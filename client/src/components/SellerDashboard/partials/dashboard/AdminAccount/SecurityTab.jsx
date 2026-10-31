import React, { useState } from "react";
import axios from "axios";

function SecurityTab({ profile, csrfToken, API_BASE_URL, getRequestConfig, showStatusMessage }) {
  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Handle password input changes
  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  // Handle password update
  const handleUpdatePassword = async () => {
  // Password validation checks
  if (passwordData.newPassword !== passwordData.confirmPassword) {
    showStatusMessage("New passwords don't match", "error");
    return;
  }

  if (passwordData.newPassword.length < 8) {
    showStatusMessage("Password must be at least 8 characters", "error");
    return;
  }

  try {
    await axios.patch(
      `${API_BASE_URL}/api/auth/seller/update-password`,
      {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      },
      getRequestConfig()
    );

    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    setIsChangingPassword(false);
    showStatusMessage("Password updated successfully", "success");
  } catch (error) {
    console.error("Error updating password:", error);
    
    if (error.response && error.response.status === 400) {
      showStatusMessage(error.response.data.message || "Current password is incorrect", "error");
    } else {
      showStatusMessage("Failed to update password", "error");
    }
  }
};

  return (
    <div className="space-y-6">
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
            {profile.passwordLastChanged || "Not available"}
          </span>
        </p>
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
  );
}

export default SecurityTab;