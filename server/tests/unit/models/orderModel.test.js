const mongoose = require("mongoose");
const Order = require("../../../src/modules/orders/models/orderSchema");

describe("Order Model Unit Tests", () => {
  it("should validate a valid order instance", () => {
    const validOrder = new Order({
      title: "MacBook Pro M3",
      name: "Buyer Bob",
      userEmail: "buyer@example.com",
      sellerEmail: "seller@example.com",
      category: "Laptops",
      images: [{ secure_url: "https://example.com/macbook.jpg", public_id: "mac_123" }],
      biddingStartPrice: 100000,
      highestBid: 125000,
      phoneNo: "9876543210",
      address: "456 Tech Park, Bangalore",
    });

    const err = validOrder.validateSync();
    expect(err).toBeUndefined();
    expect(validOrder.highestBid).toBe(125000);
  });

  it("should fail validation when required fields are missing", () => {
    const incompleteOrder = new Order({
      title: "MacBook Pro M3",
    });

    const err = incompleteOrder.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.userEmail).toBeDefined();
    expect(err.errors.sellerEmail).toBeDefined();
    expect(err.errors.phoneNo).toBeDefined();
    expect(err.errors.address).toBeDefined();
  });

  it("should default highestBid to 0", () => {
    const order = new Order({
      title: "MacBook Pro M3",
      name: "Buyer Bob",
      userEmail: "buyer@example.com",
      sellerEmail: "seller@example.com",
      category: "Laptops",
      images: [{ secure_url: "https://example.com/macbook.jpg", public_id: "mac_123" }],
      biddingStartPrice: 100000,
      phoneNo: "9876543210",
      address: "456 Tech Park, Bangalore",
    });

    expect(order.highestBid).toBe(0);
  });
});
