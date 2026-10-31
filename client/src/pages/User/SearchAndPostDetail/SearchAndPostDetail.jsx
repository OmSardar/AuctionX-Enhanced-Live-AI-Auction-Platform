import React, { useEffect, useState, useCallback, useRef } from "react";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useThemeProvider } from "../../../components/AdminDashboard/utils/ThemeContext";
import {
  parseAuctionDates,
  calculateAuctionTime,
} from "../../../utils/auctionTimer";
import {
  getOptimizedDetailImage,
  getResponsiveSrcSet,
  getOptimizedThumbnail,
  getOptimizedCardImage,
} from "../../../utils/imageOptimizer";

const SearchAndPostDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentTheme } = useThemeProvider();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState({});
  const intervalsRef = useRef({});
  const isDarkMode = currentTheme === "dark";
  const [isFetchingRelated, setIsFetchingRelated] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL;

  const clearAllTimers = () => {
    Object.values(intervalsRef.current).forEach((intervalId) => {
      clearInterval(intervalId);
    });
    intervalsRef.current = {};
  };

  const initializeTimers = (productsList) => {
    clearAllTimers();
    if (!Array.isArray(productsList)) return;

    productsList.forEach((item) => {
      if (!item?._id) return;
      const { startDate, endDate } = parseAuctionDates(item);

      const calc = calculateAuctionTime(startDate, endDate, item.status || "Active");
      setTimeLeft((prev) => ({
        ...prev,
        [item._id]: {
          ...calc.timeLeft,
          statusText: calc.statusText,
          isEnded: calc.isEnded,
          isUpcoming: calc.isUpcoming,
          isActive: calc.isActive,
        },
      }));

      const intervalId = setInterval(() => {
        const updated = calculateAuctionTime(startDate, endDate, item.status || "Active");
        setTimeLeft((prev) => ({
          ...prev,
          [item._id]: {
            ...updated.timeLeft,
            statusText: updated.statusText,
            isEnded: updated.isEnded,
            isUpcoming: updated.isUpcoming,
            isActive: updated.isActive,
          },
        }));
      }, 1000);

      intervalsRef.current[item._id] = intervalId;
    });
  };

  const fetchProductDetail = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosWithAuth.get(`/products/${id}`);
      const mainProduct = response.data.product;
      setProduct(mainProduct);

      let allTimersList = [];
      if (mainProduct) {
        allTimersList.push(mainProduct);
      }

      // Once we have the product, fetch related products
      if (mainProduct?.category) {
        setIsFetchingRelated(true);
        const formattedCategory = encodeURIComponent(mainProduct.category);
        const relatedResponse = await axiosWithAuth.get(
          `/products/category/${formattedCategory}`
        );
        // Filter out the current product
        const filteredProducts = relatedResponse.data.filter(
          (item) => item._id !== id
        );
        setRelatedProducts(filteredProducts);
        allTimersList = [...allTimersList, ...filteredProducts];
        setIsFetchingRelated(false);
      }

      // Initialize authoritative timers for both main product and related cards
      initializeTimers(allTimersList);
      setError(null);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to fetch product details. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProductDetail();

    return () => {
      clearAllTimers();
    };
  }, [id, fetchProductDetail]);

  const nextImage = () => {
    if (product && product.images && product.images.length > 0) {
      setCurrentImageIndex(
        (prevIndex) => (prevIndex + 1) % product.images.length
      );
    }
  };

  const prevImage = () => {
    if (product && product.images && product.images.length > 0) {
      setCurrentImageIndex((prevIndex) =>
        prevIndex === 0 ? product.images.length - 1 : prevIndex - 1
      );
    }
  };

  // Animation variants
  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0 },
  };

  // Skeleton UI for product detail
  const ProductDetailSkeleton = () => (
    <div className="bg-surface border border-border-subtle rounded-lg shadow-card overflow-hidden max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row">
        {/* Image Skeleton */}
        <div className="w-full lg:w-1/2 p-6">
          <div className="h-96 rounded-lg bg-surface-subtle animate-pulse"></div>
          <div className="flex mt-4 space-x-2">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="h-16 w-16 rounded-md bg-surface-subtle animate-pulse"
              ></div>
            ))}
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="w-full lg:w-1/2 p-6">
          <div className="h-8 w-3/4 bg-surface-subtle rounded animate-pulse mb-4"></div>
          <div className="h-6 w-1/2 bg-surface-subtle rounded animate-pulse mb-4"></div>
          <div className="h-10 w-1/3 bg-surface-subtle rounded animate-pulse mb-6"></div>

          <div className="grid grid-cols-4 gap-2 mb-6">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="h-20 bg-surface-subtle rounded animate-pulse"
              ></div>
            ))}
          </div>

          <div className="h-32 bg-surface-subtle rounded animate-pulse mb-6"></div>

          <div className="flex gap-4">
            <div className="h-12 w-32 bg-surface-subtle rounded animate-pulse"></div>
            <div className="h-12 w-32 bg-surface-subtle rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );

  // Skeleton for related products
  const RelatedProductsSkeleton = () => (
    <div className="mt-16">
      <div className="h-8 w-64 mx-auto bg-surface-subtle rounded animate-pulse mb-8"></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(4)].map((_, index) => (
          <motion.div
            key={index}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            transition={{ delay: index * 0.1, duration: 0.6 }}
            className="bg-surface border border-border-subtle rounded-lg overflow-hidden shadow-card"
          >
            <div className="h-48 bg-surface-subtle animate-pulse"></div>
            <div className="p-4">
              <div className="h-6 w-3/4 bg-surface-subtle rounded animate-pulse mb-2"></div>
              <div className="flex justify-between items-center mb-3">
                <div className="h-4 w-1/3 bg-surface-subtle rounded animate-pulse"></div>
                <div className="h-4 w-1/4 bg-surface-subtle rounded animate-pulse"></div>
              </div>
              <div className="h-16 bg-surface-subtle rounded animate-pulse"></div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  // Function to render description properly
  const renderDescription = () => {
    if (!product || !product.description) return null;

    if (Array.isArray(product.description)) {
      return product.description.map((desc, index) => (
        <div key={index} className="mb-3">
          {desc.name && <h4 className="font-medium">{desc.name}</h4>}
          {desc.description && <p>{desc.description}</p>}
        </div>
      ));
    } else {
      return <p>{product.description}</p>;
    }
  };

  // Main render with theme awareness
  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Main Product Detail */}
        {loading ? (
          <ProductDetailSkeleton />
        ) : error ? (
          <div className="text-center py-16 px-4">
            <div className="bg-status-error/10 border border-status-error/20 text-status-error px-4 py-3 rounded max-w-lg mx-auto">
              <p>{error}</p>
            </div>
          </div>
        ) : product ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-surface border border-border-subtle rounded-lg shadow-card overflow-hidden max-w-6xl mx-auto"
          >
            <div className="flex flex-col lg:flex-row">
              {/* Image Gallery Section */}
              <div className="w-full lg:w-1/2 p-6 relative">
                <div className="relative rounded-lg overflow-hidden bg-surface-subtle h-96">
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent opacity-50 blur-2xl"></div>

                  {/* Image */}
                  {product.images && product.images.length > 0 ? (
                    <motion.img
                      key={currentImageIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      src={getOptimizedDetailImage(product.images[currentImageIndex].secure_url)}
                      srcSet={getResponsiveSrcSet(product.images[currentImageIndex].secure_url, [450, 800, 1200])}
                      sizes="(max-width: 768px) 100vw, 800px"
                      alt={`${product.name} - Image ${currentImageIndex + 1}`}
                      loading="eager"
                      fetchpriority="high"
                      decoding="sync"
                      className="w-full h-full object-contain relative z-10"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      No Images Available
                    </div>
                  )}

                  {/* Navigation arrows */}
                  {product.images && product.images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 rounded-full p-2 text-white hover:bg-opacity-70 transition z-20"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 19l-7-7 7-7"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 rounded-full p-2 text-white hover:bg-opacity-70 transition z-20"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnail images */}
                {product.images && product.images.length > 1 && (
                  <div className="flex mt-4 space-x-2 overflow-x-auto pb-2">
                    {product.images.map((image, index) => (
                      <div
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`cursor-pointer rounded-md overflow-hidden h-16 w-16 flex-shrink-0 border-2 ${
                          currentImageIndex === index
                            ? "border-amber-500"
                            : "border-transparent"
                        }`}
                      >
                        <img
                          src={getOptimizedThumbnail(image.secure_url, 120)}
                          alt={`Thumbnail ${index + 1}`}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Information Section */}
              <div className="w-full lg:w-1/2 p-6">
                <h1
                  className={`text-3xl font-bold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  } mb-2`}
                >
                  {product.name}
                </h1>
                <div className="flex items-center mb-4">
                  <span
                    className={isDarkMode ? "text-gray-400" : "text-gray-600"}
                  >
                    Category:
                  </span>
                  <span
                    className="ml-2 text-amber-500 hover:text-amber-400 cursor-pointer"
                    onClick={() =>
                      navigate(
                        `/category/${product.category.replace(/ /g, "-")}`
                      )
                    }
                  >
                    {product.category}
                  </span>
                </div>

                <div className="mb-6">
                  <div className="text-2xl font-bold text-amber-500 mb-1">
                    Starting Price: ₹
                    {product.biddingStartPrice?.toLocaleString() || "0"}
                  </div>

                  {/* Bidding Time Section */}
                  {(product.biddingEndTime || product.endTime) && (
                    <div className="mt-4">
                      <h3
                        className={`${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        } mb-2 font-semibold`}
                      >
                        {timeLeft[product._id]?.statusText || "AUCTION ENDS IN"}:
                      </h3>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="bg-surface-subtle border border-border-subtle rounded p-2 text-center">
                          <span className="block text-2xl font-bold font-numeric text-brand-gold">
                            {timeLeft[product._id]?.days || "00"}
                          </span>
                          <span className="text-foreground-muted text-xs">
                            Days
                          </span>
                        </div>
                        <div className="bg-surface-subtle border border-border-subtle rounded p-2 text-center">
                          <span className="block text-2xl font-bold font-numeric text-brand-gold">
                            {timeLeft[product._id]?.hours || "00"}
                          </span>
                          <span className="text-foreground-muted text-xs">
                            Hours
                          </span>
                        </div>
                        <div className="bg-surface-subtle border border-border-subtle rounded p-2 text-center">
                          <span className="block text-2xl font-bold font-numeric text-brand-gold">
                            {timeLeft[product._id]?.minutes || "00"}
                          </span>
                          <span className="text-foreground-muted text-xs">
                            Minutes
                          </span>
                        </div>
                        <div className="bg-surface-subtle border border-border-subtle rounded p-2 text-center">
                          <span className="block text-2xl font-bold font-numeric text-brand-gold">
                            {timeLeft[product._id]?.seconds || "00"}
                          </span>
                          <span className="text-foreground-muted text-xs">
                            Seconds
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <h3
                    className={`text-lg font-semibold ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    } mb-2`}
                  >
                    Description:
                  </h3>
                  <div
                    className={isDarkMode ? "text-gray-300" : "text-gray-600"}
                  >
                    {renderDescription()}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex flex-wrap gap-4 mt-6">
                  <button
                    onClick={() => navigate(`/product/${id}`)}
                    className="btn-canonical btn-canonical-lg btn-canonical-primary"
                  >
                    {timeLeft[product._id]?.isUpcoming
                      ? "View Upcoming Auction"
                      : timeLeft[product._id]?.isEnded
                      ? "View Completed Auction"
                      : "Place Bid Now"}
                  </button>
                  <button
                    onClick={() => window.history.back()}
                    className="btn-canonical btn-canonical-lg btn-canonical-secondary"
                  >
                    Back
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div
            className={`text-center py-10 ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            }`}
          >
            <p>No product details available.</p>
          </div>
        )}

        {/* Related Products Section */}
        {isFetchingRelated ? (
          <RelatedProductsSkeleton />
        ) : (
          relatedProducts &&
          relatedProducts.length > 0 && (
            <div className="mt-16">
              <h2
                className={`text-2xl font-bold mb-6 text-center ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}
              >
                Related Products in {product.category}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {relatedProducts.map((relatedProduct, index) => (
                  <motion.div
                    key={relatedProduct._id}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    variants={cardVariants}
                    transition={{ delay: index * 0.1, duration: 0.6 }}
                    className="bg-surface border border-border-subtle rounded-lg overflow-hidden shadow-card transform transition-all hover:scale-105 hover:shadow-xl cursor-pointer"
                    onClick={() => navigate(`/product/${relatedProduct._id}`)}
                  >
                    {/* Product Image */}
                    <div className="h-48 overflow-hidden relative">
                      {/* Timer added above the image */}
                      {timeLeft[relatedProduct._id] && (
                        <div className="absolute z-10 top-2 left-2 bg-black/60 text-white px-2 py-1 rounded-md text-xs font-numeric">
                          <span>{timeLeft[relatedProduct._id].days}d </span>
                          <span>{timeLeft[relatedProduct._id].hours}h </span>
                          <span>{timeLeft[relatedProduct._id].minutes}m </span>
                          <span>{timeLeft[relatedProduct._id].seconds}s</span>
                        </div>
                      )}

                      {relatedProduct.images &&
                      relatedProduct.images.length > 0 ? (
                        <img
                          src={getOptimizedCardImage(relatedProduct.images[0].secure_url, 400)}
                          alt={relatedProduct.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-surface-subtle flex items-center justify-center text-foreground-muted">
                          No Image
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-foreground mb-2 truncate">
                        {relatedProduct.name}
                      </h3>

                      <div className="flex justify-between items-center mb-3">
                        <span className="text-foreground-secondary">
                          {relatedProduct.category}
                        </span>
                        <span className="text-brand-gold font-bold font-numeric">
                          ₹
                          {relatedProduct.biddingStartPrice?.toLocaleString("en-IN") ||
                            "0"}
                        </span>
                      </div>

                      {/* Countdown Timer */}
                      <div className="bg-surface-subtle border border-border-subtle rounded p-2 text-center">
                        <div className="grid grid-cols-4 gap-1 text-xs">
                          <div>
                            <span className="block text-lg font-bold font-numeric text-brand-gold">
                              {timeLeft[relatedProduct._id]?.days || "00"}
                            </span>
                            <span className="text-foreground-muted text-xs">
                              Days
                            </span>
                          </div>
                          <div>
                            <span className="block text-lg font-bold font-numeric text-brand-gold">
                              {timeLeft[relatedProduct._id]?.hours || "00"}
                            </span>
                            <span className="text-foreground-muted text-xs">
                              Hrs
                            </span>
                          </div>
                          <div>
                            <span className="block text-lg font-bold font-numeric text-brand-gold">
                              {timeLeft[relatedProduct._id]?.minutes || "00"}
                            </span>
                            <span className="text-foreground-muted text-xs">
                              Min
                            </span>
                          </div>
                          <div>
                            <span className="block text-lg font-bold font-numeric text-brand-gold">
                              {timeLeft[relatedProduct._id]?.seconds || "00"}
                            </span>
                            <span className="text-foreground-muted text-xs">
                              Sec
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default SearchAndPostDetail;
