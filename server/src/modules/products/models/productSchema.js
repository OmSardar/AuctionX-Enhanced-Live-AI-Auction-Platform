const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // Changed to Map to store key-value pairs for description points
    description: [
      {
        name: { type: String, required: true },
        description: { type: String, required: true },
      },
    ],
    email: { type: String, required: true },
    category: { type: String, required: true },

    // Store multiple images with both the secure_url and public_id
    images: [
      {
        secure_url: { type: String, required: true },
        public_id: { type: String, required: true },
      },
    ],

    mobileNumber: { type: String, required: true },
    biddingStartDate: { type: Date, required: true },
    biddingStartTime: { type: String, required: true },
    biddingStartPrice: { type: Number, required: true },

    // Banner related fields
    hasBanner: { type: Boolean, default: false },
    bannerImage: {
      secure_url: { type: String },
      public_id: { type: String },
    },
    bannerPlan: { type: String },

    // Existing legacy fields (retained for backward compatibility)
    tempuseremail: { type: String, required: false },
    tempamount: { type: Number, required: false },
    tempname: { type: String, required: false },
    biddingEndTime: { type: String, required: true },

    // Canonical bidding and pricing fields
    startingPrice: { type: Number }, // Preserved original reserve/starting price (never overwritten)
    currentPrice: { type: Number }, // Current highest accepted bid
    highestBidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    highestBidderEmail: { type: String, default: null },
    highestBidderName: { type: String, default: null },
    bidCount: { type: Number, default: 0 },
    minIncrement: { type: Number, default: 50 },
    lastBidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bid",
      default: null,
    },

    // Canonical lifecycle and anti-sniping time fields
    startTime: { type: Date },
    originalEndTime: { type: Date }, // Original scheduled close before any anti-sniping extensions
    endTime: { type: Date }, // Authoritative effective closing time
    antiSnipeCount: { type: Number, default: 0 },
    maxExtensionDeadline: { type: Date }, // Hard cap (originalEndTime + 15m)

    // Stage 3 Finalization, Winner and Payment Deadline Fields
    finalizedAt: { type: Date, default: null },
    paymentDeadline: { type: Date, default: null },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    finalPrice: { type: Number, default: null },
    reconciliationRequired: { type: Boolean, default: false },
    reconciliationNotes: { type: String, default: null },

    // Lifecycle status: supports legacy ('Active', 'Closed') and target enums
    status: {
      type: String,
      enum: [
        "Active",
        "Closed",
        "DRAFT",
        "SCHEDULED",
        "LIVE",
        "ENDED",
        "AWAITING_PAYMENT",
        "SETTLED",
        "UNSOLD",
        "CANCELLED",
      ],
      default: "Active",
    },

    // Listing Moderation & Catalog Governance
    isModerated: {
      type: Boolean,
      default: false,
      index: true,
    },
    moderationStatus: {
      type: String,
      enum: ["ACTIVE", "FLAGGED", "SUSPENDED", "REMOVED"],
      default: "ACTIVE",
      index: true,
    },
    moderationReason: {
      type: String,
      default: "",
    },
    moderatedAt: {
      type: Date,
      default: null,
    },
    moderatedBy: {
      type: String,
      default: null,
    },
    moderationHistory: [
      {
        action: { type: String, required: true },
        reason: { type: String, required: true },
        adminEmail: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Performance and query indexes
productSchema.index({ status: 1, startTime: 1 });
productSchema.index({ status: 1, endTime: 1 });
productSchema.index({ status: 1, category: 1 });
productSchema.index({ isModerated: 1, status: 1 });
productSchema.index({ email: 1 });
productSchema.index({ email: 1, createdAt: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ currentPrice: 1 });

module.exports = mongoose.model("Product", productSchema);
