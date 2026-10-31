const Seller = require("../models/seller");
const Order = require("../../../orders/models/orderSchema");

// Get all sellers with pagination
const getAllSellers = async (req, res) => {
  try {
    const { page = 1, limit = 5, status, search } = req.query;

    // Convert page and limit to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Calculate skip value for pagination
    const skip = (pageNum - 1) * limitNum;

    // Build query based on filters
    let query = {};

    // Filter by status if provided
    if (status && status !== "all") {
      query.status = status;
    }

    // Search by name, email, or store name if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { storeName: { $regex: search, $options: "i" } },
      ];
    }

    // Query sellers with pagination
    const sellers = await Seller.find(query)
      .select("-password") // Exclude password
      .sort({ createdAt: -1 }) // Sort by most recent first
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const totalSellersCount = await Seller.countDocuments(query);

    // Calculate total pages
    const totalPages = Math.ceil(totalSellersCount / limitNum);

    // Get count of sellers by status
    const statusCounts = await Seller.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Format the status counts
    const formattedStatusCounts = {};
    statusCounts.forEach((item) => {
      formattedStatusCounts[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      sellers,
      totalPages,
      currentPage: pageNum,
      totalSellers: totalSellersCount,
      statusCounts: formattedStatusCounts,
    });
  } catch (error) {
    console.error("Error fetching sellers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sellers",
      error: error.message,
    });
  }
};

// Get single seller details
const getSellerDetails = async (req, res) => {
  try {
    const { sellerId } = req.params;

    const seller = await Seller.findById(sellerId).select("-password");

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    // Get seller's recent orders
    const recentOrders = await Order.find({ sellerId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Get seller's sales statistics
    const salesStats = await Order.aggregate([
      { $match: { sellerId: seller._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          revenue: { $sum: "$soldPrice" },
        },
      },
    ]);

    // Format sales stats
    const formattedSalesStats = {};
    salesStats.forEach((item) => {
      formattedSalesStats[item._id] = {
        count: item.count,
        revenue: item.revenue,
      };
    });

    res.status(200).json({
      success: true,
      seller,
      recentOrders,
      salesStats: formattedSalesStats,
    });
  } catch (error) {
    console.error("Error fetching seller details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch seller details",
      error: error.message,
    });
  }
};

// Update seller status
const updateSellerStatus = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { status } = req.body;

    if (!["active", "suspended", "pending_approval"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const seller = await Seller.findByIdAndUpdate(
      sellerId,
      { status },
      { new: true }
    ).select("-password");

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Seller status updated successfully",
      seller,
    });
  } catch (error) {
    console.error("Error updating seller status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update seller status",
      error: error.message,
    });
  }
};

// Verify seller
const verifySeller = async (req, res) => {
  try {
    const { sellerId } = req.params;

    const seller = await Seller.findByIdAndUpdate(
      sellerId,
      {
        isVerified: true,
        status: "active",
      },
      { new: true }
    ).select("-password");

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Seller verified successfully",
      seller,
    });
  } catch (error) {
    console.error("Error verifying seller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify seller",
      error: error.message,
    });
  }
};

// Get seller statistics for dashboard
const getSellerStats = async (req, res) => {
  try {
    // Count sellers by status
    const statusCounts = await Seller.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Format status counts
    const formattedStatusCounts = {};
    statusCounts.forEach((item) => {
      formattedStatusCounts[item._id] = item.count;
    });

    // Count new sellers in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newSellersCount = await Seller.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Get top 5 sellers by sales
    const topSellers = await Seller.find()
      .sort({ totalSales: -1 })
      .limit(5)
      .select("name email storeName totalSales totalOrders isVerified");

    res.status(200).json({
      success: true,
      statusCounts: formattedStatusCounts,
      newSellersCount,
      topSellers,
    });
  } catch (error) {
    console.error("Error fetching seller statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch seller statistics",
      error: error.message,
    });
  }
};

module.exports = {
  getAllSellers,
  getSellerDetails,
  updateSellerStatus,
  verifySeller,
  getSellerStats,
};
