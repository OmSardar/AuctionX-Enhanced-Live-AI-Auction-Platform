import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import PricingTable from "../../components/SellerComponents/PricingTable/PricingTable.jsx";

const SellerHome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [calculatorItemValue, setCalculatorItemValue] = useState(25000);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  // Smooth scroll to hash anchor if present
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      const elem = document.getElementById(id);
      if (elem) {
        elem.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [location.hash]);

  // Commission calculations: 10% platform fee, 90% seller payout
  const platformFee = Math.round(calculatorItemValue * 0.1);
  const sellerTakeHome = calculatorItemValue - platformFee;

  const faqs = [
    {
      q: "What are the platform fees for selling on AuctionX?",
      a: "AuctionX charges a flat, transparent 10% platform commission on settled auctions. Starter plan sellers enjoy zero upfront listing fees, meaning you only pay when your item successfully sells and gets paid by the buyer.",
    },
    {
      q: "When and how do I receive my payout?",
      a: "Once the winning bidder confirms payment, the funds are safely processed. As soon as delivery is fulfilled and confirmed, net proceeds (90%) are transferred directly to your registered bank account.",
    },
    {
      q: "What happens if a winning bidder does not pay?",
      a: "Winning bidders have a 24-hour payment obligation window. If an order remains unpaid, you can re-list the item or contact the bidder through our order resolution process at zero additional listing cost.",
    },
    {
      q: "Can I upgrade or change my subscription tier at any time?",
      a: "Yes! You can start on the Free Starter tier with 5 monthly listings and upgrade to Freelancer, Business, or Enterprise tiers directly from your Seller Dashboard as your catalog grows.",
    },
    {
      q: "What categories can I sell on AuctionX?",
      a: "AuctionX hosts auctions across luxury watches, fine art, collectibles, antiques, high-end electronics, rare automobiles, memorabilia, and designer goods.",
    },
  ];

  return (
    <div className="bg-canvas text-foreground overflow-hidden">
      {/* 1. HERO SECTION */}
      <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-32 px-4 sm:px-6 lg:px-8 border-b border-border-subtle">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 sm:w-[600px] h-96 bg-action-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-subtle border border-border-subtle text-action-primary text-xs sm:text-sm font-semibold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Premier Online Auction Marketplace for Verified Sellers
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-tight">
                Turn Your High-Value Items Into{" "}
                <span className="text-action-primary bg-gradient-to-r from-amber-600 via-action-primary to-amber-700 bg-clip-text text-transparent">
                  Competitive Bidding Wars
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-foreground-secondary max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                List luxury goods, antiques, art, and collectibles on AuctionX. Enjoy transparent fee structures, real-time bidder excitement, and verified buyer settlement.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button
                  onClick={() => navigate("/seller/signup")}
                  className="px-8 py-4 bg-action-primary hover:bg-action-primary-hover text-white rounded-xl font-bold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  Start Selling for Free
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
                <button
                  onClick={() => navigate("/seller/login")}
                  className="px-8 py-4 bg-surface hover:bg-surface-hover border border-border-subtle text-foreground rounded-xl font-semibold text-base transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  Seller Portal Login
                </button>
              </div>

              {/* Trust Features Checklist */}
              <div className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs sm:text-sm text-foreground-secondary">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>10% Flat Success Fee</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Secure Digital Checkout</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Direct Bank Settlement</span>
                </div>
              </div>
            </div>

            {/* Right Live Simulation Card */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md bg-surface border border-border-subtle rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
                {/* Live Ribbon */}
                <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-red-500">
                      Live Auction
                    </span>
                  </div>
                  <span className="text-xs font-mono text-foreground-secondary bg-surface-subtle px-2.5 py-1 rounded-md border border-border-subtle">
                    Ends in 02:45
                  </span>
                </div>

                {/* Simulated Product Card */}
                <div className="pt-4 space-y-4">
                  <div className="relative h-48 rounded-2xl overflow-hidden bg-surface-subtle flex items-center justify-center border border-border-subtle">
                    <img
                      src="https://res.cloudinary.com/dszvpb3q5/image/upload/v1738092417/xohxoosm3tnn0jjvquuv.png"
                      alt="Featured Auction Item"
                      className="w-full h-full object-contain p-4"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/lot-placeholder.svg";
                      }}
                    />
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                      Rare Collectible Lot #104
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Vintage 1968 Chronograph Watch (Mint Condition)
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Verified Authenticity • Active Bidders
                    </p>
                  </div>

                  {/* Bidding Summary Box */}
                  <div className="bg-surface-subtle rounded-2xl p-4 border border-border-subtle flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wider font-semibold">Current Highest Bid</p>
                      <p className="text-2xl font-black text-action-primary mt-0.5">₹78,500</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20">
                        Reserve Met
                      </span>
                      <p className="text-[11px] text-muted mt-1">+18 bids placed</p>
                    </div>
                  </div>

                  {/* Live Activity Feed */}
                  <div className="space-y-2 pt-1 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border-subtle">
                      <span className="text-foreground-secondary">
                        <strong className="text-foreground">Rajesh M.</strong> placed a bid
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">₹78,500</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-surface/50 border border-border-subtle">
                      <span className="text-muted">
                        <strong>Vikram S.</strong> placed a bid
                      </span>
                      <span className="font-semibold text-muted">₹76,000</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PLATFORM FEATURES BAR */}
      <section className="py-12 bg-surface border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-extrabold text-action-primary">Real-Time</p>
              <p className="text-xs sm:text-sm text-foreground-secondary font-medium">WebSocket Live Bidding</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-extrabold text-foreground">Curated Lots</p>
              <p className="text-xs sm:text-sm text-foreground-secondary font-medium">Collectibles, Watches & Art</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">Direct Settlement</p>
              <p className="text-xs sm:text-sm text-foreground-secondary font-medium">Bank Transfers upon Delivery</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-extrabold text-foreground">10% Fee</p>
              <p className="text-xs sm:text-sm text-foreground-secondary font-medium">Zero Upfront Listing Fee</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. VALUE PROPOSITIONS (WHY SELL ON AUCTIONX) */}
      <section className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-border-subtle">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-action-primary">
              Why AuctionX Outperforms Fixed-Price Marketplaces
            </h2>
            <p className="text-3xl sm:text-4xl font-bold text-foreground">
              Maximum Value Discovery with Transparent Selling
            </p>
            <p className="text-foreground-secondary text-base sm:text-lg">
              Traditional marketplaces lock you into fixed prices and prolonged buyer bargaining. AuctionX pits active buyers against one another in real-time auctions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 bg-surface rounded-2xl border border-border-subtle shadow-card hover:border-action-primary/50 transition-all duration-300 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-action-primary/10 text-action-primary flex items-center justify-center text-2xl font-bold">
                ⚡
              </div>
              <h3 className="text-xl font-bold text-foreground">Real-Time Bidding Engine</h3>
              <p className="text-foreground-secondary text-sm leading-relaxed">
                Dynamic websocket-powered live bidding stimulates urgency and competitive bids, discovering true market value beyond static listings.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 bg-surface rounded-2xl border border-border-subtle shadow-card hover:border-action-primary/50 transition-all duration-300 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-2xl font-bold">
                🛡️
              </div>
              <h3 className="text-xl font-bold text-foreground">Secure Payment Processing</h3>
              <p className="text-foreground-secondary text-sm leading-relaxed">
                Winning bidders complete payment securely through authorized checkout gateways. Payouts are credited directly to your registered bank account after delivery.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 bg-surface rounded-2xl border border-border-subtle shadow-card hover:border-action-primary/50 transition-all duration-300 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-2xl font-bold">
                📊
              </div>
              <h3 className="text-xl font-bold text-foreground">Comprehensive Order Tracking</h3>
              <p className="text-foreground-secondary text-sm leading-relaxed">
                Downloadable PDF order invoices, customer address records, and transparent bidding history tracking available directly in your dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS (3 SIMPLE STEPS) */}
      <section
        id="how-it-works"
        className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-surface-subtle border-b border-border-subtle scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-action-primary">
              Simple & Straightforward
            </h2>
            <p className="text-3xl sm:text-4xl font-bold text-foreground">
              How Selling on AuctionX Works
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="bg-surface p-8 rounded-2xl border border-border-subtle shadow-card relative">
              <span className="text-4xl font-black text-action-primary/20 absolute top-4 right-6">01</span>
              <div className="space-y-3">
                <span className="inline-block px-3 py-1 bg-surface-subtle border border-border-subtle rounded-md text-xs font-semibold text-action-primary">
                  Step One
                </span>
                <h3 className="text-xl font-bold text-foreground">List Your Item</h3>
                <p className="text-foreground-secondary text-sm leading-relaxed">
                  Upload photos, describe condition, select your category, and set your starting bid price and auction deadline.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-surface p-8 rounded-2xl border border-border-subtle shadow-card relative">
              <span className="text-4xl font-black text-action-primary/20 absolute top-4 right-6">02</span>
              <div className="space-y-3">
                <span className="inline-block px-3 py-1 bg-surface-subtle border border-border-subtle rounded-md text-xs font-semibold text-action-primary">
                  Step Two
                </span>
                <h3 className="text-xl font-bold text-foreground">Live Bidding Frenzy</h3>
                <p className="text-foreground-secondary text-sm leading-relaxed">
                  Interested collectors view your listing. Real-time bids push the closing price higher until the auction timer expires.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-surface p-8 rounded-2xl border border-border-subtle shadow-card relative">
              <span className="text-4xl font-black text-action-primary/20 absolute top-4 right-6">03</span>
              <div className="space-y-3">
                <span className="inline-block px-3 py-1 bg-surface-subtle border border-border-subtle rounded-md text-xs font-semibold text-action-primary">
                  Step Three
                </span>
                <h3 className="text-xl font-bold text-foreground">Fulfill & Receive Payout</h3>
                <p className="text-foreground-secondary text-sm leading-relaxed">
                  Winning bidder completes checkout via online payment. Ship the item with tracking to receive your net proceeds directly to your registered bank account.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. INTERACTIVE COMMISSION & EARNINGS CALCULATOR */}
      <section className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-border-subtle">
        <div className="max-w-4xl mx-auto bg-surface border border-border-subtle rounded-3xl p-8 sm:p-12 shadow-xl">
          <div className="text-center space-y-3 mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Calculate Your Seller Payout
            </h2>
            <p className="text-foreground-secondary text-sm sm:text-base">
              No hidden listing surprises or unexpected gateway deductions. Transparent 10% platform fee.
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-foreground">
                  Expected Auction Closing Price
                </label>
                <span className="text-xl font-black text-foreground">
                  ₹{calculatorItemValue.toLocaleString("en-IN")}
                </span>
              </div>
              <input
                type="range"
                min="1000"
                max="500000"
                step="1000"
                value={calculatorItemValue}
                onChange={(e) => setCalculatorItemValue(Number(e.target.value))}
                className="w-full h-2 bg-surface-subtle rounded-lg appearance-none cursor-pointer accent-action-primary"
              />
              <div className="flex justify-between text-xs text-muted mt-2">
                <span>₹1,000</span>
                <span>₹2,50,000</span>
                <span>₹5,00,000</span>
              </div>
            </div>

            {/* Calculation Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-5 rounded-2xl bg-surface-subtle border border-border-subtle space-y-1">
                <p className="text-xs font-semibold text-muted uppercase">Platform Commission (10%)</p>
                <p className="text-2xl font-bold text-foreground-secondary">
                  ₹{platformFee.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted">Covers platform infrastructure, auction hosting & maintenance</p>
              </div>

              <div className="p-5 rounded-2xl bg-action-primary/10 border border-action-primary/30 space-y-1">
                <p className="text-xs font-semibold text-action-primary uppercase">Estimated Net Proceeds (90%)</p>
                <p className="text-3xl font-black text-action-primary">
                  ₹{sellerTakeHome.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-foreground-secondary">Direct bank settlement following buyer order completion</p>
              </div>
            </div>

            <div className="text-center pt-2">
              <button
                onClick={() => navigate("/seller/signup")}
                className="px-8 py-3.5 bg-action-primary hover:bg-action-primary-hover text-white font-bold rounded-xl shadow-md transition-all duration-200 cursor-pointer"
              >
                List Items at This Rate
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. AUTHORITATIVE SUBSCRIPTION PLANS (PRICING TABLE) */}
      <section
        id="pricing-fees"
        className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-surface-subtle border-b border-border-subtle scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-action-primary">
              Subscription Tiers
            </h2>
            <p className="text-3xl sm:text-4xl font-bold text-foreground">
              Choose the Right Plan for Your Volume
            </p>
            <p className="text-foreground-secondary text-base sm:text-lg">
              Start with our Free Starter tier and scale up to unlock premium catalog placement, lower listing restrictions, and VIP support.
            </p>
          </div>

          {/* Integrated Authoritative Pricing Table hooked to backend API */}
          <PricingTable />
        </div>
      </section>

      {/* 7. FREQUENTLY ASKED QUESTIONS */}
      <section
        id="faqs"
        className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-border-subtle scroll-mt-20"
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-action-primary">
              Got Questions?
            </h2>
            <p className="text-3xl font-bold text-foreground">
              Frequently Asked Questions for Sellers
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-surface border border-border-subtle rounded-2xl overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  className="w-full p-6 text-left flex items-center justify-between text-foreground font-semibold text-base sm:text-lg hover:text-action-primary transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <svg
                    className={`w-5 h-5 transform transition-transform duration-200 shrink-0 ${
                      openFaqIndex === idx ? "rotate-180 text-action-primary" : "text-muted"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaqIndex === idx && (
                  <div className="px-6 pb-6 text-foreground-secondary text-sm leading-relaxed border-t border-border-subtle/50 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. FINAL CONVERSION CTA BANNER */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-surface to-surface-subtle">
        <div className="max-w-5xl mx-auto bg-gradient-to-r from-amber-600 via-action-primary to-amber-700 rounded-3xl p-8 sm:p-14 text-center text-white shadow-2xl space-y-6">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            Ready to Unleash Your Inventory's True Value?
          </h2>
          <p className="text-amber-100 text-base sm:text-lg max-w-2xl mx-auto">
            Join thousands of collectors and businesses auctioning with AuctionX. Set up your verified seller profile in under 3 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button
              onClick={() => navigate("/seller/signup")}
              className="px-8 py-4 bg-white text-gray-900 hover:bg-gray-100 rounded-xl font-bold text-base shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
            >
              Create Free Seller Account
            </button>
            <button
              onClick={() => navigate("/seller/login")}
              className="px-8 py-4 bg-black/20 hover:bg-black/30 text-white border border-white/30 rounded-xl font-semibold text-base transition-all duration-200 cursor-pointer"
            >
              Sign In to Existing Account
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SellerHome;
