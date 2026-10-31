import React, { useState, useEffect } from "react";
import axios from "axios";
import { fetchCsrfToken } from "../../../../../redux/slices/csrfSecuritySlice";
import { useSelector, useDispatch } from "react-redux";
import ProfileTab from "./ProfileTab";
import SecurityTab from "./SecurityTab";
import NotificationsTab from "./NotificationsTab";

function AdminAccountPage() {
  // Admin profile state
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    phone: "",
    avatar: "",
    joinDate: "",
    lastLogin: "",
  });
  const dispatch = useDispatch();

  // Active tab state
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  // Activity log state
  const [activityLogs, setActivityLogs] = useState([]);

  // Notification preferences state
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    loginAlerts: true,
    systemUpdates: false,
    weeklyReports: true,
  });

  // Status message state
  const [statusMessage, setStatusMessage] = useState({ type: "", message: "" });

  // Get CSRF token and user data from Redux
  const { token: csrfToken } = useSelector((state) => state.csrf);
  const { email: userEmail, role: userRole } = useSelector(
    (state) => state.auth.user || {}
  );
  const API_URL = import.meta.env.VITE_API_URL;
  // Base API URL
  const API_BASE_URL = API_URL;

  useEffect(() => {
    if (!csrfToken) {
      dispatch(fetchCsrfToken());
    }
  }, [dispatch, csrfToken]);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true);

        let isVerified = userRole === "seller";

        // Verify seller status if not already verified in Redux
        if (!isVerified) {
          const sellerCheckResponse = await axios.post(
            `${API_BASE_URL}/api/auth/seller/check-seller`,
            { email: userEmail },
            getRequestConfig()
          );

          if (sellerCheckResponse.data?.isSeller || sellerCheckResponse.data?.role === "seller") {
            isVerified = true;
            setIsAdminVerified(true);
          } else {
            throw new Error("Access denied: Seller privileges required");
          }
        } else {
          setIsAdminVerified(true);
        }

        // Only proceed if user is verified as seller
        if (isVerified) {
          // Fetch seller profile
          const profileResponse = await axios.get(
            `${API_BASE_URL}/api/auth/seller/user/${userEmail}`,
            {
              headers: {
                "X-CSRF-Token": csrfToken,
              },
              withCredentials: true,
            }
          );

          setProfile(profileResponse.data);
        }
      } catch (error) {
        console.error("Error in seller account data fetch:", error);
        setStatusMessage({
          type: "error",
          message:
            error.response?.data?.message ||
            error.message ||
            "Failed to load seller account data",
        });
      } finally {
        setLoading(false);
      }
    };

    if (csrfToken && userEmail) {
      fetchAdminData();
    }
  }, [csrfToken, userEmail, userRole]);

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

  // Helper function to display and auto-clear status messages
  const showStatusMessage = (message, type) => {
    setStatusMessage({ type, message });
    setTimeout(() => setStatusMessage({ type: "", message: "" }), 3000);
  };

  // Update profile handler (to be passed to ProfileTab)
  const handleUpdateProfile = (updatedProfile) => {
    setProfile(updatedProfile);
    showStatusMessage("Profile updated successfully", "success");
  };

  // Update notifications handler (to be passed to NotificationsTab)
  const handleUpdateNotifications = (updatedNotifications) => {
    setNotifications(updatedNotifications);
    showStatusMessage("Notification preferences updated", "success");
  };

  // Update activity logs handler (to be passed to ActivityLogTab)
  const handleUpdateActivityLogs = (updatedLogs) => {
    setActivityLogs(updatedLogs);
  };

  // Loading state display
  if (loading) {
    return (
      <div className="col-span-full xl:col-span-8 bg-white dark:bg-gray-800 shadow-xs rounded-xl p-8 flex justify-center items-center">
        <div className="animate-pulse text-gray-600 dark:text-gray-300">
          Loading admin account information...
        </div>
      </div>
    );
  }

  // Access denied state
  if (!isAdminVerified && userRole !== "admin") {
    return (
      <div className="col-span-full xl:col-span-8 bg-white dark:bg-gray-800 shadow-xs rounded-xl p-8 flex justify-center items-center">
        <div className="text-red-500 dark:text-red-400 text-center">
          <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
          <p>You don't have administrator privileges to access this page.</p>
          {statusMessage.message && (
            <p className="mt-2 text-sm">{statusMessage.message}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-full xl:col-span-8 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
      {/* Header */}
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60">
        <h2 className="font-semibold text-xl text-gray-800 dark:text-gray-100">
          Admin Account
        </h2>
      </header>

      {/* Status Message */}
      {statusMessage.message && (
        <div
          className={`mx-5 mt-4 p-3 rounded ${
            statusMessage.type === "success"
              ? "bg-green-100 text-green-700 border border-green-200"
              : "bg-red-100 text-red-700 border border-red-200"
          }`}
        >
          {statusMessage.message}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/60">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab("profile")}
            className={`py-2 px-3 rounded-lg transition duration-200 ${
              activeTab === "profile"
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/40"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`py-2 px-3 rounded-lg transition duration-200 ${
              activeTab === "security"
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/40"
            }`}
          >
            Security
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`py-2 px-3 rounded-lg transition duration-200 ${
              activeTab === "notifications"
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/40"
            }`}
          >
            Notifications
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {activeTab === "profile" && (
          <ProfileTab
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            csrfToken={csrfToken}
            API_BASE_URL={API_BASE_URL}
            getRequestConfig={getRequestConfig}
            showStatusMessage={showStatusMessage}
          />
        )}

        {activeTab === "security" && (
          <SecurityTab
            profile={profile}
            csrfToken={csrfToken}
            API_BASE_URL={API_BASE_URL}
            getRequestConfig={getRequestConfig}
            showStatusMessage={showStatusMessage}
          />
        )}

        {activeTab === "notifications" && (
          <NotificationsTab
            notifications={notifications}
            onUpdateNotifications={handleUpdateNotifications}
            csrfToken={csrfToken}
            API_BASE_URL={API_BASE_URL}
            getRequestConfig={getRequestConfig}
            showStatusMessage={showStatusMessage}
          />
        )}

        {activeTab === "activity" && (
          <ActivityLogTab
            activityLogs={activityLogs}
            onUpdateLogs={handleUpdateActivityLogs}
            csrfToken={csrfToken}
            API_BASE_URL={API_BASE_URL}
            getRequestConfig={getRequestConfig}
            showStatusMessage={showStatusMessage}
          />
        )}
      </div>

      {/* Footer with admin designation */}
      <footer className="px-5 py-4 border-t border-gray-100 dark:border-gray-700/60 flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Admin ID: {profile._id || "ADMIN-123456"}</span>
        <span>
          Last session: {profile.lastLogin || new Date().toLocaleString()}
        </span>
      </footer>
    </div>
  );
}

export default AdminAccountPage;
