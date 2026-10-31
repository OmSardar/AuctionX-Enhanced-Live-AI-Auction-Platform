import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, ChevronDown, HelpCircle, ShieldCheck, Gavel, Store, CreditCard } from "lucide-react";

const FAQ_DATA = [
  {
    id: "bidding-1",
    category: "Bidding",
    question: "How does live bidding work on AuctionX?",
    answer:
      "When a lot opens for live bidding, you can submit competitive bids in predefined increments. Bids submitted in the final moments trigger an anti-sniping countdown extension, ensuring every bidder has fair opportunity. Once placed and confirmed, all bids are legally binding contractual offers.",
    link: { label: "Explore Live Auctions", to: "/bid" },
  },
  {
    id: "bidding-2",
    category: "Bidding",
    question: "What is scheduled or proxy bidding?",
    answer:
      "Scheduled bidding allows you to configure a maximum limit in advance. Our automated system will progressively bid the lowest required amount on your behalf whenever another bidder places an offer, stopping once your authorized maximum is reached or the lot closes.",
    link: { label: "View Scheduled Bids", to: "/scheduledbids" },
  },
  {
    id: "bidding-3",
    category: "Bidding",
    question: "Can I retract or cancel a placed bid?",
    answer:
      "To protect auction integrity, active bids cannot be retracted or cancelled once submitted. Please verify the lot condition, seller rating, reserve price, and your intended bid amount carefully before confirming your offer.",
    link: { label: "Read Bidding Guide", to: "/guide" },
  },
  {
    id: "selling-1",
    category: "Selling",
    question: "How do I become a seller on AuctionX?",
    answer:
      "To list lots, register as a seller and verify your account. Complete your seller profile details and confirm your registered email address with our secure OTP verification system to activate instant seller privileges.",
    link: { label: "Apply as Seller", to: "/seller" },
  },
  {
    id: "selling-2",
    category: "Selling",
    question: "What are the seller fees and commissions?",
    answer:
      "Listing your items on AuctionX is straightforward. We charge a standard transaction commission only upon a successful closing sale, which is transparently itemized before you publish your lot.",
    link: { label: "View Terms & Policies", to: "/terms" },
  },
  {
    id: "payments-1",
    category: "Payments & Delivery",
    question: "What payment methods are supported?",
    answer:
      "AuctionX supports major cards, UPI, net banking, and platform wallet deposits through Razorpay checkout.",
    link: { label: "Manage Wallet Balance", to: "/balance" },
  },
  {
    id: "payments-2",
    category: "Payments & Delivery",
    question: "How does settlement protection work?",
    answer:
      "When you win an auction, payment settlement transitions through an atomic state machine with idempotency keys. Payout workflows require settlement completion and order verification before funds are released to the seller account.",
    link: { label: "Security Architecture", to: "/security" },
  },
  {
    id: "payments-3",
    category: "Payments & Delivery",
    question: "How is item delivery and shipping handled?",
    answer:
      "Verified sellers are contractually obligated to dispatch items via tracked courier within 2 to 5 business days of winning bid settlement. Tracking credentials are provided directly in your Orders page.",
    link: { label: "Track My Orders", to: "/orders" },
  },
  {
    id: "trust-1",
    category: "Trust & Safety",
    question: "How are lot authentications and condition verified?",
    answer:
      "Sellers are required to provide comprehensive photographic evidence and provenance details. In cases where an item arrives materially different from the catalog description, our Buyer Protection policy offers dispute resolution and full refunds.",
    link: { label: "Contact Support Team", to: "/contact" },
  },
];

const CATEGORIES = ["All", "Bidding", "Selling", "Payments & Delivery", "Trust & Safety"];

const FAQ = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedId, setExpandedId] = useState("bidding-1");

  const filteredFaqs = useMemo(() => {
    return FAQ_DATA.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" || item.category === selectedCategory;
      const matchesQuery =
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, selectedCategory]);

  const toggleAccordion = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="w-full min-h-screen bg-canvas text-foreground pt-24 pb-20 transition-colors">
      <div className="max-w-4xl mx-auto px-6 sm:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-action-primary/10 text-action-primary text-xs font-semibold uppercase tracking-wider mb-4 border border-action-primary/20">
            <HelpCircle className="w-3.5 h-3.5" />
            Help & Knowledge Base
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-base sm:text-lg text-foreground-secondary max-w-2xl mx-auto leading-relaxed">
            Everything you need to know about live bidding, seller accounts, payment safeguards, and item delivery.
          </p>
          <div className="mt-4 p-3 bg-surface-subtle border border-border-subtle rounded-lg max-w-2xl mx-auto text-xs text-foreground-muted leading-relaxed">
            <strong className="text-foreground font-semibold">Demonstration Project:</strong> AuctionX is an educational portfolio showcase demonstrating real-time auction concurrency, state management, and seller workflows.
          </div>
        </div>

        {/* Search Input */}
        <div className="relative mb-8">
          <Search className="w-5 h-5 text-foreground-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search questions by keyword (e.g. settlement, cancel bid, delivery)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-border-subtle bg-surface text-foreground placeholder:text-foreground-muted shadow-xs focus:outline-none focus:ring-2 focus:ring-ring-focus focus:border-transparent transition-all text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-foreground-muted hover:text-foreground cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 mb-10 pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus ${
                selectedCategory === cat
                  ? "bg-action-primary text-white shadow-xs"
                  : "bg-surface border border-border-subtle text-foreground-secondary hover:text-foreground hover:bg-surface-subtle"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq) => {
              const isExpanded = expandedId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                    isExpanded
                      ? "bg-surface border-action-primary/30 shadow-warm-lg"
                      : "bg-surface border-border-subtle hover:border-border"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleAccordion(faq.id)}
                    aria-expanded={isExpanded}
                    className="w-full flex items-center justify-between p-5 sm:p-6 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
                  >
                    <div className="flex items-center gap-3 pr-4">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-surface-subtle text-foreground-muted border border-border-subtle shrink-0">
                        {faq.category}
                      </span>
                      <span className="text-base sm:text-lg font-semibold text-foreground">
                        {faq.question}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-foreground-muted shrink-0 transition-transform duration-200 ${
                        isExpanded ? "rotate-180 text-action-primary" : ""
                      }`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 border-t border-border-subtle/50 mt-1">
                      <p className="text-sm sm:text-base text-foreground-secondary leading-relaxed pt-3">
                        {faq.answer}
                      </p>
                      {faq.link && (
                        <div className="mt-4 pt-3 border-t border-border-subtle/50">
                          <Link
                            to={faq.link.to}
                            className="inline-flex items-center text-xs font-semibold text-action-primary hover:underline gap-1.5"
                          >
                            <span>{faq.link.label}</span>
                            <span>&rarr;</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 bg-surface rounded-xl border border-border-subtle">
              <p className="text-foreground-secondary text-sm">
                No questions found matching "{searchQuery}".
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
                className="mt-3 text-xs font-semibold text-action-primary hover:underline cursor-pointer"
              >
                Reset Search Filters
              </button>
            </div>
          )}
        </div>

        {/* Help Banner CTA */}
        <div className="mt-14 p-8 rounded-xl bg-surface-dark border border-border-subtle text-white text-center shadow-warm-lg">
          <h3 className="text-xl font-bold mb-2">Still Have Questions?</h3>
          <p className="text-sand/80 text-sm max-w-lg mx-auto mb-6">
            Can't find what you're looking for? Reach out directly to our 24/7 client operations and trust team.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center bg-action-primary hover:bg-action-primary-hover text-white font-semibold py-2.5 px-5 rounded-lg shadow-xs text-sm transition-colors"
            >
              Contact Support
            </Link>
            <Link
              to="/helpsupport"
              className="inline-flex items-center justify-center bg-white/10 hover:bg-white/20 text-white font-semibold py-2.5 px-5 rounded-lg shadow-xs text-sm transition-colors border border-white/15"
            >
              Browse Support Center
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;