import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import { FaUserCircle } from "react-icons/fa";

import { ThemeToggle } from "../../../components/ui/ThemeToggle";
import { SoundToggle } from "../../../components/ui/SoundToggle";
import { AuctionXLogo } from "../../../components/ui/AuctionXLogo";
import {
  NavbarSearch,
  NavbarMegaMenu,
  NavbarUserMenu,
  NavbarMobileDrawer,
} from "./components";

const API_URL = import.meta.env.VITE_API_URL;
const DEFAULT_AVATAR = "/default-profile.png";

/**
 * Navbar Component
 * Refactored modular application shell navigation.
 * Integrates search, category mega menu, user account management, and responsive drawer.
 */
const Navbar = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState(null);

  const [allProducts, setAllProducts] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userCountry, setUserCountry] = useState("");
  const [profilePic, setProfilePic] = useState(DEFAULT_AVATAR);

  const role = useSelector((state) => state.auth.role);
  const userEmail = useSelector((state) => state.auth.user?.email);

  // Fetch user data (profile avatar and country)
  useEffect(() => {
    const fetchUserData = async () => {
      if (!userEmail) {
        setProfilePic(DEFAULT_AVATAR);
        setUserCountry("");
        return;
      }

      try {
        const endpoint =
          role === "seller"
            ? `/auth/seller/user/${encodeURIComponent(userEmail)}`
            : `/auth/user/user/${encodeURIComponent(userEmail)}`;

        const userResponse = await axiosWithAuth.get(endpoint);

        setUserCountry(userResponse.data.country || "");

        if (
          userResponse.data.profilePic &&
          userResponse.data.profilePic.length > 0 &&
          userResponse.data.profilePic[0].secure_url
        ) {
          setProfilePic(userResponse.data.profilePic[0].secure_url);
        } else {
          setProfilePic(DEFAULT_AVATAR);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast.error("Failed to fetch user data.");
        setProfilePic(DEFAULT_AVATAR);
      }
    };

    fetchUserData();

    const handleProfileUpdated = () => {
      fetchUserData();
    };

    window.addEventListener("profile-updated", handleProfileUpdated);
    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, [userEmail, role]);

  // Lazily load lightweight search suggestions on demand or during idle
  const hasLoadedSearchData = React.useRef(false);

  const loadSearchData = React.useCallback(async () => {
    if (hasLoadedSearchData.current) return;
    hasLoadedSearchData.current = true;

    try {
      setIsLoading(true);
      const productsResponse = await axiosWithAuth.get("/products?select=name,category,status");

      const rawList = productsResponse.data?.products || productsResponse.data || [];
      const activeProducts = Array.isArray(rawList)
        ? rawList.filter((product) => product.status === "Active")
        : [];

      setAllProducts(activeProducts);

      // Extract unique active categories
      const uniqueCategories = [];
      const categoryIds = new Set();

      activeProducts.forEach((product) => {
        if (
          product.category &&
          typeof product.category === "string" &&
          !categoryIds.has(product.category)
        ) {
          categoryIds.add(product.category);
          uniqueCategories.push({
            _id: product.category,
            name: "Category " + product.category.slice(0, 4),
            status: "Active",
          });
        }
      });

      setAllCategories(uniqueCategories);
    } catch (error) {
      console.warn("Notice: Search suggestions fetch deferred or unavailable:", error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Pre-warm search suggestions after a non-blocking idle delay (never blocks initial page load)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        window.requestIdleCallback(() => loadSearchData());
      } else {
        loadSearchData();
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [loadSearchData]);

  return (
    <div className="fixed top-0 left-0 w-full z-50 transition-colors duration-200">
      <header className="bg-surface/95 backdrop-blur-md border-b border-border-subtle shadow-xs">
        <div className="px-4 mx-auto max-w-[1536px] w-full sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20 gap-3 xl:gap-6">
            {/* ZONE 1: Brand & Primary Navigation (Left) */}
            <div className="flex items-center gap-3 lg:gap-5 xl:gap-6 shrink-0">
              {/* Logo & Region Badge */}
              <Link
                to="/"
                className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus rounded-lg py-1 select-none"
                aria-label="AuctionX Home"
              >
                <AuctionXLogo className="w-auto h-8 lg:h-9 object-contain" />
                {userCountry && (
                  <span className="hidden sm:inline-block bg-primary-50 dark:bg-primary-950/60 text-action-primary border border-border-subtle text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    {userCountry}
                  </span>
                )}
              </Link>

              {/* Desktop Primary Navigation (Categories MegaMenu + Bid an Item) */}
              <nav
                aria-label="Primary desktop navigation"
                className="hidden md:flex items-center gap-2 xl:gap-4"
              >
                <NavbarMegaMenu
                  isOpen={openCategory === "Categories"}
                  onOpen={() => setOpenCategory("Categories")}
                  onClose={() => setOpenCategory(null)}
                />

                <Link
                  to="/bid"
                  className="text-sm font-medium text-foreground hover:text-action-primary transition-colors whitespace-nowrap px-2.5 py-1.5 rounded-lg hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
                >
                  Bid an Item
                </Link>
              </nav>
            </div>

            {/* ZONE 2: Search (Center, responsive fluid width) */}
            <div className="hidden md:flex flex-1 items-center justify-center max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg min-w-0 mx-2">
              <NavbarSearch
                allProducts={allProducts}
                allCategories={allCategories}
                isLoading={isLoading}
                isMobile={false}
                onFocus={loadSearchData}
              />
            </div>

            {/* ZONE 3: Actions, Utilities & Account (Right) */}
            <div className="flex items-center gap-2 sm:gap-2.5 xl:gap-3 shrink-0">
              {/* Become a Seller CTA Button */}
              <Link
                to="/seller"
                className="hidden xl:inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg text-white bg-action-primary hover:bg-action-primary-hover shadow-xs transition-all hover:scale-[1.02] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
              >
                Become a Seller
              </Link>

              {/* Subtle Divider (Desktop) */}
              <div className="hidden xl:block h-5 w-px bg-border-subtle" />

              {/* Sound & Theme Utilities */}
              <div className="flex items-center gap-1 sm:gap-1.5">
                <SoundToggle />
                <ThemeToggle />
              </div>

              {/* Subtle Divider (Desktop) */}
              <div className="hidden md:block h-5 w-px bg-border-subtle" />

              {/* Prominent Account Area: Signed In Profile vs High-Contrast Sign In Button */}
              <div className="hidden sm:block">
                {userEmail ? (
                  <NavbarUserMenu
                    isOpen={isDropdownOpen}
                    onToggle={() => setIsDropdownOpen((prev) => !prev)}
                    onClose={() => setIsDropdownOpen(false)}
                    userEmail={userEmail}
                    profilePic={profilePic}
                  />
                ) : (
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-foreground bg-surface-subtle hover:bg-action-primary/10 hover:text-action-primary border border-border-default hover:border-action-primary/40 transition-all shadow-xs shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
                  >
                    <FaUserCircle className="w-4 h-4 text-action-primary" />
                    <span>Sign In</span>
                  </Link>
                )}
              </div>

              {/* Mobile Menu Toggle Button */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                aria-expanded={isMobileMenuOpen}
                aria-label="Toggle mobile menu"
                className="md:hidden p-2 rounded-lg text-foreground hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  {isMobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16m-7 6h7"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <NavbarMobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        allProducts={allProducts}
        allCategories={allCategories}
        isLoading={isLoading}
        onFocus={loadSearchData}
        userEmail={userEmail}
        profilePic={profilePic}
        userCountry={userCountry}
      />
    </div>
  );
};

export default Navbar;
