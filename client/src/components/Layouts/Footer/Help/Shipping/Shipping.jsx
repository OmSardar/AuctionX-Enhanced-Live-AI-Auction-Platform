import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Shipping = () => {
  const shippingRates = [
    { destination: "India (Domestic)", standard: "₹99", express: "₹199", delivery: "2–4 business days" },
    { destination: "South Asia & Middle East", standard: "₹499", express: "₹999", delivery: "4–6 business days" },
    { destination: "Europe & United Kingdom", standard: "₹999", express: "₹1,999", delivery: "7–10 business days" },
    { destination: "Asia Pacific", standard: "₹799", express: "₹1,499", delivery: "5–8 business days" },
    { destination: "North America", standard: "₹1,199", express: "₹2,499", delivery: "7–10 business days" },
    { destination: "Rest of World", standard: "₹1,499", express: "₹2,999", delivery: "10–14 business days" }
  ];

  const faqItems = [
    {
      question: "How do I track my winning auction delivery?",
      answer: "You will receive an automated dispatch email containing your courier tracking number as soon as the seller packages your item. You can also view live tracking updates on your Orders page."
    },
    {
      question: "What if my item arrives damaged or not as described?",
      answer: "AuctionX buyer safeguards ensure claims can be reviewed. If an item arrives damaged, notify support within 48 hours of delivery with photos of the package and item to initiate a claim review."
    },
    {
      question: "Do sellers offer combined shipping for multiple won lots?",
      answer: "Many sellers offer discounted combined shipping when you win multiple lots from their store within a 24-hour window. Look for the 'Combined Shipping' badge on listing details."
    },
    {
      question: "Can I update my delivery address after winning an auction?",
      answer: "You can select or update your shipping address during final checkout before payment is submitted. Once payment is processed and dispatch begins, address changes must be requested through customer support."
    }
  ];

  const [openFaqItems, setOpenFaqItems] = useState({});

  const toggleFaq = (index) => {
    setOpenFaqItems((prev) => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <div className="min-h-screen bg-canvas text-foreground py-12 px-4 sm:px-6 lg:px-8 mt-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-12">
          <span className="inline-block text-xs uppercase tracking-wider font-semibold text-action-primary bg-action-primary/10 px-3 py-1 rounded-full mb-3">
            Fulfillment & Delivery
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-foreground mb-3">
            Shipping Information
          </h1>
          <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto">
            Reliable, insured delivery across domestic and international destinations with real-time tracking.
          </p>
        </header>
        
        {/* Info Cards Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {/* Shipping Process Card */}
          <div className="bg-surface rounded-xl shadow-warm-xs p-6 border border-border-subtle border-t-4 border-t-action-primary hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center mb-4">
              <div className="w-11 h-11 bg-action-primary/10 text-action-primary rounded-lg flex items-center justify-center text-xl mr-3 font-bold">
                📦
              </div>
              <h3 className="text-lg font-semibold text-foreground">Verified Dispatch</h3>
            </div>
            <div className="text-muted text-sm space-y-2 leading-relaxed">
              <p>Sellers are required to dispatch sold lots within 48 business hours of payment confirmation.</p>
              <p>Every parcel is packed to collector-grade standards using tamper-evident packaging.</p>
            </div>
          </div>
          
          {/* Delivery Areas Card */}
          <div className="bg-surface rounded-xl shadow-warm-xs p-6 border border-border-subtle border-t-4 border-t-brand-clay hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center mb-4">
              <div className="w-11 h-11 bg-brand-clay/10 text-brand-clay rounded-lg flex items-center justify-center text-xl mr-3 font-bold">
                🌎
              </div>
              <h3 className="text-lg font-semibold text-foreground">Global Reach</h3>
            </div>
            <div className="text-muted text-sm space-y-2 leading-relaxed">
              <p>We facilitate shipping to over 100 countries with major courier partners (DHL, FedEx, UPS, USPS).</p>
              <p>Express courier options are available during checkout for urgent deliveries.</p>
            </div>
          </div>
          
          {/* Protection & Insurance Card */}
          <div className="bg-surface rounded-xl shadow-warm-xs p-6 border border-border-subtle border-t-4 border-t-status-success hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center mb-4">
              <div className="w-11 h-11 bg-status-success/10 text-status-success rounded-lg flex items-center justify-center text-xl mr-3 font-bold">
                🛡️
              </div>
              <h3 className="text-lg font-semibold text-foreground">Transit Insurance</h3>
            </div>
            <div className="text-muted text-sm space-y-2 leading-relaxed">
              <p>All platform shipments include standard loss and damage coverage up to ₹5,000.</p>
              <p>High-value auction lots feature full replacement value declared insurance and signature on delivery.</p>
            </div>
          </div>
        </section>
        
        {/* Shipping Rates Section */}
        <section className="mb-14">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">
              Estimated Shipping Rates & Times
            </h2>
            <span className="text-xs text-muted hidden sm:inline">
              * Rates calculated at checkout based on package weight and dimensions
            </span>
          </div>
          
          <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface shadow-warm-xs">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-subtle border-b border-border-subtle text-foreground text-left">
                  <th className="py-3.5 px-6 font-semibold">Destination</th>
                  <th className="py-3.5 px-6 font-semibold">Standard Shipping</th>
                  <th className="py-3.5 px-6 font-semibold">Express Shipping</th>
                  <th className="py-3.5 px-6 font-semibold">Estimated Delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {shippingRates.map((rate, index) => (
                  <tr 
                    key={index} 
                    className="hover:bg-surface-subtle/50 transition-colors"
                  >
                    <td className="py-3.5 px-6 font-medium text-foreground">{rate.destination}</td>
                    <td className="py-3.5 px-6 text-muted">{rate.standard}</td>
                    <td className="py-3.5 px-6 text-muted">{rate.express}</td>
                    <td className="py-3.5 px-6 text-foreground font-medium">{rate.delivery}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        
        {/* FAQ Section */}
        <section className="mb-14">
          <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground mb-6">
            Frequently Asked Shipping Questions
          </h2>
          <div className="space-y-3">
            {faqItems.map((faq, index) => {
              const isOpen = !!openFaqItems[index];
              return (
                <div 
                  key={index} 
                  className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-warm-xs"
                >
                  <button 
                    type="button"
                    className="w-full px-6 py-4 cursor-pointer flex justify-between items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-action-primary"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                  >
                    <span className="font-semibold text-foreground text-sm sm:text-base">{faq.question}</span>
                    <span className={`text-action-primary text-xl font-bold transition-transform duration-200 ml-4 ${isOpen ? 'rotate-45' : ''}`}>
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 pt-1 border-t border-border-subtle">
                      <p className="text-muted text-sm leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        
        {/* Support Banner Section */}
        <section className="bg-surface-dark text-foreground-inverse rounded-2xl p-8 sm:p-10 text-center shadow-warm-md">
          <h2 className="text-2xl font-bold font-display mb-3">Need Help with an Existing Shipment?</h2>
          <p className="max-w-2xl mx-auto mb-6 text-muted text-sm sm:text-base leading-relaxed">
            Our logistics support specialists can help you track delayed parcels, request customs documentation, or file carrier claims.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link 
              to="/contact" 
              className="inline-flex items-center justify-center bg-action-primary hover:bg-action-primary-hover text-white font-medium px-6 py-2.5 rounded-lg shadow-warm-xs transition-colors text-sm"
            >
              Contact Support
            </Link>
            <Link 
              to="/orders" 
              className="inline-flex items-center justify-center bg-surface hover:bg-surface-subtle text-foreground font-medium px-6 py-2.5 rounded-lg shadow-warm-xs transition-colors text-sm"
            >
              View My Orders
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Shipping;