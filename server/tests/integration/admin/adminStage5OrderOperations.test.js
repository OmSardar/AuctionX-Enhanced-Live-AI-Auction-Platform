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
const Payment = require("../../../src/modules/payments/models/Payment");
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
    currentPrice: overrides.currentPrice || 2500,
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
    title: overrides.title || "Antique Silver Pocket Watch",
    name: overrides.name || "Johnathan Doe",
    userEmail: overrides.userEmail || "winner@example.com",
    sellerEmail: overrides.sellerEmail || "seller@example.com",
    category: overrides.category || "Watches",
    images: overrides.images || [
      { secure_url: "https://example.com/watch.jpg", public_id: "watch_01" },
    ],
    biddingStartPrice: overrides.biddingStartPrice || 1000,
    highestBid: overrides.highestBid || 2500,
    finalPrice: overrides.finalPrice || 2500,
    phoneNo: overrides.phoneNo || "9876543210",
    address: overrides.address || "123 Heritage Lane, Mumbai, Maharashtra, India",
    status: overrides.status || "PENDING",
    paymentDeadline: overrides.paymentDeadline || new Date(now.getTime() + 24 * 60 * 60 * 1000),
    ...overrides,
  });
  return await order.save();
};

// Helper to create a test payment
const createTestPayment = async (overrides = {}) => {
  const payment = new Payment({
    orderId: overrides.orderId,
    productId: overrides.productId,
    userId: overrides.userId || new mongoose.Types.ObjectId(),
    userEmail: overrides.userEmail || "winner@example.com",
    amount: overrides.amount || 250000, // ₹2500 in paise
    currency: "INR",
    status: overrides.status || "INITIATED",
    razorpayOrderId: overrides.razorpayOrderId || "order_mock123",
    razorpayPaymentId: overrides.razorpayPaymentId || "pay_mock123",
    ...overrides,
  });
  return await payment.save();
};

describe("Admin Stage 5 — Order & Settlement Operations Integration Tests", () => {
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
    it("should reject unauthenticated requests to order operations with 401", async () => {
      const res = await request(app).get("/api/admin/orders");
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject ordinary users from accessing order operations with 403", async () => {
      const { user, token } = await createTestUser();
      const res = await request(app)
        .get("/api/admin/orders")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should reject sellers from accessing order operations with 403", async () => {
      const { seller, token } = await createTestSeller();
      const res = await request(app)
        .get("/api/admin/orders")
        .set("Cookie", [`token=${token}`]);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should allow verified administrators to access order directory with 200", async () => {
      const { admin, token } = await createTestAdmin({ role: "admin" });
      const res = await request(app)
        .get("/api/admin/orders")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.orders)).toBe(true);
    });

    it("should allow editor role (read-only) to access order operations with 200", async () => {
      const { admin, token } = await createTestAdmin({ role: "editor" });
      const res = await request(app)
        .get("/api/admin/orders")
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

      // Seed 15 test orders
      for (let i = 1; i <= 15; i++) {
        await createTestOrder({
          title: `Art Piece #${i}`,
          finalPrice: 1000 * i,
        });
      }

      const res = await request(app)
        .get("/api/admin/orders?page=2&limit=5")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.orders.length).toBe(5);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.total).toBe(15);
      expect(res.body.pagination.totalPages).toBe(3);
    });

    it("should filter orders by status (PENDING vs PAID vs EXPIRED)", async () => {
      const { token } = await createTestAdmin();

      await createTestOrder({ title: "Order Pending", status: "PENDING" });
      await createTestOrder({ title: "Order Paid", status: "PAID" });
      await createTestOrder({ title: "Order Expired", status: "EXPIRED" });

      const pendingRes = await request(app)
        .get("/api/admin/orders?status=PENDING")
        .set("Cookie", [`adminToken=${token}`]);

      expect(pendingRes.statusCode).toBe(200);
      expect(pendingRes.body.orders.length).toBe(1);
      expect(pendingRes.body.orders[0].title).toBe("Order Pending");

      const paidRes = await request(app)
        .get("/api/admin/orders?status=PAID")
        .set("Cookie", [`adminToken=${token}`]);

      expect(paidRes.statusCode).toBe(200);
      expect(paidRes.body.orders.length).toBe(1);
      expect(paidRes.body.orders[0].title).toBe("Order Paid");
    });

    it("should filter by overdueOnly=true (only pending orders whose deadline passed)", async () => {
      const { token } = await createTestAdmin();
      const now = new Date();

      // Overdue order
      await createTestOrder({
        title: "Overdue Pending Watch",
        status: "PENDING",
        paymentDeadline: new Date(now.getTime() - 2 * 3600000), // 2h ago
      });

      // Active pending order
      await createTestOrder({
        title: "Active Pending Painting",
        status: "PENDING",
        paymentDeadline: new Date(now.getTime() + 10 * 3600000), // in 10h
      });

      // Expired order (already resolved, not overdue pending)
      await createTestOrder({
        title: "Already Expired Item",
        status: "EXPIRED",
        paymentDeadline: new Date(now.getTime() - 5 * 3600000),
      });

      const res = await request(app)
        .get("/api/admin/orders?overdueOnly=true")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.orders.length).toBe(1);
      expect(res.body.orders[0].title).toBe("Overdue Pending Watch");
      expect(res.body.orders[0].isOverdue).toBe(true);
    });

    it("should search across title, userEmail, sellerEmail, and exact ObjectId", async () => {
      const { token } = await createTestAdmin();

      const ord1 = await createTestOrder({
        title: "Unique Renaissance Painting",
        userEmail: "collector@renaissance.org",
      });
      await createTestOrder({
        title: "Modern Sculpture",
        userEmail: "modernist@gallery.com",
      });

      // 1. Search by title
      const resTitle = await request(app)
        .get("/api/admin/orders?search=Renaissance")
        .set("Cookie", [`adminToken=${token}`]);
      expect(resTitle.body.orders.length).toBe(1);
      expect(resTitle.body.orders[0].title).toBe("Unique Renaissance Painting");

      // 2. Search by exact ObjectId
      const resId = await request(app)
        .get(`/api/admin/orders?search=${ord1._id.toString()}`)
        .set("Cookie", [`adminToken=${token}`]);
      expect(resId.body.orders.length).toBe(1);
      expect(resId.body.orders[0].id).toBe(ord1._id.toString());
    });

    it("should safely sort by finalPrice ascending and descending", async () => {
      const { token } = await createTestAdmin();

      await createTestOrder({ title: "Low Price Item", finalPrice: 500 });
      await createTestOrder({ title: "High Price Item", finalPrice: 50000 });

      const resAsc = await request(app)
        .get("/api/admin/orders?sortBy=finalPrice&sortOrder=asc")
        .set("Cookie", [`adminToken=${token}`]);
      expect(resAsc.body.orders[0].finalPrice).toBe(500);

      const resDesc = await request(app)
        .get("/api/admin/orders?sortBy=finalPrice&sortOrder=desc")
        .set("Cookie", [`adminToken=${token}`]);
      expect(resDesc.body.orders[0].finalPrice).toBe(50000);
    });
  });

  // =========================================================================
  // 3. Role-Based Information Protection & PII Masking
  // =========================================================================
  describe("3. Role-Based Information Protection & PII Masking", () => {
    it("masks sensitive email, phone, and shipping address when accessed by editor role", async () => {
      const { token: editorToken } = await createTestAdmin({ role: "editor" });

      const order = await createTestOrder({
        userEmail: "victor.winner@luxuryauctions.com",
        sellerEmail: "sophia.seller@estatejewels.com",
        name: "Victor Winner",
        phoneNo: "9876543210",
        address: "Flat 4B, Emerald Heights, Marine Drive, Mumbai, 400020",
      });

      const res = await request(app)
        .get(`/api/admin/orders/${order._id}`)
        .set("Cookie", [`adminToken=${editorToken}`]);

      expect(res.statusCode).toBe(200);
      const { winner, seller } = res.body.data.order;

      // Emails must be masked
      expect(winner.email).toBe("vi***@luxuryauctions.com");
      expect(seller.email).toBe("so***@estatejewels.com");

      // Phone must be partially masked
      expect(winner.phoneNo).toBe("******3210");

      // Address must be redacted
      expect(winner.shippingAddress).toContain("[REDACTED ADDRESS]");
    });

    it("displays unmasked operational information to full admin role", async () => {
      const { token: adminToken } = await createTestAdmin({ role: "admin" });

      const order = await createTestOrder({
        userEmail: "victor.winner@luxuryauctions.com",
        sellerEmail: "sophia.seller@estatejewels.com",
        name: "Victor Winner",
        phoneNo: "9876543210",
        address: "Flat 4B, Emerald Heights, Marine Drive, Mumbai, 400020",
      });

      const res = await request(app)
        .get(`/api/admin/orders/${order._id}`)
        .set("Cookie", [`adminToken=${adminToken}`]);

      expect(res.statusCode).toBe(200);
      const { winner, seller } = res.body.data.order;

      expect(winner.email).toBe("victor.winner@luxuryauctions.com");
      expect(seller.email).toBe("sophia.seller@estatejewels.com");
      expect(winner.phoneNo).toBe("9876543210");
      expect(winner.shippingAddress).toBe("Flat 4B, Emerald Heights, Marine Drive, Mumbai, 400020");
    });
  });

  // =========================================================================
  // 4. Order Detail Investigation & Cross-Model Linking
  // =========================================================================
  describe("4. Order Detail Investigation & Cross-Model Linking", () => {
    it("correctly links order to parent auction, winning bid, and payment records", async () => {
      const { token } = await createTestAdmin();

      const product = await createTestProduct({
        name: "Royal Heritage Necklace",
        bidCount: 5,
        antiSnipeCount: 1,
      });

      const order = await createTestOrder({
        productId: product._id,
        finalPrice: 85000,
        title: product.name,
      });

      // Seed authoritative winning bid
      const winningBid = await Bid.create({
        productId: product._id,
        bidder: new mongoose.Types.ObjectId(),
        bidderEmail: "royal.buyer@heritage.com",
        bidderName: "Royal Buyer",
        amount: 85000,
        status: "ACCEPTED",
        idempotencyKey: "bid_first_place",
      });

      // Seed linked payment
      const payment = await createTestPayment({
        orderId: order._id,
        productId: product._id,
        amount: 8500000,
        status: "CAPTURED",
        razorpayOrderId: "order_rcpt_123",
        razorpayPaymentId: "pay_trans_456",
        verifiedVia: "CHECKOUT_VERIFICATION",
      });

      const res = await request(app)
        .get(`/api/admin/orders/${order._id}`)
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      const { auction, winningBid: winBidRes, payments } = res.body.data;

      // Linked Auction
      expect(auction).toBeDefined();
      expect(auction.id).toBe(product._id.toString());
      expect(auction.name).toBe("Royal Heritage Necklace");
      expect(auction.bidCount).toBe(5);

      // Winning Bid
      expect(winBidRes).toBeDefined();
      expect(winBidRes.amount).toBe(85000);
      expect(winBidRes.bidderEmail).toBe("royal.buyer@heritage.com");

      // Payments
      expect(payments.length).toBe(1);
      expect(payments[0].status).toBe("CAPTURED");
      expect(payments[0].amountInRupees).toBe(85000);
      expect(payments[0].razorpayPaymentId).toBe("pay_trans_456");
    });
  });

  // =========================================================================
  // 5. Payment Deadline Calculations & Overdue Diagnostics
  // =========================================================================
  describe("5. Payment Deadline Calculations & Overdue Diagnostics", () => {
    it("distinguishes active payment window from overdue pending and confirmed expired", async () => {
      const { token } = await createTestAdmin();
      const now = new Date();

      // 1. Active window
      const activeOrder = await createTestOrder({
        status: "PENDING",
        paymentDeadline: new Date(now.getTime() + 12 * 3600000), // 12h left
      });

      // 2. Overdue pending
      const overdueOrder = await createTestOrder({
        status: "PENDING",
        paymentDeadline: new Date(now.getTime() - 4 * 3600000), // 4h overdue
      });

      // 3. Confirmed expired
      const expiredOrder = await createTestOrder({
        status: "EXPIRED",
        paymentDeadline: new Date(now.getTime() - 24 * 3600000),
      });

      // Check Active Order
      const resActive = await request(app)
        .get(`/api/admin/orders/${activeOrder._id}`)
        .set("Cookie", [`adminToken=${token}`]);
      expect(resActive.body.data.order.isOverdue).toBe(false);
      expect(resActive.body.data.order.deadlineStatus).toBe("ACTIVE_PAYMENT_WINDOW");
      expect(resActive.body.data.order.remainingMs).toBeGreaterThan(0);

      // Check Overdue Order
      const resOverdue = await request(app)
        .get(`/api/admin/orders/${overdueOrder._id}`)
        .set("Cookie", [`adminToken=${token}`]);
      expect(resOverdue.body.data.order.isOverdue).toBe(true);
      expect(resOverdue.body.data.order.deadlineStatus).toBe("OVERDUE_UNRECONCILED");
      expect(resOverdue.body.data.order.overdueMs).toBeGreaterThan(0);
      expect(resOverdue.body.data.inconsistencies.length).toBeGreaterThan(0);
      expect(resOverdue.body.data.inconsistencies[0].code).toBe("OVERDUE_UNRECONCILED");

      // Check Expired Order
      const resExpired = await request(app)
        .get(`/api/admin/orders/${expiredOrder._id}`)
        .set("Cookie", [`adminToken=${token}`]);
      expect(resExpired.body.data.order.isOverdue).toBe(false);
      expect(resExpired.body.data.order.deadlineStatus).toBe("EXPIRED");
    });
  });

  // =========================================================================
  // 6. Runner-Up Candidate Discovery & Invariant Enforcement
  // =========================================================================
  describe("6. Runner-Up Candidate Discovery & Invariant Enforcement", () => {
    it("discovers runner-up candidate without automatic billing or winner mutation", async () => {
      const { token } = await createTestAdmin();
      const product = await createTestProduct();

      // Winning bid (₹10,000)
      await Bid.create({
        productId: product._id,
        bidder: new mongoose.Types.ObjectId(),
        bidderEmail: "winner1@domain.com",
        bidderName: "Winner One",
        amount: 10000,
        status: "ACCEPTED",
        idempotencyKey: "bid_1",
      });

      // Runner-up bid (₹9,500)
      const runnerUpBid = await Bid.create({
        productId: product._id,
        bidder: new mongoose.Types.ObjectId(),
        bidderEmail: "runnerup@domain.com",
        bidderName: "Runner Up",
        amount: 9500,
        status: "ACCEPTED",
        idempotencyKey: "bid_2",
      });

      const order = await createTestOrder({
        productId: product._id,
        finalPrice: 10000,
      });

      const res = await request(app)
        .get(`/api/admin/orders/${order._id}`)
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      const { runnerUpOversight } = res.body.data;

      expect(runnerUpOversight.hasCandidate).toBe(true);
      expect(runnerUpOversight.candidateBid.amount).toBe(9500);
      expect(runnerUpOversight.candidateBid.bidderEmail).toBe("runnerup@domain.com");
      expect(runnerUpOversight.policy).toMatch(/Automatic billing or winner substitution is prohibited/i);

      // Verify zero mutation occurred on order or product
      const freshOrder = await Order.findById(order._id);
      expect(freshOrder.finalPrice).toBe(10000); // Intact
      expect(freshOrder.status).toBe("PENDING"); // Intact
    });

    it("correctly sets hasCandidate=false when no second bid exists", async () => {
      const { token } = await createTestAdmin();
      const product = await createTestProduct();

      // Only 1 bid
      await Bid.create({
        productId: product._id,
        bidder: new mongoose.Types.ObjectId(),
        bidderEmail: "solo.bidder@domain.com",
        bidderName: "Solo Bidder",
        amount: 5000,
        status: "ACCEPTED",
        idempotencyKey: "bid_solo",
      });

      const order = await createTestOrder({
        productId: product._id,
        finalPrice: 5000,
      });

      const res = await request(app)
        .get(`/api/admin/orders/${order._id}`)
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.runnerUpOversight.hasCandidate).toBe(false);
      expect(res.body.data.runnerUpOversight.candidateBid).toBeNull();
    });
  });

  // =========================================================================
  // 7. Strict Read-Only Invariants (Zero Mutation on Inspection)
  // =========================================================================
  describe("7. Strict Read-Only Invariants (Zero Mutation on Inspection)", () => {
    it("inspecting order directory, detail, and deadline console does NOT mutate database documents", async () => {
      const { token } = await createTestAdmin();
      const now = new Date();

      const product = await createTestProduct({ currentPrice: 5000, status: "ENDED" });
      const order = await createTestOrder({
        productId: product._id,
        status: "PENDING",
        finalPrice: 5000,
        paymentDeadline: new Date(now.getTime() - 3600000), // Overdue
      });

      const beforeOrder = await Order.findById(order._id).lean();
      const beforeProduct = await Product.findById(product._id).lean();

      // Call directory endpoint
      await request(app)
        .get("/api/admin/orders")
        .set("Cookie", [`adminToken=${token}`]);

      // Call single detail endpoint
      await request(app)
        .get(`/api/admin/orders/${order._id}`)
        .set("Cookie", [`adminToken=${token}`]);

      // Call deadline monitoring endpoint
      await request(app)
        .get("/api/admin/orders/deadlines/monitoring")
        .set("Cookie", [`adminToken=${token}`]);

      const afterOrder = await Order.findById(order._id).lean();
      const afterProduct = await Product.findById(product._id).lean();

      // Invariant: Status, price, deadlines, and updated timestamps MUST remain identical
      expect(afterOrder.status).toBe(beforeOrder.status);
      expect(afterOrder.finalPrice).toBe(beforeOrder.finalPrice);
      expect(afterOrder.paymentDeadline.toISOString()).toBe(beforeOrder.paymentDeadline.toISOString());
      expect(afterOrder.updatedAt.toISOString()).toBe(beforeOrder.updatedAt.toISOString());

      expect(afterProduct.status).toBe(beforeProduct.status);
      expect(afterProduct.currentPrice).toBe(beforeProduct.currentPrice);
      expect(afterProduct.updatedAt.toISOString()).toBe(beforeProduct.updatedAt.toISOString());
    });
  });

  // =========================================================================
  // 8. Graceful Handling of Orphaned & Missing Records
  // =========================================================================
  describe("8. Graceful Handling of Orphaned & Missing Records", () => {
    it("returns 404 cleanly for non-existent order ID", async () => {
      const { token } = await createTestAdmin();
      const randomId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/admin/orders/${randomId}`)
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it("returns 400 for malformed order ID", async () => {
      const { token } = await createTestAdmin();

      const res = await request(app)
        .get("/api/admin/orders/malformed-id-12345")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("handles orphaned product references gracefully with warning flag", async () => {
      const { token } = await createTestAdmin();
      const nonExistentProductId = new mongoose.Types.ObjectId();

      const order = await createTestOrder({
        productId: nonExistentProductId,
      });

      const res = await request(app)
        .get(`/api/admin/orders/${order._id}`)
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.auction).toBeNull();
      expect(res.body.data.inconsistencies.some((i) => i.code === "ORPHANED_PRODUCT_REFERENCE")).toBe(true);
    });
  });

  // =========================================================================
  // 9. Operational Telemetry & Summary Reporting
  // =========================================================================
  describe("9. Operational Telemetry & Summary Reporting", () => {
    it("reports real-time aggregate counts, settlement volume, and overdue metrics", async () => {
      const { token } = await createTestAdmin();
      const now = new Date();

      await createTestOrder({
        status: "PAID",
        finalPrice: 15000,
      });
      await createTestOrder({
        status: "PENDING",
        finalPrice: 5000,
        paymentDeadline: new Date(now.getTime() - 3600000), // Overdue
      });
      await createTestOrder({
        status: "PENDING",
        finalPrice: 8000,
        paymentDeadline: new Date(now.getTime() + 2 * 3600000), // Approaching
      });

      const res = await request(app)
        .get("/api/admin/orders/summary")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      const { summary } = res.body;

      expect(summary.totalOrders).toBe(3);
      expect(summary.paidCount).toBe(1);
      expect(summary.pendingCount).toBe(2);
      expect(summary.overdueCount).toBe(1);
      expect(summary.approachingCount).toBe(1);
      expect(summary.totalSettledVolume).toBe(15000);
      expect(summary.pendingSettlementVolume).toBe(13000);
    });

    it("returns deadline monitoring breakdown correctly", async () => {
      const { token } = await createTestAdmin();
      const now = new Date();

      await createTestOrder({
        title: "Approaching Item",
        status: "PENDING",
        paymentDeadline: new Date(now.getTime() + 2 * 3600000),
      });

      await createTestOrder({
        title: "Overdue Item",
        status: "PENDING",
        paymentDeadline: new Date(now.getTime() - 2 * 3600000),
      });

      const res = await request(app)
        .get("/api/admin/orders/deadlines/monitoring")
        .set("Cookie", [`adminToken=${token}`]);

      expect(res.statusCode).toBe(200);
      const { monitoring } = res.body;

      expect(monitoring.approachingCount).toBe(1);
      expect(monitoring.approachingOrders[0].title).toBe("Approaching Item");

      expect(monitoring.overdueUnreconciledCount).toBe(1);
      expect(monitoring.overdueUnreconciledOrders[0].title).toBe("Overdue Item");
    });
  });
});
