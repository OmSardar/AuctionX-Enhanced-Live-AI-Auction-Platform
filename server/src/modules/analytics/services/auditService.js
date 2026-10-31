const AuditLog = require("../../authentication/models/auditLog");
const { logger } = require("../../../infrastructure/logging/loggerMiddleware");

// Substrings that indicate sensitive credentials
const SENSITIVE_SUBSTRINGS = [
  "password",
  "token",
  "secret",
  "cookie",
  "otp",
  "jwt",
  "cvv",
  "cvc",
  "pan",
  "privatekey",
  "private_key",
];

/**
 * Deep sanitization to strip and redact confidential credentials from audit metadata.
 */
function sanitizePayload(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 5) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizePayload(item, depth + 1));
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    const isSensitive = SENSITIVE_SUBSTRINGS.some((sub) => lowerKey.includes(sub));

    if (isSensitive) {
      cleaned[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      cleaned[key] = sanitizePayload(value, depth + 1);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

const { resolveAuthenticClientIp } = require("../../../common/utilities/ipResolver");

/**
 * Unified Central Audit Service — Stage 7.42
 * Provides platform-wide immutable event logging, querying, and telemetry.
 */
class AuditService {
  /**
   * Record an authoritative event across the AuctionX platform.
   */
  async recordEvent({
    actor = null,
    target = null,
    actorType = "system",
    actorId = null,
    actorEmail = null,
    actorName = null,
    actorRole = null,
    actingAdminId = null,
    actingAdminEmail = null,
    actingAdminRole = null,
    actingAdminModel = "Admin",
    resourceType = "account",
    resourceId = null,
    targetAccountId = null,
    targetAccountEmail = null,
    targetAccountType = null,
    action,
    category = "GOVERNANCE",
    outcome = "SUCCESS",
    failureReason = "",
    reason = "",
    beforeStatus = null,
    afterStatus = null,
    beforeState = null,
    afterState = null,
    changedFields = [],
    metadata = {},
    idempotencyKey = null,
    correlationId = null,
    req = null,
    throwOnError = false,
  }) {
    try {
      if (actor) {
        actorType = actor.actorType || actorType;
        actorId = actor.actorId || actor.id || actor._id || actorId;
        actorEmail = actor.actorEmail || actor.email || actorEmail;
        actorName = actor.actorName || actor.name || actorName;
        actorRole = actor.actorRole || actor.role || actorRole;
      }
      if (target) {
        resourceType = target.targetType || target.resourceType || resourceType;
        resourceId = target.targetId || target.resourceId || target.id || target._id || resourceId;
        targetAccountId = target.targetAccountId || target.targetId || targetAccountId;
        targetAccountEmail = target.targetAccountEmail || target.email || targetAccountEmail;
        targetAccountType = target.targetAccountType || target.targetType || targetAccountType;
      }
      // 1. If idempotency key is supplied, check for existing entry
      if (idempotencyKey) {
        const existing = await AuditLog.findOne({ idempotencyKey }).lean();
        if (existing) {
          return existing;
        }
      }

      // 2. Extract network and actor context from req if present
      let ip = "";
      let userAgent = "";
      let cid = correlationId;

      if (req) {
        ip = resolveAuthenticClientIp(req);
        userAgent = req.headers["user-agent"] || "";
        cid =
          cid ||
          req.headers["x-correlation-id"] ||
          req.headers["x-request-id"] ||
          null;

        // Auto-resolve actor from authenticated req context if not supplied
        if (!actorId) {
          if (req.admin) {
            actorType = "admin";
            actorId = req.admin.id || req.admin._id?.toString();
            actorEmail = req.admin.email;
            actorRole = req.admin.role || "admin";
          } else if (req.seller) {
            actorType = "seller";
            actorId = req.seller.id || req.seller._id?.toString();
            actorEmail = req.seller.email;
            actorRole = "seller";
          } else if (req.user) {
            actorType = req.user.role === "admin" ? "admin" : "user";
            actorId = req.user.id || req.user._id?.toString();
            actorEmail = req.user.email;
            actorRole = req.user.role || "user";
          }
        }
      }

      // 3. Sanitize state deltas and metadata to prevent leaking secrets
      const safeMetadata = sanitizePayload(metadata);
      const safeBefore = sanitizePayload(beforeState);
      const safeAfter = sanitizePayload(afterState);

      // 4. Create and persist the immutable audit log
      const auditLog = new AuditLog({
        actorType,
        actorId: actorId ? String(actorId) : null,
        actorEmail,
        actorName,
        actorRole,
        actingAdminId: actingAdminId || (actorType === "admin" && actorId ? String(actorId) : null),
        actingAdminEmail: actingAdminEmail || (actorType === "admin" ? actorEmail : null),
        actingAdminRole: actingAdminRole || (actorType === "admin" ? actorRole || "admin" : "admin"),
        actingAdminModel,
        resourceType: resourceType || targetAccountType || "account",
        resourceId: resourceId ? String(resourceId) : targetAccountId ? String(targetAccountId) : null,
        targetAccountId: targetAccountId ? String(targetAccountId) : resourceId ? String(resourceId) : null,
        targetAccountEmail,
        targetAccountType: targetAccountType || resourceType || "user",
        action,
        category,
        outcome,
        failureReason,
        reason,
        beforeStatus,
        afterStatus: afterStatus || (beforeStatus ? beforeStatus : null),
        beforeState: safeBefore,
        afterState: safeAfter,
        changedFields,
        metadata: safeMetadata,
        idempotencyKey,
        correlationId: cid,
        ipAddress: ip,
        userAgent,
        completedAt: outcome === "SUCCESS" ? new Date() : null,
      });

      await auditLog.save();
      return auditLog;
    } catch (error) {
      logger.error("AuditService: Failed to record audit log:", {
        action,
        error: error.message,
        idempotencyKey,
      });

      if (throwOnError) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Search and filter audit events with safe bounds.
   */
  async queryEvents({
    page = 1,
    limit = 20,
    actorType,
    actorId,
    actorEmail,
    action,
    category,
    outcome,
    resourceType,
    resourceId,
    search,
    startDate,
    endDate,
    correlationId,
    sortBy = "createdAt",
    sortOrder = "desc",
  }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (actorType && actorType !== "ALL") {
      filter.actorType = actorType.toLowerCase();
    }
    if (actorId) {
      filter.$or = [{ actorId }, { actingAdminId: actorId }];
    }
    if (actorEmail) {
      filter.$or = [
        { actorEmail: new RegExp(actorEmail, "i") },
        { actingAdminEmail: new RegExp(actorEmail, "i") },
      ];
    }
    if (action && action !== "ALL") {
      filter.action = action;
    }
    if (category && category !== "ALL") {
      filter.category = category;
    }
    if (outcome && outcome !== "ALL") {
      filter.outcome = outcome;
    }
    if (resourceType && resourceType !== "ALL") {
      filter.resourceType = resourceType;
    }
    if (resourceId) {
      filter.$or = [{ resourceId }, { targetAccountId: resourceId }];
    }
    if (correlationId) {
      filter.correlationId = correlationId;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) filter.createdAt.$lte = end;
      }
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { action: regex },
        { actorEmail: regex },
        { targetAccountEmail: regex },
        { reason: regex },
        { failureReason: regex },
        { resourceId: regex },
        { correlationId: regex },
      ];
    }

    const sortDirection = sortOrder.toLowerCase() === "asc" ? 1 : -1;
    const sort = { [sortBy]: sortDirection };

    const [events, totalCount] = await Promise.all([
      AuditLog.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    return {
      events,
      totalCount,
      page: pageNum,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    };
  }

  /**
   * Fetch single audit event with redacted sensitive details.
   */
  async getEventById(id) {
    if (!id) return null;
    return AuditLog.findById(id).lean();
  }

  /**
   * Telemetry summary of audit outcomes and activities over the last 24h.
   */
  async getAuditSummary() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalEvents, outcomeStats, recentFailures] = await Promise.all([
      AuditLog.countDocuments({ createdAt: { $gte: since24h } }),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: since24h } } },
        { $group: { _id: "$outcome", count: { $sum: 1 } } },
      ]),
      AuditLog.find({
        outcome: { $in: ["FAILED", "DENIED", "RECONCILIATION_REQUIRED"] },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const outcomeMap = {
      SUCCESS: 0,
      FAILED: 0,
      DENIED: 0,
      PENDING: 0,
      ROLLED_BACK: 0,
      RECONCILIATION_REQUIRED: 0,
    };

    outcomeStats.forEach((stat) => {
      if (stat._id && outcomeMap[stat._id] !== undefined) {
        outcomeMap[stat._id] = stat.count;
      }
    });

    return {
      totalEventsLast24h: totalEvents,
      outcomes: outcomeMap,
      recentFailures,
    };
  }
}

const auditServiceInstance = new AuditService();
auditServiceInstance.resolveAuthenticClientIp = resolveAuthenticClientIp;
module.exports = auditServiceInstance;
