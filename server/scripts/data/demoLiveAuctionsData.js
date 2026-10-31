/**
 * AuctionX — Official Live Demo Auction Catalogue (Batch 2)
 *
 * 15 realistic marketplace products priced <= ₹400 across diverse categories,
 * partitioned into 3 dynamic countdown duration groups:
 * - Products 1-5: 5-minute auction duration
 * - Products 6-10: 10-minute auction duration
 * - Products 11-15: 20-minute auction duration
 *
 * All images are verified locally in client/public/demo-products/ and server/public/demo-products/.
 */

const DEMO_LIVE_AUCTIONS = [
  // =========================================================================
  // GROUP 1: 5-Minute Live Auctions (Products 1–5)
  // =========================================================================
  {
    slug: "demo-auction-batch-2-mini-bluetooth-speaker",
    name: "Mini Bluetooth Speaker",
    category: "Electronics",
    price: 399,
    biddingStartPrice: 399,
    durationMinutes: 5,
    stock: 12,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/mini-bluetooth-speaker.jpg",
      public_id: "demo_auction_speaker",
    },
    description: [
      { name: "Audio Output", description: "Crisp 5W high-definition speaker with precision passive bass radiator for room-filling sound." },
      { name: "Wireless Connectivity", description: "Bluetooth 5.3 architecture providing up to 10 meters of stable range and instant auto-pairing." },
      { name: "Battery & Playtime", description: "Rechargeable 800mAh lithium battery delivering up to 6 hours continuous music playback via USB-C." },
      { name: "Build & Portability", description: "Pocket-sized aircraft-grade aluminum alloy body with IPX5 water-resistant splash protection." },
    ],
  },
  {
    slug: "demo-auction-batch-2-portable-reading-light",
    name: "Portable Reading Light",
    category: "Electronics",
    price: 199,
    biddingStartPrice: 199,
    durationMinutes: 5,
    stock: 20,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/reading-light.jpg",
      public_id: "demo_auction_reading_light",
    },
    description: [
      { name: "Eye-Care Optical Lens", description: "Warm amber 3000K LED beads engineered to block 99.9% of harmful blue light to prevent eye fatigue." },
      { name: "Stepless Dimming", description: "Touch-sensitive control with 3 color temperatures and continuous brightness dimming." },
      { name: "Flexible Gooseneck", description: "Reinforced 360-degree bendable silicone neck maintains exact position without drooping." },
      { name: "Ergonomic Clip Base", description: "Non-marring padded spring clamp opens up to 3cm, standing upright on desks or clipping to books." },
    ],
  },
  {
    slug: "demo-auction-batch-2-wooden-phone-stand",
    name: "Wooden Phone Stand",
    category: "Accessories",
    price: 149,
    biddingStartPrice: 149,
    durationMinutes: 5,
    stock: 18,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/wooden-phone-stand.jpg",
      public_id: "demo_auction_wooden_stand",
    },
    description: [
      { name: "Eco Craftsmanship", description: "Hand-milled solid American walnut with a natural plant-based protective wax finish." },
      { name: "Dual Groove Geometry", description: "Precision dual-width slots accommodate thick protective cases in both portrait and landscape modes." },
      { name: "Optimal Viewing", description: "Engineered 65-degree tilt angle provides ergonomic hands-free video calls, typing, and video streaming." },
      { name: "Surface Protection", description: "Anti-slip silicone pads on base prevent surface scuffs and keep dock anchored on glass and wood." },
    ],
  },
  {
    slug: "demo-auction-batch-2-insulated-travel-cup",
    name: "Insulated Travel Cup",
    category: "Home & Kitchen",
    price: 349,
    biddingStartPrice: 349,
    durationMinutes: 5,
    stock: 15,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/insulated-travel-cup.jpg",
      public_id: "demo_auction_travel_cup",
    },
    description: [
      { name: "Thermal Insulation", description: "Double-wall vacuum insulation maintains hot drinks for 6 hours or iced beverages cold for 12 hours." },
      { name: "Leak-Proof Design", description: "100% spill-proof flip-top lid with food-grade silicone airtight seal and click-lock security latch." },
      { name: "Material Safety", description: "BPA-free pro-grade 18/8 stainless steel interior leaves zero metallic taste and resists staining." },
      { name: "Form Factor", description: "380ml capacity with tapered base tailored to fit all standard automotive cup holders." },
    ],
  },
  {
    slug: "demo-auction-batch-2-compact-wallet",
    name: "Compact Wallet",
    category: "Fashion",
    price: 299,
    biddingStartPrice: 299,
    durationMinutes: 5,
    stock: 22,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/compact-wallet.jpg",
      public_id: "demo_auction_wallet",
    },
    description: [
      { name: "Minimalist Capacity", description: "Holds 6 debit/credit cards, identification card, and folded currency notes in an ultra-slim profile." },
      { name: "RFID Protection", description: "Integrated certified RFID-blocking composite layer shields cards from unauthorized NFC scanners." },
      { name: "Premium Material", description: "Durable cross-grain vegan PU leather with reinforced perimeter stitching and burnished edges." },
      { name: "Front-Pocket Comfort", description: "Slim 8mm thickness designed for seamless front pocket carry without creating bulk." },
    ],
  },

  // =========================================================================
  // GROUP 2: 10-Minute Live Auctions (Products 6–10)
  // =========================================================================
  {
    slug: "demo-auction-batch-2-mini-led-desk-lamp",
    name: "Mini LED Desk Lamp",
    category: "Home Decor",
    price: 399,
    biddingStartPrice: 399,
    durationMinutes: 10,
    stock: 14,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/led-desk-lamp.jpg",
      public_id: "demo_auction_desk_lamp",
    },
    description: [
      { name: "Modern Lighting", description: "Flicker-free diffusion panel providing uniform glare-free illumination for reading and workstation tasks." },
      { name: "Color Temperature Modes", description: "3 lighting presets: Warm White (3000K), Natural Light (4500K), and Cool White (6000K)." },
      { name: "Energy Consumption", description: "Eco-friendly 4W LED array with 30,000-hour operational lifespan and low thermal emission." },
      { name: "Weighted Base", description: "Anti-tip weighted pedestal with responsive capacitive touch button and smooth dimming curve." },
    ],
  },
  {
    slug: "demo-auction-batch-2-printed-ceramic-coaster-set",
    name: "Printed Ceramic Coaster Set",
    category: "Home Decor",
    price: 179,
    biddingStartPrice: 179,
    durationMinutes: 10,
    stock: 25,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/ceramic-coasters.jpg",
      public_id: "demo_auction_coasters",
    },
    description: [
      { name: "Set Configuration", description: "Pack of 4 round 10cm ceramic drink coasters featuring vibrant artisanal bohemian geometric artwork." },
      { name: "Moisture Absorption", description: "Porous earthenware stone rapidly absorbs condensation droplets within 10 to 15 seconds." },
      { name: "Surface Protection", description: "Natural non-scratch cork backing prevents table scrapes and eliminates slipping on polished wood or glass." },
      { name: "Easy Maintenance", description: "Stain-resistant ceramic surface wipes clean effortlessly with mild water and air dries quickly." },
    ],
  },
  {
    slug: "demo-auction-batch-2-usb-cable-organizer",
    name: "USB Cable Organizer",
    category: "Electronics",
    price: 99,
    biddingStartPrice: 99,
    durationMinutes: 10,
    stock: 35,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/usb-cable-organizer.jpg",
      public_id: "demo_auction_cable_organizer",
    },
    description: [
      { name: "Channel Layout", description: "5-slot flexible silicone cord holder securely grips charger cables, audio wires, and peripherals." },
      { name: "Strong Adhesive", description: "Pre-mounted heavy-duty acrylic adhesive tape bonds securely to wood, metal, plastic, and ceramic tiles." },
      { name: "Universal Sizing", description: "Accommodates all standard cords up to 6mm in diameter including Type-C, Lightning, and HDMI cables." },
      { name: "Cable Preservation", description: "Soft high-grade silicone prevents wire pinching, kinks, and connector fraying at desk edges." },
    ],
  },
  {
    slug: "demo-auction-batch-2-reusable-water-spray-bottle",
    name: "Reusable Water Spray Bottle",
    category: "Home & Kitchen",
    price: 149,
    biddingStartPrice: 149,
    durationMinutes: 10,
    stock: 28,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/water-spray-bottle.jpg",
      public_id: "demo_auction_spray_bottle",
    },
    description: [
      { name: "Ultra-Fine Mist", description: "0.3mm micro-nozzle delivers continuous aerosol-quality fine mist without toxic propellant gases." },
      { name: "Ergonomic Trigger", description: "Smooth pump handle engineered to reduce hand strain during prolonged misting sessions." },
      { name: "Multi-Purpose Use", description: "Ideal for misting delicate indoor succulents, hair styling hydration, facial spritzing, and garment steaming." },
      { name: "Durable Reservoir", description: "200ml BPA-free transparent PET plastic body with reinforced leak-tight threading." },
    ],
  },
  {
    slug: "demo-auction-batch-2-minimalist-key-holder",
    name: "Minimalist Key Holder",
    category: "Accessories",
    price: 199,
    biddingStartPrice: 199,
    durationMinutes: 10,
    stock: 20,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/minimalist-key-holder.jpg",
      public_id: "demo_auction_key_holder",
    },
    description: [
      { name: "Magnetic Suspension", description: "Concealed heavy-duty N52 neodymium magnet holds up to 2.5kg of keys, fobs, and pocket tools." },
      { name: "Solid Beechwood", description: "Lathe-turned natural beechwood cylinder with smooth chamfered edges and clear satin varnish." },
      { name: "Zero-Drill Mounting", description: "Supplied with high-tack foam adhesive pad for drill-free mounting on drywall, tile, and entryway walls." },
      { name: "Compact Size", description: "Understated 4cm diameter footprint integrates seamlessly into modern entryways and home offices." },
    ],
  },

  // =========================================================================
  // GROUP 3: 20-Minute Live Auctions (Products 11–15)
  // =========================================================================
  {
    slug: "demo-auction-batch-2-cotton-hand-towel-set",
    name: "Cotton Hand Towel Set",
    category: "Home & Kitchen",
    price: 249,
    biddingStartPrice: 249,
    durationMinutes: 20,
    stock: 16,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/cotton-hand-towels.jpg",
      public_id: "demo_auction_hand_towels",
    },
    description: [
      { name: "Cotton Density", description: "Woven from 100% natural ring-spun combed long-staple cotton at a luxurious 550 GSM weight." },
      { name: "Package Content", description: "Set of 2 generously sized 40cm x 65cm hand towels with ribbed decorative weave borders." },
      { name: "Fast Drying", description: "High-loft terry loops ensure maximum water absorbency while drying rapidly to prevent odor build-up." },
      { name: "Reinforced Edges", description: "Double-stitched durable side seams prevent unraveling across hundreds of wash cycles." },
    ],
  },
  {
    slug: "demo-auction-batch-2-compact-makeup-pouch",
    name: "Compact Makeup Pouch",
    category: "Fashion",
    price: 199,
    biddingStartPrice: 199,
    durationMinutes: 20,
    stock: 18,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/makeup-pouch.jpg",
      public_id: "demo_auction_makeup_pouch",
    },
    description: [
      { name: "Internal Organization", description: "Wide-opening clamshell design with side gussets, interior zippered stash pocket, and 3 elastic brush slots." },
      { name: "Waterproof Fabric", description: "Silky quilted water-repellent nylon outer with wipe-clean polyester lining protecting bags from leaks." },
      { name: "Sturdy Hardware", description: "Custom electroplated gold-tone metal zipper glide with self-locking teeth and smooth pull." },
      { name: "Versatile Travel Size", description: "Dimensions: 18cm x 11cm x 7cm; fits compacts, foundations, cosmetic brushes, and daily toiletries." },
    ],
  },
  {
    slug: "demo-auction-batch-2-mini-plant-pot",
    name: "Mini Plant Pot",
    category: "Home Decor",
    price: 129,
    biddingStartPrice: 129,
    durationMinutes: 20,
    stock: 24,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/mini-plant-pot.jpg",
      public_id: "demo_auction_plant_pot",
    },
    description: [
      { name: "Geometric Sculpting", description: "Modern faceted geometric succulent planter finished in earthy matte unglazed terracotta." },
      { name: "Drainage System", description: "Built-in bottom drainage hole prevents overwatering and root rot in desert and tropical houseplants." },
      { name: "Bamboo Base Plate", description: "Includes matching carved natural bamboo saucer to catch excess irrigation water and protect desks." },
      { name: "Dimensions", description: "Compact 8.5cm diameter x 7.5cm height; tailored for windowsill herb and succulent displays." },
    ],
  },
  {
    slug: "demo-auction-batch-2-adjustable-laptop-riser",
    name: "Adjustable Laptop Riser",
    category: "Accessories",
    price: 399,
    biddingStartPrice: 399,
    durationMinutes: 20,
    stock: 15,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/laptop-riser.jpg",
      public_id: "demo_auction_laptop_riser",
    },
    description: [
      { name: "Multi-Angle Elevation", description: "6 adjustable tilt angles ranging from 15 to 45 degrees elevating screens to ergonomic eye level." },
      { name: "Thermal Heat Dissipation", description: "Open-frame ventilated aluminum construction enhances cooling airflow around laptop vents." },
      { name: "Foldable Travel Design", description: "Folds down instantly to 24cm x 4.5cm baton shape; includes soft flannel protective travel bag." },
      { name: "Heavy-Duty Capacity", description: "Aircraft-grade sandblasted aluminum supports up to 10kg, fitting all laptops from 10 to 15.6 inches." },
    ],
  },
  {
    slug: "demo-auction-batch-2-stainless-steel-keychain",
    name: "Stainless Steel Keychain",
    category: "Accessories",
    price: 99,
    biddingStartPrice: 99,
    durationMinutes: 20,
    stock: 30,
    condition: "Brand New",
    image: {
      secure_url: "/demo-products/steel-keychain.jpg",
      public_id: "demo_auction_keychain",
    },
    description: [
      { name: "Material Grade", description: "Solid 304 marine-grade rustproof stainless steel with satin brushed anti-scratch finish." },
      { name: "Integrated Utility", description: "Engineered with quick-clip spring carabiner gate, flat key split ring, and built-in bottle opener." },
      { name: "Secure Latching", description: "Precision torsion spring prevents accidental unhooking from belt loops, backpacks, and lanyard straps." },
      { name: "Compact EDC Profile", description: "Ultra-compact 32g weight with 7cm overall length for everyday pocket carry." },
    ],
  },
];

module.exports = {
  DEMO_LIVE_AUCTIONS,
};

