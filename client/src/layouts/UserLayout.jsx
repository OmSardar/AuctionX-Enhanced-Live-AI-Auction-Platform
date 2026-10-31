import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "@/pages/Layouts/Navbar/Navbar";
import Footer from "@/pages/Layouts/Footer/Footer";
import { RouteLoadingFallback } from "@/shared/components/feedback";

const UserLayout = ({ showNavbarAndFooter = true }) => {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-foreground transition-colors duration-200">
      {showNavbarAndFooter && <Navbar />}
      <div className="main-content flex-grow pt-16 lg:pt-20">
        <main>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      {showNavbarAndFooter && <Footer />}
    </div>
  );
};

export default UserLayout;
