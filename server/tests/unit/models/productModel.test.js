const mongoose = require("mongoose");
const Product = require("../../../src/modules/products/models/productSchema");

describe("Product Model Unit Tests", () => {
  it("should validate a valid product instance", () => {
    const validProduct = new Product({
      name: "Vintage Rolex Submariner",
      description: [{ name: "Condition", description: "Mint condition" }],
      email: "seller@example.com",
      category: "Watches",
      images: [{ secure_url: "https://example.com/watch.jpg", public_id: "watch_123" }],
      mobileNumber: "9876543210",
      biddingStartDate: new Date(),
      biddingStartTime: "10:00",
      biddingStartPrice: 50000,
      biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
      status: "Active",
    });

    const err = validProduct.validateSync();
    expect(err).toBeUndefined();
    expect(validProduct.status).toBe("Active");
  });

  it("should fail validation when required fields are missing", () => {
    const product = new Product({
      name: "Incomplete Product",
    });

    const err = product.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.email).toBeDefined();
    expect(err.errors.category).toBeDefined();
    expect(err.errors.biddingStartPrice).toBeDefined();
    expect(err.errors.biddingEndTime).toBeDefined();
  });

  it("should default status to 'Active'", () => {
    const product = new Product({
      name: "Default Status Item",
      description: [{ name: "Info", description: "Test" }],
      email: "seller@example.com",
      category: "Art",
      images: [{ secure_url: "https://example.com/art.jpg", public_id: "art_1" }],
      mobileNumber: "9876543210",
      biddingStartDate: new Date(),
      biddingStartTime: "12:00",
      biddingStartPrice: 1000,
      biddingEndTime: new Date(Date.now() + 3600000).toISOString(),
    });

    expect(product.status).toBe("Active");
  });

  it("should reject invalid status enum", () => {
    const product = new Product({
      name: "Item with invalid status",
      description: [{ name: "Info", description: "Test" }],
      email: "seller@example.com",
      category: "Art",
      images: [{ secure_url: "https://example.com/art.jpg", public_id: "art_1" }],
      mobileNumber: "9876543210",
      biddingStartDate: new Date(),
      biddingStartTime: "12:00",
      biddingStartPrice: 1000,
      biddingEndTime: new Date(Date.now() + 3600000).toISOString(),
      status: "Cancelled",
    });

    const err = product.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.status).toBeDefined();
  });
});
