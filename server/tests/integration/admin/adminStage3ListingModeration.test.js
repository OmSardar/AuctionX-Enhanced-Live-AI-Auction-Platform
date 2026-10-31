const request = require("supertest");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const {
  createTestUser,
  createTestSeller,
  createTestAdmin,
} = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");
const { placeBid, BidError } = require("../../../src/modules/bidding/services/bidService");

const UserModel = require("../../../src/modules/users/models/user");
const SellerModel = require("../../../src/modules/sellers/accounts/models/seller");
const Admin = require("../../../src/modules/admin/authentication/models/admin");
const AdminAuditLog = require("../../../src/modules/admin/disputes/models/adminAuditLog");
const Product = require("../../../src/modules/products/models/productSchema");
const ReportAdmin = require("../../../src/modules/admin/moderation/models/reports");
const Bid = require("../../../src/modules/bidding/models/bidSchema");

// Helper to create a test product
const createTestProduct = async (overrides = {}) => {
  const product = new Product({
    name: overrides.name || "Vintage Mechanical Chronograph",
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

// Helper to create a test report
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

describe("Admin Stage 3 — Listing Moderation & Report Resolution Integration Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // 1 & 2. Authentication and Authorization Controls
  describe("1. Authentication & Role Permissions", () => {
    it("should reject unauthenticated requests to admin listings directory with 401", async () => {
      const res = await request(app).get("/api/admin/listings");
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should forbid ordinary users from accessing listing moderation endpoints with 403", async () => {
      const { user, token } = await createTestUser({ role: "user" });
      const product = await createTestProduct();

      const res = await request(app)
        .get("/api/admin/listings")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/admin privilege/i);
    });

    it("should forbid sellers from accessing listing moderation endpoints with 403", async () => {
      const { seller, token } = await createTestSeller();

      const res = await request(app)
        .get("/api/admin/listings")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should forbid an editor from performing moderation actions with 403", async () => {
      const csrf = createCsrfCredentials();
      const { admin: editor, token: editorToken } = await createTestAdmin({
        role: "editor",
      });
      const product = await createTestProduct();

      const res = await request(app)
        .patch(`/api/admin/listings/${product._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${editorToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          action: "REMOVE",
          reason: "Policy violation flagged by editor",
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/insufficient permissions|restricted to administrators/i);
    });
  });

  // 4. Listing search, filters, pagination
  describe("2. Directory Search, Filtering, and Pagination", () => {
    it("should return bounded, paginated listings with accurate summary counters", async () => {
      const { token: adminToken } = await createTestAdmin({ role: "super-admin" });

      // Create 3 products: 2 live/active, 1 moderated
      await createTestProduct({ name: "Rolex Submariner Watch", category: "Watches" });
      await createTestProduct({ name: "Omega Speedmaster Watch", category: "Watches" });
      await createTestProduct({
        name: "Fake Cartier Watch",
        category: "Watches",
        isModerated: true,
        moderationStatus: "REMOVED",
      });

      const res = await request(app)
        .get("/api/admin/listings?page=1&limit=2")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.listings).toHaveLength(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.totalPages).toBe(2);
      expect(res.body.summary.totalListings).toBe(3);
      expect(res.body.summary.moderatedCount).toBe(1);
    });

    it("should filter listings accurately by search query and category", async () => {
      const { token: adminToken } = await createTestAdmin({ role: "super-admin" });

      await createTestProduct({ name: "Rare Persian Carpet", category: "Antiques" });
      await createTestProduct({ name: "Gibson Les Paul Guitar", category: "Musical Instruments" });

      const res = await request(app)
        .get("/api/admin/listings?search=Persian&category=Antiques")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.listings).toHaveLength(1);
      expect(res.body.listings[0].name).toBe("Rare Persian Carpet");
    });

    it("should return single listing details, reports, and audit trail", async () => {
      const { token: adminToken } = await createTestAdmin({ role: "super-admin" });
      const product = await createTestProduct({ name: "Fine Diamond Necklace" });
      await createTestReport({
        productId: product._id,
        reason: "Misleading Specifications",
      });

      const res = await request(app)
        .get(`/api/admin/listings/${product._id}`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.listing.name).toBe("Fine Diamond Necklace");
      expect(res.body.reports).toHaveLength(1);
      expect(res.body.reports[0].reason).toBe("Misleading Specifications");
    });
  });

  // 5 & 6. Controlled Listing Moderation & Validation
  describe("3. Controlled Listing Moderation", () => {
    it("should require a valid moderation reason of at least 5 characters", async () => {
      const csrf = createCsrfCredentials();
      const { token: adminToken } = await createTestAdmin({ role: "super-admin" });
      const product = await createTestProduct();

      const res = await request(app)
        .patch(`/api/admin/listings/${product._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          action: "REMOVE",
          reason: "bad", // too short (< 5 chars)
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/at least 5 characters/i);
    });

    it("should moderate a listing, update status to REMOVED, and persist moderationHistory", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "super-admin" });
      const product = await createTestProduct();

      const res = await request(app)
        .patch(`/api/admin/listings/${product._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          action: "REMOVE",
          reason: "Suspected counterfeit trademark infringement",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.listing.isModerated).toBe(true);
      expect(res.body.listing.moderationStatus).toBe("REMOVED");

      // Verify database persistence
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.isModerated).toBe(true);
      expect(updatedProduct.moderationStatus).toBe("REMOVED");
      expect(updatedProduct.moderationReason).toBe("Suspected counterfeit trademark infringement");
      expect(updatedProduct.moderationHistory).toHaveLength(1);
      expect(updatedProduct.moderationHistory[0].action).toBe("REMOVE");
    });

    it("should reject redundant moderation if the listing is already in the requested state", async () => {
      const csrf = createCsrfCredentials();
      const { token: adminToken } = await createTestAdmin({ role: "super-admin" });
      const product = await createTestProduct({
        isModerated: true,
        moderationStatus: "REMOVED",
      });

      const res = await request(app)
        .patch(`/api/admin/listings/${product._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          action: "REMOVE",
          reason: "Redundant moderation request",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already moderated with status REMOVED/i);
    });
  });

  // 7, 8, 11, 12. Auction Safety Invariants & Public Discovery Exclusion
  describe("4. Auction Safety Invariants & Discovery Exclusion", () => {
    it("should exclude moderated listings from public catalog discovery (getAllProducts)", async () => {
      const activeProduct = await createTestProduct({ name: "Clean Public Watch" });
      const moderatedProduct = await createTestProduct({
        name: "Takedown Product Watch",
        isModerated: true,
        moderationStatus: "REMOVED",
      });

      const res = await request(app).get("/api/products");

      expect(res.statusCode).toBe(200);
      const productNames = res.body.products.map((p) => p.name);
      expect(productNames).toContain("Clean Public Watch");
      expect(productNames).not.toContain("Takedown Product Watch");
    });

    it("should return 404 from public single product query if the listing is moderated", async () => {
      const moderatedProduct = await createTestProduct({
        name: "Secret Moderated Product",
        isModerated: true,
        moderationStatus: "REMOVED",
      });

      const res = await request(app).get(`/api/products/${moderatedProduct._id}`);
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should strictly disallow bids on moderated listings via bidService.placeBid", async () => {
      const { user: bidder } = await createTestUser();
      const moderatedProduct = await createTestProduct({
        name: "Moderated Auction Item",
        currentPrice: 1000,
        biddingStartPrice: 1000,
        isModerated: true,
        moderationStatus: "REMOVED",
      });

      await expect(
        placeBid({
          productId: moderatedProduct._id.toString(),
          bidder,
          amount: 1200,
        })
      ).rejects.toThrow(/moderation/i);
    });

    it("should preserve bid history, highest bidder, and current price when moderating", async () => {
      const csrf = createCsrfCredentials();
      const { token: adminToken } = await createTestAdmin({ role: "super-admin" });
      const { user: bidder } = await createTestUser();

      // Setup product with an active bid
      const product = await createTestProduct({
        currentPrice: 1000,
        biddingStartPrice: 1000,
        startTime: new Date(Date.now() - 60000),
        endTime: new Date(Date.now() + 3600000),
        status: "Active",
      });

      // Place a valid bid before moderation
      await placeBid({
        productId: product._id.toString(),
        bidder,
        amount: 1100,
      });

      const productBeforeMod = await Product.findById(product._id);
      expect(productBeforeMod.currentPrice).toBe(1100);
      expect(productBeforeMod.bidCount).toBe(1);

      // Now moderate (take down) the product
      const res = await request(app)
        .patch(`/api/admin/listings/${product._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          action: "REMOVE",
          reason: "Grievance received under investigation",
        });

      expect(res.statusCode).toBe(200);

      // Verify auction invariants: price, bids, and bidder are untouched
      const productAfterMod = await Product.findById(product._id);
      expect(productAfterMod.currentPrice).toBe(1100);
      expect(productAfterMod.bidCount).toBe(1);
      expect(productAfterMod.highestBidder.toString()).toBe(bidder._id.toString());

      // Verify the bid record in the Bid collection is still completely intact
      const bidRecord = await Bid.findOne({ productId: product._id });
      expect(bidRecord).toBeTruthy();
      expect(bidRecord.amount).toBe(1100);
    });

    it("should BLOCK restoring an auction to LIVE if its scheduled endTime is in the past", async () => {
      const csrf = createCsrfCredentials();
      const { token: adminToken } = await createTestAdmin({ role: "super-admin" });

      // Create a product that was moderated whose endTime expired
      const expiredProduct = await createTestProduct({
        name: "Expired Ended Auction",
        status: "ENDED",
        endTime: new Date(Date.now() - 3600000), // Ended 1 hour ago
        isModerated: true,
        moderationStatus: "REMOVED",
      });

      const res = await request(app)
        .patch(`/api/admin/listings/${expiredProduct._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          action: "RESTORE",
          reason: "Attempting to reopen expired auction",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Cannot restore auction to LIVE state because its scheduled end time has already elapsed/i);
    });

    it("should successfully restore a valid active auction", async () => {
      const csrf = createCsrfCredentials();
      const { token: adminToken } = await createTestAdmin({ role: "super-admin" });

      // Create a moderated product with valid future endTime
      const validProduct = await createTestProduct({
        name: "Future Valid Auction",
        status: "Active",
        endTime: new Date(Date.now() + 3600000), // 1h in future
        isModerated: true,
        moderationStatus: "REMOVED",
      });

      const res = await request(app)
        .patch(`/api/admin/listings/${validProduct._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          action: "RESTORE",
          reason: "Investigation completed, listing cleared of violations",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.listing.isModerated).toBe(false);
      expect(res.body.listing.moderationStatus).toBe("ACTIVE");
    });
  });

  // 9 & 10. Audit Reliability, Compensating Rollback, and Idempotency
  describe("5. Audit Reliability & Idempotency", () => {
    it("should return idempotent response and avoid duplicate audit logs when retried with same idempotencyKey", async () => {
      const csrf = createCsrfCredentials();
      const { token: adminToken } = await createTestAdmin({ role: "super-admin" });
      const product = await createTestProduct();
      const idempotencyKey = "test-idempotency-key-stage-3-moderation-123";

      // 1st request
      const res1 = await request(app)
        .patch(`/api/admin/listings/${product._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          action: "REMOVE",
          reason: "First submission for trademark issue",
          idempotencyKey,
        });

      expect(res1.statusCode).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.isReplay).toBeFalsy();

      // 2nd request with EXACT SAME idempotencyKey
      const res2 = await request(app)
        .patch(`/api/admin/listings/${product._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          action: "REMOVE",
          reason: "First submission for trademark issue",
          idempotencyKey,
        });

      expect(res2.statusCode).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.isReplay).toBe(true);

      // Verify only ONE audit log exists for this action
      const auditCount = await AdminAuditLog.countDocuments({
        idempotencyKey,
        outcome: "SUCCESS",
      });
      expect(auditCount).toBe(1);
    });

    it("should abort moderation and leave product untouched if audit intent initialization fails", async () => {
      const csrf = createCsrfCredentials();
      const { token: adminToken } = await createTestAdmin({ role: "super-admin" });
      const product = await createTestProduct();

      // Mock save failure during intent
      jest
        .spyOn(AdminAuditLog.prototype, "save")
        .mockRejectedValueOnce(new Error("Mongo connection crash during intent initialization"));

      const res = await request(app)
        .patch(`/api/admin/listings/${product._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          action: "REMOVE",
          reason: "Audit failure test run",
        });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Failed to initialize administrative audit record/i);

      // Product must NOT be modified
      const refreshedProduct = await Product.findById(product._id);
      expect(refreshedProduct.isModerated).toBe(false);
      expect(refreshedProduct.moderationStatus).toBe("ACTIVE");
    });

    it("should execute compensating rollback when audit finalization fails", async () => {
      const csrf = createCsrfCredentials();
      const { token: adminToken } = await createTestAdmin({ role: "super-admin" });
      const product = await createTestProduct({
        isModerated: false,
        moderationStatus: "ACTIVE",
      });

      let auditSaveCount = 0;
      const originalSave = AdminAuditLog.prototype.save;
      jest.spyOn(AdminAuditLog.prototype, "save").mockImplementation(function () {
        auditSaveCount++;
        if (auditSaveCount === 1) {
          // Intent PENDING save succeeds
          return originalSave.apply(this, arguments);
        } else if (auditSaveCount === 2) {
          // Finalize SUCCESS save fails!
          throw new Error("Audit log database unavailable during finalization");
        }
        return originalSave.apply(this, arguments);
      });

      const res = await request(app)
        .patch(`/api/admin/listings/${product._id}/moderate`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          action: "REMOVE",
          reason: "Failure compensation test",
        });

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/audit trail could not be committed/i);

      // Verify compensating rollback restored the product back to ACTIVE
      const rolledBackProduct = await Product.findById(product._id);
      expect(rolledBackProduct.isModerated).toBe(false);
      expect(rolledBackProduct.moderationStatus).toBe("ACTIVE");
    });
  });

  // 3 & 5. Report Queue & Dispute Resolution
  describe("6. Report Review and Status Resolution", () => {
    it("should list reports with status filtering and bounded pagination", async () => {
      const { token: adminToken } = await createTestAdmin({ role: "super-admin" });

      await createTestReport({ status: "pending", reason: "Fraudulent Item" });
      await createTestReport({ status: "resolved", reason: "Copyright Grievance" });

      const res = await request(app)
        .get("/api/admin/listings/reports?status=pending")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reports).toHaveLength(1);
      expect(res.body.reports[0].reason).toBe("Fraudulent Item");
    });

    it("should reject report resolution with invalid status or short resolution note", async () => {
      const csrf = createCsrfCredentials();
      const { token: adminToken } = await createTestAdmin({ role: "super-admin" });
      const report = await createTestReport();

      // Invalid status
      const res1 = await request(app)
        .patch(`/api/admin/listings/reports/${report._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "non-existent-status",
          resolutionNote: "Valid resolution note explanation",
        });

      expect(res1.statusCode).toBe(400);
      expect(res1.body.message).toMatch(/Invalid report status/i);

      // Short resolution note
      const res2 = await request(app)
        .patch(`/api/admin/listings/reports/${report._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "resolved",
          resolutionNote: "ok", // < 5 chars
        });

      expect(res2.statusCode).toBe(400);
      expect(res2.body.message).toMatch(/at least 5 characters/i);
    });

    it("should successfully transition report status and record audit log", async () => {
      const csrf = createCsrfCredentials();
      const { admin, token: adminToken } = await createTestAdmin({ role: "super-admin" });
      const report = await createTestReport();

      const res = await request(app)
        .patch(`/api/admin/listings/reports/${report._id}/status`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          status: "resolved",
          resolutionNote: "Seller provided authentic certificate of provenance",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.report.status).toBe("resolved");
      expect(res.body.report.resolutionNote).toBe(
        "Seller provided authentic certificate of provenance"
      );

      // Verify report in database
      const updatedReport = await ReportAdmin.findById(report._id);
      expect(updatedReport.status).toBe("resolved");
      expect(updatedReport.resolvedBy).toBe(admin.email);
      expect(updatedReport.resolvedAt).toBeTruthy();

      // Verify audit log
      const auditLog = await AdminAuditLog.findOne({
        targetAccountId: report._id.toString(),
        action: "RESOLVE_REPORT",
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog.actingAdminEmail).toBe(admin.email);
    });
  });
});
