/**
 * Wallet Accounting & Escrow Reservation Service
 *
 * Implements strict financial accounting invariants:
 * availableBalance = totalWalletBalance - reservedBalance
 *
 * Guarantees:
 * 1. A user cannot spend, withdraw, or reuse reserved funds.
 * 2. Placing a bid reserves funds without deducting total wallet balance.
 * 3. Outbid bidders have their reservations automatically and idempotently released.
 * 4. Auction winners have their reserved funds captured exactly once upon settlement.
 * 5. All movements are recorded in the immutable Transaction ledger.
 */

const mongoose = require("mongoose");
const User = require("../../users/models/user");
const Transaction = require("../../admin/finance/models/transaction");
const WalletReservation = require("../../bidding/models/walletReservationSchema");
const { logger } = require("../../../infrastructure/logging/loggerMiddleware");

class WalletError extends Error {
  constructor(message, statusCode = 400, code = "WALLET_ERROR", details = {}) {
    super(message);
    this.name = "WalletError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Retrieves the current authoritative financial snapshot for a user.
 *
 * @param {string|ObjectId} userId
 * @returns {Promise<Object>} { totalBalance, reservedBalance, availableBalance, user }
 */
async function getWalletBalance(userId, { session } = {}) {
  const user = await User.findById(userId).session(session || null);
  if (!user) {
    throw new WalletError("User not found", 404, "USER_NOT_FOUND");
  }

  const totalBalance = typeof user.amount === "number" && !isNaN(user.amount) ? user.amount : 0;
  const reservedBalance =
    typeof user.reservedAmount === "number" && !isNaN(user.reservedAmount)
      ? user.reservedAmount
      : 0;

  const availableBalance = Math.round((totalBalance - reservedBalance) * 100) / 100;

  return {
    totalBalance,
    reservedBalance,
    availableBalance,
    user,
  };
}

/**
 * Validates and executes wallet escrow reservation for a newly placed or increased bid.
 *
 * Handles two scenarios:
 * A) Bidder increases their own bid: only (newBid - existingReservation) is checked and reserved.
 * B) Bidder places opening bid or outbids another user: full bid amount is reserved, and previous
 *    bidder's active reservation is automatically and atomically released.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.userId - Bidder user ID
 * @param {string} params.userEmail - Bidder email
 * @param {string} params.userName - Bidder name
 * @param {string|ObjectId} params.productId - Product being bid on
 * @param {string|ObjectId} params.bidId - Created Bid record ID
 * @param {number} params.bidAmount - Bid amount in INR rupees
 * @param {string} [params.idempotencyKey]
 * @param {ClientSession} [params.session] - Optional MongoDB transaction session
 * @returns {Promise<Object>} Reservation outcome
 */
async function reserveBidFunds({
  userId,
  userEmail,
  userName,
  productId,
  bidId,
  bidAmount,
  idempotencyKey = null,
  session = null,
}) {
  const roundedAmount = Math.round(Number(bidAmount) * 100) / 100;
  if (isNaN(roundedAmount) || roundedAmount <= 0) {
    throw new WalletError("Invalid bid reservation amount", 400, "INVALID_AMOUNT");
  }

  // 1. Fetch current bidder wallet state
  const bidderDoc = await User.findById(userId).session(session || null);
  if (!bidderDoc) {
    throw new WalletError("Bidder account not found", 404, "USER_NOT_FOUND");
  }

  const totalBalance = typeof bidderDoc.amount === "number" && !isNaN(bidderDoc.amount) ? bidderDoc.amount : 0;
  const currentReserved =
    typeof bidderDoc.reservedAmount === "number" && !isNaN(bidderDoc.reservedAmount)
      ? bidderDoc.reservedAmount
      : 0;
  const availableBalance = Math.round((totalBalance - currentReserved) * 100) / 100;

  // 2. Check for an existing ACTIVE reservation on this product
  const activeReservation = await WalletReservation.findOne({
    productId,
    status: "ACTIVE",
  }).session(session || null);

  const isSelfIncrease =
    activeReservation && activeReservation.userId.toString() === userId.toString();

  if (isSelfIncrease) {
    // -------------------------------------------------------------------------
    // SCENARIO A: Same bidder increasing their own highest bid
    // -------------------------------------------------------------------------
    const existingReserved = activeReservation.amount;
    const additionalRequired = Math.round((roundedAmount - existingReserved) * 100) / 100;

    if (additionalRequired <= 0) {
      throw new WalletError(
        `New bid amount (₹${roundedAmount}) must be greater than current reservation (₹${existingReserved})`,
        400,
        "BID_BELOW_EXISTING_RESERVATION"
      );
    }

    if (availableBalance < additionalRequired) {
      throw new WalletError(
        `Insufficient available wallet balance to increase bid. Required additional: ₹${additionalRequired}, available: ₹${availableBalance}`,
        400,
        "INSUFFICIENT_AVAILABLE_BALANCE",
        {
          requiredAmount: roundedAmount,
          requiredAdditional: additionalRequired,
          availableBalance,
          totalBalance,
          reservedBalance: currentReserved,
          currency: "INR",
        }
      );
    }

    // Atomically increment bidder's reservedAmount by additionalRequired
    const updatedBidder = await User.findOneAndUpdate(
      {
        _id: userId,
        // Concurrency guard: available balance must still cover additionalRequired
        $expr: {
          $gte: [
            { $subtract: [{ $ifNull: ["$amount", 0] }, { $ifNull: ["$reservedAmount", 0] }] },
            additionalRequired,
          ],
        },
      },
      {
        $inc: { reservedAmount: additionalRequired },
      },
      { new: true, session: session || null }
    );

    if (!updatedBidder) {
      throw new WalletError(
        "Insufficient available wallet balance due to concurrent transaction",
        409,
        "CONCURRENT_BALANCE_MUTATION"
      );
    }

    // Update active reservation amount to new bid amount
    activeReservation.amount = roundedAmount;
    activeReservation.bidId = bidId;
    if (idempotencyKey) activeReservation.idempotencyKey = idempotencyKey;
    await activeReservation.save({ session: session || null });

    // Record BID_RESERVATION_INCREASE in ledger
    await Transaction.create(
      [
        {
          userId,
          userEmail,
          name: userName || bidderDoc.name || "User",
          type: "BID_RESERVATION_INCREASE",
          amount: additionalRequired,
          productId,
          bidId,
          idempotencyKey: idempotencyKey ? `res_inc:${idempotencyKey}` : undefined,
          reference: `Bid increase to ₹${roundedAmount} (additional hold: ₹${additionalRequired})`,
          metadata: {
            productId: productId.toString(),
            bidId: bidId.toString(),
            previousAmount: existingReserved,
            newAmount: roundedAmount,
            additionalReserved: additionalRequired,
          },
        },
      ],
      { session: session || null }
    );

    return {
      success: true,
      reservation: activeReservation,
      isIncrease: true,
      additionalReserved: additionalRequired,
      availableBalance: Math.round((updatedBidder.amount - updatedBidder.reservedAmount) * 100) / 100,
      reservedBalance: updatedBidder.reservedAmount,
    };
  }

  // ---------------------------------------------------------------------------
  // SCENARIO B: Opening bid or Outbidding another user
  // ---------------------------------------------------------------------------
  if (availableBalance < roundedAmount) {
    throw new WalletError(
      `Insufficient available wallet balance to place this bid. Required: ₹${roundedAmount}, available: ₹${availableBalance}`,
      400,
      "INSUFFICIENT_AVAILABLE_BALANCE",
      {
        requiredAmount: roundedAmount,
        availableBalance,
        totalBalance,
        reservedBalance: currentReserved,
        currency: "INR",
      }
    );
  }

  // Release previous bidder's reservation if someone is being outbid
  let releasedPreviousBidder = null;
  if (activeReservation) {
    const prevUserId = activeReservation.userId;
    const prevAmount = activeReservation.amount;

    // 1. Mark previous reservation as RELEASED
    activeReservation.status = "RELEASED";
    activeReservation.releasedAt = new Date();
    await activeReservation.save({ session: session || null });

    // 2. Decrement previous user's reservedAmount
    const updatedPrevUser = await User.findOneAndUpdate(
      { _id: prevUserId },
      { $inc: { reservedAmount: -prevAmount } },
      { new: true, session: session || null }
    );

    // 3. Record BID_RESERVATION_RELEASE in ledger
    await Transaction.create(
      [
        {
          userId: prevUserId,
          userEmail: activeReservation.userEmail,
          name: updatedPrevUser?.name || "Previous Bidder",
          type: "BID_RESERVATION_RELEASE",
          amount: prevAmount,
          productId,
          bidId: activeReservation.bidId,
          reference: `Released outbid reservation of ₹${prevAmount}`,
          metadata: {
            productId: productId.toString(),
            releasedAmount: prevAmount,
            outbidByUserId: userId.toString(),
            outbidByBidId: bidId.toString(),
          },
        },
      ],
      { session: session || null }
    );

    releasedPreviousBidder = {
      userId: prevUserId.toString(),
      email: activeReservation.userEmail,
      releasedAmount: prevAmount,
    };

    if (logger) {
      logger.info(
        `[WalletService] Released ₹${prevAmount} reservation for outbid user ${activeReservation.userEmail} on product ${productId}`
      );
    }
  }

  // Atomically reserve funds on the new bidder
  const updatedBidder = await User.findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $gte: [
          { $subtract: [{ $ifNull: ["$amount", 0] }, { $ifNull: ["$reservedAmount", 0] }] },
          roundedAmount,
        ],
      },
    },
    {
      $inc: { reservedAmount: roundedAmount },
    },
    { new: true, session: session || null }
  );

  if (!updatedBidder) {
    throw new WalletError(
      "Insufficient available wallet balance due to concurrent transaction",
      409,
      "CONCURRENT_BALANCE_MUTATION"
    );
  }

  // Create new ACTIVE WalletReservation
  let newReservation;
  try {
    const created = await WalletReservation.create(
      [
        {
          userId,
          userEmail,
          productId,
          bidId,
          amount: roundedAmount,
          currency: "INR",
          status: "ACTIVE",
          idempotencyKey,
        },
      ],
      { session: session || null }
    );
    newReservation = created[0];
  } catch (createErr) {
    if (!session) {
      await User.updateOne(
        { _id: userId },
        { $inc: { reservedAmount: -roundedAmount } }
      ).catch(() => {});
    }
    if (createErr.code === 11000 || createErr.name === "MongoServerError") {
      throw new WalletError(
        "Another bidder placed an active reservation concurrently",
        409,
        "CONCURRENT_RESERVATION_COLLISION"
      );
    }
    throw createErr;
  }

  // Record BID_RESERVATION in ledger
  await Transaction.create(
    [
      {
        userId,
        userEmail,
        name: userName || bidderDoc.name || "User",
        type: "BID_RESERVATION",
        amount: roundedAmount,
        productId,
        bidId,
        idempotencyKey: idempotencyKey ? `res:${idempotencyKey}` : undefined,
        reference: `Reserved ₹${roundedAmount} for auction bid`,
        metadata: {
          productId: productId.toString(),
          bidId: bidId.toString(),
          reservedAmount: roundedAmount,
        },
      },
    ],
    { session: session || null }
  );

  return {
    success: true,
    reservation: newReservation,
    isIncrease: false,
    releasedPreviousBidder,
    availableBalance: Math.round((updatedBidder.amount - updatedBidder.reservedAmount) * 100) / 100,
    reservedBalance: updatedBidder.reservedAmount,
  };
}

/**
 * Idempotently releases an active reservation when an auction is cancelled or bidder drops out.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.productId
 * @param {string|ObjectId} [params.userId]
 * @param {string} [params.reason]
 * @param {ClientSession} [params.session]
 * @returns {Promise<Object>}
 */
async function releaseReservation({ productId, userId = null, reason = "AUCTION_CANCELLED", session = null }) {
  const query = { productId, status: "ACTIVE" };
  if (userId) query.userId = userId;

  const reservation = await WalletReservation.findOneAndUpdate(
    query,
    {
      $set: {
        status: "RELEASED",
        releasedAt: new Date(),
        notes: reason,
      },
    },
    { new: false, session: session || null }
  );

  if (!reservation) {
    return { success: true, released: false, message: "No active reservation found" };
  }

  // Decrement reservedAmount on user
  const updatedUser = await User.findOneAndUpdate(
    { _id: reservation.userId },
    { $inc: { reservedAmount: -reservation.amount } },
    { new: true, session: session || null }
  );

  // Record in ledger
  await Transaction.create(
    [
      {
        userId: reservation.userId,
        userEmail: reservation.userEmail,
        name: updatedUser?.name || "User",
        type: "BID_RESERVATION_RELEASE",
        amount: reservation.amount,
        productId,
        bidId: reservation.bidId,
        reference: `Released reservation of ₹${reservation.amount}: ${reason}`,
        metadata: {
          productId: productId.toString(),
          reason,
        },
      },
    ],
    { session: session || null }
  );

  if (logger) {
    logger.info(
      `[WalletService] Released ₹${reservation.amount} reservation for user ${reservation.userEmail} on product ${productId} (reason: ${reason})`
    );
  }

  return {
    success: true,
    released: true,
    amount: reservation.amount,
    userId: reservation.userId.toString(),
  };
}

/**
 * Captures the winning bidder's reserved escrow funds upon auction expiration / finalization.
 *
 * Atomically:
 * 1. Decrements winner's total wallet amount by finalAmount.
 * 2. Decrements winner's reservedAmount by finalAmount.
 * 3. Marks WalletReservation as CAPTURED and links orderId.
 * 4. Records AUCTION_WIN_CAPTURE in Transaction ledger.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.productId
 * @param {string|ObjectId} params.winnerId
 * @param {number} params.finalAmount
 * @param {string|ObjectId} [params.orderId]
 * @param {ClientSession} [params.session]
 * @returns {Promise<Object>}
 */
async function captureWinningReservation({
  productId,
  winnerId,
  finalAmount,
  orderId = null,
  session = null,
}) {
  const roundedFinal = Math.round(Number(finalAmount) * 100) / 100;

  // 1. Idempotency Check: Was this auction's winning reservation ALREADY captured?
  const alreadyCaptured = await WalletReservation.findOne({
    productId,
    status: "CAPTURED",
  }).session(session || null);

  if (alreadyCaptured) {
    return {
      success: true,
      alreadyCaptured: true,
      reservation: alreadyCaptured,
      capturedAmount: alreadyCaptured.amount,
    };
  }

  // 2. Locate the active reservation
  let reservation = await WalletReservation.findOne({
    productId,
    status: "ACTIVE",
  }).session(session || null);

  if (!reservation) {
    // Check if the reservation was created under a legacy bid before escrow introduction
    // In this fallback, create a synthetic captured entry to maintain ledger completeness
    const winnerUser = await User.findById(winnerId).session(session || null);
    if (!winnerUser) {
      throw new WalletError("Winner user account not found", 404, "WINNER_NOT_FOUND");
    }

    // Direct capture from total balance if sufficient
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: winnerId,
        amount: { $gte: roundedFinal },
      },
      {
        $inc: { amount: -roundedFinal },
      },
      { new: true, session: session || null }
    );

    if (!updatedUser) {
      throw new WalletError(
        `Winner does not have sufficient wallet balance (₹${winnerUser.amount || 0}) to settle ₹${roundedFinal}`,
        400,
        "INSUFFICIENT_SETTLEMENT_BALANCE"
      );
    }

    const [syntheticCapture] = await WalletReservation.create(
      [
        {
          userId: winnerId,
          userEmail: winnerUser.email,
          productId,
          bidId: new mongoose.Types.ObjectId(),
          amount: roundedFinal,
          status: "CAPTURED",
          capturedAt: new Date(),
          orderId,
          notes: "Legacy bid direct wallet capture",
        },
      ],
      { session: session || null }
    );

    await Transaction.create(
      [
        {
          userId: winnerId,
          userEmail: winnerUser.email,
          name: winnerUser.name || "Winner",
          type: "AUCTION_WIN_CAPTURE",
          amount: roundedFinal,
          productId,
          reference: `Auction won & settled via wallet capture (₹${roundedFinal})`,
          metadata: {
            productId: productId.toString(),
            orderId: orderId ? orderId.toString() : null,
            mode: "direct_capture_fallback",
          },
        },
      ],
      { session: session || null }
    );

    return {
      success: true,
      alreadyCaptured: false,
      reservation: syntheticCapture,
      capturedAmount: roundedFinal,
    };
  }

  // Verify reservation belongs to the winner
  if (reservation.userId.toString() !== winnerId.toString()) {
    throw new WalletError(
      `Reservation user mismatch: expected winner ${winnerId}, found ${reservation.userId}`,
      409,
      "RESERVATION_WINNER_MISMATCH"
    );
  }

  // Verify reservation amount matches final winning price
  if (Math.abs(reservation.amount - roundedFinal) > 0.01) {
    throw new WalletError(
      `Reservation amount (₹${reservation.amount}) does not match final auction price (₹${roundedFinal})`,
      400,
      "RESERVATION_AMOUNT_MISMATCH"
    );
  }

  // 3. Atomically debit winner's total balance AND reservedAmount by the captured amount
  const updatedWinner = await User.findOneAndUpdate(
    {
      _id: winnerId,
      amount: { $gte: roundedFinal },
      reservedAmount: { $gte: roundedFinal },
    },
    {
      $inc: {
        amount: -roundedFinal,
        reservedAmount: -roundedFinal,
      },
    },
    { new: true, session: session || null }
  );

  if (!updatedWinner) {
    // Check if another worker concurrently captured this reservation
    const recheckCaptured = await WalletReservation.findOne({
      productId,
      status: "CAPTURED",
    }).session(session || null);
    if (recheckCaptured) {
      return {
        success: true,
        alreadyCaptured: true,
        reservation: recheckCaptured,
        capturedAmount: recheckCaptured.amount,
      };
    }

    throw new WalletError(
      "Failed to capture reserved funds: balance or reservation inconsistency",
      409,
      "CAPTURE_INCONSISTENCY"
    );
  }

  // 4. Mark reservation as CAPTURED
  reservation.status = "CAPTURED";
  reservation.capturedAt = new Date();
  if (orderId) reservation.orderId = orderId;
  await reservation.save({ session: session || null });

  // 5. Record AUCTION_WIN_CAPTURE in Transaction ledger
  await Transaction.create(
    [
      {
        userId: winnerId,
        userEmail: reservation.userEmail,
        name: updatedWinner.name || "Winner",
        type: "AUCTION_WIN_CAPTURE",
        amount: roundedFinal,
        productId,
        bidId: reservation.bidId,
        reference: `Auction won & settled via wallet escrow capture (₹${roundedFinal})`,
        metadata: {
          productId: productId.toString(),
          bidId: reservation.bidId.toString(),
          orderId: orderId ? orderId.toString() : null,
          capturedAmount: roundedFinal,
        },
      },
    ],
    { session: session || null }
  );

  if (logger) {
    logger.info(
      `[WalletService] Successfully captured ₹${roundedFinal} winning escrow for user ${reservation.userEmail} on product ${productId}`
    );
  }

  return {
    success: true,
    alreadyCaptured: false,
    reservation,
    capturedAmount: roundedFinal,
    walletBalance: updatedWinner.amount,
    reservedBalance: updatedWinner.reservedAmount,
  };
}

/**
 * Releases all active reservations for a given product (e.g. on cancellation or unsold auction).
 *
 * @param {string|ObjectId} productId
 * @param {string} [reason]
 * @param {ClientSession} [session]
 * @returns {Promise<number>} Number of released reservations
 */
async function releaseAllAuctionReservations(productId, reason = "AUCTION_CLOSED_NO_WINNER", session = null) {
  const activeReservations = await WalletReservation.find({
    productId,
    status: "ACTIVE",
  }).session(session || null);

  for (const res of activeReservations) {
    res.status = "RELEASED";
    res.releasedAt = new Date();
    res.notes = reason;
    await res.save({ session: session || null });

    await User.updateOne(
      { _id: res.userId },
      { $inc: { reservedAmount: -res.amount } },
      { session: session || null }
    );

    await Transaction.create(
      [
        {
          userId: res.userId,
          userEmail: res.userEmail,
          name: "User",
          type: "BID_RESERVATION_RELEASE",
          amount: res.amount,
          productId,
          bidId: res.bidId,
          reference: `Auction closed without winner: released hold of ₹${res.amount}`,
          metadata: {
            productId: productId.toString(),
            reason,
          },
        },
      ],
      { session: session || null }
    );
  }

  return activeReservations.length;
}

/**
 * Phase 1 of Standalone Reservation:
 * Atomically reserves funds on the bidder's own account BEFORE attempting the Product write.
 * Does NOT touch any existing reservation or other users.
 */
async function holdBidderFunds({ userId, productId, bidAmount }) {
  const roundedAmount = Math.round(Number(bidAmount) * 100) / 100;

  const bidderDoc = await User.findById(userId);
  if (!bidderDoc) {
    throw new WalletError("Bidder account not found", 404, "USER_NOT_FOUND");
  }

  const totalBalance = typeof bidderDoc.amount === "number" && !isNaN(bidderDoc.amount) ? bidderDoc.amount : 0;
  const currentReserved =
    typeof bidderDoc.reservedAmount === "number" && !isNaN(bidderDoc.reservedAmount)
      ? bidderDoc.reservedAmount
      : 0;
  const availableBalance = Math.round((totalBalance - currentReserved) * 100) / 100;

  const activeReservation = await WalletReservation.findOne({
    productId,
    status: "ACTIVE",
  });

  const isSelfIncrease =
    Boolean(activeReservation) && activeReservation.userId.toString() === userId.toString();

  let requiredToHold = roundedAmount;
  if (isSelfIncrease) {
    requiredToHold = Math.round((roundedAmount - activeReservation.amount) * 100) / 100;
    if (requiredToHold <= 0) {
      throw new WalletError(
        `New bid amount (₹${roundedAmount}) must be greater than current reservation (₹${activeReservation.amount})`,
        400,
        "BID_BELOW_EXISTING_RESERVATION"
      );
    }
  }

  if (availableBalance < requiredToHold) {
    throw new WalletError(
      `Insufficient available wallet balance to place this bid. Required: ₹${requiredToHold}, available: ₹${availableBalance}`,
      400,
      "INSUFFICIENT_AVAILABLE_BALANCE",
      {
        requiredAmount: roundedAmount,
        requiredAdditional: requiredToHold,
        availableBalance,
        totalBalance,
        reservedBalance: currentReserved,
        currency: "INR",
      }
    );
  }

  // Atomically increment reservedAmount on bidder
  const updatedBidder = await User.findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $gte: [
          { $subtract: [{ $ifNull: ["$amount", 0] }, { $ifNull: ["$reservedAmount", 0] }] },
          requiredToHold,
        ],
      },
    },
    { $inc: { reservedAmount: requiredToHold } },
    { new: true }
  );

  if (!updatedBidder) {
    throw new WalletError(
      "Insufficient available wallet balance due to concurrent transaction",
      409,
      "CONCURRENT_BALANCE_MUTATION"
    );
  }

  return {
    heldAmount: requiredToHold,
    isSelfIncrease,
    activeReservation,
  };
}

/**
 * Rollback helper if Product update failed in Standalone topology.
 */
async function releaseBidderHold({ userId, amount }) {
  if (amount > 0) {
    await User.updateOne(
      { _id: userId },
      { $inc: { reservedAmount: -amount } }
    ).catch(() => {});
  }
}

/**
 * Phase 2 of Standalone Reservation:
 * Commits the reservation AFTER Product write has succeeded.
 * Releases previous bidder and creates/updates WalletReservation and Transaction ledger.
 */
async function commitBidReservation({
  userId,
  userEmail,
  userName,
  productId,
  bidId,
  bidAmount,
  heldAmount,
  isSelfIncrease,
  idempotencyKey = null,
}) {
  const roundedAmount = Math.round(Number(bidAmount) * 100) / 100;

  if (isSelfIncrease) {
    const activeRes = await WalletReservation.findOne({ productId, status: "ACTIVE" });
    let actualRequiredDelta = heldAmount;
    if (activeRes) {
      const prevAmount = activeRes.amount;
      actualRequiredDelta = Math.max(0, Math.round((roundedAmount - prevAmount) * 100) / 100);
      activeRes.amount = roundedAmount;
      activeRes.bidId = bidId;
      if (idempotencyKey) activeRes.idempotencyKey = idempotencyKey;
      await activeRes.save();

      // If concurrent racing self-increases caused heldAmount to exceed actualRequiredDelta,
      // immediately return the excess hold to the bidder's available balance
      const excessHeld = Math.round((heldAmount - actualRequiredDelta) * 100) / 100;
      if (excessHeld > 0) {
        await User.updateOne(
          { _id: userId },
          { $inc: { reservedAmount: -excessHeld } }
        );
      }
    }

    await Transaction.create([
      {
        userId,
        userEmail,
        name: userName || "User",
        type: "BID_RESERVATION_INCREASE",
        amount: heldAmount,
        productId,
        bidId,
        idempotencyKey: idempotencyKey ? `res_inc:${idempotencyKey}` : undefined,
        reference: `Bid increase to ₹${roundedAmount} (additional hold: ₹${heldAmount})`,
        metadata: {
          productId: productId.toString(),
          bidId: bidId.toString(),
          newAmount: roundedAmount,
          additionalReserved: heldAmount,
        },
      },
    ]);

    const bidder = await User.findById(userId);
    return {
      success: true,
      reservation: activeRes,
      isIncrease: true,
      availableBalance: Math.round(((bidder?.amount || 0) - (bidder?.reservedAmount || 0)) * 100) / 100,
      reservedBalance: bidder?.reservedAmount || 0,
    };
  }

  // Release previous bidder's reservation if outbidding
  const activeReservation = await WalletReservation.findOne({ productId, status: "ACTIVE" });
  let releasedPreviousBidder = null;

  if (activeReservation) {
    const prevUserId = activeReservation.userId;
    const prevAmount = activeReservation.amount;

    activeReservation.status = "RELEASED";
    activeReservation.releasedAt = new Date();
    await activeReservation.save();

    await User.updateOne(
      { _id: prevUserId },
      { $inc: { reservedAmount: -prevAmount } }
    );

    await Transaction.create([
      {
        userId: prevUserId,
        userEmail: activeReservation.userEmail,
        name: "Previous Bidder",
        type: "BID_RESERVATION_RELEASE",
        amount: prevAmount,
        productId,
        bidId: activeReservation.bidId,
        reference: `Released outbid reservation of ₹${prevAmount}`,
        metadata: {
          productId: productId.toString(),
          releasedAmount: prevAmount,
          outbidByUserId: userId.toString(),
          outbidByBidId: bidId.toString(),
        },
      },
    ]);

    releasedPreviousBidder = {
      userId: prevUserId.toString(),
      email: activeReservation.userEmail,
      releasedAmount: prevAmount,
    };
  }

  // Create new ACTIVE WalletReservation
  const [newReservation] = await WalletReservation.create([
    {
      userId,
      userEmail,
      productId,
      bidId,
      amount: roundedAmount,
      currency: "INR",
      status: "ACTIVE",
      idempotencyKey,
    },
  ]);

  await Transaction.create([
    {
      userId,
      userEmail,
      name: userName || "User",
      type: "BID_RESERVATION",
      amount: roundedAmount,
      productId,
      bidId,
      idempotencyKey: idempotencyKey ? `res:${idempotencyKey}` : undefined,
      reference: `Reserved ₹${roundedAmount} for auction bid`,
      metadata: {
        productId: productId.toString(),
        bidId: bidId.toString(),
        reservedAmount: roundedAmount,
      },
    },
  ]);

  const bidder = await User.findById(userId);
  return {
    success: true,
    reservation: newReservation,
    isIncrease: false,
    releasedPreviousBidder,
    availableBalance: Math.round(((bidder?.amount || 0) - (bidder?.reservedAmount || 0)) * 100) / 100,
    reservedBalance: bidder?.reservedAmount || 0,
  };
}

module.exports = {
  WalletError,
  getWalletBalance,
  reserveBidFunds,
  releaseReservation,
  captureWinningReservation,
  releaseAllAuctionReservations,
  holdBidderFunds,
  releaseBidderHold,
  commitBidReservation,
};
