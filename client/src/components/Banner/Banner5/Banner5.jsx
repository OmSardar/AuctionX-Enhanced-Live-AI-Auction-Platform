import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext"; // Update the import path
// Importing images from the local folder
import image1 from "../../../assets/images/components/Banner/auction 1.png";
import image2 from "../../../assets/images/components/Banner/auction 2.png";
import image3 from "../../../assets/images/components/Banner/auction 3.jpg";
import image4 from "../../../assets/images/components/Banner/auction 4.png";
import image5 from "../../../assets/images/components/Banner/auction 5.png";
import image6 from "../../../assets/images/components/Banner/auction 6.png";
import image7 from "../../../assets/images/components/Banner/auction 7.png";

const Banner5 = () => {
  const navigate = useNavigate();
  const { currentTheme } = useThemeProvider();

  const products = [
    { id: 1, url: image1, author: "Author 1", category: "Currencies" },
    { id: 2, url: image2, author: "Author 2", category: "Antiques" },
    { id: 3, url: image3, author: "Author 3", category: "Automobiles" },
    { id: 4, url: image4, author: "Author 4", category: "Automobiles" },
    { id: 5, url: image5, author: "Author 5", category: "Books" },
    { id: 6, url: image6, author: "Author 6", category: "Furnitures" },
    { id: 7, url: image7, author: "Author 7", category: "Properties" },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // Auto-rotation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % products.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [products.length]);

  // Navigate to category page
  const handleClick = (category) => {
    navigate(`/category/${category}`);
  };

  // Swipe handlers for touch devices
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 50) {
      // Swipe left
      setCurrentIndex((prevIndex) => (prevIndex + 1) % products.length);
    }

    if (touchStart - touchEnd < -50) {
      // Swipe right
      setCurrentIndex((prevIndex) =>
        prevIndex === 0 ? products.length - 1 : prevIndex - 1
      );
    }
  };

  // Go to next slide
  const nextSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % products.length);
  };

  // Go to previous slide
  const prevSlide = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? products.length - 1 : prevIndex - 1
    );
  };

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
          {products.length > 0 ? (
            products.map((product, index) => (
              <div
                key={product.id}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out cursor-pointer clickable-card ${
                  index === currentIndex
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
                data-sound-interactive="true"
                tabIndex={index === currentIndex ? 0 : -1}
                role="button"
                aria-label={`Explore category: ${product.category}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClick(product.category);
                  }
                }}
                onClick={() => handleClick(product.category)}
              >
                <img
                  src={product.url}
                  alt={product.author}
                  className="w-full h-full object-cover rounded-2xl"
                />

                {/* Caption */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-espresso/90 via-espresso/50 to-transparent p-4 sm:p-6 text-white">
                  <p className="text-base sm:text-lg font-bold font-display text-white">
                    {product.author}
                  </p>
                  <p className="text-xs sm:text-sm text-sand/90 font-medium uppercase tracking-wider">
                    {product.category}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-canvas-subtle rounded-2xl w-full">
              <p className="text-muted-foreground font-medium">
                No images available
              </p>
            </div>
          )}

          {/* Indicator dots */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 z-10">
            {products.map((_, index) => (
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
        </div>
      </div>
    </div>
  );
};

export default Banner5;
