const mongoose = require("mongoose");
const ReportAdmin = require("../../moderation/models/reports");
const Order = require("../../../orders/models/orderSchema");
const Product = require("../../../products/models/productSchema");
const Payment = require("../../../payments/models/Payment");
const Bid = require("../../../bidding/models/bidSchema");
const AdminAuditLog = require("../models/adminAuditLog");
const AdminInternalNote = require("../models/adminInternalNote");
const Admin = require("../../authentication/models/admin");
const { normalizeAuctionBoundaries } = require("../../../auctions/services/lifecycleService");

// Helper to escape regex special characters
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Helper to sanitize internal note content
const sanitizeNoteContent = (content) => {
  if (!content || typeof content !== "string") return "";
  return content
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/(?:^|[^a-zA-Z0-9])on[a-zA-Z]+\s*=/gi, (match) => (match.startsWith("o") || match.startsWith("O") ? "" : match[0]))
    .replace(/[<>]/g, (char) => (char === "<" ? "&lt;" : "&gt;"))
    .trim();
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
 * Standardized sanitization DTO for dispute/report directory records
 */
const sanitizeDisputeSummaryDTO = (report, callerRole = "admin") => {
  const isEditor = callerRole === "editor";

  // Derive high-level case category
  let caseCategory = "OTHER";
  if (report.reportType === "delivery") caseCategory = "ORDER_DELIVERY_DISPUTE";
  else if (report.reportType === "payment-deposit" || report.reportType === "payment-withdraw")
    caseCategory = "PAYMENT_TRANSACTION_DISPUTE";
  else if (report.reportType === "illegal") caseCategory = "LISTING_MODERATION_REPORT";

  return {
    id: (report._id || report.id).toString(),
    _id: (report._id || report.id).toString(),
    reportType: report.reportType || "other",
    caseCategory,
    status: report.status || "pending",
    reportText: isEditor && report.report && report.report.length > 120
      ? `${report.report.slice(0, 120)}...`
      : report.report || "",
    fullReportText: isEditor ? null : report.report || "",
    reason: report.reason || "",
    customReason: report.customReason || "",
    resolutionNote: report.resolutionNote || "",
    resolvedBy: isEditor && report.resolvedBy ? maskEmail(report.resolvedBy) : report.resolvedBy || null,
    resolvedAt: report.resolvedAt ? new Date(report.resolvedAt).toISOString() : null,
    date: report.date ? new Date(report.date).toISOString() : null,
    createdAt: report.date ? new Date(report.date).toISOString() : null,

    // Complainant / Reporter Info
    reporter: {
      name: isEditor && report.userName ? `${report.userName.charAt(0)}***` : report.userName || "Anonymous",
      email: isEditor ? maskEmail(report.userEmail) : report.userEmail || "",
    },

    // Reported Seller Info
    seller: {
      email: isEditor ? maskEmail(report.sellerEmail) : report.sellerEmail || null,
    },

    // Linked Identifiers & Context Flags
    orderId: report.orderId || null,
    productId: report.productId ? report.productId.toString() : null,
    hasLinkedOrder: Boolean(report.orderId),
    hasLinkedProduct: Boolean(report.productId),
    hasAttachments: Boolean(report.attachments && report.attachments.length > 0),
    attachmentCount: report.attachments ? report.attachments.length : 0,
  };
};

/**
 * GET /api/admin/disputes/summary
 * Aggregate metrics for disputes, complaints, listing reports, and contested orders
 */
const getDisputeSummary = async (req, res) => {
  try {
    const [
      totalCases,
      unresolvedCount,
      resolvedCount,
      closedCount,
      rejectedCount,
      deliveryDisputes,
      paymentDepositDisputes,
      paymentWithdrawDisputes,
      listingReports,
      otherComplaints,
      attachmentCasesCount,
      ordersWithReportsCount,
    ] = await Promise.all([
      ReportAdmin.countDocuments({}),
      ReportAdmin.countDocuments({ status: { $in: ["pending", "in-progress"] } }),
      ReportAdmin.countDocuments({ status: "resolved" }),
      ReportAdmin.countDocuments({ status: "closed" }),
      ReportAdmin.countDocuments({ status: "rejected" }),
      ReportAdmin.countDocuments({ reportType: "delivery" }),
      ReportAdmin.countDocuments({ reportType: "payment-deposit" }),
      ReportAdmin.countDocuments({ reportType: "payment-withdraw" }),
      ReportAdmin.countDocuments({ reportType: "illegal" }),
      ReportAdmin.countDocuments({ reportType: "other" }),
      ReportAdmin.countDocuments({ "attachments.0": { $exists: true } }),
      ReportAdmin.distinct("orderId", {
        orderId: { $exists: true, $ne: null, $nin: ["", "undefined"] },
        status: { $in: ["pending", "in-progress"] },
      }),
    ]);

    // Payment reconciliation flags
    const reconciliationPaymentsCount = await Payment.countDocuments({
      status: { $in: ["REQUIRES_RECONCILIATION", "FAILED"] },
    });

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalCases,
        unresolvedCount,
        resolvedCount,
        closedCount,
        rejectedCount,
        types: {
          deliveryDisputes,
          paymentDisputes: paymentDepositDisputes + paymentWithdrawDisputes,
          paymentDepositDisputes,
          paymentWithdrawDisputes,
          listingReports,
          otherComplaints,
        },
        attachmentCasesCount,
        contestedOrdersCount: ordersWithReportsCount.length,
        reconciliationPaymentsCount,
      },
    });
  } catch (error) {
    console.error("[AdminDisputeOperations] getDisputeSummary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to aggregate dispute and complaint telemetry",
    });
  }
};

/**
 * GET /api/admin/disputes
 * Paginated disputes and complaints directory with bounded limits, multi-filter, search, and sorting.
 */
const getDisputes = async (req, res) => {
  try {
    const callerRole = req.admin?.role || req.user?.role || "admin";

    // 1. Pagination validation
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 100) limit = 100; // Hard boundary

    const skip = (page - 1) * limit;

    // 2. Build multi-filter query
    const filter = {};

    // Status filter
    const statusParam = req.query.status ? req.query.status.toLowerCase() : "all";
    if (statusParam !== "all") {
      if (["pending", "in-progress", "resolved", "closed", "rejected"].includes(statusParam)) {
        filter.status = statusParam;
      }
    }

    // Type / Category filter
    const categoryParam = req.query.category || req.query.reportType || "all";
    if (categoryParam !== "all") {
      if (categoryParam === "order_disputes") {
        filter.reportType = { $in: ["delivery", "payment-deposit", "payment-withdraw"] };
      } else if (categoryParam === "payment_disputes") {
        filter.reportType = { $in: ["payment-deposit", "payment-withdraw"] };
      } else if (categoryParam === "listing_reports") {
        filter.reportType = "illegal";
      } else if (["delivery", "illegal", "payment-deposit", "payment-withdraw", "other"].includes(categoryParam)) {
        filter.reportType = categoryParam;
      }
    }

    // Has linked order filter
    if (req.query.hasOrder === "true") {
      filter.$or = [
        { orderId: { $exists: true, $ne: null, $nin: ["", "undefined"] } },
        { productId: { $exists: true, $ne: null } },
      ];
    }

    // Has attachments filter
    if (req.query.hasAttachments === "true") {
      filter["attachments.0"] = { $exists: true };
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) {
        const start = new Date(req.query.startDate);
        if (!isNaN(start.getTime())) filter.date.$gte = start;
      }
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        if (!isNaN(end.getTime())) filter.date.$lte = end;
      }
    }

    // Search query
    if (req.query.search && req.query.search.trim()) {
      const term = req.query.search.trim();
      if (mongoose.Types.ObjectId.isValid(term)) {
        filter.$or = [
          { _id: new mongoose.Types.ObjectId(term) },
          { productId: new mongoose.Types.ObjectId(term) },
        ];
      } else {
        const escaped = escapeRegex(term);
        const searchRegex = new RegExp(escaped, "i");
        filter.$or = [
          { report: searchRegex },
          { userEmail: searchRegex },
          { userName: searchRegex },
          { sellerEmail: searchRegex },
          { orderId: searchRegex },
          { reason: searchRegex },
        ];
      }
    }

    // 3. Safe sorting
    const allowedSortFields = ["date", "status", "reportType", "resolvedAt"];
    let sortBy = req.query.sortBy || "date";
    if (!allowedSortFields.includes(sortBy)) sortBy = "date";

    let sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const sort = { [sortBy]: sortOrder, _id: sortOrder };

    // 4. Query database
    const [total, rawReports] = await Promise.all([
      ReportAdmin.countDocuments(filter),
      ReportAdmin.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const disputes = rawReports.map((r) => sanitizeDisputeSummaryDTO(r, callerRole));

    return res.status(200).json({
      success: true,
      disputes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("[AdminDisputeOperations] getDisputes error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve disputes directory",
    });
  }
};

/**
 * GET /api/admin/disputes/:id
 * Single dispute / complaint investigation view.
 * Integrates linked Order details, Payment records, Auction context, Bids, Evidence,
 * and related Audit logs with strict role-appropriate masking.
 */
const getDisputeById = async (req, res) => {
  try {
    const { id } = req.params;
    const callerRole = req.admin?.role || req.user?.role || "admin";
    const isEditor = callerRole === "editor";

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Case / Report ID format",
      });
    }

    // 1. Fetch ReportAdmin document
    const report = await ReportAdmin.findById(id).lean();
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Dispute or report case not found",
      });
    }

    // 2. Fetch Linked Order (if orderId or productId is present)
    let linkedOrder = null;
    let orderInconsistency = null;

    if (report.orderId && report.orderId.trim() !== "") {
      const trimmedOrderId = report.orderId.trim();
      if (mongoose.Types.ObjectId.isValid(trimmedOrderId)) {
        linkedOrder = await Order.findById(trimmedOrderId).lean();
      }
      if (!linkedOrder) {
        // Fallback search by razorpayOrderId or title
        linkedOrder = await Order.findOne({
          $or: [{ razorpayOrderId: trimmedOrderId }, { title: trimmedOrderId }],
        }).lean();
      }
      if (!linkedOrder) {
        orderInconsistency = "ORPHANED_ORDER_REFERENCE: The specified order ID does not exist in the database.";
      }
    } else if (report.productId) {
      linkedOrder = await Order.findOne({ productId: report.productId }).lean();
    }

    // 3. Fetch Linked Payments
    let linkedPayments = [];
    const paymentQueries = [];
    if (linkedOrder) paymentQueries.push({ orderId: linkedOrder._id });
    if (report.productId) paymentQueries.push({ productId: report.productId });

    if (paymentQueries.length > 0) {
      linkedPayments = await Payment.find({ $or: paymentQueries })
        .sort({ createdAt: -1 })
        .lean();
    }

    // 4. Fetch Linked Product / Auction
    let linkedProduct = null;
    let auctionBoundaries = null;
    const targetProductId = report.productId || linkedOrder?.productId;

    if (targetProductId) {
      linkedProduct = await Product.findById(targetProductId).lean();
      if (linkedProduct) {
        auctionBoundaries = normalizeAuctionBoundaries(linkedProduct);
      }
    }

    // 5. Fetch Authoritative Accepted Bids
    let acceptedBids = [];
    if (targetProductId) {
      acceptedBids = await Bid.find({
        productId: targetProductId,
        status: "ACCEPTED",
      })
        .sort({ amount: -1, createdAt: -1 })
        .limit(3)
        .lean();
    }

    // 6. Fetch Related Admin Audit Logs
    const auditTargetIds = [report._id.toString()];
    if (report.orderId) auditTargetIds.push(report.orderId);
    if (targetProductId) auditTargetIds.push(targetProductId.toString());

    const auditLogs = await AdminAuditLog.find({
      targetAccountId: { $in: auditTargetIds },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // 7. Detect Payment vs Order Inconsistencies
    const inconsistencies = [];
    if (orderInconsistency) {
      inconsistencies.push({
        code: "ORPHANED_ORDER_REFERENCE",
        severity: "WARNING",
        message: orderInconsistency,
      });
    }

    if (linkedOrder && linkedPayments.length > 0) {
      const capturedPayment = linkedPayments.find((p) => p.status === "CAPTURED");
      if (capturedPayment && linkedOrder.status !== "PAID") {
        inconsistencies.push({
          code: "PAYMENT_ORDER_STATUS_MISMATCH",
          severity: "CRITICAL",
          message: `Payment ${capturedPayment._id} is CAPTURED, but Order status is ${linkedOrder.status}. Reconciliation required.`,
        });
      }
    }

    if (report.reportType === "delivery" && linkedOrder && linkedOrder.status !== "PAID") {
      inconsistencies.push({
        code: "DELIVERY_DISPUTE_ON_UNPAID_ORDER",
        severity: "INFO",
        message: `Delivery complaint filed for an order in status '${linkedOrder.status}' (not yet settled).`,
      });
    }

    // 8. Fetch Internal Investigation Notes
    const internalNotes = await AdminInternalNote.find({ caseId: report._id })
      .sort({ createdAt: -1 })
      .lean();

    // 9. Assemble Investigation DTO
    const caseDTO = {
      case: {
        id: report._id.toString(),
        _id: report._id.toString(),
        reportType: report.reportType || "other",
        status: report.status || "pending",
        reportText: report.report || "",
        reason: report.reason || "",
        customReason: report.customReason || "",
        resolutionNote: report.resolutionNote || "",
        resolvedBy: isEditor && report.resolvedBy ? maskEmail(report.resolvedBy) : report.resolvedBy || null,
        resolvedAt: report.resolvedAt ? new Date(report.resolvedAt).toISOString() : null,
        date: report.date ? new Date(report.date).toISOString() : null,

        // Reporter
        reporter: {
          name: isEditor && report.userName ? `${report.userName.charAt(0)}***` : report.userName || "Anonymous",
          email: isEditor ? maskEmail(report.userEmail) : report.userEmail || "",
        },

        // Reported Seller
        seller: {
          email: isEditor ? maskEmail(report.sellerEmail) : report.sellerEmail || null,
        },

        // Evidence Attachments
        attachments: (report.attachments || []).map((att) => ({
          secure_url: att.secure_url,
          public_id: att.public_id,
        })),
        hasAttachments: Boolean(report.attachments && report.attachments.length > 0),
      },

      // Linked Order Context
      order: linkedOrder
        ? {
            id: linkedOrder._id.toString(),
            title: linkedOrder.title,
            status: linkedOrder.status,
            finalPrice: linkedOrder.finalPrice || linkedOrder.highestBid || 0,
            paymentDeadline: linkedOrder.paymentDeadline
              ? new Date(linkedOrder.paymentDeadline).toISOString()
              : null,
            winnerEmail: isEditor ? maskEmail(linkedOrder.userEmail) : linkedOrder.userEmail,
            sellerEmail: isEditor ? maskEmail(linkedOrder.sellerEmail) : linkedOrder.sellerEmail,
            phoneNo: isEditor ? maskPhone(linkedOrder.phoneNo) : linkedOrder.phoneNo,
            shippingAddress: isEditor ? maskAddress(linkedOrder.address) : linkedOrder.address,
            paidAt: linkedOrder.paidAt ? new Date(linkedOrder.paidAt).toISOString() : null,

            // Stage 7 Dispute Hold State
            isDisputeHoldActive: Boolean(linkedOrder.isDisputeHoldActive),
            disputeHolds: (linkedOrder.disputeHolds || []).map((h) => ({
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
            activeHoldForThisCase:
              (linkedOrder.disputeHolds || []).find(
                (h) => h.caseId?.toString() === report._id.toString() && h.status === "ACTIVE"
              ) || null,
            activeHoldsCount: (linkedOrder.disputeHolds || []).filter((h) => h.status === "ACTIVE").length,
            blockedTransitions: linkedOrder.isDisputeHoldActive
              ? [
                  "AUTOMATED_PAYMENT_DEADLINE_EXPIRATION",
                  "SELLER_FULFILLMENT_COMPLETION",
                  "ORDER_CANCELLATION",
                  "SETTLEMENT_FINALIZATION",
                ]
              : [],
          }
        : null,

      // Linked Product / Auction Context
      auction: linkedProduct
        ? {
            id: linkedProduct._id.toString(),
            name: linkedProduct.name,
            status: linkedProduct.status,
            moderationStatus: linkedProduct.moderationStatus || "ACTIVE",
            currentPrice: linkedProduct.currentPrice || 0,
            bidCount: linkedProduct.bidCount || 0,
            startTime: auctionBoundaries?.startTime ? auctionBoundaries.startTime.toISOString() : null,
            endTime: auctionBoundaries?.endTime ? auctionBoundaries.endTime.toISOString() : null,
            antiSnipingExtensionsCount: linkedProduct.antiSnipingExtensionsCount || 0,
          }
        : null,

      // Authoritative Bids
      topBids: acceptedBids.map((b) => ({
        id: b._id.toString(),
        amount: b.amount,
        bidderEmail: isEditor ? maskEmail(b.bidderEmail) : b.bidderEmail,
        bidderName: isEditor && b.bidderName ? `${b.bidderName.charAt(0)}***` : b.bidderName,
        createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
      })),

      // Linked Payment Ledger
      payments: linkedPayments.map((p) => ({
        id: p._id.toString(),
        type: p.type,
        amountInRupees: p.amount ? p.amount / 100 : 0,
        currency: p.currency,
        status: p.status,
        razorpayOrderId: p.razorpayOrderId,
        razorpayPaymentId: p.razorpayPaymentId,
        verifiedVia: p.verifiedVia,
        failureReason: p.failureReason,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      })),

      // Internal Investigation Notes
      internalNotes: (internalNotes || []).map((note) => ({
        id: note._id.toString(),
        caseId: note.caseId.toString(),
        authorEmail: isEditor ? maskEmail(note.authorEmail) : note.authorEmail,
        authorRole: note.authorRole,
        content: note.content,
        createdAt: note.createdAt ? new Date(note.createdAt).toISOString() : null,
      })),

      // Audit Logs
      auditLogs: auditLogs.map((log) => ({
        id: log._id.toString(),
        action: log.action,
        actingAdminEmail: log.actingAdminEmail,
        actingAdminRole: log.actingAdminRole,
        reason: log.reason,
        outcome: log.outcome,
        completedAt: log.completedAt ? new Date(log.completedAt).toISOString() : log.createdAt,
      })),

      // Inconsistencies & Alerts
      inconsistencies,

      // Documented Gaps & Governance Invariants
      governance: {
        messagingCapability: {
          supported: false,
          notes: "In-app direct buyer/seller chat is not implemented in the current backend. Evidence is restricted to uploaded attachments.",
        },
        resolutionPolicy:
          "Read-only operational view. Automatic refunds, balance adjustments, payment state mutations, and winner substitutions are strictly disabled in this stage.",
      },
    };

    return res.status(200).json({
      success: true,
      data: caseDTO,
    });
  } catch (error) {
    console.error("[AdminDisputeOperations] getDisputeById error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve case investigation details",
    });
  }
};

/**
 * GET /api/admin/disputes/contested/orders
 * Dedicated view for orders that have active reports or payment reconciliation alerts attached
 */
const getContestedOrders = async (req, res) => {
  try {
    const callerRole = req.admin?.role || req.user?.role || "admin";
    const isEditor = callerRole === "editor";

    // 1. Find all active delivery or payment reports with an orderId or productId
    const activeReports = await ReportAdmin.find({
      status: { $in: ["pending", "in-progress"] },
      $or: [
        { orderId: { $exists: true, $ne: null, $nin: ["", "undefined"] } },
        { productId: { $exists: true, $ne: null } },
      ],
    })
      .sort({ date: -1 })
      .limit(50)
      .lean();

    const contestedList = [];

    for (const rep of activeReports) {
      let order = null;
      if (rep.orderId && mongoose.Types.ObjectId.isValid(rep.orderId)) {
        order = await Order.findById(rep.orderId).lean();
      }
      if (!order && rep.productId) {
        order = await Order.findOne({ productId: rep.productId }).lean();
      }

      contestedList.push({
        caseId: rep._id.toString(),
        reportType: rep.reportType,
        reportDate: rep.date ? new Date(rep.date).toISOString() : null,
        complaintSummary: rep.report,
        reporterEmail: isEditor ? maskEmail(rep.userEmail) : rep.userEmail,
        orderId: rep.orderId || order?._id.toString() || null,
        orderTitle: order?.title || "Item details unavailable",
        orderStatus: order?.status || "UNKNOWN",
        finalPrice: order?.finalPrice || order?.highestBid || 0,
        hasOrder: Boolean(order),
        isDisputeHoldActive: Boolean(order?.isDisputeHoldActive),
      });
    }

    return res.status(200).json({
      success: true,
      count: contestedList.length,
      contestedOrders: contestedList,
    });
  } catch (error) {
    console.error("[AdminDisputeOperations] getContestedOrders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve contested orders",
    });
  }
};

/**
 * POST /api/admin/disputes/:id/hold
 * Places an authoritative dispute hold on the order linked to this case.
 * Enforces 3-phase recoverable audit intent protocol.
 */
const placeDisputeHold = async (req, res) => {
  try {
    const actingRole = req.role || req.adminRole || req.user?.role || "admin";
    if (actingRole === "editor") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: 'editor' role has read-only access and cannot place dispute holds",
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Case / Report ID format" });
    }

    const report = await ReportAdmin.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Dispute case not found" });
    }

    if (!report.orderId || report.orderId.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Dispute case does not reference a linked order. Hold can only be placed on an order.",
      });
    }

    let order = null;
    const trimmedOrderId = report.orderId.trim();
    if (mongoose.Types.ObjectId.isValid(trimmedOrderId)) {
      order = await Order.findById(trimmedOrderId);
    }
    if (!order) {
      order = await Order.findOne({
        $or: [{ razorpayOrderId: trimmedOrderId }, { title: trimmedOrderId }],
      });
    }
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Linked order not found in database. Hold cannot be placed on an orphaned order reference.",
      });
    }

    const { reason, idempotencyKey } = req.body;
    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "A meaningful hold reason (at least 5 characters) is required.",
      });
    }
    if (reason.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Hold reason exceeds maximum allowed length of 500 characters.",
      });
    }

    const opKey = idempotencyKey ? `HOLD_${id}_${order._id}_${idempotencyKey.trim()}` : null;
    let existingAudit = null;
    if (opKey) {
      existingAudit = await AdminAuditLog.findOne({ idempotencyKey: opKey });
      if (existingAudit) {
        // Verify action matches original intent
        if (existingAudit.action !== "PLACE_DISPUTE_HOLD") {
          return res.status(409).json({
            success: false,
            message: `Conflict: Idempotency key '${idempotencyKey}' was previously registered for action '${existingAudit.action}', not 'PLACE_DISPUTE_HOLD'.`,
          });
        }
        // Verify target order and case match original intent
        if (
          (existingAudit.targetAccountId && existingAudit.targetAccountId !== order._id.toString()) ||
          (existingAudit.metadata?.caseId && existingAudit.metadata.caseId !== id)
        ) {
          return res.status(409).json({
            success: false,
            message: "Conflict: Idempotency key targets a different order or dispute case.",
          });
        }

        if (existingAudit.outcome === "SUCCESS") {
          const targetHoldId = existingAudit.metadata?.holdId;
          const existingHold = (order.disputeHolds || []).find((h) =>
            targetHoldId ? h.holdId === targetHoldId : h.caseId?.toString() === id && h.status === "ACTIVE"
          );
          return res.status(200).json({
            success: true,
            message: "Dispute hold already placed (idempotent replay)",
            isReplay: true,
            hold: existingHold || null,
            order: {
              id: order._id.toString(),
              isDisputeHoldActive: order.isDisputeHoldActive,
              status: order.status,
            },
          });
        }
        if (existingAudit.outcome === "RECONCILIATION_REQUIRED") {
          return res.status(409).json({
            success: false,
            reconciliationRequired: true,
            message: "Conflict: Prior dispute hold attempt entered an ambiguous failure state and requires administrative reconciliation.",
            auditLogId: existingAudit._id.toString(),
          });
        }
        if (existingAudit.outcome === "PENDING") {
          // Ambiguous state recovery: verify if this specific hold was persisted prior to process stop
          const targetHoldId = existingAudit.metadata?.holdId;
          let matchingHold = null;

          if (targetHoldId) {
            matchingHold = (order.disputeHolds || []).find((h) => h.holdId === targetHoldId);
          } else {
            // targetHoldId was not recorded on pending audit.
            // Check if authoritative persisted state matches the exact intended mutation
            const caseHolds = (order.disputeHolds || []).filter((h) => h.caseId?.toString() === id);
            if (caseHolds.length === 1 && caseHolds[0].status === "ACTIVE") {
              const candidate = caseHolds[0];
              const reasonMatches = !existingAudit.reason || candidate.reason === existingAudit.reason;
              const actorMatches = !existingAudit.actingAdminId || candidate.placedBy?.adminId === existingAudit.actingAdminId;
              if (reasonMatches && actorMatches) {
                matchingHold = candidate;
              } else {
                return res.status(409).json({
                  success: false,
                  reconciliationRequired: true,
                  message: "Ambiguous recovery: A hold exists for this case, but audit record lacks specific hold identity. Manual investigation required.",
                  auditLogId: existingAudit._id.toString(),
                });
              }
            } else if (caseHolds.length > 1) {
              return res.status(409).json({
                success: false,
                reconciliationRequired: true,
                message: "Ambiguous recovery: Multiple holds exist for this case, but audit record lacks specific hold identity. Manual investigation required.",
                auditLogId: existingAudit._id.toString(),
              });
            }
          }

          if (matchingHold && matchingHold.status === "ACTIVE") {
            // Verify hold coherence: order.isDisputeHoldActive must be true
            if (!order.isDisputeHoldActive) {
              return res.status(409).json({
                success: false,
                reconciliationRequired: true,
                message: "Ambiguous recovery: Hold exists as ACTIVE but order isDisputeHoldActive flag is false. Manual investigation required.",
                auditLogId: existingAudit._id.toString(),
              });
            }

            const updatedAudit = await AdminAuditLog.findOneAndUpdate(
              { _id: existingAudit._id, outcome: "PENDING" },
              {
                $set: {
                  outcome: "SUCCESS",
                  completedAt: new Date(),
                  "metadata.recoveredFromAmbiguousState": true,
                },
              },
              { new: true }
            );
            const finalizedAudit = updatedAudit || (await AdminAuditLog.findById(existingAudit._id));
            if (finalizedAudit && finalizedAudit.outcome === "SUCCESS") {
              return res.status(200).json({
                success: true,
                message: "Dispute hold already placed (idempotent replay after crash recovery)",
                isReplay: true,
                hold: matchingHold,
                order: {
                  id: order._id.toString(),
                  isDisputeHoldActive: order.isDisputeHoldActive,
                  status: order.status,
                },
              });
            }
            if (finalizedAudit && finalizedAudit.outcome === "RECONCILIATION_REQUIRED") {
              return res.status(409).json({
                success: false,
                reconciliationRequired: true,
                message: "Conflict: Prior dispute hold attempt entered an ambiguous failure state and requires administrative reconciliation.",
                auditLogId: finalizedAudit._id.toString(),
              });
            }
          } else if (matchingHold && matchingHold.status === "RELEASED") {
            await AdminAuditLog.findOneAndUpdate(
              { _id: existingAudit._id, outcome: "PENDING" },
              {
                $set: {
                  outcome: "SUCCESS",
                  completedAt: new Date(),
                  "metadata.recoveredFromAmbiguousState": true,
                  "metadata.subsequentlyReleased": true,
                },
              }
            );
            return res.status(200).json({
              success: true,
              message: "Dispute hold was placed and subsequently released (historical idempotent replay)",
              isReplay: true,
              hold: matchingHold,
              order: {
                id: order._id.toString(),
                isDisputeHoldActive: order.isDisputeHoldActive,
                status: order.status,
              },
            });
          } else {
            // Order was not updated before crash; check if another active hold was placed concurrently
            const activeHoldForCase = (order.disputeHolds || []).find(
              (h) => h.caseId?.toString() === id && h.status === "ACTIVE"
            );
            if (activeHoldForCase) {
              await AdminAuditLog.findOneAndUpdate(
                { _id: existingAudit._id, outcome: "PENDING" },
                {
                  $set: {
                    outcome: "FAILED",
                    failureReason: "Interrupted prior to order mutation; conflicting active hold placed concurrently.",
                    completedAt: new Date(),
                  },
                }
              );
              return res.status(409).json({
                success: false,
                message: "Conflict: An active dispute hold is already in effect for this case on the linked order.",
                activeHold: activeHoldForCase,
              });
            }
            await AdminAuditLog.findOneAndUpdate(
              { _id: existingAudit._id, outcome: "PENDING" },
              {
                $set: {
                  outcome: "FAILED",
                  failureReason: "Interrupted prior to order mutation; re-attempted via retry.",
                  completedAt: new Date(),
                },
              }
            );
          }
        }
      }
    }

    // Check for duplicate active hold for same case on this order
    const existingActiveHold = (order.disputeHolds || []).find(
      (h) => h.caseId?.toString() === id && h.status === "ACTIVE"
    );
    if (existingActiveHold) {
      return res.status(409).json({
        success: false,
        message: "An active dispute hold is already in effect for this case on the linked order.",
        activeHold: existingActiveHold,
      });
    }

    const actingAdminId = req.userId || req.adminId || req.user?._id?.toString() || "system";
    const actingAdminEmail = req.adminEmail || req.user?.email || "unknown";
    const actingAdminModel = req.adminModel || (req.user instanceof Admin ? "Admin" : "User");

    // Phase 1: Record Audit Intent with deterministic holdId
    const holdId = existingAudit?.metadata?.holdId || `HOLD_${report._id}_${Date.now()}`;
    let auditLog = existingAudit;
    try {
      if (auditLog) {
        auditLog.outcome = "PENDING";
        auditLog.reason = reason.trim();
        auditLog.failureReason = "";
        auditLog.completedAt = null;
        auditLog.actingAdminId = actingAdminId;
        auditLog.actingAdminEmail = actingAdminEmail;
        auditLog.actingAdminRole = actingRole;
        auditLog.beforeStatus = order.status;
        auditLog.afterStatus = order.status;
        auditLog.metadata = {
          caseId: report._id.toString(),
          orderId: order._id.toString(),
          holdId,
          isDisputeHoldActiveBefore: order.isDisputeHoldActive || false,
        };
        await auditLog.save();
      } else {
        auditLog = new AdminAuditLog({
          idempotencyKey: opKey || `HOLD_${id}_${order._id}_${Date.now()}`,
          actingAdminId,
          actingAdminEmail,
          actingAdminModel,
          actingAdminRole: actingRole,
          targetAccountId: order._id.toString(),
          targetAccountEmail: order.userEmail,
          targetAccountType: "order",
          action: "PLACE_DISPUTE_HOLD",
          reason: reason.trim(),
          beforeStatus: order.status,
          afterStatus: order.status,
          outcome: "PENDING",
          metadata: {
            caseId: report._id.toString(),
            orderId: order._id.toString(),
            holdId,
            isDisputeHoldActiveBefore: order.isDisputeHoldActive || false,
          },
          ipAddress: req.ip || req.connection?.remoteAddress || "",
          userAgent: req.headers["user-agent"] || "",
        });
        await auditLog.save();
      }
    } catch (intentErr) {
      console.error("Critical: Failed to record dispute hold audit intent:", intentErr);
      return res.status(500).json({
        success: false,
        message: "Failed to initialize audit record. Dispute hold was not placed.",
      });
    }

    // Phase 2: Atomic Conditional Update on Order
    const newHold = {
      holdId,
      caseId: report._id,
      reason: reason.trim(),
      placedBy: {
        adminId: actingAdminId,
        adminEmail: actingAdminEmail,
        role: actingRole,
      },
      placedAt: new Date(),
      status: "ACTIVE",
    };

    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        disputeHolds: {
          $not: {
            $elemMatch: { caseId: report._id, status: "ACTIVE" },
          },
        },
      },
      {
        $push: { disputeHolds: newHold },
        $set: { isDisputeHoldActive: true },
      },
      { new: true }
    );

    if (!updatedOrder) {
      // Check if a concurrent request with this exact holdId succeeded
      const checkOrder = await Order.findById(order._id);
      const racedHold = (checkOrder?.disputeHolds || []).find((h) => h.holdId === holdId);
      if (racedHold && racedHold.status === "ACTIVE") {
        await AdminAuditLog.findOneAndUpdate(
          { _id: auditLog._id, outcome: "PENDING" },
          {
            $set: {
              outcome: "SUCCESS",
              completedAt: new Date(),
              "metadata.holdId": holdId,
              "metadata.isDisputeHoldActiveAfter": true,
            },
          }
        );
        return res.status(200).json({
          success: true,
          message: "Dispute hold already placed (concurrent replay)",
          isReplay: true,
          hold: racedHold,
          order: {
            id: checkOrder._id.toString(),
            isDisputeHoldActive: checkOrder.isDisputeHoldActive,
            status: checkOrder.status,
          },
        });
      }

      await AdminAuditLog.findOneAndUpdate(
        { _id: auditLog._id, outcome: "PENDING" },
        {
          $set: {
            outcome: "FAILED",
            failureReason: "Conditional update failed: another active hold was placed concurrently for this case.",
            completedAt: new Date(),
          },
        }
      );
      return res.status(409).json({
        success: false,
        message: "Conflict: An active dispute hold was placed concurrently for this case.",
      });
    }

    // Phase 3: Finalize Audit Log
    try {
      auditLog.outcome = "SUCCESS";
      auditLog.completedAt = new Date();
      auditLog.metadata = {
        ...auditLog.metadata,
        holdId,
        isDisputeHoldActiveAfter: true,
      };
      await auditLog.save();
    } catch (finalizeErr) {
      console.error("Critical: Audit finalization failed, attempting compensating rollback:", finalizeErr);
      try {
        const rollbackOrder = await Order.findOneAndUpdate(
          {
            _id: order._id,
            disputeHolds: {
              $elemMatch: { holdId, status: "ACTIVE" },
            },
          },
          [
            {
              $set: {
                disputeHolds: {
                  $filter: {
                    input: { $ifNull: ["$disputeHolds", []] },
                    as: "dh",
                    cond: { $ne: ["$$dh.holdId", holdId] },
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

        auditLog.outcome = "ROLLED_BACK";
        auditLog.failureReason = `Audit finalization failed: ${finalizeErr.message}. Hold ${holdId} rolled back.`;
        auditLog.completedAt = new Date();
        await auditLog.save().catch(() => {});

        return res.status(500).json({
          success: false,
          message: "Audit finalization failed. Dispute hold was rolled back to maintain consistency.",
        });
      } catch (rollbackErr) {
        console.error("FATAL: Compensating rollback failed:", rollbackErr);
        auditLog.outcome = "RECONCILIATION_REQUIRED";
        auditLog.failureReason = `FATAL: Hold ${holdId} placed on order ${order._id} but audit finalization failed (${finalizeErr.message}) AND rollback failed (${rollbackErr.message}). Immediate manual reconciliation required.`;
        auditLog.completedAt = new Date();
        await auditLog.save().catch(() => {});

        return res.status(500).json({
          success: false,
          reconciliationRequired: true,
          message: "CRITICAL: Dispute hold state inconsistency detected. Flagged for administrative reconciliation.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Dispute hold successfully placed on linked order.",
      hold: newHold,
      order: {
        id: updatedOrder._id.toString(),
        isDisputeHoldActive: updatedOrder.isDisputeHoldActive,
        status: updatedOrder.status,
      },
    });
  } catch (error) {
    console.error("[AdminDisputeOperations] placeDisputeHold error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while placing dispute hold",
    });
  }
};

/**
 * POST /api/admin/disputes/:id/release-hold
 * Releases an active dispute hold on the order linked to this case.
 * Enforces 3-phase recoverable audit intent protocol.
 */
const releaseDisputeHold = async (req, res) => {
  try {
    const actingRole = req.role || req.adminRole || req.user?.role || "admin";
    if (actingRole === "editor") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: 'editor' role has read-only access and cannot release dispute holds",
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Case / Report ID format" });
    }

    const report = await ReportAdmin.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Dispute case not found" });
    }

    if (!report.orderId || report.orderId.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Dispute case does not reference a linked order.",
      });
    }

    let order = null;
    const trimmedOrderId = report.orderId.trim();
    if (mongoose.Types.ObjectId.isValid(trimmedOrderId)) {
      order = await Order.findById(trimmedOrderId);
    }
    if (!order) {
      order = await Order.findOne({
        $or: [{ razorpayOrderId: trimmedOrderId }, { title: trimmedOrderId }],
      });
    }
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Linked order not found in database.",
      });
    }

    const { releaseReason, idempotencyKey } = req.body;
    if (!releaseReason || typeof releaseReason !== "string" || releaseReason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "A meaningful release reason (at least 5 characters) is required.",
      });
    }
    if (releaseReason.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Release reason exceeds maximum allowed length of 500 characters.",
      });
    }

    const opKey = idempotencyKey ? `RELEASE_${id}_${order._id}_${idempotencyKey.trim()}` : null;
    let existingAudit = null;
    if (opKey) {
      existingAudit = await AdminAuditLog.findOne({ idempotencyKey: opKey });
      if (existingAudit) {
        // Verify action matches original intent
        if (existingAudit.action !== "RELEASE_DISPUTE_HOLD") {
          return res.status(409).json({
            success: false,
            message: `Conflict: Idempotency key '${idempotencyKey}' was previously registered for action '${existingAudit.action}', not 'RELEASE_DISPUTE_HOLD'.`,
          });
        }
        // Verify target order and case match original intent
        if (
          (existingAudit.targetAccountId && existingAudit.targetAccountId !== order._id.toString()) ||
          (existingAudit.metadata?.caseId && existingAudit.metadata.caseId !== id)
        ) {
          return res.status(409).json({
            success: false,
            message: "Conflict: Idempotency key targets a different order or dispute case.",
          });
        }

        if (existingAudit.outcome === "SUCCESS") {
          return res.status(200).json({
            success: true,
            message: "Dispute hold already released (idempotent replay)",
            isReplay: true,
            isDisputeHoldActive: order.isDisputeHoldActive,
            order: {
              id: order._id.toString(),
              isDisputeHoldActive: order.isDisputeHoldActive,
              status: order.status,
            },
          });
        }
        if (existingAudit.outcome === "RECONCILIATION_REQUIRED") {
          return res.status(409).json({
            success: false,
            reconciliationRequired: true,
            message: "Conflict: Prior dispute hold release entered an ambiguous failure state and requires administrative reconciliation.",
            auditLogId: existingAudit._id.toString(),
          });
        }
        if (existingAudit.outcome === "PENDING") {
          // Ambiguous outcome recovery: check if exact hold was released on the order
          const targetHoldId = existingAudit.metadata?.holdId;
          let matchingHold = null;

          if (targetHoldId) {
            matchingHold = (order.disputeHolds || []).find((h) => h.holdId === targetHoldId);
          } else {
            const caseHolds = (order.disputeHolds || []).filter((h) => h.caseId?.toString() === id);
            const releasedCaseHolds = caseHolds.filter((h) => h.status === "RELEASED");
            if (releasedCaseHolds.length === 1) {
              const candidate = releasedCaseHolds[0];
              const reasonMatches = !existingAudit.reason || candidate.releaseReason === existingAudit.reason;
              if (reasonMatches) {
                matchingHold = candidate;
              } else {
                return res.status(409).json({
                  success: false,
                  reconciliationRequired: true,
                  message: "Ambiguous recovery: A released hold exists for this case, but release details do not match the audit intent. Manual investigation required.",
                  auditLogId: existingAudit._id.toString(),
                });
              }
            } else if (releasedCaseHolds.length > 1) {
              return res.status(409).json({
                success: false,
                reconciliationRequired: true,
                message: "Ambiguous recovery: Multiple released holds exist for this case, but audit record lacks specific hold identity. Manual investigation required.",
                auditLogId: existingAudit._id.toString(),
              });
            }
          }
          const isHoldReleased = matchingHold && matchingHold.status === "RELEASED";
          const hasActiveForThisCase = (order.disputeHolds || []).some(
            (h) => h.caseId?.toString() === id && h.status === "ACTIVE"
          );

          if (isHoldReleased && !hasActiveForThisCase) {
            const updatedAudit = await AdminAuditLog.findOneAndUpdate(
              { _id: existingAudit._id, outcome: "PENDING" },
              {
                $set: {
                  outcome: "SUCCESS",
                  completedAt: new Date(),
                  "metadata.recoveredFromAmbiguousState": true,
                },
              },
              { new: true }
            );
            const finalizedAudit = updatedAudit || (await AdminAuditLog.findById(existingAudit._id));
            if (finalizedAudit && finalizedAudit.outcome === "SUCCESS") {
              return res.status(200).json({
                success: true,
                message: "Dispute hold already released (idempotent replay after crash recovery)",
                isReplay: true,
                isDisputeHoldActive: order.isDisputeHoldActive,
                order: {
                  id: order._id.toString(),
                  isDisputeHoldActive: order.isDisputeHoldActive,
                  status: order.status,
                },
              });
            }
            if (finalizedAudit && finalizedAudit.outcome === "RECONCILIATION_REQUIRED") {
              return res.status(409).json({
                success: false,
                reconciliationRequired: true,
                message: "Conflict: Prior dispute hold release entered an ambiguous failure state and requires administrative reconciliation.",
                auditLogId: finalizedAudit._id.toString(),
              });
            }
          }
          await AdminAuditLog.findOneAndUpdate(
            { _id: existingAudit._id, outcome: "PENDING" },
            {
              $set: {
                outcome: "FAILED",
                failureReason: "Interrupted prior to order release; re-attempted via retry.",
                completedAt: new Date(),
              },
            }
          );
        }
      }
    }

    // Find active hold for this case
    const activeHold = (order.disputeHolds || []).find(
      (h) => h.caseId?.toString() === id && h.status === "ACTIVE"
    );
    if (!activeHold) {
      return res.status(404).json({
        success: false,
        message: "No active dispute hold found for this case on the linked order.",
      });
    }

    const actingAdminId = req.userId || req.adminId || req.user?._id?.toString() || "system";
    const actingAdminEmail = req.adminEmail || req.user?.email || "unknown";
    const actingAdminModel = req.adminModel || (req.user instanceof Admin ? "Admin" : "User");

    // Phase 1: Record Audit Intent
    let auditLog = existingAudit;
    try {
      if (auditLog) {
        auditLog.outcome = "PENDING";
        auditLog.reason = releaseReason.trim();
        auditLog.failureReason = "";
        auditLog.completedAt = null;
        auditLog.actingAdminId = actingAdminId;
        auditLog.actingAdminEmail = actingAdminEmail;
        auditLog.actingAdminRole = actingRole;
        auditLog.beforeStatus = order.status;
        auditLog.afterStatus = order.status;
        auditLog.metadata = {
          caseId: report._id.toString(),
          orderId: order._id.toString(),
          holdId: activeHold.holdId,
        };
        await auditLog.save();
      } else {
        auditLog = new AdminAuditLog({
          idempotencyKey: opKey || `RELEASE_${id}_${order._id}_${Date.now()}`,
          actingAdminId,
          actingAdminEmail,
          actingAdminModel,
          actingAdminRole: actingRole,
          targetAccountId: order._id.toString(),
          targetAccountEmail: order.userEmail,
          targetAccountType: "order",
          action: "RELEASE_DISPUTE_HOLD",
          reason: releaseReason.trim(),
          beforeStatus: order.status,
          afterStatus: order.status,
          outcome: "PENDING",
          metadata: {
            caseId: report._id.toString(),
            orderId: order._id.toString(),
            holdId: activeHold.holdId,
          },
          ipAddress: req.ip || req.connection?.remoteAddress || "",
          userAgent: req.headers["user-agent"] || "",
        });
        await auditLog.save();
      }
    } catch (intentErr) {
      console.error("Critical: Failed to record dispute hold release audit intent:", intentErr);
      return res.status(500).json({
        success: false,
        message: "Failed to initialize audit record. Dispute hold was not released.",
      });
    }

    // Phase 2: Atomic Conditional Release on Order (Single-Document Pipeline)
    const releaseTime = new Date();
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        disputeHolds: {
          $elemMatch: { holdId: activeHold.holdId, status: "ACTIVE" },
        },
      },
      [
        {
          $set: {
            disputeHolds: {
              $map: {
                input: { $ifNull: ["$disputeHolds", []] },
                as: "h",
                in: {
                  $cond: [
                    { $eq: ["$$h.holdId", activeHold.holdId] },
                    {
                      $mergeObjects: [
                        "$$h",
                        {
                          status: "RELEASED",
                          releasedBy: {
                            adminId: actingAdminId,
                            adminEmail: actingAdminEmail,
                            role: actingRole,
                          },
                          releasedAt: releaseTime,
                          releaseReason: releaseReason.trim(),
                        },
                      ],
                    },
                    "$$h",
                  ],
                },
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

    if (!updatedOrder) {
      const checkOrder = await Order.findById(order._id);
      const isAlreadyReleased = (checkOrder?.disputeHolds || []).some(
        (h) => h.holdId === activeHold.holdId && h.status === "RELEASED"
      );
      if (isAlreadyReleased) {
        await AdminAuditLog.findOneAndUpdate(
          { _id: auditLog._id, outcome: "PENDING" },
          {
            $set: {
              outcome: "SUCCESS",
              completedAt: new Date(),
              "metadata.isDisputeHoldActiveAfter": checkOrder.isDisputeHoldActive,
            },
          }
        );
        return res.status(200).json({
          success: true,
          message: "Dispute hold already released (concurrent racer finalized)",
          isReplay: true,
          isDisputeHoldActive: checkOrder.isDisputeHoldActive,
          order: {
            id: checkOrder._id.toString(),
            isDisputeHoldActive: checkOrder.isDisputeHoldActive,
            status: checkOrder.status,
          },
        });
      }

      await AdminAuditLog.findOneAndUpdate(
        { _id: auditLog._id, outcome: "PENDING" },
        {
          $set: {
            outcome: "FAILED",
            failureReason: "Conditional update failed: hold was modified or released concurrently.",
            completedAt: new Date(),
          },
        }
      );
      return res.status(409).json({
        success: false,
        message: "Conflict: The dispute hold was modified or released concurrently.",
      });
    }

    // Phase 3: Finalize Audit Log
    try {
      auditLog.outcome = "SUCCESS";
      auditLog.completedAt = new Date();
      auditLog.metadata = {
        ...auditLog.metadata,
        isDisputeHoldActiveAfter: updatedOrder.isDisputeHoldActive,
      };
      await auditLog.save();
    } catch (finalizeErr) {
      console.error("Critical: Audit finalization failed on hold release:", finalizeErr);
      auditLog.outcome = "RECONCILIATION_REQUIRED";
      auditLog.failureReason = `Hold ${activeHold.holdId} was released, but audit finalization failed (${finalizeErr.message}). Immediate manual reconciliation required.`;
      auditLog.completedAt = new Date();
      await auditLog.save().catch(() => {});

      return res.status(500).json({
        success: false,
        reconciliationRequired: true,
        message: "CRITICAL: Dispute hold was released but audit finalization failed. Flagged for administrative reconciliation.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Dispute hold successfully released.",
      isDisputeHoldActive: updatedOrder.isDisputeHoldActive,
      order: {
        id: updatedOrder._id.toString(),
        isDisputeHoldActive: updatedOrder.isDisputeHoldActive,
        status: updatedOrder.status,
      },
    });
  } catch (error) {
    console.error("[AdminDisputeOperations] releaseDisputeHold error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while releasing dispute hold",
    });
  }
};

/**
 * GET /api/admin/disputes/:id/notes
 * Fetches all internal investigation notes for a case.
 */
const getInternalNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const callerRole = req.admin?.role || req.user?.role || "admin";
    const isEditor = callerRole === "editor";

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Case ID format" });
    }

    const report = await ReportAdmin.findById(id).select("_id").lean();
    if (!report) {
      return res.status(404).json({ success: false, message: "Dispute case not found" });
    }

    const notes = await AdminInternalNote.find({ caseId: id })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: notes.length,
      notes: notes.map((note) => ({
        id: note._id.toString(),
        caseId: note.caseId.toString(),
        authorEmail: isEditor ? maskEmail(note.authorEmail) : note.authorEmail,
        authorRole: note.authorRole,
        content: note.content,
        createdAt: note.createdAt ? new Date(note.createdAt).toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("[AdminDisputeOperations] getInternalNotes error:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve internal notes" });
  }
};

/**
 * POST /api/admin/disputes/:id/notes
 * Adds a durable internal investigation note to a case.
 */
const addInternalNote = async (req, res) => {
  try {
    const actingRole = req.role || req.adminRole || req.user?.role || "admin";
    if (actingRole === "editor") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: 'editor' role has read-only access and cannot add internal notes",
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Case ID format" });
    }

    const report = await ReportAdmin.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Dispute case not found" });
    }

    const { content } = req.body;
    if (!content || typeof content !== "string" || content.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Note content must be at least 3 characters long.",
      });
    }
    if (content.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Note content exceeds maximum allowed length of 2000 characters.",
      });
    }

    const sanitizedContent = sanitizeNoteContent(content);
    if (!sanitizedContent || sanitizedContent.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Note content contains invalid or malicious characters.",
      });
    }

    const actingAdminId = req.userId || req.adminId || req.user?._id?.toString() || "system";
    const actingAdminEmail = req.adminEmail || req.user?.email || "unknown";

    const note = new AdminInternalNote({
      caseId: report._id,
      authorId: actingAdminId,
      authorEmail: actingAdminEmail,
      authorRole: actingRole,
      content: sanitizedContent,
      ipAddress: req.ip || req.connection?.remoteAddress || "",
    });
    await note.save();

    // Audit log entry for tracking
    await AdminAuditLog.create({
      actingAdminId,
      actingAdminEmail,
      actingAdminModel: req.adminModel || (req.user instanceof Admin ? "Admin" : "User"),
      actingAdminRole: actingRole,
      targetAccountId: report._id.toString(),
      targetAccountEmail: report.userEmail || "unknown",
      targetAccountType: "report",
      action: "ADD_INVESTIGATION_NOTE",
      reason: "Added internal dispute investigation note",
      beforeStatus: report.status,
      afterStatus: report.status,
      outcome: "SUCCESS",
      metadata: { noteId: note._id.toString(), contentLength: sanitizedContent.length },
      ipAddress: req.ip || req.connection?.remoteAddress || "",
      userAgent: req.headers["user-agent"] || "",
    }).catch((err) => console.error("Non-fatal note audit logging error:", err));

    return res.status(201).json({
      success: true,
      message: "Internal investigation note added successfully.",
      note: {
        id: note._id.toString(),
        caseId: note.caseId.toString(),
        authorEmail: note.authorEmail,
        authorRole: note.authorRole,
        content: note.content,
        createdAt: note.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[AdminDisputeOperations] addInternalNote error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save internal investigation note",
    });
  }
};

module.exports = {
  getDisputeSummary,
  getDisputes,
  getDisputeById,
  getContestedOrders,
  placeDisputeHold,
  releaseDisputeHold,
  getInternalNotes,
  addInternalNote,
};
