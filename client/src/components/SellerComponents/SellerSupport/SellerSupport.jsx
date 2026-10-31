import React from 'react'

const SellerSupport = () => {
  return (
    <section className="pt-12 bg-canvas sm:pt-16 lg:pt-24 text-foreground">
      <div className="px-4 mx-auto sm:px-6 lg:px-8 max-w-7xl">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-display leading-tight text-foreground sm:text-4xl lg:text-5xl lg:leading-tight">
            Real humans are here to help you build your brand
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            Our 24/7 dedicated support team helps auction sellers set reserve prices, optimize catalogs, and settle bids.
          </p>
          <a
            href="/support"
            className="inline-flex items-center justify-center px-8 py-3.5 mt-8 text-base font-semibold text-white transition-all duration-200 bg-primary hover:bg-primary-hover rounded-xl shadow-warm-sm focus:outline-none cursor-pointer"
            role="button"
          >
            <svg
              className="w-5 h-5 mr-2 -ml-1"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            Contact our support
          </a>
        </div>
      </div>

      <div className="container mx-auto 2xl:px-12">
        <img
          className="w-full mt-8 rounded-2xl"
          src="/seller-support-team.svg"
          alt="AuctionX 24/7 Support Team"
        />
      </div>
    </section>
  );
};

export default SellerSupport