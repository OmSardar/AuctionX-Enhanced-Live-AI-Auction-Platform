import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { ShieldAlert, Search, RefreshCw, Filter, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";

export default function AdminLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAction, setSelectedAction] = useState("all");

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 15,
      };
      if (selectedAction !== "all") params.action = selectedAction;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const response = await axiosWithAuth.get("/admin/users/audit-logs", { params });

      if (response.data?.success && Array.isArray(response.data.auditLogs)) {
        setLogs(response.data.auditLogs);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setTotalLogs(response.data.pagination?.total || 0);
        setCurrentPage(page);
      } else {
        setLogs([]);
        setTotalPages(1);
        setTotalLogs(0);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [selectedAction]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const getOutcomeBadge = (outcome) => {
    switch (outcome?.toUpperCase()) {
      case "SUCCESS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
            <CheckCircle2 className="w-3 h-3" /> SUCCESS
          </span>
        );
      case "FAILED":
      case "ROLLED_BACK":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
            <XCircle className="w-3 h-3" /> {outcome}
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
            <Clock className="w-3 h-3" /> PENDING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            {outcome || "UNKNOWN"}
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-2xl border border-gray-100 dark:border-gray-700/60 p-5 sm:p-6 transition-colors">
      {/* Header */}
      <div className="sm:flex sm:justify-between sm:items-center pb-5 border-b border-gray-100 dark:border-gray-700/60 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Global Administrative Audit Log
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Authoritative, tamper-evident audit trail for all governance, status modifications, and moderation actions.
          </p>
        </div>
        <div className="mt-3 sm:mt-0 flex items-center gap-2">
          <button
            onClick={() => fetchLogs(currentPage)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-xs font-medium text-gray-700 dark:text-gray-300 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-stretch sm:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by admin email, target email, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200"
          >
            <option value="all">All Actions</option>
            <option value="STATUS_UPDATE">Account Status Update</option>
            <option value="SUSPENSION">Suspensions</option>
            <option value="LISTING_MODERATION">Listing Moderation</option>
            <option value="DISPUTE_HOLD">Dispute Hold Protocol</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-xs text-gray-500 dark:text-gray-400">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full mb-2"></div>
          <p>Loading audit ledger...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-8">
          <ShieldAlert className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-1">
            No audit records found
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            {searchTerm || selectedAction !== "all"
              ? "No administrative records match your current filter criteria."
              : "Administrative actions performed by managers and super-admins will appear here automatically."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700/60">
          <table className="table-auto w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-600 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-700/60 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Timestamp</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Acting Admin</th>
                <th className="px-4 py-3 text-left">Target Account</th>
                <th className="px-4 py-3 text-left">State Transition</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-center">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-200">
              {logs.map((log) => (
                <tr key={log._id} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-amber-700 dark:text-amber-300">
                    {log.action || "GOVERNANCE"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{log.actingAdminEmail}</div>
                    <span className="text-[10px] text-gray-400 capitalize">{log.actingRole || "admin"}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300">
                      {log.targetAccountEmail || log.targetAccountId || "N/A"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        {log.beforeState?.status || "None"}
                      </span>
                      <span>→</span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">
                        {log.afterState?.status || "Updated"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate" title={log.reason}>
                    {log.reason || "Administrative procedure"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {getOutcomeBadge(log.outcome)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700/60 mt-4 text-xs text-gray-500">
          <div>
            Showing page <span className="font-semibold text-gray-700 dark:text-gray-300">{currentPage}</span> of{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-300">{totalPages}</span> ({totalLogs} total records)
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => fetchLogs(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => fetchLogs(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}