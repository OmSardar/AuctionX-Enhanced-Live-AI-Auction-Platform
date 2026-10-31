/**
 * Unit & Invariant Test Suite for Batch 2 Live Demo Auctions & Countdown Lifecycle
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const { DEMO_LIVE_AUCTIONS } = require("../../scripts/data/demoLiveAuctionsData");
const {
  assertSafeConnection,
  seedLiveDemoAuctions,
  DEMO_SELLER_EMAIL,
} = require("../../scripts/data/seedLiveDemoAuctions");
const { DEMO_CATALOGUE } = require("../../scripts/data/demoCatalogueData");

const Product = require("../../src/modules/products/models/productSchema");
const Item = require("../../src/modules/admin/listings/models/inventory");
const Seller = require("../../src/modules/sellers/accounts/models/seller");
const {
  finalizeExpiredAuctions,
  finalizeSingleAuction,
  normalizeAuctionBoundaries,
} = require("../../src/modules/auctions/services/lifecycleService");
const { parseAuctionTimeBoundaries } = require("../../src/modules/bidding/middleware/checkTimeRestriction");

describe("Batch 2 Live Demo Auctions & Countdown Testing", () => {
  const TEST_DB_URI = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/auctionx_test_db";

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  afterAll(async () => {
    // Clean up demo products created in test DB
    try {
      await Product.deleteMany({ tempname: { $regex: "^demo-auction-batch-2" } });
      await Item.deleteMany({ email: DEMO_SELLER_EMAIL });
      await Seller.deleteMany({ email: DEMO_SELLER_EMAIL });
    } catch (_) {}
  });

  describe("1. Catalogue Data & Group Invariants", () => {
    test("defines exactly 15 demo products in Batch 2", () => {
      expect(DEMO_LIVE_AUCTIONS).toHaveLength(15);
    });

    test("every product is priced strictly between ₹1 and ₹400", () => {
      DEMO_LIVE_AUCTIONS.forEach((product) => {
        expect(product.price).toBeGreaterThan(0);
        expect(product.price).toBeLessThanOrEqual(400);
        expect(product.biddingStartPrice).toBe(product.price);
        expect(typeof product.price).toBe("number");
      });
    });

    test("distributes products into three exact groups (5m, 10m, 20m)", () => {
      const group5 = DEMO_LIVE_AUCTIONS.slice(0, 5);
      const group10 = DEMO_LIVE_AUCTIONS.slice(5, 10);
      const group20 = DEMO_LIVE_AUCTIONS.slice(10, 15);

      expect(group5).toHaveLength(5);
      expect(group10).toHaveLength(5);
      expect(group20).toHaveLength(5);

      group5.forEach((p) => expect(p.durationMinutes).toBe(5));
      group10.forEach((p) => expect(p.durationMinutes).toBe(10));
      group20.forEach((p) => expect(p.durationMinutes).toBe(20));

      expect(group5.map((p) => p.name)).toEqual([
        "Mini Bluetooth Speaker",
        "Portable Reading Light",
        "Wooden Phone Stand",
        "Insulated Travel Cup",
        "Compact Wallet",
      ]);

      expect(group10.map((p) => p.name)).toEqual([
        "Mini LED Desk Lamp",
        "Printed Ceramic Coaster Set",
        "USB Cable Organizer",
        "Reusable Water Spray Bottle",
        "Minimalist Key Holder",
      ]);

      expect(group20.map((p) => p.name)).toEqual([
        "Cotton Hand Towel Set",
        "Compact Makeup Pouch",
        "Mini Plant Pot",
        "Adjustable Laptop Riser",
        "Stainless Steel Keychain",
      ]);
    });

    test("all products have stable slugs prefixed with demo-auction-batch-2-", () => {
      DEMO_LIVE_AUCTIONS.forEach((product) => {
        expect(product.slug).toMatch(/^demo-auction-batch-2-[a-z0-9-]+$/);
      });
    });

    test("zero collision between Batch 1 and Batch 2 slugs or images", () => {
      const batch1Slugs = new Set(DEMO_CATALOGUE.map((p) => p.slug));
      const batch1Images = new Set(DEMO_CATALOGUE.map((p) => p.image.secure_url));

      DEMO_LIVE_AUCTIONS.forEach((p) => {
        expect(batch1Slugs.has(p.slug)).toBe(false);
        expect(batch1Images.has(p.image.secure_url)).toBe(false);
      });
    });

    test("all 15 image files exist locally in client/public/demo-products and are non-empty", () => {
      const clientPublic = path.resolve(__dirname, "../../../client/public");
      const serverPublic = path.resolve(__dirname, "../../public");

      DEMO_LIVE_AUCTIONS.forEach((product) => {
        const relPath = product.image.secure_url.replace(/^\//, "");
        const clientFile = path.join(clientPublic, relPath);
        const serverFile = path.join(serverPublic, relPath);

        expect(fs.existsSync(clientFile)).toBe(true);
        expect(fs.existsSync(serverFile)).toBe(true);

        const clientStat = fs.statSync(clientFile);
        const serverStat = fs.statSync(serverFile);

        expect(clientStat.size).toBeGreaterThan(15000); // Valid JPEG image > 15KB
        expect(serverStat.size).toBe(clientStat.size);
      });
    });
  });

  describe("2. Seeder Safety & Database Isolation", () => {
    test("assertSafeConnection rejects remote Atlas, production, and Auction-X-Major", () => {
      expect(() =>
        assertSafeConnection("mongodb+srv://user:pass@cluster0.tolhj.mongodb.net/Auction-X")
      ).toThrow("CRITICAL SAFETY ERROR");

      expect(() =>
        assertSafeConnection("mongodb://127.0.0.1:27017/Auction-X-Major")
      ).toThrow("CRITICAL SAFETY ERROR");

      expect(() =>
        assertSafeConnection("mongodb://127.0.0.1:27017/production")
      ).toThrow("CRITICAL SAFETY ERROR");
    });
  });

  describe("3. Seeder Execution, Timing & Idempotency", () => {
    const fixedBaseTime = new Date("2026-10-31T12:00:00.000Z");

    test("seeds all 15 live demo products with accurate dynamic end times", async () => {
      const result = await seedLiveDemoAuctions({
        targetUri: TEST_DB_URI,
        now: fixedBaseTime,
        keepConnection: true,
      });

      expect(result.success).toBe(true);
      expect(result.totalCount).toBe(15);
      expect(result.createdCount + result.updatedCount).toBe(15);

      // Verify in MongoDB
      const products = await Product.find({
        tempname: { $regex: "^demo-auction-batch-2" },
      }).sort({ startingPrice: 1 });

      expect(products).toHaveLength(15);

      // Verify 5-minute group
      const speaker = await Product.findOne({ tempname: "demo-auction-batch-2-mini-bluetooth-speaker" });
      expect(speaker).not.toBeNull();
      expect(speaker.status).toBe("Active");
      expect(speaker.startTime.toISOString()).toBe("2026-10-31T11:59:00.000Z"); // started 1m ago
      expect(speaker.endTime.toISOString()).toBe("2026-10-31T12:05:00.000Z"); // ends in exactly 5m
      expect(speaker.biddingEndTime).toBe("2026-10-31T12:05:00.000Z");

      // Verify 10-minute group
      const lamp = await Product.findOne({ tempname: "demo-auction-batch-2-mini-led-desk-lamp" });
      expect(lamp).not.toBeNull();
      expect(lamp.endTime.toISOString()).toBe("2026-10-31T12:10:00.000Z"); // ends in exactly 10m

      // Verify 20-minute group
      const towels = await Product.findOne({ tempname: "demo-auction-batch-2-cotton-hand-towel-set" });
      expect(towels).not.toBeNull();
      expect(towels.endTime.toISOString()).toBe("2026-10-31T12:20:00.000Z"); // ends in exactly 20m
    });

    test("running seeder a second time is strictly idempotent (0 duplicates)", async () => {
      const laterTime = new Date("2026-10-31T14:00:00.000Z");
      const result = await seedLiveDemoAuctions({
        targetUri: TEST_DB_URI,
        now: laterTime,
        keepConnection: true,
      });

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(0);
      expect(result.updatedCount).toBe(15);

      const count = await Product.countDocuments({
        tempname: { $regex: "^demo-auction-batch-2" },
      });
      expect(count).toBe(15);

      // Check that end time was dynamically refreshed
      const speaker = await Product.findOne({ tempname: "demo-auction-batch-2-mini-bluetooth-speaker" });
      expect(speaker.endTime.toISOString()).toBe("2026-10-31T14:05:00.000Z");
    });
  });

  describe("4. Auction Boundary Normalization & Expiration Evaluation", () => {
    test("normalizes auction start and end boundaries accurately across all 15 products", async () => {
      const products = await Product.find({ tempname: { $regex: "^demo-auction-batch-2" } });
      expect(products).toHaveLength(15);

      products.forEach((prod) => {
        const boundaries = normalizeAuctionBoundaries(prod);
        expect(boundaries.startTime).toBeInstanceOf(Date);
        expect(boundaries.endTime).toBeInstanceOf(Date);
        expect(boundaries.originalEndTime).toBeInstanceOf(Date);
        expect(boundaries.maxExtensionDeadline).toBeInstanceOf(Date);
        expect(boundaries.endTime.getTime()).toBeGreaterThan(boundaries.startTime.getTime());
      });
    });

    test("evaluates remaining milliseconds accurately for each duration group", async () => {
      const speaker = await Product.findOne({ tempname: "demo-auction-batch-2-mini-bluetooth-speaker" });
      const lamp = await Product.findOne({ tempname: "demo-auction-batch-2-mini-led-desk-lamp" });
      const towels = await Product.findOne({ tempname: "demo-auction-batch-2-cotton-hand-towel-set" });

      const baseNow = new Date("2026-10-31T14:00:00.000Z");

      const speakerRemaining = speaker.endTime.getTime() - baseNow.getTime();
      const lampRemaining = lamp.endTime.getTime() - baseNow.getTime();
      const towelsRemaining = towels.endTime.getTime() - baseNow.getTime();

      expect(speakerRemaining).toBe(5 * 60 * 1000);
      expect(lampRemaining).toBe(10 * 60 * 1000);
      expect(towelsRemaining).toBe(20 * 60 * 1000);
    });
  });

  describe("5. Backend Lifecycle Transition & Expiration", () => {
    test("finalizeExpiredAuctions transitions expired auctions to UNSOLD when no bids exist", async () => {
      const speaker = await Product.findOne({ tempname: "demo-auction-batch-2-mini-bluetooth-speaker" });
      expect(speaker.status).toBe("Active");

      // Run finalize with clock set BEFORE endTime (should not finalize)
      const beforeEnd = new Date(speaker.endTime.getTime() - 1000);
      const earlyRes = await finalizeSingleAuction(speaker._id, { now: beforeEnd });
      expect(earlyRes.success).toBe(false);
      expect(earlyRes.reason).toBe("AUCTION_NOT_EXPIRED");

      // Verify product remains Active
      let checkProduct = await Product.findById(speaker._id);
      expect(checkProduct.status).toBe("Active");

      // Advance clock past endTime
      const afterEnd = new Date(speaker.endTime.getTime() + 1000);
      const finalRes = await finalizeSingleAuction(speaker._id, { now: afterEnd });
      expect(finalRes.success).toBe(true);
      expect(finalRes.status).toBe("UNSOLD");

      // Verify status in DB transitioned to UNSOLD
      checkProduct = await Product.findById(speaker._id);
      expect(checkProduct.status).toBe("UNSOLD");
      expect(checkProduct.finalPrice).toBe(speaker.startingPrice);
      expect(checkProduct.finalizedAt).not.toBeNull();
    });
  });

  describe("6. Admin Inventory & INR Formatting", () => {
    test("syncs all 15 products to Admin Inventory with correct INR currency format", async () => {
      const items = await Item.find({ email: DEMO_SELLER_EMAIL });
      expect(items.length).toBeGreaterThanOrEqual(15);

      const speakerItem = await Item.findOne({ name: "Mini Bluetooth Speaker", email: DEMO_SELLER_EMAIL });
      expect(speakerItem).not.toBeNull();
      expect(speakerItem.price).toBe("₹399");
      expect(speakerItem.status).toBe("Auction Live");
      expect(speakerItem.image).toBe("/demo-products/mini-bluetooth-speaker.jpg");
    });
  });
});
