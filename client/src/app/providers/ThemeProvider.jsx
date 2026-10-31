import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";

const ThemeContext = createContext({
  currentTheme: "light",
  isDark: false,
  changeCurrentTheme: () => {},
  toggleTheme: () => {},
});

/**
 * Enterprise ThemeProvider for Auction X
 * Supports 'light' and 'dark' themes with automatic system preference fallback,
 * transition flash suppression, and synchronized localStorage persistence.
 */
export const ThemeProvider = ({ children }) => {
  const getInitialTheme = () => {
    try {
      const persisted = localStorage.getItem("theme");
      if (persisted === "light" || persisted === "dark") {
        return persisted;
      }
      if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    } catch {
      // Fallback in environments where localStorage or window is unavailable
    }
    return "light";
  };

  const [theme, setTheme] = useState(getInitialTheme);

  const changeCurrentTheme = useCallback((newTheme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem("theme", newTheme);
    } catch {
      // Ignore storage quota or access issues
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("theme", next);
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    // Temporarily suppress transitions to prevent jarring color flash during theme toggle
    const style = document.createElement("style");
    style.textContent = "*, *::before, *::after { transition: none !important; }";
    document.head.appendChild(style);

    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }

    const timer = setTimeout(() => {
      if (style.parentNode) {
        document.head.removeChild(style);
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      if (style.parentNode) {
        document.head.removeChild(style);
      }
    };
  }, [theme]);

  // Sync with system theme preference if user hasn't explicitly set localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e) => {
      try {
        const savedTheme = localStorage.getItem("theme");
        if (!savedTheme) {
          setTheme(e.matches ? "dark" : "light");
        }
      } catch {
        // Ignore
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      currentTheme: theme,
      isDark: theme === "dark",
      changeCurrentTheme,
      toggleTheme,
    }),
    [theme, changeCurrentTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;

export const useThemeProvider = () => useContext(ThemeContext);
export const useTheme = () => useContext(ThemeContext);
