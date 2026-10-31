const mongoose = require("mongoose");
const Seller = require("../../../src/modules/sellers/accounts/models/seller");

describe("Seller Model Unit Tests", () => {
  it("should validate a valid seller model instance", () => {
    const validSeller = new Seller({
      name: "Acme Store",
      email: "acme@example.com",
      password: "HashedPassword123!",
      role: "seller",
    });

    const err = validSeller.validateSync();
    expect(err).toBeUndefined();
  });

  it("should fail validation when name is missing", () => {
    const seller = new Seller({
      email: "acme@example.com",
      password: "HashedPassword123!",
    });

    const err = seller.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.name).toBeDefined();
  });

  it("should fail validation when email is missing", () => {
    const seller = new Seller({
      name: "Acme Store",
      password: "HashedPassword123!",
    });

    const err = seller.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.email).toBeDefined();
  });

  it("should default role to 'seller'", () => {
    const seller = new Seller({
      name: "Acme Store",
      email: "acme@example.com",
      password: "HashedPassword123!",
    });

    expect(seller.role).toBe("seller");
  });

  it("should reject invalid role enum", () => {
    const seller = new Seller({
      name: "Invalid Role Seller",
      email: "invalid@example.com",
      password: "HashedPassword123!",
      role: "customer",
    });

    const err = seller.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.role).toBeDefined();
  });
});
