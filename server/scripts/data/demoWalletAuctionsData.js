/**
 * AuctionX — Low-Price Demo Auctions for Live Wallet Verification
 *
 * 10 realistic demo products priced between ₹200 and ₹300:
 * - Batch A (Products 1–4): 5-minute auction duration
 * - Batch B (Products 5–7): 8-minute auction duration
 * - Batch C (Products 8–10): 10-minute auction duration
 *
 * All images are verified locally in client/public/demo-products/.
 */

const DEMO_WALLET_AUCTIONS = [
  // =========================================================================
  // BATCH A: 4 Auctions — 5 Minutes Remaining
  // =========================================================================
  {
    slug: "demo-wallet-auction-1-travel-cup",
    name: "Insulated Stainless Travel Cup",
    category: "Home & Kitchen",
    price: 280,
    biddingStartPrice: 280,
    durationMinutes: 5,
    batchGroup: "Batch A (5m)",
    stock: 15,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/insulated-travel-cup.jpg",
      public_id: "demo_wallet_cup",
    },
    description: [
      { name: "Thermal Vacuum Core", description: "Double-walled 18/8 food-grade stainless steel keeps beverages hot for 6 hours or iced cold for 12 hours." },
      { name: "Spill-Proof Lid", description: "Silicone pressure seal with one-handed flip-top lock prevents leaks during transit or sports." },
      { name: "Ergonomic Grip", description: "Powder-coated matte finish provides non-slip handling and scratch-resistant durability." },
      { name: "Capacity", description: "380ml capacity designed to fit standard cup holders and backpacks." },
    ],
  },
  {
    slug: "demo-wallet-auction-2-reading-light",
    name: "Portable Amber Reading Light",
    category: "Electronics",
    price: 220,
    biddingStartPrice: 220,
    durationMinutes: 5,
    batchGroup: "Batch A (5m)",
    stock: 20,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/reading-light.jpg",
      public_id: "demo_wallet_reading_light",
    },
    description: [
      { name: "Eye-Protection Amber LED", description: "Warm 3000K amber glow eliminates 99% blue light for comfortable nighttime reading." },
      { name: "Flexible Silicone Neck", description: "360-degree bendable neck retains shape effortlessly to pinpoint illumination." },
      { name: "USB Rechargeable", description: "Built-in 600mAh battery delivers up to 10 hours continuous illumination on a single charge." },
      { name: "Multi-Surface Clamp", description: "Padded clip opens up to 3cm, standing upright on desks or clamping securely to books." },
    ],
  },
  {
    slug: "demo-wallet-auction-3-compact-wallet",
    name: "Minimalist Leather Wallet",
    category: "Fashion",
    price: 299,
    biddingStartPrice: 299,
    durationMinutes: 5,
    batchGroup: "Batch A (5m)",
    stock: 14,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/compact-wallet.jpg",
      public_id: "demo_wallet_compact_wallet",
    },
    description: [
      { name: "Genuine Leather", description: "Top-grain handcrafted leather with reinforced saddle stitching for longevity." },
      { name: "RFID Blocking", description: "Integrated electromagnetic shield protects contactless credit cards from unauthorized scans." },
      { name: "Slim Profile", description: "Measures only 0.8cm thick while holding up to 8 cards, currency notes, and quick-access ID." },
      { name: "Pull-Tab Access", description: "Quick-draw nylon pull tab allows instant retrieval of frequently used cards." },
    ],
  },
  {
    slug: "demo-wallet-auction-4-cotton-towels",
    name: "Cotton Hand Towel Set (Pack of 3)",
    category: "Home & Kitchen",
    price: 249,
    biddingStartPrice: 249,
    durationMinutes: 5,
    batchGroup: "Batch A (5m)",
    stock: 18,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/cotton-hand-towels.jpg",
      public_id: "demo_wallet_cotton_towels",
    },
    description: [
      { name: "100% Combed Cotton", description: "550 GSM plush combed cotton fibers deliver ultra-soft skin feel and quick moisture absorption." },
      { name: "Durable Double Hemming", description: "Reinforced double-stitched borders prevent fraying after repetitive commercial wash cycles." },
      { name: "Fast Drying", description: "Breathable waffle weave structure promotes swift air drying to resist damp odor buildup." },
      { name: "Dimensions", description: "Set of three matching 40cm x 60cm hand towels in muted contemporary tones." },
    ],
  },

  // =========================================================================
  // BATCH B: 3 Auctions — 8 Minutes Remaining
  // =========================================================================
  {
    slug: "demo-wallet-auction-5-phone-stand",
    name: "Ergonomic Desktop Phone Stand",
    category: "Accessories",
    price: 210,
    biddingStartPrice: 210,
    durationMinutes: 8,
    batchGroup: "Batch B (8m)",
    stock: 25,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/phone-stand.jpg",
      public_id: "demo_wallet_phone_stand",
    },
    description: [
      { name: "Solid Aluminum Alloy", description: "Weighted CNC-machined aluminum base prevents tipping under smartphones and compact tablets." },
      { name: "Multi-Angle Articulation", description: "Dual rotating hinges allow 270-degree angle adjustments for video calls and typing." },
      { name: "Silicone Cushioning", description: "Anti-scratch silicone pads protect device chassis and lock dock firmly on glass or wood." },
      { name: "Cable Pass-Through", description: "Precision rear routing port allows clean cable management while charging." },
    ],
  },
  {
    slug: "demo-wallet-auction-6-flower-vase",
    name: "Ceramic Glazed Flower Vase",
    category: "Home Decor",
    price: 260,
    biddingStartPrice: 260,
    durationMinutes: 8,
    batchGroup: "Batch B (8m)",
    stock: 10,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/ceramic-flower-vase.jpg",
      public_id: "demo_wallet_flower_vase",
    },
    description: [
      { name: "Artisanal Ceramic", description: "Kiln-fired earthenware with a smooth matte reactive glaze finish in contemporary Nordic styling." },
      { name: "Waterproof Interior", description: "Specially treated interior glaze prevents moisture seepage with fresh botanical stems." },
      { name: "Stable Silhouette", description: "Weighted base ensures steady placement on shelves, dinner tables, and console displays." },
      { name: "Height & Proportion", description: "18cm tall with a 7cm neck opening designed for dry grasses and fresh floral bouquets." },
    ],
  },
  {
    slug: "demo-wallet-auction-7-makeup-pouch",
    name: "Compact Cosmetic Makeup Pouch",
    category: "Fashion",
    price: 230,
    biddingStartPrice: 230,
    durationMinutes: 8,
    batchGroup: "Batch B (8m)",
    stock: 22,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/makeup-pouch.jpg",
      public_id: "demo_wallet_makeup_pouch",
    },
    description: [
      { name: "Water-Resistant Fabric", description: "High-density nylon exterior wipes clean and shields toiletries from moisture damage." },
      { name: "Structured Organization", description: "Elastic brush slots, mesh divider pockets, and open central cavity for cosmetics." },
      { name: "Smooth Metal Hardware", description: "Heavy-duty gold-tone metal zipper glides seamlessly with oversized pull ring." },
      { name: "Travel Dimensions", description: "20cm x 12cm x 7cm compact footprint easily fits inside totes and carry-on luggage." },
    ],
  },

  // =========================================================================
  // BATCH C: 3 Auctions — 10 Minutes Remaining
  // =========================================================================
  {
    slug: "demo-wallet-auction-8-cable-organizer",
    name: "Multi-Slot USB Cable Organizer",
    category: "Electronics",
    price: 250,
    biddingStartPrice: 250,
    durationMinutes: 10,
    batchGroup: "Batch C (10m)",
    stock: 30,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/usb-cable-organizer.jpg",
      public_id: "demo_wallet_cable_organizer",
    },
    description: [
      { name: "5-Channel Cable Base", description: "Flexible silicone channels firmly grip power cords, Type-C cables, and headphone wires." },
      { name: "Residue-Free Adhesive", description: "Commercial-grade 3M adhesive backing adheres strongly to wood, metal, plastic, and glass." },
      { name: "Durable Silicone", description: "Anti-static, non-magnetic eco-friendly silicone resists dirt and preserves cable jackets." },
      { name: "Desk Decluttering", description: "Keeps charging heads instantly accessible without falling behind desks or nightstands." },
    ],
  },
  {
    slug: "demo-wallet-auction-9-spray-bottle",
    name: "Reusable Mist Spray Bottle",
    category: "Home & Kitchen",
    price: 270,
    biddingStartPrice: 270,
    durationMinutes: 10,
    batchGroup: "Batch C (10m)",
    stock: 16,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/water-spray-bottle.jpg",
      public_id: "demo_wallet_spray_bottle",
    },
    description: [
      { name: "Ultra-Fine Continuous Mist", description: "High-pressure 0.3mm nozzle produces prolonged 1.2-second fine aerosol-like spray bursts." },
      { name: "360-Degree Spraying", description: "Can be sprayed sideways or upside down for hard-to-reach plant care or salon hairstyling." },
      { name: "BPA-Free PET Material", description: "Durable food-grade shatterproof PET resin bottle holds 300ml of water or plant tonic." },
      { name: "Ergonomic Trigger", description: "Effortless pump lever reduces hand fatigue compared to standard spray mechanisms." },
    ],
  },
  {
    slug: "demo-wallet-auction-10-laptop-riser",
    name: "Aluminum Laptop Cooling Riser",
    category: "Accessories",
    price: 290,
    biddingStartPrice: 290,
    durationMinutes: 10,
    batchGroup: "Batch C (10m)",
    stock: 12,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/laptop-riser.jpg",
      public_id: "demo_wallet_laptop_riser",
    },
    description: [
      { name: "Ergonomic Elevation", description: "Raises laptop screen 15cm to eye level, improving posture and relieving cervical spine strain." },
      { name: "Passive Thermal Dissipation", description: "Open hollow aluminum structure maximizes air flow to keep laptops running cool." },
      { name: "Protective Silicone Pads", description: "Thick rubber grip pads protect laptop surfaces from scratching and prevent slip." },
      { name: "Universal Compatibility", description: "Engineered to support all 10-inch to 15.6-inch notebooks up to 5kg." },
    ],
  },
];

module.exports = {
  DEMO_WALLET_AUCTIONS,
};

