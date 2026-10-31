import React, { useState, useEffect, useCallback } from "react";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import AdminDashboardShell from "../layouts/AdminDashboardShell";
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Calendar,
  Layers,
  UserCheck,
  Server,
  FileText,
} from "lucide-react";

export default function AdminAuditExplorer() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [actorType, setActorType] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [outcome, setOutcome] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Inspection Drawer
  const [selectedEvent, setSelectedEvent] = useState(null);

  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await axiosWithAuth.get("/admin/audit-logs/summary");
      if (res.data?.success && res.data.data) {
        setSummary(res.data.data);
      }
    } catch (err) {
      console.warn("Audit summary error:", err.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchLogs = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = {
          page,
          limit: 15,
        };
        if (actorType !== "ALL") params.actorType = actorType;
        if (category !== "ALL") params.category = category;
        if (outcome !== "ALL") params.outcome = outcome;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        if (searchTerm.trim()) params.search = searchTerm.trim();

        const res = await axiosWithAuth.get("/admin/audit-logs", { params });

        if (res.data?.success && Array.isArray(res.data.events)) {
          setLogs(res.data.events);
          setCurrentPage(res.data.page || 1);
          setTotalPages(res.data.totalPages || 1);
          setTotalCount(res.data.totalCount || 0);
        } else {
          setLogs([]);
          setTotalPages(1);
          setTotalCount(0);
        }
      } catch (err) {
        console.error("Failed to load unified audit logs:", err);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    [actorType, category, outcome, startDate, endDate, searchTerm]
  );

  useEffect(() => {
    fetchLogs(1);
    fetchSummary();
  }, [fetchLogs]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setActorType("ALL");
    setCategory("ALL");
    setOutcome("ALL");
    setStartDate("");
    setEndDate("");
  };

  const getOutcomeBadge = (eventOutcome) => {
    switch (eventOutcome?.toUpperCase()) {
      case "SUCCESS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> SUCCESS
          </span>
        );
      case "FAILED":
      case "ROLLED_BACK":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" /> {eventOutcome}
          </span>
        );
      case "DENIED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
            <AlertTriangle className="w-3 h-3 text-purple-600 dark:text-purple-400" /> DENIED
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" /> PENDING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-surface-subtle text-foreground-muted border border-border-subtle">
            {eventOutcome || "UNKNOWN"}
          </span>
        );
    }
  };

  const getActorBadge = (type) => {
    const t = (type || "system").toLowerCase();
    const colors = {
      admin: "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40",
      user: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40",
      seller: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40",
      system: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
      integration: "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/40",
    };
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider ${
          colors[t] || colors.system
        }`}
      >
        {t}
      </span>
    );
  };

  return (
    <AdminDashboardShell>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="sm:flex sm:justify-between sm:items-center pb-5 border-b border-border-subtle">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight">
                Activity & Audit Explorer
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-action-primary/10 text-action-primary border border-action-primary/20">
                Unified Trail
              </span>
            </div>
            <p className="text-xs sm:text-sm text-foreground-muted mt-1">
              Authoritative, append-only operational audit trail across administrators, users, sellers, and system jobs
            </p>
          </div>

          <div className="mt-4 sm:mt-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                fetchLogs(currentPage);
                fetchSummary();
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-border-default bg-surface hover:bg-surface-subtle text-foreground shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-action-primary ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Telemetry Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-surface border border-border-subtle shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted font-medium">Events (24h)</span>
                <Clock className="w-4 h-4 text-action-primary" />
              </div>
              <p className="text-2xl font-bold font-display text-foreground mt-2">
                {summary.totalEventsLast24h || 0}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-border-subtle shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Successful</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400 mt-2">
                {summary.outcomes?.SUCCESS || 0}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-border-subtle shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">Failed / Errors</span>
                <XCircle className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-2xl font-bold font-display text-rose-600 dark:text-rose-400 mt-2">
                {summary.outcomes?.FAILED || 0}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-border-subtle shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Denied Access</span>
                <AlertTriangle className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-2xl font-bold font-display text-purple-600 dark:text-purple-400 mt-2">
                {summary.outcomes?.DENIED || 0}
              </p>
            </div>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl bg-surface border border-border-subtle shadow-card space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by action, email, actor ID, resource ID, or correlation ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-surface-subtle border border-border-default text-foreground placeholder:text-foreground-muted focus:outline-hidden focus:ring-2 focus:ring-action-primary/30"
              />
              <Search className="w-4 h-4 text-foreground-muted absolute left-3 top-2.5" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={actorType}
                onChange={(e) => setActorType(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-surface-subtle border border-border-default text-foreground cursor-pointer"
              >
                <option value="ALL">All Actors</option>
                <option value="ADMIN">Admin</option>
                <option value="USER">User</option>
                <option value="SELLER">Seller</option>
                <option value="SYSTEM">System</option>
                <option value="INTEGRATION">Integration</option>
              </select>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-surface-subtle border border-border-default text-foreground cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="AUTH">Authentication</option>
                <option value="SECURITY">Security</option>
                <option value="USER_MANAGEMENT">User Management</option>
                <option value="SELLER_MANAGEMENT">Seller Management</option>
                <option value="MARKETPLACE">Marketplace</option>
                <option value="AUCTION">Auctions</option>
                <option value="ORDER">Orders</option>
                <option value="DISPUTE">Disputes</option>
                <option value="FINANCE">Finance</option>
                <option value="GOVERNANCE">Governance</option>
              </select>

              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-surface-subtle border border-border-default text-foreground cursor-pointer"
              >
                <option value="ALL">All Outcomes</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="DENIED">Denied</option>
                <option value="PENDING">Pending</option>
                <option value="ROLLED_BACK">Rolled Back</option>
              </select>

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="Filter events from date"
                className="px-2.5 py-1.5 rounded-xl text-xs bg-surface-subtle border border-border-default text-foreground"
              />
              <span className="text-xs text-foreground-muted">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="Filter events up to date"
                className="px-2.5 py-1.5 rounded-xl text-xs bg-surface-subtle border border-border-default text-foreground"
              />

              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover shadow-xs transition cursor-pointer"
              >
                Filter
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 rounded-xl text-xs font-medium border border-border-default bg-surface hover:bg-surface-subtle text-foreground-muted hover:text-foreground transition cursor-pointer"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Audit Log Table */}
        <div className="bg-surface rounded-2xl border border-border-subtle shadow-card overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-xs text-foreground-muted">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-action-primary border-t-transparent rounded-full mb-3"></div>
              <p>Loading authoritative audit trail...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center p-8">
              <ShieldAlert className="w-10 h-10 text-foreground-muted/40 mx-auto mb-3" />
              <h3 className="font-semibold text-sm text-foreground mb-1">
                No matching audit records found
              </h3>
              <p className="text-xs text-foreground-muted max-w-sm mx-auto">
                No operational activity matches your selected filters. Adjust your search criteria or refresh the ledger.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-auto w-full text-xs">
                <thead className="bg-surface-subtle text-foreground-muted font-semibold border-b border-border-subtle uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Timestamp (UTC)</th>
                    <th className="px-4 py-3 text-left">Actor</th>
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-left">Target / Resource</th>
                    <th className="px-4 py-3 text-left">State Delta</th>
                    <th className="px-4 py-3 text-left">Reason / Context</th>
                    <th className="px-4 py-3 text-center">Outcome</th>
                    <th className="px-4 py-3 text-center">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-foreground">
                  {logs.map((log) => (
                    <tr
                      key={log._id || log.id}
                      className="hover:bg-surface-subtle/70 transition"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-foreground-muted font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {getActorBadge(log.actorType)}
                          <span className="font-medium text-foreground truncate max-w-[140px]" title={log.actorEmail || log.actorId}>
                            {log.actorEmail || log.actorId || "System"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-semibold text-action-primary font-mono text-[11px]">
                          {log.action}
                        </span>
                        <div className="text-[10px] text-foreground-muted">{log.category}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-foreground-muted uppercase">
                            {log.resourceType || log.targetAccountType || "item"}:
                          </span>
                          <span className="font-mono text-[11px] truncate max-w-[130px]" title={log.targetAccountEmail || log.resourceId}>
                            {log.targetAccountEmail || log.resourceId || "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.beforeStatus || log.afterStatus ? (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="px-1.5 py-0.5 rounded bg-surface-subtle text-foreground-muted border border-border-subtle">
                              {log.beforeStatus || "None"}
                            </span>
                            <span>→</span>
                            <span className="px-1.5 py-0.5 rounded bg-action-primary/10 text-action-primary font-semibold border border-action-primary/20">
                              {log.afterStatus || "Updated"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-foreground-muted text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-foreground-muted" title={log.reason || log.failureReason}>
                        {log.reason || log.failureReason || "System procedure"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {getOutcomeBadge(log.outcome)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(log)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border-default hover:bg-surface-subtle text-[11px] font-medium text-action-primary transition cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border-subtle text-xs text-foreground-muted">
              <div>
                Page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
                <span className="font-semibold text-foreground">{totalPages}</span> ({totalCount} total entries)
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fetchLogs(currentPage - 1)}
                  disabled={currentPage <= 1 || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-default disabled:opacity-40 hover:bg-surface-subtle transition cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchLogs(currentPage + 1)}
                  disabled={currentPage >= totalPages || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-default disabled:opacity-40 hover:bg-surface-subtle transition cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Inspection Drawer / Modal */}
        {selectedEvent && (
          <div
            className="fixed inset-0 z-50 bg-gray-950/60 backdrop-blur-xs flex items-center justify-center p-4"
            data-lenis-prevent="true"
          >
            <div
              className="bg-surface border border-border-subtle rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto overscroll-contain flex flex-col p-6 space-y-5"
              data-lenis-prevent="true"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-action-primary" />
                  <h3 className="text-lg font-bold font-display text-foreground">
                    Audit Event Details
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 rounded-lg hover:bg-surface-subtle text-foreground-muted hover:text-foreground cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface-subtle border border-border-subtle">
                  <div>
                    <span className="text-foreground-muted">Action:</span>
                    <p className="font-semibold text-action-primary font-mono">{selectedEvent.action}</p>
                  </div>
                  <div>
                    <span className="text-foreground-muted">Outcome:</span>
                    <div>{getOutcomeBadge(selectedEvent.outcome)}</div>
                  </div>
                  <div>
                    <span className="text-foreground-muted">Actor:</span>
                    <p className="font-medium text-foreground">{selectedEvent.actorEmail || selectedEvent.actorId || "System"}</p>
                  </div>
                  <div>
                    <span className="text-foreground-muted">Actor Type & Role:</span>
                    <p className="font-medium text-foreground">{selectedEvent.actorType} ({selectedEvent.actorRole || "N/A"})</p>
                  </div>
                  <div>
                    <span className="text-foreground-muted">Resource:</span>
                    <p className="font-mono text-foreground">{selectedEvent.resourceType}: {selectedEvent.resourceId || selectedEvent.targetAccountId || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-foreground-muted">Recorded Timestamp:</span>
                    <p className="text-foreground">{new Date(selectedEvent.createdAt).toISOString()}</p>
                  </div>
                  {selectedEvent.correlationId && (
                    <div className="col-span-2">
                      <span className="text-foreground-muted">Correlation ID:</span>
                      <p className="font-mono text-foreground">{selectedEvent.correlationId}</p>
                    </div>
                  )}
                  {selectedEvent.ipAddress && (
                    <div>
                      <span className="text-foreground-muted">IP Address:</span>
                      <p className="font-mono text-foreground">{selectedEvent.ipAddress}</p>
                    </div>
                  )}
                  {selectedEvent.idempotencyKey && (
                    <div>
                      <span className="text-foreground-muted">Idempotency Key:</span>
                      <p className="font-mono text-foreground truncate">{selectedEvent.idempotencyKey}</p>
                    </div>
                  )}
                </div>

                {selectedEvent.reason && (
                  <div>
                    <span className="text-foreground-muted font-semibold">Administrative Reason / Justification:</span>
                    <p className="mt-1 p-2.5 rounded-lg bg-surface-subtle border border-border-subtle text-foreground">
                      {selectedEvent.reason}
                    </p>
                  </div>
                )}

                {selectedEvent.failureReason && (
                  <div>
                    <span className="text-rose-600 font-semibold">Failure Diagnostics:</span>
                    <p className="mt-1 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                      {selectedEvent.failureReason}
                    </p>
                  </div>
                )}

                {/* Safe Sanitized Metadata */}
                <div>
                  <span className="text-foreground-muted font-semibold">Event Metadata (Sanitized):</span>
                  <pre className="mt-1 p-3 rounded-lg bg-gray-900 text-gray-100 font-mono text-[11px] overflow-x-auto max-h-48">
                    {JSON.stringify(selectedEvent.metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="pt-3 border-t border-border-subtle flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-subtle border border-border-default text-foreground cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminDashboardShell>
  );
}
