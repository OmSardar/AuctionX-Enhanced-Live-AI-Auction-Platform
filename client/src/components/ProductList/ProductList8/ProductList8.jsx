import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ImPriceTags } from "react-icons/im";
import PopupModal from "../../Modals/PopupModal/PopupModal";
import ReactDOM from "react-dom";
import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext"; // Adjust the path as needed

// Skeleton Component - Standardized
const ProductSkeleton = () => {
  return (
    <div className="bg-surface-subtle border border-border-subtle rounded-lg p-4 m-2 w-48 text-center flex-shrink-0 animate-pulse">
      <div className="w-full h-44 bg-surface rounded-lg mb-2"></div>
      <div className="h-4 bg-surface rounded w-3/4 mx-auto mb-2"></div>
      <div className="h-4 bg-surface rounded w-1/2 mx-auto mb-2"></div>
      <div className="h-10 bg-surface rounded-lg w-full mt-2"></div>
    </div>
  );
};

const ProductList8 = () => {
  const productListRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [displayCount, setDisplayCount] = useState(7);
  const [category, setCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { currentTheme } = useThemeProvider();
  const API_URL = import.meta.env.VITE_API_URL;

  const handleOpenPopup = (productId) => {
    const product = products.find((p) => p._id === productId);
    setSelectedProduct(product);
  };

  const handleClosePopup = () => {
    setSelectedProduct(null);
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/products/`);
      const productsArray = response.data.products || [];
      const activeProducts = productsArray.filter(
        (product) => product.status === "Active"
      );
      const filteredProducts = category
        ? activeProducts.filter((product) => product.category === category)
        : activeProducts;
      const shuffledProducts = shuffleArray(filteredProducts);
      setProducts(shuffledProducts.slice(0, 20));
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const shuffleArray = (array) => {
    return array.sort(() => Math.random() - 0.5);
  };

  useEffect(() => {
    fetchProducts();
  }, [category]);

  const scroll = (direction) => {
    const { current } = productListRef;
    if (current) {
      const scrollAmount =
        direction === "left" ? -current.clientWidth : current.clientWidth;
      current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const loadMoreProducts = () => {
    setDisplayCount((prevCount) => Math.min(prevCount + 7, products.length));
  };

  return (
    <div className="flex items-center p-5 relative w-full rounded-xl bg-surface border border-border-subtle shadow-card">
      {/* Left Scroll Button */}
      <button
        aria-label="Scroll left"
        className="btn-canonical btn-canonical-icon-md btn-canonical-secondary absolute top-1/2 -translate-y-1/2 left-3 z-10 shadow-md text-base"
        onClick={() => scroll("left")}
      >
        ❮
      </button>

      {/* Product List */}
      <div
        className="flex gap-4 overflow-x-auto scrollbar-hide flex-nowrap w-full px-2"
        ref={productListRef}
      >
        {isLoading ? (
          // Display Skeleton Loading State
          Array.from({ length: displayCount }).map((_, index) => (
            <ProductSkeleton key={index} />
          ))
        ) : products.length === 0 ? (
          <p className="text-base text-center w-full p-8 rounded-lg bg-surface-subtle text-foreground-muted">
            No products available yet.
          </p>
        ) : (
          products.slice(0, displayCount).map((product) => (
            <div
              key={product._id}
              className="bg-surface rounded-xl border border-border-subtle p-3.5 w-48 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover flex-shrink-0 flex flex-col justify-between min-w-0 product-card"
              data-sound-interactive="true"
            >
              <div className="flex-1 flex flex-col min-w-0">
                <div className="w-full aspect-square rounded-lg overflow-hidden bg-surface-subtle mb-2.5">
                  <img
                    src={product.images[0]?.secure_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="font-semibold text-sm line-clamp-2 break-words text-foreground" title={product.name}>
                  {product.name}
                </p>
                <p className="text-sm font-bold flex items-center justify-center gap-1.5 truncate text-action-primary font-numeric mt-1.5">
                  <ImPriceTags className="text-xs" /> ₹{Number(product.biddingStartPrice || 0).toLocaleString()}
                </p>
              </div>
              <button
                className="btn-canonical btn-canonical-md btn-canonical-primary w-full mt-3"
                onClick={() => handleOpenPopup(product._id)}
              >
                Bid Now
              </button>
            </div>

          ))
        )}
      </div>

      {/* Right Scroll Button */}
      <button
        aria-label="Scroll right"
        className="btn-canonical btn-canonical-icon-md btn-canonical-secondary absolute top-1/2 -translate-y-1/2 right-3 z-10 shadow-md text-base"
        onClick={() => {
          scroll("right");
          loadMoreProducts();
        }}
      >
        ❯
      </button>

      {/* Popup */}
      {selectedProduct &&
        ReactDOM.createPortal(
          <PopupModal product={selectedProduct} onClose={handleClosePopup} />,
          document.body
        )}
    </div>
  );
};

export default ProductList8;
