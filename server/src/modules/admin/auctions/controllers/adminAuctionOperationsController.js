const mongoose = require("mongoose");
const Product = require("../../../products/models/productSchema");
const Bid = require("../../../bidding/models/bidSchema");
const Order = require("../../../orders/models/orderSchema");
const ScheduledBid = require("../../../bidding/models/scheduledBid");
const AdminAuditLog = require("../../disputes/models/adminAuditLog");
const { getSchedulerHealth } = require("../../../../infrastructure/scheduling/schedulerService");
const { normalizeAuctionBoundaries } = require("../../../auctions/services/lifecycleService");

// Helper to escape regex special characters
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Mask sensitive email for restricted roles (e.g. editor)
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
 * Mask IP address for restricted roles
 */
const maskIp = (ip) => {
  if (!ip) return "";
  return "xxx.xxx.xxx.xxx";
};

/**
 * Standardized sanitization DTO for auction operational view
 */
const sanitizeAuctionRecord = (product, callerRole = "admin") => {
  const plain = product.toObject ? product.toObject() : { ...product };
  const boundaries = normalizeAuctionBoundaries(plain);
  const isEditor = callerRole === "editor";

  // Compute clear lifecycle status label
  const now = new Date();
  const effectiveEnd = plain.endTime || boundaries.endTime;
  const effectiveStart = plain.startTime || boundaries.startTime;

  let computedLifecycleLabel = plain.status || "Active";
  if (plain.status === "SCHEDULED" && effectiveStart && effectiveStart <= now) {
    computedLifecycleLabel = "DUE_FOR_LAUNCH";
  } else if ((plain.status === "Active" || plain.status === "LIVE") && effectiveEnd && effectiveEnd <= now) {
    computedLifecycleLabel = "AWAITING_FINALIZATION";
  }

  return {
    id: (plain._id || plain.id).toString(),
    _id: (plain._id || plain.id).toString(),
    name: plain.name,
    category: plain.category,
    sellerEmail: isEditor ? maskEmail(plain.email) : plain.email,
    mobileNumber: isEditor ? "**********" : plain.mobileNumber,
    images: plain.images || [],
    thumbnail: plain.images?.[0]?.secure_url || "",
    biddingStartPrice: plain.biddingStartPrice || plain.startingPrice || 0,
    startingPrice: plain.startingPrice || plain.biddingStartPrice || 0,
    currentPrice: plain.currentPrice !== undefined ? plain.currentPrice : (plain.biddingStartPrice || 0),
    bidCount: plain.bidCount || 0,
    highestBidder: plain.highestBidder ? plain.highestBidder.toString() : null,
    highestBidderEmail: isEditor ? maskEmail(plain.highestBidderEmail) : (plain.highestBidderEmail || null),
    highestBidderName: plain.highestBidderName || null,
    // Canonical time boundaries
    startTime: effectiveStart,
    originalEndTime: plain.originalEndTime || boundaries.originalEndTime || null,
    endTime: effectiveEnd,
    maxExtensionDeadline: plain.maxExtensionDeadline || boundaries.maxExtensionDeadline || null,
    antiSnipeCount: plain.antiSnipeCount || 0,
    // Lifecycle & moderation state
    status: plain.status || "Active",
    lifecycleStatusLabel: computedLifecycleLabel,
    isModerated: Boolean(plain.isModerated),
    moderationStatus: plain.moderationStatus || "ACTIVE",
    moderationReason: plain.moderationReason || "",
    moderatedAt: plain.moderatedAt || null,
    moderatedBy: plain.moderatedBy || null,
    moderationHistory: plain.moderationHistory || [],
    // Finalization & settlement
    finalizedAt: plain.finalizedAt || null,
    paymentDeadline: plain.paymentDeadline || null,
    winnerId: plain.winnerId ? plain.winnerId.toString() : null,
    finalPrice: plain.finalPrice !== undefined ? plain.finalPrice : null,
    orderId: plain.orderId ? plain.orderId.toString() : null,
    reconciliationRequired: Boolean(plain.reconciliationRequired),
    reconciliationNotes: plain.reconciliationNotes || null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

/**
 * GET /api/admin/auctions
 * Paginated auction directory with multi-status filters, search, sorting, and bounded output.
 */
const getAuctions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const {
      search,
      lifecycleStatus,
      moderationStatus,
      category,
      reconciliationOnly,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};
    const now = new Date();

    // 1. Text Search across auction title, seller email, category, or exact ObjectId
    if (search && search.trim()) {
      const trimmed = search.trim();
      const escaped = escapeRegex(trimmed);
      const orClauses = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
        { category: { $regex: escaped, $options: "i" } },
      ];
      if (mongoose.Types.ObjectId.isValid(trimmed)) {
        orClauses.push({ _id: new mongoose.Types.ObjectId(trimmed) });
      }
      filter.$or = orClauses;
    }

    // 2. Lifecycle Status Filter (supports both canonical & legacy enums)
    if (lifecycleStatus && lifecycleStatus !== "ALL") {
      if (lifecycleStatus === "SCHEDULED") {
        filter.status = "SCHEDULED";
      } else if (lifecycleStatus === "LIVE") {
        filter.status = { $in: ["LIVE", "Active"] };
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [{ endTime: { $gt: now } }, { endTime: null }],
        });
      } else if (lifecycleStatus === "AWAITING_FINALIZATION") {
        filter.status = { $in: ["Active", "LIVE"] };
        filter.endTime = { $lte: now };
      } else if (lifecycleStatus === "ENDED" || lifecycleStatus === "Closed") {
        filter.status = { $in: ["Closed", "ENDED"] };
      } else {
        filter.status = lifecycleStatus;
      }
    }

    // 3. Moderation Status Filter
    if (moderationStatus && moderationStatus !== "ALL") {
      filter.moderationStatus = moderationStatus;
    }

    // 4. Category Filter
    if (category && category !== "ALL") {
      filter.category = category;
    }

    // 5. Reconciliation Required Filter
    if (reconciliationOnly === "true") {
      filter.reconciliationRequired = true;
    }

    // 6. Date Range Filtering (on createdAt or startTime)
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) dateFilter.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) dateFilter.$lte = end;
      }
      if (Object.keys(dateFilter).length > 0) {
        filter.createdAt = dateFilter;
      }
    }

    // Safe sorting
    const validSortFields = [
      "createdAt",
      "startTime",
      "endTime",
      "currentPrice",
      "biddingStartPrice",
      "bidCount",
      "name",
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sortOptions = { [sortField]: sortDirection };

    // Execute paginated queries + summary telemetry in parallel
    const [totalCount, products, summaryCounts] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort(sortOptions).skip(skip).limit(limit).lean(),
      Promise.all([
        Product.countDocuments(),
        Product.countDocuments({ status: "SCHEDULED" }),
        Product.countDocuments({
          status: { $in: ["Active", "LIVE"] },
          isModerated: { $ne: true },
          $or: [{ endTime: { $gt: now } }, { endTime: null }],
        }),
        Product.countDocuments({
          status: { $in: ["Active", "LIVE"] },
          endTime: { $lte: now },
        }),
        Product.countDocuments({ status: "AWAITING_PAYMENT" }),
        Product.countDocuments({ status: "SETTLED" }),
        Product.countDocuments({ status: "UNSOLD" }),
        Product.countDocuments({ status: { $in: ["Closed", "ENDED"] } }),
        Product.countDocuments({ reconciliationRequired: true }),
      ]),
    ]);

    const [
      totalListings,
      scheduledCount,
      liveCount,
      awaitingFinalizationCount,
      awaitingPaymentCount,
      settledCount,
      unsoldCount,
      endedCount,
      reconciliationRequiredCount,
    ] = summaryCounts;

    const callerRole = req.role || "admin";
    const sanitizedAuctions = products.map((p) => sanitizeAuctionRecord(p, callerRole));

    return res.status(200).json({
      success: true,
      auctions: sanitizedAuctions,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
        hasMore: page * limit < totalCount,
      },
      summary: {
        totalListings,
        scheduledCount,
        liveCount,
        awaitingFinalizationCount,
        awaitingPaymentCount,
        settledCount,
        unsoldCount,
        endedCount,
        reconciliationRequiredCount,
      },
    });
  } catch (error) {
    console.error("Admin get auctions error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching auction operational directory",
    });
  }
};

/**
 * GET /api/admin/auctions/:id
 * Retrieve single auction operational investigation detail including order, audit logs, and lifecycle timestamps.
 */
const getAuctionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid auction identifier format",
      });
    }

    const product = await Product.findById(id).lean();
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Auction listing not found",
      });
    }

    const callerRole = req.role || "admin";
    const isEditor = callerRole === "editor";

    // Concurrently fetch related order summary and administrative audit logs
    const [orderDoc, auditLogs] = await Promise.all([
      Order.findOne({
        $or: [{ productId: id }, ...(product.orderId ? [{ _id: product.orderId }] : [])],
      }).lean(),
      AdminAuditLog.find({ targetAccountId: id }).sort({ createdAt: -1 }).limit(25).lean(),
    ]);

    let orderSummary = null;
    if (orderDoc) {
      orderSummary = {
        orderId: orderDoc._id.toString(),
        status: orderDoc.status,
        finalPrice: orderDoc.finalPrice || orderDoc.highestBid || 0,
        paymentDeadline: orderDoc.paymentDeadline || null,
        paidAt: orderDoc.paidAt || null,
        paymentAttempts: orderDoc.paymentAttempts || 0,
        winnerEmail: isEditor ? maskEmail(orderDoc.userEmail) : orderDoc.userEmail,
        sellerEmail: isEditor ? maskEmail(orderDoc.sellerEmail) : orderDoc.sellerEmail,
      };
    }

    const sanitizedAuction = sanitizeAuctionRecord(product, callerRole);

    return res.status(200).json({
      success: true,
      auction: {
        ...sanitizedAuction,
        order: orderSummary,
        auditLogs: auditLogs.map((log) => ({
          id: log._id.toString(),
          actingAdminEmail: log.actingAdminEmail,
          actingAdminRole: log.actingAdminRole,
          action: log.action,
          reason: log.reason,
          beforeStatus: log.beforeStatus,
          afterStatus: log.afterStatus,
          outcome: log.outcome,
          failureReason: log.failureReason,
          completedAt: log.completedAt || log.createdAt,
          ipAddress: isEditor ? maskIp(log.ipAddress) : log.ipAddress,
          metadata: log.metadata || {},
        })),
      },
    });
  } catch (error) {
    console.error("Admin get auction details error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching auction operational details",
    });
  }
};

/**
 * GET /api/admin/auctions/:id/bids
 * Retrieve paginated authoritative historical bids for an auction.
 */
const getAuctionBids = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid auction identifier format",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const callerRole = req.role || "admin";
    const isEditor = callerRole === "editor";

    const [totalCount, bids] = await Promise.all([
      Bid.countDocuments({ productId: id }),
      Bid.find({ productId: id })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const sanitizedBids = bids.map((b) => ({
      id: b._id.toString(),
      bidderId: b.bidder ? b.bidder.toString() : null,
      bidderEmail: isEditor ? maskEmail(b.bidderEmail) : b.bidderEmail,
      bidderName: b.bidderName,
      amount: b.amount,
      currency: b.currency || "INR",
      status: b.status,
      createdAt: b.createdAt,
      ipAddress: isEditor ? maskIp(b.ipAddress) : (b.ipAddress || ""),
    }));

    return res.status(200).json({
      success: true,
      bids: sanitizedBids,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
        hasMore: page * limit < totalCount,
      },
    });
  } catch (error) {
    console.error("Admin get auction bids error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching auction bid history",
    });
  }
};

/**
 * GET /api/admin/auctions/lifecycle/telemetry
 * Retrieve real-time lifecycle queue health, engine status, and reconciliation alerts.
 */
const getLifecycleTelemetry = async (req, res) => {
  try {
    const now = new Date();
    const schedulerHealth = getSchedulerHealth();

    // Query queue statuses
    const [
      awaitingLaunchCount,
      scheduledUpcomingCount,
      activeLiveCount,
      pendingFinalizationCount,
      awaitingPaymentCount,
      settledCount,
      unsoldCount,
      reconciliationRequiredAuctionsCount,
      reconciliationRequiredAuditCount,
      scheduledBidsPending,
      scheduledBidsExecuted,
      scheduledBidsFailed,
      reconciliationAudits,
      reconciliationAuctions,
    ] = await Promise.all([
      Product.countDocuments({
        status: "SCHEDULED",
        startTime: { $lte: now },
      }),
      Product.countDocuments({
        status: "SCHEDULED",
        startTime: { $gt: now },
      }),
      Product.countDocuments({
        status: { $in: ["Active", "LIVE"] },
        $or: [{ endTime: { $gt: now } }, { endTime: null }],
      }),
      Product.countDocuments({
        status: { $in: ["Active", "LIVE"] },
        endTime: { $lte: now },
      }),
      Product.countDocuments({ status: "AWAITING_PAYMENT" }),
      Product.countDocuments({ status: "SETTLED" }),
      Product.countDocuments({ status: "UNSOLD" }),
      Product.countDocuments({ reconciliationRequired: true }),
      AdminAuditLog.countDocuments({ outcome: "RECONCILIATION_REQUIRED" }),
      ScheduledBid.countDocuments({ status: "PENDING" }),
      ScheduledBid.countDocuments({ status: "EXECUTED" }),
      ScheduledBid.countDocuments({ status: "FAILED" }),
      AdminAuditLog.find({ outcome: "RECONCILIATION_REQUIRED" })
        .sort({ completedAt: -1, createdAt: -1 })
        .limit(10)
        .lean(),
      Product.find({ reconciliationRequired: true })
        .select("_id name email status moderationStatus reconciliationNotes updatedAt")
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      timestamp: now.toISOString(),
      scheduler: schedulerHealth,
      queues: {
        awaitingLaunchCount,
        scheduledUpcomingCount,
        activeLiveCount,
        pendingFinalizationCount,
        awaitingPaymentCount,
        settledCount,
        unsoldCount,
        reconciliationRequiredAuctionsCount,
        reconciliationRequiredAuditCount,
      },
      scheduledBids: {
        pendingCount: scheduledBidsPending,
        executedCount: scheduledBidsExecuted,
        failedCount: scheduledBidsFailed,
      },
      reconciliationAlerts: {
        auditLogs: reconciliationAudits.map((a) => ({
          id: a._id.toString(),
          actingAdminEmail: a.actingAdminEmail,
          targetAccountId: a.targetAccountId,
          action: a.action,
          failureReason: a.failureReason,
          timestamp: a.completedAt || a.createdAt,
          metadata: a.metadata || {},
        })),
        auctions: reconciliationAuctions.map((p) => ({
          id: p._id.toString(),
          name: p.name,
          sellerEmail: p.email,
          status: p.status,
          reconciliationNotes: p.reconciliationNotes,
          updatedAt: p.updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error("Admin get lifecycle telemetry error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching lifecycle telemetry",
    });
  }
};

/**
 * GET /api/admin/auctions/scheduled-bids
 * Retrieve paginated scheduled bids directory for operational diagnostics.
 */
const getScheduledBidsDirectory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    const { status, search } = req.query;
    const filter = {};

    if (status && status !== "ALL") {
      filter.status = status;
    }

    if (search && search.trim()) {
      const escaped = escapeRegex(search.trim());
      filter.$or = [
        { userEmail: { $regex: escaped, $options: "i" } },
        { userName: { $regex: escaped, $options: "i" } },
      ];
    }

    const callerRole = req.role || "admin";
    const isEditor = callerRole === "editor";

    const [totalCount, scheduledBids] = await Promise.all([
      ScheduledBid.countDocuments(filter),
      ScheduledBid.find(filter)
        .populate("productId", "name status currentPrice")
        .sort({ targetTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const sanitizedBids = scheduledBids.map((b) => ({
      id: b._id.toString(),
      userEmail: isEditor ? maskEmail(b.userEmail) : b.userEmail,
      userName: b.userName,
      amount: b.amount,
      targetTime: b.targetTime,
      status: b.status,
      failureReason: b.failureReason || null,
      executedBidId: b.executedBidId ? b.executedBidId.toString() : null,
      product: b.productId
        ? {
            id: b.productId._id ? b.productId._id.toString() : b.productId.toString(),
            name: b.productId.name || "Unknown Listing",
            status: b.productId.status || "Unknown",
            currentPrice: b.productId.currentPrice || 0,
          }
        : null,
      createdAt: b.createdAt,
    }));

    return res.status(200).json({
      success: true,
      scheduledBids: sanitizedBids,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
        hasMore: page * limit < totalCount,
      },
    });
  } catch (error) {
    console.error("Admin get scheduled bids error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching scheduled bids directory",
    });
  }
};

module.exports = {
  getAuctions,
  getAuctionById,
  getAuctionBids,
  getLifecycleTelemetry,
  getScheduledBidsDirectory,
};
