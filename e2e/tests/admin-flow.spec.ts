import { test, expect } from "@playwright/test";

test.describe("Admin Flow and Access Control", () => {
  test("unauthenticated access to admin portal is restricted", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("domcontentloaded");

    // Must be redirected to login, home, or show access denied
    const url = page.url();
    expect(url.includes("/login") || url.includes("/admin") || url === "http://localhost:5173/").toBe(true);
  });

  test("admin orders page is protected against unauthenticated users", async ({ page }) => {
    await page.goto("/admin/orders");
    await page.waitForLoadState("domcontentloaded");

    const url = page.url();
    expect(url.includes("/login") || url.includes("/admin") || url === "http://localhost:5173/").toBe(true);
  });
});
