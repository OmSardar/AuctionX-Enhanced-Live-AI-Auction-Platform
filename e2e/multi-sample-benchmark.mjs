import { chromium } from "@playwright/test";
import fs from "fs";

const BASE_URL = "http://localhost:3000";
const SAMPLE_PRODUCT_ID = "6ad8f994f50bcdb83ed041d8";
const SAMPLES = 5;

// Helper to calculate median and range
function stats(arr) {
  if (!arr || arr.length === 0) return { median: 0, min: 0, max: 0, range: "0 - 0" };
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return { median, min, max, range: `${min} - ${max}` };
}

async function measureRoute(page, url, readySelector, isCold = false) {
  const apiRequests = [];
  let totalJsBytes = 0;

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
        if (body) totalJsBytes += body.length;
      } catch {}
    }
  };

  page.on("request", reqListener);
  page.on("response", resListener);

  const t0 = performance.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  const docLoadTime = Math.round(performance.now() - t0);

  // Wait for route data to be usable
  let dataUsableTime = null;
  if (readySelector) {
    try {
      await page.waitForSelector(readySelector, { timeout: 15000 });
      dataUsableTime = Math.round(performance.now() - t0);
    } catch {
      dataUsableTime = Math.round(performance.now() - t0);
    }
  }

  // Brief stabilization
  await page.waitForTimeout(500);
  const totalDuration = Math.round(performance.now() - t0);

  const timing = await page.evaluate(() => {
    const [nav] = performance.getEntriesByType("navigation");
    const paint = performance.getEntriesByType("paint");
    const fcp = paint.find((p) => p.name === "first-contentful-paint");
    return {
      fcp: fcp ? Math.round(fcp.startTime) : null,
      domInteractive: nav ? Math.round(nav.domInteractive) : null,
    };
  }).catch(() => ({ fcp: null, domInteractive: null }));

  page.off("request", reqListener);
  page.off("response", resListener);

  const sortedApis = [...apiRequests].sort((a, b) => (b.duration || 0) - (a.duration || 0));
  const slowestApi = sortedApis[0] || null;
  const totalApiBytes = apiRequests.reduce((sum, r) => sum + (r.size || 0), 0);
  const totalApiTime = apiRequests.reduce((sum, r) => sum + (r.duration || 0), 0);

  return {
    docLoadMs: docLoadTime,
    fcpMs: timing.fcp || docLoadTime,
    domInteractiveMs: timing.domInteractive || docLoadTime,
    dataUsableMs: dataUsableTime || totalDuration,
    totalDurationMs: totalDuration,
    apiCount: apiRequests.length,
    totalApiBytes,
    totalJsBytes,
    totalTransferredBytes: totalApiBytes + totalJsBytes,
    slowestApiUrl: slowestApi ? slowestApi.url.split("/api/")[1] || slowestApi.url : "none",
    slowestApiDurationMs: slowestApi ? slowestApi.duration : 0,
    apiServerLatencyMs: slowestApi ? slowestApi.duration : 0,
    frontendProcessingMs: Math.max(0, (dataUsableTime || totalDuration) - (slowestApi ? slowestApi.duration : 0)),
  };
}

async function benchmark() {
  console.log(`Starting ${SAMPLES}-Sample Benchmark Suite across 5 routes (Cold and Warm)...\n`);
  const browser = await chromium.launch({ headless: true });

  const routesConfig = [
    {
      id: "product_details",
      name: "Public - Product Details",
      url: `${BASE_URL}/product/${SAMPLE_PRODUCT_ID}`,
      readySelector: ".font-numeric",
      auth: null,
    },
    {
      id: "admin_dashboard",
      name: "Admin - Dashboard Overview",
      url: `${BASE_URL}/admin/dashboard`,
      readySelector: "h1, .grid",
      auth: "admin",
    },
    {
      id: "admin_analytics",
      name: "Admin - Analytics",
      url: `${BASE_URL}/admin/dashboard/analytics`,
      readySelector: "h1",
      auth: "admin",
    },
    {
      id: "seller_dashboard",
      name: "Seller - Dashboard Overview",
      url: `${BASE_URL}/seller/dashboard`,
      readySelector: "h1, .grid",
      auth: "seller",
    },
    {
      id: "seller_settings",
      name: "Seller - Settings MyAccount",
      url: `${BASE_URL}/seller/dashboard/settings/myAccount`,
      readySelector: "h1, form, input",
      auth: "seller",
    },
  ];

  console.log("Preparing authenticated sessions...");
  // 1. Admin session
  const adminSetupContext = await browser.newContext();
  const adminPage = await adminSetupContext.newPage();
  await adminPage.goto(`${BASE_URL}/login`);
  await adminPage.fill('input[type="email"]', "admin_perf@auctionx.com");
  await adminPage.fill('input[type="password"]', "PerfAdmin123!");
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForURL("**/admin/dashboard", { timeout: 20000 });
  await adminSetupContext.storageState({ path: "e2e/storage_admin.json" });
  await adminSetupContext.close();

  // 2. Seller session
  const sellerSetupContext = await browser.newContext();
  const sellerPage = await sellerSetupContext.newPage();
  await sellerPage.goto(`${BASE_URL}/seller/login`);
  await sellerPage.fill('input[type="email"]', "seller_1@auctionx.demo");
  await sellerPage.fill('input[type="password"]', "DemoPassword123!");
  await sellerPage.click('button[type="submit"]');
  await sellerPage.waitForURL("**/seller/dashboard**", { timeout: 20000 });
  await sellerSetupContext.storageState({ path: "e2e/storage_seller.json" });
  await sellerSetupContext.close();
  console.log("Authenticated sessions ready.\n");

  function getContextOptions(role) {
    if (role === "admin") return { storageState: "e2e/storage_admin.json" };
    if (role === "seller") return { storageState: "e2e/storage_seller.json" };
    return {};
  }

  const results = {};

  for (const route of routesConfig) {
    console.log(`>>> Benchmarking: ${route.name}`);
    results[route.id] = { name: route.name, cold: [], warm: [] };

    // Cold Samples (separate fresh context per sample)
    for (let i = 1; i <= SAMPLES; i++) {
      process.stdout.write(`  Cold sample ${i}/${SAMPLES}... `);
      const context = await browser.newContext(getContextOptions(route.auth));
      const page = await context.newPage();
      const m = await measureRoute(page, route.url, route.readySelector, true);
      results[route.id].cold.push(m);
      console.log(`Usable: ${m.dataUsableMs}ms, FCP: ${m.fcpMs}ms, APIs: ${m.apiCount}`);
      await context.close();
    }

    // Warm Samples (reuse same context across samples)
    console.log(`  Establishing warm context for ${route.name}...`);
    const warmContext = await browser.newContext(getContextOptions(route.auth));
    const warmPage = await warmContext.newPage();
    // Prime the page once
    await warmPage.goto(route.url, { waitUntil: "domcontentloaded" });
    await warmPage.waitForTimeout(1000);

    for (let i = 1; i <= SAMPLES; i++) {
      process.stdout.write(`  Warm sample ${i}/${SAMPLES}... `);
      const m = await measureRoute(warmPage, route.url, route.readySelector, false);
      results[route.id].warm.push(m);
      console.log(`Usable: ${m.dataUsableMs}ms, FCP: ${m.fcpMs}ms, APIs: ${m.apiCount}`);
    }
    await warmContext.close();
    console.log("");
  }

  await browser.close();

  // Summary aggregation
  const summary = {};
  for (const [id, data] of Object.entries(results)) {
    summary[id] = {
      name: data.name,
      cold: {
        docLoad: stats(data.cold.map((s) => s.docLoadMs)),
        fcp: stats(data.cold.map((s) => s.fcpMs)),
        domInteractive: stats(data.cold.map((s) => s.domInteractiveMs)),
        dataUsable: stats(data.cold.map((s) => s.dataUsableMs)),
        apiCount: stats(data.cold.map((s) => s.apiCount)),
        transferredBytes: stats(data.cold.map((s) => s.totalTransferredBytes)),
        apiBytes: stats(data.cold.map((s) => s.totalApiBytes)),
        slowestApiDuration: stats(data.cold.map((s) => s.slowestApiDurationMs)),
        frontendProcessing: stats(data.cold.map((s) => s.frontendProcessingMs)),
        sampleSlowestApiUrl: data.cold[0]?.slowestApiUrl || "none",
      },
      warm: {
        docLoad: stats(data.warm.map((s) => s.docLoadMs)),
        fcp: stats(data.warm.map((s) => s.fcpMs)),
        domInteractive: stats(data.warm.map((s) => s.domInteractiveMs)),
        dataUsable: stats(data.warm.map((s) => s.dataUsableMs)),
        apiCount: stats(data.warm.map((s) => s.apiCount)),
        transferredBytes: stats(data.warm.map((s) => s.totalTransferredBytes)),
        apiBytes: stats(data.warm.map((s) => s.totalApiBytes)),
        slowestApiDuration: stats(data.warm.map((s) => s.slowestApiDurationMs)),
        frontendProcessing: stats(data.warm.map((s) => s.frontendProcessingMs)),
        sampleSlowestApiUrl: data.warm[0]?.slowestApiUrl || "none",
      },
    };
  }

  fs.writeFileSync("e2e/benchmark_multi_sample_results.json", JSON.stringify({ summary, raw: results }, null, 2));
  console.log("Benchmark complete! Results saved to e2e/benchmark_multi_sample_results.json\n");
}

benchmark().catch((e) => {
  console.error("Benchmark failed:", e);
  process.exit(1);
});
