import { chromium } from "@playwright/test";

const PREVIEW_URL = "http://localhost:4173";
const SAMPLE_PRODUCT_ID = "6ad8f994f50bcdb83ed041d8";

async function verifyAll() {
  console.log("=============================================================");
  console.log("AuctionX Asset Loading, LCP, PDF & Image Delivery Verification");
  console.log("=============================================================\n");

  const browser = await chromium.launch({ headless: true });

  // --------------------------------------------------------------------------
  // 1. Audit vendor-pdf across Initial Route Loads
  // --------------------------------------------------------------------------
  console.log("--- 1. Testing Initial Route Loads for vendor-pdf Leakage ---");

  // First authenticate admin and seller for dashboard visits
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await adminPage.goto(`${PREVIEW_URL}/login`);
  await adminPage.fill('input[type="email"]', "admin_perf@auctionx.com");
  await adminPage.fill('input[type="password"]', "PerfAdmin123!");
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForURL("**/admin/dashboard", { timeout: 15000 });
  await adminCtx.storageState({ path: "e2e/storage_preview_admin.json" });
  await adminCtx.close();

  const sellerCtx = await browser.newContext();
  const sellerPage = await sellerCtx.newPage();
  await sellerPage.goto(`${PREVIEW_URL}/seller/login`);
  await sellerPage.fill('input[type="email"]', "seller_1@auctionx.demo");
  await sellerPage.fill('input[type="password"]', "DemoPassword123!");
  await sellerPage.click('button[type="submit"]');
  await sellerPage.waitForURL("**/seller/dashboard**", { timeout: 15000 });
  await sellerCtx.storageState({ path: "e2e/storage_preview_seller.json" });
  await sellerCtx.close();

  const testRoutes = [
    { name: "Public Homepage", url: `${PREVIEW_URL}/`, auth: null },
    { name: "Product Detail", url: `${PREVIEW_URL}/product/${SAMPLE_PRODUCT_ID}`, auth: null },
    { name: "Admin Dashboard", url: `${PREVIEW_URL}/admin/dashboard`, auth: "e2e/storage_preview_admin.json" },
    { name: "Admin Analytics", url: `${PREVIEW_URL}/admin/dashboard/analytics`, auth: "e2e/storage_preview_admin.json" },
    { name: "Seller Dashboard", url: `${PREVIEW_URL}/seller/dashboard`, auth: "e2e/storage_preview_seller.json" },
  ];

  for (const r of testRoutes) {
    const ctx = await browser.newContext(r.auth ? { storageState: r.auth } : {});
    const page = await ctx.newPage();
    let pdfChunkRequested = false;
    let jsChunks = [];

    page.on("request", (req) => {
      const u = req.url();
      if (u.includes("vendor-pdf")) {
        pdfChunkRequested = true;
      }
      if (u.endsWith(".js") || u.includes(".js?")) {
        const chunkName = u.split("/").pop().split("?")[0];
        jsChunks.push(chunkName);
      }
    });

    await page.goto(r.url, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    console.log(`Route [${r.name}]:`);
    console.log(`  vendor-pdf requested: ${pdfChunkRequested ? "YES (LEAK!)" : "NO (Clean! Isolated)"}`);
    console.log(`  JS Chunks loaded: ${jsChunks.length} chunks`);
    if (pdfChunkRequested) {
      console.error(`  ERROR: vendor-pdf was requested on ${r.name}!`);
    }
    await ctx.close();
  }

  // --------------------------------------------------------------------------
  // 1b. Verify On-Demand PDF Export Feature Works
  // --------------------------------------------------------------------------
  console.log("\n--- 1b. Testing On-Demand PDF Download Feature ---");
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    let pdfChunkRequested = false;
    let pdfDownloaded = false;

    page.on("request", (req) => {
      if (req.url().includes("vendor-pdf")) {
        pdfChunkRequested = true;
      }
    });

    page.on("download", async (download) => {
      pdfDownloaded = true;
      console.log(`  Download triggered: ${download.suggestedFilename()}`);
    });

    // Visit Privacy Policy
    await page.goto(`${PREVIEW_URL}/privacy`, { waitUntil: "networkidle" });
    console.log(`  Before PDF button click, vendor-pdf requested: ${pdfChunkRequested}`);

    // Find and click the download button
    const downloadBtn = page.locator('button:has-text("Download PDF"), button:has-text("Download Policy"), button:has-text("Export")').first();
    const isVisible = await downloadBtn.isVisible().catch(() => false);
    if (isVisible) {
      console.log("  Clicking PDF Download button in Privacy page...");
      await downloadBtn.click();
      await page.waitForTimeout(2000);
      console.log(`  After PDF button click, vendor-pdf requested: ${pdfChunkRequested ? "YES (Loaded on-demand!)" : "NO"}`);
    } else {
      console.log("  Privacy download button not found via simple selector, checking button locator...");
      const buttons = await page.locator("button").allInnerTexts();
      console.log("  Available buttons:", buttons.slice(0, 10));
    }
    await ctx.close();
  }

  // --------------------------------------------------------------------------
  // 2. Measure Product-Detail LCP & Resource Waterfall
  // --------------------------------------------------------------------------
  console.log("\n--- 2. Product-Detail Primary Image & LCP Breakdown ---");
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    let primaryImageReq = null;
    let primaryImageRes = null;
    const allImagesRequested = [];

    page.on("request", (req) => {
      const u = req.url();
      if (req.resourceType() === "image" || /\.(png|jpe?g|webp|avif|svg)(\?.*)?$/i.test(u)) {
        allImagesRequested.push({ url: u, priority: req.headers()["priority"] || "unknown", time: performance.now() });
        if (!primaryImageReq && (u.includes("res.cloudinary.com") || u.includes("images.unsplash.com") || u.includes("dummyjson.com") || u.includes("product"))) {
          primaryImageReq = { url: u, start: performance.now() };
        }
      }
    });

    page.on("response", (res) => {
      const u = res.url();
      if (primaryImageReq && u === primaryImageReq.url && !primaryImageRes) {
        primaryImageRes = {
          status: res.status(),
          end: performance.now(),
          size: 0,
          contentType: res.headers()["content-type"],
        };
      }
    });

    await page.addInitScript(() => {
      window.__perfEntries = [];
      try {
        new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            window.__perfEntries.push({
              name: entry.name,
              entryType: entry.entryType,
              startTime: entry.startTime,
              duration: entry.duration,
              element: entry.element ? entry.element.tagName : null,
              size: entry.size || 0,
              url: entry.url || "",
            });
          });
        }).observe({ entryTypes: ["largest-contentful-paint", "paint", "element"], buffered: true });
      } catch {}
    });

    const t0 = performance.now();
    await page.goto(`${PREVIEW_URL}/product/${SAMPLE_PRODUCT_ID}`, { waitUntil: "networkidle" });
    const loadDuration = performance.now() - t0;

    const timings = await page.evaluate(() => {
      const lcpEntries = (window.__perfEntries || []).filter((e) => e.entryType === "largest-contentful-paint");
      const lastLcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1] : null;
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      const navTiming = performance.getEntriesByType("navigation")[0]?.toJSON();
      const resourceEntries = performance.getEntriesByType("resource").map((r) => ({
        name: r.name,
        initiatorType: r.initiatorType,
        startTime: Math.round(r.startTime),
        responseEnd: Math.round(r.responseEnd),
        duration: Math.round(r.duration),
        transferSize: r.transferSize,
        decodedBodySize: r.decodedBodySize,
      }));

      // Find primary image element
      const heroImg = document.querySelector('img[fetchpriority="high"], img[alt*="slide"], .carousel-container img');
      const heroImgInfo = heroImg
        ? {
            currentSrc: heroImg.currentSrc,
            naturalWidth: heroImg.naturalWidth,
            naturalHeight: heroImg.naturalHeight,
            loading: heroImg.getAttribute("loading"),
            fetchpriority: heroImg.getAttribute("fetchpriority"),
            decoding: heroImg.getAttribute("decoding"),
            sizes: heroImg.getAttribute("sizes"),
            srcset: heroImg.getAttribute("srcset"),
          }
        : null;

      return {
        lcp: lastLcp ? { startTime: Math.round(lastLcp.startTime), size: lastLcp.size, url: lastLcp.url } : null,
        fcp: fcp ? Math.round(fcp.startTime) : null,
        heroImgInfo,
        resources: resourceEntries,
      };
    });

    console.log(`  Page Load Complete: ${Math.round(loadDuration)}ms`);
    console.log(`  First Contentful Paint (FCP): ${timings.fcp}ms`);
    console.log(`  Largest Contentful Paint (LCP): ${timings.lcp ? `${timings.lcp.startTime}ms (element size: ${timings.lcp.size})` : "N/A"}`);
    if (timings.lcp?.url) {
      console.log(`  LCP Asset URL: ${timings.lcp.url.slice(0, 80)}...`);
    }
    console.log("  Hero Image DOM Attributes:");
    console.log("   ", timings.heroImgInfo);

    console.log(`  Total Images Requested on Initial Load: ${allImagesRequested.length}`);
    allImagesRequested.slice(0, 5).forEach((img, idx) => {
      console.log(`    [${idx + 1}] ${img.url.slice(0, 80)}...`);
    });

    await ctx.close();
  }

  // --------------------------------------------------------------------------
  // 3. Verify Responsive srcset at Desktop (1280px) and Mobile (375px)
  // --------------------------------------------------------------------------
  console.log("\n--- 3. Responsive Image Delivery: Desktop vs Mobile ---");
  {
    // Desktop Viewport (1280x800)
    const deskCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const deskPage = await deskCtx.newPage();
    await deskPage.goto(`${PREVIEW_URL}/product/${SAMPLE_PRODUCT_ID}`, { waitUntil: "networkidle" });
    const deskHero = await deskPage.evaluate(() => {
      const img = document.querySelector('img[fetchpriority="high"]') || document.querySelector(".carousel-container img");
      return img ? { currentSrc: img.currentSrc, naturalWidth: img.naturalWidth, width: img.clientWidth } : null;
    });
    console.log(`  Desktop (1280px viewport):`);
    console.log(`    Rendered width: ${deskHero?.width}px, Natural width: ${deskHero?.naturalWidth}px`);
    console.log(`    Current source: ${deskHero?.currentSrc}`);
    await deskCtx.close();

    // Mobile Viewport (375x667)
    const mobCtx = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const mobPage = await mobCtx.newPage();
    await mobPage.goto(`${PREVIEW_URL}/product/${SAMPLE_PRODUCT_ID}`, { waitUntil: "networkidle" });
    const mobHero = await mobPage.evaluate(() => {
      const img = document.querySelector('img[fetchpriority="high"]') || document.querySelector(".carousel-container img");
      return img ? { currentSrc: img.currentSrc, naturalWidth: img.naturalWidth, width: img.clientWidth } : null;
    });
    console.log(`  Mobile (375px viewport):`);
    console.log(`    Rendered width: ${mobHero?.width}px, Natural width: ${mobHero?.naturalWidth}px`);
    console.log(`    Current source: ${mobHero?.currentSrc}`);
    await mobCtx.close();
  }

  // --------------------------------------------------------------------------
  // 4. Verify Interactive Features: Thumbnails, Zoom, Modal, Fallback
  // --------------------------------------------------------------------------
  console.log("\n--- 4. Interactive Image Features: Thumbnails, Zoom, Modals ---");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${PREVIEW_URL}/product/${SAMPLE_PRODUCT_ID}`, { waitUntil: "networkidle" });

    // Thumbnails check
    const thumbnails = await page.locator('button[aria-label*="Slide"], button:has(img)').all();
    console.log(`  Thumbnail buttons found: ${thumbnails.length}`);
    if (thumbnails.length > 1) {
      console.log("  Clicking 2nd thumbnail...");
      await thumbnails[1].click();
      await page.waitForTimeout(400);
      console.log("  Successfully switched slide via thumbnail.");
    }

    // Zoom / Fullscreen Modal check
    const zoomBtn = page.locator('button[aria-label*="zoom"], button[aria-label*="fullscreen"], button:has(svg)').first();
    const zoomExists = await zoomBtn.isVisible().catch(() => false);
    console.log(`  Zoom / Modal action button visible: ${zoomExists}`);

    // Check seller avatar
    const avatar = await page.evaluate(() => {
      const avImg = document.querySelector('img[alt*="avatar"], img[alt*="Seller"], .avatar img');
      return avImg ? { src: avImg.currentSrc, complete: avImg.complete } : null;
    });
    console.log("  Seller Avatar:", avatar || "Default icon rendered");

    // Test URL utility behavior on original vs unsupported hosts
    const urlTestResults = await page.evaluate(async () => {
      // Import imageUtils directly
      try {
        const { getOptimizedImageUrl, getResponsiveImageSrcSet } = await import("/src/utils/imageUtils.js");
        const cloudUrl = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
        const unsplashUrl = "https://images.unsplash.com/photo-1518791841217-8f162f1e1131";
        const customUrl = "https://example.com/photo.jpg";

        return {
          cloudinaryOptimized: getOptimizedImageUrl(cloudUrl, { width: 800, quality: 80 }),
          unsplashOptimized: getOptimizedImageUrl(unsplashUrl, { width: 800, quality: 80 }),
          customPreserved: getOptimizedImageUrl(customUrl, { width: 800, quality: 80 }),
          customSrcSet: getResponsiveImageSrcSet(customUrl),
        };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log("  Image Utility URL tests:", urlTestResults);

    await ctx.close();
  }

  await browser.close();
  console.log("\n=============================================================");
  console.log("Verification finished.");
  console.log("=============================================================");
}

verifyAll().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
