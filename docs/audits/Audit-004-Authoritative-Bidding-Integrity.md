# Auction X — Stage 2 Implementation & Verification Audit Report

> **Audit Document:** `docs/audits/Audit-004-Authoritative-Bidding-Integrity.md`  
> **Stage:** Stage 2 — Authoritative Bidding and Concurrency Engine  
> **Execution Date:** 2026-10-14  
> **Status:** **COMPLETE — PASS (100% Focused Unit Tests Passing, Regression & Smoke Tests Intact)**  

---

## 1. Files Changed & Architectural Rationale

The following files were created or modified for Stage 2:

| File Path | Change Type | Purpose & Architectural Rationale |
|---|---|---|
| `server/models/SellAnItemSchema/Product.js` | Modified | Added canonical auction fields: `startingPrice`, `currentPrice`, `highestBidder`, `highestBidderEmail`, `highestBidderName`, `bidCount`, `minIncrement`, `startTime`, `originalEndTime`, `endTime`, `antiSnipeCount`, `maxExtensionDeadline`. Expanded `status` enum to support authoritative lifecycle values (`Active`, `LIVE`, `ENDED`, `AWAITING_PAYMENT`, `SETTLED`, `CANCELLED`, `UNSOLD`, `Closed`). Added compound performance indexes `[status, endTime]` and `[highestBidder, status]`. |
| `server/models/Bid.js` | **Created** | Created immutable append-only `Bid` ledger model storing `productId`, `bidder`, `bidderEmail`, `bidderName`, `amount`, `currency`, `status`, `idempotencyKey`, `ipAddress`, and timestamps. Uses compound index `{ productId: 1, amount: -1 }` and `{ bidder: 1, createdAt: -1 }`. |
| `server/models/SellAnItemSchema/Bid.js` | **Created** | Re-export alias pointing to `server/models/Bid.js` to ensure uniform module resolution across all legacy import paths. |
| `server/services/bidService.js` | **Created** | **Single authoritative bid service** powering all entry points. Enforces server-side authentication, seller self-bidding prohibition, active status check, server time validation (start & effective end), minimum increment verification, anti-sniping soft-close calculations (2m window / 2m extension / 15m cumulative cap), atomic conditional database updates, and durable `Bid` ledger persistence. |
| `server/server.js` | Modified | Attached `app.set("io", io)` so that controllers and services have access to Socket.IO for server-confirmed room broadcasts without circular dependencies. |
| `server/controllers/SellerControllers/SellerProductController/productController.js` | Modified | Added `placeBid` (HTTP POST handler calling `bidService`) and `getBidHistory` (paginated read handler). Deprecated and locked down `patchProduct` (returns HTTP 403 `ENDPOINT_DEPRECATED` with guidance to use `/api/products/:id/bid`). |
| `server/routes/SellerRoutes/productRoutes.js` | Modified | Mounted `POST /:id/bid` (with authentication and schema validation) and `GET /:id/bids`. Locked down `PATCH /tempdata/:id` to reject direct mutations with HTTP 403. |
| `server/controllers/OtherControllers/SocketController.js` | Modified | Refactored WebSocket bidding handler: validates token identity, routes payload directly through `bidService.placeBid`, broadcasts ONLY server-confirmed bids to room `product_${productId}`, and returns private error events (`bidError`) to the emitting socket on rejection. |
| `client/src/pages/User/ProductDetails/ProductDetails.jsx` | Modified | Eliminated client-side wallet simulation (`/auth/update-amount`) and insecure tempdata patching (`/products/tempdata/:id`). Replaced direct socket state mutation with authoritative HTTP POST (`/api/products/${id}/bid`) while listening to room broadcasts for live UI updates. |
| `server/migrations/001_backfill_auction_fields.js` | **Created** | Idempotent, non-destructive migration script that backfills canonical auction fields (`startingPrice`, `currentPrice`, `bidCount`, time boundaries) from legacy fields without dropping or altering legacy properties. |
| `server/tests/unit/stage2_bidding_concurrency.test.js` | **Created** | Dedicated 20-test verification suite testing validation, self-bidding, anti-sniping dynamic extensions, 15-minute caps, race conditions, atomic concurrency, HTTP routes, and route lockdown. |

---

## 2. Confirmed Behavior: Before vs. After

| Scenario / Invariant | Behavior BEFORE Stage 2 | Behavior AFTER Stage 2 |
|---|---|---|
| **Bid Processing Authority** | Fragmented across client browser, Socket.IO handler, and insecure HTTP routes. | **Single Authoritative Service** (`bidService.js`). All bids pass through identical server validation and persistence engine. |
| **Bidder Identity Verification** | Sockets and HTTP trusted client-supplied names, emails, and user IDs. | Bidder identity is strictly derived from verified server authentication session/JWT token. Client identity overrides are rejected. |
| **Seller Self-Bidding** | Sellers could place bids on their own products. | Hard-blocked with HTTP 403 / `SELLER_CANNOT_BID`. |
| **Original Price Preservation** | `biddingStartPrice` was directly overwritten by incoming bids. | `startingPrice` is immutable and preserved permanently. Current hammer price is maintained in `currentPrice`. |
| **Bid Ledger History** | No history existed; each bid overwrote single-value temporary fields (`tempamount`, `tempname`). | Every accepted bid is appended as an immutable document in the `bids` collection. Read endpoint `GET /api/products/:id/bids` exposes full paginated history. |
| **Insecure Tempdata Mutation** | Any client could call `PATCH /api/products/tempdata/:id` with arbitrary amounts and names. | Route is deprecated and permanently locked down with HTTP 403 `ENDPOINT_DEPRECATED`. |
| **Client-Side Balance Mutation** | Frontend simulated wallet deductions locally before dispatching bids. | Removed simulated balance and tempdata calls from frontend. Frontend now submits authoritative bid and handles server response. |
| **Anti-Sniping Extensions** | Auctions ended strictly at `biddingEndTime` regardless of last-second bidding. | Server detects bids within the final 2 minutes, dynamically extends effective end time by 2 minutes, and strictly enforces a 15-minute cumulative extension cap past `originalEndTime`. |
| **Concurrency & Race Conditions** | Concurrent bids caused lost updates and race conditions due to uncoordinated read-modify-write cycles. | Atomic MongoDB update predicate (`$lt: proposedAmount`) guarantees exactly one winner for identical or stale amounts, rejecting concurrent conflicts with HTTP 409. |
| **Broadcast Timing** | Bids were broadcast over Socket.IO before database persistence was confirmed. | Broadcast occurs **only after** database update and durable ledger write succeed. Rejected bids emit private errors and never broadcast. |

---

## 3. Concurrency Guarantees & Persistence Invariants

### Acceptance Algorithm
1. **Preadmission Validation:**
   - Validates MongoDB ObjectId and positive numeric bid amount.
   - Ensures bidder is authenticated and not the seller (`product.email !== bidder.email`).
   - Ensures auction status is active (`["Active", "LIVE"]`).
   - Validates server-authoritative time boundaries (`now >= startTime` and `now < effectiveEndTime`).
   - Checks minimum increment:
     - If `bidCount === 0`: `amount >= startingPrice`.
     - If `bidCount > 0`: `amount >= currentPrice + minIncrement`.
2. **Anti-Sniping Calculation:**
   - Evaluates remaining time `timeRemaining = currentEndTime.getTime() - now.getTime()`.
   - If `timeRemaining <= 2 minutes (120,000 ms)`:
     - Proposed extension: `currentEndTime + 2 minutes`.
     - Capped extension: `min(proposedEndTime, originalEndTime + 15 minutes)`.
     - If extended, updates `endTime`, `biddingEndTime`, and increments `antiSnipeCount`.
3. **Atomic Conditional Update Predicate:**
   The update is committed using a single atomic conditional operation:
   ```javascript
   const updateFilter = {
     _id: productId,
     $or: [
       { currentPrice: { $lt: amount } },
       { currentPrice: { $exists: false } },
       { bidCount: 0 },
     ],
     status: { $in: ["Active", "LIVE"] },
     endTime: { $gt: now },
   };
   ```
4. **Durable Ledger Persistence & Compensating Rollback:**
   - Upon successful atomic update, an immutable `Bid` document is created in `Bid.collection`.
   - If writing the `Bid` ledger record fails for any reason, an automatic compensating rollback reverts `Product` to its prior state to preserve absolute consistency between `Product` and `Bid` history.
5. **Conflict Response:**
   - If a concurrent write race occurs and the predicate matches zero documents (stale price or simultaneous duplicate bid), the service re-reads the latest authoritative state and throws a `409 Conflict` (`CONCURRENT_BID_CONFLICT`) containing the new `currentPrice`.

### Database Topology & Transaction Assumptions
- Local standalone MongoDB (`mongodb://127.0.0.1:27017`) instances do not support multi-document transactions without replica sets (`MongoServerError: Transaction numbers are only allowed on a replica set member`).
- To provide 100% reliable consistency on both standalone deployments and replica sets, the service leverages MongoDB's native single-document atomic operations (`findOneAndUpdate` with conditional write predicate) as the concurrency gate, backed by compensating reversal on ledger failure.

---

## 4. Schema Migration & Historical Data Strategy

1. **Additive Schema Design:**
   - All newly introduced fields (`startingPrice`, `currentPrice`, `bidCount`, `antiSnipeCount`, `maxExtensionDeadline`) have backwards-compatible fallbacks in Mongoose and service logic.
   - Legacy fields (`biddingStartPrice`, `tempamount`, `tempname`, `tempuseremail`) are strictly preserved.
2. **Idempotent Migration Script (`server/migrations/001_backfill_auction_fields.js`):**
   - Scans documents missing canonical fields.
   - Populates `startingPrice = biddingStartPrice || 0`.
   - Populates `currentPrice = tempamount || startingPrice`.
   - Populates `bidCount = (tempamount && tempamount > startingPrice) ? 1 : 0`.
   - Resolves canonical `startTime`, `endTime`, `originalEndTime`, and `maxExtensionDeadline`.
   - Does **not** fabricate non-existent historical `Bid` records that the database never captured.
3. **Rollback Strategy:**
   - Because all changes are additive and legacy fields remain untouched, rolling back application code does not cause data loss or schema breakage.

---

## 5. HTTP and Socket.IO Integration Details

Both HTTP and Socket.IO entry points delegate directly to `bidService.placeBid`:

```
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│     HTTP: POST /:id/bid         │      │     Socket.IO: 'placeBid'       │
└────────────────┬────────────────┘      └────────────────┬────────────────┘
                 │                                        │
                 │ (JWT Auth + CSRF)                      │ (JWT Auth via handshake/data)
                 ▼                                        ▼
         ┌────────────────────────────────────────────────────────┐
         │               bidService.placeBid(...)                 │
         │  - Anti-sniping calculation                            │
         │  - Atomic Product.findOneAndUpdate predicate          │
         │  - Immutable Bid.create ledger insertion              │
         │  - Compensating rollback if ledger write fails         │
         └───────────────────────────┬────────────────────────────┘
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │ io.to(`product_${id}`).emit( │
                     │   "newBid", broadcastData     │
                     │ )                             │
                     └───────────────────────────────┘
```

- **HTTP Endpoint:** Returns structured JSON `{ success: true, product, bid, wasExtended }` with HTTP 200, or HTTP 400/403/404/409 with structured error payloads.
- **Socket.IO Event:** Emits `bidAccepted` to the caller, broadcasts `newBid` to the product room, or emits private `bidError` to the caller upon rejection.

---

## 6. Exact Test Commands Executed & Actual Results

### Command 1: Stage 2 Focused Test Suite
```bash
npx jest tests/unit/stage2_bidding_concurrency.test.js --runInBand --detectOpenHandles --forceExit
```
**Result:** **PASS (20/20 tests passing)**
```
PASS tests/unit/stage2_bidding_concurrency.test.js
  Stage 2 — Authoritative Bidding & Concurrency Engine
    A. Server-Side Validations & Authorization
      √ Rejects non-existent or invalid product ID (24 ms)
      √ Rejects unauthenticated bidder (24 ms)
      √ Rejects malformed, negative, zero, or NaN amounts (16 ms)
      √ Rejects seller bidding on their own listing (20 ms)
      √ Rejects bid if auction status is closed or inactive (32 ms)
      √ Rejects bid if auction has not started yet (server time check) (36 ms)
      √ Rejects bid if auction has already closed (server time check) (24 ms)
      √ Rejects bid below minimum increment (currentPrice + minIncrement) (20 ms)
    B. Concurrency, Atomicity & Original Price Preservation
      √ Preserves the seller's original starting price when bids are placed (38 ms)
      √ Creates an immutable, durable Bid ledger record on accepted bid (27 ms)
      √ Resolves two concurrent bids at identical amount: exactly one winner, one 409 conflict (37 ms)
      √ Rejects a lower bid arriving after a higher bid (26 ms)
      √ Handles high concurrency correctly: 10 concurrent bids converge to correct state (126 ms)
    C. Anti-Sniping Soft-Close Dynamic Extensions
      √ Does NOT extend auction if bid is outside final 2-minute window (29 ms)
      √ Dynamically extends auction by 2 minutes when valid bid is placed in final 2 minutes (29 ms)
      √ Caps cumulative anti-sniping extension at 15 minutes beyond original scheduled end (42 ms)
      √ Invalid or rejected bids NEVER extend the auction (24 ms)
    D. HTTP Endpoints & Route Deprecation
      √ POST /api/products/:id/bid accepts valid bid and returns authoritative state (90 ms)
      √ GET /api/products/:id/bids returns paginated bid history (71 ms)
      √ PATCH /api/products/tempdata/:id is locked down and returns 403 Forbidden (35 ms)

Test Suites: 1 passed, 1 total
Tests:       20 passed, 20 total
Time:        3.096 s
```

### Command 2: Stage 1 Regression Test Suite
```bash
npx jest tests/unit/stage1_security_validation.test.js --runInBand --detectOpenHandles --forceExit
```
**Result:** **PASS (13/13 tests passing)**

### Command 3: Application Health Smoke Test Suite
```bash
npx jest tests/smoke/smoke.test.js --runInBand --detectOpenHandles --forceExit
```
**Result:** **PASS (8/8 tests passing)**
- Server status: Active
- MongoDB: Connected
- CSRF Token generation: Active
- Products catalog: Functional
- Auth routes: Reachable
- Recommendation proxy: Responsive
- Banners endpoint: Functional
- Socket.IO connection: Verified

---

## 7. Blockers, Limitations & Unresolved Issues

- **No Active Blockers.**
- **Wallet/Balance Handling:** As documented in the roadmap and design specifications, user balance deduction/escrow is not implemented in Stage 2. Authoritative payment and settlement are deferred to Stage 4 (Razorpay) and Stage 5 (Settlement).
- **Scheduler Integration:** Automated transition from `Active` to `ENDED` at the expiration of `endTime` belongs to **Stage 3: Lifecycle and Scheduler State Engine**.

---

## 8. Recommended Next Stage

Proceed to **Stage 3: Lifecycle, Expiration, and Settlement Scheduler State Engine** upon owner authorization.
- Stage 3 will implement the server-authoritative timer/cron scheduler to transition auctions (`LIVE` → `ENDED`), determine the final winning bidder, create pending payment orders with a 24-hour expiration window, and emit lifecycle state transitions over Socket.IO and database events.
