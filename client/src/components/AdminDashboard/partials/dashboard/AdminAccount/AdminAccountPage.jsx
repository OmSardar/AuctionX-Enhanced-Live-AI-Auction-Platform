import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../../../../redux/slices/axiosWithAuth";
import { fetchCsrfToken } from "../../../../../redux/slices/csrfSecuritySlice";
import { useSelector, useDispatch } from "react-redux";
import { cn } from "../../../../../lib/utils";
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
  const { email: userEmail, role: userRole } = useSelector((state) => state.auth.user || {});

  // Base API URL
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  useEffect(() => {
    if (!csrfToken) {
      dispatch(fetchCsrfToken());
    }
  }, [dispatch, csrfToken]);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true);
        
        // Verify admin status if not already verified in Redux
        if (userRole !== "admin") {
          const adminCheckResponse = await axiosWithAuth.post(
            `${API_BASE_URL}/api/auth/user/check-admin`,
            { email: userEmail }
          );
          
          if (!adminCheckResponse.data.isAdmin) {
            throw new Error("Access denied: Administrator privileges required");
          }
          setIsAdminVerified(true);
        } else {
          setIsAdminVerified(true);
        }

        // Only proceed if user is verified as admin
        if (isAdminVerified || userRole === "admin") {
          // Fetch admin profile
          const profileResponse = await axiosWithAuth.get(
            `${API_BASE_URL}/api/auth/user/user/${userEmail}`
          );

          setProfile(profileResponse.data);
        }
      } catch (error) {
        console.error("Error in admin data fetch:", error);
        setStatusMessage({
          type: "error",
          message: error.response?.data?.message || error.message || "Failed to load admin data",
        });
      } finally {
        setLoading(false);
      }
    };

    if (csrfToken && userEmail) {
      fetchAdminData();
    }
  }, [csrfToken, userEmail, userRole, isAdminVerified, API_BASE_URL]);

  // Helper function to get request config with CSRF token
  const getRequestConfig = () => {
    return {
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken || "",
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

  // Loading state display
  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto bg-surface border border-border-default shadow-xs rounded-2xl p-12 flex justify-center items-center">
        <div className="animate-pulse text-foreground-secondary">
          Loading admin account information...
        </div>
      </div>
    );
  }

  // Access denied state
  if (!isAdminVerified && userRole !== "admin") {
    return (
      <div className="w-full max-w-5xl mx-auto bg-surface border border-status-danger/40 shadow-xs rounded-2xl p-8 flex justify-center items-center">
        <div className="text-status-danger text-center">
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
    <div className="w-full max-w-5xl mx-auto bg-surface border border-border-default shadow-xs rounded-2xl overflow-hidden">
      {/* Header */}
      <header className="px-6 py-5 border-b border-border-default bg-surface-subtle/30 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-xl text-foreground font-display">
            Admin Account Settings
          </h2>
          <p className="text-xs text-foreground-secondary mt-0.5">
            Manage your administrator credentials, personal profile, and authentication security.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-action-primary/10 text-action-primary border border-action-primary/20">
          Administrator
        </span>
      </header>

      {/* Status Message */}
      {statusMessage.message && (
        <div
          className={cn(
            "mx-6 mt-4 p-3.5 rounded-xl text-xs font-medium border",
            statusMessage.type === "success"
              ? "bg-status-success-bg text-status-success border-status-success/30"
              : "bg-status-danger-bg text-status-danger border-status-danger/30"
          )}
        >
          {statusMessage.message}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="px-6 py-3 border-b border-border-default bg-surface">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("profile")}
            className={cn(
              "py-2 px-4 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer",
              activeTab === "profile"
                ? "bg-action-primary text-white font-semibold shadow-xs"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-subtle"
            )}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={cn(
              "py-2 px-4 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer",
              activeTab === "security"
                ? "bg-action-primary text-white font-semibold shadow-xs"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-subtle"
            )}
          >
            Security & 2FA
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={cn(
              "py-2 px-4 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer",
              activeTab === "notifications"
                ? "bg-action-primary text-white font-semibold shadow-xs"
                : "text-foreground-secondary hover:text-foreground hover:bg-surface-subtle"
            )}
          >
            Notifications
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
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
      </div>

      {/* Footer with admin designation */}
      <footer className="px-6 py-4 border-t border-border-default bg-surface-subtle/30 flex flex-col sm:flex-row justify-between gap-2 text-xs text-foreground-muted">
        <span>Admin ID: {profile._id || "ADMIN-123456"}</span>
        <span>
          Last session: {profile.lastLogin || new Date().toLocaleString()}
        </span>
      </footer>
    </div>
  );
}

export default AdminAccountPage;