import React, { useState } from "react";
import {
  FaShareAlt,
  FaTimes,
  FaInstagram,
  FaFacebook,
  FaWhatsapp,
  FaTelegramPlane,
} from "react-icons/fa";
import Copy from "../Copy/Copy";

const ShareMenu = () => {
  const [isOpen, setIsOpen] = useState(false); // State to manage menu visibility
  const currentUrl = encodeURIComponent(window.location.href); // Get and encode the current URL

  const toggleMenu = () => {
    setIsOpen(!isOpen); // Toggle the menu state
  };

  return (
    <div className="w-full m-0 p-0">
      <div className="w-full flex items-center justify-end box-border">
        <div className="w-fit h-fit absolute mb-[7%] z-2">
          <input
            type="checkbox"
            id="SHAREDMENU-toggle"
            className="hidden"
            checked={isOpen}
            onChange={toggleMenu} // Toggle menu on change
          />
          <label
            htmlFor="SHAREDMENU-toggle"
            className="w-[55px] h-[55px] relative block mt-[15px] cursor-pointer"
          >
            <div className="w-[55px] h-[55px] bg-gray-800 rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center leading-[55px] shadow-[0_20px_30px_-10px_rgba(0,0,0,0.3)] flex items-center justify-center">
              {isOpen ? (
                <FaTimes className="text-white text-2xl" />
              ) : (
                <FaShareAlt className="text-white text-2xl" />
              )}
            </div>
          </label>
          <div
            className={`absolute bottom-full left-1/2 transform -translate-x-1/2 w-[55px] box-border border-[0.4mm] border-gray-200 p-[15px] rounded-[20mm] flex flex-col items-center justify-between overflow-hidden transition-all duration-350 ease-in-out ${
              isOpen ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
            } bg-white z-2 shadow-lg`}
          >
            <div className="w-[40px] h-[40px] flex items-center justify-center relative my-[6px] cursor-pointer text-gray-800 hover:text-gray-600">
              <a
                href={`https://instagram.com/?url=${currentUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <FaInstagram className="text-2xl" />
              </a>
            </div>
            <div className="w-[40px] h-[40px] flex items-center justify-center relative my-[6px] cursor-pointer text-gray-800 hover:text-gray-600">
              <a
                href={`https://facebook.com/sharer/sharer.php?u=${currentUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
              >
                <FaFacebook className="text-2xl" />
              </a>
            </div>
            <div className="w-[40px] h-[40px] flex items-center justify-center relative my-[6px] cursor-pointer text-gray-800 hover:text-gray-600">
              <a
                href={`https://api.whatsapp.com/send?text=${currentUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
              >
                <FaWhatsapp className="text-2xl" />
              </a>
            </div>
            <div className="w-[40px] h-[40px] flex items-center justify-center relative my-[6px] cursor-pointer text-gray-800 hover:text-gray-600">
              <a
                href={`https://t.me/share/url?url=${currentUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
              >
                <FaTelegramPlane className="text-2xl" />
              </a>
            </div>
            <div className="w-[40px] h-[40px] flex items-center justify-center relative my-[6px] cursor-pointer text-gray-800 hover:text-gray-600">
              <Copy />
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareMenu;