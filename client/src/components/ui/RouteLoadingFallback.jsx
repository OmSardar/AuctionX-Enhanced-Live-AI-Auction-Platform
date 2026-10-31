import React from "react";
import { Skeleton } from "./Skeleton";
import { cn } from "../../lib/utils";

/**
 * RouteLoadingFallback Component
 * Accessible, lightweight page-level skeleton rendered during lazy route transitions.
 * Fully compatible with both light and dark themes.
 */
export const RouteLoadingFallback = ({ className }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page content"
      className={cn(
        "min-h-[60vh] w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in-50 duration-200",
        className
      )}
    >
      {/* Top Header Placeholder */}
      <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 sm:w-64 rounded-md" />
          <Skeleton className="h-4 w-32 sm:w-40 rounded-sm" />
        </div>
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>

      {/* Hero / Banner Skeleton */}
      <Skeleton className="w-full h-44 sm:h-56 rounded-2xl" />

      {/* Content Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
        {[1, 2, 3].map((key) => (
          <div
            key={key}
            className="p-4 rounded-xl border border-border-subtle bg-surface space-y-3"
          >
            <Skeleton className="w-full h-36 rounded-lg" />
            <Skeleton className="h-5 w-3/4 rounded-sm" />
            <Skeleton className="h-4 w-1/2 rounded-sm" />
            <div className="flex justify-between items-center pt-2">
              <Skeleton className="h-4 w-20 rounded-sm" />
              <Skeleton className="h-7 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Screen reader only status */}
      <span className="sr-only">Loading page content, please wait...</span>
    </div>
  );
};

export default RouteLoadingFallback;
