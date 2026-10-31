import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import SellerNavbar from "@/pages/Seller/Layouts/SellerNavbar/SellerNavbar";
import SellerFooter from "@/pages/Seller/Layouts/SellerFooter/SellerFooter";
import { RouteLoadingFallback } from "@/shared/components/feedback";

const SellerLayout = ({ showNavbarAndFooter = true }) => {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-foreground transition-colors duration-200">
      {showNavbarAndFooter && <SellerNavbar />}
      <div className="main-content flex-grow pt-16 lg:pt-20">
        <main>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      {showNavbarAndFooter && <SellerFooter />}
    </div>
  );
};

export default SellerLayout;
