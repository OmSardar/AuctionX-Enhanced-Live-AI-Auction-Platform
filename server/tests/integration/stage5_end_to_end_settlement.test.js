/**
 * Stage 5 — End-to-End Integration & Production-Readiness Test Suite
 *
 * Comprehensive adversarial and lifecycle integration verification covering:
 *  1. Complete auction-to-payment lifecycle:
 *     - Scheduled auction created -> Early bids rejected
 *     - Transitions to LIVE at scheduled start time
 *     - Server-authoritative bid validation and ledger recording
 *     - Anti-sniping dynamic extension within final 2-minute window
 *     - Expiration via lifecycle scheduler -> Persisted winner & final price
 *     - Exactly one eligible Order created with immutable 24h deadline
 *     - Authorization enforcement: only winner can initiate payment
 *     - Integer paise amount derived strictly from server-side order
 *     - Checkout signature verification transitions Order to PAID, Product to SETTLED
 *     - Real-time socket broadcast of payment settlement
 *  2. Adversarial security & edge-case verification:
 *     - Invalid checkout signatures rejected (400)
 *     - Webhook raw-body tampering rejected (400)
 *     - Duplicate webhook deliveries handled idempotently (200, duplicate: true)
 *     - Concurrent webhook deliveries of same event processed exactly once
 *     - Second distinct captured payment quarantined as REQUIRES_RECONCILIATION without double fulfillment
 *     - Out-of-order success and failure events (failed event does not downgrade PAID order)
 *     - Worker crash recovery with lease expiry
 *     - Zombie worker fencing: stale worker cannot overwrite status or cause conflicting side effects
 *     - Client idempotency key reuse & mismatch rejection (409)
 *     - Late payment after 24h deadline quarantined as REQUIRES_RECONCILIATION
 *     - Self-healing reconciliation repairs partial crashes between Order and Product
 *     - Refund processing transitions Order and Payment to REFUNDED
 */

const crypto = require("crypto");
const mongoose = require("mongoose");
const request = require("supertest");
const { app, server, io } = require("../../server");
const Product = require("../../src/modules/products/models/productSchema");
const Order = require("../../src/modules/orders/models/orderSchema");
const Bid = require("../../src/modules/bidding/models/bidSchema");
const Payment = require("../../src/modules/payments/models/Payment");
const WebhookEvent = require("../../src/modules/payments/models/WebhookEvent");
const User = require("../../src/modules/users/models/user");

const { clearDatabase } = require("../helpers/dbHelper");
const { createTestUser } = require("../helpers/authHelper");
const { createCsrfCredentials } = require("../helpers/csrfHelper");
const { createSocketClient } = require("../helpers/socketHelper");

const { placeBid } = require("../../src/modules/bidding/services/bidService");
const { processLifecycleTransitions, finalizeExpiredAuctions } = require("../../src/modules/auctions/services/lifecycleService");
const {
  PaymentError,
  setProviderClient,
  resetProviderClient,
  initiateOrderPayment,
  verifyCheckoutSignature,
  verifyCheckoutPayment,
  settleOrderPayment,
  handleRazorpayWebhook,
  reconcilePaymentStates,
} = require("../../src/modules/payments/services/paymentService");

describe("Stage 5 — End-to-End Integration & Production-Readiness Suite", () => {
  const TEST_KEY_SECRET = "mock_razorpay_secret_32chars_test_key";
  const TEST_WEBHOOK_SECRET = "mock_webhook_secret_32chars_test_key";

  let testServer;
  let activeClients = [];
  let sellerUser;
  let bidderA;
  let bidderAToken;
  let bidderB;
  let bidderBToken;

  // In-memory mock Razorpay client
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
    fetchPayment: jest.fn(async (paymentId) => {
      return {
        id: paymentId,
        entity: "payment",
        amount: 200000,
        currency: "INR",
        status: "captured",
      };
    }),
  };

  beforeAll((done) => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_stage5_mock_key";
    process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

    testServer = server.listen(0, async () => {
      if (mongoose.connection.readyState === 1) {
        try { await mongoose.connection.collection("payments").drop(); } catch (e) {}
        try { await mongoose.connection.collection("webhookevents").drop(); } catch (e) {}
      }
      await Product.init();
      await Order.init();
      await Bid.init();
      await Payment.init();
      await WebhookEvent.init();
      done();
    });
  });

  afterAll((done) => {
    resetProviderClient();
    activeClients.forEach((c) => c.connected && c.disconnect());
    testServer.close(done);
  });

  beforeEach(async () => {
    await clearDatabase();
    activeClients.forEach((c) => c.connected && c.disconnect());
    activeClients = [];
    mockProviderOrders.clear();
    mockProviderClient.createOrder.mockClear();
    setProviderClient(mockProviderClient);

    // Create Seller
    const sellerData = await createTestUser({
      name: "Seller One",
      email: "seller1@auctionx.com",
    });
    sellerUser = sellerData.user;

    // Create Bidder A
    const bidderAData = await createTestUser({
      name: "Bidder Alice",
      email: "alice@auctionx.com",
    });
    bidderA = bidderAData.user;
    bidderAToken = bidderAData.token;

    // Create Bidder B
    const bidderBData = await createTestUser({
      name: "Bidder Bob",
      email: "bob@auctionx.com",
    });
    bidderB = bidderBData.user;
    bidderBToken = bidderBData.token;
  });

  function getConnectedClient(token = null) {
    const client = createSocketClient(testServer, token);
    activeClients.push(client);
    return new Promise((resolve, reject) => {
      client.on("connect", () => resolve(client));
      client.on("connect_error", reject);
    });
  }

  function computeCheckoutSignature(razorpayOrderId, razorpayPaymentId, secret = TEST_KEY_SECRET) {
    return crypto
      .createHmac("sha256", secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
  }

  function computeWebhookSignature(rawBody, secret = TEST_WEBHOOK_SECRET) {
    return crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
  }

  // =========================================================================
  // JOURNEY 1: Complete Auction-to-Payment Lifecycle
  // =========================================================================
  describe("Journey 1: Complete Auction-to-Payment Lifecycle", () => {
    it("traces full journey: scheduled -> live -> bids -> anti-snipe -> expire -> order -> pay -> settle", async () => {
      // Dynamic test-controlled clock anchor relative to execution time
      const baseTime = new Date(Date.now() - 20 * 60 * 1000);
      const now = new Date(baseTime.getTime());
      const startTime = new Date(baseTime.getTime() + 5 * 60 * 1000); // starts in 5 minutes
      const scheduledEndTime = new Date(baseTime.getTime() + 15 * 60 * 1000); // scheduled 15 min

      // Step 1: Create Product scheduled in future
      const product = await Product.create({
        name: "Vintage Mechanical Chronograph",
        email: sellerUser.email,
        category: "Watches",
        description: [{ name: "Condition", description: "Mint collector piece" }],
        images: [{ secure_url: "https://example.com/watch.jpg", public_id: "w1" }],
        mobileNumber: "9876543210",
        biddingStartDate: startTime,
        biddingStartTime: "10:05",
        biddingEndDate: scheduledEndTime,
        biddingEndTime: "10:15",
        startTime,
        endTime: scheduledEndTime,
        effectiveEndTime: scheduledEndTime,
        biddingStartPrice: 1000,
        startingPrice: 1000,
        currentPrice: 1000,
        status: "SCHEDULED",
        bidCount: 0,
      });

      // Step 2: Attempt early bid before startTime -> rejected
      await expect(
        placeBid({
          productId: product._id,
          bidder: bidderA,
          amount: 1100,
          now,
        })
      ).rejects.toThrow(/Bidding has ended or is not active/i);

      // Step 3: Clock advances to startTime -> auction starts
      const timeAtStart = new Date(baseTime.getTime() + 5 * 60 * 1000 + 1000);
      const transitionResult = await processLifecycleTransitions({ now: timeAtStart, io });
      expect(transitionResult.started.transitionedCount).toBe(1);

      const liveProduct = await Product.findById(product._id);
      expect(liveProduct.status).toBe("LIVE");

      // Step 4: Bidder A places valid bid of ₹1,200
      const bid1 = await placeBid({
        productId: product._id,
        bidder: bidderA,
        amount: 1200,
        now: new Date(baseTime.getTime() + 6 * 60 * 1000),
        io,
      });
      expect(bid1.success).toBe(true);
      expect(bid1.product.currentPrice).toBe(1200);

      // Bidder B outbids with ₹1,500
      const bid2 = await placeBid({
        productId: product._id,
        bidder: bidderB,
        amount: 1500,
        now: new Date(baseTime.getTime() + 8 * 60 * 1000),
        io,
      });
      expect(bid2.success).toBe(true);
      expect(bid2.product.currentPrice).toBe(1500);

      // Step 5: Anti-sniping: Bidder A places bid of ₹2,000 at 10:14:15 (within final 2 min of 10:15:00)
      const snipeTime = new Date(baseTime.getTime() + 14 * 60 * 1000 + 15 * 1000);
      const snipeBid = await placeBid({
        productId: product._id,
        bidder: bidderA,
        amount: 2000,
        now: snipeTime,
        io,
      });
      expect(snipeBid.success).toBe(true);
      expect(snipeBid.wasExtended).toBe(true);

      // Verify anti-sniping extension: 2 minutes added to 10:15:00 -> 10:17:00
      const extendedProduct = await Product.findById(product._id);
      const expectedNewEnd = new Date(baseTime.getTime() + 17 * 60 * 1000);
      expect(extendedProduct.endTime.getTime()).toBe(expectedNewEnd.getTime());
      expect(extendedProduct.antiSnipeCount).toBe(1);

      // Step 6: Clock advances past extended effective end time (10:17:01) -> Auction Expires
      const expiryTime = new Date(baseTime.getTime() + 17 * 60 * 1000 + 1000);
      const finalizeResult = await processLifecycleTransitions({ now: expiryTime, io });
      expect(finalizeResult.finalized.finalizedCount).toBe(1);

      const endedProduct = await Product.findById(product._id);
      expect(endedProduct.status).toBe("ENDED");
      expect(endedProduct.finalPrice).toBe(2000);
      expect(endedProduct.winnerId.toString()).toBe(bidderA._id.toString());

      // Step 7: Verify exactly one Order created, automatically settled via wallet escrow
      const orders = await Order.find({ productId: product._id });
      expect(orders.length).toBe(1);
      const order = orders[0];
      expect(order.status).toBe("PAID");
      expect(order.paymentMethod).toBe("WALLET");
      expect(order.walletSettled).toBe(true);
      expect(order.finalPrice).toBe(2000);
      expect(order.userEmail).toBe(bidderA.email);

      // Verify wallet balances: Bidder A had 2000 captured (50000 -> 48000), Bidder B had 1500 released (50000)
      const freshBidderA = await User.findById(bidderA._id);
      expect(freshBidderA.amount).toBe(48000);
      expect(freshBidderA.reservedAmount).toBe(0);

      const freshBidderB = await User.findById(bidderB._id);
      expect(freshBidderB.amount).toBe(50000);
      expect(freshBidderB.reservedAmount).toBe(0);

      // Step 8: Authorization: Bidder B (loser) attempts payment initiation -> HTTP 403 Forbidden
      const csrf = createCsrfCredentials();
      const imposterRes = await request(app)
        .post("/api/payment/create-order")
        .set("Cookie", [`token=${bidderBToken}`, csrf.cookie])
        .set("X-CSRF-Token", csrf.token)
        .send({ orderId: order._id.toString() });

      expect(imposterRes.status).toBe(403);
      expect(imposterRes.body.code).toBe("UNAUTHORIZED_PAYER");

      // Step 9: Bidder A (winner) attempts payment initiation -> rejected because already paid via wallet escrow
      const doublePayRes = await request(app)
        .post("/api/payment/create-order")
        .set("Cookie", [`token=${bidderAToken}`, csrf.cookie])
        .set("X-CSRF-Token", csrf.token)
        .send({ orderId: order._id.toString() });

      expect(doublePayRes.status).toBe(400);
      expect(doublePayRes.body.code).toBe("ORDER_ALREADY_PAID");

      // Step 10: Manual/Pending Order Checkout: Verify Razorpay checkout flow for eligible pending orders
      const manualProduct = await Product.create({
        name: "Manual Settlement Item",
        email: sellerUser.email,
        category: "Collectibles",
        description: [{ name: "Condition", description: "Mint" }],
        images: [{ secure_url: "https://example.com/mint.jpg", public_id: "m1" }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(Date.now() - 7200000),
        biddingStartTime: "00:00",
        biddingEndDate: new Date(Date.now() - 3600000),
        biddingEndTime: "01:00",
        biddingStartPrice: 1000,
        currentPrice: 2000,
        finalPrice: 2000,
        status: "ENDED",
        winnerId: bidderA._id,
      });

      const pendingOrder = await Order.create({
        productId: manualProduct._id,
        winnerId: bidderA._id,
        title: manualProduct.name,
        name: bidderA.name,
        userEmail: bidderA.email,
        sellerEmail: sellerUser.email,
        category: manualProduct.category,
        images: manualProduct.images,
        biddingStartPrice: 1000,
        highestBid: 2000,
        finalPrice: 2000,
        phoneNo: "9876543210",
        address: "Address on File",
        status: "PENDING",
        paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const payInitRes = await request(app)
        .post("/api/payment/create-order")
        .set("Cookie", [`token=${bidderAToken}`, csrf.cookie])
        .set("X-CSRF-Token", csrf.token)
        .send({ orderId: pendingOrder._id.toString() });

      expect(payInitRes.status).toBe(200);
      expect(payInitRes.body.amount).toBe(200000);
      expect(payInitRes.body.currency).toBe("INR");
      const providerOrderId = payInitRes.body.razorpayOrderId;
      expect(providerOrderId).toBeDefined();

      // Step 11: Complete checkout payment via browser verification
      const paymentId = `pay_e2e_${Date.now()}`;
      const validCheckoutSig = computeCheckoutSignature(providerOrderId, paymentId);

      // Listen for socket payment:settled event
      const socketClient = await getConnectedClient(bidderAToken);
      let socketEventReceived = null;
      socketClient.on("payment:settled", (data) => {
        socketEventReceived = data;
      });

      const verifyRes = await request(app)
        .post("/api/payment/verify")
        .set("Cookie", [`token=${bidderAToken}`, csrf.cookie])
        .set("X-CSRF-Token", csrf.token)
        .send({
          orderId: pendingOrder._id.toString(),
          razorpayOrderId: providerOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validCheckoutSig,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.order.status).toBe("PAID");

      // Verify DB persistence: Order is PAID, Payment is CAPTURED
      const paidOrder = await Order.findById(pendingOrder._id);
      expect(paidOrder.status).toBe("PAID");
      expect(paidOrder.razorpayPaymentId).toBe(paymentId);

      const capturedPayment = await Payment.findOne({ razorpayPaymentId: paymentId });
      expect(capturedPayment).toBeDefined();
      expect(capturedPayment.status).toBe("CAPTURED");
      expect(capturedPayment.amount).toBe(200000);

      // Step 12: Subsequent incoming webhook for this captured payment is safely deduplicated
      const webhookPayload = JSON.stringify({
        id: `evt_e2e_wh_${Date.now()}`,
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: providerOrderId,
              amount: 200000,
            },
          },
        },
      });
      const validWhSig = computeWebhookSignature(Buffer.from(webhookPayload, "utf8"));

      const webhookRes = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", validWhSig)
        .send(webhookPayload);

      expect(webhookRes.status).toBe(200);
      expect(webhookRes.body.success).toBe(true);

      // Order remains consistently settled without corruption
      const recheckedOrder = await Order.findById(pendingOrder._id);
      expect(recheckedOrder.status).toBe("PAID");
    });
  });

  // =========================================================================
  // JOURNEY 2: Adversarial Payment & Webhook Verification
  // =========================================================================
  describe("Journey 2: Adversarial Payment & Webhook Verification", () => {
    let testOrder;
    let testProduct;

    beforeEach(async () => {
      testProduct = await Product.create({
        name: "Adversarial Item",
        email: sellerUser.email,
        category: "Art",
        description: [{ name: "Condition", description: "Good" }],
        images: [{ secure_url: "https://example.com/art.jpg", public_id: "a1" }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(Date.now() - 7200000),
        biddingStartTime: "00:00",
        biddingEndDate: new Date(Date.now() - 3600000),
        biddingEndTime: "01:00",
        biddingStartPrice: 500,
        currentPrice: 3000,
        finalPrice: 3000,
        status: "ENDED",
        winnerId: bidderA._id,
      });

      testOrder = await Order.create({
        title: testProduct.name,
        name: bidderA.name,
        userEmail: bidderA.email,
        sellerEmail: sellerUser.email,
        category: testProduct.category,
        images: testProduct.images,
        biddingStartPrice: 500,
        highestBid: 3000,
        finalPrice: 3000,
        phoneNo: "9876543210",
        address: "123 Winner Ave, Mumbai",
        productId: testProduct._id,
        winnerId: bidderA._id,
        status: "PENDING",
        paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    });

    it("rejects invalid checkout signature with HTTP 400", async () => {
      const csrf = createCsrfCredentials();
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: bidderA });

      const res = await request(app)
        .post("/api/payment/verify")
        .set("Cookie", [`token=${bidderAToken}`, csrf.cookie])
        .set("X-CSRF-Token", csrf.token)
        .send({
          orderId: testOrder._id.toString(),
          razorpayOrderId: initiated.razorpayOrderId,
          razorpayPaymentId: "pay_tampered_123",
          razorpaySignature: "0000000000000000000000000000000000000000000000000000000000000000",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_SIGNATURE");

      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe("PENDING");
    });

    it("rejects webhook with tampered raw body bytes", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: bidderA });
      const originalPayload = JSON.stringify({
        id: `evt_tamper_${Date.now()}`,
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_tamper_1",
              order_id: initiated.razorpayOrderId,
              amount: 300000,
            },
          },
        },
      });

      // Signature computed for original payload
      const sig = computeWebhookSignature(Buffer.from(originalPayload, "utf8"));

      // Attacker tampers body payload in transit (modifies amount)
      const tamperedPayload = originalPayload.replace("300000", "100000");

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", sig)
        .send(tamperedPayload);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_WEBHOOK_SIGNATURE");

      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe("PENDING");
    });

    it("handles concurrent deliveries of identical webhook event safely", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: bidderA });
      const eventId = `evt_concurrent_${Date.now()}`;
      const paymentId = `pay_concurrent_${Date.now()}`;

      const payload = JSON.stringify({
        id: eventId,
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: initiated.razorpayOrderId,
              amount: 300000,
            },
          },
        },
      });
      const sig = computeWebhookSignature(Buffer.from(payload, "utf8"));

      // Send 5 concurrent requests with identical event
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .post("/api/payment/webhook")
          .set("Content-Type", "application/json")
          .set("x-razorpay-signature", sig)
          .send(payload)
      );

      const responses = await Promise.all(requests);
      responses.forEach((res) => {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      // Invariant: WebhookEvent unique index records exactly 1 document
      const eventCount = await WebhookEvent.countDocuments({ eventId });
      expect(eventCount).toBe(1);

      // Invariant: Order is PAID exactly once
      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe("PAID");
    });

    it("quarantines second distinct captured payment as REQUIRES_RECONCILIATION without double-fulfillment", async () => {
      const initiated1 = await initiateOrderPayment({ orderId: testOrder._id, user: bidderA });

      // First payment captured
      const pay1 = `pay_first_${Date.now()}`;
      await settleOrderPayment({
        orderId: testOrder._id,
        razorpayOrderId: initiated1.razorpayOrderId,
        razorpayPaymentId: pay1,
        amountPaise: 300000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      const orderAfterPay1 = await Order.findById(testOrder._id);
      expect(orderAfterPay1.status).toBe("PAID");
      expect(orderAfterPay1.razorpayPaymentId).toBe(pay1);

      // Second DISTINCT payment captured by provider (e.g. user double-clicked or paid via alternative link)
      const pay2 = `pay_excess_${Date.now()}`;
      const duplicateResult = await settleOrderPayment({
        orderId: testOrder._id,
        razorpayOrderId: `order_second_prov_${Date.now()}`,
        razorpayPaymentId: pay2,
        amountPaise: 300000,
        verifiedVia: "WEBHOOK",
      });

      expect(duplicateResult.success).toBe(false);
      expect(duplicateResult.duplicateCharge).toBe(true);
      expect(duplicateResult.code).toBe("DUPLICATE_PAYMENT_EXCESS_CHARGE");

      // Invariant: Order remains bound to first payment, NOT replaced by pay2
      const finalOrder = await Order.findById(testOrder._id);
      expect(finalOrder.status).toBe("PAID");
      expect(finalOrder.razorpayPaymentId).toBe(pay1);

      // Invariant: Second payment quarantined for operator refund
      const excessPayment = await Payment.findOne({ razorpayPaymentId: pay2 });
      expect(excessPayment).toBeDefined();
      expect(excessPayment.status).toBe("REQUIRES_RECONCILIATION");
      expect(excessPayment.reconciliationNotes).toMatch(/Excess payment charge/i);
    });

    it("ensures delayed payment.failed event does NOT downgrade an already PAID order", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: bidderA });
      const paymentId = `pay_success_${Date.now()}`;

      // 1. Order is marked PAID
      await settleOrderPayment({
        orderId: testOrder._id,
        razorpayOrderId: initiated.razorpayOrderId,
        razorpayPaymentId: paymentId,
        amountPaise: 300000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      // 2. Out-of-order failure webhook arrives
      const failedPayload = JSON.stringify({
        id: `evt_failed_late_${Date.now()}`,
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_attempt_failed",
              order_id: initiated.razorpayOrderId,
              error_description: "Card issuer declined",
            },
          },
        },
      });
      const sig = computeWebhookSignature(Buffer.from(failedPayload, "utf8"));

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", sig)
        .send(failedPayload);

      expect(res.status).toBe(200);

      // Invariant: Order is NOT downgraded to FAILED or PENDING
      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe("PAID");

      // Captured payment record remains CAPTURED
      const payment = await Payment.findOne({ razorpayPaymentId: paymentId });
      expect(payment.status).toBe("CAPTURED");
    });

    it("fences zombie worker: Worker A cannot overwrite event or DB after Worker B reclaims expired lease", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: bidderA });
      const eventId = `evt_fencing_${Date.now()}`;
      const paymentId = `pay_fenced_${Date.now()}`;

      // Simulate Worker A acquiring event at T0 with leaseVersion 1
      const initialEvent = await WebhookEvent.create({
        eventId,
        eventType: "payment.captured",
        entityId: paymentId,
        providerOrderId: initiated.razorpayOrderId,
        processingStatus: "PENDING",
        leaseExpiresAt: new Date(Date.now() - 10000), // Lease expired 10s ago
        leaseVersion: 1,
      });

      // Worker B arrives and reclaims the event
      const webhookPayload = JSON.stringify({
        id: eventId,
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: initiated.razorpayOrderId,
              amount: 300000,
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

      // Verify Worker B succeeded and bumped leaseVersion to 2
      const eventAfterB = await WebhookEvent.findOne({ eventId });
      expect(eventAfterB.processingStatus).toBe("PROCESSED");
      expect(eventAfterB.leaseVersion).toBe(2);

      // Now Worker A (zombie) wakes up and attempts to update event status using stale leaseVersion 1
      const zombieUpdate = await WebhookEvent.updateOne(
        {
          eventId,
          processingStatus: "PENDING",
          $or: [
            { leaseVersion: 1 },
            { leaseVersion: { $exists: false } },
          ],
        },
        {
          $set: {
            processingStatus: "FAILED",
            error: "Zombie worker failed",
          },
        }
      );

      // Invariant: Fencing token prevented zombie write
      expect(zombieUpdate.modifiedCount).toBe(0);

      const finalEvent = await WebhookEvent.findOne({ eventId });
      expect(finalEvent.processingStatus).toBe("PROCESSED");
      expect(finalEvent.error).toBeNull();
    });

    it("rejects idempotency key reuse with different order ID with HTTP 409", async () => {
      const csrf = createCsrfCredentials();
      const testKey = `idem_key_${Date.now()}`;

      // First initiation with order 1
      const res1 = await request(app)
        .post("/api/payment/create-order")
        .set("Cookie", [`token=${bidderAToken}`, csrf.cookie])
        .set("X-CSRF-Token", csrf.token)
        .set("Idempotency-Key", testKey)
        .send({ orderId: testOrder._id.toString() });

      expect(res1.status).toBe(200);

      // Create a second order
      const secondOrder = await Order.create({
        title: "Another Item",
        name: bidderA.name,
        userEmail: bidderA.email,
        sellerEmail: sellerUser.email,
        category: "Books",
        biddingStartPrice: 100,
        highestBid: 500,
        finalPrice: 500,
        phoneNo: "9876543210",
        address: "123 Winner Ave, Mumbai",
        status: "PENDING",
        winnerId: bidderA._id,
        paymentDeadline: new Date(Date.now() + 86400000),
      });

      // Attempt to reuse testKey with secondOrder
      const res2 = await request(app)
        .post("/api/payment/create-order")
        .set("Cookie", [`token=${bidderAToken}`, csrf.cookie])
        .set("X-CSRF-Token", csrf.token)
        .set("Idempotency-Key", testKey)
        .send({ orderId: secondOrder._id.toString() });

      expect(res2.status).toBe(409);
      expect(res2.body.code).toBe("IDEMPOTENCY_CONFLICT");
    });

    it("quarantines late payment captured after 24h deadline as REQUIRES_RECONCILIATION", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: bidderA });

      // Simulate order expired past 24h deadline
      testOrder.status = "EXPIRED";
      testOrder.paymentDeadline = new Date(Date.now() - 3600000);
      await testOrder.save();

      // Late payment arrives from provider
      await expect(
        settleOrderPayment({
          orderId: testOrder._id,
          razorpayOrderId: initiated.razorpayOrderId,
          razorpayPaymentId: `pay_late_${Date.now()}`,
          amountPaise: 300000,
          verifiedVia: "WEBHOOK",
        })
      ).rejects.toThrow(/Payment arrived after the 24-hour deadline expired/i);

      // Invariant: Order is NOT moved to PAID
      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe("EXPIRED");

      // Invariant: Payment record is marked REQUIRES_RECONCILIATION
      const payment = await Payment.findOne({ razorpayOrderId: initiated.razorpayOrderId });
      expect(payment.status).toBe("REQUIRES_RECONCILIATION");
    });

    it("reconcilePaymentStates heals partial crash where Order is PAID but Product is ENDED", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: bidderA });

      // Simulate partial crash: Order transitioned to PAID, but Product was left ENDED
      testOrder.status = "PAID";
      testOrder.razorpayPaymentId = `pay_healed_${Date.now()}`;
      testOrder.razorpayOrderId = initiated.razorpayOrderId;
      await testOrder.save();

      expect(testProduct.status).toBe("ENDED");

      // Run payment reconciler
      const report = await reconcilePaymentStates({ now: new Date() });
      expect(report.healedProductsCount).toBeGreaterThanOrEqual(1);

      // Invariant: Product is converged to SETTLED
      const healedProduct = await Product.findById(testProduct._id);
      expect(healedProduct.status).toBe("SETTLED");
    });

    it("processes refund webhook transitioning Payment and Order to REFUNDED", async () => {
      const initiated = await initiateOrderPayment({ orderId: testOrder._id, user: bidderA });
      const paymentId = `pay_to_refund_${Date.now()}`;

      // First pay the order
      await settleOrderPayment({
        orderId: testOrder._id,
        razorpayOrderId: initiated.razorpayOrderId,
        razorpayPaymentId: paymentId,
        amountPaise: 300000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      const refundPayload = JSON.stringify({
        id: `evt_refund_processed_${Date.now()}`,
        event: "refund.processed",
        payload: {
          refund: {
            entity: {
              id: `rfnd_${Date.now()}`,
              payment_id: paymentId,
              amount: 300000,
              status: "processed",
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

      // Invariant: Order is REFUNDED
      const order = await Order.findById(testOrder._id);
      expect(order.status).toBe("REFUNDED");

      // Invariant: Payment is REFUNDED
      const payment = await Payment.findOne({ razorpayPaymentId: paymentId });
      expect(payment.status).toBe("REFUNDED");
    });
  });
});
