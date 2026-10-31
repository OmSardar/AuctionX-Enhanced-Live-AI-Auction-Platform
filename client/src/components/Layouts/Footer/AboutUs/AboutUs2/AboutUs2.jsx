import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Team from "../AboutUs3/AboutUs3";

const cardData = [
  {
    step: "01",
    tag: "Simplified",
    title: "Auctions Made Intuitive",
    description: "Effortless live bidding designed for both seasoned collectors and first-time enthusiasts.",
    bgClass: "bg-brand-terracotta text-white border-brand-terracotta/40",
  },
  {
    step: "02",
    tag: "Effortless Experience",
    title: "Seamless Auction Flow",
    description: "Instantaneous bids, automated proxy increments, and real-time outbid alerts across devices.",
    bgClass: "bg-brand-clay text-white border-brand-clay/40",
  },
  {
    step: "03",
    tag: "Live Sync",
    title: "Real-Time Bidding Updates",
    description: "Sub-second state synchronization via WebSocket technology for true fair-market bidding.",
    bgClass: "bg-brand-espresso text-white border-brand-espresso/40",
  },
  {
    step: "04",
    tag: "Integrity & Trust",
    title: "Dedicated 24/7 Support",
    description: "Bank-grade escrow settlements, verified authenticity, and dedicated specialist assistance.",
    bgClass: "bg-gradient-to-br from-[#2D241E] to-[#1E1815] text-white border-action-primary/30",
  },
];

const AboutUs2 = () => {
  const navigate = useNavigate();
  const stackAreaRef = useRef(null);
  const cardRefs = useRef([]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const cards = cardRefs.current.filter(Boolean);
    const stackArea = stackAreaRef.current;
    if (!cards.length || !stackArea) return;

    const applyCardTransforms = () => {
      cards.forEach((card, index) => {
        if (!card) return;
        if (card.classList.contains("active")) {
          // Smoothly fly card upward with controlled rotation and opacity fade
          card.style.transform = "translate(-50%, -110vh) rotate(-16deg) scale(0.9)";
          card.style.opacity = "0";
          card.style.pointerEvents = "none";
        } else {
          // Staggered clean stacking: subtle offset and scale so text doesn't overlap
          const depth = index;
          const rotateDeg = (depth % 2 === 0 ? 1 : -1) * (depth * 2.5);
          const yOffset = depth * 6;
          const xOffset = depth * 3;
          const scale = 1 - depth * 0.03;

          card.style.transform = `translate(calc(-50% + ${xOffset}px), calc(-50% + ${yOffset}px)) rotate(${rotateDeg}deg) scale(${scale})`;
          card.style.opacity = "1";
          card.style.pointerEvents = "auto";
        }
      });
    };

    applyCardTransforms();

    const handleScroll = () => {
      const rect = stackArea.getBoundingClientRect();
      const scrollProgress = -rect.top / (rect.height - window.innerHeight);

      if (scrollProgress >= 0) {
        const totalCards = cards.length;
        const activeCount = Math.floor(scrollProgress * (totalCards + 0.5));

        cards.forEach((card, idx) => {
          if (!card) return;
          if (idx < activeCount) {
            card.classList.add("active");
          } else {
            card.classList.remove("active");
          }
        });
        applyCardTransforms();
      } else {
        cards.forEach((card) => {
          if (card) card.classList.remove("active");
        });
        applyCardTransforms();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <div className="w-full bg-canvas text-foreground transition-colors duration-300 overflow-x-hidden">
      <div className="w-full flex flex-col items-center justify-center">
        {/* Banner Hero */}
        <div className="w-full py-20 md:py-28 flex flex-col items-center justify-center px-4 text-center">
          <span className="text-xs uppercase tracking-widest font-semibold text-action-primary bg-action-primary/10 px-4 py-1.5 rounded-full mb-4 border border-action-primary/20">
            About Our Mission
          </span>
          <h1 className="font-display font-extrabold text-4xl sm:text-6xl md:text-7xl lg:text-8xl text-foreground tracking-tight">
            Auction<span className="text-action-primary">X</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-foreground-secondary max-w-2xl mx-auto">
            Where discerning collectors and visionary creators meet through authentic, real-time live auctions.
          </p>
        </div>

        {/* Scroll-Driven Feature Showcase */}
        <div
          ref={stackAreaRef}
          className="w-full min-h-[220vh] relative flex flex-col lg:flex-row items-start justify-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        >
          {/* Sticky Left Narrative Column */}
          <div className="w-full lg:w-1/2 lg:sticky lg:top-24 flex flex-col justify-center py-12 lg:py-24 z-10">
            <div className="max-w-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-action-primary">
                Philosophy & Vision
              </span>
              <h2 className="text-3xl sm:text-5xl font-bold font-display text-foreground mt-2 leading-tight">
                Reimagining the Auction Experience
              </h2>
              <p className="mt-5 text-sm sm:text-base text-foreground-secondary leading-relaxed">
                For us, AuctionX is the spirit of looking at things differently. Founded in 2024, our platform bridges the excitement of heritage live auction houses with state-of-the-art digital infrastructure.
              </p>
              <p className="mt-3 text-sm sm:text-base text-foreground-secondary leading-relaxed">
                Every bid is backed by cryptographic verification, transparent reserves, and bank-grade settlement protocols.
              </p>

              <div className="mt-8 flex flex-wrap gap-4 items-center">
                <button
                  type="button"
                  onClick={() => navigate("/our-story")}
                  className="inline-flex items-center justify-center text-sm font-semibold px-6 py-3 rounded-xl border border-action-primary/40 bg-action-primary/10 hover:bg-action-primary text-action-primary hover:text-white shadow-warm-xs transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus cursor-pointer"
                >
                  Read Our Full Story
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/whyus")}
                  className="inline-flex items-center justify-center text-sm font-semibold px-6 py-3 rounded-xl border border-border-subtle bg-surface hover:bg-surface-subtle text-foreground shadow-xs transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus cursor-pointer"
                >
                  Why Choose AuctionX
                </button>
              </div>
            </div>
          </div>

          {/* Sticky Right Animated Cards Column */}
          <div className="w-full lg:w-1/2 h-[70vh] lg:h-screen lg:sticky lg:top-0 flex items-center justify-center relative">
            <div className="w-[320px] sm:w-[380px] h-[340px] sm:h-[380px] relative">
              {cardData.map((card, idx) => (
                <div
                  key={idx}
                  ref={(el) => (cardRefs.current[idx] = el)}
                  style={{ zIndex: cardData.length - idx }}
                  className={`w-[320px] sm:w-[380px] h-[340px] sm:h-[380px] p-8 sm:p-9 rounded-3xl flex flex-col justify-between absolute top-1/2 left-1/2 border shadow-warm-lg transition-transform duration-500 ease-out select-none will-change-transform ${card.bgClass}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs">
                      {card.tag}
                    </span>
                    <span className="text-sm font-mono font-bold opacity-75">
                      {card.step}
                    </span>
                  </div>

                  <div className="my-auto py-2">
                    <h3 className="text-2xl sm:text-3xl font-display font-bold leading-snug">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-xs sm:text-sm leading-relaxed opacity-90 font-normal">
                      {card.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/15 flex items-center justify-between text-xs font-medium opacity-80">
                    <span>AuctionX Core Guarantee</span>
                    <span className="text-action-primary-light">Explore &rarr;</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Founding Engineering Team Section */}
        <div className="w-full min-h-[500px] flex items-center justify-center bg-canvas transition-colors duration-300 py-16">
          <Team />
        </div>
      </div>
    </div>
  );
};

export default AboutUs2;
