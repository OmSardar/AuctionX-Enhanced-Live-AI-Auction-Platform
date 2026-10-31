import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";

const badgeVariants = {
  default:
    "bg-surface-subtle text-foreground border-border-subtle",
  primary:
    "bg-action-primary/10 text-action-primary border-action-primary/20",
  secondary:
    "bg-dashboard-accent-subtle text-dashboard-accent border-dashboard-accent/20",
  success:
    "bg-status-success-bg text-status-success border-status-success/20",
  warning:
    "bg-status-warning-bg text-status-warning border-status-warning/20",
  danger:
    "bg-status-error-bg text-status-error border-status-error/20",
  destructive:
    "bg-status-error-bg text-status-error border-status-error/20",
  info:
    "bg-status-info-bg text-status-info border-status-info/20",
  gold:
    "bg-brand-gold-subtle text-brand-gold border-brand-gold/30",
  outline:
    "bg-transparent text-foreground border-border-default",
};

const badgeSizes = {
  xs: "px-1.5 py-0.2 text-[10px] leading-tight",
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs font-semibold",
};

/**
 * Standard semantic Badge component
 */
export const Badge = forwardRef(
  ({ children, className, variant = "default", size = "sm", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 font-medium rounded-full border tabular-nums select-none transition-colors",
          badgeVariants[variant] || badgeVariants.default,
          badgeSizes[size] || badgeSizes.sm,
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
Badge.displayName = "Badge";

const auctionStatusConfig = {
  active: {
    label: "Live Auction",
    variant: "success",
    hasPulse: true,
  },
  live: {
    label: "Live Now",
    variant: "success",
    hasPulse: true,
  },
  ending: {
    label: "Ending Soon",
    variant: "danger",
    hasPulse: true,
  },
  reserve: {
    label: "Reserve Met",
    variant: "info",
    hasPulse: false,
  },
  upcoming: {
    label: "Upcoming",
    variant: "primary",
    hasPulse: false,
  },
  closed: {
    label: "Ended",
    variant: "default",
    hasPulse: false,
  },
  sold: {
    label: "Sold",
    variant: "secondary",
    hasPulse: false,
  },
  pending: {
    label: "Pending",
    variant: "warning",
    hasPulse: false,
  },
};

/**
 * Auction Domain Status Badge
 * Specifically engineered for auction lifecycle states (Live, Ending Soon, Closed, Reserve Met)
 */
export const StatusBadge = forwardRef(
  ({ status = "active", label, pulse, className, size = "sm", ...props }, ref) => {
    const normalizedKey = String(status).toLowerCase();
    const config = auctionStatusConfig[normalizedKey] || {
      label: status,
      variant: "default",
      hasPulse: false,
    };

    const shouldPulse = pulse !== undefined ? pulse : config.hasPulse;
    const displayLabel = label || config.label;

    return (
      <span
        ref={ref}
        role="status"
        aria-label={`Auction status: ${displayLabel}`}
        className={cn(
          "inline-flex items-center gap-1.5 font-semibold rounded-full border tabular-nums transition-colors",
          badgeVariants[config.variant] || badgeVariants.default,
          badgeSizes[size] || badgeSizes.sm,
          className
        )}
        {...props}
      >
        {shouldPulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
          </span>
        )}
        <span>{displayLabel}</span>
      </span>
    );
  }
);
StatusBadge.displayName = "StatusBadge";

export default Badge;
