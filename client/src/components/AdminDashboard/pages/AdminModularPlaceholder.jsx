import React from "react";
import AdminDashboardShell from "../layouts/AdminDashboardShell";
import { Link } from "react-router-dom";
import { FaArrowLeft, FaTools } from "react-icons/fa";

/**
 * Modular Placeholder Component for Future Admin Stages (Users, Listings, Auctions).
 * Explicitly distinguishes foundation stages from future feature releases without
 * displaying fake data or implying non-functional controls.
 */
const AdminModularPlaceholder = ({
  title = "Module Under Development",
  moduleName = "Management Feature",
  stage = "Stage 2",
  description = "This administrative module is scheduled for implementation in upcoming stages.",
  plannedCapabilities = [],
}) => {
  return (
    <AdminDashboardShell>
          <div className=" p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Breadcrumb / Back Navigation */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-action-primary hover:underline transition-all"
            >
              <FaArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>

            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-action-primary/10 text-action-primary border border-action-primary/20">
              {stage} Roadmap
            </span>
          </div>

          {/* Core Modular Information Card */}
          <div className="p-8 sm:p-12 rounded-2xl border border-border-default bg-surface shadow-card text-center max-w-3xl mx-auto flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-action-primary/10 flex items-center justify-center text-action-primary text-2xl mb-5 shadow-xs">
              <FaTools />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground tracking-tight mb-2">
              {title}
            </h1>

            <p className="text-sm sm:text-base text-foreground-muted max-w-xl mb-8 leading-relaxed">
              {description}
            </p>

            {/* Planned Capabilities Overview */}
            {plannedCapabilities.length > 0 && (
              <div className="w-full text-left bg-surface-subtle p-5 sm:p-6 rounded-xl border border-border-subtle mb-8">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-3">
                  Scope for {moduleName}
                </h2>
                <ul className="space-y-2 text-xs sm:text-sm text-foreground-secondary">
                  {plannedCapabilities.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-action-primary mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/admin/dashboard"
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-action-primary hover:bg-action-primary-hover shadow-xs transition-all active:scale-95"
              >
                Return to Overview
              </Link>
            </div>
          </div>
        </div>
    </AdminDashboardShell>
  );
};

export default AdminModularPlaceholder;
