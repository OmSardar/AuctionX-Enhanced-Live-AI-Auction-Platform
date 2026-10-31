import React, { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import PopupModal from "../../Modals/PopupModal/PopupModal";
import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext"; // Adjust the import path as needed
import {
  parseAuctionDates,
  calculateAuctionTime,
} from "../../../utils/auctionTimer";
import soundManager from "../../../utils/soundManager";

const ProductList2 = () => {
  const { currentTheme } = useThemeProvider();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [productsData, setProductsData] = useState([]);
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const [timeLeft, setTimeLeft] = useState({});
  const intervalsRef = useRef({});
  const ref = useRef(null);
  const isInView = useInView(ref, { triggerOnce: true, threshold: 0.2 });
  const [hasAnimated, setHasAnimated] = useState(false);
  const PRODUCTS_LIMIT = 10;
  const API_URL = import.meta.env.VITE_API_URL;

  // Shuffle array utility function
  const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);

  const clearAllTimers = () => {
    Object.values(intervalsRef.current).forEach((intervalId) => {
      clearInterval(intervalId);
    });
    intervalsRef.current = {};
  };

  const initializeTimers = (products) => {
    clearAllTimers();
    if (!Array.isArray(products)) return;

    products.forEach((product) => {
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
    const fetchProducts = async () => {
      try {
        const response = await fetch(`${API_URL}/api/products/`);
        const data = await response.json();

        if (!data.products || !Array.isArray(data.products)) {
          console.warn("Unexpected API response format:", data);
          throw new Error("Expected products array in response");
        }

        const activeProducts = data.products.filter(
          (product) => product.status === "Active"
        );

        if (activeProducts.length > 0) {
          const randomizedData = shuffleArray(activeProducts);
          const limitedProducts = randomizedData.slice(0, PRODUCTS_LIMIT);

          setProductsData(randomizedData);
          setDisplayedProducts(limitedProducts);
          initializeTimers(limitedProducts);
        } else {
          console.log("No active products found");
          setProductsData([]);
          setDisplayedProducts([]);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        setProductsData([]);
        setDisplayedProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();

    return () => {
      clearAllTimers();
    };
  }, []);

  useEffect(() => {
    if (isInView && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [isInView, hasAnimated]);

  const openPopup = (product) => {
    soundManager.playClick();
    setSelectedProduct(product);
  };

  const closePopup = () => {
    setSelectedProduct(null);
  };

  // No products placeholder
  const NoProductsPlaceholder = () => (
    <div
      className={`col-span-full flex flex-col items-center justify-center py-12 ${
        currentTheme === "dark" ? "text-gray-300" : "text-gray-900"
      }`}
    >
      <svg
        className={`w-16 h-16 mb-4 ${
          currentTheme === "dark" ? "text-gray-500" : "text-gray-400"
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        ></path>
      </svg>
      <h3
        className={`text-lg font-medium ${
          currentTheme === "dark" ? "text-gray-300" : "text-gray-900"
        }`}
      >
        No products available
      </h3>
      <p
        className={`mt-1 text-sm ${
          currentTheme === "dark" ? "text-gray-400" : "text-gray-500"
        }`}
      >
        Check back soon for new products
      </p>
    </div>
  );

  return (
    <div
      className="bg-canvas text-foreground"
      ref={ref}
    >
      <div className="mx-auto max-w-full px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <h2 className="sr-only">Products</h2>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={hasAnimated ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5 xl:gap-x-8"
        >
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="group relative">
                <div
                  className="aspect-square w-full rounded-lg bg-surface-subtle animate-pulse"
                ></div>
                <div className="mt-4">
                  <div
                    className="h-4 w-3/4 rounded bg-surface-subtle animate-pulse"
                  ></div>
                  <div
                    className="mt-2 h-4 w-1/2 rounded bg-surface-subtle animate-pulse"
                  ></div>
                </div>
              </div>
            ))
          ) : displayedProducts.length > 0 ? (
            displayedProducts.map((product, index) => (
              <motion.div
                key={product._id || index}
                className="group relative cursor-pointer flex flex-col justify-between min-w-0 h-full product-card clickable-card"
                data-sound-interactive="true"
                tabIndex={0}
                role="button"
                aria-label={`View details for ${product.name}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPopup(product);
                  }
                }}
                onClick={() => openPopup(product)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={hasAnimated ? { opacity: 1, scale: 1 } : {}}
                transition={{
                  duration: 0.5,
                  ease: "easeOut",
                  delay: 0.1 * (index % 10),
                }}
              >
                {timeLeft[product._id] && (
                  <div className="absolute z-10 top-2 left-2 bg-black/60 text-white px-2 py-1 rounded-md text-xs">
                    <span>{timeLeft[product._id].days}d </span>
                    <span>{timeLeft[product._id].hours}h </span>
                    <span>{timeLeft[product._id].minutes}m </span>
                    <span>{timeLeft[product._id].seconds}s</span>
                  </div>
                )}
                <div className="relative">
                  <img
                    alt={product.name || "Product image"}
                    src={
                      product.images && product.images[0]
                        ? product.images[0].secure_url
                        : "placeholder-image.jpg"
                    }
                    className="aspect-square w-full rounded-lg bg-surface-subtle object-cover group-hover:opacity-75"
                  />
                </div>
                <div className="mt-3 flex flex-col justify-between flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base text-foreground font-medium line-clamp-2 break-words" title={product.name}>
                    {product.name}
                  </h3>
                  <p className="mt-2 text-base sm:text-lg font-bold text-action-primary font-numeric">
                    ₹{typeof product.biddingStartPrice === "number"
                      ? product.biddingStartPrice.toLocaleString()
                      : product.biddingStartPrice || "0"}
                  </p>
                </div>
              </motion.div>

            ))
          ) : (
            <NoProductsPlaceholder />
          )}
        </motion.div>
      </div>

      {selectedProduct && (
        <PopupModal product={selectedProduct} onClose={closePopup} />
      )}
    </div>
  );
};

export default ProductList2;
