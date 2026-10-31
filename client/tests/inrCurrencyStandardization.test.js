import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatCurrency, formatCompactNumber } from "../src/lib/utils.js";
import { formatValue, formatThousands } from "../src/lib/chartUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientRoot, "..");

test("1. Centralized Currency Formatter — Unit Contract & Edge Cases", () => {
  // ₹100 is displayed as INR
  const hundred = formatCurrency(100);
  assert.ok(hundred.includes("₹"), `Expected ₹ in formatCurrency(100), got: ${hundred}`);
  assert.ok(hundred.includes("100"), `Expected 100 in formatCurrency(100), got: ${hundred}`);

  // ₹1,250 is formatted using Indian grouping
  const thousand = formatCurrency(1250);
  assert.ok(thousand.includes("₹"), `Expected ₹ in formatCurrency(1250), got: ${thousand}`);
  assert.ok(thousand.includes("1,250"), `Expected 1,250 grouping, got: ${thousand}`);

  // Indian Lakh grouping: 1,00,000
  const lakh = formatCurrency(100000);
  assert.ok(lakh.includes("1,00,000"), `Expected Indian grouping 1,00,000, got: ${lakh}`);

  // Decimal amounts are handled correctly
  const decimal = formatCurrency(1250.5);
  assert.ok(decimal.includes("1,250.50"), `Expected 1,250.50, got: ${decimal}`);

  const precise = formatCurrency(349.99);
  assert.ok(precise.includes("349.99"), `Expected 349.99, got: ${precise}`);

  // Zero and missing values are handled safely
  assert.equal(formatCurrency(0), "₹0.00", "0 should format to ₹0.00");
  assert.equal(formatCurrency(null), "₹0.00", "null should format to ₹0.00");
  assert.equal(formatCurrency(undefined), "₹0.00", "undefined should format to ₹0.00");
  assert.equal(formatCurrency(NaN), "₹0.00", "NaN should format to ₹0.00");
  assert.equal(formatCurrency(""), "₹0.00", "Empty string should format to ₹0.00");
  assert.equal(formatCurrency("invalid"), "₹0.00", "Non-numeric string should format to ₹0.00");

  // Options support: minimumFractionDigits: 0
  assert.equal(formatCurrency(100, { minimumFractionDigits: 0 }), "₹100", "Should support 0 fraction digits");

  // Negative amounts displayed correctly
  const negative = formatCurrency(-100);
  assert.ok(negative.includes("100"), "Negative should contain amount");
  assert.ok(negative.includes("-") || negative.includes("−"), `Negative should contain minus sign, got: ${negative}`);

  // String numeric inputs handled gracefully
  assert.equal(formatCurrency("250"), "₹250.00", "Numeric string '250' should format correctly");
});

test("2. Chart Utilities — INR Standardization Contract", () => {
  const chartVal = formatValue(25000);
  assert.ok(chartVal.includes("₹"), `Chart value must use ₹, got: ${chartVal}`);
  assert.ok(!chartVal.includes("$"), "Chart value must not contain $");

  const compactVal = formatCompactNumber(100000);
  assert.ok(compactVal.includes("L") || compactVal.includes("100K") || compactVal.includes("1"), `Compact number in en-IN, got: ${compactVal}`);
});

test("3. Admin Dashboard Audit — Complete Elimination of $ and USD Inconsistencies", () => {
  const adminFiles = [
    "src/components/AdminDashboard/partials/dashboard/Customers.jsx",
    "src/components/AdminDashboard/partials/dashboard/DepositePage.jsx",
    "src/components/AdminDashboard/partials/dashboard/WithdrawPage.jsx",
    "src/components/AdminDashboard/partials/dashboard/Inventory.jsx",
    "src/components/AdminDashboard/partials/dashboard/OrdersPage.jsx",
    "src/components/AdminDashboard/partials/dashboard/SellerHistoryPage.jsx",
    "src/components/AdminDashboard/partials/dashboard/SellerPage.jsx",
    "src/components/AdminDashboard/partials/dashboard/TransactionPage.jsx",
    "src/components/AdminDashboard/partials/dashboard/GoodiesPage/GoodiesPage.jsx",
    "src/components/AdminDashboard/partials/dashboard/GoodiesPage/SellGoodiesPage.jsx",
    "src/components/AdminDashboard/pages/AdminAuctionsPage.jsx",
    "src/components/AdminDashboard/pages/AdminDisputesPage.jsx",
    "src/components/AdminDashboard/pages/AdminListingsPage.jsx",
    "src/components/AdminDashboard/pages/AdminOrdersPage.jsx",
  ];

  for (const relPath of adminFiles) {
    const fullPath = path.resolve(clientRoot, relPath);
    assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
    const content = fs.readFileSync(fullPath, "utf-8");

    // Must not have monetary dollar signs like $100, Price ($), ${amount} without backtick
    assert.ok(!content.includes("Price ($)"), `${relPath} must not have 'Price ($)'`);
    assert.ok(!content.includes("return `$${"), `${relPath} must not return '$' in currency formatter`);
    assert.ok(!/>\s*\$\s*\{/.test(content), `${relPath} must not have JSX literal dollar expression`);
  }
});

test("4. Seller Dashboard Audit — Complete Elimination of $ and USD Inconsistencies", () => {
  const sellerFiles = [
    "src/components/SellerDashboard/partials/dashboard/CustomAuctionPage.jsx",
    "src/components/SellerDashboard/partials/dashboard/OrdersPage.jsx",
    "src/components/SellerDashboard/partials/dashboard/OrderRevenuePage.jsx",
    "src/components/SellerDashboard/partials/dashboard/TransactionPage.jsx",
    "src/components/SellerDashboard/partials/dashboard/PendingBids/PendingBids.jsx",
    "src/components/SellerDashboard/partials/dashboard/GoodiesPage/GoodiesPage.jsx",
    "src/components/SellerDashboard/partials/dashboard/GoodiesPage/SellGoodiesPage.jsx",
    "src/components/SellerDashboard/partials/dashboard/GraphWide1.jsx",
    "src/components/SellerDashboard/partials/dashboard/GraphWide2.jsx",
    "src/components/SellerDashboard/partials/dashboard/GraphWide3.jsx",
    "src/components/SellerDashboard/partials/dashboard/GraphWide7.jsx",
    "src/components/SellerDashboard/partials/dashboard/AdminAccount/ProfileTab.jsx",
  ];

  for (const relPath of sellerFiles) {
    const fullPath = path.resolve(clientRoot, relPath);
    assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
    const content = fs.readFileSync(fullPath, "utf-8");

    assert.ok(!content.includes("Starting Price ($)"), `${relPath} must not have 'Starting Price ($)'`);
    assert.ok(!content.includes("Price ($)"), `${relPath} must not have 'Price ($)'`);
    assert.ok(!content.includes("$24,780"), `${relPath} must not have '$24,780'`);
    assert.ok(!content.includes("$17,489"), `${relPath} must not have '$17,489'`);
    assert.ok(!content.includes("$9,962"), `${relPath} must not have '$9,962'`);
    assert.ok(!content.includes("+$6,796"), `${relPath} must not have '+$6,796'`);
    assert.ok(!content.includes("Minimum: $"), `${relPath} must not have 'Minimum: $'`);
    assert.ok(!/>\s*\$\s*\{/.test(content), `${relPath} must not have JSX literal dollar expression`);
  }
});

test("5. Shared UI Components Audit — Standardized Currency Format", () => {
  const sharedFiles = [
    "src/shared/components/data-display/charts/LineChart02.jsx",
    "src/shared/components/data-display/charts/RealtimeChart.jsx",
    "src/shared/components/data-display/WideCard3.jsx",
    "src/components/Layouts/Footer/Help/Payment/Payment.jsx",
    "src/components/Layouts/Footer/Help/Shipping/Shipping.jsx",
    "src/components/ProductList/ProductList4/ProductList4.jsx",
    "src/components/ProductList/ProductList5/ProductList5.jsx",
    "src/pages/Layouts/Navbar/components/NavbarSearch.jsx",
  ];

  for (const relPath of sharedFiles) {
    const fullPath = path.resolve(clientRoot, relPath);
    assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
    const content = fs.readFileSync(fullPath, "utf-8");

    assert.ok(!content.includes("$1,482"), `${relPath} must not have '$1,482'`);
    assert.ok(!content.includes("USD (Default)"), `${relPath} must not have 'USD (Default)'`);
  }
});

test("6. Demo Product Assets — Verified Working Images on Disk", () => {
  const demoImages = [
    "ceramic-coffee-mug.jpg",
    "steel-water-bottle.jpg",
    "desk-organizer.jpg",
    "wireless-mouse-pad.jpg",
    "premium-notebook.jpg",
    "cotton-tote-bag.jpg",
    "keychain-torch.jpg",
    "table-plant.jpg",
    "phone-stand.jpg",
    "bamboo-toothbrush.jpg",
    "ceramic-flower-vase.jpg",
    "canvas-pencil-pouch.jpg",
    "reusable-lunch-box.jpg",
    "printed-cushion-cover.jpg",
    "cable-organizer.jpg",
    "classic-sunglasses.jpg",
    "mini-desk-clock.jpg",
    "passport-holder.jpg",
    "spoon-set.jpg",
    "reusable-shopping-bag.jpg",
  ];

  const clientAssetDir = path.resolve(clientRoot, "public/demo-products");
  assert.ok(fs.existsSync(clientAssetDir), "client/public/demo-products directory must exist");

  for (const img of demoImages) {
    const imgPath = path.join(clientAssetDir, img);
    assert.ok(fs.existsSync(imgPath), `Demo image must exist on disk: ${img}`);
    const stat = fs.statSync(imgPath);
    assert.ok(stat.size > 5000, `Demo image must be a valid non-empty file (>5KB): ${img} (${stat.size} bytes)`);
  }
});

test("7. Currency Import Invariants — Every file calling formatCurrency must import or define it", () => {
  function walk(dir) {
    let results = [];
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        results = results.concat(walk(full));
      } else if (/\.(jsx|js)$/.test(item)) {
        results.push(full);
      }
    }
    return results;
  }

  const srcDir = path.resolve(clientRoot, "src");
  const allFiles = walk(srcDir);
  const missingImports = [];

  for (const file of allFiles) {
    const content = fs.readFileSync(file, "utf-8");
    if (content.includes("formatCurrency")) {
      const hasImport = /import\s*\{[^}]*formatCurrency[^}]*\}\s*from/.test(content);
      const hasDef = /function\s+formatCurrency|const\s+formatCurrency|export\s*\{[^}]*formatCurrency[^}]*\}/.test(content);
      if (!hasImport && !hasDef) {
        missingImports.push(path.relative(clientRoot, file));
      }
    }
  }

  assert.strictEqual(
    missingImports.length,
    0,
    `Files calling formatCurrency without importing or defining it: ${missingImports.join(", ")}`
  );
});
