import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
// Allow local server reuse only outside CI when not explicitly disabled (e.g. PLAYWRIGHT_REUSE_SERVER=false)
const reuseServer = !isCI && process.env.PLAYWRIGHT_REUSE_SERVER !== "false";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: process.platform === "win32" ? "cmd /c npm run dev" : "npm run dev",
      cwd: "../client",
      url: "http://localhost:3000",
      reuseExistingServer: reuseServer,
      timeout: 60000,
      env: {
        VITE_API_URL: process.env.VITE_API_URL || "http://localhost:5000",
      },
    },
    {
      command: process.platform === "win32" ? "cmd /c node server.js" : "node server.js",
      cwd: "../server",
      url: "http://localhost:5000",
      reuseExistingServer: reuseServer,
      timeout: 60000,
      env: {
        PORT: process.env.PORT || "5000",
        NODE_ENV: process.env.NODE_ENV || "test",
        MONGODB_URL: process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/auctionx-e2e",
        JWT_SECRET: process.env.JWT_SECRET || "test-e2e-jwt-secret-minimum-32-chars-long",
      },
    },
  ],
});
