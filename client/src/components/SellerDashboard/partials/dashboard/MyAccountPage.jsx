import React, { useState, useEffect } from "react";
import axios from "axios";
import { fetchCsrfToken } from "../../../../redux/slices/csrfSecuritySlice";
import { useSelector, useDispatch } from "react-redux";

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
  const authUser = useSelector((state) => state.auth?.user || state.auth?.seller);

  // Authoritative provider check: Google-only if marked OAuth and has no local password
  const isGoogleOnly = Boolean(
    (profile?.isOAuthUser || authUser?.isOAuthUser) &&
    (profile?.hasPassword === false || authUser?.hasPassword === false)
  );

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [loading, setLoading] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL;
  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Activity log state
  const [activityLogs, setActivityLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 5;

  // Notification preferences state
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    loginAlerts: true,
    systemUpdates: false,
    weeklyReports: true,
  });

  // Active tab state
  const [activeTab, setActiveTab] = useState("profile");

  // Status message state
  const [statusMessage, setStatusMessage] = useState({ type: "", message: "" });

  const { token: csrfToken } = useSelector((state) => state.csrf);

  useEffect(() => {
    if (!csrfToken && !loading) {
      dispatch(fetchCsrfToken());
    }
  }, [dispatch, csrfToken, loading]);

  // Fetch admin profile data from the backend
  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const config = {
          withCredentials: true, // This allows cookies to be sent with the request
          headers: {
            "X-CSRF-Token": csrfToken || "", // Send CSRF token if available
          },
        };

        const profileResponse = await axios.get(
          `${API_URL}/api/adminProfile/profile`,
          config
        );
        setProfile(profileResponse.data);

        const logsResponse = await axios.get(
          `${API_URL}/api/adminProfile/activity-logs`,
          config
        );
        setActivityLogs(logsResponse.data);

        const notificationsResponse = await axios.get(
          `${API_URL}/api/adminProfile/notification-preferences`,
          config
        );
        setNotifications(notificationsResponse.data);
      } catch (error) {
        console.error("Error fetching admin data:", error);
        setStatusMessage({
          type: "error",
          message: "Failed to load admin data",
        });
      }
    };

    fetchAdminData();
  }, []);

  // Handle editing profile
  const handleEditProfile = () => {
    setEditedProfile({ ...profile });
    setIsEditing(true);
  };

  // Handle profile input changes
  const handleProfileChange = (e) => {
    setEditedProfile({
      ...editedProfile,
      [e.target.name]: e.target.value,
    });
  };

  // Handle avatar change
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      // ✅ Fixed: Properly set headers outside the body
      const response = await axios.post(
        `${API_URL}/api/adminProfile/upload-avatar`,
        formData,
        {
          headers: {
            "X-CSRF-Token": csrfToken,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      setEditedProfile({
        ...editedProfile,
        avatar: response.data.avatarUrl,
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      setStatusMessage({ type: "error", message: "Failed to upload avatar" });
    }
  };

  // Handle save profile
  const handleSaveProfile = async () => {
    try {
      // ✅ Fixed: Properly set headers as third parameter
      const response = await axios.put(
        `${API_URL}/api/adminProfile/profile`,
        editedProfile,
        {
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        }
      );
      setProfile(response.data);
      setIsEditing(false);
      setStatusMessage({
        type: "success",
        message: "Profile updated successfully",
      });

      // Clear status message after 3 seconds
      setTimeout(() => setStatusMessage({ type: "", message: "" }), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setStatusMessage({ type: "error", message: "Failed to update profile" });
    }
  };

  // Handle password input changes
  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  // Handle password update
  const handleUpdatePassword = async () => {
    if (isGoogleOnly) {
      setStatusMessage({
        type: "error",
        message: "Password management is unavailable for Google sign-in accounts.",
      });
      return;
    }

    // Password validation checks
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setStatusMessage({ type: "error", message: "New passwords don't match" });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setStatusMessage({
        type: "error",
        message: "Password must be at least 8 characters",
      });
      return;
    }

    try {
      // ✅ Fixed: Properly set headers and body
      await axios.put(
        `${API_URL}/api/adminProfile/update-password`,
        {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        },
        {
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        }
      );

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setIsChangingPassword(false);
      setStatusMessage({
        type: "success",
        message: "Password updated successfully",
      });

      setTimeout(() => setStatusMessage({ type: "", message: "" }), 3000);
    } catch (error) {
      console.error("Error updating password:", error);
      setStatusMessage({ type: "error", message: "Failed to update password" });
    }
  };

  // Handle notification toggle
  const handleNotificationChange = async (setting) => {
    const updatedPreferences = {
      ...notifications,
      [setting]: !notifications[setting],
    };

    try {
      // ✅ Fixed: Properly set headers and body
      await axios.put(
        `${API_URL}/api/adminProfile/notification-preferences`,
        updatedPreferences,
        {
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        }
      );
      setNotifications(updatedPreferences);
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      setStatusMessage({
        type: "error",
        message: "Failed to update notification preferences",
      });
    }
  };

  // Pagination for activity logs
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = activityLogs.slice(indexOfFirstLog, indexOfLastLog);

  // Function to change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

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
          <button
            onClick={() => setActiveTab("activity")}
            className={`py-2 px-3 rounded-lg transition duration-200 ${
              activeTab === "activity"
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/40"
            }`}
          >
            Activity Log
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 relative">
                  <img
                    src={
                      isEditing
                        ? editedProfile.avatar
                        : profile.avatar || "/default-profile.png"
                    }
                    alt="Admin Avatar"
                    className="rounded-full w-full h-full object-cover border-2 border-gray-200 dark:border-gray-700"
                  />
                  {isEditing && (
                    <label className="absolute bottom-0 right-0 bg-blue-500 p-1 rounded-full cursor-pointer">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleAvatarChange}
                        accept="image/*"
                      />
                    </label>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {`${profile.firstName} ${profile.lastName}`}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {profile.role}
                  </p>
                </div>
              </div>

              {!isEditing ? (
                <button
                  onClick={handleEditProfile}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="space-x-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>

            {/* Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="firstName"
                    value={editedProfile.firstName || ""}
                    onChange={handleProfileChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                ) : (
                  <p className="text-gray-800 dark:text-gray-100">
                    {profile.firstName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="lastName"
                    value={editedProfile.lastName || ""}
                    onChange={handleProfileChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                ) : (
                  <p className="text-gray-800 dark:text-gray-100">
                    {profile.lastName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    name="email"
                    value={editedProfile.email || ""}
                    onChange={handleProfileChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                ) : (
                  <p className="text-gray-800 dark:text-gray-100">
                    {profile.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="phone"
                    value={editedProfile.phone || ""}
                    onChange={handleProfileChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                ) : (
                  <p className="text-gray-800 dark:text-gray-100">
                    {profile.phone}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <p className="text-gray-800 dark:text-gray-100">
                  {profile.role}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Member Since
                </label>
                <p className="text-gray-800 dark:text-gray-100">
                  {profile.joinDate}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Login
                </label>
                <p className="text-gray-800 dark:text-gray-100">
                  {profile.lastLogin}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="space-y-6">
            {isGoogleOnly ? (
              <div className="p-5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 flex items-start gap-3">
                <div className="text-blue-500 mt-0.5">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                    Google Sign-In Account
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    This seller account uses Google sign-in and does not have a local password set. Password settings are unavailable.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
                    Password
                  </h3>
                  {!isChangingPassword && (
                    <button
                      onClick={() => setIsChangingPassword(true)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
                    >
                      Change Password
                    </button>
                  )}
                </div>

                {isChangingPassword ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>

                    <div className="pt-2 flex justify-end space-x-2">
                      <button
                        onClick={() => {
                          setIsChangingPassword(false);
                          setPasswordData({
                            currentPassword: "",
                            newPassword: "",
                            confirmPassword: "",
                          });
                        }}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdatePassword}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
                      >
                        Update Password
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400">
                    Your password was last changed on{" "}
                    <span className="text-gray-800 dark:text-gray-200">
                      5/2/2025
                    </span>
                  </p>
                )}
              </>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
                Two-Factor Authentication
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-800 dark:text-gray-100">
                    Protect your account with 2FA
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <button className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition duration-200">
                  Enable 2FA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">
              Email Notifications
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-800 dark:text-gray-100">
                    Email Alerts
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Receive emails about account activity
                  </p>
                </div>
                <div className="relative inline-block w-10 mr-2 align-middle">
                  <input
                    type="checkbox"
                    id="emailAlerts"
                    checked={notifications.emailAlerts}
                    onChange={() => handleNotificationChange("emailAlerts")}
                    className="sr-only"
                  />
                  <label
                    htmlFor="emailAlerts"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${
                      notifications.emailAlerts
                        ? "bg-blue-500"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                        notifications.emailAlerts
                          ? "translate-x-4"
                          : "translate-x-0"
                      }`}
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-800 dark:text-gray-100">
                    Login Alerts
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Get notified about new login attempts
                  </p>
                </div>
                <div className="relative inline-block w-10 mr-2 align-middle">
                  <input
                    type="checkbox"
                    id="loginAlerts"
                    checked={notifications.loginAlerts}
                    onChange={() => handleNotificationChange("loginAlerts")}
                    className="sr-only"
                  />
                  <label
                    htmlFor="loginAlerts"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${
                      notifications.loginAlerts
                        ? "bg-blue-500"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                        notifications.loginAlerts
                          ? "translate-x-4"
                          : "translate-x-0"
                      }`}
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-800 dark:text-gray-100">
                    System Updates
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Get notified about system changes and updates
                  </p>
                </div>
                <div className="relative inline-block w-10 mr-2 align-middle">
                  <input
                    type="checkbox"
                    id="systemUpdates"
                    checked={notifications.systemUpdates}
                    onChange={() => handleNotificationChange("systemUpdates")}
                    className="sr-only"
                  />
                  <label
                    htmlFor="systemUpdates"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${
                      notifications.systemUpdates
                        ? "bg-blue-500"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                        notifications.systemUpdates
                          ? "translate-x-4"
                          : "translate-x-0"
                      }`}
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-800 dark:text-gray-100">
                    Weekly Reports
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Receive weekly summary of system activities
                  </p>
                </div>
                <div className="relative inline-block w-10 mr-2 align-middle">
                  <input
                    type="checkbox"
                    id="weeklyReports"
                    checked={notifications.weeklyReports}
                    onChange={() => handleNotificationChange("weeklyReports")}
                    className="sr-only"
                  />
                  <label
                    htmlFor="weeklyReports"
                    className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${
                      notifications.weeklyReports
                        ? "bg-blue-500"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
                        notifications.weeklyReports
                          ? "translate-x-4"
                          : "translate-x-0"
                      }`}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Activity Log Tab */}
        {activeTab === "activity" && (
          <div>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
              Recent Activity
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="p-2 whitespace-nowrap text-left">
                      Activity
                    </th>
                    <th className="p-2 whitespace-nowrap text-left">
                      IP Address
                    </th>
                    <th className="p-2 whitespace-nowrap text-left">Device</th>
                    <th className="p-2 whitespace-nowrap text-left">
                      Date & Time
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-700/60">
                  {currentLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="p-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                              log.type === "login"
                                ? "bg-green-100 text-green-600"
                                : log.type === "update"
                                ? "bg-blue-100 text-blue-600"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {log.type === "login" ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                                />
                              </svg>
                            ) : log.type === "update" ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                />
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 dark:text-gray-100">
                              {log.activity}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-gray-800 dark:text-gray-100">
                          {log.ipAddress}
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-gray-800 dark:text-gray-100">
                          {log.device}
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-gray-800 dark:text-gray-100">
                          {log.timestamp}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination for logs */}
            {activityLogs.length > logsPerPage && (
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of{" "}
                  {Math.ceil(activityLogs.length / logsPerPage)}
                </span>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={
                    currentPage === Math.ceil(activityLogs.length / logsPerPage)
                  }
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}

            <div className="mt-6">
              <button className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download Full Activity Report
              </button>
            </div>
          </div>
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
