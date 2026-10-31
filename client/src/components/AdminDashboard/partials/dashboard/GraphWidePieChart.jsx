import React from "react";
import DoughnutChart from "@/shared/components/data-display/charts/DoughnutChart";
import { getCssVariable } from "../../utils/Utils";

function DashboardCard06({ metrics }) {
  const rawLabels = metrics?.labels && metrics.labels.length > 0
    ? metrics.labels
    : ["Electronics", "Collectibles", "Art & Antiques", "Other"];
  const rawCounts = metrics?.counts && metrics.counts.length > 0
    ? metrics.counts
    : [0, 0, 0, 0];

  const chartData = {
    labels: rawLabels,
    datasets: [
      {
        label: "Items by Category",
        data: rawCounts,
        backgroundColor: [
          getCssVariable("--color-violet-500"),
          getCssVariable("--color-sky-500"),
          getCssVariable("--color-emerald-500"),
          getCssVariable("--color-amber-500"),
          getCssVariable("--color-rose-500"),
        ],
        hoverBackgroundColor: [
          getCssVariable("--color-violet-600"),
          getCssVariable("--color-sky-600"),
          getCssVariable("--color-emerald-600"),
          getCssVariable("--color-amber-600"),
          getCssVariable("--color-rose-600"),
        ],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="flex flex-col col-span-full sm:col-span-6 xl:col-span-4 bg-surface border border-border-subtle shadow-card rounded-2xl">
      <header className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 className="font-bold text-foreground">
            Top Auction Categories
          </h2>
          <p className="text-xs text-foreground-muted">
            Catalog distribution across product categories
          </p>
        </div>
      </header>
      <div className="p-4 grow flex items-center justify-center">
        <DoughnutChart data={chartData} width={389} height={260} />
      </div>
    </div>
  );
}

export default DashboardCard06;
