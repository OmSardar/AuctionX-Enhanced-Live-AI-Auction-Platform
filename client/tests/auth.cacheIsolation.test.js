import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

test("Cache Security 1 — User, Role, and Token Context Isolation", () => {
  const axiosAuthPath = path.join(rootDir, "client/src/redux/slices/axiosWithAuth.jsx");
  assert.ok(fs.existsSync(axiosAuthPath), "axiosWithAuth.jsx must exist");
  const content = fs.readFileSync(axiosAuthPath, "utf-8");

  // Verify authoritative key composition
  assert.ok(
    content.includes("const cacheKey = `${authRole}:${authUserId}:${tokenFingerprint}:${url}?${serializedParams}`;"),
    "Cache key must incorporate role, user ID, token fingerprint, and serialized params"
  );

  // Functional simulation of key generator
  const generateKey = (role, userId, token, url, params) => {
    const authRole = role || "anonymous";
    const authUserId = userId || "anonymous";
    const tokenFingerprint = token ? token.slice(-12) : "notoken";
    const serializedParams = typeof params === "object" ? JSON.stringify(params) : params || "";
    return `${authRole}:${authUserId}:${tokenFingerprint}:${url}?${serializedParams}`;
  };

  // 1. Two different users fetching the same endpoint must NEVER share a cache key
  const keyUser1 = generateKey("seller", "seller_1@auctionx.demo", "jwt_token_alpha_123456", "/orders", { page: 1 });
  const keyUser2 = generateKey("seller", "seller_2@auctionx.demo", "jwt_token_beta_789012", "/orders", { page: 1 });
  assert.notEqual(keyUser1, keyUser2, "Different users must produce distinct cache keys");

  // 2. An admin and a seller fetching the same endpoint must NEVER share a cache key
  const keyAdmin = generateKey("admin", "admin_1@auctionx.com", "jwt_admin_token_111111", "/dashboard/stats", "");
  const keySeller = generateKey("seller", "admin_1@auctionx.com", "jwt_seller_token_222222", "/dashboard/stats", "");
  assert.notEqual(keyAdmin, keySeller, "Different roles must produce distinct cache keys even if email matches");

  // 3. Token renewal / rotation must invalidate prior session cache key
  const keyTokenOld = generateKey("seller", "seller_1@auctionx.demo", "old_token_version_000001", "/profile", "");
  const keyTokenNew = generateKey("seller", "seller_1@auctionx.demo", "new_token_version_000002", "/profile", "");
  assert.notEqual(keyTokenOld, keyTokenNew, "Rotated token must produce a distinct cache key");
});

test("Cache Security 2 — Sensitive, Real-time, Financial, and Auth Route Exclusions", () => {
  const axiosAuthPath = path.join(rootDir, "client/src/redux/slices/axiosWithAuth.jsx");
  const content = fs.readFileSync(axiosAuthPath, "utf-8");

  const requiredUncacheable = [
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

  requiredUncacheable.forEach((route) => {
    assert.ok(
      content.includes(`"${route}"`) || content.includes(`'${route}'`),
      `UNCACHEABLE_ROUTES must contain ${route}`
    );
  });

  // Functional simulation of route bypass rule
  const isUncacheableRoute = (url) => {
    const uncacheable = requiredUncacheable;
    return uncacheable.some((route) => url.toLowerCase().includes(route));
  };

  assert.equal(isUncacheableRoute("/products/6ad8f994f50bcdb83ed041d8/bid"), true);
  assert.equal(isUncacheableRoute("/bids/history/6ad8f994f50bcdb83ed041d8"), true);
  assert.equal(isUncacheableRoute("/payment/create-order"), true);
  assert.equal(isUncacheableRoute("/razorpay/verify"), true);
  assert.equal(isUncacheableRoute("/wallet/balance"), true);
  assert.equal(isUncacheableRoute("/auth/check"), true);
  assert.equal(isUncacheableRoute("/auth/seller/profile-pic"), true);
  assert.equal(isUncacheableRoute("/subscriptions/verify"), true);
  assert.equal(isUncacheableRoute("/csrf-token"), true);
  assert.equal(isUncacheableRoute("/2fa/verify"), true);

  // Safe catalog & order read queries CAN be cached
  assert.equal(isUncacheableRoute("/products?select=name,category,status"), false);
  assert.equal(isUncacheableRoute("/categories"), false);
});

test("Cache Security 3 — Mutation Invalidation Rule", () => {
  const axiosAuthPath = path.join(rootDir, "client/src/redux/slices/axiosWithAuth.jsx");
  const content = fs.readFileSync(axiosAuthPath, "utf-8");

  assert.ok(
    content.includes('["post", "put", "patch", "delete"].includes(method)'),
    "All state-modifying mutation methods must be recognized"
  );
  assert.ok(
    content.includes("clearApiCache();"),
    "State mutations must trigger clearApiCache() immediately"
  );

  // Simulation of simulated mutation invalidation
  const cacheMap = new Map();
  cacheMap.set("seller:s1:tok:orders", { data: [{ id: 1 }] });
  cacheMap.set("seller:s1:tok:products", { data: [{ id: 2 }] });
  assert.equal(cacheMap.size, 2);

  const simulateRequest = (method) => {
    if (["post", "put", "patch", "delete"].includes(method.toLowerCase())) {
      cacheMap.clear();
    }
  };

  simulateRequest("post");
  assert.equal(cacheMap.size, 0, "POST mutation must clear the entire API read cache");
});

test("Cache Security 4 — Store Subscription & Event-Driven Eviction", () => {
  const axiosAuthPath = path.join(rootDir, "client/src/redux/slices/axiosWithAuth.jsx");
  const content = fs.readFileSync(axiosAuthPath, "utf-8");

  assert.ok(
    content.includes("store.subscribe(() => {"),
    "Must subscribe to Redux store state transitions"
  );
  assert.ok(
    content.includes("window.addEventListener(\"auctionx:logout\", clearApiCache)"),
    "Must listen to auctionx:logout window event"
  );
  assert.ok(
    content.includes("window.addEventListener(\"auctionx:auth-change\", clearApiCache)"),
    "Must listen to auctionx:auth-change window event"
  );

  // Verify authThunks completeLogout flushes cache
  const authThunksPath = path.join(rootDir, "client/src/redux/slices/authThunks.jsx");
  const thunksContent = fs.readFileSync(authThunksPath, "utf-8");
  assert.ok(
    thunksContent.includes("clearApiCache();"),
    "completeLogout must explicitly call clearApiCache()"
  );
});

test("Cache Security 5 — Caller-Controlled Force-Fresh Bypass (cacheTtl: 0 & no-cache headers)", () => {
  const axiosAuthPath = path.join(rootDir, "client/src/redux/slices/axiosWithAuth.jsx");
  const content = fs.readFileSync(axiosAuthPath, "utf-8");

  assert.ok(
    content.includes("config.cacheTtl === 0"),
    "Must support explicit cache bypass via cacheTtl: 0"
  );
  assert.ok(
    content.includes('getHeader(config.headers, "Cache-Control") === "no-cache"'),
    "Must support explicit cache bypass via Cache-Control: no-cache"
  );
  assert.ok(
    content.includes('getHeader(config.headers, "Pragma") === "no-cache"'),
    "Must support explicit cache bypass via Pragma: no-cache"
  );

  // In ProductDetails.jsx, forceFresh uses cacheTtl: 0
  const pdPath = path.join(rootDir, "client/src/pages/User/ProductDetails/ProductDetails.jsx");
  const pdContent = fs.readFileSync(pdPath, "utf-8");
  assert.ok(
    pdContent.includes("cacheTtl: 0"),
    "ProductDetails must pass cacheTtl: 0 to force-fresh during live auction state changes"
  );
});
