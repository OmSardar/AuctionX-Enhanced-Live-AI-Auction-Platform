import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../../../app/providers/ThemeProvider";
import { AuctionXLogo } from "../../../components/ui/AuctionXLogo";
import facebooklogo from "../../../assets/images/Layouts/facebook.png";
import instagramlogo from "../../../assets/images/Layouts/instagram.png";
import xlogo from "../../../assets/images/Layouts/twitter.png";
import linkedinlogo from "../../../assets/images/Layouts/linkedin.png";
import githublogo from "../../../assets/images/Layouts/github-logo.png";
import LogoSlider from "../../../components/Common/LogoSlider/LogoSlider";
import { cn } from "../../../lib/utils";

/**
 * Footer Component
 * Modernized application shell footer with responsive layout, semantic tokens,
 * high-contrast light/dark themes, and accessible mobile accordion.
 */
const Footer = () => {
  const [openSections, setOpenSections] = useState({
    about: false,
    consumer: false,
    help: false,
  });

  const { isDark } = useTheme();

  const toggleSection = (section) => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) return;
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const navigationSections = [
    {
      id: "about",
      title: "About",
      links: [
        { label: "Contact Us", to: "/contact" },
        { label: "About Us", to: "/about" },
        { label: "Why Us", to: "/whyus" },
      ],
    },
    {
      id: "consumer",
      title: "Consumer Policy",
      links: [
        { label: "Terms & Conditions", to: "/terms" },
        { label: "Security", to: "/security" },
        { label: "Privacy", to: "/privacy" },
      ],
    },
    {
      id: "help",
      title: "HELP",
      links: [
        { label: "Payment", to: "/payment" },
        { label: "Shipping", to: "/shipping" },
        { label: "Reports", to: "/report" },
        { label: "FAQ", to: "/faq" },
      ],
    },
  ];

  const socialLinks = [
    {
      href: "https://linktr.ee/auctionx_official",
      src: githublogo,
      alt: "GitHub",
      glowColor: "rgba(51, 51, 51, 0.4)",
      darkGlowColor: "rgba(255, 255, 255, 0.3)",
    },
    {
      href: "https://linktr.ee/AuctionX",
      src: linkedinlogo,
      alt: "LinkedIn",
      glowColor: "rgba(0, 114, 177, 0.4)",
      darkGlowColor: "rgba(0, 114, 177, 0.6)",
    },
    {
      href: "https://www.facebook.com/share/15nxmDHcJ6/",
      src: facebooklogo,
      alt: "Facebook",
      glowColor: "rgba(66, 103, 130, 0.4)",
      darkGlowColor: "rgba(66, 103, 130, 0.6)",
    },
    {
      href: "https://www.instagram.com/auctionx_official/",
      src: instagramlogo,
      alt: "Instagram",
      glowColor: "rgba(225, 48, 108, 0.4)",
      darkGlowColor: "rgba(225, 48, 108, 0.6)",
    },
    {
      href: "https://x.com/Auction__X",
      src: xlogo,
      alt: "X",
      glowColor: "rgba(29, 161, 242, 0.4)",
      darkGlowColor: "rgba(29, 161, 242, 0.6)",
    },
  ];

  return (
    <footer className="bg-surface text-foreground py-12 relative overflow-hidden border-t border-border-subtle shadow-sm transition-colors duration-200">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Partner Logos Slider */}
        <div className="mb-8">
          <LogoSlider />
        </div>

        <div className="flex flex-col items-center space-y-8">
          {/* Brand Logo & Slogan */}
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <Link
              to="/"
              className="relative group transition-transform duration-200 hover:scale-105 inline-block"
              aria-label="AuctionX Home"
            >
              <AuctionXLogo className="h-10 sm:h-12 w-auto" />
            </Link>
            <span className="text-lg sm:text-xl text-action-primary font-semibold tracking-wide">
              Place your first bid now!!
            </span>
          </div>

          {/* Navigation Columns (Grid on Desktop, Accordion on Mobile) */}
          <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 pt-4">
            {navigationSections.map((section) => {
              const isSectionOpen = openSections[section.id];

              return (
                <div
                  key={section.id}
                  className="border-b md:border-b-0 border-border-subtle pb-3 md:pb-0"
                >
                  {/* Header: Button on Mobile, Heading on Desktop */}
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isSectionOpen}
                    className="w-full flex items-center justify-between md:cursor-default py-2 md:py-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus rounded-md"
                  >
                    <h3 className="text-base sm:text-lg font-bold text-foreground md:border-b-2 md:border-action-primary md:pb-1 text-center md:text-left w-full">
                      {section.title}
                    </h3>
                    <svg
                      className={cn(
                        "w-5 h-5 md:hidden text-foreground-muted transition-transform duration-200 shrink-0",
                        isSectionOpen && "rotate-180"
                      )}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Links List */}
                  <nav
                    aria-label={`${section.title} links`}
                    className={cn(
                      "transition-all duration-200 ease-in-out md:block",
                      isSectionOpen ? "block" : "hidden"
                    )}
                  >
                    <ul className="mt-3 flex flex-col md:flex-row md:flex-wrap md:justify-center md:gap-x-6 gap-y-2.5 text-center">
                      {section.links.map((link) => (
                        <li key={link.to}>
                          <Link
                            to={link.to}
                            className="text-sm text-foreground-secondary hover:text-action-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring-focus rounded"
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>
              );
            })}
          </div>

          {/* Social Media Links */}
          <div className="pt-4">
            <div className="flex justify-center items-center gap-4 sm:gap-6">
              {socialLinks.map((icon, index) => (
                <a
                  key={index}
                  href={icon.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow AuctionX on ${icon.alt}`}
                  className="relative group p-1 rounded-full transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
                >
                  <div className="relative">
                    <img
                      src={icon.src}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-contain transition-all duration-300"
                    />
                    <div
                      className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{
                        boxShadow: `0 0 14px 4px ${
                          isDark ? icon.darkGlowColor : icon.glowColor
                        }`,
                      }}
                    />
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Copyright & Demonstration Disclosure */}
          <div className="pt-4 text-center border-t border-border-subtle w-full space-y-2">
            <p className="text-xs text-foreground-muted max-w-2xl mx-auto leading-relaxed">
              AuctionX is an advanced full-stack demonstration platform showcasing real-time bidding, payment workflows, and AI recommendations built with production-oriented engineering practices. Live transactions, third-party integrations, and verification processes depend on deployment configuration.
            </p>
            <p className="text-xs sm:text-sm text-foreground-muted">
              &copy; {new Date().getFullYear()} AuctionX. All rights reserved.{" "}
              <Link
                to="/terms"
                className="text-action-primary hover:underline font-medium ml-1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring-focus rounded"
              >
                Terms & Conditions
              </Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;