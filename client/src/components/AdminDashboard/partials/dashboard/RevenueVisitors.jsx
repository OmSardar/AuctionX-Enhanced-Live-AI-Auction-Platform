import React from "react";
import BarChart from "@/shared/components/data-display/charts/BarChart01";
import { getCssVariable } from "../../utils/Utils";
import { Users, Store } from "lucide-react";

function RevenueVisitors({ metrics }) {
  const labels = metrics?.labels || ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const userCounts = metrics?.users || [0, 0, 0, 0, 0, 0];
  const sellerCounts = metrics?.sellers || [0, 0, 0, 0, 0, 0];

  const totalNewUsers = userCounts.reduce((a, b) => a + b, 0);
  const totalNewSellers = sellerCounts.reduce((a, b) => a + b, 0);

  const chartData = {
    labels,
    datasets: [
      {
        label: "New Registered Users",
        data: userCounts,
        backgroundColor: getCssVariable("--color-violet-500"),
        hoverBackgroundColor: getCssVariable("--color-violet-600"),
        barPercentage: 0.6,
        categoryPercentage: 0.7,
        borderRadius: 4,
      },
      {
        label: "Onboarded Sellers",
        data: sellerCounts,
        backgroundColor: getCssVariable("--color-emerald-500"),
        hoverBackgroundColor: getCssVariable("--color-emerald-600"),
        barPercentage: 0.6,
        categoryPercentage: 0.7,
        borderRadius: 4,
      },
    ],
  };

  return (
    <div className="col-span-full xl:col-span-8 bg-surface border border-border-subtle shadow-card rounded-2xl">
      <header className="px-5 py-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="font-bold text-foreground">
            Platform Community Growth
          </h2>
          <p className="text-xs text-foreground-muted">
            Monthly registered buyers vs newly onboarded sellers
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
            <Users className="w-3.5 h-3.5" /> +{totalNewUsers} Users
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <Store className="w-3.5 h-3.5" /> +{totalNewSellers} Sellers
          </span>
        </div>
      </header>
      <div className="p-4">
        <BarChart data={chartData} width={700} height={260} />
      </div>
    </div>
  );
}

export default RevenueVisitors;
