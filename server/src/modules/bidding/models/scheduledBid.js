/**
 * ScheduledBid Model — User-Initiated Scheduled Bids
 *
 * Persists bids configured by users to execute automatically at a designated
 * target timestamp during an active auction lifecycle.
 */

const mongoose = require("mongoose");

const scheduledBidSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    targetTime: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "EXECUTED", "CANCELLED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    executedBidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bid",
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    idempotencyKey: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly find due scheduled bids in the background worker
scheduledBidSchema.index({ status: 1, targetTime: 1 });

// User scheduled bid listing
scheduledBidSchema.index({ userId: 1, status: 1, createdAt: -1 });

// Scoped idempotency per user + product + idempotencyKey
scheduledBidSchema.index(
  { userId: 1, productId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);

const ScheduledBid =
  mongoose.models.ScheduledBid ||
  mongoose.model("ScheduledBid", scheduledBidSchema);

module.exports = ScheduledBid;
