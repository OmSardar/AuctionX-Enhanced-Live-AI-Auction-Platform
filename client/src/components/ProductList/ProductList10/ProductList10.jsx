import React, { useState, useEffect } from "react";
import PopupModal from "../../Modals/PopupModal/PopupModal";
import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext";

const ProductList = () => {
  const { currentTheme } = useThemeProvider();
  const [products, setProducts] = useState([]);
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(true);
  const [partialLoading, setPartialLoading] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const productsPerPage = 7;
  const API_URL = import.meta.env.VITE_API_URL;

  // Helper function to randomize array
  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Initialize timers (placeholder for your timer logic)
  const initializeTimers = (products) => {
    // console.log("Initializing timers for", products.length, "products");
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(`${API_URL}/api/products/`);
        const data = await response.json();

        const productsArray = data.products || [];
        const activeProducts = productsArray.filter(
          (product) => product.status === "Active"
        );

        if (activeProducts.length === 0) {
          console.log("No active products found");
        }

        const initialPartialLoading = {};
        activeProducts.forEach((product) => {
          initialPartialLoading[product._id] = true;
        });
        setPartialLoading(initialPartialLoading);

        const randomizedData = shuffleArray(activeProducts);
        setProducts(randomizedData);
        setDisplayedProducts(randomizedData.slice(0, productsPerPage));
        setIsFetching(false);
        setLoading(false);

        randomizedData.slice(0, productsPerPage).forEach((product, index) => {
          setTimeout(() => {
            setPartialLoading((prev) => ({
              ...prev,
              [product._id]: false,
            }));
          }, 500 + index * 300);
        });

        initializeTimers(randomizedData);
      } catch (error) {
        console.error("Error fetching products:", error);
        setIsFetching(false);
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Skeleton Loader Component with dark mode support
  const SkeletonLoader = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 lg:grid-rows-5 gap-4 p-4 min-h-screen bg-canvas text-foreground">
      {/* Skeleton for Product 1 */}
      <div className="lg:col-span-2 lg:row-span-5 shadow-card rounded-lg bg-surface-subtle animate-pulse"></div>

      {/* Skeleton for Product 2 */}
      <div className="lg:col-start-3 lg:row-span-3 shadow-card rounded-lg bg-surface-subtle animate-pulse"></div>

      {/* Skeleton for Product 3 */}
      <div className="lg:col-start-4 lg:row-span-2 shadow-card rounded-lg bg-surface-subtle animate-pulse"></div>

      {/* Skeleton for Product 4 */}
      <div className="lg:col-start-5 lg:row-span-3 shadow-card rounded-lg bg-surface-subtle animate-pulse"></div>

      {/* Skeleton for Product 5 */}
      <div className="lg:col-start-3 lg:row-start-4 lg:row-span-2 shadow-card rounded-lg bg-surface-subtle animate-pulse"></div>

      {/* Skeleton for Product 6 */}
      <div className="lg:col-start-4 lg:row-start-3 lg:row-span-3 shadow-card rounded-lg bg-surface-subtle animate-pulse"></div>

      {/* Skeleton for Product 7 */}
      <div className="lg:col-start-5 lg:row-start-4 lg:row-span-2 shadow-card rounded-lg bg-surface-subtle animate-pulse"></div>
    </div>
  );

  // Individual product skeleton with semantic tokens
  const ProductSkeleton = ({ className }) => (
    <div className={`${className} shadow-card rounded-lg bg-surface-subtle animate-pulse`}></div>
  );

  if (loading) {
    return <SkeletonLoader />;
  }

  // Handle case when no products are found
  if (displayedProducts.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-canvas text-foreground">
        <div className="text-center p-8 rounded-lg shadow-card bg-surface border border-border-subtle text-foreground">
          <h2 className="text-xl font-bold">No products available</h2>
          <p className="mt-2 text-foreground-secondary">Check back later for new items</p>
        </div>
      </div>
    );
  }

  // Helper function to get the primary image URL
  const getProductImage = (product) => {
    if (
      product.hasBanner &&
      product.bannerImage &&
      product.bannerImage.secure_url
    ) {
      return product.bannerImage.secure_url;
    } else if (
      product.images &&
      product.images.length > 0 &&
      product.images[0].secure_url
    ) {
      return product.images[0].secure_url;
    }
    return "/lot-placeholder.svg";
  };

  const renderCard = (index, gridClasses) => {
    const product = displayedProducts[index];
    if (!product) return <ProductSkeleton key={index} className={gridClasses} />;
    if (partialLoading[product._id]) return <ProductSkeleton key={product._id} className={gridClasses} />;

    return (
      <div
        key={product._id}
        className={`${gridClasses} shadow-card hover:shadow-card-hover border border-border-subtle rounded-lg relative overflow-hidden bg-surface group cursor-pointer transition-all duration-300 product-card clickable-card`}
        data-sound-interactive="true"
        tabIndex={0}
        role="button"
        aria-label={`View details for ${product.name}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedProduct(product);
          }
        }}
        onClick={() => setSelectedProduct(product)}
      >
        <img
          src={getProductImage(product)}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/lot-placeholder.svg";
          }}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white p-4 flex flex-col justify-end">
          <h2 className="text-base sm:text-lg font-bold truncate drop-shadow-xs">{product.name}</h2>
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="font-numeric font-semibold text-sm sm:text-base text-primary-200">
              ₹{product.biddingStartPrice.toLocaleString()}
            </p>
            <button
              type="button"
              className="btn-canonical btn-canonical-sm btn-canonical-primary shadow-xs"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedProduct(product);
              }}
            >
              Bid Now
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative bg-canvas text-foreground">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 lg:grid-rows-5 gap-4 p-4 min-h-screen">
        {renderCard(0, "lg:col-span-2 lg:row-span-5 min-h-[300px]")}
        {renderCard(1, "lg:col-start-3 lg:row-span-3 min-h-[220px]")}
        {renderCard(2, "lg:col-start-4 lg:row-span-2 min-h-[180px]")}
        {renderCard(3, "lg:col-start-5 lg:row-span-3 min-h-[220px]")}
        {renderCard(4, "lg:col-start-3 lg:row-start-4 lg:row-span-2 min-h-[180px]")}
        {renderCard(5, "lg:col-start-4 lg:row-start-3 lg:row-span-3 min-h-[220px]")}
        {renderCard(6, "lg:col-start-5 lg:row-start-4 lg:row-span-2 min-h-[180px]")}
      </div>
      {selectedProduct && (
        <PopupModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
};

export default ProductList;
