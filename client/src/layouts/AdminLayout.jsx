import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import AdminDashboardShell from "@/components/AdminDashboard/layouts/AdminDashboardShell";
import { RouteLoadingFallback } from "@/shared/components/feedback";

const AdminLayout = ({ children }) => {
  return (
    <AdminDashboardShell>
      <Suspense fallback={<RouteLoadingFallback />}>
        {children || <Outlet />}
      </Suspense>
    </AdminDashboardShell>
  );
};

export default AdminLayout;
