import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");
const adminPagesDir = path.resolve(clientRoot, "src/components/AdminDashboard/pages");

test("Phase 2 — SmoothScrollProvider Lenis Scroll Prevention & Route Pause", () => {
  const providerPath = path.resolve(clientRoot, "src/components/ui/SmoothScrollProvider.jsx");
  assert.ok(fs.existsSync(providerPath), "SmoothScrollProvider.jsx must exist");
  const content = fs.readFileSync(providerPath, "utf-8");

  // Verify custom prevent callback inspecting data-lenis-prevent attribute
  assert.ok(
    content.includes("data-lenis-prevent"),
    "SmoothScrollProvider must check data-lenis-prevent attribute"
  );
  assert.ok(
    content.includes("node.closest?.(\"[data-lenis-prevent]\")") ||
      content.includes("[data-lenis-prevent]"),
    "SmoothScrollProvider must prevent Lenis wheel interception on containers with data-lenis-prevent"
  );

  // Verify Lenis is paused on administrative and seller dashboard routes
  assert.ok(
    content.includes('pathname.startsWith("/admin")') || content.includes("isAdminOrSeller"),
    "SmoothScrollProvider must detect admin routes to disable singleton Lenis takeover"
  );
  assert.ok(
    content.includes("lenisRef.current.stop()") ||
      content.includes("lenis.stop()"),
    "SmoothScrollProvider must pause Lenis when navigating into dashboard routes"
  );
});

test("Phase 2 — AdminDashboardShell Structure, Invariants & Scroll Container", () => {
  const shellPath = path.resolve(clientRoot, "src/components/AdminDashboard/layouts/AdminDashboardShell.jsx");
  assert.ok(fs.existsSync(shellPath), "AdminDashboardShell.jsx must exist");
  const content = fs.readFileSync(shellPath, "utf-8");

  // Verify root container has data-lenis-prevent="true"
  assert.ok(
    content.includes('data-lenis-prevent="true"'),
    "AdminDashboardShell must declare data-lenis-prevent='true'"
  );

  // Verify scroll container attributes
  assert.ok(
    content.includes('id="admin-main-scroll-container"'),
    "AdminDashboardShell must specify id='admin-main-scroll-container'"
  );
  assert.ok(
    content.includes("overflow-y-auto"),
    "AdminDashboardShell main container must allow natural vertical scrolling"
  );
  assert.ok(
    content.includes("overscroll-contain"),
    "AdminDashboardShell main container must declare overscroll-contain to prevent scroll chaining locks"
  );

  // Verify route change scroll reset
  assert.ok(
    content.includes("scrollContainerRef.current.scrollTo"),
    "AdminDashboardShell must reset scroll position to top on route change"
  );
  assert.ok(
    content.includes("location.pathname"),
    "AdminDashboardShell must trigger scroll restoration on location.pathname dependency"
  );

  // Verify theme tokens
  assert.ok(
    content.includes("bg-canvas") && content.includes("text-foreground"),
    "AdminDashboardShell must use AuctionX theme tokens bg-canvas and text-foreground"
  );
});

test("Phase 3 — Route-level Lazy Loading in App.jsx", () => {
  const appPath = path.resolve(clientRoot, "src/App.jsx");
  assert.ok(fs.existsSync(appPath), "App.jsx must exist");
  const content = fs.readFileSync(appPath, "utf-8");

  // Verify lazyRetry helper is defined and used
  assert.ok(
    content.includes("const lazyRetry ="),
    "App.jsx must declare resilient lazyRetry importer"
  );

  // Check key admin routes are lazy-loaded
  const expectedLazyAdminRoutes = [
    "Dashboard",
    "Analytics",
    "Sales",
    "Customers",
    "Inventory",
    "Orders",
    "Invoice",
    "Transactions",
    "Withdraw",
    "Deposite",
    "Subscriptions",
    "Reports",
    "AdminFeedback",
    "Seller",
    "SellerHistory",
    "AddBanner",
    "AdminTeam",
    "CustomEvents",
    "Calender",
    "MyAccount",
    "MyNotifications",
    "AddAdmins",
    "AdminUsersPage",
    "AdminListingsPage",
    "AdminAuctionsPage",
    "AdminOrdersPage",
    "AdminDisputesPage",
    "AdminReconciliationPage",
  ];

  for (const routeSymbol of expectedLazyAdminRoutes) {
    const regex = new RegExp(`const\\s+${routeSymbol}\\s*=\\s*lazyRetry\\(`);
    assert.ok(
      regex.test(content),
      `Admin route symbol ${routeSymbol} must be loaded via lazyRetry()`
    );
  }

  // Check alias routes are defined
  assert.ok(content.includes('path="/admin/dashboard/users"'), "App.jsx must provide /admin/dashboard/users alias");
  assert.ok(content.includes('path="/admin/dashboard/listings"'), "App.jsx must provide /admin/dashboard/listings alias");
  assert.ok(content.includes('path="/admin/dashboard/auctions"'), "App.jsx must provide /admin/dashboard/auctions alias");
  assert.ok(content.includes('path="/admin/dashboard/reconciliation"'), "App.jsx must provide /admin/dashboard/reconciliation alias");
});

test("Phase 3 — Lazy Loading Heavy Chart Components in Analytics & Sales", () => {
  const analyticsPath = path.resolve(adminPagesDir, "AdminAnalytics.jsx");
  const analyticsContent = fs.readFileSync(analyticsPath, "utf-8");

  // Verify React.lazy is used for Chart.js cards
  assert.ok(
    analyticsContent.includes("lazy(") && analyticsContent.includes("Suspense"),
    "AdminAnalytics must use React.lazy and Suspense"
  );
  assert.ok(
    analyticsContent.includes('lazy(() => import("../partials/dashboard/GraphWide1"))'),
    "AdminAnalytics must lazy-load GraphWide1"
  );
  assert.ok(
    analyticsContent.includes('lazy(() => import("../partials/dashboard/GraphWidePieChart"))'),
    "AdminAnalytics must lazy-load GraphWidePieChart"
  );
  assert.ok(
    analyticsContent.includes('lazy(() => import("../partials/dashboard/RevenueVisitors"))'),
    "AdminAnalytics must lazy-load RevenueVisitors"
  );

  const salesPath = path.resolve(adminPagesDir, "AdminSales.jsx");
  const salesContent = fs.readFileSync(salesPath, "utf-8");

  assert.ok(
    salesContent.includes("lazy(") && salesContent.includes("Suspense"),
    "AdminSales must use React.lazy and Suspense"
  );
  assert.ok(
    salesContent.includes('lazy(() => import("../partials/dashboard/GraphWide6"))'),
    "AdminSales must lazy-load GraphWide6"
  );
  assert.ok(
    salesContent.includes('lazy(() => import("../partials/dashboard/GraphWide7"))'),
    "AdminSales must lazy-load GraphWide7"
  );
});

test("Phase 4 & 5 — Design System & Admin Shell Adoption Across All Admin Pages", () => {
  const files = fs.readdirSync(adminPagesDir).filter((f) => f.endsWith(".jsx"));
  assert.ok(files.length >= 35, `Expected >= 35 admin pages, found ${files.length}`);

  let shellAdoptionCount = 0;
  for (const file of files) {
    if (file === "AdminManageUsers.jsx") {
      // AdminManageUsers delegates to AdminUsersPage directly
      continue;
    }

    const filepath = path.join(adminPagesDir, file);
    const content = fs.readFileSync(filepath, "utf-8");

    // No admin page should import Sidebar or Header directly
    assert.strictEqual(
      content.includes("import Sidebar from"),
      false,
      `${file} must not import Sidebar directly (must use AdminDashboardShell)`
    );
    assert.strictEqual(
      content.includes("import Header from"),
      false,
      `${file} must not import Header directly (must use AdminDashboardShell)`
    );

    // Each page must use AdminDashboardShell
    assert.ok(
      content.includes("AdminDashboardShell"),
      `${file} must use AdminDashboardShell`
    );
    shellAdoptionCount++;
  }

  assert.ok(
    shellAdoptionCount >= 35,
    `All admin pages (${shellAdoptionCount}) must adopt AdminDashboardShell`
  );
});

test("Phase 2 — Modal & Inspection Drawer Scroll Lock Prevention Invariants", () => {
  const modalPages = [
    "AdminUsersPage.jsx",
    "AdminListingsPage.jsx",
    "AdminAuctionsPage.jsx",
    "AdminOrdersPage.jsx",
    "AdminDisputesPage.jsx",
    "AdminReconciliationPage.jsx",
  ];

  for (const pageName of modalPages) {
    const pagePath = path.join(adminPagesDir, pageName);
    assert.ok(fs.existsSync(pagePath), `${pageName} must exist`);
    const content = fs.readFileSync(pagePath, "utf-8");

    // Verify modal scrollable container has data-lenis-prevent="true"
    assert.ok(
      content.includes('data-lenis-prevent="true"'),
      `${pageName} inspection modal must declare data-lenis-prevent="true" to preserve wheel scrolling`
    );
    assert.ok(
      content.includes("overscroll-contain"),
      `${pageName} inspection modal must declare overscroll-contain`
    );
  }
});

test("Phase 4 — Sidebar Theme Tokens & Comprehensive Navigation Links", () => {
  const sidebarPath = path.resolve(clientRoot, "src/components/AdminDashboard/partials/Sidebar.jsx");
  assert.ok(fs.existsSync(sidebarPath), "Sidebar.jsx must exist");
  const content = fs.readFileSync(sidebarPath, "utf-8");

  // Verify theme tokens
  assert.ok(content.includes("bg-surface"), "Sidebar must use bg-surface token");
  assert.ok(content.includes("border-border-subtle"), "Sidebar must use border-border-subtle token");
  assert.ok(content.includes('data-lenis-prevent="true"'), "Sidebar must have data-lenis-prevent='true'");
  assert.ok(content.includes("overscroll-contain"), "Sidebar must have overscroll-contain");

  // Verify navigation links for newly integrated sections
  assert.ok(content.includes('to="/admin/listings"'), "Sidebar must link to /admin/listings");
  assert.ok(content.includes('to="/admin/auctions"'), "Sidebar must link to /admin/auctions");
  assert.ok(content.includes('to="/admin/reconciliation"'), "Sidebar must link to /admin/reconciliation");
  assert.ok(content.includes('to="/admin/orders"'), "Sidebar must link to /admin/orders");
  assert.ok(
    content.includes('to="/admin/dashboard/report"') || content.includes('to="/admin/disputes"'),
    "Sidebar must link to reports / disputes"
  );
  assert.ok(
    content.includes('to="/admin/dashboard/manageUsers"') || content.includes('to="/admin/users"'),
    "Sidebar must link to manage users"
  );
});

test("Phase 5 — CSRF & axiosWithAuth Strict Adoption Across Admin Dashboard", () => {
  const adminPages = fs.readdirSync(adminPagesDir).filter((f) => f.endsWith(".jsx"));
  for (const file of adminPages) {
    const content = fs.readFileSync(path.join(adminPagesDir, file), "utf-8");
    assert.strictEqual(
      content.includes('import axios from "axios"') || content.includes("import axios from 'axios'"),
      false,
      `${file} must not import raw axios; must use axiosWithAuth for CSRF protection`
    );
  }

  const accountDir = path.resolve(clientRoot, "src/components/AdminDashboard/partials/dashboard/AdminAccount");
  if (fs.existsSync(accountDir)) {
    const accountFiles = fs.readdirSync(accountDir).filter((f) => f.endsWith(".jsx"));
    for (const file of accountFiles) {
      const content = fs.readFileSync(path.join(accountDir, file), "utf-8");
      assert.strictEqual(
        content.includes('import axios from "axios"') || content.includes("import axios from 'axios'"),
        false,
        `${file} must not import raw axios; must use axiosWithAuth for CSRF protection`
      );
    }
  }
});

test("Phase 5 — Seller Dashboard 'Add View' Button Theme Harmonization", () => {
  const sellerDashboardPath = path.resolve(clientRoot, "src/components/SellerDashboard/pages/SellerDashboard.jsx");
  assert.ok(fs.existsSync(sellerDashboardPath), "SellerDashboard.jsx must exist");
  const content = fs.readFileSync(sellerDashboardPath, "utf-8");

  assert.ok(
    content.includes("bg-action-primary"),
    "SellerDashboard 'Add View' button must use semantic bg-action-primary token"
  );
  assert.strictEqual(
    content.includes("dark:bg-gray-100 dark:text-gray-800"),
    false,
    "SellerDashboard 'Add View' button must not contain inverted glaring white block in dark mode"
  );
});

