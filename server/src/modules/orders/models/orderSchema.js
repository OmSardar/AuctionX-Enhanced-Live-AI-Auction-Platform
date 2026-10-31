const mongoose = require('mongoose');

// Define the Order schema
const orderSchema = new mongoose.Schema({
  title: { type: String, required: true },
  name: { type: String, required: true },
  userEmail: { type: String, required: true },
  sellerEmail: { type: String, required: true },
  category: { type: String, required: true },
  images: [
    {
      secure_url: { type: String, required: true },
      public_id: { type: String, required: true }
    }
  ],
  biddingStartPrice: { type: Number, required: true },
  highestBid: { type: Number, default: 0 },
  finalPrice: { type: Number },
  phoneNo: { type: String, required: true },
  address: { type: String, required: true },

  // Stage 3 Canonical Lifecycle & Payment Obligation Fields
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  winnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED', 'EXPIRED'],
    default: 'PENDING',
  },
  paymentDeadline: {
    type: Date,
  },

  // Stage 4 Payment Architecture & Settlement Fields
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null,
  },
  razorpayPaymentId: {
    type: String,
    default: null,
  },
  razorpayOrderId: {
    type: String,
    default: null,
  },
  paidAt: {
    type: Date,
    default: null,
  },
  paymentAttempts: {
    type: Number,
    default: 0,
  },

  // Stage 7 Dispute Hold & Investigation Protocol Fields
  disputeHolds: [
    {
      holdId: { type: String, required: true },
      caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReportAdmin', required: true },
      reason: { type: String, required: true, trim: true },
      placedBy: {
        adminId: { type: String, required: true },
        adminEmail: { type: String, required: true },
        role: { type: String, required: true },
      },
      placedAt: { type: Date, default: Date.now },
      status: { type: String, enum: ['ACTIVE', 'RELEASED'], default: 'ACTIVE' },
      releasedBy: {
        adminId: { type: String },
        adminEmail: { type: String },
        role: { type: String },
      },
      releasedAt: { type: Date },
      releaseReason: { type: String, trim: true },
    }
  ],
  isDisputeHoldActive: {
    type: Boolean,
    default: false,
    index: true,
  },
}, { timestamps: true });

// Prevent duplicate payment obligations for the same auction item
orderSchema.index({ productId: 1 }, { unique: true, sparse: true });
orderSchema.index({ userEmail: 1, createdAt: -1 });
orderSchema.index({ status: 1, paymentDeadline: 1 });
orderSchema.index({ razorpayOrderId: 1 }, { sparse: true });
orderSchema.index({ "disputeHolds.caseId": 1, "disputeHolds.status": 1 });
orderSchema.index({ isDisputeHoldActive: 1, paymentDeadline: 1 });
orderSchema.index({ sellerEmail: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });

// Export the Order model
module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);

