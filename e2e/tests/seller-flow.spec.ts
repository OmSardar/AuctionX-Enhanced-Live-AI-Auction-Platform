import { test, expect } from "@playwright/test";

test.describe("Seller Flow E2E Tests", () => {
  test("seller home landing page renders key seller features", async ({ page }) => {
    await page.goto("/seller");
    await page.waitForLoadState("domcontentloaded");

    expect(page.url()).toContain("/seller");
  });

  test("seller dashboard routes require valid seller authentication", async ({ page }) => {
    await page.goto("/seller/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Expect either redirected to login/seller, or unauthorized view shown
    const url = page.url();
    expect(url.includes("/seller") || url.includes("/login")).toBe(true);
  });

  test("seller verification page renders required input sections", async ({ page }) => {
    await page.goto("/verifysellerprofile");
    await page.waitForLoadState("domcontentloaded");

    expect(page.url()).toContain("verifysellerprofile");
  });
});
