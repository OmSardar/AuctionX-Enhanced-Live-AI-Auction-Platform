import React, { useState, useRef, useId } from "react";
import { cn } from "../../lib/utils";

const positionClasses = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

/**
 * Accessible Tooltip Component
 * Activates on both mouse hover and keyboard focus.
 * Includes ARIA tooltip role and proper describedby linkage.
 */
export const Tooltip = ({
  content,
  children,
  position = "top",
  className,
  delay = 150,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef(null);
  const tooltipId = useId();

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  const handleFocus = () => setIsVisible(true);
  const handleBlur = () => setIsVisible(false);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {/* Trigger */}
      <span
        aria-describedby={isVisible ? tooltipId : undefined}
        tabIndex={0}
        className="inline-flex items-center cursor-help focus:outline-none focus:ring-2 focus:ring-ring-focus rounded"
      >
        {children}
      </span>

      {/* Tooltip Popup */}
      {isVisible && content && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            "absolute z-50 px-2.5 py-1.5 text-xs font-medium rounded-md shadow-md pointer-events-none whitespace-nowrap",
            "bg-slate-900 text-white dark:bg-surface-raised dark:text-foreground border border-border-strong",
            "animate-in fade-in-50 zoom-in-95 duration-150",
            positionClasses[position] || positionClasses.top,
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
