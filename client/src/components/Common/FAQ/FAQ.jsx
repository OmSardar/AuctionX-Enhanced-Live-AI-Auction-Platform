import { useState } from "react";

const FAQItem = ({ question, answer }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border py-4.5">
      <button
        className="w-full flex justify-between items-center text-left focus:outline-none group cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
          {question}
        </span>
        <span
          className={`w-8 h-8 flex items-center justify-center text-2xl ml-2 text-primary font-medium transform transition-transform duration-300 ease-in-out ${
            expanded ? "rotate-45 text-accent-dark" : ""
          }`}
        >
          +
        </span>
      </button>
      <div
        className={`mt-2 text-muted-foreground leading-relaxed overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? "max-h-[500px] opacity-100 py-1" : "max-h-0 opacity-0"
        }`}
      >
        <p className="text-sm sm:text-base">{answer}</p>
      </div>
    </div>
  );
};

const FAQList = () => {
  const faqData = [
    {
      question: "What is your refund policy?",
      answer:
        "We offer a 30-day refund policy on all our products. Please contact support for more details.",
    },
    {
      question: "How can I track my order?",
      answer:
        "You can track your order using the tracking number provided in your order confirmation email.",
    },
    {
      question: "Do you offer technical support?",
      answer:
        "Yes, we provide 24/7 technical support. Contact us anytime for assistance.",
    },
  ];

  return (
    <div className="w-full max-w-[2000px] mx-auto my-8 p-6 sm:p-8 bg-surface border border-border shadow-warm-sm rounded-2xl overflow-x-auto">
      <h2 className="text-2xl font-bold font-display text-foreground mb-6">
        Frequently Asked Questions
      </h2>
      {faqData.map((faq, index) => (
        <FAQItem key={index} question={faq.question} answer={faq.answer} />
      ))}
    </div>
  );
};

export default FAQList;
