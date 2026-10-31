const mongoose = require("mongoose");
const Product = require("../../products/models/productSchema");
const Bid = require("../../bidding/models/bidSchema");
const Order = require("../../orders/models/orderSchema");
const User = require("../../users/models/user");
const ScheduledBid = require("../../bidding/models/scheduledBid");
const walletService = require("../../payments/services/walletService");
const { logger } = require("../../../infrastructure/logging/loggerMiddleware");

/**
 * Custom Error for Lifecycle Operations
 */
class LifecycleError extends Error {
  constructor(message, statusCode = 500, code = "LIFECYCLE_ERROR", details = {}) {
    super(message);
    this.name = "LifecycleError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Ensures indexes on critical models are initialized in the database.
 */
let indexesInitialized = false;
async function ensureIndexes() {
  if (indexesInitialized) return;
  try {
    await Promise.all([
      Order.init(),
      Product.init(),
      Bid.init(),
    ]);
    indexesInitialized = true;
  } catch (err) {
    if (logger) logger.warn(`[Lifecycle] Index initialization notice: ${err.message}`);
  }
}

/**
 * Normalizes and extracts canonical auction boundaries from a product document.
 * Safely handles both modern and legacy documents without inventing data.
 *
 * @param {Object} product
 * @returns {Object} { startTime, endTime, originalEndTime, maxExtensionDeadline }
 */
function normalizeAuctionBoundaries(product) {
  let startTime = product.startTime || null;
  let endTime = product.endTime || null;
  let originalEndTime = product.originalEndTime || null;
  let maxExtensionDeadline = product.maxExtensionDeadline || null;

  if (!startTime && product.biddingStartDate) {
    if (product.biddingStartTime) {
      const timeStr = String(product.biddingStartTime).trim();
      if (timeStr.includes("T") || timeStr.endsWith("Z")) {
        const parsed = new Date(timeStr);
        if (!isNaN(parsed.getTime())) startTime = parsed;
      } else {
        const [hours, minutes] = timeStr.split(":").map(Number);
        const date = new Date(product.biddingStartDate);
        if (!isNaN(date.getTime()) && !isNaN(hours) && !isNaN(minutes)) {
          date.setUTCHours(hours, minutes, 0, 0);
          startTime = date;
        }
      }
    }
    if (!startTime) {
      const parsed = new Date(product.biddingStartDate);
      if (!isNaN(parsed.getTime())) startTime = parsed;
    }
  }

  if (!endTime && product.biddingEndTime) {
    const parsed = new Date(product.biddingEndTime);
    if (!isNaN(parsed.getTime())) endTime = parsed;
  }

  if (!originalEndTime && endTime) {
    originalEndTime = endTime;
  }

  if (!maxExtensionDeadline && originalEndTime) {
    maxExtensionDeadline = new Date(originalEndTime.getTime() + 15 * 60 * 1000);
  }

  return { startTime, endTime, originalEndTime, maxExtensionDeadline };
}

/**
 * Transitions SCHEDULED auctions to LIVE once their scheduled startTime arrives.
 * Idempotent, concurrency-safe via atomic conditional findOneAndUpdate.
 *
 * @param {Object} options
 * @param {Date} [options.now] - Current authoritative server timestamp
 * @param {number} [options.batchSize] - Bounded batch limit
 * @param {Object} [options.io] - Optional Socket.IO server instance
 * @returns {Promise<Object>} { processedCount, transitionedCount, productIds }
 */
async function startScheduledAuctions({ now = new Date(), batchSize = 50, io = null } = {}) {
  const queryTime = now instanceof Date ? now : new Date(now);

  // Find candidates that are scheduled to start (handles both canonical and legacy timestamps)
  const candidates = await Product.find({
    status: "SCHEDULED",
    isModerated: { $ne: true },
    moderationStatus: { $nin: ["REMOVED", "SUSPENDED"] },
    $or: [
      { startTime: { $lte: queryTime } },
      { startTime: null },
      { startTime: { $exists: false } },
    ],
  })
    .limit(batchSize)
    .select("_id name startTime endTime biddingEndTime biddingStartDate biddingStartTime originalEndTime maxExtensionDeadline")
    .lean();

  let transitionedCount = 0;
  const transitionedIds = [];

  for (const candidate of candidates) {
    const boundaries = normalizeAuctionBoundaries(candidate);

    // If scheduled startTime has not yet arrived, skip
    if (boundaries.startTime && boundaries.startTime.getTime() > queryTime.getTime()) {
      continue;
    }

    // Atomic transition gate: only one worker can match { status: 'SCHEDULED' }
    const updated = await Product.findOneAndUpdate(
      {
        _id: candidate._id,
        status: "SCHEDULED",
        isModerated: { $ne: true },
        moderationStatus: { $nin: ["REMOVED", "SUSPENDED"] },
        $or: [
          { startTime: { $lte: queryTime } },
          { startTime: null },
          { startTime: { $exists: false } },
        ],
      },
      {
        $set: {
          status: "LIVE",
          ...(boundaries.startTime && !candidate.startTime ? { startTime: boundaries.startTime } : {}),
          ...(boundaries.endTime && !candidate.endTime ? { endTime: boundaries.endTime } : {}),
          ...(boundaries.originalEndTime && !candidate.originalEndTime ? { originalEndTime: boundaries.originalEndTime } : {}),
          ...(boundaries.maxExtensionDeadline && !candidate.maxExtensionDeadline ? { maxExtensionDeadline: boundaries.maxExtensionDeadline } : {}),
        },
      },
      { new: true }
    );

    if (updated) {
      transitionedCount++;
      transitionedIds.push(updated._id.toString());

      if (logger) {
        logger.info(
          `[Lifecycle] Auction ${updated._id} transitioned from SCHEDULED to LIVE at ${queryTime.toISOString()}`
        );
      }

      // Real-time broadcast after successful DB persistence
      if (io) {
        try {
          const roomId = updated._id.toString();
          const payload = {
            productId: roomId,
            status: "LIVE",
            startTime: updated.startTime ? updated.startTime.toISOString() : null,
            endTime: updated.endTime
              ? updated.endTime.toISOString()
              : updated.biddingEndTime || null,
          };
          io.to(roomId).emit("auctionStarted", payload);
          io.emit("auctionStatusChanged", payload);
        } catch (emitErr) {
          if (logger) {
            logger.warn(`[Lifecycle] Socket emit error on auction ${updated._id}: ${emitErr.message}`);
          }
        }
      }
    }
  }

  return {
    processedCount: candidates.length,
    transitionedCount,
    productIds: transitionedIds,
  };
}

/**
 * Idempotently repairs or generates a pending Order for an auction that transitioned to ENDED
 * with a winner, but was interrupted before the Order record could be created.
 * Preserves the immutable payment deadline (exactly 24h after original finalization time).
 *
 * @param {Object} product - Product document
 * @param {Object} options
 * @param {Date} [options.now]
 * @returns {Promise<Object|null>} The existing or repaired Order
 */
async function repairOrphanOrder(product, { now = new Date() } = {}) {
  await ensureIndexes();

  let existingOrder = await Order.findOne({ productId: product._id });
  if (existingOrder) {
    if (!product.orderId) {
      await Product.updateOne({ _id: product._id }, { $set: { orderId: existingOrder._id } });
    }
    return existingOrder;
  }

  // Find authoritative winning bid
  const winningBid = await Bid.findOne({
    productId: product._id,
    status: "ACCEPTED",
  }).sort({ amount: -1, createdAt: -1, _id: -1 });

  if (!winningBid && !product.winnerId && !product.highestBidder) {
    return null;
  }

  const winnerId = winningBid?.bidder || product.winnerId || product.highestBidder;
  const finalPrice = winningBid?.amount || product.finalPrice || product.currentPrice || 0;
  const winnerUser = winnerId ? await User.findById(winnerId).lean() : null;

  // Deadline MUST be exactly 24 hours after original finalization time, NOT extended on retry
  const originalFinalizedAt = product.finalizedAt || product.updatedAt || now;
  const paymentDeadline =
    product.paymentDeadline ||
    new Date(originalFinalizedAt.getTime() + 24 * 60 * 60 * 1000);

  // Attempt wallet capture for orphan repair
  try {
    await walletService.captureWinningReservation({
      productId: product._id,
      winnerId,
      finalAmount: finalPrice,
    });
  } catch (capErr) {
    if (logger) logger.warn(`[Lifecycle] Orphan order repair capture note: ${capErr.message}`);
  }

  try {
    existingOrder = await Order.create({
      productId: product._id,
      winnerId,
      title: product.name || "Auction Item",
      name:
        winningBid?.bidderName ||
        winnerUser?.name ||
        product.highestBidderName ||
        "Auction Winner",
      userEmail:
        winningBid?.bidderEmail ||
        winnerUser?.email ||
        product.highestBidderEmail ||
        "winner@auctionx.com",
      sellerEmail: product.email || "seller@auctionx.com",
      category: product.category || "General",
      images:
        product.images && product.images.length > 0
          ? product.images
          : [{ secure_url: "https://example.com/item.jpg", public_id: "default" }],
      biddingStartPrice: product.startingPrice || product.biddingStartPrice || 0,
      highestBid: finalPrice,
      finalPrice: finalPrice,
      phoneNo: winnerUser?.phoneNo || product.mobileNumber || "9876543210",
      address: winnerUser?.address || "Address on File",
      status: "PAID",
      paymentMethod: "WALLET",
      walletSettled: true,
      paidAt: originalFinalizedAt,
      paymentDeadline,
    });
  } catch (err) {
    if (err.code === 11000) {
      existingOrder = await Order.findOne({ productId: product._id });
    } else {
      throw err;
    }
  }

  if (existingOrder) {
    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          orderId: existingOrder._id,
          paymentDeadline,
          finalizedAt: originalFinalizedAt,
        },
      }
    );
  }

  return existingOrder;
}

/**
 * Scans for auctions in status 'ENDED' with a winner that are missing an Order record
 * (e.g., due to process crash, network failure, or interrupted finalization) and repairs them.
 *
 * @param {Object} options
 * @param {Date} [options.now]
 * @param {number} [options.batchSize]
 * @param {Object} [options.io]
 * @returns {Promise<Object>} { scannedCount, recoveredCount, errors }
 */
async function recoverOrphanFinalizedAuctions({ now = new Date(), batchSize = 50, io = null } = {}) {
  const queryTime = now instanceof Date ? now : new Date(now);

  const orphans = await Product.find({
    status: "ENDED",
    $or: [{ orderId: null }, { orderId: { $exists: false } }],
    $and: [
      { $or: [{ winnerId: { $ne: null } }, { highestBidder: { $ne: null } }, { bidCount: { $gt: 0 } }] },
    ],
  })
    .limit(batchSize)
    .lean();

  let recoveredCount = 0;
  const errors = [];

  for (const orphan of orphans) {
    try {
      const repairedOrder = await repairOrphanOrder(orphan, { now: queryTime });
      if (repairedOrder) {
        recoveredCount++;
        if (logger) {
          logger.info(`[Lifecycle] Successfully recovered orphan order for ended auction ${orphan._id}`);
        }
      }
    } catch (err) {
      errors.push({
        productId: orphan._id.toString(),
        error: err.message,
      });
      if (logger) {
        logger.error(`[Lifecycle] Failed to recover orphan auction ${orphan._id}: ${err.message}`);
      }
    }
  }

  return {
    scannedCount: orphans.length,
    recoveredCount,
    errors,
  };
}

/**
 * Finalizes a single expired auction with winner determination, ledger consistency verification,
 * and idempotent pending payment obligation (Order) generation.
 *
 * @param {string|ObjectId} productId - MongoDB ObjectId of the product
 * @param {Object} options
 * @param {Date} [options.now] - Current authoritative server timestamp
 * @param {Object} [options.io] - Optional Socket.IO server instance
 * @returns {Promise<Object>} Authoritative finalization result
 */
async function finalizeSingleAuction(productId, { now = new Date(), io = null } = {}) {
  await ensureIndexes();
  const queryTime = now instanceof Date ? now : new Date(now);

  const product = await Product.findById(productId);
  if (!product) {
    throw new LifecycleError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  // If flagged for manual reconciliation, reject immediately
  if (product.reconciliationRequired) {
    throw new LifecycleError(
      `Ledger consistency check failed: ${product.reconciliationNotes || "Reconciliation required"}`,
      500,
      "LEDGER_PRODUCT_MISMATCH",
      { productId: product._id.toString(), notes: product.reconciliationNotes }
    );
  }

  // If already ended, return cached outcome idempotently and repair orphan order if interrupted
  const terminalStatuses = ["ENDED", "UNSOLD", "Closed", "SETTLED", "CANCELLED", "AWAITING_PAYMENT"];
  if (terminalStatuses.includes(product.status)) {
    let existingOrder = await Order.findOne({ productId: product._id });
    const hasWinner = Boolean(
      product.winnerId ||
      product.highestBidder ||
      (product.bidCount && product.bidCount > 0)
    );

    if (product.status === "ENDED" && hasWinner && !existingOrder) {
      existingOrder = await repairOrphanOrder(product, { now: queryTime });
    }

    return {
      success: true,
      alreadyFinalized: true,
      status: product.status,
      product,
      order: existingOrder,
    };
  }

  // Active status check
  const activeStatuses = ["Active", "LIVE"];
  if (!activeStatuses.includes(product.status)) {
    throw new LifecycleError(
      `Cannot finalize product with status ${product.status}`,
      400,
      "INVALID_AUCTION_STATUS"
    );
  }

  // Resolve effective closing time
  const { endTime } = normalizeAuctionBoundaries(product);
  const effectiveEndTime = product.endTime || endTime;

  if (!effectiveEndTime) {
    throw new LifecycleError(
      "Auction closing time cannot be resolved",
      500,
      "MISSING_END_TIME"
    );
  }

  // Strict boundary check: never finalize before authoritative effective endTime
  if (queryTime.getTime() < effectiveEndTime.getTime()) {
    const wasExtended = Boolean(
      (product.antiSnipeCount && product.antiSnipeCount > 0) ||
      (product.originalEndTime && effectiveEndTime.getTime() > product.originalEndTime.getTime())
    );
    return {
      success: false,
      reason: "AUCTION_NOT_EXPIRED",
      wasExtended,
      effectiveEndTime: effectiveEndTime.toISOString(),
      currentTime: queryTime.toISOString(),
    };
  }

  const bidCount = product.bidCount || 0;

  // =========================================================================
  // SCENARIO 1: Auction Ended with NO Valid Bids (UNSOLD)
  // =========================================================================
  if (bidCount === 0) {
    // Atomic conditional finalization gate (supports both canonical and legacy documents)
    const finalizedProduct = await Product.findOneAndUpdate(
      {
        _id: product._id,
        status: { $in: activeStatuses },
        $or: [
          { endTime: { $lte: queryTime } },
          { endTime: { $exists: false } },
          { endTime: null },
        ],
      },
      {
        $set: {
          status: "UNSOLD",
          finalizedAt: queryTime,
          winnerId: null,
          highestBidder: null,
          highestBidderEmail: null,
          highestBidderName: null,
          finalPrice: product.startingPrice || product.biddingStartPrice || 0,
          endTime: effectiveEndTime,
          originalEndTime: product.originalEndTime || effectiveEndTime,
        },
      },
      { new: true }
    );

    if (!finalizedProduct) {
      // Concurrently finalized or extended by an in-flight bid
      const refreshed = await Product.findById(product._id);
      const isTerminal = refreshed && terminalStatuses.includes(refreshed.status);
      return {
        success: isTerminal,
        alreadyFinalized: isTerminal,
        wasExtended: !isTerminal,
        status: refreshed ? refreshed.status : product.status,
        product: refreshed,
        order: null,
      };
    }

    if (logger) {
      logger.info(
        `[Lifecycle] Auction ${product._id} ended UNSOLD (0 bids) at ${queryTime.toISOString()}`
      );
    }

    // Release any stray reservations for this product
    await walletService.releaseAllAuctionReservations(product._id, "AUCTION_UNSOLD");

    // Broadcast after DB persistence
    if (io) {
      try {
        const roomId = product._id.toString();
        const payload = {
          productId: roomId,
          status: "UNSOLD",
          finalPrice: finalizedProduct.finalPrice,
          winnerId: null,
          bidCount: 0,
        };
        io.to(roomId).emit("auctionEnded", payload);
        io.emit("auctionStatusChanged", payload);
      } catch (err) {
        if (logger) logger.warn(`[Lifecycle] Socket emit error: ${err.message}`);
      }
    }

    return {
      success: true,
      alreadyFinalized: false,
      status: "UNSOLD",
      product: finalizedProduct,
      order: null,
    };
  }

  // =========================================================================
  // SCENARIO 2: Auction Ended with Bids — Winner Determination & Consistency
  // =========================================================================
  // Re-fetch fresh product state to prevent comparing against stale in-memory snapshot
  const freshProduct = await Product.findById(product._id);
  if (!freshProduct || !activeStatuses.includes(freshProduct.status)) {
    const refreshed = freshProduct || (await Product.findById(product._id));
    const isTerminal = refreshed && terminalStatuses.includes(refreshed.status);
    const existingOrder = await Order.findOne({ productId: product._id });
    return {
      success: isTerminal,
      alreadyFinalized: isTerminal,
      status: refreshed ? refreshed.status : product.status,
      product: refreshed,
      order: existingOrder,
    };
  }

  const freshBoundaries = normalizeAuctionBoundaries(freshProduct);
  const freshEndTime = freshProduct.endTime || freshBoundaries.endTime;
  if (freshEndTime && queryTime.getTime() < freshEndTime.getTime()) {
    return {
      success: false,
      reason: "AUCTION_NOT_EXPIRED",
      wasExtended: true,
      effectiveEndTime: freshEndTime.toISOString(),
      currentTime: queryTime.toISOString(),
    };
  }

  // Query authoritative accepted bid ledger
  const latestAcceptedBid = await Bid.findOne({
    productId: freshProduct._id,
    status: "ACCEPTED",
  }).sort({ amount: -1, createdAt: -1, _id: -1 });

  // Consistency Invariant Verification:
  // 1. If bidCount > 0, an ACCEPTED bid MUST exist in the ledger
  if (!latestAcceptedBid) {
    const errorMsg = `Inconsistency detected on auction ${product._id}: bidCount is ${freshProduct.bidCount} but no ACCEPTED bids found in ledger`;
    if (logger) logger.error(`[Lifecycle] ${errorMsg}`);

    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          reconciliationRequired: true,
          reconciliationNotes: errorMsg,
        },
      }
    );

    throw new LifecycleError(
      "Ledger consistency check failed: missing accepted bid record",
      500,
      "LEDGER_PRODUCT_MISMATCH",
      { productId: product._id.toString(), bidCount: freshProduct.bidCount }
    );
  }

  // 2. Verify agreement between fresh Product state and Bid ledger
  const priceMatches =
    Math.abs(latestAcceptedBid.amount - (freshProduct.currentPrice || freshProduct.biddingStartPrice || 0)) < 0.01;
  const bidderMatches =
    freshProduct.highestBidder &&
    latestAcceptedBid.bidder.toString() === freshProduct.highestBidder.toString();

  if (!priceMatches || !bidderMatches) {
    const errorMsg = `Ledger inconsistency on auction ${product._id}: Product currentPrice=${freshProduct.currentPrice}, highestBidder=${freshProduct.highestBidder} vs Bid ledger amount=${latestAcceptedBid.amount}, bidder=${latestAcceptedBid.bidder}`;
    if (logger) logger.error(`[Lifecycle] ${errorMsg}`);

    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          reconciliationRequired: true,
          reconciliationNotes: errorMsg,
        },
      }
    );

    throw new LifecycleError(
      "Ledger consistency check failed: price or bidder mismatch",
      500,
      "LEDGER_PRODUCT_MISMATCH",
      {
        productId: product._id.toString(),
        productPrice: freshProduct.currentPrice,
        ledgerPrice: latestAcceptedBid.amount,
        productBidder: freshProduct.highestBidder,
        ledgerBidder: latestAcceptedBid.bidder,
      }
    );
  }

  // Payment deadline: exactly 24 hours after authoritative finalization time
  const paymentDeadline = new Date(queryTime.getTime() + 24 * 60 * 60 * 1000);

  // Atomic transition gate
  const finalizedProduct = await Product.findOneAndUpdate(
    {
      _id: product._id,
      status: { $in: activeStatuses },
      $or: [
        { endTime: { $lte: queryTime } },
        { endTime: { $exists: false } },
        { endTime: null },
      ],
    },
    {
      $set: {
        status: "ENDED",
        winnerId: latestAcceptedBid.bidder,
        highestBidder: latestAcceptedBid.bidder,
        highestBidderEmail: latestAcceptedBid.bidderEmail,
        highestBidderName: latestAcceptedBid.bidderName,
        finalPrice: latestAcceptedBid.amount,
        currentPrice: latestAcceptedBid.amount,
        finalizedAt: queryTime,
        paymentDeadline,
        endTime: freshEndTime,
        originalEndTime: freshProduct.originalEndTime || freshEndTime,
      },
    },
    { new: true }
  );

  if (!finalizedProduct) {
    // Concurrently finalized by another worker or extended by racing bid
    const refreshed = await Product.findById(product._id);
    const isTerminal = refreshed && terminalStatuses.includes(refreshed.status);
    const existingOrder = await Order.findOne({ productId: product._id });
    return {
      success: isTerminal,
      alreadyFinalized: isTerminal,
      wasExtended: !isTerminal && (refreshed?.endTime > queryTime),
      reason: !isTerminal ? "AUCTION_EXTENDED" : undefined,
      status: refreshed ? refreshed.status : product.status,
      product: refreshed,
      order: existingOrder,
    };
  }

  // Automatic Wallet-Backed Escrow Capture & Paid Order Fulfillment
  let captureResult = null;
  try {
    captureResult = await walletService.captureWinningReservation({
      productId: product._id,
      winnerId: latestAcceptedBid.bidder,
      finalAmount: latestAcceptedBid.amount,
    });
  } catch (captureErr) {
    if (logger) {
      logger.error(
        `[Lifecycle] Wallet capture failed for auction ${product._id}: ${captureErr.message}`
      );
    }
    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          reconciliationRequired: true,
          reconciliationNotes: `Settlement capture error: ${captureErr.message}`,
        },
      }
    );
    throw captureErr;
  }

  // Idempotent creation of winning paid order
  let order = await Order.findOne({ productId: product._id });
  if (!order) {
    try {
      const winnerUser = await User.findById(latestAcceptedBid.bidder).lean();
      order = await Order.create({
        productId: product._id,
        winnerId: latestAcceptedBid.bidder,
        title: product.name || "Auction Item",
        name: latestAcceptedBid.bidderName || winnerUser?.name || "Auction Winner",
        userEmail: latestAcceptedBid.bidderEmail || winnerUser?.email || "winner@auctionx.com",
        sellerEmail: product.email || "seller@auctionx.com",
        category: product.category || "General",
        images:
          product.images && product.images.length > 0
            ? product.images
            : [{ secure_url: "https://example.com/item.jpg", public_id: "default" }],
        biddingStartPrice: product.startingPrice || product.biddingStartPrice || 0,
        highestBid: latestAcceptedBid.amount,
        finalPrice: latestAcceptedBid.amount,
        phoneNo: winnerUser?.phoneNo || product.mobileNumber || "9876543210",
        address: winnerUser?.address || "Address on File",
        status: "PAID",
        paymentMethod: "WALLET",
        walletSettled: true,
        paidAt: queryTime,
        paymentDeadline,
      });
    } catch (orderErr) {
      if (orderErr.code === 11000) {
        // Unique sparse index race: fetched concurrently created order
        order = await Order.findOne({ productId: product._id });
      } else {
        if (logger) {
          logger.error(
            `[Lifecycle] Failed to create Order for auction ${product._id}: ${orderErr.message}`
          );
        }
        throw orderErr;
      }
    }
  }

  // Link reservation to order
  if (captureResult?.reservation && order && !captureResult.reservation.orderId) {
    captureResult.reservation.orderId = order._id;
    await captureResult.reservation.save().catch(() => {});
  }

  // Release any leftover/stray active reservations for this product
  await walletService.releaseAllAuctionReservations(
    product._id,
    "AUCTION_SETTLED_LEFTOVER_CLEANUP"
  );

  // Link order to product
  if (order && !finalizedProduct.orderId) {
    await Product.updateOne(
      { _id: product._id },
      { $set: { orderId: order._id } }
    );
  }

  if (logger) {
    logger.info(
      `[Lifecycle] Auction ${product._id} finalized successfully. Winner: ${latestAcceptedBid.bidder}, Final Price: ₹${latestAcceptedBid.amount}, Deadline: ${paymentDeadline.toISOString()}`
    );
  }

  // Real-time broadcast after successful DB persistence
  if (io) {
    try {
      const roomId = product._id.toString();
      const payload = {
        productId: roomId,
        status: "ENDED",
        finalPrice: latestAcceptedBid.amount,
        winnerId: latestAcceptedBid.bidder.toString(),
        winnerEmail: latestAcceptedBid.bidderEmail,
        paymentDeadline: paymentDeadline.toISOString(),
        bidCount: freshProduct.bidCount,
      };
      io.to(roomId).emit("auctionEnded", payload);
      io.emit("auctionStatusChanged", payload);
    } catch (emitErr) {
      if (logger) logger.warn(`[Lifecycle] Socket emit error: ${emitErr.message}`);
    }
  }

  return {
    success: true,
    alreadyFinalized: false,
    status: "ENDED",
    product: finalizedProduct,
    order,
  };
}

/**
 * Finds and finalizes all expired auctions in bounded batches.
 * Idempotent, safe across multiple worker instances.
 *
 * @param {Object} options
 * @param {Date} [options.now] - Current authoritative server timestamp
 * @param {number} [options.batchSize] - Maximum batch size
 * @param {Object} [options.io] - Optional Socket.IO server instance
 * @returns {Promise<Object>} { processedCount, finalizedCount, errors }
 */
async function finalizeExpiredAuctions({ now = new Date(), batchSize = 50, io = null } = {}) {
  const queryTime = now instanceof Date ? now : new Date(now);

  const candidates = await Product.find({
    status: { $in: ["Active", "LIVE"] },
    reconciliationRequired: { $ne: true },
    $or: [
      { endTime: { $lte: queryTime } },
      { endTime: { $exists: false }, biddingEndTime: { $lte: queryTime.toISOString() } },
    ],
  })
    .limit(batchSize)
    .select("_id")
    .lean();

  let finalizedCount = 0;
  const errors = [];

  for (const candidate of candidates) {
    try {
      const result = await finalizeSingleAuction(candidate._id, { now: queryTime, io });
      if (result.success && !result.alreadyFinalized) {
        finalizedCount++;
      }
    } catch (err) {
      errors.push({
        productId: candidate._id.toString(),
        error: err.message,
        code: err.code || "UNKNOWN_ERROR",
      });
      if (logger) {
        logger.error(
          `[Lifecycle] Error finalizing auction ${candidate._id}: ${err.message}`
        );
      }
    }
  }

  return {
    processedCount: candidates.length,
    finalizedCount,
    errors,
  };
}

/**
 * Processes due user-controlled scheduled bids whose target execution timestamp
 * has arrived. Executes bids authoritatively via placeBid().
 *
 * @param {Object} options
 * @param {Date} [options.now] - Current authoritative server timestamp
 * @param {number} [options.batchSize] - Maximum batch size
 * @param {Object} [options.io] - Optional Socket.IO server instance
 * @returns {Promise<Object>} { processedCount, executedCount, failedCount }
 */
async function executeDueScheduledBids({ now = new Date(), batchSize = 50, io = null } = {}) {
  const queryTime = now instanceof Date ? now : new Date(now);
  const { placeBid } = require("../../bidding/services/bidService");

  // Find pending scheduled bids whose target time has arrived
  const candidates = await ScheduledBid.find({
    status: "PENDING",
    targetTime: { $lte: queryTime },
  })
    .sort({ targetTime: 1 })
    .limit(batchSize)
    .select("_id")
    .lean();

  let executedCount = 0;
  let failedCount = 0;

  for (const candidate of candidates) {
    // Concurrency-safe claim
    const scheduledBid = await ScheduledBid.findOneAndUpdate(
      { _id: candidate._id, status: "PENDING" },
      { $set: { status: "PROCESSING" } },
      { new: true }
    );

    if (!scheduledBid) continue; // Claimed by another cycle/worker

    try {
      // Check product status
      const product = await Product.findById(scheduledBid.productId);
      if (!product) {
        scheduledBid.status = "FAILED";
        scheduledBid.failureReason = "Auction product not found";
        await scheduledBid.save();
        failedCount++;
        continue;
      }

      // Check moderation status
      if (product.isModerated || ["REMOVED", "SUSPENDED"].includes(product.moderationStatus)) {
        scheduledBid.status = "FAILED";
        scheduledBid.failureReason = "LISTING_MODERATED: Auction product has been removed or suspended by moderation";
        await scheduledBid.save();
        failedCount++;
        continue;
      }

      const activeStatuses = ["Active", "LIVE"];
      if (!activeStatuses.includes(product.status)) {
        scheduledBid.status = "FAILED";
        scheduledBid.failureReason = `Auction is not active (current status: ${product.status})`;
        await scheduledBid.save();
        failedCount++;
        continue;
      }

      // Check auction end time
      const boundaries = normalizeAuctionBoundaries(product);
      const effectiveEnd = product.endTime || boundaries.endTime;
      if (effectiveEnd && queryTime.getTime() >= effectiveEnd.getTime()) {
        scheduledBid.status = "FAILED";
        scheduledBid.failureReason = "Auction has concluded before scheduled execution";
        await scheduledBid.save();
        failedCount++;
        continue;
      }

      // Execute via authoritative placeBid
      const bidder = {
        _id: scheduledBid.userId,
        email: scheduledBid.userEmail,
        name: scheduledBid.userName,
      };

      const bidResult = await placeBid({
        productId: scheduledBid.productId.toString(),
        bidder,
        amount: scheduledBid.amount,
        idempotencyKey: scheduledBid.idempotencyKey || `sched_${scheduledBid._id.toString()}`,
        now: queryTime,
      });

      scheduledBid.status = "EXECUTED";
      scheduledBid.executedBidId = bidResult.bid?._id || null;
      await scheduledBid.save();
      executedCount++;

      if (io) {
        try {
          io.to(scheduledBid.userId.toString()).emit("scheduledBidExecuted", {
            scheduledBidId: scheduledBid._id,
            productId: scheduledBid.productId,
            amount: scheduledBid.amount,
            bidId: scheduledBid.executedBidId,
          });
        } catch (emitErr) {
          if (logger) logger.warn(`[Lifecycle] Failed to emit scheduledBidExecuted: ${emitErr.message}`);
        }
      }
    } catch (err) {
      scheduledBid.status = "FAILED";
      scheduledBid.failureReason = err.message || "Failed to execute bid";
      await scheduledBid.save();
      failedCount++;

      if (io) {
        try {
          io.to(scheduledBid.userId.toString()).emit("scheduledBidFailed", {
            scheduledBidId: scheduledBid._id,
            productId: scheduledBid.productId,
            amount: scheduledBid.amount,
            reason: scheduledBid.failureReason,
          });
        } catch (emitErr) {
          if (logger) logger.warn(`[Lifecycle] Failed to emit scheduledBidFailed: ${emitErr.message}`);
        }
      }
    }
  }

  return {
    processedCount: candidates.length,
    executedCount,
    failedCount,
  };
}

/**
 * Comprehensive reconciliation cycle: recovers orphan orders, starts scheduled auctions,
 * executes due user-controlled scheduled bids, and finalizes expired auctions.
 *
 * @param {Object} options
 * @param {Date} [options.now]
 * @param {number} [options.batchSize]
 * @param {Object} [options.io]
 * @returns {Promise<Object>} Summary of lifecycle transitions
 */
async function processLifecycleTransitions({ now = new Date(), batchSize = 50, io = null } = {}) {
  const queryTime = now instanceof Date ? now : new Date(now);

  // 1. Recover any interrupted/crashed finalizations missing order obligations
  const recoveryResults = await recoverOrphanFinalizedAuctions({ now: queryTime, batchSize, io });

  // 2. Start scheduled auctions
  const startResults = await startScheduledAuctions({ now: queryTime, batchSize, io });

  // 3. Execute due user-controlled scheduled bids
  const scheduledBidResults = await executeDueScheduledBids({ now: queryTime, batchSize, io });

  // 4. Finalize expired auctions
  const finalizeResults = await finalizeExpiredAuctions({ now: queryTime, batchSize, io });

  return {
    timestamp: queryTime.toISOString(),
    recovered: recoveryResults,
    started: startResults,
    scheduledBids: scheduledBidResults,
    finalized: finalizeResults,
  };
}

module.exports = {
  LifecycleError,
  normalizeAuctionBoundaries,
  ensureIndexes,
  repairOrphanOrder,
  recoverOrphanFinalizedAuctions,
  startScheduledAuctions,
  finalizeSingleAuction,
  finalizeExpiredAuctions,
  executeDueScheduledBids,
  processLifecycleTransitions,
};

