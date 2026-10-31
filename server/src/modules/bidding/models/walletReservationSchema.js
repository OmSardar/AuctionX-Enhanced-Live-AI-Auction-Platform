/**
 * Wallet Reservation Model — Escrow / Hold Engine for Auction Bidding
 *
 * Guarantees that at most ONE ACTIVE reservation exists per auction product.
 * When outbid, the reservation is released back to available balance.
 * When won, the reservation is captured into a finalized order.
 */

const mongoose = require("mongoose");

const walletReservationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    bidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bid",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "RELEASED", "CAPTURED", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
    },
    releasedAt: {
      type: Date,
      default: null,
    },
    capturedAt: {
      type: Date,
      default: null,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
      sparse: true,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes
// CRITICAL: Ensure at most ONE ACTIVE reservation exists per auction product!
walletReservationSchema.index(
  { productId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" }, name: "uniq_active_product_reservation" }
);
walletReservationSchema.index({ userId: 1, status: 1 });
walletReservationSchema.index({ productId: 1, userId: 1, status: 1 });

const WalletReservation =
  mongoose.models.WalletReservation ||
  mongoose.model("WalletReservation", walletReservationSchema);

module.exports = WalletReservation;

