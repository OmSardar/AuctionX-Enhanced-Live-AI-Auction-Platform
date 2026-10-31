import React from "react";
import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext";

const categories = [
  {
    name: "Fine Art & Sculptures",
    icon: (
      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    name: "Haute Horlogerie",
    icon: (
      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="7" />
        <polyline points="12 9 12 12 14 14" />
        <path d="M12 5V2M12 22v-3M16.2 3.8l-1.5 2.6M9.3 17.6l-1.5 2.6M19.8 8.8l-2.6 1.5M6.8 13.7l-2.6 1.5" />
      </svg>
    ),
  },
  {
    name: "Sports Memorabilia",
    icon: (
      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1h10v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34" />
        <path d="M6 4h12a2 2 0 0 1 2 2v3a6 6 0 0 1-6 6h0a6 6 0 0 1-6-6V6a2 2 0 0 1 2-2z" />
      </svg>
    ),
  },
  {
    name: "Rare Coins & Medals",
    icon: (
      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" strokeDasharray="3 2" />
        <path d="M12 9v6M9.5 10.5h5" />
      </svg>
    ),
  },
  {
    name: "Fine Jewelry & Gems",
    icon: (
      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12l4 6-10 12L2 9l4-6z" />
        <path d="M2 9h20M10 3l2 6-2 12M14 3l-2 6 2 12" />
      </svg>
    ),
  },
  {
    name: "Ancient Antiquities",
    icon: (
      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2h8M9 2v4M15 2v4M6 6h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 6z" />
        <path d="M6 10c-2 0-3 1.5-3 3s1.5 3 3 3M18 10c2 0 3 1.5 3 3s-1.5 3-3 3" />
      </svg>
    ),
  },
  {
    name: "Classic Automobilia",
    icon: (
      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
      </svg>
    ),
  },
  {
    name: "Rare Books & Manuscripts",
    icon: (
      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
  },
  {
    name: "Championship Trophies",
    icon: (
      <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
        <path d="M7 6H4a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4h1M17 6h3a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4h-1" />
      </svg>
    ),
  },
];

const LogoSlider = () => {
  const { currentTheme } = useThemeProvider();

  return (
    <div
      className="w-full relative py-4 bg-surface-subtle/40 border-y border-border-subtle/40 transition-colors duration-300 overflow-hidden"
      role="region"
      aria-label="AuctionX Collectible Specialties"
    >
      {/* Edge gradient masks for seamless scrolling */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-r from-surface to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-surface to-transparent z-10" />

      <div className="w-full overflow-hidden">
        <div
          className="flex items-center logo-slider-track"
          style={{
            animation: "slide 28s linear infinite",
          }}
        >
          {categories.concat(categories).map((item, index) => (
            <div
              key={index}
              className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5 mx-3 rounded-xl bg-surface border border-border-subtle shadow-warm-xs text-foreground hover:border-action-primary/60 transition-all duration-300 group cursor-default select-none"
              title={item.name}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-action-primary/10 text-action-primary group-hover:scale-110 transition-transform duration-300">
                {item.icon}
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap tracking-wide text-foreground group-hover:text-action-primary transition-colors">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>
        {`
          @keyframes slide {
            from {
              transform: translateX(0);
            }
            to {
              transform: translateX(-50%);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .logo-slider-track {
              animation-play-state: paused !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default LogoSlider;