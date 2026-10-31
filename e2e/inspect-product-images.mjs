import { chromium } from "@playwright/test";

async function inspectImages() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const imageRequests = [];

  page.on("response", async (res) => {
    const url = res.url();
    const contentType = res.headers()["content-type"] || "";
    if (
      contentType.startsWith("image/") ||
      url.match(/\.(jpg|jpeg|png|webp|avif|gif|svg)(\?.*)?$/i) ||
      url.includes("images.unsplash.com") ||
      url.includes("res.cloudinary.com")
    ) {
      let bodyLength = 0;
      try {
        const b = await res.body();
        bodyLength = b ? b.length : 0;
      } catch {}
      imageRequests.push({
        url,
        status: res.status(),
        contentType,
        bytes: bodyLength,
      });
    }
  });

  const productId = "6ad8f994f50bcdb83ed041d8";
  console.log(`Navigating to http://localhost:3000/product/${productId}...`);
  await page.goto(`http://localhost:3000/product/${productId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".font-numeric", { timeout: 15000 });
  await page.waitForTimeout(2000);

  const domImages = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    return imgs.map((img) => ({
      src: img.src,
      currentSrc: img.currentSrc,
      alt: img.alt,
      loading: img.loading,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      clientWidth: img.clientWidth,
      clientHeight: img.clientHeight,
      offsetParent: img.offsetParent !== null,
    }));
  });

  console.log("\n--- Network Image Requests ---");
  let totalImageBytes = 0;
  for (const req of imageRequests) {
    totalImageBytes += req.bytes;
    console.log(
      `- [${req.status}] ${(req.bytes / 1024).toFixed(1)} KB | ${req.contentType} | ${req.url.slice(0, 100)}`
    );
  }
  console.log(`\nTotal Image Requests: ${imageRequests.length}`);
  console.log(`Total Image Transferred: ${(totalImageBytes / 1024 / 1024).toFixed(2)} MB`);

  console.log("\n--- DOM Image Elements ---");
  for (const img of domImages) {
    console.log(
      `- Alt: "${img.alt}" | Visible: ${img.offsetParent} | Nat: ${img.naturalWidth}x${img.naturalHeight} | Rendered: ${img.clientWidth}x${img.clientHeight} | Loading: "${img.loading}" | Src: ${img.src.slice(0, 80)}`
    );
  }

  await browser.close();
}

inspectImages().catch(console.error);
