import React from "react";

const SellProduct = () => {
  return (
    <section className="py-12 bg-canvas sm:py-16 lg:py-24 text-foreground">
      <div className="max-w-6xl px-4 mx-auto sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:items-stretch md:grid-cols-2 gap-x-12 lg:gap-x-20 gap-y-10">
          <div className="flex flex-col justify-between lg:py-5">
            <div>
              <h2 className="text-3xl font-bold font-display leading-tight text-foreground sm:text-4xl lg:leading-tight lg:text-5xl">
                Ready to auction your premium items?
              </h2>
              <p className="max-w-xl mt-4 text-base leading-relaxed text-muted-foreground">
                Explore the AuctionX seller workflow: multi-category item listing, live bid monitoring, and automated auction lifecycle settlement.
              </p>

              <img
                className="relative z-10 max-w-xs mx-auto -mb-16 md:hidden"
                src="/curve-line-mobile.svg"
                alt=""
              />

              <img
                className="hidden w-full translate-x-24 translate-y-8 md:block opacity-60"
                src="/curve-line.svg"
                alt=""
              />
            </div>

            <div className="hidden md:mt-auto md:block bg-surface p-6 rounded-2xl border border-border shadow-warm-xs">
              <span className="inline-block text-xs uppercase tracking-wider font-semibold text-action-primary bg-action-primary/10 px-3 py-1 rounded-full mb-3">
                Seller Workflow Capabilities
              </span>
              <h3 className="text-base font-bold text-foreground">
                Authoritative Inventory &amp; Lifecycle Management
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
                AuctionX provides complete seller lifecycle management: configurable reserve prices, scheduled auction start/end timings, live bid telemetry, and automated post-auction settlement outbox.
              </p>
            </div>
          </div>

          <div className="lg:pl-6">
            <div className="overflow-hidden bg-surface rounded-2xl border border-border shadow-warm-md">
              <div className="p-6 sm:p-10">
                <h3 className="text-2xl sm:text-3xl font-bold font-display text-foreground">
                  Get Started as a Seller
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Submit your details and our seller success team will guide your first listing.
                </p>

                <form onSubmit={(e) => e.preventDefault()} className="mt-6">
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm font-semibold text-foreground">
                        Your Name
                      </label>
                      <div className="mt-1.5 relative">
                        <input
                          type="text"
                          placeholder="Enter your full name"
                          className="block w-full px-4 py-3 text-foreground placeholder:text-muted-foreground transition-all duration-200 bg-canvas-subtle border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-foreground">
                        Email Address
                      </label>
                      <div className="mt-1.5 relative">
                        <input
                          type="email"
                          placeholder="Enter your email address"
                          className="block w-full px-4 py-3 text-foreground placeholder:text-muted-foreground transition-all duration-200 bg-canvas-subtle border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-foreground">
                        What do you plan to auction?
                      </label>
                      <div className="mt-1.5 relative">
                        <textarea
                          placeholder="Tell us about the category and items you want to list..."
                          className="block w-full px-4 py-3 text-foreground placeholder:text-muted-foreground transition-all duration-200 bg-canvas-subtle border border-border rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          rows="4"
                        ></textarea>
                      </div>
                    </div>

                    <div>
                      <button
                        type="submit"
                        className="btn-canonical btn-canonical-lg btn-canonical-primary w-full shadow-xs"
                      >
                        Submit Request
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SellProduct;
