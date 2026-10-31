import React from "react";
import LineChart from "@/shared/components/data-display/charts/LineChart01";
import { chartAreaGradient } from "@/shared/components/data-display/charts/ChartjsConfig";
import { adjustColorOpacity, getCssVariable } from "../../utils/Utils";

function DashboardCard02({ metrics }) {
  const labels = metrics?.dateLabels || metrics?.labels || [
    "10-01-2025",
    "11-01-2025",
    "12-01-2025",
    "01-01-2026",
    "02-01-2026",
    "03-01-2026",
  ];
  const seriesData = metrics?.platformFees || [0, 0, 0, 0, 0, 0];
  const totalAmount = metrics?.platformFees
    ? metrics.platformFees.reduce((acc, v) => acc + v, 0)
    : 0;

  const chartData = {
    labels,
    datasets: [
      {
        data: seriesData,
        fill: true,
        backgroundColor: function (context) {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          return chartAreaGradient(ctx, chartArea, [
            {
              stop: 0,
              color: adjustColorOpacity(
                getCssVariable("--color-sky-500"),
                0
              ),
            },
            {
              stop: 1,
              color: adjustColorOpacity(
                getCssVariable("--color-sky-500"),
                0.2
              ),
            },
          ]);
        },
        borderColor: getCssVariable("--color-sky-500"),
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointBackgroundColor: getCssVariable("--color-sky-500"),
        pointHoverBackgroundColor: getCssVariable("--color-sky-500"),
        pointBorderWidth: 0,
        pointHoverBorderWidth: 0,
        clip: 20,
        tension: 0.2,
      },
    ],
  };

  return (
    <div className="flex flex-col col-span-full sm:col-span-6 xl:col-span-4 bg-surface border border-border-subtle shadow-card rounded-2xl">
      <div className="px-5 pt-5 pb-2">
        <header className="flex justify-between items-start mb-2">
          <h2 className="text-base font-bold text-foreground">
            Platform Commission
          </h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            Net Revenue
          </span>
        </header>
        <div className="text-xs font-semibold text-foreground-muted uppercase mb-1">
          10% Settlement Margin
        </div>
        <div className="flex items-start">
          <div className="text-2xl sm:text-3xl font-bold font-display text-foreground mr-2">
            ₹{totalAmount.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="grow max-sm:max-h-[128px] xl:max-h-[128px]">
        <LineChart data={chartData} width={389} height={128} />
      </div>
    </div>
  );
}

export default DashboardCard02;
