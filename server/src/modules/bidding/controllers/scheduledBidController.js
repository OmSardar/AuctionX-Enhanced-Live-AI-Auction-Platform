/**
 * Scheduled Bid Controller
 *
 * Handles creation, retrieval, and cancellation of user-controlled scheduled bids.
 */

const ScheduledBid = require("../models/scheduledBid");
const Product = require("../../products/models/productSchema");
const { parseAuctionTimeBoundaries } = require("../middleware/checkTimeRestriction");

/**
 * Creates a scheduled bid for an upcoming or active auction.
 * POST /api/scheduled-bids
 */
exports.createScheduledBid = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication required to schedule a bid",
      });
    }

    const { productId, amount, targetTime: rawTargetTime, idempotencyKey } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        code: "MISSING_PRODUCT_ID",
        message: "Product ID is required",
      });
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_AMOUNT",
        message: "Bid amount must be a positive number",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        code: "PRODUCT_NOT_FOUND",
        message: "Auction product not found",
      });
    }

    // Check if listing is moderated
    if (product.isModerated || ["REMOVED", "SUSPENDED"].includes(product.moderationStatus)) {
      return res.status(403).json({
        success: false,
        code: "LISTING_MODERATED",
        message: "Cannot schedule bids on a listing that has been moderated or suspended",
      });
    }

    // Disallow self-bidding
    if (product.email && user.email && product.email.toLowerCase() === user.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        code: "SELF_BIDDING_FORBIDDEN",
        message: "You cannot schedule a bid on your own auction listing",
      });
    }

    // Check terminal auction statuses
    const terminalStatuses = ["Closed", "ENDED", "AWAITING_PAYMENT", "SETTLED", "UNSOLD", "CANCELLED"];
    if (terminalStatuses.includes(product.status)) {
      return res.status(400).json({
        success: false,
        code: "AUCTION_CLOSED",
        message: "Cannot schedule bids for an auction that has already ended or closed",
      });
    }

    // Resolve time boundaries
    const boundaries = parseAuctionTimeBoundaries(product);
    const startTime = product.startTime || boundaries.startTime;
    const endTime = product.endTime || boundaries.endTime;
    const now = new Date();

    if (endTime && now.getTime() >= endTime.getTime()) {
      return res.status(400).json({
        success: false,
        code: "AUCTION_ENDED",
        message: "Auction has already concluded",
      });
    }

    // Validate or default targetTime
    let targetTime = null;
    if (rawTargetTime) {
      targetTime = new Date(rawTargetTime);
      if (isNaN(targetTime.getTime())) {
        return res.status(400).json({
          success: false,
          code: "INVALID_TARGET_TIME",
          message: "Provided scheduled time is invalid",
        });
      }
    } else {
      // Default to auction start time if upcoming, or current time if already live
      targetTime = startTime && startTime.getTime() > now.getTime() ? startTime : now;
    }

    // Target time must not be past the auction end time
    if (endTime && targetTime.getTime() >= endTime.getTime()) {
      return res.status(400).json({
        success: false,
        code: "TARGET_TIME_EXCEEDS_AUCTION",
        message: "Scheduled execution time cannot be after the auction end time",
      });
    }

    // Validate minimum bid requirement (must be at least starting price)
    const startPrice =
      product.startingPrice !== undefined
        ? product.startingPrice
        : product.biddingStartPrice || 0;
    const currentPrice =
      product.currentPrice !== undefined
        ? product.currentPrice
        : product.tempamount || startPrice;
    const minIncrement = product.minIncrement || 50;

    const minimumAllowed = product.bidCount > 0 ? currentPrice + minIncrement : startPrice;

    if (parsedAmount < minimumAllowed) {
      return res.status(400).json({
        success: false,
        code: "AMOUNT_BELOW_MINIMUM",
        message: `Scheduled bid amount must be at least ₹${minimumAllowed}`,
        minimumRequired: minimumAllowed,
      });
    }

    // Idempotency check
    if (idempotencyKey) {
      const existing = await ScheduledBid.findOne({
        userId: user._id,
        productId,
        idempotencyKey,
      });
      if (existing) {
        return res.status(200).json({
          success: true,
          message: "Scheduled bid retrieved (idempotent)",
          scheduledBid: existing,
        });
      }
    }

    // Create ScheduledBid record
    const scheduledBid = await ScheduledBid.create({
      productId,
      userId: user._id,
      userEmail: user.email,
      userName: user.name || "Bidder",
      amount: Math.round(parsedAmount * 100) / 100,
      targetTime,
      status: "PENDING",
      idempotencyKey: idempotencyKey || null,
    });

    res.status(201).json({
      success: true,
      message: "Bid scheduled successfully",
      scheduledBid,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key collision
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_SCHEDULED_BID",
        message: "A scheduled bid with this idempotency key already exists",
      });
    }
    next(error);
  }
};

/**
 * Retrieves all scheduled bids for the authenticated user.
 * GET /api/scheduled-bids/user
 */
exports.getUserScheduledBids = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const scheduledBids = await ScheduledBid.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .populate(
        "productId",
        "name images category biddingStartPrice currentPrice status startTime endTime biddingEndTime"
      );

    res.status(200).json({
      success: true,
      count: scheduledBids.length,
      scheduledBids,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancels a pending scheduled bid.
 * DELETE /api/scheduled-bids/:id
 */
exports.cancelScheduledBid = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const { id } = req.params;
    const scheduledBid = await ScheduledBid.findOne({ _id: id, userId: user._id });

    if (!scheduledBid) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Scheduled bid not found",
      });
    }

    if (scheduledBid.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        code: "CANNOT_CANCEL",
        message: `Cannot cancel scheduled bid with status '${scheduledBid.status}'. Only PENDING bids may be cancelled.`,
      });
    }

    scheduledBid.status = "CANCELLED";
    await scheduledBid.save();

    res.status(200).json({
      success: true,
      message: "Scheduled bid cancelled successfully",
      scheduledBid,
    });
  } catch (error) {
    next(error);
  }
};
