const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../../server");
const { clearDatabase } = require("../../helpers/dbHelper");
const {
  createTestUser,
  createTestSeller,
  createTestAdmin,
} = require("../../helpers/authHelper");

const ReportAdmin = require("../../../src/modules/admin/moderation/models/reports");
const Product = require("../../../src/modules/products/models/productSchema");
const Bid = require("../../../src/modules/bidding/models/bidSchema");
const Order = require("../../../src/modules/orders/models/orderSchema");
const Payment = require("../../../src/modules/payments/models/Payment");
const AdminAuditLog = require("../../../src/modules/admin/disputes/models/adminAuditLog");

// Helper to create a test report/dispute
const createTestReport = async (overrides = {}) => {
  const report = new ReportAdmin({
    userName: overrides.userName || "Alice Complainant",
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

// Helper to create a test product
const createTestProduct = async (overrides = {}) => {
  const now = new Date();
  const product = new Product({
    name: overrides.name || "Vintage Chronograph Watch",
    description: overrides.description || [
      { name: "Condition", description: "Mint condition collector watch" },
    ],
    email: overrides.email || "seller.antique@domain.com",
    category: overrides.category || "Watches",
    images: overrides.images || [
      { secure_url: "https://example.com/watch.jpg", public_id: "watch_01" },
    ],
    mobileNumber: overrides.mobileNumber || "9876543210",
    biddingStartDate: overrides.biddingStartDate || new Date(now.getTime() - 3600000),
    biddingStartTime: overrides.biddingStartTime || "10:00",
    biddingStartPrice: overrides.biddingStartPrice || 1000,
    biddingEndTime: overrides.biddingEndTime || "18:00",
    startingPrice: overrides.startingPrice || 1000,
    currentPrice: overrides.currentPrice || 3500,
    bidCount: overrides.bidCount || 2,
    status: overrides.status || "ENDED",
    startTime: overrides.startTime || new Date(now.getTime() - 7200000),
    endTime: overrides.endTime || new Date(now.getTime() - 3600000),
    originalEndTime: overrides.originalEndTime || new Date(now.getTime() - 3600000),
    ...overrides,
  });
  return await product.save();
};

// Helper to create a test order
const createTestOrder = async (overrides = {}) => {
  const now = new Date();
  const order = new Order({
    title: overrides.title || "Vintage Chronograph Watch",
    name: overrides.name || "Alice Complainant",
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
    status: overrides.status || "PAID",
    paymentDeadline: overrides.paymentDeadline || new Date(now.getTime() + 24 * 60 * 60 * 1000),
    paidAt: overrides.paidAt || now,
    ...overrides,
  });
  return await order.save();
};

describe("Admin Stage 6 — Disputes & Resolution Management Integration Tests", () => {
  beforeEach(async () => {
    await clearDatabase();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. Authentication & Role-Based Access Enforcement
  // =========================================================================
  describe("1. Authentication & Role-Based Access Enforcement", () => {
    it("should reject unauthenticated requests to disputes operations with 401", async () => {
      const res = await request(app).get("/api/admin/disputes");
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject ordinary users from accessing disputes operations with 403", async () => {
      const { token } = await createTestUser();
      const res = await request(app)
        .get("/api/admin/disputes")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should reject sellers from accessing disputes operations with 403", async () => {
      const { token } = await createTestSeller();
      const res = await request(app)
        .get("/api/admin/disputes")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should allow verified administrators to access disputes directory with 200", async () => {
      const { token } = await createTestAdmin({ role: "admin" });
      const res = await request(app)
        .get("/api/admin/disputes")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.disputes)).toBe(true);
    });

    it("should allow editor role (read-only) to access disputes operations with 200", async () => {
      const { token } = await createTestAdmin({ role: "editor" });
      const res = await request(app)
        .get("/api/admin/disputes")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // 2. Directory Pagination, Multi-Filter, Search & Sorting
  // =========================================================================
  describe("2. Directory Pagination, Multi-Filter, Search & Sorting", () => {
    it("should paginate correctly with bounded limits", async () => {
      const { token } = await createTestAdmin();

      // Seed 12 dispute cases
      for (let i = 1; i <= 12; i++) {
        await createTestReport({
          userName: `User #${i}`,
          userEmail: `user${i}@example.com`,
          report: `Complaint narrative for case #${i} with sufficient text length`,
        });
      }

      const res = await request(app)
        .get("/api/admin/disputes?page=2&limit=5")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.disputes.length).toBe(5);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.total).toBe(12);
      expect(res.body.pagination.totalPages).toBe(3);
    });

    it("should filter cases by status (pending vs in-progress vs resolved)", async () => {
      const { token } = await createTestAdmin();

      await createTestReport({ reportType: "delivery", status: "pending", report: "Pending delivery grievance" });
      await createTestReport({ reportType: "delivery", status: "resolved", report: "Resolved delivery grievance", resolutionNote: "Refund processed offline" });

      const resPending = await request(app)
        .get("/api/admin/disputes?status=pending")
        .set("Cookie", [`adminToken=${token}`]);

      expect(resPending.statusCode).toBe(200);
      expect(resPending.body.disputes.length).toBe(1);
      expect(resPending.body.disputes[0].status).toBe("pending");

      const resResolved = await request(app)
        .get("/api/admin/disputes?status=resolved")
        .set("Cookie", [`adminToken=${token}`]);

      expect(resResolved.statusCode).toBe(200);
      expect(resResolved.body.disputes.length).toBe(1);
      expect(resResolved.body.disputes[0].status).toBe("resolved");
    });

    it("should filter cases by category (delivery vs payment-deposit vs illegal)", async () => {
      const { token } = await createTestAdmin();

      await createTestReport({ reportType: "delivery", report: "Item failed to arrive after 10 days" });
      await createTestReport({ reportType: "payment-deposit", report: "Wallet balance did not update after deposit" });
      await createTestReport({ reportType: "illegal", report: "Suspected counterfeit handbag listed" });

      const resDelivery = await request(app)
        .get("/api/admin/disputes?category=delivery")
        .set("Cookie", [`adminToken=${token}`]);

      expect(resDelivery.statusCode).toBe(200);
      expect(resDelivery.body.disputes.length).toBe(1);
      expect(resDelivery.body.disputes[0].reportType).toBe("delivery");
      expect(resDelivery.body.disputes[0].caseCategory).toBe("ORDER_DELIVERY_DISPUTE");

      const resPayment = await request(app)
        .get("/api/admin/disputes?category=payment-deposit")
        .set("Cookie", [`adminToken=${token}`]);

      expect(resPayment.statusCode).toBe(200);
      expect(resPayment.body.disputes.length).toBe(1);
      expect(resPayment.body.disputes[0].reportType).toBe("payment-deposit");
      expect(resPayment.body.disputes[0].caseCategory).toBe("PAYMENT_TRANSACTION_DISPUTE");
    });

    it("should search across complaint text, userEmail, sellerEmail, and exact ObjectId", async () => {
      const { token } = await createTestAdmin();

      const rep1 = await createTestReport({
        report: "Extremely damaged antique crystal chandelier during transit",
        userEmail: "chandelier.buyer@luxury.com",
      });
      await createTestReport({
        report: "Defective digital camera sensor",
        userEmail: "photographer@lens.com",
      });

      // Search by text
      const resText = await request(app)
        .get("/api/admin/disputes?search=chandelier")
        .set("Cookie", [`adminToken=${token}`]);
      expect(resText.body.disputes.length).toBe(1);
      expect(resText.body.disputes[0].id).toBe(rep1._id.toString());

      // Search by exact ObjectId
      const resId = await request(app)
        .get(`/api/admin/disputes?search=${rep1._id.toString()}`)
        .set("Cookie", [`adminToken=${token}`]);
      expect(resId.body.disputes.length).toBe(1);
      expect(resId.body.disputes[0].id).toBe(rep1._id.toString());
    });
  });

  // =========================================================================
  // 3. Role-Based Information Protection & PII Masking
  // =========================================================================
  describe("3. Role-Based Information Protection & PII Masking", () => {
    it("masks sensitive email and reporter name when accessed by editor role", async () => {
      const { token: editorToken } = await createTestAdmin({ role: "editor" });

      const report = await createTestReport({
        userName: "Charlotte Bronte",
        userEmail: "charlotte.buyer@estate.com",
        sellerEmail: "victorian.seller@antiques.co.uk",
        report: "Seller sent replica instead of original first edition book.",
      });

      const res = await request(app)
        .get(`/api/admin/disputes/${report._id}`)
        .set("Cookie", [`adminToken=${editorToken}`]);

      expect(res.statusCode).toBe(200);
      const { reporter, seller } = res.body.data.case;

      expect(reporter.email).toBe("ch***@estate.com");
      expect(reporter.name).toBe("C***");
      expect(seller.email).toBe("vi***@antiques.co.uk");
    });

    it("displays unmasked operational information to full admin role", async () => {
      const { token: adminToken } = await createTestAdmin({ role: "admin" });

      const report = await createTestReport({
        userName: "Charlotte Bronte",
        userEmail: "charlotte.buyer@estate.com",
        sellerEmail: "victorian.seller@antiques.co.uk",
        report: "Seller sent replica instead of original first edition book.",
      });

      const res = await request(app)
        .get(`/api/admin/disputes/${report._id}`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      const { reporter, seller } = res.body.data.case;

      expect(reporter.email).toBe("charlotte.buyer@estate.com");
      expect(reporter.name).toBe("Charlotte Bronte");
      expect(seller.email).toBe("victorian.seller@antiques.co.uk");
    });
  });

  // =========================================================================
  // 4. Distinction Between Listing Reports and Order/Payment Disputes
  // =========================================================================
  describe("4. Distinction Between Listing Reports and Order/Payment Disputes", () => {
    it("correctly identifies case categories and distinguishes listing violations from order disputes", async () => {
      const { token } = await createTestAdmin();

      const deliveryRep = await createTestReport({ reportType: "delivery", report: "Delivery package missing contents" });
      const paymentRep = await createTestReport({ reportType: "payment-withdraw", report: "Withdrawal not credited" });
      const listingRep = await createTestReport({ reportType: "illegal", report: "Listing contains copyrighted media" });

      const res = await request(app)
        .get("/api/admin/disputes")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      const items = res.body.disputes;

      const deliveryItem = items.find((i) => i.id === deliveryRep._id.toString());
      const paymentItem = items.find((i) => i.id === paymentRep._id.toString());
      const listingItem = items.find((i) => i.id === listingRep._id.toString());

      expect(deliveryItem.caseCategory).toBe("ORDER_DELIVERY_DISPUTE");
      expect(paymentItem.caseCategory).toBe("PAYMENT_TRANSACTION_DISPUTE");
      expect(listingItem.caseCategory).toBe("LISTING_MODERATION_REPORT");
    });
  });

  // =========================================================================
  // 5. Cross-Model Linking to Orders, Auctions, Bids, and Payments
  // =========================================================================
  describe("5. Cross-Model Linking to Orders, Auctions, Bids, and Payments", () => {
    it("correctly cross-references linked order, parent auction, winning bid, and payment records", async () => {
      const { token } = await createTestAdmin();

      const product = await createTestProduct({ name: "Vintage Rolex Submariner" });
      const order = await createTestOrder({
        productId: product._id,
        finalPrice: 120000,
        title: product.name,
      });

      // Seed authoritative accepted bid
      await Bid.create({
        productId: product._id,
        bidder: new mongoose.Types.ObjectId(),
        bidderEmail: "submariner.collector@watchclub.com",
        bidderName: "Submariner Collector",
        amount: 120000,
        status: "ACCEPTED",
        idempotencyKey: "bid_rolex_win",
      });

      // Seed payment record
      await Payment.create({
        orderId: order._id,
        productId: product._id,
        userId: new mongoose.Types.ObjectId(),
        userEmail: "submariner.collector@watchclub.com",
        amount: 12000000,
        status: "CAPTURED",
        razorpayOrderId: "order_rzp_rolex",
        razorpayPaymentId: "pay_rzp_rolex",
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      // Report filed against this order and product
      const report = await createTestReport({
        orderId: order._id.toString(),
        productId: product._id,
        reportType: "delivery",
        report: "Watch bezel was scratched upon unboxing, contrary to mint condition listing.",
      });

      const res = await request(app)
        .get(`/api/admin/disputes/${report._id}`)
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      const { data } = res.body;

      // Case info
      expect(data.case.id).toBe(report._id.toString());
      expect(data.case.reportType).toBe("delivery");

      // Linked Order
      expect(data.order).toBeDefined();
      expect(data.order.id).toBe(order._id.toString());
      expect(data.order.finalPrice).toBe(120000);
      expect(data.order.status).toBe("PAID");

      // Linked Auction
      expect(data.auction).toBeDefined();
      expect(data.auction.id).toBe(product._id.toString());
      expect(data.auction.name).toBe("Vintage Rolex Submariner");

      // Bids
      expect(data.topBids.length).toBe(1);
      expect(data.topBids[0].amount).toBe(120000);

      // Payments
      expect(data.payments.length).toBe(1);
      expect(data.payments[0].status).toBe("CAPTURED");
      expect(data.payments[0].amountInRupees).toBe(120000);
    });
  });

  // =========================================================================
  // 6. Evidence Attachments & Gaps
  // =========================================================================
  describe("6. Evidence Attachments & Gaps", () => {
    it("returns uploaded evidence attachments and documents lack of in-app messaging", async () => {
      const { token } = await createTestAdmin();

      const report = await createTestReport({
        attachments: [
          { secure_url: "https://res.cloudinary.com/test/damaged_box.jpg", public_id: "att_box" },
          { secure_url: "https://res.cloudinary.com/test/scratched_bezel.jpg", public_id: "att_bezel" },
        ],
      });

      const res = await request(app)
        .get(`/api/admin/disputes/${report._id}`)
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      const { case: caseData, governance } = res.body.data;

      expect(caseData.attachments.length).toBe(2);
      expect(caseData.attachments[0].secure_url).toContain("damaged_box.jpg");
      expect(caseData.hasAttachments).toBe(true);

      // Verify messaging gap is honestly documented
      expect(governance.messagingCapability.supported).toBe(false);
      expect(governance.messagingCapability.notes).toMatch(/chat is not implemented/i);
    });
  });

  // =========================================================================
  // 7. Missing and Orphaned Related Records
  // =========================================================================
  describe("7. Missing and Orphaned Related Records", () => {
    it("returns 404 cleanly for non-existent case ID", async () => {
      const { token } = await createTestAdmin();
      const nonExistentId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/admin/disputes/${nonExistentId}`)
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("returns 400 for malformed case ID", async () => {
      const { token } = await createTestAdmin();

      const res = await request(app)
        .get("/api/admin/disputes/malformed-id-invalid")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("handles orphaned order reference gracefully with warning flag", async () => {
      const { token } = await createTestAdmin();
      const nonExistentOrderId = new mongoose.Types.ObjectId().toString();

      const report = await createTestReport({
        orderId: nonExistentOrderId,
        report: "Dispute referencing deleted or non-existent order obligation",
      });

      const res = await request(app)
        .get(`/api/admin/disputes/${report._id}`)
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.order).toBeNull();
      expect(res.body.data.inconsistencies.some((i) => i.code === "ORPHANED_ORDER_REFERENCE")).toBe(true);
    });
  });

  // =========================================================================
  // 8. Strict Read-Only Invariants (Zero Mutation on Inspection)
  // =========================================================================
  describe("8. Strict Read-Only Invariants (Zero Mutation on Inspection)", () => {
    it("inspecting directory, detail, and contested orders does NOT mutate database documents", async () => {
      const { token } = await createTestAdmin();

      const product = await createTestProduct({ currentPrice: 5000 });
      const order = await createTestOrder({ productId: product._id, status: "PAID", finalPrice: 5000 });
      const report = await createTestReport({
        orderId: order._id.toString(),
        productId: product._id,
        status: "pending",
        report: "Contested unboxing grievance with zero mutation requirement",
      });

      const beforeReport = await ReportAdmin.findById(report._id).lean();
      const beforeOrder = await Order.findById(order._id).lean();
      const beforeProduct = await Product.findById(product._id).lean();

      // Call directory
      await request(app)
        .get("/api/admin/disputes")
        .set("Cookie", [`adminToken=${token}`]);

      // Call detail
      await request(app)
        .get(`/api/admin/disputes/${report._id}`)
        .set("Cookie", [`adminToken=${token}`]);

      // Call contested orders
      await request(app)
        .get("/api/admin/disputes/contested/orders")
        .set("Cookie", [`adminToken=${token}`]);

      const afterReport = await ReportAdmin.findById(report._id).lean();
      const afterOrder = await Order.findById(order._id).lean();
      const afterProduct = await Product.findById(product._id).lean();

      // All statuses and timestamps must remain identical
      expect(afterReport.status).toBe(beforeReport.status);
      expect(afterReport.report).toBe(beforeReport.report);
      expect(afterOrder.status).toBe(beforeOrder.status);
      expect(afterOrder.finalPrice).toBe(beforeOrder.finalPrice);
      expect(afterProduct.status).toBe(beforeProduct.status);
    });
  });

  // =========================================================================
  // 9. Operational Telemetry & Contested Orders Triage
  // =========================================================================
  describe("9. Operational Telemetry & Contested Orders Triage", () => {
    it("reports real-time aggregate counts and category breakdown", async () => {
      const { token } = await createTestAdmin();

      await createTestReport({ reportType: "delivery", status: "pending" });
      await createTestReport({ reportType: "payment-deposit", status: "pending" });
      await createTestReport({ reportType: "illegal", status: "resolved", resolutionNote: "Listing suspended" });

      const res = await request(app)
        .get("/api/admin/disputes/summary")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      const { summary } = res.body;

      expect(summary.totalCases).toBe(3);
      expect(summary.unresolvedCount).toBe(2);
      expect(summary.resolvedCount).toBe(1);
      expect(summary.types.deliveryDisputes).toBe(1);
      expect(summary.types.paymentDisputes).toBe(1);
      expect(summary.types.listingReports).toBe(1);
    });

    it("returns contested orders queue correctly", async () => {
      const { token } = await createTestAdmin();

      const order = await createTestOrder({ title: "Challenged Luxury Vase", finalPrice: 4000 });
      await createTestReport({
        orderId: order._id.toString(),
        reportType: "delivery",
        status: "pending",
        report: "Vase arrived shattered into pieces",
      });

      const res = await request(app)
        .get("/api/admin/disputes/contested/orders")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.contestedOrders[0].orderTitle).toBe("Challenged Luxury Vase");
      expect(res.body.contestedOrders[0].finalPrice).toBe(4000);
    });
  });
});
