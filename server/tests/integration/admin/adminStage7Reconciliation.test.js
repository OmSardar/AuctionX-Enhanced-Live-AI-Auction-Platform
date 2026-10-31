const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const {
  createTestUser,
  createTestSeller,
  createTestAdmin,
} = require("../../helpers/authHelper");
const { createCsrfCredentials } = require("../../helpers/csrfHelper");

const ReportAdmin = require("../../../src/modules/admin/moderation/models/reports");
const Order = require("../../../src/modules/orders/models/orderSchema");
const AdminAuditLog = require("../../../src/modules/admin/disputes/models/adminAuditLog");

// Helper to create a test report/dispute
const createTestReport = async (overrides = {}) => {
  const report = new ReportAdmin({
    userName: overrides.userName || "Alice Buyer",
    userEmail: overrides.userEmail || "alice.buyer@example.com",
    reportType: overrides.reportType || "delivery",
    report: overrides.report || "The auction item arrived broken and seller refused replacement.",
    orderId: overrides.orderId || undefined,
    productId: overrides.productId || undefined,
    sellerEmail: overrides.sellerEmail || "seller.antique@domain.com",
    status: overrides.status || "pending",
    reason: overrides.reason || "Damaged item received",
    resolutionNote: overrides.resolutionNote || "",
    resolvedBy: overrides.resolvedBy || null,
    resolvedAt: overrides.resolvedAt || null,
    attachments: overrides.attachments || [],
    ...overrides,
  });
  return await report.save();
};

// Helper to create a test order
const createTestOrder = async (overrides = {}) => {
  const now = new Date();
  const order = new Order({
    winnerId: overrides.winnerId || new mongoose.Types.ObjectId(),
    title: overrides.title || "Antique Silver Pocket Watch",
    name: overrides.name || "Alice Buyer",
    userEmail: overrides.userEmail || "alice.buyer@example.com",
    sellerEmail: overrides.sellerEmail || "seller.antique@domain.com",
    category: overrides.category || "Watches",
    images: overrides.images || [
      { secure_url: "https://example.com/watch.jpg", public_id: "watch_01" },
    ],
    biddingStartPrice: overrides.biddingStartPrice || 1000,
    highestBid: overrides.highestBid || 3500,
    finalPrice: overrides.finalPrice || 3500,
    phoneNo: overrides.phoneNo || "9876543210",
    address: overrides.address || "123 Maritime Way, Kochi, Kerala",
    status: overrides.status || "PENDING",
    paymentDeadline: overrides.paymentDeadline || new Date(now.getTime() + 24 * 60 * 60 * 1000),
    isDisputeHoldActive: overrides.isDisputeHoldActive || false,
    disputeHolds: overrides.disputeHolds || [],
    ...overrides,
  });
  return await order.save();
};

// Helper to create a test audit log
const createTestAuditLog = async (overrides = {}) => {
  const audit = new AdminAuditLog({
    actingAdminId: overrides.actingAdminId || "admin_001",
    actingAdminEmail: overrides.actingAdminEmail || "lead_admin@auctionx.com",
    actingAdminModel: overrides.actingAdminModel || "Admin",
    actingAdminRole: overrides.actingAdminRole || "admin",
    targetAccountId: overrides.targetAccountId || new mongoose.Types.ObjectId().toString(),
    targetAccountEmail: overrides.targetAccountEmail || "target@example.com",
    targetAccountType: overrides.targetAccountType || "order",
    action: overrides.action || "PLACE_DISPUTE_HOLD",
    reason: overrides.reason || "Testing audit reconciliation",
    beforeStatus: overrides.beforeStatus || "PENDING",
    afterStatus: overrides.afterStatus || "PENDING",
    outcome: overrides.outcome || "PENDING",
    failureReason: overrides.failureReason || "",
    idempotencyKey: overrides.idempotencyKey || `TEST_KEY_${Date.now()}_${Math.random()}`,
    completedAt: overrides.completedAt || null,
    metadata: overrides.metadata || {},
    ...overrides,
  });
  return await audit.save();
};

describe("Admin Stage 7.2 — Audit Reconciliation & Operational Recovery Console Integration Tests", () => {
  let adminToken;
  let editorToken;
  let userToken;
  let sellerToken;

  beforeEach(async () => {
    await clearDatabase();

    const admin = await createTestAdmin({
      email: "lead_admin@auctionx.com",
      role: "admin",
      status: "Active",
    });
    adminToken = admin.token;

    const editor = await createTestAdmin({
      email: "readonly_editor@auctionx.com",
      role: "editor",
      status: "Active",
    });
    editorToken = editor.token;

    const user = await createTestUser({
      email: "regular_user@example.com",
      role: "user",
      status: "Active",
    });
    userToken = user.token;

    const seller = await createTestSeller({
      email: "seller_reconciliation@example.com",
      status: "Active",
    });
    sellerToken = seller.token;
  });

  describe("1. Authentication & Role-Based Access Enforcement", () => {
    it("rejects unauthenticated requests to reconciliation endpoints with 401", async () => {
      const resSummary = await request(app).get("/api/admin/reconciliation/summary");
      expect(resSummary.status).toBe(401);

      const resOps = await request(app).get("/api/admin/reconciliation/operations");
      expect(resOps.status).toBe(401);

      const fakeId = new mongoose.Types.ObjectId().toString();
      const resInspect = await request(app).get(`/api/admin/reconciliation/operations/${fakeId}/inspect`);
      expect(resInspect.status).toBe(401);
    });

    it("rejects regular user token from accessing reconciliation endpoints with 403", async () => {
      const res = await request(app)
        .get("/api/admin/reconciliation/summary")
        .set("Cookie", [`token=${userToken}`]);
      expect(res.status).toBe(403);
    });

    it("rejects seller token from accessing reconciliation endpoints with 403", async () => {
      const res = await request(app)
        .get("/api/admin/reconciliation/operations")
        .set("Cookie", [`token=${sellerToken}`]);
      expect(res.status).toBe(403);
    });

    it("allows verified administrator to access reconciliation endpoints with 200", async () => {
      const res = await request(app)
        .get("/api/admin/reconciliation/summary")
        .set("Cookie", [`adminToken=${adminToken}`]);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary).toBeDefined();
    });

    it("allows editor role (read-only) to access reconciliation endpoints with 200", async () => {
      const res = await request(app)
        .get("/api/admin/reconciliation/summary")
        .set("Cookie", [`adminToken=${editorToken}`]);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("2. Editor Role Boundaries & PII Masking", () => {
    it("masks sensitive email addresses in operations directory when accessed by editor role", async () => {
      await createTestAuditLog({
        actingAdminEmail: "confidential_admin@auctionx.com",
        targetAccountEmail: "sensitive_buyer@domain.com",
        outcome: "RECONCILIATION_REQUIRED",
      });

      const resEditor = await request(app)
        .get("/api/admin/reconciliation/operations")
        .set("Cookie", [`adminToken=${editorToken}`]);

      expect(resEditor.status).toBe(200);
      const op = resEditor.body.operations[0];
      expect(op.actingAdminEmail).toMatch(/^co\*\*\*@auctionx\.com$/);
      expect(op.targetAccountEmail).toMatch(/^se\*\*\*@domain\.com$/);

      // Verify full administrator sees unmasked emails
      const resAdmin = await request(app)
        .get("/api/admin/reconciliation/operations")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(resAdmin.status).toBe(200);
      const adminOp = resAdmin.body.operations[0];
      expect(adminOp.actingAdminEmail).toBe("confidential_admin@auctionx.com");
      expect(adminOp.targetAccountEmail).toBe("sensitive_buyer@domain.com");
    });

    it("masks sensitive emails in deep inspection response when accessed by editor role", async () => {
      const order = await createTestOrder({
        userEmail: "buyer_private@domain.com",
        sellerEmail: "seller_private@domain.com",
      });
      const report = await createTestReport({
        orderId: order._id.toString(),
        userEmail: "reporter_private@domain.com",
      });
      const audit = await createTestAuditLog({
        targetAccountId: order._id.toString(),
        actingAdminEmail: "admin_private@auctionx.com",
        outcome: "RECONCILIATION_REQUIRED",
        metadata: { caseId: report._id.toString(), orderId: order._id.toString() },
      });

      const res = await request(app)
        .get(`/api/admin/reconciliation/operations/${audit._id}/inspect`)
        .set("Cookie", [`adminToken=${editorToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.audit.actingAdminEmail).toMatch(/^ad\*\*\*@auctionx\.com$/);
      expect(res.body.persistedState.order.userEmail).toMatch(/^bu\*\*\*@domain\.com$/);
      expect(res.body.persistedState.order.sellerEmail).toMatch(/^se\*\*\*@domain\.com$/);
      expect(res.body.persistedState.disputeCase.userEmail).toMatch(/^re\*\*\*@domain\.com$/);
    });
  });

  describe("3. Validation, Bounded Pagination, and Parameter Guards", () => {
    it("rejects invalid outcome filter with 400 Bad Request", async () => {
      const res = await request(app)
        .get("/api/admin/reconciliation/operations?outcome=UNKNOWN_OUTCOME")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid outcome filter/i);
    });

    it("rejects invalid action filter with 400 Bad Request", async () => {
      const res = await request(app)
        .get("/api/admin/reconciliation/operations?action=INVALID_ACTION")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid action filter/i);
    });

    it("rejects invalid category filter with 400 Bad Request", async () => {
      const res = await request(app)
        .get("/api/admin/reconciliation/operations?category=unsupported_cat")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid category filter/i);
    });

    it("rejects invalid sortBy field with 400 Bad Request", async () => {
      const res = await request(app)
        .get("/api/admin/reconciliation/operations?sortBy=malicious_field")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid sortBy field/i);
    });

    it("rejects malformed ObjectId format in inspect endpoint with 400", async () => {
      const res = await request(app)
        .get("/api/admin/reconciliation/operations/not-a-valid-id/inspect")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid audit log id format/i);
    });

    it("returns 404 cleanly when audit log record is not found", async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/admin/reconciliation/operations/${nonExistentId}/inspect`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/audit log record not found/i);
    });

    it("bounds maximum query limit to 50 when client requests 100", async () => {
      const res = await request(app)
        .get("/api/admin/reconciliation/operations?limit=100")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(50);
    });
  });

  describe("4. Consistent Completed Operations (CONSISTENT_COMPLETED)", () => {
    it("diagnoses a fully completed PLACE_DISPUTE_HOLD operation as CONSISTENT_COMPLETED", async () => {
      const order = await createTestOrder({
        isDisputeHoldActive: true,
      });
      const report = await createTestReport({ orderId: order._id.toString() });

      const holdId = `HOLD_${report._id}_001`;
      order.disputeHolds = [
        {
          holdId,
          caseId: report._id,
          reason: "Investigation active",
          placedBy: { adminId: "admin_01", adminEmail: "admin@auctionx.com", role: "admin" },
          placedAt: new Date(),
          status: "ACTIVE",
        },
      ];
      await order.save();

      const audit = await createTestAuditLog({
        targetAccountId: order._id.toString(),
        action: "PLACE_DISPUTE_HOLD",
        outcome: "SUCCESS",
        metadata: { caseId: report._id.toString(), orderId: order._id.toString() },
      });

      const res = await request(app)
        .get(`/api/admin/reconciliation/operations/${audit._id}/inspect`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.consistencyAnalysis.classification).toBe("CONSISTENT_COMPLETED");
      expect(res.body.consistencyAnalysis.discrepancies.length).toBe(0);
      expect(res.body.consistencyAnalysis.isSafeToRetry).toBe(false);
      expect(res.body.consistencyAnalysis.requiresManualReview).toBe(false);
      expect(res.body.persistedState.order.isDisputeHoldActive).toBe(true);
      expect(res.body.persistedState.order.activeHoldsCount).toBe(1);
    });

    it("diagnoses a fully completed RELEASE_DISPUTE_HOLD operation as CONSISTENT_COMPLETED", async () => {
      const report = await createTestReport();
      const order = await createTestOrder({
        isDisputeHoldActive: false,
        disputeHolds: [
          {
            holdId: "HOLD_REL_001",
            caseId: report._id,
            reason: "Investigation active",
            placedBy: { adminId: "admin_01", adminEmail: "admin@auctionx.com", role: "admin" },
            placedAt: new Date(Date.now() - 3600000),
            status: "RELEASED",
            releasedAt: new Date(),
            releasedBy: { adminId: "admin_01", adminEmail: "admin@auctionx.com", role: "admin" },
            releaseReason: "Resolved complaint",
          },
        ],
      });
      report.orderId = order._id.toString();
      await report.save();

      const audit = await createTestAuditLog({
        targetAccountId: order._id.toString(),
        action: "RELEASE_DISPUTE_HOLD",
        outcome: "SUCCESS",
        metadata: { caseId: report._id.toString(), orderId: order._id.toString() },
      });

      const res = await request(app)
        .get(`/api/admin/reconciliation/operations/${audit._id}/inspect`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.consistencyAnalysis.classification).toBe("CONSISTENT_COMPLETED");
      expect(res.body.consistencyAnalysis.discrepancies.length).toBe(0);
      expect(res.body.persistedState.order.isDisputeHoldActive).toBe(false);
      expect(res.body.persistedState.order.activeHoldsCount).toBe(0);
    });
  });

  describe("5. Incomplete Audit Records with Matching Persisted State (APPLIED_AUDIT_INCOMPLETE)", () => {
    it("detects hold applied on order when audit remains PENDING and flags safe to retry", async () => {
      const report = await createTestReport();
      const order = await createTestOrder({
        isDisputeHoldActive: true,
        disputeHolds: [
          {
            holdId: `HOLD_${report._id}_CRASH`,
            caseId: report._id,
            reason: "Crash simulation hold",
            placedBy: { adminId: "admin_01", adminEmail: "admin@auctionx.com", role: "admin" },
            placedAt: new Date(),
            status: "ACTIVE",
          },
        ],
      });
      report.orderId = order._id.toString();
      await report.save();

      const audit = await createTestAuditLog({
        targetAccountId: order._id.toString(),
        action: "PLACE_DISPUTE_HOLD",
        outcome: "PENDING",
        metadata: { caseId: report._id.toString(), orderId: order._id.toString() },
      });

      const res = await request(app)
        .get(`/api/admin/reconciliation/operations/${audit._id}/inspect`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.consistencyAnalysis.classification).toBe("APPLIED_AUDIT_INCOMPLETE");
      expect(res.body.consistencyAnalysis.isSafeToRetry).toBe(true);
      expect(res.body.consistencyAnalysis.discrepancies).toEqual(
        expect.arrayContaining([expect.stringMatching(/audit record remained in pending/i)])
      );
    });
  });

  describe("6. Incomplete Audit Records with Conflicting Persisted State (CONFLICTING_AMBIGUOUS_STATE)", () => {
    it("detects audit SUCCESS but missing hold on order as CONFLICTING_AMBIGUOUS_STATE", async () => {
      const report = await createTestReport();
      const order = await createTestOrder({
        isDisputeHoldActive: false,
        disputeHolds: [],
      });
      report.orderId = order._id.toString();
      await report.save();

      const audit = await createTestAuditLog({
        targetAccountId: order._id.toString(),
        action: "PLACE_DISPUTE_HOLD",
        outcome: "SUCCESS",
        metadata: { caseId: report._id.toString(), orderId: order._id.toString() },
      });

      const res = await request(app)
        .get(`/api/admin/reconciliation/operations/${audit._id}/inspect`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.consistencyAnalysis.classification).toBe("CONFLICTING_AMBIGUOUS_STATE");
      expect(res.body.consistencyAnalysis.requiresManualReview).toBe(true);
      expect(res.body.consistencyAnalysis.isSafeToRetry).toBe(false);
      expect(res.body.consistencyAnalysis.discrepancies).toEqual(
        expect.arrayContaining([expect.stringMatching(/no active hold exists for this case/i)])
      );
    });

    it("detects isDisputeHoldActive disagreement with holds array as CONFLICTING_AMBIGUOUS_STATE", async () => {
      const report = await createTestReport();
      // Corrupted state: active hold exists but isDisputeHoldActive is FALSE
      const order = await createTestOrder({
        isDisputeHoldActive: false,
        disputeHolds: [
          {
            holdId: "CORRUPTED_HOLD_01",
            caseId: report._id,
            reason: "Active hold test",
            placedBy: { adminId: "admin_01", adminEmail: "admin@auctionx.com", role: "admin" },
            placedAt: new Date(),
            status: "ACTIVE",
          },
        ],
      });
      report.orderId = order._id.toString();
      await report.save();

      const audit = await createTestAuditLog({
        targetAccountId: order._id.toString(),
        action: "PLACE_DISPUTE_HOLD",
        outcome: "RECONCILIATION_REQUIRED",
        failureReason: "FATAL: Rollback update failed",
        metadata: { caseId: report._id.toString(), orderId: order._id.toString() },
      });

      const res = await request(app)
        .get(`/api/admin/reconciliation/operations/${audit._id}/inspect`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.consistencyAnalysis.classification).toBe("CONFLICTING_AMBIGUOUS_STATE");
      expect(res.body.consistencyAnalysis.requiresManualReview).toBe(true);
      expect(res.body.consistencyAnalysis.discrepancies).toEqual(
        expect.arrayContaining([expect.stringMatching(/isDisputeHoldActive \(false\) disagrees with active holds/i)])
      );
    });
  });

  describe("7. Missing Orders, Missing Cases, and Mismatched References", () => {
    it("diagnoses missing referenced order as ORPHANED_REFERENCE without crashing", async () => {
      const fakeOrderId = new mongoose.Types.ObjectId().toString();
      const report = await createTestReport({ orderId: fakeOrderId });

      const audit = await createTestAuditLog({
        targetAccountId: fakeOrderId,
        action: "PLACE_DISPUTE_HOLD",
        outcome: "RECONCILIATION_REQUIRED",
        metadata: { caseId: report._id.toString(), orderId: fakeOrderId },
      });

      const res = await request(app)
        .get(`/api/admin/reconciliation/operations/${audit._id}/inspect`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.consistencyAnalysis.classification).toBe("ORPHANED_REFERENCE");
      expect(res.body.persistedState.order.exists).toBe(false);
      expect(res.body.consistencyAnalysis.isSafeToRetry).toBe(false);
      expect(res.body.consistencyAnalysis.requiresManualReview).toBe(true);
      expect(res.body.consistencyAnalysis.discrepancies).toEqual(
        expect.arrayContaining([expect.stringMatching(/does not exist in database \(orphaned reference\)/i)])
      );
    });

    it("diagnoses missing referenced dispute case as ORPHANED_REFERENCE without crashing", async () => {
      const order = await createTestOrder();
      const fakeCaseId = new mongoose.Types.ObjectId().toString();

      const audit = await createTestAuditLog({
        targetAccountId: order._id.toString(),
        action: "PLACE_DISPUTE_HOLD",
        outcome: "RECONCILIATION_REQUIRED",
        metadata: { caseId: fakeCaseId, orderId: order._id.toString() },
      });

      const res = await request(app)
        .get(`/api/admin/reconciliation/operations/${audit._id}/inspect`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.consistencyAnalysis.classification).toBe("ORPHANED_REFERENCE");
      expect(res.body.persistedState.disputeCase.exists).toBe(false);
      expect(res.body.consistencyAnalysis.isSafeToRetry).toBe(false);
      expect(res.body.consistencyAnalysis.requiresManualReview).toBe(true);
    });

    it("detects cross-reference mismatch between case and targeted order", async () => {
      const orderA = await createTestOrder({ title: "Order A" });
      const orderB = await createTestOrder({ title: "Order B" });
      // Report references Order A, but audit targets Order B
      const report = await createTestReport({ orderId: orderA._id.toString() });

      const audit = await createTestAuditLog({
        targetAccountId: orderB._id.toString(),
        action: "PLACE_DISPUTE_HOLD",
        outcome: "RECONCILIATION_REQUIRED",
        metadata: { caseId: report._id.toString(), orderId: orderB._id.toString() },
      });

      const res = await request(app)
        .get(`/api/admin/reconciliation/operations/${audit._id}/inspect`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.consistencyAnalysis.classification).toBe("CONFLICTING_AMBIGUOUS_STATE");
      expect(res.body.persistedState.disputeCase.orderReferenceMatches).toBe(false);
      expect(res.body.consistencyAnalysis.discrepancies).toEqual(
        expect.arrayContaining([expect.stringMatching(/dispute case references orderid/i)])
      );
    });
  });

  describe("8. Multiple Active Holds on One Order", () => {
    it("accurately inspects an order with multiple independent active holds", async () => {
      const report1 = await createTestReport({ report: "Case 1: damaged item" });
      const report2 = await createTestReport({ report: "Case 2: counterfeit provenance" });

      const order = await createTestOrder({
        isDisputeHoldActive: true,
        disputeHolds: [
          {
            holdId: "HOLD_CASE_1",
            caseId: report1._id,
            reason: "Investigation case 1",
            placedBy: { adminId: "admin_1", adminEmail: "admin1@auctionx.com", role: "admin" },
            placedAt: new Date(),
            status: "ACTIVE",
          },
          {
            holdId: "HOLD_CASE_2",
            caseId: report2._id,
            reason: "Investigation case 2",
            placedBy: { adminId: "admin_2", adminEmail: "admin2@auctionx.com", role: "admin" },
            placedAt: new Date(),
            status: "ACTIVE",
          },
        ],
      });
      report1.orderId = order._id.toString();
      report2.orderId = order._id.toString();
      await report1.save();
      await report2.save();

      const audit1 = await createTestAuditLog({
        targetAccountId: order._id.toString(),
        action: "PLACE_DISPUTE_HOLD",
        outcome: "SUCCESS",
        metadata: { caseId: report1._id.toString(), orderId: order._id.toString() },
      });

      const res = await request(app)
        .get(`/api/admin/reconciliation/operations/${audit1._id}/inspect`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.consistencyAnalysis.classification).toBe("CONSISTENT_COMPLETED");
      expect(res.body.persistedState.order.activeHoldsCount).toBe(2);
      expect(res.body.persistedState.order.disputeHolds.length).toBe(2);
    });
  });

  describe("9. Database Errors and Partially Unavailable Dependencies", () => {
    it("handles database query rejection gracefully and reports dependency unavailable", async () => {
      const report = await createTestReport();
      const order = await createTestOrder();
      const audit = await createTestAuditLog({
        targetAccountId: order._id.toString(),
        action: "PLACE_DISPUTE_HOLD",
        outcome: "RECONCILIATION_REQUIRED",
        metadata: { caseId: report._id.toString(), orderId: order._id.toString() },
      });

      const findByIdSpy = jest.spyOn(Order, "findById").mockImplementation(() => {
        throw new Error("MongoNetworkTimeoutException: replica set member unreachable");
      });

      try {
        const res = await request(app)
          .get(`/api/admin/reconciliation/operations/${audit._id}/inspect`)
          .set("Cookie", [`adminToken=${adminToken}`]);

        expect(res.status).toBe(200);
        expect(res.body.consistencyAnalysis.classification).toBe("DEPENDENCY_UNAVAILABLE");
        expect(res.body.consistencyAnalysis.discrepancies).toEqual(
          expect.arrayContaining([expect.stringMatching(/database error while fetching dependencies/i)])
        );
      } finally {
        findByIdSpy.mockRestore();
      }
    });
  });

  describe("10. Confirmation That Inspection Endpoints Never Mutate Orders, Holds, or Audit Outcomes", () => {
    it("proves strict zero mutation: calling inspect repeatedly leaves database completely untouched", async () => {
      const report = await createTestReport();
      const order = await createTestOrder({
        isDisputeHoldActive: true,
        disputeHolds: [
          {
            holdId: "HOLD_ZERO_MUTATION",
            caseId: report._id,
            reason: "Immutable hold",
            placedBy: { adminId: "admin_1", adminEmail: "admin@auctionx.com", role: "admin" },
            placedAt: new Date(),
            status: "ACTIVE",
          },
        ],
      });
      report.orderId = order._id.toString();
      await report.save();

      const audit = await createTestAuditLog({
        targetAccountId: order._id.toString(),
        action: "PLACE_DISPUTE_HOLD",
        outcome: "RECONCILIATION_REQUIRED",
        failureReason: "Testing zero mutation guarantee",
        metadata: { caseId: report._id.toString(), orderId: order._id.toString() },
      });

      // Capture exact baseline snapshots before inspect
      const orderBefore = await Order.findById(order._id).lean();
      const reportBefore = await ReportAdmin.findById(report._id).lean();
      const auditBefore = await AdminAuditLog.findById(audit._id).lean();

      // Call inspect 5 times
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .get(`/api/admin/reconciliation/operations/${audit._id}/inspect`)
          .set("Cookie", [`adminToken=${adminToken}`]);
        expect(res.status).toBe(200);
      }

      // Capture snapshots after inspect
      const orderAfter = await Order.findById(order._id).lean();
      const reportAfter = await ReportAdmin.findById(report._id).lean();
      const auditAfter = await AdminAuditLog.findById(audit._id).lean();

      // Assert complete equality
      expect(orderAfter.isDisputeHoldActive).toBe(orderBefore.isDisputeHoldActive);
      expect(orderAfter.disputeHolds.length).toBe(orderBefore.disputeHolds.length);
      expect(orderAfter.status).toBe(orderBefore.status);
      expect(orderAfter.updatedAt.getTime()).toBe(orderBefore.updatedAt.getTime());

      expect(reportAfter.status).toBe(reportBefore.status);
      expect(reportAfter.date.getTime()).toBe(reportBefore.date.getTime());

      expect(auditAfter.outcome).toBe(auditBefore.outcome);
      expect(auditAfter.failureReason).toBe(auditBefore.failureReason);
    });
  });

  describe("11. Telemetry Summary Metrics Verification", () => {
    it("accurately calculates reconciliationRequiredCount, stalePendingCount, and byAction breakdown", async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      // 2 Reconciliation Required
      await createTestAuditLog({
        outcome: "RECONCILIATION_REQUIRED",
        action: "PLACE_DISPUTE_HOLD",
        failureReason: "FATAL: Compensating rollback failed: network down",
      });
      await createTestAuditLog({
        outcome: "RECONCILIATION_REQUIRED",
        action: "RELEASE_DISPUTE_HOLD",
      });

      // 1 Stale Pending (10 mins old)
      await createTestAuditLog({
        outcome: "PENDING",
        action: "PLACE_DISPUTE_HOLD",
        createdAt: tenMinutesAgo,
      });

      // 1 Fresh Pending (just created)
      await createTestAuditLog({
        outcome: "PENDING",
        action: "PLACE_DISPUTE_HOLD",
      });

      // 1 Failed
      await createTestAuditLog({
        outcome: "FAILED",
        action: "SUSPEND_ACCOUNT",
      });

      const res = await request(app)
        .get("/api/admin/reconciliation/summary?ageMinutes=5")
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.summary.reconciliationRequiredCount).toBe(2);
      expect(res.body.summary.stalePendingCount).toBe(1);
      expect(res.body.summary.totalPendingCount).toBe(2);
      expect(res.body.summary.failedRollbackCount).toBe(1);
      expect(res.body.summary.failedCount).toBe(1);
      expect(res.body.summary.totalIssues).toBe(3); // 2 RECONCILIATION_REQUIRED + 1 stale PENDING
      expect(res.body.summary.byAction.PLACE_DISPUTE_HOLD).toBe(2); // 1 RECONCILIATION_REQUIRED + 1 stale PENDING
      expect(res.body.summary.byAction.RELEASE_DISPUTE_HOLD).toBe(1);
    });
  });

  describe("12. Admin Stage 7.3 Recovery Hardening, Mismatched Keys, Race Prevention & Authoritative Classifications", () => {
    it("flags isSafeToRetry as false when pending audit lacks a valid idempotencyKey", async () => {
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });

      const auditNoKey = await createTestAuditLog({
        targetAccountId: order._id.toString(),
        action: "PLACE_DISPUTE_HOLD",
        outcome: "PENDING",
        idempotencyKey: "", // Missing key
        metadata: { caseId: report._id.toString(), orderId: order._id.toString() },
      });

      const res = await request(app)
        .get(`/api/admin/reconciliation/operations/${auditNoKey._id}/inspect`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.consistencyAnalysis.classification).toBe("UNAPPLIED_AUDIT_INCOMPLETE");
      expect(res.body.consistencyAnalysis.isSafeToRetry).toBe(false);
      expect(res.body.consistencyAnalysis.requiresManualReview).toBe(true);
      expect(res.body.consistencyAnalysis.recommendedAction).toMatch(/lacks an idempotencyKey/i);
    });

    it("prevents CONFLICTING_AMBIGUOUS_STATE from being overwritten by PENDING classification when hold flag is incoherent", async () => {
      const report = await createTestReport();
      const order = await createTestOrder({
        isDisputeHoldActive: false, // Incoherent: has active hold but flag is false
        disputeHolds: [
          {
            holdId: "HOLD_INCOHERENT_FLAG",
            caseId: report._id,
            reason: "Flag incoherence test",
            placedBy: { adminId: "admin_1", adminEmail: "admin@auctionx.com", role: "admin" },
            placedAt: new Date(),
            status: "ACTIVE",
          },
        ],
      });
      report.orderId = order._id.toString();
      await report.save();

      const audit = await createTestAuditLog({
        targetAccountId: order._id.toString(),
        action: "PLACE_DISPUTE_HOLD",
        outcome: "PENDING",
        idempotencyKey: "VALID_KEY_INCOHERENT_TEST",
        metadata: { caseId: report._id.toString(), orderId: order._id.toString(), holdId: "HOLD_INCOHERENT_FLAG" },
      });

      const res = await request(app)
        .get(`/api/admin/reconciliation/operations/${audit._id}/inspect`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.consistencyAnalysis.classification).toBe("CONFLICTING_AMBIGUOUS_STATE");
      expect(res.body.consistencyAnalysis.isSafeToRetry).toBe(false);
      expect(res.body.consistencyAnalysis.requiresManualReview).toBe(true);
      expect(res.body.consistencyAnalysis.discrepancies).toEqual(
        expect.arrayContaining([expect.stringMatching(/disagrees with active holds count/i)])
      );
    });

    it("rejects place hold retry with 409 Conflict if idempotency key was previously registered for a different action", async () => {
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });
      const rawKey = `IDEM_ACTION_MISMATCH_${Date.now()}`;
      const registeredOpKey = `HOLD_${report._id}_${order._id}_${rawKey}`;

      // Register key under RELEASE_DISPUTE_HOLD
      await createTestAuditLog({
        idempotencyKey: registeredOpKey,
        action: "RELEASE_DISPUTE_HOLD",
        targetAccountId: order._id.toString(),
        metadata: { caseId: report._id.toString(), orderId: order._id.toString() },
      });

      const csrfCreds = await createCsrfCredentials();
      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [`adminToken=${adminToken}`, csrfCreds.cookie])
        .set(csrfCreds.headerName, csrfCreds.token)
        .send({
          reason: "Attempting to place hold with mismatched action idempotency key",
          idempotencyKey: rawKey,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/was previously registered for action 'RELEASE_DISPUTE_HOLD'/i);
    });

    it("rejects place hold retry with 409 Conflict if idempotency key targets a different order", async () => {
      const orderA = await createTestOrder({ title: "Original Target" });
      const orderB = await createTestOrder({ title: "Different Target" });
      const report = await createTestReport({ orderId: orderB._id.toString() });
      const rawKey = `IDEM_TARGET_MISMATCH_${Date.now()}`;
      const registeredOpKey = `HOLD_${report._id}_${orderB._id}_${rawKey}`;

      // Audit log records targetAccountId as orderA, but request order is orderB
      await createTestAuditLog({
        idempotencyKey: registeredOpKey,
        action: "PLACE_DISPUTE_HOLD",
        targetAccountId: orderA._id.toString(), // Mismatch!
        metadata: { caseId: report._id.toString(), orderId: orderA._id.toString() },
      });

      const csrfCreds = await createCsrfCredentials();
      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [`adminToken=${adminToken}`, csrfCreds.cookie])
        .set(csrfCreds.headerName, csrfCreds.token)
        .send({
          reason: "Testing target mismatch rejection",
          idempotencyKey: rawKey,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/targets a different order or dispute case/i);
    });

    it("requires manual reconciliation when recovering a pending audit without specific hold identity if hold exists", async () => {
      const report = await createTestReport();
      const order = await createTestOrder({
        isDisputeHoldActive: true,
        disputeHolds: [
          {
            holdId: "HOLD_UNSPECIFIED_IDENTITY",
            caseId: report._id,
            reason: "Pre-existing hold",
            placedBy: { adminId: "admin_1", adminEmail: "admin@auctionx.com", role: "admin" },
            placedAt: new Date(),
            status: "ACTIVE",
          },
        ],
      });
      report.orderId = order._id.toString();
      await report.save();

      const rawKey = `IDEM_NO_HOLD_ID_${Date.now()}`;
      const registeredOpKey = `HOLD_${report._id}_${order._id}_${rawKey}`;

      // Pending audit record without holdId in metadata
      await createTestAuditLog({
        idempotencyKey: registeredOpKey,
        action: "PLACE_DISPUTE_HOLD",
        outcome: "PENDING",
        targetAccountId: order._id.toString(),
        metadata: { caseId: report._id.toString(), orderId: order._id.toString() }, // No holdId!
      });

      const csrfCreds = await createCsrfCredentials();
      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [`adminToken=${adminToken}`, csrfCreds.cookie])
        .set(csrfCreds.headerName, csrfCreds.token)
        .send({
          reason: "Attempting recovery without hold identity",
          idempotencyKey: rawKey,
        });

      expect(res.status).toBe(409);
      expect(res.body.reconciliationRequired).toBe(true);
      expect(res.body.message).toMatch(/Ambiguous recovery: A hold exists for this case, but audit record lacks specific hold identity/i);
    });

    it("safely and atomically recovers pending audit when exact holdId matches persisted order hold", async () => {
      const report = await createTestReport();
      const holdId = `HOLD_EXACT_MATCH_${Date.now()}`;
      const order = await createTestOrder({
        isDisputeHoldActive: true,
        disputeHolds: [
          {
            holdId,
            caseId: report._id,
            reason: "Applied before crash",
            placedBy: { adminId: "admin_1", adminEmail: "admin@auctionx.com", role: "admin" },
            placedAt: new Date(),
            status: "ACTIVE",
          },
        ],
      });
      report.orderId = order._id.toString();
      await report.save();

      const rawKey = `IDEM_CRASH_RECOVER_${Date.now()}`;
      const registeredOpKey = `HOLD_${report._id}_${order._id}_${rawKey}`;

      const pendingAudit = await createTestAuditLog({
        idempotencyKey: registeredOpKey,
        action: "PLACE_DISPUTE_HOLD",
        outcome: "PENDING",
        targetAccountId: order._id.toString(),
        metadata: { caseId: report._id.toString(), orderId: order._id.toString(), holdId },
      });

      const csrfCreds = await createCsrfCredentials();
      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [`adminToken=${adminToken}`, csrfCreds.cookie])
        .set(csrfCreds.headerName, csrfCreds.token)
        .send({
          reason: "Idempotent retry recovering from crash",
          idempotencyKey: rawKey,
        });

      expect(res.status).toBe(200);
      expect(res.body.isReplay).toBe(true);
      expect(res.body.hold.holdId).toBe(holdId);

      // Verify audit record was finalized atomically to SUCCESS with recoveredFromAmbiguousState
      const refreshedAudit = await AdminAuditLog.findById(pendingAudit._id);
      expect(refreshedAudit.outcome).toBe("SUCCESS");
      expect(refreshedAudit.metadata.recoveredFromAmbiguousState).toBe(true);
      expect(refreshedAudit.completedAt).not.toBeNull();
    });

    it("ensures pipeline compensating rollback targeting specific holdId does not release other active holds", async () => {
      const report1 = await createTestReport({ report: "Valid report description for case 1" });
      const report2 = await createTestReport({ report: "Valid report description for case 2" });
      const holdToRollback = `HOLD_ROLLBACK_TARGET_${Date.now()}`;
      const otherActiveHold = `HOLD_INDEPENDENT_ACTIVE_${Date.now()}`;

      const order = await createTestOrder({
        isDisputeHoldActive: true,
        disputeHolds: [
          {
            holdId: otherActiveHold,
            caseId: report2._id,
            reason: "Unrelated dispute hold",
            placedBy: { adminId: "admin_2", adminEmail: "admin2@auctionx.com", role: "admin" },
            placedAt: new Date(),
            status: "ACTIVE",
          },
          {
            holdId: holdToRollback,
            caseId: report1._id,
            reason: "Hold that will be rolled back",
            placedBy: { adminId: "admin_1", adminEmail: "admin1@auctionx.com", role: "admin" },
            placedAt: new Date(),
            status: "ACTIVE",
          },
        ],
      });

      // Execute single-document pipeline rollback for holdToRollback
      const rollbackOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          disputeHolds: {
            $elemMatch: { holdId: holdToRollback, status: "ACTIVE" },
          },
        },
        [
          {
            $set: {
              disputeHolds: {
                $filter: {
                  input: { $ifNull: ["$disputeHolds", []] },
                  as: "dh",
                  cond: { $ne: ["$$dh.holdId", holdToRollback] },
                },
              },
            },
          },
          {
            $set: {
              isDisputeHoldActive: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: "$disputeHolds",
                        as: "dh",
                        cond: { $eq: ["$$dh.status", "ACTIVE"] },
                      },
                    },
                  },
                  0,
                ],
              },
            },
          },
        ],
        { new: true }
      );

      expect(rollbackOrder).not.toBeNull();
      // The other active hold must still be present and ACTIVE!
      expect(rollbackOrder.disputeHolds.length).toBe(1);
      expect(rollbackOrder.disputeHolds[0].holdId).toBe(otherActiveHold);
      expect(rollbackOrder.disputeHolds[0].status).toBe("ACTIVE");
      // And isDisputeHoldActive must remain TRUE because otherActiveHold is still active!
      expect(rollbackOrder.isDisputeHoldActive).toBe(true);
    });
  });
});
