const request = require("supertest");
const { app, server } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const {
  createTestUser,
  createTestSeller,
  createTestAdmin,
} = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const { createSocketClient } = require("../../helpers/socketHelper");
const {
  startScheduledAuctions,
  executeDueScheduledBids,
} = require("../../../src/modules/auctions/services/lifecycleService");

const Product = require("../../../src/modules/products/models/productSchema");
const ScheduledBid = require("../../../src/modules/bidding/models/scheduledBid");
const ReportAdmin = require("../../../src/modules/admin/moderation/models/reports");
const AdminAuditLog = require("../../../src/modules/admin/disputes/models/adminAuditLog");
const Bid = require("../../../src/modules/bidding/models/bidSchema");

const createTestProduct = async (overrides = {}) => {
  const product = new Product({
    name: overrides.name || "Test Chronograph Watch",
    description: overrides.description || [
      { name: "Condition", description: "Mint condition" },
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
    biddingStartDate: overrides.biddingStartDate || new Date(),
    biddingStartTime: overrides.biddingStartTime || "10:00",
    biddingStartPrice: overrides.biddingStartPrice || 1000,
    biddingEndTime: overrides.biddingEndTime || "18:00",
    startingPrice: overrides.startingPrice || 1000,
    currentPrice: overrides.currentPrice || 1000,
    bidCount: overrides.bidCount || 0,
    status: overrides.status || "Active",
    startTime: overrides.startTime || new Date(Date.now() - 3600000), // 1 hour ago
    endTime: overrides.endTime || new Date(Date.now() + 3600000), // 1 hour in future
    ...overrides,
  });
  return await product.save();
};

const createTestReport = async (overrides = {}) => {
  const report = new ReportAdmin({
    userName: overrides.userName || "Whistle Blower",
    userEmail: overrides.userEmail || "whistleblower@example.com",
    reportType: overrides.reportType || "illegal",
    report: overrides.report || "Counterfeit replica item details",
    reason: overrides.reason || "Counterfeit Goods",
    customReason: overrides.customReason || "Listing contains unverified replica",
    productId: overrides.productId || null,
    status: overrides.status || "pending",
    date: overrides.date || new Date(),
    ...overrides,
  });
  return await report.save();
};

describe("Admin Stage 3.1 — Listing Moderation Coverage & Safety Audit", () => {
  let testServer;
  let activeClients = [];

  beforeAll((done) => {
    testServer = server.listen(0, () => {
      done();
    });
  });

  afterAll((done) => {
    activeClients.forEach((client) => {
      if (client.connected) client.disconnect();
    });
    testServer.close(done);
  });

  beforeEach(async () => {
    await clearDatabase();
    activeClients.forEach((client) => {
      if (client.connected) client.disconnect();
    });
    activeClients = [];
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function getConnectedClient(token = null) {
    const client = createSocketClient(testServer, token);
    activeClients.push(client);
    return new Promise((resolve, reject) => {
      client.on("connect", () => resolve(client));
      client.on("connect_error", (err) => reject(err));
    });
  }

  // --------------------------------------------------------------------------
  // 1. PUBLIC DISCOVERY & ACCESS PATHS
  // --------------------------------------------------------------------------
  describe("1. Listing Discovery & Public Access Guards", () => {
    it("public requests must NOT bypass filtering with ?includeModerated=true", async () => {
      const activeProduct = await createTestProduct({ name: "Clean Public Watch" });
      const removedProduct = await createTestProduct({
        name: "Removed Suspicious Watch",
        isModerated: true,
        moderationStatus: "REMOVED",
      });
      const suspendedProduct = await createTestProduct({
        name: "Suspended Watch",
        isModerated: true,
        moderationStatus: "SUSPENDED",
      });

      // Anonymous caller tries includeModerated=true
      const res = await request(app).get("/api/products?includeModerated=true");
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const returnedIds = res.body.products.map((p) => p._id.toString());
      expect(returnedIds).toContain(activeProduct._id.toString());
      expect(returnedIds).not.toContain(removedProduct._id.toString());
      expect(returnedIds).not.toContain(suspendedProduct._id.toString());
    });

    it("authenticated admin requests WITH ?includeModerated=true may view moderated listings", async () => {
      const activeProduct = await createTestProduct({ name: "Clean Public Watch" });
      const removedProduct = await createTestProduct({
        name: "Removed Suspicious Watch",
        isModerated: true,
        moderationStatus: "REMOVED",
      });
      const { admin, token: adminToken } = await createTestAdmin({ role: "admin" });

      const res = await request(app)
        .get("/api/products?includeModerated=true")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const returnedIds = res.body.products.map((p) => p._id.toString());
      expect(returnedIds).toContain(activeProduct._id.toString());
      expect(returnedIds).toContain(removedProduct._id.toString());
    });

    it("public view of seller profile (getProductsByEmail) excludes moderated listings", async () => {
      const sellerEmail = "merchant@example.com";
      const cleanProd = await createTestProduct({ email: sellerEmail, name: "Merchant Clean Item" });
      const modProd = await createTestProduct({
        email: sellerEmail,
        name: "Merchant Moderated Item",
        isModerated: true,
        moderationStatus: "REMOVED",
      });

      // Anonymous buyer viewing seller's items
      const res = await request(app).get(`/api/products/email/${sellerEmail}`);
      expect(res.statusCode).toBe(200);
      const returnedIds = res.body.products.map((p) => p._id.toString());
      expect(returnedIds).toContain(cleanProd._id.toString());
      expect(returnedIds).not.toContain(modProd._id.toString());
    });

    it("authenticated seller viewing their OWN profile (getProductsByEmail) sees moderated listings", async () => {
      const sellerEmail = "merchant@example.com";
      const { seller, token } = await createTestSeller({ email: sellerEmail });
      const cleanProd = await createTestProduct({ email: sellerEmail, name: "Merchant Clean Item" });
      const modProd = await createTestProduct({
        email: sellerEmail,
        name: "Merchant Moderated Item",
        isModerated: true,
        moderationStatus: "REMOVED",
        moderationReason: "Under copyright review",
      });

      // Owner seller viewing their own items
      const res = await request(app)
        .get(`/api/products/email/${sellerEmail}`)
        .set("Cookie", [`sellerToken=${token}`]);

      expect(res.statusCode).toBe(200);
      const returnedIds = res.body.products.map((p) => p._id.toString());
      expect(returnedIds).toContain(cleanProd._id.toString());
      expect(returnedIds).toContain(modProd._id.toString());
    });

    it("getProductById returns 404 to public users for moderated listings, 200 for admins", async () => {
      const modProd = await createTestProduct({
        isModerated: true,
        moderationStatus: "REMOVED",
      });

      // Public user
      const pubRes = await request(app).get(`/api/products/${modProd._id}`);
      expect(pubRes.statusCode).toBe(404);
      expect(pubRes.body.success).toBe(false);

      // Admin user
      const { admin, token: adminToken } = await createTestAdmin({ role: "admin" });
      const adminRes = await request(app)
        .get(`/api/products/${modProd._id}`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(adminRes.statusCode).toBe(200);
      expect(adminRes.body.success).toBe(true);
      expect(adminRes.body.product._id.toString()).toBe(modProd._id.toString());
    });
  });

  // --------------------------------------------------------------------------
  // 2. SELLER MUTATION & STATUS PATCHING
  // --------------------------------------------------------------------------
  describe("2. Seller Listing Mutation & Moderation Tampering Prevention", () => {
    it("seller cannot edit a listing that has been moderated or suspended", async () => {
      const sellerEmail = "seller1@example.com";
      const { seller, token } = await createTestSeller({ email: sellerEmail });
      const csrf = createCsrfCredentials();

      const modProd = await createTestProduct({
        email: sellerEmail,
        isModerated: true,
        moderationStatus: "SUSPENDED",
      });

      const res = await request(app)
        .put(`/api/products/${modProd._id}`)
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          name: "Attempted Title Update",
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe("LISTING_MODERATED");
    });

    it("seller cannot inject moderation fields into PUT /api/products/:id", async () => {
      const sellerEmail = "seller2@example.com";
      const { seller, token } = await createTestSeller({ email: sellerEmail });
      const csrf = createCsrfCredentials();

      const cleanProd = await createTestProduct({
        email: sellerEmail,
        isModerated: false,
        moderationStatus: "ACTIVE",
      });

      const res = await request(app)
        .put(`/api/products/${cleanProd._id}`)
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          name: "Updated Legal Title",
          isModerated: true,
          moderationStatus: "REMOVED",
          moderationReason: "Hacked reason",
        });

      expect(res.statusCode).toBe(200);
      const refreshed = await Product.findById(cleanProd._id);
      expect(refreshed.name).toBe("Updated Legal Title");
      expect(refreshed.isModerated).toBe(false);
      expect(refreshed.moderationStatus).toBe("ACTIVE");
      expect(refreshed.moderationReason).not.toBe("Hacked reason");
    });

    it("seller cannot activate a moderated listing via statuspatch", async () => {
      const sellerEmail = "seller3@example.com";
      const { seller, token } = await createTestSeller({ email: sellerEmail });
      const csrf = createCsrfCredentials();

      const modProd = await createTestProduct({
        email: sellerEmail,
        status: "Closed",
        isModerated: true,
        moderationStatus: "REMOVED",
      });

      const res = await request(app)
        .patch(`/api/products/statuspatch/${modProd._id}`)
        .set("Cookie", [csrf.cookie, `sellerToken=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "Active" });

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe("LISTING_MODERATED");

      const refreshed = await Product.findById(modProd._id);
      expect(refreshed.status).toBe("Closed");
    });
  });

  // --------------------------------------------------------------------------
  // 3. SCHEDULED BIDS & LIFECYCLE GUARDS
  // --------------------------------------------------------------------------
  describe("3. Scheduled Bids & Lifecycle Moderation Guards", () => {
    it("creating a scheduled bid on a moderated listing returns 403 LISTING_MODERATED", async () => {
      const { user, token } = await createTestUser({ email: "bidder@example.com" });
      const csrf = createCsrfCredentials();

      const modProd = await createTestProduct({
        isModerated: true,
        moderationStatus: "REMOVED",
      });

      const res = await request(app)
        .post("/api/scheduled-bids")
        .set("Cookie", [csrf.cookie, `token=${token}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          productId: modProd._id.toString(),
          amount: 2000,
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe("LISTING_MODERATED");
    });

    it("executeDueScheduledBids lifecycle fails bids with LISTING_MODERATED if listing was moderated after scheduling", async () => {
      const { user } = await createTestUser({ email: "bidder2@example.com" });
      const product = await createTestProduct({
        isModerated: true,
        moderationStatus: "REMOVED",
      });

      const sched = await ScheduledBid.create({
        userId: user._id,
        userEmail: user.email,
        userName: user.name,
        productId: product._id,
        amount: 3000,
        targetTime: new Date(Date.now() - 10000), // Due in the past
        status: "PENDING",
      });

      const result = await executeDueScheduledBids({ now: new Date() });
      expect(result.failedCount).toBe(1);

      const refreshed = await ScheduledBid.findById(sched._id);
      expect(refreshed.status).toBe("FAILED");
      expect(refreshed.failureReason).toMatch(/LISTING_MODERATED/);
    });

    it("startScheduledAuctions lifecycle worker skips moderated scheduled auctions", async () => {
      const scheduledModProduct = await createTestProduct({
        status: "SCHEDULED",
        startTime: new Date(Date.now() - 60000), // Should have started 1 min ago
        isModerated: true,
        moderationStatus: "REMOVED",
      });

      const scheduledCleanProduct = await createTestProduct({
        status: "SCHEDULED",
        startTime: new Date(Date.now() - 60000),
        isModerated: false,
        moderationStatus: "ACTIVE",
      });

      const result = await startScheduledAuctions({ now: new Date() });
      expect(result.transitionedCount).toBe(1);
      expect(result.productIds).toContain(scheduledCleanProduct._id.toString());
      expect(result.productIds).not.toContain(scheduledModProduct._id.toString());

      const refreshedMod = await Product.findById(scheduledModProduct._id);
      expect(refreshedMod.status).toBe("SCHEDULED"); // Did not transition to LIVE
    });
  });

  // --------------------------------------------------------------------------
  // 4. WEBSOCKET ISOLATION FOR MODERATED LISTINGS
  // --------------------------------------------------------------------------
  describe("4. WebSocket Real-Time Isolation", () => {
    it("non-admin client joining room of a moderated listing receives error LISTING_MODERATED", async () => {
      const { user, token } = await createTestUser({ email: "socketuser@example.com" });
      const modProd = await createTestProduct({
        isModerated: true,
        moderationStatus: "REMOVED",
      });

      const client = await getConnectedClient(token);

      const errorPromise = new Promise((resolve) => {
        client.on("error", (data) => resolve(data));
      });

      client.emit("joinProductRoom", modProd._id.toString());

      const errorData = await errorPromise;
      expect(errorData.code).toBe("LISTING_MODERATED");
    });
  });

  // --------------------------------------------------------------------------
  // 5. AUDIT RECOVERY & DOUBLE-FAULT RESILIENCE
  // --------------------------------------------------------------------------
  describe("5. Audit Recovery & Standalone MongoDB Double-Fault Handling", () => {
    it("marks auditLog as RECONCILIATION_REQUIRED when audit finalization fails AND compensating rollback fails", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "admin" });
      const product = await createTestProduct();

      // Mock Product.prototype.save so that initial save works, but second save (rollback) fails!
      let saveCallCount = 0;
      const originalSave = Product.prototype.save;
      jest.spyOn(Product.prototype, "save").mockImplementation(function () {
        saveCallCount++;
        if (saveCallCount === 1) {
          // Initial moderation update
          return originalSave.apply(this);
        }
        // Rollback save failure!
        return Promise.reject(new Error("Simulated Disk Full during Rollback"));
      });

      // Mock AdminAuditLog.prototype.save so that Phase 1 (intent) succeeds, but Phase 3 (finalization) fails!
      let auditSaveCallCount = 0;
      const originalAuditSave = AdminAuditLog.prototype.save;
      jest.spyOn(AdminAuditLog.prototype, "save").mockImplementation(function () {
        auditSaveCallCount++;
        if (auditSaveCallCount === 1) {
          // Intent creation
          return originalAuditSave.apply(this);
        }
        if (auditSaveCallCount === 2) {
          // Finalization failure
          return Promise.reject(new Error("Simulated Network Partition during Audit Finalization"));
        }
        // Reconciliation record update
        return originalAuditSave.apply(this);
      });

      const res = await request(app)
        .patch(`/api/admin/listings/${product._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          action: "REMOVE",
          reason: "Suspected fake item listing",
        });

      expect(res.statusCode).toBe(500);

      // Verify the audit intent log was preserved and marked RECONCILIATION_REQUIRED
      const auditLog = await AdminAuditLog.findOne({
        targetAccountId: product._id.toString(),
        targetAccountType: "listing",
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog.outcome).toBe("RECONCILIATION_REQUIRED");
      expect(auditLog.failureReason).toMatch(/FATAL/i);
      expect(auditLog.metadata?.reconciliationNeeded).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 6. REPORT RESOLUTION SEMANTICS & LEGACY ROUTE HARDENING
  // --------------------------------------------------------------------------
  describe("6. Report Resolution Semantics & Validation", () => {
    it("rejects redundant report status transition with 400", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "admin" });
      const report = await createTestReport({ status: "resolved", resolutionNote: "Initial note" });

      const res = await request(app)
        .patch(`/api/admin/listings/reports/${report._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "resolved",
          resolutionNote: "Redundant attempt note",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/already in status 'resolved'/i);
    });

    it("legacy report update PUT /api/admin/reports/:id rejects editor role with 403", async () => {
      const csrf = createCsrfCredentials();
      const { admin: editor, token: editorToken } = await createTestAdmin({ role: "editor" });
      const report = await createTestReport({ status: "pending" });

      const res = await request(app)
        .put(`/api/admin/reports/${report._id}`)
        .set("Cookie", [csrf.cookie, `adminToken=${editorToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "resolved", resolutionNote: "Valid resolution note" });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/editor role is read-only/i);
    });

    it("legacy report update requires resolutionNote >= 5 chars for resolved status", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "admin" });
      const report = await createTestReport({ status: "pending" });

      const res = await request(app)
        .put(`/api/admin/reports/${report._id}`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ status: "resolved", resolutionNote: "no" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/resolution note/i);
    });

    it("legacy report update logs an audit record upon successful resolution", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "admin" });
      const report = await createTestReport({ status: "pending" });

      const res = await request(app)
        .put(`/api/admin/reports/${report._id}`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "resolved",
          resolutionNote: "Resolved after comprehensive review",
        });

      expect(res.statusCode).toBe(200);

      const auditLog = await AdminAuditLog.findOne({
        targetAccountId: report._id.toString(),
        targetAccountType: "report",
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog.outcome).toBe("SUCCESS");
      expect(auditLog.afterStatus).toBe("resolved");
    });
  });

  // --------------------------------------------------------------------------
  // 7. FINANCIAL & AUCTION INVARIANTS
  // --------------------------------------------------------------------------
  describe("7. Auction Financial & Lifecycle Invariants", () => {
    it("moderation and restoration strictly preserve bid amounts, currentPrice, and highestBidder", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "admin" });
      const { user: bidder } = await createTestUser({ email: "bidder_top@example.com" });

      const product = await createTestProduct({
        biddingStartPrice: 1000,
        currentPrice: 2500,
        bidCount: 5,
        highestBidder: bidder._id,
        highestBidderEmail: bidder.email,
        highestBidderName: bidder.name,
      });

      // Moderate listing (REMOVE)
      const removeRes = await request(app)
        .patch(`/api/admin/listings/${product._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ action: "REMOVE", reason: "Investigating potential rule breach" });

      expect(removeRes.statusCode).toBe(200);

      const postRemove = await Product.findById(product._id);
      expect(postRemove.currentPrice).toBe(2500);
      expect(postRemove.bidCount).toBe(5);
      expect(postRemove.highestBidderEmail).toBe("bidder_top@example.com");

      // Restore listing (RESTORE)
      const restoreRes = await request(app)
        .patch(`/api/admin/listings/${product._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ action: "RESTORE", reason: "Cleared upon verification" });

      expect(restoreRes.statusCode).toBe(200);

      const postRestore = await Product.findById(product._id);
      expect(postRestore.currentPrice).toBe(2500);
      expect(postRestore.bidCount).toBe(5);
      expect(postRestore.highestBidderEmail).toBe("bidder_top@example.com");
      expect(postRestore.isModerated).toBe(false);
      expect(postRestore.moderationStatus).toBe("ACTIVE");
    });

    it("restoration of an auction whose deadline has already elapsed is rejected with 400", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "admin" });

      const expiredProduct = await createTestProduct({
        isModerated: true,
        moderationStatus: "REMOVED",
        endTime: new Date(Date.now() - 3600000), // Concluded 1 hour ago
      });

      const res = await request(app)
        .patch(`/api/admin/listings/${expiredProduct._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          action: "RESTORE",
          reason: "Attempting to restore expired auction",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/scheduled end time has already elapsed/i);
    });
  });
});
