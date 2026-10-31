import React, { useState, useEffect, lazy, Suspense } from "react";
import AdminDashboardShell from "../layouts/AdminDashboardShell";
import FilterButton from "../components/DropdownFilter";
import Datepicker from "../components/Datepicker";
import { Skeleton } from "../../ui/Skeleton";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import { executeGraphQL, ANALYTICS_OVERVIEW_QUERY } from "../../../lib/graphqlClient";
import { RefreshCw, AlertCircle } from "lucide-react";

// Lazy-load expensive Chart.js graphs and revenue visualizations on-demand
const DashboardCard01 = lazy(() => import("../partials/dashboard/GraphWide1"));
const DashboardCard02 = lazy(() => import("../partials/dashboard/GraphWide2"));
const DashboardCard03 = lazy(() => import("../partials/dashboard/GraphWide3"));
const DashboardCard04 = lazy(() => import("../partials/dashboard/GraphWide4"));
const DashboardCard05 = lazy(() => import("../partials/dashboard/GraphWide5"));
const DashboardCard06 = lazy(() => import("../partials/dashboard/GraphWidePieChart"));
const DashboardCard07 = lazy(() => import("../partials/dashboard/RevenueVisitors"));

const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      // First try composite GraphQL query
      try {
        const gqlData = await executeGraphQL({
          query: ANALYTICS_OVERVIEW_QUERY,
          variables: { months: 12 },
        });
        if (gqlData?.analyticsOverview) {
          setData(gqlData.analyticsOverview);
          setLoading(false);
          return;
        }
      } catch (gqlErr) {
        console.warn("GraphQL analytics fetch failed, falling back to REST:", gqlErr.message);
      }

      // REST fallback endpoint
      const res = await axiosWithAuth.get("/admin/analytics/overview");
      if (res.data?.success && res.data.data) {
        setData(res.data.data);
      } else {
        throw new Error(res.data?.message || "Failed to load real analytics data");
      }
    } catch (err) {
      console.error("Analytics fetch error:", err);
      setError(err.response?.data?.message || err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <AdminDashboardShell>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto space-y-6">
        {/* Dashboard actions */}
        <div className="sm:flex sm:justify-between sm:items-center pb-4 border-b border-border-subtle">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl text-foreground font-bold font-display">
                Analytics Overview
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Live Database Telemetry
              </span>
            </div>
            <p className="text-xs sm:text-sm text-foreground-muted mt-1">
              Authoritative financial, auction health, catalog, and user metrics derived from live collections
            </p>
          </div>

          {/* Right: Actions */}
          <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2 mt-4 sm:mt-0">
            <button
              type="button"
              onClick={fetchAnalytics}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-border-default bg-surface hover:bg-surface-subtle text-foreground shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-action-primary ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <FilterButton align="right" />
            <Datepicker align="right" />
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchAnalytics}
              className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Cards Grid */}
        <Suspense
          fallback={
            <div className="grid grid-cols-12 gap-6">
              <Skeleton className="col-span-full sm:col-span-6 xl:col-span-4 h-80 rounded-2xl" />
              <Skeleton className="col-span-full sm:col-span-6 xl:col-span-4 h-80 rounded-2xl" />
              <Skeleton className="col-span-full sm:col-span-6 xl:col-span-4 h-80 rounded-2xl" />
              <Skeleton className="col-span-full sm:col-span-6 xl:col-span-4 h-80 rounded-2xl" />
              <Skeleton className="col-span-full sm:col-span-6 xl:col-span-4 h-80 rounded-2xl" />
              <Skeleton className="col-span-full sm:col-span-6 xl:col-span-4 h-80 rounded-2xl" />
            </div>
          }
        >
          <div className="grid grid-cols-12 gap-6">
            <DashboardCard01 metrics={data?.revenueTimeSeries} />
            <DashboardCard02 metrics={data?.revenueTimeSeries} />
            <DashboardCard03 metrics={data?.revenueTimeSeries} />
            <DashboardCard04 metrics={data?.financialFlows} />
            <DashboardCard05 metrics={data?.auctionHealth} />
            <DashboardCard06 metrics={data?.categoryDistribution} />
            <DashboardCard07 metrics={data?.userGrowth} />
          </div>
        </Suspense>
      </div>
    </AdminDashboardShell>
  );
};

export default Analytics;
