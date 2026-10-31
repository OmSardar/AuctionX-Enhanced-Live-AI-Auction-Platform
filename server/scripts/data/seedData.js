const FAQ = require('../../src/modules/communication/models/FaqChat');

const initialFAQs = [
  {
    question: "How do I bid?",
    answer: "Click on 'Place Bid' and enter your amount.",
    category: "Bidding",
    tags: ["bidding", "process"]
  },
  {
    question: "What happens if I win?",
    answer: "You will receive shipping details.",
    category: "Bidding",
    tags: ["shipping", "winning"]
  },
  {
    question: "Can I cancel my bid?",
    answer: "No, once placed, bids cannot be canceled.",
    category: "Bidding",
    tags: ["cancellation", "rules"]
  },
  {
    question: "Do you offer technical support?",
    answer: "Yes, we provide 24/7 technical support. Contact us anytime for assistance.",
    category: "Support",
    tags: ["help", "assistance"]
  },
  {
    question: "How are transactions secured?",
    answer: "All financial transactions are processed through our secure payment gateway with end-to-end encryption. We never store your complete credit card information on our servers.",
    category: "Security",
    tags: ["payments", "encryption"]
  },
  {
    question: "How is my account protected?",
    answer: "We offer multi-factor authentication, account activity monitoring, and suspicious login detection to prevent unauthorized access to your account.",
    category: "Security",
    tags: ["account", "protection"]
  },
  {
    question: "How is my privacy protected?",
    answer: "Your personal information is safeguarded with strict access controls. We never sell your data to third parties and only share information when necessary to complete transactions.",
    category: "Privacy",
    tags: ["data", "protection"]
  },
  {
    question: "How do you prevent fraud?",
    answer: "Our dedicated fraud detection team uses advanced algorithms to identify and prevent suspicious activities, protecting both buyers and sellers from scams.",
    category: "Security",
    tags: ["fraud", "protection"]
  },
  {
    "question": "How to login?",
    "answer": "Use email or Google to log in.",
    "category": "Authentication",
    "tags": ["login", "authentication"]
  },
  {
    "question": "Who are you?",
    "answer": "I am your assistant Lucy. What can I help you with?",
    "category": "General",
    "tags": ["assistant", "identity"]
  },
  {
    "question": "How's the day?",
    "answer": "It's going great! How about yours?",
    "category": "Casual",
    "tags": ["day", "mood", "conversation"]
  },
  {
    "question": "How are you doing?",
    "answer": "I'm doing well! Thanks for asking. How about you?",
    "category": "Casual",
    "tags": ["well-being", "mood", "conversation"]
  },
  {
    "question": "What's up?",
    "answer": "Not much! Just here to help. What’s on your mind?",
    "category": "Casual",
    "tags": ["chat", "conversation", "friendly"]
  },
  {
    "question": "Do you have feelings?",
    "answer": "I don't have feelings like humans, but I’m here to make your day better!",
    "category": "General",
    "tags": ["AI", "emotions", "conversation"]
  },
  {
    "question": "Tell me a joke!",
    "answer": "Sure! Why don’t skeletons fight each other? Because they don’t have the guts!",
    "category": "Casual",
    "tags": ["joke", "fun", "humor"]
  },
  {
    "question": "What’s your favorite color?",
    "answer": "I like all colors! But if I had to choose, maybe blue—it’s calming.",
    "category": "Casual",
    "tags": ["color", "preference", "fun"]
  },
  {
    "question": "Do you sleep?",
    "answer": "Nope! I’m always awake and ready to assist you.",
    "category": "General",
    "tags": ["AI", "sleep", "fun"]
  },
  {
    "question": "Can you be my friend?",
    "answer": "Of course! I'm always here for a chat whenever you need.",
    "category": "Casual",
    "tags": ["friend", "chat", "friendly"]
  },
  {
    "question": "Do you like music?",
    "answer": "I can't listen to music, but I’d love to hear what you’re into!",
    "category": "Casual",
    "tags": ["music", "preference", "chat"]
  }, 
  {
    question: "What payment method is used?",
    answer: "We use Razorpay for all transactions.",
    category: "Payments",
    tags: ["payment", "methods"]
  },
  {
    question: "How can I withdraw money?",
    answer: "Click on the 'Switch to Withdraw Money' button on the payment page below your available balance.",
    category: "Payments",
    tags: ["withdrawal", "money"]
  },
  {
    question: "Can I download an item receipt?",
    answer: "Yes, go to your profile, click on 'My Bids,' and select your orders. Click on 'View Details' to see and download the invoice.",
    category: "Orders",
    tags: ["receipt", "invoice"]
  },
  {
    question: "How do I edit my user details?",
    answer: "Go to 'Profile Settings' on your profile page.",
    category: "Accounts",
    tags: ["profile", "settings"]
  },
  {
    question: "How can I contact you?",
    answer: "Visit the 'Contact Us' page at the bottom of the website, or reach us at auctionxofficial@gmail.com or call 6290613849.",
    category: "Support",
    tags: ["contact", "help"]
  },
  {
    question: "Where can I get help?",
    answer: "Go to your profile, click on 'Help and Support,' then navigate to 'Contact Support' to submit your query. We will respond to your email within 24 hours on working days (Monday to Friday).",
    category: "Support",
    tags: ["help", "assistance"]
  },
  {
    question: "Do you provide a return policy?",
    answer: "No, as per our website rules, once you win a bid, there is no return or refund of the product or money.",
    category: "Policies",
    tags: ["returns", "refunds"]
  },
  {
    question: "What is the minimum balance that can be added?",
    answer: "The minimum amount you can add is ₹500.",
    category: "Payments",
    tags: ["minimum", "deposit"]
  },
  {
    question: "How can I raise a privacy-related issue?",
    answer: "Go to the 'Privacy' page at the bottom of the website, scroll down to find 'Privacy Request,' click on 'Submit Privacy Request,' enter your privacy-related issue, and submit. Our support team will contact you within 24 working hours.",
    category: "Privacy",
    tags: ["request", "support"]
  },
  {
    question: "How to sell an item?",
    answer: "To sell an item you need to become a seller by logging in and verifying. After that, click 'Sell an Item' on the dashboard to sell an item.",
    category: "Selling",
    tags: ["seller", "listing"]
  },
  {
    question: "Is banner free?",
    answer: "No, charges are applicable for banners.",
    category: "Advertising",
    tags: ["banner", "costs"]
  },
  {
    question: "How to create a banner?",
    answer: "Click on 'Sell an Item' page, scroll down to find 'Add Banner' option and select it. Upon selecting it, it will show the available sizes. Click on any based on your need, select a banner size, and upload a banner.",
    category: "Advertising",
    tags: ["banner", "creation"]
  },
  {
    question: "Is seller account different from normal account?",
    answer: "Yes, seller account (email) should be different from normal account (email).",
    category: "Accounts",
    tags: ["seller", "registration"]
  },
  {
    question: "What are the different payment gateways in Auction X?",
    answer: "There are multiple payment gateways like Google Pay, PhonePe, Razorpay, PayPal, etc.",
    category: "Payments",
    tags: ["gateways", "methods"]
  },
  {
    question: "Can we filter items based on categories?",
    answer: "Yes, you can use the filter from the categories dropdown or search your categories on the search bar.",
    category: "Navigation",
    tags: ["filter", "search"]
  },
  {
    question: "Can we filter products based on tomorrow and today?",
    answer: "Yes, go to 'Bid an Item' page, scroll down to find the 'Today/Tomorrow' banner, click on the side you want. Then the products would be filtered based on your selections.",
    category: "Navigation",
    tags: ["filter", "time"]
  },
  {
    question: "Is Auction X secure?",
    answer: "Yes, Auction X uses many security practices to keep users' data safe.",
    category: "Security",
    tags: ["data", "protection"]
  },
  {
    question: "What is OTP validation for?",
    answer: "It is a security feature provided by Auction X to validate if the user is legitimate or not.",
    category: "Security",
    tags: ["otp", "validation"]
  },
  {
    question: "What can we search in the search bar?",
    answer: "You can search for products and categories.",
    category: "Navigation",
    tags: ["search", "filter"]
  },
  {
    question: "How to become a seller?",
    answer: "Click on 'Become a Seller' at the top of the page, sign in or sign up with your email, fill out the form, and you are ready to sell items.",
    category: "Selling",
    tags: ["seller", "registration"]
  },
  {
    question: "How to create banners?",
    answer: "To create banners, click on the 'Add a Banner' option, choose one of the plans below, select the banner size, and upload your banner.",
    category: "Advertising",
    tags: ["banner", "creation"]
  },
  {
    question: "Is creating a banner free?",
    answer: "No, charges are applicable for creating a banner.",
    category: "Advertising",
    tags: ["banner", "costs"]
  },
  {
    question: "Can the product details be updated?",
    answer: "Yes, you can update your product details, but you cannot change the time and date of the product. Also, you can only update it before 1 hour of the bidding start time.",
    category: "Selling",
    tags: ["product", "editing"]
  },
  {
    question: "What are daily challenges?",
    answer: "Daily challenges are a way to earn star points, which can be exchanged to get discounts on bids, special avatars for profile pictures, and many more rewards.",
    category: "Features",
    tags: ["challenges", "rewards"]
  },
  {
    question: "Can we filter products based on today and tomorrow?",
    answer: "Yes, go to the 'Bid an Item' page, scroll down to find the 'Today' and 'Tomorrow' banners, and click on 'Today' or 'Tomorrow' to filter products accordingly.",
    category: "Navigation",
    tags: ["filter", "time"]
  },
  {
    question: "Can the email be updated?",
    answer: "No, you cannot update the email.",
    category: "Accounts",
    tags: ["profile", "limitations"]
  },
  {
    question: "How to track items?",
    answer: "Go to 'My Bids' from the profile dropdown, then click on the product you want to track.",
    category: "Orders",
    tags: ["tracking", "bids"]
  },
  {
    question: "How do I create an account?",
    answer: "Click on 'Sign Up' at the top right corner of the website, fill in your details, and verify your email to create an account.",
    category: "Accounts",
    tags: ["registration", "signup"]
  },
  {
    question: "Can I have multiple accounts?",
    answer: "No, each user is allowed only one account. However, you can have separate buyer and seller accounts with different email addresses.",
    category: "Accounts",
    tags: ["limitations", "seller"]
  },
  {
    question: "How do I reset my password?",
    answer: "Click on 'Login', then 'Forgot Password'. Enter your registered email address to receive a password reset link.",
    category: "Accounts",
    tags: ["password", "security"]
  },
  {
    question: "How can I delete my account?",
    answer: "Go to 'Profile Settings', scroll to the bottom, and click on 'Delete Account'. Note that account deletion is permanent and cannot be undone.",
    category: "Accounts",
    tags: ["profile", "deletion"]
  },
  {
    question: "Is there a mobile app for Auction X?",
    answer: "Yes, Auction X is available as a mobile app on both Android and iOS platforms. Search for 'Auction X' in your app store.",
    category: "General",
    tags: ["app", "mobile"]
  },
  {
    question: "How do I change my email address?",
    answer: "Go to 'Profile Settings', click on 'Edit Email', enter your new email address, and verify it through the link sent to your new email.",
    category: "Accounts",
    tags: ["profile", "email"]
  },
  {
    question: "Can I change my username?",
    answer: "Yes, go to 'Profile Settings' and update your username in the 'Basic Information' section.",
    category: "Accounts",
    tags: ["profile", "username"]
  },
  {
    question: "How can I see my account activity?",
    answer: "Go to your profile and click on 'Account Activity' to view your recent login history and actions.",
    category: "Accounts",
    tags: ["security", "activity"]
  },
  {
    question: "What should I do if I notice suspicious activity on my account?",
    answer: "Immediately change your password and contact our support team at auctionxofficial@gmail.com or through the 'Help and Support' section.",
    category: "Security",
    tags: ["account", "suspicious"]
  },
  {
    question: "Can I link multiple email addresses to my account?",
    answer: "No, each account can only have one email address. For seller accounts, you need to use a different email.",
    category: "Accounts",
    tags: ["email", "limitations"]
  },
  {
    question: "Is there a minimum bid amount?",
    answer: "Yes, each item has a minimum bid amount set by the seller. You cannot place a bid lower than this amount.",
    category: "Bidding",
    tags: ["minimum", "rules"]
  },
  {
    question: "How do I know if my bid is successful?",
    answer: "You will receive a notification and an email confirming your bid. You can also check the status in 'My Bids'.",
    category: "Bidding",
    tags: ["confirmation", "notification"]
  },
  {
    question: "What happens if someone outbids me?",
    answer: "You will receive a notification informing you that you've been outbid, giving you the opportunity to place a higher bid if desired.",
    category: "Bidding",
    tags: ["outbid", "notification"]
  },
  {
    question: "Can I set a maximum bid amount?",
    answer: "Yes, you can set a maximum bid amount, and our system will automatically increase your bid up to your maximum if someone outbids you.",
    category: "Bidding",
    tags: ["maximum", "automatic"]
  },
  {
    question: "How do I know when an auction ends?",
    answer: "Each item listing displays the auction end time. You will also receive a notification before the auction ends if you've placed a bid.",
    category: "Bidding",
    tags: ["end", "notification"]
  },
  {
    question: "Is there an auto-extend feature for auctions?",
    answer: "Yes, if a bid is placed in the last 5 minutes of an auction, the auction is automatically extended by 5 minutes.",
    category: "Bidding",
    tags: ["extension", "time"]
  },
  {
    question: "What is a reserve price?",
    answer: "A reserve price is the minimum amount a seller is willing to accept. If the final bid doesn't meet the reserve price, the seller is not obligated to sell.",
    category: "Selling",
    tags: ["price", "minimum"]
  },
  {
    question: "How can I see my bidding history?",
    answer: "Go to your profile and click on 'My Bids' to view all your current and past bids.",
    category: "Bidding",
    tags: ["history", "tracking"]
  },
  {
    question: "Can I bid on multiple items simultaneously?",
    answer: "Yes, you can place bids on as many items as you wish, provided you have sufficient balance.",
    category: "Bidding",
    tags: ["multiple", "balance"]
  },
  {
    question: "What happens if I win multiple auctions?",
    answer: "You will receive notifications for each auction won. Each transaction is processed separately.",
    category: "Bidding",
    tags: ["winning", "multiple"]
  },
  {
    question: "What currencies do you accept?",
    answer: "We primarily accept Indian Rupees (₹), but support other currencies through PayPal for international users.",
    category: "Payments",
    tags: ["currency", "international"]
  },
  {
    question: "Is there a transaction fee?",
    answer: "Yes, a small transaction fee of 2% is applied to all transactions to cover payment processing costs.",
    category: "Payments",
    tags: ["fees", "transaction"]
  },
  {
    question: "How long does it take for a withdrawal to be processed?",
    answer: "Withdrawal requests are typically processed within 2-3 business days.",
    category: "Payments",
    tags: ["withdrawal", "processing"]
  },
  {
    question: "What is the maximum amount I can withdraw?",
    answer: "You can withdraw up to ₹50,000 per day, subject to verification for larger amounts.",
    category: "Payments",
    tags: ["withdrawal", "limits"]
  },
  {
    question: "Do you offer any payment plans?",
    answer: "No, all auction wins must be paid in full according to our payment terms.",
    category: "Payments",
    tags: ["plans", "terms"]
  },
  {
    question: "What happens if my payment fails?",
    answer: "If your payment fails, you will be notified and given 24 hours to complete the payment. Failure to do so may result in losing the auction.",
    category: "Payments",
    tags: ["failure", "consequences"]
  },
  {
    question: "Can I get a refund for my added balance?",
    answer: "Yes, unused balance can be refunded upon request, subject to a small processing fee.",
    category: "Payments",
    tags: ["refund", "balance"]
  },
  {
    question: "How do I update my payment information?",
    answer: "Go to 'Profile Settings', click on 'Payment Methods', and update your information.",
    category: "Payments",
    tags: ["update", "methods"]
  },
  {
    question: "Is there a cooling period for withdrawals?",
    answer: "Yes, there is a 48-hour cooling period for withdrawals after adding money to your account for security purposes.",
    category: "Payments",
    tags: ["withdrawal", "security"]
  },
  {
    question: "Can I use my credit card for payments?",
    answer: "Yes, we accept all major credit cards through our secure payment gateways.",
    category: "Payments",
    tags: ["credit", "methods"]
  },
  {
    question: "What are the seller fees?",
    answer: "Seller fees are 5% of the final auction price, with a minimum fee of ₹100.",
    category: "Selling",
    tags: ["fees", "commission"]
  },
  {
    question: "How do I set a reserve price?",
    answer: "When listing an item, check the 'Set Reserve Price' option and enter your minimum acceptable amount.",
    category: "Selling",
    tags: ["reserve", "minimum"]
  },
  {
    question: "Can I edit a listing after it's published?",
    answer: "You can edit certain details of your listing before the first bid is placed. After that, only minor corrections are allowed.",
    category: "Selling",
    tags: ["editing", "listing"]
  },
  {
    question: "How many images can I upload for an item?",
    answer: "You can upload up to 10 images per item listing.",
    category: "Selling",
    tags: ["images", "listing"]
  },
  {
    question: "What items are prohibited from selling?",
    answer: "Prohibited items include illegal goods, counterfeit products, dangerous substances, and adult content. See our 'Prohibited Items' policy for a complete list.",
    category: "Selling",
    tags: ["prohibited", "policy"]
  },
  {
    question: "How long can I list an item for?",
    answer: "You can choose auction durations from 1 to 10 days when listing an item.",
    category: "Selling",
    tags: ["duration", "listing"]
  },
  {
    question: "Can I cancel a listing?",
    answer: "You can cancel a listing if no bids have been placed. Once bidding starts, cancellation is not possible.",
    category: "Selling",
    tags: ["cancellation", "listing"]
  },
  {
    question: "How do I get verified as a seller?",
    answer: "Complete your store setup on the 'Become a Seller' page and verify your registered email address with your secure 6-digit verification code.",
    category: "Selling",
    tags: ["verification", "email-otp"]
  },
  {
    question: "What happens if no one bids on my item?",
    answer: "If no bids are placed, you can relist the item or adjust the starting price to attract more interest.",
    category: "Selling",
    tags: ["no bids", "relisting"]
  },
  {
    question: "Can I offer shipping options?",
    answer: "Yes, you can specify multiple shipping options when creating your listing, including courier services and pickup options.",
    category: "Selling",
    tags: ["shipping", "options"]
  },
  {
    question: "What happens if I don't pay after winning an auction?",
    answer: "Failure to pay may result in account suspension and being blacklisted from future auctions. The seller may also leave negative feedback.",
    category: "Bidding",
    tags: ["payment", "consequences"]
  },
  {
    question: "Can I get notifications for new items in specific categories?",
    answer: "Yes, you can set up alerts for specific categories by clicking on 'Save Search' when browsing those categories.",
    category: "Navigation",
    tags: ["alerts", "categories"]
  },
  {
    question: "How do I leave feedback for a seller?",
    answer: "After completing a transaction, go to 'My Bids', find the completed transaction, and click on 'Leave Feedback'.",
    category: "Orders",
    tags: ["feedback", "seller"]
  },
  {
    question: "Is there a buy-it-now option?",
    answer: "Yes, sellers can set a 'Buy It Now' price that allows buyers to purchase items immediately without bidding.",
    category: "Bidding",
    tags: ["buy now", "immediate"]
  },
  {
    question: "How do I report suspicious items or sellers?",
    answer: "Click on the 'Report' button on the item page or seller profile, select the reason for reporting, and submit your concern.",
    category: "Security",
    tags: ["report", "suspicious"]
  },
  {
    question: "Can I auction services on Auction X?",
    answer: "Yes, you can auction services as well as physical items, provided they comply with our terms of service.",
    category: "Selling",
    tags: ["services", "non-physical"]
  },
  {
    question: "Is there an age requirement to use Auction X?",
    answer: "Yes, you must be at least 18 years old to create an account and use Auction X.",
    category: "General",
    tags: ["age", "requirements"]
  },
  {
    question: "Do you offer international shipping?",
    answer: "Shipping options are set by individual sellers. Many sellers offer international shipping, but this varies by listing.",
    category: "Orders",
    tags: ["shipping", "international"]
  },
  {
    question: "How can I promote my listings?",
    answer: "You can purchase promotional features such as 'Featured Listing', 'Homepage Spotlight', or 'Category Top' to increase visibility.",
    category: "Selling",
    tags: ["promotion", "visibility"]
  },
  {
    question: "What file formats are accepted for item images?",
    answer: "We accept JPG, PNG, and GIF formats for item images, with a maximum size of 5MB per image.",
    category: "Selling",
    tags: ["images", "formats"]
  },
  {
    question: "What are the available banner sizes?",
    answer: "Banner sizes include 728x90px (leaderboard), 300x250px (medium rectangle), and 160x600px (skyscraper).",
    category: "Advertising",
    tags: ["banner", "sizes"]
  },
  {
    question: "How much does a banner ad cost?",
    answer: "Banner pricing varies based on size and placement, starting from ₹1,000 for a 3-day display.",
    category: "Advertising",
    tags: ["banner", "pricing"]
  },
  {
    question: "Can I target my banner to specific categories?",
    answer: "Yes, you can choose specific categories for your banner display for an additional fee.",
    category: "Advertising",
    tags: ["banner", "targeting"]
  },
  {
    question: "How long can a banner be displayed?",
    answer: "Banners can be displayed for periods ranging from 3 days to 30 days.",
    category: "Advertising",
    tags: ["banner", "duration"]
  },
  {
    question: "What are the banner design requirements?",
    answer: "Banners must comply with our design guidelines, including no explicit content, clear readability, and accurate representation.",
    category: "Advertising",
    tags: ["banner", "guidelines"]
  },
  {
    question: "Can I get statistics on my banner performance?",
    answer: "Yes, you can view impressions and click-through rates for your banner in the 'Banner Analytics' section.",
    category: "Advertising",
    tags: ["banner", "analytics"]
  },
  {
    question: "Is there a review process for banners?",
    answer: "Yes, all banners go through a review process before going live to ensure they meet our guidelines.",
    category: "Advertising",
    tags: ["banner", "review"]
  },
  {
    question: "Can I schedule my banner for specific dates?",
    answer: "Yes, you can select specific start and end dates for your banner campaign during the setup process.",
    category: "Advertising",
    tags: ["banner", "scheduling"]
  },
  {
    question: "How do I edit my banner after publishing?",
    answer: "Go to 'My Banners' in your seller dashboard, select the banner, and click 'Edit'. Note that this will restart the review process.",
    category: "Advertising",
    tags: ["banner", "editing"]
  },
  {
    question: "Can I cancel my banner subscription?",
    answer: "You can cancel your banner subscription, but refunds are prorated based on the display time already used.",
    category: "Advertising",
    tags: ["banner", "cancellation"]
  },
    {
      "question": "Hello!",
      "answer": "Hi there! How can I assist you today?",
      "category": "Casual",
      "tags": ["greeting", "chat", "friendly"]
    },
    {
      "question": "Hey!",
      "answer": "Hey! How’s it going?",
      "category": "Casual",
      "tags": ["greeting", "chat", "friendly"]
    },
    {
      "question": "Good morning!",
      "answer": "Good morning! Hope you have a fantastic day ahead.",
      "category": "Casual",
      "tags": ["greeting", "morning", "friendly"]
    },
    {
      "question": "Good night!",
      "answer": "Good night! Sleep well and sweet dreams.",
      "category": "Casual",
      "tags": ["greeting", "night", "friendly"]
    },
    {
      "question": "How's your day going?",
      "answer": "It’s going great! How about yours?",
      "category": "Casual",
      "tags": ["day", "mood", "conversation"]
    },
    {
      "question": "How are you?",
      "answer": "I'm doing great! Thanks for asking. How about you?",
      "category": "Casual",
      "tags": ["well-being", "mood", "conversation"]
    },
    {
      "question": "What are you doing?",
      "answer": "Just here, ready to help! What’s up?",
      "category": "Casual",
      "tags": ["chat", "conversation", "friendly"]
    },
    {
      "question": "What's new?",
      "answer": "Not much! Just happy to chat with you. What’s new with you?",
      "category": "Casual",
      "tags": ["chat", "conversation", "friendly"]
    },
    {
      "question": "Tell me something interesting!",
      "answer": "Did you know that honey never spoils? Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly good!",
      "category": "Casual",
      "tags": ["fun fact", "interesting", "chat"]
    },
    {
      "question": "What's your favorite food?",
      "answer": "I don’t eat, but I hear pizza is pretty popular!",
      "category": "Casual",
      "tags": ["food", "preference", "fun"]
    },
    {
      "question": "Can you tell me a joke?",
      "answer": "Of course! Why don’t skeletons fight each other? Because they don’t have the guts!",
      "category": "Casual",
      "tags": ["joke", "fun", "humor"]
    },
    {
      "question": "Do you have a favorite movie?",
      "answer": "I don’t watch movies, but I hear 'The Matrix' is a classic!",
      "category": "Casual",
      "tags": ["movies", "fun", "preference"]
    },
    {
      "question": "Do you like animals?",
      "answer": "I think animals are amazing! Do you have a favorite one?",
      "category": "Casual",
      "tags": ["animals", "fun", "chat"]
    },
    {
      "question": "Can you sing?",
      "answer": "I wish I could! But I can find lyrics for you if you’d like.",
      "category": "Casual",
      "tags": ["singing", "music", "fun"]
    },
    {
      "question": "Do you get tired?",
      "answer": "Nope! I’m always here, ready to help.",
      "category": "Casual",
      "tags": ["AI", "energy", "chat"]
    },
    {
      "question": "Can you dance?",
      "answer": "I wish I could! But if you dance, I can cheer you on!",
      "category": "Casual",
      "tags": ["dance", "fun", "chat"]
    },
    {
      "question": "Do you have a best friend?",
      "answer": "I consider everyone I chat with a friend!",
      "category": "Casual",
      "tags": ["friends", "chat", "friendly"]
    },
    {
      "question": "Do you ever get bored?",
      "answer": "Never! There’s always something interesting to talk about.",
      "category": "Casual",
      "tags": ["boredom", "fun", "chat"]
    },
    {
      "question": "Can you tell me a fun fact?",
      "answer": "Sure! Did you know that a day on Venus is longer than a year on Venus?",
      "category": "Casual",
      "tags": ["fun fact", "interesting", "chat"]
    }
  
  
];

const TeamMember = require("../../src/modules/team/models/TeamMember");

const initialTeamMembers = [
  {
    name: "Kunal Sarkar",
    role: "Lead Developer / Technical Strategist",
    bio: "Passionate Graphic & Branding Designer and Full Stack Developer, blending creativity and technical expertise to craft impactful solutions.",
    imageUrl: "/assets/images/FooterElements/AboutUs/KunalSarkar.jpg",
    socialLinks: {
      linkedin: "https://www.linkedin.com/in/kunal-sarkar-592a1230a/",
      github: "https://github.com/kunalsarkar-bit",
      email: "kunalsarkar6290@gmail.com",
      twitter: "",
    },
    displayOrder: 0,
    isActive: true,
  },
  {
    name: "Om Sardar",
    role: "Lead Full-Stack Developer",
    bio: "Passionate engineer with deep proficiency in React, Node.js, Python, OOP, and distributed systems, committed to scalable marketplace architecture.",
    imageUrl: "/assets/images/FooterElements/AboutUs/OmSardar.jpg",
    socialLinks: {
      linkedin: "https://www.linkedin.com/in/om-sardar",
      github: "https://github.com/OM-SARDAR",
      email: "omsardar14@gmail.com",
      twitter: "",
    },
    displayOrder: 1,
    isActive: true,
  },
];

const seedDatabase = async () => {
  try {
    const count = await FAQ.countDocuments();
    if (count === 0) {
      await FAQ.insertMany(initialFAQs);
      console.log('Database seeded with initial FAQ data');
    } else {
      console.log('Database already contains data, skipping seed operation');
    }

    const teamCount = await TeamMember.countDocuments();
    if (teamCount === 0) {
      await TeamMember.insertMany(initialTeamMembers);
      console.log('Database seeded with verified initial team members (Kunal Sarkar & Om Sardar)');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
};

module.exports = seedDatabase;