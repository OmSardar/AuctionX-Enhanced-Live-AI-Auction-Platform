import React, { useState, useEffect } from "react";

const FirstLoadLoader = ({ onFinish }) => {
  const [progress, setProgress] = useState(12);
  const [statusMessage, setStatusMessage] = useState("Initializing live auction engine...");
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Stage 1: Fast initial burst (400ms)
    const t1 = setTimeout(() => {
      setProgress(40);
      setStatusMessage("Connecting to real-time bidding network...");
    }, 450);

    // Stage 2: Middle progression (1000ms)
    const t2 = setTimeout(() => {
      setProgress(78);
      setStatusMessage("Curating personalized AI recommendations...");
    }, 1100);

    // Stage 3: Completion (1700ms)
    const t3 = setTimeout(() => {
      setProgress(100);
      setStatusMessage("Entering live marketplace...");
    }, 1800);

    // Stage 4: Fade out exit (2250ms)
    const t4 = setTimeout(() => {
      setIsExiting(true);
    }, 2250);

    // Stage 5: Notify parent to unmount (2650ms)
    const t5 = setTimeout(() => {
      if (onFinish) onFinish();
    }, 2650);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onFinish]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-all duration-400 ease-out select-none bg-[#FFF9F0] text-[#542B21] dark:bg-[#1A1512] dark:text-[#FAF7F4] ${
        isExiting ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
      }`}
    >
      {/* Dynamic ambient radial backdrop glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60 dark:opacity-40"
        style={{
          background:
            "radial-gradient(circle 500px at 50% 50%, rgba(217, 122, 86, 0.18), transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Decorative background grid pattern for subtle tech depth */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
        aria-hidden="true"
      />

      {/* Central Brand Showcase Card */}
      <div className="relative z-10 flex flex-col items-center px-6 py-8 max-w-sm w-full mx-auto text-center">
        {/* Animated Brand Emblem with breathing glow ring */}
        <div className="relative mb-6">
          {/* Subtle pulsating aura */}
          <div
            className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-[#D97A56] via-[#C65D3A] to-[#7F3828] opacity-30 blur-xl animate-pulse"
            aria-hidden="true"
          />

          {/* SVG Vector Brand Emblem */}
          <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl p-2.5 bg-white/70 dark:bg-[#29211E]/80 backdrop-blur-md border border-[#E8D8C3] dark:border-[#3D2D24] shadow-xl flex items-center justify-center transform transition-transform duration-700 ease-out hover:scale-105">
            <svg
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
              aria-label="AuctionX Brand Emblem"
            >
              <defs>
                <linearGradient
                  id="loader-fav-primary"
                  x1="4"
                  y1="4"
                  x2="36"
                  y2="36"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#D97A56" />
                  <stop offset="50%" stopColor="#C65D3A" />
                  <stop offset="100%" stopColor="#7F3828" />
                </linearGradient>
                <linearGradient
                  id="loader-fav-accent"
                  x1="20"
                  y1="6"
                  x2="38"
                  y2="28"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#EDA88C" />
                  <stop offset="100%" stopColor="#B04E2E" />
                </linearGradient>
              </defs>
              <rect
                x="2"
                y="2"
                width="36"
                height="36"
                rx="10"
                className="fill-[#FFF9F0] dark:fill-[#1A1512] stroke-[#D97A56]"
                strokeWidth="1.2"
              />
              <path
                d="M13 14.5L18.5 9L23 13.5L17.5 19L13 14.5Z"
                fill="url(#loader-fav-primary)"
              />
              <path
                d="M20 16.5L28 24.5C28.8 25.3 28.8 26.5 28 27.3C27.2 28.1 26 28.1 25.2 27.3L17.2 19.3L20 16.5Z"
                fill="url(#loader-fav-accent)"
              />
              <path
                d="M11 26L15.5 21.5L17.5 23.5L13 28C12.2 28.8 11.2 28.2 10.8 27.6C10.4 27 10.2 26 11 26Z"
                fill="url(#loader-fav-primary)"
                opacity="0.85"
              />
              <path
                d="M9 31C9 30.4 9.4 30 10 30H24C24.6 30 25 30.4 25 31C25 31.6 24.6 32 24 32H10C9.4 32 9 31.6 9 31Z"
                fill="url(#loader-fav-primary)"
              />
            </svg>
          </div>
        </div>

        {/* Brand Typography */}
        <div className="flex items-baseline justify-center gap-1.5 mb-2 font-display">
          <span className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#542B21] dark:text-[#FAF7F4]">
            AUCTION
          </span>
          <span className="text-3xl md:text-4xl font-black bg-gradient-to-br from-[#EDA88C] via-[#C65D3A] to-[#7F3828] bg-clip-text text-transparent">
            X
          </span>
        </div>

        {/* AI Live Platform Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-7 bg-[#F5EDE2] dark:bg-[#2E2420] border border-[#E8D8C3] dark:border-[#3D2D24] shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#8E7C66] dark:text-[#A69888]">
            AI-Powered Live Auctions
          </span>
        </div>

        {/* Smooth Terracotta Progress Bar */}
        <div className="w-56 md:w-64 mb-3">
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-[#E8D8C3]/50 dark:bg-[#3D2D24]/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#D97A56] via-[#C65D3A] to-[#7F3828] shadow-[0_0_10px_rgba(198,93,58,0.5)] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Dynamic Status Text */}
        <p className="text-xs font-medium text-[#8E7C66] dark:text-[#A69888] tracking-wide transition-opacity duration-300">
          {statusMessage}
        </p>
      </div>
    </div>
  );
};

export default FirstLoadLoader;
