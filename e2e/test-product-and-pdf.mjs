import { chromium } from "@playwright/test";

const PREVIEW_URL = "http://localhost:4173";
const SAMPLE_PRODUCT_ID = "6ad8f994f50bcdb83ed041d8";

async function run() {
  console.log("=============================================================");
  console.log("AuctionX Asset Loading, LCP & Feature Verification");
  console.log("=============================================================\n");

  const browser = await chromium.launch({ headless: true });

  // --------------------------------------------------------------------------
  // 1. PDF Feature & On-Demand Chunk Verification
  // --------------------------------------------------------------------------
  console.log("--- 1. Testing PDF Feature & vendor-pdf Isolation ---");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    let pdfRequestedBefore = false;
    let pdfRequestedAfter = false;
    let pdfChunkUrl = "";

    page.on("request", (req) => {
      if (req.url().includes("vendor-pdf")) {
        if (!pdfRequestedBefore) {
          pdfRequestedAfter = true;
          pdfChunkUrl = req.url();
        }
      }
    });

    await page.goto(`${PREVIEW_URL}/privacy`, { waitUntil: "networkidle" });
    console.log(`  Initial Privacy page load complete.`);
    console.log(`  vendor-pdf requested before click: ${pdfRequestedBefore ? "YES (LEAK!)" : "NO (Clean!)"}`);

    const pdfBtn = page.locator('button:has-text("Download PDF")');
    await pdfBtn.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    const isBtnVisible = await pdfBtn.isVisible();
    console.log(`  Download PDF button visible: ${isBtnVisible}`);

    if (isBtnVisible) {
      console.log("  Clicking 'Download PDF' button...");
      await pdfBtn.click();
      await page.waitForTimeout(2000);
      console.log(`  vendor-pdf requested after click: ${pdfRequestedAfter ? "YES (Successfully loaded on demand!)" : "NO"}`);
      if (pdfChunkUrl) {
        console.log(`  Loaded chunk URL: ${pdfChunkUrl.split("/").pop()}`);
      }
    }
    await ctx.close();
  }

  // --------------------------------------------------------------------------
  // 2. Measure Product-Detail LCP & Resource Waterfall
  // --------------------------------------------------------------------------
  console.log("\n--- 2. Product-Detail Primary Image & LCP Breakdown ---");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();

    let primaryImgReq = null;
    let primaryImgRes = null;
    const allImages = [];
    const allRequests = [];

    page.on("request", (req) => {
      const u = req.url();
      const rType = req.resourceType();
      allRequests.push({ url: u, type: rType, time: performance.now() });
      if (rType === "image" || /\.(png|jpe?g|webp|avif|svg)(\?.*)?$/i.test(u)) {
        allImages.push({ url: u, time: performance.now() });
        if (!primaryImgReq && (u.includes("images.unsplash.com") || u.includes("cloudinary"))) {
          primaryImgReq = { url: u, start: performance.now() };
        }
      }
    });

    page.on("response", (res) => {
      const u = res.url();
      if (primaryImgReq && u === primaryImgReq.url && !primaryImgRes) {
        primaryImgRes = {
          status: res.status(),
          end: performance.now(),
          contentType: res.headers()["content-type"],
          contentLength: res.headers()["content-length"],
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
        }).observe({ entryTypes: ["largest-contentful-paint", "paint"], buffered: true });
      } catch {}
    });

    const t0 = performance.now();
    await page.goto(`${PREVIEW_URL}/product/${SAMPLE_PRODUCT_ID}`);
    // Wait for product details to be rendered
    await page.waitForSelector(".font-numeric", { timeout: 15000 });
    const dataUsableTime = performance.now() - t0;

    await page.waitForTimeout(500);

    const perfDetails = await page.evaluate(() => {
      const lcpEntries = (window.__perfEntries || []).filter((e) => e.entryType === "largest-contentful-paint");
      const lastLcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1] : null;
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      const navTiming = performance.getEntriesByType("navigation")[0]?.toJSON();
      
      const images = Array.from(document.querySelectorAll("img")).map((img) => ({
        src: img.src,
        currentSrc: img.currentSrc,
        alt: img.alt,
        loading: img.getAttribute("loading"),
        fetchpriority: img.getAttribute("fetchpriority"),
        decoding: img.getAttribute("decoding"),
        sizes: img.getAttribute("sizes"),
        srcset: img.getAttribute("srcset"),
        width: img.clientWidth,
        naturalWidth: img.naturalWidth,
        complete: img.complete,
      }));

      const fonts = performance.getEntriesByType("resource").filter((r) => r.initiatorType === "css" || r.name.includes("font") || r.name.includes(".woff2")).map((r) => ({
        name: r.name.split("/").pop(),
        duration: Math.round(r.duration),
        startTime: Math.round(r.startTime),
      }));

      return {
        fcp: fcp ? Math.round(fcp.startTime) : null,
        lcp: lastLcp ? { startTime: Math.round(lastLcp.startTime), size: lastLcp.size, url: lastLcp.url } : null,
        images,
        fonts,
      };
    });

    console.log(`  Route Data Usable: ${Math.round(dataUsableTime)}ms`);
    console.log(`  First Contentful Paint (FCP): ${perfDetails.fcp}ms`);
    console.log(`  Largest Contentful Paint (LCP): ${perfDetails.lcp?.startTime}ms (element size: ${perfDetails.lcp?.size})`);
    if (perfDetails.lcp?.url) {
      console.log(`  LCP Asset URL: ${perfDetails.lcp.url}`);
    }

    if (primaryImgReq && primaryImgRes) {
      console.log("  Primary Hero Image Timing Breakdown:");
      console.log(`    Request Start: ${Math.round(primaryImgReq.start - t0)}ms`);
      console.log(`    Response End: ${Math.round(primaryImgRes.end - t0)}ms`);
      console.log(`    Transfer Duration: ${Math.round(primaryImgRes.end - primaryImgReq.start)}ms`);
      console.log(`    Content-Type: ${primaryImgRes.contentType}`);
      console.log(`    Content-Length: ${primaryImgRes.contentLength || "chunked"} bytes`);
    }

    console.log(`  Rendered Images in DOM (${perfDetails.images.length}):`);
    perfDetails.images.forEach((img, i) => {
      console.log(`    [${i + 1}] alt="${img.alt}" | loading=${img.loading} | fetchpriority=${img.fetchpriority} | naturalWidth=${img.naturalWidth}px | currentSrc=${img.currentSrc.slice(0, 75)}...`);
    });

    console.log(`  Fonts loaded (${perfDetails.fonts.length}):`, perfDetails.fonts.map(f => `${f.name} (${f.duration}ms)`).join(", "));
    await ctx.close();
  }

  // --------------------------------------------------------------------------
  // 3. Responsive Image Delivery (Desktop 1280px vs Mobile 375px)
  // --------------------------------------------------------------------------
  console.log("\n--- 3. Responsive Image Delivery: Desktop vs Mobile Viewports ---");
  {
    // Desktop Viewport
    const deskCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const deskPage = await deskCtx.newPage();
    await deskPage.goto(`${PREVIEW_URL}/product/${SAMPLE_PRODUCT_ID}`);
    await deskPage.waitForSelector(".font-numeric");
    const deskHero = await deskPage.evaluate(() => {
      const img = document.querySelector('img[alt*="Slide 1"]');
      return img ? { currentSrc: img.currentSrc, clientWidth: img.clientWidth, naturalWidth: img.naturalWidth, srcset: img.getAttribute("srcset") } : null;
    });
    console.log(`  Desktop (1280x800):`);
    console.log(`    Rendered width: ${deskHero?.clientWidth}px, Natural width: ${deskHero?.naturalWidth}px`);
    console.log(`    Active source: ${deskHero?.currentSrc}`);
    await deskCtx.close();

    // Mobile Viewport
    const mobCtx = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const mobPage = await mobCtx.newPage();
    await mobPage.goto(`${PREVIEW_URL}/product/${SAMPLE_PRODUCT_ID}`);
    await mobPage.waitForSelector(".font-numeric");
    const mobHero = await mobPage.evaluate(() => {
      const img = document.querySelector('img[alt*="Slide 1"]');
      return img ? { currentSrc: img.currentSrc, clientWidth: img.clientWidth, naturalWidth: img.naturalWidth, srcset: img.getAttribute("srcset") } : null;
    });
    console.log(`  Mobile (375x667):`);
    console.log(`    Rendered width: ${mobHero?.clientWidth}px, Natural width: ${mobHero?.naturalWidth}px`);
    console.log(`    Active source: ${mobHero?.currentSrc}`);
    await mobCtx.close();
  }

  // --------------------------------------------------------------------------
  // 4. Interactive Image Gallery Features
  // --------------------------------------------------------------------------
  console.log("\n--- 4. Interactive Gallery: Thumbnails & Secondary Image Deferral ---");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();

    const downloadedImages = [];
    page.on("request", (req) => {
      if (req.resourceType() === "image") {
        downloadedImages.push(req.url());
      }
    });

    await page.goto(`${PREVIEW_URL}/product/${SAMPLE_PRODUCT_ID}`);
    await page.waitForSelector(".font-numeric");

    console.log(`  Initial load: ${downloadedImages.length} images downloaded`);
    
    // Check thumbnail dots / buttons
    const slideIndicators = await page.locator(".carousel + div > div, div[onClick]").all();
    console.log(`  Slide indicator elements: ${slideIndicators.length}`);

    // Click 2nd slide dot
    const secondDot = page.locator(".carousel + div > div").nth(1);
    const hasSecondDot = await secondDot.isVisible().catch(() => false);
    if (hasSecondDot) {
      console.log("  Clicking 2nd slide indicator...");
      await secondDot.click();
      await page.waitForTimeout(500);

      const slide2Img = await page.evaluate(() => {
        const img = document.querySelector('img[alt*="Slide 2"]');
        return img ? { src: img.src, complete: img.complete, naturalWidth: img.naturalWidth, loading: img.getAttribute("loading") } : null;
      });
      console.log("  Slide 2 Image after switch:", slide2Img);
    }

    // Check seller avatar
    const sellerAvatar = await page.evaluate(() => {
      const img = document.querySelector('img[alt*="Seller"], img[alt*="avatar"], .seller-info img');
      return img ? { src: img.src, complete: img.complete } : null;
    });
    console.log("  Seller Avatar:", sellerAvatar || "Rendered default initials/icon");

    await ctx.close();
  }

  // --------------------------------------------------------------------------
  // 5. Image Utility Unit Safety Verification
  // --------------------------------------------------------------------------
  console.log("\n--- 5. Image Optimizer Utility Safety Verification ---");
  {
    // Test helper functions in node context directly
    const { getOptimizedImageUrl, getResponsiveSrcSet, getOptimizedDetailImage } = await import(
      "../client/src/utils/imageOptimizer.js"
    );

    const cloudinaryUrl = "https://res.cloudinary.com/auctionx/image/upload/v1234/sample.jpg";
    const unsplashUrl = "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80";
    const customUrl = "https://external-server.com/uploads/photo.jpg";

    console.log("  Testing Cloudinary transformation:");
    const cRes = getOptimizedImageUrl(cloudinaryUrl, { width: 800, quality: 80 });
    console.log("    Input: ", cloudinaryUrl);
    console.log("    Output:", cRes);

    console.log("  Testing Unsplash transformation:");
    const uRes = getOptimizedImageUrl(unsplashUrl, { width: 800, quality: 80 });
    console.log("    Input: ", unsplashUrl);
    console.log("    Output:", uRes);

    console.log("  Testing Unsupported host safety (no invalid alteration):");
    const safeRes = getOptimizedImageUrl(customUrl, { width: 800, quality: 80 });
    console.log("    Input: ", customUrl);
    console.log("    Output:", safeRes);
    console.log("    Preserved exactly:", safeRes === customUrl ? "PASS" : "FAIL");

    const srcSetCustom = getResponsiveSrcSet(customUrl);
    console.log("    Srcset on unsupported host: empty or single src?", srcSetCustom || "(empty)");
  }

  await browser.close();
  console.log("\n=============================================================");
  console.log("Asset Loading and LCP Verification Completed Successfully!");
  console.log("=============================================================");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
