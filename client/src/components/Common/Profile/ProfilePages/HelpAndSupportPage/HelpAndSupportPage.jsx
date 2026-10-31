import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchCsrfToken } from "../../../../../redux/slices/csrfSecuritySlice";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

const HelpAndSupportPage = () => {
  const [activeTab, setActiveTab] = useState("faq");
  const [searchQuery, setSearchQuery] = useState("");
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token: csrfToken, loading } = useSelector((state) => state.csrf || {});
  const dispatch = useDispatch();

  // Get user data from Redux store
  const user = useSelector(
    (state) => state.auth?.user || state.user?.data || state.user
  );

  useEffect(() => {
    if (!csrfToken && !loading) {
      dispatch(fetchCsrfToken());
    }
  }, [dispatch, csrfToken, loading]);

  useEffect(() => {
    if (user) {
      setContactForm((prev) => ({
        ...prev,
        name:
          user.name ||
          user.fullName ||
          (user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : ""),
        email: user.email || "",
      }));
    }
  }, [user]);

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        name: contactForm.name,
        email: contactForm.email,
        subject: contactForm.subject,
        message: contactForm.message,
      };

      const response = await fetch(`${API_URL}/api/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to submit support ticket");
      }

      toast.success("Your support ticket has been submitted");
      setTicketSubmitted(true);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error(
        "There was an error submitting your ticket. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-canvas text-foreground py-12 px-4 sm:px-6 lg:px-8 mt-20">
      <div className="max-w-5xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-10">
          <span className="inline-block text-xs uppercase tracking-wider font-semibold text-action-primary bg-action-primary/10 px-3 py-1 rounded-full mb-3">
            Member Assistance
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-foreground mb-3">
            Help & Support Portal
          </h1>
          <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto">
            Everything you need to master bidding, manage balances, and troubleshoot orders on AuctionX.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-2xl mx-auto mb-10">
          <input
            type="text"
            placeholder="Search FAQs, guides, or policies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border-subtle bg-surface text-foreground placeholder-muted focus:border-action-primary focus:ring-2 focus:ring-action-primary/20 shadow-warm-xs text-sm sm:text-base outline-none"
          />
          <svg
            className="w-5 h-5 text-muted absolute right-3.5 top-1/2 transform -translate-y-1/2 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-border-subtle mb-8">
          <nav className="flex space-x-4 sm:space-x-8 justify-center overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveTab("faq")}
              className={`py-3 px-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "faq"
                  ? "border-action-primary text-action-primary"
                  : "border-transparent text-muted hover:text-foreground hover:border-border-subtle"
              }`}
            >
              Frequently Asked Questions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("guides")}
              className={`py-3 px-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "guides"
                  ? "border-action-primary text-action-primary"
                  : "border-transparent text-muted hover:text-foreground hover:border-border-subtle"
              }`}
            >
              User Guides
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("contact")}
              className={`py-3 px-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "contact"
                  ? "border-action-primary text-action-primary"
                  : "border-transparent text-muted hover:text-foreground hover:border-border-subtle"
              }`}
            >
              Submit Support Ticket
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-surface rounded-2xl shadow-warm-md border border-border-subtle p-6 sm:p-8 mb-10">
          {/* FAQ Section */}
          {activeTab === "faq" && (
            <div className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground mb-4">
                Frequently Asked Questions
              </h2>

              {searchQuery && filteredFaqs.length === 0 ? (
                <div className="text-center py-10 text-muted">
                  <p>No FAQs match "{searchQuery}". Try different keywords or switch to the Contact tab.</p>
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {(searchQuery ? filteredFaqs : faqs).map((faq, index) => (
                    <FaqItem key={index} faq={faq} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User Guides Section */}
          {activeTab === "guides" && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground mb-6">
                Marketplace Guides & Handbooks
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {guides.map((guide, index) => (
                  <GuideCard key={index} guide={guide} />
                ))}
              </div>
            </div>
          )}

          {/* Contact Support Section */}
          {activeTab === "contact" && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground mb-6">
                Submit a Support Ticket
              </h2>

              {ticketSubmitted ? (
                <div className="bg-status-success/10 border border-status-success/30 rounded-xl p-8 text-center">
                  <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-status-success/20 text-status-success mb-4">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Support Ticket Submitted!
                  </h3>
                  <p className="text-muted text-sm mb-6 max-w-md mx-auto">
                    We've received your inquiry and our member support team will follow up at your registered email within 24 hours.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setTicketSubmitted(false);
                      setContactForm((prev) => ({ ...prev, subject: "", message: "" }));
                    }}
                    className="inline-flex items-center px-5 py-2.5 bg-action-primary hover:bg-action-primary-hover text-white text-sm font-medium rounded-lg shadow-warm-xs transition-colors"
                  >
                    Submit Another Request
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2">
                    <form onSubmit={handleContactSubmit} className="space-y-5">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                          Your Name <span className="text-status-error">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          id="name"
                          required
                          value={contactForm.name}
                          onChange={handleContactChange}
                          className="block w-full rounded-lg border border-border-subtle bg-surface px-3.5 py-2.5 text-foreground text-sm shadow-warm-xs focus:border-action-primary focus:ring-2 focus:ring-action-primary/20"
                          placeholder="Enter your full name"
                        />
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                          Email Address <span className="text-status-error">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          id="email"
                          required
                          value={contactForm.email}
                          onChange={handleContactChange}
                          className="block w-full rounded-lg border border-border-subtle bg-surface px-3.5 py-2.5 text-foreground text-sm shadow-warm-xs focus:border-action-primary focus:ring-2 focus:ring-action-primary/20"
                          placeholder="Enter your email"
                        />
                      </div>

                      <div>
                        <label htmlFor="subject" className="block text-sm font-medium text-foreground mb-1">
                          Issue Category <span className="text-status-error">*</span>
                        </label>
                        <select
                          name="subject"
                          id="subject"
                          required
                          value={contactForm.subject}
                          onChange={handleContactChange}
                          className="block w-full rounded-lg border border-border-subtle bg-surface px-3.5 py-2.5 text-foreground text-sm shadow-warm-xs focus:border-action-primary focus:ring-2 focus:ring-action-primary/20"
                        >
                          <option value="">Select a topic</option>
                          <option value="Bidding Issues">Bidding & Auction Issues</option>
                          <option value="Payment Issues">Payment & Wallet Issues</option>
                          <option value="Account Questions">Account Verification & Profile</option>
                          <option value="Item Questions">Item Authenticity & Condition</option>
                          <option value="Shipping & Delivery">Shipping & Tracking</option>
                          <option value="other">Other Inquiries</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="message" className="block text-sm font-medium text-foreground mb-1">
                          Message Description <span className="text-status-error">*</span>
                        </label>
                        <textarea
                          name="message"
                          id="message"
                          rows={4}
                          required
                          value={contactForm.message}
                          onChange={handleContactChange}
                          className="block w-full rounded-lg border border-border-subtle bg-surface p-3 text-foreground placeholder-muted text-sm shadow-warm-xs focus:border-action-primary focus:ring-2 focus:ring-action-primary/20"
                          placeholder="Please provide details about your inquiry..."
                        ></textarea>
                      </div>

                      <div>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className={`w-full py-2.5 px-4 rounded-lg shadow-warm-xs text-sm font-medium text-white bg-action-primary hover:bg-action-primary-hover transition-colors inline-flex items-center justify-center gap-2 ${
                            isSubmitting ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        >
                          {isSubmitting ? "Submitting Ticket..." : "Submit Support Ticket"}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="bg-surface-subtle p-6 rounded-xl border border-border-subtle flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-foreground mb-4">
                        Contact Details
                      </h3>
                      <div className="space-y-4 text-xs sm:text-sm text-muted">
                        <div>
                          <span className="font-semibold text-foreground block mb-0.5">Direct Support Email:</span>
                          <a href="mailto:support@auctionx.com" className="text-action-primary hover:underline">
                            support@auctionx.com
                          </a>
                        </div>
                        <div>
                          <span className="font-semibold text-foreground block mb-0.5">Toll-Free Phone:</span>
                          <a href="tel:+18002828466" className="text-action-primary hover:underline">
                            1-800-AUCTION (1-800-282-8466)
                          </a>
                        </div>
                        <div>
                          <span className="font-semibold text-foreground block mb-0.5">Operating Hours:</span>
                          <p>Monday–Friday: 9:00 AM – 8:00 PM EST</p>
                          <p>Saturday: 10:00 AM – 6:00 PM EST</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-border-subtle">
                      <span className="text-xs text-muted block">
                        Response time: Under 24 business hours.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Links Section */}
        <div className="bg-surface rounded-2xl shadow-warm-xs border border-border-subtle p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">
            Helpful Marketplace Quick Links
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              to="/guide"
              className="flex items-center p-3 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle transition-colors group"
            >
              <span className="text-xl mr-3">🔨</span>
              <span className="text-xs sm:text-sm font-medium text-foreground group-hover:text-action-primary transition-colors">
                Bidding Guide
              </span>
            </Link>
            <Link
              to="/payment"
              className="flex items-center p-3 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle transition-colors group"
            >
              <span className="text-xl mr-3">💳</span>
              <span className="text-xs sm:text-sm font-medium text-foreground group-hover:text-action-primary transition-colors">
                Payment Options
              </span>
            </Link>
            <Link
              to="/shipping"
              className="flex items-center p-3 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle transition-colors group"
            >
              <span className="text-xl mr-3">📦</span>
              <span className="text-xs sm:text-sm font-medium text-foreground group-hover:text-action-primary transition-colors">
                Shipping Policy
              </span>
            </Link>
            <Link
              to="/terms"
              className="flex items-center p-3 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle transition-colors group"
            >
              <span className="text-xl mr-3">📜</span>
              <span className="text-xs sm:text-sm font-medium text-foreground group-hover:text-action-primary transition-colors">
                Terms & Rules
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// FAQ Item
const FaqItem = ({ faq }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="py-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-action-primary rounded-lg"
        aria-expanded={isOpen}
      >
        <h3 className="text-sm sm:text-base font-semibold text-foreground pr-4">
          {faq.question}
        </h3>
        <span className={`text-action-primary font-bold text-lg transition-transform duration-200 shrink-0 ${isOpen ? "rotate-45" : ""}`}>
          +
        </span>
      </button>
      {isOpen && (
        <div className="mt-2 text-sm text-muted leading-relaxed">
          <p>{faq.answer}</p>
        </div>
      )}
    </div>
  );
};

// Guide Card
const GuideCard = ({ guide }) => {
  return (
    <div className="bg-surface-subtle rounded-xl p-5 border border-border-subtle hover:border-action-primary/30 shadow-warm-xs flex flex-col justify-between transition-colors">
      <div>
        <div className="text-2xl mb-3">{guide.icon}</div>
        <h3 className="text-base font-semibold text-foreground mb-1.5">
          {guide.title}
        </h3>
        <p className="text-xs text-muted leading-relaxed mb-4">
          {guide.description}
        </p>
      </div>
      <Link
        to={guide.link}
        className="text-xs font-semibold text-action-primary hover:underline inline-flex items-center gap-1"
      >
        <span>Read Guide</span>
        <span>→</span>
      </Link>
    </div>
  );
};

const faqs = [
  {
    question: "How do I place a bid?",
    answer: "Navigate to any active auction item and click 'Bid Now'. Enter your amount above the current minimum increment, confirm details, and your bid will register in real time on the live socket stream.",
  },
  {
    question: "What happens if I win an auction?",
    answer: "When an auction countdown expires with you as the winning bidder, the item is reserved in your Orders page. You will receive an email invoice to confirm delivery address and complete checkout.",
  },
  {
    question: "How do shipping costs and delivery work?",
    answer: "Shipping costs are transparently calculated based on parcel dimensions and destination. Every parcel is dispatched with courier tracking within 48 hours of payment settlement.",
  },
  {
    question: "Can I cancel a bid once placed?",
    answer: "Bids placed in live auctions represent binding commitments. If an extraordinary error occurs, contact our support team immediately before the auction reaches its final countdown.",
  },
  {
    question: "What payment methods are supported?",
    answer: "AuctionX supports credit and debit cards, UPI, net banking, and platform wallet balance through Razorpay checkout.",
  },
  {
    question: "What is the Buyer Protection policy?",
    answer: "Payments are secured through our state-machine settlement safeguards and Razorpay processing. If an item arrives damaged or differs substantially from the listing, you can open a dispute within 48 hours for review and refund processing.",
  },
];

const guides = [
  {
    title: "Getting Started with AuctionX",
    description: "Learn how to register, verify your identity, and navigate curated auctions.",
    link: "/guide",
    icon: "🚀",
  },
  {
    title: "Bidding Strategies & Increment Rules",
    description: "Discover proxy bidding, timing strategies, and anti-sniping protection.",
    link: "/guide",
    icon: "🎯",
  },
  {
    title: "Payment & Settlement Guide",
    description: "Detailed breakdown of cards, wallets, settlement safeguards, and receipt downloads.",
    link: "/payment",
    icon: "💳",
  },
  {
    title: "Seller's Handbook & Listing Standards",
    description: "Learn how to list items, set reserves, handle packaging, and receive disbursements.",
    link: "/seller",
    icon: "🏪",
  },
  {
    title: "Authenticity & Provenance Standards",
    description: "How our multi-point verification process protects buyers and collectors.",
    link: "/whyus",
    icon: "🛡️",
  },
  {
    title: "Dispute Resolution & Filing Reports",
    description: "How to open a ticket, upload photos, and resolve order discrepancies.",
    link: "/report",
    icon: "🚨",
  },
];

export default HelpAndSupportPage;
