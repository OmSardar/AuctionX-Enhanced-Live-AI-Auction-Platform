const UserModel = require("../../../users/models/user");
const SellerModel = require("../../../sellers/accounts/models/seller");
const Admin = require("../../authentication/models/admin");
const AdminAuditLog = require("../../disputes/models/adminAuditLog");
const Product = require("../../../products/models/productSchema");
const Bid = require("../../../bidding/models/bidSchema");
const Order = require("../../../orders/models/orderSchema");
const crypto = require("crypto");

/**
 * Standardized sanitization helper to strip sensitive fields
 */
const sanitizeUserRecord = (doc, accountType) => {
  const plain = doc.toObject ? doc.toObject() : { ...doc };
  delete plain.password;
  delete plain.__v;

  const avatar =
    plain.selectedAvatar ||
    plain.googlePhoto ||
    (plain.profilePic && plain.profilePic[0]?.secure_url) ||
    plain.avatar ||
    "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

  return {
    id: (plain._id || plain.id).toString(),
    _id: (plain._id || plain.id).toString(),
    name: plain.name || `${plain.firstName || ""} ${plain.lastName || ""}`.trim() || "Unnamed",
    email: plain.email,
    accountType: accountType || (plain.role === "seller" ? "seller" : plain.role === "admin" ? "admin" : "buyer"),
    role: plain.role || (accountType === "seller" ? "seller" : "user"),
    status: plain.status || "Active",
    isVerified: Boolean(plain.isVerified),
    avatar,
    phoneNo: plain.phoneNo || plain.phone || "",
    city: plain.city || "",
    country: plain.country || "",
    storeName: plain.storeName || "",
    suspensionReason: plain.suspensionReason || "",
    statusChangedAt: plain.statusChangedAt || null,
    statusChangedBy: plain.statusChangedBy || null,
    createdAt: plain.createdAt || plain.joinDate || new Date(),
    updatedAt: plain.updatedAt || null,
  };
};

/**
 * GET /api/admin/users
 * Paginated directory of platform accounts with bounded pagination,
 * multi-attribute filtering, search, and safe sorting.
 */
const getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const {
      search = "",
      accountType = "all",
      status = "all",
      isVerified = "all",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Allowed sort fields to prevent projection or injection exploits
    const allowedSortFields = ["createdAt", "name", "email", "status"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder.toLowerCase() === "asc" ? 1 : -1;
    const sortOption = { [sortField]: sortDirection };

    // Build query filters for UserModel
    const userFilter = {};
    const sellerFilter = {};
    const adminFilter = {};

    if (search && search.trim()) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      userFilter.$or = [{ name: regex }, { email: regex }];
      sellerFilter.$or = [{ name: regex }, { email: regex }, { storeName: regex }];
      adminFilter.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
    }

    if (status && status !== "all") {
      userFilter.status = status;
      sellerFilter.status = status;
      adminFilter.status = status;
    }

    if (isVerified && isVerified !== "all") {
      const verifiedBool = isVerified === "true";
      userFilter.isVerified = verifiedBool;
      sellerFilter.isVerified = verifiedBool;
    }

    // Role differentiation
    if (accountType === "buyer") {
      userFilter.role = "user";
    } else if (accountType === "admin") {
      userFilter.role = "admin";
    }

    let records = [];
    let totalCount = 0;

    if (accountType === "buyer") {
      const [count, rawUsers] = await Promise.all([
        UserModel.countDocuments(userFilter),
        UserModel.find(userFilter)
          .select("-password")
          .sort(sortOption)
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);
      totalCount = count;
      records = rawUsers.map((u) => sanitizeUserRecord(u, "buyer"));
    } else if (accountType === "seller") {
      const [count, rawSellers] = await Promise.all([
        SellerModel.countDocuments(sellerFilter),
        SellerModel.find(sellerFilter)
          .select("-password")
          .sort(sortOption)
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);
      totalCount = count;
      records = rawSellers.map((s) => sanitizeUserRecord(s, "seller"));
    } else if (accountType === "admin") {
      const [count, rawAdmins] = await Promise.all([
        Admin.countDocuments(adminFilter),
        Admin.find(adminFilter)
          .select("-password")
          .sort(sortOption)
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);
      totalCount = count;
      records = rawAdmins.map((a) => sanitizeUserRecord(a, "admin"));
    } else {
      // Unified "all" directory query
      // Query both UserModel (buyers & admin roles) and SellerModel
      const [userCount, sellerCount] = await Promise.all([
        UserModel.countDocuments(userFilter),
        SellerModel.countDocuments(sellerFilter),
      ]);
      totalCount = userCount + sellerCount;

      // Fetch proportional slice from collections
      const [usersList, sellersList] = await Promise.all([
        UserModel.find(userFilter)
          .select("-password")
          .sort(sortOption)
          .limit(skip + limit)
          .lean(),
        SellerModel.find(sellerFilter)
          .select("-password")
          .sort(sortOption)
          .limit(skip + limit)
          .lean(),
      ]);

      const unified = [
        ...usersList.map((u) => sanitizeUserRecord(u, u.role === "admin" ? "admin" : "buyer")),
        ...sellersList.map((s) => sanitizeUserRecord(s, "seller")),
      ];

      // Sort unified pool accurately
      unified.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (sortField === "createdAt") {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        } else if (typeof valA === "string") {
          valA = valA.toLowerCase();
          valB = (valB || "").toLowerCase();
        }
        if (valA < valB) return -1 * sortDirection;
        if (valA > valB) return 1 * sortDirection;
        return 0;
      });

      records = unified.slice(skip, skip + limit);
    }

    // High-level summary metrics
    const [totalBuyers, totalSellers, totalAdmins, activeUsers, suspendedUsers] = await Promise.all([
      UserModel.countDocuments({ role: "user" }),
      SellerModel.countDocuments(),
      Admin.countDocuments(),
      UserModel.countDocuments({ status: "Active" }),
      UserModel.countDocuments({ status: "Suspended" }),
    ]);

    return res.status(200).json({
      success: true,
      users: records,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
        hasMore: page * limit < totalCount,
      },
      summary: {
        totalBuyers,
        totalSellers,
        totalAdmins,
        activeCount: activeUsers,
        suspendedCount: suspendedUsers,
      },
    });
  } catch (error) {
    console.error("Admin user directory error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching user directory",
    });
  }
};

/**
 * GET /api/admin/users/:id
 * Retrieve comprehensive administrative details for a specific account.
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    let targetDoc = null;
    let targetType = "buyer";

    // 1. Search in UserModel
    targetDoc = await UserModel.findById(id).select("-password").lean();
    if (targetDoc) {
      targetType = targetDoc.role === "admin" ? "admin" : "buyer";
    }

    // 2. Search in SellerModel if not found
    if (!targetDoc) {
      targetDoc = await SellerModel.findById(id).select("-password").lean();
      if (targetDoc) {
        targetType = "seller";
      }
    }

    // 3. Search in Admin if not found
    if (!targetDoc) {
      targetDoc = await Admin.findById(id).select("-password").lean();
      if (targetDoc) {
        targetType = "admin";
      }
    }

    if (!targetDoc) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    const sanitized = sanitizeUserRecord(targetDoc, targetType);

    // 4. Gather related activity statistics using safe, efficient queries
    const [bidsCount, productsCount, ordersCount, recentAuditLogs] = await Promise.all([
      Bid ? Bid.countDocuments({ $or: [{ bidderId: targetDoc._id }, { userEmail: targetDoc.email }] }).catch(() => 0) : 0,
      Product ? Product.countDocuments({ email: targetDoc.email }).catch(() => 0) : 0,
      Order ? Order.countDocuments({ $or: [{ userEmail: targetDoc.email }, { buyerId: targetDoc._id }] }).catch(() => 0) : 0,
      AdminAuditLog.find({ targetAccountId: id }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    return res.status(200).json({
      success: true,
      user: sanitized,
      activityStats: {
        bidsPlaced: bidsCount,
        productsListed: productsCount,
        ordersCompleted: ordersCount,
      },
      auditHistory: recentAuditLogs,
    });
  } catch (error) {
    console.error("Admin user details lookup error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching account details",
    });
  }
};

/**
 * PATCH /api/admin/users/:id/status
 * Admin governance action to alter account status (e.g. Suspend or Restore).
 * Enforces permission tiers, self-lockout prevention, and reliable audit logging.
 *
 * Consistency Strategy (Standalone MongoDB non-replica set):
 * 1. Idempotency Check: Verifies whether an operation with `idempotencyKey` was already executed.
 *    If previously completed with outcome='SUCCESS', returns cached success without duplicate audit logging.
 * 2. Intent Phase: Records an AdminAuditLog intent with outcome='PENDING'. If intent initialization fails,
 *    the account document is untouched and 500 error returned immediately.
 * 3. Execution Phase: Updates target account document status. If account update fails, audit log is marked 'FAILED'.
 * 4. Finalization & Compensating Rollback: Finalizes audit log with outcome='SUCCESS' and completedAt.
 *    If audit finalization fails, a compensating rollback reverts the target account to its beforeStatus,
 *    marks audit log 'ROLLED_BACK', and returns a 500 error (never returns 200 without a committed audit trail).
 */
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason, idempotencyKey } = req.body;

    // 1. Validate status input
    const validStatuses = ["Active", "Suspended", "Flagged"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // 2. Validate mandatory reason for status changes
    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "A meaningful reason (at least 5 characters) is required for administrative status actions",
      });
    }

    // 3. Permission checks on acting administrator
    const actingRole = req.role;
    if (actingRole === "editor") {
      return res.status(403).json({
        success: false,
        message: "Editor role is read-only. Status modifications are restricted to administrators.",
      });
    }

    // 4. Locate target document
    let target = null;
    let targetModelName = "User";
    let targetAccountType = "buyer";

    target = await UserModel.findById(id);
    if (target) {
      targetAccountType = target.role === "admin" ? "admin" : "buyer";
      targetModelName = "User";
    } else {
      target = await SellerModel.findById(id);
      if (target) {
        targetAccountType = "seller";
        targetModelName = "Seller";
      } else {
        target = await Admin.findById(id);
        if (target) {
          targetAccountType = "admin";
          targetModelName = "Admin";
        }
      }
    }

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Target account not found",
      });
    }

    // 5. Self-lockout prevention: Acting admin cannot suspend or flag their own account
    const actingAdminId = req.userId.toString();
    const targetId = (target._id || target.id).toString();
    const actingEmail = (req.adminEmail || "").toLowerCase();
    const targetEmail = (target.email || "").toLowerCase();

    if (actingAdminId === targetId || (actingEmail && actingEmail === targetEmail)) {
      return res.status(400).json({
        success: false,
        message: "Self-suspension is prohibited to prevent administrator lockout",
      });
    }

    // 6. Administrator target protection
    const isTargetAdmin = targetAccountType === "admin" || target.role === "admin" || target.role === "super-admin";
    if (isTargetAdmin) {
      // Only super-admin can modify another admin's status
      if (actingRole !== "super-admin") {
        return res.status(403).json({
          success: false,
          message: "Only super-administrators can suspend or modify administrator accounts",
        });
      }

      // Check for last super-admin protection if target is super-admin
      if (target.role === "super-admin" && status !== "Active") {
        const otherSuperAdmins = await Admin.countDocuments({
          role: "super-admin",
          status: "Active",
          _id: { $ne: target._id },
        });

        if (otherSuperAdmins === 0) {
          return res.status(400).json({
            success: false,
            message: "Cannot suspend or restrict the last active super-administrator",
          });
        }
      }
    }

    // 7. Idempotency Key Determination
    const opKey =
      idempotencyKey ||
      req.headers["x-idempotency-key"] ||
      `admin-status-${actingAdminId}-${targetId}-${status}-${crypto
        .createHash("sha256")
        .update(reason.trim())
        .digest("hex")
        .slice(0, 16)}`;

    // Check for an existing audit log with this idempotency key
    let existingAudit = await AdminAuditLog.findOne({ idempotencyKey: opKey });
    if (existingAudit) {
      if (existingAudit.outcome === "SUCCESS") {
        // Idempotent replay: Action was already successfully committed and audited
        const sanitized = sanitizeUserRecord(target, targetAccountType);
        return res.status(200).json({
          success: true,
          message: `Account status already updated to ${status} (idempotent replay)`,
          user: sanitized,
          auditLog: existingAudit,
          isReplay: true,
        });
      }
    }

    const beforeStatus = target.status || "Active";
    const beforeReason = target.suspensionReason || "";

    // 8. Phase 1 — Record Operation Intent in AdminAuditLog
    let auditLog = existingAudit;
    if (!auditLog) {
      try {
        auditLog = new AdminAuditLog({
          idempotencyKey: opKey,
          actingAdminId,
          actingAdminEmail: req.adminEmail || "unknown",
          actingAdminModel: req.adminModel || "Admin",
          actingAdminRole: actingRole,
          targetAccountId: targetId,
          targetAccountEmail: target.email,
          targetAccountType,
          action: status === "Suspended" ? "SUSPEND_ACCOUNT" : status === "Active" ? "RESTORE_ACCOUNT" : "FLAG_ACCOUNT",
          reason: reason.trim(),
          beforeStatus,
          afterStatus: status,
          outcome: "PENDING",
          ipAddress: req.ip || req.connection?.remoteAddress || "",
          userAgent: req.headers["user-agent"] || "",
        });
        await auditLog.save();
      } catch (intentErr) {
        console.error("Critical: Failed to record administrative audit intent:", intentErr);
        return res.status(500).json({
          success: false,
          message: "Failed to initialize administrative audit record. Account was not modified.",
        });
      }
    }

    // 9. Phase 2 — Perform soft status update on target document
    try {
      target.status = status;
      target.suspensionReason = status === "Suspended" ? reason.trim() : "";
      target.statusChangedAt = new Date();
      target.statusChangedBy = req.adminEmail || actingAdminId;
      await target.save();
    } catch (targetErr) {
      console.error("Critical: Failed to update target document:", targetErr);
      // Mark audit intent as failed
      auditLog.outcome = "FAILED";
      auditLog.failureReason = targetErr.message;
      auditLog.completedAt = new Date();
      await auditLog.save().catch(() => {});
      return res.status(500).json({
        success: false,
        message: `Failed to update account status: ${targetErr.message}`,
      });
    }

    // 10. Phase 3 — Finalize audit log (mark SUCCESS) or execute Compensating Rollback
    try {
      auditLog.outcome = "SUCCESS";
      auditLog.completedAt = new Date();
      await auditLog.save();
    } catch (auditFinalizeErr) {
      console.error("Critical: Audit finalization failed, executing compensating rollback on target account:", auditFinalizeErr);
      try {
        target.status = beforeStatus;
        target.suspensionReason = beforeReason;
        target.statusChangedAt = new Date();
        target.statusChangedBy = `ROLLBACK: ${req.adminEmail || actingAdminId}`;
        await target.save();

        auditLog.outcome = "ROLLED_BACK";
        auditLog.failureReason = `Audit finalization failed: ${auditFinalizeErr.message}. Target account rolled back to ${beforeStatus}`;
        auditLog.completedAt = new Date();
        await auditLog.save().catch(() => {});
      } catch (rollbackErr) {
        console.error("Fatal: Target account rollback failed after audit finalization failure:", rollbackErr);
      }

      return res.status(500).json({
        success: false,
        message: "Administrative action failed: audit trail could not be committed. Account change rolled back.",
      });
    }

    const sanitized = sanitizeUserRecord(target, targetAccountType);

    return res.status(200).json({
      success: true,
      message: `Account status successfully updated to ${status}`,
      user: sanitized,
      auditLog,
    });
  } catch (error) {
    console.error("Admin update user status error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error altering account status",
    });
  }
};

/**
 * GET /api/admin/users/:id/audit-logs
 * Retrieve audit history specific to an account.
 */
const getUserAuditLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      AdminAuditLog.countDocuments({ targetAccountId: id }),
      AdminAuditLog.find({ targetAccountId: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      auditLogs: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Admin fetch user audit logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching audit records",
    });
  }
};

/**
 * GET /api/admin/users/audit-logs
 * Global audit log feed for administrator account oversight.
 */
const getGlobalAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const { action, search } = req.query;
    const filter = {};

    if (action && action !== "all") {
      filter.action = action;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { targetAccountEmail: regex },
        { actingAdminEmail: regex },
        { reason: regex },
      ];
    }

    const [total, logs] = await Promise.all([
      AdminAuditLog.countDocuments(filter),
      AdminAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      auditLogs: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Admin global audit log error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching audit logs",
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  updateUserStatus,
  getUserAuditLogs,
  getGlobalAuditLogs,
};
