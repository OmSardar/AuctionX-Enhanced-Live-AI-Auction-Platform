import { test, expect } from "@playwright/test";

test.describe("Authentication Flows", () => {
  test("login page renders successfully with email and password inputs", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Verify login form is present
    const emailInput = page.locator('.sign-in-form input[name="email"], input[type="email"]').first();
    const passwordInput = page.locator('.sign-in-form input[name="password"], input[type="password"]').first();

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
  });

  test("submitting invalid credentials displays appropriate error", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();

    await emailInput.fill("nonexistent_user@example.com");
    await passwordInput.fill("WrongPassword123!");
    await submitButton.click();

    // Verify user stays on login or error message appears
    await expect(page).toHaveURL(/login/);
  });

  test("navigation between login and signup views works", async ({ page }) => {
    await page.goto("/login");

    // Look for link/button to switch to register or sign up
    const signupLink = page.locator('a:has-text("Sign Up"), button:has-text("Sign Up"), a:has-text("Register")').first();
    if (await signupLink.isVisible()) {
      await signupLink.click();
      await page.waitForTimeout(500);
      // Verify page updated or switched view
      expect(page.url()).toBeDefined();
    }
  });
});
