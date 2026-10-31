import React, { useState, useEffect, lazy, Suspense } from "react";
import AdminDashboardShell from "../layouts/AdminDashboardShell";
import FilterButton from "../components/DropdownFilter";
import Datepicker from "../components/Datepicker";
import { Skeleton } from "../../ui/Skeleton";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import { executeGraphQL, ANALYTICS_OVERVIEW_QUERY } from "../../../lib/graphqlClient";
import { RefreshCw, AlertCircle } from "lucide-react";

// Lazy-load expensive Chart.js sales graphs on-demand
const DashboardCard08 = lazy(() => import("../partials/dashboard/GraphWide6"));
const DashboardCard09 = lazy(() => import("../partials/dashboard/GraphWide7"));
const DashboardCard10 = lazy(() => import("../partials/dashboard/Customers"));
const DashboardCard11 = lazy(() => import("../partials/dashboard/WideCard1"));
const DashboardCard12 = lazy(() => import("@/shared/components/data-display/WideCard2"));
const DashboardCard13 = lazy(() => import("@/shared/components/data-display/WideCard3"));

const Sales = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSalesData = async () => {
    setLoading(true);
    setError(null);
    try {
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
        console.warn("GraphQL sales fetch error, using REST fallback:", gqlErr.message);
      }

      const res = await axiosWithAuth.get("/admin/analytics/overview");
      if (res.data?.success && res.data.data) {
        setData(res.data.data);
      } else {
        throw new Error(res.data?.message || "Failed to load sales analytics");
      }
    } catch (err) {
      console.error("Sales fetch error:", err);
      setError(err.response?.data?.message || err.message || "Failed to load sales data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
  }, []);

  return (
    <AdminDashboardShell>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto space-y-6">
        {/* Dashboard actions */}
        <div className="sm:flex sm:justify-between sm:items-center pb-4 border-b border-border-subtle">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl text-foreground font-bold font-display">
                Sales & Revenue Analytics
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-action-primary/10 text-action-primary border border-action-primary/20">
                Financial Aggregations
              </span>
            </div>
            <p className="text-xs sm:text-sm text-foreground-muted mt-1">
              Settled auction volume, order fulfillment ratios, and dispute resolutions
            </p>
          </div>

          {/* Right: Actions */}
          <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2 mt-4 sm:mt-0">
            <button
              type="button"
              onClick={fetchSalesData}
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
              onClick={fetchSalesData}
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
              <Skeleton className="col-span-full sm:col-span-6 xl:col-span-6 h-80 rounded-2xl" />
              <Skeleton className="col-span-full sm:col-span-6 xl:col-span-6 h-80 rounded-2xl" />
              <Skeleton className="col-span-full sm:col-span-6 xl:col-span-4 h-80 rounded-2xl" />
              <Skeleton className="col-span-full sm:col-span-6 xl:col-span-4 h-80 rounded-2xl" />
              <Skeleton className="col-span-full sm:col-span-6 xl:col-span-4 h-80 rounded-2xl" />
            </div>
          }
        >
          <div className="grid grid-cols-12 gap-6">
            <DashboardCard08 metrics={data?.revenueTimeSeries} />
            <DashboardCard09 metrics={data?.revenueTimeSeries} />
            <DashboardCard10 />
            <DashboardCard11 metrics={data?.disputeReasons} />
            <DashboardCard12 />
            <DashboardCard13 />
          </div>
        </Suspense>
      </div>
    </AdminDashboardShell>
  );
};

export default Sales;
