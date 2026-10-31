const mongoose = require("mongoose");
const AdminAuditLog = require("../models/adminAuditLog");
const Order = require("../../../orders/models/orderSchema");
const ReportAdmin = require("../../moderation/models/reports");
const Admin = require("../../authentication/models/admin");

/**
 * Mask sensitive email for restricted roles (e.g. editor)
 */
const maskEmail = (email) => {
  if (!email || typeof email !== "string") return "";
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const user = parts[0];
  const domain = parts[1];
  const maskedUser = user.length > 2 ? `${user.slice(0, 2)}***` : `${user}***`;
  return `${maskedUser}@${domain}`;
};

/**
 * Mask phone number for restricted roles
 */
const maskPhone = (phone) => {
  if (!phone || typeof phone !== "string") return "";
  const clean = phone.trim();
  if (clean.length < 4) return "**********";
  return `******${clean.slice(-4)}`;
};

/**
 * Determine investigation priority based on outcome and status
 */
const getInvestigationPriority = (outcome, ageMinutes = 0) => {
  if (outcome === "RECONCILIATION_REQUIRED") return "CRITICAL";
  if (outcome === "PENDING" && ageMinutes >= 5) return "HIGH";
  if (outcome === "PENDING") return "MEDIUM";
  if (outcome === "FAILED") return "MEDIUM";
  return "LOW";
};

/**
 * Suggest next triage step based on audit log state
 */
const getSuggestedAction = (audit, isStalePending) => {
  if (audit.outcome === "RECONCILIATION_REQUIRED") {
    return "Execute read-only consistency inspection. Verify if order hold is partially applied and whether compensating rollback failed before manual adjustment.";
  }
  if (isStalePending) {
    return "Inspect operation to verify if order mutation succeeded before process interruption. Retry with same idempotencyKey if safe.";
  }
  if (audit.outcome === "FAILED") {
    return "Review failure reason. If validation or authorization failed, no order changes were made.";
  }
  if (audit.outcome === "ROLLED_BACK") {
    return "Audit finalization failed but compensating rollback succeeded. Order state was reverted to baseline.";
  }
  return "Operation completed. Run read-only inspection if discrepancy suspected.";
};

/**
 * GET /api/admin/reconciliation/summary
 * Telemetry summary of operations requiring investigation.
 */
const getReconciliationSummary = async (req, res) => {
  try {
    const ageMinutesThreshold = Math.max(1, parseInt(req.query.ageMinutes, 10) || 5);
    const staleThresholdDate = new Date(Date.now() - ageMinutesThreshold * 60 * 1000);

    const [
      reconciliationRequiredCount,
      stalePendingCount,
      failedRollbackCount,
      totalPendingCount,
      failedCount,
      actionAggregation,
    ] = await Promise.all([
      AdminAuditLog.countDocuments({ outcome: "RECONCILIATION_REQUIRED" }),
      AdminAuditLog.countDocuments({ outcome: "PENDING", createdAt: { $lte: staleThresholdDate } }),
      AdminAuditLog.countDocuments({
        outcome: "RECONCILIATION_REQUIRED",
        failureReason: { $regex: /rollback failed/i },
      }),
      AdminAuditLog.countDocuments({ outcome: "PENDING" }),
      AdminAuditLog.countDocuments({ outcome: "FAILED" }),
      AdminAuditLog.aggregate([
        {
          $match: {
            $or: [
              { outcome: "RECONCILIATION_REQUIRED" },
              { outcome: "PENDING", createdAt: { $lte: staleThresholdDate } },
            ],
          },
        },
        {
          $group: {
            _id: "$action",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const byAction = {};
    for (const item of actionAggregation) {
      byAction[item._id] = item.count;
    }

    return res.status(200).json({
      success: true,
      summary: {
        totalIssues: reconciliationRequiredCount + stalePendingCount,
        reconciliationRequiredCount,
        stalePendingCount,
        totalPendingCount,
        failedRollbackCount,
        failedCount,
        staleAgeMinutesThreshold: ageMinutesThreshold,
        byAction,
      },
    });
  } catch (error) {
    console.error("[AdminReconciliation] getReconciliationSummary error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching reconciliation summary",
    });
  }
};

/**
 * GET /api/admin/reconciliation/operations
 * Paginated, filtered directory of administrative operations requiring investigation.
 */
const getReconciliationOperations = async (req, res) => {
  try {
    const actingRole = req.role || req.adminRole || req.user?.role || "admin";
    const isEditor = actingRole === "editor";

    // 1. Pagination validation
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 50) limit = 50; // Bound maximum query cost

    // 2. Filters
    const { outcome, action, category, search } = req.query;
    const ageMinutes = Math.max(1, parseInt(req.query.ageMinutes, 10) || 5);
    const staleThresholdDate = new Date(Date.now() - ageMinutes * 60 * 1000);

    const query = {};

    // Outcome filter
    if (outcome && outcome !== "ALL") {
      const allowedOutcomes = ["PENDING", "SUCCESS", "FAILED", "ROLLED_BACK", "RECONCILIATION_REQUIRED"];
      if (!allowedOutcomes.includes(outcome)) {
        return res.status(400).json({
          success: false,
          message: `Invalid outcome filter. Allowed: ${allowedOutcomes.join(", ")}`,
        });
      }
      query.outcome = outcome;
    }

    // Action filter
    if (action && action !== "ALL") {
      const allowedActions = [
        "SUSPEND_ACCOUNT",
        "RESTORE_ACCOUNT",
        "FLAG_ACCOUNT",
        "UPDATE_STATUS",
        "MODERATE_LISTING",
        "RESTORE_LISTING",
        "RESOLVE_REPORT",
        "DISMISS_REPORT",
        "REJECT_REPORT",
        "UPDATE_REPORT",
        "PLACE_DISPUTE_HOLD",
        "RELEASE_DISPUTE_HOLD",
        "ADD_INVESTIGATION_NOTE",
      ];
      if (!allowedActions.includes(action)) {
        return res.status(400).json({
          success: false,
          message: `Invalid action filter. Allowed: ${allowedActions.join(", ")}`,
        });
      }
      query.action = action;
    }

    // Category filter
    if (category && category !== "ALL") {
      if (category === "dispute_hold") {
        query.action = { $in: ["PLACE_DISPUTE_HOLD", "RELEASE_DISPUTE_HOLD"] };
      } else if (category === "stale_pending") {
        query.outcome = "PENDING";
        query.createdAt = { $lte: staleThresholdDate };
      } else if (category === "reconciliation_required") {
        query.outcome = "RECONCILIATION_REQUIRED";
      } else if (category === "failed_rollback") {
        query.outcome = "RECONCILIATION_REQUIRED";
        query.failureReason = { $regex: /rollback failed/i };
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid category filter. Allowed: 'ALL', 'dispute_hold', 'stale_pending', 'reconciliation_required', 'failed_rollback'",
        });
      }
    }

    // Free text search with escaping to prevent regex injection
    if (search && typeof search === "string" && search.trim() !== "") {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escapedSearch, "i");
      query.$or = [
        { targetAccountId: searchRegex },
        { targetAccountEmail: searchRegex },
        { actingAdminEmail: searchRegex },
        { reason: searchRegex },
        { failureReason: searchRegex },
        { idempotencyKey: searchRegex },
      ];
    }

    // Default view when no explicit filter: prioritize items requiring attention
    if (!outcome && !category && !action && !search) {
      query.$or = [
        { outcome: "RECONCILIATION_REQUIRED" },
        { outcome: "PENDING", createdAt: { $lte: staleThresholdDate } },
      ];
    }

    // 3. Sorting
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const allowedSortFields = ["createdAt", "completedAt", "outcome", "action"];
    if (!allowedSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sortBy field. Allowed: ${allowedSortFields.join(", ")}`,
      });
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder;

    // 4. Execution
    const total = await AdminAuditLog.countDocuments(query);
    const skip = (page - 1) * limit;

    const auditLogs = await AdminAuditLog.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    const now = Date.now();
    const operations = auditLogs.map((log) => {
      const createdAtMs = log.createdAt ? new Date(log.createdAt).getTime() : now;
      const ageMs = Math.max(0, now - createdAtMs);
      const ageMinutes = Math.round(ageMs / 60000);
      const isStalePending = log.outcome === "PENDING" && ageMinutes >= ageMinutesThreshold;

      return {
        id: log._id.toString(),
        action: log.action,
        outcome: log.outcome,
        reason: log.reason,
        failureReason: log.failureReason || "",
        idempotencyKey: log.idempotencyKey || null,
        targetAccountId: log.targetAccountId,
        targetAccountEmail: isEditor ? maskEmail(log.targetAccountEmail) : log.targetAccountEmail,
        targetAccountType: log.targetAccountType,
        actingAdminEmail: isEditor ? maskEmail(log.actingAdminEmail) : log.actingAdminEmail,
        actingAdminRole: log.actingAdminRole,
        beforeStatus: log.beforeStatus,
        afterStatus: log.afterStatus,
        createdAt: log.createdAt ? new Date(log.createdAt).toISOString() : null,
        completedAt: log.completedAt ? new Date(log.completedAt).toISOString() : null,
        ageMs,
        ageMinutes,
        isStalePending,
        investigationPriority: getInvestigationPriority(log.outcome, ageMinutes),
        suggestedAction: getSuggestedAction(log, isStalePending),
        metadata: {
          caseId: log.metadata?.caseId || null,
          orderId: log.metadata?.orderId || null,
          isDisputeHoldActiveBefore: log.metadata?.isDisputeHoldActiveBefore ?? null,
          recoveredFromAmbiguousState: log.metadata?.recoveredFromAmbiguousState ?? false,
        },
      };
    });

    return res.status(200).json({
      success: true,
      operations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("[AdminReconciliation] getReconciliationOperations error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching reconciliation operations",
    });
  }
};

/**
 * GET /api/admin/reconciliation/operations/:id/inspect
 * Deep read-only consistency inspection of an administrative operation against live database state.
 * Guaranteed zero mutation: performs no writes, repairs, or updates.
 */
const inspectOperation = async (req, res) => {
  try {
    const actingRole = req.role || req.adminRole || req.user?.role || "admin";
    const isEditor = actingRole === "editor";

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Audit Log ID format",
      });
    }

    const auditLog = await AdminAuditLog.findById(id).lean();
    if (!auditLog) {
      return res.status(404).json({
        success: false,
        message: "Audit log record not found",
      });
    }

    // 1. Identify Target References
    const caseIdRef = auditLog.metadata?.caseId || (auditLog.targetAccountType === "report" ? auditLog.targetAccountId : null);
    const orderIdRef = auditLog.metadata?.orderId || (auditLog.targetAccountType === "order" ? auditLog.targetAccountId : null);

    let order = null;
    let disputeCase = null;
    let orderFetchError = null;
    let caseFetchError = null;

    // 2. Read Related Order (Read-only)
    if (orderIdRef && mongoose.Types.ObjectId.isValid(orderIdRef)) {
      try {
        order = await Order.findById(orderIdRef).lean();
      } catch (err) {
        orderFetchError = err.message;
      }
    }

    // 3. Read Related Dispute Case (Read-only)
    if (caseIdRef && mongoose.Types.ObjectId.isValid(caseIdRef)) {
      try {
        disputeCase = await ReportAdmin.findById(caseIdRef).lean();
      } catch (err) {
        caseFetchError = err.message;
      }
    }

    // 4. Perform Read-Only Consistency Analysis
    const discrepancies = [];
    const evidence = [];
    let classification = "CONSISTENT_COMPLETED";
    let isSafeToRetry = false;
    let requiresManualReview = false;
    let recommendedAction = "";
    const nextSteps = [];

    // Dependency availability check
    if (orderFetchError || caseFetchError) {
      classification = "DEPENDENCY_UNAVAILABLE";
      requiresManualReview = true;
      isSafeToRetry = false;
      discrepancies.push(`Database error while fetching dependencies: ${orderFetchError || caseFetchError}`);
      evidence.push("One or more required database collections encountered query errors.");
      recommendedAction = "Do not attempt state repair. Ensure MongoDB health and re-run inspection.";
      nextSteps.push("Verify database connectivity and query execution metrics");
      nextSteps.push("Re-run read-only inspection once database dependencies are healthy");
    } else if (orderIdRef && !order) {
      classification = "ORPHANED_REFERENCE";
      requiresManualReview = true;
      isSafeToRetry = false;
      discrepancies.push(`Referenced order ${orderIdRef} does not exist in database (orphaned reference).`);
      evidence.push(`Audit record targets orderId ${orderIdRef}, but no document was found in orders collection.`);
      recommendedAction = "Verify if order was hard-deleted or if target identifier was recorded incorrectly.";
      nextSteps.push("Search application archive logs for referenced order ID");
      nextSteps.push("Confirm whether order was created in an uncommitted session");
    } else if (caseIdRef && !disputeCase) {
      classification = "ORPHANED_REFERENCE";
      requiresManualReview = true;
      isSafeToRetry = false;
      discrepancies.push(`Referenced dispute case ${caseIdRef} does not exist in database (orphaned reference).`);
      evidence.push(`Audit record references caseId ${caseIdRef}, but no report document was found.`);
      recommendedAction = "Verify report record history before modifying linked order.";
      nextSteps.push("Search reports collection for matching complaints by user/seller");
    } else if (auditLog.action === "PLACE_DISPUTE_HOLD") {
      // Analyze PLACE_DISPUTE_HOLD operation
      evidence.push(`Audit action is PLACE_DISPUTE_HOLD with recorded outcome: ${auditLog.outcome}.`);

      if (order && disputeCase) {
        let hasConflict = false;

        // Cross-reference verification
        const caseRefOrder = disputeCase.orderId?.trim();
        if (caseRefOrder && caseRefOrder !== order._id.toString()) {
          discrepancies.push(`Dispute case references orderId ${caseRefOrder}, but audit log targets orderId ${order._id.toString()}.`);
          classification = "CONFLICTING_AMBIGUOUS_STATE";
          requiresManualReview = true;
          hasConflict = true;
        } else {
          evidence.push("Dispute case correctly cross-references the targeted order.");
        }

        const activeHolds = (order.disputeHolds || []).filter((h) => h.status === "ACTIVE");
        const matchingActiveHold = (order.disputeHolds || []).find(
          (h) => (auditLog.metadata?.holdId ? h.holdId === auditLog.metadata.holdId : h.caseId?.toString() === disputeCase._id.toString() && h.status === "ACTIVE")
        );
        const matchingReleasedHold = (order.disputeHolds || []).find(
          (h) => (auditLog.metadata?.holdId ? h.holdId === auditLog.metadata.holdId : h.caseId?.toString() === disputeCase._id.toString() && h.status === "RELEASED")
        );

        // Verification of isDisputeHoldActive flag coherence
        const expectedFlag = activeHolds.length > 0;
        if (Boolean(order.isDisputeHoldActive) !== expectedFlag) {
          discrepancies.push(`Order isDisputeHoldActive (${order.isDisputeHoldActive}) disagrees with active holds count (${activeHolds.length}).`);
          classification = "CONFLICTING_AMBIGUOUS_STATE";
          requiresManualReview = true;
          hasConflict = true;
        } else {
          evidence.push(`Order isDisputeHoldActive flag (${order.isDisputeHoldActive}) agrees with active holds count (${activeHolds.length}).`);
        }

        if (auditLog.outcome === "SUCCESS") {
          if (!matchingActiveHold) {
            discrepancies.push("Audit log recorded SUCCESS, but no active hold exists for this case on the order.");
            classification = "CONFLICTING_AMBIGUOUS_STATE";
            requiresManualReview = true;
            recommendedAction = "Manual review required: Audit trail indicates hold placement succeeded, but order has no active hold.";
            nextSteps.push("Check if hold was subsequently released in a later audit log");
            nextSteps.push("Verify timeline of subsequent release operations on this order");
          } else {
            classification = "CONSISTENT_COMPLETED";
            evidence.push(`Active hold ${matchingActiveHold.holdId} is present on the order as intended.`);
            recommendedAction = "No action required: Operation is fully consistent and persisted.";
            nextSteps.push("Operation is healthy; dispute case remains under active administrative hold");
          }
        } else if (auditLog.outcome === "RECONCILIATION_REQUIRED") {
          classification = "CONFLICTING_AMBIGUOUS_STATE";
          requiresManualReview = true;
          discrepancies.push(`Operation flagged RECONCILIATION_REQUIRED: ${auditLog.failureReason || "Incomplete finalization/rollback"}`);

          if (matchingActiveHold) {
            evidence.push("Hold is currently ACTIVE on the order despite finalization or rollback failure.");
            recommendedAction = "Manual reconciliation required: Hold was placed on the order, but audit finalization failed. Do not execute automatic replay without confirming hold legitimacy.";
            nextSteps.push("Review administrative justification for the dispute hold");
            nextSteps.push("If hold is legitimate, authorized operator may re-run idempotent hold API to heal audit record");
          } else {
            evidence.push("No active hold exists on the order for this case.");
            recommendedAction = "Rollback succeeded or hold was never applied. Confirm if hold is still required.";
            nextSteps.push("If hold is required, submit a new dispute hold request with a fresh idempotencyKey");
          }
        } else if (auditLog.outcome === "PENDING") {
          const hasValidKey = Boolean(auditLog.idempotencyKey && typeof auditLog.idempotencyKey === "string" && auditLog.idempotencyKey.trim().length > 0);
          if (hasConflict) {
            isSafeToRetry = false;
            requiresManualReview = true;
            recommendedAction = "Manual review required: Pending audit has conflicting cross-references or order hold flag incoherence.";
            nextSteps.push("Resolve cross-reference or flag discrepancy before attempting recovery");
          } else if (matchingActiveHold) {
            classification = "APPLIED_AUDIT_INCOMPLETE";
            isSafeToRetry = hasValidKey;
            requiresManualReview = !hasValidKey;
            discrepancies.push("Hold was applied to the order, but audit record remained in PENDING state.");
            evidence.push("Order reflects active dispute hold, but audit log finalization was interrupted.");
            if (hasValidKey) {
              recommendedAction = "Safe to retry: Idempotent replay will detect applied hold and finalize audit record to SUCCESS.";
              nextSteps.push("Execute idempotent replay using the same idempotencyKey");
              nextSteps.push("Confirm audit record transitions to SUCCESS with recoveredFromAmbiguousState flag");
            } else {
              recommendedAction = "Manual reconciliation required: Hold was placed, but audit record lacks an idempotencyKey for safe retry.";
              nextSteps.push("Investigate why idempotencyKey is missing from audit record");
              nextSteps.push("Do not replay without key; manually reconcile order hold status");
            }
          } else {
            classification = "UNAPPLIED_AUDIT_INCOMPLETE";
            isSafeToRetry = hasValidKey;
            requiresManualReview = !hasValidKey;
            discrepancies.push("Audit record is PENDING and no hold was placed on the order.");
            evidence.push("Order disputeHolds contains no hold for this case.");
            if (hasValidKey) {
              recommendedAction = "Safe to retry: Process interrupted prior to order mutation. Request may be safely submitted.";
              nextSteps.push("Re-submit dispute hold request with original or new idempotencyKey");
            } else {
              recommendedAction = "Manual review required: Pending audit lacks an idempotencyKey for safe retry.";
              nextSteps.push("Generate new idempotencyKey and submit fresh dispute hold request if hold is still required");
            }
          }
        } else if (auditLog.outcome === "FAILED" || auditLog.outcome === "ROLLED_BACK") {
          if (matchingActiveHold) {
            discrepancies.push(`Audit outcome is ${auditLog.outcome}, but hold is ACTIVE on the order.`);
            classification = "CONFLICTING_AMBIGUOUS_STATE";
            requiresManualReview = true;
            recommendedAction = "Critical conflict: Audit indicates failure/rollback, yet hold is active on the order.";
            nextSteps.push("Investigate whether a separate operation placed this hold");
            nextSteps.push("Confirm whether order should remain held or be released");
          } else {
            classification = "CONSISTENT_COMPLETED";
            evidence.push(`Audit outcome is ${auditLog.outcome} and order contains no active hold.`);
            recommendedAction = "Operation terminated safely without leaving active holds.";
            nextSteps.push("No recovery action needed");
          }
        }
      }
    } else if (auditLog.action === "RELEASE_DISPUTE_HOLD") {
      // Analyze RELEASE_DISPUTE_HOLD operation
      evidence.push(`Audit action is RELEASE_DISPUTE_HOLD with recorded outcome: ${auditLog.outcome}.`);

      if (order && disputeCase) {
        let hasConflict = false;

        // Cross-reference verification
        const caseRefOrder = disputeCase.orderId?.trim();
        if (caseRefOrder && caseRefOrder !== order._id.toString()) {
          discrepancies.push(`Dispute case references orderId ${caseRefOrder}, but audit log targets orderId ${order._id.toString()}.`);
          classification = "CONFLICTING_AMBIGUOUS_STATE";
          requiresManualReview = true;
          hasConflict = true;
        } else {
          evidence.push("Dispute case correctly cross-references the targeted order.");
        }

        const activeHolds = (order.disputeHolds || []).filter((h) => h.status === "ACTIVE");
        const matchingActiveHold = (order.disputeHolds || []).find(
          (h) => (auditLog.metadata?.holdId ? h.holdId === auditLog.metadata.holdId : h.caseId?.toString() === disputeCase._id.toString() && h.status === "ACTIVE")
        );
        const matchingReleasedHold = (order.disputeHolds || []).find(
          (h) => (auditLog.metadata?.holdId ? h.holdId === auditLog.metadata.holdId : h.caseId?.toString() === disputeCase._id.toString() && h.status === "RELEASED")
        );

        // Verification of isDisputeHoldActive flag coherence
        const expectedFlag = activeHolds.length > 0;
        if (Boolean(order.isDisputeHoldActive) !== expectedFlag) {
          discrepancies.push(`Order isDisputeHoldActive (${order.isDisputeHoldActive}) disagrees with active holds count (${activeHolds.length}).`);
          classification = "CONFLICTING_AMBIGUOUS_STATE";
          requiresManualReview = true;
          hasConflict = true;
        }

        if (auditLog.outcome === "SUCCESS") {
          if (matchingActiveHold) {
            discrepancies.push("Audit log recorded SUCCESS for release, but hold is still ACTIVE on the order.");
            classification = "CONFLICTING_AMBIGUOUS_STATE";
            requiresManualReview = true;
            recommendedAction = "Discrepancy: Release was recorded as successful, but hold was not updated to RELEASED.";
            nextSteps.push("Verify if a subsequent hold was placed by another admin");
            nextSteps.push("Re-attempt hold release if dispute is resolved");
          } else {
            classification = "CONSISTENT_COMPLETED";
            evidence.push("Hold is marked RELEASED or absent from active holds on the order.");
            recommendedAction = "No action required: Hold release is fully consistent.";
            nextSteps.push("Operation is healthy");
          }
        } else if (auditLog.outcome === "RECONCILIATION_REQUIRED") {
          classification = "CONFLICTING_AMBIGUOUS_STATE";
          requiresManualReview = true;
          const hasValidKey = Boolean(auditLog.idempotencyKey && typeof auditLog.idempotencyKey === "string" && auditLog.idempotencyKey.trim().length > 0);
          discrepancies.push(`Release operation flagged RECONCILIATION_REQUIRED: ${auditLog.failureReason || "Finalization failed"}`);

          if (!hasConflict && matchingReleasedHold && !matchingActiveHold && hasValidKey) {
            evidence.push("Hold is RELEASED on the order, but audit finalization failed.");
            recommendedAction = "Hold was successfully released on the order. Idempotent replay will self-heal audit log.";
            isSafeToRetry = true;
            nextSteps.push("Execute idempotent release retry to synchronize audit record");
          } else {
            isSafeToRetry = false;
            evidence.push("Hold is still ACTIVE or in ambiguous state.");
            recommendedAction = "Manual review required: Release was not cleanly finalized.";
            nextSteps.push("Verify case resolution notes and re-attempt release if approved");
          }
        } else if (auditLog.outcome === "PENDING") {
          const hasValidKey = Boolean(auditLog.idempotencyKey && typeof auditLog.idempotencyKey === "string" && auditLog.idempotencyKey.trim().length > 0);
          if (hasConflict) {
            isSafeToRetry = false;
            requiresManualReview = true;
            recommendedAction = "Manual review required: Pending release audit has conflicting cross-references or flag incoherence.";
          } else if (matchingReleasedHold && !matchingActiveHold) {
            classification = "APPLIED_AUDIT_INCOMPLETE";
            isSafeToRetry = hasValidKey;
            requiresManualReview = !hasValidKey;
            discrepancies.push("Hold was released on the order, but audit record remained PENDING.");
            if (hasValidKey) {
              recommendedAction = "Safe to retry: Idempotent replay will detect released hold and finalize audit record.";
              nextSteps.push("Execute idempotent retry with original idempotencyKey");
            } else {
              recommendedAction = "Manual review required: Hold was released but audit record lacks idempotencyKey.";
            }
          } else {
            classification = "UNAPPLIED_AUDIT_INCOMPLETE";
            isSafeToRetry = hasValidKey;
            requiresManualReview = !hasValidKey;
            discrepancies.push("Release audit is PENDING and hold is still ACTIVE on order.");
            if (hasValidKey) {
              recommendedAction = "Safe to retry: Process interrupted prior to order release.";
              nextSteps.push("Re-submit release request if dispute is resolved");
            } else {
              recommendedAction = "Manual review required: Release audit lacks idempotencyKey.";
            }
          }
        }
      }
    } else {
      // General audit log action consistency check
      evidence.push(`Audit action ${auditLog.action} recorded outcome: ${auditLog.outcome}.`);
      const hasValidKey = Boolean(auditLog.idempotencyKey && typeof auditLog.idempotencyKey === "string" && auditLog.idempotencyKey.trim().length > 0);
      if (auditLog.outcome === "RECONCILIATION_REQUIRED") {
        classification = "CONFLICTING_AMBIGUOUS_STATE";
        requiresManualReview = true;
        isSafeToRetry = false;
        discrepancies.push(`Action flagged RECONCILIATION_REQUIRED: ${auditLog.failureReason || "Ambiguous failure"}`);
        recommendedAction = "Manual operator review required for non-hold administrative action.";
        nextSteps.push("Inspect target account history and administrative audit trail");
      } else if (auditLog.outcome === "PENDING") {
        classification = "UNAPPLIED_AUDIT_INCOMPLETE";
        isSafeToRetry = hasValidKey;
        requiresManualReview = !hasValidKey;
        discrepancies.push("Operation remained in PENDING state.");
        recommendedAction = hasValidKey
          ? "Verify if target account was modified before re-attempting action."
          : "Manual review required: Pending operation lacks idempotencyKey for safe replay.";
        nextSteps.push("Check target account status before re-attempting");
      } else {
        classification = "CONSISTENT_COMPLETED";
        isSafeToRetry = false;
        recommendedAction = "No action required: Operation completed.";
        nextSteps.push("No further triage required");
      }
    }

    // 5. Build Safe Normalized Response DTO
    const now = Date.now();
    const createdAtMs = auditLog.createdAt ? new Date(auditLog.createdAt).getTime() : now;
    const ageMs = Math.max(0, now - createdAtMs);
    const ageMinutes = Math.round(ageMs / 60000);

    return res.status(200).json({
      success: true,
      audit: {
        id: auditLog._id.toString(),
        action: auditLog.action,
        outcome: auditLog.outcome,
        reason: auditLog.reason,
        failureReason: auditLog.failureReason || "",
        idempotencyKey: auditLog.idempotencyKey || null,
        targetAccountId: auditLog.targetAccountId,
        targetAccountEmail: isEditor ? maskEmail(auditLog.targetAccountEmail) : auditLog.targetAccountEmail,
        targetAccountType: auditLog.targetAccountType,
        actingAdminEmail: isEditor ? maskEmail(auditLog.actingAdminEmail) : auditLog.actingAdminEmail,
        actingAdminRole: auditLog.actingAdminRole,
        beforeStatus: auditLog.beforeStatus,
        afterStatus: auditLog.afterStatus,
        createdAt: auditLog.createdAt ? new Date(auditLog.createdAt).toISOString() : null,
        completedAt: auditLog.completedAt ? new Date(auditLog.completedAt).toISOString() : null,
        ageMs,
        ageMinutes,
        metadata: {
          caseId: auditLog.metadata?.caseId || null,
          orderId: auditLog.metadata?.orderId || null,
          isDisputeHoldActiveBefore: auditLog.metadata?.isDisputeHoldActiveBefore ?? null,
          recoveredFromAmbiguousState: auditLog.metadata?.recoveredFromAmbiguousState ?? false,
        },
      },
      persistedState: {
        order: order
          ? {
              exists: true,
              id: order._id.toString(),
              status: order.status,
              finalPrice: order.finalPrice || order.highestBid || 0,
              userEmail: isEditor ? maskEmail(order.userEmail) : order.userEmail,
              sellerEmail: isEditor ? maskEmail(order.sellerEmail) : order.sellerEmail,
              isDisputeHoldActive: Boolean(order.isDisputeHoldActive),
              activeHoldsCount: (order.disputeHolds || []).filter((h) => h.status === "ACTIVE").length,
              disputeHolds: (order.disputeHolds || []).map((h) => ({
                holdId: h.holdId,
                caseId: h.caseId?.toString(),
                status: h.status,
                reason: h.reason,
                placedAt: h.placedAt ? new Date(h.placedAt).toISOString() : null,
                releasedAt: h.releasedAt ? new Date(h.releasedAt).toISOString() : null,
                placedBy: h.placedBy
                  ? {
                      adminEmail: isEditor ? maskEmail(h.placedBy.adminEmail) : h.placedBy.adminEmail,
                      role: h.placedBy.role,
                    }
                  : null,
                releasedBy: h.releasedBy
                  ? {
                      adminEmail: isEditor ? maskEmail(h.releasedBy.adminEmail) : h.releasedBy.adminEmail,
                      role: h.releasedBy.role,
                    }
                  : null,
              })),
            }
          : {
              exists: false,
              id: orderIdRef || null,
              error: orderFetchError || "Order not found in database",
            },
        disputeCase: disputeCase
          ? {
              exists: true,
              id: disputeCase._id.toString(),
              status: disputeCase.status,
              reportType: disputeCase.reportType,
              orderId: disputeCase.orderId || null,
              userEmail: isEditor ? maskEmail(disputeCase.userEmail) : disputeCase.userEmail,
              sellerEmail: isEditor ? maskEmail(disputeCase.sellerEmail) : disputeCase.sellerEmail,
              orderReferenceMatches:
                order && disputeCase.orderId ? disputeCase.orderId.trim() === order._id.toString() : false,
            }
          : {
              exists: false,
              id: caseIdRef || null,
              error: caseFetchError || "Dispute case not found in database",
            },
      },
      consistencyAnalysis: {
        classification,
        isSafeToRetry,
        requiresManualReview,
        summary:
          classification === "CONSISTENT_COMPLETED"
            ? "Authoritative database state is consistent with audit outcome."
            : classification === "APPLIED_AUDIT_INCOMPLETE"
            ? "Operation state was applied to database, but audit log finalization was interrupted."
            : classification === "UNAPPLIED_AUDIT_INCOMPLETE"
            ? "Audit operation is pending or incomplete; database state was not modified."
            : classification === "DEPENDENCY_UNAVAILABLE"
            ? "Database dependency query failure prevented inspection."
            : classification === "ORPHANED_REFERENCE"
            ? "Referenced document (order or dispute case) does not exist in authoritative storage."
            : "Ambiguous or conflicting state detected between audit record and live database state.",
        discrepancies,
        evidence,
        recommendedAction,
        nextSteps,
      },
    });
  } catch (error) {
    console.error("[AdminReconciliation] inspectOperation error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during consistency inspection",
    });
  }
};

module.exports = {
  getReconciliationSummary,
  getReconciliationOperations,
  inspectOperation,
};
