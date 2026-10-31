import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactDOM from "react-dom";
import { Clock, Tag, DollarSign, Calendar } from "lucide-react";
import ProductDetailsPopup from "../../Modals/PopupModal/PopupModal";
import {
  parseAuctionDates,
  calculateAuctionTime,
} from "../../../utils/auctionTimer";
import soundManager from "../../../utils/soundManager";
import { getOptimizedCardImage } from "../../../utils/imageOptimizer";

const TomorrowBid = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null); // Changed from selectedProductId
  const [timeLeft, setTimeLeft] = useState({});
  const productsPerPage = 12;
  const intervalsRef = useRef({});
  const API_URL = import.meta.env.VITE_API_URL;

  const handleOpenPopup = (product) => {
    // Changed to accept full product
    setSelectedProduct(product);
  };

  const handleClosePopup = () => {
    setSelectedProduct(null);
  };

  const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);

  useEffect(() => {
    const fetchAndRandomizeProducts = async () => {
      try {
        setIsFetching(true);
        console.log("Attempting to fetch products for tomorrow");

        const response = await fetch(`${API_URL}/api/products/`);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.products || !Array.isArray(data.products)) {
          throw new Error(
            "Expected products array in response but got: " +
              JSON.stringify(data)
          );
        }

        // Calculate tomorrow's start and end times
        const tomorrowStart = new Date(
          new Date().setDate(new Date().getDate() + 1)
        ).setHours(0, 0, 0, 0);
        const tomorrowEnd = new Date(
          new Date().setDate(new Date().getDate() + 1)
        ).setHours(23, 59, 59, 999);

        // Filter active products starting tomorrow
        const activeProducts = data.products.filter((product) => {
          const biddingStartDate = new Date(product.biddingStartDate).getTime();
          return (
            product.status === "Active" &&
            biddingStartDate >= tomorrowStart &&
            biddingStartDate <= tomorrowEnd
          );
        });

        console.log("Active products for tomorrow:", activeProducts.length);

        if (activeProducts.length > 0) {
          const randomizedData = shuffleArray(activeProducts);
          setProducts(randomizedData);
          setDisplayedProducts(randomizedData.slice(0, productsPerPage));

          // Initialize timers for products
          initializeTimers(randomizedData);
        } else {
          console.log("No active products starting tomorrow");
          setProducts([]);
          setDisplayedProducts([]);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
        setDisplayedProducts([]);
      } finally {
        setIsLoading(false);
        setIsFetching(false);
      }
    };

    fetchAndRandomizeProducts();

    // Cleanup function
    return () => {
      Object.values(intervalsRef.current).forEach(clearInterval);
      intervalsRef.current = {};
    };
  }, []);

  const initializeTimers = (productsList) => {
    Object.values(intervalsRef.current).forEach(clearInterval);
    intervalsRef.current = {};
    if (!Array.isArray(productsList)) return;

    productsList.forEach((product) => {
      if (!product?._id) return;
      const { startDate } = parseAuctionDates(
        product.biddingStartDate,
        product.biddingStartTime
      );

      if (startDate) {
        const updateTimer = () => {
          const now = Date.now();
          const diff = startDate.getTime() - now;
          if (diff > 0) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor(
              (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
            );
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft((prev) => ({
              ...prev,
              [product._id]: {
                days: String(days).padStart(2, "0"),
                hours: String(hours).padStart(2, "0"),
                minutes: String(minutes).padStart(2, "0"),
                seconds: String(seconds).padStart(2, "0"),
              },
            }));
          } else {
            clearInterval(intervalsRef.current[product._id]);
            delete intervalsRef.current[product._id];
            setTimeLeft((prev) => ({
              ...prev,
              [product._id]: {
                days: "00",
                hours: "00",
                minutes: "00",
                seconds: "00",
              },
            }));
          }
        };

        updateTimer();
        intervalsRef.current[product._id] = setInterval(updateTimer, 1000);
      }
    });
  };

  const loadMoreProducts = useCallback(() => {
    if (isLoading) return;
    setIsLoading(true);

    setTimeout(() => {
      const nextIndex = currentIndex + productsPerPage;
      setDisplayedProducts((prev) => [
        ...prev,
        ...products.slice(currentIndex, nextIndex),
      ]);
      setCurrentIndex(nextIndex);
      setIsLoading(false);
    }, 1000);
  }, [currentIndex, isLoading, products]);

  const handleScroll = (e) => {
    const bottom =
      e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 100;
    if (bottom && !isLoading && currentIndex < products.length) {
      loadMoreProducts();
    }
  };

  const formatTimeLeft = (productId) => {
    if (timeLeft[productId]) {
      const { days, hours, minutes, seconds } = timeLeft[productId];
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
    return "Loading...";
  };

  return (
    <div className="pt-24 bg-canvas min-h-screen text-foreground">
      <div className="container mx-auto px-4 pb-16">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Tomorrow's Bidding
          </h2>
          <p className="text-foreground-secondary max-w-2xl mx-auto">
            Get a preview of tomorrow's exclusive items and prepare your bids
            early. Set reminders to catch these exciting opportunities!
          </p>
        </div>

        {isFetching ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-action-primary"></div>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="text-center py-16 bg-surface border border-border-subtle rounded-lg shadow-sm">
            <h3 className="text-xl font-medium text-foreground mb-2">
              No items scheduled for bidding tomorrow
            </h3>
            <p className="text-foreground-secondary mb-4">
              Check back later for upcoming bidding opportunities!
            </p>
          </div>
        ) : (
          <div
            id="result"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-y-auto"
            onScroll={handleScroll}
            style={{ maxHeight: "calc(100vh - 240px)" }}
          >
            {displayedProducts.map((product) => (
              <div
                key={product._id}
                className="bg-surface border border-border-subtle rounded-xl shadow-card overflow-hidden transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 flex flex-col justify-between min-w-0 h-full product-card"
                data-sound-interactive="true"
              >
                <div className="relative w-full aspect-4/3 bg-surface-subtle overflow-hidden shrink-0">
                  <img
                    src={
                      product.images[0]?.secure_url
                        ? getOptimizedCardImage(product.images[0].secure_url, 450)
                        : "/api/placeholder/400/320"
                    }
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 bg-dashboard-accent text-white font-semibold px-3 py-1 rounded-full text-xs sm:text-sm font-numeric shadow-md">
                    Coming Soon
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <h5 className="text-base sm:text-lg font-semibold text-foreground mb-2 line-clamp-2 break-words" title={product.name}>
                      {product.name}
                    </h5>

                    <div className="flex items-center mb-2">
                      <Tag
                        size={16}
                        className="text-foreground-muted mr-2 shrink-0"
                      />
                      <p className="text-sm text-foreground-secondary truncate">
                        {product.category}
                      </p>
                    </div>

                    <div className="flex items-center mb-2">
                      <DollarSign size={16} className="text-action-primary mr-2 shrink-0" />
                      <p className="text-base sm:text-lg font-bold font-numeric text-action-primary">
                        ₹{Number(product.biddingStartPrice || 0).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center mb-4">
                      <Clock size={16} className="text-dashboard-accent mr-2 shrink-0" />
                      <p className="text-sm text-foreground-secondary font-medium font-numeric truncate">
                        Starts in: {formatTimeLeft(product._id)}
                      </p>
                    </div>
                  </div>

                  <button
                    className="btn-canonical btn-canonical-md btn-canonical-secondary w-full mt-4"
                    onClick={() => {
                      soundManager.playClick();
                      handleOpenPopup(product);
                    }}
                    onMouseEnter={() => soundManager.playHover()}
                  >
                    <span>Preview Item</span>
                  </button>
                </div>
              </div>

            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-action-primary"></div>
          </div>
        )}
      </div>

      {selectedProduct &&
        ReactDOM.createPortal(
          <div className="fixed inset-0  bg-opacity-60 flex justify-center items-center z-50 p-4">
            <ProductDetailsPopup
              product={selectedProduct} // Pass full product object
              onClose={handleClosePopup}
            />
          </div>,
          document.body
        )}
    </div>
  );
};

export default TomorrowBid;
