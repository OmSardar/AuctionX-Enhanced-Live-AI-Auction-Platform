const mongoose = require("mongoose");

/**
 * Unified AuditLog Schema — Stage 7.42
 * Immutable audit trail across administrators, sellers, users, integrations, and system tasks.
 * Stores events in 'adminauditlogs' for full backward compatibility with AdminAuditLog.
 */
const auditLogSchema = new mongoose.Schema(
  {
    // Actor details
    actorType: {
      type: String,
      enum: ["admin", "user", "seller", "system", "integration"],
      default: "admin",
      index: true,
    },
    actorId: {
      type: String,
      index: true,
      default: null,
    },
    actorEmail: {
      type: String,
      index: true,
      default: null,
    },
    actorName: {
      type: String,
      default: null,
    },
    actorRole: {
      type: String,
      default: null,
    },

    // Backward-compatibility aliases for Stage 2-7.2 tests
    actingAdminId: {
      type: String,
      index: true,
      default: null,
    },
    actingAdminEmail: {
      type: String,
      index: true,
      default: null,
    },
    actingAdminModel: {
      type: String,
      enum: ["Admin", "User", "System"],
      default: "Admin",
    },
    actingAdminRole: {
      type: String,
      default: "admin",
    },

    // Target / Resource details
    resourceType: {
      type: String,
      index: true,
      default: "account",
    },
    resourceId: {
      type: String,
      index: true,
      default: null,
    },
    targetAccountId: {
      type: String,
      index: true,
      default: null,
    },
    targetAccountEmail: {
      type: String,
      index: true,
      default: null,
    },
    targetAccountType: {
      type: String,
      default: "user",
    },

    // Action and Category
    action: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        "AUTH",
        "SECURITY",
        "USER_MANAGEMENT",
        "SELLER_MANAGEMENT",
        "MARKETPLACE",
        "AUCTION",
        "ORDER",
        "DISPUTE",
        "FINANCE",
        "ENGAGEMENT",
        "SYSTEM",
        "GOVERNANCE",
      ],
      default: "GOVERNANCE",
      index: true,
    },

    // Outcome & Diagnostics
    outcome: {
      type: String,
      enum: [
        "PENDING",
        "SUCCESS",
        "FAILED",
        "DENIED",
        "ROLLED_BACK",
        "RECONCILIATION_REQUIRED",
      ],
      default: "SUCCESS",
      index: true,
    },
    failureReason: {
      type: String,
      default: "",
    },
    reason: {
      type: String,
      default: "",
      trim: true,
    },

    // State delta tracking
    beforeStatus: {
      type: String,
      default: null,
    },
    afterStatus: {
      type: String,
      default: null,
    },
    beforeState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    afterState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    changedFields: {
      type: [String],
      default: [],
    },

    // Correlation & Idempotency
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    correlationId: {
      type: String,
      index: true,
      default: null,
    },

    // Network & Environment
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
    completedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable audit base timestamp
  }
);

// Pre-save normalization hook ensuring bidirectional compatibility
auditLogSchema.pre("save", function (next) {
  // Sync actor fields
  if (!this.actorId && this.actingAdminId) {
    this.actorId = this.actingAdminId;
  }
  if (!this.actingAdminId && this.actorId && this.actorType === "admin") {
    this.actingAdminId = this.actorId;
  }

  if (!this.actorEmail && this.actingAdminEmail) {
    this.actorEmail = this.actingAdminEmail;
  }
  if (!this.actingAdminEmail && this.actorEmail && this.actorType === "admin") {
    this.actingAdminEmail = this.actorEmail;
  }

  if (!this.actorRole && this.actingAdminRole) {
    this.actorRole = this.actingAdminRole;
  }

  // Sync target / resource fields
  if (!this.resourceId && this.targetAccountId) {
    this.resourceId = this.targetAccountId;
  }
  if (!this.targetAccountId && this.resourceId) {
    this.targetAccountId = this.resourceId;
  }

  if (!this.resourceType && this.targetAccountType) {
    this.resourceType = this.targetAccountType;
  }
  if (!this.targetAccountType && this.resourceType) {
    this.targetAccountType = this.resourceType;
  }

  if (this.outcome === "SUCCESS" && !this.completedAt) {
    this.completedAt = new Date();
  }

  next();
});

// Composite indexes for fast administrative lookups
auditLogSchema.index({ targetAccountId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ actorEmail: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ category: 1, outcome: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog =
  mongoose.models.AuditLog ||
  mongoose.model("AuditLog", auditLogSchema, "adminauditlogs");

module.exports = AuditLog;
