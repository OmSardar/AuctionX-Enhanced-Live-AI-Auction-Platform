import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const BiddingGuidePage = () => {
  const [activeFaq, setActiveFaq] = useState(null);

  const toggleFaq = (idx) => {
    setActiveFaq(activeFaq === idx ? null : idx);
  };

  const steps = [
    {
      num: "01",
      title: "Register & Verify Your Account",
      desc: "Create your free AuctionX profile and complete user verification. Identity verification unlocks live real-time bidding, transparent bid histories, and wallet capabilities.",
      tag: "Prerequisite",
      linkText: "Learn about verification",
      linkTo: "/security"
    },
    {
      num: "02",
      title: "Discover Lots & Track Countdowns",
      desc: "Explore active auctions by category, rarity, or reserve status. Every lot features a live synchronized countdown timer, detailed condition reports, and authenticated provenance records.",
      tag: "Discovery",
      linkText: "Explore active listings",
      linkTo: "/bid"
    },
    {
      num: "03",
      title: "Place Your Bid or Use Proxy Bidding",
      desc: "Enter your custom bid amount above the current minimum increment, or specify your maximum reserve. Our proxy engine automatically bids incrementally on your behalf up to your cap.",
      tag: "Action",
      linkText: "View bidding rules",
      linkTo: "/terms"
    },
    {
      num: "04",
      title: "Win, Settle & Insured Delivery",
      desc: "When the clock strikes zero with your bid on top, the lot is reserved in your orders. Your payment is secured through settlement safeguards until courier tracking confirms delivery in stated condition.",
      tag: "Settlement",
      linkText: "Review shipping info",
      linkTo: "/shipping"
    }
  ];

  const tips = [
    {
      icon: "🎯",
      title: "Establish Your Ceiling Early",
      desc: "Decide your maximum valuation before final countdown minutes. Avoiding emotional bidding wars guarantees smart, disciplined acquisitions."
    },
    {
      icon: "🔍",
      title: "Inspect Authenticity Records",
      desc: "Check seller ratings, verified badges, and item high-resolution images. Ask questions through seller support if details are unclear."
    },
    {
      icon: "⏱️",
      title: "Understand Anti-Sniping Rules",
      desc: "Bids placed in the final 60 seconds automatically extend the auction clock by 2 minutes to give all genuine bidders an equal opportunity."
    },
    {
      icon: "💳",
      title: "Fund Your Wallet Balance",
      desc: "Pre-funding your wallet balance removes payment gateway latency, giving you instantaneous bid confirmation during high-speed live auctions."
    }
  ];

  const faqs = [
    {
      q: "What is proxy bidding and how does it protect me?",
      a: "Proxy bidding allows you to enter the highest price you are willing to pay for an item. The AuctionX platform will automatically place bids on your behalf using the standard increment only when another user bids against you, stopping when you either win or your maximum is surpassed."
    },
    {
      q: "Can I cancel or withdraw a bid once placed?",
      a: "No. In live auction environments, all bids are legally binding commitments to purchase. Please review item specifications, condition reports, and estimated shipping fees before confirming your bid."
    },
    {
      q: "Are there additional buyer premium fees?",
      a: "AuctionX maintains complete fee transparency. Any marketplace processing fees or applicable local taxes are clearly itemized on the bidding modal prior to placement."
    },
    {
      q: "How does the anti-sniping countdown extension work?",
      a: "To prevent automated bots and sniping scripts from depriving honest collectors, any bid entered within the final 60 seconds extends the lot duration by 120 seconds."
    }
  ];

  return (
    <div className="min-h-screen bg-canvas text-foreground py-12 px-4 sm:px-6 lg:px-8 mt-20">
      <div className="max-w-5xl mx-auto">
        {/* Hero Section */}
        <div className="bg-surface-dark text-foreground-inverse rounded-2xl p-8 sm:p-12 shadow-warm-md mb-12 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <span className="inline-block text-xs uppercase tracking-wider font-semibold text-action-primary bg-action-primary/20 px-3 py-1 rounded-full mb-3">
              Collector & Buyer Handbook
            </span>
            <h1 className="text-3xl sm:text-5xl font-bold font-display tracking-tight mb-4">
              The Complete Bidding Guide
            </h1>
            <p className="text-muted text-base sm:text-lg leading-relaxed mb-8">
              Master the AuctionX marketplace. Learn how live bidding, proxy increments, anti-sniping protection, and settlement fulfillment work.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/bid"
                className="inline-flex items-center justify-center px-6 py-3 bg-action-primary hover:bg-action-primary-hover text-white font-medium text-sm rounded-lg shadow-warm-xs transition-colors"
              >
                Browse Live Auctions
              </Link>
              <Link
                to="/category/all"
                className="inline-flex items-center justify-center px-6 py-3 bg-surface hover:bg-surface-subtle text-foreground font-medium text-sm rounded-lg shadow-warm-xs transition-colors"
              >
                Explore Categories
              </Link>
            </div>
          </div>
        </div>

        {/* 4-Step Process Section */}
        <section className="mb-16">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-foreground mb-2">
              The 4-Step Auction Lifecycle
            </h2>
            <p className="text-muted text-sm sm:text-base">
              A straightforward, transparent process from initial discovery to doorstep delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="bg-surface rounded-xl p-6 sm:p-7 border border-border-subtle shadow-warm-xs hover:border-action-primary/30 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-bold font-display text-action-primary">
                      {step.num}
                    </span>
                    <span className="text-xs uppercase tracking-wider font-semibold text-muted bg-surface-subtle px-2.5 py-1 rounded-full border border-border-subtle">
                      {step.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    {step.desc}
                  </p>
                </div>
                <div className="pt-3 border-t border-border-subtle">
                  <Link
                    to={step.linkTo}
                    className="text-xs font-semibold text-action-primary hover:underline inline-flex items-center gap-1"
                  >
                    <span>{step.linkText}</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bidding Tips Grid */}
        <section className="mb-16">
          <div className="bg-surface rounded-2xl p-8 sm:p-10 border border-border-subtle shadow-warm-xs">
            <div className="text-center max-w-xl mx-auto mb-10">
              <span className="text-xs uppercase tracking-wider font-semibold text-action-primary bg-action-primary/10 px-3 py-1 rounded-full">
                Pro Strategies
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-foreground mt-3 mb-2">
                Winning Auction Strategies
              </h2>
              <p className="text-muted text-sm">
                Practical insights to win competitive lots without overpaying.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {tips.map((tip, idx) => (
                <div key={idx} className="p-5 rounded-xl bg-surface-subtle border border-border-subtle">
                  <div className="text-2xl mb-3">{tip.icon}</div>
                  <h3 className="text-base font-semibold text-foreground mb-1.5">
                    {tip.title}
                  </h3>
                  <p className="text-muted text-xs sm:text-sm leading-relaxed">
                    {tip.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Accordion */}
        <section className="mb-16">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-foreground mb-2">
              Bidding FAQs
            </h2>
            <p className="text-muted text-sm">
              Common questions answered by our auction house specialists.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-surface rounded-xl border border-border-subtle overflow-hidden shadow-warm-xs"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-5 text-left flex justify-between items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-action-primary"
                    aria-expanded={isOpen}
                  >
                    <span className="font-semibold text-foreground text-sm sm:text-base pr-4">
                      {faq.q}
                    </span>
                    <span className={`text-action-primary text-xl font-bold transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-45' : ''}`}>
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-sm text-muted leading-relaxed border-t border-border-subtle">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Ready to Bid Call to Action */}
        <div className="bg-surface-dark text-foreground-inverse rounded-2xl p-8 sm:p-10 text-center shadow-warm-md">
          <h2 className="text-2xl font-bold font-display mb-3">Ready to place your first bid?</h2>
          <p className="text-muted text-sm sm:text-base max-w-xl mx-auto mb-6 leading-relaxed">
            Discover curated vintage watches, rare collectibles, fine art, and electronics live now on AuctionX.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/bid"
              className="inline-flex items-center justify-center px-6 py-2.5 bg-action-primary hover:bg-action-primary-hover text-white font-medium text-sm rounded-lg shadow-warm-xs transition-colors"
            >
              Browse Live Auctions
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center px-6 py-2.5 bg-surface hover:bg-surface-subtle text-foreground font-medium text-sm rounded-lg shadow-warm-xs transition-colors"
            >
              Ask Support Team
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BiddingGuidePage;