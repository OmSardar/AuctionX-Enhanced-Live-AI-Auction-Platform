import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { completeLogout } from "../../../../redux/slices/authThunks";
import { NavbarSearch } from "./NavbarSearch";
import { ThemeToggle } from "../../../../components/ui/ThemeToggle";
import { SoundToggle } from "../../../../components/ui/SoundToggle";
import { cn } from "../../../../lib/utils";

const DEFAULT_AVATAR = "/default-profile.png";

/**
 * NavbarMobileDrawer Component
 * Responsive mobile navigation drawer with search, navigation links, user menu, and theme toggle.
 */
export const NavbarMobileDrawer = ({
  isOpen = false,
  onClose,
  allProducts = [],
  allCategories = [],
  isLoading = false,
  onFocus,
  userEmail = "",
  profilePic = DEFAULT_AVATAR,
  userCountry = "",
}) => {
  const dispatch = useDispatch();
  const auth = useSelector((state) => state.auth);
  const isAdmin =
    auth.role === "admin" ||
    auth.role === "super-admin" ||
    auth.user?.role === "admin";
  const [isUserSectionOpen, setIsUserSectionOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const profileLinks = [
    { label: "Profile", to: "/profile/myprofile" },
    ...(isAdmin ? [{ label: "Admin Dashboard", to: "/admin" }] : []),
    { label: "My Bids", to: "/orders" },
    { label: "Scheduled Bid", to: "/scheduledbids" },
    { label: "Add Money", to: "/balance" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation menu"
      className="md:hidden fixed inset-x-0 top-16 bottom-0 z-40 bg-black/40 backdrop-blur-xs flex flex-col"
    >
      <div className="bg-surface border-b border-border-subtle max-h-[calc(100vh-4rem)] overflow-y-auto shadow-2xl flex flex-col divide-y divide-border-subtle">
        {/* Mobile Search Bar */}
        <div className="p-4 bg-surface-subtle">
          <NavbarSearch
            allProducts={allProducts}
            allCategories={allCategories}
            isLoading={isLoading}
            isMobile={true}
            onNavigate={onClose}
            onFocus={onFocus}
          />
        </div>

        {/* Primary Navigation Links */}
        <nav aria-label="Mobile primary navigation" className="p-4 space-y-2">
          <Link
            to="/category"
            onClick={onClose}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg text-base font-medium text-foreground hover:bg-surface-subtle transition-colors"
          >
            <span>Browse Categories</span>
            <span className="text-foreground-muted">&rarr;</span>
          </Link>
          <Link
            to="/bid"
            onClick={onClose}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg text-base font-medium text-foreground hover:bg-surface-subtle transition-colors"
          >
            <span>Bid an Item</span>
            <span className="text-xs bg-status-success-bg text-status-success font-semibold px-2 py-0.5 rounded">
              Live
            </span>
          </Link>
          <Link
            to="/seller"
            onClick={onClose}
            className="flex items-center justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-action-primary hover:bg-action-primary-hover shadow-xs transition-all"
          >
            Become a Seller
          </Link>
        </nav>

        {/* User Account Section */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsUserSectionOpen(!isUserSectionOpen)}
              className="flex items-center gap-3 text-left w-full focus-visible:outline-none"
            >
              <img
                src={profilePic || DEFAULT_AVATAR}
                alt={userEmail || "Account"}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-border-subtle bg-surface-subtle"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR;
                }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-foreground-muted block">
                  {userEmail ? "Account" : "Guest"}
                </span>
                <span className="text-sm font-semibold text-foreground truncate block">
                  {userEmail || "Sign in to continue"}
                </span>
              </div>
              <svg
                className={cn(
                  "w-5 h-5 text-foreground-muted transition-transform duration-200",
                  isUserSectionOpen && "rotate-180"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Expandable Account Links */}
          {isUserSectionOpen && (
            <div className="mt-3 pl-12 space-y-1.5 border-l-2 border-action-primary ml-5 py-1">
              {profileLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className="block py-1.5 text-sm text-foreground-secondary hover:text-action-primary transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          {userEmail ? (
            <div className="mt-4 pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  dispatch(completeLogout());
                }}
                className="w-full inline-flex items-center justify-center py-2 px-4 rounded-lg text-sm font-semibold text-action-destructive bg-status-error-bg hover:bg-action-destructive/15 transition-colors cursor-pointer"
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <Link
                to="/login"
                onClick={onClose}
                className="w-full inline-flex items-center justify-center py-2 px-4 rounded-lg text-sm font-semibold text-white bg-action-primary hover:bg-action-primary-hover transition-colors"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>

        {/* Footer Actions / Sound & Theme Toggles */}
        <div className="p-4 flex flex-col gap-3 bg-surface-subtle border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground-secondary">
              Audio Feedback
            </span>
            <SoundToggle showLabel={true} />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            <span className="text-xs font-medium text-foreground-secondary">
              Appearance
            </span>
            <ThemeToggle showLabel={true} />
          </div>
        </div>

      </div>

      {/* Backdrop area tap to close */}
      <div
        className="flex-1 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />
    </div>
  );
};

export default NavbarMobileDrawer;
