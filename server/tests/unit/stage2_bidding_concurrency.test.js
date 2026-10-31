/**
 * Stage 2 Remediation Verification Suite:
 * - Authoritative Bidding & Concurrency Engine
 * - Dynamic Anti-Sniping Soft-Close Extensions
 * - Opening Bid Race Atomic Elimination (HIGH-01)
 * - Concurrent Minimum Increment Enforcement (CRIT-02)
 * - Scoped Idempotency & Duplicate Key Resolution (HIGH-02)
 * - Failure-Injection & Non-Rollback Consistency Invariants (CRIT-01)
 * - Canonical Fields Initialization in Product Creation (HIGH-03)
 * - Deterministic Bid History & Route Lockdown (LOW-01)
 */

const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../server");
const Product = require("../../src/modules/products/models/productSchema");
const Bid = require("../../src/modules/bidding/models/bidSchema");
const {
  placeBid,
  getBidHistory,
  calculateMinimumNextBid,
  BidError,
} = require("../../src/modules/bidding/services/bidService");
const { createTestUser, generateUserToken } = require("../helpers/authHelper");
const { createCsrfCredentials } = require("../helpers/csrfHelper");

describe("Stage 2 — Authoritative Bidding & Concurrency Remediation Suite", () => {
  let sellerUser;
  let bidderA;
  let bidderB;
  let bidderC;

  beforeAll(async () => {
    await Bid.init();
    await Product.init();
    sellerUser = await createTestUser({ email: "seller_stage2@test.com", name: "Stage 2 Seller" });
    bidderA = await createTestUser({ email: "bidder_a@test.com", name: "Bidder Alpha" });
    bidderB = await createTestUser({ email: "bidder_b@test.com", name: "Bidder Beta" });
    bidderC = await createTestUser({ email: "bidder_c@test.com", name: "Bidder Gamma" });
  });

  afterEach(async () => {
    await Product.deleteMany({ email: "seller_stage2@test.com" });
    await Bid.deleteMany({});
  });

  async function createFixtureProduct(overrides = {}) {
    const startTime = overrides.startTime || new Date(Date.now() - 3600 * 1000); // 1h ago
    const endTime = overrides.endTime || new Date(Date.now() + 3600 * 1000); // 1h future
    const originalEndTime = overrides.originalEndTime || endTime;
    const startPrice = overrides.startingPrice !== undefined ? overrides.startingPrice : 1000;

    const product = new Product({
      name: overrides.name || "Vintage Watch",
      category: "Antiques",
      description: [{ name: "Condition", description: "Mint" }],
      email: overrides.email || sellerUser.user.email,
      mobileNumber: "9876543210",
      images: [{ secure_url: "https://example.com/watch.jpg", public_id: "watch_1" }],
      biddingStartDate: startTime,
      biddingStartTime: startTime.toISOString(),
      biddingEndTime: endTime.toISOString(),
      biddingStartPrice: startPrice,
      startingPrice: startPrice,
      currentPrice: overrides.currentPrice !== undefined ? overrides.currentPrice : startPrice,
      startTime: startTime,
      endTime: endTime,
      originalEndTime: originalEndTime,
      maxExtensionDeadline:
        overrides.maxExtensionDeadline ||
        new Date(originalEndTime.getTime() + 15 * 60 * 1000),
      antiSnipeCount: overrides.antiSnipeCount || 0,
      status: overrides.status || "Active",
      bidCount: overrides.bidCount !== undefined ? overrides.bidCount : 0,
      minIncrement: overrides.minIncrement || 50,
      ...overrides,
    });

    return await product.save();
  }

  describe("A. Server-Side Validations, Precision & Authorization", () => {
    it("Rejects non-existent or invalid product ID", async () => {
      await expect(
        placeBid({
          productId: "invalid-id",
          bidder: bidderA.user,
          amount: 1100,
        })
      ).rejects.toThrow("Invalid product identifier");

      const randomId = new mongoose.Types.ObjectId().toString();
      await expect(
        placeBid({
          productId: randomId,
          bidder: bidderA.user,
          amount: 1100,
        })
      ).rejects.toThrow("Product not found");
    });

    it("Rejects unauthenticated bidder", async () => {
      const product = await createFixtureProduct();
      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: null,
          amount: 1100,
        })
      ).rejects.toThrow("Authentication required to place a bid");
    });

    it("Rejects malformed, negative, zero, or NaN amounts", async () => {
      const product = await createFixtureProduct();

      await expect(
        placeBid({ productId: product._id.toString(), bidder: bidderA.user, amount: -100 })
      ).rejects.toThrow("Bid amount must be a positive finite number");

      await expect(
        placeBid({ productId: product._id.toString(), bidder: bidderA.user, amount: 0 })
      ).rejects.toThrow("Bid amount must be a positive finite number");

      await expect(
        placeBid({ productId: product._id.toString(), bidder: bidderA.user, amount: "not_a_number" })
      ).rejects.toThrow("Bid amount must be a positive finite number");

      await expect(
        placeBid({ productId: product._id.toString(), bidder: bidderA.user, amount: Infinity })
      ).rejects.toThrow("Bid amount must be a positive finite number");
    });

    it("Rejects fractional amounts with more than 2 decimal places (paise precision)", async () => {
      const product = await createFixtureProduct();

      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1050.125, // 3 decimal places
        })
      ).rejects.toThrow("Bid amount cannot have more than 2 decimal places (paise)");
    });

    it("Rejects seller bidding on their own listing", async () => {
      const product = await createFixtureProduct();

      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: sellerUser.user,
          amount: 1100,
        })
      ).rejects.toThrow("Sellers are not permitted to bid on their own listings");
    });

    it("Rejects bid if auction status is closed or inactive", async () => {
      const product = await createFixtureProduct({ status: "Closed" });

      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1100,
        })
      ).rejects.toThrow("Bidding has ended or is not active for this product");
    });

    it("Rejects bid if auction has not started yet (server time check)", async () => {
      const futureStart = new Date(Date.now() + 60 * 60 * 1000);
      const product = await createFixtureProduct({
        startTime: futureStart,
        endTime: new Date(futureStart.getTime() + 60 * 60 * 1000),
      });

      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1100,
          now: new Date(),
        })
      ).rejects.toThrow("Bidding has not started yet");
    });

    it("Rejects bid if auction has already closed (server time check)", async () => {
      const pastEnd = new Date(Date.now() - 60 * 1000);
      const product = await createFixtureProduct({
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: pastEnd,
      });

      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1100,
          now: new Date(),
        })
      ).rejects.toThrow("Operation not allowed, bidding time has passed");
    });

    it("Rejects bid below minimum increment (currentPrice + minIncrement)", async () => {
      const product = await createFixtureProduct({ currentPrice: 1000, bidCount: 1, minIncrement: 50 });

      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1020, // 30 below required
        })
      ).rejects.toThrow("Bid must be at least ₹1050");
    });
  });

  describe("B. Opening Bid Race & Minimum Increment Concurrency", () => {
    it("Resolves two simultaneous opening bids at starting price: exactly one winner, one 409 conflict (HIGH-01)", async () => {
      // Auction at bidCount: 0, startingPrice: 1000
      const product = await createFixtureProduct({ startingPrice: 1000, currentPrice: 1000, bidCount: 0 });

      const bidPromises = [
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1000,
        }),
        placeBid({
          productId: product._id.toString(),
          bidder: bidderB.user,
          amount: 1000,
        }),
      ];

      const results = await Promise.allSettled(bidPromises);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly ONE opening bid can win
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      expect(rejected[0].reason).toBeInstanceOf(BidError);
      expect(rejected[0].reason.statusCode).toBe(409);
      expect(rejected[0].reason.code).toBe("BID_OUTBID");

      // Database invariants
      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.currentPrice).toBe(1000);
      expect(dbProduct.bidCount).toBe(1);

      // Bid ledger must contain exactly 1 ACCEPTED bid (the losing bid is marked REJECTED)
      const acceptedBids = await Bid.find({ productId: product._id, status: "ACCEPTED" });
      expect(acceptedBids.length).toBe(1);
      expect(acceptedBids[0].amount).toBe(1000);
    });

    it("Enforces minimum increment under concurrency: prevents concurrent bypass (CRIT-02)", async () => {
      // Current price: 1000, minIncrement: 50. Min valid next bid is 1050.
      const product = await createFixtureProduct({ currentPrice: 1000, bidCount: 1, minIncrement: 50 });

      // Bidder A bids 1050 (valid). Bidder B bids 1060 (valid against 1000, but violates 1050 + 50 = 1100).
      // Both start at the same time with stale view of 1000.
      const bidPromises = [
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1050,
        }),
        placeBid({
          productId: product._id.toString(),
          bidder: bidderB.user,
          amount: 1060,
        }),
      ];

      const results = await Promise.allSettled(bidPromises);
      const fulfilled = results.filter((r) => r.status === "fulfilled");

      // If 1050 commits first, 1060 MUST BE REJECTED because 1060 < 1050 + 50
      // If 1060 commits first, 1050 MUST BE REJECTED because 1050 < 1060
      // In either case, exactly ONE bid can be accepted!
      expect(fulfilled.length).toBe(1);

      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.bidCount).toBe(2); // Initial fixture had bidCount: 1 + 1 new accepted bid
      const acceptedBids = await Bid.find({ productId: product._id, status: "ACCEPTED" });
      expect(acceptedBids.length).toBe(1);
    });

    it("Preserves the seller's original starting price when bids are placed", async () => {
      const product = await createFixtureProduct({ startingPrice: 1000, currentPrice: 1000, bidCount: 0 });

      const result = await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
      });

      expect(result.product.startingPrice).toBe(1000);
      expect(result.product.currentPrice).toBe(1100);

      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.startingPrice).toBe(1000);
      expect(dbProduct.currentPrice).toBe(1100);
    });

    it("Resolves two concurrent bids at identical higher amount: exactly one winner", async () => {
      const product = await createFixtureProduct({ startingPrice: 1000, currentPrice: 1000, bidCount: 1, minIncrement: 50 });

      const bidPromises = [
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1100,
        }),
        placeBid({
          productId: product._id.toString(),
          bidder: bidderB.user,
          amount: 1100,
        }),
      ];

      const results = await Promise.allSettled(bidPromises);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect(rejected[0].reason.statusCode).toBe(409);

      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.currentPrice).toBe(1100);
      expect(dbProduct.bidCount).toBe(2);
    });

    it("Rejects a lower bid arriving after a higher bid", async () => {
      const product = await createFixtureProduct({ currentPrice: 1000, bidCount: 1, minIncrement: 50 });

      await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1200,
      });

      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: bidderB.user,
          amount: 1100,
        })
      ).rejects.toThrow("Bid must be at least ₹1250");

      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.currentPrice).toBe(1200);
    });

    it("Handles high concurrency correctly: 10 concurrent bids converge to highest bid", async () => {
      const product = await createFixtureProduct({ startingPrice: 1000, currentPrice: 1000, bidCount: 0 });

      const amounts = [1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1450, 1500];
      const promises = amounts.map((amt, idx) => {
        const bidder = idx % 2 === 0 ? bidderA.user : bidderB.user;
        return placeBid({
          productId: product._id.toString(),
          bidder,
          amount: amt,
        }).catch((err) => ({ error: err.code }));
      });

      await Promise.all(promises);

      const dbProduct = await Product.findById(product._id);
      const acceptedBids = await Bid.find({ productId: product._id, status: "ACCEPTED" }).sort({ amount: -1 });

      // Final price in product MUST equal highest accepted bid
      expect(dbProduct.currentPrice).toBe(acceptedBids[0].amount);
      expect(dbProduct.highestBidder.toString()).toBe(acceptedBids[0].bidder.toString());
      expect(dbProduct.bidCount).toBe(acceptedBids.length);
    });
  });

  describe("C. Scoped Idempotency & Duplicate Request Resolution (HIGH-02)", () => {
    it("Sequential retry with same idempotencyKey returns cached outcome without duplicate bid", async () => {
      const product = await createFixtureProduct({ currentPrice: 1000, bidCount: 0 });
      const key = "key-seq-12345";

      // First submission
      const firstResult = await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        idempotencyKey: key,
      });

      expect(firstResult.success).toBe(true);
      expect(firstResult.isDuplicate).toBeUndefined();

      // Duplicate retry
      const retryResult = await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        idempotencyKey: key,
      });

      expect(retryResult.success).toBe(true);
      expect(retryResult.isDuplicate).toBe(true);
      expect(retryResult.bid._id.toString()).toBe(firstResult.bid._id.toString());

      // Invariants: bidCount remains 1, exactly 1 Bid document exists
      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.bidCount).toBe(1);

      const bids = await Bid.find({ productId: product._id });
      expect(bids.length).toBe(1);
    });

    it("Concurrent duplicate requests with same idempotencyKey resolve safely with 1 bid created", async () => {
      const product = await createFixtureProduct({ currentPrice: 1000, bidCount: 0 });
      const key = "key-conc-race-999";

      const promises = [
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1100,
          idempotencyKey: key,
        }),
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1100,
          idempotencyKey: key,
        }),
      ];

      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter((r) => r.status === "fulfilled");

      // Both callers receive successful resolution
      expect(fulfilled.length).toBe(2);

      // Exactly ONE bid was durably created in database
      const bids = await Bid.find({ productId: product._id });
      expect(bids.length).toBe(1);
      expect(bids[0].idempotencyKey).toBe(key);
    });

    it("Reusing same idempotencyKey with a different amount is rejected with 409 conflict", async () => {
      const product = await createFixtureProduct({ currentPrice: 1000, bidCount: 0 });
      const key = "key-payload-mismatch";

      await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        idempotencyKey: key,
      });

      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1200, // Different amount!
          idempotencyKey: key,
        })
      ).rejects.toThrow("Idempotency key was previously submitted with a different bid amount");
    });

    it("Reusing same idempotencyKey with a different bidder is rejected with 409 collision", async () => {
      const product = await createFixtureProduct({ currentPrice: 1000, bidCount: 0 });
      const key = "key-bidder-collision";

      await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        idempotencyKey: key,
      });

      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: bidderB.user, // Different bidder!
          amount: 1100,
          idempotencyKey: key,
        })
      ).rejects.toThrow("Idempotency key already used by another bidder");
    });
  });

  describe("D. Failure Injection & Zero Stale Rollback Invariants (CRIT-01)", () => {
    it("A losing bid never corrupts or rolls back a subsequent winning bid", async () => {
      const product = await createFixtureProduct({ currentPrice: 1000, bidCount: 1, minIncrement: 50 });

      // Bidder B places a higher bid of 1200 and wins
      await placeBid({
        productId: product._id.toString(),
        bidder: bidderB.user,
        amount: 1200,
      });

      // Now Bidder A attempts an outbid request of 1100
      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1100,
        })
      ).rejects.toThrow();

      // Product MUST still belong to Bidder B at 1200 with zero corruption
      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.currentPrice).toBe(1200);
      expect(dbProduct.highestBidder.toString()).toBe(bidderB.user._id.toString());
      expect(dbProduct.bidCount).toBe(2);
    });

    it("Product and Bid ledger are durably linked via lastBidId", async () => {
      const product = await createFixtureProduct({ startingPrice: 1000, bidCount: 0 });

      const result = await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
      });

      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.lastBidId).toBeDefined();
      expect(dbProduct.lastBidId.toString()).toBe(result.bid._id.toString());
    });
  });

  describe("E. Anti-Sniping Soft-Close Dynamic Extensions", () => {
    it("Does NOT extend auction if bid is outside final 2-minute window", async () => {
      const scheduledEnd = new Date(Date.now() + 60 * 60 * 1000);
      const product = await createFixtureProduct({ endTime: scheduledEnd, originalEndTime: scheduledEnd });

      const bidTime = new Date(scheduledEnd.getTime() - 10 * 60 * 1000);
      const result = await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        now: bidTime,
      });

      expect(result.wasExtended).toBe(false);
      expect(result.product.endTime.getTime()).toBe(scheduledEnd.getTime());
    });

    it("Dynamically extends auction by 2 minutes when valid bid is placed in final 2 minutes", async () => {
      const scheduledEnd = new Date(Date.now() + 60 * 60 * 1000);
      const product = await createFixtureProduct({ endTime: scheduledEnd, originalEndTime: scheduledEnd });

      const bidTime = new Date(scheduledEnd.getTime() - 60 * 1000);
      const result = await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        now: bidTime,
      });

      expect(result.wasExtended).toBe(true);
      const expectedNewEnd = new Date(scheduledEnd.getTime() + 2 * 60 * 1000);
      expect(result.product.endTime.getTime()).toBe(expectedNewEnd.getTime());
      expect(result.product.antiSnipeCount).toBe(1);
    });

    it("Caps cumulative anti-sniping extension at 15 minutes beyond original scheduled end", async () => {
      const originalEnd = new Date(Date.now() + 60 * 60 * 1000);
      const maxDeadline = new Date(originalEnd.getTime() + 15 * 60 * 1000);
      const currentEnd = new Date(originalEnd.getTime() + 14 * 60 * 1000);

      const product = await createFixtureProduct({
        startTime: new Date(Date.now() - 3600 * 1000),
        originalEndTime: originalEnd,
        endTime: currentEnd,
        maxExtensionDeadline: maxDeadline,
        antiSnipeCount: 7,
        currentPrice: 1500,
        bidCount: 7,
      });

      const bidTime = new Date(currentEnd.getTime() - 30 * 1000);
      const result = await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1600,
        now: bidTime,
      });

      expect(result.wasExtended).toBe(true);
      expect(result.product.endTime.getTime()).toBe(maxDeadline.getTime());
    });

    it("Invalid or rejected bids NEVER extend the auction", async () => {
      const scheduledEnd = new Date(Date.now() + 60 * 60 * 1000);
      const product = await createFixtureProduct({
        endTime: scheduledEnd,
        originalEndTime: scheduledEnd,
        currentPrice: 1000,
        bidCount: 1,
        minIncrement: 50,
      });

      const bidTime = new Date(scheduledEnd.getTime() - 30 * 1000);

      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1010, // Below min 1050
          now: bidTime,
        })
      ).rejects.toThrow("Bid must be at least ₹1050");

      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.endTime.getTime()).toBe(scheduledEnd.getTime());
      expect(dbProduct.antiSnipeCount).toBe(0);
    });
  });

  describe("F. Product Creation Canonical Initialization (HIGH-03)", () => {
    it("POST /api/products initializes all canonical auction fields on creation", async () => {
      const csrf = createCsrfCredentials();
      const startDate = "2026-10-20";
      const startTime = "10:00";

      const res = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${sellerUser.token}`)
        .set("Cookie", [csrf.cookie, `token=${sellerUser.token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          name: "Canonical Test Product",
          category: "Art",
          description: JSON.stringify([{ name: "Condition", description: "Pristine" }]),
          mobileNumber: "9876543210",
          biddingStartDate: startDate,
          biddingStartTime: startTime,
          biddingStartPrice: 2500,
          hasBanner: "false",
          images: [{ secure_url: "https://example.com/art.jpg", public_id: "art_1" }],
        });

      // Controller must accept valid creation
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("success", true);

      const createdProduct = res.body.product;
      expect(createdProduct).toHaveProperty("startingPrice", 2500);
      expect(createdProduct).toHaveProperty("currentPrice", 2500);
      expect(createdProduct).toHaveProperty("bidCount", 0);
      expect(createdProduct).toHaveProperty("minIncrement", 50);
      expect(createdProduct).toHaveProperty("startTime");
      expect(createdProduct).toHaveProperty("originalEndTime");
      expect(createdProduct).toHaveProperty("endTime");
      expect(createdProduct).toHaveProperty("maxExtensionDeadline");
      expect(createdProduct).toHaveProperty("status", "Active");

      // Clean up created product
      await Product.findByIdAndDelete(createdProduct._id);
    });
  });

  describe("G. Deterministic Bid History & Audit Invariants (LOW-01)", () => {
    it("GET /api/products/:id/bids returns deterministic history and excludes non-accepted bids", async () => {
      const product = await createFixtureProduct();

      // Accepted bids
      await placeBid({ productId: product._id.toString(), bidder: bidderA.user, amount: 1100 });
      await placeBid({ productId: product._id.toString(), bidder: bidderB.user, amount: 1200 });

      // Injected rejected bid (should not appear)
      await Bid.create({
        productId: product._id,
        bidder: bidderC.user._id,
        bidderEmail: bidderC.user.email,
        bidderName: bidderC.user.name,
        amount: 1050,
        status: "REJECTED",
      });

      const res = await request(app).get(`/api/products/${product._id}/bids`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body.count).toBe(2); // Only the 2 ACCEPTED bids
      expect(res.body.bids[0].amount).toBe(1200);
      expect(res.body.bids[1].amount).toBe(1100);
    });
  });

  describe("H. HTTP Endpoints & Route Deprecation", () => {
    it("POST /api/products/:id/bid accepts valid bid and returns authoritative state", async () => {
      const product = await createFixtureProduct();
      const csrf = createCsrfCredentials();

      const res = await request(app)
        .post(`/api/products/${product._id}/bid`)
        .set("Authorization", `Bearer ${bidderA.token}`)
        .set("Cookie", [csrf.cookie, `token=${bidderA.token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ amount: 1100 });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body.data).toHaveProperty("currentPrice", 1100);
      expect(res.body.data).toHaveProperty("bidCount", 1);
    });

    it("PATCH /api/products/tempdata/:id is locked down and returns 403 Forbidden", async () => {
      const product = await createFixtureProduct();
      const csrf = createCsrfCredentials();

      const res = await request(app)
        .patch(`/api/products/tempdata/${product._id}`)
        .set("Authorization", `Bearer ${bidderA.token}`)
        .set("Cookie", [csrf.cookie, `token=${bidderA.token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ tempamount: 999999 });

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty("code", "ENDPOINT_DEPRECATED");
    });
  });
});
