import React from "react";
import LineChart from "@/shared/components/data-display/charts/LineChart02";
import { getCssVariable } from "../../utils/Utils";

function DashboardCard08({ metrics }) {
  const labels = metrics?.dateLabels || metrics?.labels || [
    "10-01-2025",
    "11-01-2025",
    "12-01-2025",
    "01-01-2026",
    "02-01-2026",
    "03-01-2026",
  ];
  const grossSales = metrics?.grossSales || [0, 0, 0, 0, 0, 0];
  const netSales = metrics?.netSales || [0, 0, 0, 0, 0, 0];

  const chartData = {
    labels,
    datasets: [
      {
        label: "Gross Sales (₹)",
        data: grossSales,
        borderColor: getCssVariable("--color-violet-500"),
        fill: false,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointBackgroundColor: getCssVariable("--color-violet-500"),
        pointHoverBackgroundColor: getCssVariable("--color-violet-500"),
        pointBorderWidth: 0,
        pointHoverBorderWidth: 0,
        clip: 20,
        tension: 0.2,
      },
      {
        label: "Net Settled (₹)",
        data: netSales,
        borderColor: getCssVariable("--color-emerald-500"),
        fill: false,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointBackgroundColor: getCssVariable("--color-emerald-500"),
        pointHoverBackgroundColor: getCssVariable("--color-emerald-500"),
        pointBorderWidth: 0,
        pointHoverBorderWidth: 0,
        clip: 20,
        tension: 0.2,
      },
    ],
  };

  return (
    <div className="flex flex-col col-span-full sm:col-span-6 bg-surface border border-border-subtle shadow-card rounded-2xl">
      <header className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 className="font-bold text-foreground">
            Sales Trajectory Over Time
          </h2>
          <p className="text-xs text-foreground-muted">
            Gross auction volume vs net settled orders
          </p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-action-primary/10 text-action-primary border border-action-primary/20">
          Monthly
        </span>
      </header>
      <div className="p-4 grow">
        <LineChart data={chartData} width={595} height={248} />
      </div>
    </div>
  );
}

export default DashboardCard08;
