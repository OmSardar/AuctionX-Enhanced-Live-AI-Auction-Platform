import { chromium } from "@playwright/test";
import fs from "fs";

const BASE_URL = "http://localhost:3000";
const SAMPLE_PRODUCT_ID = "6ad8f994f50bcdb83ed041d8";

async function measureRoute(page, url, label, isCold = true) {
  const apiRequests = [];
  const jsRequests = [];
  const failedRequests = [];
  const consoleErrors = [];

  const requestListener = (req) => {
    const reqUrl = req.url();
    if (reqUrl.includes("/api/")) {
      apiRequests.push({ url: reqUrl, start: Date.now() });
    }
  };

  const responseListener = (res) => {
    const resUrl = res.url();
    if (resUrl.includes("/api/")) {
      const match = apiRequests.find((r) => r.url === resUrl);
      if (match) {
        match.duration = Date.now() - match.start;
        match.status = res.status();
      }
      if (res.status() >= 400) {
        failedRequests.push({ url: resUrl, status: res.status() });
      }
    } else if (resUrl.endsWith(".js") || resUrl.includes(".js?")) {
      res.body().then((b) => {
        jsRequests.push({ url: resUrl, size: b ? b.length : 0 });
      }).catch(() => {});
    }
  };

  const consoleListener = (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  };

  page.on("request", requestListener);
  page.on("response", responseListener);
  page.on("console", consoleListener);

  const t0 = Date.now();
  await page.goto(url, { waitUntil: "networkidle", timeout: 25000 }).catch(() => {
    // If networkidle times out due to long-polling / socket, continue
  });
  const tTotal = Date.now() - t0;

  // Extract web vitals & timing from the browser
  const metrics = await page.evaluate(() => {
    const navEntries = performance.getEntriesByType("navigation");
    const nav = navEntries.length > 0 ? navEntries[0] : null;
    const paintEntries = performance.getEntriesByType("paint");
    const fcpEntry = paintEntries.find((p) => p.name === "first-contentful-paint");

    return {
      fcp: fcpEntry ? Math.round(fcpEntry.startTime) : null,
      domInteractive: nav ? Math.round(nav.domInteractive) : null,
      domComplete: nav ? Math.round(nav.domComplete) : null,
      loadEventEnd: nav ? Math.round(nav.loadEventEnd) : null,
    };
  }).catch(() => ({ fcp: null, domInteractive: null, domComplete: null, loadEventEnd: null }));

  page.off("request", requestListener);
  page.off("response", responseListener);
  page.off("console", consoleListener);

  const totalApiDuration = apiRequests.reduce((acc, r) => acc + (r.duration || 0), 0);
  const totalJsSize = jsRequests.reduce((acc, r) => acc + r.size, 0);

  return {
    label,
    url,
    isCold,
    durationMs: tTotal,
    fcp: metrics.fcp,
    interactiveMs: metrics.domInteractive || tTotal,
    apiCount: apiRequests.length,
    totalApiDurationMs: totalApiDuration,
    jsChunkCount: jsRequests.length,
    totalJsSizeBytes: totalJsSize,
    failedRequestCount: failedRequests.length,
    consoleErrorCount: consoleErrors.length,
  };
}

async function main() {
  console.log("================================================================");
  console.log("AUCTIONX POST-OPTIMIZATION PERFORMANCE PROFILER");
  console.log("================================================================");

  const browser = await chromium.launch({ headless: true });
  const results = [];

  // 1. PUBLIC ROUTES (Unauthenticated)
  console.log("\n>>> Profiling Public Routes (Cold)...");
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();

  const publicRoutes = [
    { url: `${BASE_URL}/`, label: "Public - Homepage" },
    { url: `${BASE_URL}/seller`, label: "Public - Seller Home" },
    { url: `${BASE_URL}/login`, label: "Public - Login Page" },
    { url: `${BASE_URL}/seller/login`, label: "Public - Seller Login" },
    { url: `${BASE_URL}/product/${SAMPLE_PRODUCT_ID}`, label: "Public - Product Details" },
  ];

  for (const r of publicRoutes) {
    const res = await measureRoute(publicPage, r.url, r.label, true);
    console.log(`  [Cold] ${r.label}: ${res.durationMs}ms (FCP: ${res.fcp}ms, APIs: ${res.apiCount}, JS: ${Math.round(res.totalJsSizeBytes / 1024)}KB)`);
    results.push(res);

    // Warm repeat navigation
    const warmRes = await measureRoute(publicPage, r.url, `${r.label} (Warm)`, false);
    console.log(`  [Warm] ${r.label}: ${warmRes.durationMs}ms (FCP: ${warmRes.fcp}ms, APIs: ${warmRes.apiCount})`);
    results.push(warmRes);
  }
  await publicContext.close();

  // 2. ADMIN DASHBOARD ROUTES (Authenticated)
  console.log("\n>>> Profiling Admin Dashboard Routes (Authenticated)...");
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  // Authenticate admin
  console.log("  Authenticating as admin (admin_perf@auctionx.com)...");
  await adminPage.goto(`${BASE_URL}/login`);
  await adminPage.fill('input[type="email"]', "admin_perf@auctionx.com");
  await adminPage.fill('input[type="password"]', "PerfAdmin123!");
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForURL("**/admin/dashboard", { timeout: 15000 });
  console.log("  Admin login successful!");

  const adminRoutes = [
    { url: `${BASE_URL}/admin/dashboard`, label: "Admin - Dashboard Overview" },
    { url: `${BASE_URL}/admin/dashboard/analytics`, label: "Admin - Analytics" },
    { url: `${BASE_URL}/admin/dashboard/sales`, label: "Admin - Sales" },
    { url: `${BASE_URL}/admin/dashboard/customers`, label: "Admin - Customers" },
    { url: `${BASE_URL}/admin/dashboard/users`, label: "Admin - Users Directory" },
    { url: `${BASE_URL}/admin/dashboard/inventory`, label: "Admin - Inventory" },
    { url: `${BASE_URL}/admin/dashboard/orders`, label: "Admin - Orders" },
    { url: `${BASE_URL}/admin/dashboard/transactions`, label: "Admin - Transactions" },
    { url: `${BASE_URL}/admin/dashboard/subscriptions`, label: "Admin - Subscriptions" },
    { url: `${BASE_URL}/admin/dashboard/reconciliation`, label: "Admin - Reconciliation" },
    { url: `${BASE_URL}/admin/dashboard/calender`, label: "Admin - Calendar" },
    { url: `${BASE_URL}/admin/dashboard/customEvents`, label: "Admin - Custom Events" },
  ];

  for (const r of adminRoutes) {
    const res = await measureRoute(adminPage, r.url, r.label, true);
    console.log(`  [Admin] ${r.label}: ${res.durationMs}ms (FCP: ${res.fcp}ms, APIs: ${res.apiCount}, JS: ${Math.round(res.totalJsSizeBytes / 1024)}KB)`);
    results.push(res);
  }
  await adminContext.close();

  // 3. SELLER DASHBOARD ROUTES (Authenticated)
  console.log("\n>>> Profiling Seller Dashboard Routes (Authenticated)...");
  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();

  // Authenticate seller
  console.log("  Authenticating as seller (seller_1@auctionx.demo)...");
  await sellerPage.goto(`${BASE_URL}/seller/login`);
  await sellerPage.fill('input[type="email"]', "seller_1@auctionx.demo");
  await sellerPage.fill('input[type="password"]', "DemoPassword123!");
  await sellerPage.click('button[type="submit"]');
  await sellerPage.waitForURL("**/seller/dashboard**", { timeout: 15000 });
  console.log("  Seller login successful!");

  const sellerRoutes = [
    { url: `${BASE_URL}/seller/dashboard`, label: "Seller - Dashboard Overview" },
    { url: `${BASE_URL}/seller/dashboard/analytics`, label: "Seller - Analytics" },
    { url: `${BASE_URL}/seller/dashboard/revenue`, label: "Seller - Revenue" },
    { url: `${BASE_URL}/seller/dashboard/pendingbids`, label: "Seller - Pending Bids" },
    { url: `${BASE_URL}/seller/dashboard/sales`, label: "Seller - Sales" },
    { url: `${BASE_URL}/seller/dashboard/orders`, label: "Seller - Orders" },
    { url: `${BASE_URL}/seller/dashboard/manageUsers`, label: "Seller - Manage Users" },
    { url: `${BASE_URL}/seller/dashboard/invoice`, label: "Seller - Invoice" },
    { url: `${BASE_URL}/seller/dashboard/subscriptions`, label: "Seller - Subscriptions" },
    { url: `${BASE_URL}/seller/dashboard/settings/myAccount`, label: "Seller - Settings MyAccount" },
    { url: `${BASE_URL}/seller/dashboard/settings/myNotifications`, label: "Seller - Notifications" },
  ];

  for (const r of sellerRoutes) {
    const res = await measureRoute(sellerPage, r.url, r.label, true);
    console.log(`  [Seller] ${r.label}: ${res.durationMs}ms (FCP: ${res.fcp}ms, APIs: ${res.apiCount}, JS: ${Math.round(res.totalJsSizeBytes / 1024)}KB)`);
    results.push(res);
  }
  await sellerContext.close();

  await browser.close();

  fs.writeFileSync("performance_post_optimization_data.json", JSON.stringify(results, null, 2));
  console.log("\nPost-optimization results saved to performance_post_optimization_data.json!");
}

main().catch((err) => {
  console.error("Profiling failed:", err);
  process.exit(1);
});
