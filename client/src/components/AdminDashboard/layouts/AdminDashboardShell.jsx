import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../partials/Sidebar";
import Header from "../partials/Header";

/**
 * AdminDashboardShell
 *
 * Unified layout container for all AuctionX administrative routes.
 * Guarantees:
 * 1. Independent, smooth mouse-wheel & trackpad scrolling with data-lenis-prevent.
 * 2. Automatic scroll-to-top on route changes without layout shifts.
 * 3. Consistent AuctionX theme tokens (warm espresso/canvas dark and warm cream light mode).
 * 4. Responsive sidebar drawer management on mobile and desktop.
 */
export const AdminDashboardShell = ({ children, headerVariant = "default" }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollContainerRef = useRef(null);
  const location = useLocation();

  // Scroll to top of main content container on administrative route changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [location.pathname]);

  return (
    <div
      className="flex h-screen overflow-hidden bg-canvas text-foreground transition-colors duration-200"
      data-lenis-prevent="true"
    >
      {/* Sidebar Navigation */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        variant={headerVariant}
      />

      {/* Main Content Scroll Area */}
      <div
        id="admin-main-scroll-container"
        ref={scrollContainerRef}
        data-lenis-prevent="true"
        className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden overscroll-contain focus:outline-none"
        tabIndex={-1}
      >
        {/* Site Header */}
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          variant={headerVariant}
        />

        {/* Dynamic Route Content */}
        <main className="grow" role="main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboardShell;
