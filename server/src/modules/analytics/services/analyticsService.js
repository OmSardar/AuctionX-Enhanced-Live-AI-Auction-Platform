const mongoose = require("mongoose");
const Order = require("../../orders/models/orderSchema");
const Product = require("../../products/models/productSchema");
const UserModel = require("../../users/models/user");
const RealSeller = require("../../sellers/accounts/models/seller");
const AdminSeller = require("../../admin/sellers/models/adminSeller");
const Transaction = require("../../admin/finance/models/transaction");
const ReportAdmin = require("../../admin/moderation/models/reports");

/**
 * Helper to generate empty monthly buckets for a continuous date range.
 * Defaults to the last N months.
 */
function generateMonthlyBuckets(monthCount = 12) {
  const buckets = [];
  const now = new Date();

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const key = `${year}-${month}`;
    const dateStr = `${month}-01-${year}`;
    const label = d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
    buckets.push({ key, label, dateStr, year, month: d.getUTCMonth() + 1 });
  }

  return buckets;
}

/**
 * Real-Data Analytics Aggregation Service — Stage 7.42
 * Queries authoritative MongoDB collections using indexed aggregation pipelines.
 * Never invents mock records, handles missing data safely, and avoids division by zero.
 */
class AnalyticsService {
  /**
   * Time-series revenue, platform fees, and orders aggregated from paid Order records.
   */
  async getRevenueTimeSeries(months = 12) {
    const buckets = generateMonthlyBuckets(months);
    const startDate = new Date(Date.UTC(buckets[0].year, buckets[0].month - 1, 1));

    // Aggregate paid orders
    const paidAgg = await Order.aggregate([
      {
        $match: {
          status: "PAID",
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: { date: "$createdAt", timezone: "UTC" } },
            month: { $month: { date: "$createdAt", timezone: "UTC" } },
          },
          grossSales: { $sum: { $ifNull: ["$finalPrice", { $ifNull: ["$highestBid", "$biddingStartPrice"] }] } },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    // Aggregate refunded orders
    const refundAgg = await Order.aggregate([
      {
        $match: {
          status: "REFUNDED",
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: { date: "$createdAt", timezone: "UTC" } },
            month: { $month: { date: "$createdAt", timezone: "UTC" } },
          },
          refundedAmount: { $sum: { $ifNull: ["$finalPrice", 0] } },
          refundCount: { $sum: 1 },
        },
      },
    ]);

    const paidMap = new Map();
    paidAgg.forEach((item) => {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, "0")}`;
      paidMap.set(key, item);
    });

    const refundMap = new Map();
    refundAgg.forEach((item) => {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, "0")}`;
      refundMap.set(key, item);
    });

    const series = buckets.map((b) => {
      const paid = paidMap.get(b.key) || { grossSales: 0, orderCount: 0 };
      const refund = refundMap.get(b.key) || { refundedAmount: 0, refundCount: 0 };
      const platformFee = Math.round(paid.grossSales * 0.1); // 10% platform commission invariant
      const netSales = Math.max(0, paid.grossSales - refund.refundedAmount);

      return {
        key: b.key,
        label: b.label,
        dateStr: b.dateStr,
        grossSales: paid.grossSales,
        netSales,
        platformFee,
        orderCount: paid.orderCount,
        refundedAmount: refund.refundedAmount,
        refundCount: refund.refundCount,
      };
    });

    return {
      labels: series.map((s) => s.label),
      dateLabels: series.map((s) => s.dateStr),
      grossSales: series.map((s) => s.grossSales),
      netSales: series.map((s) => s.netSales),
      platformFees: series.map((s) => s.platformFee),
      orderCounts: series.map((s) => s.orderCount),
      series,
    };
  }

  /**
   * Category distribution across all items and sales volume.
   */
  async getCategoryBreakdown() {
    const [productCategories, orderCategories] = await Promise.all([
      Product.aggregate([
        {
          $group: {
            _id: { $ifNull: ["$category", "Uncategorized"] },
            itemCount: { $sum: 1 },
            avgStartingPrice: { $avg: "$startingPrice" },
            totalBids: { $sum: "$bidCount" },
          },
        },
        { $sort: { itemCount: -1 } },
      ]),
      Order.aggregate([
        { $match: { status: "PAID" } },
        {
          $group: {
            _id: { $ifNull: ["$category", "Uncategorized"] },
            totalRevenue: { $sum: { $ifNull: ["$finalPrice", 0] } },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { totalRevenue: -1 } },
      ]),
    ]);

    const revenueMap = new Map();
    orderCategories.forEach((cat) => {
      revenueMap.set(cat._id, cat);
    });

    const categories = productCategories.map((p) => {
      const rev = revenueMap.get(p._id) || { totalRevenue: 0, orderCount: 0 };
      return {
        category: p._id,
        itemCount: p.itemCount,
        avgStartingPrice: Math.round(p.avgStartingPrice || 0),
        totalBids: p.totalBids || 0,
        totalRevenue: rev.totalRevenue,
        orderCount: rev.orderCount,
      };
    });

    return {
      labels: categories.map((c) => c.category),
      counts: categories.map((c) => c.itemCount),
      revenues: categories.map((c) => c.totalRevenue),
      items: categories,
    };
  }

  /**
   * Auction lifecycle health, conversion rate, and bid volume.
   */
  async getAuctionHealth() {
    const now = new Date();

    const [statusAgg, pricingStats, totalBids] = await Promise.all([
      Product.aggregate([
        {
          $group: {
            _id: {
              $cond: [
                {
                  $and: [
                    { $in: ["$status", ["Active", "LIVE"]] },
                    { $or: [{ $gt: ["$endTime", now] }, { $eq: ["$endTime", null] }] },
                  ],
                },
                "ACTIVE",
                {
                  $cond: [
                    { $in: ["$status", ["SCHEDULED", "DRAFT"]] },
                    "UPCOMING",
                    {
                      $cond: [
                        { $in: ["$status", ["Closed", "ENDED", "SETTLED"]] },
                        "COMPLETED",
                        "UNSOLD_OR_CANCELLED",
                      ],
                    },
                  ],
                },
              ],
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Product.aggregate([
        {
          $group: {
            _id: null,
            avgStartingPrice: { $avg: "$startingPrice" },
            avgCurrentPrice: { $avg: "$currentPrice" },
            totalAuctions: { $sum: 1 },
          },
        },
      ]),
      Product.aggregate([
        {
          $group: {
            _id: null,
            totalBids: { $sum: { $ifNull: ["$bidCount", 0] } },
          },
        },
      ]),
    ]);

    const statusMap = {
      ACTIVE: 0,
      UPCOMING: 0,
      COMPLETED: 0,
      UNSOLD_OR_CANCELLED: 0,
    };

    statusAgg.forEach((s) => {
      if (statusMap[s._id] !== undefined) {
        statusMap[s._id] = s.count;
      }
    });

    const totalAuctions = pricingStats[0]?.totalAuctions || 0;
    const resolvedAuctions = statusMap.COMPLETED + statusMap.UNSOLD_OR_CANCELLED;
    const completionRate =
      resolvedAuctions > 0
        ? Math.round((statusMap.COMPLETED / resolvedAuctions) * 100)
        : 0;

    return {
      totalAuctions,
      activeAuctions: statusMap.ACTIVE,
      upcomingAuctions: statusMap.UPCOMING,
      completedAuctions: statusMap.COMPLETED,
      unsoldOrCancelled: statusMap.UNSOLD_OR_CANCELLED,
      completionRate,
      avgStartingPrice: Math.round(pricingStats[0]?.avgStartingPrice || 0),
      avgCurrentPrice: Math.round(pricingStats[0]?.avgCurrentPrice || 0),
      totalBids: totalBids[0]?.totalBids || 0,
    };
  }

  /**
   * User and Seller registration growth over time.
   */
  async getUserGrowth(months = 12) {
    const buckets = generateMonthlyBuckets(months);
    const startDate = new Date(Date.UTC(buckets[0].year, buckets[0].month - 1, 1));

    const [userAgg, sellerAgg] = await Promise.all([
      UserModel.aggregate([
        { $match: { role: { $ne: "admin" }, createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              year: { $year: { date: "$createdAt", timezone: "UTC" } },
              month: { $month: { date: "$createdAt", timezone: "UTC" } },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      RealSeller.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              year: { $year: { date: "$createdAt", timezone: "UTC" } },
              month: { $month: { date: "$createdAt", timezone: "UTC" } },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const userMap = new Map();
    userAgg.forEach((item) => {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, "0")}`;
      userMap.set(key, item.count);
    });

    const sellerMap = new Map();
    sellerAgg.forEach((item) => {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, "0")}`;
      sellerMap.set(key, item.count);
    });

    const items = buckets.map((b) => ({
      key: b.key,
      label: b.label,
      dateStr: b.dateStr,
      users: userMap.get(b.key) || 0,
      sellers: sellerMap.get(b.key) || 0,
    }));

    return {
      labels: items.map((i) => i.label),
      dateLabels: items.map((i) => i.dateStr),
      users: items.map((i) => i.users),
      sellers: items.map((i) => i.sellers),
      items,
    };
  }

  /**
   * Dispute and complaint breakdown by reportType from ReportAdmin.
   */
  async getDisputeReasonBreakdown() {
    const reports = await ReportAdmin.aggregate([
      {
        $group: {
          _id: { $ifNull: ["$reportType", "other"] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const typeLabels = {
      delivery: "Fulfillment & Delivery",
      illegal: "Policy & Counterfeit",
      "payment-deposit": "Payment / Deposit",
      "payment-withdraw": "Withdrawal",
      other: "General Complaints",
    };

    const items = reports.map((r) => ({
      type: r._id,
      label: typeLabels[r._id] || r._id,
      count: r.count,
    }));

    return {
      labels: items.map((i) => i.label),
      counts: items.map((i) => i.count),
      items,
    };
  }

  /**
   * Financial deposits, withdrawals, and wallet movements from Transaction.
   */
  async getFinancialFlows() {
    const flows = await Transaction.aggregate([
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    let deposits = 0;
    let withdrawals = 0;
    let depositCount = 0;
    let withdrawalCount = 0;

    flows.forEach((f) => {
      if (f._id === "deposit") {
        deposits = f.totalAmount;
        depositCount = f.count;
      } else if (f._id === "withdrawal") {
        withdrawals = f.totalAmount;
        withdrawalCount = f.count;
      }
    });

    return {
      deposits,
      withdrawals,
      netFlow: deposits - withdrawals,
      depositCount,
      withdrawalCount,
    };
  }

  /**
   * Unified comprehensive administrative analytics overview.
   */
  async getFullAnalyticsOverview() {
    const [
      revenueData,
      categoryData,
      auctionHealth,
      userGrowth,
      disputeReasons,
      financialFlows,
    ] = await Promise.all([
      this.getRevenueTimeSeries(12),
      this.getCategoryBreakdown(),
      this.getAuctionHealth(),
      this.getUserGrowth(12),
      this.getDisputeReasonBreakdown(),
      this.getFinancialFlows(),
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
  }
}

module.exports = new AnalyticsService();
