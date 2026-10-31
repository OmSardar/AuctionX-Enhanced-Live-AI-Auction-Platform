const authUserMiddleware = require("../../../src/modules/users/middleware/authUserMiddleware");
const { createTestUser, generateUserToken, TEST_JWT_SECRET } = require("../../helpers/authHelper");
const jwt = require("jsonwebtoken");

describe("authUserMiddleware Unit Tests", () => {
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

  it("should return 401 if no token is provided in cookies or headers", async () => {
    await authUserMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/No token provided/i),
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should authenticate successfully when valid token is in cookies", async () => {
    const { user, token } = await createTestUser();
    mockReq.cookies.token = token;

    await authUserMiddleware(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.user).toBeDefined();
    expect(mockReq.user.email).toBe(user.email);
    expect(mockReq.userId.toString()).toBe(user._id.toString());
  });

  it("should authenticate successfully when valid token is in Authorization header", async () => {
    const { user, token } = await createTestUser();
    mockReq.headers.authorization = `Bearer ${token}`;

    await authUserMiddleware(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.user).toBeDefined();
    expect(mockReq.user.email).toBe(user.email);
  });

  it("should return 401 when token is expired", async () => {
    const expiredToken = jwt.sign(
      { id: "507f1f77bcf86cd799439011", email: "expired@example.com" },
      TEST_JWT_SECRET,
      { expiresIn: "-1s" }
    );
    mockReq.headers.authorization = `Bearer ${expiredToken}`;

    await authUserMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/Token expired/i),
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should return 401 when token is invalid", async () => {
    mockReq.headers.authorization = "Bearer completely-invalid-token";

    await authUserMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/Invalid token/i),
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("optional variant should continue with req.user = null when no token provided", async () => {
    await authUserMiddleware.optional(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.user).toBeNull();
  });

  it("should reject intermediate MFA challenge tokens with 401", async () => {
    const mfaToken = jwt.sign(
      { id: "507f1f77bcf86cd799439011", email: "user_mfa@example.com", purpose: "mfa_challenge", mfaPending: true },
      TEST_JWT_SECRET,
      { expiresIn: "5m" }
    );
    mockReq.headers.authorization = `Bearer ${mfaToken}`;

    await authUserMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/Incomplete authentication challenge/i),
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should reject wrong-purpose tokens such as password_reset with 401", async () => {
    const resetToken = jwt.sign(
      { id: "507f1f77bcf86cd799439011", email: "reset@example.com", purpose: "password_reset" },
      TEST_JWT_SECRET,
      { expiresIn: "15m" }
    );
    mockReq.headers.authorization = `Bearer ${resetToken}`;

    await authUserMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/Invalid token purpose/i),
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should reject suspended user with 403 and clear cookies", async () => {
    const { user, token } = await createTestUser({
      status: "Suspended",
      suspensionReason: "Policy violations",
    });
    mockReq.cookies.token = token;
    mockRes.clearCookie = jest.fn();

    await authUserMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.clearCookie).toHaveBeenCalledWith("token", expect.any(Object));
    expect(mockRes.clearCookie).toHaveBeenCalledWith("sellerToken", expect.any(Object));
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        status: "Suspended",
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("optional variant should also reject suspended user with 403 and clear cookies", async () => {
    const { user, token } = await createTestUser({
      status: "Suspended",
      suspensionReason: "Terms breach",
    });
    mockReq.cookies.token = token;
    mockRes.clearCookie = jest.fn();

    await authUserMiddleware.optional(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.clearCookie).toHaveBeenCalledWith("token", expect.any(Object));
    expect(mockRes.clearCookie).toHaveBeenCalledWith("sellerToken", expect.any(Object));
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        status: "Suspended",
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });
});
