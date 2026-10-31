import React from "react";
import BarChart from "@/shared/components/data-display/charts/BarChart02";
import { getCssVariable } from "../../utils/Utils";

function DashboardCard09({ metrics }) {
  const labels = metrics?.labels || ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const grossSales = metrics?.grossSales || [0, 0, 0, 0, 0, 0];
  const refunds = metrics?.series
    ? metrics.series.map((s) => -Math.abs(s.refundedAmount || 0))
    : [0, 0, 0, 0, 0, 0];

  const totalGross = grossSales.reduce((a, b) => a + b, 0);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Gross Settled (₹)",
        data: grossSales,
        backgroundColor: getCssVariable("--color-violet-500"),
        hoverBackgroundColor: getCssVariable("--color-violet-600"),
        barPercentage: 0.6,
        categoryPercentage: 0.7,
        borderRadius: 4,
      },
      {
        label: "Refunded Orders (₹)",
        data: refunds,
        backgroundColor: getCssVariable("--color-rose-500"),
        hoverBackgroundColor: getCssVariable("--color-rose-600"),
        barPercentage: 0.6,
        categoryPercentage: 0.7,
        borderRadius: 4,
      },
    ],
  };

  return (
    <div className="flex flex-col col-span-full sm:col-span-6 bg-surface border border-border-subtle shadow-card rounded-2xl">
      <header className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 className="font-bold text-foreground">
            Sales vs Refunds Comparison
          </h2>
          <p className="text-xs text-foreground-muted">
            Delivered orders compared against refunded disputes
          </p>
        </div>
        <div className="text-sm font-bold font-display text-foreground">
          ₹{totalGross.toLocaleString()}
        </div>
      </header>
      <div className="p-4 grow">
        <BarChart data={chartData} width={595} height={248} />
      </div>
    </div>
  );
}

export default DashboardCard09;
