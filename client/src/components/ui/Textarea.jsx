import React, { forwardRef, useId } from "react";
import { cn } from "../../lib/utils";

/**
 * Enterprise Form Textarea Component
 * Multi-line input with accessible error state, label, and character counter support.
 */
export const Textarea = forwardRef(
  (
    {
      id: customId,
      name,
      label,
      error,
      helperText,
      disabled = false,
      required = false,
      rows = 3,
      className,
      wrapperClassName,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = customId || (name ? `textarea-${name}` : generatedId);
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    return (
      <div className={cn("w-full flex flex-col gap-1.5", wrapperClassName)}>
        {label && (
          <label
            htmlFor={textareaId}
            className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary select-none flex items-center justify-between"
          >
            <span>
              {label}
              {required && <span className="text-status-error ml-1" aria-hidden="true">*</span>}
            </span>
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          name={name}
          rows={rows}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={cn(
            "w-full rounded-md border text-sm transition-colors p-3",
            "bg-surface text-foreground",
            "placeholder:text-foreground-muted",
            "focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-canvas",
            "disabled:opacity-60 disabled:bg-surface-subtle disabled:cursor-not-allowed",
            error
              ? "border-status-error focus:border-status-error focus:ring-status-error/30"
              : "border-border-default hover:border-border-strong focus:border-action-primary focus:ring-ring-focus",
            className
          )}
          {...props}
        />

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

Textarea.displayName = "Textarea";

export default Textarea;
