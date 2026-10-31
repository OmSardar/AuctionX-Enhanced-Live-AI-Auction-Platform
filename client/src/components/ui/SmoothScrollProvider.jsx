import React, { createContext, useContext, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import Lenis from "@studio-freight/lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const SmoothScrollContext = createContext(null);

export const useSmoothScroll = () => useContext(SmoothScrollContext);

/**
 * SmoothScrollProvider
 * Application-wide smooth scroll orchestration using Lenis and GSAP ScrollTrigger.
 * Features:
 * - Synchronizes with GSAP ticker for frame-rate independent physics.
 * - Updates ScrollTrigger on scroll and auto-refreshes on route change and resize.
 * - Immediately syncs scroll position on route changes without scroll latency.
 * - Cooperates with ScrollRestoration and respects user's prefers-reduced-motion.
 * - Allows nested scroll containers to scroll natively via data-lenis-prevent attribute.
 */
export const SmoothScrollProvider = ({ children }) => {
  const location = useLocation();
  const lenisRef = useRef(null);
  const locationKeyRef = useRef(location.key);

  useEffect(() => {
    // 1. Respect reduced-motion preferences
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      return;
    }

    // 2. Initialize singleton Lenis smooth scrolling instance with dashboard bypass
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false, // Preserve crisp native gesture responsiveness on mobile
      touchMultiplier: 1.5,
      infinite: false,
      prevent: (node) => {
        if (!node) return false;
        // Never intercept wheel/touch on admin or seller dashboard pages
        if (typeof window !== "undefined") {
          const path = window.location.pathname;
          if (path.startsWith("/admin") || path.startsWith("/seller/dashboard")) {
            return true;
          }
        }
        return (
          node.hasAttribute?.("data-lenis-prevent") ||
          Boolean(node.closest?.("[data-lenis-prevent]")) ||
          Boolean(node.closest?.(".overflow-y-auto")) ||
          Boolean(node.closest?.("#sidebar"))
        );
      },
    });

    lenisRef.current = lenis;

    // Pause Lenis if starting directly on a dashboard route
    if (typeof window !== "undefined") {
      const p = window.location.pathname;
      if (p.startsWith("/admin") || p.startsWith("/seller/dashboard")) {
        lenis.stop();
        document.body?.setAttribute("data-lenis-prevent", "true");
      }
    }

    // 3. Connect Lenis events to GSAP ScrollTrigger
    lenis.on("scroll", ScrollTrigger.update);

    // 4. Drive Lenis via GSAP ticker for unified rendering loop
    const tickerCallback = (time) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    // Initial recalculation
    ScrollTrigger.refresh();

    // 5. Global resize handler
    const onResize = () => {
      lenis.resize();
      ScrollTrigger.refresh();
    };

    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      window.removeEventListener("resize", onResize);
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
      lenisRef.current = null;
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove(
          "lenis",
          "lenis-smooth",
          "lenis-scrolling",
          "lenis-stopped"
        );
        document.body?.removeAttribute("data-lenis-prevent");
      }
    };
  }, []);

  // 6. Handle route transitions: cooperate with ScrollRestoration & recalculate triggers
  useEffect(() => {
    if (!lenisRef.current) return;

    const isDashboard =
      location.pathname.startsWith("/admin") ||
      location.pathname.startsWith("/seller/dashboard");

    if (isDashboard) {
      // Dashboards manage independent internal scroll containers (h-screen overflow-hidden)
      lenisRef.current.stop();
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove(
          "lenis",
          "lenis-smooth",
          "lenis-scrolling"
        );
        document.body?.setAttribute("data-lenis-prevent", "true");
      }
      return;
    }

    // Re-enable native Lenis smooth scrolling for public pages & remove dashboard prevent flag
    if (typeof document !== "undefined") {
      document.body?.removeAttribute("data-lenis-prevent");
    }
    lenisRef.current.start();

    if (locationKeyRef.current !== location.key) {
      locationKeyRef.current = location.key;

      // Reset internal Lenis scroll coordinate immediately to top
      lenisRef.current.scrollTo(0, { immediate: true });
      lenisRef.current.resize();

      // Defer refresh slightly to allow next page DOM components to mount
      const timer = setTimeout(() => {
        lenisRef.current?.resize();
        ScrollTrigger.refresh();
      }, 80);

      return () => clearTimeout(timer);
    }
  }, [location.pathname, location.key]);

  return (
    <SmoothScrollContext.Provider value={lenisRef.current}>
      {children}
    </SmoothScrollContext.Provider>
  );
};

export default SmoothScrollProvider;
