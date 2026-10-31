/**
 * AuctionX Knowledge Base
 *
 * Curated domain knowledge used to ground the AI assistant.
 * Each entry contains a topic, keywords for matching, content for context injection,
 * and optional navigation actions.
 *
 * This is the single source of truth for what the assistant "knows" about AuctionX
 * beyond the FAQ collection in MongoDB.
 */

const NAVIGATION_ACTIONS = {
  HOME: { type: "navigate", path: "/", label: "Go to Home" },
  LOGIN: { type: "navigate", path: "/login", label: "Sign In" },
  REGISTER: { type: "navigate", path: "/login", label: "Create Account" },
  PROFILE: { type: "navigate", path: "/profile/myprofile", label: "View Profile" },
  MY_ORDERS: { type: "navigate", path: "/profile/orders", label: "View My Orders" },
  SETTINGS: { type: "navigate", path: "/profilesettings", label: "Account Settings" },
  SELLER_DASHBOARD: { type: "navigate", path: "/seller/dashboard", label: "Seller Dashboard" },
  SELL_ITEM: { type: "navigate", path: "/seller/dashboard/sell", label: "Sell an Item" },
  MY_BIDS: { type: "navigate", path: "/scheduledbids", label: "My Scheduled Bids" },
  ABOUT_US: { type: "navigate", path: "/about", label: "About AuctionX" },
  CONTACT: { type: "navigate", path: "/contact", label: "Contact Support" },
  PRIVACY: { type: "navigate", path: "/privacy", label: "Privacy Policy" },
  FEEDBACK: { type: "navigate", path: "/feedback", label: "Submit Feedback" },
};

// Allowlist of valid navigation paths (server-side validation)
const ALLOWED_NAVIGATION_PATHS = new Set(
  Object.values(NAVIGATION_ACTIONS).map((a) => a.path)
);

const knowledgeEntries = [
  // ─── PLATFORM OVERVIEW ───
  {
    topic: "What is AuctionX",
    keywords: ["auctionx", "what is", "platform", "about", "overview", "introduction"],
    content:
      "AuctionX is a premier online auction marketplace that connects buyers and sellers through real-time live bidding and scheduled auctions. The platform features AI-powered product recommendations, secure payment processing via Razorpay, real-time bidding with Socket.io, and a comprehensive seller dashboard. AuctionX supports both live auctions (bid in real-time) and scheduled auctions (set a future bid time).",
    actions: [NAVIGATION_ACTIONS.ABOUT_US],
  },
  {
    topic: "Key features",
    keywords: ["features", "capabilities", "what can", "offer", "highlights"],
    content:
      "AuctionX key features include: (1) Real-time live bidding with instant updates, (2) Scheduled/automatic bidding for upcoming auctions, (3) AI-powered product recommendations personalized to your interests, (4) Secure payments via Razorpay with wallet support, (5) Comprehensive seller dashboard with analytics, (6) Product feedback and rating system, (7) Dark/light theme with sound effects, (8) Google OAuth and email/password authentication, (9) Admin moderation and dispute resolution, (10) Mobile-responsive design.",
    actions: [NAVIGATION_ACTIONS.HOME],
  },

  // ─── BIDDING ───
  {
    topic: "How to place a bid",
    keywords: ["bid", "place bid", "how to bid", "bidding", "make a bid", "start bidding"],
    content:
      "To place a bid on AuctionX: (1) Browse active auctions on the home page, (2) Click on a product to view its details, (3) Enter your bid amount (must be at least ₹50 above the current highest bid, or the starting price if no bids exist), (4) Click 'Place Bid' to submit. Your bid is processed in real-time via WebSocket. You'll receive instant notifications if you're outbid.",
    actions: [NAVIGATION_ACTIONS.HOME],
  },
  {
    topic: "Scheduled bidding",
    keywords: ["schedule bid", "scheduled", "automatic bid", "future bid", "auto bid", "advance bid"],
    content:
      "AuctionX allows you to schedule bids in advance for upcoming auctions. On any active or upcoming product detail page, click 'Schedule Bid', set your maximum bid amount and the time you want it placed. The system will automatically place your bid at the designated time. You can manage all your scheduled bids from Profile → Scheduled Bids.",
    actions: [NAVIGATION_ACTIONS.MY_BIDS],
  },
  {
    topic: "Bid rules and restrictions",
    keywords: ["bid rules", "minimum bid", "bid increment", "can't bid", "bid restrictions", "bid cancel"],
    content:
      "AuctionX bidding rules: (1) Minimum bid increment is ₹50 above the current highest bid, (2) Once placed, bids CANNOT be cancelled or withdrawn, (3) You cannot bid on your own items, (4) Your account must be verified to place bids, (5) Bids are final and binding — if you win, you must complete payment within 24 hours.",
    actions: [],
  },

  // ─── PAYMENTS & ORDERS ───
  {
    topic: "Payment methods",
    keywords: ["payment", "pay", "razorpay", "wallet", "checkout", "how to pay"],
    content:
      "AuctionX supports secure payments through Razorpay, including UPI, credit/debit cards, net banking, and wallets. All transactions use end-to-end encryption. When you win an auction, you have a 24-hour settlement window to complete your payment through the checkout flow in My Orders.",
    actions: [NAVIGATION_ACTIONS.MY_ORDERS],
  },
  {
    topic: "Order history and won items",
    keywords: ["orders", "my orders", "won items", "order history", "purchases", "won auction"],
    content:
      "To view items you've won or purchased: Go to your Profile → My Orders. This page shows all your auction wins, payment status, shipping details, and order tracking. You can complete pending payments and view detailed order information from here.",
    actions: [NAVIGATION_ACTIONS.MY_ORDERS],
  },
  {
    topic: "Settlement and payment window",
    keywords: ["settlement", "payment deadline", "24 hours", "payment window", "time to pay"],
    content:
      "After winning an auction, you have a strict 24-hour settlement window to complete checkout. If payment is not completed within this window, the win may be forfeited and the item may be re-listed. Go to Profile → My Orders to complete pending payments.",
    actions: [NAVIGATION_ACTIONS.MY_ORDERS],
  },

  // ─── ACCOUNT & PROFILE ───
  {
    topic: "Account creation and registration",
    keywords: ["register", "sign up", "create account", "new account", "join", "registration"],
    content:
      "To create an AuctionX account: (1) Click 'Sign Up' on the login page, (2) Enter your name, email, and password (or use Google Sign-In), (3) Verify your email via OTP, (4) Complete your profile with country and preferences. Both buyer and seller accounts are available.",
    actions: [NAVIGATION_ACTIONS.REGISTER],
  },
  {
    topic: "Login and authentication",
    keywords: ["login", "sign in", "log in", "can't login", "forgot password", "google login", "password"],
    content:
      "AuctionX supports email/password login and Google OAuth. If you forgot your password, use the 'Forgot Password' link on the login page to reset it via email OTP. For security, AuctionX uses httpOnly cookies for session management with CSRF protection.",
    actions: [NAVIGATION_ACTIONS.LOGIN],
  },
  {
    topic: "Profile management",
    keywords: ["profile", "edit profile", "update profile", "avatar", "profile picture", "account settings"],
    content:
      "Manage your profile from Profile → Settings. You can update your display name, avatar/profile picture, country, and password. AuctionX offers a custom avatar selector with multiple preset options, or you can upload your own image.",
    actions: [NAVIGATION_ACTIONS.SETTINGS],
  },

  // ─── SELLER ───
  {
    topic: "Becoming a seller",
    keywords: ["become seller", "sell items", "start selling", "seller account", "list item", "sell"],
    content:
      "To sell on AuctionX: (1) Register or switch to a Seller account, (2) Complete seller verification, (3) Go to Seller Dashboard → Sell an Item, (4) Fill in product details (title, description, category, starting price, images, auction dates), (5) Submit for listing. Your items will appear in the marketplace once approved.",
    actions: [NAVIGATION_ACTIONS.SELL_ITEM],
  },
  {
    topic: "Seller dashboard",
    keywords: ["seller dashboard", "seller analytics", "revenue", "seller orders", "manage products"],
    content:
      "The Seller Dashboard provides comprehensive tools: (1) Order & Revenue analytics, (2) Pending Bids management, (3) Custom Auction creation, (4) Product listing management, (5) Subscription management, (6) Feedback from buyers, (7) Account settings. Access it from your profile menu.",
    actions: [NAVIGATION_ACTIONS.SELLER_DASHBOARD],
  },
  {
    topic: "Seller subscriptions",
    keywords: ["subscription", "seller plan", "premium seller", "seller subscription"],
    content:
      "AuctionX offers seller subscription plans with premium features like enhanced listing visibility, priority support, advanced analytics, and higher product listing limits. Manage your subscription from Seller Dashboard → Subscriptions.",
    actions: [NAVIGATION_ACTIONS.SELLER_DASHBOARD],
  },

  // ─── SECURITY & PRIVACY ───
  {
    topic: "Account security",
    keywords: ["security", "secure", "safe", "hacked", "suspicious", "protection"],
    content:
      "AuctionX protects your account with: JWT-based authentication with httpOnly cookies, CSRF protection on all state-changing requests, MongoDB sanitization against injection attacks, account suspension detection, and automatic session expiry. If you notice suspicious activity, change your password immediately and contact support.",
    actions: [NAVIGATION_ACTIONS.SETTINGS],
  },
  {
    topic: "Privacy and data protection",
    keywords: ["privacy", "data", "personal information", "gdpr", "delete data", "data request"],
    content:
      "AuctionX takes privacy seriously. You can submit privacy requests (data access, deletion, etc.) from the Privacy Policy page. Your personal data is never sold to third parties. All financial data is encrypted. Chat conversations auto-expire after 30 days.",
    actions: [NAVIGATION_ACTIONS.PRIVACY],
  },

  // ─── SUPPORT ───
  {
    topic: "Contacting support",
    keywords: ["support", "help", "contact", "customer service", "assistance", "issue", "problem"],
    content:
      "For additional help beyond this assistant: (1) Use the Contact Us form to submit a support ticket, (2) Submit product-specific feedback on product pages, (3) Use the general Feedback form for platform suggestions. Our support team responds within 24-48 hours.",
    actions: [NAVIGATION_ACTIONS.CONTACT],
  },
  {
    topic: "Dispute resolution",
    keywords: ["dispute", "complaint", "refund", "problem with order", "issue with seller"],
    content:
      "If you have a dispute with a transaction: (1) First try to resolve it through the order details page, (2) If unresolved, contact support via the Contact Us form with your order ID, (3) Admin moderators will review and mediate the dispute. AuctionX has a dedicated dispute resolution system.",
    actions: [NAVIGATION_ACTIONS.CONTACT],
  },

  // ─── RECOMMENDATIONS ───
  {
    topic: "AI Recommendations",
    keywords: ["recommendations", "suggested", "for you", "personalized", "ai suggestions"],
    content:
      "AuctionX uses an AI-powered recommendation engine to suggest products based on your browsing history, bidding patterns, and preferences. Recommendations appear on the home page and are updated in real-time. The more you interact with the platform, the more personalized your suggestions become.",
    actions: [NAVIGATION_ACTIONS.HOME],
  },

  // ─── NAVIGATION HELP ───
  {
    topic: "Where to find things",
    keywords: ["where", "find", "navigate", "go to", "how to access", "location", "page"],
    content:
      "Key AuctionX pages: Home (browse auctions), Profile (account info), My Orders (won items & payments), Scheduled Bids (manage auto-bids), Seller Dashboard (for sellers), Settings (profile & password), Contact (support), About (company info), Privacy (data policy), Feedback (suggestions).",
    actions: [NAVIGATION_ACTIONS.HOME],
  },
];

/**
 * Search the knowledge base for entries matching the user's query.
 * Returns the top N matching entries sorted by relevance score.
 *
 * @param {string} query - The user's question
 * @param {number} topN - Max number of results to return (default 3)
 * @returns {Array<{topic: string, content: string, actions: Array, score: number}>}
 */
function searchKnowledgeBase(query, topN = 3) {
  if (!query || typeof query !== "string") return [];

  const queryLower = query.toLowerCase();
  const queryWords = new Set(
    queryLower
      .split(/\s+/)
      .filter((w) => w.length > 2) // Skip very short words
  );

  const scored = knowledgeEntries.map((entry) => {
    let score = 0;

    // Keyword match scoring
    for (const keyword of entry.keywords) {
      if (queryLower.includes(keyword)) {
        score += 3; // Direct keyword match
      } else {
        // Partial word overlap
        const kwWords = keyword.split(/\s+/);
        for (const kwWord of kwWords) {
          if (queryWords.has(kwWord)) {
            score += 1;
          }
        }
      }
    }

    // Topic match bonus
    if (queryLower.includes(entry.topic.toLowerCase())) {
      score += 5;
    }

    return { ...entry, score };
  });

  return scored
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/**
 * Validate that a navigation path is in the allowlist.
 * @param {string} path
 * @returns {boolean}
 */
function isAllowedNavigation(path) {
  return ALLOWED_NAVIGATION_PATHS.has(path);
}

module.exports = {
  searchKnowledgeBase,
  isAllowedNavigation,
  NAVIGATION_ACTIONS,
  ALLOWED_NAVIGATION_PATHS,
  knowledgeEntries,
};
