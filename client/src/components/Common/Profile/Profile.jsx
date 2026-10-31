import React from "react";
import { Outlet } from "react-router-dom";
import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext"; // Adjust the import path as needed

const ProfilePage = () => {
  const { currentTheme } = useThemeProvider();
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#191919] transition-colors duration-300">
      <div className="container mx-auto  px-6">
        <Outlet /> {/* Nested pages will render here */}
      </div>
    </div>
  );
};

export default ProfilePage;