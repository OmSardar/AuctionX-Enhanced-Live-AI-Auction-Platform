import React, { useState } from "react";

const SellerDashboardSidebar = () => {
  const [selected, setSelected] = useState(0);

  const select = (index) => {
    setSelected(index);
  };

  return (
    <div className="max-w-full mx-auto antialiased bg-canvas py-12 p-8 border-y border-border/40">
      <div className="flex justify-center">
        <nav id="nav" className="w-56 relative bg-sand/20 p-1.5 rounded-xl border border-sand/30">
          <span
            className="absolute h-10 w-[calc(100%-12px)] bg-surface rounded-lg shadow-sm border border-sand/40 transition-transform transition-medium ease-out"
            style={{ transform: `translateY(calc(100% * ${selected}))` }}
          ></span>
          <ul className="relative">
            <li>
              <button
                type="button"
                onClick={() => select(0)}
                aria-selected={selected === 0}
                className="py-2 px-3 w-full flex items-center focus:outline-none focus-visible:underline"
              >
                <svg
                  className={`h-6 w-6 transition-all ease-out transition-medium ${
                    selected === 0 ? "text-primary" : "text-text-muted"
                  }`}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12.707 2.293a1 1 0 00-1.414 0l-9 9a1 1 0 101.414 1.414L4 12.414V21a1 1 0 001 1h5a1 1 0 001-1v-6h2v6a1 1 0 001 1h5a1 1 0 001-1v-8.586l.293.293a1 1 0 001.414-1.414l-9-9zM18 10.414l-6-6-6 6V20h3v-6a1 1 0 011-1h4a1 1 0 011 1v6h3v-9.586z"
                  />
                </svg>
                <span
                  className={`ml-2 text-sm font-medium transition-all ease-out transition-medium ${
                    selected === 0 ? "text-primary font-semibold" : "text-text-secondary"
                  }`}
                >
                  Home
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => select(1)}
                aria-selected={selected === 1}
                className="py-2 px-3 w-full flex items-center focus:outline-none focus-visible:underline"
              >
                <svg
                  className={`h-6 w-6 transition-all ease-out transition-medium ${
                    selected === 1 ? "text-primary" : "text-text-muted"
                  }`}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M11.617 1.076a1 1 0 011.09.217l5.657 5.657a9 9 0 11-13.113.41A1 1 0 017 8.022v2.292a2 2 0 104 0V2a1 1 0 01.617-.924zM13 4.414v5.9A4 4 0 015.212 11.6 7 7 0 1016.95 8.364L13 4.414z"
                  />
                </svg>
                <span
                  className={`ml-2 text-sm font-medium transition-all ease-out transition-medium ${
                    selected === 1 ? "text-primary font-semibold" : "text-text-secondary"
                  }`}
                >
                  Popular
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => select(2)}
                aria-selected={selected === 2}
                className="py-2 px-3 w-full flex items-center focus:outline-none focus-visible:underline"
              >
                <svg
                  className={`h-6 w-6 transition-all ease-out transition-medium ${
                    selected === 2 ? "text-primary" : "text-text-muted"
                  }`}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 7a1 1 0 011-1h8a1 1 0 011 1v8a1 1 0 11-2 0V8h-7a1 1 0 01-1-1z"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M20.707 7.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0L9 12.414l-5.293 5.293a1 1 0 01-1.414-1.414l6-6a1 1 0 011.414 0L13 13.586l6.293-6.293a1 1 0 011.414 0z"
                  />
                </svg>
                <span
                  className={`ml-2 text-sm font-medium transition-all ease-out transition-medium ${
                    selected === 2 ? "text-primary font-semibold" : "text-text-secondary"
                  }`}
                >
                  Trending
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => select(3)}
                aria-selected={selected === 3}
                className="py-2 px-3 w-full flex items-center focus:outline-none focus-visible:underline"
              >
                <svg
                  className={`h-6 w-6 transition-all ease-out transition-medium ${
                    selected === 3 ? "text-primary" : "text-text-muted"
                  }`}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M7 10a3 3 0 013-3h8a3 3 0 013 3v8a3 3 0 01-3 3h-8a3 3 0 01-3-3v-8zm3-1a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-8a1 1 0 00-1-1h-8z"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M3 6a3 3 0 013-3h10a1 1 0 110 2H6a1 1 0 00-1 1v10a1 1 0 11-2 0V6z"
                  />
                </svg>
                <span
                  className={`ml-2 text-sm font-medium transition-all ease-out transition-medium ${
                    selected === 3 ? "text-primary font-semibold" : "text-text-secondary"
                  }`}
                >
                  Subscriptions
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => select(4)}
                aria-selected={selected === 4}
                className="py-2 px-3 w-full flex items-center focus:outline-none focus-visible:underline"
              >
                <svg
                  className={`h-6 w-6 transition-all ease-out transition-medium ${
                    selected === 4 ? "text-primary" : "text-text-muted"
                  }`}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M4 5a3 3 0 013-3h10a3 3 0 013 3v16a1 1 0 01-1.447.894L12 18.618l-6.553 3.276A1 1 0 014 21V5zm3-1a1 1 0 00-1 1v14.382l5.553-2.776a1 1 0 01.894 0L18 19.382V5a1 1 0 00-1-1H7z"
                  />
                </svg>
                <span
                  className={`ml-2 text-sm font-medium transition-all ease-out transition-medium ${
                    selected === 4 ? "text-primary font-semibold" : "text-text-secondary"
                  }`}
                >
                  Bookmarks
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => select(5)}
                aria-selected={selected === 5}
                className="py-2 px-3 w-full flex items-center focus:outline-none focus-visible:underline"
              >
                <svg
                  className={`h-6 w-6 transition-all ease-out transition-medium ${
                    selected === 5 ? "text-primary" : "text-text-muted"
                  }`}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 21a9 9 0 110-18 9 9 0 010 18zm0-16a7 7 0 100 14 7 7 0 000-14z"
                  />
                </svg>
                <span
                  className={`ml-2 text-sm font-medium transition-all ease-out transition-medium ${
                    selected === 5 ? "text-primary font-semibold" : "text-text-secondary"
                  }`}
                >
                  Settings
                </span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
};

export default SellerDashboardSidebar;
