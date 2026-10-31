import { chromium } from "@playwright/test";
import fs from "fs";

const BASE_URL = "http://localhost:3000";
const SAMPLE_PRODUCT_ID = "6ad8f994f50bcdb83ed041d8";

async function measureDeep(page, url, label, readySelector, isCold = true) {
  const apiRequests = [];
  const jsRequests = [];
  const errors = [];

  const reqListener = (req) => {
    const u = req.url();
    if (u.includes("/api/")) {
      apiRequests.push({ url: u, method: req.method(), start: performance.now() });
    }
  };

  const resListener = async (res) => {
    const u = res.url();
    if (u.includes("/api/")) {
      const match = apiRequests.find((r) => r.url === u && !r.duration);
      if (match) {
        match.duration = Math.round(performance.now() - match.start);
        match.status = res.status();
        try {
          const body = await res.body();
          match.size = body ? body.length : 0;
        } catch {
          match.size = 0;
        }
      }
    } else if (u.endsWith(".js") || u.includes(".js?")) {
      try {
        const body = await res.body();
        jsRequests.push({ url: u, size: body ? body.length : 0 });
      } catch {}
    }
  };

  page.on("request", reqListener);
  page.on("response", resListener);

  const t0 = performance.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  const docLoadTime = Math.round(performance.now() - t0);

  // Wait for data to be usable
  let dataUsableTime = null;
  if (readySelector) {
    try {
      await page.waitForSelector(readySelector, { timeout: 12000 });
      dataUsableTime = Math.round(performance.now() - t0);
    } catch (e) {
      dataUsableTime = Math.round(performance.now() - t0);
    }
  }

  // Small delay to let any immediately trailing microtasks settle
  await page.waitForTimeout(1000);
  const totalDuration = Math.round(performance.now() - t0);

  // Browser navigation & paint metrics
  const timing = await page.evaluate(() => {
    const [nav] = performance.getEntriesByType("navigation");
    const paint = performance.getEntriesByType("paint");
    const fcp = paint.find((p) => p.name === "first-contentful-paint");
    return {
      fcp: fcp ? Math.round(fcp.startTime) : null,
      domInteractive: nav ? Math.round(nav.domInteractive) : null,
      domComplete: nav ? Math.round(nav.domComplete) : null,
      loadEventEnd: nav ? Math.round(nav.loadEventEnd) : null,
    };
  }).catch(() => ({ fcp: null, domInteractive: null, domComplete: null, loadEventEnd: null }));

  page.off("request", reqListener);
  page.off("response", resListener);

  const sortedApis = [...apiRequests].sort((a, b) => (b.duration || 0) - (a.duration || 0));
  const slowestApi = sortedApis[0] || null;

  return {
    label,
    url,
    isCold,
    docLoadMs: docLoadTime,
    fcpMs: timing.fcp,
    domInteractiveMs: timing.domInteractive,
    dataUsableMs: dataUsableTime || totalDuration,
    totalDurationMs: totalDuration,
    apiCount: apiRequests.length,
    slowestApi: slowestApi ? { url: slowestApi.url.split("/api/")[1] || slowestApi.url, durationMs: slowestApi.duration, status: slowestApi.status } : null,
    apiRequests: apiRequests.map(r => ({ endpoint: r.url.split("/api/")[1] || r.url, durationMs: r.duration, sizeBytes: r.size })),
    jsChunkCount: jsRequests.length,
    totalJsSizeBytes: jsRequests.reduce((sum, j) => sum + j.size, 0),
  };
}

async function run() {
  console.log("Starting deep profiling of the 5 slowest routes...\n");
  const browser = await chromium.launch({ headless: true });
  const results = [];

  // 1. PUBLIC ROUTE: Product Details
  console.log(">>> Profiling Route 1: Public - Product Details");
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  const r1Cold = await measureDeep(publicPage, `${BASE_URL}/product/${SAMPLE_PRODUCT_ID}`, "Public - Product Details", ".font-numeric", true);
  console.log(`  [Cold] FCP: ${r1Cold.fcpMs}ms, Data Usable: ${r1Cold.dataUsableMs}ms, Total: ${r1Cold.totalDurationMs}ms, APIs: ${r1Cold.apiCount}`);
  results.push(r1Cold);

  const r1Warm = await measureDeep(publicPage, `${BASE_URL}/product/${SAMPLE_PRODUCT_ID}`, "Public - Product Details (Warm)", ".font-numeric", false);
  console.log(`  [Warm] FCP: ${r1Warm.fcpMs}ms, Data Usable: ${r1Warm.dataUsableMs}ms, Total: ${r1Warm.totalDurationMs}ms, APIs: ${r1Warm.apiCount}`);
  results.push(r1Warm);
  await publicContext.close();

  // 2. ADMIN ROUTES
  console.log("\n>>> Authenticating Admin for Admin Routes...");
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`${BASE_URL}/login`);
  await adminPage.fill('input[type="email"]', "admin_perf@auctionx.com");
  await adminPage.fill('input[type="password"]', "PerfAdmin123!");
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForURL("**/admin/dashboard", { timeout: 15000 });
  console.log("  Admin login OK");

  // Route 2: Admin - Dashboard Overview
  console.log(">>> Profiling Route 2: Admin - Dashboard Overview");
  const r2Cold = await measureDeep(adminPage, `${BASE_URL}/admin/dashboard`, "Admin - Dashboard Overview", "h1, .grid", true);
  console.log(`  [Cold] FCP: ${r2Cold.fcpMs}ms, Data Usable: ${r2Cold.dataUsableMs}ms, Total: ${r2Cold.totalDurationMs}ms, APIs: ${r2Cold.apiCount}`);
  results.push(r2Cold);

  const r2Warm = await measureDeep(adminPage, `${BASE_URL}/admin/dashboard`, "Admin - Dashboard Overview (Warm)", "h1, .grid", false);
  console.log(`  [Warm] FCP: ${r2Warm.fcpMs}ms, Data Usable: ${r2Warm.dataUsableMs}ms, Total: ${r2Warm.totalDurationMs}ms, APIs: ${r2Warm.apiCount}`);
  results.push(r2Warm);

  // Route 3: Admin - Analytics
  console.log(">>> Profiling Route 3: Admin - Analytics");
  const r3Cold = await measureDeep(adminPage, `${BASE_URL}/admin/dashboard/analytics`, "Admin - Analytics", "h1", true);
  console.log(`  [Cold] FCP: ${r3Cold.fcpMs}ms, Data Usable: ${r3Cold.dataUsableMs}ms, Total: ${r3Cold.totalDurationMs}ms, APIs: ${r3Cold.apiCount}`);
  results.push(r3Cold);

  const r3Warm = await measureDeep(adminPage, `${BASE_URL}/admin/dashboard/analytics`, "Admin - Analytics (Warm)", "h1", false);
  console.log(`  [Warm] FCP: ${r3Warm.fcpMs}ms, Data Usable: ${r3Warm.dataUsableMs}ms, Total: ${r3Warm.totalDurationMs}ms, APIs: ${r3Warm.apiCount}`);
  results.push(r3Warm);
  await adminContext.close();

  // 3. SELLER ROUTES
  console.log("\n>>> Authenticating Seller for Seller Routes...");
  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await sellerPage.goto(`${BASE_URL}/seller/login`);
  await sellerPage.fill('input[type="email"]', "seller_1@auctionx.demo");
  await sellerPage.fill('input[type="password"]', "DemoPassword123!");
  await sellerPage.click('button[type="submit"]');
  await sellerPage.waitForURL("**/seller/dashboard**", { timeout: 15000 });
  console.log("  Seller login OK");

  // Route 4: Seller - Dashboard Overview
  console.log(">>> Profiling Route 4: Seller - Dashboard Overview");
  const r4Cold = await measureDeep(sellerPage, `${BASE_URL}/seller/dashboard`, "Seller - Dashboard Overview", "h1, .grid", true);
  console.log(`  [Cold] FCP: ${r4Cold.fcpMs}ms, Data Usable: ${r4Cold.dataUsableMs}ms, Total: ${r4Cold.totalDurationMs}ms, APIs: ${r4Cold.apiCount}`);
  results.push(r4Cold);

  const r4Warm = await measureDeep(sellerPage, `${BASE_URL}/seller/dashboard`, "Seller - Dashboard Overview (Warm)", "h1, .grid", false);
  console.log(`  [Warm] FCP: ${r4Warm.fcpMs}ms, Data Usable: ${r4Warm.dataUsableMs}ms, Total: ${r4Warm.totalDurationMs}ms, APIs: ${r4Warm.apiCount}`);
  results.push(r4Warm);

  // Route 5: Seller - Settings MyAccount
  console.log(">>> Profiling Route 5: Seller - Settings MyAccount");
  const r5Cold = await measureDeep(sellerPage, `${BASE_URL}/seller/dashboard/settings/myAccount`, "Seller - Settings MyAccount", "h1, form, input", true);
  console.log(`  [Cold] FCP: ${r5Cold.fcpMs}ms, Data Usable: ${r5Cold.dataUsableMs}ms, Total: ${r5Cold.totalDurationMs}ms, APIs: ${r5Cold.apiCount}`);
  results.push(r5Cold);

  const r5Warm = await measureDeep(sellerPage, `${BASE_URL}/seller/dashboard/settings/myAccount`, "Seller - Settings MyAccount (Warm)", "h1, form, input", false);
  console.log(`  [Warm] FCP: ${r5Warm.fcpMs}ms, Data Usable: ${r5Warm.dataUsableMs}ms, Total: ${r5Warm.totalDurationMs}ms, APIs: ${r5Warm.apiCount}`);
  results.push(r5Warm);
  await sellerContext.close();

  await browser.close();

  fs.writeFileSync("e2e/slowest_routes_deep_profile.json", JSON.stringify(results, null, 2));
  console.log("\nDeep profiling results saved to e2e/slowest_routes_deep_profile.json!");
}

run().catch((e) => {
  console.error("Deep profiling failed:", e);
  process.exit(1);
});
