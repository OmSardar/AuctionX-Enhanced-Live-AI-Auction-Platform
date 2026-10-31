import React, { useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

const dialogSizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  full: "max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]",
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Enterprise Accessible Dialog (Modal) Component
 * Features: React Portal, focus trap containment (Tab & Shift+Tab),
 * focus restoration, Escape key listener, body scroll lock,
 * backdrop click dismissal, and ARIA modal semantics.
 */
export const Dialog = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  className,
  closeOnBackdrop = true,
  showCloseButton = true,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const previousActiveElement = useRef(null);

  const getFocusableElements = () => {
    if (!dialogRef.current) return [];
    return Array.from(dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null || el.getClientRects().length > 0
    );
  };

  // Focus preservation and initial focus
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = "hidden";

      requestAnimationFrame(() => {
        if (!dialogRef.current) return;
        const focusable = getFocusableElements();
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          dialogRef.current.focus();
        }
      });
    } else {
      document.body.style.overflow = "";
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === "function") {
        previousActiveElement.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle keyboard events (Escape dismissal & Tab focus trap)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === "Tab") {
        if (!dialogRef.current) return;

        const focusable = getFocusableElements();

        if (focusable.length === 0) {
          // If no focusable elements, prevent default to keep focus trapped in the dialog container
          event.preventDefault();
          if (document.activeElement !== dialogRef.current) {
            dialogRef.current.focus();
          }
          return;
        }

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (event.shiftKey) {
          // Shift + Tab (backwards)
          if (
            document.activeElement === firstElement ||
            document.activeElement === dialogRef.current ||
            !dialogRef.current.contains(document.activeElement)
          ) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab (forwards)
          if (
            document.activeElement === lastElement ||
            !dialogRef.current.contains(document.activeElement)
          ) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const dialogContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      {/* Modal Card */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full rounded-xl bg-surface-raised border border-border-subtle",
          "shadow-xl overflow-hidden focus:outline-none transition-all duration-200",
          dialogSizes[size] || dialogSizes.md,
          className
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-5 pb-4 border-b border-border-subtle">
            <div>
              {title && (
                <h2
                  id={titleId}
                  className="text-lg font-semibold text-foreground leading-snug"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id={descriptionId}
                  className="text-xs text-foreground-muted mt-1"
                >
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="rounded-lg p-1.5 text-foreground-muted hover:text-foreground hover:bg-surface-subtle transition-colors focus:outline-none focus:ring-2 focus:ring-ring-focus"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body Content */}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(dialogContent, document.body)
    : null;
};

export default Dialog;
