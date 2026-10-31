/* eslint-disable react/prop-types */
import { useState, useEffect, useRef, useMemo, useId } from "react";
import * as Flags from "country-flag-icons/react/3x2";
import { ChevronDown, Search, Check, Globe } from "lucide-react";
import { allCountries } from "country-region-data";
import { inferUserCountry } from "../../utils/geoData";

/**
 * Render country SVG flag using country-flag-icons
 * Eliminates Windows emoji missing-glyph boxes.
 */
export const CountryFlag = ({ isoCode, name = "", className = "w-5 h-3.5 rounded-[2px] object-cover shadow-xs border border-border/20 flex-shrink-0" }) => {
  if (!isoCode) {
    return <Globe className="w-4 h-4 text-foreground-muted flex-shrink-0" aria-hidden="true" />;
  }

  const normalized = isoCode.toUpperCase();
  const FlagComponent = Flags[normalized];

  if (!FlagComponent) {
    return <Globe className="w-4 h-4 text-foreground-muted flex-shrink-0" aria-hidden="true" />;
  }

  return (
    <FlagComponent
      title={name || normalized}
      className={className}
      aria-hidden="true"
    />
  );
};

/**
 * Reusable, Accessible, Location-Aware Country Selector
 *
 * Features:
 * - 250+ standard ISO countries with SVG flags
 * - Privacy-conscious location inference (prioritizes India first if inferred)
 * - Retains explicit user selection
 * - Compatible with ISO codes ("IN") and full country names ("India")
 * - Search filter, keyboard navigation, accessible combobox ARIA roles
 * - Full light / dark mode styling conforming to AuctionX design tokens
 */
export const CountrySelector = ({
  id: customId,
  name = "country",
  value = "",
  onChange,
  disabled = false,
  required = false,
  placeholder = "Select Country",
  label,
  error,
  helperText,
  valueType = "iso", // "iso" (e.g., "IN") or "name" (e.g., "India")
  className = "",
  wrapperClassName = "",
}) => {
  const generatedId = useId();
  const selectorId = customId || `country-selector-${name || generatedId}`;
  const listboxId = `${selectorId}-listbox`;
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Inferred country code (e.g., "IN")
  const inferredCountryCode = useMemo(() => inferUserCountry(), []);

  // Build the complete list of countries with location-aware ordering
  const countryList = useMemo(() => {
    const rawList = allCountries.map(([cName, cCode]) => ({
      name: cName,
      isoCode: cCode.toUpperCase(),
    }));

    // Find the inferred country
    const prioritized = rawList.find(
      (c) => c.isoCode === inferredCountryCode.toUpperCase()
    );

    // Sort the rest alphabetically
    const others = rawList
      .filter((c) => c.isoCode !== inferredCountryCode.toUpperCase())
      .sort((a, b) => a.name.localeCompare(b.name));

    return prioritized ? [prioritized, ...others] : rawList;
  }, [inferredCountryCode]);

  // Resolve current selected country object from `value` (supports ISO code or full name)
  const selectedCountry = useMemo(() => {
    if (!value) return null;
    const valUpper = String(value).trim().toUpperCase();

    // 1. Direct match by ISO code
    let match = countryList.find((c) => c.isoCode === valUpper);
    if (match) return match;

    // 2. Match by full country name
    match = countryList.find((c) => c.name.toUpperCase() === valUpper);
    if (match) return match;

    // 3. Partial / loose match
    return (
      countryList.find(
        (c) =>
          c.name.toLowerCase().startsWith(valUpper.toLowerCase()) ||
          valUpper.toLowerCase().startsWith(c.name.toLowerCase())
      ) || null
    );
  }, [value, countryList]);

  // Filtered list based on search query
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countryList;
    const query = searchQuery.trim().toLowerCase();
    return countryList.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.isoCode.toLowerCase().includes(query)
    );
  }, [countryList, searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeItem = listRef.current.children[highlightedIndex];
      if (activeItem) {
        activeItem.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (country) => {
    const outputValue = valueType === "name" ? country.name : country.isoCode;

    if (onChange) {
      // Create synthetic event compatible with standard form handlers
      const syntheticEvent = {
        target: {
          name,
          value: outputValue,
          isoCode: country.isoCode,
          countryName: country.name,
        },
      };
      onChange(syntheticEvent);
    }

    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredCountries.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredCountries[highlightedIndex]) {
          handleSelect(filteredCountries[highlightedIndex]);
        }
        break;
      case "Escape":
      case "Tab":
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className={`w-full flex flex-col gap-1.5 ${wrapperClassName}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={selectorId}
          className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary select-none flex items-center justify-between"
        >
          <span>
            {label}
            {required && <span className="text-status-error ml-1" aria-hidden="true">*</span>}
          </span>
          {inferredCountryCode && !value && (
            <span className="text-[10px] text-foreground-muted font-normal lowercase tracking-normal">
              inferred from locale
            </span>
          )}
        </label>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          id={selectorId}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-label={label || placeholder}
          className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 text-sm rounded-md border transition-all text-left ${
            disabled
              ? "bg-surface-subtle text-foreground-secondary border-border-subtle cursor-not-allowed opacity-80"
              : isOpen
              ? "bg-surface text-foreground border-action-primary ring-2 ring-ring-focus"
              : error
              ? "bg-surface text-foreground border-status-error hover:border-status-error"
              : "bg-surface text-foreground border-border-default hover:border-border-strong cursor-pointer"
          } ${className}`}
        >
          <div className="flex items-center gap-2.5 min-w-0 truncate">
            {selectedCountry ? (
              <>
                <CountryFlag
                  isoCode={selectedCountry.isoCode}
                  name={selectedCountry.name}
                />
                <span className="truncate font-medium">
                  {selectedCountry.name}
                </span>
                <span className="text-xs text-foreground-muted font-mono uppercase">
                  ({selectedCountry.isoCode})
                </span>
              </>
            ) : (
              <span className="text-foreground-muted">{placeholder}</span>
            )}
          </div>

          <ChevronDown
            size={16}
            className={`text-foreground-muted transition-transform duration-200 flex-shrink-0 ${
              isOpen ? "rotate-180 text-action-primary" : ""
            }`}
          />
        </button>

        {/* Hidden input for standard HTML form compatibility */}
        <input
          type="hidden"
          name={name}
          value={value || ""}
          required={required}
        />

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Countries"
            className="absolute z-50 mt-1.5 w-full bg-surface border border-border-default rounded-lg shadow-lg overflow-hidden animate-scale-in"
            style={{ maxHeight: "320px" }}
          >
            {/* Search Box */}
            <div className="p-2 border-b border-border-subtle bg-surface-subtle/50 sticky top-0 z-10">
              <div className="relative flex items-center">
                <Search
                  size={15}
                  className="absolute left-2.5 text-foreground-muted pointer-events-none"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search country or code..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface text-foreground border border-border-subtle rounded-md focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-ring-focus placeholder:text-foreground-muted"
                />
              </div>
            </div>

            {/* List of Countries */}
            <div
              ref={listRef}
              className="max-h-56 overflow-y-auto py-1 divide-y divide-border-subtle/30"
            >
              {filteredCountries.length === 0 ? (
                <div className="p-4 text-center text-xs text-foreground-muted">
                  No countries found matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredCountries.map((country, index) => {
                  const isSelected =
                    selectedCountry?.isoCode === country.isoCode;
                  const isHighlighted = index === highlightedIndex;
                  const isPrioritized =
                    country.isoCode === inferredCountryCode.toUpperCase() &&
                    !searchQuery;

                  return (
                    <div
                      key={country.isoCode}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(country)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors ${
                        isHighlighted
                          ? "bg-action-primary/10 text-action-primary"
                          : isSelected
                          ? "bg-surface-subtle text-foreground font-semibold"
                          : "text-foreground hover:bg-canvas-subtle"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CountryFlag
                          isoCode={country.isoCode}
                          name={country.name}
                        />
                        <span className="truncate">{country.name}</span>
                        {isPrioritized && (
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-action-primary/15 text-action-primary">
                            Inferred
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-xs font-mono text-foreground-muted uppercase">
                          {country.isoCode}
                        </span>
                        {isSelected && (
                          <Check
                            size={15}
                            className="text-action-primary font-bold"
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-status-error font-medium" role="alert">
          {error}
        </p>
      )}

      {!error && helperText && (
        <p className="text-xs text-foreground-muted">{helperText}</p>
      )}
    </div>
  );
};

export default CountrySelector;
