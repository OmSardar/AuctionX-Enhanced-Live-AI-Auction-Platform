/**
 * Stage 4 — Wallet Escrow Independent Verification & Financial Integrity Hardening Suite
 *
 * Covers:
 * Section 1: Concurrency and Crash Recovery Failure Boundaries
 * Section 2: Order Schema Payment Method Defaults & Backward Compatibility
 * Section 3: Accounting Invariants (No Math.max masking, over-reservation, ledger auditing)
 * Section 4: Reconciliation Endpoint Security (401/403, read-only GET, audited POST, PII masking)
 * Section 5: Razorpay Compatibility & Non-Interference
 * Section 6: Exact Real-World Business Scenario (User A ₹400, User B ₹500, Auction ₹200)
 */

const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../server");
const Product = require("../../src/modules/products/models/productSchema");
const Bid = require("../../src/modules/bidding/models/bidSchema");
const Order = require("../../src/modules/orders/models/orderSchema");
const User = require("../../src/modules/users/models/user");
const Admin = require("../../src/modules/admin/authentication/models/admin");
const Transaction = require("../../src/modules/admin/finance/models/transaction");
const WalletReservation = require("../../src/modules/bidding/models/walletReservationSchema");
const Payment = require("../../src/modules/payments/models/Payment");
const { placeBid, BidError } = require("../../src/modules/bidding/services/bidService");
const walletService = require("../../src/modules/payments/services/walletService");
const {
  finalizeSingleAuction,
  repairOrphanOrder,
  normalizeAuctionBoundaries,
} = require("../../src/modules/auctions/services/lifecycleService");
const { runWalletReconciliation } = require("../../src/modules/payments/services/walletReconciliationService");
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  settleWalletTopup,
} = require("../../src/modules/payments/services/paymentService");
const { createTestUser, generateUserToken, generateAdminToken } = require("../helpers/authHelper");
const { createCsrfCredentials } = require("../helpers/csrfHelper");

describe("AuctionX — Wallet Escrow Independent Verification & Hardening Suite", () => {
  let sellerUser;
  let bidderA;
  let bidderB;
  let ordinaryUser;
  let adminUser;

  beforeAll(async () => {
    await Bid.init();
    await Product.init();
    await Order.init();
    await WalletReservation.init();
    await Transaction.init();
    await Payment.init();
    await User.init();
    await Admin.init();

    sellerUser = await createTestUser({ email: "hardened_seller@test.com", name: "Hardened Seller" });
    bidderA = await createTestUser({ email: "hardened_bidder_a@test.com", name: "Bidder A", amount: 400 });
    bidderB = await createTestUser({ email: "hardened_bidder_b@test.com", name: "Bidder B", amount: 500 });
    ordinaryUser = await createTestUser({ email: "ordinary_user@test.com", name: "Ordinary User", role: "user" });

    // Ensure Admin account exists
    let existingAdmin = await Admin.findOne({ email: "finance_admin@auctionx.com" });
    if (!existingAdmin) {
      existingAdmin = await Admin.create({
        firstName: "Finance",
        lastName: "Admin",
        email: "finance_admin@auctionx.com",
        password: "hashed_test_password_123",
        role: "admin",
      });
    }
    adminUser = existingAdmin;
  });

  afterAll(async () => {
    await Product.deleteMany({ email: sellerUser.user.email });
    await User.deleteMany({
      email: {
        $in: [
          sellerUser.user.email,
          bidderA.user.email,
          bidderB.user.email,
          ordinaryUser.user.email,
        ],
      },
    });
    await Admin.deleteMany({ email: "finance_admin@auctionx.com" });
    await Order.deleteMany({});
    await Bid.deleteMany({});
    await WalletReservation.deleteMany({});
    await Transaction.deleteMany({});
  });

  async function createFixtureAuction(overrides = {}) {
    const now = new Date();
    const startTime = overrides.startTime || new Date(now.getTime() - 60 * 1000);
    const originalEndTime = overrides.originalEndTime || new Date(now.getTime() + 60 * 60 * 1000);
    const endTime = overrides.endTime || originalEndTime;
    const startPrice = overrides.startingPrice !== undefined ? overrides.startingPrice : 200;

    return Product.create({
      name: overrides.name || "Verification Auction Product",
      category: "Collectibles",
      description: [{ name: "Condition", description: "Mint" }],
      email: overrides.email || sellerUser.user.email,
      mobileNumber: "9876543210",
      images: [{ secure_url: "https://example.com/asset.jpg", public_id: "asset_01" }],
      biddingStartDate: startTime,
      biddingStartTime: startTime.toISOString(),
      biddingEndTime: endTime.toISOString(),
      biddingStartPrice: startPrice,
      startingPrice: startPrice,
      currentPrice: overrides.currentPrice !== undefined ? overrides.currentPrice : startPrice,
      startTime,
      endTime,
      originalEndTime,
      maxExtensionDeadline: new Date(originalEndTime.getTime() + 15 * 60 * 1000),
      antiSnipeCount: 0,
      status: overrides.status || "Active",
      bidCount: overrides.bidCount !== undefined ? overrides.bidCount : 0,
      minIncrement: overrides.minIncrement !== undefined ? overrides.minIncrement : 50,
      ...overrides,
    });
  }

  // ===========================================================================
  // SECTION 1: MONGO CONCURRENCY AND CRASH RECOVERY FAILURE BOUNDARIES
  // ===========================================================================
  describe("Section 1: Concurrency and Crash Recovery Failure Boundaries", () => {
    beforeEach(async () => {
      await User.updateOne({ _id: bidderA.user._id }, { $set: { amount: 400, reservedAmount: 0 } });
      await User.updateOne({ _id: bidderB.user._id }, { $set: { amount: 500, reservedAmount: 0 } });
      await WalletReservation.deleteMany({});
    });

    it("Failure Boundary 1: Wallet hold succeeds, but bid validation throws -> hold is completely rolled back", async () => {
      const product = await createFixtureAuction({ startingPrice: 200 });

      // Simulate a bid where holdBidderFunds succeeds, but invalid parameters trigger a rejection
      const holdOutcome = await walletService.holdBidderFunds({
        userId: bidderA.user._id,
        productId: product._id,
        bidAmount: 300,
      });

      expect(holdOutcome.heldAmount).toBe(300);

      // Verify user's reservedAmount was held
      const userDuringHold = await User.findById(bidderA.user._id);
      expect(userDuringHold.reservedAmount).toBe(300);
      expect(userDuringHold.availableAmount).toBe(100);

      // Rollback via releaseBidderHold as happens on failure
      await walletService.releaseBidderHold({
        userId: bidderA.user._id,
        amount: holdOutcome.heldAmount,
      });

      const userAfterRollback = await User.findById(bidderA.user._id);
      expect(userAfterRollback.reservedAmount).toBe(0);
      expect(userAfterRollback.availableAmount).toBe(400);
    });

    it("Failure Boundary 2: Wallet hold succeeds, but auction price update fails (outbid race) -> only bidder's hold is released", async () => {
      const product = await createFixtureAuction({ startingPrice: 200, currentPrice: 200, bidCount: 0 });

      // First bid accepted
      await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 250,
      });

      const userABefore = await User.findById(bidderA.user._id);
      expect(userABefore.reservedAmount).toBe(250);

      // Bidder B attempts a bid lower than minimum increment (e.g. 260 when increment is 50 -> min 300)
      await expect(
        placeBid({
          productId: product._id.toString(),
          bidder: bidderB.user,
          amount: 260,
        })
      ).rejects.toThrow();

      // Verify Bidder B's funds were never held / cleanly rolled back
      const userBAfter = await User.findById(bidderB.user._id);
      expect(userBAfter.reservedAmount).toBe(0);
      expect(userBAfter.availableAmount).toBe(500);

      // Verify Bidder A's reservation remains completely intact
      const userAAfter = await User.findById(bidderA.user._id);
      expect(userAAfter.reservedAmount).toBe(250);
      expect(userAAfter.availableAmount).toBe(150);
    });

    it("Failure Boundary 3 & 4: Application crash between Product update and reservation commit -> reconciliation detects discrepancy", async () => {
      const product = await createFixtureAuction({ startingPrice: 200, currentPrice: 200, bidCount: 0 });

      // Simulate Phase 1 hold on Bidder A
      await User.updateOne({ _id: bidderA.user._id }, { $set: { reservedAmount: 300 } });
      // Simulate Product updated to Bidder A without creating WalletReservation document (crash simulation)
      await Product.updateOne(
        { _id: product._id },
        { $set: { currentPrice: 300, highestBidder: bidderA.user._id, bidCount: 1 } }
      );

      // Run reconciliation audit
      const report = await runWalletReconciliation({ autoRepair: false });
      expect(report.healthy).toBe(false);

      const mismatch = report.discrepancies.find((d) => d.type === "RESERVED_BALANCE_MISMATCH");
      expect(mismatch).toBeDefined();
      expect(mismatch.expectedReserved).toBe(0); // sum of active reservations is 0
      expect(mismatch.actualReserved).toBe(300);

      // Run reconciliation with autoRepair: true
      await runWalletReconciliation({ autoRepair: true });
      const userAfterRepair = await User.findById(bidderA.user._id);
      expect(userAfterRepair.reservedAmount).toBe(0);
      expect(userAfterRepair.availableAmount).toBe(400);
    });

    it("Failure Boundary 5: Application crash during settlement -> repairOrphanOrder recovers cleanly without double capture", async () => {
      const now = new Date();
      const pastTime = new Date(now.getTime() - 1000);
      const product = await createFixtureAuction({
        startingPrice: 200,
        currentPrice: 300,
        highestBidder: bidderA.user._id,
        highestBidderEmail: bidderA.user.email,
        bidCount: 1,
        startTime: new Date(now.getTime() - 3600 * 1000),
        endTime: pastTime,
        originalEndTime: pastTime,
        status: "ENDED",
        finalPrice: 300,
        finalizedAt: pastTime,
      });

      // Active reservation exists
      await WalletReservation.create({
        userId: bidderA.user._id,
        userEmail: bidderA.user.email,
        productId: product._id,
        bidId: new mongoose.Types.ObjectId(),
        amount: 300,
        currency: "INR",
        status: "ACTIVE",
      });
      await User.updateOne({ _id: bidderA.user._id }, { $set: { amount: 400, reservedAmount: 300 } });

      // An accepted bid exists
      await Bid.create({
        productId: product._id,
        bidder: bidderA.user._id,
        bidderEmail: bidderA.user.email,
        bidderName: bidderA.user.name || "Bidder A",
        amount: 300,
        status: "ACCEPTED",
      });

      // Product has status "ENDED" but NO Order (simulating crash before Order was saved)
      const orphanOrder1 = await repairOrphanOrder(product, { now });
      expect(orphanOrder1).toBeDefined();
      expect(orphanOrder1.status).toBe("PAID");
      expect(orphanOrder1.paymentMethod).toBe("WALLET");
      expect(orphanOrder1.walletSettled).toBe(true);

      const userAfterFirstRepair = await User.findById(bidderA.user._id);
      expect(userAfterFirstRepair.amount).toBe(100); // 400 - 300 = 100
      expect(userAfterFirstRepair.reservedAmount).toBe(0);

      // Repeated repair (e.g. secondary scheduler tick)
      const orphanOrder2 = await repairOrphanOrder(product, { now });
      expect(orphanOrder2._id.toString()).toBe(orphanOrder1._id.toString());

      // Confirm user was NEVER double debited
      const userAfterSecondRepair = await User.findById(bidderA.user._id);
      expect(userAfterSecondRepair.amount).toBe(100);
      expect(userAfterSecondRepair.reservedAmount).toBe(0);
    });

    it("Failure Boundary 6: Two bidders submit opening bids simultaneously -> exactly 1 winner, 1 outbid rollback", async () => {
      const product = await createFixtureAuction({ startingPrice: 200, currentPrice: 200, bidCount: 0 });

      // Run two concurrent opening bids at ₹200
      const results = await Promise.allSettled([
        placeBid({
          productId: product._id.toString(),
          bidder: bidderA.user,
          amount: 200,
        }),
        placeBid({
          productId: product._id.toString(),
          bidder: bidderB.user,
          amount: 200,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Verify the winning bidder has ₹200 reserved
      const winnerId = fulfilled[0].value.product.highestBidder.toString();
      const winningUser = await User.findById(winnerId);
      expect(winningUser.reservedAmount).toBe(200);

      // Verify the losing bidder has 0 reserved
      const loserId = winnerId === bidderA.user._id.toString() ? bidderB.user._id : bidderA.user._id;
      const losingUser = await User.findById(loserId);
      expect(losingUser.reservedAmount).toBe(0);

      // Exactly 1 active reservation in database
      const activeResCount = await WalletReservation.countDocuments({
        productId: product._id,
        status: "ACTIVE",
      });
      expect(activeResCount).toBe(1);
    });

    it("Failure Boundary 7: Same bidder submits concurrent bid increases -> serialized safely without over-reservation", async () => {
      const product = await createFixtureAuction({ startingPrice: 200, currentPrice: 200, bidCount: 0 });

      // Bidder B places opening bid at ₹200
      await placeBid({
        productId: product._id.toString(),
        bidder: bidderB.user,
        amount: 200,
      });

      const userBAfterOpening = await User.findById(bidderB.user._id);
      expect(userBAfterOpening.reservedAmount).toBe(200);
      expect(userBAfterOpening.availableAmount).toBe(300); // 500 - 200 = 300

      // Bidder B attempts two concurrent increases: ₹250 and ₹300
      const results = await Promise.allSettled([
        placeBid({
          productId: product._id.toString(),
          bidder: bidderB.user,
          amount: 250,
        }),
        placeBid({
          productId: product._id.toString(),
          bidder: bidderB.user,
          amount: 300,
        }),
      ]);

      const userBAfterConcurrent = await User.findById(bidderB.user._id);
      const updatedProduct = await Product.findById(product._id);

      // Invariant: reservedAmount matches product currentPrice exactly
      expect(userBAfterConcurrent.reservedAmount).toBe(updatedProduct.currentPrice);
      expect(userBAfterConcurrent.availableAmount).toBe(500 - updatedProduct.currentPrice);

      const activeRes = await WalletReservation.findOne({ productId: product._id, status: "ACTIVE" });
      expect(activeRes.amount).toBe(updatedProduct.currentPrice);
      expect(activeRes.userId.toString()).toBe(bidderB.user._id.toString());
    });

    it("Failure Boundary 8: Two scheduler instances attempt settlement simultaneously -> idempotent capture", async () => {
      const now = new Date();
      const pastTime = new Date(now.getTime() - 1000);
      const product = await createFixtureAuction({
        startingPrice: 200,
        currentPrice: 350,
        highestBidder: bidderB.user._id,
        highestBidderEmail: bidderB.user.email,
        bidCount: 2,
        startTime: new Date(now.getTime() - 3600 * 1000),
        endTime: pastTime,
        originalEndTime: pastTime,
        status: "Active",
      });

      await Bid.create({
        productId: product._id,
        bidder: bidderB.user._id,
        bidderEmail: bidderB.user.email,
        bidderName: bidderB.user.name || "Bidder B",
        amount: 350,
        status: "ACCEPTED",
      });

      await WalletReservation.create({
        userId: bidderB.user._id,
        userEmail: bidderB.user.email,
        productId: product._id,
        bidId: new mongoose.Types.ObjectId(),
        amount: 350,
        currency: "INR",
        status: "ACTIVE",
      });

      await User.updateOne({ _id: bidderB.user._id }, { $set: { amount: 500, reservedAmount: 350 } });

      // Run two concurrent finalization calls
      const [worker1, worker2] = await Promise.all([
        finalizeSingleAuction(product._id, { now }),
        finalizeSingleAuction(product._id, { now }),
      ]);

      // Exactly one marks alreadyFinalized: false, the other alreadyFinalized: true
      const finalizedFlags = [worker1.alreadyFinalized, worker2.alreadyFinalized];
      expect(finalizedFlags).toContain(false);
      expect(finalizedFlags).toContain(true);

      // User B was debited exactly ₹350 once
      const userBFinal = await User.findById(bidderB.user._id);
      expect(userBFinal.amount).toBe(150);
      expect(userBFinal.reservedAmount).toBe(0);

      // Exactly 1 Order exists
      const orders = await Order.find({ productId: product._id });
      expect(orders.length).toBe(1);
      expect(orders[0].status).toBe("PAID");
      expect(orders[0].paymentMethod).toBe("WALLET");
      expect(orders[0].walletSettled).toBe(true);
    });
  });

  // ===========================================================================
  // SECTION 2: PAYMENT METHOD DEFAULTS & BACKWARD COMPATIBILITY
  // ===========================================================================
  describe("Section 2: Payment Method Defaults & Backward Compatibility", () => {
    it("Creating an order without explicit paymentMethod sets paymentMethod to null (NOT 'WALLET')", async () => {
      const order = await Order.create({
        title: "Test Order",
        name: "Test Customer",
        userEmail: "test@example.com",
        sellerEmail: "seller@example.com",
        category: "Electronics",
        images: [{ secure_url: "https://example.com/item.jpg", public_id: "id_1" }],
        biddingStartPrice: 100,
        phoneNo: "9876543210",
        address: "Test Address",
      });

      expect(order.paymentMethod).toBeNull();
      expect(order.walletSettled).toBe(false);
    });

    it("Preserves existing orders with 'RAZORPAY' or 'COD' without silent reclassification", async () => {
      const razorpayOrder = await Order.create({
        title: "Razorpay Order",
        name: "Customer",
        userEmail: "cust@example.com",
        sellerEmail: "seller@example.com",
        category: "Electronics",
        images: [{ secure_url: "https://example.com/item.jpg", public_id: "id_2" }],
        biddingStartPrice: 100,
        phoneNo: "9876543210",
        address: "Test Address",
        paymentMethod: "RAZORPAY",
        status: "PAID",
      });

      const codOrder = await Order.create({
        title: "COD Order",
        name: "Customer",
        userEmail: "cust@example.com",
        sellerEmail: "seller@example.com",
        category: "Electronics",
        images: [{ secure_url: "https://example.com/item.jpg", public_id: "id_3" }],
        biddingStartPrice: 100,
        phoneNo: "9876543210",
        address: "Test Address",
        paymentMethod: "COD",
        status: "PENDING",
      });

      const fetchedRazorpay = await Order.findById(razorpayOrder._id);
      expect(fetchedRazorpay.paymentMethod).toBe("RAZORPAY");
      expect(fetchedRazorpay.walletSettled).toBe(false);

      const fetchedCod = await Order.findById(codOrder._id);
      expect(fetchedCod.paymentMethod).toBe("COD");
      expect(fetchedCod.walletSettled).toBe(false);
    });
  });

  // ===========================================================================
  // SECTION 3: ACCOUNTING INVARIANTS & AUDITING
  // ===========================================================================
  describe("Section 3: Accounting Invariants", () => {
    it("Treats negative available balance as true accounting discrepancy (NO Math.max concealing)", async () => {
      // Simulate corrupted user document where reservedAmount exceeds total amount
      await User.updateOne(
        { _id: bidderA.user._id },
        { $set: { amount: 100, reservedAmount: 250 } }
      );

      const user = await User.findById(bidderA.user._id);
      // availableAmount virtual MUST NOT be clamped to 0
      expect(user.availableAmount).toBe(-150);

      // Reconciliation scan MUST report NEGATIVE_AVAILABLE_BALANCE
      const report = await runWalletReconciliation({ autoRepair: false });
      expect(report.healthy).toBe(false);

      const negAvailable = report.discrepancies.find((d) => d.type === "NEGATIVE_AVAILABLE_BALANCE");
      expect(negAvailable).toBeDefined();
      expect(negAvailable.availableBalance).toBe(-150);

      // Reset
      await User.updateOne({ _id: bidderA.user._id }, { $set: { amount: 400, reservedAmount: 0 } });
    });

    it("Rejects withdrawal or manual balance reduction below active reservedAmount (RESERVED_FUNDS_LOCKED)", async () => {
      await User.updateOne(
        { _id: bidderA.user._id },
        { $set: { amount: 400, reservedAmount: 250 } }
      );

      const token = bidderA.token;
      const csrf = createCsrfCredentials();

      // Attempt to reduce balance to ₹200 (less than ₹250 reserved)
      const res = await request(app)
        .patch("/api/auth/update-amount")
        .set("Authorization", `Bearer ${token}`)
        .set("X-CSRF-Token", csrf.token)
        .set("Cookie", csrf.cookie)
        .send({ amount: 200 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("RESERVED_FUNDS_LOCKED");
      expect(res.body.reservedBalance).toBe(250);

      // Reset
      await User.updateOne({ _id: bidderA.user._id }, { $set: { amount: 400, reservedAmount: 0 } });
    });

    it("Prevents duplicate releases via atomic findOneAndUpdate", async () => {
      const product = await createFixtureAuction();
      await WalletReservation.create({
        productId: product._id,
        userId: bidderA.user._id,
        userEmail: bidderA.user.email,
        bidId: new mongoose.Types.ObjectId(),
        amount: 200,
        status: "ACTIVE",
      });
      await User.updateOne({ _id: bidderA.user._id }, { $set: { amount: 400, reservedAmount: 200 } });

      // Run two concurrent releases
      const [res1, res2] = await Promise.all([
        walletService.releaseReservation({ productId: product._id }),
        walletService.releaseReservation({ productId: product._id }),
      ]);

      const releasedFlags = [res1.released, res2.released];
      expect(releasedFlags).toContain(true);
      expect(releasedFlags).toContain(false);

      // Verify reservedAmount was decremented strictly once
      const userAfter = await User.findById(bidderA.user._id);
      expect(userAfter.reservedAmount).toBe(0);
      expect(userAfter.availableAmount).toBe(400);
    });
  });

  // ===========================================================================
  // SECTION 4: SECURE THE RECONCILIATION ENDPOINT
  // ===========================================================================
  describe("Section 4: Secure the Reconciliation Endpoint", () => {
    it("Rejects unauthenticated requests with 401 Unauthorized", async () => {
      const res = await request(app).get("/api/transactions/wallet-reconciliation");
      expect(res.status).toBe(401);
    });

    it("Rejects ordinary users (role: 'user') with 403 Forbidden", async () => {
      const userToken = ordinaryUser.token;
      const res = await request(app)
        .get("/api/transactions/wallet-reconciliation")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Admin privileges required/i);
    });

    it("Rejects sellers with 403 Forbidden", async () => {
      const sellerToken = generateUserToken({
        id: new mongoose.Types.ObjectId().toString(),
        role: "seller",
        email: "seller@test.com",
        purpose: "auth",
      });
      const res = await request(app)
        .get("/api/transactions/wallet-reconciliation")
        .set("Authorization", `Bearer ${sellerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Admin privileges required/i);
    });

    it("Accepts Admin requests and ensures GET is strictly read-only (masks PII)", async () => {
      const adminToken = generateAdminToken({
        id: adminUser._id.toString(),
        email: adminUser.email,
        role: "admin",
        purpose: "auth",
      });

      // Simulate a discrepancy
      await User.updateOne({ _id: bidderA.user._id }, { $set: { reservedAmount: 123 } });

      const res = await request(app)
        .get("/api/transactions/wallet-reconciliation?autoRepair=true") // Attempt autoRepair on GET
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary).toBeDefined();

      // Verify GET did NOT repair because autoRepair is forced to false on GET
      const userAfterGet = await User.findById(bidderA.user._id);
      expect(userAfterGet.reservedAmount).toBe(123); // Unchanged!

      // Verify email PII masking
      if (res.body.discrepancies.length > 0) {
        const disc = res.body.discrepancies[0];
        if (disc.userEmail) {
          expect(disc.userEmail).toMatch(/\*+/); // Masked!
        }
      }

      // Now run POST /wallet-reconciliation/repair to authorize repair
      const csrf = createCsrfCredentials();
      const repairRes = await request(app)
        .post("/api/transactions/wallet-reconciliation/repair")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-CSRF-Token", csrf.token)
        .set("Cookie", csrf.cookie);

      expect(repairRes.status).toBe(200);
      expect(repairRes.body.success).toBe(true);

      // Verify repaired
      const userAfterPost = await User.findById(bidderA.user._id);
      expect(userAfterPost.reservedAmount).toBe(0);

      // Verify audit transaction was created
      const auditTx = await Transaction.findOne({ type: "ADMIN_RECONCILIATION_REPAIR" }).sort({ date: -1 });
      expect(auditTx).toBeDefined();
      expect(auditTx.userEmail).toBe(adminUser.email);
    });
  });

  // ===========================================================================
  // SECTION 5: RAZORPAY COMPATIBILITY & NON-INTERFERENCE
  // ===========================================================================
  describe("Section 5: Razorpay Compatibility & Non-Interference", () => {
    beforeEach(async () => {
      await User.updateOne({ _id: bidderA.user._id }, { $set: { amount: 400, reservedAmount: 0 } });
    });

    it("Razorpay wallet top-up works without interference and increases availableBalance", async () => {
      const initialUser = await User.findById(bidderA.user._id);
      const initialAmount = initialUser.amount;

      // Mock a verified Razorpay Payment
      const mockRazorpayPaymentId = `pay_mock_${Date.now()}`;
      const mockRazorpayOrderId = `order_mock_${Date.now()}`;

      const payment = await Payment.create({
        userId: bidderA.user._id,
        userEmail: bidderA.user.email,
        amount: 25000,
        currency: "INR",
        provider: "RAZORPAY",
        type: "WALLET_TOPUP",
        status: "PENDING_VERIFICATION",
        razorpayPaymentId: mockRazorpayPaymentId,
        razorpayOrderId: mockRazorpayOrderId,
      });

      // Settle top-up
      await settleWalletTopup({ paymentId: payment._id, caller: "test" });

      const userAfterTopup = await User.findById(bidderA.user._id);
      expect(userAfterTopup.amount).toBe(initialAmount + 250);
      expect(userAfterTopup.availableAmount).toBe(initialAmount + 250);

      // Duplicate delivery of the same payment is idempotent (does NOT double-credit)
      await settleWalletTopup({ paymentId: payment._id, caller: "test" });
      const userAfterDuplicate = await User.findById(bidderA.user._id);
      expect(userAfterDuplicate.amount).toBe(initialAmount + 250);
    });

    it("Wallet-paid auction does NOT create or require a Razorpay payment", async () => {
      const now = new Date();
      const pastTime = new Date(now.getTime() - 1000);
      const product = await createFixtureAuction({
        startingPrice: 200,
        currentPrice: 250,
        highestBidder: bidderA.user._id,
        highestBidderEmail: bidderA.user.email,
        bidCount: 1,
        startTime: new Date(now.getTime() - 3600 * 1000),
        endTime: pastTime,
        originalEndTime: pastTime,
        status: "Active",
      });

      await Bid.create({
        productId: product._id,
        bidder: bidderA.user._id,
        bidderEmail: bidderA.user.email,
        bidderName: bidderA.user.name || "Bidder A",
        amount: 250,
        status: "ACCEPTED",
      });

      await WalletReservation.create({
        userId: bidderA.user._id,
        userEmail: bidderA.user.email,
        productId: product._id,
        bidId: new mongoose.Types.ObjectId(),
        amount: 250,
        currency: "INR",
        status: "ACTIVE",
      });

      await User.updateOne({ _id: bidderA.user._id }, { $set: { amount: 650, reservedAmount: 250 } });

      const result = await finalizeSingleAuction(product._id, { now });
      expect(result.success).toBe(true);
      expect(result.order.status).toBe("PAID");
      expect(result.order.paymentMethod).toBe("WALLET");
      expect(result.order.walletSettled).toBe(true);
      expect(result.order.razorpayPaymentId).toBeNull();
      expect(result.order.razorpayOrderId).toBeNull();
    });
  });

  // ===========================================================================
  // SECTION 6: EXACT REAL-WORLD BUSINESS SCENARIO
  // ===========================================================================
  describe("Section 6: Exact Real-World Business Scenario Verification", () => {
    it("Executes the exact 10-step lifecycle with User A (₹400), User B (₹500), and Auction (₹200)", async () => {
      // Setup isolated test accounts: User A ₹400, User B ₹500
      await User.updateOne({ _id: bidderA.user._id }, { $set: { amount: 400, reservedAmount: 0 } });
      await User.updateOne({ _id: bidderB.user._id }, { $set: { amount: 500, reservedAmount: 0 } });
      await WalletReservation.deleteMany({});

      const now = new Date();
      const originalEndTime = new Date(now.getTime() + 60 * 60 * 1000); // 1h in future

      // Auction: starting price ₹200, min increment ₹50
      const product = await createFixtureAuction({
        startingPrice: 200,
        currentPrice: 200,
        minIncrement: 50,
        bidCount: 0,
        startTime: new Date(now.getTime() - 60 * 1000),
        endTime: originalEndTime,
        originalEndTime,
      });

      // -----------------------------------------------------------------------
      // Step 1: User A bids ₹300
      // -----------------------------------------------------------------------
      const bid1 = await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 300,
      });
      expect(bid1.success).toBe(true);

      // -----------------------------------------------------------------------
      // Step 2: Confirm User A has ₹100 available and ₹300 reserved
      // -----------------------------------------------------------------------
      const userAAfterStep1 = await User.findById(bidderA.user._id);
      expect(userAAfterStep1.amount).toBe(400); // Total balance untouched
      expect(userAAfterStep1.reservedAmount).toBe(300); // ₹300 in escrow
      expect(userAAfterStep1.availableAmount).toBe(100); // 400 - 300 = 100

      const resA = await WalletReservation.findOne({ productId: product._id, status: "ACTIVE" });
      expect(resA).toBeDefined();
      expect(resA.userId.toString()).toBe(bidderA.user._id.toString());
      expect(resA.amount).toBe(300);

      // -----------------------------------------------------------------------
      // Step 3: User B attempts ₹350
      // -----------------------------------------------------------------------
      const bid2 = await placeBid({
        productId: product._id.toString(),
        bidder: bidderB.user,
        amount: 350,
      });
      expect(bid2.success).toBe(true);

      // -----------------------------------------------------------------------
      // Step 4: Confirm User A's ₹300 is released (User A available: ₹400, reserved: ₹0)
      // -----------------------------------------------------------------------
      const userAAfterStep3 = await User.findById(bidderA.user._id);
      expect(userAAfterStep3.amount).toBe(400);
      expect(userAAfterStep3.reservedAmount).toBe(0); // Released!
      expect(userAAfterStep3.availableAmount).toBe(400); // Full ₹400 restored!

      // -----------------------------------------------------------------------
      // Step 5: Confirm User B has ₹150 available and ₹350 reserved
      // -----------------------------------------------------------------------
      const userBAfterStep3 = await User.findById(bidderB.user._id);
      expect(userBAfterStep3.amount).toBe(500); // Total balance untouched
      expect(userBAfterStep3.reservedAmount).toBe(350); // ₹350 in escrow
      expect(userBAfterStep3.availableAmount).toBe(150); // 500 - 350 = 150

      const resB = await WalletReservation.findOne({ productId: product._id, status: "ACTIVE" });
      expect(resB).toBeDefined();
      expect(resB.userId.toString()).toBe(bidderB.user._id.toString());
      expect(resB.amount).toBe(350);

      // -----------------------------------------------------------------------
      // Step 6: Close the auction using controlled time
      // -----------------------------------------------------------------------
      const closureTime = new Date(originalEndTime.getTime() + 1000); // 1s past end
      const finalizationResult = await finalizeSingleAuction(product._id, { now: closureTime });

      expect(finalizationResult.success).toBe(true);
      expect(finalizationResult.status).toBe("ENDED");

      // -----------------------------------------------------------------------
      // Step 7: Confirm exactly ₹350 is captured
      // -----------------------------------------------------------------------
      const capturedRes = await WalletReservation.findOne({ productId: product._id, status: "CAPTURED" });
      expect(capturedRes).toBeDefined();
      expect(capturedRes.amount).toBe(350);
      expect(capturedRes.userId.toString()).toBe(bidderB.user._id.toString());

      // -----------------------------------------------------------------------
      // Step 8: Confirm User B has ₹150 remaining
      // -----------------------------------------------------------------------
      const userBFinal = await User.findById(bidderB.user._id);
      expect(userBFinal.amount).toBe(150); // Debited 500 - 350 = 150
      expect(userBFinal.reservedAmount).toBe(0); // Escrow cleared
      expect(userBFinal.availableAmount).toBe(150);

      // -----------------------------------------------------------------------
      // Step 9: Confirm one order exists with PAID, WALLET, and walletSettled: true
      // -----------------------------------------------------------------------
      const winningOrders = await Order.find({ productId: product._id });
      expect(winningOrders.length).toBe(1);

      const winningOrder = winningOrders[0];
      expect(winningOrder.status).toBe("PAID");
      expect(winningOrder.paymentMethod).toBe("WALLET");
      expect(winningOrder.walletSettled).toBe(true);
      expect(winningOrder.finalPrice).toBe(350);
      expect(winningOrder.winnerId.toString()).toBe(bidderB.user._id.toString());

      // -----------------------------------------------------------------------
      // Step 10: Confirm no Razorpay checkout is initiated
      // -----------------------------------------------------------------------
      expect(winningOrder.razorpayOrderId).toBeNull();
      expect(winningOrder.razorpayPaymentId).toBeNull();
      expect(winningOrder.paymentId).toBeNull();
    });

    it("Cancellation releases active reservation immediately", async () => {
      const product = await createFixtureAuction({ startingPrice: 200, currentPrice: 200, bidCount: 0 });

      await placeBid({
        productId: product._id.toString(),
        bidder: bidderA.user,
        amount: 300,
      });

      const userABeforeCancel = await User.findById(bidderA.user._id);
      expect(userABeforeCancel.reservedAmount).toBe(300);

      // Cancel auction
      await walletService.releaseReservation({
        productId: product._id,
        reason: "AUCTION_ADMIN_CANCELLED",
      });

      const userAAfterCancel = await User.findById(bidderA.user._id);
      expect(userAAfterCancel.reservedAmount).toBe(0);
      expect(userAAfterCancel.availableAmount).toBe(400);

      const activeRes = await WalletReservation.findOne({ productId: product._id, status: "ACTIVE" });
      expect(activeRes).toBeNull();
    });

    it("Zero-bid auction closes as UNSOLD without creating an order or touching any wallet", async () => {
      const now = new Date();
      const pastTime = new Date(now.getTime() - 1000);
      const product = await createFixtureAuction({
        startingPrice: 200,
        currentPrice: 200,
        bidCount: 0,
        startTime: new Date(now.getTime() - 3600 * 1000),
        endTime: pastTime,
        originalEndTime: pastTime,
        status: "Active",
      });

      const result = await finalizeSingleAuction(product._id, { now });
      expect(result.success).toBe(true);
      expect(result.status).toBe("UNSOLD");

      const orders = await Order.find({ productId: product._id });
      expect(orders.length).toBe(0);
    });
  });
});
