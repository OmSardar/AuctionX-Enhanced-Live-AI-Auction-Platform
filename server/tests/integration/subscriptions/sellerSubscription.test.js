const request = require("supertest");
const crypto = require("crypto");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const { createTestSeller, createTestUser } = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const Subscription = require("../../../src/modules/subscriptions/models/subscription");
const Seller = require("../../../src/modules/sellers/accounts/models/seller");
const Product = require("../../../src/modules/products/models/productSchema");
const { setProviderClient, resetProviderClient } = require("../../../src/modules/payments/services/paymentService");
const { expireStaleSubscriptions } = require("../../../src/modules/subscriptions/services/subscriptionService");

describe("Seller Subscription, Billing & Entitlement Integration Tests", () => {
  const TEST_KEY_SECRET = "mock_razorpay_secret_32chars_test_key";

  function generateSignature(orderId, paymentId, secret = TEST_KEY_SECRET) {
    return crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
  }

  beforeEach(async () => {
    await clearDatabase();
    resetProviderClient();
  });

  afterAll(() => {
    resetProviderClient();
  });

  describe("1. Public Plans API", () => {
    it("GET /api/seller/subscriptions/plans should return all configured plans and entitlements", async () => {
      const res = await request(app).get("/api/seller/subscriptions/plans");
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.plans)).toBe(true);
      expect(res.body.plans.length).toBeGreaterThanOrEqual(4);

      const planIds = res.body.plans.map((p) => p.id);
      expect(planIds).toContain("free");
      expect(planIds).toContain("freelancer");
      expect(planIds).toContain("business");
      expect(planIds).toContain("enterprise");

      // Verify structure of free vs paid plans
      const freePlan = res.body.plans.find((p) => p.id === "free");
      expect(freePlan.listingLimit).toBe(3);
      expect(freePlan.prices.monthly.amountPaise).toBe(0);

      const proPlan = res.body.plans.find((p) => p.id === "business");
      expect(proPlan.listingLimit).toBe(50);
      expect(proPlan.prices.monthly.amountPaise).toBe(299900);
    });
  });

  describe("2. Current Subscription Retrieval & Defaults", () => {
    it("should reject unauthenticated request with 401", async () => {
      const res = await request(app).get("/api/seller/subscriptions/current");
      expect(res.statusCode).toBe(401);
    });

    it("should reject ordinary buyer token with 403 Forbidden", async () => {
      const { token: buyerToken } = await createTestUser({ email: "buyer_sub@example.com" });
      const res = await request(app)
        .get("/api/seller/subscriptions/current")
        .set("Cookie", [`token=${buyerToken}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/Seller privileges required/i);
    });

    it("should return default Free Starter tier with live listing usage for newly registered seller", async () => {
      const { seller, token } = await createTestSeller({ email: "new_seller_sub@example.com" });

      const res = await request(app)
        .get("/api/seller/subscriptions/current")
        .set("Cookie", [`sellerToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.plan.id).toBe("free");
      expect(res.body.usage.activeListings).toBe(0);
      expect(res.body.usage.maxListings).toBe(3);
      expect(res.body.usage.remaining).toBe(3);
      expect(res.body.usage.isLimitReached).toBe(false);
    });
  });

  describe("3. Subscription Checkout Flow", () => {
    it("should reject checkout for non-existent plan ID with 400", async () => {
      const csrf = createCsrfCredentials();
      const { token } = await createTestSeller({ email: "seller_checkout_bad@example.com" });

      const res = await request(app)
        .post("/api/seller/subscriptions/checkout")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ planId: "non_existent_plan" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/invalid subscription plan/i);
    });

    it("should reject subscription checkout if seller is Suspended", async () => {
      const csrf = createCsrfCredentials();
      const { token } = await createTestSeller({
        email: "suspended_seller_sub@example.com",
        status: "Suspended",
      });

      const res = await request(app)
        .post("/api/seller/subscriptions/checkout")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ planId: "business" });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/suspended/i);
    });

    it("should initiate checkout for paid plan with authoritative server-side pricing", async () => {
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({ email: "seller_paid_checkout@example.com" });

      const res = await request(app)
        .post("/api/seller/subscriptions/checkout")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          planId: "freelancer",
          billingInterval: "monthly",
          amount: 1, // Tampered client price — must be ignored!
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.orderId).toBeDefined();
      expect(res.body.amount).toBe(79900); // Authoritative price from config: ₹799
      expect(res.body.currency).toBe("INR");
      expect(res.body.plan.id).toBe("freelancer");

      // Verify pending Subscription record created in database
      const pendingSub = await Subscription.findOne({ razorpayOrderId: res.body.orderId });
      expect(pendingSub).toBeDefined();
      expect(pendingSub.status).toBe("pending");
      expect(pendingSub.userEmail).toBe(seller.email);
      expect(pendingSub.amountPaise).toBe(79900);
    });

    it("should directly switch to Free tier without payment gateway call", async () => {
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({ email: "seller_switch_free@example.com" });

      const res = await request(app)
        .post("/api/seller/subscriptions/checkout")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ planId: "free" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isFree).toBe(true);
      expect(res.body.subscription.status).toBe("free");
    });
  });

  describe("4. Payment Signature Verification & Authoritative Activation", () => {
    it("should reject payment verification if required parameters are missing", async () => {
      const csrf = createCsrfCredentials();
      const { token } = await createTestSeller({ email: "seller_ver_missing@example.com" });

      const res = await request(app)
        .post("/api/seller/subscriptions/verify")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ razorpayOrderId: "order_123" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Missing required payment verification parameters/i);
    });

    it("should reject IDOR attempt when Seller A tries to verify Seller B's subscription order", async () => {
      const csrf = createCsrfCredentials();
      const { token: tokenA } = await createTestSeller({ email: "seller_attacker@example.com" });
      const { seller: sellerB } = await createTestSeller({ email: "seller_victim@example.com" });

      const victimOrder = await Subscription.create({
        planId: "business",
        planName: "Business",
        userEmail: sellerB.email,
        sellerId: sellerB._id,
        price: 2999,
        amountPaise: 299900,
        status: "pending",
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        razorpayOrderId: "order_victim_secret_999",
      });

      const fakePaymentId = "pay_fake_attacker_123";
      const fakeSig = generateSignature(victimOrder.razorpayOrderId, fakePaymentId);

      const res = await request(app)
        .post("/api/seller/subscriptions/verify")
        .set("Cookie", [csrf.cookie, `sellerToken=${tokenA}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          razorpayOrderId: victimOrder.razorpayOrderId,
          razorpayPaymentId: fakePaymentId,
          razorpaySignature: fakeSig,
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/Forbidden/i);
    });

    it("should reject invalid cryptographic payment signatures with HTTP 400", async () => {
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({ email: "seller_bad_sig@example.com" });

      const pendingOrder = await Subscription.create({
        planId: "business",
        planName: "Business",
        userEmail: seller.email,
        sellerId: seller._id,
        price: 2999,
        amountPaise: 299900,
        status: "pending",
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        razorpayOrderId: "order_badsig_456",
      });

      const res = await request(app)
        .post("/api/seller/subscriptions/verify")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          razorpayOrderId: pendingOrder.razorpayOrderId,
          razorpayPaymentId: "pay_tampered_789",
          razorpaySignature: "invalid_hex_signature_abc123",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/signature verification failed/i);

      // Verify order status is failed
      const updated = await Subscription.findById(pendingOrder._id);
      expect(updated.status).toBe("failed");
    });

    it("should authoritatively activate subscription and update listing limits on valid verification", async () => {
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({ email: "seller_activate_sub@example.com" });

      const pendingOrder = await Subscription.create({
        planId: "business",
        planName: "Business",
        billingInterval: "monthly",
        userEmail: seller.email,
        sellerId: seller._id,
        price: 2999,
        amountPaise: 299900,
        status: "pending",
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        razorpayOrderId: "order_valid_activation_101",
      });

      const paymentId = "pay_valid_payment_999";
      const validSig = generateSignature(pendingOrder.razorpayOrderId, paymentId);

      const res = await request(app)
        .post("/api/seller/subscriptions/verify")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          razorpayOrderId: pendingOrder.razorpayOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.subscription.status).toBe("active");
      expect(res.body.subscription.listingLimit).toBe(50); // Business tier listing limit

      // Verify in database
      const activatedSub = await Subscription.findById(pendingOrder._id);
      expect(activatedSub.status).toBe("active");
      expect(activatedSub.razorpayPaymentId).toBe(paymentId);

      // Verify seller document cached fields
      const updatedSeller = await Seller.findById(seller._id);
      expect(updatedSeller.subscriptionPlan).toBe("business");
      expect(updatedSeller.subscriptionStatus).toBe("active");

      // Verify idempotent re-verification succeeds cleanly
      const resIdempotent = await request(app)
        .post("/api/seller/subscriptions/verify")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          razorpayOrderId: pendingOrder.razorpayOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validSig,
        });
      expect(resIdempotent.statusCode).toBe(200);
      expect(resIdempotent.body.isIdempotent).toBe(true);
    });
  });

  describe("5. Listing Limit & Entitlement Enforcement", () => {
    it("should enforce Free plan listing limit (max 3 active listings) and allow after upgrade", async () => {
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({ email: "seller_quota@example.com" });

      const now = new Date();
      const futureEnd = new Date(now.getTime() + 1000000);

      // Create 3 active listings directly
      for (let i = 1; i <= 3; i++) {
        await Product.create({
          name: `Listing Item ${i}`,
          category: "Art",
          description: [{ name: "Details", description: "Sample item" }],
          mobileNumber: "9876543210",
          biddingStartDate: now,
          biddingStartTime: "12:00",
          biddingStartPrice: 100 * i,
          email: seller.email,
          images: [{ secure_url: "https://example.com/art.jpg", public_id: `art_${i}` }],
          biddingEndTime: futureEnd.toISOString(),
          startingPrice: 100 * i,
          currentPrice: 100 * i,
          status: "Active",
        });
      }

      // Check current subscription usage reflects 3/3 active listings
      const resUsage = await request(app)
        .get("/api/seller/subscriptions/current")
        .set("Cookie", [`sellerToken=${token}`]);

      expect(resUsage.statusCode).toBe(200);
      expect(resUsage.body.usage.activeListings).toBe(3);
      expect(resUsage.body.usage.maxListings).toBe(3);
      expect(resUsage.body.usage.remaining).toBe(0);
      expect(resUsage.body.usage.isLimitReached).toBe(true);

      // Attempt to create a 4th listing -> must be rejected with 403 SUBSCRIPTION_LIMIT_EXCEEDED
      const fourthProductData = {
        name: "Forbidden 4th Item",
        category: "Art",
        description: JSON.stringify([{ name: "Condition", description: "Mint" }]),
        mobileNumber: "9876543210",
        biddingStartDate: "2026-10-25",
        biddingStartTime: "10:00",
        biddingStartPrice: 500,
        images: [{ secure_url: "https://example.com/art4.jpg", public_id: "art_4" }],
      };

      const resBlocked = await request(app)
        .post("/api/products")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send(fourthProductData);

      expect(resBlocked.statusCode).toBe(403);
      expect(resBlocked.body.code).toBe("SUBSCRIPTION_LIMIT_EXCEEDED");
      expect(resBlocked.body.message).toMatch(/limit reached/i);

      // Now upgrade seller to Freelancer plan (limit: 15)
      await Subscription.create({
        planId: "freelancer",
        planName: "Freelancer",
        userEmail: seller.email,
        sellerId: seller._id,
        price: 799,
        amountPaise: 79900,
        listingLimit: 15,
        status: "active",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      await Seller.updateOne(
        { _id: seller._id },
        { subscriptionPlan: "freelancer", subscriptionStatus: "active" }
      );

      // Now create the 4th listing -> should succeed!
      const resAllowed = await request(app)
        .post("/api/products")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send(fourthProductData);

      expect(resAllowed.statusCode).toBe(201);
      expect(resAllowed.body.success).toBe(true);
      expect(resAllowed.body.product.name).toBe("Forbidden 4th Item");
    });
  });

  describe("6. Subscription Cancellation & History", () => {
    it("should allow active paid subscriber to schedule cancellation at period end", async () => {
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({ email: "seller_cancel_test@example.com" });

      await Subscription.create({
        planId: "business",
        planName: "Business",
        userEmail: seller.email,
        sellerId: seller._id,
        price: 2999,
        amountPaise: 299900,
        listingLimit: 50,
        status: "active",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post("/api/seller/subscriptions/cancel")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Scaling down storefront operations" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.subscription.cancelAtPeriodEnd).toBe(true);
      expect(res.body.subscription.cancellationReason).toBe("Scaling down storefront operations");
    });

    it("should return paginated subscription history for authenticated seller", async () => {
      const { seller, token } = await createTestSeller({ email: "seller_history_sub@example.com" });

      // Create 2 history records
      await Subscription.create([
        {
          planId: "freelancer",
          planName: "Freelancer",
          userEmail: seller.email,
          sellerId: seller._id,
          price: 799,
          amountPaise: 79900,
          status: "expired",
          startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        {
          planId: "business",
          planName: "Business",
          userEmail: seller.email,
          sellerId: seller._id,
          price: 2999,
          amountPaise: 299900,
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      ]);

      const res = await request(app)
        .get("/api/seller/subscriptions/history")
        .set("Cookie", [`sellerToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total).toBe(2);
      expect(res.body.subscriptions.length).toBe(2);
    });
  });

  describe("7. Production Payment Bypass & Hardening Invariants", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("should reject mock payment order creation in production mode without live credentials", async () => {
      process.env.NODE_ENV = "production";
      const csrf = createCsrfCredentials();
      const { token } = await createTestSeller({ email: "prod_bypass_seller@example.com" });

      const res = await request(app)
        .post("/api/seller/subscriptions/checkout")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ planId: "business", billingInterval: "monthly" });

      expect(res.statusCode).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("GATEWAY_UNAVAILABLE");
    });

    it("should strictly reject mock signature and mock payment ID verification in production mode", async () => {
      process.env.NODE_ENV = "production";
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({ email: "prod_verify_mock@example.com" });

      const pendingSub = await Subscription.create({
        planId: "freelancer",
        planName: "Freelancer",
        userEmail: seller.email,
        sellerId: seller._id,
        price: 799,
        amountPaise: 79900,
        status: "pending",
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        razorpayOrderId: "order_mock_prod_test",
      });

      const res = await request(app)
        .post("/api/seller/subscriptions/verify")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          razorpayOrderId: pendingSub.razorpayOrderId,
          razorpayPaymentId: "pay_mock_12345678",
          razorpaySignature: "test_mock_sig_12345678",
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("MOCK_PAYMENT_PROHIBITED");
    });

    it("should reject verification when payment ID is already utilized by another subscription (Payment ID Reuse Prevention)", async () => {
      const csrf = createCsrfCredentials();
      const { seller: sellerA, token: tokenA } = await createTestSeller({ email: "seller_reuse_a@example.com" });
      const { seller: sellerB, token: tokenB } = await createTestSeller({ email: "seller_reuse_b@example.com" });

      const paymentId = "pay_unique_shared_token_999";
      const orderA = "order_aaa_111";
      const orderB = "order_bbb_222";

      // Seller A has already activated using paymentId
      await Subscription.create({
        planId: "freelancer",
        planName: "Freelancer",
        userEmail: sellerA.email,
        sellerId: sellerA._id,
        price: 799,
        amountPaise: 79900,
        status: "active",
        razorpayOrderId: orderA,
        razorpayPaymentId: paymentId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Seller B has a pending order
      await Subscription.create({
        planId: "business",
        planName: "Business",
        userEmail: sellerB.email,
        sellerId: sellerB._id,
        price: 2999,
        amountPaise: 299900,
        status: "pending",
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        razorpayOrderId: orderB,
      });

      // Seller B attempts to reuse Seller A's payment ID
      const sigB = generateSignature(orderB, paymentId);
      const res = await request(app)
        .post("/api/seller/subscriptions/verify")
        .set("Cookie", [csrf.cookie, `sellerToken=${tokenB}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          razorpayOrderId: orderB,
          razorpayPaymentId: paymentId,
          razorpaySignature: sigB,
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("PAYMENT_REUSED");
    });

    it("should be idempotent on repeated verification requests without duplicating activations or records", async () => {
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({ email: "seller_idempotent@example.com" });

      const orderId = "order_idem_123";
      const paymentId = "pay_idem_456";
      const sig = generateSignature(orderId, paymentId);

      await Subscription.create({
        planId: "freelancer",
        planName: "Freelancer",
        userEmail: seller.email,
        sellerId: seller._id,
        price: 799,
        amountPaise: 79900,
        status: "pending",
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        razorpayOrderId: orderId,
      });

      // First verification call
      const res1 = await request(app)
        .post("/api/seller/subscriptions/verify")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: sig,
        });

      expect(res1.statusCode).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.subscription.status).toBe("active");

      // Repeated duplicate verification call
      const res2 = await request(app)
        .post("/api/seller/subscriptions/verify")
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: sig,
        });

      expect(res2.statusCode).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.isIdempotent).toBe(true);
    });
  });

  describe("8. Expiry Lifecycle, Scheduled Reversion & Quota Bypass Prevention", () => {
    function buildProductDoc(email, name, status = "Active") {
      return {
        name,
        email,
        category: "Art",
        description: [{ name: "Condition", description: "Mint" }],
        mobileNumber: "9876543210",
        biddingStartDate: "2026-10-25",
        biddingStartTime: "10:00",
        biddingEndDate: "2026-10-26",
        biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
        biddingStartPrice: 100,
        startingPrice: 100,
        currentPrice: 100,
        status,
        images: [{ secure_url: "https://example.com/art.jpg", public_id: `art_${Date.now()}_${Math.random()}` }],
      };
    }

    it("should expire subscription and revert listing quota to Free tier when endDate passes", async () => {
      const { seller, token } = await createTestSeller({ email: "seller_expired_sub@example.com" });

      // Create a business subscription that expired yesterday
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await Subscription.create({
        planId: "business",
        planName: "Business",
        userEmail: seller.email,
        sellerId: seller._id,
        price: 2999,
        amountPaise: 299900,
        status: "active",
        startDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        endDate: yesterday,
        listingLimit: 50,
      });

      // Fetch current subscription
      const res = await request(app)
        .get("/api/seller/subscriptions/current")
        .set("Cookie", [`sellerToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.plan.id).toBe("free");
      expect(res.body.usage.maxListings).toBe(3); // Reverted to Starter Free limit

      // Database should reflect expired
      const dbSub = await Subscription.findOne({ userEmail: seller.email, planId: "business" });
      expect(dbSub.status).toBe("expired");
    });

    it("should allow expireStaleSubscriptions service to sweep and mark expired records", async () => {
      const { seller } = await createTestSeller({ email: "seller_sweep_exp@example.com" });

      await Subscription.create({
        planId: "freelancer",
        planName: "Freelancer",
        userEmail: seller.email,
        sellerId: seller._id,
        price: 799,
        amountPaise: 79900,
        status: "active",
        startDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      });

      const sweepResult = await expireStaleSubscriptions();
      expect(sweepResult.success).toBe(true);
      expect(sweepResult.expiredCount).toBeGreaterThanOrEqual(1);

      const dbSub = await Subscription.findOne({ userEmail: seller.email });
      expect(dbSub.status).toBe("expired");
    });

    it("should prevent quota bypass via PATCH /api/products/statuspatch/:id when at Free tier limit", async () => {
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({ email: "quota_patch_seller@example.com" });

      // Create 3 active products (max allowed on Free tier)
      await Product.create([
        buildProductDoc(seller.email, "Active Item 1", "Active"),
        buildProductDoc(seller.email, "Active Item 2", "Active"),
        buildProductDoc(seller.email, "Active Item 3", "Active"),
      ]);

      // Create a Closed product
      const closedProduct = await Product.create(
        buildProductDoc(seller.email, "Closed Item To Reactivate", "Closed")
      );

      // Attempt to reactivate Closed product via statuspatch
      const res = await request(app)
        .patch(`/api/products/statuspatch/${closedProduct._id}`)
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Active" });

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe("SUBSCRIPTION_LIMIT_EXCEEDED");
      expect(res.body.currentCount).toBe(3);
      expect(res.body.limit).toBe(3);
    });

    it("should prevent quota bypass via generic PUT /api/products/:id when at Free tier limit", async () => {
      const csrf = createCsrfCredentials();
      const { seller, token } = await createTestSeller({ email: "quota_put_seller@example.com" });

      // Create 3 active products
      await Product.create([
        buildProductDoc(seller.email, "Item A", "Active"),
        buildProductDoc(seller.email, "Item B", "Active"),
        buildProductDoc(seller.email, "Item C", "Active"),
      ]);

      const draftProduct = await Product.create(
        buildProductDoc(seller.email, "Draft Item", "Closed")
      );

      // Attempt to set status: "Active" via PUT /api/products/:id
      const res = await request(app)
        .put(`/api/products/${draftProduct._id}`)
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Active", name: "Attempted Activated Item" });

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe("SUBSCRIPTION_LIMIT_EXCEEDED");
    });
  });

  describe("9. Subscription Webhook Processing & Cryptographic Security", () => {
    const WEBHOOK_SECRET = "mock_webhook_secret_key_32chars_test";

    function generateWebhookSignature(payload, secret = WEBHOOK_SECRET) {
      const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
      return crypto.createHmac("sha256", secret).update(raw).digest("hex");
    }

    it("should reject subscription webhook with invalid HMAC signature with HTTP 400", async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

      const eventPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_test_webhook_invalid_sig",
              order_id: "order_sub_test_invalid",
              amount: 199900,
            },
          },
        },
      };

      const res = await request(app)
        .post("/api/seller/subscriptions/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", "invalid_tampered_signature_hex")
        .send(eventPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Invalid webhook signature/i);
    });

    it("should bypass CSRF without token and process payment.captured webhook with valid HMAC signature", async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
      const { seller } = await createTestSeller({ email: "sub_webhook_seller@example.com" });

      const pendingSub = await Subscription.create({
        sellerId: seller._id,
        userEmail: seller.email,
        planId: "business",
        planName: "Professional",
        billingInterval: "monthly",
        price: 1999,
        amountPaise: 199900,
        currency: "INR",
        status: "pending",
        razorpayOrderId: "order_sub_webhook_valid_123",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const eventPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_sub_webhook_valid_456",
              order_id: "order_sub_webhook_valid_123",
              amount: 199900,
            },
          },
        },
      };

      const rawJson = JSON.stringify(eventPayload);
      const signature = generateWebhookSignature(rawJson, WEBHOOK_SECRET);

      // Notice: NO CSRF cookie, NO CSRF header! Demonstrates webhook CSRF bypass
      const res = await request(app)
        .post("/api/seller/subscriptions/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(rawJson);

      expect(res.statusCode).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.processed).toBe(true);

      const updatedSub = await Subscription.findById(pendingSub._id);
      expect(updatedSub.status).toBe("active");
      expect(updatedSub.razorpayPaymentId).toBe("pay_sub_webhook_valid_456");

      const updatedSeller = await Seller.findById(seller._id);
      expect(updatedSeller.subscriptionPlan).toBe("business");
      expect(updatedSeller.subscriptionStatus).toBe("active");
    });

    it("should handle duplicate subscription webhook delivery idempotently without re-processing", async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
      const { seller } = await createTestSeller({ email: "sub_idempotent_seller@example.com" });

      await Subscription.create({
        sellerId: seller._id,
        userEmail: seller.email,
        planId: "enterprise",
        planName: "Enterprise Elite",
        billingInterval: "monthly",
        price: 4999,
        amountPaise: 499900,
        currency: "INR",
        status: "active",
        razorpayOrderId: "order_sub_already_active_789",
        razorpayPaymentId: "pay_sub_already_active_789",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const eventPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_sub_already_active_789",
              order_id: "order_sub_already_active_789",
              amount: 499900,
            },
          },
        },
      };

      const rawJson = JSON.stringify(eventPayload);
      const signature = generateWebhookSignature(rawJson, WEBHOOK_SECRET);

      const res = await request(app)
        .post("/api/seller/subscriptions/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(rawJson);

      expect(res.statusCode).toBe(200);
      expect(res.body.isIdempotent).toBe(true);
      expect(res.body.message).toMatch(/already active/i);
    });
  });
});

