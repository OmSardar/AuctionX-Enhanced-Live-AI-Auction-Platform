const UserModel = require("../../../users/models/user");
const SellerModel = require("../../../sellers/accounts/models/seller");
const Product = require("../../../products/models/productSchema");
const Bid = require("../../../bidding/models/bidSchema");
const Order = require("../../../orders/models/orderSchema");
const ReportAdmin = require("../../moderation/models/reports");
const AdminSeller = require("../../sellers/models/adminSeller");

/**
 * GET /api/admin/dashboard/stats
 * Securely aggregate key operational metrics for the AuctionX Admin Dashboard.
 * Queries are targeted, indexed, and lean to prevent loading entire collections.
 */
const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();

    // 1-5. Execute all independent count metrics and recent activity feeds concurrently
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
      // User metrics
      UserModel.countDocuments({ role: { $ne: "admin" } }),
      UserModel.countDocuments({ role: "user" }),
      SellerModel.countDocuments(),
      UserModel.countDocuments({ isVerified: true, role: { $ne: "admin" } }),
      // Product & Auction metrics
      Product.countDocuments(),
      Product.countDocuments({
        status: { $in: ["Active", "LIVE"] },
        $or: [{ endTime: { $gt: now } }, { endTime: null }],
      }),
      Product.countDocuments({
        status: { $in: ["SCHEDULED", "DRAFT"] },
      }),
      Product.countDocuments({
        status: { $in: ["Closed", "ENDED", "SETTLED", "UNSOLD", "CANCELLED"] },
      }),
      // Moderation metrics
      ReportAdmin.countDocuments({ status: { $in: ["pending", "in-progress"] } }),
      AdminSeller.countDocuments({ status: "pending_approval" }),
      // Bidding & Transaction metrics
      Bid.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: "PAID" }),
      // Recent Activity Feeds (Indexed lean reads)
      Bid.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("productId bidderEmail bidderName amount status createdAt")
        .lean(),
      Product.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name category currentPrice startingPrice status createdAt email")
        .lean(),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title userEmail sellerEmail finalPrice status createdAt")
        .lean(),
    ]);

    // Format combined chronological recent activity
    const activityItems = [
      ...recentBids.map((b) => ({
        id: b._id,
        type: "BID",
        title: `Bid of ₹${b.amount} placed on auction`,
        actor: b.bidderEmail || b.bidderName,
        status: b.status,
        timestamp: b.createdAt,
      })),
      ...recentProducts.map((p) => ({
        id: p._id,
        type: "PRODUCT",
        title: `Item "${p.name}" listed (${p.category})`,
        actor: p.email,
        status: p.status,
        timestamp: p.createdAt,
      })),
      ...recentOrders.map((o) => ({
        id: o._id,
        type: "ORDER",
        title: `Order "${o.title}" for ₹${o.finalPrice || 0}`,
        actor: o.userEmail,
        status: o.status,
        timestamp: o.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    const metricsPayload = {
      users: {
        total: totalUsers,
        totalUsers,
        regularUsers: totalRegularUsers,
        sellers: totalSellers,
        totalSellers,
        verified: verifiedUsers,
        verifiedUsers,
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
        pendingSellers: pendingSellerApprovals,
        productModerationModelled: false,
        notes:
          "Product-level moderation queue is not modeled in the current schema; listings are created directly as Active or Scheduled.",
      },
      bids: {
        totalBids,
      },
      orders: {
        total: totalOrders,
        settled: settledOrders,
      },
      activity: activityItems,
      recentActivity: activityItems,
      generatedAt: now.toISOString(),
    };

    return res.status(200).json({
      success: true,
      stats: metricsPayload,
      data: metricsPayload,
    });
  } catch (error) {
    console.error("Error generating admin dashboard metrics:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching dashboard statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getDashboardStats,
};
