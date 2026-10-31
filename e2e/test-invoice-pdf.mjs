import { chromium } from "@playwright/test";

async function testAdminInvoicePdf() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    storageState: "e2e/storage_preview_admin.json",
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();

  let pdfChunkRequested = false;
  page.on("request", (req) => {
    if (req.url().includes("vendor-pdf")) {
      pdfChunkRequested = true;
      console.log("Requested vendor-pdf chunk:", req.url());
    }
  });

  await page.goto("http://localhost:4173/admin/dashboard/invoice", { waitUntil: "networkidle" });
  console.log("Admin Invoice page loaded. vendor-pdf requested?", pdfChunkRequested);

  // Look for any download/invoice button
  const invoiceBtns = await page.locator('button:has-text("Download"), button:has-text("PDF"), button:has-text("Invoice")').all();
  console.log("Invoice buttons found:", invoiceBtns.length);

  if (invoiceBtns.length > 0) {
    console.log("Clicking first invoice download button...");
    await invoiceBtns[0].click();
    await page.waitForTimeout(2000);
    console.log("After click, vendor-pdf requested?", pdfChunkRequested);
  }

  await ctx.close();
  await browser.close();
}

testAdminInvoicePdf().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
