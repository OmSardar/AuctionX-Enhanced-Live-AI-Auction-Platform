import React, { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext"; // Adjust the import path as needed

const ProfileHeader = () => {
  const sections = [
    { name: "My Profile", path: "/profile/myprofile" },
    { name: "My Orders", path: "/profile/orders" },
    { name: "My Wallet", path: "/profile/balance" },
    { name: "Help & Support", path: "/profile/helpsupport" },
    { name: "Our Story", path: "/profile/our-story" },
  ];

  const location = useLocation();
  const navRef = useRef(null);
  const { currentTheme } = useThemeProvider();
  const [activeStyle, setActiveStyle] = useState({
    left: 0,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const activeTab = document.querySelector(".nav-link.active");
    if (activeTab && navRef.current) {
      const navRect = navRef.current.getBoundingClientRect();
      const activeRect = activeTab.getBoundingClientRect();
      setActiveStyle({
        left: activeRect.left - navRect.left - 22, // Shift slightly to the left
        width: activeRect.width,
        height: activeRect.height,
      });
    }
  }, [location.pathname]);

  return (
<header className="bg-surface/95 backdrop-blur-md shadow-warm-sm border-b border-border z-60 mt-18 transition-colors duration-300">
      <nav className="container mx-auto px-6 py-4 relative" ref={navRef}>
        <ul className="flex justify-center space-x-6 relative">
          <div
            className="absolute transition-all duration-300 bg-primary/10 border border-primary/20 rounded-md"
            style={{
              left: activeStyle.left,
              width: activeStyle.width,
              height: activeStyle.height,
            }}
          ></div>
          {sections.map((section) => (
            <li key={section.name} className="relative mt-1">
              <NavLink
                to={section.path}
                className={({ isActive }) =>
                  `nav-link transition duration-200 px-4 py-2 rounded-md relative z-10 font-medium ${
                    isActive
                      ? "text-primary font-bold active"
                      : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                {section.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
};

export default ProfileHeader;