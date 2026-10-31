const mongoose = require("mongoose");
const Order = require("../../../orders/models/orderSchema");
const Product = require("../../../products/models/productSchema");
const Payment = require("../../../payments/models/Payment");
const Bid = require("../../../bidding/models/bidSchema");
const AdminAuditLog = require("../../disputes/models/adminAuditLog");
const { normalizeAuctionBoundaries } = require("../../../auctions/services/lifecycleService");

// Helper to safely escape regex search strings
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Mask email address for restricted roles (e.g. editor)
 */
const maskEmail = (email) => {
  if (!email || typeof email !== "string") return "";
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const user = parts[0];
  const domain = parts[1];
  const maskedUser = user.length > 2 ? `${user.slice(0, 2)}***` : `${user}***`;
  return `${maskedUser}@${domain}`;
};

/**
 * Mask phone number for restricted roles
 */
const maskPhone = (phone) => {
  if (!phone || typeof phone !== "string") return "";
  const clean = phone.trim();
  if (clean.length < 4) return "**********";
  return `******${clean.slice(-4)}`;
};

/**
 * Mask physical address for restricted roles
 */
const maskAddress = (address) => {
  if (!address || typeof address !== "string") return "";
  const parts = address.split(",");
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim();
    return `[REDACTED ADDRESS], ${lastPart}`;
  }
  return "[REDACTED ADDRESS]";
};

/**
 * Computes payment deadline diagnostics and state flags
 */
const computeDeadlineDiagnostics = (order, now = new Date()) => {
  const deadline = order.paymentDeadline ? new Date(order.paymentDeadline) : null;
  const isPending = order.status === "PENDING";

  if (!deadline || isNaN(deadline.getTime())) {
    return {
      hasDeadline: false,
      paymentDeadline: null,
      isOverdue: false,
      isApproaching: false,
      remainingMs: null,
      overdueMs: null,
      deadlineStatus: isPending ? "NO_DEADLINE_SET" : order.status,
    };
  }

  const diffMs = deadline.getTime() - now.getTime();
  const isOverdue = isPending && diffMs < 0;
  // Approaching deadline: within 4 hours remaining
  const isApproaching = isPending && diffMs >= 0 && diffMs <= 4 * 60 * 60 * 1000;

  let deadlineStatus = order.status;
  if (isPending) {
    if (isOverdue) {
      deadlineStatus = "OVERDUE_UNRECONCILED";
    } else if (isApproaching) {
      deadlineStatus = "APPROACHING_DEADLINE";
    } else {
      deadlineStatus = "ACTIVE_PAYMENT_WINDOW";
    }
  }

  return {
    hasDeadline: true,
    paymentDeadline: deadline.toISOString(),
    isOverdue,
    isApproaching,
    remainingMs: diffMs > 0 ? diffMs : 0,
    overdueMs: isOverdue ? Math.abs(diffMs) : 0,
    deadlineStatus,
  };
};

/**
 * Standardized sanitization DTO for order directory records
 */
const sanitizeOrderSummaryDTO = (order, callerRole = "admin", now = new Date()) => {
  const isEditor = callerRole === "editor";
  const diagnostics = computeDeadlineDiagnostics(order, now);

  return {
    id: (order._id || order.id).toString(),
    _id: (order._id || order.id).toString(),
    title: order.title || "Untitled Auction Item",
    category: order.category || "General",
    image: order.images?.[0]?.secure_url || null,
    biddingStartPrice: order.biddingStartPrice || 0,
    highestBid: order.highestBid || 0,
    finalPrice: order.finalPrice || order.highestBid || 0,
    status: order.status || "PENDING",
    paymentAttempts: order.paymentAttempts || 0,
    paidAt: order.paidAt ? new Date(order.paidAt).toISOString() : null,
    createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : null,
    updatedAt: order.updatedAt ? new Date(order.updatedAt).toISOString() : null,

    // Buyer / Winner info with role masking
    winner: {
      id: order.winnerId ? order.winnerId.toString() : null,
      name: isEditor && order.name ? `${order.name.charAt(0)}***` : order.name || "Unknown Winner",
      email: isEditor ? maskEmail(order.userEmail) : order.userEmail || "",
    },

    // Seller info with role masking
    seller: {
      email: isEditor ? maskEmail(order.sellerEmail) : order.sellerEmail || "",
    },

    // Linked IDs
    productId: order.productId ? order.productId.toString() : null,
    paymentId: order.paymentId ? order.paymentId.toString() : null,
    razorpayOrderId: order.razorpayOrderId || null,
    razorpayPaymentId: order.razorpayPaymentId || null,

    // Deadline diagnostics
    ...diagnostics,

    // Stage 7 Dispute Hold State
    isDisputeHoldActive: Boolean(order.isDisputeHoldActive),
    activeHoldsCount: (order.disputeHolds || []).filter((h) => h.status === "ACTIVE").length,
  };
};

/**
 * GET /api/admin/orders/summary
 * Aggregate metrics, KPIs, and reconciliation indicators
 */
const getOrderSummary = async (req, res) => {
  try {
    const now = new Date();
    const approachingWindow = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    const [
      totalOrders,
      pendingCount,
      paidCount,
      expiredCount,
      cancelledCount,
      refundedCount,
      overdueCount,
      approachingCount,
      volumeAggregate,
    ] = await Promise.all([
      Order.countDocuments({}),
      Order.countDocuments({ status: "PENDING" }),
      Order.countDocuments({ status: "PAID" }),
      Order.countDocuments({ status: "EXPIRED" }),
      Order.countDocuments({ status: "CANCELLED" }),
      Order.countDocuments({ status: "REFUNDED" }),
      Order.countDocuments({ status: "PENDING", paymentDeadline: { $lt: now } }),
      Order.countDocuments({
        status: "PENDING",
        paymentDeadline: { $gte: now, $lte: approachingWindow },
      }),
      Order.aggregate([
        {
          $group: {
            _id: "$status",
            totalValue: { $sum: { $ifNull: ["$finalPrice", "$highestBid"] } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Financial volume breakdown
    let totalSettledVolume = 0;
    let pendingSettlementVolume = 0;
    volumeAggregate.forEach((group) => {
      if (group._id === "PAID") {
        totalSettledVolume = group.totalValue || 0;
      } else if (group._id === "PENDING") {
        pendingSettlementVolume = group.totalValue || 0;
      }
    });

    // Count reconciliation alerts (overdue orders still in PENDING state)
    const reconciliationAlertsCount = overdueCount;

    return res.status(200).json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        totalOrders,
        pendingCount,
        paidCount,
        expiredCount,
        cancelledCount,
        refundedCount,
        overdueCount,
        approachingCount,
        reconciliationAlertsCount,
        totalSettledVolume,
        pendingSettlementVolume,
      },
    });
  } catch (error) {
    console.error("[AdminOrderOperations] getOrderSummary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to aggregate order operational summary",
    });
  }
};

/**
 * GET /api/admin/orders
 * Paginated order operations directory with bounded limits, multi-attribute filtering,
 * debounced search, and safe sorting.
 */
const getOrders = async (req, res) => {
  try {
    const callerRole = req.admin?.role || req.user?.role || "admin";
    const now = new Date();

    // 1. Validate pagination
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 100) limit = 100; // Hard bounded limit

    const skip = (page - 1) * limit;

    // 2. Build multi-filter query
    const filter = {};

    // Status filter
    const statusParam = req.query.status ? req.query.status.toUpperCase() : "ALL";
    if (statusParam !== "ALL") {
      if (["PENDING", "PAID", "CANCELLED", "REFUNDED", "EXPIRED"].includes(statusParam)) {
        filter.status = statusParam;
      }
    }

    // Overdue filter
    if (req.query.overdueOnly === "true") {
      filter.status = "PENDING";
      filter.paymentDeadline = { $lt: now };
    }

    // Approaching deadline filter (within 4 hours)
    if (req.query.approachingOnly === "true") {
      const in4Hours = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      filter.status = "PENDING";
      filter.paymentDeadline = { $gte: now, $lte: in4Hours };
    }

    // Reconciliation-required filter (overdue pending orders)
    if (req.query.reconciliationOnly === "true") {
      filter.status = "PENDING";
      filter.paymentDeadline = { $lt: now };
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) {
        const start = new Date(req.query.startDate);
        if (!isNaN(start.getTime())) filter.createdAt.$gte = start;
      }
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        if (!isNaN(end.getTime())) filter.createdAt.$lte = end;
      }
    }

    // Search query: title, userEmail, sellerEmail, winner name, or exact ObjectId
    if (req.query.search && req.query.search.trim()) {
      const term = req.query.search.trim();
      if (mongoose.Types.ObjectId.isValid(term)) {
        filter.$or = [
          { _id: new mongoose.Types.ObjectId(term) },
          { productId: new mongoose.Types.ObjectId(term) },
          { winnerId: new mongoose.Types.ObjectId(term) },
        ];
      } else {
        const escaped = escapeRegex(term);
        const searchRegex = new RegExp(escaped, "i");
        filter.$or = [
          { title: searchRegex },
          { userEmail: searchRegex },
          { sellerEmail: searchRegex },
          { name: searchRegex },
          { razorpayOrderId: searchRegex },
          { razorpayPaymentId: searchRegex },
        ];
      }
    }

    // 3. Safe sorting
    const allowedSortFields = ["createdAt", "paymentDeadline", "finalPrice", "updatedAt"];
    let sortBy = req.query.sortBy || "createdAt";
    if (!allowedSortFields.includes(sortBy)) sortBy = "createdAt";

    let sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const sort = { [sortBy]: sortOrder, _id: sortOrder };

    // 4. Execute bounded query
    const [total, rawOrders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const orders = rawOrders.map((ord) => sanitizeOrderSummaryDTO(ord, callerRole, now));

    return res.status(200).json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("[AdminOrderOperations] getOrders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve orders directory",
    });
  }
};

/**
 * GET /api/admin/orders/:id
 * Single order operational investigation view.
 * Exposes linked auction boundaries, authoritative payment state, bid ledger references,
 * runner-up candidates, and audit trail with strict role-based PII masking.
 */
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const callerRole = req.admin?.role || req.user?.role || "admin";
    const isEditor = callerRole === "editor";
    const now = new Date();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Order ID format",
      });
    }

    // 1. Fetch Order
    const order = await Order.findById(id).lean();
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order obligation record not found",
      });
    }

    // 2. Fetch Linked Product / Auction
    let product = null;
    let auctionBoundaries = null;
    if (order.productId) {
      product = await Product.findById(order.productId).lean();
      if (product) {
        auctionBoundaries = normalizeAuctionBoundaries(product);
      }
    }

    // 3. Fetch Linked Payments
    const paymentQuery = {
      $or: [
        { orderId: order._id },
        ...(order.productId ? [{ productId: order.productId }] : []),
      ],
    };
    const payments = await Payment.find(paymentQuery)
      .sort({ createdAt: -1 })
      .lean();

    // 4. Fetch Winning & Runner-up bids
    let winningBid = null;
    let runnerUpBid = null;
    if (order.productId) {
      const acceptedBids = await Bid.find({
        productId: order.productId,
        status: "ACCEPTED",
      })
        .sort({ amount: -1, createdAt: -1, _id: -1 })
        .limit(2)
        .lean();

      if (acceptedBids.length > 0) {
        winningBid = acceptedBids[0];
      }
      if (acceptedBids.length > 1) {
        runnerUpBid = acceptedBids[1];
      }
    }

    // 5. Fetch Related Admin Audit Logs
    const auditTargetIds = [order._id.toString()];
    if (order.productId) auditTargetIds.push(order.productId.toString());
    const auditLogs = await AdminAuditLog.find({
      targetAccountId: { $in: auditTargetIds },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // 6. Deadline and Reconciliation Diagnostics
    const diagnostics = computeDeadlineDiagnostics(order, now);

    // Inconsistency detection
    const inconsistencies = [];
    if (diagnostics.isOverdue && order.status === "PENDING") {
      inconsistencies.push({
        code: "OVERDUE_UNRECONCILED",
        severity: "WARNING",
        message: "Payment deadline has elapsed, but order status has not transitioned to EXPIRED by the lifecycle worker.",
      });
    }
    if (!product && order.productId) {
      inconsistencies.push({
        code: "ORPHANED_PRODUCT_REFERENCE",
        severity: "ERROR",
        message: "Order references a product ID that does not exist in the database.",
      });
    }
    const capturedPayment = payments.find((p) => p.status === "CAPTURED");
    if (capturedPayment && order.status !== "PAID") {
      inconsistencies.push({
        code: "PAYMENT_ORDER_MISMATCH",
        severity: "CRITICAL",
        message: `Payment ${capturedPayment._id} is CAPTURED, but Order status is ${order.status}. Reconciliation required.`,
      });
    }
    if (order.status === "PAID" && product && product.status !== "SETTLED") {
      inconsistencies.push({
        code: "ORDER_PRODUCT_SETTLEMENT_MISMATCH",
        severity: "WARNING",
        message: `Order is marked PAID, but Auction product status is ${product.status} (expected SETTLED).`,
      });
    }

    // 7. Assemble Complete Investigation DTO
    const orderInvestigationDTO = {
      order: {
        id: order._id.toString(),
        _id: order._id.toString(),
        title: order.title || "Untitled Auction Item",
        category: order.category || "General",
        images: order.images || [],
        biddingStartPrice: order.biddingStartPrice || 0,
        highestBid: order.highestBid || 0,
        finalPrice: order.finalPrice || order.highestBid || 0,
        status: order.status || "PENDING",
        paymentAttempts: order.paymentAttempts || 0,
        paidAt: order.paidAt ? new Date(order.paidAt).toISOString() : null,
        createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : null,
        updatedAt: order.updatedAt ? new Date(order.updatedAt).toISOString() : null,

        // Winner & Shipping info with role-appropriate masking
        winner: {
          id: order.winnerId ? order.winnerId.toString() : null,
          name: isEditor && order.name ? `${order.name.charAt(0)}***` : order.name || "Unknown Winner",
          email: isEditor ? maskEmail(order.userEmail) : order.userEmail || "",
          phoneNo: isEditor ? maskPhone(order.phoneNo) : order.phoneNo || "NOT_PROVIDED",
          shippingAddress: isEditor ? maskAddress(order.address) : order.address || "NOT_PROVIDED",
        },

        // Seller identity with role masking
        seller: {
          email: isEditor ? maskEmail(order.sellerEmail) : order.sellerEmail || "",
        },

        // Provider references
        razorpayOrderId: order.razorpayOrderId || null,
        razorpayPaymentId: order.razorpayPaymentId || null,

        // Deadline diagnostics
        ...diagnostics,

        // Stage 7 Dispute Hold State
        isDisputeHoldActive: Boolean(order.isDisputeHoldActive),
        disputeHolds: (order.disputeHolds || []).map((h) => ({
          holdId: h.holdId,
          caseId: h.caseId ? h.caseId.toString() : null,
          reason: h.reason,
          status: h.status,
          placedAt: h.placedAt ? new Date(h.placedAt).toISOString() : null,
          placedBy: {
            adminEmail: isEditor ? maskEmail(h.placedBy?.adminEmail) : h.placedBy?.adminEmail,
            role: h.placedBy?.role,
          },
          releasedAt: h.releasedAt ? new Date(h.releasedAt).toISOString() : null,
          releasedBy: h.releasedBy
            ? {
                adminEmail: isEditor ? maskEmail(h.releasedBy?.adminEmail) : h.releasedBy?.adminEmail,
                role: h.releasedBy?.role,
              }
            : null,
          releaseReason: h.releaseReason || null,
        })),
        activeHoldsCount: (order.disputeHolds || []).filter((h) => h.status === "ACTIVE").length,
        blockedTransitions: order.isDisputeHoldActive
          ? [
              "AUTOMATED_PAYMENT_DEADLINE_EXPIRATION",
              "SELLER_FULFILLMENT_COMPLETION",
              "ORDER_CANCELLATION",
              "SETTLEMENT_FINALIZATION",
            ]
          : [],
      },

      // Auction context
      auction: product
        ? {
            id: product._id.toString(),
            _id: product._id.toString(),
            name: product.name,
            status: product.status,
            moderationStatus: product.moderationStatus || "ACTIVE",
            reconciliationRequired: product.reconciliationRequired || false,
            reconciliationReason: product.reconciliationReason || null,
            bidCount: product.bidCount || 0,
            startTime: auctionBoundaries?.startTime ? auctionBoundaries.startTime.toISOString() : null,
            endTime: auctionBoundaries?.endTime ? auctionBoundaries.endTime.toISOString() : null,
            originalEndTime: auctionBoundaries?.originalEndTime ? auctionBoundaries.originalEndTime.toISOString() : null,
            antiSnipingExtensionsCount: product.antiSnipingExtensionsCount || 0,
          }
        : null,

      // Winning bid confirmation
      winningBid: winningBid
        ? {
            id: winningBid._id.toString(),
            amount: winningBid.amount,
            bidderName: isEditor ? `${winningBid.bidderName?.charAt(0) || "B"}***` : winningBid.bidderName,
            bidderEmail: isEditor ? maskEmail(winningBid.bidderEmail) : winningBid.bidderEmail,
            createdAt: winningBid.createdAt ? new Date(winningBid.createdAt).toISOString() : null,
          }
        : null,

      // Runner-Up Oversight & Invariants
      runnerUpOversight: {
        supported: true,
        hasCandidate: Boolean(runnerUpBid),
        candidateBid: runnerUpBid
          ? {
              id: runnerUpBid._id.toString(),
              amount: runnerUpBid.amount,
              bidderName: isEditor ? `${runnerUpBid.bidderName?.charAt(0) || "R"}***` : runnerUpBid.bidderName,
              bidderEmail: isEditor ? maskEmail(runnerUpBid.bidderEmail) : runnerUpBid.bidderEmail,
              createdAt: runnerUpBid.createdAt ? new Date(runnerUpBid.createdAt).toISOString() : null,
            }
          : null,
        policy:
          "Automatic billing or winner substitution is prohibited. Runner-up offers require explicit administrative initiation and bidder acceptance.",
        workflowStatus: "READ_ONLY_OVERSIGHT",
      },

      // Fulfillment Visibility
      fulfillment: {
        destinationRecorded: Boolean(order.address && order.address !== "PENDING_CHECKOUT"),
        phoneProvided: Boolean(order.phoneNo && order.phoneNo !== "PENDING_CHECKOUT"),
        carrierIntegrationStatus: "NOT_CONFIGURED",
        trackingNumber: null,
        fulfillmentState:
          order.status === "PAID"
            ? "AWAITING_SELLER_FULFILLMENT"
            : order.status === "EXPIRED" || order.status === "CANCELLED"
            ? "TERMINATED"
            : "AWAITING_PAYMENT_SETTLEMENT",
        notes: "Carrier tracking APIs are not integrated in the backend. Fulfillment status tracks payment settlement.",
      },

      // Payment records ledger
      payments: payments.map((p) => ({
        id: p._id.toString(),
        type: p.type || "AUCTION_ORDER",
        amountMinorUnits: p.amount,
        amountInRupees: p.amount ? p.amount / 100 : 0,
        currency: p.currency || "INR",
        status: p.status,
        razorpayOrderId: p.razorpayOrderId || null,
        razorpayPaymentId: p.razorpayPaymentId || null,
        verifiedVia: p.verifiedVia || null,
        verifiedAt: p.verifiedAt ? new Date(p.verifiedAt).toISOString() : null,
        failureReason: p.failureReason || null,
        reconciliationNotes: p.reconciliationNotes || null,
        walletCredited: p.walletCredited || false,
        ledgerRecorded: p.ledgerRecorded || false,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      })),

      // Related Audit Logs
      auditLogs: auditLogs.map((log) => ({
        id: log._id.toString(),
        action: log.action,
        actingAdminEmail: log.actingAdminEmail,
        actingAdminRole: log.actingAdminRole,
        targetAccountType: log.targetAccountType,
        reason: log.reason,
        outcome: log.outcome,
        failureReason: log.failureReason || null,
        completedAt: log.completedAt ? new Date(log.completedAt).toISOString() : log.createdAt,
      })),

      // Detected state inconsistencies
      inconsistencies,
    };

    return res.status(200).json({
      success: true,
      data: orderInvestigationDTO,
    });
  } catch (error) {
    console.error("[AdminOrderOperations] getOrderById error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve order investigation details",
    });
  }
};

/**
 * GET /api/admin/orders/deadlines/monitoring
 * Dedicated operational view for monitoring payment deadlines, overdue orders,
 * approaching deadlines, and settlement inconsistencies.
 */
const getDeadlineMonitoring = async (req, res) => {
  try {
    const callerRole = req.admin?.role || req.user?.role || "admin";
    const now = new Date();
    const in4Hours = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    const [approachingOrders, overdueOrders, recentlyExpiredOrders] = await Promise.all([
      // Orders approaching deadline within next 4 hours
      Order.find({
        status: "PENDING",
        paymentDeadline: { $gte: now, $lte: in4Hours },
      })
        .sort({ paymentDeadline: 1 })
        .limit(20)
        .lean(),

      // Orders whose deadline has elapsed but status is still PENDING (unreconciled)
      Order.find({
        status: "PENDING",
        paymentDeadline: { $lt: now },
      })
        .sort({ paymentDeadline: 1 })
        .limit(20)
        .lean(),

      // Recently expired orders
      Order.find({
        status: "EXPIRED",
      })
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      timestamp: now.toISOString(),
      monitoring: {
        approachingCount: approachingOrders.length,
        approachingOrders: approachingOrders.map((o) => sanitizeOrderSummaryDTO(o, callerRole, now)),

        overdueUnreconciledCount: overdueOrders.length,
        overdueUnreconciledOrders: overdueOrders.map((o) => sanitizeOrderSummaryDTO(o, callerRole, now)),

        recentlyExpiredCount: recentlyExpiredOrders.length,
        recentlyExpiredOrders: recentlyExpiredOrders.map((o) => sanitizeOrderSummaryDTO(o, callerRole, now)),
      },
    });
  } catch (error) {
    console.error("[AdminOrderOperations] getDeadlineMonitoring error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve deadline monitoring telemetry",
    });
  }
};

module.exports = {
  getOrderSummary,
  getOrders,
  getOrderById,
  getDeadlineMonitoring,
};
