const checkTimeRestriction = require("../../../src/modules/bidding/middleware/checkTimeRestriction");
const Product = require("../../../src/modules/products/models/productSchema");

describe("checkTimeRestriction Middleware Regression Unit Tests", () => {
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockReq = {
      params: { id: "507f1f77bcf86cd799439011" },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFn = jest.fn();
    jest.restoreAllMocks();
  });

  it("should allow request when auction biddingEndTime is in the future", async () => {
    const futureEndTime = new Date(Date.now() + 3600000).toISOString();
    jest.spyOn(Product, "findById").mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      biddingEndTime: futureEndTime,
    });

    await checkTimeRestriction(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it("should reject request with 403 when auction biddingEndTime has passed", async () => {
    const pastEndTime = new Date(Date.now() - 60000).toISOString();
    jest.spyOn(Product, "findById").mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      biddingEndTime: pastEndTime,
    });

    await checkTimeRestriction(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: "Operation not allowed, bidding time has passed.",
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should return 404 when product is not found", async () => {
    jest.spyOn(Product, "findById").mockResolvedValue(null);

    await checkTimeRestriction(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: "Product not found",
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should return 500 when database query throws error", async () => {
    jest.spyOn(Product, "findById").mockRejectedValue(new Error("Database connection lost"));

    await checkTimeRestriction(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: "Server error",
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should support backward compatibility if legacy bidEndTime is used", async () => {
    const pastEndTime = new Date(Date.now() - 10000).toISOString();
    jest.spyOn(Product, "findById").mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      bidEndTime: pastEndTime,
    });

    await checkTimeRestriction(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(nextFn).not.toHaveBeenCalled();
  });
});
