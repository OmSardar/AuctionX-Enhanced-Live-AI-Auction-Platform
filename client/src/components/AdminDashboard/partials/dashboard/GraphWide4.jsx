import React from "react";
import BarChart from "@/shared/components/data-display/charts/BarChart01";
import { getCssVariable } from "../../utils/Utils";

function DashboardCard04({ metrics }) {
  const deposits = metrics?.deposits || 0;
  const withdrawals = metrics?.withdrawals || 0;

  const chartData = {
    labels: ["Wallet Deposits", "Processed Withdrawals"],
    datasets: [
      {
        label: "Cashflow (₹)",
        data: [deposits, withdrawals],
        backgroundColor: [
          getCssVariable("--color-emerald-500"),
          getCssVariable("--color-sky-500"),
        ],
        hoverBackgroundColor: [
          getCssVariable("--color-emerald-600"),
          getCssVariable("--color-sky-600"),
        ],
        barPercentage: 0.6,
        categoryPercentage: 0.7,
        borderRadius: 8,
      },
    ],
  };

  return (
    <div className="flex flex-col col-span-full sm:col-span-6 bg-surface border border-border-subtle shadow-card rounded-2xl">
      <header className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 className="font-bold text-foreground">
            Financial Cashflow
          </h2>
          <p className="text-xs text-foreground-muted">
            Total wallet deposits vs processed user/seller withdrawals
          </p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-action-primary/10 text-action-primary border border-action-primary/20">
          Net: ₹{(deposits - withdrawals).toLocaleString()}
        </span>
      </header>
      <div className="p-4 grow">
        <BarChart data={chartData} width={595} height={248} />
      </div>
    </div>
  );
}

export default DashboardCard04;
