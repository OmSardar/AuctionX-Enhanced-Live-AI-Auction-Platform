import React from "react";
import { cn } from "../../lib/utils";

/**
 * AuctionXLogo Component
 * Locally authored SVG brand identity for AuctionX.
 * Adapts to light/dark themes via currentColor and design-token terracotta gradients.
 */
export const AuctionXLogo = ({
  className = "h-8 lg:h-9 w-auto",
  showWordmark = true,
  ariaLabel = "AuctionX Logo",
  ...props
}) => {
  return (
    <svg
      viewBox={showWordmark ? "0 0 180 40" : "0 0 40 40"}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={cn("inline-block select-none", className)}
      {...props}
    >
      <title>{ariaLabel}</title>
      <defs>
        <linearGradient
          id="auctionx-primary-grad"
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
          id="auctionx-accent-grad"
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

      {/* Brand Mark Emblem: Faceted Auction Gavel & Monogram "A-X" */}
      <g id="brand-mark">
        {/* Rounded Hexagonal / Shield Foundation */}
        <rect
          x="2"
          y="2"
          width="36"
          height="36"
          rx="10"
          className="fill-primary-50 dark:fill-primary-950/60 stroke-border-subtle"
          strokeWidth="1.2"
        />

        {/* Dynamic Gavel Head & Handle Silhouette in Brand Gradient */}
        <path
          d="M13 14.5L18.5 9L23 13.5L17.5 19L13 14.5Z"
          fill="url(#auctionx-primary-grad)"
        />
        <path
          d="M20 16.5L28 24.5C28.8 25.3 28.8 26.5 28 27.3C27.2 28.1 26 28.1 25.2 27.3L17.2 19.3L20 16.5Z"
          fill="url(#auctionx-accent-grad)"
        />
        <path
          d="M11 26L15.5 21.5L17.5 23.5L13 28C12.2 28.8 11.2 28.2 10.8 27.6C10.4 27 10.2 26 11 26Z"
          fill="url(#auctionx-primary-grad)"
          opacity="0.85"
        />
        {/* Sound Base / Pedestal */}
        <path
          d="M9 31C9 30.4 9.4 30 10 30H24C24.6 30 25 30.4 25 31C25 31.6 24.6 32 24 32H10C9.4 32 9 31.6 9 31Z"
          fill="url(#auctionx-primary-grad)"
        />
      </g>

      {/* Brand Wordmark: "AUCTION" + Terracotta "X" */}
      {showWordmark && (
        <g id="brand-wordmark">
          <text
            x="48"
            y="27"
            fontFamily="var(--font-display, 'DM Sans', 'Inter', sans-serif)"
            fontSize="21"
            fontWeight="800"
            letterSpacing="-0.03em"
            className="fill-foreground transition-colors duration-200"
          >
            AUCTION
          </text>
          <text
            x="148"
            y="27"
            fontFamily="var(--font-display, 'DM Sans', 'Inter', sans-serif)"
            fontSize="23"
            fontWeight="900"
            letterSpacing="-0.02em"
            fill="url(#auctionx-primary-grad)"
          >
            X
          </text>
        </g>
      )}
    </svg>
  );
};

export default AuctionXLogo;
