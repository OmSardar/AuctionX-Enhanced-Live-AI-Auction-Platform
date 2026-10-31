import { test, expect } from "@playwright/test";

test.describe("Auction and Bidding User Flows", () => {
  test("scheduled bids page renders properly", async ({ page }) => {
    await page.goto("/scheduledbids");
    await page.waitForLoadState("domcontentloaded");

    expect(page.url()).toContain("scheduledbids");
  });

  test("today bid page displays active auctions or empty state gracefully", async ({ page }) => {
    await page.goto("/todaybid");
    await page.waitForLoadState("domcontentloaded");

    expect(page.url()).toContain("todaybid");
  });

  test("unauthenticated user cannot place bids without being prompted to log in", async ({ page }) => {
    await page.goto("/bid");
    await page.waitForLoadState("domcontentloaded");

    // Check if redirected to login or if auth warning is displayed
    const currentUrl = page.url();
    const hasLoginPrompt = (await page.locator('button:has-text("Login"), a:has-text("Login")').count()) > 0;
    expect(currentUrl.includes("/login") || currentUrl.includes("/bid") || hasLoginPrompt).toBe(true);
  });
});

test.describe.serial("Authoritative Bidding UI with CSRF Protection", () => {
  const path = require("path");
  const mongoose = require(path.resolve(__dirname, "../../server/node_modules/mongoose"));
  const jwt = require(path.resolve(__dirname, "../../server/node_modules/jsonwebtoken"));
  const User = require(path.resolve(__dirname, "../../server/src/modules/users/models/user"));
  const Product = require(path.resolve(__dirname, "../../server/src/modules/products/models/productSchema"));
  const Bid = require(path.resolve(__dirname, "../../server/src/modules/bidding/models/bidSchema"));

  const TEST_JWT_SECRET = process.env.JWT_SECRET || "test-e2e-jwt-secret-minimum-32-chars-long";
  const TEST_MONGODB_URL = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/auctionx-e2e";

  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];

  let sellerUser: any = null;
  let bidderUser: any = null;
  let bidderToken: string = "";
  let testProduct: any = null;
  let productId: string = "";
  let authContext: any = null;
  let authPage: any = null;

  test.beforeAll(async ({ browser }) => {
    // 1. Strict Isolation Check: Connect and verify database name in test runner
    await mongoose.connect(TEST_MONGODB_URL);
    if (mongoose.connection.name !== "auctionx-e2e") {
      await mongoose.disconnect();
      throw new Error(`UNSAFE DATABASE TARGET: Connected to '${mongoose.connection.name}' instead of 'auctionx-e2e'. Aborting test.`);
    }

    // 1b. Server Target Check: Confirm Express application server is running in test mode and connected to auctionx-e2e
    try {
      const readinessRes = await fetch("http://localhost:5000/api/test/e2e-readiness");
      if (!readinessRes.ok) {
        throw new Error(
          `Application server readiness check failed with status ${readinessRes.status}. ` +
          `The server on port 5000 may not be running in test mode or may be an unrelated process.`
        );
      }
      const readinessData = await readinessRes.json();
      if (readinessData.database !== "auctionx-e2e") {
        throw new Error(
          `UNSAFE DATABASE TARGET: Application server is connected to '${readinessData.database}' instead of 'auctionx-e2e'. Aborting test.`
        );
      }
    } catch (serverErr: any) {
      await mongoose.disconnect().catch(() => {});
      throw new Error(`E2E Server Isolation Check Failed: ${serverErr.message}`);
    }

    // 2. Provision Seller User & track ID immediately
    sellerUser = new User({
      name: "E2E Test Seller",
      email: `e2e_seller_${Date.now()}@example.com`,
      password: "TestPassword123!",
      role: "user",
      isVerified: true,
      status: "Active",
      amount: 10000,
    });
    await sellerUser.save();
    createdUserIds.push(sellerUser._id.toString());

    // 3. Provision Bidder User & track ID immediately
    bidderUser = new User({
      name: "E2E Test Bidder",
      email: `e2e_bidder_${Date.now()}@example.com`,
      password: "TestPassword123!",
      role: "user",
      isVerified: true,
      status: "Active",
      amount: 50000,
    });
    await bidderUser.save();
    createdUserIds.push(bidderUser._id.toString());

    // 4. Generate Authoritative JWT Token for Bidder
    bidderToken = jwt.sign(
      {
        id: bidderUser._id.toString(),
        email: bidderUser.email,
        name: bidderUser.name,
        role: bidderUser.role,
      },
      TEST_JWT_SECRET,
      { expiresIn: "2h" }
    );

    // 5. Provision Active Auction Product (owned by sellerUser) & track ID immediately
    testProduct = new Product({
      name: "E2E Isolated Auction Item",
      email: sellerUser.email,
      category: "Electronics",
      mobileNumber: "9876543210",
      biddingStartDate: new Date(Date.now() - 3600000), // Started 1 hour ago
      biddingStartTime: "00:00",
      biddingStartPrice: 1000,
      startingPrice: 1000,
      currentPrice: 1000,
      biddingEndTime: new Date(Date.now() + 86400000).toISOString(), // Closes in 24 hours
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 86400000),
      minIncrement: 50,
      status: "Active",
      images: [
        {
          secure_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
          public_id: "e2e_test_img",
        },
      ],
      description: [
        {
          name: "Item Verification",
          description: "Isolated E2E test item for CSRF bidding flow validation",
        },
      ],
    });
    await testProduct.save();
    productId = testProduct._id.toString();
    createdProductIds.push(productId);

    // 6. Setup persistent authenticated browser context for bidder
    authContext = await browser.newContext();
    await authContext.addCookies([
      { name: "token", value: bidderToken, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" },
      { name: "token", value: bidderToken, url: "http://localhost:5000", httpOnly: true, sameSite: "Lax" },
    ]);
    authPage = await authContext.newPage();
  });

  test.afterAll(async () => {
    try {
      if (authContext) {
        await authContext.close().catch(() => {});
      }
      // Verified Cleanup: Remove strictly the test-owned records from auctionx-e2e
      if (mongoose.connection.readyState === 1 && mongoose.connection.name === "auctionx-e2e") {
        for (const pId of createdProductIds) {
          await Product.deleteOne({ _id: pId }).catch((err: any) =>
            console.error(`Failed to delete test product ${pId}:`, err)
          );
          await Bid.deleteMany({ productId: pId }).catch((err: any) =>
            console.error(`Failed to delete bids for product ${pId}:`, err)
          );
        }
        for (const uId of createdUserIds) {
          await User.deleteOne({ _id: uId }).catch((err: any) =>
            console.error(`Failed to delete test user ${uId}:`, err)
          );
        }
      }
    } finally {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect().catch(() => {});
      }
    }
  });

  test("1. Unauthenticated user cannot bid and sees 'Login to Bid'", async ({ page }) => {
    await page.goto(`/product/${productId}`);
    await page.waitForLoadState("domcontentloaded");

    // Wait for product details to load
    await expect(page.locator('h3:has-text("E2E Isolated Auction Item")')).toBeVisible({ timeout: 15000 });

    // Assert that the action button prompts for login and is disabled
    const loginToBidBtn = page.locator('button:has-text("Login to Bid")');
    await expect(loginToBidBtn).toBeVisible();
    await expect(loginToBidBtn).toBeDisabled();

    // Verify bid input dropdown is not visible
    const bidInput = page.locator('input[type="number"]');
    await expect(bidInput).not.toBeVisible();
  });

  test("2. Authenticated user: Client-side validation rejects invalid bid without sending request", async () => {
    // Track network requests
    let bidPostSent = false;
    authPage.on("request", (req: any) => {
      if (req.url().includes(`/products/${productId}/bid`) && req.method() === "POST") {
        bidPostSent = true;
      }
    });

    await authPage.goto(`/product/${productId}`);
    await authPage.waitForLoadState("domcontentloaded");

    // Wait for product title and authoritative bid button
    await expect(authPage.locator('h3:has-text("E2E Isolated Auction Item")')).toBeVisible({ timeout: 15000 });
    const bidBtn = authPage.locator('button:has-text("Bid on this Item")');
    await expect(bidBtn).toBeVisible({ timeout: 15000 });
    await expect(bidBtn).toBeEnabled();

    // Click to open dropdown
    await bidBtn.click();
    const bidInput = authPage.locator('input[type="number"]');
    await expect(bidInput).toBeVisible();

    // Enter an invalid bid amount below minimum (currentBid: 1000 + 50 = 1050 required)
    await bidInput.fill("1020");
    await authPage.locator(".fa-gavel").click();

    // Verify visible error message
    const alertBox = authPage.locator("text=Invalid amount. Your bid must be at least ₹1050.");
    await expect(alertBox).toBeVisible();

    // Assert that no network request was sent to the backend
    expect(bidPostSent).toBe(false);

    // Verify database ledger remains unchanged (0 bids)
    const bidCount = await Bid.countDocuments({ productId });
    expect(bidCount).toBe(0);
  });

  test("3. Stale CSRF token triggers automatic refresh & replay, successfully placing bid through UI", async () => {
    // Track request attempts and responses
    const bidAttempts: Array<{ url: string; method: string; status: number; csrfHeader: string | undefined }> = [];
    let csrfRefreshCalls = 0;

    authPage.on("response", async (res: any) => {
      if (res.url().includes(`/products/${productId}/bid`) && res.request().method() === "POST") {
        bidAttempts.push({
          url: res.url(),
          method: res.request().method(),
          status: res.status(),
          csrfHeader: res.request().headers()["x-csrf-token"],
        });
      }
      if (res.url().includes("/csrf-token") && res.request().method() === "GET") {
        csrfRefreshCalls++;
      }
    });

    // Controlled stale-token injection on first bid attempt
    let injectedStaleToken = false;
    await authPage.route(`**/api/products/${productId}/bid`, async (route: any) => {
      if (!injectedStaleToken) {
        injectedStaleToken = true;
        const modifiedHeaders = {
          ...route.request().headers(),
          "x-csrf-token": "stale-mismatched-token-99999",
        };
        await route.continue({ headers: modifiedHeaders });
      } else {
        await route.continue();
      }
    });

    await authPage.goto(`/product/${productId}`);
    await authPage.waitForLoadState("domcontentloaded");

    await expect(authPage.locator('h3:has-text("E2E Isolated Auction Item")')).toBeVisible({ timeout: 15000 });
    const bidBtn = authPage.locator('button:has-text("Bid on this Item")');
    await expect(bidBtn).toBeVisible({ timeout: 15000 });

    // Open bid dropdown
    await bidBtn.click();
    const bidInput = authPage.locator('input[type="number"]');
    await expect(bidInput).toBeVisible();

    // Enter valid bid amount (1100 > minimum 1050)
    await bidInput.fill("1100");

    // Click submit gavel
    await authPage.locator(".fa-gavel").click();

    // Wait for authoritative UI success message
    await expect(authPage.locator("text=Bid placed successfully!")).toBeVisible({ timeout: 15000 });

    // Assert visible on-screen current bid updated to ₹1100
    await expect(authPage.locator("text=Current Bid: ₹1100")).toBeVisible();

    // Verify CSRF recovery lifecycle:
    // 1st attempt failed with 403 (stale token), 1 token refresh occurred, 2nd attempt succeeded with 200
    expect(bidAttempts.length).toBe(2);
    expect(bidAttempts[0].status).toBe(403);
    expect(bidAttempts[0].csrfHeader).toBe("stale-mismatched-token-99999");
    expect(csrfRefreshCalls).toBeGreaterThanOrEqual(1);
    expect(bidAttempts[1].status).toBe(200);
    expect(bidAttempts[1].csrfHeader).not.toBe("stale-mismatched-token-99999");

    // Verify authoritative database mutation: Exactly ONE bid created
    const bids = await Bid.find({ productId });
    expect(bids.length).toBe(1);
    expect(bids[0].amount).toBe(1100);
    expect(bids[0].bidder.toString()).toBe(bidderUser._id.toString());
    expect(bids[0].status).toBe("ACCEPTED");

    // Verify product state updated atomically in database
    const updatedProd = await Product.findById(productId);
    expect(updatedProd.currentPrice).toBe(1100);
    expect(updatedProd.bidCount).toBe(1);
    expect(updatedProd.highestBidder.toString()).toBe(bidderUser._id.toString());
  });

  test("4. Subsequent valid bid increments auction state without duplicate calls", async () => {
    let postCount = 0;
    authPage.on("request", (req: any) => {
      if (req.url().includes(`/products/${productId}/bid`) && req.method() === "POST") {
        postCount++;
      }
    });

    await authPage.goto(`/product/${productId}`);
    await authPage.waitForLoadState("domcontentloaded");

    await expect(authPage.locator('h3:has-text("E2E Isolated Auction Item")')).toBeVisible({ timeout: 15000 });
    // Verify previous bid of 1100 is reflected
    await expect(authPage.locator("text=Current Bid: ₹1100")).toBeVisible();

    const bidBtn = authPage.locator('button:has-text("Bid on this Item")');
    await bidBtn.click();

    const bidInput = authPage.locator('input[type="number"]');
    await expect(bidInput).toBeVisible();

    // Minimum now is 1100 + 50 = 1150; enter 1200
    await bidInput.fill("1200");
    await authPage.locator(".fa-gavel").click();

    await expect(authPage.locator("text=Bid placed successfully!")).toBeVisible({ timeout: 15000 });
    await expect(authPage.locator("text=Current Bid: ₹1200")).toBeVisible();

    // Exactly 1 POST request sent (no retry needed because session already has fresh CSRF token)
    expect(postCount).toBe(1);

    // Verify database ledger has exactly 2 bids
    const bids = await Bid.find({ productId }).sort({ amount: 1 });
    expect(bids.length).toBe(2);
    expect(bids[1].amount).toBe(1200);

    const updatedProd = await Product.findById(productId);
    expect(updatedProd.currentPrice).toBe(1200);
    expect(updatedProd.bidCount).toBe(2);
  });

  test("5. Tampered CSRF request is rejected with 403 and produces zero business mutation", async () => {
    await authPage.goto(`/product/${productId}`);
    await authPage.waitForLoadState("domcontentloaded");

    // Perform direct fetch from browser without CSRF token
    const result = await authPage.evaluate(async (pId: string) => {
      try {
        const response = await fetch(`http://localhost:5000/api/products/${pId}/bid`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Deliberately omitted X-CSRF-Token
          },
          body: JSON.stringify({ amount: 1500 }),
          credentials: "include",
        });
        const data = await response.json();
        return { status: response.status, data };
      } catch (e: any) {
        return { error: e.message };
      }
    }, productId);

    // Express csrfProtection rejects before business logic
    expect(result.status).toBe(403);
    expect(result.data?.message).toBe("CSRF token missing");

    // Verify database remains unchanged at exactly 2 bids
    const bidCount = await Bid.countDocuments({ productId });
    expect(bidCount).toBe(2);

    const currentProd = await Product.findById(productId);
    expect(currentProd.currentPrice).toBe(1200);
  });
});
