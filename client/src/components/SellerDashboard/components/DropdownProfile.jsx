import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Transition from "../utils/Transition";
import { useDispatch, useSelector } from "react-redux";
import { completeLogout } from "../../../redux/slices/authThunks";
import axios from "axios";
const API_URL = import.meta.env.VITE_API_URL;
import UserAvatar from "../images/user-avatar-32.png";

function DropdownProfile({ align }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  const trigger = useRef(null);
  const dropdown = useRef(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Get CSRF token and user data from Redux
  const { token: csrfToken } = useSelector((state) => state.csrf);
  const { email: userEmail, role: userRole } = useSelector(
    (state) => state.auth.user || {}
  );

  // Base API URL
  const API_BASE_URL = API_URL;

  // Helper function to get request config with CSRF token
  const getRequestConfig = () => {
    return {
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
        "x-CSRF-Token": csrfToken || "",
      },
    };
  };

  useEffect(() => {
    // Verify seller status on component mount
    const verifySellerStatus = async () => {
      try {
        setLoading(false);

        // If user role is already seller in Redux, trust it
        if (userRole === "seller") {
          setIsAdminVerified(true);
          return;
        }

        // Otherwise check with the backend
        if (csrfToken && userEmail) {
          const sellerCheckResponse = await axios.post(
            `${API_BASE_URL}/api/auth/seller/check-seller`,
            { email: userEmail },
            getRequestConfig()
          );

          if (!sellerCheckResponse.data.isSeller && sellerCheckResponse.data.role !== "seller") {
            dispatch(completeLogout());
            navigate("/seller/login");
            return;
          }

          setIsAdminVerified(true);
        }
      } catch (error) {
        console.error("Error verifying seller status:", error);
      } finally {
        setLoading(false);
      }
    };

    verifySellerStatus();
  }, [csrfToken, userEmail, userRole, dispatch, navigate]);

  const handleLogout = () => {
    dispatch(completeLogout());
    navigate("/seller/login");
  };

  // close on click outside
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
  });

  // close if the esc key is pressed
  useEffect(() => {
    const keyHandler = ({ keyCode }) => {
      if (!dropdownOpen || keyCode !== 27) return;
      setDropdownOpen(false);
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  });

  // Show loading state
  if (loading) {
    return (
      <div className="relative inline-flex">
        <div className="inline-flex justify-center items-center group">
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
          <div className="ml-2 w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-flex">
      <button
        ref={trigger}
        className="inline-flex justify-center items-center group"
        aria-haspopup="true"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
      >
        <img
          className="w-8 h-8 rounded-full"
          src={UserAvatar}
          width="32"
          height="32"
          alt="User"
        />
        <div className="flex items-center truncate">
          <span className="truncate ml-2 text-sm font-medium text-gray-600 dark:text-gray-100 group-hover:text-gray-800 dark:group-hover:text-white">
            {userEmail || "Admin User"}
          </span>
          <svg
            className="w-3 h-3 shrink-0 ml-1 fill-current text-gray-400 dark:text-gray-500"
            viewBox="0 0 12 12"
          >
            <path d="M5.9 11.4L.5 6l1.4-1.4 4 4 4-4L11.3 6z" />
          </svg>
        </div>
      </button>

      <Transition
        className={`origin-top-right z-10 absolute top-full min-w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 py-1.5 rounded-lg shadow-lg overflow-hidden mt-1 ${
          align === "right" ? "right-0" : "left-0"
        }`}
        show={dropdownOpen}
        enter="transition ease-out duration-200 transform"
        enterStart="opacity-0 -translate-y-2"
        enterEnd="opacity-100 translate-y-0"
        leave="transition ease-out duration-200"
        leaveStart="opacity-100"
        leaveEnd="opacity-0"
      >
        <div
          ref={dropdown}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setDropdownOpen(false)}
        >
          <div className="pt-0.5 pb-2 px-3 mb-1 border-b border-gray-200 dark:border-gray-700/60">
            <div className="font-medium text-gray-800 dark:text-gray-100">
              {userEmail || "Admin User"}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 italic">
              Seller
            </div>
          </div>
          <ul>
            <li>
              <button
                className="w-full text-left font-medium text-sm text-violet-500 hover:text-violet-600 dark:hover:text-violet-400 flex items-center py-1 px-3"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate("/seller/dashboard/settings/myAccount");
                }}
              >
                Settings
              </button>
            </li>
            <li>
              <button
                className="w-full text-left font-medium text-sm text-violet-500 hover:text-violet-600 dark:hover:text-violet-400 flex items-center py-1 px-3"
                onClick={() => {
                  handleLogout();
                  setDropdownOpen(false);
                }}
              >
                Sign Out
              </button>
            </li>
          </ul>
        </div>
      </Transition>
    </div>
  );
}

export default DropdownProfile;
