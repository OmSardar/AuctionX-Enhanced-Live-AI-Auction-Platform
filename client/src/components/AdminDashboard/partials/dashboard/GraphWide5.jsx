import React from "react";
import { Gavel, Activity, CheckCircle, Flame } from "lucide-react";

function DashboardCard05({ metrics }) {
  const activeAuctions = metrics?.activeAuctions || 0;
  const totalBids = metrics?.totalBids || 0;
  const completionRate = metrics?.completionRate || 0;
  const avgCurrentPrice = metrics?.avgCurrentPrice || 0;

  return (
    <div className="flex flex-col col-span-full sm:col-span-6 xl:col-span-4 bg-surface border border-border-subtle shadow-card rounded-2xl p-5 justify-between">
      <div>
        <header className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-action-primary" />
            <h2 className="text-base font-bold text-foreground">
              Live Auction Telemetry
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            LIVE
          </span>
        </header>
        <p className="text-xs text-foreground-muted mb-4">
          Real-time bidding density and auction resolution rates from the database.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-surface-subtle border border-border-subtle">
            <span className="text-[11px] text-foreground-muted flex items-center gap-1">
              <Gavel className="w-3.5 h-3.5 text-action-primary" /> Active Auctions
            </span>
            <div className="text-2xl font-bold font-display text-foreground mt-1">
              {activeAuctions.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-surface-subtle border border-border-subtle">
            <span className="text-[11px] text-foreground-muted flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" /> Total Bids
            </span>
            <div className="text-2xl font-bold font-display text-foreground mt-1">
              {totalBids.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-3 border-t border-border-subtle text-xs">
        <div className="flex justify-between items-center">
          <span className="text-foreground-muted flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Completion Rate:
          </span>
          <span className="font-semibold text-foreground">{completionRate}%</span>
        </div>
        <div className="w-full bg-surface-subtle rounded-full h-2 border border-border-subtle overflow-hidden">
          <div
            className="bg-action-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }}
          ></div>
        </div>
        <div className="flex justify-between items-center pt-1 text-[11px] text-foreground-muted">
          <span>Avg Winning Price:</span>
          <span className="font-mono font-semibold text-foreground">₹{avgCurrentPrice.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export default DashboardCard05;
