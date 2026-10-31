/**
 * Bid Service — Authoritative Bidding & Concurrency Engine
 *
 * Implements server-authoritative bid validation, atomic concurrency control,
 * anti-sniping soft-close dynamic extensions, scoped idempotency, and durable
 * bid ledger persistence.
 */

const mongoose = require("mongoose");
const Product = require("../../products/models/productSchema");
const Bid = require("../models/bidSchema");
const User = require("../../users/models/user");
const WalletReservation = require("../models/walletReservationSchema");
const walletService = require("../../payments/services/walletService");
const { parseAuctionTimeBoundaries } = require("../middleware/checkTimeRestriction");
const { logger } = require("../../../infrastructure/logging/loggerMiddleware");
const { recordAuthoritativeInteraction, enqueueAuthoritativeEvent } = require("../../../infrastructure/messaging/recommendationTrackingService");

/**
 * Custom operational error class for bidding domain errors
 */
class BidError extends Error {
  constructor(message, statusCode = 400, code = "BID_REJECTED", details = {}) {
    super(message);
    this.name = "BidError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Detects whether the active MongoDB connection supports multi-document transactions
 */
function isReplicaSetTopology() {
  try {
    const client = mongoose.connection.client;
    const topologyType = client?.topology?.description?.type;
    return (
      topologyType === "ReplicaSetWithPrimary" ||
      topologyType === "Sharded"
    );
  } catch {
    return false;
  }
}

/**
 * Calculates minimum required next bid for a product
 */
function calculateMinimumNextBid(product) {
  const startingPrice =
    product.startingPrice !== undefined
      ? product.startingPrice
      : product.biddingStartPrice || 0;

  const currentPrice =
    product.currentPrice !== undefined
      ? product.currentPrice
      : product.tempamount || startingPrice;

  const bidCount = product.bidCount || 0;
  const minIncrement = product.minIncrement || 50;

  if (bidCount === 0) {
    return startingPrice;
  }
  return Math.round((currentPrice + minIncrement) * 100) / 100;
}

/**
 * Checks if a duplicate bid with the given idempotencyKey already exists.
 * If found and valid, returns the idempotent outcome; throws 409 if payload/bidder mismatch.
 */
async function checkIdempotentDuplicate(productId, sanitizedIdempotencyKey, bidder, roundedAmount) {
  if (!sanitizedIdempotencyKey) return null;
  const existingBid = await Bid.findOne({
    productId,
    idempotencyKey: sanitizedIdempotencyKey,
  });
  if (!existingBid) return null;

  if (existingBid.bidder.toString() !== bidder._id.toString()) {
    throw new BidError(
      "Idempotency key already used by another bidder",
      409,
      "IDEMPOTENCY_KEY_COLLISION"
    );
  }
  if (Math.abs(existingBid.amount - roundedAmount) > 0.001) {
    throw new BidError(
      "Idempotency key was previously submitted with a different bid amount",
      409,
      "IDEMPOTENCY_PAYLOAD_MISMATCH"
    );
  }

  let resolvedBid = existingBid;
  if (existingBid.status === "PENDING") {
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      const settled = await Bid.findOne({ productId, idempotencyKey: sanitizedIdempotencyKey });
      if (settled && settled.status !== "PENDING") {
        resolvedBid = settled;
        break;
      }
    }
  }

  const latestProduct = await Product.findById(productId);
  return {
    success: true,
    product: latestProduct,
    bid: resolvedBid,
    wasExtended: false,
    isDuplicate: true,
    broadcastData: {
      productId: latestProduct ? latestProduct._id.toString() : productId,
      currentBid: latestProduct ? latestProduct.currentPrice : resolvedBid.amount,
      bidderName: resolvedBid.bidderName,
      bidderEmail: resolvedBid.bidderEmail,
      biddingEndTime:
        latestProduct?.biddingEndTime ||
        (latestProduct?.endTime ? latestProduct.endTime.toISOString() : null),
      bidCount: latestProduct ? latestProduct.bidCount : 1,
      wasExtended: false,
    },
  };
}

/**
 * Authoritative bid placement function.
 * Called by both HTTP route (POST /api/products/:id/bid) and Socket.IO (placeBid event).
 *
 * @param {Object} params
 * @param {string} params.productId - Product MongoDB ObjectId
 * @param {Object} params.bidder - Authenticated user object ({ _id, email, name })
 * @param {number} params.amount - Proposed bid amount
 * @param {string} [params.ipAddress] - Client IP for audit logging
 * @param {string} [params.idempotencyKey] - Optional idempotency key (scoped per product)
 * @param {Date} [params.now] - Current timestamp (parameterized for deterministic testing)
 * @returns {Promise<Object>} Authoritative outcome including updated product and created bid
 */
async function placeBid({
  productId,
  bidder,
  amount,
  ipAddress,
  idempotencyKey,
  now = new Date(),
}) {
  // 1. Validate Product Identifier
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    throw new BidError("Invalid product identifier", 400, "INVALID_PRODUCT_ID");
  }

  // 2. Validate Authenticated Bidder
  if (!bidder || !bidder._id || !bidder.email) {
    throw new BidError("Authentication required to place a bid", 401, "UNAUTHORIZED");
  }

  // 3. Validate Amount & Monetary Precision (Paise: max 2 decimal places)
  const numericAmount = Number(amount);
  if (
    isNaN(numericAmount) ||
    !isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new BidError(
      "Bid amount must be a positive finite number",
      400,
      "INVALID_BID_AMOUNT"
    );
  }

  const roundedAmount = Math.round(numericAmount * 100) / 100;
  if (Math.abs(numericAmount - roundedAmount) > 0.00001) {
    throw new BidError(
      "Bid amount cannot have more than 2 decimal places (paise)",
      400,
      "INVALID_BID_AMOUNT"
    );
  }

  // 4. Validate & Normalize Idempotency Key (Scoped per product)
  let sanitizedIdempotencyKey = null;
  if (idempotencyKey !== undefined && idempotencyKey !== null) {
    if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
      throw new BidError(
        "Idempotency key must be a non-empty string",
        400,
        "INVALID_IDEMPOTENCY_KEY"
      );
    }
    sanitizedIdempotencyKey = idempotencyKey.trim();
    if (sanitizedIdempotencyKey.length > 128) {
      throw new BidError(
        "Idempotency key cannot exceed 128 characters",
        400,
        "INVALID_IDEMPOTENCY_KEY"
      );
    }

    // Pre-check for duplicate idempotency key
    const cachedDuplicate = await checkIdempotentDuplicate(
      productId,
      sanitizedIdempotencyKey,
      bidder,
      roundedAmount
    );
    if (cachedDuplicate) {
      return cachedDuplicate;
    }
  }

  // 5. Load Product from Database
  const product = await Product.findById(productId);
  if (!product) {
    throw new BidError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }

  // 5.1 Enforce Listing Moderation Invariant
  if (product.isModerated || ["REMOVED", "SUSPENDED"].includes(product.moderationStatus)) {
    throw new BidError(
      "This listing has been removed or suspended by administrator moderation",
      403,
      "LISTING_MODERATED"
    );
  }

  // 6. Enforce Seller Self-Bidding Prevention
  if (
    product.email &&
    bidder.email &&
    product.email.trim().toLowerCase() === bidder.email.trim().toLowerCase()
  ) {
    throw new BidError(
      "Sellers are not permitted to bid on their own listings",
      403,
      "SELLER_CANNOT_BID"
    );
  }

  // 7. Enforce Auction Status
  const activeStatuses = ["Active", "LIVE"];
  if (!activeStatuses.includes(product.status)) {
    throw new BidError(
      "Bidding has ended or is not active for this product",
      400,
      "AUCTION_NOT_ACTIVE",
      { status: product.status }
    );
  }

  // 8. Resolve Canonical Time Boundaries
  const timeBoundaries = parseAuctionTimeBoundaries(product);
  const startTime = product.startTime || timeBoundaries.startTime;
  const currentEndTime = product.endTime || timeBoundaries.endTime;

  if (!startTime || !currentEndTime) {
    throw new BidError(
      "Auction schedule boundaries are not configured properly",
      500,
      "INVALID_AUCTION_SCHEDULE"
    );
  }

  // 9. Enforce Start Time Boundary
  if (now.getTime() < startTime.getTime()) {
    throw new BidError(
      "Bidding has not started yet",
      400,
      "AUCTION_NOT_STARTED",
      { startTime: startTime.toISOString() }
    );
  }

  // 10. Enforce Effective End Time Boundary
  if (now.getTime() >= currentEndTime.getTime()) {
    if (sanitizedIdempotencyKey) {
      const cachedDuplicate = await checkIdempotentDuplicate(
        productId,
        sanitizedIdempotencyKey,
        bidder,
        roundedAmount
      );
      if (cachedDuplicate) {
        return cachedDuplicate;
      }
    }
    throw new BidError(
      "Operation not allowed, bidding time has passed (auction ended)",
      400,
      "AUCTION_CLOSED",
      { endTime: currentEndTime.toISOString() }
    );
  }

  // 11. Enforce In-Memory Minimum Bid Increment Pre-Check
  const minimumNextBid = calculateMinimumNextBid(product);
  if (roundedAmount < minimumNextBid) {
    if (sanitizedIdempotencyKey) {
      const cachedDuplicate = await checkIdempotentDuplicate(
        productId,
        sanitizedIdempotencyKey,
        bidder,
        roundedAmount
      );
      if (cachedDuplicate) {
        return cachedDuplicate;
      }
    }
    throw new BidError(
      `Bid must be at least ₹${minimumNextBid}`,
      400,
      "BID_BELOW_MINIMUM",
      {
        minimumNextBid,
        currentPrice: product.currentPrice || product.biddingStartPrice || 0,
        minIncrement: product.minIncrement || 50,
      }
    );
  }

  // 11.5 Enforce Authoritative Available Wallet Balance Pre-Check
  const existingActiveRes = await WalletReservation.findOne({
    productId,
    status: "ACTIVE",
    userId: bidder._id,
  });

  const existingReservedAmount = existingActiveRes ? existingActiveRes.amount : 0;
  const additionalRequired = Math.round((roundedAmount - existingReservedAmount) * 100) / 100;

  const bidderUser = await User.findById(bidder._id);
  if (!bidderUser) {
    throw new BidError("Bidder account not found", 404, "USER_NOT_FOUND");
  }

  const totalBal =
    typeof bidderUser.amount === "number" && !isNaN(bidderUser.amount) ? bidderUser.amount : 0;
  const reservedBal =
    typeof bidderUser.reservedAmount === "number" && !isNaN(bidderUser.reservedAmount)
      ? bidderUser.reservedAmount
      : 0;
  const availableBal = Math.max(0, Math.round((totalBal - reservedBal) * 100) / 100);

  if (additionalRequired > 0 && availableBal < additionalRequired) {
    throw new BidError(
      "Insufficient available wallet balance to place this bid.",
      400,
      "INSUFFICIENT_AVAILABLE_BALANCE",
      {
        requiredAmount: roundedAmount,
        requiredAdditional: additionalRequired,
        availableBalance: availableBal,
        totalBalance: totalBal,
        reservedBalance: reservedBal,
        currency: "INR",
      }
    );
  }

  // 12. Anti-Sniping Dynamic Extension Evaluation (Decision A)
  // Window: Final 2 minutes (<= 120,000 ms before currentEndTime)
  // Extension: 2 minutes (120,000 ms)
  // Cap: Maximum 15 minutes (900,000 ms) beyond original scheduled end time
  const originalEndTime =
    product.originalEndTime ||
    timeBoundaries.endTime ||
    currentEndTime;

  const maxExtensionDeadline =
    product.maxExtensionDeadline ||
    new Date(originalEndTime.getTime() + 15 * 60 * 1000);

  const msRemaining = currentEndTime.getTime() - now.getTime();
  const isWithinAntiSnipeWindow =
    msRemaining > 0 && msRemaining <= 2 * 60 * 1000;

  let wasExtended = false;
  let effectiveNewEndTime = currentEndTime;

  if (isWithinAntiSnipeWindow) {
    const proposedEndTime = new Date(currentEndTime.getTime() + 2 * 60 * 1000);
    const cappedEndTime =
      proposedEndTime.getTime() > maxExtensionDeadline.getTime()
        ? maxExtensionDeadline
        : proposedEndTime;

    if (cappedEndTime.getTime() > currentEndTime.getTime()) {
      wasExtended = true;
      effectiveNewEndTime = cappedEndTime;
    }
  }

  // 13. Authoritative Atomic Write Predicate Construction
  const startingPrice =
    product.startingPrice !== undefined
      ? product.startingPrice
      : product.biddingStartPrice || 0;

  const minIncrement = product.minIncrement || 50;

  const atomicFilter = {
    _id: productId,
    status: { $in: activeStatuses },
    endTime: { $gt: now },
  };

  if (product.bidCount === 0 || !product.bidCount) {
    // Opening Bid Condition (Addresses HIGH-01):
    // MUST verify bidCount is STILL 0 in the database at write time!
    // Ensures two competing opening bids cannot both be accepted.
    atomicFilter.$and = [
      {
        $or: [
          { bidCount: 0 },
          { bidCount: { $exists: false } },
        ],
      },
      {
        $or: [
          { startingPrice: { $lte: roundedAmount } },
          { startingPrice: { $exists: false }, biddingStartPrice: { $lte: roundedAmount } },
          { currentPrice: { $lte: roundedAmount } },
          { currentPrice: { $exists: false } },
        ],
      },
    ];
  } else {
    // Subsequent Bid Condition (Addresses CRIT-02):
    // MUST verify currentPrice in database is at least minIncrement below the new bid!
    // Guarantees concurrent bids cannot bypass the required increment.
    const maxAllowedPriorPrice =
      Math.round((roundedAmount - minIncrement) * 100) / 100;
    atomicFilter.currentPrice = { $lte: maxAllowedPriorPrice };
  }

  const updateSet = {
    currentPrice: roundedAmount,
    highestBidder: bidder._id,
    highestBidderEmail: bidder.email,
    highestBidderName: bidder.name || bidder.email,
    // Preserve legacy fields for backward compatibility
    tempamount: roundedAmount,
    tempuseremail: bidder.email,
    tempname: bidder.name || bidder.email,
    biddingStartPrice: roundedAmount,
  };

  if (product.startingPrice === undefined) {
    updateSet.startingPrice = startingPrice;
  }
  if (!product.startTime) {
    updateSet.startTime = startTime;
  }
  if (!product.originalEndTime) {
    updateSet.originalEndTime = originalEndTime;
    updateSet.maxExtensionDeadline = maxExtensionDeadline;
  }

  if (wasExtended) {
    updateSet.endTime = effectiveNewEndTime;
    updateSet.biddingEndTime = effectiveNewEndTime.toISOString();
  } else if (!product.endTime) {
    updateSet.endTime = currentEndTime;
  }

  const updateOperations = {
    $set: updateSet,
    $inc: {
      bidCount: 1,
      __v: 1,
      antiSnipeCount: wasExtended ? 1 : 0,
    },
  };

  // 14. Dual Consistency Architecture Execution
  let updatedProduct = null;
  let newBid = null;
  let walletReservationOutcome = null;

  if (isReplicaSetTopology()) {
    // =========================================================================
    // BRANCH A: Replica-Set Topology -> Multi-Document ACID Transaction
    // =========================================================================
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        updatedProduct = await Product.findOneAndUpdate(
          atomicFilter,
          updateOperations,
          { session, new: true }
        );

        if (!updatedProduct) {
          throw new BidError("OUTBID", 409, "BID_OUTBID");
        }

        const bids = await Bid.create(
          [
            {
              productId,
              bidder: bidder._id,
              bidderEmail: bidder.email,
              bidderName: bidder.name || bidder.email,
              amount: roundedAmount,
              currency: "INR",
              status: "ACCEPTED",
              ipAddress: ipAddress || null,
              idempotencyKey: sanitizedIdempotencyKey,
            },
          ],
          { session }
        );
        newBid = bids[0];

        // Reserve wallet funds atomically inside transaction
        try {
          walletReservationOutcome = await walletService.reserveBidFunds({
            userId: bidder._id,
            userEmail: bidder.email,
            userName: bidder.name || bidder.email,
            productId,
            bidId: newBid._id,
            bidAmount: roundedAmount,
            idempotencyKey: sanitizedIdempotencyKey,
            session,
          });
        } catch (resErr) {
          if (resErr.code === 11000 || resErr.name === "MongoServerError" || resErr.code === "CONCURRENT_RESERVATION_COLLISION") {
            throw new BidError("OUTBID", 409, "BID_OUTBID");
          }
          throw resErr;
        }

        // Link product directly to winning bid record
        await Product.updateOne(
          { _id: productId },
          { $set: { lastBidId: newBid._id } },
          { session }
        );

        // Transactional Outbox: Persist authoritative recommendation event atomically with bid
        await enqueueAuthoritativeEvent(
          {
            email: bidder.email,
            productId,
            interactionType: "bid",
            eventId: `bid:${newBid._id}`,
          },
          { session }
        );
      });
    } catch (txError) {
      if (txError instanceof BidError) {
        const latest = await Product.findById(productId);
        const latestPrice = latest?.currentPrice || product.currentPrice || startingPrice;
        throw new BidError(
          `You have been outbid. Current price is ₹${latestPrice}`,
          409,
          "BID_OUTBID",
          {
            currentPrice: latestPrice,
            minimumNextBid: calculateMinimumNextBid(latest || product),
          }
        );
      }
      throw txError;
    } finally {
      await session.endSession();
    }
  } else {
    // =========================================================================
    // BRANCH B: Standalone Topology -> Durable Ledger-First Protocol (No Blind Rollback)
    // =========================================================================
    // Step 1: Create durable Bid record in PENDING state
    try {
      newBid = await Bid.create({
        productId,
        bidder: bidder._id,
        bidderEmail: bidder.email,
        bidderName: bidder.name || bidder.email,
        amount: roundedAmount,
        currency: "INR",
        status: "PENDING",
        ipAddress: ipAddress || null,
        idempotencyKey: sanitizedIdempotencyKey,
      });
    } catch (insertError) {
      // Handle concurrent duplicate idempotencyKey race (E11000)
      if (insertError.code === 11000 && sanitizedIdempotencyKey) {
        for (let attempt = 0; attempt < 5; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
          const existingBid = await Bid.findOne({
            productId,
            idempotencyKey: sanitizedIdempotencyKey,
          });
          if (existingBid && existingBid.status !== "PENDING") {
            const latestProduct = await Product.findById(productId);
            return {
              success: true,
              product: latestProduct,
              bid: existingBid,
              wasExtended: false,
              isDuplicate: true,
              broadcastData: {
                productId: latestProduct ? latestProduct._id.toString() : productId,
                currentBid: latestProduct ? latestProduct.currentPrice : existingBid.amount,
                bidderName: existingBid.bidderName,
                bidderEmail: existingBid.bidderEmail,
                biddingEndTime:
                  latestProduct?.biddingEndTime ||
                  (latestProduct?.endTime ? latestProduct.endTime.toISOString() : null),
                bidCount: latestProduct ? latestProduct.bidCount : 1,
                wasExtended: false,
              },
            };
          }
        }
        const fallbackBid = await Bid.findOne({
          productId,
          idempotencyKey: sanitizedIdempotencyKey,
        });
        if (fallbackBid) {
          const latestProduct = await Product.findById(productId);
          return {
            success: true,
            product: latestProduct,
            bid: fallbackBid,
            wasExtended: false,
            isDuplicate: true,
            broadcastData: {
              productId: latestProduct ? latestProduct._id.toString() : productId,
              currentBid: latestProduct ? latestProduct.currentPrice : fallbackBid.amount,
              bidderName: fallbackBid.bidderName,
              bidderEmail: fallbackBid.bidderEmail,
              biddingEndTime: latestProduct?.biddingEndTime || null,
              bidCount: latestProduct?.bidCount || 1,
              wasExtended: false,
            },
          };
        }
      }
      throw insertError;
    }

    // Step 1.5: Atomically hold bidder funds (Phase 1)
    let holdOutcome;
    try {
      holdOutcome = await walletService.holdBidderFunds({
        userId: bidder._id,
        productId,
        bidAmount: roundedAmount,
      });
    } catch (walletErr) {
      await Bid.updateOne({ _id: newBid._id }, { $set: { status: "REJECTED" } }).catch(() => {});
      throw walletErr;
    }

    // Step 2: Atomic update on Product, durably referencing newBid._id
    updateSet.lastBidId = newBid._id;

    try {
      updatedProduct = await Product.findOneAndUpdate(
        atomicFilter,
        updateOperations,
        { new: true }
      );
    } catch (productUpdateErr) {
      await walletService.releaseBidderHold({
        userId: bidder._id,
        amount: holdOutcome.heldAmount,
      });
      await Bid.updateOne(
        { _id: newBid._id },
        { $set: { status: "REJECTED" } }
      ).catch(() => {});
      throw productUpdateErr;
    }

    // Step 3: Transition Bid state based on atomic write outcome
    if (!updatedProduct) {
      // Outbid or predicate failed: mark bid REJECTED; Product was NEVER modified!
      await Bid.updateOne(
        { _id: newBid._id },
        { $set: { status: "REJECTED" } }
      ).catch((err) => {
        logger.warn("Failed to mark pending bid as REJECTED:", { error: err.message });
      });

      // Rollback ONLY this bidder's hold! Previous bidder was NEVER touched!
      await walletService.releaseBidderHold({
        userId: bidder._id,
        amount: holdOutcome.heldAmount,
      });

      const latest = await Product.findById(productId);
      const latestPrice = latest?.currentPrice || product.currentPrice || startingPrice;
      throw new BidError(
        `You have been outbid. Current price is ₹${latestPrice}`,
        409,
        "BID_OUTBID",
        {
          currentPrice: latestPrice,
          minimumNextBid: calculateMinimumNextBid(latest || product),
        }
      );
    }

    // Product update SUCCEEDED! Now commit the reservation (Phase 2)
    try {
      walletReservationOutcome = await walletService.commitBidReservation({
        userId: bidder._id,
        userEmail: bidder.email,
        userName: bidder.name || bidder.email,
        productId,
        bidId: newBid._id,
        bidAmount: roundedAmount,
        heldAmount: holdOutcome.heldAmount,
        isSelfIncrease: holdOutcome.isSelfIncrease,
        idempotencyKey: sanitizedIdempotencyKey,
      });
    } catch (commitErr) {
      logger.error("Failed to commit wallet reservation after product update:", {
        productId,
        bidId: newBid._id,
        error: commitErr.message,
      });
      await Product.updateOne(
        { _id: productId },
        {
          $set: {
            reconciliationRequired: true,
            reconciliationNotes: `Reservation commit failed after product write: ${commitErr.message}`,
          },
        }
      ).catch(() => {});
      throw commitErr;
    }

    // Bid succeeded: finalize status to ACCEPTED
    await Bid.updateOne(
      { _id: newBid._id },
      { $set: { status: "ACCEPTED" } }
    );
    newBid.status = "ACCEPTED";
  }

  // Record authoritative bid interaction for recommendation engine (non-blocking)
  try {
    recordAuthoritativeInteraction({
      email: bidder.email,
      productId: updatedProduct._id,
      interactionType: "bid",
      eventId: `bid:${newBid?._id || updatedProduct.lastBidId || updatedProduct._id}`,
    }).catch(() => {});
  } catch (_) {}

  // 15. Return Authoritative Accepted Outcome
  return {
    success: true,
    product: updatedProduct,
    bid: newBid,
    wasExtended,
    newEndTime: wasExtended ? effectiveNewEndTime : undefined,
    walletReservation: walletReservationOutcome?.reservation || null,
    releasedPreviousBidder: walletReservationOutcome?.releasedPreviousBidder || null,
    availableBalance: walletReservationOutcome?.availableBalance,
    reservedBalance: walletReservationOutcome?.reservedBalance,
    broadcastData: {
      productId: updatedProduct._id.toString(),
      currentBid: updatedProduct.currentPrice,
      bidderName: bidder.name || bidder.email,
      bidderEmail: bidder.email,
      biddingEndTime:
        updatedProduct.biddingEndTime ||
        (updatedProduct.endTime ? updatedProduct.endTime.toISOString() : null),
      bidCount: updatedProduct.bidCount,
      wasExtended,
    },
  };
}

/**
 * Retrieves paginated bid history for an auction (only ACCEPTED/WINNING bids)
 */
async function getBidHistory(productId, { limit = 50, skip = 0 } = {}) {
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    throw new BidError("Invalid product identifier", 400, "INVALID_PRODUCT_ID");
  }

  const bids = await Bid.find({
    productId,
    status: { $in: ["ACCEPTED", "WINNING"] },
  })
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(Math.min(limit, 100))
    .lean();

  const total = await Bid.countDocuments({
    productId,
    status: { $in: ["ACCEPTED", "WINNING"] },
  });

  return {
    success: true,
    count: bids.length,
    total,
    bids,
  };
}

module.exports = {
  placeBid,
  getBidHistory,
  calculateMinimumNextBid,
  isReplicaSetTopology,
  BidError,
};
