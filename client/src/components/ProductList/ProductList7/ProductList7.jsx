import React, { useState, useEffect, useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { GiSandsOfTime } from "react-icons/gi";
import { ImPriceTags } from "react-icons/im";
import ReactDOM from "react-dom";
import PopupModal from "../../Modals/PopupModal/PopupModal";
import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext"; // Adjust the import path as needed
import {
  parseAuctionDates,
  calculateAuctionTime,
} from "../../../utils/auctionTimer";
import soundManager from "../../../utils/soundManager";

const SkeletonProductCard = () => {
  return (
    <div className="w-full p-4 rounded-xl bg-surface border border-border-subtle shadow-card flex flex-col justify-between animate-pulse min-w-0">
      <div className="w-full aspect-4/3 bg-surface-subtle rounded-lg mb-3"></div>
      <div className="h-5 bg-surface-subtle rounded w-3/4 mx-auto my-1.5"></div>
      <div className="h-4 bg-surface-subtle rounded w-1/2 mx-auto my-1.5"></div>
      <div className="h-4 bg-surface-subtle rounded w-1/3 mx-auto my-1.5"></div>
      <div className="h-10 bg-surface-subtle rounded w-full mt-auto"></div>
    </div>
  );
};


const ProductList7 = () => {
  const navigate = useNavigate();
  const { currentTheme } = useThemeProvider();
  const darkMode = currentTheme === "dark";

  const [products, setProducts] = useState([]);
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [productsPerPage, setProductsPerPage] = useState(11);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isFetching, setIsFetching] = useState(true);
  const API_URL = import.meta.env.VITE_API_URL;

  // Adjust products per page based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setProductsPerPage(4); // Mobile
      } else if (window.innerWidth < 1024) {
        setProductsPerPage(6); // Tablet
      } else {
        setProductsPerPage(11); // Desktop
      }
    };

    // Set initial value and add listener
    handleResize();
    window.addEventListener("resize", handleResize);

    // Clean up
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleOpenPopup = (productId) => {
    const product = products.find((p) => p._id === productId);
    setSelectedProduct(product);
  };

  const handleClosePopup = () => {
    setSelectedProduct(null);
  };

  const shuffleArray = (array) => {
    return array.sort(() => Math.random() - 0.5);
  };

  useEffect(() => {
    const fetchAndRandomizeProducts = async () => {
      try {
        const response = await fetch(`${API_URL}/api/products/`);
        if (!response.ok) {
          throw new Error("Failed to fetch products");
        }
        const data = await response.json();

        // Extract the products array from the response
        const productsArray = data.products || [];

        // Filter active products
        const activeProducts = productsArray.filter(
          (product) => product.status === "Active"
        );

        if (activeProducts.length === 0) {
          console.log("No active products found");
        }
        const randomizedData = shuffleArray(activeProducts);
        setProducts(randomizedData);
        setDisplayedProducts(randomizedData.slice(0, productsPerPage));
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchAndRandomizeProducts();
  }, [productsPerPage]);

  const loadMoreProducts = useCallback(() => {
    if (loading) return;
    setLoading(true);

    setTimeout(() => {
      const nextIndex = currentIndex + productsPerPage;
      setDisplayedProducts((prev) => [
        ...prev,
        ...products.slice(currentIndex, nextIndex),
      ]);
      setCurrentIndex(nextIndex);
      setLoading(false);
    }, 2000);
  }, [currentIndex, loading, products, productsPerPage]);

  const handleScroll = (e) => {
    const container = e.target;
    // More responsive threshold for different devices
    const threshold = 100; // px from bottom to trigger load
    const isNearBottom =
      container.scrollHeight - (container.scrollTop + container.clientHeight) <=
      threshold;

    if (isNearBottom && !loading) {
      loadMoreProducts();
    }
  };

  const calculateTimeLeft = (
    biddingStartDate,
    biddingStartTime,
    biddingEndTime,
    status = "Active"
  ) => {
    if (!biddingStartDate || !biddingEndTime) {
      return "Date not available";
    }

    try {
      const { startDate, endDate } = parseAuctionDates(
        biddingStartDate,
        biddingStartTime,
        biddingEndTime
      );

      if (!startDate && !endDate) {
        return "Invalid date";
      }

      const calc = calculateAuctionTime(startDate, endDate, status);
      if (calc.isEnded) {
        return "Time expired";
      }

      const { days, hours, minutes, seconds } = calc.timeLeft;
      const dNum = parseInt(days, 10);
      const hNum = parseInt(hours, 10);
      const mNum = parseInt(minutes, 10);
      const sNum = parseInt(seconds, 10);

      if (window.innerWidth < 640) {
        return `${dNum}d ${hNum}h`;
      }

      return `${dNum}d ${hNum}h ${mNum}m ${sNum}s`;
    } catch (error) {
      return "Time calculation error";
    }
  };

  const [liveCountdown, setLiveCountdown] = useState({});

  useEffect(() => {
    const updateAll = () => {
      const updatedCountdown = {};
      displayedProducts.forEach((product) => {
        const timeLeft = calculateTimeLeft(
          product.biddingStartDate,
          product.biddingStartTime,
          product.biddingEndTime,
          product.status
        );
        updatedCountdown[product._id] = timeLeft;
      });
      setLiveCountdown(updatedCountdown);
    };

    updateAll();
    const intervalId = setInterval(updateAll, 1000);

    return () => clearInterval(intervalId);
  }, [displayedProducts]);

  return (
    <div className="w-full rounded-xl sm:rounded-2xl font-sans bg-canvas text-foreground shadow-card p-2 sm:p-4">
      <div
        id="result"
        className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 overflow-y-auto max-h-[80vh] sm:max-h-[120vh] md:max-h-[150vh] lg:max-h-[180vh] scrollbar-thin p-2 mt-4 sm:mt-8"
        onScroll={handleScroll}
      >
        {isFetching
          ? Array.from({ length: productsPerPage }).map((_, index) => (
              <SkeletonProductCard key={index} />
            ))
          : displayedProducts.map((product) => (
              <div
                key={product._id}
                onMouseEnter={() => soundManager.playHover()}
                className="w-full p-4 rounded-xl bg-surface border border-border-subtle shadow-card flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover min-w-0"
              >
                <div className="relative w-full aspect-4/3 rounded-lg overflow-hidden bg-surface-subtle mb-3">
                  <img
                    src={
                      product.images[0]?.secure_url ||
                      "/lot-placeholder.svg"
                    }
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div className="min-w-0 text-center">
                    <h3
                      className="text-foreground text-sm sm:text-base font-bold tracking-wide line-clamp-2 break-words"
                      title={product.name}
                    >
                      {product.name}
                    </h3>
                    <h4 className="my-1.5 text-action-primary text-sm sm:text-base font-bold font-numeric flex items-center justify-center gap-1">
                      <ImPriceTags className="inline-block text-xs" /> ₹
                      {Number(product.biddingStartPrice || 0).toLocaleString()}
                    </h4>
                    <h4 className="text-foreground-secondary text-xs sm:text-sm font-numeric flex items-center justify-center gap-1">
                      <GiSandsOfTime className="inline-block text-xs" />{" "}
                      {liveCountdown[product._id] || "Loading..."}
                    </h4>
                  </div>
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={() => {
                        soundManager.playClick();
                        handleOpenPopup(product._id);
                      }}
                      onMouseEnter={() => soundManager.playHover()}
                      className="btn-canonical btn-canonical-md btn-canonical-primary w-full"
                    >
                      Bid Now
                    </button>
                  </div>
                </div>
              </div>
            ))}

        {loading && (
          <div className="flex justify-center items-center w-full my-4 sm:my-5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-border-subtle border-t-action-primary rounded-full animate-spin"></div>
          </div>
        )}
        {displayedProducts.length === 0 && !isFetching && (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <svg
              className={`w-16 h-16 ${
                darkMode ? "text-gray-500" : "text-gray-400"
              } mb-4`}
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
                darkMode ? "text-gray-200" : "text-gray-900"
              }`}
            >
              No products available
            </h3>
            <p
              className={`mt-1 text-sm ${
                darkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Check back soon for new products
            </p>
          </div>
        )}
        {selectedProduct &&
          typeof document !== "undefined" &&
          ReactDOM.createPortal(
            <PopupModal
              product={selectedProduct}
              onClose={handleClosePopup}
              darkMode={darkMode}
            />,
            document.body
          )}
      </div>
    </div>
  );
};

export default ProductList7;
