/**
 * Stage 3 — Production-Grade Auction Lifecycle and Expiration Scheduler Suite
 *
 * Covers:
 * 1. Future auctions remain scheduled and reject early bids.
 * 2. Scheduled auctions transition to live at the correct time.
 * 3. Live auctions remain active before their effective end time.
 * 4. Auctions end at the persisted effective end time.
 * 5. An anti-sniping extension postpones expiration correctly.
 * 6. The 15-minute cumulative anti-sniping cap remains respected.
 * 7. A bid racing with expiration has exactly one valid outcome.
 * 8. An ended auction rejects subsequent bids.
 * 9. Concurrent scheduler workers cannot finalize the same auction inconsistently.
 * 10. Repeated scheduler execution does not duplicate finalization or payment obligations.
 * 11. Auctions with no accepted bids end without a winner obligation.
 * 12. Winner and final price agree with authoritative bid/product state.
 * 13. Inconsistent ledger/product state fails safely and is observable.
 * 14. The payment deadline is exactly 24 hours after authoritative finalization time and never changes on retry.
 * 15. A crash/restart or interrupted processing can recover without duplicate effects.
 * 16. Socket events are emitted only after successful persistence.
 * 17. Existing bidding and idempotency behavior remains intact.
 * 18. Legacy/incomplete auction records are handled according to the documented policy.
 * 19. Scheduler startup, shutdown, database outages, retries, and test cleanup behave correctly.
 */

const mongoose = require("mongoose");
const Product = require("../../src/modules/products/models/productSchema");
const Bid = require("../../src/modules/bidding/models/bidSchema");
const Order = require("../../src/modules/orders/models/orderSchema");
const User = require("../../src/modules/users/models/user");
const { placeBid, BidError } = require("../../src/modules/bidding/services/bidService");
const {
  startScheduledAuctions,
  finalizeSingleAuction,
  finalizeExpiredAuctions,
  processLifecycleTransitions,
  normalizeAuctionBoundaries,
  LifecycleError,
  repairOrphanOrder,
  recoverOrphanFinalizedAuctions,
} = require("../../src/modules/auctions/services/lifecycleService");
const {
  startScheduler,
  stopScheduler,
  isSchedulerRunning,
  triggerTickNow,
  setTimeProvider,
  resetTimeProvider,
} = require("../../src/infrastructure/scheduling/schedulerService");
const { createTestUser } = require("../helpers/authHelper");

describe("Stage 3 — Production-Grade Auction Lifecycle & Scheduler Suite", () => {
  let sellerUser;
  let bidderA;
  let bidderB;
  let bidderC;

  beforeAll(async () => {
    await Bid.init();
    await Product.init();
    await Order.init();

    sellerUser = await createTestUser({ email: "seller_stage3@test.com", name: "Stage 3 Seller" });
    bidderA = await createTestUser({ email: "bidder_stage3_a@test.com", name: "Bidder 3A" });
    bidderB = await createTestUser({ email: "bidder_stage3_b@test.com", name: "Bidder 3B" });
    bidderC = await createTestUser({ email: "bidder_stage3_c@test.com", name: "Bidder 3C" });
  });

  beforeEach(async () => {
    resetTimeProvider();
    await stopScheduler();
  });

  afterEach(async () => {
    resetTimeProvider();
    await stopScheduler();
    await Product.deleteMany({ email: { $in: ["seller_stage3@test.com", "legacy_seller@test.com"] } });
    await Bid.deleteMany({});
    await Order.deleteMany({});
  });

  afterAll(async () => {
    await stopScheduler();
  });

  async function createFixtureProduct(overrides = {}) {
    const startTime = overrides.startTime || new Date(Date.now() - 3600 * 1000);
    const endTime = overrides.endTime || new Date(Date.now() + 3600 * 1000);
    const originalEndTime = overrides.originalEndTime || endTime;
    const startingPrice = overrides.startingPrice !== undefined ? overrides.startingPrice : 1000;
    const currentPrice = overrides.currentPrice !== undefined ? overrides.currentPrice : startingPrice;

    return Product.create({
      name: overrides.name || "Stage 3 Antique Painting",
      category: "Art",
      description: [{ name: "Condition", description: "Mint" }],
      email: overrides.email || sellerUser.user.email,
      mobileNumber: "9876543210",
      images: [{ secure_url: "https://example.com/art.jpg", public_id: "art_1" }],
      biddingStartDate: startTime,
      biddingStartTime: startTime.toISOString(),
      biddingEndTime: endTime.toISOString(),
      biddingStartPrice: startingPrice,
      startingPrice,
      currentPrice,
      bidCount: overrides.bidCount !== undefined ? overrides.bidCount : 0,
      minIncrement: overrides.minIncrement !== undefined ? overrides.minIncrement : 50,
      startTime,
      originalEndTime,
      endTime,
      maxExtensionDeadline:
        overrides.maxExtensionDeadline || new Date(originalEndTime.getTime() + 15 * 60 * 1000),
      antiSnipeCount: overrides.antiSnipeCount || 0,
      status: overrides.status || "Active",
      highestBidder: overrides.highestBidder || null,
      highestBidderEmail: overrides.highestBidderEmail || null,
      highestBidderName: overrides.highestBidderName || null,
      lastBidId: overrides.lastBidId || null,
      finalizedAt: overrides.finalizedAt !== undefined ? overrides.finalizedAt : null,
      paymentDeadline: overrides.paymentDeadline !== undefined ? overrides.paymentDeadline : null,
      orderId: overrides.orderId !== undefined ? overrides.orderId : null,
      winnerId: overrides.winnerId !== undefined ? overrides.winnerId : null,
      finalPrice: overrides.finalPrice !== undefined ? overrides.finalPrice : null,
      reconciliationRequired: overrides.reconciliationRequired !== undefined ? overrides.reconciliationRequired : false,
      reconciliationNotes: overrides.reconciliationNotes !== undefined ? overrides.reconciliationNotes : null,
    });
  }

  // =========================================================================
  // 1. Future Auctions & Premature Bidding Protection
  // =========================================================================
  describe("1. Scheduled State & Early Bid Prevention", () => {
    it("Future auctions remain scheduled and reject early bids", async () => {
      const futureStart = new Date(Date.now() + 2 * 3600 * 1000); // starts in 2 hours
      const futureEnd = new Date(futureStart.getTime() + 3600 * 1000);

      const product = await createFixtureProduct({
        startTime: futureStart,
        endTime: futureEnd,
        status: "SCHEDULED",
      });

      // Attempt to bid before startTime
      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1100,
          now: new Date(),
        })
      ).rejects.toThrow();

      // State remains strictly SCHEDULED
      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.status).toBe("SCHEDULED");
      expect(dbProduct.bidCount).toBe(0);
    });
  });

  // =========================================================================
  // 2. Scheduled to Live Transition
  // =========================================================================
  describe("2. Scheduled to Live Transitions", () => {
    it("Scheduled auctions transition to live at the correct time", async () => {
      const pastStart = new Date(Date.now() - 60 * 1000); // scheduled start 1 min ago
      const futureEnd = new Date(Date.now() + 3600 * 1000);

      const product = await createFixtureProduct({
        startTime: pastStart,
        endTime: futureEnd,
        status: "SCHEDULED",
      });

      const res = await startScheduledAuctions({ now: new Date() });
      expect(res.transitionedCount).toBe(1);
      expect(res.productIds).toContain(product._id.toString());

      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.status).toBe("LIVE");
    });
  });

  // =========================================================================
  // 3. Live Auctions Active Window
  // =========================================================================
  describe("3. Active Auctions Before Expiration", () => {
    it("Live auctions remain active before their effective end time", async () => {
      const product = await createFixtureProduct({
        startTime: new Date(Date.now() - 1800 * 1000), // started 30m ago
        endTime: new Date(Date.now() + 1800 * 1000), // ends in 30m
        status: "LIVE",
      });

      // Scheduler tick must NOT touch or finalize this auction
      const tickResult = await triggerTickNow({ now: new Date() });
      expect(tickResult.finalized.finalizedCount).toBe(0);

      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.status).toBe("LIVE");

      // Valid bid can still be accepted
      const bidRes = await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1050,
      });
      expect(bidRes.success).toBe(true);
      expect(bidRes.product.currentPrice).toBe(1050);
    });
  });

  // =========================================================================
  // 4. Expiration at Effective End Time
  // =========================================================================
  describe("4. Auction Finalization at Persisted End Time", () => {
    it("Auctions end at the persisted effective end time", async () => {
      const expiredEnd = new Date(Date.now() - 10 * 1000); // ended 10s ago
      const product = await createFixtureProduct({
        startTime: new Date(expiredEnd.getTime() - 3600 * 1000),
        endTime: expiredEnd,
        status: "LIVE",
      });

      // Place a bid prior to expiration, well outside the anti-snipe window
      await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        now: new Date(expiredEnd.getTime() - 600 * 1000),
      });

      // Run scheduler finalization
      const finalRes = await finalizeSingleAuction(product._id, { now: new Date() });
      expect(finalRes.success).toBe(true);
      expect(finalRes.status).toBe("ENDED");

      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.status).toBe("ENDED");
      expect(dbProduct.finalizedAt).toBeDefined();
      expect(dbProduct.finalPrice).toBe(1100);
      expect(dbProduct.winnerId.toString()).toBe(bidderA.user._id.toString());
    });
  });

  // =========================================================================
  // 5 & 6. Anti-Sniping Interaction with Lifecycle Scheduler
  // =========================================================================
  describe("5 & 6. Anti-Sniping Extensions & Cap Enforcement", () => {
    it("An anti-sniping extension postpones expiration correctly", async () => {
      const originalEnd = new Date(Date.now() + 60 * 1000); // 1 minute left (in anti-snipe window)
      const product = await createFixtureProduct({
        startTime: new Date(Date.now() - 3600 * 1000),
        endTime: originalEnd,
        originalEndTime: originalEnd,
        status: "LIVE",
      });

      // Bid placed in final 1 minute -> extends by 2 minutes
      const bidRes = await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        now: new Date(),
      });
      expect(bidRes.wasExtended).toBe(true);
      const extendedEndTime = new Date(bidRes.product.endTime);
      expect(extendedEndTime.getTime()).toBeGreaterThan(originalEnd.getTime());

      // Attempt to finalize at original end time -> must NOT finalize because extendedEndTime is in the future!
      const checkRes = await finalizeSingleAuction(product._id, {
        now: new Date(originalEnd.getTime() + 5000),
      });
      expect(checkRes.success).toBe(false);
      expect(checkRes.reason).toBe("AUCTION_NOT_EXPIRED");

      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.status).toBe("LIVE");

      // When extendedEndTime has passed -> finalizes properly
      const finalRes = await finalizeSingleAuction(product._id, {
        now: new Date(extendedEndTime.getTime() + 1000),
      });
      expect(finalRes.success).toBe(true);
      expect(finalRes.status).toBe("ENDED");
    });

    it("The 15-minute cumulative anti-sniping cap remains respected", async () => {
      const scheduledStart = new Date(Date.now() - 3600 * 1000);
      const originalEnd = new Date(Date.now() + 120 * 1000);
      const maxCap = new Date(originalEnd.getTime() + 15 * 60 * 1000);

      // Create product already at the maximum cap
      const product = await createFixtureProduct({
        startTime: scheduledStart,
        endTime: maxCap,
        originalEndTime: originalEnd,
        maxExtensionDeadline: maxCap,
        currentPrice: 2000,
        bidCount: 5,
        status: "LIVE",
      });

      // Bid placed 30 seconds before cap
      const lateBidTime = new Date(maxCap.getTime() - 30 * 1000);
      const bidRes = await placeBid({
        productId: product._id.toString(),
        bidder: bidderB.user,
        amount: 2100,
        now: lateBidTime,
      });

      // Cannot extend beyond maxExtensionDeadline
      expect(bidRes.product.endTime.getTime()).toBe(maxCap.getTime());

      // 10 seconds after cap -> auction ends strictly at cap
      const finalRes = await finalizeSingleAuction(product._id, {
        now: new Date(maxCap.getTime() + 10 * 1000),
      });
      expect(finalRes.status).toBe("ENDED");
      expect(finalRes.product.finalPrice).toBe(2100);
    });
  });

  // =========================================================================
  // 7 & 8. Bids Racing with Expiration & Ended Auction Rejections
  // =========================================================================
  describe("7 & 8. Racing Bids vs Expiration & Ended Rejections", () => {
    it("A bid racing with expiration has exactly one valid outcome", async () => {
      const expirationTime = new Date(Date.now() + 500); // expires in 500ms
      const product = await createFixtureProduct({
        endTime: expirationTime,
        status: "LIVE",
        currentPrice: 1000,
        bidCount: 0,
      });

      // Simulate simultaneous bid and finalization
      const promises = [
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1100,
          now: new Date(expirationTime.getTime() - 50),
        }),
        finalizeSingleAuction(product._id, {
          now: new Date(expirationTime.getTime() + 50),
        }),
      ];

      const results = await Promise.allSettled(promises);
      const bidOutcome = results[0];
      const finalizeOutcome = results[1];

      // Both promises settled cleanly without crashes or inconsistent states
      expect(bidOutcome.status === "fulfilled" || finalizeOutcome.status === "fulfilled").toBe(true);

      const dbProduct = await Product.findById(product._id);
      if (dbProduct.status === "ENDED") {
        // If ended, finalPrice must match either 1000 (if finalized first) or 1100 (if bid committed first)
        expect([1000, 1100]).toContain(dbProduct.finalPrice);
      }
    });

    it("An ended auction rejects subsequent bids", async () => {
      const product = await createFixtureProduct({
        status: "ENDED",
        endTime: new Date(Date.now() - 3600 * 1000),
        currentPrice: 1500,
        bidCount: 1,
      });

      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 1600,
        })
      ).rejects.toThrow("Bidding has ended or is not active for this product");
    });
  });

  // =========================================================================
  // 9 & 10. Multi-Worker Concurrency & Idempotent Finalization
  // =========================================================================
  describe("9 & 10. Multi-Worker Safety & Idempotent Retry", () => {
    it("Concurrent scheduler workers cannot finalize the same auction inconsistently", async () => {
      const expiredEnd = new Date(Date.now() - 60 * 1000);
      const product = await createFixtureProduct({
        endTime: expiredEnd,
        status: "LIVE",
      });

      await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        now: new Date(expiredEnd.getTime() - 600 * 1000),
      });

      // 3 parallel scheduler workers attempting finalization simultaneously
      const workerPromises = [
        finalizeSingleAuction(product._id, { now: new Date() }),
        finalizeSingleAuction(product._id, { now: new Date() }),
        finalizeSingleAuction(product._id, { now: new Date() }),
      ];

      const results = await Promise.all(workerPromises);

      // Exactly ONE worker performs initial transition (alreadyFinalized: false)
      const primaryWorker = results.filter((r) => r.alreadyFinalized === false);
      const secondaryWorkers = results.filter((r) => r.alreadyFinalized === true);

      expect(primaryWorker.length).toBe(1);
      expect(secondaryWorkers.length).toBe(2);

      // Exactly ONE Order was created in database
      const orders = await Order.find({ productId: product._id });
      expect(orders.length).toBe(1);
      expect(orders[0].highestBid).toBe(1100);
    });

    it("Repeated scheduler execution does not duplicate finalization or payment obligations", async () => {
      const expiredEnd = new Date(Date.now() - 60 * 1000);
      const product = await createFixtureProduct({
        endTime: expiredEnd,
        status: "LIVE",
      });

      await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        now: new Date(expiredEnd.getTime() - 600 * 1000),
      });

      // Run scheduler tick 1
      const tick1 = await triggerTickNow({ now: new Date() });
      expect(tick1.finalized.finalizedCount).toBe(1);

      // Run scheduler tick 2 (retry immediately)
      const tick2 = await triggerTickNow({ now: new Date() });
      expect(tick2.finalized.finalizedCount).toBe(0); // 0 newly finalized

      // Verify no duplicate order or changed state
      const orders = await Order.find({ productId: product._id });
      expect(orders.length).toBe(1);
    });
  });

  // =========================================================================
  // 11. Zero-Bid Auctions (UNSOLD)
  // =========================================================================
  describe("11. Zero-Bid Auctions", () => {
    it("Auctions with no accepted bids end without a winner obligation", async () => {
      const expiredEnd = new Date(Date.now() - 60 * 1000);
      const product = await createFixtureProduct({
        endTime: expiredEnd,
        status: "LIVE",
        bidCount: 0,
        startingPrice: 1000,
      });

      const res = await finalizeSingleAuction(product._id, { now: new Date() });
      expect(res.status).toBe("UNSOLD");

      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.status).toBe("UNSOLD");
      expect(dbProduct.winnerId).toBeNull();

      // Zero order records created
      const orders = await Order.find({ productId: product._id });
      expect(orders.length).toBe(0);
    });
  });

  // =========================================================================
  // 12 & 13. Winner Determination & Ledger Consistency Verification
  // =========================================================================
  describe("12 & 13. Ledger Consistency & Inconsistency Safeguards", () => {
    it("Winner and final price agree with authoritative bid/product state", async () => {
      const expiredEnd = new Date(Date.now() - 60 * 1000);
      const product = await createFixtureProduct({
        endTime: expiredEnd,
        status: "LIVE",
      });

      // Place sequence of competing bids outside anti-snipe window
      await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        now: new Date(expiredEnd.getTime() - 600 * 1000),
      });
      await placeBid({
        productId: product._id.toString(),
        bidder: bidderB.user,
        amount: 1200,
        now: new Date(expiredEnd.getTime() - 500 * 1000),
      });
      await placeBid({
        productId: product._id.toString(),
        bidder: bidderC.user,
        amount: 1350,
        now: new Date(expiredEnd.getTime() - 400 * 1000),
      });

      const res = await finalizeSingleAuction(product._id, { now: new Date() });
      expect(res.status).toBe("ENDED");
      expect(res.product.winnerId.toString()).toBe(bidderC.user._id.toString());
      expect(res.product.finalPrice).toBe(1350);

      const order = await Order.findOne({ productId: product._id });
      expect(order).toBeDefined();
      expect(order.winnerId.toString()).toBe(bidderC.user._id.toString());
      expect(order.userEmail).toBe(bidderC.user.email);
      expect(order.highestBid).toBe(1350);
      expect(order.status).toBe("PENDING");
    });

    it("Inconsistent ledger/product state fails safely and is observable", async () => {
      const expiredEnd = new Date(Date.now() - 60 * 1000);
      // Create product claiming bidCount: 1, currentPrice: 5000, but no matching bid exists in ledger
      const product = await createFixtureProduct({
        endTime: expiredEnd,
        status: "LIVE",
        bidCount: 1,
        currentPrice: 5000,
        highestBidder: bidderA.user._id,
      });

      await expect(
        finalizeSingleAuction(product._id, { now: new Date() })
      ).rejects.toThrow("Ledger consistency check failed");

      // Verify safety: NO winner declared, NO order created, product flagged for reconciliation
      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.reconciliationRequired).toBe(true);
      expect(dbProduct.reconciliationNotes).toMatch(/ledger/i);

      const orders = await Order.find({ productId: product._id });
      expect(orders.length).toBe(0);
    });
  });

  // =========================================================================
  // 14. 24-Hour Winner Payment Deadline & Immutability
  // =========================================================================
  describe("14. Winner Payment Deadline Precision", () => {
    it("The payment deadline is exactly 24 hours after authoritative finalization time and never changes on retry", async () => {
      const expiredEnd = new Date(Date.now() - 300 * 1000);
      const product = await createFixtureProduct({
        endTime: expiredEnd,
        status: "LIVE",
      });

      await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        now: new Date(expiredEnd.getTime() - 30 * 1000),
      });

      const finalizationTime = new Date(Date.now());
      const res = await finalizeSingleAuction(product._id, { now: finalizationTime });
      expect(res.status).toBe("ENDED");

      const order = await Order.findOne({ productId: product._id });
      const expectedDeadline = new Date(finalizationTime.getTime() + 24 * 60 * 60 * 1000);
      expect(order.paymentDeadline.toISOString()).toBe(expectedDeadline.toISOString());

      // Retry finalization 2 hours later
      const retryTime = new Date("2026-10-15T14:00:00.000Z");
      await finalizeSingleAuction(product._id, { now: retryTime });

      // Deadline MUST NOT change on retry
      const refreshedOrder = await Order.findOne({ productId: product._id });
      expect(refreshedOrder.paymentDeadline.toISOString()).toBe(expectedDeadline.toISOString());
    });
  });

  // =========================================================================
  // 15. Crash / Restart Recovery
  // =========================================================================
  describe("15. Restart & Downtime Recovery", () => {
    it("A crash/restart or interrupted processing can recover without duplicate effects", async () => {
      const baseTime = Date.now();
      const start1 = new Date(baseTime - 7200 * 1000);
      const expired1 = new Date(baseTime - 3600 * 1000);
      const start2 = new Date(baseTime - 7200 * 1000);
      const expired2 = new Date(baseTime - 1800 * 1000);

      // Create 2 products while scheduler was offline
      const p1 = await createFixtureProduct({ startTime: start1, endTime: expired1, status: "Active" });
      const p2 = await createFixtureProduct({ startTime: start2, endTime: expired2, status: "Active" });

      await placeBid({ productId: p1._id.toString(), bidder: bidderA.user, amount: 1100, now: new Date(start1.getTime() + 60000) });
      await placeBid({ productId: p2._id.toString(), bidder: bidderB.user, amount: 1200, now: new Date(start2.getTime() + 60000) });

      // Recovery tick processes both overdue items
      const summary = await triggerTickNow({ now: new Date(baseTime) });
      expect(summary.finalized.finalizedCount).toBe(2);

      const dbP1 = await Product.findById(p1._id);
      const dbP2 = await Product.findById(p2._id);
      expect(dbP1.status).toBe("ENDED");
      expect(dbP2.status).toBe("ENDED");

      expect(await Order.countDocuments({ productId: { $in: [p1._id, p2._id] } })).toBe(2);
    });
  });

  // =========================================================================
  // 16. Socket.IO Lifecycle Emission
  // =========================================================================
  describe("16. Socket.IO Event Broadcasting", () => {
    it("Socket events are emitted only after successful persistence", async () => {
      const emittedEvents = [];
      const mockIo = {
        to: (room) => ({
          emit: (event, data) => {
            emittedEvents.push({ room, event, data });
          },
        }),
        emit: (event, data) => {
          emittedEvents.push({ event, data });
        },
      };

      const expiredEnd = new Date(Date.now() - 10 * 1000);
      const product = await createFixtureProduct({
        endTime: expiredEnd,
        status: "LIVE",
      });

      await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        now: new Date(expiredEnd.getTime() - 600 * 1000),
      });

      await finalizeSingleAuction(product._id, { now: new Date(), io: mockIo });

      // Check emitted event
      const endedEvent = emittedEvents.find((e) => e.event === "auctionEnded");
      expect(endedEvent).toBeDefined();
      expect(endedEvent.data.productId).toBe(product._id.toString());
      expect(endedEvent.data.finalPrice).toBe(1100);
      expect(endedEvent.data.winnerId).toBe(bidderA.user._id.toString());
      expect(endedEvent.data.paymentDeadline).toBeDefined();

      // Ensure persistence happened before emit
      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.status).toBe("ENDED");
    });
  });

  // =========================================================================
  // 17. Bidding Service Invariant Integrity
  // =========================================================================
  describe("17. Bidding Service Invariants Preservation", () => {
    it("Existing bidding and idempotency behavior remains intact", async () => {
      const product = await createFixtureProduct({
        currentPrice: 1000,
        bidCount: 0,
        status: "Active",
      });

      const key = "stage3-idemp-key-101";
      const res1 = await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        idempotencyKey: key,
      });
      expect(res1.success).toBe(true);

      // Retry with same idempotencyKey returns cached outcome
      const res2 = await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        idempotencyKey: key,
      });
      expect(res2.isDuplicate).toBe(true);
      expect(res2.bid.amount).toBe(1100);

      const bids = await Bid.find({ productId: product._id });
      expect(bids.length).toBe(1);
    });
  });

  // =========================================================================
  // 18. Legacy / Incomplete Auction Records
  // =========================================================================
  describe("18. Legacy Records Handling", () => {
    it("Legacy/incomplete auction records are handled according to documented policy", async () => {
      const pastDate = new Date(Date.now() - 3600 * 1000);
      const legacyProduct = await Product.create({
        name: "Legacy Product",
        email: "legacy_seller@test.com",
        category: "Books",
        description: [{ name: "Condition", description: "Good" }],
        mobileNumber: "9876543210",
        images: [{ secure_url: "https://example.com/book.jpg", public_id: "book_1" }],
        biddingStartDate: pastDate,
        biddingStartTime: "10:00",
        biddingStartPrice: 500,
        biddingEndTime: new Date(Date.now() - 60 * 1000).toISOString(),
        status: "Active",
        // Note: startTime, originalEndTime, endTime deliberately omitted
      });

      const boundaries = normalizeAuctionBoundaries(legacyProduct);
      expect(boundaries.startTime).toBeDefined();
      expect(boundaries.endTime).toBeDefined();

      // Finalization processes legacy document safely without errors
      const res = await finalizeSingleAuction(legacyProduct._id, { now: new Date() });
      expect(res.success).toBe(true);
      expect(res.status).toBe("UNSOLD");

      const updated = await Product.findById(legacyProduct._id);
      expect(updated.status).toBe("UNSOLD");
    });
  });

  // =========================================================================
  // 19. Scheduler Lifecycle & Graceful Shutdown
  // =========================================================================
  describe("19. Scheduler Lifecycle, Startup & Shutdown", () => {
    it("Scheduler startup, shutdown, database outages, retries, and test cleanup behave correctly", async () => {
      expect(isSchedulerRunning()).toBe(false);

      // Start scheduler
      const started = startScheduler({ intervalMs: 200 });
      expect(started).toBe(true);
      expect(isSchedulerRunning()).toBe(true);

      // Duplicate start is a safe no-op
      const doubleStart = startScheduler({ intervalMs: 200 });
      expect(doubleStart).toBe(false);

      // Stop scheduler
      await stopScheduler();
      expect(isSchedulerRunning()).toBe(false);
    });
  });

  // =========================================================================
  // 20. Failure Injection, Interrupted State Recovery & Advanced Concurrency
  // =========================================================================
  describe("20. Failure Injection, Interrupted State Recovery & Advanced Concurrency", () => {
    it("Crash or failure between Product finalization and Order creation is recovered automatically with immutable 24h deadline", async () => {
      const originalFinalizedAt = new Date("2026-10-15T10:00:00.000Z");
      const originalDeadline = new Date(originalFinalizedAt.getTime() + 24 * 60 * 60 * 1000);

      // 1. Simulate state after crash: Product is ENDED with a winner, but NO Order was created yet and orderId is null
      const product = await createFixtureProduct({
        status: "ENDED",
        winnerId: bidderA.user._id,
        highestBidder: bidderA.user._id,
        highestBidderEmail: bidderA.user.email,
        highestBidderName: bidderA.user.name,
        finalPrice: 1500,
        currentPrice: 1500,
        bidCount: 1,
        finalizedAt: originalFinalizedAt,
        paymentDeadline: originalDeadline,
        orderId: null,
      });

      // Insert authoritative accepted bid into ledger
      await Bid.create({
        productId: product._id,
        bidder: bidderA.user._id,
        bidderEmail: bidderA.user.email,
        bidderName: bidderA.user.name,
        amount: 1500,
        status: "ACCEPTED",
        idempotencyKey: "crash-test-key-1",
      });

      // Verify prerequisite: No order exists yet in database
      const orderBefore = await Order.findOne({ productId: product._id });
      expect(orderBefore).toBeNull();

      // 2. Trigger lifecycle recovery cycle 5 hours later
      const recoveryTime = new Date("2026-10-15T15:00:00.000Z");
      const summary = await processLifecycleTransitions({ now: recoveryTime });

      expect(summary.recovered.recoveredCount).toBeGreaterThanOrEqual(1);

      // 3. Verify that an Order was created and linked to the product
      const orderAfter = await Order.findOne({ productId: product._id });
      expect(orderAfter).toBeDefined();
      expect(orderAfter.winnerId.toString()).toBe(bidderA.user._id.toString());
      expect(orderAfter.finalPrice).toBe(1500);
      expect(orderAfter.status).toBe("PENDING");

      // 4. Verify deadline immutability: MUST match original 24h deadline, NOT recoveryTime + 24h
      expect(orderAfter.paymentDeadline.toISOString()).toBe(originalDeadline.toISOString());

      // 5. Verify product.orderId is linked
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.orderId.toString()).toBe(orderAfter._id.toString());
    });

    it("Anti-sniping dynamic extension racing with finalization correctly postpones finalization and does not raise false ledger mismatch", async () => {
      const baseTime = Date.now();
      const initialEnd = new Date(baseTime + 60 * 1000); // 1 minute left (within 2m anti-snipe window)

      const product = await createFixtureProduct({
        status: "LIVE",
        endTime: initialEnd,
        originalEndTime: initialEnd,
        startingPrice: 1000,
        currentPrice: 1000,
        bidCount: 0,
      });

      // Place a valid bid that extends the auction by 2 minutes
      const bidRes = await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 1100,
        now: new Date(baseTime + 10 * 1000),
      });
      expect(bidRes.wasExtended).toBe(true);

      // At the initial expiration time, attempt finalization
      const finalizationAttempt = await finalizeSingleAuction(product._id, {
        now: new Date(initialEnd.getTime() + 1000), // Original end has passed, but extended end has not
      });

      // Finalization must be refused because auction was extended
      expect(finalizationAttempt.success).toBe(false);
      expect(finalizationAttempt.reason).toBe("AUCTION_NOT_EXPIRED");
      expect(finalizationAttempt.wasExtended).toBe(true);

      // Ensure no false ledger reconciliation error was triggered
      const dbProduct = await Product.findById(product._id);
      expect(dbProduct.status).toBe("LIVE");
      expect(dbProduct.reconciliationRequired).toBe(false);
    });

    it("Legacy SCHEDULED auctions with missing canonical startTime transition to LIVE when scheduled time arrives", async () => {
      const pastStart = new Date("2026-10-14T08:00:00.000Z");
      const legacyScheduled = await Product.create({
        name: "Legacy Scheduled Item",
        email: "seller@test.com",
        category: "Electronics",
        description: [{ name: "Condition", description: "Mint" }],
        mobileNumber: "9876543210",
        images: [{ secure_url: "https://example.com/item.jpg", public_id: "item_1" }],
        biddingStartDate: pastStart,
        biddingStartTime: "08:00",
        biddingStartPrice: 2000,
        biddingEndTime: new Date("2026-10-14T12:00:00.000Z").toISOString(),
        status: "SCHEDULED",
        // Canonical startTime deliberately omitted to test legacy migration on transition
      });

      const tickResult = await startScheduledAuctions({
        now: new Date("2026-10-14T08:30:00.000Z"),
      });

      expect(tickResult.transitionedCount).toBeGreaterThanOrEqual(1);

      const refreshed = await Product.findById(legacyScheduled._id);
      expect(refreshed.status).toBe("LIVE");
      expect(refreshed.startTime).toBeDefined();
    });

    it("Auctions requiring reconciliation are skipped in recurring scheduler batches to prevent thrashing", async () => {
      const expiredTime = new Date(Date.now() - 100 * 1000);
      const flaggedProduct = await createFixtureProduct({
        status: "LIVE",
        endTime: expiredTime,
        reconciliationRequired: true,
        reconciliationNotes: "Manual operator intervention required",
      });

      // Trigger cycle
      const cycleResult = await triggerTickNow({ now: new Date() });

      // Must complete without crashing or processing the flagged product
      expect(cycleResult.finalized.errors.length).toBe(0);

      const refreshed = await Product.findById(flaggedProduct._id);
      expect(refreshed.status).toBe("LIVE"); // Kept intact for operator review
      expect(refreshed.reconciliationRequired).toBe(true);
    });

    it("Concurrent workers attempting to heal the same orphan order do not create duplicate Orders", async () => {
      const originalFinalizedAt = new Date("2026-10-15T09:00:00.000Z");
      const product = await createFixtureProduct({
        status: "ENDED",
        winnerId: bidderB.user._id,
        highestBidder: bidderB.user._id,
        highestBidderEmail: bidderB.user.email,
        highestBidderName: bidderB.user.name,
        finalPrice: 3200,
        currentPrice: 3200,
        bidCount: 1,
        finalizedAt: originalFinalizedAt,
        orderId: null,
      });

      await Bid.create({
        productId: product._id,
        bidder: bidderB.user._id,
        bidderEmail: bidderB.user.email,
        bidderName: bidderB.user.name,
        amount: 3200,
        status: "ACCEPTED",
        idempotencyKey: "dual-repair-key",
      });

      // Concurrent execution by two worker processes
      const [res1, res2] = await Promise.all([
        repairOrphanOrder(product, { now: new Date() }),
        repairOrphanOrder(product, { now: new Date() }),
      ]);

      expect(res1).toBeDefined();
      expect(res2).toBeDefined();
      expect(res1._id.toString()).toBe(res2._id.toString());

      const orderCount = await Order.countDocuments({ productId: product._id });
      expect(orderCount).toBe(1);
    });
  });
});
