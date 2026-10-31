import React from "react";
import { cn } from "../../lib/utils";
import Button from "./Button";

/**
 * Standard Empty State Component
 * Displayed when collections, search queries, or user lists have no records.
 */
export const EmptyState = ({
  icon,
  title = "No items found",
  description = "There are no records to display at this time.",
  actionText,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl",
        "bg-surface border border-border-subtle shadow-xs",
        className
      )}
    >
      <div className="w-12 h-12 mb-4 rounded-full bg-surface-subtle flex items-center justify-center text-foreground-muted">
        {icon || (
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
          </svg>
        )}
      </div>

      <h3 className="text-base font-semibold text-foreground mb-1">
        {title}
      </h3>

      <p className="text-sm text-foreground-muted max-w-sm mb-6">
        {description}
      </p>

      {actionText && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

/**
 * Standard Error State Component with Retry Action
 */
export const ErrorState = ({
  title = "Something went wrong",
  message = "An error occurred while loading this data. Please try again.",
  onRetry,
  className,
}) => {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-xl",
        "bg-status-error-bg/50 border border-status-error/30",
        className
      )}
    >
      <div className="w-12 h-12 mb-4 rounded-full bg-status-error-bg flex items-center justify-center text-status-error">
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>

      <h3 className="text-base font-semibold text-status-error mb-1">
        {title}
      </h3>

      <p className="text-sm text-status-error/80 max-w-sm mb-5">
        {message}
      </p>

      {onRetry && (
        <Button variant="danger" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
