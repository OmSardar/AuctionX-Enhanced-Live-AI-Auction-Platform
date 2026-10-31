import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AdminDashboardShell from "../layouts/AdminDashboardShell";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import {
  FaUsers,
  FaGavel,
  FaShieldAlt,
  FaChartLine,
  FaSyncAlt,
  FaArrowRight,
  FaExclamationTriangle,
  FaBoxOpen,
  FaCheckCircle,
} from "react-icons/fa";

/**
 * Enterprise Admin Dashboard (Stage 1)
 * Powered exclusively by real database queries from /api/admin/dashboard/stats.
 * Fully responsive, theme-token aware, and includes loading, error, and empty states.
 */
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const API_URL = import.meta.env.VITE_API_URL;

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const endpoint = "/admin/dashboard/stats";
      let response;
      try {
        response = await axiosWithAuth.get(endpoint);
      } catch (err) {
        if (API_URL) {
          response = await axiosWithAuth.get(`${API_URL}/api${endpoint}`);
        } else {
          throw err;
        }
      }

      if (response.data?.success && response.data?.stats) {
        setStats(response.data.stats);
      } else {
        throw new Error(response.data?.message || "Failed to load dashboard metrics");
      }
    } catch (err) {
      console.error("Admin dashboard fetch error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load administrative statistics. Please check your credentials."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <AdminDashboardShell>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-7xl mx-auto">
        {/* Top Bar: Title & Action Controls */}
            <div className="sm:flex sm:justify-between sm:items-center mb-8 pb-5 border-b border-border-subtle">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight">
                    Admin Dashboard
                  </h1>
                  <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-action-primary/10 text-action-primary border border-action-primary/20">
                    Stage 1 Foundation
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-foreground-muted mt-1">
                  Real-time system telemetry, database metrics, and governance oversight
                </p>
              </div>

              {/* Refresh Button */}
              <div className="mt-4 sm:mt-0 flex items-center gap-3">
                <button
                  type="button"
                  onClick={fetchStats}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-border-default bg-surface hover:bg-surface-subtle text-foreground shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <FaSyncAlt className={`w-3.5 h-3.5 text-action-primary ${isLoading ? "animate-spin" : ""}`} />
                  <span>{isLoading ? "Refreshing..." : "Refresh Metrics"}</span>
                </button>
              </div>
            </div>

            {/* Error State Banner */}
            {error && (
              <div
                role="alert"
                className="mb-8 p-4 rounded-2xl border border-action-destructive/40 bg-status-error-bg/30 text-action-destructive flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200"
              >
                <div className="flex items-center gap-3">
                  <FaExclamationTriangle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Failed to retrieve metrics</p>
                    <p className="text-xs opacity-90">{error}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchStats}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-action-destructive text-white hover:bg-action-destructive/90 transition-colors shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Loading State: Skeleton Cards */}
            {isLoading && !stats && (
              <div className="space-y-8 animate-pulse">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl border border-border-subtle bg-surface shadow-xs h-36 flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-center">
                        <div className="w-24 h-4 bg-surface-raised rounded-md" />
                        <div className="w-9 h-9 rounded-xl bg-surface-raised" />
                      </div>
                      <div className="w-16 h-8 bg-surface-raised rounded-md" />
                      <div className="w-32 h-3 bg-surface-raised rounded-md" />
                    </div>
                  ))}
                </div>
                <div className="p-6 rounded-2xl border border-border-subtle bg-surface shadow-xs h-64" />
              </div>
            )}

            {/* Loaded State: Real Database Metrics */}
            {stats && (
              <div className="space-y-8 animate-in fade-in duration-200">
                {/* 1. Core Key Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Card: Total Users */}
                  <div className="p-5 rounded-2xl border border-border-subtle bg-surface shadow-card hover:border-action-primary/30 transition-all duration-200 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Total Registered Users
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-sm shadow-xs">
                        <FaUsers />
                      </div>
                    </div>
                    <div className="my-2">
                      <span className="text-3xl font-extrabold font-display text-foreground tracking-tight">
                        {stats.users?.total ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-foreground-muted border-t border-border-subtle/60 pt-2.5">
                      <span>{stats.users?.regularUsers ?? 0} buyers • {stats.users?.sellers ?? 0} sellers</span>
                      <span className="text-status-success font-medium">
                        {stats.users?.verified ?? 0} verified
                      </span>
                    </div>
                  </div>

                  {/* Card: Auctions & Listings */}
                  <div className="p-5 rounded-2xl border border-border-subtle bg-surface shadow-card hover:border-action-primary/30 transition-all duration-200 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Catalogue Listings
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-sm shadow-xs">
                        <FaGavel />
                      </div>
                    </div>
                    <div className="my-2">
                      <span className="text-3xl font-extrabold font-display text-foreground tracking-tight">
                        {stats.auctions?.total ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-foreground-muted border-t border-border-subtle/60 pt-2.5">
                      <span className="text-action-primary font-medium">
                        {stats.auctions?.active ?? 0} active live
                      </span>
                      <span>
                        {stats.auctions?.upcoming ?? 0} upcoming
                      </span>
                    </div>
                  </div>

                  {/* Card: Total Bids */}
                  <div className="p-5 rounded-2xl border border-border-subtle bg-surface shadow-card hover:border-action-primary/30 transition-all duration-200 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Total Bids Placed
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-sm shadow-xs">
                        <FaChartLine />
                      </div>
                    </div>
                    <div className="my-2">
                      <span className="text-3xl font-extrabold font-display text-foreground tracking-tight">
                        {stats.bids?.totalBids ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-foreground-muted border-t border-border-subtle/60 pt-2.5">
                      <span>Immutable ledger records</span>
                      <span className="text-status-success font-medium flex items-center gap-1">
                        <FaCheckCircle className="w-3 h-3" /> Live
                      </span>
                    </div>
                  </div>

                  {/* Card: Pending Moderation */}
                  <div className="p-5 rounded-2xl border border-border-subtle bg-surface shadow-card hover:border-action-primary/30 transition-all duration-200 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Pending Moderation
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center text-sm shadow-xs">
                        <FaShieldAlt />
                      </div>
                    </div>
                    <div className="my-2">
                      <span className="text-3xl font-extrabold font-display text-foreground tracking-tight">
                        {(stats.moderation?.pendingReports || 0) +
                          (stats.moderation?.pendingSellerApprovals || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-foreground-muted border-t border-border-subtle/60 pt-2.5">
                      <span>
                        {stats.moderation?.pendingReports ?? 0} reports • {stats.moderation?.pendingSellerApprovals ?? 0} sellers
                      </span>
                      <span className="font-semibold text-action-primary">
                        Action required
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Structured Section Foundation Links */}
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-3">
                    Administrative Domains
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Link: Users Management */}
                    <Link
                      to="/admin/users"
                      className="p-5 rounded-2xl border border-border-default bg-surface hover:bg-surface-subtle transition-all duration-200 shadow-xs group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-base text-foreground group-hover:text-action-primary transition-colors">
                            User Governance
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-subtle border border-border-subtle text-foreground-muted">
                            /admin/users
                          </span>
                        </div>
                        <p className="text-xs text-foreground-muted line-clamp-2">
                          User lifecycle oversight, account verification status, and seller approval pipelines.
                        </p>
                      </div>
                      <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-action-primary group-hover:translate-x-1 transition-transform">
                        <span>Access domain</span>
                        <FaArrowRight className="w-2.5 h-2.5" />
                      </div>
                    </Link>

                    {/* Link: Listing Moderation */}
                    <Link
                      to="/admin/listings"
                      className="p-5 rounded-2xl border border-border-default bg-surface hover:bg-surface-subtle transition-all duration-200 shadow-xs group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-base text-foreground group-hover:text-action-primary transition-colors">
                            Listing Moderation
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-subtle border border-border-subtle text-foreground-muted">
                            /admin/listings
                          </span>
                        </div>
                        <p className="text-xs text-foreground-muted line-clamp-2">
                          Catalogue compliance, item description audits, and policy enforcement review.
                        </p>
                      </div>
                      <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-action-primary group-hover:translate-x-1 transition-transform">
                        <span>Access domain</span>
                        <FaArrowRight className="w-2.5 h-2.5" />
                      </div>
                    </Link>

                    {/* Link: Auction Oversight */}
                    <Link
                      to="/admin/auctions"
                      className="p-5 rounded-2xl border border-border-default bg-surface hover:bg-surface-subtle transition-all duration-200 shadow-xs group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-base text-foreground group-hover:text-action-primary transition-colors">
                            Auction Oversight
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-subtle border border-border-subtle text-foreground-muted">
                            /admin/auctions
                          </span>
                        </div>
                        <p className="text-xs text-foreground-muted line-clamp-2">
                          Anti-sniping monitoring, active auction states, and settlement deadline compliance.
                        </p>
                      </div>
                      <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-action-primary group-hover:translate-x-1 transition-transform">
                        <span>Access domain</span>
                        <FaArrowRight className="w-2.5 h-2.5" />
                      </div>
                    </Link>
                  </div>
                </div>

                {/* 3. Recent Real Activity Feed */}
                <div className="p-6 rounded-2xl border border-border-default bg-surface shadow-card">
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-border-subtle">
                    <div>
                      <h2 className="text-base font-bold text-foreground font-display">
                        Recent System Activity
                      </h2>
                      <p className="text-xs text-foreground-muted mt-0.5">
                        Latest persisted bids, catalogue listings, and settlement orders
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-foreground-muted px-2.5 py-1 rounded-full bg-surface-subtle border border-border-subtle">
                      Real Persistence Feed
                    </span>
                  </div>

                  {(!stats.recentActivity || stats.recentActivity.length === 0) ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center text-foreground-muted">
                      <FaBoxOpen className="w-10 h-10 mb-3 text-border-default" />
                      <p className="text-sm font-semibold text-foreground">No recent activity found</p>
                      <p className="text-xs text-foreground-muted mt-1 max-w-sm">
                        New bids, products, and orders will appear chronologically in this feed as transactions occur.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-border-subtle text-foreground-muted uppercase tracking-wider text-[10px]">
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Activity Description</th>
                            <th className="py-2.5 px-3">Account</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/60">
                          {stats.recentActivity.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-surface-subtle/50 transition-colors">
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                                    item.type === "BID"
                                      ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                      : item.type === "PRODUCT"
                                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                      : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                  }`}
                                >
                                  {item.type}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-medium text-foreground">
                                {item.title}
                              </td>
                              <td className="py-3 px-3 text-foreground-secondary font-mono text-[11px]">
                                {item.actor || "System"}
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-subtle border border-border-subtle text-foreground-muted">
                                  {item.status || "Recorded"}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right text-foreground-muted font-mono text-[11px]">
                                {item.timestamp ? new Date(item.timestamp).toLocaleString() : "Just now"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 4. Architecture Note on Moderation Scope */}
                <div className="p-4 rounded-xl border border-border-subtle bg-surface-subtle/60 text-xs text-foreground-muted flex items-start gap-3">
                  <FaShieldAlt className="w-4 h-4 text-action-primary mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-foreground">Schema Governance Note: </span>
                    <span>
                      {stats.moderation?.notes ||
                        "Product-level moderation queue is not modeled in the current schema; listings are created directly as Active or Scheduled."}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
    </AdminDashboardShell>
  );
}

export default Dashboard;
