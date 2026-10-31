import React from "react";
import { useTheme } from "../../app/providers/ThemeProvider";
import { cn } from "../../lib/utils";

/**
 * Universal Theme Toggle Component
 * Consumes the canonical ThemeProvider with accessible aria-label and smooth icon transitions.
 */
export const ThemeToggle = ({ className, showLabel = false }) => {
  const { currentTheme, changeCurrentTheme, isDark } = useTheme();

  const handleToggle = () => {
    changeCurrentTheme(currentTheme === "light" ? "dark" : "light");
  };

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <input
        type="checkbox"
        name="theme-toggle"
        id="theme-toggle-switch"
        className="sr-only"
        checked={isDark}
        onChange={handleToggle}
      />
      <label
        htmlFor="theme-toggle-switch"
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        className="flex items-center justify-center cursor-pointer w-8 h-8 rounded-full transition-colors hover:bg-surface-subtle text-foreground-secondary hover:text-foreground focus-within:ring-2 focus-within:ring-ring-focus"
      >
        {/* Sun Icon (shown in dark mode to switch to light) */}
        <svg
          className={cn("w-4 h-4 fill-current", isDark ? "block" : "hidden")}
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M8 0a1 1 0 0 1 1 1v.5a1 1 0 1 1-2 0V1a1 1 0 0 1 1-1Z" />
          <path d="M12 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-4 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
          <path d="M13.657 3.757a1 1 0 0 0-1.414-1.414l-.354.354a1 1 0 0 0 1.414 1.414l.354-.354ZM13.5 8a1 1 0 0 1 1-1h.5a1 1 0 1 1 0 2h-.5a1 1 0 0 1-1-1ZM13.303 11.889a1 1 0 0 0-1.414 1.414l.354.354a1 1 0 0 0 1.414-1.414l-.354-.354ZM8 13.5a1 1 0 0 1 1 1v.5a1 1 0 1 1-2 0v-.5a1 1 0 0 1 1-1ZM4.111 13.303a1 1 0 1 0-1.414-1.414l-.354.354a1 1 0 1 0 1.414 1.414l.354-.354ZM0 8a1 1 0 0 1 1-1h.5a1 1 0 0 1 0 2H1a1 1 0 0 1-1-1ZM3.757 2.343a1 1 0 1 0-1.414 1.414l.354.354A1 1 0 1 0 4.11 2.697l-.354-.354Z" />
        </svg>

        {/* Moon Icon (shown in light mode to switch to dark) */}
        <svg
          className={cn("w-4 h-4 fill-current", isDark ? "hidden" : "block")}
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M7.019 1.985a1.55 1.55 0 0 0-.483-1.36 1.44 1.44 0 0 0-1.53-.277C2.056 1.553 0 4.5 0 7.9 0 12.352 3.648 16 8.1 16c3.407 0 6.246-2.058 7.51-4.963a1.446 1.446 0 0 0-.25-1.55 1.554 1.554 0 0 0-1.372-.502c-4.01.552-7.539-2.987-6.97-7ZM2 7.9C2 5.64 3.193 3.664 4.961 2.6 4.82 7.245 8.72 11.158 13.36 11.04 12.265 12.822 10.341 14 8.1 14 4.752 14 2 11.248 2 7.9Z" />
        </svg>

        <span className="sr-only">Toggle color scheme</span>
      </label>

      {showLabel && (
        <span className="text-xs font-medium text-foreground-secondary select-none">
          {isDark ? "Dark Mode" : "Light Mode"}
        </span>
      )}
    </div>
  );
};

export default ThemeToggle;
