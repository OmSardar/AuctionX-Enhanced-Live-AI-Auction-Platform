import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import PopupModal from "../../Modals/PopupModal/PopupModal";
import {
  parseAuctionDates,
  calculateAuctionTime,
} from "../../../utils/auctionTimer";
import { getOptimizedCardImage } from "../../../utils/imageOptimizer";

const ProductList = () => {
  // Get user from Redux store
  const { user } = useSelector((state) => state.auth);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [timeLeft, setTimeLeft] = useState({});
  const intervalsRef = useRef({});
  const productsPerPage = 12;
  const API_URL = import.meta.env.VITE_API_URL;
  const RECOMMENDATION_API_URL = import.meta.env.VITE_RECOMMENDATION_API_URL;

  const currentRecommendationIdRef = useRef(null);
  const containerRef = useRef(null);
  const loggedImpressionsRef = useRef(new Set());
  const pendingImpressionsRef = useRef([]);
  const flushTimeoutRef = useRef(null);

  // Retrieve or initialize anonymous session identifier for guest telemetry
  const getOrCreateSessionId = () => {
    try {
      let sid = sessionStorage.getItem("auctionx_session_id");
      if (!sid) {
        sid = "sess_" + Math.random().toString(36).substring(2, 12) + "_" + Date.now().toString(36);
        sessionStorage.setItem("auctionx_session_id", sid);
      }
      return sid;
    } catch {
      return "sess_anonymous";
    }
  };

  // Resolve normalized tracking URL (strictly routes through the authenticated Express gateway)
  const getTrackUrl = () => {
    const apiBase = (API_URL || "").trim().replace(/\/+$/, "");
    return apiBase ? `${apiBase}/api/track` : "/api/track";
  };

  // Flush queued viewport impressions to Express tracking gateway
  const flushImpressionBatch = async () => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }

    if (pendingImpressionsRef.current.length === 0) return;

    const batchToSend = pendingImpressionsRef.current.splice(0, 25);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("userToken");
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      await fetch(getTrackUrl(), {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ batch: batchToSend }),
      });
    } catch (err) {
      console.debug("Batch impression telemetry notice:", err);
    }
  };

  // Debounce and queue impression tracking events
  const scheduleImpressionFlush = (item) => {
    pendingImpressionsRef.current.push(item);
    if (pendingImpressionsRef.current.length >= 25) {
      flushImpressionBatch();
    } else if (!flushTimeoutRef.current) {
      flushTimeoutRef.current = setTimeout(flushImpressionBatch, 500);
    }
  };

  // Resolve normalized recommendations URL (supports direct microservice or backend proxy)
  const getRecommendationsUrl = (email, limit) => {
    const sessionId = getOrCreateSessionId();
    const query = `count=${limit}&fallback=true${!email ? `&session_id=${encodeURIComponent(sessionId)}` : ""}`;
    // User-personalized recommendations must route through the authoritative Express gateway
    // which verifies JWT authentication and passes the internal service key.
    if (!email && RECOMMENDATION_API_URL) {
      const base = RECOMMENDATION_API_URL.trim().replace(/\/+$/, "");
      const prefix = base.endsWith("/api") ? base : `${base}/api`;
      return `${prefix}/recommendations?${query}`;
    }
    const apiBase = (API_URL || "").trim().replace(/\/+$/, "");
    const prefix = apiBase ? `${apiBase}/api` : "/api";
    return email
      ? `${prefix}/recommendations/${encodeURIComponent(email)}?${query}`
      : `${prefix}/recommendations?${query}`;
  };

  // Track user interaction (client-observable events: view, click)
  const trackInteraction = async (productId, interactionType = "click", position = undefined, surface = undefined) => {
    if (!productId) return;

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("userToken");
      const headers = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const body = {
        product_id: productId,
        interaction_type: interactionType,
      };

      if (position !== undefined) {
        body.position = position;
      }

      if (surface) {
        body.surface = surface;
      } else if (currentRecommendationIdRef.current) {
        body.surface = "recommendations";
      }

      if (user?.email) {
        body.email = user.email;
      } else {
        body.session_id = getOrCreateSessionId();
      }

      if (currentRecommendationIdRef.current) {
        body.recommendation_id = currentRecommendationIdRef.current;
      }

      await fetch(getTrackUrl(), {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      });
    } catch (error) {
      // Telemetry failure must never interrupt user browsing
      console.debug("Telemetry notice:", error);
    }
  };

  const clearAllTimers = () => {
    Object.values(intervalsRef.current).forEach((intervalId) => {
      clearInterval(intervalId);
    });
    intervalsRef.current = {};
  };

  const initializeTimers = (productList) => {
    clearAllTimers();
    if (!Array.isArray(productList)) return;

    productList.forEach((product) => {
      if (!product?._id) return;
      const { startDate, endDate } = parseAuctionDates(
        product.biddingStartDate,
        product.biddingStartTime,
        product.biddingEndTime
      );

      const calc = calculateAuctionTime(startDate, endDate, product.status || "Active");
      setTimeLeft((prev) => ({
        ...prev,
        [product._id]: calc.timeLeft,
      }));

      const intervalId = setInterval(() => {
        const updated = calculateAuctionTime(startDate, endDate, product.status || "Active");
        setTimeLeft((prev) => ({
          ...prev,
          [product._id]: updated.timeLeft,
        }));
      }, 1000);

      intervalsRef.current[product._id] = intervalId;
    });
  };

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchRecommendations = async () => {
      try {
        setIsFetching(true);
        const apiBaseUrl = (API_URL || "").trim().replace(/\/+$/, "");

        // Fetch recommendations for both guests and authenticated users
        const recUrl = getRecommendationsUrl(user?.email, productsPerPage);
        const token = localStorage.getItem("token") || localStorage.getItem("userToken");
        const headers = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(recUrl, {
          signal: controller.signal,
          headers,
          credentials: "include",
        });

        if (!response.ok)
          throw new Error(`HTTP error! Status: ${response.status}`);

        const data = await response.json();
        if (data.recommendation_id) {
          currentRecommendationIdRef.current = data.recommendation_id;
        } else {
          currentRecommendationIdRef.current = null;
        }
        loggedImpressionsRef.current.clear();
        const recommendedProducts = data.products || [];

        if (!isMounted) return;

        if (recommendedProducts.length > 0) {
          setProducts(recommendedProducts);
          setDisplayedProducts(recommendedProducts);
          initializeTimers(recommendedProducts);
        } else {
          // Graceful fallback to regular active products if recommendations list is empty
          currentRecommendationIdRef.current = null;
          loggedImpressionsRef.current.clear();
          const fallbackEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/products/` : "/api/products/";
          const fallbackResponse = await fetch(fallbackEndpoint, { signal: controller.signal });
          const fallbackData = await fallbackResponse.json();
          const activeProducts =
            fallbackData.products?.filter((p) => p.status === "Active") || [];
          if (isMounted) {
            setProducts(activeProducts);
            setDisplayedProducts(activeProducts.slice(0, productsPerPage));
            initializeTimers(activeProducts);
          }
        }
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Error fetching recommendations:", error);
        if (!isMounted) return;

        // Fallback to regular products on service unavailability
        try {
          currentRecommendationIdRef.current = null;
          loggedImpressionsRef.current.clear();
          const apiBaseUrl = (API_URL || "").trim().replace(/\/+$/, "");
          const fallbackEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/products/` : "/api/products/";
          const fallbackResponse = await fetch(fallbackEndpoint, { signal: controller.signal });
          const fallbackData = await fallbackResponse.json();
          const activeProducts =
            fallbackData.products?.filter((p) => p.status === "Active") || [];
          if (isMounted) {
            setProducts(activeProducts);
            setDisplayedProducts(activeProducts.slice(0, productsPerPage));
            initializeTimers(activeProducts);
          }
        } catch (fallbackError) {
          if (fallbackError.name === "AbortError") return;
          console.error("Fallback fetch also failed:", fallbackError);
          if (isMounted) {
            setProducts([]);
            setDisplayedProducts([]);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsFetching(false);
        }
      }
    };

    fetchRecommendations();

    return () => {
      isMounted = false;
      controller.abort();
      clearAllTimers();
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      flushImpressionBatch();
    };
  }, [user?.email]);

  // Viewport-based impression logging (documented threshold: 0.5, i.e. 50% card visibility)
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Documented threshold: 0.5 (card must be at least 50% visible in the viewport)
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const cardEl = entry.target;
            const productId = cardEl.getAttribute("data-product-id");
            const position = parseInt(cardEl.getAttribute("data-position") || "0", 10);
            const slateId = cardEl.getAttribute("data-recommendation-slate") || currentRecommendationIdRef.current || undefined;
            const surface = cardEl.getAttribute("data-surface") || "recommendations";

            if (!productId) return;

            const dedupKey = `${slateId || "catalog"}:${productId}`;
            if (loggedImpressionsRef.current.has(dedupKey)) {
              return;
            }
            loggedImpressionsRef.current.add(dedupKey);

            const impressionItem = {
              product_id: productId,
              interaction_type: "impression",
              position,
              surface,
              timestamp: new Date().toISOString(),
            };

            if (slateId) {
              impressionItem.recommendation_id = slateId;
            }

            if (user?.email) {
              impressionItem.email = user.email;
            } else {
              impressionItem.session_id = getOrCreateSessionId();
            }

            scheduleImpressionFlush(impressionItem);
          }
        });
      },
      {
        threshold: [0.5], // 50% visibility threshold
      }
    );

    const cards = containerRef.current?.querySelectorAll("[data-product-card='true']") || [];
    cards.forEach((card) => observer.observe(card));

    return () => {
      observer.disconnect();
    };
  }, [displayedProducts, user?.email]);

  const openPopup = (product, position = 0) => {
    trackInteraction(
      product._id,
      "click",
      position,
      currentRecommendationIdRef.current ? "recommendations" : "catalog"
    );
    setSelectedProduct(product);
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0 },
  };

  const NoProductsPlaceholder = () => (
    <div className="col-span-full flex flex-col items-center justify-center py-12">
      <svg
        className="w-16 h-16 text-gray-400 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        ></path>
      </svg>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
        No products available
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
        Check back soon for new products
      </p>
    </div>
  );

  return (
    <div className="relative bg-canvas text-foreground">
      <div className="mx-auto max-w-full px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {user ? "Recommended for you" : "Featured products"}
        </h2>

        <div ref={containerRef} className="mt-4 sm:mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-x-4 xl:gap-x-6">
          {isLoading || isFetching ? (
            Array.from({ length: 6 }).map((_, index) => (
              <motion.div
                key={index}
                className="group relative"
                variants={cardVariants}
              >
                <div className="aspect-square w-full rounded-md bg-surface-subtle animate-pulse"></div>
                <div className="mt-4 flex justify-between">
                  <div>
                    <div className="h-4 w-24 bg-surface-subtle animate-pulse rounded"></div>
                    <div className="mt-2 h-4 w-16 bg-surface-subtle animate-pulse rounded"></div>
                  </div>
                  <div className="h-4 w-12 bg-surface-subtle animate-pulse rounded"></div>
                </div>
              </motion.div>
            ))
          ) : displayedProducts.length > 0 ? (
            displayedProducts.map((product, index) => (
              <motion.div
                key={product._id || index}
                data-product-card="true"
                data-product-id={product._id}
                data-position={index}
                data-recommendation-slate={currentRecommendationIdRef.current || ""}
                data-surface={currentRecommendationIdRef.current ? "recommendations" : "catalog"}
                className="group relative cursor-pointer flex flex-col justify-between min-w-0 h-full product-card clickable-card"
                data-sound-interactive="true"
                tabIndex={0}
                role="button"
                aria-label={`View details for ${product.name}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPopup(product, index);
                  }
                }}
                onClick={() => openPopup(product, index)}
                variants={cardVariants}
              >
                {timeLeft[product._id] && (
                  <div className="absolute z-10 top-2 left-2 bg-black/60 text-white px-2 py-1 rounded-md text-xs">
                    <span>{timeLeft[product._id].days}d </span>
                    <span>{timeLeft[product._id].hours}h </span>
                    <span>{timeLeft[product._id].minutes}m </span>
                    <span>{timeLeft[product._id].seconds}s</span>
                  </div>
                )}
                {product.lifecycleStatus === "UPCOMING" ? (
                  <div className="absolute z-10 top-2 right-2 bg-amber-600/90 text-white px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase shadow-sm">
                    Upcoming
                  </div>
                ) : product.lifecycleStatus === "LIVE" ? (
                  <div className="absolute z-10 top-2 right-2 bg-emerald-600/90 text-white px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase shadow-sm">
                    Live
                  </div>
                ) : null}
                <div className="relative">
                  <img
                    alt={
                      product.imageAlt || `Product image for ${product.name}`
                    }
                    src={
                      getOptimizedCardImage(
                        product.images?.[0]?.secure_url || product.image,
                        380
                      ) || "placeholder-image.jpg"
                    }
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full rounded-md bg-surface-subtle object-cover group-hover:opacity-75"
                  />
                </div>
                <div className="mt-3 flex flex-col justify-between flex-1 min-w-0">
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base text-foreground font-medium line-clamp-2 break-words" title={product.name}>
                      {product.name}
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-foreground-muted truncate">
                      {product.color || product.category || ""}
                    </p>
                  </div>
                  <p className="mt-2 text-sm sm:text-base font-bold text-action-primary font-numeric">
                    ₹{product.biddingStartPrice !== undefined ? Number(product.biddingStartPrice).toLocaleString() : (product.price || 0)}
                  </p>
                </div>

              </motion.div>
            ))
          ) : (
            <NoProductsPlaceholder />
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedProduct && (
          <PopupModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductList;
