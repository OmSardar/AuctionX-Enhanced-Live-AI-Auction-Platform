const mongoose = require("mongoose");

/**
 * Payment Attempt & Transaction Ledger Model
 * Tracks individual payment attempts, provider order associations,
 * cryptographic verification details, and reconciliation states.
 */
const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: function () {
        return this.type === "AUCTION_ORDER";
      },
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: function () {
        return this.type === "AUCTION_ORDER";
      },
      index: true,
    },
    type: {
      type: String,
      enum: ["AUCTION_ORDER", "WALLET_TOPUP", "BANNER_PAYMENT", "SELLER_SUBSCRIPTION"],
      default: "AUCTION_ORDER",
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
    // Amount in integer minor units (paise for INR)
    amount: {
      type: Number,
      required: true,
      min: 100, // Minimum ₹1.00
    },
    currency: {
      type: String,
      required: true,
      default: "INR",
      uppercase: true,
    },
    // Payment Attempt State Machine
    status: {
      type: String,
      enum: [
        "INITIATED",
        "PENDING_VERIFICATION",
        "CAPTURED",
        "FAILED",
        "CANCELLED",
        "EXPIRED",
        "REQUIRES_RECONCILIATION",
      ],
      default: "INITIATED",
      index: true,
    },
    // Razorpay Provider Identifiers
    razorpayOrderId: {
      type: String,
      index: true,
      sparse: true,
    },
    razorpayPaymentId: {
      type: String,
      sparse: true,
    },
    // Scoped Idempotency Key
    idempotencyKey: {
      type: String,
      sparse: true,
    },
    // Verification Metadata
    verifiedVia: {
      type: String,
      enum: ["CHECKOUT_VERIFICATION", "WEBHOOK", "MANUAL_RECONCILIATION"],
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    reconciliationNotes: {
      type: String,
      default: null,
    },
    rawProviderDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Durable Settlement & Ledger Coordination Tracking
    walletCredited: {
      type: Boolean,
      default: false,
      index: true,
    },
    walletCreditedAt: {
      type: Date,
      default: null,
    },
    ledgerRecorded: {
      type: Boolean,
      default: false,
      index: true,
    },
    ledgerRecordedAt: {
      type: Date,
      default: null,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },
    settlementLockedUntil: {
      type: Date,
      default: null,
      index: true,
    },
    settlementToken: {
      type: String,
      default: null,
      index: true,
    },
    settlementLeaseVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Indexes for query performance and uniqueness
paymentSchema.index({ orderId: 1, createdAt: -1 });
paymentSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, sparse: true, name: "uniq_razorpay_payment_id" }
);
paymentSchema.index(
  { orderId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
    name: "uniq_order_idempotency",
  }
);
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
