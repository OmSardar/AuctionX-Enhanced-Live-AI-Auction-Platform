import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext";
import axios from "axios";

const Banner6 = () => {
  const navigate = useNavigate();
  const { currentTheme } = useThemeProvider();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const API_URL = import.meta.env.VITE_API_URL;

  // Fetch banners from API
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/banners`, {
          params: {
            position: "top",
            isActive: true,
          },
        });

        // Access the banners data from the response
        const bannersData = response.data?.data || response.data || [];

        // Filter active banners and map to required format
        const formattedBanners = bannersData
          .filter((banner) => banner?.imageUrl && banner?.isActive)
          .map((banner) => ({
            id: banner._id,
            url: banner.imageUrl,
            author: banner.title,
            category: banner.description,
            link: banner.link,
          }));

        setBanners(formattedBanners);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching banners:", err);
        setError("Failed to load banners");
        setLoading(false);
        setBanners([]);
      }
    };

    fetchBanners();
  }, []);

  // Auto-rotation effect
  useEffect(() => {
    if (banners.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [banners.length]);

  // Navigate to link or category page
  const handleClick = (banner) => {
    if (banner.link) {
      if (banner.link.startsWith("http")) {
        window.open(banner.link, "_blank");
      } else {
        navigate(banner.link);
      }
    } else if (banner.category) {
      navigate(`/category/${banner.category}`);
    }
  };

  // Swipe handlers for touch devices
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (banners.length === 0) return;

    if (touchStart - touchEnd > 50) {
      // Swipe left
      setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }

    if (touchStart - touchEnd < -50) {
      // Swipe right
      setCurrentIndex((prevIndex) =>
        prevIndex === 0 ? banners.length - 1 : prevIndex - 1
      );
    }
  };

  // Go to next slide
  const nextSlide = () => {
    if (banners.length === 0) return;
    setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
  };

  // Go to previous slide
  const prevSlide = () => {
    if (banners.length === 0) return;
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? banners.length - 1 : prevIndex - 1
    );
  };

  if (loading) {
    return (
      <div className="w-full bg-canvas flex items-center justify-center p-3 sm:p-2 md:p-4 transition-colors duration-300">
        <div className="w-full mx-auto">
          <div className="relative overflow-hidden rounded-2xl shadow-warm-md border border-border h-[250px] sm:h-[300px] md:h-[400px] lg:h-[500px] w-full flex items-center justify-center bg-surface">
            <p className="text-muted-foreground font-medium">
              Loading banners...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-canvas flex items-center justify-center p-3 sm:p-2 md:p-4 transition-colors duration-300">
        <div className="w-full mx-auto">
          <div className="relative overflow-hidden rounded-2xl shadow-warm-md border border-border h-[250px] sm:h-[300px] md:h-[400px] lg:h-[500px] w-full flex items-center justify-center bg-surface">
            <p className="text-muted-foreground font-medium">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-canvas flex items-center justify-center p-3 sm:p-2 md:p-4 transition-colors duration-300">
      <div className="w-full mx-auto">
        <div
          className="relative overflow-hidden rounded-2xl shadow-warm-md border border-border h-[250px] sm:h-[300px] md:h-[400px] lg:h-[500px] w-full group bg-surface"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Navigation arrows */}
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-surface/80 hover:bg-surface text-foreground hover:text-primary p-2.5 rounded-full shadow-warm-sm border border-border opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer"
            onClick={prevSlide}
            aria-label="Previous slide"
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
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-surface/80 hover:bg-surface text-foreground hover:text-primary p-2.5 rounded-full shadow-warm-sm border border-border opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer"
            onClick={nextSlide}
            aria-label="Next slide"
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

          {/* Slides */}
          {banners.length > 0 ? (
            banners.map((banner, index) => (
              <div
                key={banner.id}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out cursor-pointer clickable-card ${
                  index === currentIndex
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
                data-sound-interactive="true"
                tabIndex={index === currentIndex ? 0 : -1}
                role="button"
                aria-label={`Explore: ${banner.author || "Featured promotion"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClick(banner);
                  }
                }}
                onClick={() => handleClick(banner)}
              >
                <img
                  src={banner.url}
                  alt={banner.author}
                  className="w-full h-full object-cover rounded-2xl cursor-pointer"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/banner-placeholder.svg";
                  }}
                />

                {/* Caption */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-espresso/90 via-espresso/50 to-transparent p-4 sm:p-6 text-white">
                  <p className="text-base sm:text-lg font-bold font-display text-white">
                    {banner.author}
                  </p>
                  <p className="text-xs sm:text-sm text-sand/90 font-medium uppercase tracking-wider">
                    {banner.category}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-canvas-subtle rounded-2xl w-full">
              <p className="text-muted-foreground font-medium">
                No banners available
              </p>
            </div>
          )}

          {/* Indicator dots */}
          {banners.length > 0 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 z-10">
              {banners.map((_, index) => (
                <button
                  key={index}
                  className={`transition-all duration-300 rounded-full cursor-pointer ${
                    index === currentIndex
                      ? "w-6 h-2 sm:h-2.5 bg-primary"
                      : "w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white/60 hover:bg-white/90"
                  }`}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Banner6;
