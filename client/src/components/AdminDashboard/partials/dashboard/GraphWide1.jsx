import React from "react";
import LineChart from "@/shared/components/data-display/charts/LineChart01";
import { chartAreaGradient } from "@/shared/components/data-display/charts/ChartjsConfig";
import { adjustColorOpacity, getCssVariable } from "../../utils/Utils";

function DashboardCard01({ metrics }) {
  // Use real database values if provided, or empty baseline
  const labels = metrics?.dateLabels || metrics?.labels || [
    "10-01-2025",
    "11-01-2025",
    "12-01-2025",
    "01-01-2026",
    "02-01-2026",
    "03-01-2026",
  ];
  const seriesData = metrics?.grossSales || [0, 0, 0, 0, 0, 0];
  const totalAmount = metrics?.grossSales
    ? metrics.grossSales.reduce((acc, v) => acc + v, 0)
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
                getCssVariable("--color-violet-500"),
                0
              ),
            },
            {
              stop: 1,
              color: adjustColorOpacity(
                getCssVariable("--color-violet-500"),
                0.2
              ),
            },
          ]);
        },
        borderColor: getCssVariable("--color-violet-500"),
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
    ],
  };

  return (
    <div className="flex flex-col col-span-full sm:col-span-6 xl:col-span-4 bg-surface border border-border-subtle shadow-card rounded-2xl">
      <div className="px-5 pt-5 pb-2">
        <header className="flex justify-between items-start mb-2">
          <h2 className="text-base font-bold text-foreground">
            Gross Platform Sales
          </h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-action-primary/10 text-action-primary border border-action-primary/20">
            Real Data
          </span>
        </header>
        <div className="text-xs font-semibold text-foreground-muted uppercase mb-1">
          Total Settled Volume
        </div>
        <div className="flex items-start">
          <div className="text-2xl sm:text-3xl font-bold font-display text-foreground mr-2">
            ₹{totalAmount.toLocaleString()}
          </div>
        </div>
      </div>
      {/* Chart container */}
      <div className="grow max-sm:max-h-[128px] xl:max-h-[128px]">
        <LineChart data={chartData} width={389} height={128} />
      </div>
    </div>
  );
}

export default DashboardCard01;
