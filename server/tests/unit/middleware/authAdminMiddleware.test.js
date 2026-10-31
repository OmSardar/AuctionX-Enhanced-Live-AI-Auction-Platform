const adminAuthMiddleware = require("../../../src/modules/admin/authentication/middleware/authAdminMiddleware");
const { createTestAdmin, createTestUser, generateUserToken, TEST_JWT_SECRET } = require("../../helpers/authHelper");
const jwt = require("jsonwebtoken");

describe("authAdminMiddleware Unit Tests", () => {
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
    await adminAuthMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/No token provided/i),
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should authenticate valid admin with token in cookies", async () => {
    const { admin, token } = await createTestAdmin();
    mockReq.cookies.adminToken = token;

    await adminAuthMiddleware(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(mockReq.admin).toBeDefined();
    expect(mockReq.admin.email).toBe(admin.email);
  });

  it("should deny access with 403 when authenticated user is NOT an admin", async () => {
    const { user, token } = await createTestUser({ role: "user" });
    mockReq.headers.authorization = `Bearer ${token}`;

    await adminAuthMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/Admin privileges required/i),
      })
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should return 401 when token is invalid", async () => {
    mockReq.headers.authorization = "Bearer corrupted-admin-token";

    await adminAuthMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/Invalid authentication token/i),
      })
    );
  });
});
