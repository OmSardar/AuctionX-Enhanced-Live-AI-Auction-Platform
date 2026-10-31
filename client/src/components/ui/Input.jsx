import React, { forwardRef, useId } from "react";
import { cn } from "../../lib/utils";

/**
 * Enterprise Form Input Component
 * Includes accessible labeling, helper text, error handling, and icon slots.
 */
export const Input = forwardRef(
  (
    {
      id: customId,
      name,
      label,
      error,
      helperText,
      leadingIcon,
      trailingIcon,
      type = "text",
      disabled = false,
      required = false,
      className,
      wrapperClassName,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = customId || (name ? `input-${name}` : generatedId);
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className={cn("w-full flex flex-col gap-1.5", wrapperClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary select-none flex items-center justify-between"
          >
            <span>
              {label}
              {required && <span className="text-status-error ml-1" aria-hidden="true">*</span>}
            </span>
          </label>
        )}

        <div className="relative flex items-center">
          {leadingIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-foreground-muted" aria-hidden="true">
              {leadingIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            name={name}
            type={type}
            disabled={disabled}
            required={required}
            aria-invalid={!!error}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            className={cn(
              "w-full rounded-md border text-sm transition-colors",
              "bg-surface text-foreground",
              "placeholder:text-foreground-muted",
              "focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-canvas",
              "disabled:opacity-60 disabled:bg-surface-subtle disabled:cursor-not-allowed",
              leadingIcon ? "pl-9" : "pl-3",
              trailingIcon ? "pr-9" : "pr-3",
              "py-2",
              error
                ? "border-status-error focus:border-status-error focus:ring-status-error/30"
                : "border-border-default hover:border-border-strong focus:border-action-primary focus:ring-ring-focus",
              className
            )}
            {...props}
          />

          {trailingIcon && (
            <div className="absolute right-3 flex items-center text-foreground-muted">
              {trailingIcon}
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} className="text-xs text-status-error font-medium" role="alert">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-xs text-foreground-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
