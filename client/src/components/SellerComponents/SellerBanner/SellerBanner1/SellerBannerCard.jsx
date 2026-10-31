import React from "react";

const SellerBannerCard = ({ date, title, description, imageUrl, altText }) => {
  return (
    <div className="relative">
      <div>
        <p className="p-6 text-xs font-medium leading-3 text-white absolute top-0 right-0">
          {date}
        </p>
        <div className="absolute bottom-0 left-0 p-6">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="text-base leading-4 text-white mt-2">{description}</p>
          <a
            href="#read-more"
            onClick={(e) => e.preventDefault()}
            className="focus:outline-none focus:underline flex items-center mt-4 cursor-pointer text-white hover:text-gray-200 hover:underline"
          >
            <p className="pr-2 text-sm font-medium leading-none">Read More</p>
            <svg
              className="fill-stroke"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5.75 12.5L10.25 8L5.75 3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      </div>
      <img src={imageUrl} className="w-full rounded-lg" alt={altText} />
    </div>
  );
};

export default SellerBannerCard;
