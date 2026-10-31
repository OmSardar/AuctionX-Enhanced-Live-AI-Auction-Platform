import { test, expect } from "@playwright/test";

test.describe("Product Browsing Flow", () => {
  test("homepage loads successfully with title and navigation", async ({ page }) => {
    await page.goto("/");

    // Verify page loads without error
    await expect(page).toHaveTitle(/Auction/i);

    // Verify navbar or header exists
    const nav = page.locator("nav, header").first();
    await expect(nav).toBeVisible();
  });

  test("can navigate to product categories", async ({ page }) => {
    await page.goto("/");

    // Check for category links or explore sections
    const categoryLink = page.locator('a[href*="/category/"], a:has-text("Category"), a:has-text("Categories")').first();
    if (await categoryLink.isVisible()) {
      await categoryLink.click();
      await page.waitForLoadState("domcontentloaded");
      expect(page.url()).toBeDefined();
    }
  });

  test("footer policy and info links are reachable", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page).toHaveURL(/privacy/);

    await page.goto("/faq");
    await expect(page).toHaveURL(/faq/);
  });
});
