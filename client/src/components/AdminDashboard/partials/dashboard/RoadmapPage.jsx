import React, { useState } from "react";
import { Milestone, CheckCircle2, Clock, Sparkles, Shield, Rocket } from "lucide-react";

const ROADMAP_ITEMS = [
  {
    stage: "Stage 1 — Core Architecture & Database",
    title: "Relational-Style MongoDB Schemas & Normalized Models",
    category: "Architecture",
    status: "Completed",
    date: "Q1 2026",
    description: "Multi-role schemas for users, sellers, and administrators with strict schema validation and indexed queries.",
  },
  {
    stage: "Stage 2 — Authoritative Bidding Integrity",
    title: "Server-Authoritative Bid Engine & Concurrency Control",
    category: "Bidding",
    status: "Completed",
    date: "Q2 2026",
    description: "Eliminated client-side bid amount forging with database-level atomic increments and transactional ledgering.",
  },
  {
    stage: "Stage 3 — Real-Time Lifecycle Orchestration",
    title: "Automated Auction Lifecycle & Scheduler Engine",
    category: "Orchestration",
    status: "Completed",
    date: "Q2 2026",
    description: "State-machine scheduler transitioning auctions through upcoming, active, completed, and closed states reliably.",
  },
  {
    stage: "Stage 4 — Dual 2FA & Google OAuth Integration",
    title: "Enterprise Dual 2FA (TOTP + Email OTP) & OAuth Hardening",
    category: "Security",
    status: "Completed",
    date: "Q3 2026",
    description: "Time-based OTP with replay protection, emergency single-use recovery codes, and provider-aware account security.",
  },
  {
    stage: "Stage 5 — Financial Settlement & Outbox Worker",
    title: "Durable Wallet Settlements & Webhook Idempotency",
    category: "Finance",
    status: "Completed",
    date: "Q3 2026",
    description: "Razorpay payment webhook signatures, zero-loss outbox reconciliation, and crash-safe transactional settlement.",
  },
  {
    stage: "Stage 6 — AI Recommendation & Telemetry Service",
    title: "FastAPI Content-Based & Collaborative Recommendation Engine",
    category: "AI/ML",
    status: "Completed",
    date: "Q4 2026",
    description: "Pseudonymous HMAC user telemetry, outbox event streaming, TF-IDF vector embeddings, and real-time live recommendation proxy.",
  },
  {
    stage: "Stage 7 — Cross-Panel Integration & Product Completion",
    title: "Admin Dashboard Audit, Real Data Pipelines & UI Polish",
    category: "Platform",
    status: "In-Progress",
    date: "Current Local",
    description: "End-to-end audit of all admin sections, elimination of dead placeholders, real database endpoints, and consistent visual polish.",
  },
  {
    stage: "Stage 8 — Public Staging & Reverse-Proxy Hardening",
    title: "Nginx Reverse Proxy & Multi-Region Controlled Staging",
    category: "DevOps",
    status: "Planned",
    date: "Upcoming",
    description: "Production-ready reverse proxying, TLS termination, gitleaks CI scanner verification, and asset quarantine validation.",
  },
];

export default function RoadmapPage() {
  const [filter, setFilter] = useState("all");

  const filteredItems = ROADMAP_ITEMS.filter((item) => {
    if (filter === "completed") return item.status === "Completed";
    if (filter === "in-progress") return item.status === "In-Progress";
    if (filter === "planned") return item.status === "Planned";
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "Completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case "In-Progress":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
            <Clock className="w-3 h-3" /> Active
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            <Rocket className="w-3 h-3" /> Planned
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-2xl border border-gray-100 dark:border-gray-700/60 p-5 sm:p-6 transition-colors">
      {/* Header */}
      <div className="sm:flex sm:justify-between sm:items-center pb-5 border-b border-gray-100 dark:border-gray-700/60 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2.5">
            <Milestone className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            AuctionX Product Roadmap & Milestones
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Authoritative progress tracker across all core engineering stages, architectural milestones, and public release gates.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="mt-3 sm:mt-0 flex gap-1.5">
          {["all", "completed", "in-progress", "planned"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer capitalize ${
                filter === f
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                  : "bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline items */}
      <div className="relative border-l-2 border-amber-500/30 dark:border-amber-600/40 ml-4 sm:ml-6 pl-4 sm:pl-6 space-y-6">
        {filteredItems.map((item, idx) => (
          <div key={idx} className="relative group">
            {/* Dot */}
            <div
              className={`absolute -left-[25px] sm:-left-[33px] top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 shadow-xs ${
                item.status === "Completed"
                  ? "bg-emerald-500"
                  : item.status === "In-Progress"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-gray-400"
              }`}
            />

            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/40 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 tracking-wide">
                  {item.stage}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">{item.date}</span>
                  {getStatusBadge(item.status)}
                </div>
              </div>

              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
                {item.title}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}