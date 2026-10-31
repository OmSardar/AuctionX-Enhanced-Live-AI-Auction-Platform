import React from 'react';

const CardSlider = () => {
  return (
    <div className="relative font-inter antialiased">
      <main className="relative py-20 flex flex-col justify-center bg-espresso border-y border-sand/20 overflow-hidden">
        <div className="w-full max-w-5xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-canvas">
              Why Premier Sellers Choose AuctionX
            </h2>
            <p className="text-sand/80 mt-2 text-base">
              Explore the key advantages designed for high-value consignments
            </p>
          </div>
          {/* Card slider */}
          <section className="px-12">
            <div className="max-w-lg mx-auto relative min-h-[320px]">
              {/* Radio inputs for slider control */}
              <input id="article-01" type="radio" name="slider" className="sr-only peer/01" />
              <input id="article-02" type="radio" name="slider" className="sr-only peer/02" />
              <input id="article-03" type="radio" name="slider" className="sr-only peer/03" defaultChecked />
              <input id="article-04" type="radio" name="slider" className="sr-only peer/04" />
              <input id="article-05" type="radio" name="slider" className="sr-only peer/05" />

              {/* Card 1 */}
              <div className="absolute inset-0 scale-[67.5%] z-20 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] peer-focus-visible/01:[&_article]:ring peer-focus-visible/01:[&_article]:ring-primary/40 peer-checked/01:relative peer-checked/01:z-50 peer-checked/01:translate-x-0 peer-checked/01:scale-100 peer-checked/01:[&>label]:pointer-events-none peer-checked/02:-translate-x-20 peer-checked/02:scale-[83.75%] peer-checked/02:z-40 peer-checked/03:-translate-x-40 peer-checked/03:z-30 peer-checked/04:-translate-x-40 peer-checked/04:opacity-0 peer-checked/05:-translate-x-40">
                <label className="absolute inset-0" htmlFor="article-01">
                  <span className="sr-only">Guaranteed Authenticity</span>
                </label>
                <article className="bg-surface p-6 rounded-2xl shadow-warm-lg border border-sand/40">
                  <header className="mb-2">
                    <div className="w-11 h-11 rounded-full bg-sand/30 flex items-center justify-center text-primary font-bold mb-3">01</div>
                    <h3 className="text-xl font-bold font-display text-espresso">Guaranteed Authenticity</h3>
                  </header>
                  <div className="text-sm leading-relaxed text-text-secondary space-y-3 mb-4">
                    <p>Every submitted lot passes rigorous appraisal and dual-verification by vetted industry specialists before being scheduled for public bidding.</p>
                  </div>
                  <footer className="text-right">
                    <a className="text-sm font-semibold text-primary hover:text-primary-600 hover:underline" href="#0">Read details -&gt;</a>
                  </footer>
                </article>
              </div>

              {/* Card 2 */}
              <div className="absolute inset-0 scale-[67.5%] z-20 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] peer-focus-visible/02:[&_article]:ring peer-focus-visible/02:[&_article]:ring-primary/40 peer-checked/01:translate-x-20 peer-checked/01:scale-[83.75%] peer-checked/01:z-40 peer-checked/02:relative peer-checked/02:z-50 peer-checked/02:translate-x-0 peer-checked/02:scale-100 peer-checked/02:[&>label]:pointer-events-none peer-checked/03:-translate-x-20 peer-checked/03:scale-[83.75%] peer-checked/03:z-40 peer-checked/04:-translate-x-40 peer-checked/04:z-30 peer-checked/05:-translate-x-40 peer-checked/05:opacity-0">
                <label className="absolute inset-0" htmlFor="article-02">
                  <span className="sr-only">Consignor Analytics</span>
                </label>
                <article className="bg-surface p-6 rounded-2xl shadow-warm-lg border border-sand/40">
                  <header className="mb-2">
                    <div className="w-11 h-11 rounded-full bg-sand/30 flex items-center justify-center text-primary font-bold mb-3">02</div>
                    <h3 className="text-xl font-bold font-display text-espresso">Consignor Analytics</h3>
                  </header>
                  <div className="text-sm leading-relaxed text-text-secondary space-y-3 mb-4">
                    <p>Track live viewership, bid depth velocity, and geographic interest in real-time through comprehensive seller performance metrics.</p>
                  </div>
                  <footer className="text-right">
                    <a className="text-sm font-semibold text-primary hover:text-primary-600 hover:underline" href="#0">Read details -&gt;</a>
                  </footer>
                </article>
              </div>

              {/* Card 3 */}
              <div className="absolute inset-0 scale-[67.5%] z-20 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] peer-focus-visible/03:[&_article]:ring peer-focus-visible/03:[&_article]:ring-primary/40 peer-checked/01:translate-x-40 peer-checked/01:z-30 peer-checked/02:translate-x-20 peer-checked/02:scale-[83.75%] peer-checked/02:z-40 peer-checked/03:relative peer-checked/03:z-50 peer-checked/03:translate-x-0 peer-checked/03:scale-100 peer-checked/03:[&>label]:pointer-events-none peer-checked/04:-translate-x-20 peer-checked/04:scale-[83.75%] peer-checked/04:z-40 peer-checked/05:-translate-x-40 peer-checked/05:z-30">
                <label className="absolute inset-0" htmlFor="article-03">
                  <span className="sr-only">Global Reach</span>
                </label>
                <article className="bg-surface p-6 rounded-2xl shadow-warm-lg border border-sand/40">
                  <header className="mb-2">
                    <div className="w-11 h-11 rounded-full bg-sand/30 flex items-center justify-center text-primary font-bold mb-3">03</div>
                    <h3 className="text-xl font-bold font-display text-espresso">Global Bidding Reach</h3>
                  </header>
                  <div className="text-sm leading-relaxed text-text-secondary space-y-3 mb-4">
                    <p>Connect instantly with thousands of verified international collectors competing in competitive live auctions without borders.</p>
                  </div>
                  <footer className="text-right">
                    <a className="text-sm font-semibold text-primary hover:text-primary-600 hover:underline" href="#0">Read details -&gt;</a>
                  </footer>
                </article>
              </div>

              {/* Card 4 */}
              <div className="absolute inset-0 scale-[67.5%] z-20 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] peer-focus-visible/04:[&_article]:ring peer-focus-visible/04:[&_article]:ring-primary/40 peer-checked/01:translate-x-40 peer-checked/01:opacity-0 peer-checked/02:translate-x-40 peer-checked/02:z-30 peer-checked/03:translate-x-20 peer-checked/03:scale-[83.75%] peer-checked/03:z-40 peer-checked/04:relative peer-checked/04:z-50 peer-checked/04:translate-x-0 peer-checked/04:scale-100 peer-checked/04:[&>label]:pointer-events-none peer-checked/05:-translate-x-20 peer-checked/05:scale-[83.75%] peer-checked/05:z-40">
                <label className="absolute inset-0" htmlFor="article-04">
                  <span className="sr-only">Settlement Safeguards</span>
                </label>
                <article className="bg-surface p-6 rounded-2xl shadow-warm-lg border border-sand/40">
                  <header className="mb-2">
                    <div className="w-11 h-11 rounded-full bg-sand/30 flex items-center justify-center text-primary font-bold mb-3">04</div>
                    <h3 className="text-xl font-bold font-display text-espresso">Settlement Safeguards</h3>
                  </header>
                  <div className="text-sm leading-relaxed text-text-secondary space-y-3 mb-4">
                    <p>Enjoy secure settlement holds upon auction close, released with structured settlement once delivery verification completes.</p>
                  </div>
                  <footer className="text-right">
                    <a className="text-sm font-semibold text-primary hover:text-primary-600 hover:underline" href="#0">Read details -&gt;</a>
                  </footer>
                </article>
              </div>

              {/* Card 5 */}
              <div className="absolute inset-0 scale-[67.5%] z-20 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] peer-focus-visible/05:[&_article]:ring peer-focus-visible/05:[&_article]:ring-primary/40 peer-checked/01:translate-x-40 peer-checked/02:translate-x-40 peer-checked/02:opacity-0 peer-checked/03:translate-x-40 peer-checked/03:z-30 peer-checked/04:translate-x-20 peer-checked/04:scale-[83.75%] peer-checked/04:z-40 peer-checked/05:relative peer-checked/05:z-50 peer-checked/05:translate-x-0 peer-checked/05:scale-100 peer-checked/05:[&>label]:pointer-events-none">
                <label className="absolute inset-0" htmlFor="article-05">
                  <span className="sr-only">Dynamic Reserve Auctions</span>
                </label>
                <article className="bg-surface p-6 rounded-2xl shadow-warm-lg border border-sand/40">
                  <header className="mb-2">
                    <div className="w-11 h-11 rounded-full bg-sand/30 flex items-center justify-center text-primary font-bold mb-3">05</div>
                    <h3 className="text-xl font-bold font-display text-espresso">Dynamic Reserve Auctions</h3>
                  </header>
                  <div className="text-sm leading-relaxed text-text-secondary space-y-3 mb-4">
                    <p>Set custom reserve thresholds, automated increment steps, and buyout parameters tailored specifically to your asset goals.</p>
                  </div>
                  <footer className="text-right">
                    <a className="text-sm font-semibold text-primary hover:text-primary-600 hover:underline" href="#0">Read details -&gt;</a>
                  </footer>
                </article>
              </div>
            </div>
          </section>
        </div>
      </main>

   
     
    </div>
  );
};

export default CardSlider;