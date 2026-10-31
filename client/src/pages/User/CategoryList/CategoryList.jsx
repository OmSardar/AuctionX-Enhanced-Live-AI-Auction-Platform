import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { AnimatePresence } from "framer-motion";
import PopupModal from "../../../components/Modals/PopupModal/PopupModal";
import { EmptyState, ErrorState } from "../../../components/ui/EmptyState";
import { RouteLoadingFallback } from "../../../components/ui/RouteLoadingFallback";
import {
  parseAuctionDates,
  calculateAuctionTime,
} from "../../../utils/auctionTimer";
import soundManager from "../../../utils/soundManager";
const API_URL = import.meta.env.VITE_API_URL;

const CategoryList = () => {
  const [products, setProducts] = useState([]);
  const [timeLeft, setTimeLeft] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const intervalsRef = useRef({});
  const { category } = useParams();

  // Convert dashes to spaces for API call and display
  const formattedCategory = category.replace(/-/g, " ");

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

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/api/products/category/${formattedCategory}`
      );
      const fetchedProducts = response.data;

      setProducts(fetchedProducts);
      initializeTimers(fetchedProducts);
      setError(null);
    } catch (error) {
      console.error("Error fetching products:", error);
      setError("Failed to fetch products. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [formattedCategory]);

  useEffect(() => {
    fetchProducts();

    return () => {
      clearAllTimers();
    };
  }, [formattedCategory, fetchProducts]);

  const openPopup = (product) => {
    soundManager.playClick();
    setSelectedProduct(product);
  };

  const closePopup = () => {
    setSelectedProduct(null);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <RouteLoadingFallback />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorState
          title="Failed to Load Products"
          message={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="w-full bg-canvas text-foreground transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {formattedCategory} Products
          </h2>
          <p className="mt-2 text-sm text-foreground-secondary">
            Explore live auctions and available listings in this category
          </p>
        </div>

        {products.length === 0 ? (
          <EmptyState
            title={`No ${formattedCategory} Products Found`}
            description={`There are currently no active auctions or products listed under ${formattedCategory}.`}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product._id}
                className="bg-surface border border-border-subtle shadow-card hover:shadow-card-hover rounded-xl overflow-hidden transform transition-all duration-200 hover:-translate-y-1 cursor-pointer flex flex-col justify-between min-w-0 h-full product-card clickable-card"
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
              >
                {/* Product Images Carousel */}
                <div className="w-full aspect-4/3 overflow-hidden bg-surface-subtle shrink-0">
                  {product.images.length > 0 ? (
                    <img
                      src={product.images[0].secure_url}
                      alt={`${product.name} - Main Image`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-subtle flex items-center justify-center text-foreground-muted">
                      No Image
                    </div>
                  )}
                </div>

                {/* Product Details */}
                <div className="p-5 flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 line-clamp-2 break-words" title={product.name}>
                      {product.name}
                    </h3>

                    <div className="flex justify-between items-center mb-3 min-w-0 gap-2">
                      <span className="text-xs sm:text-sm text-foreground-secondary truncate">
                        Category: {product.category}
                      </span>
                      <span className="text-base sm:text-lg font-bold text-action-primary font-numeric shrink-0">
                        ₹{Number(product.biddingStartPrice || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>


                  {/* Countdown Timer */}
                  <div className="bg-surface-subtle border border-border-subtle rounded-xl p-3 text-center">
                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-surface border border-border-subtle shadow-xs rounded-lg p-2">
                        <span className="block text-2xl font-bold font-numeric text-foreground">
                          {timeLeft[product._id]?.days || "00"}
                        </span>
                        <span className="text-xs text-foreground-muted">
                          Days
                        </span>
                      </div>
                      <div className="bg-surface border border-border-subtle shadow-xs rounded-lg p-2">
                        <span className="block text-2xl font-bold font-numeric text-foreground">
                          {timeLeft[product._id]?.hours || "00"}
                        </span>
                        <span className="text-xs text-foreground-muted">
                          Hours
                        </span>
                      </div>
                      <div className="bg-surface border border-border-subtle shadow-xs rounded-lg p-2">
                        <span className="block text-2xl font-bold font-numeric text-foreground">
                          {timeLeft[product._id]?.minutes || "00"}
                        </span>
                        <span className="text-xs text-foreground-muted">
                          Minutes
                        </span>
                      </div>
                      <div className="bg-surface border border-border-subtle shadow-xs rounded-lg p-2">
                        <span className="block text-2xl font-bold font-numeric text-foreground">
                          {timeLeft[product._id]?.seconds || "00"}
                        </span>
                        <span className="text-xs text-foreground-muted">
                          Seconds
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Canonical CTA */}
                  <button
                    type="button"
                    className="btn-canonical btn-canonical-md btn-canonical-primary w-full mt-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPopup(product);
                    }}
                  >
                    Bid Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {selectedProduct && (
            <PopupModal
              product={{
                ...selectedProduct,
                imageSrc: selectedProduct.images[0]?.secure_url || "",
                imageAlt: `${selectedProduct.name} - Main Image`,
                price: `₹${Number(selectedProduct.biddingStartPrice || 0).toLocaleString()}`,
                color: selectedProduct.category,
              }}
              onClose={closePopup}

            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CategoryList;
