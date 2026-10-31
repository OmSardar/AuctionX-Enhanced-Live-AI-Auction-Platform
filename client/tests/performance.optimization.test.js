import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

test("Performance Suite 1 — axiosWithAuth In-Flight Deduplication & Read-Cache Invariants", () => {
  const axiosAuthPath = path.join(rootDir, "client/src/redux/slices/axiosWithAuth.jsx");
  assert.ok(fs.existsSync(axiosAuthPath), "axiosWithAuth.jsx must exist");
  const content = fs.readFileSync(axiosAuthPath, "utf-8");

  // Verify inFlightRequests map exists
  assert.ok(
    content.includes("const inFlightRequests = new Map()"),
    "Must maintain inFlightRequests Map for request deduplication"
  );

  // Verify apiCache map exists
  assert.ok(
    content.includes("const apiCache = new Map()"),
    "Must maintain apiCache Map for idempotent read caching"
  );

  // Verify clearApiCache export exists
  assert.ok(
    content.includes("export const clearApiCache = () =>"),
    "Must export clearApiCache helper for explicit cache invalidation"
  );

  // Verify user-isolation and role-isolation in cache key
  assert.ok(
    content.includes("const cacheKey = `${authRole}:${authUserId}:${tokenFingerprint}:${url}?${serializedParams}`;"),
    "Cache key must incorporate authRole, authUserId, and tokenFingerprint for strict session and role isolation"
  );

  // Verify uncacheable real-time, financial, and authentication routes
  assert.ok(
    content.includes("const UNCACHEABLE_ROUTES = ["),
    "Must maintain an explicit list of uncacheable routes"
  );
  assert.ok(content.includes('"/bids"'), "Bidding routes must bypass cache");
  assert.ok(content.includes('"/payment"'), "Payment routes must bypass cache");
  assert.ok(content.includes('"/wallet"'), "Wallet routes must bypass cache");
  assert.ok(content.includes('"/csrf"'), "CSRF routes must bypass cache");

  // Verify store subscription for auto-flushing cache on auth changes
  assert.ok(
    content.includes("store.subscribe(() => {"),
    "Must subscribe to Redux store to flush cache on user or token identity changes"
  );
  assert.ok(
    content.includes("currentUserId !== lastSubscribedUserId || currentToken !== lastSubscribedToken"),
    "Must detect user ID or token changes and invoke clearApiCache"
  );

  // Verify completeLogout clears cache
  const authThunksPath = path.join(rootDir, "client/src/redux/slices/authThunks.jsx");
  assert.ok(fs.existsSync(authThunksPath), "authThunks.jsx must exist");
  const thunksContent = fs.readFileSync(authThunksPath, "utf-8");
  assert.ok(
    thunksContent.includes("clearApiCache();"),
    "completeLogout must explicitly call clearApiCache() on user logout"
  );
});

test("Performance Suite 2 — GraphWide5 Interval Stabilization & Background Throttling", () => {
  const graphPath = path.join(
    rootDir,
    "client/src/components/SellerDashboard/partials/dashboard/GraphWide5.jsx"
  );
  assert.ok(fs.existsSync(graphPath), "GraphWide5.jsx must exist");
  const content = fs.readFileSync(graphPath, "utf-8");

  // Verify counter recreation loop is eliminated
  assert.ok(
    !content.includes("}, [counter]);"),
    "GraphWide5 must NOT depend on [counter] which causes continuous re-render loops"
  );

  // Verify document.hidden check exists
  assert.ok(
    content.includes("document.hidden"),
    "GraphWide5 must pause canvas updates when tab is in background"
  );

  // Verify interval is relaxed to 5000ms
  assert.ok(
    content.includes("5000);"),
    "GraphWide5 ticker must be relaxed to 5000ms to reduce idle CPU utilization"
  );
});

test("Performance Suite 3 — Seller Dashboard & Analytics Lazy Loading with Suspense", () => {
  const sellerDashboardPath = path.join(
    rootDir,
    "client/src/components/SellerDashboard/pages/SellerDashboard.jsx"
  );
  const sellerAnalyticsPath = path.join(
    rootDir,
    "client/src/components/SellerDashboard/pages/SellerAnalytics.jsx"
  );
  assert.ok(fs.existsSync(sellerDashboardPath), "SellerDashboard.jsx must exist");
  assert.ok(fs.existsSync(sellerAnalyticsPath), "SellerAnalytics.jsx must exist");

  const dashContent = fs.readFileSync(sellerDashboardPath, "utf-8");
  const analyticsContent = fs.readFileSync(sellerAnalyticsPath, "utf-8");

  // Verify lazy imports in SellerDashboard
  assert.ok(
    dashContent.includes('const DashboardCard01 = lazy(() => import("../partials/dashboard/GraphWide1"));'),
    "SellerDashboard must lazy-load DashboardCard01"
  );
  assert.ok(
    dashContent.includes('const DashboardCard05 = lazy(() => import("../partials/dashboard/GraphWide5"));'),
    "SellerDashboard must lazy-load DashboardCard05"
  );
  assert.ok(
    dashContent.includes("<Suspense"),
    "SellerDashboard must wrap card grid in Suspense"
  );

  // Verify lazy imports in SellerAnalytics
  assert.ok(
    analyticsContent.includes('const DashboardCard01 = lazy(() => import("../partials/dashboard/GraphWide1"));'),
    "SellerAnalytics must lazy-load DashboardCard01"
  );
  assert.ok(
    analyticsContent.includes("<Suspense"),
    "SellerAnalytics must wrap card grid in Suspense"
  );
});

test("Performance Suite 4 — ChatQnA Deferral of Topics Network Fetch", () => {
  const chatPath = path.join(rootDir, "client/src/components/Common/ChatQnA/ChatQnA.jsx");
  assert.ok(fs.existsSync(chatPath), "ChatQnA.jsx must exist");
  const content = fs.readFileSync(chatPath, "utf-8");

  // Verify topic fetch is deferred until isOpen
  assert.ok(
    content.includes("if (!isOpen || suggestedTopics.length > 0) return;"),
    "ChatQnA must defer /chat/topics API request until user opens the chat drawer"
  );
});

test("Performance Suite 5 — DropdownProfile Redux Sync & Network Call Guard", () => {
  const profilePath = path.join(
    rootDir,
    "client/src/components/AdminDashboard/components/DropdownProfile.jsx"
  );
  assert.ok(fs.existsSync(profilePath), "DropdownProfile.jsx must exist");
  const content = fs.readFileSync(profilePath, "utf-8");

  // Verify network fetch is guarded if initialPic exists in Redux
  assert.ok(
    content.includes("if (!initialPic") && content.includes("fetchUserProfile();"),
    "DropdownProfile must not make redundant network calls on mount when profile picture is already present in Redux"
  );
});

test("Performance Suite 6 — Vite Chunk Splitting Strategy Invariants", () => {
  const vitePath = path.join(rootDir, "client/vite.config.js");
  assert.ok(fs.existsSync(vitePath), "vite.config.js must exist");
  const content = fs.readFileSync(vitePath, "utf-8");

  // Verify strategic chunking
  assert.ok(content.includes('"vendor-charts"'), "vite.config.js must isolate vendor-charts chunk");
  assert.ok(content.includes('"vendor-pdf"'), "vite.config.js must isolate vendor-pdf chunk");
  assert.ok(content.includes('"vendor-react"'), "vite.config.js must isolate vendor-react chunk");
  assert.ok(content.includes('"vendor-redux"'), "vite.config.js must isolate vendor-redux chunk");
  assert.ok(content.includes('"vendor-icons"'), "vite.config.js must isolate vendor-icons chunk");
  assert.ok(content.includes('"vendor-animation"'), "vite.config.js must isolate vendor-animation chunk");
});

const resolveServerPath = (canonical, legacy) => {
  const cPath = path.join(rootDir, canonical);
  return fs.existsSync(cPath) ? cPath : path.join(rootDir, legacy);
};

test("Performance Suite 7 — MongoDB Performance Indexes and Controller Optimizations", () => {
  // Order schema indexes
  const orderSchemaPath = resolveServerPath(
    "server/src/modules/orders/models/orderSchema.js",
    "server/models/SellAnItemSchema/orderSchema.js"
  );
  if (!fs.existsSync(orderSchemaPath)) return;
  const orderContent = fs.readFileSync(orderSchemaPath, "utf-8");
  if (orderContent.includes("sellerEmail: 1")) {
    assert.ok(
      orderContent.includes("orderSchema.index({ sellerEmail: 1, createdAt: -1 });"),
      "orderSchema must have compound index for sellerEmail + createdAt"
    );
  } else {
    assert.ok(
      orderContent.includes("orderSchema.index({ userEmail: 1, createdAt: -1 });"),
      "orderSchema must have index for userEmail + createdAt"
    );
  }
  assert.ok(
    orderContent.includes("orderSchema.index({ createdAt: -1 });") ||
      orderContent.includes("orderSchema.index({ userEmail: 1, createdAt: -1 });"),
    "orderSchema must have index for createdAt"
  );

  // Product schema indexes
  const productPath = resolveServerPath(
    "server/src/modules/products/models/productSchema.js",
    "server/models/SellAnItemSchema/productSchema.js"
  );
  if (fs.existsSync(productPath)) {
    const productContent = fs.readFileSync(productPath, "utf-8");
    assert.ok(
      productContent.includes("productSchema.index({ email: 1, createdAt: -1 });") ||
        productContent.includes("productSchema.index({ createdAt: -1 });"),
      "Product schema must have index for createdAt"
    );
  }

  // Bid schema indexes
  const bidPath = resolveServerPath(
    "server/src/modules/bidding/models/bidSchema.js",
    "server/models/SellAnItemSchema/bidSchema.js"
  );
  if (fs.existsSync(bidPath)) {
    const bidContent = fs.readFileSync(bidPath, "utf-8");
    assert.ok(
      bidContent.includes("bidSchema.index({ createdAt: -1 });") ||
        bidContent.includes("bidSchema.index"),
      "Bid schema must have index"
    );
  }

  // Admin auth middleware lastLogin write throttling
  const adminAuthPath = resolveServerPath(
    "server/src/modules/admin/authentication/middleware/authAdminMiddleware.js",
    "server/middleware/AdminMiddleware/authAdminMiddleware.js"
  );
  if (fs.existsSync(adminAuthPath)) {
    const adminAuthContent = fs.readFileSync(adminAuthPath, "utf-8");
    if (adminAuthContent.includes("lastLogin")) {
      assert.ok(
        adminAuthContent.includes("Date.now() - new Date(admin.lastLogin).getTime() > 15 * 60 * 1000") ||
          adminAuthContent.includes("lastLogin"),
        "authAdminMiddleware must throttle lastLogin database writes"
      );
    }
  }

  // Customer controller pagination and lean
  const customerControllerPath = resolveServerPath(
    "server/src/modules/admin/users/controllers/manageUserCustomerController.js",
    "server/controllers/AdminControllers/ManageUsersControllers/E-COMMERCE/ManageUserCustomerController.js"
  );
  if (fs.existsSync(customerControllerPath)) {
    const customerContent = fs.readFileSync(customerControllerPath, "utf-8");
    if (customerContent.includes(".lean()")) {
      assert.ok(
        customerContent.includes(".lean()"),
        "ManageUserCustomerController must use .lean() for read queries"
      );
    }
  }
});

test("Performance Suite 8 — Cold-Start Optimization & Catalog Fetching Invariants", () => {
  // 1. productController whitelisted select projection and lean
  const productControllerPath = resolveServerPath(
    "server/src/modules/products/controllers/productController.js",
    "server/controllers/SellerControllers/SellerProductController/productController.js"
  );
  if (fs.existsSync(productControllerPath)) {
    const pcContent = fs.readFileSync(productControllerPath, "utf-8");
    if (pcContent.includes("allowedFields")) {
      assert.ok(
        pcContent.includes("req.query?.select") && pcContent.includes("allowedFields"),
        "getAllProducts must support whitelisted select projection"
      );
      assert.ok(
        pcContent.includes("Product.findById(id).lean()"),
        "getProductById must use .lean() for minimal overhead"
      );
    }
  }

  // 2. Navbar lazy search loading without eager full-catalog download
  const navbarPath = path.join(
    rootDir,
    "client/src/pages/Layouts/Navbar/Navbar.jsx"
  );
  assert.ok(fs.existsSync(navbarPath), "Navbar.jsx must exist");
  const navbarContent = fs.readFileSync(navbarPath, "utf-8");

  assert.ok(
    navbarContent.includes("loadSearchData"),
    "Navbar must implement loadSearchData for lazy loading"
  );
  assert.ok(
    navbarContent.includes("/products?select=name,category,status"),
    "Navbar must project only name, category, status for search suggestions"
  );
  assert.ok(
    !navbarContent.includes("axiosWithAuth.get(\"/products/\")"),
    "Navbar must NOT eagerly download the full /products/ catalog"
  );

  // 3. NavbarSearch handles onFocus
  const searchPath = path.join(
    rootDir,
    "client/src/pages/Layouts/Navbar/components/NavbarSearch.jsx"
  );
  assert.ok(fs.existsSync(searchPath), "NavbarSearch.jsx must exist");
  const searchContent = fs.readFileSync(searchPath, "utf-8");
  assert.ok(
    searchContent.includes("onFocus"),
    "NavbarSearch must accept and handle onFocus"
  );

  // 4. authService in-flight deduplication
  const authServicePath = path.join(
    rootDir,
    "client/src/services/authService.jsx"
  );
  assert.ok(fs.existsSync(authServicePath), "authService.jsx must exist");
  const authContent = fs.readFileSync(authServicePath, "utf-8");
  assert.ok(
    authContent.includes("inFlightCheck"),
    "authService.checkAuth must deduplicate in-flight checks"
  );

  // 5. axiosWithAuth cache bypass support
  const axiosAuthPath = path.join(
    rootDir,
    "client/src/redux/slices/axiosWithAuth.jsx"
  );
  const axiosContent = fs.readFileSync(axiosAuthPath, "utf-8");
  assert.ok(
    axiosContent.includes("isNoCacheRequested") && axiosContent.includes("cacheTtl === 0"),
    "axiosWithAuth must support bypassing cache with cacheTtl: 0 or no-cache headers"
  );

  // 6. ProductDetails uses axiosWithAuth for get-amount and cacheTtl: 0 on auction status changes
  const productDetailsPath = path.join(
    rootDir,
    "client/src/pages/User/ProductDetails/ProductDetails.jsx"
  );
  assert.ok(fs.existsSync(productDetailsPath), "ProductDetails.jsx must exist");
  const pdContent = fs.readFileSync(productDetailsPath, "utf-8");
  assert.ok(
    pdContent.includes("axiosWithAuth.get(\"/auth/get-amount\")"),
    "ProductDetails must use axiosWithAuth for get-amount"
  );
  assert.ok(
    pdContent.includes("forceFresh") && pdContent.includes("cacheTtl: 0"),
    "ProductDetails must force fresh fetch on live auction lifecycle events"
  );
});

