const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      sparse: true,
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "deposit",
        "withdrawal",
        "WALLET_TOPUP",
        "BID_RESERVATION",
        "BID_RESERVATION_INCREASE",
        "BID_RESERVATION_RELEASE",
        "AUCTION_WIN_CAPTURE",
        "AUCTION_REFUND",
        "WALLET_ADJUSTMENT",
        "ADMIN_RECONCILIATION_REPAIR",
      ],
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      index: true,
      sparse: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      index: true,
      sparse: true,
    },
    bidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bid",
      index: true,
      sparse: true,
    },
    idempotencyKey: {
      type: String,
      index: true,
      sparse: true,
    },
    reference: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "rejected", "processing", "failed"],
      default: "completed",
    },
    notes: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for query performance and idempotency
TransactionSchema.index({ userEmail: 1, date: -1 });
TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ productId: 1, type: 1 });
TransactionSchema.index(
  { paymentId: 1 },
  { unique: true, sparse: true, name: "uniq_transaction_payment_id" }
);
TransactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true, name: "uniq_transaction_idempotency_key" }
);

module.exports = mongoose.model("Transaction", TransactionSchema);
