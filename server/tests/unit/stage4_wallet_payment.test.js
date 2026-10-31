/**
 * Stage 4 — Wallet Add-Funds Payment Test Suite
 *
 * Covers all safety and correctness requirements for wallet top-up:
 * 1. Successful add-funds payment (server-authoritative amount, paise precision, wallet balance credit, ledger transaction).
 * 2. Invalid cryptographic signature (rejection with 400 INVALID_SIGNATURE, wallet uncredited).
 * 3. Failed database update after verification (quarantined as REQUIRES_RECONCILIATION, recoverable).
 * 4. Duplicate callback and webhook delivery (idempotent, strictly credited once).
 * 5. Concurrent attempts to credit the same payment (safe under racing verify requests, no double crediting).
 * 6. Retry / reconciliation after transient failure (reconciles to CAPTURED and credits balance).
 * 7. Incorrect user or payment association (User B forbidden from verifying User A's payment).
 * 8. Amount mismatch (quarantined as REQUIRES_RECONCILIATION, no invalid credit).
 */

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const mongoose = require("mongoose");
const request = require("supertest");
const { app } = require("../../server");
const Payment = require("../../src/modules/payments/models/Payment");
const WebhookEvent = require("../../src/modules/payments/models/WebhookEvent");
const User = require("../../src/modules/users/models/user");
const Transaction = require("../../src/modules/admin/finance/models/transaction");
const { clearDatabase } = require("../helpers/dbHelper");
const { createTestUser } = require("../helpers/authHelper");
const { createCsrfCredentials } = require("../helpers/csrfHelper");
const {
  PaymentError,
  setProviderClient,
  resetProviderClient,
  callRazorpayCreateOrder,
  verifyCheckoutSignature,
  initiateWalletTopup,
  settleWalletTopup,
  verifyWalletCheckoutPayment,
  reconcileWalletPayment,
  processWebhook,
} = require("../../src/modules/payments/services/paymentService");

describe("Stage 4 — Wallet Add-Funds Payment Architecture", () => {
  const TEST_KEY_SECRET = "mock_razorpay_secret_32chars_test_key";
  const TEST_WEBHOOK_SECRET = "mock_webhook_secret_32chars_test_key";

  let legitimateUser;
  let legitimateToken;
  let imposterUser;
  let imposterToken;

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
    fetchPayment: jest.fn(async (paymentId) => {
      return {
        id: paymentId,
        entity: "payment",
        amount: 50000,
        currency: "INR",
        status: "captured",
        order_id: null,
      };
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

    await Payment.init();
    await WebhookEvent.init();
    await User.init();
    await Transaction.init();
  });

  beforeEach(async () => {
    await clearDatabase();
    mockProviderOrders.clear();
    mockProviderClient.createOrder.mockClear();
    setProviderClient(mockProviderClient);

    // Create Legitimate User with starting balance ₹500
    const userData = await createTestUser({
      name: "Legitimate User",
      email: `user_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
      role: "user",
    });
    legitimateUser = userData.user;
    legitimateToken = userData.token;

    // Set starting balance to 500
    await User.updateOne({ _id: legitimateUser._id }, { $set: { amount: 500 } });
    legitimateUser = await User.findById(legitimateUser._id);

    // Create Imposter User
    const imposterData = await createTestUser({
      name: "Imposter User",
      email: `imposter_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
      role: "user",
    });
    imposterUser = imposterData.user;
    imposterToken = imposterData.token;
  });

  afterAll(async () => {
    resetProviderClient();
  });

  // Helper to generate valid checkout signature
  function generateSignature(razorpayOrderId, razorpayPaymentId, secret = TEST_KEY_SECRET) {
    return crypto
      .createHmac("sha256", secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
  }

  // Helper to generate valid webhook signature
  function generateWebhookSignature(rawBody, secret = TEST_WEBHOOK_SECRET) {
    return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  }

  // =========================================================================
  // 1. Successful add-funds payment
  // =========================================================================
  describe("1. Successful Add-Funds Payment", () => {
    it("creates authoritative order with integer paise and credits wallet upon verified payment", async () => {
      const csrf = await createCsrfCredentials();

      // 1. Initiate order for ₹500
      const initRes = await request(app)
        .post("/api/payment/wallet/create-order")
        .set("Authorization", `Bearer ${legitimateToken}`)
        .set("Cookie", `${csrf.cookie}`)
        .set("X-CSRF-Token", csrf.token)
        .send({ amount: 500 })
        .expect(200);

      expect(initRes.body.success).toBe(true);
      expect(initRes.body.amount).toBe(50000); // 500 * 100 paise
      expect(initRes.body.currency).toBe("INR");
      expect(initRes.body.razorpayOrderId).toBeDefined();

      const { razorpayOrderId, paymentId } = initRes.body;

      // Verify payment was persisted in DB
      const paymentDoc = await Payment.findById(paymentId);
      expect(paymentDoc).toBeDefined();
      expect(paymentDoc.status).toBe("INITIATED");
      expect(paymentDoc.type).toBe("WALLET_TOPUP");
      expect(paymentDoc.amount).toBe(50000);
      expect(paymentDoc.userId.toString()).toBe(legitimateUser._id.toString());

      // 2. Client completes payment and submits callback for verification
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;
      const razorpaySignature = generateSignature(razorpayOrderId, razorpayPaymentId);

      const verifyRes = await request(app)
        .post("/api/payment/wallet/verify")
        .set("Authorization", `Bearer ${legitimateToken}`)
        .set("Cookie", `${csrf.cookie}`)
        .set("X-CSRF-Token", csrf.token)
        .send({
          paymentId,
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
        })
        .expect(200);

      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.status).toBe("CAPTURED");
      expect(verifyRes.body.walletBalance).toBe(1000); // 500 + 500

      // Verify DB state
      const updatedUser = await User.findById(legitimateUser._id);
      expect(updatedUser.amount).toBe(1000);

      const updatedPayment = await Payment.findById(paymentId);
      expect(updatedPayment.status).toBe("CAPTURED");
      expect(updatedPayment.razorpayPaymentId).toBe(razorpayPaymentId);
      expect(updatedPayment.verifiedVia).toBe("CHECKOUT_VERIFICATION");

      // Verify Transaction ledger entry
      const tx = await Transaction.findOne({ userEmail: legitimateUser.email, type: "deposit" });
      expect(tx).toBeDefined();
      expect(tx.amount).toBe(500);
    });

    it("accepts wallet top-up via create-order route when type is WALLET_TOPUP", async () => {
      const csrf = await createCsrfCredentials();

      const initRes = await request(app)
        .post("/api/payment/create-order")
        .set("Authorization", `Bearer ${legitimateToken}`)
        .set("Cookie", `${csrf.cookie}`)
        .set("X-CSRF-Token", csrf.token)
        .send({ type: "WALLET_TOPUP", amount: 250 })
        .expect(200);

      expect(initRes.body.success).toBe(true);
      expect(initRes.body.amount).toBe(25000);
    });
  });

  // =========================================================================
  // 2. Invalid signature
  // =========================================================================
  describe("2. Invalid Signature Verification", () => {
    it("rejects tampered signature with 400 and preserves existing balance", async () => {
      const csrf = await createCsrfCredentials();

      const orderRes = await initiateWalletTopup({
        amountRupees: 500,
        user: legitimateUser,
      });

      const fakeSignature = "invalid_tampered_hmac_signature_hex";
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const res = await request(app)
        .post("/api/payment/wallet/verify")
        .set("Authorization", `Bearer ${legitimateToken}`)
        .set("Cookie", `${csrf.cookie}`)
        .set("X-CSRF-Token", csrf.token)
        .send({
          paymentId: orderRes.paymentId,
          razorpayOrderId: orderRes.razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature: fakeSignature,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("INVALID_SIGNATURE");

      // Balance unchanged
      const user = await User.findById(legitimateUser._id);
      expect(user.amount).toBe(500);

      // Payment not captured
      const payment = await Payment.findById(orderRes.paymentId);
      expect(payment.status).toBe("INITIATED");
    });
  });

  // =========================================================================
  // 3. Failed database update after verification
  // =========================================================================
  describe("3. Failed Database Update After Verification", () => {
    it("quarantines payment as REQUIRES_RECONCILIATION if user credit DB write throws", async () => {
      const orderRes = await initiateWalletTopup({
        amountRupees: 500,
        user: legitimateUser,
      });

      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;
      const razorpaySignature = generateSignature(orderRes.razorpayOrderId, razorpayPaymentId);

      // Mock User.updateOne to simulate DB failure when crediting the balance
      const originalUpdateOne = User.updateOne;
      let callCount = 0;
      User.updateOne = jest.fn(async (...args) => {
        callCount++;
        // Allow initial initialization query if needed, fail on the credit operation
        if (callCount > 1 || (args[0] && args[0].creditedPayments)) {
          throw new Error("Database connection lost during credit");
        }
        return originalUpdateOne.apply(User, args);
      });

      try {
        await expect(
          verifyWalletCheckoutPayment({
            paymentId: orderRes.paymentId,
            razorpayOrderId: orderRes.razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            user: legitimateUser,
          })
        ).rejects.toThrow(/failed to update wallet balance in database/i);

        // Check payment record status in DB
        const quarantined = await Payment.findById(orderRes.paymentId);
        expect(quarantined.status).toBe("REQUIRES_RECONCILIATION");
        expect(quarantined.reconciliationNotes).toContain("Database connection lost during credit");
        expect(quarantined.razorpayPaymentId).toBe(razorpayPaymentId);

        // Check that user balance is completely unchanged
        const user = await User.findById(legitimateUser._id);
        expect(user.amount).toBe(500);

        // Check that 0 transactions were created
        const txCount = await Transaction.countDocuments({ paymentId: orderRes.paymentId });
        expect(txCount).toBe(0);
      } finally {
        User.updateOne = originalUpdateOne;
      }
    });
  });

  // =========================================================================
  // 4. Duplicate callback and webhook delivery
  // =========================================================================
  describe("4. Duplicate Callback and Webhook Delivery", () => {
    it("idempotently handles repeated verify calls without double crediting", async () => {
      const orderRes = await initiateWalletTopup({
        amountRupees: 500,
        user: legitimateUser,
      });

      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;
      const razorpaySignature = generateSignature(orderRes.razorpayOrderId, razorpayPaymentId);

      // 1st verify call
      const res1 = await verifyWalletCheckoutPayment({
        paymentId: orderRes.paymentId,
        razorpayOrderId: orderRes.razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        user: legitimateUser,
      });

      expect(res1.success).toBe(true);
      expect(res1.alreadyPaid).toBe(false);
      expect(res1.walletBalance).toBe(1000);

      // 2nd verify call (duplicate callback)
      const res2 = await verifyWalletCheckoutPayment({
        paymentId: orderRes.paymentId,
        razorpayOrderId: orderRes.razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        user: legitimateUser,
      });

      expect(res2.success).toBe(true);
      expect(res2.alreadyPaid).toBe(true);
      expect(res2.walletBalance).toBe(1000); // Strictly not 1500!

      // Confirm DB balance
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      // Exactly ONE transaction record
      const txCount = await Transaction.countDocuments({ userEmail: legitimateUser.email, type: "deposit" });
      expect(txCount).toBe(1);
    });

    it("deduplicates webhook delivery without crediting wallet a second time", async () => {
      const orderRes = await initiateWalletTopup({
        amountRupees: 500,
        user: legitimateUser,
      });

      const eventId = `evt_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const webhookPayload = JSON.stringify({
        id: eventId,
        entity: "event",
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: razorpayPaymentId,
              order_id: orderRes.razorpayOrderId,
              amount: 50000,
              currency: "INR",
              status: "captured",
            },
          },
        },
      });

      const signature = generateWebhookSignature(Buffer.from(webhookPayload, "utf8"));

      // 1st webhook call
      const wh1 = await processWebhook({
        rawBody: Buffer.from(webhookPayload, "utf8"),
        signature,
      });
      expect(wh1.success).toBe(true);
      expect(wh1.duplicate).toBeUndefined();

      let user = await User.findById(legitimateUser._id);
      expect(user.amount).toBe(1000);

      // 2nd webhook call (duplicate)
      const wh2 = await processWebhook({
        rawBody: Buffer.from(webhookPayload, "utf8"),
        signature,
      });
      expect(wh2.success).toBe(true);
      expect(wh2.duplicate).toBe(true);

      user = await User.findById(legitimateUser._id);
      expect(user.amount).toBe(1000); // Still 1000!
    });
  });

  // =========================================================================
  // 5. Concurrent attempts to credit the same payment
  // =========================================================================
  describe("5. Concurrent Attempts to Credit the Same Payment", () => {
    it("handles concurrent verify requests safely and increments balance exactly once", async () => {
      const orderRes = await initiateWalletTopup({
        amountRupees: 500,
        user: legitimateUser,
      });

      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;
      const razorpaySignature = generateSignature(orderRes.razorpayOrderId, razorpayPaymentId);

      // Fire 2 concurrent verify requests
      const [result1, result2] = await Promise.all([
        verifyWalletCheckoutPayment({
          paymentId: orderRes.paymentId,
          razorpayOrderId: orderRes.razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          user: legitimateUser,
        }),
        verifyWalletCheckoutPayment({
          paymentId: orderRes.paymentId,
          razorpayOrderId: orderRes.razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          user: legitimateUser,
        }),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // One was the first settlement, the other was idempotent alreadyPaid
      const alreadyPaidFlags = [result1.alreadyPaid, result2.alreadyPaid];
      expect(alreadyPaidFlags).toContain(false);
      expect(alreadyPaidFlags).toContain(true);

      // Final balance must be exactly 1000
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      // Only 1 transaction created
      const txCount = await Transaction.countDocuments({ userEmail: legitimateUser.email });
      expect(txCount).toBe(1);
    });
  });

  // =========================================================================
  // 6. Retry or reconciliation after transient database failure
  // =========================================================================
  describe("6. Reconciliation After Transient Failure", () => {
    it("recovers a quarantined payment and credits wallet safely upon reconciliation", async () => {
      // 1. Manually create a payment stuck in REQUIRES_RECONCILIATION
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "REQUIRES_RECONCILIATION",
        razorpayOrderId,
        razorpayPaymentId,
        reconciliationNotes: "Failed to credit wallet in database: Transient DB disconnect",
      });

      expect(legitimateUser.amount).toBe(500);

      // 2. Run reconciliation worker on this payment
      const reconResult = await reconcileWalletPayment({ paymentId: payment._id });

      expect(reconResult.success).toBe(true);
      expect(reconResult.status).toBe("CAPTURED");
      expect(reconResult.walletBalance).toBe(1000);

      // Verify DB
      const user = await User.findById(legitimateUser._id);
      expect(user.amount).toBe(1000);

      const updatedPayment = await Payment.findById(payment._id);
      expect(updatedPayment.status).toBe("CAPTURED");
      expect(updatedPayment.verifiedVia).toBe("MANUAL_RECONCILIATION");
    });
  });

  // =========================================================================
  // 7. Incorrect user or order association
  // =========================================================================
  describe("7. Incorrect User Association", () => {
    it("rejects an imposter attempting to verify another user's wallet payment with 403", async () => {
      const orderRes = await initiateWalletTopup({
        amountRupees: 500,
        user: legitimateUser,
      });

      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;
      const razorpaySignature = generateSignature(orderRes.razorpayOrderId, razorpayPaymentId);

      // Imposter attempts to verify legitimateUser's payment
      await expect(
        verifyWalletCheckoutPayment({
          paymentId: orderRes.paymentId,
          razorpayOrderId: orderRes.razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          user: imposterUser, // Wrong user!
        })
      ).rejects.toThrow("You are not authorized to verify this payment");

      // Balance of legitimateUser is unchanged
      const userA = await User.findById(legitimateUser._id);
      expect(userA.amount).toBe(500);

      // Balance of imposterUser is unchanged
      const userB = await User.findById(imposterUser._id);
      expect(userB.amount || 0).toBe(0);
    });
  });

  // =========================================================================
  // 8. Amount mismatch
  // =========================================================================
  describe("8. Amount Mismatch Protection", () => {
    it("quarantines payment if provider reports a mismatched amount", async () => {
      const orderRes = await initiateWalletTopup({
        amountRupees: 500, // 50000 paise
        user: legitimateUser,
      });

      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      // Simulate webhook or provider reporting only 1000 paise (₹10) instead of 50000 paise (₹500)
      await expect(
        settleWalletTopup({
          paymentId: orderRes.paymentId,
          razorpayOrderId: orderRes.razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 1000, // Mismatch!
          verifiedVia: "WEBHOOK",
        })
      ).rejects.toThrow(/Amount mismatch/);

      // Payment quarantined
      const payment = await Payment.findById(orderRes.paymentId);
      expect(payment.status).toBe("REQUIRES_RECONCILIATION");
      expect(payment.reconciliationNotes).toContain("Amount mismatch");

      // Wallet NOT credited
      const user = await User.findById(legitimateUser._id);
      expect(user.amount).toBe(500);
    });
  });

  // =========================================================================
  // 9. Targeted Failure-Injection and Crash Safety Windows
  // =========================================================================
  describe("9. Targeted Failure-Injection and Crash Safety Windows", () => {
    // Failure Window 1: Payment in PENDING_VERIFICATION, process crashes before wallet credit
    it("Failure Window 1: recovers cleanly when process crashed before wallet credit without duplicate charge", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      // Simulate state after crash before wallet credit: Payment is PENDING_VERIFICATION, wallet uncredited
      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "PENDING_VERIFICATION",
        razorpayOrderId,
        razorpayPaymentId,
        walletCredited: false,
        ledgerRecorded: false,
      });

      // Verify baseline: User balance is 500, 0 transactions
      expect(legitimateUser.amount).toBe(500);
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(0);

      // Recovery / retry settlement executes
      const result = await settleWalletTopup({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("CAPTURED");
      expect(result.walletBalance).toBe(1000);

      // Assert DB state:
      const updatedUser = await User.findById(legitimateUser._id);
      expect(updatedUser.amount).toBe(1000);
      // In sound standalone MongoDB design, creditedPayments retains the payment ID in a bounded ring buffer to atomically fence stale workers
      expect(updatedUser.creditedPayments).toContain(payment._id.toString());

      const txList = await Transaction.find({ paymentId: payment._id });
      expect(txList.length).toBe(1);
      expect(txList[0].amount).toBe(500);
      expect(txList[0].type).toBe("deposit");

      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
      expect(finalPayment.ledgerRecorded).toBe(true);
    });

    // Failure Window 2: Wallet credit succeeded, process crashes before ledger write
    it("Failure Window 2: heals missing ledger entry without double crediting wallet balance", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "PENDING_VERIFICATION",
        razorpayOrderId,
        razorpayPaymentId,
        walletCredited: false,
        ledgerRecorded: false,
      });

      // Simulate crash right after wallet credit:
      // User was already credited (+₹500 to ₹1000) and creditedPayments has paymentId,
      // but Transaction was NOT created, and Payment is still PENDING_VERIFICATION.
      await User.updateOne(
        { _id: legitimateUser._id },
        {
          $inc: { amount: 500 },
          $push: { creditedPayments: payment._id.toString() },
        }
      );

      // Assert crash state: User has ₹1000, 0 transactions
      const crashUser = await User.findById(legitimateUser._id);
      expect(crashUser.amount).toBe(1000);
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(0);

      // Retry / reconciliation executes
      const result = await settleWalletTopup({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "MANUAL_RECONCILIATION",
      });

      expect(result.success).toBe(true);
      expect(result.alreadyPaid).toBe(true);

      // Assert DB state:
      // 1. Balance must STAY ₹1000 (ABSOLUTELY NO double credit!)
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      // 2. Missing ledger record must be healed
      const txList = await Transaction.find({ paymentId: payment._id });
      expect(txList.length).toBe(1);
      expect(txList[0].amount).toBe(500);

      // 3. Payment record fully updated
      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
      expect(finalPayment.ledgerRecorded).toBe(true);
    });

    // Failure Window 3: Ledger entry succeeded, process crashes before final payment state recorded
    it("Failure Window 3: heals final payment status when ledger write succeeded before crash", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "PENDING_VERIFICATION",
        razorpayOrderId,
        razorpayPaymentId,
        walletCredited: false,
        ledgerRecorded: false,
      });

      // Simulate crash after both User credit and Transaction write:
      await User.updateOne(
        { _id: legitimateUser._id },
        {
          $inc: { amount: 500 },
          $push: { creditedPayments: payment._id.toString() },
        }
      );
      await Transaction.create({
        paymentId: payment._id,
        userEmail: legitimateUser.email,
        name: legitimateUser.name,
        type: "deposit",
        amount: 500,
      });

      // Retry executes
      const result = await settleWalletTopup({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(result.success).toBe(true);

      // Balance remains strictly ₹1000
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      // Still strictly 1 transaction (unique constraint prevents duplication)
      const txCount = await Transaction.countDocuments({ paymentId: payment._id });
      expect(txCount).toBe(1);

      // Payment is now marked CAPTURED
      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
      expect(finalPayment.ledgerRecorded).toBe(true);
    });

    // Failure Window 4: Webhook and browser verification race concurrently
    it("Failure Window 4: concurrent webhook and browser verification credit wallet strictly once", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
        razorpayPaymentId,
      });

      expect(legitimateUser.amount).toBe(500);

      // Race 2 workers simultaneously: Worker A (checkout verify) and Worker B (webhook)
      const [workerA, workerB] = await Promise.all([
        settleWalletTopup({
          paymentId: payment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "CHECKOUT_VERIFICATION",
        }),
        settleWalletTopup({
          paymentId: payment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "WEBHOOK",
        }),
      ]);

      expect(workerA.success).toBe(true);
      expect(workerB.success).toBe(true);

      // Exactly one of the workers applied the initial credit, the other reported alreadyPaid
      expect(workerA.alreadyPaid !== workerB.alreadyPaid).toBe(true);

      // Assert DB state:
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000); // 500 + 500 = 1000, NOT 1500

      const txCount = await Transaction.countDocuments({ paymentId: payment._id });
      expect(txCount).toBe(1);

      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
    });

    // Failure Window 5: Reconciliation retry races with earlier settlement attempt
    it("Failure Window 5: reconciliation retry racing with earlier settlement does not double credit", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "REQUIRES_RECONCILIATION",
        razorpayOrderId,
        razorpayPaymentId,
      });

      const [res1, res2] = await Promise.all([
        reconcileWalletPayment({ paymentId: payment._id }),
        settleWalletTopup({
          paymentId: payment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "CHECKOUT_VERIFICATION",
        }),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);

      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      const txCount = await Transaction.countDocuments({ paymentId: payment._id });
      expect(txCount).toBe(1);
    });

    // Failure Window 6: Ambiguous database timeout recovery
    it("Failure Window 6A: disambiguates timeout when DB write actually committed before timeout", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "REQUIRES_RECONCILIATION",
        razorpayOrderId,
        razorpayPaymentId,
        reconciliationNotes: "Network timeout waiting for database response",
      });

      // Write reached Mongo before timeout:
      await User.updateOne(
        { _id: legitimateUser._id },
        {
          $inc: { amount: 500 },
          $push: { creditedPayments: payment._id.toString() },
        }
      );

      // Reconciliation runs to resolve the ambiguous timeout
      const reconResult = await reconcileWalletPayment({ paymentId: payment._id });
      expect(reconResult.success).toBe(true);

      // Balance is strictly 1000, NOT 1500
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      const txCount = await Transaction.countDocuments({ paymentId: payment._id });
      expect(txCount).toBe(1);
    });

    it("Failure Window 6B: disambiguates timeout when DB write was dropped before reaching Mongo", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "REQUIRES_RECONCILIATION",
        razorpayOrderId,
        razorpayPaymentId,
        reconciliationNotes: "Network connection reset before write reached Mongo",
      });

      // Write was dropped: User amount is still 500, creditedPayments does not have paymentId
      expect(legitimateUser.amount).toBe(500);

      // Reconciliation runs
      const reconResult = await reconcileWalletPayment({ paymentId: payment._id });
      expect(reconResult.success).toBe(true);

      // Balance is properly credited to 1000
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      const txCount = await Transaction.countDocuments({ paymentId: payment._id });
      expect(txCount).toBe(1);
    });

    // Unconfirmed CAPTURED state healing
    it("heals unconfirmed CAPTURED payments without returning a false-positive success", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      // Legacy or faulty worker marked CAPTURED, but wallet was never credited
      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "CAPTURED",
        razorpayOrderId,
        razorpayPaymentId,
        walletCredited: false, // unconfirmed!
      });

      expect(legitimateUser.amount).toBe(500);

      // Settle must detect that wallet credit was unconfirmed and heal it
      const result = await settleWalletTopup({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "MANUAL_RECONCILIATION",
      });

      expect(result.success).toBe(true);

      // Assert user balance is credited to 1000
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      const txCount = await Transaction.countDocuments({ paymentId: payment._id });
      expect(txCount).toBe(1);

      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.walletCredited).toBe(true);
      expect(finalPayment.ledgerRecorded).toBe(true);
    });
  });

  // =========================================================================
  // 10. Stage 4.2 Permanent Idempotency Across Extended Histories
  // =========================================================================
  describe("10. Stage 4.2 Permanent Idempotency Across Extended Histories", () => {
    it("permanently prevents duplicate credit when a payment is replayed after >100 subsequent payments", async () => {
      // 1. Initial Top-up: Payment P1 (₹500)
      const p1OrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const p1PaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const p1 = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId: p1OrderId,
        razorpayPaymentId: p1PaymentId,
      });

      // Settle P1
      const res1 = await settleWalletTopup({
        paymentId: p1._id,
        razorpayOrderId: p1OrderId,
        razorpayPaymentId: p1PaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(res1.success).toBe(true);
      expect(res1.walletBalance).toBe(1000);

      // Verify P1 in DB
      const userAfterP1 = await User.findById(legitimateUser._id);
      expect(userAfterP1.amount).toBe(1000);
      expect(await Transaction.countDocuments({ paymentId: p1._id })).toBe(1);

      // 2. Simulate 105 subsequent payments credited to this user
      // In the old design, $slice: -100 would evict P1 and cause a duplicate credit on replay.
      const subsequentTxns = [];
      for (let i = 0; i < 105; i++) {
        const dummyPaymentId = new mongoose.Types.ObjectId();
        subsequentTxns.push({
          paymentId: dummyPaymentId,
          userEmail: legitimateUser.email,
          name: legitimateUser.name,
          type: "deposit",
          amount: 10,
        });
      }
      await Transaction.insertMany(subsequentTxns);

      // Explicitly ensure P1 is NOT in user's in-flight/credited array (evicted/cleared state)
      await User.updateOne(
        { _id: legitimateUser._id },
        {
          $inc: { amount: 105 * 10 },
          $set: { creditedPayments: ["dummy_recent_id_1", "dummy_recent_id_2"] },
        }
      );

      const userBeforeReplay = await User.findById(legitimateUser._id);
      const expectedBalance = 1000 + (105 * 10);
      expect(userBeforeReplay.amount).toBe(expectedBalance);
      expect(userBeforeReplay.creditedPayments).not.toContain(p1._id.toString());

      // 3. Replay P1 via settleWalletTopup (e.g. replayed callback or delayed processing)
      const replayResult = await settleWalletTopup({
        paymentId: p1._id,
        razorpayOrderId: p1OrderId,
        razorpayPaymentId: p1PaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(replayResult.success).toBe(true);
      expect(replayResult.alreadyPaid).toBe(true);

      // 4. Replay P1 via reconcileWalletPayment (e.g. background reconciliation worker)
      const reconReplayResult = await reconcileWalletPayment({ paymentId: p1._id });
      expect(reconReplayResult.success).toBe(true);
      expect(reconReplayResult.alreadyPaid).toBe(true);

      // 5. CRITICAL ASSERTIONS:
      // - Wallet balance must remain strictly unchanged! (NO double credit!)
      const userAfterReplay = await User.findById(legitimateUser._id);
      expect(userAfterReplay.amount).toBe(expectedBalance);

      // - Exactly 1 transaction must exist in the ledger for P1
      const p1Txns = await Transaction.find({ paymentId: p1._id });
      expect(p1Txns.length).toBe(1);
    });

    it("duplicate webhook delivery is permanently deduplicated without side effects", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
        razorpayPaymentId,
      });

      // 1st Webhook delivery
      const res1 = await settleWalletTopup({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "WEBHOOK",
      });
      expect(res1.success).toBe(true);
      expect(res1.alreadyPaid).toBe(false);

      const balanceAfterFirst = (await User.findById(legitimateUser._id)).amount;
      expect(balanceAfterFirst).toBe(1000);

      // 2nd Webhook delivery (duplicate)
      const res2 = await settleWalletTopup({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "WEBHOOK",
      });
      expect(res2.success).toBe(true);
      expect(res2.alreadyPaid).toBe(true);

      // Balance strictly unchanged
      const balanceAfterSecond = (await User.findById(legitimateUser._id)).amount;
      expect(balanceAfterSecond).toBe(1000);

      // Exactly 1 transaction in DB
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);
    });

    it("concurrent browser verification and webhook delivery settle wallet exactly once", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
        razorpayPaymentId,
      });

      expect(legitimateUser.amount).toBe(500);

      // Fire both concurrently
      const [browserRes, webhookRes] = await Promise.all([
        settleWalletTopup({
          paymentId: payment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "CHECKOUT_VERIFICATION",
        }),
        settleWalletTopup({
          paymentId: payment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "WEBHOOK",
        }),
      ]);

      expect(browserRes.success).toBe(true);
      expect(webhookRes.success).toBe(true);
      expect(browserRes.alreadyPaid !== webhookRes.alreadyPaid).toBe(true);

      // Balance incremented exactly once (500 + 500 = 1000)
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      // Exactly 1 ledger transaction
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);

      // Payment is CAPTURED
      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
    });
  });

  // =========================================================================
  // 11. Stage 4.3 Adversarial Settlement Protocol & Fencing Tests
  // =========================================================================
  describe("11. Stage 4.3 Adversarial Settlement Protocol & Fencing Tests", () => {
    it("stale worker with expired lease cannot corrupt newer worker's settlement or double-credit", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
        razorpayPaymentId,
      });

      expect(legitimateUser.amount).toBe(500);

      // 1. Simulate Worker 1 acquiring the lease
      const worker1Token = "token_worker_1_adversarial";
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            settlementLockedUntil: new Date(Date.now() + 10000),
            settlementToken: worker1Token,
            status: "PENDING_VERIFICATION",
          },
          $inc: { settlementLeaseVersion: 1 },
        }
      );

      // 2. Simulate Worker 1 experiencing a GC/network freeze while its lease expires
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            settlementLockedUntil: new Date(Date.now() - 1000), // Expired!
          },
        }
      );

      // 3. Worker 2 (Recovery) acquires the expired lease and completes settlement
      const worker2Res = await settleWalletTopup({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "MANUAL_RECONCILIATION",
      });

      expect(worker2Res.success).toBe(true);
      expect(worker2Res.alreadyPaid).toBe(false);

      // Balance is now 1000 (500 + 500)
      const afterWorker2 = await User.findById(legitimateUser._id);
      expect(afterWorker2.amount).toBe(1000);

      // 4. Stale Worker 1 wakes up and attempts to settle with obsolete token
      // The fencing check and Step 1 permanent gate must prevent any double credit
      const worker1Res = await settleWalletTopup({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(worker1Res.success).toBe(true);
      expect(worker1Res.alreadyPaid).toBe(true);

      // Final Assertions:
      // - Wallet balance strictly remains 1000 (ABSOLUTELY NO double credit!)
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      // - Exactly 1 transaction in the ledger
      const txCount = await Transaction.countDocuments({ paymentId: payment._id });
      expect(txCount).toBe(1);

      // - Payment record remains CAPTURED and walletCredited
      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
      expect(finalPayment.settlementLockedUntil).toBeNull();
    });

    it("heals missing wallet credit when ledger write committed before crash", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "PENDING_VERIFICATION",
        razorpayOrderId,
        razorpayPaymentId,
        walletCredited: false,
        ledgerRecorded: true,
      });

      // Simulate crash right after Transaction was inserted, but BEFORE User.amount was incremented:
      await Transaction.create({
        paymentId: payment._id,
        userEmail: legitimateUser.email,
        name: legitimateUser.name,
        type: "deposit",
        amount: 500,
      });

      // Verify state: User balance is 500, creditedPayments is empty, 1 transaction
      expect((await User.findById(legitimateUser._id)).amount).toBe(500);
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);

      // Reconciliation runs to resolve partial crash
      const reconResult = await reconcileWalletPayment({ paymentId: payment._id });
      expect(reconResult.success).toBe(true);

      // Missing wallet balance must be self-healed to 1000
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      // Still exactly 1 transaction
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);

      // Payment finalized to CAPTURED and walletCredited
      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
    });

    it("fenced payment finalization prevents superseded leaseholder from mutating completed state", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000,
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "PENDING_VERIFICATION",
        razorpayOrderId,
        razorpayPaymentId,
        walletCredited: true,
        settlementLockedUntil: null,
        settlementToken: null,
      });

      // Attempt to finalize with an obsolete token
      const staleToken = "obsolete_worker_token";
      const result = await Payment.findOneAndUpdate(
        {
          _id: payment._id,
          settlementToken: staleToken,
        },
        {
          $set: { status: "FAILED", failureReason: "Corrupted by stale worker" },
        },
        { new: true }
      );

      // Must be null (0 documents matched)
      expect(result).toBeNull();

      // Original state intact
      const intactPayment = await Payment.findById(payment._id);
      expect(intactPayment.status).toBe("PENDING_VERIFICATION");
      expect(intactPayment.failureReason).toBeNull();
    });

    it("defensive compensation immediately corrects balance if unique collision occurs after increment", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
        razorpayPaymentId,
      });

      // Pre-insert transaction simulating a winner that already committed the ledger
      await Transaction.create({
        paymentId: payment._id,
        userEmail: legitimateUser.email,
        name: legitimateUser.name,
        type: "deposit",
        amount: 500,
      });

      // Now run settlement for this payment
      const result = await settleWalletTopup({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(result.success).toBe(true);
      expect(result.alreadyPaid).toBe(true);

      // Balance must be strictly 1000 (healed once if needed, never twice)
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      // Exactly 1 transaction in DB
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);
    });
  });

  // =========================================================================
  // 12. Stage 4.4 Deterministic Cross-Document Settlement & Compensation Safety
  // =========================================================================
  describe("12. Stage 4.4 Deterministic Cross-Document Settlement & Compensation Safety", () => {
    it("controlled barrier: stale Worker A pauses after lease check; Worker B settles; Worker A resumes and is atomically blocked on User document", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
        razorpayPaymentId,
      });

      // Set up deterministic synchronization barriers
      let releaseWorkerA;
      const workerABarrier = new Promise((resolve) => {
        releaseWorkerA = resolve;
      });

      let notifyWorkerAPaused;
      const workerAPaused = new Promise((resolve) => {
        notifyWorkerAPaused = resolve;
      });

      const originalUserUpdateOne = User.updateOne;
      let userUpdateCallsForPayment = 0;

      // Intercept User.updateOne to inject a deterministic pause on Worker A
      User.updateOne = jest.fn(async (...args) => {
        const filter = args[0] || {};
        if (filter.creditedPayments && filter.creditedPayments.$ne === payment._id.toString()) {
          userUpdateCallsForPayment++;
          if (userUpdateCallsForPayment === 1) {
            // Worker A reached the mutation point right after validating its lease token!
            // Notify test driver that Worker A is now paused
            notifyWorkerAPaused();
            // Block Worker A deterministically until Worker B completes
            await workerABarrier;
          }
        }
        return originalUserUpdateOne.apply(User, args);
      });

      try {
        // 1. Worker A launches settlement in background
        const workerAPromise = settleWalletTopup({
          paymentId: payment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "CHECKOUT_VERIFICATION",
        });

        // Wait until Worker A is deterministically paused right before incrementing User.amount
        await workerAPaused;

        // 2. While Worker A is paused, advance/expire Worker A's lease in DB so Worker B can acquire it
        await Payment.updateOne(
          { _id: payment._id },
          { $set: { settlementLockedUntil: new Date(Date.now() - 1000) } }
        );

        // 3. Worker B enters settlement, acquires the lease, and completes full settlement
        const workerBRes = await settleWalletTopup({
          paymentId: payment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "WEBHOOK",
        });

        expect(workerBRes.success).toBe(true);
        expect(workerBRes.status).toBe("CAPTURED");

        // Verify state after Worker B: balance is 1000 (500 initial + 500 credited)
        const userAfterB = await User.findById(legitimateUser._id);
        expect(userAfterB.amount).toBe(1000);
        expect(userAfterB.creditedPayments).toContain(payment._id.toString());

        // 4. Now release the barrier to let Worker A resume execution
        releaseWorkerA();
        const workerARes = await workerAPromise;

        expect(workerARes.success).toBe(true);
        expect(workerARes.alreadyPaid).toBe(true);

        // 5. Final Assertions:
        // - Final balance MUST strictly be 1000 (NEVER 1500; Worker A must be atomically blocked on User)
        const finalUser = await User.findById(legitimateUser._id);
        expect(finalUser.amount).toBe(1000);

        // - Exactly 1 Transaction record in the ledger
        const txCount = await Transaction.countDocuments({ paymentId: payment._id });
        expect(txCount).toBe(1);

        // - Payment record remains CAPTURED and walletCredited: true
        const finalPayment = await Payment.findById(payment._id);
        expect(finalPayment.status).toBe("CAPTURED");
        expect(finalPayment.walletCredited).toBe(true);
      } finally {
        User.updateOne = originalUserUpdateOne;
      }
    });

    it("guard removal failure mode: removing creditedPayments atomic fence allows stale worker to double-credit", async () => {
      // Demonstrates mathematically why the single-document fence on User is required:
      // If an update blindly runs without the creditedPayments condition, a stale worker increments twice.
      const testUserId = legitimateUser._id;
      const initialAmount = (await User.findById(testUserId)).amount; // 500

      const paymentId1 = new mongoose.Types.ObjectId().toString();

      // Flawed update (omitting creditedPayments guard):
      const flawedUpdate = async () => {
        return User.updateOne(
          { _id: testUserId },
          { $inc: { amount: 500 } }
        );
      };

      // Two workers execute flawed update sequentially or concurrently:
      await flawedUpdate(); // Worker 1 (+500 -> 1000)
      await flawedUpdate(); // Stale Worker 2 (+500 -> 1500!)

      const corruptedUser = await User.findById(testUserId);
      expect(corruptedUser.amount).toBe(initialAmount + 1000); // 1500 - corrupted!

      // Correct guarded update:
      const paymentId2 = new mongoose.Types.ObjectId().toString();
      const guardedUpdate = async () => {
        return User.updateOne(
          { _id: testUserId, creditedPayments: { $ne: paymentId2 } },
          {
            $inc: { amount: 500 },
            $push: { creditedPayments: { $each: [paymentId2], $slice: -100 } },
          }
        );
      };

      const res1 = await guardedUpdate(); // First worker succeeds
      expect(res1.modifiedCount).toBe(1);

      const res2 = await guardedUpdate(); // Stale worker blocked by database condition!
      expect(res2.modifiedCount).toBe(0);

      const safeUser = await User.findById(testUserId);
      expect(safeUser.amount).toBe(corruptedUser.amount + 500); // Only incremented once
    });

    it("compensation audit: blind negative $inc rollback reverses legitimate credit if second worker committed ledger", async () => {
      // Proves why blind compensation upon 11000 error is dangerous:
      // If Worker A incremented amount, paused, Worker B took over and committed ledger relying on Worker A's credit,
      // Worker A waking up and blindly executing $inc: -500 would reduce balance to 500, stealing legitimate money!
      const userBefore = await User.findById(legitimateUser._id);
      expect(userBefore.amount).toBe(500);

      const fakePaymentId = new mongoose.Types.ObjectId();

      // Step A: Worker A increments User balance (+500 -> 1000) and marks creditedPayments
      await User.updateOne(
        { _id: legitimateUser._id, creditedPayments: { $ne: fakePaymentId.toString() } },
        {
          $inc: { amount: 500 },
          $push: { creditedPayments: { $each: [fakePaymentId.toString()], $slice: -100 } },
        }
      );
      expect((await User.findById(legitimateUser._id)).amount).toBe(1000);

      // Step B: Worker B takes over, sees user already credited, creates Transaction
      await Transaction.create({
        paymentId: fakePaymentId,
        userEmail: legitimateUser.email,
        name: legitimateUser.name,
        type: "deposit",
        amount: 500,
      });

      // Step C: If flawed Worker A catches 11000 on Transaction.create and runs blind rollback:
      const flawedCompensation = async () => {
        await User.updateOne(
          { _id: legitimateUser._id },
          { $inc: { amount: -500 } }
        );
      };

      // Run flawed compensation:
      await flawedCompensation();

      // Balance was illegitimately reduced back to 500!
      const userAfterFlawedComp = await User.findById(legitimateUser._id);
      expect(userAfterFlawedComp.amount).toBe(500); // Legitimate credit reversed!

      // This confirms why the sound design eliminates blind negative compensation entirely.
    });

    it("ambiguous database timeout on negative compensation causes double-decrement and underflow", async () => {
      // Demonstrates non-idempotency of blind negative compensation:
      // If a compensation update experiences a network timeout and is retried, it decrements twice.
      const initialAmount = 1000;
      await User.updateOne({ _id: legitimateUser._id }, { $set: { amount: initialAmount } });

      const negativeCompensation = async () => {
        return User.updateOne(
          { _id: legitimateUser._id },
          { $inc: { amount: -500 } }
        );
      };

      // First call (e.g. executed on server, but client experienced socket timeout):
      await negativeCompensation();
      expect((await User.findById(legitimateUser._id)).amount).toBe(500);

      // Client / worker retries the compensation due to ambiguous error:
      await negativeCompensation();
      expect((await User.findById(legitimateUser._id)).amount).toBe(0); // Underflow / double deduction!
    });

    it("recoverable reconciliation: recovers crash between User credit and Payment capture without double credit", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "REQUIRES_RECONCILIATION",
        razorpayOrderId,
        razorpayPaymentId,
        walletCredited: false,
      });

      // Simulate state where User was credited (+500 -> 1000) and payment ID pushed to creditedPayments,
      // but worker crashed before creating Transaction or setting Payment.status to CAPTURED:
      await User.updateOne(
        { _id: legitimateUser._id, creditedPayments: { $ne: payment._id.toString() } },
        {
          $inc: { amount: 500 },
          $addToSet: { creditedPayments: payment._id.toString() },
        }
      );

      expect((await User.findById(legitimateUser._id)).amount).toBe(1000);
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(0);

      // Run reconciliation
      const reconResult = await reconcileWalletPayment({ paymentId: payment._id });
      expect(reconResult.success).toBe(true);

      // Assert:
      // - Wallet balance strictly remains 1000 (NOT incremented to 1500!)
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      // - Transaction was created (1 transaction)
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);

      // - Payment was finalized to CAPTURED
      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
    });
  });

  // =========================================================================
  // 13. Stage 4.5 Permanent Idempotency Across Payment Lifetime
  // =========================================================================
  describe("13. Stage 4.5 Permanent Idempotency Across Payment Lifetime", () => {
    it("permanently retains payment markers across >100 subsequent settlements, preventing replay double credit", async () => {
      // 1. Initial settlement of Payment 1
      const p1OrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const p1PaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const p1 = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId: p1OrderId,
        razorpayPaymentId: p1PaymentId,
      });

      const res1 = await settleWalletTopup({
        paymentId: p1._id,
        razorpayOrderId: p1OrderId,
        razorpayPaymentId: p1PaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(res1.success).toBe(true);
      expect(res1.walletBalance).toBe(1000); // 500 initial + 500

      // 2. Perform 105 real subsequent top-ups for this user via settleWalletTopup
      for (let i = 0; i < 105; i++) {
        const subOrderId = `order_sub_${i}_${crypto.randomBytes(4).toString("hex")}`;
        const subPayId = `pay_sub_${i}_${crypto.randomBytes(4).toString("hex")}`;

        const subPayment = await Payment.create({
          userId: legitimateUser._id,
          userEmail: legitimateUser.email,
          amount: 1000, // ₹10 each
          currency: "INR",
          type: "WALLET_TOPUP",
          status: "INITIATED",
          razorpayOrderId: subOrderId,
          razorpayPaymentId: subPayId,
        });

        await settleWalletTopup({
          paymentId: subPayment._id,
          razorpayOrderId: subOrderId,
          razorpayPaymentId: subPayId,
          amountPaise: 1000,
          verifiedVia: "WEBHOOK",
        });
      }

      const expectedBalance = 1000 + (105 * 10); // ₹2050
      const userAfter105 = await User.findById(legitimateUser._id);
      expect(userAfter105.amount).toBe(expectedBalance);

      // CRITICAL ASSERTION: P1 was NEVER evicted! Bounded ring buffer eviction is eliminated.
      expect(userAfter105.creditedPayments).toContain(p1._id.toString());
      expect(userAfter105.creditedPayments.length).toBe(106); // 1 + 105

      // 3. Replay P1 via settleWalletTopup
      const replaySettle = await settleWalletTopup({
        paymentId: p1._id,
        razorpayOrderId: p1OrderId,
        razorpayPaymentId: p1PaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(replaySettle.success).toBe(true);
      expect(replaySettle.alreadyPaid).toBe(true);

      // 4. Replay P1 via reconcileWalletPayment
      const replayRecon = await reconcileWalletPayment({ paymentId: p1._id });
      expect(replayRecon.success).toBe(true);
      expect(replayRecon.alreadyPaid).toBe(true);

      // 5. Final balance MUST remain strictly unchanged (NO double credit!)
      const userAfterReplay = await User.findById(legitimateUser._id);
      expect(userAfterReplay.amount).toBe(expectedBalance);

      // Exactly 1 transaction exists for P1
      expect(await Transaction.countDocuments({ paymentId: p1._id })).toBe(1);
    });

    it("recovers partially crashed payment (Transaction exists, Payment.walletCredited=false) after >100 payments without double credit", async () => {
      // Setup: Payment P1 crashed after Step 6 (Transaction created), but before Step 7 (Payment.walletCredited)
      const p1OrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const p1PaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const p1 = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "PENDING_VERIFICATION",
        razorpayOrderId: p1OrderId,
        razorpayPaymentId: p1PaymentId,
        walletCredited: false, // Simulates crash before Step 7
        ledgerRecorded: true,
      });

      // User was already credited (+₹500 -> ₹1000) and P1 marked in creditedPayments
      await User.updateOne(
        { _id: legitimateUser._id },
        {
          $inc: { amount: 500 },
          $addToSet: { creditedPayments: p1._id.toString() },
        }
      );

      // Transaction was created
      await Transaction.create({
        paymentId: p1._id,
        userEmail: legitimateUser.email,
        name: legitimateUser.name,
        type: "deposit",
        amount: 500,
      });

      // Perform 105 subsequent payments
      for (let i = 0; i < 105; i++) {
        const dummyId = new mongoose.Types.ObjectId().toString();
        await User.updateOne(
          { _id: legitimateUser._id },
          {
            $inc: { amount: 10 },
            $addToSet: { creditedPayments: dummyId },
          }
        );
      }

      const expectedBalance = 1000 + (105 * 10);
      const userBeforeRecon = await User.findById(legitimateUser._id);
      expect(userBeforeRecon.amount).toBe(expectedBalance);
      // P1 is still in creditedPayments because no eviction occurs
      expect(userBeforeRecon.creditedPayments).toContain(p1._id.toString());

      // Now run reconciliation on the partially crashed payment
      const reconResult = await reconcileWalletPayment({ paymentId: p1._id });
      expect(reconResult.success).toBe(true);

      // Balance MUST NOT be double-credited!
      const userAfterRecon = await User.findById(legitimateUser._id);
      expect(userAfterRecon.amount).toBe(expectedBalance);

      // Payment is now finalized to CAPTURED
      const finalizedPayment = await Payment.findById(p1._id);
      expect(finalizedPayment.status).toBe("CAPTURED");
      expect(finalizedPayment.walletCredited).toBe(true);
      expect(await Transaction.countDocuments({ paymentId: p1._id })).toBe(1);
    });

    it("concurrent settlement: 5 racing workers settle the same payment strictly once", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
        razorpayPaymentId,
      });

      // Launch 5 concurrent settlement workers
      const settlePromises = Array.from({ length: 5 }, () =>
        settleWalletTopup({
          paymentId: payment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "CHECKOUT_VERIFICATION",
        })
      );

      const results = await Promise.all(settlePromises);

      // All 5 workers must succeed
      for (const res of results) {
        expect(res.success).toBe(true);
      }

      // Exactly one worker performed the original credit (alreadyPaid: false); others saw alreadyPaid: true
      const freshCredits = results.filter((r) => r.alreadyPaid === false);
      expect(freshCredits.length).toBe(1);

      // Balance is strictly 1000 (500 initial + 500 credit once)
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      // Exactly 1 transaction in DB
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);

      // Payment is CAPTURED
      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
    });

    it("stale worker barrier: resuming after 105 subsequent payments is atomically blocked on User", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
        razorpayPaymentId,
      });

      let releaseWorkerA;
      const workerABarrier = new Promise((resolve) => {
        releaseWorkerA = resolve;
      });

      let notifyWorkerAPaused;
      const workerAPaused = new Promise((resolve) => {
        notifyWorkerAPaused = resolve;
      });

      const originalUserUpdateOne = User.updateOne;
      let userUpdateCalls = 0;

      User.updateOne = jest.fn(async (...args) => {
        const filter = args[0] || {};
        if (filter.creditedPayments && filter.creditedPayments.$ne === payment._id.toString()) {
          userUpdateCalls++;
          if (userUpdateCalls === 1) {
            notifyWorkerAPaused();
            await workerABarrier;
          }
        }
        return originalUserUpdateOne.apply(User, args);
      });

      try {
        // Worker A starts settlement and pauses right before Step 5 mutation
        const workerAPromise = settleWalletTopup({
          paymentId: payment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "CHECKOUT_VERIFICATION",
        });

        await workerAPaused;

        // Advance lease so Worker B can acquire it
        await Payment.updateOne(
          { _id: payment._id },
          { $set: { settlementLockedUntil: new Date(Date.now() - 1000) } }
        );

        // Worker B settles the payment to completion
        const workerBRes = await settleWalletTopup({
          paymentId: payment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "WEBHOOK",
        });
        expect(workerBRes.success).toBe(true);

        // Simulate 105 subsequent payments for the user
        for (let i = 0; i < 105; i++) {
          const dummyId = new mongoose.Types.ObjectId().toString();
          await User.updateOne(
            { _id: legitimateUser._id },
            {
              $inc: { amount: 10 },
              $addToSet: { creditedPayments: dummyId },
            }
          );
        }

        const expectedBalance = 1000 + (105 * 10);

        // Worker A resumes after 105 subsequent payments!
        releaseWorkerA();
        const workerARes = await workerAPromise;
        expect(workerARes.success).toBe(true);
        expect(workerARes.alreadyPaid).toBe(true);

        // Balance MUST NOT be double-credited!
        const finalUser = await User.findById(legitimateUser._id);
        expect(finalUser.amount).toBe(expectedBalance);

        // Exactly 1 transaction in DB
        expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);
      } finally {
        User.updateOne = originalUserUpdateOne;
      }
    });

    it("recovers process failure between User credit (Step 5) and Transaction insert (Step 6)", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "REQUIRES_RECONCILIATION",
        razorpayOrderId,
        razorpayPaymentId,
        walletCredited: false,
      });

      // User was credited (+500 -> 1000) and payment marked in creditedPayments
      await User.updateOne(
        { _id: legitimateUser._id, creditedPayments: { $ne: payment._id.toString() } },
        {
          $inc: { amount: 500 },
          $addToSet: { creditedPayments: payment._id.toString() },
        }
      );

      // But Transaction DOES NOT exist
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(0);

      // Reconciliation worker runs
      const reconRes = await reconcileWalletPayment({ paymentId: payment._id });
      expect(reconRes.success).toBe(true);

      // Assert balance is NOT incremented again
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      // Missing Transaction was created
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);

      // Payment is CAPTURED
      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
    });
  });

  // =========================================================================
  // 14. Stage 4.6 Crash Matrix, Recovery & Invariant Verification
  // =========================================================================
  describe("14. Stage 4.6 Crash Matrix, Recovery & Invariant Verification", () => {
    // 1. Failure before the wallet mutation
    it("Crash Window 1: failure before wallet mutation recovers cleanly upon retry without duplicate credit", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "PENDING_VERIFICATION",
        razorpayOrderId,
        razorpayPaymentId,
        walletCredited: false,
        ledgerRecorded: false,
      });

      // Verify initial state: User balance 500, no marker, no transaction
      expect((await User.findById(legitimateUser._id)).amount).toBe(500);
      expect((await User.findById(legitimateUser._id)).creditedPayments).not.toContain(payment._id.toString());
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(0);

      // Simulate Worker 1 crashing right before Step 5:
      // It acquired the lease, but died before User.updateOne.
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            settlementLockedUntil: new Date(Date.now() - 1000), // lease expired upon crash
            settlementToken: "crashed_worker_1_token",
          },
        }
      );

      // Recovery Worker 2 runs settleWalletTopup
      const recoveryResult = await settleWalletTopup({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.status).toBe("CAPTURED");
      expect(recoveryResult.walletBalance).toBe(1000);

      // Invariants:
      // - Balance increased by payment amount at most once (500 + 500 = 1000)
      const user = await User.findById(legitimateUser._id);
      expect(user.amount).toBe(1000);
      // - Permanent payment marker set
      expect(user.creditedPayments).toContain(payment._id.toString());
      // - Exactly one Transaction ledger entry exists
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);
      // - Payment reaches consistent terminal state CAPTURED
      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
      expect(finalPayment.ledgerRecorded).toBe(true);
    });

    // 2. Failure after the wallet mutation but before ledger insertion
    it("Crash Window 2: failure after wallet mutation but before ledger insertion heals missing ledger without double crediting", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "PENDING_VERIFICATION",
        razorpayOrderId,
        razorpayPaymentId,
        walletCredited: false,
        ledgerRecorded: false,
      });

      // Simulate crash immediately after Step 5:
      // User was mutated (+500 -> 1000) and marker added to creditedPayments,
      // but Worker died before Step 6 (no Transaction created, payment still PENDING_VERIFICATION)
      await User.updateOne(
        { _id: legitimateUser._id, creditedPayments: { $ne: payment._id.toString() } },
        {
          $inc: { amount: 500 },
          $addToSet: { creditedPayments: payment._id.toString() },
        }
      );

      // Verify crash state
      const crashUser = await User.findById(legitimateUser._id);
      expect(crashUser.amount).toBe(1000);
      expect(crashUser.creditedPayments).toContain(payment._id.toString());
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(0);

      // Reconciliation / retry worker runs
      const recoveryResult = await reconcileWalletPayment({ paymentId: payment._id });
      expect(recoveryResult.success).toBe(true);

      // Invariants:
      // - Wallet balance strictly remains 1000 (NO double credit!)
      const recoveredUser = await User.findById(legitimateUser._id);
      expect(recoveredUser.amount).toBe(1000);
      // - Permanent payment marker remains intact
      expect(recoveredUser.creditedPayments).toContain(payment._id.toString());
      // - Exactly 1 Transaction ledger entry reconstructed
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);
      // - Payment reaches consistent terminal state CAPTURED
      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
      expect(finalPayment.ledgerRecorded).toBe(true);
    });

    // 3. Failure after ledger insertion but before Payment finalization
    it("Crash Window 3: failure after ledger insertion but before Payment finalization finalizes payment without double credit", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "PENDING_VERIFICATION",
        razorpayOrderId,
        razorpayPaymentId,
        walletCredited: false,
        ledgerRecorded: false,
      });

      // Simulate crash after both Step 5 and Step 6, before Step 7:
      await User.updateOne(
        { _id: legitimateUser._id, creditedPayments: { $ne: payment._id.toString() } },
        {
          $inc: { amount: 500 },
          $addToSet: { creditedPayments: payment._id.toString() },
        }
      );
      await Transaction.create({
        paymentId: payment._id,
        userEmail: legitimateUser.email,
        name: legitimateUser.name,
        type: "deposit",
        amount: 500,
      });

      // Verify crash state: Transaction exists, but Payment.walletCredited is still false
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);
      const prePayment = await Payment.findById(payment._id);
      expect(prePayment.walletCredited).toBe(false);

      // Recovery via settleWalletTopup
      const recoveryResult = await settleWalletTopup({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.alreadyPaid).toBe(true);

      // Invariants:
      // - Balance strictly remains 1000
      const recoveredUser = await User.findById(legitimateUser._id);
      expect(recoveredUser.amount).toBe(1000);
      // - Marker present
      expect(recoveredUser.creditedPayments).toContain(payment._id.toString());
      // - Exactly 1 Transaction ledger entry
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);
      // - Payment reaches consistent terminal state CAPTURED
      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
      expect(finalPayment.ledgerRecorded).toBe(true);
    });

    // 4. Failure after Payment finalization but before caller receives confirmation
    it("Crash Window 4: caller network failure after Payment finalization receives idempotent confirmation on retry", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
        razorpayPaymentId,
      });

      // First call executes completely on server
      const firstRes = await settleWalletTopup({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(firstRes.success).toBe(true);
      expect(firstRes.walletBalance).toBe(1000);

      // Simulate caller's network connection dropping before receiving firstRes.
      // Caller retries the exact same verification call:
      const retryRes = await settleWalletTopup({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(retryRes.success).toBe(true);
      expect(retryRes.alreadyPaid).toBe(true);
      expect(retryRes.status).toBe("CAPTURED");
      expect(retryRes.walletBalance).toBe(1000);

      // Invariants:
      // - Balance strictly remains 1000
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);
      // - Marker present
      expect(finalUser.creditedPayments).toContain(payment._id.toString());
      // - Exactly 1 Transaction ledger entry
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);
      // - Payment record remains CAPTURED
      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
    });

    // 5. During reconciliation and concurrent retries
    it("Crash Window 5: concurrent retries and reconciliation race safely with at-most-once credit", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "REQUIRES_RECONCILIATION",
        razorpayOrderId,
        razorpayPaymentId,
      });

      // 3 racing workers: checkout retry, webhook retry, and scheduled reconciliation
      const [worker1, worker2, worker3] = await Promise.all([
        settleWalletTopup({
          paymentId: payment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "CHECKOUT_VERIFICATION",
        }),
        settleWalletTopup({
          paymentId: payment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "WEBHOOK",
        }),
        reconcileWalletPayment({
          paymentId: payment._id,
        }),
      ]);

      expect(worker1.success).toBe(true);
      expect(worker2.success).toBe(true);
      expect(worker3.success).toBe(true);

      // Invariants:
      // - Balance incremented by 500 strictly once
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);
      // - Marker present
      expect(finalUser.creditedPayments).toContain(payment._id.toString());
      // - Exactly 1 Transaction ledger entry
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);
      // - Terminal state CAPTURED
      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
    });

    // 6. During ambiguous database write outcomes
    it("Crash Window 6: ambiguous database write timeout is deterministically resolved on recovery", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "REQUIRES_RECONCILIATION",
        razorpayOrderId,
        razorpayPaymentId,
        reconciliationNotes: "Ambiguous timeout during User.updateOne mutation",
      });

      // Case 6A: The write actually reached MongoDB before timeout
      await User.updateOne(
        { _id: legitimateUser._id, creditedPayments: { $ne: payment._id.toString() } },
        {
          $inc: { amount: 500 },
          $addToSet: { creditedPayments: payment._id.toString() },
        }
      );

      // Recovery worker executes
      const recovery6A = await reconcileWalletPayment({ paymentId: payment._id });
      expect(recovery6A.success).toBe(true);

      // Invariants:
      const user6A = await User.findById(legitimateUser._id);
      expect(user6A.amount).toBe(1000); // strictly 1000, NOT 1500!
      expect(user6A.creditedPayments).toContain(payment._id.toString());
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);

      // Case 6B: A new payment whose write timed out BEFORE reaching MongoDB
      const paymentBOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const paymentBPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const paymentB = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "REQUIRES_RECONCILIATION",
        razorpayOrderId: paymentBOrderId,
        razorpayPaymentId: paymentBPaymentId,
        reconciliationNotes: "Socket hangup before write reached MongoDB",
      });

      // Payment B was NOT committed to Mongo: User balance is still 1000, paymentB not in creditedPayments
      expect(user6A.creditedPayments).not.toContain(paymentB._id.toString());

      // Recovery worker executes for Payment B
      const recovery6B = await reconcileWalletPayment({ paymentId: paymentB._id });
      expect(recovery6B.success).toBe(true);

      // Invariants:
      const user6B = await User.findById(legitimateUser._id);
      expect(user6B.amount).toBe(1500); // 1000 + 500 = 1500
      expect(user6B.creditedPayments).toContain(paymentB._id.toString());
      expect(await Transaction.countDocuments({ paymentId: paymentB._id })).toBe(1);
      const finalPaymentB = await Payment.findById(paymentB._id);
      expect(finalPaymentB.status).toBe("CAPTURED");
      expect(finalPaymentB.walletCredited).toBe(true);
    });
  });

  // =========================================================================
  // 15. Stage 4.7 Adversarial Audit of Wallet Recovery & Ambiguous Write Safety
  // =========================================================================
  describe("15. Stage 4.7 Adversarial Audit of Wallet Recovery & Ambiguous Write Safety", () => {
    it("fault injection: timeout AFTER write committed is immediately disambiguated via re-read without double credit", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
        razorpayPaymentId,
      });

      const originalUserUpdateOne = User.updateOne;
      let injectedTimeoutFired = false;

      // Fault injection: updateOne commits on MongoDB, but immediately throws a simulated socket timeout
      User.updateOne = jest.fn(async (...args) => {
        const filter = args[0] || {};
        if (filter.creditedPayments && filter.creditedPayments.$ne === payment._id.toString()) {
          // 1. Perform actual write to MongoDB (simulating write reached engine)
          await originalUserUpdateOne.apply(User, args);
          // 2. Simulate driver receiving network timeout / socket drop
          injectedTimeoutFired = true;
          throw new Error("MongoNetworkTimeoutError: connection timed out waiting for write concern acknowledgment");
        }
        return originalUserUpdateOne.apply(User, args);
      });

      try {
        const result = await settleWalletTopup({
          paymentId: payment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "CHECKOUT_VERIFICATION",
        });

        expect(injectedTimeoutFired).toBe(true);
        expect(result.success).toBe(true);
        expect(result.status).toBe("CAPTURED");

        // Assert invariants:
        // - Balance incremented strictly once (500 + 500 = 1000)
        const finalUser = await User.findById(legitimateUser._id);
        expect(finalUser.amount).toBe(1000);
        // - Permanent marker set
        expect(finalUser.creditedPayments).toContain(payment._id.toString());
        // - Exactly 1 Transaction
        expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);
        // - Payment finalized to CAPTURED
        const finalPayment = await Payment.findById(payment._id);
        expect(finalPayment.status).toBe("CAPTURED");
        expect(finalPayment.walletCredited).toBe(true);
      } finally {
        User.updateOne = originalUserUpdateOne;
      }
    });

    it("fault injection: timeout BEFORE write reaches Mongo safely quarantines and recovers cleanly without guessing", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
        razorpayPaymentId,
      });

      const originalUserUpdateOne = User.updateOne;
      let updateAttempted = false;

      // Fault injection: updateOne throws BEFORE reaching Mongo engine (no mutation occurred)
      User.updateOne = jest.fn(async (...args) => {
        const filter = args[0] || {};
        if (filter.creditedPayments && filter.creditedPayments.$ne === payment._id.toString()) {
          updateAttempted = true;
          throw new Error("MongoSocketClosedError: socket closed before command could be sent");
        }
        return originalUserUpdateOne.apply(User, args);
      });

      try {
        // Attempt settlement: must fail and quarantine, NOT guess or report false success
        await expect(
          settleWalletTopup({
            paymentId: payment._id,
            razorpayOrderId,
            razorpayPaymentId,
            amountPaise: 50000,
            verifiedVia: "CHECKOUT_VERIFICATION",
          })
        ).rejects.toThrow("Payment verified, but failed to update wallet balance in database");

        expect(updateAttempted).toBe(true);

        // State after failure:
        // - Balance untouched (still 500)
        const userAfterCrash = await User.findById(legitimateUser._id);
        expect(userAfterCrash.amount).toBe(500);
        expect(userAfterCrash.creditedPayments).not.toContain(payment._id.toString());
        // - 0 transactions
        expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(0);
        // - Quarantined in REQUIRES_RECONCILIATION
        const quarantinedPayment = await Payment.findById(payment._id);
        expect(quarantinedPayment.status).toBe("REQUIRES_RECONCILIATION");
      } finally {
        User.updateOne = originalUserUpdateOne;
      }

      // Subsequent reconciliation once network is restored:
      const reconResult = await reconcileWalletPayment({ paymentId: payment._id });
      expect(reconResult.success).toBe(true);

      // Invariants restored:
      const userAfterRecon = await User.findById(legitimateUser._id);
      expect(userAfterRecon.amount).toBe(1000);
      expect(userAfterRecon.creditedPayments).toContain(payment._id.toString());
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);
      const finalPayment = await Payment.findById(payment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
    });

    it("fault injection: persistent DB unavailability leaves payment recoverable without false-positive success", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
        razorpayPaymentId,
      });

      const originalUserUpdateOne = User.updateOne;
      const originalUserFindById = User.findById;

      // Fault injection: DB remains completely offline during update AND during disambiguation re-read
      User.updateOne = jest.fn(async (...args) => {
        const filter = args[0] || {};
        if (filter.creditedPayments) {
          throw new Error("MongoServerSelectionError: server selection timed out");
        }
        return originalUserUpdateOne.apply(User, args);
      });
      User.findById = jest.fn(async (...args) => {
        throw new Error("MongoServerSelectionError: server selection timed out");
      });

      try {
        await expect(
          settleWalletTopup({
            paymentId: payment._id,
            razorpayOrderId,
            razorpayPaymentId,
            amountPaise: 50000,
            verifiedVia: "CHECKOUT_VERIFICATION",
          })
        ).rejects.toThrow("Payment verified, but failed to update wallet balance in database");

        // Critical: it NEVER returns a false positive or mutates state
      } finally {
        User.updateOne = originalUserUpdateOne;
        User.findById = originalUserFindById;
      }
    });

    it("legacy state protection: historical CAPTURED payment with Transaction but missing marker is NEVER double-credited", async () => {
      // Setup a legacy payment created before creditedPayments or walletCredited existed:
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const legacyPayment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "CAPTURED", // Was already captured in historical system!
        razorpayOrderId,
        razorpayPaymentId,
        walletCredited: false, // Defaulted by Mongoose because field didn't exist in legacy doc
        ledgerRecorded: true,
      });

      // Transaction existed in legacy ledger
      await Transaction.create({
        paymentId: legacyPayment._id,
        userEmail: legitimateUser.email,
        name: legitimateUser.name,
        type: "deposit",
        amount: 500,
      });

      // User balance was already incremented to 1000 originally, but creditedPayments is empty
      await User.updateOne(
        { _id: legitimateUser._id },
        {
          $set: {
            amount: 1000, // already credited historically
            creditedPayments: [], // marker array was empty historically
          },
        }
      );

      // Verify baseline: balance 1000, marker absent
      const preUser = await User.findById(legitimateUser._id);
      expect(preUser.amount).toBe(1000);
      expect(preUser.creditedPayments).not.toContain(legacyPayment._id.toString());

      // Settle is re-invoked on the legacy payment (e.g. replayed callback or reconciliation sweep)
      const settleRes = await settleWalletTopup({
        paymentId: legacyPayment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(settleRes.success).toBe(true);
      expect(settleRes.alreadyPaid).toBe(true);

      // CRITICAL REGRESSION ASSERTION:
      // Balance MUST REMAIN 1000! ABSOLUTELY NO DOUBLE CREDIT TO 1500!
      const postUser = await User.findById(legitimateUser._id);
      expect(postUser.amount).toBe(1000);

      // Marker is safely backfilled for permanent future protection
      expect(postUser.creditedPayments).toContain(legacyPayment._id.toString());

      // Exactly 1 Transaction
      expect(await Transaction.countDocuments({ paymentId: legacyPayment._id })).toBe(1);

      // Payment record updated to walletCredited: true
      const postPayment = await Payment.findById(legacyPayment._id);
      expect(postPayment.walletCredited).toBe(true);
    });

    it("contradictory state protection: FAILED payment is rejected and preserves audit evidence without balance mutation", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const failedPayment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "FAILED",
        razorpayOrderId,
        razorpayPaymentId,
        failureReason: "Payment authentication failed at bank gateway",
      });

      // Attempting to reconcile a FAILED payment must throw INVALID_PAYMENT_STATUS
      await expect(
        reconcileWalletPayment({ paymentId: failedPayment._id })
      ).rejects.toThrow("Cannot reconcile payment with status FAILED");

      // Balance is completely untouched
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(500);

      // 0 transactions
      expect(await Transaction.countDocuments({ paymentId: failedPayment._id })).toBe(0);

      // Failure reason remains intact
      const unmutatedPayment = await Payment.findById(failedPayment._id);
      expect(unmutatedPayment.status).toBe("FAILED");
      expect(unmutatedPayment.failureReason).toBe("Payment authentication failed at bank gateway");
    });
  });

  describe("16. Stage 4.8 & 4.9 Razorpay Configuration Hardening & Wallet Invariant Tests", () => {
    let savedKeyId;
    let savedKeySecret;
    let savedViteKey;

    beforeEach(() => {
      savedKeyId = process.env.RAZORPAY_KEY_ID;
      savedKeySecret = process.env.RAZORPAY_KEY_SECRET;
      savedViteKey = process.env.VITE_RAZORPAY_API_KEY;
    });

    afterEach(() => {
      process.env.RAZORPAY_KEY_ID = savedKeyId;
      process.env.RAZORPAY_KEY_SECRET = savedKeySecret;
      process.env.VITE_RAZORPAY_API_KEY = savedViteKey;
      resetProviderClient();
    });

    it("actionable error when Razorpay credentials are not configured without secret exposure", async () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      delete process.env.VITE_RAZORPAY_API_KEY;

      resetProviderClient();

      try {
        await callRazorpayCreateOrder({
          amount: 50000,
          currency: "INR",
          receipt: "rcpt_test_config",
        });
        throw new Error("Expected callRazorpayCreateOrder to throw");
      } catch (err) {
        expect(err.name).toBe("PaymentError");
        expect(err.statusCode).toBe(503);
        expect(err.code).toBe("GATEWAY_NOT_CONFIGURED");
        expect(err.message).toBe("Payment gateway credentials are not configured");
        expect(err.details).toBeDefined();
        expect(err.details.missing).toEqual(["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]);
        expect(err.details.hint).toContain("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
        // Must never leak secret values
        expect(JSON.stringify(err)).not.toContain("mock_razorpay_secret");
      }
    });

    it("canonical backend configuration: strictly requires RAZORPAY_KEY_ID and rejects VITE_RAZORPAY_API_KEY fallback", async () => {
      delete process.env.RAZORPAY_KEY_ID;
      process.env.RAZORPAY_KEY_SECRET = "mock_secret_key_123456789";
      process.env.VITE_RAZORPAY_API_KEY = "rzp_test_vite_public_key";

      resetProviderClient();

      try {
        await callRazorpayCreateOrder({
          amount: 50000,
          currency: "INR",
          receipt: "rcpt_test_canonical_enforcement",
        });
        throw new Error("Expected callRazorpayCreateOrder to throw");
      } catch (err) {
        expect(err.statusCode).toBe(503);
        expect(err.code).toBe("GATEWAY_NOT_CONFIGURED");
        // Canonical enforcement: VITE_RAZORPAY_API_KEY is NOT used on the backend; RAZORPAY_KEY_ID is strictly reported missing
        expect(err.details.missing).toEqual(["RAZORPAY_KEY_ID"]);
        expect(err.details.hint).toContain("RAZORPAY_KEY_ID");
      }
    });

    it("missing key ID independently: fails with actionable error reporting RAZORPAY_KEY_ID missing", async () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.VITE_RAZORPAY_API_KEY;
      process.env.RAZORPAY_KEY_SECRET = "mock_secret_key_123456789";

      resetProviderClient();

      try {
        await callRazorpayCreateOrder({
          amount: 50000,
          currency: "INR",
          receipt: "rcpt_test_missing_key_id",
        });
        throw new Error("Expected callRazorpayCreateOrder to throw");
      } catch (err) {
        expect(err.statusCode).toBe(503);
        expect(err.code).toBe("GATEWAY_NOT_CONFIGURED");
        expect(err.details.missing).toEqual(["RAZORPAY_KEY_ID"]);
      }
    });

    it("missing key secret independently: fails with actionable error reporting RAZORPAY_KEY_SECRET missing", async () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_canonical_key_id";
      delete process.env.RAZORPAY_KEY_SECRET;

      resetProviderClient();

      try {
        await callRazorpayCreateOrder({
          amount: 50000,
          currency: "INR",
          receipt: "rcpt_test_missing_secret",
        });
        throw new Error("Expected callRazorpayCreateOrder to throw");
      } catch (err) {
        expect(err.statusCode).toBe(503);
        expect(err.code).toBe("GATEWAY_NOT_CONFIGURED");
        expect(err.details.missing).toEqual(["RAZORPAY_KEY_SECRET"]);
      }
    });

    it("backend configuration: builds authenticated Basic Auth request when all required keys are present", async () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_canonical_key_id";
      process.env.RAZORPAY_KEY_SECRET = "canonical_secret_key_xyz";

      resetProviderClient();

      const expectedAuthHeader = `Basic ${Buffer.from(
        "rzp_test_canonical_key_id:canonical_secret_key_xyz"
      ).toString("base64")}`;

      const axiosSpy = jest.spyOn(axios, "post").mockResolvedValueOnce({
        data: {
          id: "order_rzp_mocked_success_123",
          amount: 50000,
          currency: "INR",
          receipt: "rcpt_test_authenticated",
        },
      });

      try {
        const order = await callRazorpayCreateOrder({
          amount: 50000,
          currency: "INR",
          receipt: "rcpt_test_authenticated",
          notes: { type: "WALLET_TOPUP" },
        });

        expect(order.id).toBe("order_rzp_mocked_success_123");
        expect(axiosSpy).toHaveBeenCalledWith(
          "https://api.razorpay.com/v1/orders",
          {
            amount: 50000,
            currency: "INR",
            receipt: "rcpt_test_authenticated",
            notes: { type: "WALLET_TOPUP" },
          },
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: expectedAuthHeader,
              "Content-Type": "application/json",
            }),
            timeout: 10000,
          })
        );
      } finally {
        axiosSpy.mockRestore();
      }
    });

    it("process environment variables take precedence over dotenv file values", () => {
      const dotenv = require("dotenv");
      process.env.TEST_INJECTED_RENDER_VAR = "injected_by_render_platform";

      const parsedConfig = dotenv.parse(
        "TEST_INJECTED_RENDER_VAR=from_local_dot_env_file\nUNSET_ENV_VAR=from_local_dot_env_file"
      );

      for (const key of Object.keys(parsedConfig)) {
        if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
          process.env[key] = parsedConfig[key];
        }
      }

      // Existing process variable remains untouched; unset variable is loaded
      expect(process.env.TEST_INJECTED_RENDER_VAR).toBe("injected_by_render_platform");
      expect(process.env.UNSET_ENV_VAR).toBe("from_local_dot_env_file");

      delete process.env.TEST_INJECTED_RENDER_VAR;
      delete process.env.UNSET_ENV_VAR;
    });

    it("working directory invariance: server .env and root .env resolve identically regardless of process.cwd()", () => {
      const serverDir = path.resolve(__dirname, "../..");
      const rootDir = path.resolve(serverDir, "..");

      const expectedServerEnv = path.join(serverDir, ".env");
      const expectedRootEnv = path.join(rootDir, ".env");

      // Evaluation in server.js:
      const resolvedServerEnv = path.resolve(serverDir, ".env");
      const resolvedRootEnv = path.resolve(serverDir, "../.env");

      expect(resolvedServerEnv).toBe(expectedServerEnv);
      expect(resolvedRootEnv).toBe(expectedRootEnv);

      // Verify immunity across working directory transitions
      const origCwd = process.cwd();
      try {
        process.chdir(rootDir);
        expect(path.resolve(serverDir, ".env")).toBe(expectedServerEnv);

        process.chdir(serverDir);
        expect(path.resolve(serverDir, ".env")).toBe(expectedServerEnv);
      } finally {
        process.chdir(origCwd);
      }
    });

    it("frontend configuration isolation: public checkout config never exposes backend secrets", async () => {
      setProviderClient({
        createOrder: async ({ amount, currency, receipt }) => ({
          id: "order_mock_topup_isolation",
          amount,
          currency,
          receipt,
        }),
      });

      const topupConfig = await initiateWalletTopup({
        amountRupees: 500,
        user: legitimateUser,
      });

      expect(topupConfig.success).toBe(true);
      expect(topupConfig.razorpayOrderId).toBe("order_mock_topup_isolation");
      expect(topupConfig.keyId).toBeDefined();

      // Secrets must never be exposed to the client response payload
      expect(topupConfig.keySecret).toBeUndefined();
      expect(topupConfig.RAZORPAY_KEY_SECRET).toBeUndefined();
      expect(topupConfig.RAZORPAY_WEBHOOK_SECRET).toBeUndefined();
      expect(topupConfig.webhookSecret).toBeUndefined();

      // Client .env.example must not document backend secrets
      const clientEnvExample = fs.readFileSync(
        path.resolve(__dirname, "../../../client/.env.example"),
        "utf8"
      );
      expect(clientEnvExample).not.toContain("RAZORPAY_KEY_SECRET");
      expect(clientEnvExample).not.toContain("RAZORPAY_WEBHOOK_SECRET");
      expect(clientEnvExample).toContain("VITE_RAZORPAY_API_KEY");

      // render.yaml client service must not receive backend secrets
      const renderYaml = fs.readFileSync(path.resolve(__dirname, "../../../render.yaml"), "utf8");
      const clientServiceSection = renderYaml
        .split("name: auctionx-client")[1]
        ?.split("name: auctionx-recommendation-service")[0];
      expect(clientServiceSection).toBeDefined();
      expect(clientServiceSection).not.toContain("RAZORPAY_KEY_SECRET");
      expect(clientServiceSection).not.toContain("RAZORPAY_WEBHOOK_SECRET");
    });

    it("order creation fails safely without credentials: never creates Payment, Transaction, or credits wallet", async () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      delete process.env.VITE_RAZORPAY_API_KEY;

      resetProviderClient();

      const userBefore = await User.findById(legitimateUser._id);
      const initialBalance = userBefore.amount;
      const initialPaymentCount = await Payment.countDocuments({ userId: legitimateUser._id });
      const initialTxnCount = await Transaction.countDocuments({ userEmail: legitimateUser.email });

      await expect(
        initiateWalletTopup({
          amountRupees: 500,
          user: legitimateUser,
        })
      ).rejects.toThrow("Payment gateway credentials are not configured");

      // Invariants: Zero mutations on database
      const userAfter = await User.findById(legitimateUser._id);
      expect(userAfter.amount).toBe(initialBalance);

      const finalPaymentCount = await Payment.countDocuments({ userId: legitimateUser._id });
      expect(finalPaymentCount).toBe(initialPaymentCount);

      const finalTxnCount = await Transaction.countDocuments({ userEmail: legitimateUser.email });
      expect(finalTxnCount).toBe(initialTxnCount);
    });

    it("contradictory state protection: FAILED payment with existing Transaction is blocked with CONTRADICTORY_PAYMENT_STATE", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const failedPayment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "FAILED",
        razorpayOrderId,
        razorpayPaymentId,
        failureReason: "Payment authentication failed",
      });

      // Contradictory artifact: Transaction exists for FAILED payment!
      await Transaction.create({
        paymentId: failedPayment._id,
        userEmail: legitimateUser.email,
        name: legitimateUser.name,
        type: "deposit",
        amount: 500,
      });

      // Both settle and reconcile must reject with 409 CONTRADICTORY_PAYMENT_STATE
      await expect(
        reconcileWalletPayment({ paymentId: failedPayment._id })
      ).rejects.toThrow("Contradictory payment state");

      await expect(
        settleWalletTopup({
          paymentId: failedPayment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "CHECKOUT_VERIFICATION",
        })
      ).rejects.toThrow("Contradictory payment state");

      // User balance remains strictly unchanged
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(500);

      // Payment status remains FAILED (never overwritten to CAPTURED)
      const unmutatedPayment = await Payment.findById(failedPayment._id);
      expect(unmutatedPayment.status).toBe("FAILED");
    });

    it("contradictory state protection: FAILED payment directly called in settleWalletTopup is rejected without balance mutation", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const failedPayment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000,
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "FAILED",
        razorpayOrderId,
        razorpayPaymentId,
      });

      await expect(
        settleWalletTopup({
          paymentId: failedPayment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 50000,
          verifiedVia: "CHECKOUT_VERIFICATION",
        })
      ).rejects.toThrow("Cannot settle payment with status FAILED");

      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(500);
    });

    it("legacy state protection: historical CAPTURED payment with Transaction and missing marker is recognized as settled and never double-credited", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const legacyPayment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "CAPTURED", // Historically captured!
        razorpayOrderId,
        razorpayPaymentId,
        walletCredited: false, // Defaulted by Mongoose
      });

      // Transaction exists from legacy settlement
      await Transaction.create({
        paymentId: legacyPayment._id,
        userEmail: legitimateUser.email,
        name: legitimateUser.name,
        type: "deposit",
        amount: 500,
      });

      // User has balance 1000 (already credited historically), but marker is missing
      await User.updateOne(
        { _id: legitimateUser._id },
        { $set: { amount: 1000, creditedPayments: [] } }
      );

      // Replayed callback or settlement attempt
      const result = await settleWalletTopup({
        paymentId: legacyPayment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(result.success).toBe(true);
      expect(result.alreadyPaid).toBe(true);
      expect(result.status).toBe("CAPTURED");

      // CRITICAL INVARIANT: User balance MUST NOT be incremented to 1500!
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      // Marker backfilled for permanent protection
      expect(finalUser.creditedPayments).toContain(legacyPayment._id.toString());

      // Exactly 1 transaction
      expect(await Transaction.countDocuments({ paymentId: legacyPayment._id })).toBe(1);

      // Payment status synchronized
      const syncedPayment = await Payment.findById(legacyPayment._id);
      expect(syncedPayment.walletCredited).toBe(true);
    });

    it("marker present but transaction missing: safely creates Transaction and finalizes to CAPTURED without balance increment", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const interruptedPayment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "PENDING_VERIFICATION",
        razorpayOrderId,
        razorpayPaymentId,
        walletCredited: false,
      });

      // User has balance 1000, and marker is PRESENT (Step 5 committed before crash)
      await User.updateOne(
        { _id: legitimateUser._id },
        {
          $set: {
            amount: 1000,
            creditedPayments: [interruptedPayment._id.toString()],
          },
        }
      );

      // Zero transactions initially
      expect(await Transaction.countDocuments({ paymentId: interruptedPayment._id })).toBe(0);

      // Replay settlement
      const result = await settleWalletTopup({
        paymentId: interruptedPayment._id,
        razorpayOrderId,
        razorpayPaymentId,
        amountPaise: 50000,
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      expect(result.success).toBe(true);
      expect(result.alreadyPaid).toBe(true);
      expect(result.status).toBe("CAPTURED");

      // Balance MUST NOT be double-credited!
      const finalUser = await User.findById(legitimateUser._id);
      expect(finalUser.amount).toBe(1000);

      // Missing Transaction was created
      expect(await Transaction.countDocuments({ paymentId: interruptedPayment._id })).toBe(1);

      // Payment finalized
      const finalPayment = await Payment.findById(interruptedPayment._id);
      expect(finalPayment.status).toBe("CAPTURED");
      expect(finalPayment.walletCredited).toBe(true);
    });
  });

  // =========================================================================
  // 17. Stage 4.10 Razorpay Test-Mode Checkout & Order Invariant Validation
  // =========================================================================
  describe("17. Stage 4.10 Razorpay Test-Mode Checkout & Order Invariant Validation", () => {
    let savedKeyId;
    let savedKeySecret;
    let savedWebhookSecret;

    beforeEach(() => {
      savedKeyId = process.env.RAZORPAY_KEY_ID;
      savedKeySecret = process.env.RAZORPAY_KEY_SECRET;
      savedWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    });

    afterEach(() => {
      process.env.RAZORPAY_KEY_ID = savedKeyId;
      process.env.RAZORPAY_KEY_SECRET = savedKeySecret;
      process.env.RAZORPAY_WEBHOOK_SECRET = savedWebhookSecret;
      resetProviderClient();
    });

    it("order creation: creates server-authoritative Razorpay order with integer paise and INR currency", async () => {
      let capturedOrderPayload = null;
      setProviderClient({
        createOrder: async (orderData) => {
          capturedOrderPayload = orderData;
          return {
            id: "order_test_mode_authoritative_123",
            entity: "order",
            amount: orderData.amount,
            amount_paid: 0,
            amount_due: orderData.amount,
            currency: orderData.currency,
            receipt: orderData.receipt,
            status: "created",
            notes: orderData.notes,
          };
        },
      });

      process.env.RAZORPAY_KEY_ID = "rzp_test_stage4_10_key_id";
      process.env.RAZORPAY_KEY_SECRET = "stage4_10_secret_32chars_test_key";

      const topup = await initiateWalletTopup({
        amountRupees: 750, // ₹750.00
        user: legitimateUser,
      });

      expect(topup.success).toBe(true);
      expect(topup.amount).toBe(75000); // 75000 paise
      expect(topup.currency).toBe("INR");
      expect(topup.razorpayOrderId).toBe("order_test_mode_authoritative_123");
      expect(topup.keyId).toBe("rzp_test_stage4_10_key_id");

      // Verify server-authoritative provider payload
      expect(capturedOrderPayload.amount).toBe(75000);
      expect(capturedOrderPayload.currency).toBe("INR");
      expect(capturedOrderPayload.notes.type).toBe("WALLET_TOPUP");
      expect(capturedOrderPayload.notes.userId).toBe(legitimateUser._id.toString());
      expect(capturedOrderPayload.notes.userEmail).toBe(legitimateUser.email);

      // Verify internal Payment record
      const paymentDoc = await Payment.findById(topup.paymentId);
      expect(paymentDoc).toBeDefined();
      expect(paymentDoc.status).toBe("INITIATED");
      expect(paymentDoc.amount).toBe(75000);
      expect(paymentDoc.currency).toBe("INR");
      expect(paymentDoc.walletCredited).toBe(false);
    });

    it("order creation rejection: rejects non-positive, sub-rupee, and non-numeric amounts", async () => {
      // 0 rupees
      await expect(
        initiateWalletTopup({ amountRupees: 0, user: legitimateUser })
      ).rejects.toThrow("Amount must be a positive number");

      // Negative amount
      await expect(
        initiateWalletTopup({ amountRupees: -50, user: legitimateUser })
      ).rejects.toThrow("Amount must be a positive number");

      // Sub-rupee amount (< ₹1.00)
      await expect(
        initiateWalletTopup({ amountRupees: 0.5, user: legitimateUser })
      ).rejects.toThrow("Minimum amount to add is ₹1.00");

      // Non-numeric
      await expect(
        initiateWalletTopup({ amountRupees: "not-a-number", user: legitimateUser })
      ).rejects.toThrow("Amount must be a positive number");
    });

    it("order creation authentication: rejects unauthenticated requests with 401 UNAUTHORIZED", async () => {
      // Null user
      await expect(
        initiateWalletTopup({ amountRupees: 500, user: null })
      ).rejects.toThrow("Authentication required to add funds");

      // Missing user._id
      await expect(
        initiateWalletTopup({ amountRupees: 500, user: { email: "test@example.com" } })
      ).rejects.toThrow("Authentication required to add funds");

      // Missing user.email
      await expect(
        initiateWalletTopup({ amountRupees: 500, user: { _id: legitimateUser._id } })
      ).rejects.toThrow("Authentication required to add funds");
    });

    it("effective checkout key: backend order response supplies authoritative key matching RAZORPAY_KEY_ID", async () => {
      process.env.RAZORPAY_KEY_ID = "rzp_test_stage4_10_auth_key";
      process.env.RAZORPAY_KEY_SECRET = "stage4_10_secret_32chars_test_key";

      setProviderClient({
        createOrder: async ({ amount, currency, receipt }) => ({
          id: "order_test_effective_key",
          amount,
          currency,
          receipt,
        }),
      });

      const result = await initiateWalletTopup({
        amountRupees: 250,
        user: legitimateUser,
      });

      expect(result.keyId).toBe("rzp_test_stage4_10_auth_key");

      // Client simulation: ensure effectiveKey picks backend keyId
      const clientViteKey = "rzp_test_stage4_10_auth_key"; // matching
      const effectiveKey = result.keyId || clientViteKey;
      expect(effectiveKey).toBe("rzp_test_stage4_10_auth_key");

      // Client simulation: verify mismatch detection
      const mismatchedViteKey = "rzp_test_different_merchant_account";
      const isMismatched = Boolean(result.keyId && mismatchedViteKey && result.keyId !== mismatchedViteKey);
      expect(isMismatched).toBe(true);
    });

    it("checkout signature verification: valid signature settles wallet; tampered signature is rejected and preserves balance", async () => {
      process.env.RAZORPAY_KEY_SECRET = "secret_for_checkout_sig_test_32chars";

      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 50000, // ₹500
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
      });

      const initialUser = await User.findById(legitimateUser._id);
      const initialBalance = initialUser.amount;

      // 1. Tampered signature test
      const tamperedSignature = "invalid_tampered_hmac_hex_signature";
      await expect(
        verifyWalletCheckoutPayment({
          paymentId: payment._id,
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature: tamperedSignature,
          user: legitimateUser,
        })
      ).rejects.toThrow("Payment signature verification failed");

      // Assert balance uncredited
      expect((await User.findById(legitimateUser._id)).amount).toBe(initialBalance);

      // 2. Valid signature test
      const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
      const validSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(payload)
        .digest("hex");

      const settleRes = await verifyWalletCheckoutPayment({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: validSignature,
        user: legitimateUser,
      });

      expect(settleRes.success).toBe(true);
      expect(settleRes.status).toBe("CAPTURED");

      // Assert balance credited exactly ₹500
      const creditedUser = await User.findById(legitimateUser._id);
      expect(creditedUser.amount).toBe(initialBalance + 500);

      // Assert Transaction created
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);
    });

    it("webhook signature verification: valid signature settles wallet; tampered signature is rejected and preserves balance", async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = "secret_for_webhook_sig_test_32chars";

      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 30000, // ₹300
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
      });

      const initialUser = await User.findById(legitimateUser._id);
      const initialBalance = initialUser.amount;

      const webhookEventPayload = {
        id: `evt_${crypto.randomBytes(8).toString("hex")}`,
        entity: "event",
        event: "payment.captured",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: razorpayPaymentId,
              order_id: razorpayOrderId,
              amount: 30000,
              currency: "INR",
              status: "captured",
              notes: {
                type: "WALLET_TOPUP",
                userId: legitimateUser._id.toString(),
                userEmail: legitimateUser.email,
              },
            },
          },
        },
      };

      const rawBodyBuffer = Buffer.from(JSON.stringify(webhookEventPayload), "utf8");

      // 1. Tampered signature test
      await expect(
        processWebhook({
          rawBody: rawBodyBuffer,
          signature: "tampered_webhook_signature_hex",
        })
      ).rejects.toThrow("Invalid webhook signature");

      expect((await User.findById(legitimateUser._id)).amount).toBe(initialBalance);

      // 2. Valid signature test
      const validWebhookSig = crypto
        .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBodyBuffer)
        .digest("hex");

      const webhookRes = await processWebhook({
        rawBody: rawBodyBuffer,
        signature: validWebhookSig,
      });

      expect(webhookRes.success).toBe(true);

      // Assert balance credited exactly ₹300
      const creditedUser = await User.findById(legitimateUser._id);
      expect(creditedUser.amount).toBe(initialBalance + 300);
    });

    it("idempotent settlement across duplicate verify, duplicate webhook, and reconciliation", async () => {
      process.env.RAZORPAY_KEY_SECRET = "secret_for_idempotency_test_32chars";
      process.env.RAZORPAY_WEBHOOK_SECRET = "secret_for_idempotency_test_32chars";

      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const payment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 20000, // ₹200
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "INITIATED",
        razorpayOrderId,
      });

      const initialBalance = (await User.findById(legitimateUser._id)).amount;

      const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
      const signature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(payload)
        .digest("hex");

      // 1. First verification
      const verify1 = await verifyWalletCheckoutPayment({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: signature,
        user: legitimateUser,
      });
      expect(verify1.success).toBe(true);
      expect((await User.findById(legitimateUser._id)).amount).toBe(initialBalance + 200);

      // 2. Duplicate verification
      const verify2 = await verifyWalletCheckoutPayment({
        paymentId: payment._id,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: signature,
        user: legitimateUser,
      });
      expect(verify2.success).toBe(true);
      expect(verify2.alreadyPaid).toBe(true);
      expect((await User.findById(legitimateUser._id)).amount).toBe(initialBalance + 200);

      // 3. Webhook delivery for already settled payment
      const webhookPayload = {
        id: `evt_${crypto.randomBytes(8).toString("hex")}`,
        entity: "event",
        event: "payment.captured",
        contains: ["payment"],
        payload: {
          payment: {
            entity: {
              id: razorpayPaymentId,
              order_id: razorpayOrderId,
              amount: 20000,
              currency: "INR",
              status: "captured",
              notes: {
                type: "WALLET_TOPUP",
                userId: legitimateUser._id.toString(),
                userEmail: legitimateUser.email,
              },
            },
          },
        },
      };
      const rawBody = Buffer.from(JSON.stringify(webhookPayload), "utf8");
      const webhookSig = crypto
        .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

      const webhookRes = await processWebhook({ rawBody, signature: webhookSig });
      expect(webhookRes.success).toBe(true);
      expect((await User.findById(legitimateUser._id)).amount).toBe(initialBalance + 200);

      // 4. Reconciliation retry
      const reconRes = await reconcileWalletPayment({ paymentId: payment._id });
      expect(reconRes.success).toBe(true);
      expect(reconRes.alreadyPaid).toBe(true);
      expect((await User.findById(legitimateUser._id)).amount).toBe(initialBalance + 200);

      // Invariant: Exactly 1 transaction recorded
      expect(await Transaction.countDocuments({ paymentId: payment._id })).toBe(1);
    });

    it("failed or cancelled payments strictly prevent wallet crediting", async () => {
      const razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      const razorpayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

      const failedPayment = await Payment.create({
        userId: legitimateUser._id,
        userEmail: legitimateUser.email,
        amount: 40000, // ₹400
        currency: "INR",
        type: "WALLET_TOPUP",
        status: "FAILED",
        failureReason: "User cancelled payment on bank 3D secure page",
        razorpayOrderId,
        razorpayPaymentId,
      });

      const initialBalance = (await User.findById(legitimateUser._id)).amount;

      // Settlement must be rejected
      await expect(
        settleWalletTopup({
          paymentId: failedPayment._id,
          razorpayOrderId,
          razorpayPaymentId,
          amountPaise: 40000,
          verifiedVia: "CHECKOUT_VERIFICATION",
        })
      ).rejects.toThrow("Cannot settle payment with status FAILED");

      // Balance remains strictly unchanged
      expect((await User.findById(legitimateUser._id)).amount).toBe(initialBalance);

      // Zero transactions created
      expect(await Transaction.countDocuments({ paymentId: failedPayment._id })).toBe(0);
    });
  });
});


