import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Transition from "../utils/Transition";
import { useDispatch, useSelector } from "react-redux";
import { completeLogout } from "../../../redux/slices/authThunks";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import {
  FaChevronDown,
  FaUserCog,
  FaSignOutAlt,
  FaChartLine,
  FaShieldAlt,
} from "react-icons/fa";
import { Badge } from "../../ui/Badge";

const DEFAULT_AVATAR = "/default-profile.png";

function DropdownProfile({ align = "right" }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const trigger = useRef(null);
  const dropdown = useRef(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux state
  const authUser = useSelector((state) => state.auth.user || {});
  const authRole = useSelector((state) => state.auth.role);
  const authProfilePic = useSelector((state) => state.auth.profilePic);

  const userEmail = authUser.email || "";
  const role = authRole || authUser.role || "admin";

  // Helper to extract secure_url from various backend formats
  const extractProfilePicUrl = (pic) => {
    if (!pic) return null;
    if (typeof pic === "string" && pic.trim().length > 0) return pic;
    if (Array.isArray(pic) && pic.length > 0) {
      return pic[0]?.secure_url || pic[0]?.url || null;
    }
    if (typeof pic === "object") {
      return pic.secure_url || pic.url || null;
    }
    return null;
  };

  // Fetch authoritative user profile with real profile image
  const fetchUserProfile = useCallback(async () => {
    if (!userEmail) return;
    try {
      const res = await axiosWithAuth.get(`/auth/user/user/${encodeURIComponent(userEmail)}`);
      if (res.data) {
        setUserProfile(res.data);
        const resolvedPic =
          extractProfilePicUrl(res.data.profilePic) ||
          extractProfilePicUrl(authUser.profilePic) ||
          extractProfilePicUrl(authProfilePic);
        if (resolvedPic) {
          setProfilePic(resolvedPic);
          setImageError(false);
        }
      }
    } catch (err) {
      console.warn("Could not fetch admin profile image:", err?.message || err);
    }
  }, [userEmail, authUser.profilePic, authProfilePic]);

  const hasFetchedProfileRef = useRef(false);

  useEffect(() => {
    // Initial sync from Redux
    const initialPic =
      extractProfilePicUrl(authUser.profilePic) ||
      extractProfilePicUrl(authProfilePic);
    if (initialPic) {
      setProfilePic(initialPic);
    }

    if (!initialPic && !hasFetchedProfileRef.current) {
      hasFetchedProfileRef.current = true;
      fetchUserProfile();
    }

    // Listen for custom profile update events dispatched across the app
    const handleProfileUpdated = () => {
      fetchUserProfile();
    };

    window.addEventListener("profile-updated", handleProfileUpdated);
    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, [fetchUserProfile, authUser.profilePic, authProfilePic]);

  const handleLogout = () => {
    dispatch(completeLogout());
    navigate("/login");
  };

  // Close on outside click
  useEffect(() => {
    const clickHandler = ({ target }) => {
      if (!dropdown.current) return;
      if (
        !dropdownOpen ||
        dropdown.current.contains(target) ||
        trigger.current.contains(target)
      )
        return;
      setDropdownOpen(false);
    };
    document.addEventListener("click", clickHandler);
    return () => document.removeEventListener("click", clickHandler);
  }, [dropdownOpen]);

  // Close on Escape key
  useEffect(() => {
    const keyHandler = ({ keyCode }) => {
      if (!dropdownOpen || keyCode !== 27) return;
      setDropdownOpen(false);
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  }, [dropdownOpen]);

  // Compute initials for avatar fallback
  const getInitials = () => {
    const first = userProfile?.firstName || authUser.firstName || "";
    const last = userProfile?.lastName || authUser.lastName || "";
    if (first || last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    }
    if (userEmail) {
      return userEmail.substring(0, 2).toUpperCase();
    }
    return "AD";
  };

  const displayName =
    userProfile?.firstName && userProfile?.lastName
      ? `${userProfile.firstName} ${userProfile.lastName}`
      : userProfile?.name || authUser.name || userEmail.split("@")[0] || "Administrator";

  return (
    <div className="relative inline-flex">
      {/* Trigger Button */}
      <button
        ref={trigger}
        type="button"
        className="inline-flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border border-border-default/70 hover:border-action-primary/50 bg-surface/90 hover:bg-surface-subtle text-foreground shadow-xs transition-all duration-200 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring-focus"
        aria-haspopup="true"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
      >
        {/* User Avatar with Initials Fallback */}
        <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 ring-1 ring-border-default/60 bg-surface-subtle">
          {profilePic && !imageError ? (
            <img
              className="w-full h-full object-cover"
              src={profilePic}
              alt={displayName}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-action-primary to-action-primary-hover text-white flex items-center justify-center font-bold text-xs select-none shadow-xs">
              {getInitials()}
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-status-success ring-1 ring-surface" />
        </div>

        {/* User Identity Text */}
        <div className="hidden sm:flex flex-col text-left">
          <span className="text-xs font-semibold text-foreground truncate max-w-[140px] leading-tight group-hover:text-action-primary transition-colors">
            {displayName}
          </span>
          <span className="text-[10px] text-foreground-muted truncate max-w-[140px] font-mono leading-tight">
            {userEmail || "admin@auctionx.internal"}
          </span>
        </div>

        <FaChevronDown
          className={`w-2.5 h-2.5 shrink-0 text-foreground-muted group-hover:text-action-primary transition-transform duration-200 ${
            dropdownOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Profile Dropdown Menu */}
      <Transition
        className={`origin-top-right z-50 absolute top-full min-w-64 bg-surface border border-border-default p-2 rounded-2xl shadow-xl overflow-hidden mt-1.5 backdrop-blur-xl ${
          align === "right" ? "right-0" : "left-0"
        }`}
        show={dropdownOpen}
        enter="transition ease-out duration-200 transform"
        enterStart="opacity-0 -translate-y-2 scale-95"
        enterEnd="opacity-100 translate-y-0 scale-100"
        leave="transition ease-out duration-150"
        leaveStart="opacity-100 scale-100"
        leaveEnd="opacity-0 scale-95"
      >
        <div
          ref={dropdown}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setDropdownOpen(false)}
          className="space-y-1.5"
        >
          {/* Header Card inside Dropdown */}
          <div className="p-2.5 rounded-xl bg-surface-subtle border border-border-subtle/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 ring-1 ring-border-default/80 bg-surface">
              {profilePic && !imageError ? (
                <img
                  className="w-full h-full object-cover"
                  src={profilePic}
                  alt={displayName}
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-action-primary to-action-primary-hover text-white flex items-center justify-center font-bold text-sm">
                  {getInitials()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs text-foreground truncate block">
                  {displayName}
                </span>
              </div>
              <p className="text-[11px] text-foreground-muted truncate font-mono">
                {userEmail}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <Badge variant="gold" className="text-[9px] uppercase px-1.5 py-0">
                  {role === "super-admin" ? "Super Admin" : "Administrator"}
                </Badge>
                <span className="text-[10px] text-status-success flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" /> Verified
                </span>
              </div>
            </div>
          </div>

          <div className="h-px bg-border-subtle my-1" />

          {/* Navigation Links */}
          <ul className="space-y-1 text-xs">
            <li>
              <button
                type="button"
                className="w-full text-left font-medium text-foreground hover:text-action-primary hover:bg-surface-subtle flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer group"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate("/admin/dashboard/settings/myAccount");
                }}
              >
                <FaUserCog className="w-3.5 h-3.5 text-action-primary group-hover:scale-110 transition-transform" />
                <span>My Account & Settings</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full text-left font-medium text-foreground hover:text-action-primary hover:bg-surface-subtle flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer group"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate("/admin/dashboard");
                }}
              >
                <FaChartLine className="w-3.5 h-3.5 text-brand-gold group-hover:scale-110 transition-transform" />
                <span>Telemetry Console</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full text-left font-medium text-foreground hover:text-action-primary hover:bg-surface-subtle flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer group"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate("/admin/dashboard/manageUsers");
                }}
              >
                <FaShieldAlt className="w-3.5 h-3.5 text-status-info group-hover:scale-110 transition-transform" />
                <span>User Governance</span>
              </button>
            </li>

            <div className="h-px bg-border-subtle my-1" />

            <li>
              <button
                type="button"
                className="w-full text-left font-medium text-status-error hover:bg-status-error-bg/30 flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer group"
                onClick={() => {
                  setDropdownOpen(false);
                  handleLogout();
                }}
              >
                <FaSignOutAlt className="w-3.5 h-3.5 text-status-error group-hover:translate-x-0.5 transition-transform" />
                <span>Sign Out</span>
              </button>
            </li>
          </ul>
        </div>
      </Transition>
    </div>
  );
}

export default DropdownProfile;
