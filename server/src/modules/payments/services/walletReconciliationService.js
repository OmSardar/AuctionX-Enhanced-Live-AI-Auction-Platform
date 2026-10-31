/**
 * Wallet Reconciliation Service
 *
 * Performs authoritative ledger, balance, and escrow reservation integrity checks.
 *
 * Invariants Verified:
 * 1. User Invariant: reservedAmount >= 0 and user.reservedAmount == sum(ACTIVE reservations for user).
 * 2. Available Balance: availableBalance == Math.max(0, amount - reservedAmount).
 * 3. Active Auction Escrow Invariant:
 *    - An active auction with bids (bidCount > 0) must have EXACTLY 1 ACTIVE reservation.
 *    - The active reservation amount must match product.currentPrice.
 *    - The active reservation userId must match product.highestBidder.
 *    - An active auction with no bids (bidCount == 0) must have 0 ACTIVE reservations.
 * 4. Settled Auction Escrow Invariant:
 *    - Settled/Ended/Sold auctions must have 0 ACTIVE reservations (all captured or released).
 */

const User = require("../../users/models/user");
const Product = require("../../products/models/productSchema");
const WalletReservation = require("../../bidding/models/walletReservationSchema");
const { logger } = require("../../../infrastructure/logging/loggerMiddleware");

/**
 * Masks user email addresses to prevent exposing PII in audit logs and reports.
 */
function maskEmail(email) {
  if (!email || typeof email !== "string") return "unknown";
  const parts = email.split("@");
  if (parts.length !== 2) return "***@***";
  const [local, domain] = parts;
  const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

/**
 * Executes a full financial and escrow reconciliation scan.
 *
 * @param {Object} [options]
 * @param {boolean} [options.autoRepair=false] - Whether to attempt automatic repair of discrepancies
 * @returns {Promise<Object>} Reconciliation report
 */
async function runWalletReconciliation({ autoRepair = false } = {}) {
  const timestamp = new Date();
  const discrepancies = [];
  let auctionEscrowMismatches = 0;

  // ---------------------------------------------------------------------------
  // 1. User Balance & Reservation Invariant Check
  // ---------------------------------------------------------------------------
  const users = await User.find({}).lean();
  const totalUsersChecked = users.length;

  for (const user of users) {
    const totalAmount = typeof user.amount === "number" && !isNaN(user.amount) ? user.amount : 0;
    const reservedAmount =
      typeof user.reservedAmount === "number" && !isNaN(user.reservedAmount)
        ? user.reservedAmount
        : 0;

    // Check 1.1: reservedAmount cannot be negative
    if (reservedAmount < 0) {
      discrepancies.push({
        type: "NEGATIVE_RESERVED_BALANCE",
        userId: user._id.toString(),
        userEmail: maskEmail(user.email),
        details: `User has negative reservedAmount: ₹${reservedAmount}`,
      });
    }

    // Check 1.2: total balance cannot be negative
    if (totalAmount < 0) {
      discrepancies.push({
        type: "NEGATIVE_TOTAL_BALANCE",
        userId: user._id.toString(),
        userEmail: maskEmail(user.email),
        details: `User has negative amount: ₹${totalAmount}`,
      });
    }

    // Check 1.3: Available balance cannot be negative (over-reservation accounting error)
    if (totalAmount - reservedAmount < -0.01) {
      discrepancies.push({
        type: "NEGATIVE_AVAILABLE_BALANCE",
        userId: user._id.toString(),
        userEmail: maskEmail(user.email),
        totalBalance: totalAmount,
        reservedBalance: reservedAmount,
        availableBalance: Math.round((totalAmount - reservedAmount) * 100) / 100,
        details: `Accounting discrepancy: User has negative available balance (₹${Math.round((totalAmount - reservedAmount) * 100) / 100})`,
      });
    }

    // Check 1.4: User reservedAmount vs sum of active WalletReservations
    const activeUserReservations = await WalletReservation.find({
      userId: user._id,
      status: "ACTIVE",
    }).lean();

    const computedReserved = Math.round(
      activeUserReservations.reduce((sum, r) => sum + (r.amount || 0), 0) * 100
    ) / 100;

    if (Math.abs(reservedAmount - computedReserved) > 0.01) {
      discrepancies.push({
        type: "RESERVED_BALANCE_MISMATCH",
        userId: user._id.toString(),
        userEmail: maskEmail(user.email),
        expectedReserved: computedReserved,
        actualReserved: reservedAmount,
        activeReservationsCount: activeUserReservations.length,
        details: `User document reservedAmount (₹${reservedAmount}) does not match sum of active reservations (₹${computedReserved})`,
      });

      if (autoRepair) {
        await User.updateOne({ _id: user._id }, { $set: { reservedAmount: computedReserved } });
        if (logger) {
          logger.info(
            `[WalletReconciliation] Auto-repaired user ${user.email} reservedAmount to ₹${computedReserved}`
          );
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Active Auction Escrow Invariant Check
  // ---------------------------------------------------------------------------
  const activeProducts = await Product.find({
    status: { $in: ["Active", "LIVE"] },
  }).lean();
  const activeAuctionsChecked = activeProducts.length;

  for (const product of activeProducts) {
    const activeReservations = await WalletReservation.find({
      productId: product._id,
      status: "ACTIVE",
    }).lean();

    const bidCount = product.bidCount || 0;

    if (bidCount === 0) {
      if (activeReservations.length > 0) {
        auctionEscrowMismatches++;
        discrepancies.push({
          type: "ORPHAN_ACTIVE_RESERVATION",
          productId: product._id.toString(),
          productTitle: product.title,
          activeCount: activeReservations.length,
          details: `Active auction has 0 bids but holds ${activeReservations.length} active reservation(s)`,
        });

        if (autoRepair) {
          await WalletReservation.updateMany(
            { productId: product._id, status: "ACTIVE" },
            { $set: { status: "RELEASED", releasedAt: new Date(), notes: "RECONCILIATION_AUTO_RELEASE" } }
          );
        }
      }
    } else {
      // bidCount > 0: Must have exactly 1 active reservation
      if (activeReservations.length !== 1) {
        auctionEscrowMismatches++;
        discrepancies.push({
          type: "MULTIPLE_ACTIVE_RESERVATIONS",
          productId: product._id.toString(),
          productTitle: product.title,
          activeCount: activeReservations.length,
          details: `Active auction has ${activeReservations.length} active reservations; expected exactly 1`,
        });
      } else {
        const activeRes = activeReservations[0];
        const currentPrice = product.currentPrice || product.startingPrice || 0;

        if (Math.abs(activeRes.amount - currentPrice) > 0.01) {
          auctionEscrowMismatches++;
          discrepancies.push({
            type: "ESCROW_AMOUNT_MISMATCH",
            productId: product._id.toString(),
            productTitle: product.title,
            reservationAmount: activeRes.amount,
            productCurrentPrice: currentPrice,
            details: `Active reservation amount ₹${activeRes.amount} does not match product currentPrice ₹${currentPrice}`,
          });
        }

        if (
          product.highestBidder &&
          activeRes.userId.toString() !== product.highestBidder.toString()
        ) {
          auctionEscrowMismatches++;
          discrepancies.push({
            type: "ESCROW_BIDDER_MISMATCH",
            productId: product._id.toString(),
            productTitle: product.title,
            reservationUserId: activeRes.userId.toString(),
            highestBidderId: product.highestBidder.toString(),
            details: `Active reservation holder (${activeRes.userId}) does not match product highestBidder (${product.highestBidder})`,
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Settled / Ended Auction Escrow Invariant Check
  // ---------------------------------------------------------------------------
  const endedProducts = await Product.find({
    status: { $in: ["Sold", "ENDED", "EXPIRED", "CANCELLED", "RECONCILIATION_REQUIRED"] },
  }).lean();

  for (const product of endedProducts) {
    const lingeringReservations = await WalletReservation.find({
      productId: product._id,
      status: "ACTIVE",
    }).lean();

    if (lingeringReservations.length > 0) {
      auctionEscrowMismatches++;
      discrepancies.push({
        type: "UNSETTLED_ACTIVE_RESERVATION",
        productId: product._id.toString(),
        productTitle: product.title,
        activeCount: lingeringReservations.length,
        details: `Ended auction (${product.status}) has ${lingeringReservations.length} lingering active reservation(s)`,
      });

      if (autoRepair) {
        for (const res of lingeringReservations) {
          res.status = "RELEASED";
          await WalletReservation.updateOne(
            { _id: res._id },
            { $set: { status: "RELEASED", releasedAt: new Date(), notes: "RECONCILIATION_AUTO_RELEASE" } }
          );
          await User.updateOne(
            { _id: res.userId },
            { $inc: { reservedAmount: -res.amount } }
          ).catch(() => {});
        }
      }
    }
  }

  const healthy = discrepancies.length === 0;

  return {
    healthy,
    timestamp,
    summary: {
      totalUsersChecked,
      discrepancyCount: discrepancies.length,
      activeAuctionsChecked,
      auctionEscrowMismatches,
    },
    discrepancies,
  };
}

module.exports = {
  runWalletReconciliation,
};

