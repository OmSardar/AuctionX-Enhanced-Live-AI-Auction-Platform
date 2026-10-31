import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import {
  FaUserShield,
  FaSearch,
  FaFilter,
  FaBan,
  FaCheckCircle,
  FaHistory,
  FaArrowLeft,
  FaSync,
  FaEye,
  FaExclamationTriangle,
  FaUserTag,
  FaStore,
  FaGavel,
  FaBoxOpen,
  FaShoppingBag,
  FaCalendarAlt,
} from "react-icons/fa";

import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Skeleton } from "../../ui/Skeleton";
import { EmptyState } from "../../ui/EmptyState";
import { cn } from "../../../lib/utils";
import AdminDashboardShell from "../layouts/AdminDashboardShell";

const API_URL = import.meta.env.VITE_API_URL || "";
const DEFAULT_AVATAR = "/default-profile.png";

const AdminUsersPage = () => {
  const auth = useSelector((state) => state.auth);
  const currentAdminEmail = auth.user?.email || "";
  const currentAdminRole = auth.role || auth.user?.role || "admin";

  // Navigation tab: 'directory' | 'audit'
  const [activeTab, setActiveTab] = useState("directory");

  // Query state
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({ totalBuyers: 0, totalSellers: 0, totalAdmins: 0, activeCount: 0, suspendedCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // User detail inspection modal
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [detailActivity, setDetailActivity] = useState(null);
  const [detailAuditHistory, setDetailAuditHistory] = useState([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Status Action Modal (Suspend / Restore)
  const [actionTarget, setActionTarget] = useState(null);
  const [actionNewStatus, setActionNewStatus] = useState("Suspended");
  const [actionReason, setActionReason] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Global Audit Logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch directory data
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        accountType: accountTypeFilter,
        status: statusFilter,
        isVerified: verifiedFilter,
        sortBy,
        sortOrder,
      };

      const res = await axiosWithAuth.get(`${API_URL}/api/admin/users`, {
        params,
      });

      if (res.data.success) {
        setUsers(res.data.users || []);
        setPagination(res.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
        setSummary(res.data.summary || {});
      }
    } catch (err) {
      console.error("Failed to fetch admin users:", err);
      const msg = err.response?.data?.message || "Failed to load user accounts from database";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    debouncedSearch,
    accountTypeFilter,
    statusFilter,
    verifiedFilter,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    if (activeTab === "directory") {
      fetchUsers();
    }
  }, [fetchUsers, activeTab]);

  // Fetch Global Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    try {
      setIsLoadingAudit(true);
      const res = await axiosWithAuth.get(`${API_URL}/api/admin/users/audit-logs`, {
        params: {
          page: auditPagination.page,
          limit: auditPagination.limit,
          action: auditActionFilter,
          search: auditSearch,
        },
      });

      if (res.data.success) {
        setAuditLogs(res.data.auditLogs || []);
        setAuditPagination(res.data.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error("Failed to fetch audit history:", err);
      toast.error("Failed to load audit history");
    } finally {
      setIsLoadingAudit(false);
    }
  }, [auditPagination.page, auditPagination.limit, auditActionFilter, auditSearch]);

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs();
    }
  }, [fetchAuditLogs, activeTab]);

  // Fetch specific user details
  const openUserDetails = async (userId) => {
    try {
      setSelectedUserId(userId);
      setIsLoadingDetail(true);
      setDetailUser(null);
      setDetailActivity(null);
      setDetailAuditHistory([]);

      const res = await axiosWithAuth.get(`${API_URL}/api/admin/users/${userId}`);

      if (res.data.success) {
        setDetailUser(res.data.user);
        setDetailActivity(res.data.activityStats || {});
        setDetailAuditHistory(res.data.auditHistory || []);
      }
    } catch (err) {
      console.error("Failed to fetch account details:", err);
      toast.error(err.response?.data?.message || "Failed to load user details");
      setSelectedUserId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Open status change confirmation dialog
  const initiateStatusAction = (user, targetStatus) => {
    setActionTarget(user);
    setActionNewStatus(targetStatus);
    setActionReason("");
  };

  // Submit status update
  const handleConfirmStatusChange = async () => {
    if (!actionTarget) return;

    if (!actionReason || actionReason.trim().length < 5) {
      toast.error("Please provide a valid administrative reason (at least 5 characters).");
      return;
    }

    try {
      setIsSubmittingAction(true);
      const idempotencyKey = `ui_${actionTarget.id}_${actionNewStatus}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const res = await axiosWithAuth.patch(
        `${API_URL}/api/admin/users/${actionTarget.id}/status`,
        {
          status: actionNewStatus,
          reason: actionReason.trim(),
          idempotencyKey,
        }
      );

      if (res.data.success) {
        toast.success(res.data.message || `Account successfully ${actionNewStatus.toLowerCase()}`);
        setActionTarget(null);
        fetchUsers();

        // Refresh detail view if open
        if (selectedUserId === actionTarget.id) {
          openUserDetails(actionTarget.id);
        }
      }
    } catch (err) {
      console.error("Failed to change account status:", err);
      const msg = err.response?.data?.message || "Action failed due to server error";
      toast.error(msg);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "Active":
        return <Badge variant="success">Active</Badge>;
      case "Suspended":
        return <Badge variant="danger">Suspended</Badge>;
      case "Flagged":
        return <Badge variant="warning">Flagged</Badge>;
      default:
        return <Badge variant="default">{status || "Unknown"}</Badge>;
    }
  };

  const getRoleBadge = (role, accountType) => {
    if (role === "super-admin" || role === "admin" || accountType === "admin") {
      return (
        <Badge variant="gold" className="uppercase text-[10px] font-bold">
          {role || "Admin"}
        </Badge>
      );
    }
    if (accountType === "seller" || role === "seller") {
      return (
        <Badge variant="secondary" className="capitalize text-[11px]">
          Seller
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="capitalize text-[11px]">
        Buyer
      </Badge>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AdminDashboardShell>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-muted hover:text-action-primary transition-colors"
            >
              <FaArrowLeft className="w-3 h-3" />
              <span>Back to Telemetry Console</span>
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <FaUserShield className="w-7 h-7 text-action-primary" />
            <span>User Management & Account Governance</span>
          </h1>
          <p className="text-sm text-foreground-muted mt-1">
            Search real platform accounts, inspect verification states, manage account restrictions, and audit governance actions.
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-surface border border-border-subtle p-1 rounded-xl shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("directory")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2",
              activeTab === "directory"
                ? "bg-action-primary text-white shadow-xs"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-subtle"
            )}
          >
            <FaUserTag className="w-3.5 h-3.5" />
            <span>Directory</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2",
              activeTab === "audit"
                ? "bg-action-primary text-white shadow-xs"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-subtle"
            )}
          >
            <FaHistory className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>
        </div>
      </div>

      {/* Top Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-xs">
          <span className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
            Total Buyers
          </span>
          <span className="text-2xl font-bold text-foreground mt-1 block">
            {summary.totalBuyers ?? "—"}
          </span>
        </div>
        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-xs">
          <span className="block text-xs font-medium uppercase tracking-wider text-foreground-muted">
            Total Sellers
          </span>
          <span className="text-2xl font-bold text-foreground mt-1 block">
            {summary.totalSellers ?? "—"}
          </span>
        </div>
        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-xs">
          <span className="block text-xs font-medium uppercase tracking-wider text-status-success">
            Active Accounts
          </span>
          <span className="text-2xl font-bold text-foreground mt-1 block">
            {summary.activeCount ?? "—"}
          </span>
        </div>
        <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-xs">
          <span className="block text-xs font-medium uppercase tracking-wider text-status-error">
            Suspended
          </span>
          <span className="text-2xl font-bold text-foreground mt-1 block">
            {summary.suspendedCount ?? "—"}
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* DIRECTORY VIEW */}
      {/* ========================================================= */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted w-4 h-4 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email address..."
                className="w-full pl-9 pr-4 py-2 bg-surface-subtle border border-border-default rounded-lg text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring-focus"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground-muted hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Account Type */}
              <select
                value={accountTypeFilter}
                onChange={(e) => {
                  setAccountTypeFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="bg-surface-subtle border border-border-default rounded-lg px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring-focus cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="buyer">Buyers Only</option>
                <option value="seller">Sellers Only</option>
                <option value="admin">Administrators</option>
              </select>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="bg-surface-subtle border border-border-default rounded-lg px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring-focus cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Flagged">Flagged</option>
              </select>

              {/* Verification */}
              <select
                value={verifiedFilter}
                onChange={(e) => {
                  setVerifiedFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="bg-surface-subtle border border-border-default rounded-lg px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring-focus cursor-pointer"
              >
                <option value="all">All Verifications</option>
                <option value="true">Verified</option>
                <option value="false">Unverified</option>
              </select>

              {/* Sort Order */}
              <select
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split(":");
                  setSortBy(field);
                  setSortOrder(dir);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="bg-surface-subtle border border-border-default rounded-lg px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring-focus cursor-pointer"
              >
                <option value="createdAt:desc">Newest First</option>
                <option value="createdAt:asc">Oldest First</option>
                <option value="name:asc">Name (A-Z)</option>
                <option value="name:desc">Name (Z-A)</option>
                <option value="status:asc">Status</option>
              </select>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchUsers}
                disabled={isLoading}
                leftIcon={<FaSync className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-status-error-bg border border-status-error/30 rounded-xl p-4 flex items-center justify-between text-status-error">
              <div className="flex items-center gap-2">
                <FaExclamationTriangle className="w-5 h-5 shrink-0" />
                <span className="text-sm font-semibold">{error}</span>
              </div>
              <Button variant="outline" size="xs" onClick={fetchUsers}>
                Retry
              </Button>
            </div>
          )}

          {/* Main User Table / List */}
          <div className="bg-surface border border-border-subtle rounded-xl shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-8 w-20 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  title="No accounts match your criteria"
                  description="Try adjusting your search terms, clearing active filters, or checking back later."
                  action={
                    (searchQuery || accountTypeFilter !== "all" || statusFilter !== "all" || verifiedFilter !== "all") && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSearchQuery("");
                          setAccountTypeFilter("all");
                          setStatusFilter("all");
                          setVerifiedFilter("all");
                        }}
                      >
                        Clear All Filters
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-subtle/50 text-[11px] font-semibold text-foreground-muted uppercase tracking-wider">
                      <th className="py-3 px-4">Account Holder</th>
                      <th className="py-3 px-4">Type / Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Verification</th>
                      <th className="py-3 px-4">Registered</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-sm">
                    {users.map((u) => {
                      const isSelf =
                        u.email?.toLowerCase() === currentAdminEmail.toLowerCase();
                      const isTargetAdmin =
                        u.role === "admin" || u.role === "super-admin" || u.accountType === "admin";
                      const canManageTarget =
                        currentAdminRole === "super-admin" || !isTargetAdmin;

                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-surface-subtle/40 transition-colors"
                        >
                          {/* User Column */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={u.avatar || DEFAULT_AVATAR}
                                alt={u.name}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.src = DEFAULT_AVATAR;
                                }}
                                className="w-9 h-9 rounded-full object-cover border border-border-subtle shrink-0 bg-surface-subtle"
                              />
                              <div className="min-w-0">
                                <span className="font-semibold text-foreground block truncate">
                                  {u.name}
                                  {isSelf && (
                                    <span className="ml-1.5 text-[10px] bg-action-primary/10 text-action-primary px-1.5 py-0.5 rounded-full font-bold">
                                      You
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs text-foreground-muted block truncate">
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Type / Role */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              {getRoleBadge(u.role, u.accountType)}
                              {u.storeName && (
                                <span className="text-[11px] text-foreground-muted flex items-center gap-1">
                                  <FaStore className="w-2.5 h-2.5" />
                                  <span className="truncate max-w-[120px]">{u.storeName}</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              {getStatusBadge(u.status)}
                              {u.status === "Suspended" && u.suspensionReason && (
                                <span className="text-[10px] text-status-error block truncate max-w-[140px]" title={u.suspensionReason}>
                                  {u.suspensionReason}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Verification */}
                          <td className="py-3 px-4">
                            {u.isVerified ? (
                              <span className="inline-flex items-center gap-1 text-xs text-status-success font-medium">
                                <FaCheckCircle className="w-3.5 h-3.5" />
                                <span>Verified</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-foreground-muted font-medium">
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          {/* Registered Date */}
                          <td className="py-3 px-4 text-xs text-foreground-muted whitespace-nowrap">
                            {formatDate(u.createdAt)}
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => openUserDetails(u.id)}
                                leftIcon={<FaEye className="w-3 h-3" />}
                              >
                                Details
                              </Button>

                              {/* Status Toggle Action: Suspend / Restore */}
                              {currentAdminRole !== "editor" && !isSelf && canManageTarget && (
                                u.status === "Suspended" ? (
                                  <Button
                                    variant="success"
                                    size="xs"
                                    onClick={() => initiateStatusAction(u, "Active")}
                                  >
                                    Restore
                                  </Button>
                                ) : (
                                  <Button
                                    variant="danger"
                                    size="xs"
                                    onClick={() => initiateStatusAction(u, "Suspended")}
                                  >
                                    Suspend
                                  </Button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.total > 0 && (
              <div className="border-t border-border-subtle p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-foreground-muted">
                <div>
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-foreground">{pagination.total}</span>{" "}
                  accounts
                </div>

                <div className="inline-flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={pagination.page <= 1 || isLoading}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  >
                    Previous
                  </Button>
                  <span className="px-2 font-medium text-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={pagination.page >= pagination.totalPages || isLoading}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* GLOBAL AUDIT TRAIL VIEW */}
      {/* ========================================================= */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted w-4 h-4 pointer-events-none" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search audit trail by admin, target, or reason..."
                className="w-full pl-9 pr-4 py-2 bg-surface-subtle border border-border-default rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring-focus"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="bg-surface-subtle border border-border-default rounded-lg px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring-focus cursor-pointer"
              >
                <option value="all">All Actions</option>
                <option value="SUSPEND_ACCOUNT">Suspensions</option>
                <option value="RESTORE_ACCOUNT">Restorations</option>
                <option value="FLAG_ACCOUNT">Flags</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchAuditLogs}
                disabled={isLoadingAudit}
                leftIcon={<FaSync className={cn("w-3.5 h-3.5", isLoadingAudit && "animate-spin")} />}
              >
                Refresh
              </Button>
            </div>
          </div>

          <div className="bg-surface border border-border-subtle rounded-xl shadow-xs overflow-hidden">
            {isLoadingAudit ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  title="No audit entries recorded"
                  description="Administrative account actions (such as suspensions and restorations) will appear in this immutable event log."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-subtle/50 text-[11px] font-semibold text-foreground-muted uppercase tracking-wider">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Acting Administrator</th>
                      <th className="py-3 px-4">Target Account</th>
                      <th className="py-3 px-4">Transition</th>
                      <th className="py-3 px-4">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-sm">
                    {auditLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-surface-subtle/40 transition-colors">
                        <td className="py-3 px-4 text-xs text-foreground-muted whitespace-nowrap">
                          {formatDate(log.createdAt)} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              log.action === "SUSPEND_ACCOUNT"
                                ? "danger"
                                : log.action === "RESTORE_ACCOUNT"
                                ? "success"
                                : "info"
                            }
                            size="xs"
                          >
                            {log.action}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-foreground text-xs block">
                            {log.actingAdminEmail}
                          </span>
                          <span className="text-[10px] text-foreground-muted block">
                            Role: {log.actingAdminRole} ({log.actingAdminModel})
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-foreground text-xs block">
                            {log.targetAccountEmail}
                          </span>
                          <span className="text-[10px] text-foreground-muted block">
                            Type: {log.targetAccountType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono">
                          <span className="text-foreground-muted">{log.beforeStatus || "Active"}</span>
                          <span className="mx-1 text-action-primary">&rarr;</span>
                          <span className="font-bold text-foreground">{log.afterStatus}</span>
                        </td>
                        <td className="py-3 px-4 text-xs text-foreground max-w-xs truncate" title={log.reason}>
                          {log.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ACCOUNT DETAILS MODAL */}
      {/* ========================================================= */}
      <Dialog
        isOpen={Boolean(selectedUserId)}
        onClose={() => setSelectedUserId(null)}
        title="Account Inspection & Telemetry"
        description="Detailed record verification, activity statistics, and user-specific audit trail."
        size="lg"
      >
        {isLoadingDetail || !detailUser ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : (
          <div
            className="p-6 space-y-6 max-h-[75vh] overflow-y-auto overscroll-contain"
            data-lenis-prevent="true"
          >
            {/* Header info */}
            <div className="flex items-center gap-4 border-b border-border-subtle pb-5">
              <img
                src={detailUser.avatar || DEFAULT_AVATAR}
                alt={detailUser.name}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR;
                }}
                className="w-16 h-16 rounded-full object-cover border-2 border-border-default shadow-xs shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-foreground">{detailUser.name}</h3>
                  {getStatusBadge(detailUser.status)}
                  {getRoleBadge(detailUser.role, detailUser.accountType)}
                </div>
                <p className="text-sm text-foreground-muted mt-0.5">{detailUser.email}</p>
                <p className="text-xs text-foreground-muted mt-1">
                  ID: <code className="font-mono text-[11px] bg-surface-subtle px-1 py-0.5 rounded">{detailUser.id}</code>
                </p>
              </div>
            </div>

            {/* Suspended alert if applicable */}
            {detailUser.status === "Suspended" && (
              <div className="bg-status-error-bg border border-status-error/30 rounded-xl p-4 text-status-error space-y-1">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <FaBan className="w-4 h-4" />
                  <span>Account Currently Suspended</span>
                </div>
                <p className="text-xs">
                  <strong>Reason:</strong> {detailUser.suspensionReason || "Administrative restriction"}
                </p>
                {detailUser.statusChangedBy && (
                  <p className="text-[11px] text-foreground-muted">
                    Suspended by: {detailUser.statusChangedBy} on {formatDate(detailUser.statusChangedAt)}
                  </p>
                )}
              </div>
            )}

            {/* Operational Activity Counters */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-3">
                Persisted Platform Activity
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-subtle border border-border-subtle rounded-xl p-3 text-center">
                  <FaGavel className="w-5 h-5 text-action-primary mx-auto mb-1" />
                  <span className="text-lg font-bold text-foreground block">
                    {detailActivity?.bidsPlaced ?? 0}
                  </span>
                  <span className="text-[11px] text-foreground-muted">Bids Placed</span>
                </div>
                <div className="bg-surface-subtle border border-border-subtle rounded-xl p-3 text-center">
                  <FaBoxOpen className="w-5 h-5 text-brand-gold mx-auto mb-1" />
                  <span className="text-lg font-bold text-foreground block">
                    {detailActivity?.productsListed ?? 0}
                  </span>
                  <span className="text-[11px] text-foreground-muted">Listed Products</span>
                </div>
                <div className="bg-surface-subtle border border-border-subtle rounded-xl p-3 text-center">
                  <FaShoppingBag className="w-5 h-5 text-status-success mx-auto mb-1" />
                  <span className="text-lg font-bold text-foreground block">
                    {detailActivity?.ordersCompleted ?? 0}
                  </span>
                  <span className="text-[11px] text-foreground-muted">Orders</span>
                </div>
              </div>
            </div>

            {/* Account Details Field Grid */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-3">
                Profile Information
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs bg-surface-subtle p-4 rounded-xl border border-border-subtle">
                <div>
                  <span className="text-foreground-muted block">Phone Number:</span>
                  <span className="font-semibold text-foreground">{detailUser.phoneNo || "Not provided"}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block">Country / City:</span>
                  <span className="font-semibold text-foreground">
                    {[detailUser.city, detailUser.country].filter(Boolean).join(", ") || "Not provided"}
                  </span>
                </div>
                {detailUser.storeName && (
                  <div>
                    <span className="text-foreground-muted block">Store Name:</span>
                    <span className="font-semibold text-foreground">{detailUser.storeName}</span>
                  </div>
                )}
                <div>
                  <span className="text-foreground-muted block">Member Since:</span>
                  <span className="font-semibold text-foreground">{formatDate(detailUser.createdAt)}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block">Email Verified:</span>
                  <span className="font-semibold text-foreground">
                    {detailUser.isVerified ? "Yes (Verified)" : "No (Unverified)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Account-Specific Audit History */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-3">
                Governance Audit Trail (This Account)
              </h4>
              {detailAuditHistory.length === 0 ? (
                <p className="text-xs text-foreground-muted bg-surface-subtle p-3 rounded-lg border border-border-subtle">
                  No prior administrative interventions recorded for this account.
                </p>
              ) : (
                <div className="space-y-2">
                  {detailAuditHistory.map((item) => (
                    <div
                      key={item._id}
                      className="p-3 bg-surface-subtle border border-border-subtle rounded-lg text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={item.action === "SUSPEND_ACCOUNT" ? "danger" : "success"}
                          size="xs"
                        >
                          {item.action}
                        </Badge>
                        <span className="text-[11px] text-foreground-muted">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-foreground">
                        <strong>Reason:</strong> {item.reason}
                      </p>
                      <p className="text-[11px] text-foreground-muted">
                        Acting Admin: {item.actingAdminEmail} ({item.actingAdminRole})
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="border-t border-border-subtle pt-4 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setSelectedUserId(null)}>
                Close
              </Button>

              {currentAdminRole !== "editor" &&
                detailUser.email?.toLowerCase() !== currentAdminEmail.toLowerCase() && (
                  detailUser.status === "Suspended" ? (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => {
                        setSelectedUserId(null);
                        initiateStatusAction(detailUser, "Active");
                      }}
                    >
                      Restore Account
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setSelectedUserId(null);
                        initiateStatusAction(detailUser, "Suspended");
                      }}
                    >
                      Suspend Account
                    </Button>
                  )
                )}
            </div>
          </div>
        )}
      </Dialog>

      {/* ========================================================= */}
      {/* STATUS CONFIRMATION DIALOG */}
      {/* ========================================================= */}
      <Dialog
        isOpen={Boolean(actionTarget)}
        onClose={() => !isSubmittingAction && setActionTarget(null)}
        title={actionNewStatus === "Suspended" ? "Confirm Account Suspension" : "Confirm Account Restoration"}
        description={`You are about to change the status of ${actionTarget?.name || "this user"} to ${actionNewStatus}.`}
        size="md"
      >
        <div className="p-6 space-y-4">
          <div
            className={cn(
              "p-3.5 rounded-xl border text-xs leading-relaxed",
              actionNewStatus === "Suspended"
                ? "bg-status-error-bg border-status-error/30 text-status-error"
                : "bg-status-success-bg border-status-success/30 text-status-success"
            )}
          >
            {actionNewStatus === "Suspended" ? (
              <p>
                <strong>Warning:</strong> Suspending this account will block the user from authenticating, placing bids, listing products, or accessing account functions. This action will be logged in the permanent audit trail.
              </p>
            ) : (
              <p>
                <strong>Restoration:</strong> Restoring this account will reinstate normal platform privileges and remove the suspension flag. This action will be recorded in the audit log.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Administrative Reason <span className="text-status-error">*</span>
            </label>
            <textarea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder={
                actionNewStatus === "Suspended"
                  ? "e.g., Unpaid auction settlement after deadline; suspected shill bidding pattern."
                  : "e.g., Identity verification confirmed via support ticket #129; issue resolved."
              }
              className="w-full p-2.5 bg-surface-subtle border border-border-default rounded-lg text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring-focus resize-none"
            />
            <div className="flex justify-between items-center text-[11px] text-foreground-muted mt-1">
              <span>Minimum 5 characters required</span>
              <span>{actionReason.length} characters</span>
            </div>
          </div>

          <div className="border-t border-border-subtle pt-4 flex items-center justify-end gap-2.5">
            <Button
              variant="outline"
              size="sm"
              disabled={isSubmittingAction}
              onClick={() => setActionTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant={actionNewStatus === "Suspended" ? "danger" : "success"}
              size="sm"
              isLoading={isSubmittingAction}
              loadingText="Processing..."
              onClick={handleConfirmStatusChange}
              disabled={actionReason.trim().length < 5}
            >
              {actionNewStatus === "Suspended" ? "Confirm Suspension" : "Confirm Restoration"}
            </Button>
          </div>
        </div>
      </Dialog>
      </div>
    </AdminDashboardShell>
  );
};

export default AdminUsersPage;
