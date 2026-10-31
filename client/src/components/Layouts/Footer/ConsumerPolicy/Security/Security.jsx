import React from 'react';
import { useThemeProvider } from '../../../../AdminDashboard/utils/ThemeContext';

const Security = () => {
  return (
    <div className="min-h-screen bg-canvas text-foreground mt-20 transition-colors duration-200">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">Security at AuctionX</h1>
          <p className="text-base sm:text-lg text-foreground-secondary max-w-xl mx-auto">
            Engineered with defense-in-depth architecture, session integrity, and input sanitization
          </p>
        </div>

        {/* Main content */}
        <div className="space-y-10">
          {/* Introduction */}
          <div className="bg-surface rounded-xl p-6 border border-border-subtle shadow-xs">
            <h2 className="text-xl font-bold text-action-primary mb-2">Engineering &amp; Security Architecture</h2>
            <p className="text-foreground-secondary leading-relaxed mb-0">
              AuctionX is an advanced full-stack demonstration platform showcasing modern web security patterns, including double-submit CSRF cookie protection, role-based access control (RBAC), in-process media decoding and sanitization, and strict rate limiting.
            </p>
          </div>

          {/* How We Protect You Section */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">How We Protect You</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-surface rounded-xl shadow-xs p-6 border border-border-subtle">
                <div className="flex items-start mb-4">
                  <div className="shrink-0 bg-action-primary/10 rounded-xl p-3 mr-4">
                    <svg className="h-6 w-6 text-action-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mt-1">Secure Transactions</h3>
                </div>
                <p className="text-sm text-foreground-secondary leading-relaxed mb-0">
                  All financial transactions are processed through our secure payment gateway with end-to-end encryption. 
                  We never store your complete credit card information on our servers.
                </p>
              </div>

              <div className="bg-surface rounded-xl shadow-xs p-6 border border-border-subtle">
                <div className="flex items-start mb-4">
                  <div className="shrink-0 bg-action-primary/10 rounded-xl p-3 mr-4">
                    <svg className="h-6 w-6 text-action-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mt-1">Account Protection</h3>
                </div>
                <p className="text-sm text-foreground-secondary leading-relaxed mb-0">
                  We offer multi-factor authentication, account activity monitoring, and suspicious login detection 
                  to prevent unauthorized access to your account.
                </p>
              </div>

              <div className="bg-surface rounded-xl shadow-xs p-6 border border-border-subtle">
                <div className="flex items-start mb-4">
                  <div className="shrink-0 bg-action-primary/10 rounded-xl p-3 mr-4">
                    <svg className="h-6 w-6 text-action-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mt-1">Privacy Protection</h3>
                </div>
                <p className="text-sm text-foreground-secondary leading-relaxed mb-0">
                  Your personal information is safeguarded with strict access controls. We never sell your data to third parties 
                  and only share information when necessary to complete transactions.
                </p>
              </div>

              <div className="bg-surface rounded-xl shadow-xs p-6 border border-border-subtle">
                <div className="flex items-start mb-4">
                  <div className="shrink-0 bg-action-primary/10 rounded-xl p-3 mr-4">
                    <svg className="h-6 w-6 text-action-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mt-1">Fraud Prevention</h3>
                </div>
                <p className="text-sm text-foreground-secondary leading-relaxed mb-0">
                  Our dedicated fraud detection algorithms identify and prevent suspicious activities, 
                  protecting both buyers and sellers from scams and shill bidding.
                </p>
              </div>
            </div>
          </div>

          {/* Buyer & Seller Protection */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Buyer & Seller Protection</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-surface rounded-xl shadow-xs p-6 border border-border-subtle">
                <h3 className="text-lg font-semibold text-action-primary border-b border-border-subtle pb-3 mb-4">For Buyers</h3>
                <ul className="list-disc pl-5 space-y-2 text-sm text-foreground-secondary">
                  <li>Money-back guarantee for items not matching verified condition</li>
                  <li>Settlement safeguard holds for auction transactions</li>
                  <li>Verified seller ratings and authenticity review history</li>
                  <li>Real-time transaction dispute assistance</li>
                  <li>Secure in-platform communication to protect credentials</li>
                </ul>
              </div>

              <div className="bg-surface rounded-xl shadow-xs p-6 border border-border-subtle">
                <h3 className="text-lg font-semibold text-action-primary border-b border-border-subtle pb-3 mb-4">For Sellers</h3>
                <ul className="list-disc pl-5 space-y-2 text-sm text-foreground-secondary">
                  <li>Protection against fraudulent chargebacks and non-paying bidders</li>
                  <li>Pre-verified buyer profiles and guaranteed wallet authorization</li>
                  <li>Objective dispute mediation team</li>
                  <li>Identity checks for high-value item purchasers</li>
                  <li>Tracked shipping integration and courier protection</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Security Tips */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Security Best Practices</h2>
            
            <div className="bg-surface rounded-xl p-6 border border-border-subtle shadow-xs">
              <h3 className="text-lg font-semibold text-action-primary mb-4">Tips to Keep Your Account Secure</h3>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="shrink-0 text-action-primary mr-3 mt-0.5">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-foreground-secondary mb-0">Use a strong, unique password for your AuctionX account</p>
                </div>
                
                <div className="flex items-start">
                  <div className="shrink-0 text-action-primary mr-3 mt-0.5">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-foreground-secondary mb-0">Enable two-factor authentication for an additional layer of security</p>
                </div>
                
                <div className="flex items-start">
                  <div className="shrink-0 text-action-primary mr-3 mt-0.5">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-foreground-secondary mb-0">Never share your login credentials or OTP codes with anyone</p>
                </div>
                
                <div className="flex items-start">
                  <div className="shrink-0 text-action-primary mr-3 mt-0.5">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-foreground-secondary mb-0">Be cautious of phishing attempts - AuctionX never requests your password by email</p>
                </div>
              </div>
            </div>
          </div>

          {/* Report Security Issues */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Report Security Issues</h2>
            
            <div className="bg-surface rounded-xl shadow-xs p-6 border border-border-subtle">
              <p className="text-sm text-foreground-secondary mb-6 leading-relaxed">
                Notice something suspicious or discover a potential vulnerability? We take all security disclosures seriously.
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-surface-subtle p-5 rounded-xl border border-border-subtle">
                  <h4 className="font-semibold text-foreground mb-1">Contact Our Security Team</h4>
                  <p className="text-xs text-foreground-secondary mb-3">Email us directly with full incident details:</p>
                  <a href="mailto:security@auctionx.com" className="inline-flex items-center text-sm text-action-primary font-medium hover:underline">
                    <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                    security@auctionx.com
                  </a>
                </div>
                
                <div className="bg-surface-subtle p-5 rounded-xl border border-border-subtle">
                  <h4 className="font-semibold text-foreground mb-1">Bug Bounty Disclosures</h4>
                  <p className="text-xs text-foreground-secondary mb-3">Report responsible vulnerability discoveries:</p>
                  <a href="mailto:security@auctionx.com?subject=Bug%20Bounty%20Vulnerability%20Report" className="inline-flex items-center text-sm text-action-primary font-medium hover:underline">
                    <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Submit Vulnerability Report
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Security;