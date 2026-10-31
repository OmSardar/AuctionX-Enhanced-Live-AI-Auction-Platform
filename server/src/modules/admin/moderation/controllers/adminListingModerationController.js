const Product = require("../../../products/models/productSchema");
const ReportAdmin = require("../models/reports");
const AdminAuditLog = require("../../disputes/models/adminAuditLog");
const Bid = require("../../../bidding/models/bidSchema");
const Order = require("../../../orders/models/orderSchema");
const SellerModel = require("../../../sellers/accounts/models/seller");
const UserModel = require("../../../users/models/user");
const crypto = require("crypto");
const mongoose = require("mongoose");

// Helper to escape regex special characters
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Standardized sanitization helper for listing records
 */
const sanitizeListingRecord = (product, reportCount = 0) => {
  const plain = product.toObject ? product.toObject() : { ...product };

  return {
    id: (plain._id || plain.id).toString(),
    _id: (plain._id || plain.id).toString(),
    name: plain.name,
    category: plain.category,
    sellerEmail: plain.email,
    mobileNumber: plain.mobileNumber,
    images: plain.images || [],
    thumbnail: plain.images?.[0]?.secure_url || "",
    biddingStartPrice: plain.biddingStartPrice || plain.startingPrice || 0,
    currentPrice: plain.currentPrice || plain.biddingStartPrice || 0,
    bidCount: plain.bidCount || 0,
    highestBidderEmail: plain.highestBidderEmail || null,
    highestBidderName: plain.highestBidderName || null,
    startTime: plain.startTime || plain.biddingStartDate || null,
    endTime: plain.endTime || plain.biddingEndTime || null,
    status: plain.status || "Active",
    isModerated: Boolean(plain.isModerated),
    moderationStatus: plain.moderationStatus || "ACTIVE",
    moderationReason: plain.moderationReason || "",
    moderatedAt: plain.moderatedAt || null,
    moderatedBy: plain.moderatedBy || null,
    moderationHistory: plain.moderationHistory || [],
    reportCount,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

/**
 * GET /api/admin/listings
 * Paginated directory of listings with search, multi-attribute filtering, and safe sorting.
 */
const getListings = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const {
      search,
      status,
      moderationStatus,
      category,
      hasReports,
      sellerEmail,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};

    // 1. Text Search across listing name, seller email, and category
    if (search && search.trim()) {
      const escaped = escapeRegex(search.trim());
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
        { category: { $regex: escaped, $options: "i" } },
      ];
    }

    // 2. Lifecycle Status filter
    if (status && status !== "ALL") {
      filter.status = status;
    }

    // 3. Moderation Status filter
    if (moderationStatus && moderationStatus !== "ALL") {
      filter.moderationStatus = moderationStatus;
    }

    // 4. Category filter
    if (category && category !== "ALL") {
      filter.category = category;
    }

    // 5. Seller email filter
    if (sellerEmail && sellerEmail.trim()) {
      filter.email = sellerEmail.trim().toLowerCase();
    }

    // 6. Report filter: Find product IDs with active reports if requested
    if (hasReports === "true") {
      const reportedProductIds = await ReportAdmin.distinct("productId", {
        productId: { $ne: null },
      });
      filter._id = { $in: reportedProductIds };
    }

    // Safe sorting fields
    const validSortFields = [
      "createdAt",
      "endTime",
      "currentPrice",
      "biddingStartPrice",
      "bidCount",
      "name",
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sortOption = { [sortField]: sortDirection };

    // Execute queries concurrently
    const [totalCount, products, reportAggregates] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort(sortOption).skip(skip).limit(limit).lean(),
      ReportAdmin.aggregate([
        { $match: { productId: { $ne: null } } },
        { $group: { _id: "$productId", count: { $sum: 1 } } },
      ]),
    ]);

    // Build report counts map
    const reportCountMap = {};
    for (const r of reportAggregates) {
      if (r._id) {
        reportCountMap[r._id.toString()] = r.count;
      }
    }

    const sanitizedListings = products.map((p) =>
      sanitizeListingRecord(p, reportCountMap[p._id.toString()] || 0)
    );

    // Summary counters for admin dashboard tab
    const [totalListings, activeListings, moderatedListings, pendingReports] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isModerated: false, status: { $in: ["Active", "LIVE"] } }),
      Product.countDocuments({ isModerated: true }),
      ReportAdmin.countDocuments({ status: { $in: ["pending", "in-progress"] } }),
    ]);

    return res.status(200).json({
      success: true,
      listings: sanitizedListings,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
        hasMore: page * limit < totalCount,
      },
      summary: {
        totalListings,
        activeListings,
        activeLiveCount: activeListings,
        moderatedListings,
        moderatedCount: moderatedListings,
        pendingReports,
        pendingReportsCount: pendingReports,
      },
    });
  } catch (error) {
    console.error("Admin listing directory error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching listing directory",
    });
  }
};

/**
 * GET /api/admin/listings/:id
 * Retrieve comprehensive details for a single listing including seller info,
 * associated reports, recent bids, order status, and moderation history.
 */
const getListingById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing identifier format",
      });
    }

    const product = await Product.findById(id).lean();
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    // Concurrently fetch seller, reports, bids, order, and audit logs
    const [seller, reports, recentBids, order, auditLogs] = await Promise.all([
      SellerModel.findOne({ email: product.email }).select("-password").lean().then((s) => {
        if (s) return s;
        return UserModel.findOne({ email: product.email }).select("-password").lean();
      }),
      ReportAdmin.find({
        $or: [{ productId: id }, { orderId: product.orderId ? product.orderId.toString() : null }],
      })
        .sort({ date: -1 })
        .lean(),
      Bid.find({ productId: id }).sort({ createdAt: -1 }).limit(10).lean(),
      Order.findOne({ productId: id }).lean(),
      AdminAuditLog.find({ targetAccountId: id }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const sanitized = sanitizeListingRecord(product, reports.length);

    return res.status(200).json({
      success: true,
      listing: sanitized,
      seller: seller
        ? {
            id: seller._id,
            name: seller.name,
            email: seller.email,
            storeName: seller.storeName || "",
            status: seller.status || "Active",
            phoneNo: seller.phoneNo || "",
            city: seller.city || "",
            country: seller.country || "",
          }
        : null,
      reports: reports.map((r) => ({
        ...r,
        reason: r.reason || r.report || r.reportType || "Catalog Grievance",
      })),
      recentBids,
      order: order
        ? {
            id: order._id,
            status: order.status,
            finalPrice: order.finalPrice,
            winnerEmail: order.userEmail,
            paidAt: order.paidAt,
          }
        : null,
      auditHistory: auditLogs,
    });
  } catch (error) {
    console.error("Admin listing detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching listing details",
    });
  }
};

/**
 * PATCH /api/admin/listings/:id/moderate
 * Admin governance action to remove, flag, or restore a listing.
 *
 * Auction Safety Invariants:
 * 1. Read-only role ('editor') cannot alter moderation state.
 * 2. Mandates & validates a meaningful reason (>= 5 characters).
 * 3. Never mutates or deletes bid history, winner data, or settlement records.
 * 4. Blocks restoring an auction to active bidding if its scheduled endTime has elapsed.
 * 5. Uses Two-Phase Intent & Compensating Rollback with idempotency key.
 */
const moderateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason, idempotencyKey } = req.body;

    // 1. Role permission enforcement
    if (req.role === "editor") {
      return res.status(403).json({
        success: false,
        message: "Editor role is read-only. Listing moderation is restricted to administrators.",
      });
    }

    // 2. Validate action input
    const validActions = ["REMOVE", "RESTORE", "FLAG"];
    if (!action || !validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: `Invalid action. Must be one of: ${validActions.join(", ")}`,
      });
    }

    // 3. Validate mandatory reason
    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "A meaningful reason (at least 5 characters) is required for listing moderation actions",
      });
    }

    // 4. Locate target product
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing identifier format",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    // 5. Invariant: Past-deadline auction restoration protection
    if (action === "RESTORE") {
      const now = new Date();
      const endTime = product.endTime ? new Date(product.endTime) : null;
      if (endTime && endTime <= now) {
        return res.status(400).json({
          success: false,
          message: "Cannot restore auction to LIVE state because its scheduled end time has already elapsed. Expired auctions cannot accept new bids.",
        });
      }
    }

    const actingAdminId = req.userId.toString();
    const actingEmail = req.adminEmail || "admin";

    // 6. Idempotency Key Determination
    const opKey =
      idempotencyKey ||
      req.headers["x-idempotency-key"] ||
      `admin-moderate-${actingAdminId}-${id}-${action}-${crypto
        .createHash("sha256")
        .update(reason.trim())
        .digest("hex")
        .slice(0, 16)}`;

    // Check for previous completed audit log (Idempotent replay must precede redundant check)
    const existingAudit = await AdminAuditLog.findOne({ idempotencyKey: opKey });
    if (existingAudit && existingAudit.outcome === "SUCCESS") {
      return res.status(200).json({
        success: true,
        message: `Listing moderation already committed (${action}) [idempotent replay]`,
        listing: sanitizeListingRecord(product),
        auditLog: existingAudit,
        isReplay: true,
      });
    }

    // 6b. Prevent redundant moderation actions if already in target state
    if (action === "REMOVE" && product.isModerated && product.moderationStatus === "REMOVED") {
      return res.status(400).json({
        success: false,
        message: "Listing is already moderated with status REMOVED",
      });
    }
    if (action === "RESTORE" && !product.isModerated && product.moderationStatus === "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Listing is already active and not moderated",
      });
    }

    const beforeStatus = product.moderationStatus || "ACTIVE";
    const targetModerationStatus =
      action === "REMOVE" ? "REMOVED" : action === "FLAG" ? "FLAGGED" : "ACTIVE";
    const targetIsModerated = action === "REMOVE";

    // 7. Phase 1 — Record Operation Intent in AdminAuditLog
    let auditLog = existingAudit;
    if (!auditLog) {
      try {
        auditLog = new AdminAuditLog({
          idempotencyKey: opKey,
          actingAdminId,
          actingAdminEmail: actingEmail,
          actingAdminModel: req.adminModel || "Admin",
          actingAdminRole: req.role,
          targetAccountId: id,
          targetAccountEmail: product.email,
          targetAccountType: "listing",
          action: action === "RESTORE" ? "RESTORE_LISTING" : "MODERATE_LISTING",
          reason: reason.trim(),
          beforeStatus,
          afterStatus: targetModerationStatus,
          outcome: "PENDING",
          ipAddress: req.ip || req.connection?.remoteAddress || "",
          userAgent: req.headers["user-agent"] || "",
          metadata: {
            listingName: product.name,
            action,
            originalAuctionStatus: product.status,
          },
        });
        await auditLog.save();
      } catch (intentErr) {
        console.error("Critical: Failed to record listing moderation audit intent:", intentErr);
        return res.status(500).json({
          success: false,
          message: "Failed to initialize administrative audit record. Listing was not modified.",
        });
      }
    }

    // 8. Phase 2 — Perform soft status update on target listing preserving invariants
    const previousIsModerated = product.isModerated;
    const previousModerationStatus = product.moderationStatus;
    const previousReason = product.moderationReason;

    try {
      product.isModerated = targetIsModerated;
      product.moderationStatus = targetModerationStatus;
      product.moderationReason = reason.trim();
      product.moderatedAt = new Date();
      product.moderatedBy = actingEmail;

      if (!product.moderationHistory) {
        product.moderationHistory = [];
      }
      product.moderationHistory.push({
        action,
        reason: reason.trim(),
        adminEmail: actingEmail,
        timestamp: new Date(),
      });

      await product.save();
    } catch (saveErr) {
      console.error("Critical: Failed to update product moderation state:", saveErr);
      auditLog.outcome = "FAILED";
      auditLog.failureReason = saveErr.message;
      auditLog.completedAt = new Date();
      await auditLog.save().catch(() => {});
      return res.status(500).json({
        success: false,
        message: `Failed to update listing: ${saveErr.message}`,
      });
    }

    // 9. Phase 3 — Finalize audit log (mark SUCCESS) or execute Compensating Rollback
    try {
      auditLog.outcome = "SUCCESS";
      auditLog.completedAt = new Date();
      await auditLog.save();
    } catch (auditFinalizeErr) {
      console.error("Critical: Audit finalization failed, executing compensating rollback on listing:", auditFinalizeErr);
      try {
        product.isModerated = previousIsModerated;
        product.moderationStatus = previousModerationStatus;
        product.moderationReason = previousReason;
        product.moderationHistory.pop(); // Remove aborted action
        await product.save();

        auditLog.outcome = "ROLLED_BACK";
        auditLog.failureReason = `Audit finalization failed: ${auditFinalizeErr.message}. Listing restored to previous moderation state.`;
        auditLog.completedAt = new Date();
        await auditLog.save().catch(() => {});
      } catch (rollbackErr) {
        console.error("Fatal: Product rollback failed after audit finalization failure:", rollbackErr);
        try {
          auditLog.outcome = "RECONCILIATION_REQUIRED";
          auditLog.failureReason = `FATAL: Audit finalization failed (${auditFinalizeErr.message}) AND compensating rollback failed (${rollbackErr.message}). Manual reconciliation required.`;
          auditLog.completedAt = new Date();
          auditLog.metadata = {
            ...(auditLog.metadata || {}),
            reconciliationNeeded: true,
            rollbackError: rollbackErr.message,
            auditFinalizeError: auditFinalizeErr.message,
            uncommittedListingState: {
              isModerated: product.isModerated,
              moderationStatus: product.moderationStatus,
            },
            targetPreviousState: {
              isModerated: previousIsModerated,
              moderationStatus: previousModerationStatus,
            },
          };
          await auditLog.save().catch(() => {});
        } catch (_) {}
      }

      return res.status(500).json({
        success: false,
        message: "Administrative action failed: audit trail could not be committed. Listing change could not be fully verified.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Listing successfully ${action === "REMOVE" ? "removed from discovery" : action === "RESTORE" ? "restored to active discovery" : "flagged for review"}`,
      listing: sanitizeListingRecord(product),
      auditLog,
    });
  } catch (error) {
    console.error("Admin listing moderation error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error moderating listing",
    });
  }
};

/**
 * GET /api/admin/listings/reports
 * Paginated reports directory with status, reportType, and search filters.
 */
const getReports = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const { status, reportType, search } = req.query;
    const filter = {};

    if (status && status !== "ALL") {
      filter.status = status;
    }

    if (reportType && reportType !== "ALL") {
      filter.reportType = reportType;
    }

    if (search && search.trim()) {
      const escaped = escapeRegex(search.trim());
      filter.$or = [
        { userName: { $regex: escaped, $options: "i" } },
        { userEmail: { $regex: escaped, $options: "i" } },
        { report: { $regex: escaped, $options: "i" } },
        { orderId: { $regex: escaped, $options: "i" } },
      ];
    }

    const [totalCount, reports] = await Promise.all([
      ReportAdmin.countDocuments(filter),
      ReportAdmin.find(filter)
        .populate("productId", "name images currentPrice status isModerated")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // Summary counts
    const [pendingReports, inProgressReports, resolvedReports, rejectedReports] = await Promise.all([
      ReportAdmin.countDocuments({ status: "pending" }),
      ReportAdmin.countDocuments({ status: "in-progress" }),
      ReportAdmin.countDocuments({ status: "resolved" }),
      ReportAdmin.countDocuments({ status: "rejected" }),
    ]);

    return res.status(200).json({
      success: true,
      reports: reports.map((r) => ({
        ...r,
        reason: r.reason || r.report || r.reportType || "Catalog Grievance",
      })),
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
        hasMore: page * limit < totalCount,
      },
      summary: {
        pendingReports,
        inProgressReports,
        resolvedReports,
        rejectedReports,
      },
    });
  } catch (error) {
    console.error("Admin get reports error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching user reports",
    });
  }
};

/**
 * GET /api/admin/listings/reports/:id
 * Retrieve single report details with linked listing.
 */
const getReportById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report identifier format",
      });
    }

    const report = await ReportAdmin.findById(id)
      .populate("productId", "name images currentPrice status email category")
      .lean();

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    return res.status(200).json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("Admin report detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching report details",
    });
  }
};

/**
 * PATCH /api/admin/listings/reports/:id/status
 * Transition report status with required resolution note and audit trail.
 */
const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote, idempotencyKey } = req.body;

    if (req.role === "editor") {
      return res.status(403).json({
        success: false,
        message: "Editor role is read-only. Report resolution is restricted to administrators.",
      });
    }

    const validStatuses = ["pending", "in-progress", "resolved", "closed", "rejected"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Require resolutionNote when closing, resolving, or rejecting
    if (["resolved", "closed", "rejected"].includes(status)) {
      if (!resolutionNote || typeof resolutionNote !== "string" || resolutionNote.trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: "A resolution note (at least 5 characters) is required when closing or resolving a report",
        });
      }
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report identifier format",
      });
    }

    const report = await ReportAdmin.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    const actingAdminId = req.userId.toString();
    const actingEmail = req.adminEmail || "admin";

    // Idempotency check
    const opKey =
      idempotencyKey ||
      req.headers["x-idempotency-key"] ||
      `admin-report-${actingAdminId}-${id}-${status}-${crypto
        .createHash("sha256")
        .update((resolutionNote || "").trim())
        .digest("hex")
        .slice(0, 16)}`;

    const existingAudit = await AdminAuditLog.findOne({ idempotencyKey: opKey });
    if (existingAudit && existingAudit.outcome === "SUCCESS") {
      return res.status(200).json({
        success: true,
        message: `Report status already updated to ${status} (idempotent replay)`,
        report,
        auditLog: existingAudit,
        isReplay: true,
      });
    }

    // Prevent redundant status transitions if already in requested state
    if (report.status === status) {
      return res.status(400).json({
        success: false,
        message: `Report is already in status '${status}'`,
      });
    }

    const beforeStatus = report.status || "pending";

    // Phase 1: Audit Intent
    let auditLog = existingAudit;
    if (!auditLog) {
      try {
        auditLog = new AdminAuditLog({
          idempotencyKey: opKey,
          actingAdminId,
          actingAdminEmail: actingEmail,
          actingAdminModel: req.adminModel || "Admin",
          actingAdminRole: req.role,
          targetAccountId: id,
          targetAccountEmail: report.userEmail,
          targetAccountType: "report",
          action: status === "rejected" ? "REJECT_REPORT" : "RESOLVE_REPORT",
          reason: (resolutionNote || `Status changed to ${status}`).trim(),
          beforeStatus,
          afterStatus: status,
          outcome: "PENDING",
          ipAddress: req.ip || req.connection?.remoteAddress || "",
          userAgent: req.headers["user-agent"] || "",
        });
        await auditLog.save();
      } catch (intentErr) {
        console.error("Critical: Failed to record report audit intent:", intentErr);
        return res.status(500).json({
          success: false,
          message: "Failed to initialize administrative audit record. Report was not modified.",
        });
      }
    }

    // Phase 2: Update Report
    const prevStatus = report.status;
    const prevNote = report.resolutionNote;
    try {
      report.status = status;
      report.resolutionNote = (resolutionNote || "").trim();
      report.resolvedBy = actingEmail;
      report.resolvedAt = new Date();
      await report.save();
    } catch (saveErr) {
      console.error("Critical: Failed to update report status:", saveErr);
      auditLog.outcome = "FAILED";
      auditLog.failureReason = saveErr.message;
      auditLog.completedAt = new Date();
      await auditLog.save().catch(() => {});
      return res.status(500).json({
        success: false,
        message: `Failed to update report: ${saveErr.message}`,
      });
    }

    // Phase 3: Finalize Audit Log or Rollback
    try {
      auditLog.outcome = "SUCCESS";
      auditLog.completedAt = new Date();
      await auditLog.save();
    } catch (auditErr) {
      console.error("Critical: Audit finalization failed, rolling back report update:", auditErr);
      try {
        report.status = prevStatus;
        report.resolutionNote = prevNote;
        await report.save();

        auditLog.outcome = "ROLLED_BACK";
        auditLog.failureReason = `Audit finalization failed: ${auditErr.message}. Report status rolled back.`;
        auditLog.completedAt = new Date();
        await auditLog.save().catch(() => {});
      } catch (rbErr) {
        console.error("Fatal: Compensating rollback failed on report:", rbErr);
        try {
          auditLog.outcome = "RECONCILIATION_REQUIRED";
          auditLog.failureReason = `FATAL: Audit finalization failed (${auditErr.message}) AND compensating rollback failed (${rbErr.message}). Manual reconciliation required.`;
          auditLog.completedAt = new Date();
          auditLog.metadata = {
            ...(auditLog.metadata || {}),
            reconciliationNeeded: true,
            rollbackError: rbErr.message,
            auditFinalizeError: auditErr.message,
            uncommittedReportState: { status: report.status },
            targetPreviousState: { status: prevStatus },
          };
          await auditLog.save().catch(() => {});
        } catch (_) {}
      }

      return res.status(500).json({
        success: false,
        message: "Administrative action failed: audit trail could not be committed. Report change could not be fully verified.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Report status updated to ${status}`,
      report,
      auditLog,
    });
  } catch (error) {
    console.error("Admin update report status error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error updating report status",
    });
  }
};

/**
 * GET /api/admin/listings/:id/audit-logs
 * Retrieve audit history specific to a listing.
 */
const getListingAuditLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [total, auditLogs] = await Promise.all([
      AdminAuditLog.countDocuments({ targetAccountId: id }),
      AdminAuditLog.find({ targetAccountId: id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    return res.status(200).json({
      success: true,
      auditLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Listing audit lookup error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve listing audit history",
    });
  }
};

module.exports = {
  getListings,
  getListingById,
  moderateListing,
  getReports,
  getReportById,
  updateReportStatus,
  getListingAuditLogs,
};
