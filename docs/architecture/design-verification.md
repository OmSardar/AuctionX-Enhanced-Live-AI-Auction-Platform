# Auction X — Architecture & Design Verification Gate

> **Document version:** 1.0.0 — Design Verification Gate  
> **Last updated:** 2026-10-13  
> **Status:** Verified — Gate Report Prepared for Project Owner Sign-Off  
> **Phase:** Phase 6 (Pre-Implementation Verification)  

---

## 1. Executive Summary

This document fulfills the **Design Verification Gate** mandated prior to beginning application code changes. It reconciles the theoretical proposals in documents `00` through `05` with the **ground-truth implementation** discovered inside the repository.

### Gate Verdict
- **Design Feasibility:** **APPROVED WITH RECONCILIATION.** The proposed modular monolith architecture, atomic bidding concurrency model, and 2-tier scheduling are feasible and compatible with the repository.
- **Critical Blockers:** **NONE.** No architectural defect or structural constraint prevents safe implementation.
- **Intervention Required:** Discrepancies between initial design assumptions and repository realities (notably the absence of the Razorpay SDK, split time string schemas, and CSRF webhook collisions) have been documented with concrete backward-compatible reconciliation plans.
- **Code Change State:** **ZERO application code modified; ZERO automated tests executed** in compliance with the verification gate rule.

---

## 2. Verified Repository Facts

A thorough inspection of `server/`, `client/`, configuration files, and dependencies established the following facts:

### 2.1 Git Working Tree & User State
- **Active Working Tree:** Multiple modified files in `client/` (UI components, theme toggle, seller dashboard, layout footers) and `server/` (authentication controllers, `server.js`, seed utilities).
- **Untracked Directories:** `client/src/components/ui/`, `client/src/app/`, `docs/`, `PROJECT_STRUCTURE.txt`.
- **Operating Constraint:** All existing user changes and untracked files must be preserved without staging, resetting, or branch switching.

### 2.2 Models & Schema Structure
1. **Product Schema (`server/models/SellAnItemSchema/Product.js`):**
   - Timing fields are split: `biddingStartDate` (Date), `biddingStartTime` (String, e.g. "14:30" or ISO), `biddingEndTime` (String, e.g. "18:00" or ISO).
   - In `productController.js` (lines 56–58), new products calculate `biddingEndTime` as `startDateTimeUTC.getTime() + 2 * 60 * 1000` (hardcoded to 2 minutes for testing, despite comments stating 24 hours).
   - Price & highest bidder are stored in: `biddingStartPrice` (Number), `tempuseremail` (String), `tempamount` (Number), `tempname` (String).
   - Status field is an enum with only two states: `status: { type: String, enum: ["Active", "Closed"], default: "Active" }`.
   - **Crucial Finding:** `biddingStartPrice` is currently overwritten with the latest bid amount during live bidding. The original starting reserve price is completely lost.
   - There is NO separate `Bid` collection; bid history is not persisted anywhere in the database.
2. **Order Schema (`server/models/SellAnItemSchema/orderSchema.js`):**
   - Flat schema: `title`, `name`, `userEmail`, `sellerEmail`, `category`, `images`, `biddingStartPrice`, `highestBid`, `phoneNo`, `address`.
   - Lacks payment status, payment deadline (`paymentDueBy`), product ObjectId reference, and transaction IDs.
3. **User Schema (`server/models/LoginSchema/user.js`):**
   - Contains a simulated wallet balance field: `amount: { type: Number, default: 0 }`.

### 2.3 Bidding Flow & Concurrency
1. **Entry Points:** Bidding currently operates via two unsynchronized entry points:
   - **Socket Handler (`server/controllers/OtherControllers/SocketController.js`):** Listens to `socket.on("placeBid")`. Loads product, performs non-atomic validation, and calls `Product.findByIdAndUpdate(productId, { biddingStartPrice: bidAmount, tempuseremail, tempamount, tempname })`.
   - **REST Endpoint (`PATCH /api/products/tempdata/:id`):** Invokes `patchProduct` in `productController.js`. Allows arbitrary client payloads to update `tempamount` and `tempuseremail` without minimum increment or price validations!
   - **Client Execution (`client/src/pages/User/ProductDetails/ProductDetails.jsx` lines 350–373):** On bid submission, the frontend makes a POST to `/auth/update-amount` to deduct user wallet balance, then makes a PATCH to `/products/tempdata/:id`, and finally emits `socket.emit("placeBid", bidData)`.
2. **Concurrency Vulnerability:** Simultaneous bids against `SocketController.js` or `patchProduct` execute non-atomic read-then-write updates. If two users bid concurrently, the slower write silently overwrites the higher bid.

### 2.4 Scheduler & Closure Reality
1. **No Background Worker:** There are zero cron jobs, intervals, or schedulers in `server/server.js`.
2. **In-Line Time Helper (`server/middleware/SellAnItemMiddleware/checkTimeRestriction.js`):**
   - Exports `parseAuctionTimeBoundaries(product)` and `getAuctionTimeStatus(product, currentTime)`.
   - Parses the split string/date fields and checks if `currentTime >= endTime`.
   - Used by `SocketController.js` to block bids after end time, but **never updates `product.status` in MongoDB**.
   - As a result, expired auctions remain marked `status: "Active"` in MongoDB indefinitely.
   - `getAllProducts` does not filter by time status, causing expired auctions to display as active cards on public feeds.

### 2.5 Razorpay Integration Reality
1. **Missing SDK:** The `razorpay` npm package is **not installed** in `server/package.json`.
2. **No Backend Payment Routes:** There are no payment order creation routes, verification routes, or webhook listeners in `server/server.js`.
3. **Simulated Wallet:** `server/controllers/LoginControllers/UserLoginController/UserPaymentController.js` only contains simulated wallet endpoints (`updateAmount`, `getAmount`).
4. **Middleware Conflict:** In `server/server.js`, `express.json()` and `csrfProtection` (Double-Submit Cookie pattern) are mounted globally. External Razorpay webhooks would fail CSRF checks (HTTP 403) and lose raw payload buffers required for HMAC-SHA256 signature verification.

---

## 3. Design Discrepancies & Reconciliations

| Area | Initial Design Assumption | Ground-Truth Repository Reality | Approved Reconciliation Plan |
|---|---|---|---|
| **Razorpay Package** | Assumed `razorpay` package was already installed in `server/package.json`. | Package is not installed. | Add `razorpay` package in Stage 4. Mock all payment tests to avoid real transactions or external dependencies. |
| **Product Timing Schema** | Assumed single ISO `startTime` and `endTime` Date fields. | Timing split across `biddingStartDate` (Date), `biddingStartTime` (String), `biddingEndTime` (String). | Perform additive schema migration: Add canonical `startTime: Date`, `endTime: Date`, `originalEndTime: Date`. Maintain virtual getters for legacy string fields. |
| **Auction Lifecycle States** | Assumed multi-state enums already modeled in Mongoose. | Only `enum: ["Active", "Closed"]` exists on `Product`. | Update `status` enum to `['DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'AWAITING_PAYMENT', 'SETTLED', 'UNSOLD', 'CANCELLED']`. Map existing `"Active"` to `"LIVE"` and `"Closed"` to `"ENDED"`. |
| **Bidding REST Endpoint** | Assumed `POST /api/products/:id/bid` existed. | Bidding only exists in Socket.IO and raw `PATCH /tempdata/:id`. | Implement `bidService.js`. Add `POST /api/products/:id/bid` for authoritative REST bidding, refactor `SocketController.js` to use `bidService`, and lock down `/tempdata/:id`. |
| **Bid History** | Assumed `bids` array or collection was in place. | Only `tempuseremail`, `tempamount`, `tempname` exist. | Create dedicated append-only `Bid` collection (`productId`, `bidderId`, `amount`, `status`, `createdAt`). |
| **CSRF & Webhooks** | Assumed standard webhook route mounting. | Global `csrfProtection` blocks all POST requests lacking `X-CSRF-Token`. | Exempt `/api/payment/webhook` from CSRF in `csrfMiddleware.js` and mount raw body parser specifically for webhooks before `express.json()`. |

---

## 4. Confirmed System Flows

The intended system flows in `00-system-flows.md` remain valid, with the following confirmed runtime mappings:

1. **Bidding Submission Flow:**
   ```
   Client (Socket or REST) 
       → Server (bidService.js)
           → Enforce: startTime <= now < endTime (server time)
           → Enforce: bidder !== seller
           → Enforce: amount >= currentPrice + minIncrement
           → MongoDB Atomic Update: Product.findOneAndUpdate(
                 { _id: id, status: 'LIVE', currentPrice: { $lt: amount }, endTime: { $gt: now } },
                 { $set: { currentPrice: amount, highestBidder: user._id }, $inc: { bidCount: 1, __v: 1 } }
             )
           → If within 2 min of endTime: extend endTime by 2 min (max 15 min cap)
           → Append-Only Insert: Bid.create({ productId, bidder, amount, ... })
           → Socket Broadcast: io.to(productId).emit("productData", snapshot)
   ```

2. **Auction Lifecycle & Two-Tier Reconciliation Flow:**
   - **Tier 1 (In-Line):** Every read/bid checks server time. Any attempt to bid past `endTime` receives HTTP 400 (`AUCTION_CLOSED`).
   - **Tier 2 (Background Reconciler):** Runs every 30s. Queries `{ status: 'LIVE', endTime: { $lte: new Date() } }`. Transitions to `ENDED` if bids exist (creating `Order` with `status: 'PENDING_PAYMENT'`), or `UNSOLD` if zero bids exist. Emits real-time notification events.

3. **Winner Settlement & Order Expiration Flow:**
   - Auction close creates `Order` with `paymentDueBy = now + 24 hours`.
   - Winner initiates Razorpay payment via `POST /api/payment/create-order`.
   - Dual-path verification: Client callback (`POST /api/payment/verify`) + Webhook (`POST /api/payment/webhook`) with `WebhookEvent` idempotency check.
   - If unpaid after 24 hours, background reaper transitions `Order` to `EXPIRED` and product to `UNSOLD` (or seller notification for relisting / second chance).

---

## 5. Approved Policy Decisions Adopted

In accordance with owner authorization:

1. **Decision A (Server-Authoritative Anti-Sniping):**
   - Active auction extends by 2 minutes if a valid bid arrives within the final 2 minutes.
   - Cumulative extension cap: Maximum 15 minutes beyond original scheduled end time.
   - Storage: Explicit `originalEndTime` and `endTime` (effective) stored and audited.
2. **Decision B (24-Hour Winner Payment Deadline):**
   - Authoritative pending order created on auction closure.
   - Only winning bidder may pay; backend calculates and validates amount.
   - Unpaid orders expire after 24 hours. Expiration is idempotent.
3. **Decision C (Auction History & Archival):**
   - Zero physical hard-deletion of completed auctions.
   - Lifecycles: `DRAFT`, `SCHEDULED`, `LIVE`, `ENDED`, `AWAITING_PAYMENT`, `SETTLED`, `UNSOLD`, `CANCELLED`.
   - Soft deletion (`isDeleted: Boolean`, `deletedAt: Date`) for seller/admin archiving. Active feeds strictly filter `{ status: 'LIVE', isDeleted: false }`.
4. **Decision D (Production Razorpay Architecture):**
   - Pure REST & Webhooks (no SOAP).
   - HMAC-SHA256 signature validation with raw body buffer.
   - `WebhookEvent` idempotency table preventing duplicate processing.

---

## 6. Migration and Rollback Strategy

### 6.1 Additive Data Migration
- **Zero Destructive Changes:** No fields will be dropped.
- **Migration Script (`server/migrations/001_backfill_auction_fields.js`):**
  - Parse existing `biddingStartDate`, `biddingStartTime`, `biddingEndTime` using the verified `checkTimeRestriction` parsing logic.
  - Set `startTime = parsedStartTime`, `endTime = parsedEndTime`, `originalEndTime = parsedEndTime`.
  - Set `currentPrice = biddingStartPrice || tempamount || 0`.
  - Set `status`: If `endTime < now` -> `'ENDED'` (or `'UNSOLD'`); if `startTime <= now < endTime` -> `'LIVE'`; if `now < startTime` -> `'SCHEDULED'`.
  - Set `isDeleted = false`.

### 6.2 Rollback Plan
- All schema additions are non-breaking. If any stage encounters an issue:
  - Feature toggles (`USE_ATOMIC_BID_SERVICE=false`, `ENABLE_RECONCILER=false`) permit immediate fallback to legacy behavior without database rollbacks.
  - Legacy fields (`biddingStartPrice`, `tempuseremail`, `tempamount`, `tempname`, `biddingEndTime`) will remain populated by the new service layer to ensure 100% backward compatibility with unmigrated UI components.

---

## 7. Implementation Stage Sequence

| Stage | Title | Focus & Deliverable | Risk Level |
|---|---|---|---|
| **Stage 1** | Security & Request Integrity | Raw webhook body parsing, CSRF webhook exemption, central error handler, input sanitization | Low |
| **Stage 2** | Authoritative Bidding & Concurrency | Atomic `Product.findOneAndUpdate` bidding engine, `Bid` collection, server-time checks, legacy field sync | Medium |
| **Stage 3** | Auction Lifecycle & Anti-Sniping Engine | Full state machine, anti-sniping (2m / 15m cap), background reconciler with `SystemLock`, feed filters | Medium |
| **Stage 4** | Razorpay Resilience & Webhook Pipeline | Install `razorpay`, dual-path HMAC verification, raw body webhook handler, `WebhookEvent` idempotency | High (Financial) |
| **Stage 5** | Winner Settlement & 24h Order Lifecycle | Pending order creation on auction end, 24h payment window, order expiration reaper, runner-up hook | Medium |
| **Stage 6** | Real-Time Sync & Socket Resiliency | Standardize Socket events, room authorization, REST resync on client reconnection | Low |
| **Stage 7** | Auditability & Observability | Structured logger with secret redaction, `AuditLog` collection, recommendation ingestion API | Low |
| **Stage 8** | Comprehensive Test Suite Execution | Execute unit, integration, concurrency, webhook replay, and end-to-end tests per `05-test-strategy.md` | Low |

---

## 8. Test and Release Quality Gates

Before any implementation stage is marked complete and deployed, it must pass the following verifiable gates:

```
[Quality Gate 1: Security & Sanitization]
├── Raw body preserved for /api/payment/webhook
├── CSRF protection permits valid webhooks and guards all browser forms
└── Zero secrets, JWT tokens, or HMAC keys in application logs

[Quality Gate 2: Concurrency & State Invariants]
├── 50 concurrent bids produce zero price overwrites or stale values
├── Time boundary strictly rejects post-closure bids (endTime + 1ms)
└── Anti-sniping extends closing by 2 minutes up to the 15-minute cap

[Quality Gate 3: Payment & Financial Integrity]
├── Cryptographic HMAC-SHA256 signature verification passes for valid payments
├── Replayed/duplicate webhook deliveries return HTTP 200 without duplicate state changes
└── Unpaid winner orders transition to EXPIRED exactly after 24 hours

[Quality Gate 4: Real-Time & Historical Feed Consistency]
├── Ended and unsold auctions disappear from live browse feeds
├── Disconnect/reconnect sequence restores accurate client price snapshot
└── Completed auctions remain permanently accessible in won/past auction views
```

---

## 9. Verification Sign-Off

- **Verification Conducted By:** Senior Software Architect / Implementation Engineer
- **Design Consistency:** All 6 system design documents in `docs/architecture/` reconciled with repository facts.
- **Stage 1 Status:** **IMPLEMENTED & VERIFIED (PASS).** 13/13 focused tests passing; 8/8 smoke tests intact.
- **Stage 1 Audit Report:** [`docs/audits/Audit-003-Security-Validation-Baseline.md`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/docs/audits/Audit-003-Security-Validation-Baseline.md)
- **Ready for Implementation:** Stage 2 (Authoritative Bidding & Concurrency Engine) is ready for authorization.
