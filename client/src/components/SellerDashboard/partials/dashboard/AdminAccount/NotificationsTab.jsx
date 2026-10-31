import React from "react";

function NotificationsTab({ notifications, handleNotificationChange }) {
  return (
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
  );
}

export default NotificationsTab;