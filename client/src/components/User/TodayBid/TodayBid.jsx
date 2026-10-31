import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactDOM from "react-dom";
import PopupModal from "../../Modals/PopupModal/PopupModal"; // Fixed import name
import { Clock, Tag, DollarSign, Calendar } from "lucide-react";
import {
  parseAuctionDates,
  calculateAuctionTime,
} from "../../../utils/auctionTimer";
import soundManager from "../../../utils/soundManager";
import { getOptimizedCardImage } from "../../../utils/imageOptimizer";

const TodayBid = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null); // Changed to store full product object
  const [timeLeft, setTimeLeft] = useState({});
  const productsPerPage = 12;
  const intervalsRef = useRef({});
  const API_URL = import.meta.env.VITE_API_URL;

  const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);

  const getDayName = (dateString) => {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const date = new Date(dateString);
    return days[date.getDay()] || "Unknown";
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsFetching(true);

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

        const today = new Date().toISOString().split("T")[0];

        const activeProducts = data.products.filter(
          (product) =>
            product.status === "Active" &&
            product.biddingStartDate &&
            new Date(product.biddingStartDate).toISOString().split("T")[0] ===
              today
        );

        console.log("Active products for today:", activeProducts.length);

        if (activeProducts.length > 0) {
          const randomizedData = shuffleArray(activeProducts);
          setProducts(randomizedData);
          setDisplayedProducts(randomizedData.slice(0, productsPerPage));

          initializeTimers(randomizedData);
        } else {
          console.log("No active products found for today");
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

    fetchProducts();

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
      const { startDate, endDate } = parseAuctionDates(
        product.biddingStartDate,
        product.biddingStartTime,
        product.biddingEndTime
      );

      const updateTimer = () => {
        const calc = calculateAuctionTime(startDate, endDate, product.status || "Active");
        setTimeLeft((prev) => ({
          ...prev,
          [product._id]: calc.timeLeft,
        }));
      };

      updateTimer();
      intervalsRef.current[product._id] = setInterval(updateTimer, 1000);
    });
  };

  const formatTimeLeft = (productId) => {
    if (timeLeft[productId]) {
      const { days, hours, minutes, seconds } = timeLeft[productId];
      const dNum = parseInt(days, 10);
      if (dNum > 0) {
        return `${dNum}d ${hours}h ${minutes}m ${seconds}s`;
      }
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return "00h 00m 00s";
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

  const calculateTimeLeft = (productId) => {
    if (timeLeft[productId]) {
      const { hours, minutes, seconds } = timeLeft[productId];
      return `${hours}:${minutes}:${seconds}`;
    }
    return "00:00:00";
  };

  const handleOpenPopup = (productId) => {
    // Find the full product object by ID
    const product = products.find((p) => p._id === productId);
    if (product) {
      setSelectedProduct(product);
    } else {
      console.error("Product not found:", productId);
    }
  };

  const handleClosePopup = () => {
    setSelectedProduct(null);
  };

  return (
    <div className="pt-24 bg-canvas min-h-screen text-foreground">
      <div className="container mx-auto px-4 pb-16">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Today's Bidding
          </h2>
          <p className="text-foreground-secondary max-w-2xl mx-auto">
            Explore today's handpicked collection of premium items available for
            bidding. Don't miss your chance to get amazing deals!
          </p>
        </div>

        {isFetching ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-action-primary"></div>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="text-center py-16 bg-surface border border-border-subtle rounded-lg shadow-sm">
            <h3 className="text-xl font-medium text-foreground mb-2">
              No items available for bidding today
            </h3>
            <p className="text-foreground-secondary mb-4">
              Check back tomorrow for new bidding opportunities!
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
                  <div className="absolute top-3 right-3 bg-action-primary text-action-primary-foreground font-semibold px-3 py-1 rounded-full text-xs sm:text-sm font-numeric shadow-md">
                    {formatTimeLeft(product._id)}
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
                      <Calendar
                        size={16}
                        className="text-foreground-muted mr-2 shrink-0"
                      />
                      <p className="text-sm text-foreground-secondary truncate">
                        {getDayName(product.biddingStartDate)}
                      </p>
                    </div>
                  </div>

                  <button
                    className="btn-canonical btn-canonical-md btn-canonical-primary w-full mt-4"
                    onClick={() => {
                      soundManager.playClick();
                      handleOpenPopup(product._id);
                    }}
                    onMouseEnter={() => soundManager.playHover()}
                  >
                    <span>Bid Now</span>
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
          <PopupModal product={selectedProduct} onClose={handleClosePopup} />,
          document.body
        )}
    </div>
  );
};

export default TodayBid;
