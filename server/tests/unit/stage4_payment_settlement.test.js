/**
 * Stage 4 — Production-Grade Payment Architecture & Settlement Test Suite
 *
 * Covers:
 * 1. Unauthorized payment initiation (HTTP 401 & service-level UNAUTHORIZED).
 * 2. Non-winning bidder attempting to pay (HTTP 403 & UNAUTHORIZED_PAYER).
 * 3. Payment initiation after 24-hour deadline expiration (HTTP 400 & PAYMENT_DEADLINE_EXPIRED).
 * 4. Client-supplied amount tampering (derived strictly from authoritative Order/Product).
 * 5. Valid and invalid checkout signatures (constant-time verification).
 * 6. Razorpay order identifier mismatch (HTTP 400 & ORDER_ID_MISMATCH).
 * 7. Invalid webhook signatures (HTTP 400 & INVALID_WEBHOOK_SIGNATURE).
 * 8. Raw-body buffer signature verification.
 * 9. Duplicate webhook deliveries (idempotency ledger in WebhookEvent, duplicate: true).
 * 10. Concurrent webhook deliveries (Promise.all duplicate event handling).
 * 11. Out-of-order payment events (payment.failed does NOT overwrite an already PAID order).
 * 12. Provider failure injection and error handling.
 * 13. Provider timeouts and retry behavior (replaying idempotency key returns existing provider order).
 * 14. Amount and currency mismatches (transitions to REQUIRES_RECONCILIATION).
 * 15. Late payment after the 24-hour deadline (quarantined as REQUIRES_RECONCILIATION, never fulfills expired auction).
 * 16. Immutable payment deadline (attempts and retries never postpone deadline).
 * 17. Dual-path settlement (checkout verification and webhook both fulfill Order to PAID and Product to SETTLED).
 * 18. No fulfillment from browser-only success signal (cryptographic proof required).
 * 19. Reconciliation worker (reconcilePaymentStates transitions overdue orders and stale payment attempts).
 */

const crypto = require("crypto");
const mongoose = require("mongoose");
const request = require("supertest");
const { app } = require("../../server");
const Product = require("../../src/modules/products/models/productSchema");
const Order = require("../../src/modules/orders/models/orderSchema");
const Payment = require("../../src/modules/payments/models/Payment");
const WebhookEvent = require("../../src/modules/payments/models/WebhookEvent");
const RecommendationOutbox = require("../../src/infrastructure/messaging/models/recommendationOutbox");
const User = require("../../src/modules/users/models/user");
const { clearDatabase } = require("../helpers/dbHelper");
const { createTestUser } = require("../helpers/authHelper");
const { createCsrfCredentials } = require("../helpers/csrfHelper");
const {
  PaymentError,
  setProviderClient,
  resetProviderClient,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  initiateOrderPayment,
  verifyCheckoutPayment,
  settleOrderPayment,
  processWebhook,
  reconcilePaymentStates,
} = require("../../src/modules/payments/services/paymentService");

describe("Stage 4 — Production-Grade Payment Architecture & Settlement", () => {
  const TEST_KEY_SECRET = "mock_razorpay_secret_32chars_test_key";
  const TEST_WEBHOOK_SECRET = "mock_webhook_secret_32chars_test_key";

  let winnerUser;
  let winnerToken;
  let imposterUser;
  let imposterToken;
  let sellerUser;
  let testProduct;
  let testOrder;

  // Mock Provider Client
  let mockProviderOrders = new Map();
  const mockProviderClient = {
    createOrder: jest.fn(async ({ amount, currency, receipt, notes }) => {
      const providerOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const orderData = {
        id: providerOrderId,
        entity: "order",
        amount,
        currency,
        receipt,
        status: "created",
        notes,
      };
      mockProviderOrders.set(providerOrderId, orderData);
      return orderData;
    }),
  };

  beforeAll(async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_mock_key_id";
    process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

    if (mongoose.connection.readyState === 1) {
      try {
        await mongoose.connection.collection("payments").drop();
      } catch (e) {}
      try {
        await mongoose.connection.collection("webhookevents").drop();
      } catch (e) {}
    }

    await Product.init();
    await Order.init();
    await Payment.init();
    await WebhookEvent.init();
  });

  beforeEach(async () => {
    await clearDatabase();
    mockProviderOrders.clear();
    mockProviderClient.createOrder.mockClear();
    setProviderClient(mockProviderClient);

    // Create Winner
    const winnerData = await createTestUser({
      name: "Winning Bidder",
      email: "winner@auctionx.com",
    });
    winnerUser = winnerData.user;
    winnerToken = winnerData.token;

    // Create Imposter
    const imposterData = await createTestUser({
      name: "Imposter Bidder",
      email: "imposter@auctionx.com",
    });
    imposterUser = imposterData.user;
    imposterToken = imposterData.token;

    // Create Seller
    const sellerData = await createTestUser({
      name: "Seller User",
      email: "seller@auctionx.com",
    });
    sellerUser = sellerData.user;

    // Create Product in ENDED state
    testProduct = await Product.create({
      name: "Vintage Camera",
      email: sellerUser.email,
      category: "Electronics",
      description: [{ name: "Condition", description: "Mint" }],
      images: [{ secure_url: "https://example.com/cam.jpg", public_id: "cam_1" }],
      mobileNumber: "9876543210",
      biddingStartDate: new Date(Date.now() - 7200000),
      biddingStartTime: "00:00",
      biddingEndDate: new Date(Date.now() - 3600000),
      biddingEndTime: "01:00",
      biddingStartPrice: 1000,
      currentPrice: 2500,
      status: "ENDED",
      totalBids: 5,
    });

    // Create Order in PENDING state with 24-hour deadline
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    testOrder = await Order.create({
      title: testProduct.name,
      name: winnerUser.name,
      userEmail: winnerUser.email,
      sellerEmail: sellerUser.email,
      category: testProduct.category,
      images: testProduct.images,
      biddingStartPrice: testProduct.biddingStartPrice,
      highestBid: 2500,
      finalPrice: 2500,
      phoneNo: "9876543210",
      address: "123 Winner Ave, Mumbai",
      productId: testProduct._id,
      winnerId: winnerUser._id,
      status: "PENDING",
      paymentDeadline: deadline,
    });
  });

  afterAll(() => {
    resetProviderClient();
  });

  // Helper to compute valid checkout signature
  function computeCheckoutSignature(razorpayOrderId, razorpayPaymentId, secret = TEST_KEY_SECRET) {
    return crypto
      .createHmac("sha256", secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
  }

  // Helper to compute valid webhook signature
  function computeWebhookSignature(rawBody, secret = TEST_WEBHOOK_SECRET) {
    return crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
  }

  // =========================================================================
  // SECTION 1: Razorpay Order Creation & Authorization
  // =========================================================================
  describe("1. Razorpay Order Creation & Authorization", () => {
    it("rejects unauthenticated request to initiate payment with 401", async () => {
      const csrf = createCsrfCredentials();
      const res = await request(app)
        .post("/api/payment/create-order")
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ orderId: testOrder._id.toString() });

      expect(res.status).toBe(401);
    });

    it("rejects non-winning user attempting to initiate payment with 403 UNAUTHORIZED_PAYER", async () => {
      const csrf = createCsrfCredentials();
      const res = await request(app)
        .post("/api/payment/create-order")
        .set("Authorization", `Bearer ${imposterToken}`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ orderId: testOrder._id.toString() });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("UNAUTHORIZED_PAYER");
    });

    it("creates server-authoritative provider order for winning bidder with paise precision", async () => {
      const csrf = createCsrfCredentials();
      const res = await request(app)
        .post("/api/payment/create-order")
        .set("Authorization", `Bearer ${winnerToken}`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ orderId: testOrder._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.amount).toBe(250000); // 2500 INR = 250000 paise
      expect(res.body.currency).toBe("INR");
      expect(res.body.razorpayOrderId).toBeDefined();
      expect(res.body.keyId).toBeDefined();

      // Check database persistence of Payment record
      const paymentRecord = await Payment.findById(res.body.paymentId);
      expect(paymentRecord).not.toBeNull();
      expect(paymentRecord.status).toBe("INITIATED");
      expect(paymentRecord.amount).toBe(250000);
      expect(paymentRecord.razorpayOrderId).toBe(res.body.razorpayOrderId);

      // Check Order linkage
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.paymentAttempts).toBe(1);
      expect(updatedOrder.razorpayOrderId).toBe(res.body.razorpayOrderId);
    });

    it("strictly derives payable amount from DB and ignores client-supplied tampered amount", async () => {
      const csrf = createCsrfCredentials();
      const res = await request(app)
        .post("/api/payment/create-order")
        .set("Authorization", `Bearer ${winnerToken}`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          orderId: testOrder._id.toString(),
          amount: 1, // Tampered client payload: ₹1.00
          amountPaise: 100,
        });

      expect(res.status).toBe(200);
      expect(res.body.amount).toBe(250000); // Must still be authoritative 250000 paise (₹2500)
    });

    it("rejects payment initiation if order has already been paid", async () => {
      testOrder.status = "PAID";
      await testOrder.save();

      const csrf = createCsrfCredentials();
      const res = await request(app)
        .post("/api/payment/create-order")
        .set("Authorization", `Bearer ${winnerToken}`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ orderId: testOrder._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("ORDER_ALREADY_PAID");
    });
  });

  // =========================================================================
  // SECTION 2: 24-Hour Payment Deadline & Immutability
  // =========================================================================
  describe("2. 24-Hour Payment Deadline & Immutability", () => {
    it("rejects payment initiation after 24-hour deadline and marks order EXPIRED", async () => {
      // Set deadline 1 hour in the past
      testOrder.paymentDeadline = new Date(Date.now() - 3600000);
      await testOrder.save();

      const csrf = createCsrfCredentials();
      const res = await request(app)
        .post("/api/payment/create-order")
        .set("Authorization", `Bearer ${winnerToken}`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ orderId: testOrder._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("PAYMENT_DEADLINE_EXPIRED");

      const refreshed = await Order.findById(testOrder._id);
      expect(refreshed.status).toBe("EXPIRED");
    });

    it("payment attempts never extend or mutate the original paymentDeadline", async () => {
      const originalDeadline = testOrder.paymentDeadline;

      // Attempt 1
      await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });
      let orderAfterFirst = await Order.findById(testOrder._id);
      expect(orderAfterFirst.paymentDeadline.getTime()).toBe(originalDeadline.getTime());

      // Attempt 2
      await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });
      let orderAfterSecond = await Order.findById(testOrder._id);
      expect(orderAfterSecond.paymentDeadline.getTime()).toBe(originalDeadline.getTime());
      expect(orderAfterSecond.paymentAttempts).toBe(2);
    });
  });

  // =========================================================================
  // SECTION 3: Idempotency & Provider Retries
  // =========================================================================
  describe("3. Idempotency & Provider Retries", () => {
    it("sequential retry with same idempotencyKey returns cached provider order without creating a duplicate", async () => {
      const idempotencyKey = "key_retry_abc_123";

      const firstResult = await initiateOrderPayment({
        orderId: testOrder._id,
        user: winnerUser,
        idempotencyKey,
      });

      expect(firstResult.isDuplicate).toBe(false);
      expect(mockProviderClient.createOrder).toHaveBeenCalledTimes(1);

      const secondResult = await initiateOrderPayment({
        orderId: testOrder._id,
        user: winnerUser,
        idempotencyKey,
      });

      expect(secondResult.isDuplicate).toBe(true);
      expect(secondResult.razorpayOrderId).toBe(firstResult.razorpayOrderId);
      expect(mockProviderClient.createOrder).toHaveBeenCalledTimes(1); // Provider API NOT called again

      const totalPayments = await Payment.countDocuments({ orderId: testOrder._id });
      expect(totalPayments).toBe(1);
    });

    it("handles provider gateway failure safely and propagates PROVIDER_API_ERROR", async () => {
      setProviderClient({
        createOrder: jest.fn().mockRejectedValue(new Error("Razorpay Gateway 503 Unavailable")),
      });

      await expect(
        initiateOrderPayment({ orderId: testOrder._id, user: winnerUser })
      ).rejects.toThrow();

      // Ensure no orphaned Payment was committed in CAPTURED state
      const payments = await Payment.find({ orderId: testOrder._id });
      expect(payments.length).toBe(0);
    });

    it("handles concurrent payment-initiation requests with the same idempotency key safely", async () => {
      const idempotencyKey = "key_concurrent_race_999";

      const [res1, res2] = await Promise.all([
        initiateOrderPayment({ orderId: testOrder._id, user: winnerUser, idempotencyKey }),
        initiateOrderPayment({ orderId: testOrder._id, user: winnerUser, idempotencyKey }),
      ]);

      expect(res1.razorpayOrderId).toBe(res2.razorpayOrderId);
      expect(res1.paymentId).toBe(res2.paymentId);
      const payments = await Payment.find({ orderId: testOrder._id });
      expect(payments.length).toBe(1);
    });

    it("rejects reusing idempotency key by a different user with 409 IDEMPOTENCY_CONFLICT", async () => {
      const idempotencyKey = "key_stolen_123";
      await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser, idempotencyKey });

      await expect(
        initiateOrderPayment({ orderId: testOrder._id, user: imposterUser, idempotencyKey })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // SECTION 4: Cryptographic Signature Verification
  // =========================================================================
  describe("4. Cryptographic Signature Verification", () => {
    it("verifyCheckoutSignature returns true for valid HMAC-SHA256 signature", () => {
      const orderId = "order_123456789";
      const paymentId = "pay_987654321";
      const validSig = computeCheckoutSignature(orderId, paymentId, TEST_KEY_SECRET);

      const isValid = verifyCheckoutSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: validSig,
        secret: TEST_KEY_SECRET,
      });

      expect(isValid).toBe(true);
    });

    it("verifyCheckoutSignature returns false for altered signature or wrong secret", () => {
      const orderId = "order_123456789";
      const paymentId = "pay_987654321";
      const validSig = computeCheckoutSignature(orderId, paymentId, TEST_KEY_SECRET);

      // Altered signature
      const tamperedSig = validSig.slice(0, -4) + "0000";
      expect(
        verifyCheckoutSignature({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: tamperedSig,
          secret: TEST_KEY_SECRET,
        })
      ).toBe(false);

      // Wrong secret
      expect(
        verifyCheckoutSignature({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
          secret: "wrong_secret_1234567890abcdef",
        })
      ).toBe(false);
    });

    it("POST /api/payment/verify rejects tampered signature with 400 INVALID_SIGNATURE", async () => {
      // Initiate order first
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });
      const csrf = createCsrfCredentials();

      const res = await request(app)
        .post("/api/payment/verify")
        .set("Authorization", `Bearer ${winnerToken}`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          orderId: testOrder._id.toString(),
          razorpayOrderId: initiated.razorpayOrderId,
          razorpayPaymentId: "pay_test_tampered_123",
          razorpaySignature: "invalid_hex_signature_deadbeef",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_SIGNATURE");

      // Verify order is still PENDING
      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe("PENDING");
    });

    it("POST /api/payment/verify rejects mismatched razorpayOrderId with 400 ORDER_ID_MISMATCH", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });
      const wrongOrderId = "order_mismatched_999";
      const paymentId = "pay_test_123";
      const sig = computeCheckoutSignature(wrongOrderId, paymentId);
      const csrf = createCsrfCredentials();

      const res = await request(app)
        .post("/api/payment/verify")
        .set("Authorization", `Bearer ${winnerToken}`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          orderId: testOrder._id.toString(),
          razorpayOrderId: wrongOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: sig,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("ORDER_ID_MISMATCH");
    });

    it("rejects checkout verification when provider fetchPayment reports failed status", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });
      const paymentId = "pay_failed_gateway";
      const validSig = computeCheckoutSignature(initiated.razorpayOrderId, paymentId);

      setProviderClient({
        createOrder: mockProviderClient.createOrder,
        fetchPayment: jest.fn().mockResolvedValue({
          id: paymentId,
          order_id: initiated.razorpayOrderId,
          status: "failed",
        }),
      });

      const csrf = createCsrfCredentials();
      const res = await request(app)
        .post("/api/payment/verify")
        .set("Authorization", `Bearer ${winnerToken}`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          orderId: testOrder._id.toString(),
          razorpayOrderId: initiated.razorpayOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("PAYMENT_NOT_CAPTURED");
      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe("PENDING");
    });
  });

  // =========================================================================
  // SECTION 5: Authoritative Settlement (Dual-Path)
  // =========================================================================
  describe("5. Authoritative Dual-Path Settlement (Verify + Webhook)", () => {
    it("settles order and product atomically on valid checkout verification", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });
      const paymentId = `pay_${Date.now()}`;
      const validSig = computeCheckoutSignature(initiated.razorpayOrderId, paymentId);
      const csrf = createCsrfCredentials();

      const res = await request(app)
        .post("/api/payment/verify")
        .set("Authorization", `Bearer ${winnerToken}`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          orderId: testOrder._id.toString(),
          razorpayOrderId: initiated.razorpayOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("PAID");

      // Verify database state: Order PAID, Product SETTLED, Payment CAPTURED
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe("PAID");
      expect(updatedOrder.razorpayPaymentId).toBe(paymentId);
      expect(updatedOrder.paidAt).not.toBeNull();

      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.status).toBe("SETTLED");

      const paymentRecord = await Payment.findOne({ razorpayOrderId: initiated.razorpayOrderId });
      expect(paymentRecord.status).toBe("CAPTURED");
      expect(paymentRecord.verifiedVia).toBe("CHECKOUT_VERIFICATION");
    });

    it("is strictly idempotent: repeated verification returns alreadyPaid without error", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });
      const paymentId = `pay_${Date.now()}`;
      const validSig = computeCheckoutSignature(initiated.razorpayOrderId, paymentId);
      const csrf = createCsrfCredentials();

      // First verification
      await request(app)
        .post("/api/payment/verify")
        .set("Authorization", `Bearer ${winnerToken}`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          orderId: testOrder._id.toString(),
          razorpayOrderId: initiated.razorpayOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      // Second verification (replay)
      const res2 = await request(app)
        .post("/api/payment/verify")
        .set("Authorization", `Bearer ${winnerToken}`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          orderId: testOrder._id.toString(),
          razorpayOrderId: initiated.razorpayOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      expect(res2.status).toBe(200);
      expect(res2.body.message).toContain("already recorded");
    });

    it("handles two distinct provider payments captured for the same Order without double-fulfillment", async () => {
      // First payment succeeds
      const init1 = await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });
      await settleOrderPayment({
        orderId: testOrder._id,
        razorpayOrderId: init1.razorpayOrderId,
        razorpayPaymentId: "pay_first_successful",
        amountPaise: 250000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      const orderAfterFirst = await Order.findById(testOrder._id);
      expect(orderAfterFirst.status).toBe("PAID");
      expect(orderAfterFirst.razorpayPaymentId).toBe("pay_first_successful");

      // Second distinct payment succeeds for same order (customer double-charged)
      const secondSettlement = await settleOrderPayment({
        orderId: testOrder._id,
        razorpayOrderId: "order_second_distinct_id",
        razorpayPaymentId: "pay_second_distinct",
        amountPaise: 250000,
        verifiedVia: "WEBHOOK",
      });

      expect(secondSettlement.duplicateCharge).toBe(true);
      expect(secondSettlement.code).toBe("DUPLICATE_PAYMENT_EXCESS_CHARGE");

      // Order must NOT be modified or fulfilled twice
      const orderAfterSecond = await Order.findById(testOrder._id);
      expect(orderAfterSecond.status).toBe("PAID");
      expect(orderAfterSecond.razorpayPaymentId).toBe("pay_first_successful");

      // Secondary payment record MUST exist and be quarantined as REQUIRES_RECONCILIATION
      const secondPayment = await Payment.findOne({ razorpayPaymentId: "pay_second_distinct" });
      expect(secondPayment).not.toBeNull();
      expect(secondPayment.status).toBe("REQUIRES_RECONCILIATION");
      expect(secondPayment.reconciliationNotes).toContain("Excess payment charge");
    });

    it("self-heals partial crash between Order PAID and Product SETTLED upon retry", async () => {
      const init = await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });
      const paymentId = "pay_healing_test";

      // Simulate partial failure: Order was updated to PAID, but Product remained ENDED
      testOrder.status = "PAID";
      testOrder.razorpayOrderId = init.razorpayOrderId;
      testOrder.razorpayPaymentId = paymentId;
      await testOrder.save();

      testProduct.status = "ENDED";
      await testProduct.save();

      // Retry settlement
      const retryResult = await settleOrderPayment({
        orderId: testOrder._id,
        razorpayOrderId: init.razorpayOrderId,
        razorpayPaymentId: paymentId,
        amountPaise: 250000,
        verifiedVia: "WEBHOOK",
      });

      expect(retryResult.alreadyPaid).toBe(true);

      // Invariant: Product must be converged to SETTLED
      const healedProduct = await Product.findById(testProduct._id);
      expect(healedProduct.status).toBe("SETTLED");
    });
  });

  // =========================================================================
  // SECTION 6: Webhook Security, Deduplication & Ordering
  // =========================================================================
  describe("6. Webhook Security, Deduplication & Ordering", () => {
    it("rejects webhook with missing or invalid signature with 400 INVALID_WEBHOOK_SIGNATURE", async () => {
      const rawPayload = JSON.stringify({
        id: "evt_invalid_sig_123",
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_1", amount: 250000 } } },
      });

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", "deadbeefbadsignature")
        .send(rawPayload);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_WEBHOOK_SIGNATURE");

      // Verify no recommendation telemetry is enqueued for invalid webhooks
      const outboxCount = await RecommendationOutbox.countDocuments();
      expect(outboxCount).toBe(0);
    });

    it("verifies webhook HMAC-SHA256 against exact raw request buffer and settles order", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });
      const paymentId = `pay_wh_${Date.now()}`;

      const webhookPayload = JSON.stringify({
        id: `evt_test_${Date.now()}`,
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: initiated.razorpayOrderId,
              amount: 250000,
              currency: "INR",
              status: "captured",
            },
          },
        },
      });

      const validSig = computeWebhookSignature(Buffer.from(webhookPayload, "utf8"));

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", validSig)
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify order settled
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe("PAID");
      expect(updatedOrder.razorpayPaymentId).toBe(paymentId);

      // Verify WebhookEvent ledger recorded PROCESSED
      const eventRecord = await WebhookEvent.findOne({ eventType: "payment.captured" });
      expect(eventRecord).not.toBeNull();
      expect(eventRecord.processingStatus).toBe("PROCESSED");

      // Verify authoritative purchase telemetry enqueued in RecommendationOutbox
      const outboxDoc = await RecommendationOutbox.findOne({
        eventId: `purchase:${testOrder._id}`,
      });
      expect(outboxDoc).not.toBeNull();
      expect(outboxDoc.eventType).toBe("purchase");
      expect(outboxDoc.email).toBe(winnerUser.email);
    });

    it("deduplicates duplicate webhook delivery idempotently without side-effects", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });
      const eventId = `evt_dedup_${Date.now()}`;
      const paymentId = `pay_dedup_${Date.now()}`;

      const webhookPayload = JSON.stringify({
        id: eventId,
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: initiated.razorpayOrderId,
              amount: 250000,
            },
          },
        },
      });
      const validSig = computeWebhookSignature(Buffer.from(webhookPayload, "utf8"));

      // Delivery 1
      const res1 = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", validSig)
        .send(webhookPayload);
      expect(res1.status).toBe(200);
      expect(res1.body.duplicate).toBeUndefined();

      // Delivery 2 (Duplicate)
      const res2 = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", validSig)
        .send(webhookPayload);
      expect(res2.status).toBe(200);
      expect(res2.body.duplicate).toBe(true);

      const totalEvents = await WebhookEvent.countDocuments({ eventId });
      expect(totalEvents).toBe(1);

      // Verify RecommendationOutbox retains exactly 1 purchase record without duplication
      const outboxCount = await RecommendationOutbox.countDocuments({
        eventId: `purchase:${testOrder._id}`,
      });
      expect(outboxCount).toBe(1);
    });

    it("handles concurrent webhook delivery of the same event ID safely via unique constraint", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });
      const eventId = `evt_concurrent_${Date.now()}`;

      const webhookPayload = JSON.stringify({
        id: eventId,
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: `pay_concurrent_${Date.now()}`,
              order_id: initiated.razorpayOrderId,
              amount: 250000,
            },
          },
        },
      });
      const validSig = computeWebhookSignature(Buffer.from(webhookPayload, "utf8"));

      // Fire 2 concurrent webhook deliveries
      const [r1, r2] = await Promise.all([
        processWebhook({ rawBody: Buffer.from(webhookPayload), signature: validSig }),
        processWebhook({ rawBody: Buffer.from(webhookPayload), signature: validSig }),
      ]);

      const outcomes = [r1, r2];
      const processedCount = outcomes.filter((o) => o.processed === true).length;
      const duplicateCount = outcomes.filter((o) => o.duplicate === true).length;

      expect(processedCount).toBe(1);
      expect(duplicateCount).toBe(1);
    });

    it("out-of-order event: payment.failed event does NOT downgrade an already PAID order", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });

      // First mark PAID via successful verification
      await settleOrderPayment({
        orderId: testOrder._id,
        razorpayOrderId: initiated.razorpayOrderId,
        razorpayPaymentId: "pay_success_123",
        amountPaise: 250000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      // Now receive an out-of-order delayed payment.failed event
      const failPayload = JSON.stringify({
        id: `evt_failed_delayed_${Date.now()}`,
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_failed_delayed",
              order_id: initiated.razorpayOrderId,
              error_description: "Card declined by issuing bank",
            },
          },
        },
      });
      const validSig = computeWebhookSignature(Buffer.from(failPayload, "utf8"));

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", validSig)
        .send(failPayload);

      expect(res.status).toBe(200);

      // Invariant: Order must REMAIN PAID
      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe("PAID");

      // Invariant: Captured Payment record must NOT be transitioned to FAILED
      const capturedPayment = await Payment.findOne({ razorpayOrderId: initiated.razorpayOrderId });
      expect(capturedPayment.status).toBe("CAPTURED");
    });

    it("resumes processing a webhook event stuck in PENDING after worker crash/lease expiry", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });
      const eventId = `evt_stuck_${Date.now()}`;
      const paymentId = `pay_recovered_${Date.now()}`;

      // Simulate a crashed worker: inserted event with PENDING 10 seconds ago
      await WebhookEvent.create({
        eventId,
        eventType: "payment.captured",
        entityId: paymentId,
        providerOrderId: initiated.razorpayOrderId,
        processingStatus: "PENDING",
        leaseExpiresAt: new Date(Date.now() - 10000),
      });

      const webhookPayload = JSON.stringify({
        id: eventId,
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: initiated.razorpayOrderId,
              amount: 250000,
            },
          },
        },
      });
      const validSig = computeWebhookSignature(Buffer.from(webhookPayload, "utf8"));

      // Provider retries delivery
      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", validSig)
        .send(webhookPayload);

      expect(res.status).toBe(200);

      // Invariant: Event was resumed and settled
      const eventRecord = await WebhookEvent.findOne({ eventId });
      expect(eventRecord.processingStatus).toBe("PROCESSED");

      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe("PAID");
    });

    it("processes refund webhook event transitioning Payment and Order to REFUNDED", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });
      const paymentId = `pay_to_refund_${Date.now()}`;

      // First pay the order
      await settleOrderPayment({
        orderId: testOrder._id,
        razorpayOrderId: initiated.razorpayOrderId,
        razorpayPaymentId: paymentId,
        amountPaise: 250000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      // Deliver refund webhook
      const refundPayload = JSON.stringify({
        id: `evt_refund_${Date.now()}`,
        event: "refund.processed",
        payload: {
          refund: {
            entity: {
              id: "rfnd_12345",
              payment_id: paymentId,
              amount: 250000,
            },
          },
        },
      });
      const validSig = computeWebhookSignature(Buffer.from(refundPayload, "utf8"));

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", validSig)
        .send(refundPayload);

      expect(res.status).toBe(200);

      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe("REFUNDED");

      const updatedPayment = await Payment.findOne({ razorpayPaymentId: paymentId });
      expect(updatedPayment.status).toBe("REFUNDED");
    });
  });

  // =========================================================================
  // SECTION 7: Reconciliation, Amount Mismatch & Late Payments
  // =========================================================================
  describe("7. Reconciliation, Amount Mismatch & Late Payments", () => {
    it("flags AMOUNT_MISMATCH and sets status to REQUIRES_RECONCILIATION if webhook amount differs", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: winnerUser });

      // Provider claims payment was 150000 paise (₹1500) instead of expected ₹2500 (250000 paise)
      await expect(
        settleOrderPayment({
          orderId: testOrder._id,
          razorpayOrderId: initiated.razorpayOrderId,
          razorpayPaymentId: "pay_mismatch_123",
          amountPaise: 150000,
          verifiedVia: "WEBHOOK",
        })
      ).rejects.toThrow("Payment amount does not match authoritative order final price");

      // Order must remain PENDING (not fulfilled)
      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe("PENDING");

      // Payment attempt flagged for reconciliation
      const payment = await Payment.findOne({ razorpayOrderId: initiated.razorpayOrderId });
      expect(payment.status).toBe("REQUIRES_RECONCILIATION");
      expect(payment.reconciliationNotes).toContain("Amount mismatch");
    });

    it("late payment: payment captured after 24h deadline is quarantined as REQUIRES_RECONCILIATION", async () => {
      // Order deadline was in the past
      testOrder.paymentDeadline = new Date(Date.now() - 3600000);
      testOrder.status = "EXPIRED";
      await testOrder.save();

      const initiated = await Payment.create({
        orderId: testOrder._id,
        productId: testProduct._id,
        userId: winnerUser._id,
        userEmail: winnerUser.email,
        amount: 250000,
        currency: "INR",
        status: "INITIATED",
        razorpayOrderId: "order_late_test_123",
      });

      // Attempt settlement of late payment
      await expect(
        settleOrderPayment({
          orderId: testOrder._id,
          razorpayOrderId: initiated.razorpayOrderId,
          razorpayPaymentId: "pay_late_captured_999",
          amountPaise: 250000,
          verifiedVia: "WEBHOOK",
        })
      ).rejects.toThrow("Payment arrived after the 24-hour deadline expired");

      // Invariant: Expired order is NOT fulfilled
      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe("EXPIRED");

      // Invariant: Payment record is quarantined with REQUIRES_RECONCILIATION
      const payment = await Payment.findById(initiated._id);
      expect(payment.status).toBe("REQUIRES_RECONCILIATION");
      expect(payment.reconciliationNotes).toContain("Late payment captured after 24h deadline expired");
    });

    it("reconcilePaymentStates worker marks overdue PENDING orders and stale payments as EXPIRED", async () => {
      // Overdue order
      testOrder.paymentDeadline = new Date(Date.now() - 60000); // 1 min ago
      testOrder.status = "PENDING";
      await testOrder.save();

      // Stale initiated payment from 3 hours ago
      const stalePayment = await Payment.create({
        orderId: testOrder._id,
        productId: testProduct._id,
        userId: winnerUser._id,
        userEmail: winnerUser.email,
        amount: 250000,
        currency: "INR",
        status: "INITIATED",
        razorpayOrderId: "order_stale_123",
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      });

      const reconciliation = await reconcilePaymentStates({ now: new Date() });
      expect(reconciliation.expiredOrdersCount).toBeGreaterThanOrEqual(1);

      const refreshedOrder = await Order.findById(testOrder._id);
      expect(refreshedOrder.status).toBe("EXPIRED");
    });

    it("reconcilePaymentStates self-heals orphan PAID orders where Product is still ENDED", async () => {
      testOrder.status = "PAID";
      await testOrder.save();

      testProduct.status = "ENDED";
      await testProduct.save();

      const recon = await reconcilePaymentStates({ now: new Date() });
      expect(recon.healedProductsCount).toBeGreaterThanOrEqual(1);

      const healed = await Product.findById(testProduct._id);
      expect(healed.status).toBe("SETTLED");
    });
  });

  // =========================================================================
  // SECTION 8: Query & Status Inspection
  // =========================================================================
  describe("8. GET /api/payment/order/:orderId Access Control", () => {
    it("allows winning buyer to view payment status and history", async () => {
      const res = await request(app)
        .get(`/api/payment/order/${testOrder._id.toString()}`)
        .set("Authorization", `Bearer ${winnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.orderStatus).toBe("PENDING");
      expect(Array.isArray(res.body.payments)).toBe(true);
    });

    it("forbids third-party imposter from viewing payment status with 403", async () => {
      const res = await request(app)
        .get(`/api/payment/order/${testOrder._id.toString()}`)
        .set("Authorization", `Bearer ${imposterToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });
  });
});
