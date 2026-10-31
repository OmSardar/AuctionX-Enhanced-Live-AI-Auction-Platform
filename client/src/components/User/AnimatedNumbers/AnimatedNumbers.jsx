import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

const Counter = ({ value, suffix = "+", label, icon: Icon, description }) => {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 1.0 });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const end = parseInt(value);
    if (start === end) return;

    let incrementTime = Math.abs(Math.floor(2000 / end));
    let timer = setInterval(() => {
      start += 1;
      setCount(start);
      if (start === end) clearInterval(timer);
    }, incrementTime);

    return () => clearInterval(timer);
  }, [value, inView]);

  return (
    <article ref={ref} className="text-center md:text-left bg-surface p-6 rounded-2xl border border-sand/40 shadow-warm-sm">
      <div className="w-14 h-14 rounded-xl shadow-warm-sm bg-sand/30 flex justify-center items-center rotate-3 mb-6 border border-sand/50">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-5xl font-bold font-display text-espresso">
        <motion.span animate={{ opacity: [0, 1] }}>{count}</motion.span>{suffix}
      </h2>
      <span className="inline-flex font-semibold text-primary mt-1 mb-2">
        {label}
      </span>
      <p className="text-sm text-text-secondary leading-relaxed">
        {description || "Demonstrating high-concurrency bidding, resilient payment flows, and seller workflows on AuctionX."}
      </p>
    </article>
  );
};

const AnimatedNumbers = () => {
  return (
    <main className="relative flex flex-col justify-center bg-canvas py-16 border-y border-border/40 overflow-hidden">
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6">
        <section className="grid gap-8 md:grid-cols-3 md:gap-8">
          <Counter
            value="40"
            suffix="+"
            label="Product Categories"
            description="Multi-category marketplace taxonomy with structured consignment attributes."
            icon={() => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          />
          <Counter
            value="89"
            suffix=""
            label="Documented Audit Records"
            description="Continuous audit sequence tracking state machines, media sanitization, and architectural verification."
            icon={() => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          />
          <Counter
            value="360"
            suffix="+"
            label="Automated Test Cases"
            description="Unit, integration, and regression suites verifying real-time bidding, RBAC, and settlement safeguards."
            icon={() => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
          />
        </section>
      </div>
    </main>
  );
};

export default AnimatedNumbers;
