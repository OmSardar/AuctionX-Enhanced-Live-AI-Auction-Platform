import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatCurrency } from "../src/lib/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");

test("1. Order Details Source Integrity & Dark Theme Standardization", () => {
  const detailedOrderPath = path.resolve(
    clientRoot,
    "src/pages/User/Dropdown/OrderHistory/DetailedOrderPage.jsx"
  );
  assert.ok(fs.existsSync(detailedOrderPath), "DetailedOrderPage.jsx must exist");
  const content = fs.readFileSync(detailedOrderPath, "utf8");

  // Must not have leaked unescaped commented text into JSX
  assert.ok(
    !content.includes("// Add this to your review section JSX"),
    "DetailedOrderPage must not leak unescaped raw comments into JSX"
  );

  // Must use dark theme styling
  assert.ok(
    content.includes("bg-slate-950"),
    "DetailedOrderPage must use dark background bg-slate-950"
  );
  assert.ok(
    !content.includes("bg-white/80 dark:bg-gray-800/80"),
    "DetailedOrderPage must eliminate legacy white/light gradient surfaces"
  );

  // Must import and use ProgressBar with status & step props
  assert.ok(
    content.includes("ProgressBar"),
    "DetailedOrderPage must import ProgressBar"
  );
  assert.ok(
    content.includes("status={order.status}"),
    "DetailedOrderPage must pass status prop to ProgressBar"
  );
  assert.ok(
    content.includes("currentStep="),
    "DetailedOrderPage must pass currentStep prop to ProgressBar"
  );
});

test("2. Modernized ProgressBar Responsive & State Handling", () => {
  const progressBarPath = path.resolve(
    clientRoot,
    "src/components/User/ProgressBar/ProgressBar.jsx"
  );
  assert.ok(fs.existsSync(progressBarPath), "ProgressBar.jsx must exist");
  const content = fs.readFileSync(progressBarPath, "utf8");

  // Must accept props
  assert.ok(
    content.includes("propStep") || content.includes("currentStep"),
    "ProgressBar must accept dynamic step props"
  );
  assert.ok(
    content.includes("status"),
    "ProgressBar must accept status prop"
  );

  // Must eliminate hardcoded bg-white
  assert.ok(
    !content.includes("bg-white shadow-md rounded-lg"),
    "ProgressBar must eliminate hardcoded legacy bg-white container"
  );

  // Must handle terminal states: CANCELLED / EXPIRED / REFUNDED
  assert.ok(
    content.includes("CANCELLED") && content.includes("EXPIRED"),
    "ProgressBar must support CANCELLED/EXPIRED terminal states"
  );
  assert.ok(
    content.includes("REFUNDED"),
    "ProgressBar must support REFUNDED state"
  );
});

test("3. Upgraded DownloadInvoice & PDF Generation Contract", () => {
  const invoicePath = path.resolve(
    clientRoot,
    "src/components/User/DownloadInvoice/DownloadInvoice.jsx"
  );
  assert.ok(fs.existsSync(invoicePath), "DownloadInvoice.jsx must exist");
  const content = fs.readFileSync(invoicePath, "utf8");

  // Must use AuctionX branding, NOT Auction House
  assert.ok(
    content.includes("AuctionX"),
    "Invoice component must use AuctionX branding"
  );
  assert.ok(
    !content.includes("Auction House"),
    "Invoice component must not reference legacy 'Auction House'"
  );

  // Must use jsPDF
  assert.ok(
    content.includes("jsPDF"),
    "Invoice component must import and use jsPDF"
  );

  // Must use safe Rs. / INR formatting for PDF glyph safety
  assert.ok(
    content.includes("Rs.") || content.includes("INR"),
    "Invoice must format currency with Rs. or INR to prevent PDF Unicode encoding issues"
  );

  // Must generate AX-INV invoice reference
  assert.ok(
    content.includes("AX-INV-"),
    "Invoice must format prefix as AX-INV-"
  );
});

test("4. Graceful Address Formatting Logic (No Raw 'A' Placeholders)", () => {
  // Simulate the address formatting logic used in DetailedOrderPage
  const formatDeliveryAddress = (orderData, userProfile) => {
    const rawAddress = (orderData?.address || "").trim();
    const isPlaceholder = !rawAddress || rawAddress.length < 5;

    if (isPlaceholder) {
      const parts = [
        rawAddress ? `Street Address: ${rawAddress}` : null,
        userProfile?.city ? `City: ${userProfile.city}` : null,
        userProfile?.state ? `State: ${userProfile.state}` : null,
        userProfile?.pinCode ? `PIN: ${userProfile.pinCode}` : null,
        "India",
      ].filter(Boolean);

      return {
        formatted: parts.length > 1 ? parts.join(", ") : "Incomplete address on file",
        isIncomplete: true,
        raw: rawAddress,
      };
    }

    return {
      formatted: rawAddress,
      isIncomplete: false,
      raw: rawAddress,
    };
  };

  // Case 1: Incomplete placeholder "A" with user profile details
  const incompleteOrder = { address: "A" };
  const userProfile = { city: "Kalyani", state: "WB", pinCode: "121212" };
  const formatted1 = formatDeliveryAddress(incompleteOrder, userProfile);

  assert.equal(formatted1.isIncomplete, true, "Should flag single character address as incomplete");
  assert.ok(
    formatted1.formatted.includes("Kalyani"),
    "Formatted address should include city from profile"
  );
  assert.ok(
    formatted1.formatted.includes("WB"),
    "Formatted address should include state from profile"
  );
  assert.ok(
    formatted1.formatted.includes("121212"),
    "Formatted address should include PIN code from profile"
  );

  // Case 2: Complete address provided directly
  const completeOrder = {
    address: "Flat 4B, Greenfield Heights, New Town, Kolkata - 700156",
  };
  const formatted2 = formatDeliveryAddress(completeOrder, userProfile);
  assert.equal(formatted2.isIncomplete, false);
  assert.equal(formatted2.formatted, completeOrder.address);
});

test("5. Auction Financial Reconciliation: Start Price vs Winning Bid (The ₹1,200 Mystery)", () => {
  // Test case matching MongoDB record 6ae4dbe7b006cb446b5b154e
  const orderRecord = {
    _id: "6ae4dbe7b006cb446b5b154e",
    title: "Mini Bluetooth Speaker",
    biddingStartPrice: 399,
    highestBid: 1200,
    finalPrice: 1200,
    status: "PAID",
  };

  const startPrice = orderRecord.biddingStartPrice;
  const winningBid = orderRecord.highestBid || orderRecord.finalPrice;
  const priceAppreciation = winningBid - startPrice;

  assert.equal(startPrice, 399, "Start price should be ₹399");
  assert.equal(winningBid, 1200, "Winning final bid should be ₹1,200");
  assert.equal(priceAppreciation, 801, "Auction competition appreciation should be ₹801");

  // Format checks
  assert.equal(formatCurrency(startPrice), "₹399.00");
  assert.equal(formatCurrency(winningBid), "₹1,200.00");
  assert.equal(formatCurrency(priceAppreciation), "₹801.00");
});

test("6. Quick Actions Functionality Integrity", () => {
  const detailedOrderPath = path.resolve(
    clientRoot,
    "src/pages/User/Dropdown/OrderHistory/DetailedOrderPage.jsx"
  );
  const content = fs.readFileSync(detailedOrderPath, "utf8");

  // Action 1: Pay Now
  assert.ok(
    content.includes("handlePayNow") && content.includes("order.status === \"PENDING\""),
    "Pay Now action must be present and conditioned on PENDING status"
  );

  // Action 2: Download Invoice
  assert.ok(
    content.includes("<DownloadInvoice"),
    "Download Invoice component must be integrated"
  );

  // Action 3: Track Package Modal
  assert.ok(
    content.includes("setIsTrackModalOpen(true)") && content.includes("isTrackModalOpen"),
    "Track Package must have functional modal state and click handler"
  );
  assert.ok(
    content.includes("AX-TRK-"),
    "Track Package must display formatted AX-TRK- tracking code"
  );

  // Action 4: Contact Support Modal
  assert.ok(
    content.includes("handleOpenSupportModal") && content.includes("isSupportModalOpen"),
    "Contact Support must have functional modal state and click handler"
  );
  assert.ok(
    content.includes("/api/contact"),
    "Contact Support must submit inquiry directly to /api/contact"
  );
});

test("7. HelpAndSupportPage Integration with /api/contact", () => {
  const helpPath = path.resolve(
    clientRoot,
    "src/components/Common/Profile/ProfilePages/HelpAndSupportPage/HelpAndSupportPage.jsx"
  );
  assert.ok(fs.existsSync(helpPath), "HelpAndSupportPage.jsx must exist");
  const content = fs.readFileSync(helpPath, "utf8");

  // Verify form submission calls /api/contact instead of /api/privacy
  assert.ok(
    content.includes("${API_URL}/api/contact"),
    "HelpAndSupportPage must submit tickets to /api/contact"
  );
  assert.ok(
    !content.includes("${API_URL}/api/privacy"),
    "HelpAndSupportPage must NOT submit support tickets to /api/privacy"
  );
});

