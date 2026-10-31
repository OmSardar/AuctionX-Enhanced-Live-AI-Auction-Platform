import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import debounce from "lodash.debounce";
import { toast } from "react-hot-toast";
import { formatCurrency } from "../../../../lib/utils";

export const NavbarSearch = ({
  allProducts = [],
  allCategories = [],
  isLoading = false,
  isMobile = false,
  onNavigate,
  onFocus,
}) => {
  const [searchText, setSearchText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const searchRef = useRef(null);
  const navigate = useNavigate();

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = (query) => {
    if (!query) {
      setSuggestions([]);
      return;
    }

    const lowerQuery = query.toLowerCase();

    // 1. Search in products
    const productSuggestions = allProducts
      .filter((product) => product.name?.toLowerCase().includes(lowerQuery))
      .slice(0, 3)
      .map((product) => ({
        ...product,
        type: "product",
      }));

    // 2. Search in categories for remaining slots
    const remainingSlots = 5 - productSuggestions.length;
    let categorySuggestions = [];
    if (remainingSlots > 0) {
      categorySuggestions = allCategories
        .filter((cat) => cat.name?.toLowerCase().includes(lowerQuery))
        .slice(0, remainingSlots)
        .map((category) => ({
          ...category,
          type: "category",
        }));
    }

    setSuggestions([...productSuggestions, ...categorySuggestions]);
  };

  const debouncedFetchSuggestions = useCallback(
    debounce(fetchSuggestions, 300),
    [allProducts, allCategories]
  );

  useEffect(() => {
    return () => {
      debouncedFetchSuggestions.cancel?.();
    };
  }, [debouncedFetchSuggestions]);

  const handleSearchChange = (e) => {
    if (allProducts.length === 0 && onFocus) {
      onFocus();
    }
    const value = e.target.value;
    setSearchText(value);
    setActiveSuggestionIndex(-1);
    debouncedFetchSuggestions(value);
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchText("");
    setSuggestions([]);
    if (onNavigate) onNavigate();

    if (suggestion.type === "product") {
      navigate(`/posts/${suggestion._id}`);
    } else {
      navigate(`/category/${suggestion._id}`);
    }
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();

    const selectedSuggestion = suggestions[activeSuggestionIndex];

    if (selectedSuggestion) {
      setSearchText("");
      setSuggestions([]);
      if (onNavigate) onNavigate();

      if (selectedSuggestion.type === "product") {
        navigate(`/posts/${selectedSuggestion._id}`);
      } else {
        navigate(`/category/${selectedSuggestion._id}`);
      }
    } else if (searchText.trim()) {
      const lowerText = searchText.toLowerCase();
      const filteredProducts = allProducts.filter((p) =>
        p.name?.toLowerCase().includes(lowerText)
      );

      if (filteredProducts.length > 0) {
        setSearchText("");
        setSuggestions([]);
        if (onNavigate) onNavigate();
        navigate(`/posts/${filteredProducts[0]._id}`);
      } else {
        const filteredCategories = allCategories.filter((c) =>
          c.name?.toLowerCase().includes(lowerText)
        );

        if (filteredCategories.length > 0) {
          setSearchText("");
          setSuggestions([]);
          if (onNavigate) onNavigate();
          navigate(`/category/${filteredCategories[0]._id}`);
        } else {
          toast.error("No matching product or category found.");
        }
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSearch(e);
    } else if (e.key === "Escape") {
      setSuggestions([]);
    }
  };

  const startListening = () => {
    if (allProducts.length === 0 && onFocus) {
      onFocus();
    }
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in your browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchText(transcript);
      debouncedFetchSuggestions(transcript);
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      toast.error("An error occurred during speech recognition. Please try again.");
    };
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  return (
    <div className={`relative ${isMobile ? "w-full" : "w-full min-w-0"}`} ref={searchRef}>
      <form onSubmit={handleSearch} className="relative w-full">
        <div className="flex items-center w-full bg-surface-subtle rounded-full px-3.5 py-1.5 space-x-2 border border-border-subtle transition-all duration-200 focus-within:ring-2 focus-within:ring-ring-focus focus-within:border-action-primary">
          <input
            type="text"
            placeholder="Search products or categories..."
            value={searchText}
            onChange={handleSearchChange}
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
            aria-label="Search products and categories"
            className="bg-transparent outline-none placeholder-foreground-muted text-sm text-foreground flex-1 min-w-0 w-full"
          />
          <button
            type="button"
            onClick={startListening}
            className={`cursor-pointer p-1.5 bg-surface rounded-full text-foreground-secondary hover:bg-action-secondary transition duration-150 focus:outline-none flex items-center justify-center shrink-0 ${
              isListening ? "animate-pulse ring-2 ring-action-destructive text-action-destructive" : ""
            }`}
            title="Voice search"
            aria-label="Voice search"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M12 15c2.761 0 5-2.239 5-5V5a5 5 0 10-10 0v5c0 2.761 2.239 5 5 5z" />
              <path d="M19 10v1a7 7 0 01-14 0v-1H3v1a9 9 0 009 9v3h2v-3a9 9 0 009-9v-1h-2z" />
            </svg>
          </button>
          <button
            type="submit"
            className="cursor-pointer p-1.5 bg-action-primary rounded-full text-white hover:bg-action-primary-hover transition duration-150 focus:outline-none shrink-0"
            title="Search"
            aria-label="Submit search"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </div>
      </form>

      {/* Suggestions Popup */}
      {suggestions.length > 0 && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 mt-2 bg-surface rounded-xl shadow-xl z-50 border border-border-subtle max-h-64 overflow-y-auto ${
            isMobile ? "w-full" : "min-w-72"
          }`}
        >
          {isLoading ? (
            <div className="p-4 text-center text-xs text-foreground-muted">
              Loading...
            </div>
          ) : (
            <ul className="py-1">
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion._id || index}
                  role="option"
                  aria-selected={index === activeSuggestionIndex}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={`px-3.5 py-2.5 cursor-pointer hover:bg-action-secondary/60 text-foreground transition-colors duration-150 flex items-center justify-between gap-2 ${
                    index === activeSuggestionIndex
                      ? "bg-action-secondary"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="flex-shrink-0 bg-surface-subtle rounded-md w-7 h-7 flex items-center justify-center text-foreground-secondary">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-xs text-gray-900 dark:text-gray-100 truncate">
                        {suggestion.name}
                      </div>
                      {suggestion.type === "product" && suggestion.price && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                          {formatCurrency(suggestion.price)}
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      suggestion.type === "product"
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        : "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    }`}
                  >
                    {suggestion.type === "product" ? "Product" : "Category"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NavbarSearch;
