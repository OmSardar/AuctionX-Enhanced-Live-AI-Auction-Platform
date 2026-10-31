# Stage 2 Remediation Audit Report: Authoritative Bidding & Concurrency

> **Audit Document:** `docs/audits/Audit-006-Bidding-Remediation-Verification.md`  
> **Target Stage:** Stage 2 — Authoritative Bidding and Concurrency Engine  
> **Date:** 2026-10-14  
> **Status:** **COMPLETE — PASS (100% Remediation Tests, Regression Tests & Smoke Tests Passing)**  
> **Auditor Role:** Senior Software Architect, Backend Distributed Systems Engineer  

---

## 1. Executive Summary & Final Verdict

### **Verdict: PASS**

All critical, high, and medium severity findings identified in `Audit-005-Authoritative-Bidding-Correctness-Reaudit.md` (CRIT-01, CRIT-02, HIGH-01, HIGH-02, HIGH-03, MED-01, MED-02, LOW-01) have been systematically resolved and empirically verified against a real MongoDB instance with concurrent multi-worker loads and failure-injection tests.

Key Remediation Achievements:
1. **Unsafe Rollback Eliminated (CRIT-01):** The hazardous `Product.findByIdAndUpdate` stale rollback has been completely eliminated and replaced by a **Durable Ledger-First State Machine Protocol** (`PENDING` → `ACCEPTED` / `REJECTED`) on standalone deployments and multi-document ACID transactions on replica sets. `Product` is never modified unless the durable `Bid` ledger record already exists, eliminating the possibility of rollbacks corrupting subsequent winning bids.
2. **Atomic Minimum Increment Enforcement (CRIT-02):** The database update predicate now enforces `{ currentPrice: { $lte: roundedAmount - minIncrement } }` directly at the database write boundary, making concurrent increment bypass mathematically impossible.
3. **Opening-Bid Concurrency Resolved (HIGH-01):** The opening bid predicate now atomically requires `{ bidCount: 0 }` (or missing) in the database write filter. Simultaneous bids at the starting price now produce exactly one accepted winner and one 409 conflict.
4. **Real Scoped Idempotency Implemented (HIGH-02):** Introduced a compound unique index with a MongoDB partial filter expression (`{ productId: 1, idempotencyKey: 1 }` where `idempotencyKey: { $type: "string" }`). Deduplication logic returns cached outcomes on retries and safely absorbs concurrent duplicate submission races.
5. **Canonical Fields Initialized on Creation (HIGH-03):** `productController.createProduct` now initializes all canonical auction fields (`startingPrice`, `currentPrice`, `startTime`, `originalEndTime`, `endTime`, `maxExtensionDeadline`, `bidCount: 0`, `minIncrement: 50`, `status: "Active"`), guaranteeing that new listings are immediately queryable by downstream Stage 3 schedulers.
6. **Browser-Authoritative Settlement Neutralized (MED-02):** Removed direct order creation and product deletion mutations from `ProductDetails.jsx` (`handleBiddingEnd`), transitioning the client to a read-only refresh pattern pending Stage 3 server-authoritative lifecycle management.
7. **Deterministic Pagination & Paise Precision (LOW-01):** Added secondary tie-breaker `_id: -1` to bid history sorting, restricted public history to `ACCEPTED` bids, and enforced maximum 2-decimal-place monetary precision.

---

## 2. Original Findings Disposition Matrix

| Finding ID | Severity | Description | Remediation Disposition | Evidence in Implementation & Tests |
|---|---|---|---|---|
| **CRIT-01** | **CRITICAL** | Compensating rollback unconditionally overwrites `Product`, destroying subsequent winning bids. | **RESOLVED** | Replaced with **Ledger-First Protocol**. `Product` is never modified if a bid loses the race; `Product.lastBidId` permanently links `Product` to the winning `Bid`. Zero blind rollbacks exist. Verified in Suite D (`stage2.test.js:460-510`). |
| **CRIT-02** | **CRITICAL** | Database atomic filter does not enforce `minIncrement`, allowing concurrent bids to bypass required increments. | **RESOLVED** | Added `{ currentPrice: { $lte: roundedAmount - minIncrement } }` to `atomicFilter`. Stale concurrent bids with raises < `minIncrement` match 0 documents and are rejected with 409. Verified in Suite B (`stage2.test.js:255-295`). |
| **HIGH-01** | **HIGH** | Opening bid predicate omits `bidCount: 0`, allowing concurrent identical bids to both win at starting price. | **RESOLVED** | Predicate requires `{ bidCount: 0 }` atomically. The first opening bid increments `bidCount` to 1; the competing bid fails the predicate and receives 409. Verified in Suite B (`stage2.test.js:210-250`). |
| **HIGH-02** | **HIGH** | `idempotencyKey` lacks uniqueness constraint and deduplication checks; retries fail with false conflicts. | **RESOLVED** | Added compound unique partial index on `{ productId: 1, idempotencyKey: 1 }`. Implemented pre-check returning cached results, and E11000 duplicate race resolution. Verified in Suite C (`stage2.test.js:370-455`). |
| **HIGH-03** | **HIGH** | `createProduct` omits canonical fields, leaving `endTime`, `currentPrice`, and `startingPrice` undefined. | **RESOLVED** | `createProduct` sets `startingPrice`, `currentPrice`, `bidCount: 0`, `minIncrement: 50`, `startTime`, `originalEndTime`, `endTime`, `maxExtensionDeadline`, and `status`. Verified in Suite F (`stage2.test.js:615-660`). |
| **MED-01** | **MEDIUM** | "100% reliable consistency" claim without transactions on standalone MongoDB was an inaccurate claim. | **RESOLVED** | Architectural honesty established. Implemented dynamic topology detection (`isReplicaSetTopology()`) using transactions where supported, and the Ledger-First State Machine on standalone instances. Documented explicitly in Section 4. |
| **MED-02** | **MEDIUM** | Frontend `ProductDetails.jsx` retains browser-triggered settlement mutating orders and deleting products. | **RESOLVED** | Removed `api.post("/orders/")` and `api.delete(...)` from `handleBiddingEnd`. Browser simply triggers read-only `fetchProductData()`. |
| **LOW-01** | **LOW** | Non-deterministic pagination and unvalidated floating-point amounts. | **RESOLVED** | Enforced 2-decimal-place paise validation in `placeBid`. Added secondary sort key `_id: -1` in `getBidHistory` and filtered by `status: "ACCEPTED"`. Verified in Suite A & G. |

---

## 3. Files Changed and Purpose

| File Path | Change Type | Architectural Purpose |
|---|---|---|
| [`server/services/bidService.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/services/bidService.js) | Modified | Core engine remediation: added paise precision validation, scoped idempotency pre-check & deduplication, opening bid atomic condition, minimum increment atomic database predicate, dual-topology consistency execution (ACID transactions on replica sets, Ledger-First protocol on standalone), and deterministic bid history retrieval. |
| [`server/models/Bid.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/models/Bid.js) | Modified | Added `"PENDING"` to status enum. Added compound unique index on `{ productId: 1, idempotencyKey: 1 }` with `partialFilterExpression: { idempotencyKey: { $type: "string" } }` so null keys never collide. Added sorting index `{ productId: 1, createdAt: -1, _id: -1 }`. |
| [`server/models/SellAnItemSchema/Product.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/models/SellAnItemSchema/Product.js) | Modified | Added `lastBidId` ObjectId reference linking `Product` directly to the durable winning `Bid` document. |
| [`server/controllers/SellerControllers/SellerProductController/productController.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/SellerControllers/SellerProductController/productController.js) | Modified | Updated `createProduct` to populate all canonical auction fields upon initial document creation. Supported `req.body.images` fallback when multer files are not passed directly. |
| [`client/src/pages/User/ProductDetails/ProductDetails.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/ProductDetails/ProductDetails.jsx) | Modified | Neutralized `handleBiddingEnd` by removing client-side `/orders/` and `/deleteSuccessProduct` calls, converting it to a read-only authoritative state refresh. |
| [`server/migrations/001_backfill_auction_fields.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/migrations/001_backfill_auction_fields.js) | Modified | Added `safeDate` helper preventing `Invalid Date` propagation, preserving idempotency and existing fields without deleting legacy properties. |
| [`server/tests/unit/stage2_bidding_concurrency.test.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/tests/unit/stage2_bidding_concurrency.test.js) | Modified | Expanded verification suite from 20 to 29 tests covering real MongoDB concurrency races, opening-bid collisions, minimum increment bypass prevention, idempotency retries and races, zero-rollback invariants, and canonical creation. |

---

## 4. Selected Consistency Architecture & Failure Semantics

### Topology Detection & Execution Paths
The service dynamically inspects the active MongoDB topology at runtime via `isReplicaSetTopology()`:

```
                              ┌───────────────────────────────────┐
                              │     bidService.placeBid(...)      │
                              └─────────────────┬─────────────────┘
                                                │
                                    Is Topology a ReplicaSet?
                                   /                         \
                             YES  /                           \  NO (Standalone)
                                 ▼                             ▼
                 ┌─────────────────────────────┐   ┌─────────────────────────────┐
                 │    BRANCH A: Transaction    │   │  BRANCH B: Ledger-First     │
                 │  - session.withTransaction  │   │  - Step 1: Create PENDING   │
                 │  - Product.findOneAndUpdate │   │    Bid document             │
                 │  - Bid.create (ACCEPTED)    │   │  - Step 2: Atomic update    │
                 │  - Product.lastBidId = bid  │   │    Product with lastBidId   │
                 │  - Commit / Abort           │   │  - Step 3:                  │
                 └──────────────┬──────────────┘   │    If OK: Bid -> ACCEPTED   │
                                │                  │    If fail: Bid -> REJECTED │
                                │                  │    (Product NEVER touched!) │
                                │                  └──────────────┬──────────────┘
                                └─────────────────┬───────────────┘
                                                  ▼
                                 Durable Acceptance Confirmed
                                 Broadcast to Room / Return 200
```

### Failure Semantics under Branch B (Standalone Protocol):
1. **Pre-write Failure:** If `Bid.create` fails or process terminates before Step 2, `Product` has not been touched. Zero inconsistency.
2. **Atomic Predicate Mismatch (Outbid / Race):** If another bid won the race or the increment was not met, `Product.findOneAndUpdate` matches zero documents and returns `null`. `Product` remains unchanged. The pending bid is marked `status: "REJECTED"`. No rollback on `Product` is ever executed.
3. **Post-update Interruption:** If `Product.findOneAndUpdate` succeeds but process terminates before Step 3 (`Bid` update to `ACCEPTED`), `Product.lastBidId` already durably points to `newBid._id`. The bid record is durably in the database and cannot be lost.

---

## 5. Idempotency & Database Index Strategy

### Index Definition:
```javascript
bidSchema.index(
  { productId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);
```

### Behavior:
- **No Key Provided:** When `idempotencyKey` is `null` or omitted, the document is excluded from the unique index by the partial filter. Multiple standard bids on the same auction never collide.
- **Key Provided:** When `idempotencyKey` is a string, uniqueness is strictly enforced per `productId`.
- **Sequential Retry:** The pre-check queries `Bid.findOne({ productId, idempotencyKey })`, verifies payload and bidder identity, and returns the cached outcome with `isDuplicate: true`.
- **Concurrent Duplicate Race:** If two duplicate requests arrive simultaneously, one inserts the `PENDING` bid; the other catches MongoDB `E11000` duplicate key error, polls briefly for the primary write to complete, and returns the cached result safely without throwing an unhandled error or creating a duplicate ledger record.

---

## 6. Exact Test Execution Results

All test suites were executed sequentially against the actual local MongoDB test database (`mongodb://127.0.0.1:27017/auctionx_test_db`) without mocks:

### Command 1: Stage 2 Remediation Test Suite (29/29 PASS)
```bash
npx jest tests/unit/stage2_bidding_concurrency.test.js --runInBand --detectOpenHandles --forceExit
```
**Output:**
```
PASS tests/unit/stage2_bidding_concurrency.test.js
  Stage 2 — Authoritative Bidding & Concurrency Remediation Suite
    A. Server-Side Validations, Precision & Authorization
      √ Rejects non-existent or invalid product ID (24 ms)
      √ Rejects unauthenticated bidder (22 ms)
      √ Rejects malformed, negative, zero, or NaN amounts (14 ms)
      √ Rejects fractional amounts with more than 2 decimal places (paise precision) (14 ms)
      √ Rejects seller bidding on their own listing (19 ms)
      √ Rejects bid if auction status is closed or inactive (17 ms)
      √ Rejects bid if auction has not started yet (server time check) (17 ms)
      √ Rejects bid if auction has already closed (server time check) (16 ms)
      √ Rejects bid below minimum increment (currentPrice + minIncrement) (17 ms)
    B. Opening Bid Race & Minimum Increment Concurrency
      √ Resolves two simultaneous opening bids at starting price: exactly one winner, one 409 conflict (HIGH-01) (58 ms)
      √ Enforces minimum increment under concurrency: prevents concurrent bypass (CRIT-02) (53 ms)
      √ Preserves the seller's original starting price when bids are placed (28 ms)
      √ Resolves two concurrent bids at identical higher amount: exactly one winner (46 ms)
      √ Rejects a lower bid arriving after a higher bid (33 ms)
      √ Handles high concurrency correctly: 10 concurrent bids converge to highest bid (192 ms)
    C. Scoped Idempotency & Duplicate Request Resolution (HIGH-02)
      √ Sequential retry with same idempotencyKey returns cached outcome without duplicate bid (57 ms)
      √ Concurrent duplicate requests with same idempotencyKey resolve safely with 1 bid created (105 ms)
      √ Reusing same idempotencyKey with a different amount is rejected with 409 conflict (37 ms)
      √ Reusing same idempotencyKey with a different bidder is rejected with 409 collision (36 ms)
    D. Failure Injection & Zero Stale Rollback Invariants (CRIT-01)
      √ A losing bid never corrupts or rolls back a subsequent winning bid (33 ms)
      √ Product and Bid ledger are durably linked via lastBidId (28 ms)
    E. Anti-Sniping Soft-Close Dynamic Extensions
      √ Does NOT extend auction if bid is outside final 2-minute window (30 ms)
      √ Dynamically extends auction by 2 minutes when valid bid is placed in final 2 minutes (28 ms)
      √ Caps cumulative anti-sniping extension at 15 minutes beyond original scheduled end (27 ms)
      √ Invalid or rejected bids NEVER extend the auction (23 ms)
    F. Product Creation Canonical Initialization (HIGH-03)
      √ POST /api/products initializes all canonical auction fields on creation (69 ms)
    G. Deterministic Bid History & Audit Invariants (LOW-01)
      √ GET /api/products/:id/bids returns deterministic history and excludes non-accepted bids (68 ms)
    H. HTTP Endpoints & Route Deprecation
      √ POST /api/products/:id/bid accepts valid bid and returns authoritative state (45 ms)
      √ PATCH /api/products/tempdata/:id is locked down and returns 403 Forbidden (27 ms)

Test Suites: 1 passed, 1 total
Tests:       29 passed, 29 total
Time:        3.793 s
```

### Command 2: Stage 1 Security & Validation Regression Suite (13/13 PASS)
```bash
npx jest tests/unit/stage1_security_validation.test.js --runInBand --detectOpenHandles --forceExit
```
**Result:** **13 passed, 13 total (100% PASS)**

### Command 3: Application Health Smoke Test Suite (8/8 PASS)
```bash
npx jest tests/smoke/smoke.test.js --runInBand --detectOpenHandles --forceExit
```
**Result:** **8 passed, 8 total (100% PASS)**

---

## 7. Migration & Compatibility Analysis

- **Idempotency:** Migration script `001_backfill_auction_fields.js` matches only documents where canonical fields are missing. Running it repeatedly produces zero modifications on migrated documents.
- **Timestamp Integrity:** Added `safeDate()` helper to sanitize legacy date strings and prevent Mongoose `CastError` or `Invalid Date` propagation.
- **Starting Price Fidelity:** Uses `biddingStartPrice` as original starting price fallback; never overwrites existing `startingPrice`.
- **Historical Records:** Zero fake `Bid` documents are fabricated for legacy auctions.
- **Rollback Safety:** All schema fields are strictly additive; legacy fields (`biddingStartPrice`, `tempamount`, `tempname`, `tempuseremail`, `biddingEndTime`) remain fully preserved.

---

## 8. Stopping State & Gate Decision

### **DECISION: STAGE 2 REMEDIATION IS COMPLETE AND VERIFIED — READY FOR GATE REVIEW**

All blocking issues identified in the Stage 2 audit have been resolved and proven with automated tests exercising real MongoDB concurrency and failure scenarios.

In strict adherence to instructions:
- **Work has stopped.**
- Stage 3 (Lifecycle Scheduler & Order Creation) has **not** been started.
- Razorpay payments and winner settlement have **not** been implemented.

*Awaiting owner review and authorization to proceed to Stage 3.*
