import React from "react";

import AdminDashboardShell from "../layouts/AdminDashboardShell";
import FilterButton from "../components/DropdownFilter";
import Datepicker from "../components/Datepicker";

import DashboardCard10 from "../partials/dashboard/FAQPage";

const FAQ = () => {
  return (
    <AdminDashboardShell>
          <div className="w-full">
          <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
            {/* Dashboard actions */}
            <div className="sm:flex sm:justify-between sm:items-center mb-8">
              {/* Left: Title */}
              <div className="mb-4 sm:mb-0">
                <h1 className="text-2xl md:text-3xl text-foreground font-bold font-display">
                  Dashboard
                </h1>
              </div>

              {/* Right: Actions */}
              <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
                {/* Filter button */}
                <FilterButton align="right" />
                {/* Datepicker built with React Day Picker */}
                <Datepicker align="right" />
                {/* Add view button */}
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-action-primary text-white hover:bg-action-primary-hover shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <svg
                    className="w-3.5 h-3.5 fill-current shrink-0"
                    viewBox="0 0 16 16"
                  >
                    <path d="M15 7H9V1c0-.6-.4-1-1-1S7 .4 7 1v6H1c-.6 0-1 .4-1 1s.4 1 1 1h6v6c0 .6.4 1 1 1s1-.4 1-1V9h6c.6 0 1-.4 1-1s-.4-1-1-1z" />
                  </svg>
                  <span>Add View</span>
                </button>
              </div>
            </div>

            {/* Cards */}
            <DashboardCard10 />
          </div>
        </div>
    </AdminDashboardShell>
  );
};

export default FAQ;
