// src/components/LoaderManager.jsx
import { useState, useEffect } from "react";
import FirstLoadLoader from "./FirstLoadLoader";
import RefreshLoader from "./RefreshLoader";

const LoaderManager = ({ children }) => {
  const [isFirstLoad, setIsFirstLoad] = useState(
    !localStorage.getItem("__app_initial_load__")
  );
  const [showLoader, setShowLoader] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const handleLoadType = () => {
      // More reliable refresh detection
      const isRefresh =
        window.performance?.navigation?.type === 1 ||
        performance.getEntriesByType("navigation")[0]?.type === "reload";

      if (isRefresh) {
        setIsFirstLoad(false);
        setIsRefreshing(true);

        // Show refresh loader for minimum 800ms but max 2s
        const timer = setTimeout(() => {
          setIsRefreshing(false);
        }, 800);

        return () => clearTimeout(timer);
      } else if (isFirstLoad) {
        // Mark first load complete in localStorage
        localStorage.setItem("__app_initial_load__", "true");

        // Don't set a timeout here - let FirstLoadLoader control its own timing
      }
    };

    // Fallback for browsers without Performance API
    if (!window.performance || !performance.getEntriesByType) {
      setIsFirstLoad(!localStorage.getItem("__app_initial_load__"));
      setShowLoader(!localStorage.getItem("__app_initial_load__"));
      // Don't auto-hide - let FirstLoadLoader control timing
      localStorage.setItem("__app_initial_load__", "true");
      return;
    }

    handleLoadType();
  }, [isFirstLoad]);

  // Handle route changes without showing first load
  useEffect(() => {
    const handleRouteChange = () => {
      if (!isFirstLoad) {
        setIsRefreshing(true);
        const timer = setTimeout(() => setIsRefreshing(false), 500);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, [isFirstLoad]);

  return (
    <>
      {isFirstLoad && showLoader ? (
        <FirstLoadLoader onFinish={() => setShowLoader(false)} />
      ) : (
        <>
          {isRefreshing && <RefreshLoader />}
          {children}
        </>
      )}
    </>
  );
};

export default LoaderManager;
