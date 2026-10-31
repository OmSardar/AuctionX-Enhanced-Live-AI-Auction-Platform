/**
 * White-Box Tests — Order Controller Unit Tests
 *
 * Tests internal branching, input validation, ownership checks,
 * and role-based permissions in orderControllers directly with mock req/res.
 */
const orderController = require("../../../src/modules/orders/controllers/orderController");
const Order = require("../../../src/modules/orders/models/orderSchema");
const { clearDatabase } = require("../../helpers/dbHelper");

function createMockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("White-Box Tests — Order Controller", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("createOrder", () => {
    it("should return 400 when required fields are missing", async () => {
      const req = {
        body: { title: "Incomplete Order" },
        user: { email: "user@test.com", name: "User" },
      };
      const res = createMockResponse();

      await orderController.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "All required fields must be provided",
        })
      );
    });

    it("should enforce authenticated user's email on created order", async () => {
      const req = {
        body: {
          title: "MacBook Pro",
          sellerEmail: "seller@test.com",
          category: "Electronics",
          images: [{ secure_url: "https://example.com/img.jpg", public_id: "img_1" }],
          biddingStartPrice: 50000,
          highestBid: 55000,
          phoneNo: "9876543210",
          address: "123 Tech Lane",
          userEmail: "spoofed@test.com", // should be overwritten by req.user.email
        },
        user: { email: "authenticated@test.com", name: "Auth User" },
      };
      const res = createMockResponse();

      await orderController.createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const saved = await Order.findOne({ title: "MacBook Pro" });
      expect(saved.userEmail).toBe("authenticated@test.com");
      expect(saved.name).toBe("Auth User");
    });
  });

  describe("getOrderById", () => {
    it("should return 404 when order does not exist", async () => {
      const req = {
        params: { id: "507f1f77bcf86cd799439011" },
        user: { email: "user@test.com", role: "user" },
      };
      const res = createMockResponse();

      await orderController.getOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should forbid a non-owner user from viewing order", async () => {
      const order = await Order.create({
        title: "Secret Item",
        name: "Legit Owner",
        userEmail: "owner@test.com",
        sellerEmail: "seller@test.com",
        category: "Jewelry",
        images: [{ secure_url: "https://example.com/img.jpg", public_id: "img_1" }],
        biddingStartPrice: 1000,
        highestBid: 1200,
        phoneNo: "9876543210",
        address: "Private Street",
      });

      const req = {
        params: { id: order._id.toString() },
        user: { email: "stranger@test.com", role: "user" },
      };
      const res = createMockResponse();

      await orderController.getOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should allow buyer to view their own order", async () => {
      const order = await Order.create({
        title: "Buyer Item",
        name: "Buyer",
        userEmail: "buyer@test.com",
        sellerEmail: "seller@test.com",
        category: "Jewelry",
        images: [{ secure_url: "https://example.com/img.jpg", public_id: "img_1" }],
        biddingStartPrice: 1000,
        highestBid: 1200,
        phoneNo: "9876543210",
        address: "Buyer Street",
      });

      const req = {
        params: { id: order._id.toString() },
        user: { email: "buyer@test.com", role: "user" },
      };
      const res = createMockResponse();

      await orderController.getOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should allow admin to view any order", async () => {
      const order = await Order.create({
        title: "Admin Inspected Item",
        name: "Buyer",
        userEmail: "buyer@test.com",
        sellerEmail: "seller@test.com",
        category: "Jewelry",
        images: [{ secure_url: "https://example.com/img.jpg", public_id: "img_1" }],
        biddingStartPrice: 1000,
        highestBid: 1200,
        phoneNo: "9876543210",
        address: "Buyer Street",
      });

      const req = {
        params: { id: order._id.toString() },
        user: { email: "admin@test.com", role: "admin" },
      };
      const res = createMockResponse();

      await orderController.getOrderById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("getOrdersByUserEmail", () => {
    it("should return 403 when user attempts to view another user's orders", async () => {
      const req = {
        params: { email: "victim@test.com" },
        user: { email: "attacker@test.com", role: "user" },
      };
      const res = createMockResponse();

      await orderController.getOrdersByUserEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return orders for matching authenticated user", async () => {
      await Order.create({
        title: "My Order",
        name: "Me",
        userEmail: "me@test.com",
        sellerEmail: "seller@test.com",
        category: "Electronics",
        images: [{ secure_url: "https://example.com/img.jpg", public_id: "img_1" }],
        biddingStartPrice: 1000,
        highestBid: 1200,
        phoneNo: "9876543210",
        address: "Home",
      });

      const req = {
        params: { email: "me@test.com" },
        user: { email: "me@test.com", role: "user" },
      };
      const res = createMockResponse();

      await orderController.getOrdersByUserEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: "My Order" })])
      );
    });
  });
});
