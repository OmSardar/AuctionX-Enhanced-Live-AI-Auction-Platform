/**
 * AuctionX — Live Demo Auction Seeder (Batch 2: 5m, 10m, 20m Countdowns)
 *
 * Populates local development MongoDB with 15 realistic demo products
 * partitioned into 3 dynamic countdown duration groups:
 * - Products 1-5: 5 minutes remaining
 * - Products 6-10: 10 minutes remaining
 * - Products 11-15: 20 minutes remaining
 *
 * SAFETY INVARIANTS:
 * - Strictly targets local development database (refuses Atlas, remote, or 'Auction-X-Major').
 * - Idempotent: Can be run repeatedly without creating duplicates.
 * - Non-destructive: Never drops collections or touches real user products.
 * - Isolated from Batch 1: Does not alter original 20 demo catalogue products.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Product = require("../../src/modules/products/models/productSchema");
const Item = require("../../src/modules/admin/listings/models/inventory");
const Seller = require("../../src/modules/sellers/accounts/models/seller");
const AdminSeller = require("../../src/modules/admin/sellers/models/adminSeller");
const { DEMO_LIVE_AUCTIONS } = require("./demoLiveAuctionsData");

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
    lower.includes("production") ||
    lower.includes("auction-x-major")
  ) {
    const errorMsg = "❌ CRITICAL SAFETY ERROR: Attempted to run demo seeder against production or remote database!";
    console.error(`\n${errorMsg}`);
    console.error(`Target URI: ${uri ? uri.replace(/:([^:@]+)@/, ":****@") : "undefined"}`);
    console.error("Demo seeding is strictly limited to local development environments.\n");
    throw new Error(errorMsg);
  }
}

/**
 * Resolves or safely creates the dedicated local demo seller account.
 */
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
    console.log(`  ✓ Verified demo seller account: ${DEMO_SELLER_EMAIL}`);
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

/**
 * Seeds or updates the 15 dynamic live demo auctions.
 *
 * @param {Object} options
 * @param {string} [options.targetUri] - Database URI
 * @param {Date} [options.now] - Base reference timestamp (defaults to current time)
 * @param {boolean} [options.keepConnection] - If true, does not disconnect after execution
 * @returns {Promise<Object>} Seeding result summary
 */
async function seedLiveDemoAuctions(options = {}) {
  const uri = options.targetUri || TARGET_URI;
  assertSafeConnection(uri);

  const shouldClose = !options.keepConnection;
  if (mongoose.connection.readyState !== 1) {
    console.log(`Connecting to: ${uri}`);
    await mongoose.connect(uri);
    console.log("✓ Connected to MongoDB.");
  }

  console.log("======================================================================");
  console.log("     AUCTION X — BATCH 2 LIVE AUCTIONS SEEDER (5m, 10m, 20m DURATION)  ");
  console.log("======================================================================");

  // 1. Ensure verified demo seller
  const seller = await ensureDemoSeller();

  const now = options.now instanceof Date ? options.now : new Date();
  console.log(`Reference Seeder Timestamp: ${now.toISOString()}`);

  let createdCount = 0;
  let updatedCount = 0;
  const seededProducts = [];

  for (let i = 0; i < DEMO_LIVE_AUCTIONS.length; i++) {
    const item = DEMO_LIVE_AUCTIONS[i];

    // Validate catalogue invariants
    if (item.price > 400 || item.price <= 0) {
      throw new Error(`Invalid price for ${item.name}: ₹${item.price} (must be > 0 and <= 400)`);
    }

    // Dynamic timing calculation:
    // Started 1 minute ago so it is actively LIVE right now
    const auctionStartTime = new Date(now.getTime() - 60 * 1000);
    // Ends exactly durationMinutes after seeder execution
    const auctionEndTime = new Date(now.getTime() + item.durationMinutes * 60 * 1000);
    const maxExtensionDeadline = new Date(auctionEndTime.getTime() + 15 * 60 * 1000);

    const productPayload = {
      name: item.name,
      description: item.description,
      email: seller.email,
      category: item.category,
      images: [item.image],
      mobileNumber: seller.phoneNo || "9876543210",
      biddingStartDate: auctionStartTime,
      biddingStartTime: auctionStartTime.toISOString(),
      biddingStartPrice: item.price,
      startingPrice: item.price,
      currentPrice: item.price,
      biddingEndTime: auctionEndTime.toISOString(),
      startTime: auctionStartTime,
      originalEndTime: auctionEndTime,
      endTime: auctionEndTime,
      maxExtensionDeadline,
      antiSnipeCount: 0,
      status: "Active",
      isModerated: false,
      moderationStatus: "ACTIVE",
      tempname: item.slug, // Stable identifier for idempotent upsert
      tempamount: item.price,
      tempuseremail: null,
      bidCount: 0,
      minIncrement: 10,
      highestBidder: null,
      highestBidderEmail: null,
      highestBidderName: null,
      winnerId: null,
      finalPrice: null,
      finalizedAt: null,
      orderId: null,
      reconciliationRequired: false,
      reconciliationNotes: null,
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

    seededProducts.push({
      index: i + 1,
      name: item.name,
      category: item.category,
      price: item.price,
      durationMinutes: item.durationMinutes,
      startTime: auctionStartTime.toISOString(),
      endTime: auctionEndTime.toISOString(),
      id: savedProduct._id.toString(),
    });

    // Sync to Admin Inventory Item (Item model)
    const inventoryPayload = {
      name: item.name,
      category: item.category,
      price: `₹${item.price.toLocaleString("en-IN")}`,
      email: seller.email,
      addedDate: auctionStartTime.toISOString().split("T")[0],
      status: "Auction Live",
      image: item.image.secure_url,
      visitors: 40 + ((item.price * 2) % 180),
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

  console.log(`\n✓ Seeded Batch 2 Live Auctions: ${createdCount} created, ${updatedCount} updated (Total: ${seededProducts.length})`);
  console.log("----------------------------------------------------------------------");
  console.log(" #  | Product                     | Price | Duration | Scheduled End Time");
  console.log("----------------------------------------------------------------------");
  seededProducts.forEach((p) => {
    const padIndex = String(p.index).padStart(2, " ");
    const padName = p.name.padEnd(27, " ");
    const padPrice = `₹${p.price}`.padStart(5, " ");
    const padDur = `${p.durationMinutes}m`.padStart(8, " ");
    console.log(`${padIndex}  | ${padName} | ${padPrice} | ${padDur} | ${p.endTime}`);
  });
  console.log("----------------------------------------------------------------------\n");

  if (shouldClose) {
    await mongoose.disconnect();
    console.log("✓ Disconnected safely from MongoDB.");
  }

  return {
    success: true,
    createdCount,
    updatedCount,
    totalCount: seededProducts.length,
    products: seededProducts,
  };
}

// Standalone execution support
if (require.main === module) {
  seedLiveDemoAuctions()
    .then(() => {
      console.log("✓ Batch 2 Live Demo Auction Seeding complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ Seeding failed:", err.message);
      process.exit(1);
    });
}

module.exports = {
  assertSafeConnection,
  ensureDemoSeller,
  seedLiveDemoAuctions,
  TARGET_URI,
  DEMO_SELLER_EMAIL,
};
