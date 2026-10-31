import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * ScrollRestoration Component for React Router v7
 *
 * Implements predictable, history-aware scroll restoration:
 * 1. PUSH / NEW ROUTE: Resets document scroll to (0, 0) immediately and across frame paints.
 * 2. SEARCH -> DETAIL: Navigating from search results to /posts/:id or /product/:id opens at top.
 * 3. POP (Back/Forward): Restores the exact saved scroll position for that history entry.
 * 4. HASH NAVIGATION: If a hash is present (#section-id), scrolls to the matching element.
 * 5. SAME-PATH QUERY/STATE CHANGES: Preserves current scroll position if only query params change.
 * 6. DIRECT URL / REFRESH: Fresh navigation to a URL always starts at (0, 0); refresh restores current page coordinates.
 * 7. ASYNC RESILIENCE: If the page hasn't finished loading content when POP occurs, uses a MutationObserver
 *    to restore scroll as soon as the DOM height expands to accommodate the target position.
 * 8. BROWSER COOPERATION: Configures `window.history.scrollRestoration = 'manual'` to prevent
 *    browser native scroll jumps from competing with React Router.
 */
export const ScrollRestoration = () => {
  const location = useLocation();
  const navigationType = useNavigationType();

  const positionsRef = useRef(new Map());
  const activeKeyRef = useRef(location.key);
  const activePathRef = useRef(location.pathname);
  const prevPathnameRef = useRef(location.pathname);
  const isInitialMountRef = useRef(true);

  // 1. Configure browser to manual scroll restoration
  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  // 2. Track active scroll position continuously, keyed by entry key & path
  useEffect(() => {
    activeKeyRef.current = location.key;
    activePathRef.current = location.pathname;

    let rafId = null;
    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const x = window.scrollX || window.pageXOffset || 0;
        const y = window.scrollY || window.pageYOffset || 0;
        const key = activeKeyRef.current;
        const path = activePathRef.current;
        const storageKey = `auctionx_scroll_${key}_${path}`;

        positionsRef.current.set(storageKey, { x, y });
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({ x, y }));
        } catch (e) {
          // Ignore storage quota or privacy restrictions
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [location.key, location.pathname]);

  // 3. Handle route transitions, Back/Forward, and hash scrolling
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const isInitialMount = isInitialMountRef.current;
    isInitialMountRef.current = false;

    const currentPath = location.pathname;
    const prevPath = prevPathnameRef.current;
    prevPathnameRef.current = currentPath;

    const isPop = navigationType === "POP";
    const isSamePath = prevPath === currentPath;

    // Helper to firmly reset scroll to top
    const resetToTop = () => {
      window.scrollTo({ left: 0, top: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    // Handle initial mount (direct URL load or browser refresh)
    if (isInitialMount) {
      const navEntry = performance.getEntriesByType?.("navigation")?.[0];
      const isReload =
        navEntry?.type === "reload" ||
        window.performance?.navigation?.type === 1;

      if (!isReload) {
        // Direct URL visit must start at top
        resetToTop();
        requestAnimationFrame(resetToTop);
        return;
      }
      // If reload, allow recovery of previous position if available below
    }

    // Handle hash scrolling if present
    if (location.hash) {
      const targetId = location.hash.slice(1);
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView();
        return;
      }
    }

    // Preserve scroll position if navigating with query params on the same pathname
    if (!isInitialMount && isSamePath && !isPop) {
      return;
    }

    // Handle POP (Browser Back/Forward navigation or refresh recovery)
    if (isPop && !isInitialMount) {
      const storageKey = `auctionx_scroll_${location.key}_${currentPath}`;
      let saved = positionsRef.current.get(storageKey);
      if (!saved) {
        try {
          const stored = sessionStorage.getItem(storageKey);
          if (stored) saved = JSON.parse(stored);
        } catch (e) {}
      }

      if (saved && typeof saved.y === "number" && saved.y > 0) {
        const targetX = saved.x || 0;
        const targetY = saved.y;

        const maxScrollY = Math.max(
          document.documentElement.scrollHeight - window.innerHeight,
          0
        );

        if (maxScrollY >= targetY) {
          window.scrollTo({ left: targetX, top: targetY, behavior: "instant" });
        } else {
          // Document may still be rendering asynchronous data.
          // Restore to current max and observe DOM mutations until document reaches required height.
          window.scrollTo({ left: targetX, top: maxScrollY, behavior: "instant" });

          let observer = null;
          let safetyTimer = null;

          const cleanup = () => {
            if (observer) {
              observer.disconnect();
              observer = null;
            }
            if (safetyTimer) {
              clearTimeout(safetyTimer);
              safetyTimer = null;
            }
            window.removeEventListener("wheel", cleanup);
            window.removeEventListener("touchstart", cleanup);
          };

          observer = new MutationObserver(() => {
            const currentMax = Math.max(
              document.documentElement.scrollHeight - window.innerHeight,
              0
            );
            if (currentMax >= targetY) {
              window.scrollTo({
                left: targetX,
                top: targetY,
                behavior: "instant",
              });
              cleanup();
            }
          });

          observer.observe(document.body, { childList: true, subtree: true });
          window.addEventListener("wheel", cleanup, {
            passive: true,
            once: true,
          });
          window.addEventListener("touchstart", cleanup, {
            passive: true,
            once: true,
          });
          safetyTimer = setTimeout(cleanup, 2000);
        }
        return;
      }
    }

    // Standard PUSH / NEW PAGE / Non-reload initial load: start at top of main document
    resetToTop();
    requestAnimationFrame(resetToTop);
  }, [location.pathname, location.search, location.hash, location.key, navigationType]);

  return null;
};

export default ScrollRestoration;
