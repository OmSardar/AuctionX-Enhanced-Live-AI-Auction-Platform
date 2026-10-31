const UserModel = require("../../users/models/user");
const SellerModel = require("../../sellers/accounts/models/seller");
const Product = require("../../products/models/productSchema");
const Bid = require("../../bidding/models/bidSchema");
const Order = require("../../orders/models/orderSchema");
const ReportAdmin = require("../../admin/moderation/models/reports");
const AdminSeller = require("../../admin/sellers/models/adminSeller");
const analyticsService = require("../../analytics/services/analyticsService");
const auditService = require("../../analytics/services/auditService");

/**
 * Administrative GraphQL Resolvers — Stage 7.42
 * Connects directly to backend services, enforcing authorization and returning
 * database-derived values without duplication.
 */
const resolvers = {
  /**
   * Composite dashboard overview query.
   */
  dashboardOverview: async (args, context) => {
    // Enforce administrative authorization
    if (!context || !context.admin) {
      throw new Error("Access denied: Administrative privileges required");
    }

    const now = new Date();

    const [
      totalUsers,
      totalRegularUsers,
      totalSellers,
      verifiedUsers,
      totalProducts,
      activeAuctions,
      upcomingAuctions,
      endedAuctions,
      pendingReports,
      pendingSellerApprovals,
      totalBids,
      totalOrders,
      settledOrders,
      recentBids,
      recentProducts,
      recentOrders,
    ] = await Promise.all([
      UserModel.countDocuments({ role: { $ne: "admin" } }),
      UserModel.countDocuments({ role: "user" }),
      SellerModel.countDocuments(),
      UserModel.countDocuments({ isVerified: true, role: { $ne: "admin" } }),
      Product.countDocuments(),
      Product.countDocuments({
        status: { $in: ["Active", "LIVE"] },
        $or: [{ endTime: { $gt: now } }, { endTime: null }],
      }),
      Product.countDocuments({ status: { $in: ["SCHEDULED", "DRAFT"] } }),
      Product.countDocuments({
        status: { $in: ["Closed", "ENDED", "SETTLED", "UNSOLD", "CANCELLED"] },
      }),
      ReportAdmin.countDocuments({ status: { $in: ["pending", "in-progress"] } }),
      AdminSeller.countDocuments({ status: "pending_approval" }),
      Bid.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: "PAID" }),
      Bid.find().sort({ createdAt: -1 }).limit(5).lean(),
      Product.find().sort({ createdAt: -1 }).limit(5).lean(),
      Order.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const activityItems = [
      ...recentBids.map((b) => ({
        id: b._id.toString(),
        type: "BID",
        title: `Bid of ₹${b.amount} placed`,
        actor: b.bidderEmail || b.bidderName || "User",
        status: b.status,
        timestamp: b.createdAt ? b.createdAt.toISOString() : now.toISOString(),
      })),
      ...recentProducts.map((p) => ({
        id: p._id.toString(),
        type: "PRODUCT",
        title: `Item "${p.name}" listed (${p.category || "General"})`,
        actor: p.email || "Seller",
        status: p.status,
        timestamp: p.createdAt ? p.createdAt.toISOString() : now.toISOString(),
      })),
      ...recentOrders.map((o) => ({
        id: o._id.toString(),
        type: "ORDER",
        title: `Order "${o.title}" for ₹${o.finalPrice || 0}`,
        actor: o.userEmail || "Buyer",
        status: o.status,
        timestamp: o.createdAt ? o.createdAt.toISOString() : now.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    return {
      users: {
        total: totalUsers,
        regularUsers: totalRegularUsers,
        sellers: totalSellers,
        verified: verifiedUsers,
      },
      auctions: {
        total: totalProducts,
        active: activeAuctions,
        upcoming: upcomingAuctions,
        ended: endedAuctions,
      },
      moderation: {
        pendingReports,
        pendingSellerApprovals,
        productModerationModelled: false,
        notes:
          "Product moderation is not modeled in the Product schema; items transition directly to active or scheduled.",
      },
      bids: totalBids,
      orders: {
        total: totalOrders,
        settled: settledOrders,
      },
      recentActivity: activityItems,
      generatedAt: now.toISOString(),
    };
  },

  /**
   * Real-data analytics overview query.
   */
  analyticsOverview: async ({ months = 12 }, context) => {
    if (!context || !context.admin) {
      throw new Error("Access denied: Administrative privileges required");
    }

    const safeMonths = Math.min(24, Math.max(1, months || 12));
    const [
      revenueData,
      categoryData,
      auctionHealth,
      userGrowth,
      disputeReasons,
      financialFlows,
    ] = await Promise.all([
      analyticsService.getRevenueTimeSeries(safeMonths),
      analyticsService.getCategoryBreakdown(),
      analyticsService.getAuctionHealth(),
      analyticsService.getUserGrowth(safeMonths),
      analyticsService.getDisputeReasonBreakdown(),
      analyticsService.getFinancialFlows(),
    ]);

    const totalGrossRevenue = revenueData.grossSales.reduce((a, b) => a + b, 0);
    const totalPlatformCommission = revenueData.platformFees.reduce((a, b) => a + b, 0);
    const totalOrdersCompleted = revenueData.orderCounts.reduce((a, b) => a + b, 0);

    return {
      summary: {
        totalGrossRevenue,
        totalPlatformCommission,
        totalOrdersCompleted,
        totalAuctions: auctionHealth.totalAuctions,
        activeAuctions: auctionHealth.activeAuctions,
        completionRate: auctionHealth.completionRate,
        netFlow: financialFlows.netFlow,
      },
      revenueTimeSeries: revenueData,
      categoryDistribution: categoryData,
      auctionHealth,
      userGrowth,
      disputeReasons,
      financialFlows,
      generatedAt: new Date().toISOString(),
    };
  },

  /**
   * Paginated, filtered audit logs query.
   */
  auditLogs: async ({ filter = {}, page = 1, limit = 20 }, context) => {
    if (!context || !context.admin) {
      throw new Error("Access denied: Administrative privileges required");
    }

    const result = await auditService.queryEvents({
      page,
      limit,
      ...filter,
    });

    const formattedEvents = result.events.map((e) => ({
      id: e._id.toString(),
      actorType: e.actorType || "admin",
      actorId: e.actorId || e.actingAdminId || null,
      actorEmail: e.actorEmail || e.actingAdminEmail || null,
      actorName: e.actorName || null,
      actorRole: e.actorRole || e.actingAdminRole || null,
      resourceType: e.resourceType || e.targetAccountType || "account",
      resourceId: e.resourceId || e.targetAccountId || null,
      targetAccountEmail: e.targetAccountEmail || null,
      action: e.action,
      category: e.category || "GOVERNANCE",
      outcome: e.outcome || "SUCCESS",
      failureReason: e.failureReason || "",
      reason: e.reason || "",
      beforeStatus: e.beforeStatus || null,
      afterStatus: e.afterStatus || null,
      beforeState: e.beforeState || null,
      afterState: e.afterState || null,
      changedFields: e.changedFields || [],
      correlationId: e.correlationId || null,
      ipAddress: e.ipAddress || "",
      userAgent: e.userAgent || "",
      metadata: e.metadata || {},
      createdAt: e.createdAt ? e.createdAt.toISOString() : new Date().toISOString(),
      completedAt: e.completedAt ? e.completedAt.toISOString() : null,
    }));

    return {
      events: formattedEvents,
      totalCount: result.totalCount,
      page: result.page,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    };
  },

  /**
   * Single audit event detail query.
   */
  auditLog: async ({ id }, context) => {
    if (!context || !context.admin) {
      throw new Error("Access denied: Administrative privileges required");
    }

    const event = await auditService.getEventById(id);
    if (!event) return null;

    return {
      id: event._id.toString(),
      actorType: event.actorType || "admin",
      actorId: event.actorId || event.actingAdminId || null,
      actorEmail: event.actorEmail || event.actingAdminEmail || null,
      actorName: event.actorName || null,
      actorRole: event.actorRole || event.actingAdminRole || null,
      resourceType: event.resourceType || event.targetAccountType || "account",
      resourceId: event.resourceId || event.targetAccountId || null,
      targetAccountEmail: event.targetAccountEmail || null,
      action: event.action,
      category: event.category || "GOVERNANCE",
      outcome: event.outcome || "SUCCESS",
      failureReason: event.failureReason || "",
      reason: event.reason || "",
      beforeStatus: event.beforeStatus || null,
      afterStatus: event.afterStatus || null,
      beforeState: event.beforeState || null,
      afterState: event.afterState || null,
      changedFields: event.changedFields || [],
      correlationId: event.correlationId || null,
      ipAddress: event.ipAddress || "",
      userAgent: event.userAgent || "",
      metadata: event.metadata || {},
      createdAt: event.createdAt ? event.createdAt.toISOString() : new Date().toISOString(),
      completedAt: event.completedAt ? event.completedAt.toISOString() : null,
    };
  },

  /**
   * 24h audit summary and telemetry query.
   */
  auditSummary: async (args, context) => {
    if (!context || !context.admin) {
      throw new Error("Access denied: Administrative privileges required");
    }

    const summary = await auditService.getAuditSummary();
    const formattedFailures = summary.recentFailures.map((e) => ({
      id: e._id.toString(),
      actorType: e.actorType || "admin",
      actorId: e.actorId || e.actingAdminId || null,
      actorEmail: e.actorEmail || e.actingAdminEmail || null,
      actorName: e.actorName || null,
      actorRole: e.actorRole || e.actingAdminRole || null,
      resourceType: e.resourceType || e.targetAccountType || "account",
      resourceId: e.resourceId || e.targetAccountId || null,
      targetAccountEmail: e.targetAccountEmail || null,
      action: e.action,
      category: e.category || "GOVERNANCE",
      outcome: e.outcome || "SUCCESS",
      failureReason: e.failureReason || "",
      reason: e.reason || "",
      beforeStatus: e.beforeStatus || null,
      afterStatus: e.afterStatus || null,
      beforeState: e.beforeState || null,
      afterState: e.afterState || null,
      changedFields: e.changedFields || [],
      correlationId: e.correlationId || null,
      ipAddress: e.ipAddress || "",
      userAgent: e.userAgent || "",
      metadata: e.metadata || {},
      createdAt: e.createdAt ? e.createdAt.toISOString() : new Date().toISOString(),
      completedAt: e.completedAt ? e.completedAt.toISOString() : null,
    }));

    return {
      totalEventsLast24h: summary.totalEventsLast24h,
      outcomes: summary.outcomes,
      recentFailures: formattedFailures,
    };
  },
};

module.exports = resolvers;
