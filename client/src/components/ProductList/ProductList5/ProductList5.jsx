import { useEffect, useRef, useState } from "react";
import React from "react";
import PopupModal from "../../Modals/PopupModal/PopupModal";
import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext"; // Adjust the path as needed
import {
  parseAuctionDates,
  calculateAuctionTime,
} from "../../../utils/auctionTimer";

import { formatCurrency } from "../../../lib/utils";

export default function ProductList5() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [timeLeft, setTimeLeft] = useState({});
  const productRefs = useRef([]);
  const intervalsRef = useRef({});
  const { currentTheme } = useThemeProvider();
  const API_URL = import.meta.env.VITE_API_URL;

  // Function to shuffle array (Fisher-Yates algorithm)
  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Function to truncate text
  const truncateText = (text, maxLength = 60) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  // Helper function to get first description item
  const getFirstDescription = (descriptionArray) => {
    if (!descriptionArray || !Array.isArray(descriptionArray) || descriptionArray.length === 0) {
      return { name: "", description: "" };
    }
    return descriptionArray[0];
  };

  const clearAllTimers = () => {
    Object.values(intervalsRef.current).forEach((intervalId) => {
      clearInterval(intervalId);
    });
    intervalsRef.current = {};
  };

  // Timer initialization and update functions
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
        
        // Check if data.products exists
        const productsArray = data.products || [];
        
        const activeProducts = productsArray
          .filter((product) => product.status === "Active")
          .slice(0, 10); // Limit to 10 products

        if (activeProducts.length > 0) {
          const randomizedData = shuffleArray(activeProducts);
          setProducts(randomizedData);
          
          // Initialize timers for products
          initializeTimers(randomizedData);
        } else {
          console.log("No active products found");
          setProducts([]);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();

    // Cleanup function to clear intervals
    return () => {
      clearAllTimers();
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const delay = entry.target.getAttribute("data-delay") || 0;
              setTimeout(() => {
                entry.target.classList.add("animate-slide-fade");
                entry.target.classList.remove("opacity-0");
              }, delay);
            }
          });
        },
        { threshold: 0.2 }
      );

      productRefs.current.forEach((card) => {
        if (card) observer.observe(card);
      });
      return () => observer.disconnect();
    }
  }, [loading]);

  return (
    <section className="w-full bg-canvas text-foreground py-16">
      <div className="container max-w-full mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 text-foreground">
          Our Snacks
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="p-4 sm:p-6 rounded-lg border border-border-subtle bg-surface-subtle animate-pulse h-64"
              ></div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {products.map((product, index) => {
              const firstDescItem = getFirstDescription(product.description);
              const productTimer = timeLeft[product._id] || {
                days: "00",
                hours: "00",
                minutes: "00",
                seconds: "00",
              };
              
              return (
                <div
                  key={product._id || index}
                  ref={(el) => (productRefs.current[index] = el)}
                  className="p-4 sm:p-6 rounded-lg bg-surface border border-border-subtle shadow-card hover:shadow-card-hover transition-transform duration-300 ease-in-out opacity-0 product-card flex flex-col justify-between"
                  data-delay={index * 100} // Sequential delay based on index
                >
                  <div>
                    <img
                      src={product.images && product.images[0]?.secure_url}
                      alt={product.name}
                      className="w-full h-32 sm:h-48 object-cover rounded-lg"
                    />
                    <h3 className="mt-3 sm:mt-4 text-lg sm:text-xl font-bold text-foreground">
                      {product.name}
                    </h3>
                    {firstDescItem && (
                      <>
                        <h4 className="text-sm font-medium text-foreground-secondary mt-1">
                          {firstDescItem.name}
                        </h4>
                        <p className="text-sm sm:text-base mt-1 text-foreground-muted">
                          {truncateText(firstDescItem.description)}
                        </p>
                      </>
                    )}
                    <p className="text-base sm:text-lg font-semibold mt-1 sm:mt-2 text-foreground font-numeric">
                      Starting at: {formatCurrency(product.biddingStartPrice)}
                    </p>
                  </div>
                  {/* Timer Display */}
                  <div className="mt-2 sm:mt-4">
                    <div className="flex justify-between text-sm font-medium text-foreground-secondary font-numeric">
                      <div className="flex flex-col items-center">
                        <span>{productTimer.days}</span>
                        <span className="text-xs text-foreground-muted">Days</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span>{productTimer.hours}</span>
                        <span className="text-xs text-foreground-muted">Hours</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span>{productTimer.minutes}</span>
                        <span className="text-xs text-foreground-muted">Mins</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span>{productTimer.seconds}</span>
                        <span className="text-xs text-foreground-muted">Secs</span>
                      </div>
                    </div>
                    <button
                      className="btn-canonical btn-canonical-md btn-canonical-primary w-full mt-3 sm:mt-4"
                      onClick={() => setSelectedProduct(product)}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <svg 
              className="w-16 h-16 mb-4 text-foreground-muted"
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
        )}
      </div>
      {selectedProduct && (
        <PopupModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          currentTheme={currentTheme}
        />
      )}
      <style>{`
        @keyframes slide-fade-up {
          0% { transform: translateY(50px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-fade {
          animation: slide-fade-up 0.5s ease-out forwards;
        }
      `}</style>
    </section>
  );
}