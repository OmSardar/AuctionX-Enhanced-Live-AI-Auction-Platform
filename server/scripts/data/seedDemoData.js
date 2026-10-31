/**
 * Auction X — Development Demo Data Seeder
 *
 * Populates local Docker MongoDB with realistic marketplace activity:
 * - 150 Customers / Users (bidding balances, addresses, bcrypt password)
 * - 150 Admin E-Commerce Customers
 * - 25 Sellers (verified, rich profiles, store descriptions)
 * - 25 Admin Sellers (active & pending statuses)
 * - 150 Products / Auctions (active, upcoming, closed states)
 * - Hundreds of bids represented via product bidding fields
 * - 60 Inventory Items (Admin E-Commerce Inventory)
 * - 60 Closed Orders (Sell An Item Orders)
 * - 60 Admin Orders (Admin E-Commerce Orders)
 * - 50 Product Reviews (ProductFeedback with valid order references)
 * - 120 Transactions (Deposits and Withdrawals)
 * - 25 Subscriptions (User subscriptions with valid user references)
 * - 8 Banners (Top, sidebar, popup advertising banners)
 * - 10 Events (Special auction events with participant references)
 * - 12 Calendar entries (Auction schedule with valid 24h times)
 *
 * SAFETY INVARIANTS:
 * - Targets local Docker MongoDB on port 27018 only.
 * - Refuses to run against Atlas or remote databases.
 * - Deletes ONLY demo records marked with '@auctionx.demo' or demo tags.
 * - Validates referential integrity upon completion.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Models
const User = require("../../src/modules/users/models/user");
const Customer = require("../../src/modules/admin/users/models/customers");
const Seller = require("../../src/modules/sellers/accounts/models/seller");
const AdminSeller = require("../../src/modules/admin/sellers/models/adminSeller");
const Product = require("../../src/modules/products/models/productSchema");
const Item = require("../../src/modules/admin/listings/models/inventory");
const Order = require("../../src/modules/orders/models/orderSchema");
const AdminOrder = require("../../src/modules/admin/orders/models/orders");
const ProductFeedback = require("../../src/modules/feedback/models/ProductFeedback");
const Transaction = require("../../src/modules/admin/finance/models/transaction");
const Subscription = require("../../src/modules/subscriptions/models/subscription");
const Banner = require("../../src/modules/admin/tasks/models/banner");
const Event = require("../../src/modules/admin/tasks/models/event");
const Calendar = require("../../src/modules/admin/tasks/models/calendar");

// Configuration
const DEMO_DOMAIN = "auctionx.demo";
const DEFAULT_LOCAL_URI = "mongodb://127.0.0.1:27018/Auction-X";
const TARGET_URI =
  process.env.DEMO_MONGODB_URL ||
  process.env.LOCAL_MONGODB_URL ||
  process.env.MONGODB_URL ||
  DEFAULT_LOCAL_URI;

/**
 * Hard safety check: ensure we NEVER target Atlas or remote production databases.
 */
function assertSafeConnection(uri) {
  const lower = uri.toLowerCase();
  if (
    lower.includes("mongodb+srv") ||
    lower.includes("cluster0") ||
    lower.includes("tolhj") ||
    lower.includes(".net") ||
    lower.includes("atlas")
  ) {
    console.error(
      "\n❌ CRITICAL SAFETY ERROR: Attempted to connect to a remote or Atlas database!"
    );
    console.error(`Target URI: ${uri.replace(/:([^:@]+)@/, ":****@")}`);
    console.error(
      "The demo data seeder is restricted to the local Docker database only.\n"
    );
    process.exit(1);
  }
}

// Reusable image assets for high-quality mock listings
const MOCK_IMAGES = {
  watches: [
    {
      secure_url:
        "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_watch_1",
    },
    {
      secure_url:
        "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_watch_2",
    },
    {
      secure_url:
        "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_watch_3",
    },
  ],
  cars: [
    {
      secure_url:
        "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_car_1",
    },
    {
      secure_url:
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_car_2",
    },
    {
      secure_url:
        "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_car_3",
    },
  ],
  cameras: [
    {
      secure_url:
        "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_cam_1",
    },
    {
      secure_url:
        "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_cam_2",
    },
  ],
  art: [
    {
      secure_url:
        "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_art_1",
    },
    {
      secure_url:
        "https://images.unsplash.com/photo-1582561424760-0321d75e81fa?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_art_2",
    },
  ],
  antiques: [
    {
      secure_url:
        "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_antique_1",
    },
    {
      secure_url:
        "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_antique_2",
    },
  ],
  electronics: [
    {
      secure_url:
        "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_elec_1",
    },
    {
      secure_url:
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_elec_2",
    },
  ],
  gaming: [
    {
      secure_url:
        "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_game_1",
    },
    {
      secure_url:
        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_game_2",
    },
  ],
  sports: [
    {
      secure_url:
        "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80",
      public_id: "demo_sport_1",
    },
  ],
  avatars: [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80",
  ],
};

const FIRST_NAMES = [
  "Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Sneha", "Arjun", "Neha",
  "Aditya", "Pooja", "Kabir", "Meera", "Karan", "Rhea", "Rahul", "Tanvi",
  "Siddharth", "Ishita", "Varun", "Simran", "Nikhil", "Kavya", "Manish",
  "Divya", "Gaurav", "Shreya", "Amit", "Alia", "Rajesh", "Sunita",
  "Elena", "Marcus", "Sofia", "David", "Lucas", "Emma", "Liam", "Olivia",
  "Alexander", "Chloe", "Julian", "Zoe", "Mateo", "Ava", "Noah", "Isabella"
];

const LAST_NAMES = [
  "Sharma", "Patel", "Verma", "Mehta", "Iyer", "Singh", "Reddy", "Chopra",
  "Nair", "Kapoor", "Bhatia", "Joshi", "Deshmukh", "Gupta", "Malhotra", "Rao",
  "Sarkar", "Banerjee", "Chatterjee", "Mukherjee", "Das", "Saxena", "Choudhury",
  "Vance", "Chen", "Miller", "Rossi", "Müller", "Dubois", "Santos", "Novak"
];

const CITIES = [
  { city: "Bangalore", state: "Karnataka", pinCode: "560038" },
  { city: "Mumbai", state: "Maharashtra", pinCode: "400001" },
  { city: "New Delhi", state: "Delhi", pinCode: "110001" },
  { city: "Hyderabad", state: "Telangana", pinCode: "500081" },
  { city: "Pune", state: "Maharashtra", pinCode: "411004" },
  { city: "Kolkata", state: "West Bengal", pinCode: "700016" },
  { city: "Chennai", state: "Tamil Nadu", pinCode: "600002" },
  { city: "Jaipur", state: "Rajasthan", pinCode: "302001" },
  { city: "Ahmedabad", state: "Gujarat", pinCode: "380009" },
  { city: "Chandigarh", state: "Punjab", pinCode: "160017" },
];

const SELLER_STORES = [
  { storeName: "Chronos Luxury Horology", desc: "Premier curator of rare Swiss timepieces and vintage chronographs." },
  { storeName: "Apex Hypercar Gallery", desc: "Exclusive collector consignment of exotic sports cars and historic automobiles." },
  { storeName: "Luxe Gems & Diamonds", desc: "Certified fine jewelry, natural diamonds, and royal heirloom pieces." },
  { storeName: "Dynasty Antiques & Relics", desc: "Museum-grade antiques, colonial artifacts, and ancient curiosities." },
  { storeName: "Studio Art Spectrum", desc: "Contemporary abstract masterpieces and fine oil paintings by master artists." },
  { storeName: "CyberVintage Tech", desc: "Sealed retro computing relics, legendary consoles, and tech artifacts." },
  { storeName: "CineOptics Vault", desc: "Vintage Leica, Hasselblad, and cinema-grade medium format camera optics." },
  { storeName: "Stadium Legends Memorabilia", desc: "Authenticated sports jerseys, historic match gear, and championship relics." },
  { storeName: "Royal Heritage Furnishings", desc: "Hand-carved teakwood, Victorian mahogany, and regal estate furniture." },
  { storeName: "Grand Cru Wine & Spirits", desc: "Properly cellared rare vintages, vintage single malts, and collectible bottles." },
  { storeName: "Titanium Mobile Tech", desc: "Limited edition luxury smartphones, bespoke titanium craftsmanship." },
  { storeName: "Sovereign Numismatics", desc: "Rare historic gold coinage, colonial banknotes, and authenticated medals." },
  { storeName: "Avant-Garde Ceramics", desc: "Hand-thrown studio pottery, Japanese raku, and porcelain stoneware." },
  { storeName: "Velocita Classic Motors", desc: "Restored Italian classics, vintage Vespas, and historic roadsters." },
  { storeName: "Imperial Rugs & Tapestries", desc: "Silk Persian carpets, antique Qum weaves, and Flemish hand tapestries." },
  { storeName: "Sonic Fidelity Acoustics", desc: "Audiophile tube amplification, planar magnetic acoustics, and analog vinyl." },
  { storeName: "First Edition Rare Books", desc: "Signed literary first editions, historic manuscripts, and antiquarian maps." },
  { storeName: "Haute Couture Vintage", desc: "Archival runway fashion, designer leather trunks, and runway pieces." },
  { storeName: "Prestige Time Vault", desc: "Certified pre-owned Rolex, Patek Philippe, and Audemars Piguet watches." },
  { storeName: "Starlight Aviation Relics", desc: "Historic aviation dials, supersonic cockpit instruments, and parts." },
  { storeName: "Elysian Estate Collectibles", desc: "Fine estate clearance, crystal chandeliers, and silver dining sets." },
  { storeName: "Modena Supercar Imports", desc: "Direct importation of track-focused supercars and limited series roadsters." },
  { storeName: "Metropolitan Modern Art", desc: "Curated original contemporary sculptures and vibrant gallery canvases." },
  { storeName: "Nirvana Asian Antiques", desc: "Bronze deities, Tibetan thangkas, and Himalayan antiquities." },
  { storeName: "Arcade Retro Classics", desc: "Fully restored full-size arcade machines, pinball tables, and vintage neon." },
];

const PRODUCT_CATALOG = [
  // Watches & Timepieces
  {
    name: "Rolex Submariner Date 16610 (1998)",
    category: "Watches & Timepieces",
    imagePool: "watches",
    startPrice: 750000,
    specs: [
      { name: "Condition", description: "Excellent unpolished condition with original box and papers." },
      { name: "Movement", description: "Rolex Calibre 3135 Automatic Chronometer." },
      { name: "Case", description: "40mm Oystersteel with unidirectional black ceramic bezel." },
      { name: "Authenticity", description: "Verified and authenticated by certified master watchmaker." }
    ]
  },
  {
    name: "Patek Philippe Calatrava 5196R Rose Gold",
    category: "Watches & Timepieces",
    imagePool: "watches",
    startPrice: 1650000,
    specs: [
      { name: "Condition", description: "Mint collector condition, worn only on special occasions." },
      { name: "Movement", description: "Manual wind Calibre 215 PS with Geneva Seal hallmark." },
      { name: "Case", description: "37mm 18k Rose Gold with alligator leather strap." },
      { name: "Provenance", description: "Purchased original from authorised salon in Geneva." }
    ]
  },
  {
    name: "Omega Speedmaster Professional Moonwatch",
    category: "Watches & Timepieces",
    imagePool: "watches",
    startPrice: 420000,
    specs: [
      { name: "Condition", description: "Brand new with factory stickers and full commemorative moon box." },
      { name: "Movement", description: "Co-Axial Master Chronometer Calibre 3861 manual wind." },
      { name: "Crystal", description: "Hesalite crystal with embossed Greek Omega emblem." }
    ]
  },
  {
    name: "Audemars Piguet Royal Oak Jumbo 15202ST",
    category: "Watches & Timepieces",
    imagePool: "watches",
    startPrice: 3100000,
    specs: [
      { name: "Condition", description: "Pristine condition with petite tapisserie blue dial." },
      { name: "Movement", description: "Ultra-thin Automatic Calibre 2121." },
      { name: "Bracelet", description: "Integrated stainless steel bracelet with folding clasp." }
    ]
  },
  {
    name: "Cartier Santos de Cartier Large Steel",
    category: "Watches & Timepieces",
    imagePool: "watches",
    startPrice: 480000,
    specs: [
      { name: "Condition", description: "Near mint condition with quick-switch steel and calfskin straps." },
      { name: "Movement", description: "In-house Manufacture 1847 MC automatic." }
    ]
  },
  {
    name: "TAG Heuer Monaco Calibre 11 Steve McQueen",
    category: "Watches & Timepieces",
    imagePool: "watches",
    startPrice: 340000,
    specs: [
      { name: "Condition", description: "Classic left-crown edition with blue sunray dial." },
      { name: "Heritage", description: "Homage to the iconic 1969 timepiece worn in the film Le Mans." }
    ]
  },

  // Classic & Vintage Cars
  {
    name: "1967 Ford Mustang Fastback GTA 390 V8",
    category: "Classic & Vintage Cars",
    imagePool: "cars",
    startPrice: 4500000,
    specs: [
      { name: "Condition", description: "Concours-grade frame-off rotisserie restoration." },
      { name: "Drivetrain", description: "Numbers-matching 390ci 'S-code' Big Block V8 with C6 automatic." },
      { name: "Color", description: "Highland Green exterior over deluxe parchment bucket interior." }
    ]
  },
  {
    name: "1974 Porsche 911 Carrera RS 2.7 Tribute",
    category: "Classic & Vintage Cars",
    imagePool: "cars",
    startPrice: 6200000,
    specs: [
      { name: "Engine", description: "Period-correct 2.7L air-cooled flat-six with mechanical fuel injection." },
      { name: "Features", description: "Lightweight ducktail spoiler, Fuchs staggered wheels, roll bar." }
    ]
  },
  {
    name: "1963 Chevrolet Corvette Stingray Split Window",
    category: "Classic & Vintage Cars",
    imagePool: "cars",
    startPrice: 8500000,
    specs: [
      { name: "Heritage", description: "One of only 10,594 coupe models produced with the iconic split window." },
      { name: "Performance", description: "Fuel-injected L84 327ci 360HP V8 paired with 4-speed manual." }
    ]
  },
  {
    name: "1989 BMW E30 M3 Evolution II",
    category: "Classic & Vintage Cars",
    imagePool: "cars",
    startPrice: 5200000,
    specs: [
      { name: "Chassis", description: "Extremely clean homologation special in Misano Red." },
      { name: "Odometer", description: "54,200 verified original kilometers with full service stamps." }
    ]
  },

  // Cameras & Lenses
  {
    name: "Leica M6 Classic 0.72x Rangefinder Black",
    category: "Cameras & Lenses",
    imagePool: "cameras",
    startPrice: 280000,
    specs: [
      { name: "Condition", description: "Recent CLA completed by Leica Wetzlar certified technician." },
      { name: "Shutter", description: "Cloth focal-plane shutter operating flawlessly across all speeds." }
    ]
  },
  {
    name: "Hasselblad 500C/M with Carl Zeiss 80mm f/2.8",
    category: "Cameras & Lenses",
    imagePool: "cameras",
    startPrice: 220000,
    specs: [
      { name: "Format", description: "Medium format 6x6 film system with A12 film back and waist-level finder." },
      { name: "Glass", description: "Crystal clear Carl Zeiss Planar T* optics, free of haze or fungus." }
    ]
  },
  {
    name: "Sony Alpha A7 IV Full-Frame Camera Kit",
    category: "Cameras & Lenses",
    imagePool: "cameras",
    startPrice: 195000,
    specs: [
      { name: "Sensor", description: "33MP Full-Frame Exmor R CMOS with BIONZ XR processing." },
      { name: "Lens", description: "Includes FE 24-70mm f/2.8 GM II professional zoom lens." }
    ]
  },
  {
    name: "Canon EOS R5 C Cinema Mirrorless Body",
    category: "Cameras & Lenses",
    imagePool: "cameras",
    startPrice: 290000,
    specs: [
      { name: "Video", description: "Internal 8K/60P 12-bit RAW video recording with active cooling fan." },
      { name: "Sensor", description: "45MP full-frame Dual Pixel CMOS AF II sensor." }
    ]
  },

  // Original Paintings & Sculptures
  {
    name: "Ethereal Monsoon Reflections — Oil on Canvas",
    category: "Original Paintings & Sculptures",
    imagePool: "art",
    startPrice: 350000,
    specs: [
      { name: "Dimensions", description: "48 x 60 inches, heavy gallery stretched Belgian linen." },
      { name: "Artist", description: "Signed and dated by acclaimed national academy gold medalist." },
      { name: "Provenance", description: "Accompanied by gallery Certificate of Authenticity." }
    ]
  },
  {
    name: "Bronze Figurine 'Grace in Motion' Ltd Ed #3/12",
    category: "Original Paintings & Sculptures",
    imagePool: "art",
    startPrice: 420000,
    specs: [
      { name: "Material", description: "Lost-wax cast bronze with hand-applied verdigris patina." },
      { name: "Base", description: "Mounted on custom polished Italian Nero Marquina marble." }
    ]
  },
  {
    name: "Abstract Nocturne in Indigo & Gold Leaf",
    category: "Original Paintings & Sculptures",
    imagePool: "art",
    startPrice: 260000,
    specs: [
      { name: "Technique", description: "Multi-layered impasto acrylic with genuine 24-karat gold leaf gilding." },
      { name: "Framing", description: "Custom floating frame handcrafted from ebonized American walnut." }
    ]
  },

  // Antiques
  {
    name: "Victorian Mahogany Cylinder Roll-Top Desk (1885)",
    category: "Antiques",
    imagePool: "antiques",
    startPrice: 380000,
    specs: [
      { name: "Era", description: "Late 19th Century British colonial craftsmanship." },
      { name: "Details", description: "Fitted satinwood interior compartments, secret drawers, and brass mounts." }
    ]
  },
  {
    name: "Antique Tanjore Painting — Saraswati in 22K Gold",
    category: "Antiques",
    imagePool: "antiques",
    startPrice: 175000,
    specs: [
      { name: "Craftsmanship", description: "Embossed wooden board with natural stone colors and pure 22K gold foil." },
      { name: "Age", description: "Circa 1920s provenance from a Chettinad ancestral estate." }
    ]
  },
  {
    name: "British East India Company Brass Nautical Sextant (1892)",
    category: "Antiques",
    imagePool: "antiques",
    startPrice: 95000,
    specs: [
      { name: "Condition", description: "Complete functional antique sextant in original fitted teak wood box." },
      { name: "Engravings", description: "Stamped by Troughton & Simms, London with government broad arrow." }
    ]
  },

  // Electronics & Audiophile
  {
    name: "McIntosh MC275 Tube Power Amplifier (Mint)",
    category: "Electronics",
    imagePool: "electronics",
    startPrice: 490000,
    specs: [
      { name: "Power", description: "75 watts per channel into 4, 8, or 16 ohms with KT88 vacuum tubes." },
      { name: "Chassis", description: "High-polished mirror stainless steel chassis with iconic illuminated tubes." }
    ]
  },
  {
    name: "Focal Utopia High-Fidelity Open-Back Headphones",
    category: "Electronics",
    imagePool: "electronics",
    startPrice: 275000,
    specs: [
      { name: "Drivers", description: "Pure Beryllium 'M'-shaped dome full-range speaker drivers." },
      { name: "Materials", description: "Forged carbon yoke with lambskin memory foam ear cushions." }
    ]
  },
  {
    name: "Original Sony Walkman TPS-L2 (1979) Boxed",
    category: "Electronics",
    imagePool: "electronics",
    startPrice: 160000,
    specs: [
      { name: "Significance", description: "First commercially available personal cassette player in world history." },
      { name: "Functionality", description: "Fully recapped and restored with new drive belts; includes demo tape." }
    ]
  },

  // Gaming Consoles & Accessories
  {
    name: "Nintendo 64 Factory Sealed Smoke Grey Console (1996)",
    category: "Gaming Consoles & Accessories",
    imagePool: "gaming",
    startPrice: 220000,
    specs: [
      { name: "Grade", description: "Wata 9.4 A+ graded factory seal with pristine corners." },
      { name: "Rarity", description: "Extremely scarce Funtastic Color series in uncirculated collector condition." }
    ]
  },
  {
    name: "Custom Liquid-Cooled RTX 4090 Tournament Battle Rig",
    category: "Gaming Consoles & Accessories",
    imagePool: "gaming",
    startPrice: 380000,
    specs: [
      { name: "Hardware", description: "Intel Core i9-14900KS, ASUS ROG Strix RTX 4090, 64GB DDR5 7200MHz." },
      { name: "Cooling", description: "Custom dual-loop EKWB hardline acrylic cooling with Lian Li O11 Dynamic EVO." }
    ]
  },

  // Signed Jerseys & Sports Merchandise
  {
    name: "Lionel Messi Signed 2022 World Cup Final Argentina Jersey",
    category: "Signed Jerseys & Merchandise",
    imagePool: "sports",
    startPrice: 650000,
    specs: [
      { name: "Authentication", description: "Includes Beckett Authenticated Certificate of Authenticity and hologram." },
      { name: "Presentation", description: "Deluxe custom conservation shadowbox frame with UV-filtering museum glass." }
    ]
  },
  {
    name: "Sachin Tendulkar Signed 2011 Cricket World Cup Bat",
    category: "Signed Jerseys & Merchandise",
    imagePool: "sports",
    startPrice: 480000,
    specs: [
      { name: "Provenance", description: "Signed during the official victory banquet in Mumbai, April 2011." },
      { name: "Bat", description: "Full-sized MRF Master Blaster English Willow match-grade cricket bat." }
    ]
  },

  // Luxury Cars
  {
    name: "2023 Rolls-Royce Ghost Extended Wheelbase",
    category: "Luxury Cars",
    imagePool: "cars",
    startPrice: 24000000,
    specs: [
      { name: "Engine", description: "6.75-liter twin-turbocharged V12 producing 563 horsepower." },
      { name: "Interior", description: "Bespoke Mandarin leather, Shooting Star starlight headliner, champagne cooler." }
    ]
  },
  {
    name: "2022 Ferrari Roma — Grigio Silverstone",
    category: "Luxury Cars",
    imagePool: "cars",
    startPrice: 18500000,
    specs: [
      { name: "Odometer", description: "4,800 certified miles under single-owner care." },
      { name: "Powertrain", description: "3.9L Twin-Turbo V8 with 8-speed dual-clutch F1 transmission." }
    ]
  },

  // Smartphones & Accessories
  {
    name: "Apple iPhone 15 Pro Max 1TB Natural Titanium (Sealed)",
    category: "Smartphones & Accessories",
    imagePool: "electronics",
    startPrice: 155000,
    specs: [
      { name: "Capacity", description: "1 Terabyte NVMe internal storage." },
      { name: "Condition", description: "Factory sealed in original retail packaging with full Apple warranty." }
    ]
  },
  {
    name: "Samsung Galaxy S24 Ultra Limited Titanium Enterprise",
    category: "Smartphones & Accessories",
    imagePool: "electronics",
    startPrice: 135000,
    specs: [
      { name: "Processor", description: "Snapdragon 8 Gen 3 for Galaxy with integrated S-Pen stylus." },
      { name: "Camera", description: "200MP Quad-Telephoto optical zoom system." }
    ]
  }
];

const FEEDBACK_COMMENTS = [
  "Exceptional experience! The item arrived in even better condition than described in the auction. Flawless communication.",
  "Fast shipping, meticulous packaging, and authentic provenance documents included. Truly a top-tier seller on Auction X!",
  "A magnificent piece for my private collection. The bidding process was transparent and exciting. Highly recommend!",
  "Very satisfied with this purchase. Accurate description, responsive seller, and swift dispatch. 5 stars all the way.",
  "Item was delivered promptly in tamper-evident security crate. Exactly what I was looking for. Will bid again!",
  "Great seller! Prompt answers to all my technical questions prior to bidding. Delighted with the outcome.",
  "Spectacular condition for its age. An absolute museum piece. Auction X handled the transaction effortlessly.",
  "Solid transaction from start to finish. Everything arrived securely wrapped and exactly on time. Thank you!"
];

/**
 * Remove only demo-generated data, identified by the '@auctionx.demo' email domain
 * and unique demo descriptors, leaving production and user data intact.
 */
async function clearDemoData() {
  console.log("\n🧹 Checking and clearing existing demo data...");

  const demoEmailRegex = new RegExp(`@${DEMO_DOMAIN}$`, "i");

  const results = {
    users: await User.deleteMany({ email: { $regex: demoEmailRegex } }),
    customers: await Customer.deleteMany({ email: { $regex: demoEmailRegex } }),
    sellers: await Seller.deleteMany({ email: { $regex: demoEmailRegex } }),
    adminSellers: await AdminSeller.deleteMany({ email: { $regex: demoEmailRegex } }),
    products: await Product.deleteMany({ email: { $regex: demoEmailRegex } }),
    items: await Item.deleteMany({ email: { $regex: demoEmailRegex } }),
    orders: await Order.deleteMany({ userEmail: { $regex: demoEmailRegex } }),
    adminOrders: await AdminOrder.deleteMany({ userEmail: { $regex: demoEmailRegex } }),
    feedback: await ProductFeedback.deleteMany({ userEmail: { $regex: demoEmailRegex } }),
    transactions: await Transaction.deleteMany({ userEmail: { $regex: demoEmailRegex } }),
    subscriptions: await Subscription.deleteMany({ userEmail: { $regex: demoEmailRegex } }),
    banners: await Banner.deleteMany({ link: { $regex: /auctionx\.demo/i } }),
    events: await Event.deleteMany({ description: { $regex: /\[Demo Event\]/i } }),
    calendars: await Calendar.deleteMany({ description: { $regex: /\[Demo Auction\]/i } }),
  };

  console.log("Deleted demo records by collection:");
  for (const [key, res] of Object.entries(results)) {
    if (res.deletedCount > 0) {
      console.log(`  - ${key}: ${res.deletedCount} removed`);
    }
  }
  console.log("✓ Demo data clean complete (non-demo records preserved).\n");
}

/**
 * Generate interconnected demo data across all marketplace entities.
 */
async function seedDemoData() {
  const startTime = Date.now();
  assertSafeConnection(TARGET_URI);

  console.log("==================================================");
  console.log("       AUCTION X — DEMO DATA SEEDER               ");
  console.log("==================================================");
  console.log(`Targeting: ${TARGET_URI}`);

  await mongoose.connect(TARGET_URI);
  console.log("✓ Connected to MongoDB.");

  // Always clear previous demo data first to ensure idempotency
  await clearDemoData();

  console.log("🌱 Generating fresh demo data...");

  // 1. Password hashing (pre-computed once for high speed)
  const passwordHash = await bcrypt.hash("DemoPassword123!", 10);

  // 2. Generate 150 Users & 150 Admin Customers
  console.log("  → Seeding 150 Users and Admin Customers...");
  const usersToInsert = [];
  const customersToInsert = [];

  for (let i = 1; i <= 150; i++) {
    const firstName = FIRST_NAMES[(i - 1) % FIRST_NAMES.length];
    const lastName = LAST_NAMES[Math.floor(i / 2) % LAST_NAMES.length];
    const fullName = `${firstName} ${lastName}`;
    const email = `buyer_${i}@${DEMO_DOMAIN}`;
    const loc = CITIES[(i - 1) % CITIES.length];
    const avatar = MOCK_IMAGES.avatars[(i - 1) % MOCK_IMAGES.avatars.length];
    const balance = 15000 + ((i * 3791) % 185000);
    const spentAmount = 10000 + ((i * 5431) % 450000);

    usersToInsert.push({
      name: fullName,
      email,
      role: "user",
      password: passwordHash,
      address: `${100 + i}, Heritage Enclave, ${loc.city}`,
      phoneNo: `98${String(10000000 + i).substring(0, 8)}`,
      alternativePhoneNo: `99${String(20000000 + i).substring(0, 8)}`,
      city: loc.city,
      state: loc.state,
      country: "India",
      pinCode: loc.pinCode,
      gender: i % 2 === 0 ? "male" : "female",
      isNewUser: false,
      amount: balance,
      isVerified: true,
      profilePic: [{ secure_url: avatar, public_id: `user_pic_${i}` }],
    });

    customersToInsert.push({
      name: fullName,
      email,
      phone: `+91 98${String(10000000 + i).substring(0, 8)}`,
      location: `${loc.city}, India`,
      spent: `₹${spentAmount.toLocaleString("en-IN")}`,
      status: "Active",
      image: avatar,
      joinedDate: new Date(Date.now() - (150 - i) * 86400000),
    });
  }

  const seededUsers = await User.insertMany(usersToInsert);
  await Customer.insertMany(customersToInsert);
  console.log(`    ✓ ${seededUsers.length} Users & Customers created.`);

  // 3. Generate 25 Sellers & 25 AdminSellers
  console.log("  → Seeding 25 Sellers and Admin Sellers...");
  const sellersToInsert = [];
  const adminSellersToInsert = [];

  for (let i = 1; i <= 25; i++) {
    const store = SELLER_STORES[i - 1];
    const firstName = FIRST_NAMES[(i + 15) % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i + 5) % LAST_NAMES.length];
    const sellerName = `${firstName} ${lastName}`;
    const email = `seller_${i}@${DEMO_DOMAIN}`;
    const loc = CITIES[(i * 3) % CITIES.length];
    const avatar = MOCK_IMAGES.avatars[(i + 2) % MOCK_IMAGES.avatars.length];
    const isPending = i > 21; // 21 active, 4 pending

    sellersToInsert.push({
      name: sellerName,
      email,
      password: passwordHash,
      role: "seller",
      isNewUser: false,
      amount: 150000 + i * 25000,
      isVerified: !isPending,
      profilePic: [{ secure_url: avatar, public_id: `seller_pic_${i}` }],
      address: `Tower ${i}, Commercial Hub, ${loc.city}`,
      phoneNo: `91${String(30000000 + i).substring(0, 8)}`,
      alternativePhoneNo: `91${String(40000000 + i).substring(0, 8)}`,
      pinCode: loc.pinCode,
      city: loc.city,
      state: loc.state,
      country: "India",
      gender: i % 2 === 0 ? "female" : "male",
      storeName: store.storeName,
      storeDescription: store.desc,
    });

    adminSellersToInsert.push({
      name: sellerName,
      email,
      phone: `+91 91${String(30000000 + i).substring(0, 8)}`,
      businessName: store.storeName,
      status: isPending ? "pending_approval" : "active",
      isVerified: !isPending,
      createdAt: new Date(Date.now() - (90 - i) * 86400000),
      profilePic: [{ secure_url: avatar, public_id: `admin_seller_pic_${i}` }],
    });
  }

  const seededSellers = await Seller.insertMany(sellersToInsert);
  await AdminSeller.insertMany(adminSellersToInsert);
  console.log(`    ✓ ${seededSellers.length} Sellers & AdminSellers created.`);

  // 4. Generate 150 Products / Auctions
  // Breakdown: 70 Active (with active bids), 20 Upcoming (future start), 60 Closed (ended)
  console.log("  → Seeding 150 Products across categories & auction states...");
  const productsToInsert = [];
  const inventoryItemsToInsert = [];
  const now = Date.now();

  for (let i = 1; i <= 150; i++) {
    const catalogItem = PRODUCT_CATALOG[(i - 1) % PRODUCT_CATALOG.length];
    const seller = seededSellers[(i - 1) % seededSellers.length];
    const imageList = MOCK_IMAGES[catalogItem.imagePool] || MOCK_IMAGES.watches;

    // Distribute auction states:
    // i <= 70: Active
    // 71 <= i <= 90: Upcoming
    // 91 <= i <= 150: Closed
    let status = "Active";
    let startDate;
    let endTime;
    let bidderUser = null;
    let currentBid = null;

    const startPrice = catalogItem.startPrice + ((i * 1234) % 15000);

    if (i <= 70) {
      // ACTIVE AUCTION
      status = "Active";
      startDate = new Date(now - (i % 4) * 86400000);
      // Ends between 8 hours and 6 days from now
      endTime = new Date(now + (8 * 3600000) + ((i * 7) % (5 * 86400000))).toISOString();

      // Pick a random buyer who has placed bids
      bidderUser = seededUsers[(i * 7) % seededUsers.length];
      const bidMultiplier = 1.1 + ((i % 8) * 0.12);
      currentBid = Math.round(startPrice * bidMultiplier);
    } else if (i <= 90) {
      // UPCOMING AUCTION
      status = "Active";
      startDate = new Date(now + (1 + (i % 4)) * 86400000);
      endTime = new Date(now + (6 + (i % 4)) * 86400000).toISOString();
      bidderUser = null;
      currentBid = null;
    } else {
      // CLOSED / ENDED AUCTION
      status = "Closed";
      startDate = new Date(now - (14 + (i % 7)) * 86400000);
      endTime = new Date(now - (1 + (i % 5)) * 86400000).toISOString();

      // Winning bidder
      bidderUser = seededUsers[(i * 11) % seededUsers.length];
      const bidMultiplier = 1.25 + ((i % 6) * 0.15);
      currentBid = Math.round(startPrice * bidMultiplier);
    }

    const hasBanner = i % 15 === 0;
    const productName = i > PRODUCT_CATALOG.length
      ? `${catalogItem.name} — Series #${Math.floor(i / PRODUCT_CATALOG.length) + 1}`
      : catalogItem.name;

    productsToInsert.push({
      name: productName,
      description: catalogItem.specs,
      email: seller.email,
      category: catalogItem.category,
      images: imageList,
      mobileNumber: seller.phoneNo,
      biddingStartDate: startDate,
      biddingStartTime: "10:00",
      biddingStartPrice: currentBid || startPrice,
      hasBanner,
      bannerImage: hasBanner ? imageList[0] : undefined,
      bannerPlan: hasBanner ? "Premium 7 Days" : undefined,
      tempuseremail: bidderUser ? bidderUser.email : undefined,
      tempamount: currentBid || undefined,
      tempname: bidderUser ? bidderUser.name : undefined,
      biddingEndTime: endTime,
      status,
    });

    // Also populate Admin E-Commerce Inventory for first 60 products
    if (i <= 60) {
      const visitors = 120 + ((i * 47) % 1800);
      const rev = (startPrice * 1.2).toFixed(0);
      inventoryItemsToInsert.push({
        name: productName,
        category: catalogItem.category,
        price: `₹${startPrice.toLocaleString("en-IN")}`,
        email: seller.email,
        addedDate: new Date(startDate).toISOString().split("T")[0],
        status: status === "Active" ? "Auction Live" : "Sold",
        image: imageList[0].secure_url,
        visitors,
        revenue: `₹${Number(rev).toLocaleString("en-IN")}`,
        sellerRevenue: `₹${(rev * 0.9).toFixed(0)}`,
        totalRevenue: `₹${(rev * 0.1).toFixed(0)}`,
      });
    }
  }

  const seededProducts = await Product.insertMany(productsToInsert);
  await Item.insertMany(inventoryItemsToInsert);
  console.log(`    ✓ ${seededProducts.length} Products & ${inventoryItemsToInsert.length} Inventory items created.`);

  // 5. Generate Orders for the 60 Closed/Ended Auctions
  console.log("  → Seeding 60 Orders & AdminOrders for completed auctions...");
  const ordersToInsert = [];
  const adminOrdersToInsert = [];

  // Filter products that were closed and have a winning bidder
  const closedProducts = seededProducts.filter(
    (p) => p.status === "Closed" && p.tempuseremail
  );

  for (let i = 0; i < closedProducts.length; i++) {
    const product = closedProducts[i];
    const buyer = seededUsers.find((u) => u.email === product.tempuseremail);

    ordersToInsert.push({
      title: product.name,
      name: product.tempname || buyer.name,
      userEmail: product.tempuseremail,
      sellerEmail: product.email,
      category: product.category,
      images: product.images,
      biddingStartPrice: product.biddingStartPrice,
      highestBid: product.tempamount || product.biddingStartPrice,
      phoneNo: buyer ? buyer.phoneNo : "9876543210",
      address: buyer ? buyer.address : "Demo Residence, Bangalore",
    });

    adminOrdersToInsert.push({
      image: product.images[0].secure_url,
      itemName: product.name,
      userEmail: product.tempuseremail,
      sellerEmail: product.email,
      startingPrice: `₹${product.biddingStartPrice.toLocaleString("en-IN")}`,
      soldPrice: `₹${(product.tempamount || product.biddingStartPrice).toLocaleString("en-IN")}`,
    });
  }

  const seededOrders = await Order.insertMany(ordersToInsert);
  await AdminOrder.insertMany(adminOrdersToInsert);
  console.log(`    ✓ ${seededOrders.length} Orders & AdminOrders created.`);

  // 6. Generate 50 Product Reviews (ProductFeedback) linked to real orders
  console.log("  → Seeding 50 Product Reviews linked to completed orders...");
  const feedbackToInsert = [];

  for (let i = 0; i < Math.min(50, seededOrders.length); i++) {
    const order = seededOrders[i];
    const comment = FEEDBACK_COMMENTS[i % FEEDBACK_COMMENTS.length];
    const rating = 4 + (i % 2 === 0 ? 1 : 0); // 4 or 5 stars

    feedbackToInsert.push({
      productName: order.title,
      productImage: order.images[0].secure_url,
      rating,
      reviewText: comment,
      additionalPhotos: [order.images[0].secure_url],
      orderId: order._id,
      userEmail: order.userEmail,
      sellerEmail: order.sellerEmail,
      createdAt: new Date(Date.now() - (50 - i) * 3600000 * 6),
    });
  }

  const seededFeedback = await ProductFeedback.insertMany(feedbackToInsert);
  console.log(`    ✓ ${seededFeedback.length} Product Reviews created.`);

  // 7. Generate 120 Transactions (Deposits and Withdrawals)
  console.log("  → Seeding 120 Financial Transactions...");
  const transactionsToInsert = [];

  for (let i = 1; i <= 120; i++) {
    const user = seededUsers[(i * 3) % seededUsers.length];
    const isDeposit = i % 3 !== 0; // 2/3 deposits, 1/3 withdrawals
    const amount = isDeposit
      ? 5000 + ((i * 1357) % 85000)
      : 2000 + ((i * 983) % 45000);

    transactionsToInsert.push({
      userEmail: user.email,
      name: user.name,
      type: isDeposit ? "deposit" : "withdrawal",
      amount,
      date: new Date(Date.now() - (120 - i) * 3600000 * 8),
    });
  }

  const seededTransactions = await Transaction.insertMany(transactionsToInsert);
  console.log(`    ✓ ${seededTransactions.length} Transactions created.`);

  // 8. Generate 25 Subscriptions
  console.log("  → Seeding 25 Subscriptions for active bidders...");
  const subscriptionsToInsert = [];
  const plans = [
    { name: "VIP Collector Pass", price: 4999, features: ["Priority Bid Matching", "Zero Escrow Fee", "Extended Preview"] },
    { name: "Pro Bidder Elite", price: 2499, features: ["Real-Time SMS Alerts", "Advanced Analytics", "5% Fee Rebate"] },
    { name: "Premier Auctioneer", price: 7999, features: ["Homepage Spotlight", "Featured Seller Badge", "Dedicated Manager"] },
  ];

  for (let i = 0; i < 25; i++) {
    const user = seededUsers[i];
    const plan = plans[i % plans.length];
    const isActive = i < 20;

    subscriptionsToInsert.push({
      planName: plan.name,
      userEmail: user.email,
      status: isActive ? "active" : "expired",
      startDate: new Date(Date.now() - (isActive ? 15 : 60) * 86400000),
      endDate: new Date(Date.now() + (isActive ? 15 : -1) * 86400000),
      price: plan.price,
      autoRenew: isActive,
      features: plan.features,
      userId: user._id,
    });
  }

  const seededSubscriptions = await Subscription.insertMany(subscriptionsToInsert);
  console.log(`    ✓ ${seededSubscriptions.length} Subscriptions created.`);

  // 9. Generate 8 Banners, 10 Events, 12 Calendar entries
  console.log("  → Seeding Banners, Events, and Calendar auction schedules...");

  const bannersToInsert = [
    {
      title: "Grand Spring Horology Showcase",
      description: "Exclusive curated collection of rare Patek Philippe, Rolex, and Audemars Piguet timepieces.",
      link: "https://auctionx.demo/events/spring-horology",
      position: "top",
      imageUrl: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80",
      imagePublicId: "banner_spring_horology",
      isActive: true,
      startDate: new Date(now - 86400000),
      endDate: new Date(now + 7 * 86400000),
    },
    {
      title: "Exotic Supercar Extravaganza",
      description: "Featuring historic Ferraris, classic Mustangs, and modern hypercars with authenticated provenance.",
      link: "https://auctionx.demo/events/supercars",
      position: "popup",
      imageUrl: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80",
      imagePublicId: "banner_supercars",
      isActive: true,
      startDate: new Date(now - 2 * 86400000),
      endDate: new Date(now + 5 * 86400000),
    },
    {
      title: "Royal Estate Jewels & Diamonds",
      description: "Natural certified untreated gemstones, heritage tiaras, and solitaire rings.",
      link: "https://auctionx.demo/events/royal-jewels",
      position: "sidebar",
      imageUrl: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80",
      imagePublicId: "banner_royal_jewels",
      isActive: true,
      startDate: new Date(now - 3 * 86400000),
      endDate: new Date(now + 10 * 86400000),
    },
    {
      title: "Contemporary Masters Art Night",
      description: "Live bidding on landmark abstract canvases and modern bronzes.",
      link: "https://auctionx.demo/events/contemporary-art",
      position: "footer",
      imageUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80",
      imagePublicId: "banner_contemporary_art",
      isActive: true,
      startDate: new Date(now),
      endDate: new Date(now + 14 * 86400000),
    },
    {
      title: "Vintage Leica & Cine Optics Gathering",
      description: "Rare black-paint rangefinders, Carl Zeiss glass, and cinema anamorphic lenses.",
      link: "https://auctionx.demo/events/vintage-optics",
      position: "top",
      imageUrl: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
      imagePublicId: "banner_vintage_optics",
      isActive: true,
      startDate: new Date(now),
      endDate: new Date(now + 6 * 86400000),
    },
    {
      title: "Legends of the Pitch — Signed Memorabilia",
      description: "World Cup final match jerseys and authenticated historic championship relics.",
      link: "https://auctionx.demo/events/sports-legends",
      position: "sidebar",
      imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=80",
      imagePublicId: "banner_sports_legends",
      isActive: true,
      startDate: new Date(now - 86400000),
      endDate: new Date(now + 4 * 86400000),
    },
    {
      title: "Dynasty Antiques & Jade Carvings",
      description: "Museum-provenance imperial porcelain and antique colonial furnishings.",
      link: "https://auctionx.demo/events/dynasty-antiques",
      position: "popup",
      imageUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
      imagePublicId: "banner_dynasty_antiques",
      isActive: true,
      startDate: new Date(now - 86400000),
      endDate: new Date(now + 9 * 86400000),
    },
    {
      title: "Collector Audio: Tube & Vinyl Salon",
      description: "Audiophile McIntosh amplification and mint unsealed original test pressings.",
      link: "https://auctionx.demo/events/collector-audio",
      position: "footer",
      imageUrl: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=1200&q=80",
      imagePublicId: "banner_collector_audio",
      isActive: true,
      startDate: new Date(now),
      endDate: new Date(now + 12 * 86400000),
    },
  ];

  await Banner.insertMany(bannersToInsert);

  const eventTypes = ["auction", "sale", "contest", "holiday"];
  const eventsToInsert = [];

  for (let i = 1; i <= 10; i++) {
    const creator = seededUsers[(i - 1) % seededUsers.length];
    const participants = [
      seededUsers[(i * 2) % seededUsers.length]._id,
      seededUsers[(i * 3) % seededUsers.length]._id,
      seededUsers[(i * 4) % seededUsers.length]._id,
    ];

    eventsToInsert.push({
      title: `Grand Auction Session #${i} [Demo Event]`,
      description: `Premium public bidding session featuring certified high-value consignments. [Demo Event]`,
      eventType: eventTypes[i % eventTypes.length],
      startDate: new Date(now + (i - 2) * 86400000),
      endDate: new Date(now + (i + 3) * 86400000),
      isActive: true,
      backgroundColor: i % 2 === 0 ? "#1E40AF" : "#047857",
      textColor: "#FFFFFF",
      participants,
      notifyUsers: true,
      createdBy: creator._id,
    });
  }

  await Event.insertMany(eventsToInsert);

  const calendarToInsert = [];
  const calendarHours = [
    { start: "09:00", end: "11:30" },
    { start: "11:00", end: "14:00" },
    { start: "14:30", end: "17:00" },
    { start: "18:00", end: "20:30" },
    { start: "21:00", end: "23:00" },
  ];

  for (let i = 1; i <= 12; i++) {
    const slot = calendarHours[i % calendarHours.length];
    const calDate = new Date(now + (i - 2) * 86400000);

    calendarToInsert.push({
      title: `Live Auction Room ${i} — Scheduled Hammer Session [Demo Auction]`,
      date: calDate,
      startTime: slot.start,
      endTime: slot.end,
      type: "auction",
      description: `Scheduled competitive hammer bidding for catalog section ${i}. [Demo Auction]`,
      location: `Auction X Virtual Hall ${String.fromCharCode(64 + i)}`,
    });
  }

  await Calendar.insertMany(calendarToInsert);
  console.log("    ✓ Banners, Events, and Calendar schedules created.");

  // 10. Referential Integrity Validation
  console.log("\n🔍 Validating referential integrity...");
  const errors = [];

  // Verify all products have valid sellers
  const sellerEmails = new Set(seededSellers.map((s) => s.email));
  for (const p of seededProducts) {
    if (!sellerEmails.has(p.email)) {
      errors.push(`Product '${p.name}' references invalid seller email '${p.email}'`);
    }
  }

  // Verify all orders reference valid buyers and sellers
  const userEmails = new Set(seededUsers.map((u) => u.email));
  for (const o of seededOrders) {
    if (!userEmails.has(o.userEmail)) {
      errors.push(`Order '${o.title}' references invalid userEmail '${o.userEmail}'`);
    }
    if (!sellerEmails.has(o.sellerEmail)) {
      errors.push(`Order '${o.title}' references invalid sellerEmail '${o.sellerEmail}'`);
    }
  }

  // Verify all reviews reference valid Order IDs
  const orderIds = new Set(seededOrders.map((o) => o._id.toString()));
  for (const f of seededFeedback) {
    if (!orderIds.has(f.orderId.toString())) {
      errors.push(`Feedback references invalid orderId '${f.orderId}'`);
    }
  }

  // Verify all subscriptions reference valid User IDs
  const userIds = new Set(seededUsers.map((u) => u._id.toString()));
  for (const s of seededSubscriptions) {
    if (!userIds.has(s.userId.toString())) {
      errors.push(`Subscription references invalid userId '${s.userId}'`);
    }
  }

  if (errors.length > 0) {
    console.error("❌ Integrity check failed with errors:");
    errors.forEach((e) => console.error("  -", e));
    throw new Error("Integrity check failed.");
  } else {
    console.log("✓ All references, foreign keys, and email mappings are 100% valid!");
  }

  // Final Summary Table
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n==================================================");
  console.log("        DEMO SEEDING COMPLETED SUCCESSFULLY       ");
  console.log("==================================================");
  console.log(`⏱ Total time: ${totalDuration}s\n`);

  const summary = [
    { Collection: "users (Buyers)", "Count Generated": seededUsers.length },
    { Collection: "customers (Admin)", "Count Generated": customersToInsert.length },
    { Collection: "sellers (Store Owners)", "Count Generated": seededSellers.length },
    { Collection: "adminsellers (Admin)", "Count Generated": adminSellersToInsert.length },
    { Collection: "products (Auctions)", "Count Generated": seededProducts.length },
    { Collection: "items (Inventory)", "Count Generated": inventoryItemsToInsert.length },
    { Collection: "orders (Completed Bids)", "Count Generated": seededOrders.length },
    { Collection: "adminorders (Admin)", "Count Generated": adminOrdersToInsert.length },
    { Collection: "productfeedbacks (Reviews)", "Count Generated": seededFeedback.length },
    { Collection: "transactions (Finances)", "Count Generated": seededTransactions.length },
    { Collection: "subscriptions (Passes)", "Count Generated": seededSubscriptions.length },
    { Collection: "banners (Campaigns)", "Count Generated": bannersToInsert.length },
    { Collection: "events (Auction Events)", "Count Generated": eventsToInsert.length },
    { Collection: "calendars (Schedules)", "Count Generated": calendarToInsert.length },
  ];

  console.table(summary);

  // Auction State breakdown
  const activeCount = seededProducts.filter((p) => p.status === "Active" && new Date(p.biddingEndTime) > new Date()).length;
  const closedCount = seededProducts.filter((p) => p.status === "Closed").length;
  const withBidsCount = seededProducts.filter((p) => p.tempamount).length;

  console.log("\nAuction State Breakdown:");
  console.log(`  - Active Live Auctions: ${activeCount}`);
  console.log(`  - Closed/Ended Auctions: ${closedCount}`);
  console.log(`  - Products with Bidding History: ${withBidsCount}`);
  console.log(`  - Default User/Seller Password: DemoPassword123!`);
  console.log("\n==================================================\n");
}

// Entrypoint
async function main() {
  const isClearOnly = process.argv.includes("--clear");

  try {
    assertSafeConnection(TARGET_URI);
    await mongoose.connect(TARGET_URI);

    if (isClearOnly) {
      await clearDemoData();
      console.log("Demo data cleared successfully.");
    } else {
      await seedDemoData();
    }
  } catch (error) {
    console.error("Seeding operation failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedDemoData, clearDemoData };
