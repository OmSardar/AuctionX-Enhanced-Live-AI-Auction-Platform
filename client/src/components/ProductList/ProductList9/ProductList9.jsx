import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactDOM from "react-dom";
import { GiSandsOfTime } from "react-icons/gi";
import { ImPriceTags } from "react-icons/im";
import { BiSolidCategoryAlt } from "react-icons/bi";
import PopupModal from "../../Modals/PopupModal/PopupModal";
import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext"; // Import the theme context
import {
  parseAuctionDates,
  calculateAuctionTime,
} from "../../../utils/auctionTimer";

const ProductList9 = () => {
  const navigate = useNavigate();
  const { currentTheme } = useThemeProvider(); // Get current theme
  const [products, setProducts] = useState([]);
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [timeLeft, setTimeLeft] = useState({});
  const intervalsRef = useRef({});
  const [isFetching, setIsFetching] = useState(true);
  const productsPerPage = 12;
  const API_URL = import.meta.env.VITE_API_URL;

  const handleOpenPopup = (productId) => {
    const product = products.find((p) => p._id === productId);
    setSelectedProduct(product);
  };

  const handleClosePopup = () => {
    setSelectedProduct(null);
  };

  const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);

  const clearAllTimers = () => {
    Object.values(intervalsRef.current).forEach((intervalId) => {
      clearInterval(intervalId);
    });
    intervalsRef.current = {};
  };

  const initializeTimers = (productsList) => {
    clearAllTimers();
    if (!Array.isArray(productsList)) return;

    productsList.forEach((product) => {
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

        // Fix: Access the products array from the response
        const productsArray = data.products || [];

        const activeProducts = productsArray.filter(
          (product) => product.status === "Active"
        );

        const randomizedData = shuffleArray(activeProducts);
        setProducts(randomizedData);
        setDisplayedProducts(randomizedData.slice(0, productsPerPage));
        setIsFetching(false);

        initializeTimers(randomizedData);
      } catch (error) {
        console.error("Error fetching products:", error);
        setIsFetching(false);
      }
    };

    fetchProducts();

    return () => {
      clearAllTimers();
    };
  }, []);

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
  }, [currentIndex, loading, products]);

  const handleScroll = useCallback(
    (e) => {
      const bottom =
        e.target.scrollHeight - Math.round(e.target.scrollTop) <=
        e.target.clientHeight + 5;
      if (bottom) {
        loadMoreProducts();
      }
    },
    [loadMoreProducts]
  );

  // Skeleton Loader Component - Updated for design tokens
  const SkeletonCard = () => (
    <div className="w-full p-4 rounded-xl bg-surface border border-border-subtle shadow-card transition-all duration-300">
      <div className="flex flex-row items-center">
        {/* Image placeholder */}
        <div className="w-40 h-52 bg-surface-subtle rounded-xl mr-5 animate-pulse"></div>

        <div className="flex-1">
          {/* Title placeholder */}
          <div className="h-6 bg-surface-subtle rounded mb-2 w-3/4 animate-pulse"></div>

          {/* Category placeholder */}
          <div className="h-4 bg-surface-subtle rounded mb-2 w-1/2 animate-pulse"></div>

          {/* Price placeholder */}
          <div className="h-4 bg-surface-subtle rounded mb-2 w-1/3 animate-pulse"></div>

          {/* Timer placeholder */}
          <div className="h-4 bg-surface-subtle rounded mb-2 w-1/4 animate-pulse"></div>

          {/* Button placeholder */}
          <div className="h-10 bg-surface-subtle rounded mt-3 w-24 animate-pulse"></div>
        </div>
      </div>
    </div>
  );

  // Empty state component - Updated for design tokens
  const EmptyState = () => (
    <div className="col-span-full flex flex-col items-center justify-center py-12">
      <svg
        className="w-16 h-16 text-foreground-muted mb-4"
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
      <h3 className="text-lg font-medium text-foreground">
        No products available
      </h3>
      <p className="mt-1 text-sm text-foreground-muted">
        Check back soon for new products
      </p>
    </div>
  );

  return (
    <div className="w-full min-h-screen bg-canvas text-foreground p-5">
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto max-w-full max-h-[160vh] mx-auto p-2 text-foreground"
        onScroll={handleScroll}
      >
        {isFetching ? (
          // Show skeleton cards when fetching
          Array.from({ length: productsPerPage }).map((_, index) => (
            <SkeletonCard key={`skeleton-${index}`} />
          ))
        ) : products.length === 0 ? (
          // Show empty state when no products
          <EmptyState />
        ) : (
          // Show actual products
          displayedProducts.map((product) => (
            <div
              key={product._id}
              className="w-full p-4 rounded-xl bg-surface border border-border-subtle shadow-card hover:shadow-card-hover transition-all duration-300 min-w-0 product-card"
              data-sound-interactive="true"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
                <div className="w-full sm:w-36 md:w-40 aspect-4/3 sm:aspect-auto sm:h-48 rounded-lg overflow-hidden bg-surface-subtle shrink-0">
                  <img
                    src={
                      product.images[0]?.secure_url ||
                      "/lot-placeholder.svg"
                    }
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <h5 className="font-bold text-base sm:text-lg mb-1.5 line-clamp-2 break-words text-foreground" title={product.name}>
                      {product.name}
                    </h5>
                    <h6 className="text-xs sm:text-sm mb-1.5 text-foreground-secondary truncate">
                      <BiSolidCategoryAlt className="inline mr-1" />{" "}
                      {product.category}
                    </h6>
                    <h5 className="text-sm sm:text-base font-bold mb-1.5 text-action-primary font-numeric">
                      <ImPriceTags className="inline mr-1 text-xs" /> ₹
                      {Number(product.biddingStartPrice || 0).toLocaleString()}
                    </h5>
                    <p className="font-medium text-xs mb-3 text-foreground-muted font-numeric">
                      <GiSandsOfTime className="inline mr-1 text-action-primary" />{" "}
                      {timeLeft[product._id]
                        ? `${timeLeft[product._id].days}d ${
                            timeLeft[product._id].hours
                          }h ${timeLeft[product._id].minutes}m ${
                            timeLeft[product._id].seconds
                          }s`
                        : "Loading..."}
                    </p>
                  </div>
                  <div className="flex justify-start">
                    <button
                      className="btn-canonical btn-canonical-md btn-canonical-primary w-full sm:w-auto px-6"
                      onClick={() => handleOpenPopup(product._id)}
                      aria-label={`Bid on ${product.name}`}
                    >
                      Bid Now
                    </button>
                  </div>
                </div>
              </div>
            </div>

          ))
        )}

        {/* Loading indicator for infinite scroll */}
        {loading && (
          <div className="col-span-full flex justify-center items-center w-full py-4">
            <div className="w-8 h-8 border-4 border-t-transparent border-action-primary rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Product details popup */}
      {selectedProduct &&
        ReactDOM.createPortal(
          <PopupModal product={selectedProduct} onClose={handleClosePopup} />,
          document.body
        )}
    </div>
  );
};

export default ProductList9;
