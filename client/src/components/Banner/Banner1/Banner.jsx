import React from "react";

const Banner = () => {
  return (
    <section className="bg-canvas py-12 sm:py-16 lg:py-20 border-y border-border/40">
      <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="grid items-center grid-cols-1 gap-12 lg:grid-cols-2">
          <div>
            <h1 className="text-3xl font-bold font-display text-espresso sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight">
              AuctionX Live Marketplace
            </h1>
            <p className="mt-4 text-base text-text-secondary sm:text-lg md:text-xl leading-relaxed">
              Explore real-time bidding, automated auction lifecycles, and AI-powered recommendations built with production-oriented engineering practices.
            </p>
            <a
              href="/bid"
              className="inline-flex items-center px-6 py-3.5 mt-8 text-sm font-semibold text-white transition-all duration-200 bg-primary rounded-full shadow-warm-sm hover:shadow-warm-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary/40 sm:px-8 sm:py-4 sm:text-base"
            >
              Explore Live Auctions
            </a>
          </div>
          <div className="order-first lg:order-last">
            <img
              className="w-full"
              src="/hero-masterclass.svg"
              alt="Auction Masterclass"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Banner;
