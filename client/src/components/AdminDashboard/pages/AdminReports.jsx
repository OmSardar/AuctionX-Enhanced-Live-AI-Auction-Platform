import React from "react";
import AdminDashboardShell from "../layouts/AdminDashboardShell";
import ReportPage from "../partials/dashboard/ReportsPage";

const Reports = () => {
  return (
    <AdminDashboardShell>
          <div className="w-full">
          <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
            {/* Dashboard actions */}
            <div className="sm:flex sm:justify-between sm:items-center mb-8">
              {/* Left: Title */}
              <div className="mb-4 sm:mb-0">
                <h1 className="text-2xl md:text-3xl text-foreground font-bold font-display">
                  Incident & Abuse Reports
                </h1>
              </div>
            </div>

            {/* Cards */}
            <div className="w-full">
              {/* Card (Customers) */}
              <ReportPage />
            </div>
          </div>
        </div>
    </AdminDashboardShell>
  );
};

export default Reports;
