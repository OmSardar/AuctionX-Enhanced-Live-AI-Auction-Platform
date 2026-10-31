import React from "react";

const OurReach = () => {
  return (
    <section className="py-12 bg-surface-subtle sm:py-16 border-t border-b border-border-subtle">
      <div className="max-w-5xl px-4 mx-auto sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-block text-xs uppercase tracking-wider font-semibold text-action-primary bg-action-primary/10 px-3 py-1 rounded-full mb-3">
            Platform Architecture
          </span>
          <h2 className="text-3xl font-bold font-display text-foreground sm:text-4xl">
            Engineered for Concurrency & Integrity
          </h2>
          <p className="mt-3 text-base sm:text-lg text-muted">
            AuctionX demonstrates production-grade full-stack engineering with real-time state machines, settlement safeguards, and defense-in-depth security.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 mt-10 text-center sm:gap-x-8 md:grid-cols-3">
          <div className="bg-surface rounded-xl p-6 border border-border-subtle shadow-warm-xs flex flex-col justify-between">
            <h3 className="font-bold font-display text-2xl sm:text-3xl text-action-primary min-h-[48px] flex items-center justify-center">
              Server-Authoritative
            </h3>
            <p className="mt-3 text-lg font-semibold text-foreground">
              Real-Time Bidding
            </p>
            <p className="text-xs sm:text-sm mt-1 text-muted">
              Atomic Compare-and-Swap state machine preventing bid-sniping races
            </p>
          </div>

          <div className="bg-surface rounded-xl p-6 border border-border-subtle shadow-warm-xs flex flex-col justify-between">
            <h3 className="font-bold font-display text-2xl sm:text-3xl text-action-primary min-h-[48px] flex items-center justify-center">
              Lease-Fenced
            </h3>
            <p className="mt-3 text-lg font-semibold text-foreground">
              Idempotency &amp; Settlement Safeguards
            </p>
            <p className="text-xs sm:text-sm mt-1 text-muted">
              Lease-fenced webhook deduplication and settlement state holds
            </p>
          </div>

          <div className="bg-surface rounded-xl p-6 border border-border-subtle shadow-warm-xs flex flex-col justify-between">
            <h3 className="font-bold font-display text-4xl sm:text-5xl text-action-primary min-h-[48px] flex items-center justify-center">
              89
            </h3>
            <p className="mt-3 text-lg font-semibold text-foreground">
              Documented Audit Records
            </p>
            <p className="text-xs sm:text-sm mt-1 text-muted">
              Continuous engineering verification across security, UX, and state models
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OurReach;