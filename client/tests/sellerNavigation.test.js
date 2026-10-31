import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");

test("1. Seller Listing Deletion — PendingBids.jsx safe error propagation & UI guards", () => {
  const pendingBidsPath = path.resolve(
    clientRoot,
    "src/components/SellerDashboard/partials/dashboard/PendingBids/PendingBids.jsx"
  );
  assert.ok(fs.existsSync(pendingBidsPath), "PendingBids.jsx must exist");
  const content = fs.readFileSync(pendingBidsPath, "utf-8");

  // Verify axiosWithAuth usage
  assert.ok(
    content.includes("axiosWithAuth"),
    "PendingBids.jsx must use axiosWithAuth for authenticated listing requests"
  );

  // Verify safe backend error message display instead of generic toast error
  assert.ok(
    content.includes("error.message") || content.includes("err.response?.data?.message"),
    "PendingBids.jsx must extract and display specific backend error message"
  );

  // Verify deletion guard on active bids or expired time
  assert.ok(
    content.includes("timeLeft.expired") || content.includes("bidCount > 0"),
    "PendingBids.jsx must check auction expiry and active bids before/during deletion"
  );

  // Verify alternative action (e.g. View Listing / Eye icon)
  assert.ok(
    content.includes("View Listing") || content.includes("/product/"),
    "PendingBids.jsx must provide a View Listing link for listings that cannot be deleted"
  );
});

test("2. Console 401/403 Fix — RevenueVisitors.jsx role endpoint isolation", () => {
  const revenueVisitorsPath = path.resolve(
    clientRoot,
    "src/components/SellerDashboard/partials/dashboard/RevenueVisitors.jsx"
  );
  assert.ok(fs.existsSync(revenueVisitorsPath), "RevenueVisitors.jsx must exist");
  const content = fs.readFileSync(revenueVisitorsPath, "utf-8");

  // Must NOT call admin inventory /api/items
  assert.ok(
    !content.includes("/api/items"),
    "RevenueVisitors.jsx must not call admin-only /api/items"
  );

  // Must use seller-scoped product endpoint
  assert.ok(
    content.includes("/products/email/"),
    "RevenueVisitors.jsx must call /products/email/:email to show seller's own listings"
  );
  assert.ok(
    content.includes("axiosWithAuth"),
    "RevenueVisitors.jsx must use authenticated client"
  );
});

test("3. Console 401/403 Fix — Customers2.jsx seller order aggregation", () => {
  const customersPath = path.resolve(
    clientRoot,
    "src/components/SellerDashboard/partials/dashboard/Customers2.jsx"
  );
  assert.ok(fs.existsSync(customersPath), "Customers2.jsx must exist");
  const content = fs.readFileSync(customersPath, "utf-8");

  // Must NOT call /api/admin/customers
  assert.ok(
    !content.includes("/api/admin/customers"),
    "Customers2.jsx must not call admin endpoint /api/admin/customers"
  );

  // Must call seller orders endpoint
  assert.ok(
    content.includes("/orders/seller/"),
    "Customers2.jsx must call /orders/seller/:email"
  );
  assert.ok(
    content.includes("axiosWithAuth"),
    "Customers2.jsx must use axiosWithAuth"
  );
});

test("4. Console 401/403 Fix — InvoicePage.jsx authenticated seller orders", () => {
  const invoicePath = path.resolve(
    clientRoot,
    "src/components/SellerDashboard/partials/dashboard/InvoicePage.jsx"
  );
  assert.ok(fs.existsSync(invoicePath), "InvoicePage.jsx must exist");
  const content = fs.readFileSync(invoicePath, "utf-8");

  // Must NOT call raw unauthenticated /api/orders
  assert.ok(
    !content.includes("axios.get(`${API_URL}/api/orders`"),
    "InvoicePage.jsx must not query unauthenticated /api/orders"
  );

  // Must use seller scoped route with auth
  assert.ok(
    content.includes("/orders/seller/"),
    "InvoicePage.jsx must use seller orders endpoint /orders/seller/:email"
  );
  assert.ok(
    content.includes("axiosWithAuth"),
    "InvoicePage.jsx must use axiosWithAuth"
  );
});

test("5. Console 401/403 Fix — MyNotificationPage.jsx seller scoped notifications", () => {
  const notificationPath = path.resolve(
    clientRoot,
    "src/components/SellerDashboard/partials/dashboard/MyNotificationPage.jsx"
  );
  assert.ok(fs.existsSync(notificationPath), "MyNotificationPage.jsx must exist");
  const content = fs.readFileSync(notificationPath, "utf-8");

  // Must NOT call admin broadcast endpoint
  assert.ok(
    !content.includes("axios.get(`${API_URL}/api/notifications`)") &&
    !content.includes("axios.post(`${API_URL}/api/notifications`"),
    "MyNotificationPage.jsx must not call admin broadcast endpoint /api/notifications"
  );
});

test("6. Performance Fix — AdminAccountPage.jsx infinite loop eliminated", () => {
  const adminAccountPath = path.resolve(
    clientRoot,
    "src/components/SellerDashboard/partials/dashboard/AdminAccount/AdminAccountPage.jsx"
  );
  assert.ok(fs.existsSync(adminAccountPath), "AdminAccountPage.jsx must exist");
  const content = fs.readFileSync(adminAccountPath, "utf-8");

  // isAdminVerified must NOT be in useEffect dependency array
  assert.ok(
    !content.includes("isAdminVerified]"),
    "AdminAccountPage.jsx must not have isAdminVerified in useEffect dependency array"
  );
  assert.ok(
    content.includes("[csrfToken, userEmail, userRole]"),
    "AdminAccountPage.jsx must have stable dependency array [csrfToken, userEmail, userRole]"
  );
});

test("7. Public Seller Navbar — Concise structure and interactive behavior", () => {
  const navbarPath = path.resolve(
    clientRoot,
    "src/pages/Seller/Layouts/SellerNavbar/SellerNavbar.jsx"
  );
  assert.ok(fs.existsSync(navbarPath), "SellerNavbar.jsx must exist");
  const content = fs.readFileSync(navbarPath, "utf-8");

  // Verify logo destination
  assert.ok(
    content.includes('to="/seller"'),
    "SellerNavbar logo must link to /seller"
  );

  // Verify How It Works and Pricing & Fees navigation
  assert.ok(
    content.includes("how-it-works"),
    "SellerNavbar must navigate to how-it-works section"
  );
  assert.ok(
    content.includes("pricing-fees"),
    "SellerNavbar must navigate to pricing-fees section"
  );

  // Verify Seller Resources dropdown destinations
  assert.ok(content.includes('path: "/faq"'), "Seller Resources must include /faq");
  assert.ok(content.includes('path: "/guide"'), "Seller Resources must include /guide");
  assert.ok(content.includes('path: "/support"'), "Seller Resources must include /support");
  assert.ok(content.includes('path: "/terms"'), "Seller Resources must include /terms");

  // Verify Sign In & Start Selling
  assert.ok(content.includes('to="/seller/login"'), "SellerNavbar must include /seller/login");
  assert.ok(content.includes('to="/seller/signup"'), "SellerNavbar must include /seller/signup");

  // Verify Escape key and click-outside listeners
  assert.ok(content.includes("Escape"), "SellerNavbar must dismiss dropdown on Escape key");
  assert.ok(content.includes("mousedown"), "SellerNavbar must dismiss dropdown on outside mousedown");
});

test("8. Seller Home — Section anchors, hash scroll, and authentic claims", () => {
  const homePath = path.resolve(clientRoot, "src/pages/Seller/SellerHome.jsx");
  assert.ok(fs.existsSync(homePath), "SellerHome.jsx must exist");
  const content = fs.readFileSync(homePath, "utf-8");

  // Verify anchor IDs
  assert.ok(content.includes('id="how-it-works"'), "SellerHome must define id='how-it-works'");
  assert.ok(content.includes('id="pricing-fees"'), "SellerHome must define id='pricing-fees'");
  assert.ok(content.includes('id="faqs"'), "SellerHome must define id='faqs'");

  // Verify hash scroll
  assert.ok(content.includes("location.hash"), "SellerHome must handle location.hash for smooth scroll");

  // Verify removal of fabricated metrics
  assert.ok(!content.includes("100K+ Active Bidders Worldwide"), "Fabricated 100K bidder claim must be removed");
  assert.ok(!content.includes("₹45 Cr+"), "Fabricated 45 Cr volume claim must be removed");
});

test("9. Route Navigation Audit — Aliases and Settings redirect registered in App.jsx", () => {
  const appPath = path.resolve(clientRoot, "src/App.jsx");
  assert.ok(fs.existsSync(appPath), "App.jsx must exist");
  const content = fs.readFileSync(appPath, "utf-8");

  // Verify seller aliases
  assert.ok(
    content.includes('path="/seller/how-it-works"'),
    "App.jsx must register /seller/how-it-works"
  );
  assert.ok(
    content.includes('path="/seller/pricing"'),
    "App.jsx must register /seller/pricing"
  );
  assert.ok(
    content.includes('path="/seller/dashboard/settings"'),
    "App.jsx must register /seller/dashboard/settings"
  );
});
