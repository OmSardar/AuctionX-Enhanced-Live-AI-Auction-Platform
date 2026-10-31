import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";
import soundManager from "../../utils/soundManager";

const variantStyles = {
  primary:
    "bg-action-primary text-white hover:bg-action-primary-hover active:bg-action-primary-active border border-transparent shadow-xs focus-visible:ring-2 focus-visible:ring-ring-focus",
  secondary:
    "bg-[#E8D8C3] text-[#542B21] hover:bg-[#D4C0A8] active:bg-[#B39E82] border border-border-subtle shadow-xs focus-visible:ring-2 focus-visible:ring-ring-focus dark:bg-surface-subtle dark:text-foreground",
  outline:
    "bg-transparent text-[#7F3828] border border-border-subtle hover:bg-surface-subtle hover:border-border-default active:bg-action-secondary focus-visible:ring-2 focus-visible:ring-ring-focus dark:text-primary-300 dark:border-border-default",
  ghost:
    "bg-transparent text-foreground-secondary hover:bg-surface-subtle active:bg-action-secondary border border-transparent shadow-none focus-visible:ring-2 focus-visible:ring-ring-focus",
  danger:
    "bg-action-destructive text-white hover:bg-action-destructive-hover active:bg-action-destructive-active border border-transparent shadow-xs focus-visible:ring-2 focus-visible:ring-action-destructive",
  destructive:
    "bg-action-destructive text-white hover:bg-action-destructive-hover active:bg-action-destructive-active border border-transparent shadow-xs focus-visible:ring-2 focus-visible:ring-action-destructive",
  success:
    "bg-status-success text-white hover:bg-status-success/90 active:bg-status-success/80 border border-transparent shadow-xs focus-visible:ring-2 focus-visible:ring-status-success",
  gold:
    "bg-brand-gold text-gray-950 hover:bg-brand-gold-hover active:bg-yellow-600 font-semibold border border-transparent shadow-xs focus-visible:ring-2 focus-visible:ring-brand-gold",
};

const sizeStyles = {
  xs: "h-7 px-2.5 text-xs font-medium rounded-lg gap-1.5",
  sm: "h-8 px-3 text-xs font-medium rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm font-medium rounded-lg gap-2",
  lg: "h-12 px-6 text-base font-semibold rounded-lg gap-2.5",
  icon: "h-10 w-10 p-0 text-sm rounded-lg inline-flex items-center justify-center shrink-0",
  "icon-sm": "h-8 w-8 p-0 text-xs rounded-lg inline-flex items-center justify-center shrink-0",
  "icon-lg": "h-12 w-12 p-0 text-base rounded-lg inline-flex items-center justify-center shrink-0",
};

/**
 * Enterprise Accessible Button Component
 * Supports multiple semantic variants, sizes, loading spinners, and icon slots.
 */
export const Button = forwardRef(
  (
    {
      children,
      className,
      variant = "primary",
      size = "md",
      type = "button",
      disabled = false,
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      soundFeedback = true,
      onClick,
      onMouseEnter,
      onFocus,
      ...props
    },
    ref
  ) => {
    const isInteractive = !disabled && !isLoading;

    const handleClick = (e) => {
      if (isInteractive && soundFeedback) {
        if (!e.__soundHandled) {
          e.__soundHandled = true;
          soundManager.playClick();
        }
      }
      onClick?.(e);
    };

    const handleMouseEnter = (e) => {
      if (isInteractive && soundFeedback) {
        soundManager.playHover();
      }
      onMouseEnter?.(e);
    };

    const handleFocus = (e) => {
      onFocus?.(e);
    };

    return (
      <button
        ref={ref}
        type={type}
        data-sound={soundFeedback ? undefined : "none"}
        disabled={!isInteractive}
        aria-busy={isLoading}
        aria-disabled={!isInteractive}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onFocus={handleFocus}
        className={cn(
          "inline-flex items-center justify-center font-medium border transition-colors select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-canvas",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          variantStyles[variant] || variantStyles.primary,
          sizeStyles[size] || sizeStyles.md,
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0" aria-hidden="true">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="inline-flex shrink-0" aria-hidden="true">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
