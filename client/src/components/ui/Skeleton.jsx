import React from "react";
import { cn } from "../../lib/utils";

/**
 * Shimmer Loading Skeleton Component
 * Provides fluid loading placeholders that match the light/dark palette.
 */
export const Skeleton = ({
  className,
  variant = "rectangular",
  width,
  height,
  style,
  ...props
}) => {
  const variantStyles = {
    text: "h-4 w-full rounded-sm",
    circular: "rounded-full",
    rectangular: "rounded-md",
    card: "w-full h-48 rounded-lg",
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse bg-surface-subtle",
        variantStyles[variant] || variantStyles.rectangular,
        className
      )}
      style={{
        width,
        height,
        ...style,
      }}
      {...props}
    />
  );
};

/**
 * Pre-composed Auction Card Skeleton for immediate use in product feeds
 */
export const AuctionCardSkeleton = ({ className }) => {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-lg border border-border-subtle bg-surface p-4 flex flex-col gap-3 shadow-xs",
        className
      )}
    >
      <Skeleton className="w-full h-44 rounded-md" />
      <div className="flex justify-between items-center pt-1">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex justify-between items-center pt-2 border-t border-border-subtle">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </div>
  );
};

export default Skeleton;
