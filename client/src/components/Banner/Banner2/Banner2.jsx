import React from "react";
import { useNavigate } from "react-router-dom";
import TodayBids from "../../../assets/images/components/Banner4/Today.gif";
import TommorowBids from "../../../assets/images/components/Banner4/Tommorow.gif";
import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext"
const Banner2 = () => {
  const navigate = useNavigate();
  const { currentTheme } = useThemeProvider();

  const handleImageClick = (route) => {
    navigate(route);
  };

  return (
    <div className={`flex flex-row justify-center items-center gap-4 p-4 ${
      currentTheme === 'dark' ? 'bg-surface' : 'bg-canvas'
    }`}>
      {/* First Image Box */}
      <div
        className="cursor-pointer w-1/2 flex justify-center items-center aspect-video overflow-hidden rounded-2xl border border-sand/40 transition-transform duration-300 hover:scale-[1.02] hover:shadow-warm-md"
        onClick={() => handleImageClick("/todaybid")}
      >
        <img
          src={TodayBids}
          alt="Today's Bids"
          className="w-full h-full object-cover rounded-2xl"
        />
      </div>

      {/* Second Image Box */}
      <div
        className="cursor-pointer w-1/2 flex justify-center items-center aspect-video overflow-hidden rounded-2xl border border-sand/40 transition-transform duration-300 hover:scale-[1.02] hover:shadow-warm-md"
        onClick={() => handleImageClick("/tomorrowbid")}
      >
        <img
          src={TommorowBids}
          alt="Tomorrow's Bids"
          className="w-full h-full object-cover rounded-2xl"
        />
      </div>
    </div>
  );
};

export default Banner2;