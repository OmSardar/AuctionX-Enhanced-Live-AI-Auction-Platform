import axios from "axios";
import { store } from "../../app/store/store";
import { fetchCsrfToken, setCsrfToken } from "./csrfSecuritySlice";

const API_URL = import.meta.env.VITE_API_URL || "";

export const getCookie = (name) => {
  if (typeof document === "undefined" || !document.cookie) return null;
  const escapedName = name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${escapedName}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
};

export const getHeader = (headers, name) => {
  if (!headers) return undefined;
  if (typeof headers.get === "function") {
    return headers.get(name);
  }
  return headers[name] || headers[name.toLowerCase()];
};

export const setHeader = (headers, name, value) => {
  if (!headers) return;
  if (typeof headers.set === "function") {
    headers.set(name, value);
  } else {
    headers[name] = value;
  }
};

// In-flight request deduplication map for idempotent GET requests
const inFlightRequests = new Map();

// Short-lived in-memory read cache for idempotent GET requests (15s TTL default)
const apiCache = new Map();

export const clearApiCache = () => {
  apiCache.clear();
};

export const getApiCacheSize = () => apiCache.size;
export const getInFlightCount = () => inFlightRequests.size;

// Routes that MUST always bypass caching and deduplication for financial, bidding, and security correctness
const UNCACHEABLE_ROUTES = [
  "/bids",
  "/bid",
  "/payment",
  "/razorpay",
  "/wallet",
  "/auth",
  "/csrf",
  "/live",
  "/2fa",
  "/twofactor",
  "/verify",
  "/subscriptions/verify",
];

// Subscribe to Redux store to flush cached responses on user, token, or role changes
let lastSubscribedUserId = undefined;
let lastSubscribedToken = undefined;

if (typeof store?.subscribe === "function") {
  store.subscribe(() => {
    try {
      const currentState = store.getState();
      const currentUser = currentState?.auth?.user;
      const currentUserId = currentUser?._id || currentUser?.id || currentUser?.email || null;
      const currentToken = currentState?.auth?.token || null;

      if (
        lastSubscribedUserId !== undefined &&
        (currentUserId !== lastSubscribedUserId || currentToken !== lastSubscribedToken)
      ) {
        clearApiCache();
      }

      lastSubscribedUserId = currentUserId;
      lastSubscribedToken = currentToken;
    } catch {
      // Ignore during initial setup or tests
    }
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("auctionx:logout", clearApiCache);
  window.addEventListener("auctionx:auth-change", clearApiCache);
}

const defaultAdapter = axios.getAdapter(axios.defaults.adapter);

const deduplicatingCachingAdapter = async (config) => {
  const method = (config.method || "get").toLowerCase();
  const url = config.url || "";

  // Check if route must bypass cache
  const isUncacheable = UNCACHEABLE_ROUTES.some((route) => url.toLowerCase().includes(route));

  // Non-GET requests (mutations) bypass cache and deduplication, and invalidate cached reads
  if (method !== "get" || config.cache === false || config.skipCache === true || isUncacheable) {
    if (["post", "put", "patch", "delete"].includes(method)) {
      clearApiCache();
    }
    return defaultAdapter(config);
  }

  // Derive authoritative user and authorization context from Redux
  const state = store.getState?.() || {};
  const authUser = state.auth?.user;
  const authRole = state.auth?.role || authUser?.role || "anonymous";
  const authUserId = authUser?._id || authUser?.id || authUser?.email || "anonymous";
  const tokenFingerprint = state.auth?.token ? state.auth.token.slice(-12) : "notoken";

  // Generate cache & deduplication key strictly bound to user identity, role, and token
  const serializedParams =
    typeof config.params === "object"
      ? JSON.stringify(config.params)
      : config.params || "";
  const cacheKey = `${authRole}:${authUserId}:${tokenFingerprint}:${url}?${serializedParams}`;

  // 1. Check if caller explicitly requested bypassing the read cache
  const isNoCacheRequested =
    config.cacheTtl === 0 ||
    getHeader(config.headers, "Cache-Control") === "no-cache" ||
    getHeader(config.headers, "Pragma") === "no-cache";

  // 2. Check if we have a fresh cached response
  const cached = apiCache.get(cacheKey);
  const ttl = typeof config.cacheTtl === "number" ? config.cacheTtl : 15000;
  if (!isNoCacheRequested && cached && Date.now() - cached.timestamp < ttl) {
    return {
      data: cached.data,
      status: cached.status,
      statusText: cached.statusText,
      headers: { ...cached.headers, "x-cache": "HIT" },
      config,
      request: cached.request,
    };
  }

  // 2. In-flight deduplication: return existing pending promise if identical GET is already in-flight for this user
  if (inFlightRequests.has(cacheKey)) {
    const sharedRes = await inFlightRequests.get(cacheKey);
    return {
      ...sharedRes,
      config,
    };
  }

  // 3. Dispatch fresh request through default adapter
  const requestPromise = (async () => {
    try {
      const res = await defaultAdapter(config);
      if (res.status >= 200 && res.status < 300) {
        apiCache.set(cacheKey, {
          data: res.data,
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
          timestamp: Date.now(),
          request: res.request,
        });
      }
      return res;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

const axiosWithAuth = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : "/api",
  withCredentials: true, // Send cookies with cross-origin/cross-port requests
  adapter: deduplicatingCachingAdapter,
});

let csrfRefreshPromise = null;

// Interceptor logic shared by both axiosWithAuth and default axios instance
const attachAuthAndCsrf = (config) => {
  // Always include credentials unless explicitly disabled
  if (config.withCredentials === undefined) {
    config.withCredentials = true;
  }

  // Prevent /api/api/... double prefixing if a caller passes a path starting with "/api/"
  if (config.url && config.url.startsWith("/api/")) {
    config.url = config.url.slice(4);
  }

  // Attach JWT Bearer token if present in Redux
  const token = store.getState()?.auth?.token;
  if (token && !getHeader(config.headers, "Authorization")) {
    setHeader(config.headers, "Authorization", `Bearer ${token}`);
  }

  // Determine authoritative CSRF token matching the backend contract (_csrf)
  const cookieCsrf = getCookie("_csrf");
  const reduxCsrf = store.getState()?.csrf?.token;

  let csrfToken = null;
  if (cookieCsrf) {
    csrfToken = cookieCsrf;
    // If Redux has an outdated or missing token, sync Redux with the authoritative cookie
    if (reduxCsrf !== cookieCsrf) {
      store.dispatch(setCsrfToken(cookieCsrf));
    }
  } else if (reduxCsrf) {
    // In cross-site topologies where document.cookie cannot read backend cookies,
    // rely on the in-memory Redux token fetched via JSON response
    csrfToken = reduxCsrf;
  }

  if (csrfToken && !getHeader(config.headers, "X-CSRF-Token")) {
    setHeader(config.headers, "X-CSRF-Token", csrfToken);
  }

  return config;
};

// Response interceptor for automatic, single-attempt CSRF recovery
const handleCsrfError = async (error, clientInstance) => {
  const originalRequest = error.config;

  // Strict detection of unambiguous CSRF rejection
  const isCsrfError =
    error.response?.status === 403 &&
    (error.response?.data?.message === "CSRF token missing" ||
      error.response?.data?.message === "Invalid CSRF token");

  // Retry at most once, strictly for CSRF rejection
  if (isCsrfError && originalRequest && !originalRequest._retry) {
    originalRequest._retry = true;

    try {
      if (!csrfRefreshPromise) {
        const thunkPromise = store.dispatch(fetchCsrfToken());
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
      return clientInstance(originalRequest);
    } catch (refreshError) {
      console.error("CSRF token refresh failed:", refreshError);
      return Promise.reject(
        new Error(
          "CSRF token refresh failed. Please refresh the page and try again."
        )
      );
    }
  }

  return Promise.reject(error);
};

// Configure axiosWithAuth
axiosWithAuth.interceptors.request.use(attachAuthAndCsrf, (error) => Promise.reject(error));
axiosWithAuth.interceptors.response.use(
  (response) => response,
  (error) => handleCsrfError(error, axiosWithAuth)
);

// Also attach to global axios instance so any component using direct axios.post/patch/delete is protected
axios.interceptors.request.use(attachAuthAndCsrf, (error) => Promise.reject(error));
axios.interceptors.response.use(
  (response) => response,
  (error) => handleCsrfError(error, axios)
);

export default axiosWithAuth;

