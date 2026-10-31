# Stage 2 Independent Correctness Audit — Adversarial Review Report

> **Audit Document:** `docs/audits/Audit-005-Authoritative-Bidding-Correctness-Reaudit.md`  
> **Target Stage:** Stage 2 — Authoritative Bidding and Concurrency Engine  
> **Date:** 2026-10-14  
> **Review Type:** Independent, Adversarial Correctness Audit (Code-Inspection & Invariant Analysis)  
> **Auditor Role:** Principal Systems Architect & Distributed Systems Engineer  

---

## 1. Executive Verdict

### **Verdict: FAIL**

While Stage 2 successfully centralized bid admission through `bidService.js`, locked down insecure `/tempdata/:id` endpoints, preserved starting prices, and passed all 20 unit tests, **an adversarial analysis of the underlying concurrency mechanics, database predicates, and failure paths reveals fundamental correctness flaws**. 

The current implementation:
1. **Contains an unsafe compensating rollback** that will blindly overwrite and corrupt subsequent valid bids under concurrent failures.
2. **Fails to enforce the minimum bid increment in the database write predicate**, allowing concurrent bids to bypass monetary increment rules.
3. **Permits double-acceptance of the initial starting price** when concurrent bids arrive on an auction with `bidCount === 0`.
4. **Has a non-functional idempotency mechanism** lacking unique indexing and cache/deduplication checks.
5. **Does not initialize canonical fields on new product creation**, breaking downstream scheduler queries and compound indexes.

Unit test passes provided false confidence because the tests tested sequential or isolated scenarios, used artificial fixtures (e.g. testing concurrent bids only with `bidCount: 1`), and never simulated failures during the dual-write window.

**Stage 3 (Lifecycle Scheduler) MUST NOT BEGIN until the critical concurrency defects and database predicates identified in this audit are remediated.**

---

## 2. Findings Ranked by Severity

| ID | Severity | Category | Summary |
|---|---|---|---|
| **CRIT-01** | **CRITICAL** | Data Integrity & Concurrency | Compensating rollback unconditionally overwrites `Product`, destroying valid subsequent concurrent bids. |
| **CRIT-02** | **CRITICAL** | Concurrency & Domain Rules | Database atomic filter does not enforce `minIncrement`, allowing concurrent bids to bypass minimum increment requirements. |
| **HIGH-01** | **HIGH** | Concurrency & Race Conditions | Opening bid predicate (`bidCount === 0`) omits `bidCount: 0` condition, allowing concurrent identical bids to both win. |
| **HIGH-02** | **HIGH** | Idempotency & Duplicate Handling | `idempotencyKey` lacks uniqueness index and pre-execution deduplication check; retries produce false conflict errors. |
| **HIGH-03** | **HIGH** | Schema & Lifecycle Drift | `productController.createProduct` omits all canonical fields, leaving `endTime`, `currentPrice`, and `startingPrice` undefined until first bid. |
| **MED-01** | **MEDIUM** | Architecture & Atomicity | "100% reliable consistency" claim without transactions is false; dual-write pattern on standalone MongoDB is best-effort and crash-vulnerable. |
| **MED-02** | **MEDIUM** | Client Authority | Frontend `ProductDetails.jsx` retains browser-triggered auction closing and hard-deletion (`handleBiddingEnd`), creating browser-triggered state races. |
| **LOW-01** | **LOW** | Determinism & Precision | `getBidHistory` sort order `{ createdAt: -1 }` lacks a secondary tie-breaker (`_id: -1`), causing non-deterministic pagination for same-millisecond bids; amounts allow arbitrary floating-point decimals. |

---

## 3. Forensic Analysis & Concrete Failure Scenarios

---

### Finding CRIT-01: Compensating Rollback Unconditionally Overwrites Valid Subsequent Bids

- **File Path:** [`server/services/bidService.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/services/bidService.js)
- **Line Numbers:** 318–334
- **Code Inspection:**
  ```javascript
  // Line 311: catch (bidPersistError) {
  await Product.findByIdAndUpdate(productId, {
    $set: {
      currentPrice: product.currentPrice || startingPrice,
      highestBidder: product.highestBidder,
      highestBidderEmail: product.highestBidderEmail,
      highestBidderName: product.highestBidderName,
      tempamount: product.tempamount,
      tempuseremail: product.tempuseremail,
      tempname: product.tempname,
      biddingStartPrice: product.biddingStartPrice,
      endTime: product.endTime,
    },
    $inc: {
      bidCount: -1,
      antiSnipeCount: wasExtended ? -1 : 0,
    },
  });
  ```

#### Concrete Failure Scenario:
1. Auction is at `currentPrice = 1000` (Bidder X, `bidCount = 1`).
2. **Request 1** arrives from Bidder A for ₹1,100.
   - At Line 96: Reads snapshot `product` (`currentPrice = 1000`).
   - At Line 276: `Product.findOneAndUpdate` succeeds. DB state is now `currentPrice = 1100`, `highestBidder = Bidder A`, `bidCount = 2`.
3. **Request 2** arrives concurrently from Bidder B for ₹1,200.
   - At Line 276: Bidder B runs `Product.findOneAndUpdate({ currentPrice: { $lt: 1200 } }, ...)` which **succeeds**.
   - DB state is now `currentPrice = 1200`, `highestBidder = Bidder B`, `bidCount = 3`.
   - At Line 300: Bidder B successfully writes `Bid.create({ amount: 1200, bidder: Bidder B })`.
4. **Failure Trigger:** Request 1's `Bid.create({ amount: 1100, bidder: Bidder A })` at Line 300 fails due to a transient MongoDB network timeout, connection reset, or memory spike.
5. Request 1 enters `catch (bidPersistError)` and executes `Product.findByIdAndUpdate(productId, ...)`.
   - **Flaw:** `findByIdAndUpdate` has **no query predicate** checking if `currentPrice` is still 1100.
   - Request 1 unconditionally `$set`s `currentPrice` back to `1000` (its stale snapshot from Step 2) and `highestBidder` back to Bidder X, while decrementing `bidCount` from 3 to 2!
6. **Consequence:**
   - Bidder B's valid, accepted bid of ₹1,200 is **silently wiped out** from `Product`.
   - `Product.currentPrice` reverts to ₹1,000, and `Product.highestBidder` reverts to Bidder X.
   - However, Bidder B's ₹1,200 record remains in the immutable `bids` collection!
   - The database is now in a corrupt, split-brain state: the ledger says Bidder B won at ₹1,200, but `Product` says Bidder X is winning at ₹1,000 with `bidCount = 2`.

---

### Finding CRIT-02: Database Atomic Filter Does Not Enforce Minimum Increment

- **File Path:** [`server/services/bidService.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/services/bidService.js)
- **Line Numbers:** 159–171, 232
- **Code Inspection:**
  ```javascript
  // Line 159: Validated only in application memory against stale snapshot
  const minimumNextBid = calculateMinimumNextBid(product);
  if (numericAmount < minimumNextBid) { throw new BidError(...); }

  // Line 232: Atomic database write predicate
  atomicFilter.currentPrice = { $lt: numericAmount };
  ```

#### Concrete Failure Scenario:
1. Auction is at `currentPrice = 1000`, `minIncrement = 50`. Minimum valid next bid is ₹1,050.
2. Bidder A submits ₹1,050.
   - Line 96 reads snapshot `currentPrice = 1000`. Memory check: `1050 >= 1050` (Passes).
3. Bidder B concurrently submits ₹1,060.
   - Line 96 reads snapshot `currentPrice = 1000`. Memory check: `1060 >= 1050` (Passes).
4. Both requests proceed to MongoDB atomic updates.
5. Bidder A's update executes first:
   - `Product.currentPrice` becomes **₹1,050**.
6. Bidder B's update executes second:
   - Bidder B's atomic filter is: `{ _id: productId, currentPrice: { $lt: 1060 } }`.
   - MongoDB evaluates: Is current price in DB (1050) less than 1060? **Yes (1050 < 1060)**.
   - MongoDB updates `Product.currentPrice` to **₹1,060**!
7. **Consequence:**
   - Bidder B's bid is accepted with an increment of **only ₹10** over Bidder A's bid (₹1,050 → ₹1,060).
   - The required minimum increment was ₹50 (should have required at least ₹1,100).
   - **Monetary rules are completely bypassed under concurrent requests.**

---

### Finding HIGH-01: Double Acceptance of Opening Starting Price Under Concurrency (`bidCount === 0`)

- **File Path:** [`server/services/bidService.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/services/bidService.js)
- **Line Numbers:** 226–230
- **Code Inspection:**
  ```javascript
  if (bidCount === 0) {
    atomicFilter.$or = [
      { currentPrice: { $lte: numericAmount } },
      { currentPrice: { $exists: false } },
    ];
  }
  ```

#### Concrete Failure Scenario:
1. A new auction is created with `startingPrice = 1000`, `currentPrice = 1000`, `bidCount = 0`.
2. Bidder A and Bidder B both concurrently submit the opening bid of ₹1,000.
3. Both read `bidCount = 0` at Line 219. Both set `atomicFilter.$or = [{ currentPrice: { $lte: 1000 } }, { currentPrice: { $exists: false } }]`.
4. Bidder A's write commits first:
   - `Product.highestBidder` = Bidder A.
   - `Product.currentPrice` = 1000.
   - `Product.bidCount` = 1.
5. Bidder B's write arrives:
   - Filter checks: Is `currentPrice <= 1000`? Current price is 1000, so `1000 <= 1000` is **TRUE**!
   - Because the filter **does NOT check `{ bidCount: 0 }`**, Bidder B's update matches!
6. Bidder B's write commits:
   - `Product.highestBidder` = Bidder B.
   - `Product.currentPrice` = 1000.
   - `Product.bidCount` = 2.
7. **Consequence:**
   - Both bidders' opening bids at ₹1,000 were accepted.
   - Bidder B became the leader at the exact same price as Bidder A without increasing the price by `minIncrement`.
   - Two accepted `Bid` ledger records exist for ₹1,000.

---

### Finding HIGH-02: Idempotency Key is Non-Functional and Lacks Unique Index

- **File Path:** [`server/models/Bid.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/models/Bid.js) (Lines 45–48), [`server/services/bidService.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/services/bidService.js) (Lines 59, 300–310)
- **Code Inspection:**
  In `Bid.js`:
  ```javascript
  idempotencyKey: {
    type: String,
    sparse: true, // Missing unique: true!
  }
  ```
  In `bidService.js`:
  Zero pre-execution check: `Bid.findOne({ productId, idempotencyKey })` is never called.

#### Concrete Failure Scenario:
1. Client submits a valid bid with `idempotencyKey = "uuid-123"`.
2. The bid is accepted by the server, updating `Product` to ₹1,100 and creating a `Bid` record.
3. The client encounters a temporary network drop before receiving the HTTP 200 response.
4. The client's HTTP library retries the request with the identical `idempotencyKey = "uuid-123"`.
5. `bidService.placeBid` receives the retry:
   - It does not check if `"uuid-123"` was already processed.
   - It evaluates the amount ₹1,100 against `currentPrice = 1100`.
   - It throws `409 Conflict` (`BID_OUTBID`: "You have been outbid").
6. **Consequence:**
   - The client believes their bid was rejected/outbid, when in reality their bid was accepted and they are currently the winning bidder.
   - Furthermore, because there is no unique constraint on `idempotencyKey`, concurrent duplicate requests can create duplicate `Bid` documents.

---

### Finding HIGH-03: Product Creation Omits Canonical Auction Fields

- **File Path:** [`server/controllers/SellerControllers/SellerProductController/productController.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/SellerControllers/SellerProductController/productController.js)
- **Line Numbers:** 68–90
- **Code Inspection:**
  ```javascript
  const productData = {
    name,
    category,
    description: descriptionPoints,
    mobileNumber,
    biddingStartDate: startDateTimeUTC.toISOString(),
    biddingStartTime: startDateTimeUTC.toISOString(),
    biddingStartPrice: Number(biddingStartPrice),
    email: req.user ? req.user.email : email,
    images: req.productImages,
    biddingEndTime: endDateTimeUTC.toISOString(),
    hasBanner: hasBanner === "true",
  };
  const newProduct = await Product.create(productData);
  ```

#### Consequences:
1. Canonical fields (`startingPrice`, `currentPrice`, `startTime`, `originalEndTime`, `endTime`, `maxExtensionDeadline`, `bidCount`, `minIncrement`) are **not set** upon creation.
2. In MongoDB, `newProduct.endTime` is `undefined`.
3. The compound index `productSchema.index({ status: 1, endTime: 1 })` cannot index new auctions by effective end time.
4. Downstream scheduled workers (Stage 3) querying `Product.find({ status: "Active", endTime: { $lte: now } })` will completely miss auctions that have not yet received their first bid.

---

### Finding MED-01: Atomicity Fallacy on Standalone MongoDB Deployment

- **File Path:** [`server/services/bidService.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/services/bidService.js) (Lines 276–341), [`docs/audits/Audit-004-Authoritative-Bidding-Integrity.md`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/docs/audits/Audit-004-Authoritative-Bidding-Integrity.md) (Section 3)

#### Analysis:
The Stage 2 audit claimed:
> *"To provide 100% reliable consistency on both standalone deployments and replica sets, the service leverages MongoDB's native single-document atomic operations... backed by compensating reversal on ledger failure."*

This claim is technically invalid in distributed systems:
1. `Product.findOneAndUpdate()` and `Bid.create()` are two separate network calls to two different collections.
2. If Node.js crashes, is killed (`SIGKILL`), or power fails between Line 280 and Line 300, `Product` has mutated, but `Bid` was never inserted. The catch block will never execute.
3. On standalone MongoDB, multi-document transactions cannot be enabled.
4. True consistency requires acknowledging that dual-writes without transactions are **eventually compensated heuristics**, not atomic operations.

---

### Finding MED-02: Frontend Retains Browser-Triggered Auction Settlement

- **File Path:** [`client/src/pages/User/ProductDetails/ProductDetails.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/ProductDetails/ProductDetails.jsx)
- **Line Numbers:** 191–242
- **Code Inspection:**
  ```javascript
  const handleBiddingEnd = async () => {
    ...
    if (winnerEmail) {
      await api.post("/orders/", auctionSummary);
      await api.delete(`/products/deleteSuccessProduct/${id}`);
    } else {
      await api.patch(`/products/statuspatch/${id}`, { status: "Closed" });
    }
  };
  ```

#### Consequences:
- When a client's local timer reaches zero, the browser attempts to execute financial and lifecycle mutations directly (`POST /orders/`, `DELETE /products/deleteSuccessProduct/:id`).
- If 10 viewers are looking at the page when it closes, 10 browsers race to settle the auction and delete the product.
- This directly violates the principle that lifecycle transitions and settlement must be server-authoritative.

---

### Finding LOW-01: Non-Deterministic Pagination & Unvalidated Floating-Point Precision

- **File Path:** [`server/services/bidService.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/services/bidService.js) (Lines 82–93, 372–376)
- **Analysis:**
  - `getBidHistory` sorts strictly by `{ createdAt: -1 }`. If multiple bids are inserted in the same millisecond, pagination using `.skip()` and `.limit()` does not guarantee deterministic document ordering across pages.
  - `placeBid` casts amounts via `Number(amount)` without enforcing monetary precision (e.g. allowing arbitrary fractions of a rupee like `1050.123456`).

---

## 4. Invariant Verification Matrix

| Claimed Invariant / Guarantee | Implementation Location | Test Evidence in Suite | Actual Confidence | Auditor Finding & Assessment |
|---|---|---|:---:|---|
| **Seller cannot bid on own auction** | `bidService.js:101-112` | `stage2.test.js:126-136` | **HIGH** | Verified. Correctly checks `product.email === bidder.email`. |
| **Server-authoritative time checks** | `bidService.js:138-156` | `stage2.test.js:141-182` | **HIGH** | Verified. Evaluates `now` parameter deterministically against start and effective end times. |
| **Original starting price preserved** | `bidService.js:209-250` | `stage2.test.js:199-218` | **HIGH** | Verified. `startingPrice` is immutable once set and never overwritten by subsequent bids. |
| **Anti-sniping 2m extension & 15m cap** | `bidService.js:173-205` | `stage2.test.js:331-438` | **HIGH** | Verified. Extensions correctly apply within final 2 minutes and cap at 15 minutes past original end. |
| **Single authoritative entry point** | `bidService.js:63-362` | `stage2.test.js:441-473` | **MEDIUM** | HTTP route calls `bidService`. Sockets call `bidService`. However, direct browser settlement in `ProductDetails.jsx` still exists. |
| **Minimum increment enforced under concurrency** | `bidService.js:159, 232` | `stage2.test.js:184-195` | **NONE** | **FAILED (CRIT-02)**. Only checked in memory; DB predicate `{ currentPrice: { $lt: amount } }` allows concurrent bypass. |
| **Initial starting price concurrency** | `bidService.js:226-230` | `stage2.test.js:240-275` | **NONE** | **FAILED (HIGH-01)**. Test artificially initialized `bidCount: 1`. When `bidCount: 0`, concurrent bids at starting price both succeed. |
| **Safe compensating rollback** | `bidService.js:311-341` | *None (zero tests)* | **NONE** | **FAILED (CRIT-01)**. Blind `findByIdAndUpdate` corrupts subsequent concurrent bids; zero unit tests exercised the failure branch. |
| **Request idempotency** | `Bid.js:45-48` | *None (zero tests)* | **NONE** | **FAILED (HIGH-02)**. No unique constraint, no deduplication check, no retried-bid test. |
| **New product canonical fields** | `productController.js:68-80` | *None* | **NONE** | **FAILED (HIGH-03)**. `createProduct` completely omits canonical fields. |

---

## 5. Required Fixes (Ordered by Dependency & Severity)

### Fix 1: Make Atomic Conditional Write Predicate Fully Authoritative (Addresses CRIT-02 & HIGH-01)
In `server/services/bidService.js`:
- For `bidCount === 0`:
  ```javascript
  atomicFilter.$or = [
    { bidCount: 0, currentPrice: { $lte: numericAmount } },
    { bidCount: 0, currentPrice: { $exists: false } },
    { bidCount: { $exists: false }, currentPrice: { $lte: numericAmount } },
  ];
  ```
- For `bidCount > 0`:
  ```javascript
  const minIncrement = product.minIncrement || 50;
  atomicFilter.currentPrice = { $lte: numericAmount - minIncrement };
  ```
This guarantees that MongoDB rejects any concurrent write that does not meet the minimum increment from the immediate prior winning bid, and prevents duplicate opening bids at starting price.

### Fix 2: Secure the Compensating Rollback with an Optimistic Predicate (Addresses CRIT-01)
In `server/services/bidService.js` (Catch block):
Do NOT perform an unconditional `findByIdAndUpdate(productId, ...)`.
Instead, use an atomic conditional filter that matches **only the exact state produced by this specific bid**:
```javascript
const rollbackFilter = {
  _id: productId,
  currentPrice: numericAmount, // Only rollback if WE are still the highest bid!
  highestBidder: bidder._id,
};

const rolledBack = await Product.findOneAndUpdate(rollbackFilter, {
  $set: {
    currentPrice: product.currentPrice || startingPrice,
    highestBidder: product.highestBidder,
    highestBidderEmail: product.highestBidderEmail,
    highestBidderName: product.highestBidderName,
    tempamount: product.tempamount,
    tempuseremail: product.tempuseremail,
    tempname: product.tempname,
    biddingStartPrice: product.biddingStartPrice,
    endTime: product.endTime,
    biddingEndTime: product.biddingEndTime,
  },
  $inc: {
    bidCount: -1,
    antiSnipeCount: wasExtended ? -1 : 0,
  },
}, { new: true });

if (!rolledBack) {
  logger.warn("Compensating rollback skipped: product state was already updated by a subsequent bid", {
    productId,
    amount: numericAmount,
  });
}
```
If a subsequent bid (Bidder B at 1200) already won, `rollbackFilter` matches zero documents, safely preventing the rollback from destroying Bidder B's victory!

### Fix 3: Implement Functional Idempotency (Addresses HIGH-02)
1. In `server/models/Bid.js`:
   Add unique sparse compound index:
   ```javascript
   bidSchema.index({ productId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
   ```
2. In `server/services/bidService.js`:
   At the start of `placeBid`:
   ```javascript
   if (idempotencyKey) {
     const existingBid = await Bid.findOne({ productId, idempotencyKey });
     if (existingBid) {
       const currentProduct = await Product.findById(productId);
       return {
         success: true,
         product: currentProduct,
         bid: existingBid,
         isDuplicate: true,
         broadcastData: { ... },
       };
     }
   }
   ```

### Fix 4: Populate Canonical Fields in `createProduct` (Addresses HIGH-03)
In `server/controllers/SellerControllers/SellerProductController/productController.js`:
Ensure `createProduct` sets:
```javascript
startingPrice: Number(biddingStartPrice),
currentPrice: Number(biddingStartPrice),
startTime: startDateTimeUTC,
originalEndTime: endDateTimeUTC,
endTime: endDateTimeUTC,
maxExtensionDeadline: new Date(endDateTimeUTC.getTime() + 15 * 60 * 1000),
bidCount: 0,
minIncrement: 50,
antiSnipeCount: 0,
status: "Active",
```

### Fix 5: Neutralize Client-Triggered Settlement in Frontend (Addresses MED-02)
In `client/src/pages/User/ProductDetails/ProductDetails.jsx`:
Remove the direct `api.post("/orders/", ...)` and `api.delete("/products/deleteSuccessProduct/...")` calls from `handleBiddingEnd`. The frontend must display an "Auction Ended — Finalizing Results" banner and wait for server-authoritative settlement events.

---

## 6. Verification Test Requirements

To verify the remediated implementation, the following tests must be added to `stage2_bidding_concurrency.test.js`:

1. **Concurrent Opening Bids (`bidCount === 0`):**
   Execute two concurrent bids at `startingPrice = 1000` when `bidCount = 0`. Verify that exactly one succeeds and the other receives 409 Conflict.
2. **Concurrent Minimum Increment Bypass:**
   Start at 1000 (`minIncrement = 50`). Launch concurrent bids of 1050 and 1060. Verify that 1050 succeeds and 1060 is rejected (since 1060 < 1050 + 50).
3. **Compensating Rollback with Interleaved Winning Bid:**
   Spy on `Bid.create` to throw an error for Bid 1 (amount 1100). Interleave Bid 2 (amount 1200) before Bid 1's rollback executes. Verify that Bid 2 remains the winner and `Product.currentPrice` remains 1200.
4. **Idempotency Key Retries:**
   Send two sequential requests with the same `idempotencyKey`. Verify that the second request returns HTTP 200 with `isDuplicate: true` and does not increment `bidCount` or throw an outbid conflict.
5. **Canonical Fields on Product Creation:**
   Verify `createProduct` returns an object where `endTime`, `startingPrice`, and `currentPrice` are properly populated.

---

## 7. Gate Decision: Next Stage Readiness

### **DECISION: STAGE 3 IS BLOCKED**

**Stage 3 (Lifecycle, Expiration, and Settlement Scheduler State Engine) cannot safely begin.**

### Rationale:
The lifecycle scheduler in Stage 3 relies directly on:
1. `endTime` and `status` in the `Product` collection to schedule closures.
2. An incorruptible `currentPrice`, `highestBidder`, and immutable `Bid` ledger to determine the official winner and create the pending Razorpay order.

If the bidding engine can corrupt winners during concurrent rollbacks or allow bids to bypass minimum increments, the Stage 3 settlement worker will lock in illegitimate winners and incorrect order values.

Remediate Fixes 1–5 first, verify with the required tests, and re-audit before authorizing Stage 3.
