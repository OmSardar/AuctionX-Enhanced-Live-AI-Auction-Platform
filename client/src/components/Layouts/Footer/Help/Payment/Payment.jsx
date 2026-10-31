import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Payment = () => {
  const [activeTab, setActiveTab] = useState('methods');
  const [activeAccordion, setActiveAccordion] = useState('');

  const toggleAccordion = (id) => {
    setActiveAccordion(activeAccordion === id ? '' : id);
  };

  const tabs = [
    { id: 'methods', label: 'Payment Methods' },
    { id: 'process', label: 'Payment Process' },
    { id: 'deposits', label: 'Deposits & Withdrawals' },
    { id: 'faq', label: 'FAQs' },
  ];

  return (
    <div className="min-h-screen bg-canvas text-foreground py-12 px-4 sm:px-6 lg:px-8 mt-20">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block text-xs uppercase tracking-wider font-semibold text-action-primary bg-action-primary/10 px-3 py-1 rounded-full mb-3">
            Financial & Security Guide
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-foreground mb-3">
            Payment Information
          </h1>
          <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto">
            Everything you need to know about payments, settlement safeguards, deposits, and payouts at AuctionX.
          </p>
          <div className="mt-4 p-3 bg-surface-subtle border border-border-subtle rounded-lg max-w-2xl mx-auto text-xs text-muted leading-relaxed">
            <strong className="text-foreground font-semibold">Portfolio Demonstration Note:</strong> AuctionX implements idempotent wallet top-ups and auction settlements configured for sandbox / test payment gateways. Live commercial payments and currency conversions depend on production deployment credentials.
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-border-subtle mb-8 overflow-x-auto">
          <nav className="flex space-x-2 sm:space-x-8 min-w-max pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors rounded-t-lg ${
                  activeTab === tab.id
                    ? 'border-action-primary text-action-primary bg-action-primary/5'
                    : 'border-transparent text-muted hover:text-foreground hover:border-border-subtle'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mb-12">
          {/* Payment Methods Tab */}
          {activeTab === 'methods' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold font-display text-foreground mb-6">
                  Accepted Payment Methods
                </h2>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Credit/Debit Cards */}
                  <div className="bg-surface rounded-xl shadow-warm-xs p-6 border border-border-subtle hover:border-action-primary/30 transition-colors">
                    <div className="flex items-center mb-4">
                      <div className="mr-4 bg-action-primary/10 p-3 rounded-lg text-action-primary">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">Credit & Debit Cards</h3>
                    </div>
                    <p className="text-muted mb-4 text-sm leading-relaxed">
                      We accept all major credit and debit cards with 3D Secure verification for lightning-fast auction checkout.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2.5 py-1 bg-surface-subtle border border-border-subtle rounded text-xs font-semibold text-foreground">VISA</span>
                      <span className="px-2.5 py-1 bg-surface-subtle border border-border-subtle rounded text-xs font-semibold text-foreground">MasterCard</span>
                      <span className="px-2.5 py-1 bg-surface-subtle border border-border-subtle rounded text-xs font-semibold text-foreground">American Express</span>
                      <span className="px-2.5 py-1 bg-surface-subtle border border-border-subtle rounded text-xs font-semibold text-foreground">Discover</span>
                    </div>
                  </div>

                  {/* Digital Wallets */}
                  <div className="bg-surface rounded-xl shadow-warm-xs p-6 border border-border-subtle hover:border-action-primary/30 transition-colors">
                    <div className="flex items-center mb-4">
                      <div className="mr-4 bg-action-primary/10 p-3 rounded-lg text-action-primary">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">Digital Wallets</h3>
                    </div>
                    <p className="text-muted mb-4 text-sm leading-relaxed">
                      Pay instantly without re-entering card numbers using your preferred one-click wallet.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-surface-subtle border border-border-subtle rounded text-xs font-medium text-foreground">PayPal</span>
                      <span className="px-3 py-1 bg-surface-subtle border border-border-subtle rounded text-xs font-medium text-foreground">Apple Pay</span>
                      <span className="px-3 py-1 bg-surface-subtle border border-border-subtle rounded text-xs font-medium text-foreground">Google Pay</span>
                    </div>
                  </div>

                  {/* Bank Transfer */}
                  <div className="bg-surface rounded-xl shadow-warm-xs p-6 border border-border-subtle hover:border-action-primary/30 transition-colors">
                    <div className="flex items-center mb-4">
                      <div className="mr-4 bg-action-primary/10 p-3 rounded-lg text-action-primary">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">Direct Bank Transfers</h3>
                    </div>
                    <p className="text-muted text-sm leading-relaxed">
                      Available for high-value items, fine art, and commercial purchases. Wire processing typically clears within 1–3 business days.
                    </p>
                  </div>

                  {/* Settlement Safeguards */}
                  <div className="bg-surface rounded-xl shadow-warm-xs p-6 border border-border-subtle hover:border-action-primary/30 transition-colors">
                    <div className="flex items-center mb-4">
                      <div className="mr-4 bg-action-primary/10 p-3 rounded-lg text-action-primary">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">Settlement Safeguards</h3>
                    </div>
                    <p className="text-muted text-sm leading-relaxed">
                      State-machine holds for auction settlements. Winning bid funds are held safely until order confirmation before seller disbursement.
                    </p>
                  </div>
                </div>
              </div>

              {/* Currency Info */}
              <div className="bg-surface-subtle rounded-xl p-6 border border-border-subtle">
                <h3 className="text-lg font-semibold text-foreground mb-2">Currency Information</h3>
                <p className="text-muted text-sm mb-4">
                  Standard settlement on AuctionX is processed in Indian Rupees (INR, ₹). All bidding transactions, wallet balances, and payouts are handled natively in INR.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-surface p-2.5 rounded-lg border border-border-subtle text-center text-xs font-semibold text-foreground">INR (Default)</div>
                  <div className="bg-surface p-2.5 rounded-lg border border-border-subtle text-center text-xs font-medium text-foreground">EUR</div>
                  <div className="bg-surface p-2.5 rounded-lg border border-border-subtle text-center text-xs font-medium text-foreground">GBP</div>
                  <div className="bg-surface p-2.5 rounded-lg border border-border-subtle text-center text-xs font-medium text-foreground">CAD</div>
                </div>
              </div>

              {/* Security Banner */}
              <div className="bg-surface rounded-xl p-6 border border-action-primary/20 shadow-warm-xs">
                <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                  <span className="text-action-primary">🛡️</span> Payment Architecture &amp; Security
                </h3>
                <p className="text-muted text-sm mb-4">
                  Payment flows are architected with delegated gateway checkout (e.g. Razorpay sandbox). Sensitive cardholder credentials never touch or persist on AuctionX infrastructure, and webhooks are validated using HMAC-SHA256 signatures with idempotent deduplication.
                </p>
                <div className="flex flex-wrap gap-4 text-xs font-medium text-muted">
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <span className="w-2 h-2 rounded-full bg-status-success"></span> Delegated Gateway
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <span className="w-2 h-2 rounded-full bg-status-success"></span> HMAC-SHA256 Webhooks
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <span className="w-2 h-2 rounded-full bg-status-success"></span> Idempotent Deduplication
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Process Tab */}
          {activeTab === 'process' && (
            <div className="space-y-8">
              <h2 className="text-2xl font-bold font-display text-foreground mb-6">
                The Auction Checkout Workflow
              </h2>
              
              <div className="relative pl-6 sm:pl-8 border-l-2 border-border-subtle space-y-8">
                {/* Step 1 */}
                <div className="relative">
                  <div className="absolute -left-[33px] sm:-left-[41px] top-0 flex items-center justify-center w-8 h-8 rounded-full bg-action-primary text-white text-xs font-bold ring-4 ring-canvas">
                    1
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Winning Bid or Direct Purchase</h3>
                    <p className="text-muted text-sm mt-1">
                      When the countdown expires with your bid highest or you click "Buy It Now", the lot is reserved in your order dashboard.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="relative">
                  <div className="absolute -left-[33px] sm:-left-[41px] top-0 flex items-center justify-center w-8 h-8 rounded-full bg-action-primary text-white text-xs font-bold ring-4 ring-canvas">
                    2
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Secure Checkout & Address Selection</h3>
                    <p className="text-muted text-sm mt-1">
                      Proceed to checkout to confirm your delivery address, shipping option, and choose your payment method.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="relative">
                  <div className="absolute -left-[33px] sm:-left-[41px] top-0 flex items-center justify-center w-8 h-8 rounded-full bg-action-primary text-white text-xs font-bold ring-4 ring-canvas">
                    3
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Settlement Verification</h3>
                    <p className="text-muted text-sm mt-1">
                      Your payment is captured and validated through our settlement state machine. Both you and the seller receive instant order confirmations.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="relative">
                  <div className="absolute -left-[33px] sm:-left-[41px] top-0 flex items-center justify-center w-8 h-8 rounded-full bg-action-primary text-white text-xs font-bold ring-4 ring-canvas">
                    4
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Dispatch & Tracking</h3>
                    <p className="text-muted text-sm mt-1">
                      The verified seller dispatches your parcel within 48 hours and provides tracking updates through the portal.
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="relative">
                  <div className="absolute -left-[33px] sm:-left-[41px] top-0 flex items-center justify-center w-8 h-8 rounded-full bg-action-primary text-white text-xs font-bold ring-4 ring-canvas">
                    5
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Delivery Confirmation & Payout Release</h3>
                    <p className="text-muted text-sm mt-1">
                      Once delivery is verified, funds are disbursed to the seller balance. Invoices are stored in your profile history.
                    </p>
                  </div>
                </div>
              </div>

              {/* Roles Breakdown */}
              <div className="grid md:grid-cols-2 gap-6 pt-4">
                <div className="bg-surface rounded-xl p-6 border border-border-subtle">
                  <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="text-status-success">✓</span> Buyer Guidelines
                  </h3>
                  <ul className="space-y-2.5 text-sm text-muted">
                    <li className="flex items-start gap-2">
                      <span className="text-action-primary font-bold">•</span>
                      <span>Payment is requested within 48 hours of auction completion.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-action-primary font-bold">•</span>
                      <span>All final bid amounts include transparent marketplace fees.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-action-primary font-bold">•</span>
                      <span>Official PDF invoices are generated automatically in your orders view.</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-surface rounded-xl p-6 border border-border-subtle">
                  <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="text-status-success">✓</span> Seller Guidelines
                  </h3>
                  <ul className="space-y-2.5 text-sm text-muted">
                    <li className="flex items-start gap-2">
                      <span className="text-action-primary font-bold">•</span>
                      <span>Settlement safeguards hold funds securely until buyer order confirmation.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-action-primary font-bold">•</span>
                      <span>Standard seller commissions are clearly detailed prior to item listing.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-action-primary font-bold">•</span>
                      <span>Payouts can be withdrawn directly to verified bank accounts.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Table */}
              <div className="bg-surface rounded-xl border border-border-subtle overflow-hidden">
                <div className="p-4 bg-surface-subtle border-b border-border-subtle font-semibold text-foreground">
                  Typical Processing Windows
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle text-muted text-left">
                        <th className="py-3 px-6 font-medium">Method</th>
                        <th className="py-3 px-6 font-medium">Clearance Window</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle text-foreground">
                      <tr>
                        <td className="py-3 px-6 font-medium">Credit / Debit Cards</td>
                        <td className="py-3 px-6 text-muted">Instant</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-6 font-medium">PayPal & Digital Wallets</td>
                        <td className="py-3 px-6 text-muted">Instant</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-6 font-medium">Bank Wire Transfer</td>
                        <td className="py-3 px-6 text-muted">1–3 business days</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-6 font-medium">Settlement Disbursement to Seller</td>
                        <td className="py-3 px-6 text-muted">Upon carrier delivery confirmation</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Deposits & Withdrawals Tab */}
          {activeTab === 'deposits' && (
            <div className="space-y-8">
              <h2 className="text-2xl font-bold font-display text-foreground mb-6">
                Balance Deposits & Payouts
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-surface rounded-xl p-6 border border-border-subtle">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 rounded-lg bg-status-success/10 text-status-success">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Depositing Funds</h3>
                  </div>
                  <p className="text-muted text-sm mb-4 leading-relaxed">
                    Pre-funding your AuctionX balance allows you to place instant bids without re-authenticating card security codes during live high-speed countdowns.
                  </p>
                  <ul className="space-y-2 text-xs text-muted">
                    <li className="flex items-center gap-2">
                      <span className="text-action-primary">✓</span> Instant availability via cards or PayPal
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-action-primary">✓</span> No fee added by AuctionX for wallet top-ups
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-action-primary">✓</span> View balance in your account dashboard anytime
                    </li>
                  </ul>
                  <div className="mt-6">
                    <Link
                      to="/balance"
                      className="inline-flex items-center justify-center px-4 py-2 bg-action-primary hover:bg-action-primary-hover text-white text-xs font-semibold rounded-lg shadow-warm-xs transition-colors"
                    >
                      Manage Wallet Balance
                    </Link>
                  </div>
                </div>

                <div className="bg-surface rounded-xl p-6 border border-border-subtle">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 rounded-lg bg-action-primary/10 text-action-primary">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Withdrawing Earnings</h3>
                  </div>
                  <p className="text-muted text-sm mb-4 leading-relaxed">
                    Sellers and buyers can withdraw available settled funds directly to their verified local bank accounts or PayPal at any time.
                  </p>
                  <ul className="space-y-2 text-xs text-muted">
                    <li className="flex items-center gap-2">
                      <span className="text-action-primary">✓</span> Minimum withdrawal amount: ₹100
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-action-primary">✓</span> Processing timeline: 1–3 business days
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-action-primary">✓</span> Bank transfers verified via profile security verification
                    </li>
                  </ul>
                  <div className="mt-6">
                    <Link
                      to="/profile/myprofile"
                      className="inline-flex items-center justify-center px-4 py-2 border border-border-subtle bg-surface-subtle hover:bg-surface text-foreground text-xs font-semibold rounded-lg transition-colors"
                    >
                      View Profile & Banking
                    </Link>
                  </div>
                </div>
              </div>

              {/* Limits Table */}
              <div className="bg-surface rounded-xl border border-border-subtle overflow-hidden">
                <div className="p-4 bg-surface-subtle border-b border-border-subtle font-semibold text-foreground">
                  Marketplace Transaction Thresholds
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle text-muted text-left">
                        <th className="py-3 px-6 font-medium">Transaction Type</th>
                        <th className="py-3 px-6 font-medium">Standard Limit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle text-foreground">
                      <tr>
                        <td className="py-3 px-6 font-medium">Daily Deposit Threshold</td>
                        <td className="py-3 px-6 text-muted">₹1,00,000</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-6 font-medium">Daily Withdrawal Threshold</td>
                        <td className="py-3 px-6 text-muted">₹50,000</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-6 font-medium">Monthly Deposit Threshold</td>
                        <td className="py-3 px-6 text-muted">₹5,00,000</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-6 font-medium">Monthly Withdrawal Threshold</td>
                        <td className="py-3 px-6 text-muted">₹2,50,000</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* FAQs Tab */}
          {activeTab === 'faq' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold font-display text-foreground mb-6">
                Payment Questions & Answers
              </h2>

              {[
                {
                  id: 'faq1',
                  q: 'What payment methods can I use to bid on AuctionX?',
                  a: 'We accept credit/debit cards, UPI, and net banking via Razorpay, as well as wallet balance.',
                },
                {
                  id: 'faq2',
                  q: 'Are there hidden buyer transaction fees?',
                  a: 'No hidden fees. Every auction card clearly specifies the bid increment, shipping estimates, and any applicable sales tax prior to placing your bid.',
                },
                {
                  id: 'faq3',
                  q: 'How do buyer settlement safeguards work?',
                  a: 'When you win, payment is recorded through an atomic settlement state machine. Disbursements are released to the seller only after order confirmation.',
                },
                {
                  id: 'faq4',
                  q: 'How quickly do seller payouts process?',
                  a: 'Once an order is confirmed delivered, the proceeds are credited to your seller balance. Withdrawals to PayPal or bank wire take 1–3 business days.',
                },
              ].map((faq) => {
                const isOpen = activeAccordion === faq.id;
                return (
                  <div
                    key={faq.id}
                    className="bg-surface rounded-xl border border-border-subtle overflow-hidden shadow-warm-xs"
                  >
                    <button
                      type="button"
                      onClick={() => toggleAccordion(faq.id)}
                      className="w-full flex justify-between items-center p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-action-primary rounded-xl"
                      aria-expanded={isOpen}
                    >
                      <span className="font-semibold text-foreground text-sm sm:text-base">
                        {faq.q}
                      </span>
                      <svg
                        className={`h-5 w-5 text-muted transform transition-transform duration-200 shrink-0 ml-4 ${
                          isOpen ? 'rotate-180 text-action-primary' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-sm text-muted leading-relaxed border-t border-border-subtle pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Support CTA */}
        <div className="bg-surface-dark text-foreground-inverse rounded-2xl p-8 text-center shadow-warm-md">
          <h3 className="text-xl sm:text-2xl font-bold font-display mb-2">
            Have questions about a specific payment or invoice?
          </h3>
          <p className="text-muted text-sm sm:text-base max-w-xl mx-auto mb-6">
            Our support desk is available to assist with billing disputes, bank wire inquiries, and settlement verifications.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center px-6 py-2.5 bg-action-primary hover:bg-action-primary-hover text-white font-medium text-sm rounded-lg shadow-warm-xs transition-colors"
            >
              Contact Support
            </Link>
            <Link
              to="/faq"
              className="inline-flex items-center justify-center px-6 py-2.5 bg-surface text-foreground font-medium text-sm rounded-lg shadow-warm-xs hover:bg-surface-subtle transition-colors"
            >
              Browse General FAQs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;