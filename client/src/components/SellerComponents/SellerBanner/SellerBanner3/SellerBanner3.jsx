import React from 'react'

const SellerBanner3 = () => {
  return (
    <section className="py-12 bg-canvas sm:py-16 lg:py-20 border-y border-border/40">
      <div className="max-w-5xl px-4 mx-auto sm:px-6 lg:px-8">
        <div className="grid items-center md:grid-cols-2 gap-y-10 md:gap-x-20">
          <div className="pr-12 sm:pr-0">
            <div className="relative max-w-xs mb-12">
              <img className="object-bottom rounded-2xl shadow-warm-md border border-border/40" src="/seller-growth-main.svg" alt="Seller consignment dashboard" />

              <img className="absolute origin-bottom-right scale-75 rounded-2xl shadow-warm-lg border-2 border-surface -bottom-12 -right-12" src="/seller-growth-badge.svg" alt="Partner settlement verified" />
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold font-display leading-tight text-espresso sm:text-4xl lg:text-5xl">
              Grow your auction business with AuctionX
            </h2>
            <p className="mt-4 text-base leading-relaxed text-text-secondary">
              Scale your collectibles, fine art, and luxury sales with dedicated consignor tools, automated settlements, and real-time bidder engagement on the AuctionX demonstration platform.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SellerBanner3