const { csrfProtection, csrfTokenRoute } = require("../../../src/infrastructure/security/csrfMiddleware");

describe("csrfMiddleware Unit Tests", () => {
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockReq = {
      method: "GET",
      cookies: {},
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
    };
    nextFn = jest.fn();
  });

  describe("csrfProtection middleware", () => {
    it("should allow safe GET request without CSRF tokens", () => {
      mockReq.method = "GET";

      csrfProtection(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(typeof mockReq.csrfToken).toBe("function");
    });

    it("should reject unsafe POST request if cookie or header is missing", () => {
      mockReq.method = "POST";

      csrfProtection(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "CSRF token missing",
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("should reject unsafe POST request if header token differs from cookie token", () => {
      mockReq.method = "POST";
      mockReq.cookies["_csrf"] = "token-aaa-111";
      mockReq.headers["x-csrf-token"] = "token-bbb-222";

      csrfProtection(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Invalid CSRF token",
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("should allow unsafe POST request when cookie and header tokens match", () => {
      const validToken = "matching-csrf-token-12345";
      mockReq.method = "POST";
      mockReq.cookies["_csrf"] = validToken;
      mockReq.headers["x-csrf-token"] = validToken;

      csrfProtection(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it("should allow DELETE request when cookie and header tokens match", () => {
      const validToken = "matching-csrf-token-99999";
      mockReq.method = "DELETE";
      mockReq.cookies["_csrf"] = validToken;
      mockReq.headers["x-csrf-token"] = validToken;

      csrfProtection(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it("should validate strictly against _csrf when both _csrf and XSRF-TOKEN cookies exist and agree", () => {
      const validToken = "matching-agreed-token-123";
      mockReq.method = "POST";
      mockReq.cookies["_csrf"] = validToken;
      mockReq.cookies["XSRF-TOKEN"] = validToken;
      mockReq.headers["x-csrf-token"] = validToken;

      csrfProtection(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it("should reject request when header matches XSRF-TOKEN instead of authoritative _csrf cookie", () => {
      mockReq.method = "POST";
      mockReq.cookies["_csrf"] = "authoritative-token-aaa";
      mockReq.cookies["XSRF-TOKEN"] = "stale-xsrf-token-bbb";
      mockReq.headers["x-csrf-token"] = "stale-xsrf-token-bbb";

      csrfProtection(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Invalid CSRF token",
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("should allow request when header matches _csrf even if XSRF-TOKEN cookie differs", () => {
      mockReq.method = "POST";
      mockReq.cookies["_csrf"] = "authoritative-token-aaa";
      mockReq.cookies["XSRF-TOKEN"] = "differing-xsrf-token-bbb";
      mockReq.headers["x-csrf-token"] = "authoritative-token-aaa";

      csrfProtection(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it("should reject request when _csrf cookie is missing even if XSRF-TOKEN cookie is present", () => {
      mockReq.method = "POST";
      delete mockReq.cookies["_csrf"];
      mockReq.cookies["XSRF-TOKEN"] = "stray-xsrf-token-111";
      mockReq.headers["x-csrf-token"] = "stray-xsrf-token-111";

      csrfProtection(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "CSRF token missing",
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("should reject request when _csrf cookie has expired (missing from req.cookies)", () => {
      mockReq.method = "POST";
      mockReq.cookies = {}; // Expired cookie dropped by browser
      mockReq.headers["x-csrf-token"] = "stale-in-memory-token";

      csrfProtection(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "CSRF token missing",
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it("should allow unsafe POST request with signed HMAC header token when _csrf cookie is missing (cross-origin 3P cookie blocking)", () => {
      const { generateToken } = require("../../../src/infrastructure/security/csrfMiddleware");
      const signedToken = generateToken();

      mockReq.method = "POST";
      mockReq.cookies = {}; // Third-party cookie blocked by browser
      mockReq.headers["x-csrf-token"] = signedToken;

      csrfProtection(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalledWith(403);
    });

    it("should reject unsafe POST request with forged signed HMAC header token when _csrf cookie is missing", () => {
      const forgedToken = "fake-nonce.1700000000000.bad-hmac-signature";

      mockReq.method = "POST";
      mockReq.cookies = {};
      mockReq.headers["x-csrf-token"] = forgedToken;

      csrfProtection(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "CSRF token missing",
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe("csrfTokenRoute endpoint handler", () => {
    it("should set cookies and return token in JSON", () => {
      mockReq.csrfToken = jest.fn().mockReturnValue("generated-test-token");

      csrfTokenRoute(mockReq, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        "_csrf",
        "generated-test-token",
        expect.any(Object)
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        "XSRF-TOKEN",
        "generated-test-token",
        expect.any(Object)
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        csrfToken: "generated-test-token",
      });
    });
  });
});
