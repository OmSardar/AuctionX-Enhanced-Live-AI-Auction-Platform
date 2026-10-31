import React, { useState, useEffect } from "react";
import { FaShippingFast, FaCheckCircle, FaLock } from "react-icons/fa";

const WhyUs = () => {
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [fade, setFade] = useState(true);

  const testimonials = [
    {
      name: "Alex Smith",
      role: "Frequent Bidder, AuctionX",
      text: "AuctionX has transformed my experience in online bidding. The platform is user-friendly, and I love how easy it is to navigate through active auctions. I feel confident with the security and transparency AuctionX offers. Highly recommended for anyone looking to buy or sell!",
    },
    {
      name: "Samantha Lee",
      role: "Seller, AuctionX",
      text: "AuctionX is fantastic for sellers! Listing my items was seamless, and the support team was always there when I needed help. The bidding process is smooth and secure, which really puts my mind at ease. I've connected with a larger audience and had great results on every sale.",
    },
    {
      name: "Michael Johnson",
      role: "New User, AuctionX",
      text: "As a first-time user, I found AuctionX incredibly easy to get started with. The setup was straightforward, and I quickly got the hang of the bidding process. It's exciting to watch live bids, and I even won my first item! AuctionX offers a unique experience I'll definitely recommend.",
    },
  ];

  const handleNext = () => {
    setFade(false);
    setTimeout(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
      setFade(true);
    }, 300);
  };

  const handlePrev = () => {
    setFade(false);
    setTimeout(() => {
      setActiveTestimonial(
        (prev) => (prev - 1 + testimonials.length) % testimonials.length
      );
      setFade(true);
    }, 300);
  };

  // Auto-rotate testimonials every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      handleNext();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-canvas text-foreground py-24 transition-colors">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        {/* Why Shop With Us Section */}
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Why Bid & Sell With AuctionX
          </h1>
          <p className="mt-3 text-base text-foreground-secondary max-w-2xl mx-auto">
            Engineered for trust, speed, and transparency across every live auction and verified transaction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: Fast Delivery */}
          <div className="bg-surface rounded-xl shadow-xs p-8 text-center border border-border-subtle hover:border-action-primary/40 hover:-translate-y-1 transition-all duration-200">
            <div className="flex justify-center items-center mb-6">
              <div className="w-16 h-16 rounded-xl bg-action-primary/10 flex items-center justify-center">
                <FaShippingFast size={32} className="text-action-primary" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Fast Tracked Dispatch
            </h2>
            <p className="text-sm text-foreground-secondary leading-relaxed">
              Expedited dispatch from verified sellers with integrated end-to-end parcel tracking to your door.
            </p>
          </div>

          {/* Card 2: Verified Authenticity */}
          <div className="bg-surface rounded-xl shadow-xs p-8 text-center border border-border-subtle hover:border-action-primary/40 hover:-translate-y-1 transition-all duration-200">
            <div className="flex justify-center items-center mb-6">
              <div className="w-16 h-16 rounded-xl bg-action-primary/10 flex items-center justify-center">
                <FaCheckCircle size={32} className="text-action-primary" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Verified Authenticity
            </h2>
            <p className="text-sm text-foreground-secondary leading-relaxed">
              Strict seller onboarding, document verification, and authentic lot inspections on every active auction.
            </p>
          </div>

          {/* Card 3: Settlement Safeguards */}
          <div className="bg-surface rounded-xl shadow-xs p-8 text-center border border-border-subtle hover:border-action-primary/40 hover:-translate-y-1 transition-all duration-200">
            <div className="flex justify-center items-center mb-6">
              <div className="w-16 h-16 rounded-xl bg-action-primary/10 flex items-center justify-center">
                <FaLock size={32} className="text-action-primary" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Settlement Safeguards
            </h2>
            <p className="text-sm text-foreground-secondary leading-relaxed">
              Bidding and payment state machines enforce hold-and-release workflows with dispute resolution safeguards.
            </p>
          </div>
        </div>

        {/* Testimonial Section */}
        <div className="max-w-3xl mx-auto mt-24 relative px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              What Our Community Says
            </h2>
            <p className="mt-2 text-sm text-foreground-secondary">
              Real stories from active collectors, bidders, and verified sellers
            </p>
          </div>

          <div className="relative overflow-hidden min-h-[180px]">
            {/* Testimonial Content */}
            <div
              className={`transition-opacity duration-300 ease-in-out ${
                fade ? "opacity-100" : "opacity-0"
              }`}
              key={activeTestimonial}
            >
              <div className="bg-surface rounded-xl shadow-warm-lg p-8 border border-border-subtle">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-action-primary font-bold text-lg">
                      {testimonials[activeTestimonial]?.name}
                    </h3>
                    <p className="text-foreground-secondary text-xs">
                      {testimonials[activeTestimonial]?.role}
                    </p>
                  </div>
                  <span className="text-sand text-3xl font-serif">“</span>
                </div>
                <p className="text-foreground-secondary text-sm leading-relaxed">
                  {testimonials[activeTestimonial]?.text}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous testimonial"
              className="bg-surface hover:bg-surface-subtle border border-border-subtle text-foreground rounded-lg w-10 h-10 flex items-center justify-center shadow-xs cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
            >
              <i className="fas fa-chevron-left text-xs"></i>
            </button>
            <div className="flex gap-1.5">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Go to slide ${idx + 1}`}
                  onClick={() => {
                    setFade(false);
                    setTimeout(() => {
                      setActiveTestimonial(idx);
                      setFade(true);
                    }, 200);
                  }}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    activeTestimonial === idx
                      ? "bg-action-primary w-6"
                      : "bg-border-subtle"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next testimonial"
              className="bg-surface hover:bg-surface-subtle border border-border-subtle text-foreground rounded-lg w-10 h-10 flex items-center justify-center shadow-xs cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
            >
              <i className="fas fa-chevron-right text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhyUs;