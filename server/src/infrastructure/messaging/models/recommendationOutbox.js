const mongoose = require("mongoose");

/**
 * Recommendation Outbox Model
 *
 * Guarantees durable, observable delivery of authoritative business events
 * (bids, purchases) to the recommendation subsystem.
 * Employs a unique index on eventId to ensure scoped idempotency.
 */
const recommendationOutboxSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: ["bid", "purchase"],
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    productId: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "DELIVERED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.RecommendationOutbox ||
  mongoose.model("RecommendationOutbox", recommendationOutboxSchema);
