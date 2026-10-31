# Auction X — Focused Bug-Fix Audit Report: My Orders, Scheduled Bids, and Product Timing

**Date:** October 14, 2026  
**Status:** Completed  
**Scope:** Three targeted bug fixes in Auction X without modifying unrelated features, Razorpay payment flows, or deployment configurations.

---

## 1. Root Cause Analysis

### Issue 1: My Orders Page Displays `Failed to fetch orders`
- **Frontend Observation:** Navigating to `/orders` (`OrdersPage.jsx`) resulted in the error message `"Failed to fetch orders"` rendered in the UI.
- **Investigation & Execution Trace:**
  1. `OrdersPage.jsx` executed `axios.get(`${backendUrl}/api/orders/user/${user.email}`)` using the raw `axios` package.
  2. Similarly, `DetailedOrderPage.jsx` called `axios.get(`${backendUrl}/api/orders/${id}`)`.
  3. The backend route `GET /api/orders/user/:email` in `server/routes/SellerRoutes/orderRoutes.js` is protected by `authUserMiddleware`:
     ```javascript
     router.get('/user/:email', authUserMiddleware, orderController.getOrdersByUserEmail);
     ```
  4. `authUserMiddleware` extracts the JWT authentication token from `req.cookies.jwt` or `req.headers.authorization`.
  5. The raw `axios` instance omitted `withCredentials: true` (which transmits the secure HTTP-only session cookie) and omitted the `Authorization: Bearer <token>` header stored in Redux/localStorage.
  6. As a result, the backend rejected the unauthenticated request with HTTP `401 Unauthorized: No token provided`.
  7. The catch block in `OrdersPage.jsx` caught the 401 error and set component state `error = "Failed to fetch orders"`.

### Issue 2: Scheduled Bids Does Not Work Correctly or Reliably
- **Frontend Observation:** Navigating to `/scheduledbids` (`ScheduledBids.jsx`) showed mock items from October 2023 with dummy prices in `$`, fake names, static descriptions, and an unhandled `alert()` on clicking "View Item".
- **Backend & System Design Analysis:**
  1. System design documents (`docs/system-design/auction-system.md`) establish that Auction X features scheduled lots awaiting their start timestamp (`Product.status === 'SCHEDULED'`). Early bidding on scheduled items is rejected with HTTP 403 `AUCTION_NOT_STARTED`.
  2. The background lifecycle scheduler (`server/services/auctionLifecycleService.js`) periodically evaluates scheduled products and transitions them to `LIVE` when `Date.now() >= startTime`.
  3. The backend endpoint `GET /api/products` in `server/controllers/SellerControllers/SellerProductController/productController.js` executed `Product.find().sort({ createdAt: -1 })` without supporting query parameter filtering by status.
  4. The client `/scheduledbids` page lacked any API call to fetch upcoming or scheduled products from the database, lacked countdown calculations, and lacked navigation to product detail routes.

### Issue 3: Auction Timing Is Incorrect on the Product Detail Page Reached Through Product Search
- **Frontend Observation:** Opening a product detail page from search results (`SearchAndPostDetail.jsx`) rendered countdown clocks showing `"00 Days 00 Hours 00 Minutes 00 Seconds"`, or mismatched start and end times with distorted durations.
- **Trace & Analysis:**
  1. **Timer Initialization Omission:** In `SearchAndPostDetail.jsx`, `initializeTimers(filteredProducts)` was called exclusively on related products (`filteredProducts`). The main product `response.data.product` was omitted. Because `timeLeft[product._id]` was undefined, the main product timer rendered the fallback zeros `00 Days 00 Hours 00 Minutes 00 Seconds`.
  2. **Timezone Offset Distortion:** In `client/src/utils/auctionTimer.js`, `parseAuctionDates(startDateRaw, startTimeRaw, endTimeRaw)` handled legacy `HH:MM` time strings by evaluating `new Date(`${datePart}T${timePart}`)`. In JavaScript, date-time strings without a trailing `Z` or timezone offset are interpreted in the client machine's local timezone. However, the backend stores auction start and end times in UTC (`setUTCHours` and `.toISOString()`). In Indian Standard Time (`UTC+05:30`), this caused a 5 hour and 30 minute offset error; in US timezones, it shifted hours backwards. Consequently, upcoming auctions appeared active or ended, and durations were altered.
  3. **Static Status Text:** `SearchAndPostDetail.jsx` hardcoded the countdown header label as `"Auction Ends In:"`, regardless of whether the auction was scheduled, active, or closed.
  4. **Currency Inconsistency:** `SearchAndPostDetail.jsx` displayed starting prices in `$`, conflicting with the platform's standard Indian Rupee (`₹`) symbol.

---

## 2. Files Changed and Rationale

| File | Subsystem | Rationale |
|---|---|---|
| `client/src/pages/User/Dropdown/OrderHistory/OrdersPage.jsx` | Client | Replaced raw `axios` with configured `axiosWithAuth` to transmit cookies, JWT bearer token, and CSRF token. Added handling for unauthenticated states, proper empty state, and surface genuine error messages. |
| `client/src/pages/User/Dropdown/OrderHistory/DetailedOrderPage.jsx` | Client | Replaced raw `axios.get` calls with `axiosWithAuth.get` to ensure authenticated access to single order details. |
| `server/controllers/SellerControllers/SellerProductController/productController.js` | Server | Updated `getAllProducts` to accept optional `status` query parameter (e.g., `GET /api/products?status=SCHEDULED`), allowing the client to fetch scheduled auctions. |
| `client/src/pages/User/Dropdown/ScheduledBids/ScheduledBids.jsx` | Client | Replaced static 2023 mock data with live API integration querying scheduled lots, dynamic real-time countdowns via `auctionTimer.js`, Indian Rupee currency formatting, skeleton loading, empty states, and direct navigation to `/product/:id`. |
| `client/src/utils/auctionTimer.js` | Client / Shared | Enhanced `parseAuctionDates` to accept a product object directly, parse legacy `HH:MM` time strings as UTC (`${datePart}T${timePart}Z`), and updated `calculateAuctionTime` to support modern lifecycle enums (`SCHEDULED`, `LIVE`, `ENDED`, `AWAITING_PAYMENT`, `SETTLED`). |
| `client/src/pages/User/SearchAndPostDetail/SearchAndPostDetail.jsx` | Client | Included main product in `initializeTimers`, attached a 1-second interval to update countdowns in real time, added dynamic status headers (`AUCTION STARTS IN:`, `BID ENDS IN:`, `AUCTION ENDED:`), and updated currency formatting to `₹`. |
| `client/src/pages/User/ProductDetails/ProductDetails.jsx` | Client | Updated to call `parseAuctionDates(product)` passing the full product entity, ensuring canonical timestamps (`startTime`, `endTime`, including anti-sniping dynamic extensions) take precedence. |
| `server/tests/unit/controllers/productController.test.js` | Server (Tests) | Added unit test verifying `getAllProducts` correctly filters products by status query (`status: "SCHEDULED"`). |
| `server/tests/unit/utils/auctionTimingRegression.test.js` | Server (Tests) | Added 9 unit regression tests covering UTC instant preservation, legacy `HH:MM` UTC parsing without timezone drift, null/invalid timestamp safety, lifecycle boundary transitions, and anti-sniping extensions. |

---

## 3. Fixes Implemented

### Fix 1: My Orders Authentication & Error Handling
- Migrated all order retrieval API calls to `axiosWithAuth`:
  ```javascript
  const res = await axiosWithAuth.get(`/orders/user/${encodeURIComponent(user.email)}`);
  ```
- Evaluated authenticated session presence before dispatching network request: when `user?.email` is absent, the UI displays a clean prompt directing the user to log in rather than firing an unauthenticated request.
- Supported empty states (`orders.length === 0`) with descriptive guidance and a link to live auctions.
- Propagated genuine backend error messages (`err.response?.data?.message || err.message`) when errors occur.

### Fix 2: Scheduled Bids Integration & Lifecycle Synchronization
- Enabled status-based query filtering on the backend:
  ```javascript
  exports.getAllProducts = async (req, res) => {
    try {
      const filter = {};
      if (req?.query?.status) {
        filter.status = req.query.status;
      }
      const products = await Product.find(filter).sort({ createdAt: -1 });
      res.status(200).json({ success: true, count: products.length, products });
    ...
  ```
- Re-architected `ScheduledBids.jsx`:
  - Fetches products from `${API_URL}/api/products`.
  - Filters for items with `status === "SCHEDULED"` or upcoming auctions whose start time is in the future.
  - Computes remaining time to auction start via `calculateAuctionTime`.
  - Updates countdown ticks every 1000ms.
  - Renders image, title, category, formatted scheduled start date, starting price in `₹`, live countdown badge, and a `"View Item"` button that navigates to `/product/${product._id}`.
  - Implements loading skeleton and an informative empty state when no scheduled lots exist.

### Fix 3: Product Search Detail Timing & Countdown Accuracy
- Fixed `parseAuctionDates` in `client/src/utils/auctionTimer.js` to parse `HH:MM` time strings as UTC:
  ```javascript
  const timePart = cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime;
  const combined = new Date(`${datePart}T${timePart}Z`);
  if (!isNaN(combined.getTime())) {
    startDate = combined;
  }
  ```
- Added single-argument product object signature `parseAuctionDates(product)` that extracts authoritative `startTime`, `endTime`, or fallback legacy fields.
- Fixed `SearchAndPostDetail.jsx` timer initialization to register both the main product and all related products:
  ```javascript
  const allProductsToTrack = [response.data.product, ...filteredProducts];
  initializeTimers(allProductsToTrack);
  ```
- Configured dynamic countdown headers:
  ```javascript
  {mainTimer?.statusText === "AUCTION STARTS IN"
    ? "Auction Starts In:"
    : mainTimer?.isEnded
    ? "Auction Status:"
    : "Auction Ends In:"}
  ```

---

## 4. Regression Tests Added or Updated

1. **`server/tests/unit/controllers/productController.test.js`**:
   - `should filter products by status query (e.g. SCHEDULED)`: Confirms `getAllProducts` filters database products by the `status` query parameter.
2. **`server/tests/unit/utils/auctionTimingRegression.test.js`**:
   - `should preserve exact UTC instant from backend ISO strings`: Confirms start/end times in ISO UTC format retain exact millisecond values and duration.
   - `should parse legacy date + HH:MM time as UTC without local timezone distortion`: Confirms `2026-10-15` and `10:00` parses to `2026-10-15T10:00:00.000Z`.
   - `should gracefully handle null, undefined, or invalid timestamps without throwing`: Confirms non-throwing fallback on invalid input.
   - `should support direct product object invocation with legacy field names`: Confirms fallback field extraction.
   - `should compute SCHEDULED / upcoming auction correctly before start time`: Confirms `isUpcoming: true`, `statusText: "AUCTION STARTS IN"`, and positive duration countdown.
   - `should compute LIVE / active auction correctly between start and end time`: Confirms `isActive: true`, `statusText: "BID ENDS IN"`, and active countdown.
   - `should compute ENDED auction when current time passes end time`: Confirms zero countdown and `isEnded: true`.
   - `should treat terminal statuses (e.g. SETTLED, Closed) as ENDED immediately`: Confirms terminal status immediate finality.
   - `should accurately reflect anti-sniping dynamic end time extension`: Confirms dynamic extensions lengthen countdown without resetting or skewing.

---

## 5. Actual Test & Build Results

### Backend Unit & Regression Test Suite
Command:
```bash
npm test -- tests/unit/controllers/orderController.test.js tests/unit/controllers/productController.test.js tests/unit/stage3_lifecycle_scheduler.test.js tests/unit/utils/auctionTimingRegression.test.js
```
Result:
```text
PASS tests/unit/stage3_lifecycle_scheduler.test.js (24 passed)
PASS tests/unit/controllers/productController.test.js (10 passed)
PASS tests/unit/utils/auctionTimingRegression.test.js (9 passed)
PASS tests/unit/controllers/orderController.test.js (8 passed)

Test Suites: 4 passed, 4 total
Tests:       51 passed, 51 total
Snapshots:   0 total
Time:        3.926 s
Exit Code:   0
```

### Frontend Production Build
Command:
```bash
npm run build (in client/)
```
Result:
```text
vite v6.1.1 building for production...
transforming...
✓ 1374 modules transformed.
rendering chunks...
computing chunk sizes...
dist/index.html                                       12.01 kB │ gzip:     2.96 kB
dist/assets/ScheduledBids-C-tARb-w.js                   7.78 kB │ gzip:     2.69 kB
dist/assets/SearchAndPostDetail-CIzQ_-aK.js            12.80 kB │ gzip:     3.28 kB
dist/assets/DetailedOrderPage-D8v1UdjR.js              35.10 kB │ gzip:     9.12 kB
dist/assets/ProductDetails-C2Mc29e4.js                140.86 kB │ gzip:    38.90 kB
✓ built in 17.55s
Exit Code: 0
```

---

## 6. Remaining Blockers & Manual Verification Steps

- **No blockers exist.**
- **Manual Verification Steps for Testing in Browser:**
  1. **My Orders:**
     - Log in to the application as a registered user.
     - Open the user dropdown menu and select **My Orders** (`/orders`).
     - Verify that existing orders render with product thumbnail, delivery status, and price, or that the empty state renders cleanly if no orders exist.
     - Click **View Details** on an order to verify that `/order/:id` loads correctly without errors.
  2. **Scheduled Bids:**
     - Navigate to `/scheduledbids`.
     - Verify that all auctions with status `SCHEDULED` appear with starting prices in `₹`, accurate scheduled start dates, and dynamic countdowns.
     - Click **View Item** to navigate to `/product/:id`.
  3. **Auction Timing:**
     - Search for an item via the top search bar and click a search result to open `/searchAndPostDetail/:id`.
     - Confirm that the countdown clock displays active hours, minutes, and seconds rather than all zeros.
     - Verify that upcoming items indicate `Auction Starts In:` while active auctions indicate `Auction Ends In:`.

---

## 7. Individual Verdict Summary

| Issue | Target Area | Verdict |
|---|---|---|
| **1. My Orders** | Authenticated order retrieval on `/orders` and `/order/:id` | **PASS** |
| **2. Scheduled Bids** | Scheduled auction discovery and countdowns on `/scheduledbids` | **PASS** |
| **3. Product Auction Timing** | Search detail and product detail auction timing / countdowns | **PASS** |
