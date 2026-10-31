import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const BASE_URL = "http://localhost:3000";

async function runNavbarSearchRegression() {
  console.log("Starting Navbar Search Regression Test Suite...\n");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const apiCalls = [];
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("/api/products")) {
      apiCalls.push(u);
    }
  });

  // 1. Initial page navigation: Confirm /api/products is NOT fetched eagerly on cold load
  console.log("Test 1: Navigating to page without focusing search...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  
  const eagerProductsCalls = apiCalls.filter((u) => u.includes("/api/products"));
  console.log(`  Initial /api/products calls before search interaction: ${eagerProductsCalls.length}`);
  assert.equal(eagerProductsCalls.length, 0, "No eager /api/products requests should fire before search focus");
  console.log("  [PASS] No eager catalog download on mount\n");

  // 2. Desktop Search Focus: Trigger lazy load
  console.log("Test 2: Focusing desktop search input...");
  const desktopSearchInput = page.locator('header input[aria-label="Search products and categories"]').first();
  await desktopSearchInput.click();
  await page.waitForTimeout(1500);

  const focusProductsCalls = apiCalls.filter((u) => u.includes("products?select="));
  console.log(`  /api/products?select= calls after focus: ${focusProductsCalls.length}`);
  assert.ok(focusProductsCalls.length >= 1, "Focusing search must trigger /api/products?select= query");
  console.log("  [PASS] Focus-triggered lazy catalog loading verified\n");

  // 3. Typing in search and displaying suggestions
  console.log("Test 3: Typing 'Rolex' to test suggestions...");
  await desktopSearchInput.fill("Rolex");
  await page.waitForTimeout(600); // wait for debounce (300ms)

  // Look for suggestions dropdown
  const suggestions = page.locator('div[ref], div').filter({ hasText: /Rolex/i });
  const hasRolexText = (await page.content()).includes("Rolex");
  assert.ok(hasRolexText, "Rolex suggestions should appear on typing");
  console.log("  [PASS] Typeahead suggestion filtering verified\n");

  // 4. Category Suggestions
  console.log("Test 4: Typing category query...");
  await desktopSearchInput.fill("Automobilia");
  await page.waitForTimeout(600);
  const hasCategoryMatch = (await page.content()).includes("Automobilia");
  assert.ok(hasCategoryMatch, "Category suggestions should appear on category query");
  console.log("  [PASS] Category suggestions verified\n");

  // 5. Empty results feedback
  console.log("Test 5: Testing empty results toast...");
  await desktopSearchInput.fill("ZzzNonExistentItem999999");
  await desktopSearchInput.press("Enter");
  await page.waitForTimeout(800);
  const toastVisible = (await page.content()).includes("No matching product or category found");
  assert.ok(toastVisible, "Toast notification must inform user when no items match");
  console.log("  [PASS] Empty search results feedback verified\n");

  // 6. Navigation to selected item
  console.log("Test 6: Selecting a product and navigating...");
  await desktopSearchInput.fill("Corvette");
  await page.waitForTimeout(600);
  await desktopSearchInput.press("Enter");
  await page.waitForTimeout(1500);
  const navigatedUrl = page.url();
  console.log(`  Navigated URL: ${navigatedUrl}`);
  assert.ok(navigatedUrl.includes("/posts/"), "Pressing enter on matching item navigates to post detail");
  console.log("  [PASS] Product navigation verified\n");

  await context.close();

  // 7. Mobile Search in Drawer
  console.log("Test 7: Mobile drawer search interaction...");
  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });

  const mobileMenuBtn = mobilePage.locator('button[aria-label="Toggle mobile menu"]');
  await mobileMenuBtn.click();
  await mobilePage.waitForTimeout(800);

  const mobileSearchInput = mobilePage.locator('div[role="dialog"] input[aria-label="Search products and categories"]');
  assert.ok(await mobileSearchInput.isVisible(), "Mobile search input must be visible in open drawer");

  await mobileSearchInput.fill("Rolex");
  await mobilePage.waitForTimeout(600);
  const mobileHasSuggestions = (await mobilePage.content()).includes("Rolex");
  assert.ok(mobileHasSuggestions, "Mobile search displays suggestions");
  console.log("  [PASS] Mobile drawer search verified\n");

  await mobileContext.close();
  await browser.close();

  console.log(">>> All Navbar Search regression tests passed successfully!\n");
}

runNavbarSearchRegression().catch((e) => {
  console.error("Navbar Search regression test failed:", e);
  process.exit(1);
});
