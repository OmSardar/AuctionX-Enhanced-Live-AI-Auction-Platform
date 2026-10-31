import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useThemeProvider } from "../../../../AdminDashboard/utils/ThemeContext";

const TermsAndCondition = () => {
  const navigate = useNavigate();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { currentTheme } = useThemeProvider();
  
  const handleAccept = () => {
    setAcceptedTerms(true);
    toast.success('Terms and Conditions accepted!');
  };
  
  return (
    <div className="w-full min-h-screen bg-canvas text-foreground py-20 transition-colors duration-200">
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Title */}
        <div className="mb-8 text-center sm:text-left">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Terms and Conditions
          </h1>
          <p className="mt-2 text-sm text-foreground-secondary">
            AuctionX Demonstration Platform User Agreement &amp; Operating Policies
          </p>
        </div>

        <div className="bg-surface border border-border-subtle rounded-xl shadow-warm-lg overflow-hidden transition-colors">
          {/* Terms Header */}
          <div className="px-6 py-5 border-b border-border-subtle bg-surface-subtle">
            <h2 className="text-lg font-bold text-action-primary">
              AuctionX User Agreement
            </h2>
            <p className="mt-1 text-xs text-foreground-secondary">
              Last updated: October 2026
            </p>
          </div>
          
          {/* Terms Content - Scrollable Area */}
          <div className="px-4 py-5 sm:p-6 max-h-96 overflow-y-auto">
            <div className="prose max-w-none">
              <h3 className={`text-lg font-medium transition-colors ${
                currentTheme === 'dark' ? 'text-purple-300' : 'text-purple-700'
              }`}>
                1. Introduction &amp; Demonstration Scope
              </h3>
              <p className={`mt-2 transition-colors ${
                currentTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Welcome to AuctionX. AuctionX is a software engineering demonstration and technical portfolio project built to showcase real-time bidding, payment workflows, and distributed microservices. These Terms and Conditions describe the operational rules and invariants of the demonstration platform. Real-world financial guarantees or commercial fulfillment are not provided.
              </p>
              
              <h3 className={`mt-6 text-lg font-medium transition-colors ${
                currentTheme === 'dark' ? 'text-purple-300' : 'text-purple-700'
              }`}>
                2. Definitions
              </h3>
              <p className={`mt-2 transition-colors ${
                currentTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                "AuctionX", "we", "us" or "our" refers to AuctionX, the project demonstration platform.
                "User", "you", and "your" refers to the person accessing or using our auction services.
                "Service" refers to the website, application, or any other auction service provided by us.
                "Listing" refers to any item or service placed for auction on our platform.
              </p>
              
              <h3 className={`mt-6 text-lg font-medium transition-colors ${
                currentTheme === 'dark' ? 'text-purple-300' : 'text-purple-700'
              }`}>
                3. Auction Participation
              </h3>
              <p className={`mt-2 transition-colors ${
                currentTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                By participating in auctions on our platform, you are making a binding offer to purchase the item at the bid price.
                If you are the winning bidder, you are obligated to complete the purchase of the item. Failure to complete a purchase
                may result in penalties including account suspension.
              </p>
              
              <h3 className={`mt-6 text-lg font-medium transition-colors ${
                currentTheme === 'dark' ? 'text-purple-300' : 'text-purple-700'
              }`}>
                4. Eligibility
              </h3>
              <p className={`mt-2 transition-colors ${
                currentTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                You must be at least 18 years old to use Auction X services. By using our services, you represent and warrant that you are at least 18 years old.
                If you are accessing our services on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms.
              </p>
              
              <h3 className={`mt-6 text-lg font-medium transition-colors ${
                currentTheme === 'dark' ? 'text-purple-300' : 'text-purple-700'
              }`}>
                5. User Accounts
              </h3>
              <p className={`mt-2 transition-colors ${
                currentTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                To participate in auctions, you must create an account. You are responsible for maintaining the confidentiality of your account credentials.
                You are also responsible for all bidding activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
              </p>
              
              <h3 className={`mt-6 text-lg font-medium transition-colors ${
                currentTheme === 'dark' ? 'text-purple-300' : 'text-purple-700'
              }`}>
                6. Bidding and Payments
              </h3>
              <p className={`mt-2 transition-colors ${
                currentTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                All bids are binding commitments to purchase items at the bid price. Auction X does not permit retractions of bids except in exceptional circumstances.
                Payment methods accepted include credit/debit cards, PayPal, and bank transfers. All payments must be completed within 48 hours of auction end.
              </p>
              
              <h3 className={`mt-6 text-lg font-medium transition-colors ${
                currentTheme === 'dark' ? 'text-purple-300' : 'text-purple-700'
              }`}>
                7. Seller Obligations
              </h3>
              <p className={`mt-2 transition-colors ${
                currentTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Sellers must accurately describe all items listed for auction. Misrepresentation of items may result in transaction reversal and account penalties.
                Sellers are responsible for shipping items to buyers within 5 business days of receiving payment, unless otherwise specified in the listing.
              </p>
              
              <h3 className={`mt-6 text-lg font-medium transition-colors ${
                currentTheme === 'dark' ? 'text-purple-300' : 'text-purple-700'
              }`}>
                8. Fees and Commissions
              </h3>
              <p className={`mt-2 transition-colors ${
                currentTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Auction X charges sellers a commission on successful sales. The commission rate is based on the final sale price and category of the item.
                Additional listing fees and promotional options may apply. All fees are clearly displayed before listing an item.
              </p>
              
              <h3 className={`mt-6 text-lg font-medium transition-colors ${
                currentTheme === 'dark' ? 'text-purple-300' : 'text-purple-700'
              }`}>
                9. Prohibited Items
              </h3>
              <p className={`mt-2 transition-colors ${
                currentTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Certain items are prohibited from being listed on Auction X, including but not limited to: illegal goods, counterfeit items,
                hazardous materials, human remains, and items that infringe on intellectual property rights. Auction X reserves the right to remove
                any listing that violates these policies.
              </p>
              
              <h3 className={`mt-6 text-lg font-medium transition-colors ${
                currentTheme === 'dark' ? 'text-purple-300' : 'text-purple-700'
              }`}>
                10. Dispute Resolution
              </h3>
              <p className={`mt-2 transition-colors ${
                currentTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                In the event of a dispute between buyers and sellers, Auction X provides a resolution process. Users agree to attempt to resolve disputes
                through our platform before pursuing external remedies. Auction X may mediate disputes and make final decisions regarding refunds or transaction reversals.
              </p>
            </div>
          </div>
          
          {/* Action Footer */}
          <div className="px-6 py-4 border-t border-border-subtle bg-surface-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors">
            <div className="flex items-center">
              <input 
                id="accept-terms" 
                name="accept-terms" 
                type="checkbox" 
                className="h-4 w-4 text-action-primary border-border-subtle rounded focus:ring-ring-focus cursor-pointer"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <label htmlFor="accept-terms" className="ml-2 block text-sm text-foreground cursor-pointer">
                I have read and agree to the Auction X Terms and Conditions
              </label>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button 
                type="button" 
                onClick={() => navigate(-1)}
                className="w-full sm:w-auto inline-flex justify-center items-center rounded-lg border border-border-subtle shadow-xs px-4 py-2 text-sm font-medium bg-surface text-foreground hover:bg-surface-subtle transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
              >
                Decline
              </button>
              <button 
                type="button" 
                className="w-full sm:w-auto inline-flex justify-center items-center rounded-lg shadow-xs px-5 py-2 bg-action-primary hover:bg-action-primary-hover text-sm font-semibold text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!acceptedTerms}
                onClick={handleAccept}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndCondition;