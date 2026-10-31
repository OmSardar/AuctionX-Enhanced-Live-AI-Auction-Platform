import { chromium } from "@playwright/test";
import fs from "fs";

const PREVIEW_URL = "http://localhost:4173";
const SAMPLE_PRODUCT_ID = "6ad8f994f50bcdb83ed041d8";
const SAMPLES = 5;

function stats(arr) {
  if (!arr || arr.length === 0) return { median: 0, min: 0, max: 0, range: "0 - 0" };
  const valid = arr.filter((x) => x !== null && x !== undefined && !isNaN(x));
  if (valid.length === 0) return { median: 0, min: 0, max: 0, range: "0 - 0" };
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return { median, min, max, range: `${min} - ${max}` };
}

async function measureRoute(page, url, readySelector) {
  let totalTransferredBytes = 0;
  let imageBytes = 0;
  let jsBytes = 0;
  let requestCount = 0;
  let imageRequestCount = 0;
  let vendorPdfRequested = false;
  const assetsMap = [];

  const responseHandler = async (res) => {
    requestCount++;
    const u = res.url();
    const headers = res.headers();
    const contentType = headers["content-type"] || "";
    let bodySize = 0;
    try {
      const body = await res.body();
      bodySize = body ? body.length : 0;
    } catch {}

    totalTransferredBytes += bodySize;

    if (u.includes("vendor-pdf")) {
      vendorPdfRequested = true;
    }

    const isImage = contentType.startsWith("image/") || /\.(png|jpe?g|webp|avif|svg|gif|ico)(\?.*)?$/i.test(u);
    if (isImage) {
      imageBytes += bodySize;
      imageRequestCount++;
    }

    const isJs = contentType.includes("javascript") || /\.(js|mjs)(\?.*)?$/i.test(u);
    if (isJs) {
      jsBytes += bodySize;
    }

    // Shorten asset name for logging
    const shortUrl = u.split("?")[0].split("/").slice(-2).join("/");
    assetsMap.push({
      url: shortUrl || u,
      fullUrl: u,
      size: bodySize,
      isImage,
      type: isImage ? "image" : isJs ? "javascript" : contentType.split(";")[0] || "other",
    });
  };

  await page.addInitScript(() => {
    window.__lcp = null;
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          window.__lcp = Math.round(entries[entries.length - 1].startTime);
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}
  });

  page.on("response", responseHandler);

  const t0 = performance.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
  const docLoadTime = Math.round(performance.now() - t0);

  let dataUsableTime = null;
  if (readySelector) {
    try {
      await page.waitForSelector(readySelector, { timeout: 20000 });
      dataUsableTime = Math.round(performance.now() - t0);
    } catch {
      dataUsableTime = Math.round(performance.now() - t0);
    }
  } else {
    dataUsableTime = docLoadTime;
  }

  // Allow layout and LCP observer to settle
  await page.waitForTimeout(600);
  const totalDuration = Math.round(performance.now() - t0);

  // Extract LCP & timing entries from browser
  const perfData = await page.evaluate(() => {
    const paint = performance.getEntriesByType("paint") || [];
    const fcp = paint.find((p) => p.name === "first-contentful-paint");
    return {
      lcp: window.__lcp || (fcp ? Math.round(fcp.startTime) : null),
      fcp: fcp ? Math.round(fcp.startTime) : null,
    };
  }).catch(() => ({ lcp: null, fcp: null }));

  page.off("response", responseHandler);

  // Identify top 3 largest assets
  const sortedAssets = [...assetsMap].sort((a, b) => b.size - a.size);
  const topLargestAssets = sortedAssets.slice(0, 3).map((a) => ({
    name: a.url,
    size: a.size,
    type: a.type,
  }));

  return {
    docLoadMs: docLoadTime,
    dataUsableMs: dataUsableTime || totalDuration,
    lcpMs: perfData.lcp,
    fcpMs: perfData.fcp || docLoadTime,
    totalTransferredBytes,
    imageBytes,
    jsBytes,
    vendorPdfRequested,
    requestCount,
    imageRequestCount,
    largestAssets: topLargestAssets,
  };
}

async function runProductionBenchmark() {
  console.log(`=============================================================`);
  console.log(`Starting Production-Preview Benchmark (Port 4173)`);
  console.log(`Samples per condition: ${SAMPLES} | Mode: Production Build Preview`);
  console.log(`=============================================================\n`);

  const browser = await chromium.launch({ headless: true });

  const routesConfig = [
    {
      id: "product_details",
      name: "Product Details",
      url: `${PREVIEW_URL}/product/${SAMPLE_PRODUCT_ID}`,
      readySelector: ".font-numeric",
      auth: null,
    },
    {
      id: "admin_dashboard",
      name: "Admin Dashboard Overview",
      url: `${PREVIEW_URL}/admin/dashboard`,
      readySelector: "h1, .grid",
      auth: "admin",
    },
    {
      id: "admin_analytics",
      name: "Admin Analytics",
      url: `${PREVIEW_URL}/admin/dashboard/analytics`,
      readySelector: "h1",
      auth: "admin",
    },
    {
      id: "seller_dashboard",
      name: "Seller Dashboard Overview",
      url: `${PREVIEW_URL}/seller/dashboard`,
      readySelector: "h1, .grid",
      auth: "seller",
    },
  ];

  console.log("Preparing authenticated preview sessions...");
  // 1. Admin session
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`${PREVIEW_URL}/login`);
  await adminPage.fill('input[type="email"]', "admin_perf@auctionx.com");
  await adminPage.fill('input[type="password"]', "PerfAdmin123!");
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForURL("**/admin/dashboard", { timeout: 20000 });
  await adminContext.storageState({ path: "e2e/storage_preview_admin.json" });
  await adminContext.close();

  // 2. Seller session
  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await sellerPage.goto(`${PREVIEW_URL}/seller/login`);
  await sellerPage.fill('input[type="email"]', "seller_1@auctionx.demo");
  await sellerPage.fill('input[type="password"]', "DemoPassword123!");
  await sellerPage.click('button[type="submit"]');
  await sellerPage.waitForURL("**/seller/dashboard**", { timeout: 20000 });
  await sellerContext.storageState({ path: "e2e/storage_preview_seller.json" });
  await sellerContext.close();
  console.log("Preview authenticated sessions stored.\n");

  function getContextOpts(authRole) {
    if (authRole === "admin") return { storageState: "e2e/storage_preview_admin.json" };
    if (authRole === "seller") return { storageState: "e2e/storage_preview_seller.json" };
    return {};
  }

  const results = {};

  for (const route of routesConfig) {
    console.log(`>>> Benchmarking Route: [${route.name}]`);
    results[route.id] = { name: route.name, cold: [], warm: [] };

    // 5 Cold samples (brand new browser context each time, empty cache)
    for (let i = 1; i <= SAMPLES; i++) {
      process.stdout.write(`  [Cold ${i}/${SAMPLES}] `);
      const ctx = await browser.newContext(getContextOpts(route.auth));
      const page = await ctx.newPage();
      const sample = await measureRoute(page, route.url, route.readySelector);
      results[route.id].cold.push(sample);
      console.log(
        `Usable: ${sample.dataUsableMs}ms | LCP: ${sample.lcpMs || "N/A"}ms | Total: ${(sample.totalTransferredBytes / 1024).toFixed(1)} KB | Img: ${(sample.imageBytes / 1024).toFixed(1)} KB | Reqs: ${sample.requestCount}`
      );
      await ctx.close();
    }

    // 5 Warm samples (reused context, cache primed)
    console.log(`  Priming warm context for ${route.name}...`);
    const warmCtx = await browser.newContext(getContextOpts(route.auth));
    const warmPage = await warmCtx.newPage();
    await warmPage.goto(route.url, { waitUntil: "domcontentloaded" });
    await warmPage.waitForTimeout(1000);

    for (let i = 1; i <= SAMPLES; i++) {
      process.stdout.write(`  [Warm ${i}/${SAMPLES}] `);
      const sample = await measureRoute(warmPage, route.url, route.readySelector);
      results[route.id].warm.push(sample);
      console.log(
        `Usable: ${sample.dataUsableMs}ms | LCP: ${sample.lcpMs || "N/A"}ms | Total: ${(sample.totalTransferredBytes / 1024).toFixed(1)} KB | Img: ${(sample.imageBytes / 1024).toFixed(1)} KB | Reqs: ${sample.requestCount}`
      );
    }
    await warmCtx.close();
    console.log("");
  }

  await browser.close();

  // Compute medians and ranges
  const summary = {};
  for (const [id, data] of Object.entries(results)) {
    // Extract largest content assets from cold sample 1
    const largestAssetsCold = data.cold[0]?.largestAssets || [];
    const largestAssetsWarm = data.warm[0]?.largestAssets || [];

    summary[id] = {
      name: data.name,
      cold: {
        dataUsable: stats(data.cold.map((s) => s.dataUsableMs)),
        lcp: stats(data.cold.map((s) => s.lcpMs)),
        fcp: stats(data.cold.map((s) => s.fcpMs)),
        totalTransferredBytes: stats(data.cold.map((s) => s.totalTransferredBytes)),
        jsBytes: stats(data.cold.map((s) => s.jsBytes)),
        imageBytes: stats(data.cold.map((s) => s.imageBytes)),
        vendorPdfRequested: data.cold.some((s) => s.vendorPdfRequested),
        requestCount: stats(data.cold.map((s) => s.requestCount)),
        imageRequestCount: stats(data.cold.map((s) => s.imageRequestCount)),
        largestAssets: largestAssetsCold,
      },
      warm: {
        dataUsable: stats(data.warm.map((s) => s.dataUsableMs)),
        lcp: stats(data.warm.map((s) => s.lcpMs)),
        fcp: stats(data.warm.map((s) => s.fcpMs)),
        totalTransferredBytes: stats(data.warm.map((s) => s.totalTransferredBytes)),
        jsBytes: stats(data.warm.map((s) => s.jsBytes)),
        imageBytes: stats(data.warm.map((s) => s.imageBytes)),
        vendorPdfRequested: data.warm.some((s) => s.vendorPdfRequested),
        requestCount: stats(data.warm.map((s) => s.requestCount)),
        imageRequestCount: stats(data.warm.map((s) => s.imageRequestCount)),
        largestAssets: largestAssetsWarm,
      },
    };
  }

  fs.writeFileSync(
    "e2e/production_preview_benchmark_results.json",
    JSON.stringify({ summary, raw: results }, null, 2)
  );

  console.log("=============================================================");
  console.log("Production Preview Benchmark Completed Successfully!");
  console.log("Results saved to e2e/production_preview_benchmark_results.json");
  console.log("=============================================================\n");
}

runProductionBenchmark().catch((err) => {
  console.error("Production preview benchmark failed:", err);
  process.exit(1);
});
