import React, { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FaChevronDown } from "react-icons/fa";
import { completeLogout } from "../../../../redux/slices/authThunks";
import { cn } from "../../../../lib/utils";

const DEFAULT_AVATAR = "/default-profile.png";

/**
 * NavbarUserMenu Component
 * Accessible desktop user profile dropdown with keyboard navigation and click-outside handling.
 */
export const NavbarUserMenu = ({
  isOpen = false,
  onToggle,
  onClose,
  userEmail = "",
  profilePic = DEFAULT_AVATAR,
  className,
}) => {
  const menuRef = useRef(null);
  const dispatch = useDispatch();
  const auth = useSelector((state) => state.auth);
  const isAdmin =
    auth.role === "admin" ||
    auth.role === "super-admin" ||
    auth.user?.role === "admin";

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Close on Escape key
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

  const menuItems = [
    { label: "Profile", to: "/profile/myprofile" },
    ...(isAdmin ? [{ label: "Admin Dashboard", to: "/admin" }] : []),
    { label: "My Bids", to: "/orders" },
    { label: "Scheduled Bid", to: "/scheduledbids" },
    { label: "Add Money", to: "/balance" },
  ];

  const usernameHandle = userEmail ? userEmail.split("@")[0] : "Account";

  return (
    <div ref={menuRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="User account menu"
        className={cn(
          "inline-flex items-center gap-2 py-1 pl-1 pr-2.5 rounded-full border transition-all duration-200 cursor-pointer select-none shrink-0",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus",
          isOpen
            ? "border-action-primary/60 bg-surface shadow-xs ring-2 ring-action-primary/30"
            : "border-border-default bg-surface hover:bg-surface-subtle hover:border-action-primary/40 shadow-xs"
        )}
      >
        <img
          className="w-7 h-7 lg:w-8 lg:h-8 rounded-full object-cover border border-border-subtle bg-surface-subtle shrink-0"
          src={profilePic || DEFAULT_AVATAR}
          alt={userEmail ? `${userEmail} profile` : "User profile"}
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.src = DEFAULT_AVATAR;
          }}
        />
        <span className="hidden xl:inline-block max-w-[100px] truncate text-xs font-semibold text-foreground">
          {usernameHandle}
        </span>
        <FaChevronDown
          className={cn(
            "w-2.5 h-2.5 text-foreground-muted transition-transform duration-200",
            isOpen && "rotate-180 text-action-primary"
          )}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className={cn(
            "absolute right-0 mt-2 w-56 py-1.5 rounded-xl shadow-xl z-50",
            "bg-surface border border-border-subtle shadow-card",
            "divide-y divide-border-subtle",
            "animate-in fade-in-50 zoom-in-95 duration-100"
          )}
        >
          {/* User Email Header */}
          <div className="px-4 py-2.5">
            <span className="block text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
              {userEmail ? "Signed in as" : "Sign In with"}
            </span>
            <span className="block text-sm font-semibold text-foreground truncate mt-0.5">
              {userEmail || "Sign in to continue"}
            </span>
          </div>

          {/* Links */}
          <div className="py-1">
            {menuItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                role="menuitem"
                className={cn(
                  "block px-4 py-2 text-sm text-foreground",
                  "hover:bg-action-secondary/60 hover:text-action-primary",
                  "transition-colors duration-150 focus-visible:outline-none focus-visible:bg-action-secondary"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {userEmail ? (
            <div className="p-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  dispatch(completeLogout());
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-action-destructive bg-status-error-bg hover:bg-action-destructive/15 transition-colors cursor-pointer"
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="p-2">
              <Link
                to="/login"
                onClick={onClose}
                className="w-full inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-action-primary hover:bg-action-primary-hover transition-colors"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NavbarUserMenu;
