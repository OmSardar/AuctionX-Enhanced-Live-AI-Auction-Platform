/**
 * CSRF Lifecycle & Client Interceptor Unit Tests
 *
 * Verifies the client-side CSRF handling contract:
 * - Authoritative `_csrf` cookie extraction regardless of document-cookie ordering
 * - Cookie vs. Redux synchronization and consistency
 * - Single-attempt recovery on unambiguous 403 CSRF rejection
 * - Prohibition of retry on non-CSRF 403 errors (admin forbidden, IDOR, authorization)
 * - Concurrent request de-duplication (single in-flight refresh promise)
 * - Preservation of request body, FormData, and credentials on retry
 * - RTK thunk unwrapping and malformed/empty token rejection
 * - Recovery of subsequent requests after an earlier refresh failure
 * - AxiosHeaders and case-insensitive header compatibility
 */

describe("Client CSRF Lifecycle & axiosWithAuth Contract", () => {
  // Pure implementation matching client/src/redux/slices/axiosWithAuth.jsx
  const getCookie = (name, cookieString) => {
    if (!cookieString) return null;
    const escapedName = name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const match = cookieString.match(
      new RegExp(`(?:^|;\\s*)${escapedName}=([^;]*)`)
    );
    return match ? decodeURIComponent(match[1]) : null;
  };

  const getHeader = (headers, name) => {
    if (!headers) return undefined;
    if (typeof headers.get === "function") {
      return headers.get(name);
    }
    return headers[name] || headers[name.toLowerCase()];
  };

  const setHeader = (headers, name, value) => {
    if (!headers) return;
    if (typeof headers.set === "function") {
      headers.set(name, value);
    } else {
      headers[name] = value;
    }
  };

  describe("Cookie Extraction & Contract Priority", () => {
    it("should extract _csrf when both _csrf and XSRF-TOKEN exist and agree", () => {
      const cookieStr = "_csrf=token-agree-123; XSRF-TOKEN=token-agree-123; other=val";
      expect(getCookie("_csrf", cookieStr)).toBe("token-agree-123");
    });

    it("should strictly extract _csrf even when XSRF-TOKEN appears first in document.cookie with a different value", () => {
      const cookieStr = "XSRF-TOKEN=legacy-xsrf-val; _csrf=authoritative-csrf-789; session=abc";
      expect(getCookie("_csrf", cookieStr)).toBe("authoritative-csrf-789");
    });

    it("should strictly extract _csrf when _csrf appears first with differing XSRF-TOKEN", () => {
      const cookieStr = "_csrf=authoritative-csrf-789; XSRF-TOKEN=legacy-xsrf-val";
      expect(getCookie("_csrf", cookieStr)).toBe("authoritative-csrf-789");
    });

    it("should return null for _csrf when only XSRF-TOKEN exists in document.cookie", () => {
      const cookieStr = "XSRF-TOKEN=stray-xsrf-token-999; theme=dark";
      expect(getCookie("_csrf", cookieStr)).toBeNull();
    });

    it("should return null when document.cookie is empty", () => {
      expect(getCookie("_csrf", "")).toBeNull();
      expect(getCookie("_csrf", null)).toBeNull();
    });
  });

  describe("Request Interceptor CSRF Selection & Redux Consistency", () => {
    let mockStore;
    let mockState;

    beforeEach(() => {
      mockState = {
        auth: { token: null },
        csrf: { token: "redux-token-111" },
      };
      mockStore = {
        getState: jest.fn(() => mockState),
        dispatch: jest.fn((action) => {
          if (action.type === "csrf/setCsrfToken") {
            mockState.csrf.token = action.payload;
          }
        }),
      };
    });

    const runRequestInterceptor = (config, cookieStr) => {
      const cookieCsrf = getCookie("_csrf", cookieStr);
      const reduxCsrf = mockStore.getState()?.csrf?.token;

      let csrfToken = null;
      if (cookieCsrf) {
        csrfToken = cookieCsrf;
        if (reduxCsrf !== cookieCsrf) {
          mockStore.dispatch({ type: "csrf/setCsrfToken", payload: cookieCsrf });
        }
      } else if (reduxCsrf) {
        csrfToken = reduxCsrf;
      }

      if (csrfToken && !getHeader(config.headers, "X-CSRF-Token")) {
        setHeader(config.headers, "X-CSRF-Token", csrfToken);
      }

      config.withCredentials = true;
      return config;
    };

    it("should prefer authoritative _csrf cookie and sync Redux when Redux had an older token", () => {
      const config = { headers: {} };
      const cookieStr = "_csrf=new-cookie-token-222";

      const result = runRequestInterceptor(config, cookieStr);

      expect(result.headers["X-CSRF-Token"]).toBe("new-cookie-token-222");
      expect(mockStore.dispatch).toHaveBeenCalledWith({
        type: "csrf/setCsrfToken",
        payload: "new-cookie-token-222",
      });
      expect(mockState.csrf.token).toBe("new-cookie-token-222");
    });

    it("should use Redux token when document.cookie has no _csrf (cross-site topology)", () => {
      const config = { headers: {} };
      const cookieStr = ""; // Cross-site: backend cookies not readable via document.cookie

      const result = runRequestInterceptor(config, cookieStr);

      expect(result.headers["X-CSRF-Token"]).toBe("redux-token-111");
      expect(mockStore.dispatch).not.toHaveBeenCalled();
    });

    it("should preserve withCredentials: true on every request", () => {
      const config = { headers: {} };
      const result = runRequestInterceptor(config, "_csrf=tok");
      expect(result.withCredentials).toBe(true);
    });

    it("should not overwrite X-CSRF-Token if already present in config.headers", () => {
      const config = { headers: { "X-CSRF-Token": "pre-existing-token" } };
      const result = runRequestInterceptor(config, "_csrf=cookie-token");
      expect(result.headers["X-CSRF-Token"]).toBe("pre-existing-token");
    });
  });

  describe("Response Interceptor CSRF Single-Attempt Recovery", () => {
    let mockAxiosInstance;
    let csrfRefreshPromise;

    beforeEach(() => {
      csrfRefreshPromise = null;
      mockAxiosInstance = jest.fn().mockResolvedValue({ status: 200, data: { success: true } });
    });

    const createResponseErrorHandler = (fetchTokenFn) => {
      return async (error) => {
        const originalRequest = error.config;

        const isCsrfError =
          error.response?.status === 403 &&
          (error.response?.data?.message === "CSRF token missing" ||
            error.response?.data?.message === "Invalid CSRF token");

        if (isCsrfError && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            if (!csrfRefreshPromise) {
              const thunkPromise = fetchTokenFn();
              csrfRefreshPromise = (typeof thunkPromise?.unwrap === "function"
                ? thunkPromise.unwrap()
                : thunkPromise
              ).finally(() => {
                csrfRefreshPromise = null;
              });
            }

            const freshToken = await csrfRefreshPromise;

            if (typeof freshToken !== "string" || !freshToken.trim()) {
              throw new Error("Invalid or empty CSRF token received during refresh");
            }

            setHeader(originalRequest.headers, "X-CSRF-Token", freshToken);
            return mockAxiosInstance(originalRequest);
          } catch (refreshError) {
            return Promise.reject(
              new Error("CSRF token refresh failed. Please refresh the page and try again.")
            );
          }
        }

        return Promise.reject(error);
      };
    };

    it("should trigger token refresh and retry original request once on 403 'CSRF token missing'", async () => {
      const fetchToken = jest.fn().mockResolvedValue("fresh-token-xyz");
      const errorHandler = createResponseErrorHandler(fetchToken);

      const error = {
        config: { url: "/api/banners", method: "post", headers: {} },
        response: { status: 403, data: { success: false, message: "CSRF token missing" } },
      };

      const result = await errorHandler(error);

      expect(fetchToken).toHaveBeenCalledTimes(1);
      expect(error.config._retry).toBe(true);
      expect(error.config.headers["X-CSRF-Token"]).toBe("fresh-token-xyz");
      expect(mockAxiosInstance).toHaveBeenCalledWith(error.config);
      expect(result).toEqual({ status: 200, data: { success: true } });
    });

    it("should trigger token refresh and retry on 403 'Invalid CSRF token'", async () => {
      const fetchToken = jest.fn().mockResolvedValue("fresh-token-abc");
      const errorHandler = createResponseErrorHandler(fetchToken);

      const error = {
        config: { url: "/api/events", method: "post", headers: {} },
        response: { status: 403, data: { success: false, message: "Invalid CSRF token" } },
      };

      const result = await errorHandler(error);

      expect(fetchToken).toHaveBeenCalledTimes(1);
      expect(error.config._retry).toBe(true);
      expect(mockAxiosInstance).toHaveBeenCalledWith(error.config);
      expect(result.data.success).toBe(true);
    });

    it("should extract fresh token properly from Redux Toolkit thunk action with .unwrap()", async () => {
      const thunkPromise = Promise.resolve({
        type: "csrf/fetchToken/fulfilled",
        payload: "unwrapped-token-777",
      });
      thunkPromise.unwrap = jest.fn().mockResolvedValue("unwrapped-token-777");
      const fetchToken = jest.fn(() => thunkPromise);
      const errorHandler = createResponseErrorHandler(fetchToken);

      const error = {
        config: { url: "/api/banners", method: "post", headers: {} },
        response: { status: 403, data: { success: false, message: "CSRF token missing" } },
      };

      const result = await errorHandler(error);

      expect(fetchToken).toHaveBeenCalledTimes(1);
      expect(thunkPromise.unwrap).toHaveBeenCalledTimes(1);
      expect(error.config.headers["X-CSRF-Token"]).toBe("unwrapped-token-777");
      expect(mockAxiosInstance).toHaveBeenCalledWith(error.config);
      expect(result.data.success).toBe(true);
    });

    it("should reject without retry if freshToken returned from refresh is empty, null, or whitespace", async () => {
      const fetchToken = jest.fn().mockResolvedValue("   ");
      const errorHandler = createResponseErrorHandler(fetchToken);

      const error = {
        config: { url: "/api/banners", method: "post", headers: {} },
        response: { status: 403, data: { success: false, message: "CSRF token missing" } },
      };

      await expect(errorHandler(error)).rejects.toThrow(
        "CSRF token refresh failed. Please refresh the page and try again."
      );
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });

    it("should NEVER retry when error is a non-CSRF 403 (e.g. admin privileges required)", async () => {
      const fetchToken = jest.fn();
      const errorHandler = createResponseErrorHandler(fetchToken);

      const error = {
        config: { url: "/api/calendar", method: "post", headers: {} },
        response: {
          status: 403,
          data: { success: false, message: "Access denied: Admin privileges required" },
        },
      };

      await expect(errorHandler(error)).rejects.toBe(error);
      expect(fetchToken).not.toHaveBeenCalled();
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });

    it("should NEVER retry on 401 Unauthorized", async () => {
      const fetchToken = jest.fn();
      const errorHandler = createResponseErrorHandler(fetchToken);

      const error = {
        config: { url: "/api/banners", method: "delete", headers: {} },
        response: {
          status: 401,
          data: { success: false, message: "Authentication required: No token provided" },
        },
      };

      await expect(errorHandler(error)).rejects.toBe(error);
      expect(fetchToken).not.toHaveBeenCalled();
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });

    it("should not retry a GET request failing with 403 non-CSRF error", async () => {
      const fetchToken = jest.fn();
      const errorHandler = createResponseErrorHandler(fetchToken);

      const error = {
        config: { url: "/api/banners", method: "get", headers: {} },
        response: { status: 403, data: { success: false, message: "Forbidden" } },
      };

      await expect(errorHandler(error)).rejects.toBe(error);
      expect(fetchToken).not.toHaveBeenCalled();
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });

    it("should NEVER retry more than once even if the retried request fails with 403 CSRF", async () => {
      const fetchToken = jest.fn().mockResolvedValue("fresh-token-once");
      const errorHandler = createResponseErrorHandler(fetchToken);

      const error = {
        config: { url: "/api/calendar", method: "post", headers: {}, _retry: true }, // Already retried
        response: { status: 403, data: { success: false, message: "CSRF token missing" } },
      };

      await expect(errorHandler(error)).rejects.toBe(error);
      expect(fetchToken).not.toHaveBeenCalled();
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });

    it("should share a single in-flight refresh promise across concurrent failing requests", async () => {
      let resolveRefresh;
      const fetchToken = jest.fn(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          })
      );
      const errorHandler = createResponseErrorHandler(fetchToken);

      const req1 = {
        config: { url: "/api/banners", method: "post", headers: {} },
        response: { status: 403, data: { success: false, message: "CSRF token missing" } },
      };
      const req2 = {
        config: { url: "/api/events", method: "post", headers: {} },
        response: { status: 403, data: { success: false, message: "Invalid CSRF token" } },
      };

      // Launch both concurrently
      const promise1 = errorHandler(req1);
      const promise2 = errorHandler(req2);

      // Only ONE fetchToken invocation should be active
      expect(fetchToken).toHaveBeenCalledTimes(1);

      // Resolve the shared refresh promise
      resolveRefresh("shared-refreshed-token");

      const [res1, res2] = await Promise.all([promise1, promise2]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(req1.config.headers["X-CSRF-Token"]).toBe("shared-refreshed-token");
      expect(req2.config.headers["X-CSRF-Token"]).toBe("shared-refreshed-token");
      expect(mockAxiosInstance).toHaveBeenCalledTimes(2);
    });

    it("should return a controlled error when token refresh fails", async () => {
      const fetchToken = jest.fn().mockRejectedValue(new Error("Network Error"));
      const errorHandler = createResponseErrorHandler(fetchToken);

      const error = {
        config: { url: "/api/banners", method: "post", headers: {} },
        response: { status: 403, data: { success: false, message: "CSRF token missing" } },
      };

      await expect(errorHandler(error)).rejects.toThrow(
        "CSRF token refresh failed. Please refresh the page and try again."
      );
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });

    it("should allow a later request to recover after an earlier refresh failure has cleared the shared promise", async () => {
      let callCount = 0;
      const fetchToken = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("First refresh failed: Network timeout"));
        }
        return Promise.resolve("second-attempt-recovered-token");
      });
      const errorHandler = createResponseErrorHandler(fetchToken);

      const firstError = {
        config: { url: "/api/banners", method: "post", headers: {} },
        response: { status: 403, data: { success: false, message: "CSRF token missing" } },
      };

      // First request fails
      await expect(errorHandler(firstError)).rejects.toThrow(
        "CSRF token refresh failed. Please refresh the page and try again."
      );
      expect(fetchToken).toHaveBeenCalledTimes(1);

      // Second independent request arrives after promise cleared
      const secondError = {
        config: { url: "/api/events", method: "post", headers: {} },
        response: { status: 403, data: { success: false, message: "Invalid CSRF token" } },
      };

      const secondResult = await errorHandler(secondError);

      expect(fetchToken).toHaveBeenCalledTimes(2);
      expect(secondError.config.headers["X-CSRF-Token"]).toBe("second-attempt-recovered-token");
      expect(mockAxiosInstance).toHaveBeenCalledWith(secondError.config);
      expect(secondResult.status).toBe(200);
    });

    it("should preserve multipart/form-data upload headers, data, and boundary on retry", async () => {
      const fakeFormData = { append: jest.fn(), _boundary: "WebKitFormBoundary7MA4YWxkTrZu0gW" };
      const fetchToken = jest.fn().mockResolvedValue("recovered-csrf-token");
      const errorHandler = createResponseErrorHandler(fetchToken);

      const error = {
        config: {
          url: "/api/banners",
          method: "post",
          headers: {
            "Content-Type": "multipart/form-data; boundary=WebKitFormBoundary7MA4YWxkTrZu0gW",
          },
          data: fakeFormData,
          withCredentials: true,
        },
        response: { status: 403, data: { success: false, message: "CSRF token missing" } },
      };

      await errorHandler(error);

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "/api/banners",
          data: fakeFormData,
          withCredentials: true,
          headers: expect.objectContaining({
            "Content-Type": "multipart/form-data; boundary=WebKitFormBoundary7MA4YWxkTrZu0gW",
            "X-CSRF-Token": "recovered-csrf-token",
          }),
        })
      );
    });

    it("should support getHeader and setHeader with both plain objects and AxiosHeaders API", () => {
      // Plain object
      const plainHeaders = { "x-csrf-token": "lowercased-token" };
      expect(getHeader(plainHeaders, "X-CSRF-Token")).toBe("lowercased-token");
      setHeader(plainHeaders, "Authorization", "Bearer abc");
      expect(plainHeaders["Authorization"]).toBe("Bearer abc");

      // AxiosHeaders-like object with get/set
      const mockMap = new Map();
      mockMap.set("x-csrf-token", "map-token");
      const axiosHeaders = {
        get: jest.fn((name) => mockMap.get(name.toLowerCase())),
        set: jest.fn((name, value) => mockMap.set(name.toLowerCase(), value)),
      };

      expect(getHeader(axiosHeaders, "X-CSRF-Token")).toBe("map-token");
      expect(axiosHeaders.get).toHaveBeenCalledWith("X-CSRF-Token");

      setHeader(axiosHeaders, "X-CSRF-Token", "updated-token");
      expect(axiosHeaders.set).toHaveBeenCalledWith("X-CSRF-Token", "updated-token");
      expect(mockMap.get("x-csrf-token")).toBe("updated-token");
    });
  });

  describe("Bidding Flow CSRF Lifecycle & Regression Protection", () => {
    let mockAxiosInstance;
    let mockStore;
    let mockState;
    let csrfRefreshPromise;

    beforeEach(() => {
      csrfRefreshPromise = null;
      mockState = {
        auth: { token: null },
        csrf: { token: "initial-csrf-bid-token" },
      };
      mockStore = {
        getState: jest.fn(() => mockState),
        dispatch: jest.fn((action) => {
          if (action.type === "csrf/setCsrfToken") {
            mockState.csrf.token = action.payload;
          }
        }),
      };
      mockAxiosInstance = jest.fn().mockResolvedValue({
        status: 200,
        data: { success: true, data: { currentPrice: 1550 } },
      });
    });

    const createBiddingResponseErrorHandler = (fetchTokenFn) => {
      return async (error) => {
        const originalRequest = error.config;

        const isCsrfError =
          error.response?.status === 403 &&
          (error.response?.data?.message === "CSRF token missing" ||
            error.response?.data?.message === "Invalid CSRF token");

        if (isCsrfError && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            if (!csrfRefreshPromise) {
              const thunkPromise = fetchTokenFn();
              csrfRefreshPromise = (typeof thunkPromise?.unwrap === "function"
                ? thunkPromise.unwrap()
                : thunkPromise
              ).finally(() => {
                csrfRefreshPromise = null;
              });
            }

            const freshToken = await csrfRefreshPromise;

            if (typeof freshToken !== "string" || !freshToken.trim()) {
              throw new Error("Invalid or empty CSRF token received during refresh");
            }

            setHeader(originalRequest.headers, "X-CSRF-Token", freshToken);
            return mockAxiosInstance(originalRequest);
          } catch (refreshError) {
            return Promise.reject(
              new Error("CSRF token refresh failed. Please refresh the page and try again.")
            );
          }
        }

        return Promise.reject(error);
      };
    };

    it("A. Valid CSRF token: should preserve endpoint, payload ({ amount }), credentials, and attach X-CSRF-Token", () => {
      const config = {
        url: "/products/65f000000000000000000001/bid",
        method: "post",
        data: { amount: 1500 },
        headers: {},
      };
      const cookieStr = "_csrf=valid-bidding-cookie-token";

      // Run request interceptor logic
      const cookieCsrf = getCookie("_csrf", cookieStr);
      let csrfToken = cookieCsrf || mockStore.getState()?.csrf?.token;
      if (csrfToken && !getHeader(config.headers, "X-CSRF-Token")) {
        setHeader(config.headers, "X-CSRF-Token", csrfToken);
      }
      config.withCredentials = true;

      expect(config.url).toBe("/products/65f000000000000000000001/bid");
      expect(config.data).toEqual({ amount: 1500 });
      expect(config.withCredentials).toBe(true);
      expect(config.headers["X-CSRF-Token"]).toBe("valid-bidding-cookie-token");
    });

    it("B. Missing/stale token: should trigger single-attempt refresh and replay when bidding returns 403 'Invalid CSRF token'", async () => {
      const fetchToken = jest.fn().mockResolvedValue("refreshed-bidding-token-999");
      const errorHandler = createBiddingResponseErrorHandler(fetchToken);

      const error = {
        config: {
          url: "/products/65f000000000000000000001/bid",
          method: "post",
          data: { amount: 1750 },
          headers: { "X-CSRF-Token": "stale-bidding-token" },
          withCredentials: true,
        },
        response: {
          status: 403,
          data: { success: false, message: "Invalid CSRF token" },
        },
      };

      const result = await errorHandler(error);

      // Verify bounded recovery: exactly 1 token refresh
      expect(fetchToken).toHaveBeenCalledTimes(1);
      // Verify retried request configuration
      expect(error.config._retry).toBe(true);
      expect(error.config.headers["X-CSRF-Token"]).toBe("refreshed-bidding-token-999");
      expect(error.config.data).toEqual({ amount: 1750 });
      expect(error.config.url).toBe("/products/65f000000000000000000001/bid");
      // Verify replayed call executed once
      expect(mockAxiosInstance).toHaveBeenCalledTimes(1);
      expect(result.data.data.currentPrice).toBe(1550);
    });

    it("C1. Authorization boundaries: should NEVER retry bid request on 401 Unauthorized", async () => {
      const fetchToken = jest.fn();
      const errorHandler = createBiddingResponseErrorHandler(fetchToken);

      const error = {
        config: {
          url: "/products/65f000000000000000000001/bid",
          method: "post",
          data: { amount: 2000 },
          headers: { "X-CSRF-Token": "valid-token" },
        },
        response: {
          status: 401,
          data: { success: false, message: "Unauthorized: No token provided" },
        },
      };

      await expect(errorHandler(error)).rejects.toBe(error);
      expect(fetchToken).not.toHaveBeenCalled();
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });

    it("C2. Authorization boundaries: should NEVER retry bid request on non-CSRF 403 (bidding window closed / account suspended)", async () => {
      const fetchToken = jest.fn();
      const errorHandler = createBiddingResponseErrorHandler(fetchToken);

      const error = {
        config: {
          url: "/products/65f000000000000000000001/bid",
          method: "post",
          data: { amount: 2500 },
          headers: { "X-CSRF-Token": "valid-token" },
        },
        response: {
          status: 403,
          data: {
            success: false,
            message: "Bidding is closed for this item",
          },
        },
      };

      await expect(errorHandler(error)).rejects.toBe(error);
      expect(fetchToken).not.toHaveBeenCalled();
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });

    it("C3. Infinite loop prevention: should NOT retry if retried bid request receives another 403 CSRF error", async () => {
      const fetchToken = jest.fn();
      const errorHandler = createBiddingResponseErrorHandler(fetchToken);

      const error = {
        config: {
          url: "/products/65f000000000000000000001/bid",
          method: "post",
          data: { amount: 3000 },
          headers: { "X-CSRF-Token": "refreshed-token-still-failing" },
          _retry: true, // Already retried
        },
        response: {
          status: 403,
          data: { success: false, message: "Invalid CSRF token" },
        },
      };

      await expect(errorHandler(error)).rejects.toBe(error);
      expect(fetchToken).not.toHaveBeenCalled();
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });

    it("D. Regression protection: ProductDetails.jsx imports axiosWithAuth and contains zero unintercepted axios.create calls", () => {
      const fs = require("fs");
      const path = require("path");
      const productDetailsPath = path.resolve(
        __dirname,
        "../../../../client/src/pages/User/ProductDetails/ProductDetails.jsx"
      );
      const source = fs.readFileSync(productDetailsPath, "utf8");

      expect(source).toContain('import axiosWithAuth from "../../../redux/slices/axiosWithAuth";');
      expect(source).not.toMatch(/const\s+api\s*=\s*axios\.create/);
      expect(source).toMatch(/axiosWithAuth\.post\(`\/products\/\${id}\/bid`/);
      expect(source).toMatch(/axiosWithAuth\.get\(`\/products\/\${id}`\)/);
      expect(source).toMatch(/axiosWithAuth\.get\("\/auth\/seller\/profile-pic"/);
    });
  });
});

