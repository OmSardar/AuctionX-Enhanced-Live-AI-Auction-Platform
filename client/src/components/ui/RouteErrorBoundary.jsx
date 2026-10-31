import React, { Component } from "react";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

/**
 * RouteErrorBoundary Component
 * Catches dynamic chunk loading failures and route errors gracefully.
 * Provides accessible recovery actions (reload page, return to home) instead of a blank screen.
 */
export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Route chunk loading error caught by boundary:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const isChunkLoadFailed =
        this.state.error?.message?.includes("Failed to fetch dynamically imported module") ||
        this.state.error?.message?.includes("dynamically imported module") ||
        this.state.error?.name === "ChunkLoadError";

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-[50vh] flex items-center justify-center px-4 py-12"
        >
          <div
            className={cn(
              "w-full max-w-md p-6 sm:p-8 text-center rounded-2xl shadow-xl",
              "bg-surface-raised border border-border-subtle"
            )}
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-status-warning-bg text-status-warning flex items-center justify-center">
              <svg
                className="w-7 h-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-foreground mb-2">
              {isChunkLoadFailed
                ? "Update Available or Network Interruption"
                : "Unable to Load Page"}
            </h2>

            <p className="text-sm text-foreground-muted mb-6 leading-relaxed">
              {isChunkLoadFailed
                ? "A new version of AuctionX may have been deployed, or your internet connection was temporarily interrupted. Please refresh to load the latest version."
                : "An unexpected error occurred while loading this view. You can retry loading or return to the home page."}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={this.handleRetry}
                className="w-full sm:w-auto"
              >
                Refresh Page
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto"
              >
                Go to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
