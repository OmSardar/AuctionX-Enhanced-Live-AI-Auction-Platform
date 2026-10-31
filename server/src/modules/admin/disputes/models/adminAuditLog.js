const AuditLog = require("../../../authentication/models/auditLog");

/**
 * AdminAuditLog — Backward Compatible Export
 * Delegates to the unified AuditLog model backed by the 'adminauditlogs' MongoDB collection.
 * Fully preserves legacy field semantics while enabling platform-wide event capture.
 */
module.exports = AuditLog;
