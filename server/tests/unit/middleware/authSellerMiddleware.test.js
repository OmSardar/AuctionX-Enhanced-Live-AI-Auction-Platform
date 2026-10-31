const { protectSellerRoute } = require("../../../src/modules/sellers/accounts/middleware/authSellerMiddleware");
const { createTestSeller, generateSellerToken, TEST_JWT_SECRET } = require("../../helpers/authHelper");
const jwt = require("jsonwebtoken");

describe("authSellerMiddleware Unit Tests", () => {
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockReq = {
      cookies: {},
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFn = jest.fn();
  });

  it("should return 401 when no token is provided", async () => {
    await protectSellerRoute(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/No token provided/i),
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should authenticate seller with valid cookie token", async () => {
    const { seller, token } = await createTestSeller();
    mockReq.cookies.sellerToken = token;

    await protectSellerRoute(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.seller).toBeDefined();
    expect(mockReq.seller.email).toBe(seller.email);
    expect(mockReq.userId.toString()).toBe(seller._id.toString());
  });

  it("should authenticate seller with Bearer token in headers", async () => {
    const { seller, token } = await createTestSeller();
    mockReq.headers.authorization = `Bearer ${token}`;

    await protectSellerRoute(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.seller).toBeDefined();
    expect(mockReq.seller.email).toBe(seller.email);
  });

  it("should return 401 when token is expired", async () => {
    const expiredToken = jwt.sign(
      { id: "507f1f77bcf86cd799439011", email: "seller_exp@example.com" },
      TEST_JWT_SECRET,
      { expiresIn: "-1s" }
    );
    mockReq.headers.authorization = `Bearer ${expiredToken}`;

    await protectSellerRoute(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/Token expired/i),
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should reject intermediate MFA challenge tokens with 401", async () => {
    const mfaToken = jwt.sign(
      { id: "507f1f77bcf86cd799439011", email: "seller_mfa@example.com", purpose: "mfa_challenge", mfaPending: true },
      TEST_JWT_SECRET,
      { expiresIn: "5m" }
    );
    mockReq.headers.authorization = `Bearer ${mfaToken}`;

    await protectSellerRoute(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/Incomplete authentication challenge/i),
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should reject unauthorized purpose tokens such as user_session with 401", async () => {
    const userSessionToken = jwt.sign(
      { id: "507f1f77bcf86cd799439011", email: "buyer_cross@example.com", purpose: "user_session" },
      TEST_JWT_SECRET,
      { expiresIn: "1h" }
    );
    mockReq.headers.authorization = `Bearer ${userSessionToken}`;

    await protectSellerRoute(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/Invalid token purpose/i),
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should reject tokens declaring role: 'user' with 403 Forbidden", async () => {
    const buyerRoleToken = jwt.sign(
      { id: "507f1f77bcf86cd799439011", email: "buyer_role@example.com", role: "user" },
      TEST_JWT_SECRET,
      { expiresIn: "1h" }
    );
    mockReq.headers.authorization = `Bearer ${buyerRoleToken}`;

    await protectSellerRoute(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/Seller privileges required/i),
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should reject suspended seller with 403 and clear cookies", async () => {
    const { seller, token } = await createTestSeller({
      status: "Suspended",
      suspensionReason: "Policy violations",
    });
    mockReq.cookies.sellerToken = token;
    mockRes.clearCookie = jest.fn();

    await protectSellerRoute(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.clearCookie).toHaveBeenCalledWith("sellerToken", expect.any(Object));
    expect(mockRes.clearCookie).toHaveBeenCalledWith("token", expect.any(Object));
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        status: "Suspended",
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });
});
