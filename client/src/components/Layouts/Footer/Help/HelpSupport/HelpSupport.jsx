import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";

export default function HelpSupport() {
  const [searchQuery, setSearchQuery] = useState("");

  const supportCategories = [
    {
      title: "Bidding & Live Auctions",
      description: "How countdowns, increments, proxy bidding, and winning work on AuctionX.",
      icon: "🔨",
      link: "/guide",
      tag: "Buyer Guide"
    },
    {
      title: "Seller Portal & Listing",
      description: "Create lots, schedule auctions, set reserve prices, and manage sales.",
      icon: "🏪",
      link: "/seller",
      tag: "Seller Guide"
    },
    {
      title: "Payment, Settlement & Wallet",
      description: "Accepted payment methods, digital wallets, settlement safeguards, and payout limits.",
      icon: "💳",
      link: "/payment",
      tag: "Finance"
    },
    {
      title: "Shipping & Order Tracking",
      description: "Courier dispatch times, domestic/international rates, and carrier tracking.",
      icon: "📦",
      link: "/shipping",
      tag: "Logistics"
    },
    {
      title: "Trust, Safety & Security",
      description: "Account verification, two-factor auth, buyer protection, and anti-fraud policies.",
      icon: "🛡️",
      link: "/security",
      tag: "Security"
    },
    {
      title: "Report an Issue / Disputes",
      description: "File an issue regarding item condition, missing packages, or payment discrepancies.",
      icon: "🚨",
      link: "/report",
      tag: "Disputes"
    },
    {
      title: "Frequently Asked Questions",
      description: "Searchable self-serve answers covering all common marketplace questions.",
      icon: "❓",
      link: "/faq",
      tag: "Self-Serve"
    },
    {
      title: "Terms & Consumer Policies",
      description: "Marketplace rules, privacy notices, buyer obligations, and legal policies.",
      icon: "📜",
      link: "/terms",
      tag: "Policies"
    },
  ];

  const filteredCategories = supportCategories.filter(
    (cat) =>
      cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-canvas text-foreground py-12 px-4 sm:px-6 lg:px-8 mt-20">
      <div className="max-w-5xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <span className="inline-block text-xs uppercase tracking-wider font-semibold text-action-primary bg-action-primary/10 px-3 py-1 rounded-full mb-3">
            AuctionX Support Center
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-foreground mb-3">
            How can we assist you today?
          </h1>
          <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto mb-8">
            Explore dedicated guides, learn bidding strategies, or connect with our specialized support specialists.
          </p>

          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto">
            <div className="relative flex items-center bg-surface border border-border-subtle rounded-xl shadow-warm-xs focus-within:border-action-primary focus-within:ring-2 focus-within:ring-action-primary/20 overflow-hidden">
              <Search className="w-5 h-5 text-muted ml-4 shrink-0" />
              <input
                type="text"
                placeholder="Search topics (e.g., bidding, settlement, returns, seller fees)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent px-3 py-3 text-sm sm:text-base text-foreground placeholder-muted outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mr-3 text-muted hover:text-foreground text-xs font-semibold px-2 py-1 rounded bg-surface-subtle"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Support Category Grid */}
        <section className="mb-14">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">
              {searchQuery ? `Search Results (${filteredCategories.length})` : "Browse Support Knowledge Hubs"}
            </h2>
            {searchQuery && (
              <span className="text-xs text-muted">
                Showing matching hubs for "{searchQuery}"
              </span>
            )}
          </div>

          {filteredCategories.length === 0 ? (
            <div className="bg-surface rounded-2xl p-10 text-center border border-border-subtle">
              <p className="text-muted text-base mb-4">
                No support topics matched your search for "{searchQuery}".
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="px-4 py-2 bg-action-primary text-white text-sm font-medium rounded-lg shadow-warm-xs hover:bg-action-primary-hover transition-colors"
              >
                Reset Search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {filteredCategories.map((category, index) => (
                <Link
                  key={index}
                  to={category.link}
                  className="group bg-surface p-5 rounded-xl border border-border-subtle hover:border-action-primary/40 shadow-warm-xs hover:shadow-warm-sm transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-3xl group-hover:scale-110 transition-transform duration-200 inline-block">
                        {category.icon}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-surface-subtle text-muted group-hover:text-action-primary group-hover:bg-action-primary/10 transition-colors">
                        {category.tag}
                      </span>
                    </div>
                    <h3 className="font-semibold text-base text-foreground group-hover:text-action-primary transition-colors mb-1.5">
                      {category.title}
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      {category.description}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border-subtle flex items-center text-xs font-medium text-action-primary group-hover:translate-x-0.5 transition-transform">
                    <span>Explore Guide</span>
                    <span className="ml-1">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Quick Help & Contact Row */}
        <section className="bg-surface-dark text-foreground-inverse rounded-2xl p-8 sm:p-10 shadow-warm-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="inline-block text-xs uppercase tracking-wider font-semibold text-action-primary bg-action-primary/20 px-3 py-1 rounded-full mb-3">
                Live Support Assistance
              </span>
              <h2 className="text-2xl font-bold font-display mb-3">
                Cannot find what you need?
              </h2>
              <p className="text-muted text-sm sm:text-base leading-relaxed mb-4">
                Our support desk is on standby to assist with verification, live bid disputes, delayed tracking, and technical inquiries.
              </p>
              <div className="space-y-1.5 text-xs text-muted">
                <p>• Operating Hours: Mon – Fri (9:00 AM – 8:00 PM EST)</p>
                <p>• Average Ticket Response: Under 4 hours on business days</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3 justify-center md:justify-end">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center px-6 py-3 bg-action-primary hover:bg-action-primary-hover text-white font-medium text-sm rounded-lg shadow-warm-xs transition-colors text-center"
              >
                Send Us a Message
              </Link>
              <Link
                to="/feedback"
                className="inline-flex items-center justify-center px-6 py-3 bg-surface hover:bg-surface-subtle text-foreground font-medium text-sm rounded-lg shadow-warm-xs transition-colors text-center"
              >
                Submit Feedback
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
