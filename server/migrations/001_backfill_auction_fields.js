/**
 * Migration 001: Additive Backfill for Canonical Auction Fields
 *
 * Populates canonical fields (startingPrice, currentPrice, bidCount, canonical dates)
 * for legacy documents without destroying or altering legacy fields.
 * Idempotent: safe to run multiple times.
 */

const mongoose = require("mongoose");
const Product = require("../models/SellAnItemSchema/Product");
const { parseAuctionTimeBoundaries } = require("../middleware/SellAnItemMiddleware/checkTimeRestriction");

function safeDate(val, fallback) {
  if (!val) return fallback;
  const d = val instanceof Date ? val : new Date(val);
  return isNaN(d.getTime()) ? fallback : d;
}

async function backfillAuctionFields() {
  console.log("Starting Migration 001: Backfill Canonical Auction Fields...");

  const cursor = Product.find({
    $or: [
      { startingPrice: { $exists: false } },
      { currentPrice: { $exists: false } },
      { startTime: { $exists: false } },
      { endTime: { $exists: false } },
      { bidCount: { $exists: false } },
    ],
  }).cursor();

  let migratedCount = 0;
  let skippedCount = 0;

  for await (const doc of cursor) {
    const timeBoundaries = parseAuctionTimeBoundaries(doc);
    const resolvedStartTime = safeDate(
      doc.startTime || timeBoundaries.startTime || doc.biddingStartDate || doc.createdAt,
      new Date()
    );
    const resolvedEndTime = safeDate(
      doc.endTime || timeBoundaries.endTime,
      new Date(resolvedStartTime.getTime() + 24 * 60 * 60 * 1000)
    );
    const resolvedOriginalEndTime = safeDate(doc.originalEndTime, resolvedEndTime);
    const resolvedMaxDeadline = safeDate(
      doc.maxExtensionDeadline,
      new Date(resolvedOriginalEndTime.getTime() + 15 * 60 * 1000)
    );

    const initialPrice = doc.startingPrice !== undefined ? doc.startingPrice : (doc.biddingStartPrice || 0);
    const currentPrice = doc.currentPrice !== undefined ? doc.currentPrice : (doc.tempamount || initialPrice);
    const bidCount = doc.bidCount !== undefined ? doc.bidCount : ((doc.tempamount && doc.tempamount > initialPrice) ? 1 : 0);

    const updateSet = {
      startingPrice: initialPrice,
      currentPrice: currentPrice,
      bidCount: bidCount,
      minIncrement: doc.minIncrement || 50,
      startTime: resolvedStartTime,
      originalEndTime: resolvedOriginalEndTime,
      endTime: resolvedEndTime,
      maxExtensionDeadline: resolvedMaxDeadline,
      antiSnipeCount: doc.antiSnipeCount || 0,
    };

    if (doc.tempuseremail && !doc.highestBidderEmail) {
      updateSet.highestBidderEmail = doc.tempuseremail;
    }
    if (doc.tempname && !doc.highestBidderName) {
      updateSet.highestBidderName = doc.tempname;
    }

    await Product.updateOne({ _id: doc._id }, { $set: updateSet });
    migratedCount++;
  }

  console.log(`Migration 001 Complete. Migrated: ${migratedCount}, Skipped: ${skippedCount}`);
  return { migratedCount, skippedCount };
}

// Standalone execution support
if (require.main === module) {
  require("dotenv").config();
  const dbUrl = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/auctionx_test_db";
  mongoose
    .connect(dbUrl)
    .then(async () => {
      await backfillAuctionFields();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}

module.exports = {
  backfillAuctionFields,
};
