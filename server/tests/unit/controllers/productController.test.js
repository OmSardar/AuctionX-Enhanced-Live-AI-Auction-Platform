/**
 * White-Box Tests — Product Controller Unit Tests
 *
 * Tests internal branching, input validation, status transitions,
 * and ownership gating in productController directly with mock req/res.
 */
const productController = require("../../../src/modules/products/controllers/productController");
const Product = require("../../../src/modules/products/models/productSchema");
const { clearDatabase } = require("../../helpers/dbHelper");

function createMockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("White-Box Tests — Product Controller", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("getAllProducts", () => {
    it("should return empty list with count 0 when no products exist", async () => {
      const req = {};
      const res = createMockResponse();

      await productController.getAllProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          count: 0,
          products: [],
        })
      );
    });

    it("should return sorted products with accurate count", async () => {
      await Product.create({
        name: "Item 1",
        description: [{ name: "d1", description: "desc1" }],
        email: "seller1@test.com",
        category: "Electronics",
        images: [{ secure_url: "https://example.com/1.jpg", public_id: "p1" }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(),
        biddingStartTime: "10:00",
        biddingStartPrice: 100,
        biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
        status: "Active",
      });

      const req = {};
      const res = createMockResponse();

      await productController.getAllProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          count: 1,
        })
      );
    });

    it("should filter products by status query (e.g. SCHEDULED)", async () => {
      await Product.create({
        name: "Scheduled Item",
        description: [{ name: "s", description: "sched" }],
        email: "seller@test.com",
        category: "Watches",
        images: [{ secure_url: "https://example.com/s.jpg", public_id: "s1" }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(Date.now() + 86400000),
        biddingStartTime: "10:00",
        biddingStartPrice: 200,
        biddingEndTime: new Date(Date.now() + 172800000).toISOString(),
        status: "SCHEDULED",
      });

      await Product.create({
        name: "Live Item",
        description: [{ name: "l", description: "live" }],
        email: "seller@test.com",
        category: "Watches",
        images: [{ secure_url: "https://example.com/l.jpg", public_id: "l1" }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(),
        biddingStartTime: "10:00",
        biddingStartPrice: 300,
        biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
        status: "LIVE",
      });

      const req = { query: { status: "SCHEDULED" } };
      const res = createMockResponse();

      await productController.getAllProducts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          count: 1,
          products: expect.arrayContaining([
            expect.objectContaining({ name: "Scheduled Item", status: "SCHEDULED" }),
          ]),
        })
      );
    });
  });

  describe("getProductById", () => {
    it("should return 404 when product is not found", async () => {
      const req = { params: { id: "507f1f77bcf86cd799439011" } };
      const res = createMockResponse();

      await productController.getProductById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Product not found",
        })
      );
    });

    it("should return product object on valid id", async () => {
      const product = await Product.create({
        name: "Item Detail",
        description: [{ name: "d", description: "detail" }],
        email: "seller@test.com",
        category: "Art",
        images: [{ secure_url: "https://example.com/art.jpg", public_id: "art1" }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(),
        biddingStartTime: "10:00",
        biddingStartPrice: 500,
        biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
        status: "Active",
      });

      const req = { params: { id: product._id.toString() } };
      const res = createMockResponse();

      await productController.getProductById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          product: expect.objectContaining({ name: "Item Detail" }),
        })
      );
    });
  });

  describe("updateProductStatus", () => {
    it("should reject invalid status values with 400", async () => {
      const req = {
        params: { id: "507f1f77bcf86cd799439011" },
        body: { status: "InvalidStatus" },
      };
      const res = createMockResponse();

      await productController.updateProductStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Valid status is required",
        })
      );
    });

    it("should enforce ownership when updating product status", async () => {
      const product = await Product.create({
        name: "Item Status",
        description: [{ name: "d", description: "detail" }],
        email: "owner@test.com",
        category: "Art",
        images: [{ secure_url: "https://example.com/art.jpg", public_id: "art1" }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(),
        biddingStartTime: "10:00",
        biddingStartPrice: 500,
        biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
        status: "Active",
      });

      const req = {
        params: { id: product._id.toString() },
        body: { status: "Closed" },
        user: { email: "different@test.com", role: "user" },
      };
      const res = createMockResponse();

      await productController.updateProductStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should allow owner to transition status to Closed", async () => {
      const product = await Product.create({
        name: "Item Status Close",
        description: [{ name: "d", description: "detail" }],
        email: "owner@test.com",
        category: "Art",
        images: [{ secure_url: "https://example.com/art.jpg", public_id: "art1" }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(),
        biddingStartTime: "10:00",
        biddingStartPrice: 500,
        biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
        status: "Active",
      });

      const req = {
        params: { id: product._id.toString() },
        body: { status: "Closed" },
        user: { email: "owner@test.com", role: "user" },
      };
      const res = createMockResponse();

      await productController.updateProductStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const updated = await Product.findById(product._id);
      expect(updated.status).toBe("Closed");
    });
  });

  describe("deleteProduct", () => {
    it("should forbid non-owners from deleting product", async () => {
      const product = await Product.create({
        name: "Item Delete",
        description: [{ name: "d", description: "detail" }],
        email: "owner@test.com",
        category: "Art",
        images: [{ secure_url: "https://example.com/art.jpg", public_id: "art1" }],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(),
        biddingStartTime: "10:00",
        biddingStartPrice: 500,
        biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
        status: "Active",
      });

      const req = {
        params: { id: product._id.toString() },
        user: { email: "intruder@test.com", role: "user" },
      };
      const res = createMockResponse();

      await productController.deleteProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should allow owner to delete product successfully", async () => {
      const product = await Product.create({
        name: "Item Delete 2",
        description: [{ name: "d", description: "detail" }],
        email: "owner@test.com",
        category: "Art",
        images: [],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(),
        biddingStartTime: "10:00",
        biddingStartPrice: 500,
        biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
        status: "Active",
      });

      const req = {
        params: { id: product._id.toString() },
        user: { email: "owner@test.com", role: "user" },
      };
      const res = createMockResponse();

      await productController.deleteProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const inDb = await Product.findById(product._id);
      expect(inDb).toBeNull();
    });

    it("should forbid deletion if product already has active bids", async () => {
      const product = await Product.create({
        name: "Item With Bids",
        description: [{ name: "d", description: "detail" }],
        email: "owner@test.com",
        category: "Watches",
        images: [],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(),
        biddingStartTime: "10:00",
        biddingStartPrice: 1000,
        biddingEndTime: new Date(Date.now() + 86400000).toISOString(),
        status: "Active",
        bidCount: 3,
        highestBidder: "507f1f77bcf86cd799439011",
      });

      const req = {
        params: { id: product._id.toString() },
        user: { email: "owner@test.com", role: "seller" },
      };
      const res = createMockResponse();

      await productController.deleteProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("Bids have already been placed"),
        })
      );

      const stillInDb = await Product.findById(product._id);
      expect(stillInDb).not.toBeNull();
    });

    it("should forbid deletion if auction has ended or is closed", async () => {
      const product = await Product.create({
        name: "Ended Item",
        description: [{ name: "d", description: "detail" }],
        email: "owner@test.com",
        category: "Art",
        images: [],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(Date.now() - 172800000),
        biddingStartTime: "10:00",
        biddingStartPrice: 500,
        biddingEndTime: new Date(Date.now() - 86400000).toISOString(),
        status: "Closed",
      });

      const req = {
        params: { id: product._id.toString() },
        user: { email: "owner@test.com", role: "seller" },
      };
      const res = createMockResponse();

      await productController.deleteProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("auction has ended"),
        })
      );
    });

    it("should forbid deletion if bidding end time has passed", async () => {
      const product = await Product.create({
        name: "Expired Item",
        description: [{ name: "d", description: "detail" }],
        email: "owner@test.com",
        category: "Art",
        images: [],
        mobileNumber: "9876543210",
        biddingStartDate: new Date(Date.now() - 172800000),
        biddingStartTime: "10:00",
        biddingStartPrice: 500,
        biddingEndTime: new Date(Date.now() - 1000).toISOString(),
        status: "Active",
      });

      const req = {
        params: { id: product._id.toString() },
        user: { email: "owner@test.com", role: "seller" },
      };
      const res = createMockResponse();

      await productController.deleteProduct(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("bidding time has passed"),
        })
      );
    });
  });
});
