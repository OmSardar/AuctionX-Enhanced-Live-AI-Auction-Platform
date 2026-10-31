const mongoose = require("mongoose");

/**
 * Webhook Event Deduplication & Audit Ledger Model
 * Guarantees idempotent webhook processing by enforcing a unique index on eventId.
 */
const webhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      index: true,
    },
    providerOrderId: {
      type: String,
      index: true,
    },
    processingStatus: {
      type: String,
      enum: ["PENDING", "PROCESSED", "IGNORED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    leaseExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    leaseVersion: {
      type: Number,
      default: 1,
    },
    error: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.WebhookEvent || mongoose.model("WebhookEvent", webhookEventSchema);
