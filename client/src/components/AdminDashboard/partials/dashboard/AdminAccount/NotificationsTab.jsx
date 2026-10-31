import React from "react";
import { FaBell, FaEnvelope, FaShieldAlt, FaChartLine } from "react-icons/fa";

function NotificationsTab({
  notifications = {
    emailAlerts: true,
    loginAlerts: true,
    systemUpdates: false,
    weeklyReports: true,
  },
  onUpdateNotifications,
  handleNotificationChange,
}) {
  const handleToggle = (key) => {
    const updated = {
      ...notifications,
      [key]: !notifications[key],
    };
    if (onUpdateNotifications) {
      onUpdateNotifications(updated);
    } else if (handleNotificationChange) {
      handleNotificationChange(key);
    }
  };

  const notificationItems = [
    {
      id: "emailAlerts",
      title: "Operational Email Alerts",
      desc: "Receive real-time transactional and auction dispute telemetry via email.",
      icon: <FaEnvelope className="text-action-primary" />,
    },
    {
      id: "loginAlerts",
      title: "Security & Login Alerts",
      desc: "Instant notification when administrator logins or MFA events occur.",
      icon: <FaShieldAlt className="text-action-primary" />,
    },
    {
      id: "systemUpdates",
      title: "System & Worker Updates",
      desc: "Telemetry regarding lifecycle cron workers and queue state.",
      icon: <FaBell className="text-action-primary" />,
    },
    {
      id: "weeklyReports",
      title: "Executive Weekly Digest",
      desc: "Receive a compiled summary of gross merchandise value, commission, and active disputes.",
      icon: <FaChartLine className="text-action-primary" />,
    },
  ];

  return (
    <div className="bg-surface-subtle border border-border-default rounded-2xl p-6 space-y-6 shadow-xs">
      <div>
        <h3 className="text-base sm:text-lg font-bold text-foreground font-display">
          Notification Preferences
        </h3>
        <p className="text-xs text-foreground-secondary mt-0.5">
          Choose which notifications you receive regarding administration, system integrity, and financial summaries.
        </p>
      </div>

      <div className="divide-y divide-border-subtle">
        {notificationItems.map((item) => {
          const isChecked = Boolean(notifications[item.id]);
          return (
            <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-action-primary/10 mt-0.5 shrink-0">
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {item.title}
                  </p>
                  <p className="text-xs text-foreground-secondary mt-0.5 max-w-lg">
                    {item.desc}
                  </p>
                </div>
              </div>

              <div className="relative inline-block w-11 shrink-0 align-middle select-none">
                <input
                  type="checkbox"
                  id={item.id}
                  checked={isChecked}
                  onChange={() => handleToggle(item.id)}
                  className="sr-only"
                />
                <label
                  htmlFor={item.id}
                  className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${
                    isChecked ? "bg-action-primary" : "bg-border-default"
                  }`}
                >
                  <span
                    className={`block h-5 w-5 mt-0.5 mx-0.5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${
                      isChecked ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NotificationsTab;