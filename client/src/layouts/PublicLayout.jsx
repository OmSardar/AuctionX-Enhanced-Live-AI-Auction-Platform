import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { RouteLoadingFallback } from "@/shared/components/feedback";

const PublicLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-canvas text-foreground transition-colors duration-200">
      <Suspense fallback={<RouteLoadingFallback />}>
        {children || <Outlet />}
      </Suspense>
    </div>
  );
};

export default PublicLayout;
