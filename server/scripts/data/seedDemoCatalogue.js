/**
 * AuctionX — Demo Product Catalogue Seeder (Idempotent & Safe)
 *
 * Populates local development MongoDB with a verified 20-product catalogue
 * priced strictly at or below ₹400 maximum.
 *
 * SAFETY INVARIANTS:
 * - Strictly targets local development database (refuses Atlas, remote, or 'Auction-X-Major').
 * - Idempotent: Can be run repeatedly without creating duplicates.
 * - Non-destructive: Never drops collections or touches real user products.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Product = require("../../src/modules/products/models/productSchema");
const Item = require("../../src/modules/admin/listings/models/inventory");
const Seller = require("../../src/modules/sellers/accounts/models/seller");
const AdminSeller = require("../../src/modules/admin/sellers/models/adminSeller");
const User = require("../../src/modules/users/models/user");
const { DEMO_CATALOGUE } = require("./demoCatalogueData");

const DEMO_DOMAIN = "auctionx.demo";
const DEMO_SELLER_EMAIL = `seller_demo@${DEMO_DOMAIN}`;
const DEFAULT_LOCAL_URI = "mongodb://127.0.0.1:27017/Auction-X";
const TARGET_URI =
  process.env.DEMO_MONGODB_URL ||
  process.env.LOCAL_MONGODB_URL ||
  process.env.MONGODB_URL ||
  DEFAULT_LOCAL_URI;

/**
 * Hard safety check: ensure we NEVER target Atlas, remote production, or Auction-X-Major.
 */
function assertSafeConnection(uri) {
  const lower = (uri || "").toLowerCase();
  if (
    process.env.NODE_ENV === "production" ||
    lower.includes("mongodb+srv") ||
    lower.includes("cluster0") ||
    lower.includes("tolhj") ||
    lower.includes(".net") ||
    lower.includes("atlas") ||
    lower.includes("auction-x-major")
  ) {
    const errorMsg = "❌ CRITICAL SAFETY ERROR: Attempted to run demo seeder against production or remote database!";
    console.error(`\n${errorMsg}`);
    console.error(`Target URI: ${uri ? uri.replace(/:([^:@]+)@/, ":****@") : "undefined"}`);
    console.error("Demo seeding is strictly limited to local development environments.\n");
    throw new Error(errorMsg);
  }
}

async function ensureDemoSeller() {
  let seller = await Seller.findOne({ email: DEMO_SELLER_EMAIL });
  if (!seller) {
    const passwordHash = await bcrypt.hash("DemoSeller123!", 10);
    seller = await Seller.create({
      storeName: "AuctionX Demo Store",
      name: "AuctionX Demo Curator",
      email: DEMO_SELLER_EMAIL,
      phoneNo: "9876543210",
      password: passwordHash,
      address: "100 MG Road, Bangalore",
      city: "Bangalore",
      state: "Karnataka",
      country: "India",
      pinCode: "560001",
      isVerified: true,
      amount: 50000,
      profilePic: [
        {
          secure_url: "/default-profile.png",
          public_id: "demo_seller_profile",
        },
      ],
    });
    console.log(`  ✓ Created verified demo seller: ${DEMO_SELLER_EMAIL}`);
  }

  let adminSeller = await AdminSeller.findOne({ email: DEMO_SELLER_EMAIL });
  if (!adminSeller) {
    await AdminSeller.create({
      name: "AuctionX Demo Curator",
      email: DEMO_SELLER_EMAIL,
      phone: "+91 9876543210",
      businessName: "AuctionX Demo Store",
      status: "active",
      isVerified: true,
      profilePic: [
        {
          secure_url: "/default-profile.png",
          public_id: "demo_admin_seller_profile",
        },
      ],
      createdAt: new Date(),
    });
  }

  return seller;
}

async function seedDemoCatalogue(options = {}) {
  const uri = options.targetUri || TARGET_URI;
  assertSafeConnection(uri);

  const shouldClose = !options.keepConnection;
  if (mongoose.connection.readyState !== 1) {
    console.log(`Connecting to: ${uri}`);
    await mongoose.connect(uri);
    console.log("✓ Connected to MongoDB.");
  }

  console.log("==================================================");
  console.log("     AUCTION X — DEMO CATALOGUE SEEDER (<= ₹400)  ");
  console.log("==================================================");

  // 1. Ensure verified demo seller
  const seller = await ensureDemoSeller();

  const now = new Date();
  const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
  const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days in future

  let createdCount = 0;
  let updatedCount = 0;
  const seededProducts = [];

  for (const item of DEMO_CATALOGUE) {
    // Validate catalogue invariants
    if (item.price > 400 || item.price <= 0) {
      throw new Error(`Invalid price for ${item.name}: ₹${item.price} (must be > 0 and <= 400)`);
    }

    const productPayload = {
      name: item.name,
      description: item.description,
      email: seller.email,
      category: item.category,
      images: [item.image],
      mobileNumber: seller.phoneNo || "9876543210",
      biddingStartDate: startDate,
      biddingStartTime: "10:00 AM",
      biddingStartPrice: item.price,
      startingPrice: item.price,
      currentPrice: item.price,
      biddingEndTime: endDate.toISOString(),
      startTime: startDate,
      originalEndTime: endDate,
      endTime: endDate,
      status: "Active",
      isModerated: false,
      moderationStatus: "ACTIVE",
      tempname: item.slug, // Stable identifier for idempotent upsert
      tempamount: item.price,
      tempuseremail: null,
      bidCount: 0,
      minIncrement: 10,
    };

    // Idempotent upsert matching on tempname (stable slug) OR (name + email)
    const existing = await Product.findOne({
      $or: [
        { tempname: item.slug },
        { name: item.name, email: seller.email },
      ],
    });

    let savedProduct;
    if (existing) {
      Object.assign(existing, productPayload);
      savedProduct = await existing.save();
      updatedCount++;
    } else {
      savedProduct = await Product.create(productPayload);
      createdCount++;
    }
    seededProducts.push(savedProduct);

    // Sync to Admin Inventory Item (Item model)
    const inventoryPayload = {
      name: item.name,
      category: item.category,
      price: `₹${item.price.toLocaleString("en-IN")}`,
      email: seller.email,
      addedDate: startDate.toISOString().split("T")[0],
      status: "Auction Live",
      image: item.image.secure_url,
      visitors: 45 + ((item.price * 3) % 250),
      revenue: `₹${item.price.toLocaleString("en-IN")}`,
      sellerRevenue: `₹${Math.round(item.price * 0.9).toLocaleString("en-IN")}`,
      totalRevenue: `₹${Math.round(item.price * 0.1).toLocaleString("en-IN")}`,
    };

    await Item.findOneAndUpdate(
      { name: item.name, email: seller.email },
      { $set: inventoryPayload },
      { upsert: true, new: true }
    );
  }

  console.log(`\nCatalogue Seeding Complete:`);
  console.log(`  - Total Products in Catalogue: ${DEMO_CATALOGUE.length}`);
  console.log(`  - Newly Created: ${createdCount}`);
  console.log(`  - Updated / Maintained: ${updatedCount}`);
  console.log(`  - Price Range: ₹${Math.min(...DEMO_CATALOGUE.map((p) => p.price))} – ₹${Math.max(...DEMO_CATALOGUE.map((p) => p.price))}`);
  console.log(`  - Maximum Price Ceiling Verified: ₹400`);

  if (shouldClose && mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
    console.log("✓ Disconnected safely from MongoDB.\n");
  }

  return {
    total: DEMO_CATALOGUE.length,
    created: createdCount,
    updated: updatedCount,
    products: seededProducts,
  };
}

if (require.main === module) {
  seedDemoCatalogue()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}

module.exports = {
  seedDemoCatalogue,
  assertSafeConnection,
  DEMO_CATALOGUE,
};
