import React from 'react'

const SellerBanner2 = () => {
  return (
    <section className="py-12 bg-canvas sm:py-16 lg:py-20 border-y border-border/40">
      <div className="px-4 mx-auto sm:px-6 lg:px-8 max-w-7xl">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-display leading-tight text-espresso sm:text-4xl lg:text-5xl lg:leading-tight">
            People who made it successful
          </h2>
          <p className="max-w-2xl mx-auto mt-4 text-lg text-text-secondary">
            Meet the dedicated auction advisors, authenticators, and domain specialists supporting your sales.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 mt-8 sm:grid-cols-3 md:mt-16 lg:gap-x-12">
          <div>
            <img className="w-full rounded-2xl shadow-warm-md border border-border/40 object-cover" src="/specialist-advisory.svg" alt="Auction Advisory Specialist" />
          </div>

          <div>
            <img className="w-full rounded-2xl shadow-warm-md border border-border/40 object-cover" src="/specialist-auth.svg" alt="Authentication Specialist" />
          </div>

          <div>
            <img className="w-full rounded-2xl shadow-warm-md border border-border/40 object-cover" src="/specialist-valuation.svg" alt="Valuation Specialist" />
          </div>
        </div>

        <div className="mt-8 text-center md:mt-12">
          <a href="#" title="" className="inline-flex items-center justify-center py-3.5 px-10 font-semibold text-white transition-all duration-200 bg-primary rounded-xl shadow-warm-sm hover:shadow-warm-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary/40" role="button">
            Join our team
          </a>
        </div>
      </div>
    </section>
  );
};

export default SellerBanner2