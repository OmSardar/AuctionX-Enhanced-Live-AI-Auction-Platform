const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    userEmail: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["deposit", "withdrawal"],
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
    status: {
      type: String,
      enum: ["pending", "completed", "rejected", "processing", "failed"],
      default: "completed",
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

// Indexes for query performance and idempotency
TransactionSchema.index({ userEmail: 1, date: -1 });
TransactionSchema.index(
  { paymentId: 1 },
  { unique: true, sparse: true, name: "uniq_transaction_payment_id" }
);

module.exports = mongoose.model("Transaction", TransactionSchema);