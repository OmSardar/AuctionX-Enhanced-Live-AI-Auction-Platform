const { DEMO_CATALOGUE } = require("../../scripts/data/demoCatalogueData");
const { assertSafeConnection } = require("../../scripts/data/seedDemoCatalogue");
const Product = require("../../src/modules/products/models/productSchema");

describe("Demo Product Catalogue & Seeding Invariants", () => {
  it("should define exactly 20 demo catalogue products", () => {
    expect(Array.isArray(DEMO_CATALOGUE)).toBe(true);
    expect(DEMO_CATALOGUE.length).toBe(20);
  });

  it("should ensure every demo product is priced strictly between ₹1 and ₹400 maximum", () => {
    for (const item of DEMO_CATALOGUE) {
      expect(typeof item.price).toBe("number");
      expect(item.price).toBeGreaterThan(0);
      expect(item.price).toBeLessThanOrEqual(400);
      expect(item.biddingStartPrice).toBe(item.price);
    }
  });

  it("should distribute products across realistic categories", () => {
    const categories = new Set(DEMO_CATALOGUE.map((item) => item.category));
    expect(categories.has("Home & Kitchen")).toBe(true);
    expect(categories.has("Stationery")).toBe(true);
    expect(categories.has("Electronics Accessories")).toBe(true);
    expect(categories.has("Fashion")).toBe(true);
    expect(categories.has("Accessories")).toBe(true);
    expect(categories.has("Home Decor")).toBe(true);
    expect(categories.has("Personal Care")).toBe(true);
    expect(categories.size).toBeGreaterThanOrEqual(5);
  });

  it("should contain realistic, structured descriptions and local image paths", () => {
    for (const item of DEMO_CATALOGUE) {
      expect(item.name).toBeTruthy();
      expect(item.slug).toMatch(/^demo-/);
      expect(Array.isArray(item.description)).toBe(true);
      expect(item.description.length).toBeGreaterThanOrEqual(3);

      for (const spec of item.description) {
        expect(spec.name).toBeTruthy();
        expect(spec.description).toBeTruthy();
      }

      expect(item.image).toBeDefined();
      expect(item.image.secure_url).toMatch(/^\/demo-products\/[a-z0-9-]+\.jpg$/);
      expect(item.image.public_id).toMatch(/^demo_/);
    }
  });

  it("should validate every demo product against the canonical Product schema", () => {
    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 86400000);

    for (const item of DEMO_CATALOGUE) {
      const productInstance = new Product({
        name: item.name,
        description: item.description,
        email: "seller_demo@auctionx.demo",
        category: item.category,
        images: [item.image],
        mobileNumber: "9876543210",
        biddingStartDate: now,
        biddingStartTime: "10:00 AM",
        biddingStartPrice: item.price,
        startingPrice: item.price,
        currentPrice: item.price,
        biddingEndTime: endDate.toISOString(),
        status: "Active",
      });

      const validationError = productInstance.validateSync();
      expect(validationError).toBeUndefined();
      expect(productInstance.status).toBe("Active");
      expect(productInstance.biddingStartPrice).toBeLessThanOrEqual(400);
    }
  });

  it("assertSafeConnection should reject remote Atlas, production, and Auction-X-Major databases", () => {
    const originalEnv = process.env.NODE_ENV;

    // Test rejection of Atlas URL
    expect(() => {
      assertSafeConnection("mongodb+srv://user:pass@cluster0.tolhj.mongodb.net/Auction-X");
    }).toThrow();

    // Test rejection of database named Auction-X-Major
    expect(() => {
      assertSafeConnection("mongodb://127.0.0.1:27017/Auction-X-Major");
    }).toThrow();

    // Test rejection under production NODE_ENV
    process.env.NODE_ENV = "production";
    expect(() => {
      assertSafeConnection("mongodb://127.0.0.1:27017/Auction-X");
    }).toThrow();

    process.env.NODE_ENV = originalEnv;
  });
});

