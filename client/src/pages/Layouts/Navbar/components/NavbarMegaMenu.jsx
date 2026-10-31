import React, { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { CATEGORIES } from "../constants/categories";
import { cn } from "../../../../lib/utils";

/**
 * NavbarMegaMenu Component
 * Accessible, 6-column mega menu for 14 auction categories and 100+ subcategories.
 */
export const NavbarMegaMenu = ({
  isOpen = false,
  onOpen,
  onClose,
  categories = CATEGORIES,
  className,
}) => {
  const menuRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      ref={menuRef}
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      className={cn("relative", className)}
    >
      <button
        type="button"
        onClick={() => (isOpen ? onClose?.() : onOpen?.())}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Browse categories"
        className={cn(
          "inline-flex items-center gap-1.5 text-base font-medium transition-colors cursor-pointer select-none",
          "text-foreground hover:text-action-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus rounded-md px-2 py-1",
          isOpen && "text-action-primary"
        )}
      >
        <span>Categories</span>
        <svg
          className={cn(
            "w-4 h-4 transition-transform duration-200 opacity-70",
            isOpen && "rotate-180"
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Mega Menu Dropdown Panel */}
      <div
        className={cn(
          "fixed top-16 lg:top-20 left-1/2 -translate-x-1/2 z-50",
          "w-[95vw] max-w-6xl p-6 rounded-2xl shadow-2xl",
          "bg-surface/95 backdrop-blur-md",
          "border border-border-subtle",
          "transition-all duration-200 ease-out",
          isOpen
            ? "opacity-100 visible translate-y-0 pointer-events-auto"
            : "opacity-0 invisible -translate-y-2 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-action-primary animate-pulse" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted">
              Auction Categories
            </h3>
          </div>
          <Link
            to="/category"
            onClick={onClose}
            className="text-xs font-medium text-action-primary hover:underline flex items-center gap-1"
          >
            View All Categories
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>

        <div
          tabIndex={0}
          aria-label="Categories list"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 max-h-[520px] overflow-y-auto pr-2 focus:outline-none"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(156, 163, 175, 0.4) transparent",
          }}
        >
          {Object.entries(categories).map(([category, subcategories]) => (
            <div key={category} className="space-y-2">
              <h4 className="font-semibold text-xs text-foreground uppercase tracking-wide border-b border-border-subtle pb-1.5">
                {category}
              </h4>
              <ul className="space-y-1">
                {subcategories.map((subcategory) => (
                  <li key={subcategory}>
                    <Link
                      to={`/category/${subcategory.replace(/\s+/g, "-")}`}
                      onClick={onClose}
                      className={cn(
                        "text-xs text-foreground-secondary block py-0.5 rounded",
                        "hover:text-action-primary hover:translate-x-0.5",
                        "transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring-focus"
                      )}
                    >
                      {subcategory}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NavbarMegaMenu;
