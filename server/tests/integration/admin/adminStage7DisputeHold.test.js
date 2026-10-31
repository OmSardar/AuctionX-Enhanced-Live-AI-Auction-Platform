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
const Product = require("../../../src/modules/products/models/productSchema");
const Payment = require("../../../src/modules/payments/models/Payment");
const AdminAuditLog = require("../../../src/modules/admin/disputes/models/adminAuditLog");
const AdminInternalNote = require("../../../src/modules/admin/disputes/models/adminInternalNote");
const { reconcilePaymentStates, initiateOrderPayment, settleOrderPayment } = require("../../../src/modules/payments/services/paymentService");

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

describe("Admin Stage 7 — Dispute Hold Protocol & Internal Investigation Integration Tests", () => {
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
      email: "seller_dispute@example.com",
      status: "Active",
    });
    sellerToken = seller.token;
  });

  describe("1. Authentication & Role-Based Access for Dispute Holds & Notes", () => {
    it("should reject unauthenticated requests to hold endpoints with 401", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });

      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Suspected non-delivery fraud" });

      expect(res.status).toBe(401);
    });

    it("should reject ordinary user token from placing hold with 403", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });

      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `token=${userToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Suspected non-delivery fraud" });

      expect(res.status).toBe(403);
    });

    it("should reject seller token from placing hold with 403", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });

      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `token=${sellerToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Suspected non-delivery fraud" });

      expect(res.status).toBe(403);
    });

    it("should reject editor role from placing a dispute hold with 403 Forbidden", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });

      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${editorToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Suspected non-delivery fraud" });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/read-only access/i);
    });

    it("should reject editor role from releasing a dispute hold with 403 Forbidden", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });

      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/release-hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${editorToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ releaseReason: "Carrier tracking verified" });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/read-only access/i);
    });

    it("should reject editor role from creating an internal investigation note with 403 Forbidden", async () => {
      const csrf = createCsrfCredentials();
      const report = await createTestReport();

      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/notes`)
        .set("Cookie", [csrf.cookie, `adminToken=${editorToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ content: "Investigated buyer shipping address." });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/read-only access/i);
    });

    it("should allow verified administrator to place hold and read/write notes with 200/201", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });

      const holdRes = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Investigating buyer claim of damaged shipment" });

      expect(holdRes.status).toBe(200);
      expect(holdRes.body.success).toBe(true);
      expect(holdRes.body.order.isDisputeHoldActive).toBe(true);

      const noteRes = await request(app)
        .post(`/api/admin/disputes/${report._id}/notes`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ content: "Spoke with seller on phone, awaiting courier receipt." });

      expect(noteRes.status).toBe(201);
      expect(noteRes.body.success).toBe(true);
    });
  });

  describe("2. Parameter Validation & Boundary Conditions", () => {
    it("should reject hold request with missing or short reason (< 5 chars)", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });

      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "bad" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least 5 characters/i);
    });

    it("should reject hold request when case does not reference an order", async () => {
      const csrf = createCsrfCredentials();
      const report = await createTestReport({ orderId: undefined });

      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Hold without order reference" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/does not reference a linked order/i);
    });

    it("should reject hold request when linked orderId is orphaned/not found in database", async () => {
      const csrf = createCsrfCredentials();
      const fakeOrderId = new mongoose.Types.ObjectId().toString();
      const report = await createTestReport({ orderId: fakeOrderId });

      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Hold for orphaned order" });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/orphaned order reference/i);
    });

    it("should reject release request when no active hold exists for this case", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder({ isDisputeHoldActive: false, disputeHolds: [] });
      const report = await createTestReport({ orderId: order._id.toString() });

      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/release-hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ releaseReason: "Releasing non-existent hold" });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/no active dispute hold found/i);
    });
  });

  describe("3. Duplicate Holds & Idempotency", () => {
    it("should reject duplicate active hold for the same case with 409 Conflict", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });

      // First hold placement
      const res1 = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "First hold placement by lead admin" });
      expect(res1.status).toBe(200);

      // Duplicate hold placement attempt
      const res2 = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Second hold placement attempt" });

      expect(res2.status).toBe(409);
      expect(res2.body.message).toMatch(/already in effect/i);
    });

    it("should return idempotent replay when retried with same idempotencyKey", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });
      const idempotencyKey = "REPLAY_KEY_999";

      const res1 = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Investigating buyer claim", idempotencyKey });
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Investigating buyer claim", idempotencyKey });

      expect(res2.status).toBe(200);
      expect(res2.body.isReplay).toBe(true);
    });
  });

  describe("4. Multiple Reports Against One Order & Independent Release Behavior", () => {
    it("preserves active hold when one of multiple active holds is released", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder({ status: "PENDING" });
      const reportA = await createTestReport({ orderId: order._id.toString(), report: "Complaint A: Damaged glass" });
      const reportB = await createTestReport({ orderId: order._id.toString(), report: "Complaint B: Missing accessories" });

      // Place hold from Report A
      const holdResA = await request(app)
        .post(`/api/admin/disputes/${reportA._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Hold for complaint A: Damaged glass" });
      expect(holdResA.status).toBe(200);

      // Place hold from Report B
      const holdResB = await request(app)
        .post(`/api/admin/disputes/${reportB._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Hold for complaint B: Missing accessories" });
      expect(holdResB.status).toBe(200);

      // Verify order has 2 active holds
      let refreshedOrder = await Order.findById(order._id);
      expect(refreshedOrder.disputeHolds.length).toBe(2);
      expect(refreshedOrder.isDisputeHoldActive).toBe(true);

      // Release hold for Report A only
      const relResA = await request(app)
        .post(`/api/admin/disputes/${reportA._id}/release-hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ releaseReason: "Glass damage claim settled with partial credit" });
      expect(relResA.status).toBe(200);
      expect(relResA.body.isDisputeHoldActive).toBe(true);

      // Order should STILL have active hold protection due to Report B
      refreshedOrder = await Order.findById(order._id);
      expect(refreshedOrder.isDisputeHoldActive).toBe(true);
      expect(refreshedOrder.status).toBe("PENDING"); // Underlying status NEVER changed!

      // Release hold for Report B
      const relResB = await request(app)
        .post(`/api/admin/disputes/${reportB._id}/release-hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ releaseReason: "Accessories located and dispatched" });
      expect(relResB.status).toBe(200);
      expect(relResB.body.isDisputeHoldActive).toBe(false);

      // Order now has no active holds
      refreshedOrder = await Order.findById(order._id);
      expect(refreshedOrder.isDisputeHoldActive).toBe(false);
      expect(refreshedOrder.status).toBe("PENDING"); // Underlying status preserved as PENDING
    });
  });

  describe("5. Lifecycle Expiration Protection", () => {
    it("reconcilePaymentStates worker does NOT expire overdue PENDING orders under active dispute hold", async () => {
      const pastDeadline = new Date(Date.now() - 3600000); // 1 hour ago
      const heldOrder = await createTestOrder({
        title: "Order Under Dispute Hold",
        status: "PENDING",
        paymentDeadline: pastDeadline,
        isDisputeHoldActive: true,
      });

      const normalOrder = await createTestOrder({
        title: "Order Without Hold",
        status: "PENDING",
        paymentDeadline: pastDeadline,
        isDisputeHoldActive: false,
      });

      // Run reconciliation pass
      const result = await reconcilePaymentStates({ now: new Date() });

      // Normal order should expire
      const refreshedNormal = await Order.findById(normalOrder._id);
      expect(refreshedNormal.status).toBe("EXPIRED");

      // Held order must NOT expire
      const refreshedHeld = await Order.findById(heldOrder._id);
      expect(refreshedHeld.status).toBe("PENDING");
      expect(refreshedHeld.isDisputeHoldActive).toBe(true);
    });

    it("initiateOrderPayment rejects payment on hold with PAYMENT_HELD_FOR_DISPUTE without expiring order", async () => {
      const pastDeadline = new Date(Date.now() - 3600000);
      const winnerId = new mongoose.Types.ObjectId();
      const user = {
        _id: winnerId,
        email: "alice.buyer@example.com",
      };
      const heldOrder = await createTestOrder({
        winnerId,
        userEmail: user.email,
        status: "PENDING",
        paymentDeadline: pastDeadline,
        isDisputeHoldActive: true,
      });

      await expect(
        initiateOrderPayment({ orderId: heldOrder._id.toString(), user })
      ).rejects.toMatchObject({
        code: "PAYMENT_HELD_FOR_DISPUTE",
      });

      // Confirm order was NOT marked EXPIRED
      const refreshedHeld = await Order.findById(heldOrder._id);
      expect(refreshedHeld.status).toBe("PENDING");
    });
  });

  describe("6. Payment Capture Race Handling on Dispute Hold", () => {
    it("verifyPaymentSignature records valid payment but preserves active dispute hold", async () => {
      const winnerId = new mongoose.Types.ObjectId();
      const order = await createTestOrder({
        winnerId,
        status: "PENDING",
        finalPrice: 5000,
        isDisputeHoldActive: true,
        disputeHolds: [
          {
            holdId: "HOLD_RACE_TEST_01",
            caseId: new mongoose.Types.ObjectId(),
            reason: "Investigating buyer complaint",
            placedBy: { adminId: "admin_01", adminEmail: "admin@test.com", role: "admin" },
            placedAt: new Date(),
            status: "ACTIVE",
          },
        ],
      });

      // Create matching Payment record
      const payment = await Payment.create({
        orderId: order._id,
        productId: new mongoose.Types.ObjectId(),
        userId: winnerId,
        userEmail: order.userEmail,
        amount: 500000, // in paise
        currency: "INR",
        status: "INITIATED",
        razorpayOrderId: "order_mock_race_123",
        razorpayPaymentId: "pay_mock_race_123",
        type: "AUCTION_ORDER",
      });

      // Call payment settlement directly
      const settleRes = await settleOrderPayment({
        orderId: order._id,
        razorpayOrderId: "order_mock_race_123",
        razorpayPaymentId: "pay_mock_race_123",
        amountPaise: 500000,
        now: new Date(),
      });

      expect(settleRes.success).toBe(true);

      // Confirm Order was marked PAID, but dispute hold remained ACTIVE!
      const refreshedOrder = await Order.findById(order._id);
      expect(refreshedOrder.status).toBe("PAID");
      expect(refreshedOrder.isDisputeHoldActive).toBe(true);
      expect(refreshedOrder.disputeHolds[0].status).toBe("ACTIVE");
    });
  });

  describe("7. Durable Internal Investigation Notes", () => {
    it("should add a valid note and sanitize malicious script tags", async () => {
      const csrf = createCsrfCredentials();
      const report = await createTestReport();

      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/notes`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({
          content: "Spoke to courier service. <script>alert('xss')</script> Tracking confirms delivery attempt.",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.note.content).not.toContain("<script>");

      // Check DB persistence
      const savedNote = await AdminInternalNote.findOne({ caseId: report._id });
      expect(savedNote).toBeTruthy();
      expect(savedNote.content).not.toContain("<script>");
      expect(savedNote.authorEmail).toBe("lead_admin@auctionx.com");
    });

    it("should fetch all internal notes for a case via admin API", async () => {
      const report = await createTestReport();
      await AdminInternalNote.create([
        {
          caseId: report._id,
          authorId: "admin_1",
          authorEmail: "admin1@test.com",
          authorRole: "admin",
          content: "Initial review of submitted photos.",
        },
        {
          caseId: report._id,
          authorId: "admin_2",
          authorEmail: "admin2@test.com",
          authorRole: "admin",
          content: "Second opinion: box shows transit crushing.",
        },
      ]);

      const res = await request(app)
        .get(`/api/admin/disputes/${report._id}/notes`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.notes[0].content).toBeTruthy();
    });

    it("should mask author email when editor fetches internal notes", async () => {
      const report = await createTestReport();
      await AdminInternalNote.create({
        caseId: report._id,
        authorId: "admin_1",
        authorEmail: "confidential_investigator@auctionx.com",
        authorRole: "superadmin",
        content: "Internal risk assessment report.",
      });

      const res = await request(app)
        .get(`/api/admin/disputes/${report._id}/notes`)
        .set("Cookie", [`adminToken=${editorToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.notes[0].authorEmail).toMatch(/co\*\*\*@auctionx\.com/);
    });
  });

  describe("8. Audit Trail Verification & Zero-Mutation Guarantees", () => {
    it("creates durable AdminAuditLog entries for PLACE_DISPUTE_HOLD and RELEASE_DISPUTE_HOLD", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });

      // Place hold
      await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Audit verification hold reason" });

      const placeAudit = await AdminAuditLog.findOne({
        targetAccountId: order._id.toString(),
        action: "PLACE_DISPUTE_HOLD",
      });
      expect(placeAudit).toBeTruthy();
      expect(placeAudit.outcome).toBe("SUCCESS");
      expect(placeAudit.reason).toBe("Audit verification hold reason");

      // Release hold
      await request(app)
        .post(`/api/admin/disputes/${report._id}/release-hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ releaseReason: "Audit verification release reason" });

      const releaseAudit = await AdminAuditLog.findOne({
        targetAccountId: order._id.toString(),
        action: "RELEASE_DISPUTE_HOLD",
      });
      expect(releaseAudit).toBeTruthy();
      expect(releaseAudit.outcome).toBe("SUCCESS");
      expect(releaseAudit.reason).toBe("Audit verification release reason");
    });
  });

  describe("9. Concurrency & Racing Invariants (Single-Document Atomic Updates)", () => {
    it("prevents stale isDisputeHoldActive when release races concurrently with another case's hold placement", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder({ status: "PENDING" });
      const reportA = await createTestReport({ orderId: order._id.toString(), report: "Case A: Defective battery" });
      const reportB = await createTestReport({ orderId: order._id.toString(), report: "Case B: Scratched bezel" });

      // Step 1: Place Hold A initially
      const holdResA = await request(app)
        .post(`/api/admin/disputes/${reportA._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Hold for Case A" });
      expect(holdResA.status).toBe(200);

      // Step 2: Concurrently execute Release of Hold A AND Placement of Hold B
      const [releaseResA, placeResB] = await Promise.all([
        request(app)
          .post(`/api/admin/disputes/${reportA._id}/release-hold`)
          .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
          .set(csrf.headerName, csrf.headerValue)
          .send({ releaseReason: "Case A resolved with partial store voucher" }),
        request(app)
          .post(`/api/admin/disputes/${reportB._id}/hold`)
          .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
          .set(csrf.headerName, csrf.headerValue)
          .send({ reason: "Hold for Case B" }),
      ]);

      expect(releaseResA.status).toBe(200);
      expect(placeResB.status).toBe(200);

      // Step 3: Check authoritative order state in DB
      const refreshedOrder = await Order.findById(order._id);
      expect(refreshedOrder).toBeTruthy();

      // Case A must be RELEASED, Case B must be ACTIVE
      const holdA = refreshedOrder.disputeHolds.find((h) => h.caseId.toString() === reportA._id.toString());
      const holdB = refreshedOrder.disputeHolds.find((h) => h.caseId.toString() === reportB._id.toString());
      expect(holdA.status).toBe("RELEASED");
      expect(holdB.status).toBe("ACTIVE");

      // Critical invariant: isDisputeHoldActive MUST be TRUE because Hold B is active!
      expect(refreshedOrder.isDisputeHoldActive).toBe(true);
    });

    it("handles two distinct cases holding the same order and releases them sequentially", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder({ status: "PENDING" });
      const report1 = await createTestReport({ orderId: order._id.toString(), report: "Dispute case report 1" });
      const report2 = await createTestReport({ orderId: order._id.toString(), report: "Dispute case report 2" });

      // Place hold 1
      await request(app)
        .post(`/api/admin/disputes/${report1._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Hold from Dispute 1" });

      // Place hold 2
      await request(app)
        .post(`/api/admin/disputes/${report2._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Hold from Dispute 2" });

      let currentOrder = await Order.findById(order._id);
      expect(currentOrder.disputeHolds.length).toBe(2);
      expect(currentOrder.isDisputeHoldActive).toBe(true);

      // Release hold 1: hold 2 is still active, so isDisputeHoldActive must remain true
      const rel1 = await request(app)
        .post(`/api/admin/disputes/${report1._id}/release-hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ releaseReason: "Resolved dispute 1" });

      expect(rel1.status).toBe(200);
      expect(rel1.body.isDisputeHoldActive).toBe(true);

      currentOrder = await Order.findById(order._id);
      expect(currentOrder.isDisputeHoldActive).toBe(true);

      // Release hold 2: no active holds remain, so isDisputeHoldActive must become false
      const rel2 = await request(app)
        .post(`/api/admin/disputes/${report2._id}/release-hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ releaseReason: "Resolved dispute 2" });

      expect(rel2.status).toBe(200);
      expect(rel2.body.isDisputeHoldActive).toBe(false);

      currentOrder = await Order.findById(order._id);
      expect(currentOrder.isDisputeHoldActive).toBe(false);
    });

    it("supports duplicate release retries via idempotencyKey without double-releasing or error", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder({ status: "PENDING" });
      const report = await createTestReport({ orderId: order._id.toString() });
      const idempotencyKey = "IDEM_RELEASE_TEST_101";

      // Place hold
      await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Initial hold for idempotency test" });

      // First release
      const rel1 = await request(app)
        .post(`/api/admin/disputes/${report._id}/release-hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ releaseReason: "First release attempt", idempotencyKey });

      expect(rel1.status).toBe(200);
      expect(rel1.body.success).toBe(true);

      // Retry release with same idempotencyKey
      const rel2 = await request(app)
        .post(`/api/admin/disputes/${report._id}/release-hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ releaseReason: "First release attempt", idempotencyKey });

      expect(rel2.status).toBe(200);
      expect(rel2.body.isReplay).toBe(true);

      // Third release with different or missing idempotencyKey returns 404
      const rel3 = await request(app)
        .post(`/api/admin/disputes/${report._id}/release-hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ releaseReason: "Third release attempt without same key" });

      expect(rel3.status).toBe(404);
      expect(rel3.body.message).toMatch(/no active dispute hold found/i);
    });
  });

  describe("10. Lifecycle & Payment Mutation Pathways Verification", () => {
    it("blocks initiateOrderPayment when isDisputeHoldActive is true BEFORE the 24h deadline arrives", async () => {
      const winnerId = new mongoose.Types.ObjectId();
      const user = { _id: winnerId, email: "alice.buyer@example.com" };
      const futureDeadline = new Date(Date.now() + 20 * 60 * 60 * 1000); // 20 hours in future

      const heldOrder = await createTestOrder({
        winnerId,
        userEmail: user.email,
        status: "PENDING",
        paymentDeadline: futureDeadline,
        isDisputeHoldActive: true,
      });

      // Attempt payment initiation before deadline
      await expect(
        initiateOrderPayment({ orderId: heldOrder._id.toString(), user, now: new Date() })
      ).rejects.toMatchObject({
        code: "PAYMENT_HELD_FOR_DISPUTE",
        statusCode: 400,
      });

      // Confirm order remains PENDING and held
      const refreshed = await Order.findById(heldOrder._id);
      expect(refreshed.status).toBe("PENDING");
      expect(refreshed.isDisputeHoldActive).toBe(true);
    });

    it("settleOrderPayment successfully records valid capture under hold without releasing the hold", async () => {
      const winnerId = new mongoose.Types.ObjectId();
      const order = await createTestOrder({
        winnerId,
        status: "PENDING",
        finalPrice: 8000,
        isDisputeHoldActive: true,
        disputeHolds: [
          {
            holdId: "HOLD_PAY_CAPTURE_01",
            caseId: new mongoose.Types.ObjectId(),
            reason: "Investigating buyer complaint",
            placedBy: { adminId: "admin_01", adminEmail: "admin@test.com", role: "admin" },
            placedAt: new Date(),
            status: "ACTIVE",
          },
        ],
      });

      await Payment.create({
        orderId: order._id,
        productId: new mongoose.Types.ObjectId(),
        userId: winnerId,
        userEmail: order.userEmail,
        amount: 800000,
        currency: "INR",
        status: "INITIATED",
        razorpayOrderId: "order_webhook_race_999",
        razorpayPaymentId: "pay_webhook_race_999",
        type: "AUCTION_ORDER",
      });

      const settleRes = await settleOrderPayment({
        orderId: order._id,
        razorpayOrderId: "order_webhook_race_999",
        razorpayPaymentId: "pay_webhook_race_999",
        amountPaise: 800000,
        now: new Date(),
      });

      expect(settleRes.success).toBe(true);

      const refreshed = await Order.findById(order._id);
      expect(refreshed.status).toBe("PAID");
      expect(refreshed.isDisputeHoldActive).toBe(true);
      expect(refreshed.disputeHolds[0].status).toBe("ACTIVE");
    });

    it("duplicate webhook payment capture under hold returns alreadyPaid without altering hold state", async () => {
      const winnerId = new mongoose.Types.ObjectId();
      const order = await createTestOrder({
        winnerId,
        status: "PAID",
        finalPrice: 4000,
        razorpayOrderId: "order_dup_webhook_888",
        razorpayPaymentId: "pay_dup_webhook_888",
        isDisputeHoldActive: true,
        disputeHolds: [
          {
            holdId: "HOLD_WEBHOOK_DUP_01",
            caseId: new mongoose.Types.ObjectId(),
            reason: "Active investigation on paid item",
            placedBy: { adminId: "admin_01", adminEmail: "admin@test.com", role: "admin" },
            placedAt: new Date(),
            status: "ACTIVE",
          },
        ],
      });

      await Payment.create({
        orderId: order._id,
        productId: new mongoose.Types.ObjectId(),
        userId: winnerId,
        userEmail: order.userEmail,
        amount: 400000,
        currency: "INR",
        status: "CAPTURED",
        razorpayOrderId: "order_dup_webhook_888",
        razorpayPaymentId: "pay_dup_webhook_888",
        type: "AUCTION_ORDER",
      });

      // Replay identical webhook event
      const replayRes = await settleOrderPayment({
        orderId: order._id,
        razorpayOrderId: "order_dup_webhook_888",
        razorpayPaymentId: "pay_dup_webhook_888",
        amountPaise: 400000,
        now: new Date(),
      });

      expect(replayRes.success).toBe(true);
      expect(replayRes.alreadyPaid).toBe(true);

      const refreshed = await Order.findById(order._id);
      expect(refreshed.status).toBe("PAID");
      expect(refreshed.isDisputeHoldActive).toBe(true);
    });

    it("quarantines late payments after deadline expiration on unheld orders without un-expiring the order", async () => {
      const winnerId = new mongoose.Types.ObjectId();
      const pastDeadline = new Date(Date.now() - 7200000); // 2 hours ago
      const expiredOrder = await createTestOrder({
        winnerId,
        status: "EXPIRED",
        finalPrice: 6000,
        paymentDeadline: pastDeadline,
        isDisputeHoldActive: false,
      });

      await Payment.create({
        orderId: expiredOrder._id,
        productId: expiredOrder.productId || new mongoose.Types.ObjectId(),
        userId: winnerId,
        userEmail: expiredOrder.userEmail,
        amount: 600000,
        currency: "INR",
        status: "INITIATED",
        razorpayOrderId: "order_late_expired_777",
        type: "AUCTION_ORDER",
      });

      await expect(
        settleOrderPayment({
          orderId: expiredOrder._id,
          razorpayOrderId: "order_late_expired_777",
          razorpayPaymentId: "pay_late_expired_777",
          amountPaise: 600000,
          now: new Date(),
        })
      ).rejects.toMatchObject({
        code: "LATE_PAYMENT_QUARANTINED",
      });

      // Verify payment was quarantined as REQUIRES_RECONCILIATION
      const quarantinedPayment = await Payment.findOne({ razorpayOrderId: "order_late_expired_777" });
      expect(quarantinedPayment.status).toBe("REQUIRES_RECONCILIATION");

      // Verify order status remains EXPIRED
      const refreshedOrder = await Order.findById(expiredOrder._id);
      expect(refreshedOrder.status).toBe("EXPIRED");
    });
  });

  describe("11. Audit Log Failure, Crash Recovery & Compensating Rollback", () => {
    it("rejects hold with 500 when audit intent creation fails and leaves order unchanged", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });

      // Mock AdminAuditLog save to fail on Phase 1
      const saveSpy = jest.spyOn(AdminAuditLog.prototype, "save").mockRejectedValueOnce(
        new Error("Database write timeout on audit log collection")
      );

      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Testing audit failure" });

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/failed to initialize audit record/i);

      // Verify order was not modified
      const refreshed = await Order.findById(order._id);
      expect(refreshed.isDisputeHoldActive).toBe(false);
      expect(refreshed.disputeHolds.length).toBe(0);

      saveSpy.mockRestore();
    });

    it("triggers compensating rollback when audit finalization fails in placeDisputeHold", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });

      const originalSave = AdminAuditLog.prototype.save;
      let callCount = 0;
      const saveSpy = jest.spyOn(AdminAuditLog.prototype, "save").mockImplementation(function (...args) {
        callCount++;
        if (callCount === 2) {
          // Phase 3 finalization save throws error
          return Promise.reject(new Error("Audit finalization disk write failed"));
        }
        return originalSave.apply(this, args);
      });

      try {
        const res = await request(app)
          .post(`/api/admin/disputes/${report._id}/hold`)
          .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
          .set(csrf.headerName, csrf.headerValue)
          .send({ reason: "Testing rollback on finalization failure" });

        expect(res.status).toBe(500);
        expect(res.body.message).toMatch(/rolled back to maintain consistency/i);

        // Verify compensating rollback removed the hold
        const refreshed = await Order.findById(order._id);
        expect(refreshed.isDisputeHoldActive).toBe(false);
        expect(refreshed.disputeHolds.length).toBe(0);
      } finally {
        saveSpy.mockRestore();
      }
    });

    it("marks audit log RECONCILIATION_REQUIRED when both finalization and rollback fail in placeDisputeHold", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });

      const originalSave = AdminAuditLog.prototype.save;
      let callCount = 0;
      const saveSpy = jest.spyOn(AdminAuditLog.prototype, "save").mockImplementation(function (...args) {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error("Audit finalization failure"));
        }
        return originalSave.apply(this, args);
      });

      // Also force Order.findOneAndUpdate to fail during rollback
      const originalFindOneAndUpdate = Order.findOneAndUpdate.bind(Order);
      let orderUpdateCount = 0;
      const updateSpy = jest.spyOn(Order, "findOneAndUpdate").mockImplementation((...args) => {
        orderUpdateCount++;
        if (orderUpdateCount === 2) {
          // Rollback update fails
          return Promise.reject(new Error("Network partitioned during rollback"));
        }
        return originalFindOneAndUpdate(...args);
      });

      try {
        const res = await request(app)
          .post(`/api/admin/disputes/${report._id}/hold`)
          .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
          .set(csrf.headerName, csrf.headerValue)
          .send({ reason: "Testing double failure leading to reconciliation" });

        expect(res.status).toBe(500);
        expect(res.body.reconciliationRequired).toBe(true);

        const auditLog = await AdminAuditLog.findOne({
          targetAccountId: order._id.toString(),
          action: "PLACE_DISPUTE_HOLD",
        });
        expect(auditLog).not.toBeNull();
        expect(auditLog.outcome).toBe("RECONCILIATION_REQUIRED");
      } finally {
        saveSpy.mockRestore();
        updateSpy.mockRestore();
      }
    });

    it("marks audit log RECONCILIATION_REQUIRED and returns 500 when finalization fails in releaseDisputeHold", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });

      // First place a hold
      await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Place hold prior to release failure test" });

      // Mock save to fail during release finalization (Phase 3)
      const originalSave = AdminAuditLog.prototype.save;
      let callCount = 0;
      const saveSpy = jest.spyOn(AdminAuditLog.prototype, "save").mockImplementation(function (...args) {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error("Release finalization disk write failed"));
        }
        return originalSave.apply(this, args);
      });

      try {
        const res = await request(app)
          .post(`/api/admin/disputes/${report._id}/release-hold`)
          .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
          .set(csrf.headerName, csrf.headerValue)
          .send({ releaseReason: "Testing release finalization failure" });

        expect(res.status).toBe(500);
        expect(res.body.reconciliationRequired).toBe(true);

        const releaseAudit = await AdminAuditLog.findOne({
          targetAccountId: order._id.toString(),
          action: "RELEASE_DISPUTE_HOLD",
        });
        expect(releaseAudit).not.toBeNull();
        expect(releaseAudit.outcome).toBe("RECONCILIATION_REQUIRED");
      } finally {
        saveSpy.mockRestore();
      }
    });

    it("self-heals ambiguous PENDING audit log on retry when hold was persisted prior to crash", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });
      const idempotencyKey = "CRASH_RECOVER_KEY_123";

      // Simulate a process crash: hold was placed in order, but audit log remained in PENDING
      const holdId = `HOLD_${report._id}_crash`;
      await Order.updateOne(
        { _id: order._id },
        {
          $push: {
            disputeHolds: {
              holdId,
              caseId: report._id,
              reason: "Crash simulation hold",
              placedBy: { adminId: "admin_1", adminEmail: "lead_admin@auctionx.com", role: "admin" },
              placedAt: new Date(),
              status: "ACTIVE",
            },
          },
          $set: { isDisputeHoldActive: true },
        }
      );

      await AdminAuditLog.create({
        idempotencyKey: `HOLD_${report._id}_${order._id}_${idempotencyKey}`,
        actingAdminId: "admin_1",
        actingAdminEmail: "lead_admin@auctionx.com",
        actingAdminModel: "Admin",
        actingAdminRole: "admin",
        targetAccountId: order._id.toString(),
        targetAccountEmail: order.userEmail,
        targetAccountType: "order",
        action: "PLACE_DISPUTE_HOLD",
        reason: "Crash simulation hold",
        beforeStatus: "PENDING",
        afterStatus: "PENDING",
        outcome: "PENDING",
        metadata: { caseId: report._id.toString(), orderId: order._id.toString() },
      });

      // Client retries with same idempotencyKey
      const retryRes = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Crash simulation hold", idempotencyKey });

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.isReplay).toBe(true);

      // Audit log must have been transitioned to SUCCESS
      const recoveredAudit = await AdminAuditLog.findOne({
        idempotencyKey: `HOLD_${report._id}_${order._id}_${idempotencyKey}`,
      });
      expect(recoveredAudit.outcome).toBe("SUCCESS");
      expect(recoveredAudit.metadata.recoveredFromAmbiguousState).toBe(true);
    });

    it("rejects retry with 409 Conflict when prior operation was flagged RECONCILIATION_REQUIRED", async () => {
      const csrf = createCsrfCredentials();
      const order = await createTestOrder();
      const report = await createTestReport({ orderId: order._id.toString() });
      const idempotencyKey = "RECON_REQUIRED_KEY_999";

      await AdminAuditLog.create({
        idempotencyKey: `HOLD_${report._id}_${order._id}_${idempotencyKey}`,
        actingAdminId: "admin_1",
        actingAdminEmail: "lead_admin@auctionx.com",
        actingAdminModel: "Admin",
        actingAdminRole: "admin",
        targetAccountId: order._id.toString(),
        targetAccountEmail: order.userEmail,
        targetAccountType: "order",
        action: "PLACE_DISPUTE_HOLD",
        reason: "Failed attempt requiring reconciliation",
        beforeStatus: "PENDING",
        afterStatus: "PENDING",
        outcome: "RECONCILIATION_REQUIRED",
        failureReason: "FATAL: Manual intervention required",
      });

      const res = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Retry of reconciliation key", idempotencyKey });

      expect(res.status).toBe(409);
      expect(res.body.reconciliationRequired).toBe(true);
      expect(res.body.message).toMatch(/requires administrative reconciliation/i);
    });
  });

  describe("12. Internal Investigation Notes Security & XSS Defense", () => {
    it("sanitizes various XSS payloads including img onerror, svg onload, and script tags", async () => {
      const csrf = createCsrfCredentials();
      const report = await createTestReport();

      const xssPayloads = [
        "<script>alert(document.cookie)</script>Investigated suspicious buyer address",
        "<img src=x onerror=alert('xss')>Reviewed courier logs",
        "<svg/onload=alert('svg')>Spoke with seller",
        "Control chars: \x00\x08Legitimate investigation notes",
      ];

      for (const payload of xssPayloads) {
        const res = await request(app)
          .post(`/api/admin/disputes/${report._id}/notes`)
          .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
          .set(csrf.headerName, csrf.headerValue)
          .send({ content: payload });

        expect(res.status).toBe(201);
        expect(res.body.note.content).not.toContain("<script>");
        expect(res.body.note.content).not.toContain("onerror=");
        expect(res.body.note.content).not.toContain("<svg");
        expect(res.body.note.content).not.toContain("\x00");
      }
    });

    it("rejects invalid note requests: non-existent case, bad ObjectId, or length violations", async () => {
      const csrf = createCsrfCredentials();
      const report = await createTestReport();
      const fakeId = new mongoose.Types.ObjectId().toString();

      // Bad ObjectId
      const resBadId = await request(app)
        .post("/api/admin/disputes/not-a-valid-id/notes")
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ content: "Valid note text" });
      expect(resBadId.status).toBe(400);

      // Non-existent report
      const resNonExistent = await request(app)
        .post(`/api/admin/disputes/${fakeId}/notes`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ content: "Valid note text" });
      expect(resNonExistent.status).toBe(404);

      // Too short (< 3 chars)
      const resShort = await request(app)
        .post(`/api/admin/disputes/${report._id}/notes`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ content: "ab" });
      expect(resShort.status).toBe(400);

      // Too long (> 2000 chars)
      const resLong = await request(app)
        .post(`/api/admin/disputes/${report._id}/notes`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ content: "a".repeat(2001) });
      expect(resLong.status).toBe(400);
    });
  });

  describe("13. Backward Compatibility for Legacy Orders Missing Dispute-Hold Fields", () => {
    it("places dispute hold on legacy order document missing disputeHolds and isDisputeHoldActive fields", async () => {
      const csrf = createCsrfCredentials();
      // Create order directly using raw mongodb to bypass mongoose schema defaults
      const legacyOrderId = new mongoose.Types.ObjectId();
      await Order.collection.insertOne({
        _id: legacyOrderId,
        title: "Legacy Vintage Camera",
        name: "Legacy Buyer",
        userEmail: "legacy.buyer@example.com",
        sellerEmail: "legacy.seller@example.com",
        category: "Cameras",
        images: [{ secure_url: "https://example.com/cam.jpg", public_id: "cam_01" }],
        biddingStartPrice: 2000,
        highestBid: 4500,
        finalPrice: 4500,
        phoneNo: "9876543210",
        address: "Legacy St, Mumbai",
        status: "PENDING",
        paymentDeadline: new Date(Date.now() + 86400000),
        // NOTE: No disputeHolds or isDisputeHoldActive fields!
      });

      const report = await createTestReport({ orderId: legacyOrderId.toString() });

      // Place dispute hold on legacy order
      const holdRes = await request(app)
        .post(`/api/admin/disputes/${report._id}/hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ reason: "Hold placed on legacy order" });

      expect(holdRes.status).toBe(200);
      expect(holdRes.body.order.isDisputeHoldActive).toBe(true);

      const refreshed = await Order.findById(legacyOrderId);
      expect(refreshed.isDisputeHoldActive).toBe(true);
      expect(refreshed.disputeHolds.length).toBe(1);
      expect(refreshed.disputeHolds[0].status).toBe("ACTIVE");

      // Release dispute hold on legacy order
      const relRes = await request(app)
        .post(`/api/admin/disputes/${report._id}/release-hold`)
        .set("Cookie", [csrf.cookie, `adminToken=${adminToken}`])
        .set(csrf.headerName, csrf.headerValue)
        .send({ releaseReason: "Hold released on legacy order" });

      expect(relRes.status).toBe(200);
      expect(relRes.body.isDisputeHoldActive).toBe(false);

      const refreshedAfterRelease = await Order.findById(legacyOrderId);
      expect(refreshedAfterRelease.isDisputeHoldActive).toBe(false);
      expect(refreshedAfterRelease.disputeHolds[0].status).toBe("RELEASED");
    });

    it("reconcilePaymentStates worker safely expires overdue legacy orders without dispute-hold fields", async () => {
      const legacyOrderId = new mongoose.Types.ObjectId();
      await Order.collection.insertOne({
        _id: legacyOrderId,
        title: "Overdue Legacy Item",
        name: "Legacy Buyer",
        userEmail: "legacy.buyer@example.com",
        sellerEmail: "legacy.seller@example.com",
        category: "General",
        images: [{ secure_url: "https://example.com/item.jpg", public_id: "it_01" }],
        biddingStartPrice: 1000,
        phoneNo: "9876543210",
        address: "Address",
        status: "PENDING",
        paymentDeadline: new Date(Date.now() - 3600000), // 1 hour overdue
      });

      await reconcilePaymentStates({ now: new Date() });

      const refreshed = await Order.findById(legacyOrderId);
      expect(refreshed.status).toBe("EXPIRED");
    });
  });
});

