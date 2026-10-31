import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, Menu, X, HelpCircle, BookOpen, ShieldCheck, FileText } from "lucide-react";
import { AuctionXLogo } from "../../../../components/ui/AuctionXLogo";

const SellerNavbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isResourcesOpen, setIsResourcesOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsResourcesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsResourcesOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsResourcesOpen(false);
  }, [location.pathname, location.hash]);

  const handleScrollToSection = (sectionId) => {
    if (location.pathname === "/seller") {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      navigate(`/seller#${sectionId}`);
    }
    setIsMobileMenuOpen(false);
  };

  const resourceItems = [
    {
      title: "Frequently Asked Questions",
      description: "Common questions about listing, fees, and payouts",
      path: "/faq",
      icon: HelpCircle,
    },
    {
      title: "Seller & Bidding Guide",
      description: "Step-by-step auction procedures and best practices",
      path: "/guide",
      icon: BookOpen,
    },
    {
      title: "Help & Support",
      description: "Direct assistance for seller account inquiries",
      path: "/support",
      icon: ShieldCheck,
    },
    {
      title: "Terms & Conditions",
      description: "Platform policies and marketplace agreements",
      path: "/terms",
      icon: FileText,
    },
  ];

  return (
    <div className="bg-surface/95 backdrop-blur-md shadow-xs border-b border-border-subtle fixed top-0 left-0 w-full z-50 text-foreground transition-colors duration-200">
      <header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo -> /seller */}
            <div className="flex-shrink-0 mr-8">
              <Link
                to="/seller"
                className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary rounded-lg"
                aria-label="AuctionX Seller Hub Home"
              >
                <AuctionXLogo className="w-auto h-10 object-contain" />
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex lg:items-center lg:space-x-8 flex-1 justify-center" aria-label="Seller Navigation">
              <button
                type="button"
                onClick={() => handleScrollToSection("how-it-works")}
                className="text-foreground-secondary hover:text-action-primary font-medium text-sm transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary rounded-md cursor-pointer"
              >
                How It Works
              </button>

              <button
                type="button"
                onClick={() => handleScrollToSection("pricing-fees")}
                className="text-foreground-secondary hover:text-action-primary font-medium text-sm transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary rounded-md cursor-pointer"
              >
                Pricing & Fees
              </button>

              {/* Seller Resources Compact Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsResourcesOpen((prev) => !prev)}
                  aria-expanded={isResourcesOpen}
                  aria-haspopup="true"
                  className="inline-flex items-center gap-1.5 text-foreground-secondary hover:text-action-primary font-medium text-sm transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary rounded-md cursor-pointer"
                >
                  <span>Seller Resources</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isResourcesOpen ? "rotate-180 text-action-primary" : ""
                    }`}
                  />
                </button>

                {isResourcesOpen && (
                  <div
                    role="menu"
                    className="absolute left-1/2 -translate-x-1/2 mt-2 w-80 bg-surface rounded-2xl shadow-xl border border-border-subtle p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <div className="px-3 py-2 text-xs font-semibold text-foreground-muted uppercase tracking-wider border-b border-border-subtle mb-1">
                      Platform Resources
                    </div>
                    {resourceItems.map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={idx}
                          to={item.path}
                          role="menuitem"
                          onClick={() => setIsResourcesOpen(false)}
                          className="flex items-start gap-3 p-3 rounded-xl hover:bg-surface-subtle transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary"
                        >
                          <div className="p-2 rounded-lg bg-surface-subtle group-hover:bg-action-primary/10 text-foreground-muted group-hover:text-action-primary transition-colors shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground group-hover:text-action-primary transition-colors">
                              {item.title}
                            </div>
                            <div className="text-xs text-foreground-muted line-clamp-1 mt-0.5">
                              {item.description}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>

            {/* Auth Buttons */}
            <div className="flex items-center space-x-3">
              <Link
                to="/seller/login"
                className="text-sm font-semibold text-foreground hover:text-action-primary px-3 py-2 rounded-lg transition-colors hidden sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary"
              >
                Sign In
              </Link>
              <Link
                to="/seller/signup"
                className="text-sm font-semibold text-action-primary-fg bg-action-primary px-4 py-2.5 rounded-xl hover:bg-action-primary-hover shadow-md hover:shadow-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus cursor-pointer"
              >
                Start Selling
              </Link>

              {/* Mobile menu trigger */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="lg:hidden inline-flex items-center justify-center p-2 rounded-xl text-foreground hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary"
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-surface border-t border-border-subtle shadow-2xl px-4 pt-3 pb-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleScrollToSection("how-it-works")}
                className="w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-foreground hover:bg-surface-subtle hover:text-action-primary transition-colors"
              >
                How It Works
              </button>

              <button
                type="button"
                onClick={() => handleScrollToSection("pricing-fees")}
                className="w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-foreground hover:bg-surface-subtle hover:text-action-primary transition-colors"
              >
                Pricing & Fees
              </button>
            </div>

            <div className="pt-2 border-t border-border-subtle">
              <div className="px-3 py-1.5 text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                Seller Resources
              </div>
              <div className="grid grid-cols-1 gap-1 mt-1">
                {resourceItems.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={idx}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-foreground-secondary hover:text-foreground hover:bg-surface-subtle transition-colors"
                    >
                      <Icon className="w-4 h-4 text-action-primary" />
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-border-subtle flex flex-col gap-2">
              <Link
                to="/seller/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl border border-border-subtle text-foreground hover:bg-surface-subtle font-medium text-sm transition-colors"
              >
                Sign In to Seller Portal
              </Link>
              <Link
                to="/seller/signup"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl bg-action-primary text-action-primary-fg hover:bg-action-primary-hover font-semibold text-sm shadow-md transition-colors"
              >
                Start Selling Free
              </Link>
            </div>
          </div>
        )}
      </header>
    </div>
  );
};

export default SellerNavbar;