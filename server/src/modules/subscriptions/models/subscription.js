const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    planName: {
      type: String,
      required: true,
      trim: true,
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "pending", "free", "past_due", "failed"],
      default: "pending",
      required: true,
    },
    planId: {
      type: String,
      enum: ["free", "freelancer", "business", "enterprise"],
      default: "free",
      trim: true,
    },
    billingInterval: {
      type: String,
      enum: ["monthly", "annual"],
      default: "monthly",
    },
    startDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    listingLimit: {
      type: Number,
      default: 3,
      min: 1,
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: "",
    },
    features: {
      type: [String],
      default: [],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: false,
    },
    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    razorpaySignature: {
      type: String,
      default: null,
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

// Indexes for better performance
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ sellerId: 1, status: 1 });
subscriptionSchema.index({ userEmail: 1, status: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ endDate: 1 });

const Subscription = mongoose.model("Subscription", subscriptionSchema);

module.exports = Subscription;
