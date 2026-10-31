import { chromium } from "@playwright/test";

async function testPdf() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  let pdfChunkRequested = false;
  page.on("request", (req) => {
    if (req.url().includes("vendor-pdf")) {
      pdfChunkRequested = true;
      console.log("Requested vendor-pdf chunk:", req.url());
    }
  });

  await page.goto("http://localhost:4173/privacy", { waitUntil: "networkidle" });
  console.log("Page loaded. vendor-pdf requested?", pdfChunkRequested);

  const btn = page.locator('button:has-text("Download PDF")');
  await btn.waitFor({ state: "visible", timeout: 10000 });
  console.log("Download PDF button is visible!");

  console.log("Clicking Download PDF button...");
  await btn.click();
  await page.waitForTimeout(2000);

  console.log("After click, vendor-pdf requested?", pdfChunkRequested);
  await browser.close();
}

testPdf().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
