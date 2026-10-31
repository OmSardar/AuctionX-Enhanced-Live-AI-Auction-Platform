import React, { useState, useRef, useEffect, createContext, useContext } from "react";
import { cn } from "../../lib/utils";

const DropdownContext = createContext({
  isOpen: false,
  setIsOpen: () => {},
});

export const Dropdown = ({ children, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen }}>
      <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
};

export const DropdownTrigger = ({ children, className }) => {
  const { isOpen, setIsOpen } = useContext(DropdownContext);

  return (
    <div
      onClick={() => setIsOpen(!isOpen)}
      aria-haspopup="true"
      aria-expanded={isOpen}
      className={cn("cursor-pointer", className)}
    >
      {children}
    </div>
  );
};

export const DropdownMenu = ({ children, align = "right", className }) => {
  const { isOpen } = useContext(DropdownContext);

  if (!isOpen) return null;

  const alignClasses = {
    left: "left-0 origin-top-left",
    right: "right-0 origin-top-right",
  };

  return (
    <div
      role="menu"
      className={cn(
        "absolute z-50 mt-1.5 min-w-48 rounded-lg p-1.5 shadow-lg",
        "bg-surface-raised border border-border-subtle focus:outline-none",
        "animate-in fade-in-50 zoom-in-95 duration-100",
        alignClasses[align] || alignClasses.right,
        className
      )}
    >
      {children}
    </div>
  );
};

export const DropdownItem = ({
  children,
  onClick,
  disabled = false,
  danger = false,
  icon,
  className,
}) => {
  const { setIsOpen } = useContext(DropdownContext);

  const handleClick = (e) => {
    if (disabled) return;
    if (onClick) onClick(e);
    setIsOpen(false);
  };

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors text-left",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        danger
          ? "text-status-error hover:bg-status-error-bg"
          : "text-foreground hover:bg-surface-subtle",
        className
      )}
    >
      {icon && <span className="shrink-0 text-current opacity-70" aria-hidden="true">{icon}</span>}
      <span className="flex-1">{children}</span>
    </button>
  );
};

export const DropdownSeparator = ({ className }) => (
  <div className={cn("my-1 h-px bg-border-subtle", className)} role="separator" />
);

export default Dropdown;
