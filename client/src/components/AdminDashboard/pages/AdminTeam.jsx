import React from "react";
import AdminDashboardShell from "../layouts/AdminDashboardShell";
import ManageTeamPage from "../partials/dashboard/ManageTeamPage";

const AdminTeam = () => {
  return (
    <AdminDashboardShell>
          <div className="w-full">
          <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
            <ManageTeamPage />
          </div>
        </div>
    </AdminDashboardShell>
  );
};

export default AdminTeam;
