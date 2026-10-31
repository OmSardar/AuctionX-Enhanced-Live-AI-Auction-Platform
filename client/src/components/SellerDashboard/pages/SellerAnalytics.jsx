import React, { useState, lazy, Suspense } from "react";

import Sidebar from "../partials/Sidebar";
import Header from "../partials/Header";
import FilterButton from "../components/DropdownFilter";
import Datepicker from "../components/Datepicker";
import { Skeleton } from "../../ui/Skeleton";

// Lazy-load expensive Chart.js graphs and revenue visualizations on-demand
const DashboardCard01 = lazy(() => import("../partials/dashboard/GraphWide1"));
const DashboardCard02 = lazy(() => import("../partials/dashboard/GraphWide2"));
const DashboardCard03 = lazy(() => import("../partials/dashboard/GraphWide3"));
const DashboardCard04 = lazy(() => import("../partials/dashboard/GraphWide4"));
const DashboardCard05 = lazy(() => import("../partials/dashboard/GraphWide5"));
const DashboardCard06 = lazy(() => import("../partials/dashboard/GraphWidePieChart"));
const DashboardCard07 = lazy(() => import("../partials/dashboard/RevenueVisitors"));

const Analytics = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Content area */}
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/*  Site header */}
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
            {/* Dashboard actions */}
            <div className="sm:flex sm:justify-between sm:items-center mb-8">
              {/* Left: Title */}
              <div className="mb-4 sm:mb-0">
                <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                  Dashboard
                </h1>
              </div>

              {/* Right: Actions */}
              <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
                {/* Filter button */}
                <FilterButton align="right" />
                {/* Datepicker built with React Day Picker */}
                <Datepicker align="right" />
                {/* Add view button */}
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-action-primary text-white hover:bg-action-primary-hover shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <svg
                    className="w-3.5 h-3.5 fill-current shrink-0"
                    viewBox="0 0 16 16"
                  >
                    <path d="M15 7H9V1c0-.6-.4-1-1-1S7 .4 7 1v6H1c-.6 0-1 .4-1 1s.4 1 1 1h6v6c0 .6.4 1 1 1s1-.4 1-1V9h6c.6 0 1-.4 1-1s-.4-1-1-1z" />
                  </svg>
                  <span>Add View</span>
                </button>
              </div>
            </div>

            {/* Cards */}
            <Suspense
              fallback={
                <div className="grid grid-cols-12 gap-6">
                  <Skeleton className="col-span-full sm:col-span-6 xl:col-span-4 h-64 rounded-2xl" />
                  <Skeleton className="col-span-full sm:col-span-6 xl:col-span-4 h-64 rounded-2xl" />
                  <Skeleton className="col-span-full sm:col-span-6 xl:col-span-4 h-64 rounded-2xl" />
                  <Skeleton className="col-span-full sm:col-span-6 xl:col-span-6 h-64 rounded-2xl" />
                  <Skeleton className="col-span-full sm:col-span-6 xl:col-span-6 h-64 rounded-2xl" />
                  <Skeleton className="col-span-full sm:col-span-6 xl:col-span-4 h-64 rounded-2xl" />
                </div>
              }
            >
              <div className="grid grid-cols-12 gap-6">
                {/* Line chart (Acme Plus) */}
                <DashboardCard01 />
                {/* Line chart (Acme Advanced) */}
                <DashboardCard02 />
                {/* Line chart (Acme Professional) */}
                <DashboardCard03 />
                {/* Bar chart (Direct vs Indirect) */}
                <DashboardCard04 />
                {/* Line chart (Real Time Value) */}
                <DashboardCard05 />
                {/* Doughnut chart (Top Countries) */}
                <DashboardCard06 />
                {/* Table (Top Channels) */}
                <DashboardCard07 />
              </div>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Analytics;
