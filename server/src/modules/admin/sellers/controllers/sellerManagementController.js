const mongoose = require("mongoose");
const RealSeller = require("../../../sellers/accounts/models/seller");
const AdminSeller = require("../models/adminSeller");
const Order = require("../../../orders/models/orderSchema");
const auditService = require("../../../analytics/services/auditService");

// Helper to resolve whether to query RealSeller or AdminSeller (supporting tests and production)
const resolveSellerModel = async (query = {}) => {
  const realCount = await RealSeller.countDocuments(query);
  if (realCount > 0) return RealSeller;
  const adminCount = await AdminSeller.countDocuments(query);
  if (adminCount > 0) return AdminSeller;
  return RealSeller;
};

// Helper to calculate commission
function calculateCommission(amount) {
  if (typeof amount !== "number" || amount < 0) return 0;
  const baseRate = 0.1; // 10% platform fee
  const minCommission = 1.0;
  const calculated = amount * baseRate;
  return Number(Math.max(calculated, minCommission).toFixed(2));
}

// Helper to process status counts
const processStatusCounts = (counts) => {
  const result = {
    all: 0,
    active: 0,
    pending_approval: 0,
    suspended: 0,
  };

  counts.forEach((item) => {
    if (item._id) {
      const lower = item._id.toLowerCase();
      if (lower === "active") result.active += item.count;
      else if (lower === "suspended") result.suspended += item.count;
      else result.pending_approval += item.count;
      result.all += item.count;
    }
  });

  return result;
};

// Get all sellers with pagination and filters
exports.getAllSellers = async (req, res) => {
  try {
    const { page = 1, limit = 5, status, search } = req.query;
    const query = {};

    // Support case-insensitive status filtering matching both frontend and backend enums
    if (status && status !== "all") {
      const lower = status.toLowerCase();
      if (lower === "active") {
        query.status = { $in: ["Active", "active"] };
      } else if (lower === "suspended") {
        query.status = { $in: ["Suspended", "suspended"] };
      } else if (lower.includes("pending")) {
        query.status = { $in: ["Pending", "pending", "pending_approval", "Approved", "Flagged"] };
      } else {
        const escapedStatus = String(status).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.status = new RegExp(`^${escapedStatus}$`, "i");
      }
    }

    // Search filter across seller name, store name, and email (escaped against ReDoS)
    if (search && String(search).trim()) {
      const escapedSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { storeName: { $regex: escapedSearch, $options: "i" } },
        { businessName: { $regex: escapedSearch, $options: "i" } },
        { email: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 5);

    const Model = await resolveSellerModel(query);

    // Fetch sellers
    const sellers = await Model.find(query)
      .select("-password")
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const totalSellers = await Model.countDocuments(query);
    const totalPages = Math.ceil(totalSellers / limitNum) || 1;

    // Normalizing status and business name fields for frontend compatibility
    const mappedSellers = sellers.map((s) => ({
      ...s,
      businessName: s.businessName || s.storeName || s.name || "Seller Store",
      phone: s.phone || s.phoneNo || "N/A",
      status: s.status ? s.status.toLowerCase() : "active",
      rawStatus: s.status,
    }));

    // Status counts for filtering badges
    const statusCounts = await Model.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      sellers: mappedSellers,
      totalPages,
      statusCounts: processStatusCounts(statusCounts),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get seller details with real recent orders and stats
exports.getSeller = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid seller ID format",
      });
    }

    let seller = await RealSeller.findById(req.params.id).select("-password").lean();
    if (!seller) {
      seller = await AdminSeller.findById(req.params.id).lean();
    }

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    // Trace real orders for this seller
    const recentOrders = await Order.find({ sellerEmail: seller.email })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const totalOrders = await Order.countDocuments({ sellerEmail: seller.email });
    const paidOrders = await Order.find(
      { sellerEmail: seller.email, status: "PAID" },
      "finalPrice highestBid"
    ).lean();
    const totalRevenue = paidOrders.reduce(
      (sum, o) => sum + (o.finalPrice || o.highestBid || 0),
      0
    );

    res.json({
      success: true,
      seller: {
        ...seller,
        businessName: seller.storeName || seller.name || "Seller Store",
        phone: seller.phoneNo || seller.phone || "N/A",
        status: seller.status ? seller.status.toLowerCase() : "active",
        recentOrders: recentOrders.map((o) => ({
          _id: o._id,
          orderNumber: o._id.toString().slice(-6).toUpperCase(),
          total: o.finalPrice || o.highestBid || 0,
          status: o.status,
          date: o.createdAt,
        })),
        salesStats: {
          totalOrders,
          totalRevenue,
          completedOrders: paidOrders.length,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching seller:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// Update seller status (e.g. Active, Suspended)
exports.updateStatus = async (req, res) => {
  try {
    const validStatuses = [
      "active",
      "pending_approval",
      "suspended",
      "Active",
      "Suspended",
      "Pending",
    ];
    if (!req.body.status || !validStatuses.includes(req.body.status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    let seller = await RealSeller.findById(req.params.id);
    let Model = RealSeller;
    if (!seller) {
      seller = await AdminSeller.findById(req.params.id);
      Model = AdminSeller;
    }

    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    const lowerStatus = req.body.status.toLowerCase();
    let canonicalStatus = lowerStatus;
    if (Model === RealSeller) {
      if (lowerStatus === "suspended") canonicalStatus = "Suspended";
      else if (lowerStatus.includes("pending")) canonicalStatus = "Pending";
      else canonicalStatus = "Active";
    } else {
      if (lowerStatus === "suspended") canonicalStatus = "suspended";
      else if (lowerStatus.includes("pending")) canonicalStatus = "pending_approval";
      else canonicalStatus = "active";
    }

    seller.status = canonicalStatus;
    seller.statusChangedAt = new Date();
    seller.statusChangedBy = req.user?.email || "admin";
    if (req.body.reason) {
      seller.suspensionReason = req.body.reason;
    } else if (canonicalStatus.toLowerCase() === "suspended") {
      seller.suspensionReason = "Administrative suspension by admin";
    }
    await seller.save();

    auditService.recordEvent({
      action: canonicalStatus.toLowerCase() === "suspended" ? "SELLER_SUSPENDED" : "SELLER_STATUS_UPDATED",
      category: "SELLER",
      actorType: "admin",
      actorId: req.user?._id || req.user?.id || req.admin?.id,
      actorEmail: req.user?.email || req.admin?.email || "admin@auctionx.com",
      resourceType: "seller",
      resourceId: seller._id,
      targetAccountId: seller._id,
      targetAccountEmail: seller.email,
      targetAccountType: "seller",
      afterStatus: canonicalStatus,
      reason: seller.suspensionReason || `Status set to ${canonicalStatus}`,
      outcome: "SUCCESS",
      metadata: { newStatus: canonicalStatus },
      req,
    });

    res.json({
      success: true,
      seller: {
        ...(seller.toObject ? seller.toObject() : seller),
        status: canonicalStatus.toLowerCase(),
        businessName: seller.businessName || seller.storeName || seller.name,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Verify seller
exports.verifySeller = async (req, res) => {
  try {
    let seller = await RealSeller.findById(req.params.id);
    let Model = RealSeller;
    if (!seller) {
      seller = await AdminSeller.findById(req.params.id);
      Model = AdminSeller;
    }

    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    seller.isVerified = true;
    seller.status = Model === RealSeller ? "Active" : "active";
    seller.statusChangedAt = new Date();
    seller.statusChangedBy = req.user?.email || "admin";
    await seller.save();

    auditService.recordEvent({
      action: "SELLER_VERIFIED",
      category: "SELLER",
      actorType: "admin",
      actorId: req.user?._id || req.user?.id || req.admin?.id,
      actorEmail: req.user?.email || req.admin?.email || "admin@auctionx.com",
      resourceType: "seller",
      resourceId: seller._id,
      targetAccountId: seller._id,
      targetAccountEmail: seller.email,
      targetAccountType: "seller",
      afterStatus: "Active",
      outcome: "SUCCESS",
      metadata: { isVerified: true },
      req,
    });

    res.json({
      success: true,
      seller: {
        ...(seller.toObject ? seller.toObject() : seller),
        status: "active",
        isVerified: true,
        businessName: seller.businessName || seller.storeName || seller.name,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get seller statistics
exports.getSellerStats = async (req, res) => {
  try {
    const Model = await resolveSellerModel();
    const statusCounts = await Model.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      statusCounts: processStatusCounts(statusCounts),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to get seller stats",
      error: err.message,
    });
  }
};

// Get seller transaction / order history with pagination
exports.getSellerHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    if (page < 1 || limit < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const skip = (page - 1) * limit;

    // Filter by sellerEmail if requested, or return all platform orders for administrative overview
    const filter = {};
    if (req.query.sellerEmail) {
      filter.sellerEmail = req.query.sellerEmail;
    } else if (req.query.email) {
      filter.sellerEmail = req.query.email;
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit) || 1;

    const transformedTransactions = orders.map((order) => ({
      _id: order._id,
      itemName: order.title || order.name || "Auction Item",
      image: order.images?.[0]?.secure_url || "/images/transaction-icon.png",
      sellerEmail: order.sellerEmail,
      buyerEmail: order.userEmail || "buyer@example.com",
      saleDate: order.paidAt || order.createdAt,
      amount: order.finalPrice || order.highestBid || order.biddingStartPrice || 0,
      status: order.status || "PENDING",
      commission: calculateCommission(
        order.finalPrice || order.highestBid || order.biddingStartPrice || 0
      ),
      notes: `Order #${order._id.toString().slice(-6).toUpperCase()} - ${order.category || "Auction"}`,
    }));

    res.status(200).json({
      success: true,
      data: {
        transactions: transformedTransactions,
        pagination: {
          currentPage: page,
          totalPages,
          totalTransactions: totalOrders,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Seller history error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get single transaction details
exports.getTransactionDetails = async (req, res) => {
  try {
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID",
      });
    }

    const order = await Order.findById(req.params.id).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    const transformedTransaction = {
      _id: order._id,
      itemName: order.title || order.name || "Auction Item",
      image: order.images?.[0]?.secure_url || "/images/transaction-icon.png",
      sellerEmail: order.sellerEmail,
      buyerEmail: order.userEmail || "buyer@example.com",
      saleDate: order.paidAt || order.createdAt,
      amount: order.finalPrice || order.highestBid || order.biddingStartPrice || 0,
      status: order.status || "PENDING",
      commission: calculateCommission(
        order.finalPrice || order.highestBid || order.biddingStartPrice || 0
      ),
      notes: `Order #${order._id.toString().slice(-6).toUpperCase()}`,
      paymentMethod: order.razorpayPaymentId ? "Razorpay" : "Online Settlement",
    };

    res.status(200).json({
      success: true,
      transaction: transformedTransaction,
    });
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
