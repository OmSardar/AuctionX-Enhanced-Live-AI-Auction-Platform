# Auction X — Test Strategy & Verification Program

> **Document version:** 0.1.0 — Design-only phase  
> **Last updated:** 2026-10-13  
> **Status:** Draft — Awaiting project owner review and approval  

---

## 1. Executive Summary & Verification Policy

This document establishes the comprehensive automated testing strategy for **Auction X**. 

### Critical Execution Policy
- **Design Verification Gate Active:** In accordance with the Non-Negotiable Execution Order, **no test suite execution is performed during this design phase**.
- **Evidence-Based Quality:** A previously passing test run or successful build is not evidence of production readiness. Tests will be implemented and executed in lockstep with the approved stages of the Implementation Roadmap (`04-implementation-roadmap.md`).
- **Zero Real Financial Credentials:** Automated tests must never use real payment credentials, real Razorpay keys, or initiate real financial transactions. All payment verification tests use cryptographic HMAC assertions against test fixtures.

---

## 2. Test Environment Architecture & Tooling

### 2.1 Tooling Matrix

| Layer / Concern | Tooling | Purpose |
|---|---|---|
| **Test Runner & Assertions** | Jest v30 | Unit, integration, and contract test orchestration |
| **HTTP API Testing** | Supertest v7 | End-to-end HTTP request and response contract assertion |
| **Database Fixture** | MongoDB (Local Test DB or MongoMemoryServer) | Isolated document-level integration tests |
| **Real-Time WebSockets** | `socket.io-client` v4 | Real-time event broadcasting, room authorization, resync testing |
| **Load & Stress Testing** | Autocannon v8 | High-concurrency benchmark and bidding contention analysis |
| **Mocking & Spies** | Jest Spies + Custom Mock Modules | Third-party isolation (Razorpay, Cloudinary, Resend SDK, Nodemailer) |

### 2.2 Environment Configuration & Isolation
Automated tests execute with `NODE_ENV=test`. Database state is isolated per test suite:
- Every suite runs against `mongodb://127.0.0.1:27017/auctionx_test_db` or an in-memory replica.
- `beforeEach`: Resets test collections to known baseline fixtures.
- `afterAll`: Drops the test database and terminates connection pools cleanly.
- Background schedulers are disabled by default in test mode unless explicitly instantiated in a scheduler test suite.

---

## 3. Test Doubles, Sandbox Fixtures & Mocks

### 3.1 Razorpay Payment Double
Automated payment tests bypass external Razorpay network calls using a deterministic cryptographic double:
- **Order Creation Mock:** Returns mock `razorpay_order_id` (e.g. `order_mock_test123`).
- **Signature Computation Helper:** Uses Node.js `crypto` with `TEST_RAZORPAY_KEY_SECRET = "test_secret_key_12345"` to generate mathematically valid HMAC-SHA256 signatures for testing signature verification logic.
- **Webhook Raw Body Fixture:** Emits raw binary buffers identical to Razorpay webhook payloads with `x-razorpay-signature` headers computed using `TEST_WEBHOOK_SECRET = "test_webhook_secret_67890"`.

### 3.2 Media & Email Mocks
- **Cloudinary (`mocks/cloudinaryMock.js`):** Intercepts `uploader.upload()` and returns deterministic secure URLs (`https://res.cloudinary.com/demo/image/upload/sample.jpg`) without internet egress.
- **Resend SDK (`tests/unit/email/emailService.test.js`):** Intercepts `resend.emails.send()`, verifying structured HTTPS payload contracts, sender domain authorization headers, recipient masking, and simulated API error responses without external network requests.
- **Nodemailer (`mocks/emailMock.js`):** Intercepts `transporter.sendMail()`, capturing outgoing emails in an in-memory array for assertion and verifying password sanitization.
- **FastAPI Recommendation Service:** Mock HTTP server or `axios-mock-adapter` responding with pre-configured recommendation product IDs (`["prod_1", "prod_2"]`).

### 3.3 Clocks & Time Simulation
Because auctions are strictly time-bound, time testing uses deterministic clock controls:
- **Jest Fake Timers (`jest.useFakeTimers()`):** Used to advance time forward across auction start, anti-snipe windows, and closing thresholds.
- **Parameterized Test Clocks:** Core domain services accept an optional `now: Date` parameter (defaulting to `new Date()`) allowing instantaneous simulation of edge cases without sleeping the process.

---

## 4. Comprehensive Test Coverage Plan

---

### 4.1 Unit Testing
- **Target:** Isolated functions, validators, and utility modules without I/O.
- **Key Test Cases:**
  1. `calculateMinIncrement(currentPrice)`: Validates incremental tiers (e.g. ₹50 under ₹1,000; ₹100 under ₹5,000; ₹500 above ₹10,000).
  2. `verifyRazorpaySignature(orderId, paymentId, signature, secret)`: Validates true for valid HMAC; false for altered paymentId, altered orderId, or wrong secret.
  3. `verifyWebhookSignature(rawBodyBuffer, signature, webhookSecret)`: Validates byte-accurate HMAC matching; rejects stringified JSON mismatches.
  4. Input sanitization: Strips MongoDB query operators (`$gt`, `$ne`, `$where`) from user inputs.
  5. Email provider resolution & invariants (`emailService.test.js`): Automatically selects Resend on Render (`RENDER=true`) or when `RESEND_API_KEY` is present; asserts password masking on SMTP failure; enforces non-retry invariant on OTP dispatches; executes bounded retry on transient 5xx errors.
  6. Transaction access control & route order (`userTransactionAccess.test.js`): Rejects unauthenticated requests (401); strictly scopes user query results to authenticated user; blocks imposter assignments (403); allows administrator global ledger mutations.

### 4.2 Service & Repository Integration Testing
- **Target:** Business domain services interacting with MongoDB.
- **Key Test Cases:**
  1. `BidService.placeBid()`: Successful bid increments `bidCount`, sets `currentPrice`, and creates `Bid` record.
  2. `AuctionService.finalizeAuction()`: Identifies highest bidder, transitions state to `ENDED`, and triggers `OrderService`.
  3. `AuctionService.handleUnsold()`: If zero bids placed, transitions state to `UNSOLD` and sets winner to null.
  4. `OrderService.createPendingOrder()`: Creates order with `paymentDueBy = now + 24h` and status `PENDING_PAYMENT`.

### 4.3 Database Integration & Transaction Behavior
- **Target:** MongoDB schema validation, indexes, and atomic updates.
- **Key Test Cases:**
  1. Schema constraint enforcement: Required fields, enum values, and unique constraints.
  2. Index verification: Confirms compound index `{ status: 1, category: 1, endTime: 1 }` is utilized via `.explain('executionStats')`.
  3. Soft-delete filter verification: Confirms queries with `{ isDeleted: false }` never return soft-deleted documents.

### 4.4 Auction State Machine Transition Testing
- **Target:** `AuctionService` and state validation logic.
- **Matrix of State Transitions:**

| Initial State | Event / Trigger | Target State | Expected Result |
|---|---|---|---|
| `DRAFT` | Admin Approves & `startTime > now` | `SCHEDULED` | **Allowed** |
| `DRAFT` | Bid Placed | — | **Rejected (400)** |
| `SCHEDULED` | `now >= startTime` | `LIVE` | **Allowed** |
| `SCHEDULED` | Bid Placed | — | **Rejected (400)** |
| `LIVE` | `now >= endTime` & Bids Exist | `ENDED` | **Allowed** |
| `LIVE` | `now >= endTime` & No Bids | `UNSOLD` | **Allowed** |
| `LIVE` | Admin Cancels (with reason) | `CANCELLED` | **Allowed** |
| `ENDED` | Winner Pays | `SETTLED` | **Allowed** |
| `ENDED` | New Bid Placed | — | **Rejected (400)** |
| `SETTLED` | Any State Transition | — | **Rejected (Terminal)** |
| `UNSOLD` | New Bid Placed | — | **Rejected (400)** |

### 4.5 Bid Concurrency & Race Condition Testing
- **Target:** Multi-client concurrent bidding on a single live auction.
- **Test Setup:**
  - Create live auction with `currentPrice = 1000`, `minIncrement = 50`.
  - Concurrently fire 50 parallel requests from 10 distinct bidder accounts using `Promise.all()`, with bid amounts spanning ₹1,050 to ₹1,500.
- **Assertions:**
  1. No two bids are accepted at the exact same price.
  2. The final `Product.currentPrice` in MongoDB equals the highest accepted bid amount.
  3. `Product.bidCount` exactly equals the total number of accepted `Bid` documents in the database.
  4. Rejected requests receive HTTP 409 (`BID_OUTBID` or `STALE_PRICE`) with the latest price in the response body.
  5. Zero negative balances, zero deadlock crashes.

### 4.6 Time-Boundary & Anti-Sniping Testing
- **Target:** `BidService` authoritative time gating and dynamic extension.
- **Key Test Cases:**
  1. **Post-Closure Rejection:** Bid placed at `endTime + 1ms` is rejected with `AUCTION_CLOSED`, even if status in DB has not yet flipped to `ENDED`.
  2. **Anti-Sniping Trigger:** Auction scheduled to end at 15:00:00. Valid bid placed at 14:58:30 (within 2-minute window).
     - Expected: `endTime` dynamically updated to 15:00:30 (extended by 2 minutes).
     - `antiSnipeCount` incremented to 1.
     - Socket event `AUCTION_EXTENDED` emitted with new `endTime`.
  3. **Anti-Sniping Cap:** Multiple bids placed in closing minutes extend auction up to the configured 15-minute cap. Bids after 15 minutes of total extension do not extend `endTime` further.

### 4.7 Scheduler Recovery & Distributed Lock Testing
- **Target:** `SchedulerService` and `SystemLock`.
- **Key Test Cases:**
  1. **Crash Recovery:** Simulate worker crashing while an auction expired 10 minutes ago. On scheduler start, the reconciler immediately detects and closes the overdue auction.
  2. **Distributed Mutual Exclusion:** Two worker instances run simultaneously. Both attempt to acquire `SystemLock` for `AUCTION_RECONCILER`.
     - Expected: Exactly one instance acquires the lock and executes; the second instance skips cleanly without errors.
  3. **Lock Expiration (TTL):** Lock holder fails to release. After TTL expires (60s), next worker successfully acquires the lease.

### 4.8 Razorpay Signature Verification & Tampering Testing
- **Target:** `PaymentService.verifyPayment()`.
- **Key Test Cases:**
  1. Valid signature passes verification and updates payment status to `CAPTURED`.
  2. Altered `razorpay_payment_id` fails verification with HTTP 400 (`INVALID_PAYMENT_SIGNATURE`).
  3. Altered `razorpay_order_id` fails verification.
  4. Secret mismatch fails verification.
  5. Zero sensitive data (signatures, keys) leaked in log files.

### 4.9 Webhook Duplication, Replay & Idempotency Testing
- **Target:** `POST /api/payment/webhook`.
- **Key Test Cases:**
  1. **First Delivery:** Valid `payment.captured` webhook processes, records event in `WebhookEvent` collection, and marks order `PAID`.
  2. **Duplicate Delivery (Replay):** Exact same webhook payload sent 3 seconds later.
     - Expected: Returns HTTP 200 immediately. `WebhookEvent` unique index catches duplicate. No second database update, no duplicate notification.
  3. **Out-of-Order Webhook:** Webhook arrives after client callback already marked payment `CAPTURED`.
     - Expected: Returns HTTP 200 without altering valid state.
  4. **Raw Body Buffer Verification:** If request body was parsed as JSON before HMAC verification, assert signature fails; passes when raw buffer is preserved.

### 4.10 Payment Reconciliation & Unpaid Winner Reaper Testing
- **Target:** `OrderService.reconcileUnpaidOrders()`.
- **Key Test Cases:**
  1. Auction ends, order created with `paymentDueBy = T + 24h`.
  2. Advance mock clock to `T + 24h + 1m`.
  3. Reconciliation worker executes.
  4. Order status transitions from `PENDING_PAYMENT` to `EXPIRED`.
  5. Seller is notified that winner failed to pay; item marked available for relisting.

### 4.11 Authentication, Authorization & Security Testing
- **Target:** Security middleware and route guards.
- **Key Test Cases:**
  1. **BOLA (Broken Object Level Authorization):** User A attempts to cancel User B's auction listing. Returns HTTP 403.
  2. **Seller Self-Bidding Prevention:** Seller attempts to bid on their own listing. Returns HTTP 403 (`SELLER_CANNOT_BID`).
  3. **Unverified Seller Listing:** Unverified user attempts to create product. Returns HTTP 403 (`SELLER_VERIFICATION_REQUIRED`).
  4. **JWT Expiration & Forgery:** Request with expired token returns HTTP 401; request with tampered JWT returns HTTP 401.
  5. **Admin Route Protection:** Non-admin user accessing `/api/admin/*` returns HTTP 403.

### 4.12 Real-Time Socket.IO Synchronization Testing
- **Target:** `Socket.IO` server events and client reconnection behavior.
- **Key Test Cases:**
  1. **Room Scoping:** Bids placed on Product A broadcast only to room `product:A`, not `product:B`.
  2. **Payload Completeness:** Broadcast payload includes full snapshot (`productId`, `currentPrice`, `bidCount`, `highestBidder`, `endTime`, `status`).
  3. **Reconnection Resync:** Client disconnects, misses 3 bids, and reconnects. Test client triggers `GET /api/products/:id` and confirms local price matches the final database state.

### 4.13 File Upload Security Testing
- **Target:** Product image upload pipeline.
- **Key Test Cases:**
  1. Non-image file upload (e.g. `.exe`, `.sh`, `.html`) is rejected with HTTP 400.
  2. File exceeding size limit (5MB) is rejected with HTTP 413.
  3. Valid JPEG/PNG file uploads to Cloudinary mock and attaches secure URL to product record.

### 4.14 End-to-End User Journeys
- **Target:** Multi-stage journey simulations using Supertest.
- **Journey 1: Full Auction Lifecycle to Settlement:**
  1. Seller registers, gets verified, lists product starting at ₹500, ending in 1 hour.
  2. Buyer A registers, places bid at ₹550.
  3. Buyer B places bid at ₹650.
  4. Advance clock past `endTime`.
  5. Reconciler closes auction; Buyer B declared winner; Order created for ₹650.
  6. Buyer B initiates payment; Razorpay order created.
  7. Payment verified via HMAC; Order marked `PAID`; Product marked `SETTLED`.
  8. Seller views order details and payout summary.

- **Journey 2: Anti-Sniping Dynamic Extension Journey:**
  1. Live auction with 50 seconds remaining.
  2. Buyer A places valid bid.
  3. Assert `endTime` dynamically extended by 2 minutes.
  4. Socket event verified.

### 4.15 Load & Stress Testing (Autocannon)
- **Target:** API resilience under concurrent load.
- **Test Scenarios:**
  - **Scenario A (Read Heavy):** 500 requests/sec against `GET /api/products` (feed) for 30 seconds.
    - *Target:* HTTP 200 > 99.5%, p95 latency < 150ms, zero crashes.
  - **Scenario B (Bidding Contention):** 50 concurrent connections firing bids at a single auction simultaneously.
    - *Target:* Exactly one winning bid per price tier, zero race condition corruptions, clean HTTP 409 responses for outbid bids.

### 4.16 Failure Injection & Recovery Testing
- **Target:** Fault tolerance under simulated outages.
- **Key Test Cases:**
  1. **Database Disconnect Mid-Bid:** MongoDB connection dropped during bid. Endpoint returns structured 503 (`DATABASE_ERROR`); connection re-established automatically.
  2. **Process Restart During Active Auction:** Node process restarted. On startup, reconciler recovers state; Socket clients reconnect with jitter and resynchronize.
  3. **Cloudinary Outage:** Media upload times out. Transaction aborted cleanly; no orphaned database documents created.

---

## 5. Acceptance Criteria & Quality Gates

Before any implementation stage is considered complete and ready for production deployment, it must pass the following gates:

```
[Quality Gate 1: Unit & Static Analysis]
├── Zero linting errors
├── Zero exposed secrets in code or logs
└── 100% pure utility function coverage (bidding increments, signature verification)

[Quality Gate 2: Concurrency & State Invariants]
├── 50 concurrent bids produce zero price overwrites
├── Time boundary strictly rejects post-closing bids (endTime + 1ms)
└── State machine strictly rejects all illegal transitions

[Quality Gate 3: Financial & Payment Integrity]
├── HMAC-SHA256 signature verification cryptographically proven
├── Duplicate webhook payloads rejected idempotently without side effects
└── Unpaid winner orders safely expire at 24 hours

[Quality Gate 4: Real-Time & Reconnection]
├── Socket broadcast contains complete state snapshots
└── Disconnect/Reconnect test recovers 100% authoritative database state
```
