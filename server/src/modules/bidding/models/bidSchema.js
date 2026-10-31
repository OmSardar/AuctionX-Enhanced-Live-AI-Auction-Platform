/**
 * Bid Model — Immutable Append-Only Bidding Ledger
 */

const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    bidderEmail: {
      type: String,
      required: true,
    },
    bidderName: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "OUTBID", "WINNING", "REJECTED"],
      default: "ACCEPTED",
    },
    ipAddress: {
      type: String,
    },
    idempotencyKey: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes for auction queries
bidSchema.index({ productId: 1, amount: -1 });
bidSchema.index({ bidder: 1, createdAt: -1 });
bidSchema.index({ productId: 1, createdAt: -1, _id: -1 });
bidSchema.index({ createdAt: -1 });
// Compound unique partial index for scoped idempotency enforcement
bidSchema.index(
  { productId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);

const Bid = mongoose.models.Bid || mongoose.model("Bid", bidSchema);

module.exports = Bid;
