import React from "react";
import BarChart from "@/shared/components/data-display/charts/BarChart03";
import { getCssVariable } from "../../utils/Utils";

function DashboardCard11({ metrics }) {
  const items = metrics?.items && metrics.items.length > 0
    ? metrics.items
    : [
        { label: "Fulfillment & Delivery", count: 0 },
        { label: "Policy & Counterfeit", count: 0 },
        { label: "Payment / Deposit", count: 0 },
        { label: "General Complaints", count: 0 },
      ];

  const colors = [
    { bg: getCssVariable("--color-violet-500"), hover: getCssVariable("--color-violet-600") },
    { bg: getCssVariable("--color-sky-500"), hover: getCssVariable("--color-sky-600") },
    { bg: getCssVariable("--color-emerald-500"), hover: getCssVariable("--color-emerald-600") },
    { bg: getCssVariable("--color-amber-500"), hover: getCssVariable("--color-amber-600") },
    { bg: getCssVariable("--color-rose-500"), hover: getCssVariable("--color-rose-600") },
  ];

  const chartData = {
    labels: ["Disputes by Category"],
    datasets: items.map((item, idx) => {
      const color = colors[idx % colors.length];
      return {
        label: item.label,
        data: [item.count],
        backgroundColor: color.bg,
        hoverBackgroundColor: color.hover,
        barPercentage: 1,
        categoryPercentage: 1,
      };
    }),
  };

  return (
    <div className="flex flex-col col-span-full sm:col-span-6 bg-surface border border-border-subtle shadow-card rounded-2xl">
      <header className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 className="font-bold text-foreground">
            Dispute & Incident Categories
          </h2>
          <p className="text-xs text-foreground-muted">
            Directly aggregated from verified user and seller incident reports
          </p>
        </div>
      </header>
      <div className="p-4 grow">
        <BarChart data={chartData} width={595} height={248} />
      </div>
    </div>
  );
}

export default DashboardCard11;
