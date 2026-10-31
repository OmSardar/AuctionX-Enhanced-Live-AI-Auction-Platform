import React, { useState, useEffect, useContext } from "react";
import PopupModal from "../../Modals/PopupModal/PopupModal";
import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext"; // Adjust the import path as needed
import {
  parseAuctionDates,
  calculateAuctionTime,
} from "../../../utils/auctionTimer";

const ProductList6 = () => {
  const { currentTheme } = useThemeProvider();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    days: "00",
    hours: "00",
    minutes: "00",
    seconds: "00",
  });
  const API_URL = import.meta.env.VITE_API_URL;

  // Function to get first description item
  const getFirstDescription = (descriptionArray) => {
    if (
      !descriptionArray ||
      !Array.isArray(descriptionArray) ||
      descriptionArray.length === 0
    ) {
      return { name: "", description: "" };
    }
    return descriptionArray[0];
  };

  // Function to truncate text
  const truncateText = (text, maxLength = 25) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const response = await fetch(`${API_URL}/api/products/`);
        const data = await response.json();

        // Extract the products array from the response
        const productsArray = data.products || [];

        // Filter active products
        const activeProperties = productsArray.filter(
          (product) => product.status === "Active"
        );

        if (activeProperties.length > 0) {
          // Get the first property
          const selectedProperty = activeProperties[0];

          // Fetch seller data for the property
          if (selectedProperty.email) {
            try {
              // Fetch basic user data
              const sellerResponse = await fetch(
                `${API_URL}/api/auth/user/user/${selectedProperty.email}`
              );
              const sellerData = await sellerResponse.json();

              // Fetch profile picture specifically
              const picResponse = await fetch(
                `${API_URL}/api/auth/user/profile-pic?email=${selectedProperty.email}`
              );
              const picData = await picResponse.json();

              setProperty({
                ...selectedProperty,
                sellerData: {
                  ...sellerData,
                  profilePic: picData.profilePic,
                  name: picData.name || sellerData.name,
                },
              });
            } catch (error) {
              console.error(
                `Error fetching seller data for ${selectedProperty.email}:`,
                error
              );
              setProperty(selectedProperty);
            }
          } else {
            setProperty(selectedProperty);
          }
        } else {
          console.log("No active properties found");
          setProperty(null);
        }
      } catch (error) {
        console.error("Error fetching property:", error);
        setProperty(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, []);

  // Timer Effect
  useEffect(() => {
    let timerInterval;

    if (property && property.biddingStartDate && property.biddingEndTime) {
      const { startDate, endDate } = parseAuctionDates(
        property.biddingStartDate,
        property.biddingStartTime,
        property.biddingEndTime
      );

      const updateTimer = () => {
        const calc = calculateAuctionTime(startDate, endDate, property.status || "Active");
        setTimeLeft(calc.timeLeft);
      };

      // Initial timer calculation
      updateTimer();

      // Set up interval to update timer every second
      timerInterval = setInterval(updateTimer, 1000);
    }

    // Cleanup interval on component unmount
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [property]);

  const openModal = () => {
    if (!property) return;

    const firstDescItem = getFirstDescription(property.description);
    setSelectedProduct({
      id: property._id,
      imageSrc:
        property.images && property.images.length > 0
          ? property.images[0].secure_url
          : "",
      imageAlt: property.name,
      name: property.name,
      description: firstDescItem.description,
      price: property.biddingStartPrice,
      images: property.images || [],
      // Add any additional fields needed for the modal
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  if (loading) {
    return (
      <div className="w-full bg-canvas text-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 text-foreground">
            Featured Property
          </h2>
          <div className="flex flex-col mx-auto justify-center my-6 bg-surface border border-border-subtle rounded-xl shadow-card md:flex-row overflow-hidden">
            <div className="animate-pulse w-full h-64 md:w-1/4 bg-surface-subtle"></div>
            <div className="flex flex-col md:w-3/4 p-6 justify-between gap-4">
              <div className="animate-pulse h-6 w-1/3 bg-surface-subtle rounded"></div>
              <div className="animate-pulse h-12 w-1/2 bg-surface-subtle rounded"></div>
              <div className="animate-pulse h-10 w-full bg-surface-subtle rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="w-full bg-canvas text-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 text-foreground">
            Featured Property
          </h2>
          <div className="flex flex-col items-center justify-center py-12">
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
              No property available
            </h3>
            <p className="mt-1 text-sm text-foreground-muted">
              Check back soon for new listings
            </p>
          </div>
        </div>
      </div>
    );
  }

  const firstDescItem = getFirstDescription(property.description);

  return (
    <div className="w-full bg-canvas text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 text-foreground">
          Featured Property
        </h2>

        <div
          className="flex flex-col mx-auto justify-center my-6 bg-surface border border-border-subtle rounded-xl shadow-card hover:shadow-card-hover transition-all md:flex-row overflow-hidden cursor-pointer animate-fade-in product-card clickable-card"
          data-sound-interactive="true"
          tabIndex={0}
          role="button"
          aria-label={`View details for ${property.name}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openModal();
            }
          }}
          onClick={openModal}
        >
          {/* Image Section - Fixed Height and Width */}
          <div className="w-full md:w-1/3 h-64 md:h-auto min-h-[16rem] flex-shrink-0 relative">
            <img
              className="object-cover w-full h-full"
              src={
                property.images && property.images.length > 0
                  ? property.images[0].secure_url
                  : "/lot-placeholder.svg"
              }
              alt={property.name}
            />
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-dark-surface/85 backdrop-blur-xs text-white border border-white/10">
                {property.condition || "Live Auction"}
              </span>
            </div>
          </div>

          {/* Content Section */}
          <div className="flex flex-col md:w-2/3 p-6 justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 min-w-0">
              <div className="min-w-0 flex-1">
                <span className="text-xs uppercase tracking-wider font-semibold text-action-primary">
                  {property.category || "Property"}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-foreground mt-1 line-clamp-2 break-words" title={property.name}>
                  {property.name}
                </h3>
                <p className="text-sm text-foreground-muted mt-2 line-clamp-2">
                  {firstDescItem.description || "Exclusive property available for live bidding."}
                </p>
              </div>
              <div className="sm:text-right shrink-0">
                <span className="text-xs text-foreground-muted block">Starting Bid</span>
                <span className="text-2xl font-bold text-action-primary font-numeric">
                  ₹{property.biddingStartPrice !== undefined ? Number(property.biddingStartPrice).toLocaleString() : 0}
                </span>
              </div>
            </div>


            {/* Timer and Seller Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border-subtle">
              {/* Timer Display */}
              <div className="flex flex-col justify-center">
                <span className="text-xs font-medium text-foreground-muted mb-1.5">Time Remaining</span>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <span className="text-lg font-bold text-foreground font-numeric block">{timeLeft.days}</span>
                    <span className="text-[10px] text-foreground-muted uppercase">Days</span>
                  </div>
                  <span className="text-foreground-muted font-bold">:</span>
                  <div className="text-center">
                    <span className="text-lg font-bold text-foreground font-numeric block">{timeLeft.hours}</span>
                    <span className="text-[10px] text-foreground-muted uppercase">Hrs</span>
                  </div>
                  <span className="text-foreground-muted font-bold">:</span>
                  <div className="text-center">
                    <span className="text-lg font-bold text-foreground font-numeric block">{timeLeft.minutes}</span>
                    <span className="text-[10px] text-foreground-muted uppercase">Min</span>
                  </div>
                  <span className="text-foreground-muted font-bold">:</span>
                  <div className="text-center">
                    <span className="text-lg font-bold text-foreground font-numeric block">{timeLeft.seconds}</span>
                    <span className="text-[10px] text-foreground-muted uppercase">Sec</span>
                  </div>
                </div>
              </div>

              {/* Seller Info */}
              <div className="flex items-center gap-3 sm:justify-end">
                <img
                  className="w-10 h-10 rounded-full object-cover border border-border-subtle shadow-xs"
                  src={
                    property.sellerData?.profilePic ||
                    "/default-profile.png"
                  }
                  alt="Seller"
                />
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    {property.sellerData?.name || "Anonymous Seller"}
                  </h4>
                  <span className="text-xs text-foreground-muted block truncate max-w-[150px]">
                    {property.email}
                  </span>
                </div>
              </div>
            </div>

            {/* Action CTA */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                className="btn-canonical btn-canonical-md btn-canonical-primary w-full sm:w-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  openModal();
                }}
              >
                Place Bid Now
              </button>
            </div>
          </div>
        </div>

        {/* Render the PopupModal if isModalOpen is true */}
        {isModalOpen && selectedProduct && (
          <PopupModal product={selectedProduct} onClose={closeModal} />
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ProductList6;
