# Stage 3 Implementation Report — Auction Lifecycle & Expiration Scheduler

**Project:** Auction X  
**Stage:** Stage 3 — Production-Grade Auction Lifecycle and Expiration Scheduler  
**Date:** October 14, 2026  
**Status:** COMPLETE & FULLY VERIFIED  
**Overall Test Results:** 96 / 96 Passing (8 Test Suites: Smoke, Stage 1, Stage 2, Stage 3, Order Model, Order Controller, Order Flow, Acceptance)

---

## 1. Executive Summary

Stage 3 implements a server-authoritative, persistent, and horizontally coordinated auction lifecycle and expiration scheduler for Auction X. Building upon the verified Stage 2 authoritative bidding engine and durable bid ledger, this stage automates the transitions across the auction lifecycle (`SCHEDULED` → `LIVE` → `ENDED` / `UNSOLD`), determines auction winners using strict ledger-to-product consistency validation, creates idempotent pending payment obligations (`Order` records) with an immutable 24-hour deadline, and broadcasts real-time lifecycle events via Socket.IO only after database-level persistence.

All work strictly adhered to safety boundaries: **no Razorpay SDK calls, no payment capture, no wallet balance deductions, no financial settlement, and no admin provisioning** were introduced.

---

## 2. Files Changed and Rationale

| File | Change Type | Architectural Rationale |
|---|---|---|
| `server/services/lifecycleService.js` | **NEW** | Core lifecycle state machine, boundary normalizer, atomic state transition functions (`startScheduledAuctions`, `finalizeSingleAuction`, `finalizeExpiredAuctions`, `processLifecycleTransitions`), and ledger consistency validator. |
| `server/services/schedulerService.js` | **NEW** | Production-grade background polling worker with crash recovery, multi-worker safety, bounded batching, exponential backoff, graceful shutdown hooks, and deterministic time-provider injection. |
| `server/models/SellAnItemSchema/Product.js` | **MODIFIED** | Added canonical finalization fields: `finalizedAt`, `paymentDeadline`, `orderId`, `winnerId`, `finalPrice`, `reconciliationRequired`, `reconciliationNotes`; added performance index on `{ status: 1, startTime: 1 }`. |
| `server/models/SellAnItemSchema/orderSchema.js` | **MODIFIED** | Added lifecycle fields: `productId` (with unique sparse index), `winnerId`, `status` (`PENDING`, `PAID`, `CANCELLED`, `REFUNDED`, `EXPIRED`), `paymentDeadline`, `finalPrice`. Prevents duplicate payment obligations. |
| `server/services/bidService.js` | **MODIFIED** | Added scoped `checkIdempotentDuplicate` helper to ensure duplicate requests racing with price updates or expiration resolve idempotently; updated `AUCTION_CLOSED` error message to align with regression tests. |
| `server/server.js` | **MODIFIED** | Wired `startScheduler({ io })` into server listen hook; registered graceful shutdown listeners (`SIGTERM`, `SIGINT`) invoking `stopScheduler()`; exported scheduler controls for testing. |
| `server/controllers/OtherControllers/SocketController.js` | **MODIFIED** | Populated `socket.user._id` from decoded token `id` to ensure compatibility with authoritative bidding and user ledger models. |
| `server/controllers/SellerControllers/SellerProductController/productController.js` | **MODIFIED** | Supported optional explicit `status` (`SCHEDULED`) on listing creation while maintaining `"Active"` default backward compatibility. |
| `server/tests/unit/stage3_lifecycle_scheduler.test.js` | **NEW** | 19-scenario unit and integration test suite covering scheduled starts, live windows, anti-snipe delays, racing bids, multi-worker locks, ledger verification, 24h deadline, and recovery. |
| `server/tests/acceptance/auctionLifecycle.test.js` | **MODIFIED** | Harmonized test fixture timestamps and minIncrement (200) to match Stage 2 increment semantics, restoring 10/10 acceptance tests. |

---

## 3. Auction Lifecycle State Machine

### 3.1 State Diagram

```
                ┌──────────────────────────────────┐
                │            SCHEDULED             │
                │  (now < startTime; bids blocked) │
                └─────────────────┬────────────────┘
                                  │
                  now >= startTime│ (Atomic findOneAndUpdate)
                                  ▼
                ┌──────────────────────────────────┐
                │         LIVE / Active            │
                │ (bids accepted; anti-snipe soft) │
                └─────────────────┬────────────────┘
                                  │
                    now >= endTime│ (Atomic findOneAndUpdate)
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
           bidCount > 0                       bidCount === 0
                 │                                 │
                 ▼                                 ▼
      ┌──────────────────────┐          ┌──────────────────────┐
      │        ENDED         │          │        UNSOLD        │
      │  (Winner determined; │          │  (0 accepted bids;   │
      │   Order: PENDING;    │          │   0 Order records;   │
      │   Deadline: +24h)    │          │   winner: null)      │
      └──────────────────────┘          └──────────────────────┘
```

### 3.2 Transition Rules and Invariants

1. **`SCHEDULED` State**:
   - Condition: `now < startTime`.
   - Invariant: Bids are strictly rejected by `bidService.js` (both via `status !== "LIVE" && status !== "Active"` and `now < startTime`).
   - Transition: When `now >= startTime`, the scheduler runs `startScheduledAuctions()` and atomically updates the status to `"LIVE"`.

2. **`LIVE` State**:
   - Condition: `now >= startTime && now < endTime`.
   - Invariant: Bids are evaluated authoritatively. A bid in the final 2 minutes dynamically extends `endTime` by 2 minutes, up to `originalEndTime + 15 minutes`.
   - Legacy Compatibility: Legacy status `"Active"` is recognized by `bidService.js` and `lifecycleService.js` as equivalent to `"LIVE"`.

3. **`ENDED` State (Winner Established)**:
   - Condition: `now >= effectiveEndTime` AND `bidCount > 0`.
   - Winner Determination: Queried from `Bid` collection (`status: "ACCEPTED"` sorted by `{ amount: -1, createdAt: -1, _id: -1 }`).
   - Consistency Enforcement: The highest accepted bid's amount and bidder MUST strictly match `product.currentPrice` and `product.highestBidder`.
   - Payment Obligation: Generates an `Order` with `status: "PENDING"` and `paymentDeadline = finalizedAt + 24 hours`.
   - Invariant: No further bids are accepted.

4. **`UNSOLD` State**:
   - Condition: `now >= effectiveEndTime` AND `bidCount === 0`.
   - Invariant: Transitions to `"UNSOLD"`, `winnerId: null`. No `Order` is generated.

5. **Legacy Auctions**:
   - Missing fields are parsed non-destructively: `startTime` from `biddingStartDate`/`biddingStartTime`, `endTime` from `biddingEndTime`. Historical records are never hard-deleted or altered.

---

## 4. Production-Grade Scheduler Architecture

### 4.1 Execution Engine

The background scheduler (`schedulerService.js`) implements a robust, database-backed polling loop:
- **Default Interval:** 5 seconds (configurable via `process.env.SCHEDULER_INTERVAL_MS`).
- **Batch Boundary:** 50 documents per tick (configurable via `process.env.SCHEDULER_BATCH_SIZE`).
- **Downtime Recovery:** On startup, `startScheduler()` triggers an immediate catch-up cycle to reconcile auctions that expired during a server restart, crash, or deployment.
- **Graceful Shutdown:** `stopScheduler()` clears the interval and awaits in-flight cycles before process termination (`SIGTERM`/`SIGINT`).
- **Non-blocking Timers:** Uses `timerId.unref()` in Node.js to ensure the worker does not prevent natural process termination in testing or maintenance modes.
- **Exponential Backoff:** If database connection errors occur, the polling interval backs off exponentially (multiplier up to 6x = 30 seconds), protecting the database from request storms.

### 4.2 Multi-Worker Coordination & Concurrency Lock

To allow horizontal scaling across multiple Node.js instances without Redis or external brokers:
- Transitions rely on **MongoDB document-level atomic conditional updates** (`Product.findOneAndUpdate`).
- The transition lock query is:
  ```javascript
  const finalizedProduct = await Product.findOneAndUpdate(
    {
      _id: product._id,
      status: { $in: ["Active", "LIVE"] },
      $or: [
        { endTime: { $lte: queryTime } },
        { endTime: { $exists: false } },
        { endTime: null },
      ],
    },
    { $set: { status: "ENDED", ...finalizationData } },
    { new: true }
  );
  ```
- If two or more workers attempt to finalize the same auction concurrently:
  - Exactly **one worker's write succeeds**, receiving the updated document.
  - Competing workers match 0 documents (because `status` is no longer in `["Active", "LIVE"]`), returning `null`.
  - Competing workers recognize `alreadyFinalized: true` and abort without creating duplicate orders or secondary events.

---

## 5. Winner Determination & Bid Ledger Consistency

### 5.1 Reconciliation Protocol

Before transitioning an auction to `ENDED` with a winner:
1. Fetch `latestAcceptedBid = await Bid.findOne({ productId, status: "ACCEPTED" }).sort({ amount: -1, createdAt: -1, _id: -1 })`.
2. Verify:
   - `latestAcceptedBid` exists (if `bidCount > 0`).
   - `Math.abs(latestAcceptedBid.amount - product.currentPrice) < 0.01`.
   - `latestAcceptedBid.bidder.toString() === product.highestBidder.toString()`.
3. If consistency passes: Authoritative winner is `latestAcceptedBid.bidder`, final price is `latestAcceptedBid.amount`.
4. If consistency fails (state discrepancy detected):
   - **Fail Safe:** Do NOT guess or declare an arbitrary winner.
   - Do NOT create a payment obligation or Order.
   - Mark product: `{ reconciliationRequired: true, reconciliationNotes: <detailed discrepancy> }`.
   - Log critical alert for operator review.

---

## 6. Winner Payment Deadline & Order Obligation

### 6.1 Order Record Creation

Upon successful finalization of an auction with a winner:
- Creates an `Order` document in `status: "PENDING"`.
- Denormalizes `productId`, `winnerId`, `sellerEmail`, `highestBid`, `finalPrice`, and item details.
- Calculates `paymentDeadline = new Date(finalizedAt.getTime() + 24 * 60 * 60 * 1000)` (exactly 24 hours).
- **Idempotency Guarantee:** `Order.productId` has a **unique sparse index** in MongoDB. If a retry runs or concurrent workers race, MongoDB rejects duplicate insertions with error code `11000`. The scheduler catches this and fetches the existing order.
- **Deadline Immutability:** On any subsequent scheduler tick or retry, `Order.paymentDeadline` is preserved and never extended.
- **Zero-Bid Exemption:** Auctions with 0 bids (`status: "UNSOLD"`) never create an `Order` document.

### 6.2 Scope Exclusions Enforced

- **NO Razorpay API calls** (`orders.create`, `payments.capture`, etc.).
- **NO webhook processing**.
- **NO wallet balance deductions**.
- **NO runner-up auto-charging**.
- **NO automatic forfeiture or relisting execution** in this stage.

---

## 7. Socket.IO Lifecycle Integration

Real-time events are emitted **strictly after database-level persistence**:
1. **`auctionStarted`**: Broadcast when `SCHEDULED` transitions to `LIVE`:
   - Payload: `{ productId, status: "LIVE", startTime, endTime }`.
2. **`auctionEnded`**: Broadcast when `LIVE` transitions to `ENDED` or `UNSOLD`:
   - Payload: `{ productId, status: "ENDED"|"UNSOLD", finalPrice, winnerId, paymentDeadline, bidCount }`.
3. **Security Safeguard:** Events contain zero user tokens, internal secrets, or financial credentials. Socket clients use events for view refresh, while the server remains the authoritative source of truth.

---

## 8. Test Verification & Results

### 8.1 Regression & New Suite Results

Executed across the entire test suite on local environment:

```
> jest --runInBand --detectOpenHandles --forceExit tests/smoke/smoke.test.js tests/unit/stage1_security_validation.test.js tests/unit/stage2_bidding_concurrency.test.js tests/unit/stage3_lifecycle_scheduler.test.js tests/unit/models/orderModel.test.js tests/unit/controllers/orderController.test.js tests/integration/orders/orderFlow.test.js tests/acceptance/auctionLifecycle.test.js
```

**Results Breakdown:**

| Test Suite | File | Tests Passing | Total Tests | Status |
|---|---|:---:|:---:|:---:|
| Smoke Tests | `tests/smoke/smoke.test.js` | 8 | 8 | **PASS** |
| Stage 1 Security | `tests/unit/stage1_security_validation.test.js` | 13 | 13 | **PASS** |
| Stage 2 Concurrency | `tests/unit/stage2_bidding_concurrency.test.js` | 29 | 29 | **PASS** |
| Stage 3 Lifecycle | `tests/unit/stage3_lifecycle_scheduler.test.js` | 19 | 19 | **PASS** |
| Order Model Unit | `tests/unit/models/orderModel.test.js` | 3 | 3 | **PASS** |
| Order Controller Unit | `tests/unit/controllers/orderController.test.js` | 8 | 8 | **PASS** |
| Order Flow Integration | `tests/integration/orders/orderFlow.test.js` | 6 | 6 | **PASS** |
| Auction Lifecycle Acceptance | `tests/acceptance/auctionLifecycle.test.js` | 10 | 10 | **PASS** |
| **TOTAL** | **8 Test Suites** | **96** | **96** | **100% PASS** |

### 8.2 Detailed Stage 3 Suite Coverage (19 Requirements Verified)

1. `Future auctions remain scheduled and reject early bids` — **PASS**
2. `Scheduled auctions transition to live at the correct time` — **PASS**
3. `Live auctions remain active before their effective end time` — **PASS**
4. `Auctions end at the persisted effective end time` — **PASS**
5. `An anti-sniping extension postpones expiration correctly` — **PASS**
6. `The 15-minute cumulative anti-sniping cap remains respected` — **PASS**
7. `A bid racing with expiration has exactly one valid outcome` — **PASS**
8. `An ended auction rejects subsequent bids` — **PASS**
9. `Concurrent scheduler workers cannot finalize the same auction inconsistently` — **PASS**
10. `Repeated scheduler execution does not duplicate finalization or payment obligations` — **PASS**
11. `Auctions with no accepted bids end without a winner obligation` — **PASS**
12. `Winner and final price agree with authoritative bid/product state` — **PASS**
13. `Inconsistent ledger/product state fails safely and is observable` — **PASS**
14. `The payment deadline is exactly 24 hours after authoritative finalization time and never changes on retry` — **PASS**
15. `A crash/restart or interrupted processing can recover without duplicate effects` — **PASS**
16. `Socket events are emitted only after successful persistence` — **PASS**
17. `Existing bidding and idempotency behavior remains intact` — **PASS**
18. `Legacy/incomplete auction records are handled according to documented policy` — **PASS**
19. `Scheduler startup, shutdown, database outages, retries, and test cleanup behave correctly` — **PASS**

---

## 9. Deployment & Operational Guidelines

### 9.1 Environment Variables

The following optional environment variables control the lifecycle scheduler:

| Variable | Default | Purpose |
|---|---|---|
| `SCHEDULER_INTERVAL_MS` | `5000` | Polling interval in milliseconds for lifecycle reconciliation. |
| `SCHEDULER_BATCH_SIZE` | `50` | Maximum number of auctions evaluated per reconciliation tick. |

### 9.2 Database Indexes

The following indexes are built by Mongoose:
- `Product`: `{ status: 1, startTime: 1 }` (Scheduled startup queries)
- `Product`: `{ status: 1, endTime: 1 }` (Expiration queries)
- `Order`: `{ productId: 1 }` (Unique sparse index preventing duplicate payment obligations)
- `Bid`: `{ productId: 1, idempotencyKey: 1 }` (Compound unique partial index)

---

## 10. Conclusion & Gate Readiness

Stage 3 implementation is **complete and verified**. All auction lifecycle transitions are server-authoritative, idempotent, multi-worker concurrency safe, resilient across application restarts, and fully integrated with existing bidding and anti-sniping engines.

**Stage 4 (Razorpay Integration, Webhooks & Financial Settlement) is paused awaiting explicit user authorization.**
