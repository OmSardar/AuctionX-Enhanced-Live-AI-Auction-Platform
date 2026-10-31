import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import PopupModal from "../../Modals/PopupModal/PopupModal";
import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext"; // Adjust the import path as needed
import {
  parseAuctionDates,
  calculateAuctionTime,
} from "../../../utils/auctionTimer";

const ProductList3 = () => {
  const { currentTheme } = useThemeProvider();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [timeLeft, setTimeLeft] = useState({});
  const intervalsRef = useRef({});
  const API_URL = import.meta.env.VITE_API_URL;

  // Shuffle array utility function
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

        // Extract the products array from the response
        const productsArray = data.products || [];

        // Filter active products
        const activeProducts = productsArray.filter(
          (product) => product.status === "Active"
        );

        if (activeProducts.length > 0) {
          const randomizedData = shuffleArray(activeProducts);
          // Limit to 8 items
          const limitedProducts = randomizedData.slice(0, 8);
          setProducts(limitedProducts);

          // Initialize timers for products
          initializeTimers(limitedProducts);
        } else {
          console.log("No active products found");
          setProducts([]);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();

    return () => {
      clearAllTimers();
    };
  }, []);

  const handleBuyNow = (product) => {
    const modalProduct = {
      ...product,
      imageSrc: product.images && product.images[0]?.secure_url,
      imageAlt: product.name,
      price: product.biddingStartPrice,
    };
    setSelectedProduct(modalProduct);
  };

  const closeModal = () => {
    setSelectedProduct(null);
  };

  return (
    <div className="container max-w-full mx-auto p-6 bg-canvas text-foreground">
      <h2 className="text-3xl font-extrabold mb-6 text-center text-foreground">
        Our Products
      </h2>

      {isLoading ? (
        <motion.div
          className="grid gap-6 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          viewport={{ once: true }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <motion.div
              key={index}
              className="flex flex-col bg-surface border border-border-subtle rounded-lg shadow-card hover:shadow-card-hover transform hover:scale-105 transition-all overflow-hidden"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              viewport={{ once: true }}
            >
              <div className="w-full h-60 bg-surface-subtle animate-pulse"></div>
              <div className="p-4 text-center">
                <div className="h-6 w-3/4 bg-surface-subtle animate-pulse rounded mx-auto"></div>
                <div className="h-5 w-1/2 bg-surface-subtle animate-pulse rounded mt-2 mx-auto"></div>
                <div className="h-10 w-full bg-surface-subtle animate-pulse rounded-lg mt-4"></div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : products.length > 0 ? (
        <motion.div
          className="grid gap-6 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          viewport={{ once: true }}
        >
          {products.map((product, index) => (
            <motion.div
              key={product._id || index}
              className="flex flex-col bg-surface border border-border-subtle rounded-lg shadow-card hover:shadow-card-hover transform hover:scale-105 transition-all relative overflow-hidden product-card"
              data-sound-interactive="true"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              viewport={{ once: true }}
            >
              {/* Timer Display */}
              <div className="absolute top-2 left-2 right-2 z-10 flex justify-between bg-surface/85 backdrop-blur-sm text-foreground border border-border-subtle font-semibold px-2.5 py-1 rounded-lg">
                <div className="text-xs font-numeric">
                  <span>{timeLeft[product._id]?.days || "00"}d </span>
                  <span>{timeLeft[product._id]?.hours || "00"}h </span>
                  <span>{timeLeft[product._id]?.minutes || "00"}m </span>
                  <span>{timeLeft[product._id]?.seconds || "00"}s</span>
                </div>
              </div>

              <div className="relative">
                <img
                  src={product.images && product.images[0]?.secure_url}
                  alt={product.name}
                  className="w-full aspect-4/3 object-cover"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between min-w-0">
                <div className="min-w-0 text-center">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground line-clamp-2 break-words" title={product.name}>
                    {product.name}
                  </h3>
                  <p className="text-base sm:text-lg font-bold text-action-primary font-numeric mt-1.5">
                    ₹{product.biddingStartPrice !== undefined ? Number(product.biddingStartPrice).toLocaleString() : 0}
                  </p>
                </div>
                <button
                  onClick={() => handleBuyNow(product)}
                  className="btn-canonical btn-canonical-md btn-canonical-primary w-full mt-4"
                >
                  Buy Now
                </button>
              </div>
            </motion.div>

          ))}
        </motion.div>
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

      {selectedProduct && (
        <PopupModal product={selectedProduct} onClose={closeModal} />
      )}
    </div>
  );
};

export default ProductList3;
