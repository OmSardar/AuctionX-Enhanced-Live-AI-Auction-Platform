const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const {
  createTestUser,
  createTestSeller,
  createTestAdmin,
} = require("../../helpers/authHelper");

const Product = require("../../../src/modules/products/models/productSchema");
const Bid = require("../../../src/modules/bidding/models/bidSchema");
const Order = require("../../../src/modules/orders/models/orderSchema");
const ScheduledBid = require("../../../src/modules/bidding/models/scheduledBid");
const AdminAuditLog = require("../../../src/modules/admin/disputes/models/adminAuditLog");

// Helper to create a test product
const createTestProduct = async (overrides = {}) => {
  const now = new Date();
  const product = new Product({
    name: overrides.name || "Vintage Chronograph Watch",
    description: overrides.description || [
      { name: "Condition", description: "Mint condition collector watch" },
    ],
    email: overrides.email || "seller@example.com",
    category: overrides.category || "Watches",
    images: overrides.images || [
      {
        secure_url: "https://example.com/watch.jpg",
        public_id: "watch_01",
      },
    ],
    mobileNumber: overrides.mobileNumber || "9876543210",
    biddingStartDate: overrides.biddingStartDate || new Date(now.getTime() - 3600000),
    biddingStartTime: overrides.biddingStartTime || "10:00",
    biddingStartPrice: overrides.biddingStartPrice || 1000,
    biddingEndTime: overrides.biddingEndTime || "18:00",
    startingPrice: overrides.startingPrice || 1000,
    currentPrice: overrides.currentPrice || 1000,
    bidCount: overrides.bidCount || 0,
    status: overrides.status || "Active",
    startTime: overrides.startTime || new Date(now.getTime() - 3600000), // 1h ago
    endTime: overrides.endTime || new Date(now.getTime() + 3600000), // 1h in future
    originalEndTime: overrides.originalEndTime || new Date(now.getTime() + 3600000),
    antiSnipeCount: overrides.antiSnipeCount || 0,
    ...overrides,
  });
  return await product.save();
};

describe("Admin Stage 4 — Auction Operations & Lifecycle Visibility Integration Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Authentication & Role-Based Access Controls
  // --------------------------------------------------------------------------
  describe("1. Authentication & Authorization Enforcement", () => {
    it("should reject unauthenticated requests to auction operations with 401", async () => {
      const res = await request(app).get("/api/admin/auctions");
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject ordinary users from accessing auction operations with 403", async () => {
      const { user, token } = await createTestUser({ role: "user" });
      const res = await request(app)
        .get("/api/admin/auctions")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should reject sellers from accessing auction operations with 403", async () => {
      const { seller, token } = await createTestSeller();
      const res = await request(app)
        .get("/api/admin/auctions")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should allow verified administrators to access auction directory with 200", async () => {
      const { admin, token: adminToken } = await createTestAdmin({ role: "admin" });
      await createTestProduct({ name: "Role Test Watch" });

      const res = await request(app)
        .get("/api/admin/auctions")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.auctions)).toBe(true);
      expect(res.body.auctions.length).toBe(1);
    });

    it("should allow editor role (read-only) to access auction operations with 200", async () => {
      const { admin: editor, token: editorToken } = await createTestAdmin({ role: "editor" });
      await createTestProduct({ name: "Editor Visible Watch" });

      const res = await request(app)
        .get("/api/admin/auctions")
        .set("Cookie", [`adminToken=${editorToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Pagination, Search, Filters & Sorting
  // --------------------------------------------------------------------------
  describe("2. Directory Pagination, Multi-Filter, Search & Sorting", () => {
    it("should paginate correctly with bounded limits", async () => {
      const { admin, token } = await createTestAdmin({ role: "admin" });
      for (let i = 1; i <= 15; i++) {
        await createTestProduct({ name: `Batch Auction ${i}` });
      }

      const res = await request(app)
        .get("/api/admin/auctions?page=1&limit=5")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.auctions.length).toBe(5);
      expect(res.body.pagination.total).toBe(15);
      expect(res.body.pagination.totalPages).toBe(3);
      expect(res.body.pagination.hasMore).toBe(true);
    });

    it("should filter auctions by lifecycleStatus (SCHEDULED vs LIVE vs ENDED)", async () => {
      const { admin, token } = await createTestAdmin({ role: "admin" });
      const now = new Date();

      const liveProd = await createTestProduct({
        name: "Live Auction Item",
        status: "LIVE",
        startTime: new Date(now.getTime() - 1800000),
        endTime: new Date(now.getTime() + 1800000),
      });

      const schedProd = await createTestProduct({
        name: "Scheduled Future Auction",
        status: "SCHEDULED",
        startTime: new Date(now.getTime() + 3600000),
        endTime: new Date(now.getTime() + 7200000),
      });

      const endedProd = await createTestProduct({
        name: "Ended Concluded Auction",
        status: "ENDED",
        startTime: new Date(now.getTime() - 7200000),
        endTime: new Date(now.getTime() - 3600000),
      });

      // Filter: SCHEDULED
      const schedRes = await request(app)
        .get("/api/admin/auctions?lifecycleStatus=SCHEDULED")
        .set("Cookie", [`adminToken=${token}`]);

      expect(schedRes.statusCode).toBe(200);
      const schedIds = schedRes.body.auctions.map((a) => a.id);
      expect(schedIds).toContain(schedProd._id.toString());
      expect(schedIds).not.toContain(liveProd._id.toString());
      expect(schedIds).not.toContain(endedProd._id.toString());

      // Filter: LIVE
      const liveRes = await request(app)
        .get("/api/admin/auctions?lifecycleStatus=LIVE")
        .set("Cookie", [`adminToken=${token}`]);

      expect(liveRes.statusCode).toBe(200);
      const liveIds = liveRes.body.auctions.map((a) => a.id);
      expect(liveIds).toContain(liveProd._id.toString());
      expect(liveIds).not.toContain(schedProd._id.toString());
    });

    it("should filter by reconciliationOnly=true", async () => {
      const { admin, token } = await createTestAdmin({ role: "admin" });
      const cleanProd = await createTestProduct({ name: "Clean Auction", reconciliationRequired: false });
      const flaggedProd = await createTestProduct({
        name: "Reconciliation Needed Auction",
        reconciliationRequired: true,
        reconciliationNotes: "Ledger discrepancy recovery alert",
      });

      const res = await request(app)
        .get("/api/admin/auctions?reconciliationOnly=true")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      const ids = res.body.auctions.map((a) => a.id);
      expect(ids).toContain(flaggedProd._id.toString());
      expect(ids).not.toContain(cleanProd._id.toString());
    });

    it("should search across title, category, seller email, and exact ObjectId", async () => {
      const { admin, token } = await createTestAdmin({ role: "admin" });
      const target = await createTestProduct({
        name: "Rare Diamond Necklace",
        email: "jeweler@example.com",
        category: "Jewelry",
      });
      await createTestProduct({ name: "Antique Oak Chair", email: "carpenter@example.com", category: "Furniture" });

      // Search by keyword
      const keywordRes = await request(app)
        .get("/api/admin/auctions?search=diamond")
        .set("Cookie", [`adminToken=${token}`]);

      expect(keywordRes.statusCode).toBe(200);
      expect(keywordRes.body.auctions.length).toBe(1);
      expect(keywordRes.body.auctions[0].id).toBe(target._id.toString());

      // Search by exact ObjectId
      const idRes = await request(app)
        .get(`/api/admin/auctions?search=${target._id.toString()}`)
        .set("Cookie", [`adminToken=${token}`]);

      expect(idRes.statusCode).toBe(200);
      expect(idRes.body.auctions.length).toBe(1);
      expect(idRes.body.auctions[0].id).toBe(target._id.toString());
    });

    it("should safely sort by currentPrice ascending and descending", async () => {
      const { admin, token } = await createTestAdmin({ role: "admin" });
      await createTestProduct({ name: "Low Price Item", currentPrice: 500 });
      await createTestProduct({ name: "High Price Item", currentPrice: 50000 });

      // Descending
      const descRes = await request(app)
        .get("/api/admin/auctions?sortBy=currentPrice&sortOrder=desc")
        .set("Cookie", [`adminToken=${token}`]);

      expect(descRes.statusCode).toBe(200);
      expect(descRes.body.auctions[0].currentPrice).toBe(50000);
      expect(descRes.body.auctions[1].currentPrice).toBe(500);

      // Ascending
      const ascRes = await request(app)
        .get("/api/admin/auctions?sortBy=currentPrice&sortOrder=asc")
        .set("Cookie", [`adminToken=${token}`]);

      expect(ascRes.statusCode).toBe(200);
      expect(ascRes.body.auctions[0].currentPrice).toBe(500);
      expect(ascRes.body.auctions[1].currentPrice).toBe(50000);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Sensitive Information Masking for Restricted Roles
  // --------------------------------------------------------------------------
  describe("3. Role-Based Information Protection", () => {
    it("masks sensitive email and IP address when accessed by editor role", async () => {
      const { admin: editor, token: editorToken } = await createTestAdmin({ role: "editor" });
      const { user: bidder } = await createTestUser({ email: "secretbidder@example.com" });

      const product = await createTestProduct({
        email: "secretseller@example.com",
        currentPrice: 15000,
        highestBidderEmail: bidder.email,
        highestBidderName: "Secret Bidder",
      });

      await Bid.create({
        productId: product._id,
        bidder: bidder._id,
        bidderEmail: bidder.email,
        bidderName: "Secret Bidder",
        amount: 15000,
        ipAddress: "192.168.1.100",
        status: "ACCEPTED",
      });

      // Inspection details as editor
      const detailRes = await request(app)
        .get(`/api/admin/auctions/${product._id}`)
        .set("Cookie", [`adminToken=${editorToken}`]);

      expect(detailRes.statusCode).toBe(200);
      expect(detailRes.body.auction.sellerEmail).toMatch(/se\*\*\*@example\.com/);
      expect(detailRes.body.auction.highestBidderEmail).toMatch(/se\*\*\*@example\.com/);
      expect(detailRes.body.auction.mobileNumber).toBe("**********");

      // Bids list as editor
      const bidsRes = await request(app)
        .get(`/api/admin/auctions/${product._id}/bids`)
        .set("Cookie", [`adminToken=${editorToken}`]);

      expect(bidsRes.statusCode).toBe(200);
      expect(bidsRes.body.bids[0].bidderEmail).toMatch(/se\*\*\*@example\.com/);
      expect(bidsRes.body.bids[0].ipAddress).toBe("xxx.xxx.xxx.xxx");
    });

    it("displays unmasked operational information to full admin role", async () => {
      const { admin, token: adminToken } = await createTestAdmin({ role: "admin" });
      const { user: bidder } = await createTestUser({ email: "auditbidder@example.com" });

      const product = await createTestProduct({
        email: "auditseller@example.com",
        currentPrice: 8000,
        highestBidderEmail: bidder.email,
        highestBidderName: "Audit Bidder",
      });

      await Bid.create({
        productId: product._id,
        bidder: bidder._id,
        bidderEmail: bidder.email,
        bidderName: "Audit Bidder",
        amount: 8000,
        ipAddress: "10.0.0.45",
        status: "ACCEPTED",
      });

      const bidsRes = await request(app)
        .get(`/api/admin/auctions/${product._id}/bids`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(bidsRes.statusCode).toBe(200);
      expect(bidsRes.body.bids[0].bidderEmail).toBe("auditbidder@example.com");
      expect(bidsRes.body.bids[0].ipAddress).toBe("10.0.0.45");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Auction Detail Accuracy & Historical Bid Ordering
  // --------------------------------------------------------------------------
  describe("4. Auction Detail Accuracy & Bid Ledger Ordering", () => {
    it("returns chronological descending bid history", async () => {
      const { admin, token } = await createTestAdmin({ role: "admin" });
      const { user } = await createTestUser({ email: "chronobidder@example.com" });
      const product = await createTestProduct();

      const t1 = new Date(Date.now() - 30000);
      const t2 = new Date(Date.now() - 20000);
      const t3 = new Date(Date.now() - 10000);

      await Bid.create({
        productId: product._id,
        bidder: user._id,
        bidderEmail: user.email,
        bidderName: user.name,
        amount: 1100,
        createdAt: t1,
        status: "OUTBID",
      });

      await Bid.create({
        productId: product._id,
        bidder: user._id,
        bidderEmail: user.email,
        bidderName: user.name,
        amount: 1200,
        createdAt: t2,
        status: "OUTBID",
      });

      await Bid.create({
        productId: product._id,
        bidder: user._id,
        bidderEmail: user.email,
        bidderName: user.name,
        amount: 1300,
        createdAt: t3,
        status: "WINNING",
      });

      const res = await request(app)
        .get(`/api/admin/auctions/${product._id}/bids`)
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.bids.length).toBe(3);
      // Latest bid first
      expect(res.body.bids[0].amount).toBe(1300);
      expect(res.body.bids[1].amount).toBe(1200);
      expect(res.body.bids[2].amount).toBe(1100);
    });

    it("correctly includes linked order status and payment deadline summary", async () => {
      const { admin, token } = await createTestAdmin({ role: "admin" });
      const { user: winner } = await createTestUser({ email: "winner@example.com" });

      const deadline = new Date(Date.now() + 86400000); // 24h
      const product = await createTestProduct({
        status: "AWAITING_PAYMENT",
        finalPrice: 7500,
        highestBidderEmail: winner.email,
        paymentDeadline: deadline,
      });

      const order = await Order.create({
        title: product.name,
        name: winner.name,
        userEmail: winner.email,
        sellerEmail: product.email,
        category: product.category,
        biddingStartPrice: product.biddingStartPrice,
        highestBid: 7500,
        finalPrice: 7500,
        phoneNo: "9876543210",
        address: "123 Victory Lane",
        productId: product._id,
        winnerId: winner._id,
        status: "PENDING",
        paymentDeadline: deadline,
        paymentAttempts: 1,
      });

      product.orderId = order._id;
      await product.save();

      const res = await request(app)
        .get(`/api/admin/auctions/${product._id}`)
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.auction.order).not.toBeNull();
      expect(res.body.auction.order.orderId).toBe(order._id.toString());
      expect(res.body.auction.order.status).toBe("PENDING");
      expect(res.body.auction.order.finalPrice).toBe(7500);
      expect(res.body.auction.order.paymentAttempts).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Read-Only Safety & Invariant Preservation
  // --------------------------------------------------------------------------
  describe("5. Strict Read-Only Invariants (Zero Mutation on Inspection)", () => {
    it("inspecting directory, detail, and bids does NOT mutate auction, winner, or order state", async () => {
      const { admin, token } = await createTestAdmin({ role: "admin" });
      const { user: bidder } = await createTestUser({ email: "preserved@example.com" });

      const initialEndTime = new Date(Date.now() + 3600000);
      const product = await createTestProduct({
        name: "Invariant Preservation Watch",
        startingPrice: 1000,
        currentPrice: 4200,
        bidCount: 3,
        highestBidder: bidder._id,
        highestBidderEmail: bidder.email,
        highestBidderName: bidder.name,
        endTime: initialEndTime,
        antiSnipeCount: 1,
        status: "LIVE",
      });

      const bid = await Bid.create({
        productId: product._id,
        bidder: bidder._id,
        bidderEmail: bidder.email,
        bidderName: bidder.name,
        amount: 4200,
        status: "WINNING",
      });

      // 1. Read directory
      await request(app)
        .get("/api/admin/auctions")
        .set("Cookie", [`adminToken=${token}`]);

      // 2. Read single auction
      await request(app)
        .get(`/api/admin/auctions/${product._id}`)
        .set("Cookie", [`adminToken=${token}`]);

      // 3. Read bids
      await request(app)
        .get(`/api/admin/auctions/${product._id}/bids`)
        .set("Cookie", [`adminToken=${token}`]);

      // 4. Assert product completely unchanged in DB
      const postProduct = await Product.findById(product._id);
      expect(postProduct.currentPrice).toBe(4200);
      expect(postProduct.bidCount).toBe(3);
      expect(postProduct.highestBidderEmail).toBe("preserved@example.com");
      expect(postProduct.status).toBe("LIVE");
      expect(postProduct.antiSnipeCount).toBe(1);
      expect(postProduct.endTime.getTime()).toBe(initialEndTime.getTime());

      // Assert bid unchanged
      const postBid = await Bid.findById(bid._id);
      expect(postBid.amount).toBe(4200);
      expect(postBid.status).toBe("WINNING");

      // Assert no orders were inadvertently generated
      const orderCount = await Order.countDocuments({ productId: product._id });
      expect(orderCount).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Graceful Handling of Missing / Orphaned Records
  // --------------------------------------------------------------------------
  describe("6. Orphaned & Missing Record Graceful Degradation", () => {
    it("returns 404 cleanly for non-existent auction ID", async () => {
      const { admin, token } = await createTestAdmin({ role: "admin" });
      const nonExistentId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/admin/auctions/${nonExistentId}`)
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it("returns 400 for malformed auction ID", async () => {
      const { admin, token } = await createTestAdmin({ role: "admin" });

      const res = await request(app)
        .get("/api/admin/auctions/not-a-valid-id")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/invalid.*format/i);
    });

    it("handles zero bids cleanly with empty array", async () => {
      const { admin, token } = await createTestAdmin({ role: "admin" });
      const product = await createTestProduct({ bidCount: 0 });

      const res = await request(app)
        .get(`/api/admin/auctions/${product._id}/bids`)
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.bids).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Lifecycle Telemetry & Reconciliation Alert Visibility
  // --------------------------------------------------------------------------
  describe("7. Operational Telemetry & Alert Visibility", () => {
    it("reports real-time queue counts and reconciliation alerts", async () => {
      const { admin, token } = await createTestAdmin({ role: "admin" });
      const now = new Date();

      // Create scheduled auction due for launch
      await createTestProduct({
        status: "SCHEDULED",
        startTime: new Date(now.getTime() - 10000),
      });

      // Create live auction
      await createTestProduct({
        status: "LIVE",
        endTime: new Date(now.getTime() + 3600000),
      });

      // Create double-fault audit log marked RECONCILIATION_REQUIRED
      await AdminAuditLog.create({
        actingAdminId: admin._id.toString(),
        actingAdminEmail: admin.email,
        actingAdminModel: "Admin",
        actingAdminRole: "admin",
        targetAccountId: "prod_sample_1",
        targetAccountEmail: "seller@example.com",
        targetAccountType: "listing",
        action: "MODERATE_LISTING",
        reason: "Test audit failure",
        beforeStatus: "ACTIVE",
        afterStatus: "REMOVED",
        outcome: "RECONCILIATION_REQUIRED",
        failureReason: "FATAL: Simulated double-fault exception",
      });

      const res = await request(app)
        .get("/api/admin/auctions/lifecycle/telemetry")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scheduler).toBeDefined();
      expect(res.body.queues.awaitingLaunchCount).toBeGreaterThanOrEqual(1);
      expect(res.body.queues.activeLiveCount).toBeGreaterThanOrEqual(1);
      expect(res.body.queues.reconciliationRequiredAuditCount).toBe(1);
      expect(res.body.reconciliationAlerts.auditLogs.length).toBe(1);
      expect(res.body.reconciliationAlerts.auditLogs[0].failureReason).toMatch(/FATAL/);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Scheduled Bids Investigation Directory
  // --------------------------------------------------------------------------
  describe("8. Scheduled Bids Investigation Directory", () => {
    it("retrieves paginated scheduled bids with failure reasons and product details", async () => {
      const { admin, token } = await createTestAdmin({ role: "admin" });
      const { user } = await createTestUser({ email: "schedinvestigate@example.com" });
      const product = await createTestProduct({ name: "Target Scheduled Product" });

      await ScheduledBid.create({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        productId: product._id,
        amount: 5500,
        targetTime: new Date(),
        status: "FAILED",
        failureReason: "LISTING_MODERATED: Auction product has been removed by moderation",
      });

      const res = await request(app)
        .get("/api/admin/auctions/scheduled-bids?status=FAILED")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scheduledBids.length).toBe(1);
      expect(res.body.scheduledBids[0].amount).toBe(5500);
      expect(res.body.scheduledBids[0].status).toBe("FAILED");
      expect(res.body.scheduledBids[0].failureReason).toMatch(/LISTING_MODERATED/);
      expect(res.body.scheduledBids[0].product.name).toBe("Target Scheduled Product");
    });
  });
});
