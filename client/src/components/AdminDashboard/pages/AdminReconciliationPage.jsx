import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import {
  FaShieldAlt,
  FaSearch,
  FaFilter,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaSync,
  FaEye,
  FaHistory,
  FaArrowLeft,
  FaInfoCircle,
  FaChevronLeft,
  FaChevronRight,
  FaLock,
  FaWrench,
  FaDatabase,
  FaClipboardList,
  FaExclamationCircle,
} from "react-icons/fa";

import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Skeleton } from "../../ui/Skeleton";
import { EmptyState } from "../../ui/EmptyState";
import { cn } from "../../../lib/utils";
import AdminDashboardShell from "../layouts/AdminDashboardShell";

const API_URL = import.meta.env.VITE_API_URL || "";

const formatDateTime = (dateString) => {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Invalid Date";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "N/A";
  }
};

const formatAge = (ageMs) => {
  if (!ageMs && ageMs !== 0) return "N/A";
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return "< 1m ago";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
};

const AdminReconciliationPage = () => {
  const auth = useSelector((state) => state.auth);
  const currentAdminRole = auth.role || auth.user?.role || "admin";
  const isEditor = currentAdminRole === "editor";

  // Telemetry & list state
  const [summary, setSummary] = useState({
    totalIssues: 0,
    reconciliationRequiredCount: 0,
    stalePendingCount: 0,
    totalPendingCount: 0,
    failedRollbackCount: 0,
    failedCount: 0,
    byAction: {},
  });
  const [operations, setOperations] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [ageMinutes, setAgeMinutes] = useState(5);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Deep inspection modal
  const [selectedAuditId, setSelectedAuditId] = useState(null);
  const [inspectionData, setInspectionData] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectError, setInspectError] = useState(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch telemetry summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await axiosWithAuth.get(`${API_URL}/api/admin/reconciliation/summary`, {
        params: { ageMinutes },
        withCredentials: true,
      });
      if (res.data?.success) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error("Failed to fetch reconciliation summary:", err);
    }
  }, [ageMinutes]);

  // Fetch paginated operations
  const fetchOperations = useCallback(
    async (pageToLoad = pagination.page) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await axiosWithAuth.get(`${API_URL}/api/admin/reconciliation/operations`, {
          params: {
            page: pageToLoad,
            limit: pagination.limit,
            outcome: outcomeFilter !== "ALL" ? outcomeFilter : undefined,
            action: actionFilter !== "ALL" ? actionFilter : undefined,
            category: categoryFilter !== "ALL" ? categoryFilter : undefined,
            search: debouncedSearch || undefined,
            ageMinutes,
            sortBy,
            sortOrder,
          },
          withCredentials: true,
        });

        if (res.data?.success) {
          setOperations(res.data.operations || []);
          setPagination(res.data.pagination);
        }
      } catch (err) {
        const msg = err.response?.data?.message || err.message || "Failed to load operations";
        setError(msg);
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [pagination.page, pagination.limit, outcomeFilter, actionFilter, categoryFilter, debouncedSearch, ageMinutes, sortBy, sortOrder]
  );

  // Fetch deep inspection for selected audit log
  const handleInspect = async (auditId) => {
    setSelectedAuditId(auditId);
    setInspectionData(null);
    setIsInspecting(true);
    setInspectError(null);

    try {
      const res = await axiosWithAuth.get(`${API_URL}/api/admin/reconciliation/operations/${auditId}/inspect`, {
        withCredentials: true,
      });
      if (res.data?.success) {
        setInspectionData(res.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to inspect operation";
      setInspectError(msg);
      toast.error(msg);
    } finally {
      setIsInspecting(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchOperations(1);
  }, [outcomeFilter, actionFilter, categoryFilter, debouncedSearch, ageMinutes, sortBy, sortOrder]);

  const handleRefresh = () => {
    fetchSummary();
    fetchOperations(pagination.page);
    toast.success("Reconciliation inventory refreshed");
  };

  const getOutcomeBadge = (outcome) => {
    switch (outcome) {
      case "RECONCILIATION_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/70 text-rose-300 border border-rose-500/50 shadow-sm animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            RECONCILIATION REQUIRED
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-500/40">
            <FaClock className="text-[10px]" /> PENDING
          </span>
        );
      case "SUCCESS":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
            <FaCheckCircle className="text-[10px]" /> SUCCESS
          </span>
        );
      case "ROLLED_BACK":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-500/40">
            <FaHistory className="text-[10px]" /> ROLLED BACK
          </span>
        );
      case "FAILED":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-subtle text-foreground border border-border-default">
            <FaTimesCircle className="text-[10px]" /> FAILED
          </span>
        );
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "CRITICAL":
        return <Badge variant="destructive" className="bg-rose-900/80 text-rose-200 border-rose-600 text-[10px]">CRITICAL</Badge>;
      case "HIGH":
        return <Badge variant="warning" className="bg-amber-900/80 text-amber-200 border-amber-600 text-[10px]">HIGH</Badge>;
      case "MEDIUM":
        return <Badge variant="secondary" className="bg-surface-subtle text-foreground border-border-default text-[10px]">MEDIUM</Badge>;
      default:
        return <Badge variant="outline" className="text-text-muted text-[10px]">LOW</Badge>;
    }
  };

  const getClassificationBadge = (classification) => {
    switch (classification) {
      case "CONSISTENT_COMPLETED":
        return (
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-500/40">
            Consistent & Completed
          </span>
        );
      case "APPLIED_AUDIT_INCOMPLETE":
        return (
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-950/70 text-cyan-300 border border-cyan-500/40">
            Applied to Order / Audit Incomplete
          </span>
        );
      case "UNAPPLIED_AUDIT_INCOMPLETE":
        return (
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-950/70 text-amber-300 border border-amber-500/40">
            Unapplied / Audit Incomplete
          </span>
        );
      case "DEPENDENCY_UNAVAILABLE":
        return (
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-purple-950/70 text-purple-300 border border-purple-500/40">
            Dependency Unavailable
          </span>
        );
      case "ORPHANED_REFERENCE":
        return (
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-orange-950/70 text-orange-300 border border-orange-500/40">
            Orphaned Reference (Missing Document)
          </span>
        );
      case "CONFLICTING_AMBIGUOUS_STATE":
      default:
        return (
          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-500/60 animate-pulse">
            Conflicting or Ambiguous State
          </span>
        );
    }
  };

  return (
    <AdminDashboardShell>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/disputes"
              className="p-2 rounded-lg bg-surface border border-border-default text-text-muted hover:text-foreground transition-colors"
              title="Return to Disputes Console"
            >
              <FaArrowLeft className="text-sm" />
            </Link>
            <div className="p-2 rounded-xl bg-gradient-to-tr from-rose-600/20 to-amber-600/20 border border-rose-500/30 text-rose-400">
              <FaShieldAlt className="text-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Operational Recovery & Reconciliation Console
                <Badge variant="outline" className="border-rose-500/40 text-rose-400 bg-rose-950/20 text-xs">
                  Stage 7.2
                </Badge>
              </h1>
              <p className="text-xs text-text-muted mt-1">
                Read-only investigation of incomplete administrative operations, dispute holds, and audit desyncs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="border-border-default bg-surface hover:bg-surface-subtle text-foreground text-xs gap-2"
          >
            <FaSync className={cn("text-xs", isLoading && "animate-spin")} />
            Refresh Inventory
          </Button>
          <Link to="/admin/disputes">
            <Button variant="secondary" className="border border-border-default bg-surface hover:bg-surface-subtle text-foreground text-xs gap-2">
              Disputes Directory
            </Button>
          </Link>
        </div>
      </div>

      {/* Role Notice */}
      {isEditor && (
        <div className="bg-amber-500/10 border border-amber-600/30 rounded-xl p-3 flex items-center gap-3 text-amber-200 text-xs">
          <FaLock className="text-amber-400 text-sm flex-shrink-0" />
          <div>
            <strong>Read-Only Editor Mode Active:</strong> Personally Identifiable Information (PII) is masked and
            state-altering actions are strictly disabled in accordance with governance policies.
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Reconciliation Required */}
        <div className="bg-surface border border-rose-900/40 rounded-xl p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Reconciliation Required</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <FaExclamationTriangle className="text-sm" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {summary.reconciliationRequiredCount}
          </div>
          <p className="text-[11px] text-rose-400 font-medium">
            Immediate operator review required
          </p>
        </div>

        {/* Card 2: Stale Pending */}
        <div className="bg-surface border border-amber-900/40 rounded-xl p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Stale Pending Operations</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <FaClock className="text-sm" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {summary.stalePendingCount}
          </div>
          <p className="text-[11px] text-amber-400 font-medium">
            Pending &gt; {summary.staleAgeMinutesThreshold || 5} min without finalization
          </p>
        </div>

        {/* Card 3: Failed Compensating Rollbacks */}
        <div className="bg-surface border border-purple-900/40 rounded-xl p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Failed Rollbacks</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <FaWrench className="text-sm" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {summary.failedRollbackCount}
          </div>
          <p className="text-[11px] text-purple-400 font-medium">
            Double-failure requiring manual state sync
          </p>
        </div>

        {/* Card 4: Total Issues Requiring Triage */}
        <div className="bg-surface border border-blue-900/40 rounded-xl p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Total Triage Queue</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <FaClipboardList className="text-sm" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {summary.totalIssues}
          </div>
          <p className="text-[11px] text-blue-400 font-medium">
            Across hold & administrative audits
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface border border-border-default rounded-xl p-4 space-y-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <FaSearch className="absolute left-3 top-3 text-text-muted text-xs" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Audit ID, Target ID, Admin Email, Reason, or Idempotency Key..."
              className="w-full pl-9 pr-4 py-2 bg-surface-subtle border border-border-default rounded-lg text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          {/* Outcome Filter */}
          <div>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-surface-subtle border border-border-default rounded-lg text-xs text-foreground focus:outline-none focus:border-rose-500 transition-colors"
            >
              <option value="ALL">All Outcomes</option>
              <option value="RECONCILIATION_REQUIRED">RECONCILIATION_REQUIRED</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
              <option value="ROLLED_BACK">ROLLED_BACK</option>
              <option value="SUCCESS">SUCCESS</option>
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 bg-surface-subtle border border-border-default rounded-lg text-xs text-foreground focus:outline-none focus:border-rose-500 transition-colors"
            >
              <option value="ALL">All Actions</option>
              <option value="PLACE_DISPUTE_HOLD">PLACE_DISPUTE_HOLD</option>
              <option value="RELEASE_DISPUTE_HOLD">RELEASE_DISPUTE_HOLD</option>
              <option value="ADD_INVESTIGATION_NOTE">ADD_INVESTIGATION_NOTE</option>
              <option value="SUSPEND_ACCOUNT">SUSPEND_ACCOUNT</option>
              <option value="RESTORE_ACCOUNT">RESTORE_ACCOUNT</option>
              <option value="RESOLVE_REPORT">RESOLVE_REPORT</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs text-text-muted gap-2 pt-2 border-t border-border-subtle">
          <div className="flex items-center gap-3">
            <span>Stale Age Threshold:</span>
            <select
              value={ageMinutes}
              onChange={(e) => setAgeMinutes(Number(e.target.value))}
              className="bg-surface-subtle border border-border-default rounded px-2 py-1 text-foreground text-xs"
            >
              <option value={1}>1 minute</option>
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={60}>1 hour</option>
            </select>
          </div>

          <div className="text-[11px] text-text-muted">
            Showing {operations.length} of {pagination.total} records requiring inspection
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface border border-border-default rounded-xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-full bg-surface-subtle" />
            <Skeleton className="h-12 w-full bg-surface-subtle" />
            <Skeleton className="h-12 w-full bg-surface-subtle" />
            <Skeleton className="h-12 w-full bg-surface-subtle" />
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <FaExclamationTriangle className="text-3xl text-rose-500 mx-auto" />
            <div className="text-sm font-semibold text-rose-300">{error}</div>
            <Button onClick={() => fetchOperations(1)} variant="outline" className="border-border-default text-xs">
              Retry Query
            </Button>
          </div>
        ) : operations.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FaCheckCircle className="text-4xl text-emerald-500/80 mx-auto mb-2" />
            <h3 className="text-base font-semibold text-foreground">No Inconsistencies Detected</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              All administrative operations match their expected database state. No stale pending records or
              reconciliation-required flags exist under current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle text-text-muted uppercase tracking-wider font-semibold border-b border-border-default">
                <tr>
                  <th className="py-3 px-4">Timestamp & Age</th>
                  <th className="py-3 px-4">Action & Priority</th>
                  <th className="py-3 px-4">Target Details</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Recorded Outcome</th>
                  <th className="py-3 px-4">Suggested Next Step</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle font-mono">
                {operations.map((op) => (
                  <tr
                    key={op.id}
                    className="hover:bg-surface-subtle transition-colors cursor-pointer"
                    onClick={() => handleInspect(op.id)}
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-foreground">{formatDateTime(op.createdAt)}</div>
                      <div className="text-[11px] text-text-muted">{formatAge(op.ageMs)}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-foreground">{op.action}</div>
                      <div className="mt-1">{getPriorityBadge(op.investigationPriority)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-foreground">
                        <span className="text-text-muted uppercase text-[10px] mr-1">{op.targetAccountType}:</span>
                        {op.targetAccountId}
                      </div>
                      {op.targetAccountEmail && (
                        <div className="text-[11px] text-text-muted truncate max-w-[180px]">
                          {op.targetAccountEmail}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-foreground">
                      <div>{op.actingAdminEmail}</div>
                      <div className="text-[10px] text-text-muted">{op.actingAdminRole}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getOutcomeBadge(op.outcome)}
                      {op.isStalePending && (
                        <div className="text-[10px] text-amber-400 mt-1 font-sans">Stale (&gt; {op.ageMinutes}m)</div>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs font-sans text-text-muted text-[11px] truncate" title={op.suggestedAction}>
                      {op.suggestedAction}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInspect(op.id);
                        }}
                        className="border border-border-default bg-surface hover:bg-surface-subtle text-foreground text-xs px-2.5 py-1"
                      >
                        <FaEye className="mr-1 text-[10px]" /> Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="p-3 border-t border-border-subtle bg-surface-subtle flex items-center justify-between text-xs text-text-muted">
            <div>
              Page {pagination.page} of {pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchOperations(pagination.page - 1)}
                className="border-border-default bg-surface hover:bg-surface-subtle text-foreground text-xs"
              >
                <FaChevronLeft className="mr-1 text-[10px]" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchOperations(pagination.page + 1)}
                className="border-border-default bg-surface hover:bg-surface-subtle text-foreground text-xs"
              >
                Next <FaChevronRight className="ml-1 text-[10px]" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Deep Consistency Inspection Modal */}
      {selectedAuditId && (
        <Dialog
          isOpen={Boolean(selectedAuditId)}
          onClose={() => setSelectedAuditId(null)}
          title="Authoritative Consistency Inspection"
          className="max-w-4xl bg-surface border-border-default text-foreground"
        >
          {isInspecting ? (
            <div className="p-8 space-y-4">
              <div className="flex items-center justify-center gap-3 text-text-muted">
                <FaSync className="animate-spin text-rose-500 text-xl" />
                <span>Performing read-only consistency audit against live MongoDB state...</span>
              </div>
              <Skeleton className="h-16 w-full bg-surface-subtle" />
              <Skeleton className="h-32 w-full bg-surface-subtle" />
            </div>
          ) : inspectError ? (
            <div className="p-6 text-center space-y-3">
              <FaExclamationTriangle className="text-3xl text-rose-500 mx-auto" />
              <div className="text-sm font-semibold text-rose-300">{inspectError}</div>
              <Button onClick={() => handleInspect(selectedAuditId)} variant="outline" className="border-border-default text-xs">
                Retry Inspection
              </Button>
            </div>
          ) : inspectionData ? (
            <div
              className="space-y-6 text-xs max-h-[75vh] overflow-y-auto overscroll-contain pr-1"
              data-lenis-prevent="true"
            >
              {/* Classification Banner */}
              <div className="bg-surface border border-border-default rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-1">
                    Consistency Analysis Classification
                  </div>
                  <div className="text-sm font-bold text-foreground flex items-center gap-2">
                    {getClassificationBadge(inspectionData.consistencyAnalysis.classification)}
                  </div>
                  <p className="text-text-muted mt-2 text-xs leading-relaxed">
                    {inspectionData.consistencyAnalysis.summary}
                  </p>
                </div>

                <div className="text-right space-y-1 sm:border-l sm:border-border-subtle sm:pl-4">
                  <div className="text-[11px] text-text-muted">Safe to Retry?</div>
                  <div>
                    {inspectionData.consistencyAnalysis.isSafeToRetry ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1 justify-end">
                        <FaCheckCircle /> YES (Idempotent)
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-1 justify-end">
                        <FaTimesCircle /> NO (Manual Review)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Read-Only Guarantee Notice */}
              <div className="bg-blue-950/20 border border-blue-500/30 rounded-lg p-2.5 flex items-center gap-2 text-blue-300 text-[11px]">
                <FaDatabase className="text-blue-400 flex-shrink-0" />
                <span>
                  <strong>Strict Zero-Mutation Guarantee:</strong> This analysis was performed via read-only queries.
                  No database documents or financial states were modified.
                </span>
              </div>

              {/* Grid: Audit Record vs Live Persisted State */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Audit Record */}
                <div className="bg-surface border border-border-default rounded-xl p-4 space-y-3 font-mono shadow-xs">
                  <div className="font-sans font-bold text-foreground border-b border-border-subtle pb-2 flex items-center gap-2">
                    <FaClipboardList className="text-text-muted" /> Recorded Audit Intent
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div>
                      <span className="text-text-muted">Log ID:</span> {inspectionData.audit.id}
                    </div>
                    <div>
                      <span className="text-text-muted">Action:</span> {inspectionData.audit.action}
                    </div>
                    <div>
                      <span className="text-text-muted">Outcome:</span> {inspectionData.audit.outcome}
                    </div>
                    <div>
                      <span className="text-text-muted">Actor:</span> {inspectionData.audit.actingAdminEmail} ({inspectionData.audit.actingAdminRole})
                    </div>
                    <div>
                      <span className="text-text-muted">Target Type:</span> {inspectionData.audit.targetAccountType} ({inspectionData.audit.targetAccountId})
                    </div>
                    {inspectionData.audit.idempotencyKey && (
                      <div className="truncate">
                        <span className="text-text-muted">Idempotency Key:</span> {inspectionData.audit.idempotencyKey}
                      </div>
                    )}
                    <div>
                      <span className="text-text-muted">Created:</span> {formatDateTime(inspectionData.audit.createdAt)}
                    </div>
                    {inspectionData.audit.failureReason && (
                      <div className="bg-rose-950/40 border border-rose-900/60 p-2 rounded text-rose-300 font-sans mt-2">
                        <strong>Recorded Failure:</strong> {inspectionData.audit.failureReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Live Persisted State */}
                <div className="bg-surface border border-border-default rounded-xl p-4 space-y-3 font-mono shadow-xs">
                  <div className="font-sans font-bold text-foreground border-b border-border-subtle pb-2 flex items-center gap-2">
                    <FaDatabase className="text-text-muted" /> Live Persisted State
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    {/* Order State */}
                    {inspectionData.persistedState.order.exists ? (
                      <div className="space-y-1">
                        <div className="text-emerald-400 font-bold">Target Order Exists: {inspectionData.persistedState.order.id}</div>
                        <div>
                          <span className="text-text-muted">Status:</span> {inspectionData.persistedState.order.status}
                        </div>
                        <div>
                          <span className="text-text-muted">isDisputeHoldActive:</span>{" "}
                          <span className={cn(inspectionData.persistedState.order.isDisputeHoldActive ? "text-rose-400 font-bold" : "text-foreground")}>
                            {String(inspectionData.persistedState.order.isDisputeHoldActive)}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-muted">Active Holds Count:</span> {inspectionData.persistedState.order.activeHoldsCount}
                        </div>
                        {inspectionData.persistedState.order.disputeHolds?.length > 0 && (
                          <div className="mt-2 text-[10px] space-y-1 bg-surface-subtle p-2 rounded border border-border-default">
                            <span className="text-text-muted font-semibold block">Order Holds Array:</span>
                            {inspectionData.persistedState.order.disputeHolds.map((h, i) => (
                              <div key={i} className="flex justify-between text-foreground">
                                <span>{h.holdId}</span>
                                <span className={cn("font-bold", h.status === "ACTIVE" ? "text-rose-400" : "text-text-muted")}>
                                  {h.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-rose-400">Order Record: Not found or unavailable</div>
                    )}

                    {/* Dispute Case State */}
                    <div className="pt-2 border-t border-border-subtle">
                      {inspectionData.persistedState.disputeCase.exists ? (
                        <div>
                          <div className="text-emerald-400 font-bold">Dispute Case Exists: {inspectionData.persistedState.disputeCase.id}</div>
                          <div>
                            <span className="text-text-muted">Case Status:</span> {inspectionData.persistedState.disputeCase.status}
                          </div>
                          <div>
                            <span className="text-text-muted">Case References Order:</span>{" "}
                            <span className={cn(inspectionData.persistedState.disputeCase.orderReferenceMatches ? "text-emerald-400" : "text-rose-400 font-bold")}>
                              {inspectionData.persistedState.disputeCase.orderReferenceMatches ? "YES (Matches)" : "NO (Mismatch)"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-text-muted">Dispute Case: No referenced case ID</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Factual Evidence vs Detected Discrepancies */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Evidence */}
                <div className="bg-surface border border-border-default rounded-xl p-4 space-y-2 shadow-xs">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <FaCheckCircle className="text-emerald-400" /> Confirmed Factual Observations
                  </div>
                  <ul className="space-y-1.5 list-disc list-inside text-text-muted">
                    {inspectionData.consistencyAnalysis.evidence.map((ev, i) => (
                      <li key={i} className="leading-relaxed">
                        {ev}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Discrepancies */}
                <div className="bg-surface border border-border-default rounded-xl p-4 space-y-2 shadow-xs">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <FaExclamationCircle className="text-rose-400" /> Detected Discrepancies
                  </div>
                  {inspectionData.consistencyAnalysis.discrepancies.length === 0 ? (
                    <div className="text-emerald-400 italic">No state discrepancies identified.</div>
                  ) : (
                    <ul className="space-y-1.5 list-disc list-inside text-rose-300">
                      {inspectionData.consistencyAnalysis.discrepancies.map((disc, i) => (
                        <li key={i} className="leading-relaxed">
                          {disc}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Operator Recovery Guidance */}
              <div className="bg-surface border border-amber-600/30 rounded-xl p-4 space-y-2 shadow-xs">
                <div className="text-amber-400 font-bold flex items-center gap-2">
                  <FaWrench className="text-amber-400" /> Recommended Operator Action
                </div>
                <p className="text-foreground text-xs leading-relaxed">
                  {inspectionData.consistencyAnalysis.recommendedAction}
                </p>

                {inspectionData.consistencyAnalysis.nextSteps?.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border-subtle">
                    <span className="text-text-muted font-semibold block mb-1">Recommended Next Steps:</span>
                    <ol className="list-decimal list-inside space-y-1 text-foreground">
                      {inspectionData.consistencyAnalysis.nextSteps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </Dialog>
      )}
      </div>
    </AdminDashboardShell>
  );
};

export default AdminReconciliationPage;
