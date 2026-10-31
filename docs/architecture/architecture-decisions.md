# Auction X — Architecture Decision Records (ADRs)

> **Document version:** 0.1.0 — Design-only phase  
> **Last updated:** 2026-10-13  
> **Status:** Draft — Awaiting project owner review and approval  

---

## Document Overview

This document records the architectural decisions made for the **Auction X** marketplace platform. Each Architecture Decision Record (ADR) follows a structured format evaluating context, problem statement, options considered, chosen decision, rationale, consequences, risks, reversibility, and explicit approval status.

### Summary of ADRs

| ADR ID | Decision Title | Status | Category |
|---|---|---|---|
| [ADR-001](#adr-001-backend-architecture--modular-monolith-vs-microservices) | Backend Architecture: Modular Monolith vs. Microservices | Proposed | Architecture |
| [ADR-002](#adr-002-database-transaction--concurrency-control-strategy) | Database Transaction & Concurrency Control Strategy | Proposed | Data & Persistence |
| [ADR-003](#adr-003-auction-scheduling--lifecycle-closure-enforcement) | Auction Scheduling & Lifecycle Closure Enforcement | Proposed | Core Domain |
| [ADR-004](#adr-004-strict-auction-closure-vs-anti-sniping-dynamic-extension) | Strict Auction Closure vs. Anti-Sniping Dynamic Extension | Proposed (Requires Owner Decision) | Business Logic |
| [ADR-005](#adr-005-auction-history-retention-and-soft-deletion) | Auction History Retention and Soft Deletion Strategy | Proposed | Data & Persistence |
| [ADR-006](#adr-006-razorpay-payment-verification--webhook-idempotency) | Razorpay Payment Verification & Webhook Idempotency | Proposed | Payments & Finance |
| [ADR-007](#adr-007-background-processing-and-job-recovery-engine) | Background Processing and Job Recovery Engine | Proposed | Infrastructure |
| [ADR-008](#adr-008-real-time-event-reliability--socketio-resynchronization) | Real-Time Event Reliability & Socket.IO Resynchronization | Proposed | Real-Time Systems |
| [ADR-009](#adr-009-post-auction-winner-settlement--unpaid-winner-policy) | Post-Auction Winner Settlement & Unpaid Winner Policy | Proposed (Requires Owner Decision) | Business Logic |
| [ADR-010](#adr-010-audit-trail-logging-and-analyticsdata-retention) | Audit Trail Logging and Analytics/Data Retention | Proposed | Compliance & Data |

---

## ADR-001: Backend Architecture — Modular Monolith vs. Microservices

### Context
The current Auction X backend (`server/`) is implemented as an Express.js application using MongoDB (Mongoose) and Socket.IO. A separate Python FastAPI microservice exists for item recommendations (`recommendation_service/`). The existing backend code has grown organically, with mixed responsibilities inside route controllers, direct model queries bypassing services, and in-memory variables.

### Problem
Should Auction X decompose its Node.js backend into independent distributed microservices (e.g., Auth Service, Auction Service, Bidding Service, Payment Service), or should it remain a single application structured as a clean Modular Monolith?

### Options Considered
1. **Option A: Full Microservices Decomposition**
   - Split into 4+ separate Node.js services communicating over HTTP/gRPC or an asynchronous event broker (e.g., RabbitMQ/Kafka).
2. **Option B: Modular Monolith with Layered Architecture (Recommended)**
   - Maintain the single Express/Node.js service process, but enforce strict internal boundaries: Controllers -> Services -> Repositories/Models, with clear dependency direction and event-driven decoupling where appropriate.
3. **Option C: Unstructured Monolith (Status Quo)**
   - Keep current controllers with mixed responsibilities.

### Decision
**Adopt Option B: Modular Monolith with Layered Architecture.**  
Keep the single Node.js runtime for the core application while retaining the independent Python FastAPI recommendation service. Enforce architectural layering within `server/`:
- `controllers/`: HTTP/Socket request decoding, authentication validation, and response serialization.
- `services/`: All business rules, transactions, invariant enforcement, and external API calls.
- `repositories/` / `models/`: Database query construction, projection, and schema definitions.
- Controllers and Socket handlers must invoke Services; they must never query models or execute business logic directly.

### Rationale
- **Team and Operational Velocity:** A modular monolith avoids distributed systems overhead (distributed tracing, network retries, saga orchestrations, complex deployments, and distributed transactions).
- **Atomic Concurrency:** MongoDB atomic updates for bids and orders operate natively and with single-digit millisecond latency inside a single database connection pool.
- **Maintainability:** Clear folder structure and interface boundaries allow future service extraction if traffic demands it, without paying the complexity tax upfront.

### Consequences
- **Positive:** Simpler deployment (single container or Node process), low latency, zero cross-service RPC overhead, straightforward integration testing.
- **Negative:** Shared process resources (CPU, event loop); heavy computation in one module could impact another if not properly managed.

### Risks
- Developers might violate layer boundaries if not enforced via code reviews and linting rules.
- Mitigation: Establish clear linting/dependency rules and architectural integration tests.

### Reversibility
**High.** Well-bounded modules inside a modular monolith can be extracted into standalone microservices cleanly in the future if scale warrants it.

### Approval Status
**Proposed — Awaiting Owner Approval.**

---

## ADR-002: Database Transaction & Concurrency Control Strategy

### Context
In an auction marketplace, bids can arrive simultaneously from multiple users for the same item. If two users bid ₹1,000 and ₹1,050 at the exact same millisecond against a current price of ₹900, naive read-modify-write patterns result in race conditions, phantom updates, or corrupted bid histories.

### Problem
How should Auction X ensure atomic, race-condition-free bid acceptance and consistent inventory/payment updates in MongoDB without introducing excessive latency or deadlock risks?

### Options Considered
1. **Option A: In-Memory Mutex / Application Locks**
   - Use Node.js in-memory lock (e.g., `async-mutex`). Fails immediately when scaling horizontally across multiple Node processes.
2. **Option B: Distributed Locks via Redis (Redlock)**
   - Acquire Redis lock before reading and updating MongoDB. High operational dependency on Redis; failure to release locks causes auction stalls.
3. **Option C: MongoDB Atomic Conditional Updates (`findOneAndUpdate`) (Recommended)**
   - Perform atomic document updates directly at the MongoDB level using conditional query filters matching the current price, status, and end time.
4. **Option D: MongoDB Multi-Document Transactions with Snapshot Isolation**
   - Wrap bid insertion and product price updates in `session.withTransaction()`. Requires replica set deployment; higher latency and abort rates under high contention.

### Decision
**Adopt Option C: MongoDB Atomic Conditional Updates with Optimistic Version Checking.**  
The primary concurrency guard for bids is an atomic query on the `Product` collection:
```javascript
const updatedProduct = await Product.findOneAndUpdate(
  {
    _id: productId,
    status: 'LIVE',
    currentPrice: { $lt: bidAmount },
    endTime: { $gt: now },
    seller: { $ne: bidderId }
  },
  {
    $set: { currentPrice: bidAmount, highestBidder: bidderId },
    $inc: { bidCount: 1, __v: 1 }
  },
  { new: true }
);
```
If `updatedProduct` is null, the bid is rejected (stale price, ended auction, or unauthorized). Upon successful atomic update, an append-only `Bid` record is created. Where multi-document operations require all-or-nothing guarantees (such as auction settlement creating an Order), use MongoDB sessions when running on a replica set, falling back to idempotent compensating steps.

### Rationale
- MongoDB document-level write locks guarantee that only one concurrent query matches `{ currentPrice: { $lt: bidAmount } }` and succeeds.
- Zero external dependencies (no Redis required for core bid correctness).
- Throughput is maximized because lock duration is limited to the single document write operation inside the database engine.

### Consequences
- **Positive:** Absolute concurrency safety, zero race conditions, sub-10ms execution, horizontally scalable across any number of Node.js instances.
- **Negative:** If a subsequent insert into the `Bid` collection fails after the `Product` was updated, compensating rollback or reconciliation is required.
- Mitigation: In-memory retry of `Bid` insert, or wrap in a replica-set session where replica set is available.

### Risks
- Minimal. The approach leverages fundamental MongoDB ACID guarantees on single documents.

### Reversibility
**Medium.** Core database query logic is isolated to `bidService.js`.

### Approval Status
**Proposed — Awaiting Owner Approval.**

---

## ADR-003: Auction Scheduling & Lifecycle Closure Enforcement

### Context
Auctions have explicit `startTime` and `endTime` fields. Currently, if an auction reaches its `endTime`, there is no reliable guarantee that a background worker transitions it to `ENDED` at that exact millisecond. If the server restarts or jobs stall, auctions can remain in `LIVE` state indefinitely.

### Problem
How to guarantee that auction start and end boundaries are strictly respected without relying on a brittle, millisecond-accurate background job?

### Options Considered
1. **Option A: Pure Background Worker Dependency**
   - Rely solely on a scheduler (e.g., `node-cron` or `agenda`) to flip states. If the worker fails or crashes, bidding continues past `endTime`.
2. **Option B: Two-Tier Architecture: Authoritative In-Line Verification + Background Reconciliation (Recommended)**
   - Tier 1: Every API request (bidding, viewing) validates `now >= startTime && now < endTime` authoritatively. Even if the status field is not yet updated to `ENDED`, any bid past `endTime` is rejected with `AUCTION_CLOSED`.
   - Tier 2: A resilient background reconciliation job runs every 30–60 seconds, querying `{ status: 'LIVE', endTime: { $lte: new Date() } }`, transitioning the database status, selecting the winner, creating order/settlement records, and broadcasting real-time events.
3. **Option C: Distributed Delay Queues (BullMQ / RabbitMQ)**
   - Enqueue a delayed job at auction creation for the exact closing timestamp. Requires external Redis/broker and complex rescheduling when auction end times change.

### Decision
**Adopt Option B: Two-Tier Architecture (In-Line Enforcement + Background Reconciliation Worker).**

### Rationale
- Correctness is decoupled from scheduler timing: An auction is effectively closed at the exact millisecond `endTime` passes because the bidding query rejects bids with `endTime: { $gt: now }`.
- System resilience: If the background worker is delayed by 15 seconds due to a deploy or high load, no illegitimate bids can be placed. When the reconciler runs, it safely finalizes the auction without inconsistencies.

### Consequences
- **Positive:** 100% immune to scheduler downtime; zero race conditions around closing boundaries; simple operational model.
- **Negative:** Winner notification and settlement order creation happen on the reconciler tick (typically within 30 seconds of closure) rather than at the exact millisecond 0.

### Risks
- Minor delay (up to 30s) in winner announcement broadcast. This is completely standard in commercial auction platforms.

### Reversibility
**High.**

### Approval Status
**Proposed — Awaiting Owner Approval.**

---

## ADR-004: Strict Auction Closure vs. Anti-Sniping Dynamic Extension

### Context
In competitive online auctions, automated "sniping" scripts often submit bids in the final 1–2 seconds. In a strict hard-close system, legitimate human bidders have no opportunity to counter, and network latency variations can unfairly drop winning bids.

### Problem
Should Auction X enforce a rigid hard closing time, or implement an anti-sniping dynamic soft-close extension?

### Options Considered
1. **Option A: Strict Hard Closure**
   - Auction ends precisely at `endTime`. No extensions under any circumstances.
2. **Option B: Anti-Sniping Dynamic Soft-Close (Recommended)**
   - If a valid bid is placed within the final 2 minutes (`now >= endTime - 2 minutes`), the `endTime` is automatically extended by 2 minutes from the time of the bid.
   - A maximum total extension cap is enforced (e.g., maximum 15 minutes beyond the original `endTime`) to prevent indefinite auctions.
3. **Option C: Seller-Configured Option**
   - Allow the seller to choose between hard closure and soft-close during listing creation.

### Decision
**Recommend Option B: Anti-Sniping Dynamic Soft-Close with a 15-minute maximum extension cap.**  
*(This is a key business policy decision presented to the Project Owner for explicit confirmation).*

### Rationale
- Maximizes platform transaction value and seller revenue by allowing true price discovery.
- Eliminates the unfair advantage of automated bot snipers over real users.
- Aligns with industry standards (eBay dynamic bidding, Bring a Trailer, Yahoo Auctions).

### Consequences
- **Positive:** Higher auction hammer prices, fairer user experience.
- **Negative:** Users and frontend countdown timers must handle dynamic `endTime` updates smoothly via Socket.IO events.

### Risks
- Bidders may become frustrated if an auction extends repeatedly without a cap. The 15-minute hard cap strictly mitigates this risk.

### Reversibility
**High.** Configurable via a single environment variable or feature flag (`AUCTION_ANTI_SNIPE_ENABLED=true/false`).

### Approval Status
**Pending Project Owner Decision.**

---

## ADR-005: Auction History Retention and Soft Deletion

### Context
When an auction ends, users need to view past listings in their "Won Auctions", "Bid History", and "My Listings" tabs. Search feeds, however, should only show active, open auctions. In the past, some code paths allowed physical deletion of listings.

### Problem
How to retain comprehensive auction, bid, and order history permanently while keeping active browsing feeds fast, clean, and uncluttered?

### Options Considered
1. **Option A: Physical Hard Deletion**
   - Delete ended auctions from the database after a retention period. Destroys audit trails, order relationships, and historical pricing data.
2. **Option B: Lifecycle States in Single Collection + Soft Deletion (Recommended)**
   - Retain all auctions in the `Product` collection.
   - Use lifecycle statuses: `DRAFT`, `SCHEDULED`, `LIVE`, `ENDED`, `SETTLED`, `UNSOLD`, `CANCELLED`.
   - Implement soft delete flags (`isDeleted: Boolean`, `deletedAt: Date`) for administrative/seller archiving.
   - Active search/feed queries strictly filter for `{ status: 'LIVE', isDeleted: false }`.
3. **Option C: Separate Archive Collection (`ArchivedProducts`)**
   - Move ended auctions into a secondary collection. Requires cross-collection data movement, breaks foreign-key references from `Bid` and `Order`, and complicates queries.

### Decision
**Adopt Option B: Single Collection with Explicit Lifecycle States and Soft Deletion.**

### Rationale
- Prevents data loss; satisfies regulatory, financial, and user history requirements.
- Compound indexes (e.g., `{ status: 1, category: 1, endTime: 1 }` and `{ isDeleted: 1 }`) ensure query performance on active feeds remains identical to a small collection.
- Foreign keys and ObjectIds remain immutable and valid across all related entities (`Bid`, `Order`, `Payment`).

### Consequences
- **Positive:** Zero data loss, historical integrity intact, trivial rollback of accidental deletions.
- **Negative:** Collection size grows over time; requires proper indexing. (MongoDB easily handles millions of documents with B-tree indexes).

### Risks
- Queries that forget to include `{ isDeleted: false }` or `{ status: 'LIVE' }` could display stale data.
- Mitigation: Enforce default query helpers/middleware in the `productRepository`.

### Reversibility
**High.**

### Approval Status
**Proposed — Awaiting Owner Approval.**

---

## ADR-006: Razorpay Payment Verification & Webhook Idempotency

### Context
The current payment flow creates Razorpay orders and relies on client-side frontend verification callbacks. If a user’s browser closes, battery dies, or network drops after paying on the Razorpay gateway modal, the server never receives the client verification call, resulting in an "unpaid" state in the database despite money being charged.

### Problem
How to achieve 100% financial consistency and idempotency for Razorpay transactions regardless of client connectivity?

### Options Considered
1. **Option A: Client Callback Only (Status Quo / Insecure)**
   - Verify payment only when the frontend calls `POST /api/payment/verify`. Completely fails on network dropouts, browser crashes, or malicious tampering.
2. **Option B: Webhook Only**
   - Rely exclusively on Razorpay server-to-server webhooks. Can introduce 2–10 second latency for user feedback in the UI.
3. **Option C: Dual-Path Verification with Durable Webhook Idempotency Store (Recommended)**
   - **Path 1 (Synchronous Fast Path):** Frontend submits payment ID, order ID, and signature to `POST /api/payment/verify`. Server validates HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET`, transitions payment to `CAPTURED`, and responds immediately to the user.
   - **Path 2 (Asynchronous Guaranteed Path):** Razorpay sends server-to-server webhook `POST /api/payment/webhook`. Server validates HMAC-SHA256 signature on raw request body, records the webhook delivery in a `WebhookEvent` collection for idempotency, and reconciles the payment state if Path 1 was missed.

### Decision
**Adopt Option C: Dual-Path Verification with Durable Webhook Idempotency Store.**

### Rationale
- Provides immediate UI feedback when the client remains connected.
- Guarantees eventual financial consistency via webhooks even if the user closes their browser instantly after entering their OTP.
- The `WebhookEvent` idempotency store (keyed on `razorpay_event_id`) prevents duplicate processing and double-credit bugs.

### Consequences
- **Positive:** Zero dropped payments; 100% financial integrity; immune to network failures; tamper-proof cryptographic verification.
- **Negative:** Requires storing webhook raw payload for signature computation (must configure `express.raw()` or custom body parser for `/api/payment/webhook`).

### Risks
- Incorrect body parsing can break HMAC verification.
- Mitigation: Dedicated middleware pipeline specifically for `/api/payment/webhook` before JSON parsing.

### Reversibility
**Low.** Financial and payment infrastructure must be strict and standardized.

### Approval Status
**Proposed — Awaiting Owner Approval.**

---

## ADR-007: Background Processing and Job Recovery Engine

### Context
Auction X requires scheduled background tasks:
1. Reconciling expired auctions (`LIVE` -> `ENDED` / `UNSOLD`).
2. Starting scheduled auctions (`SCHEDULED` -> `LIVE`).
3. Expiring unpaid winner orders after the payment grace period.
4. Syncing interaction data to the FastAPI recommendation service.

### Problem
How to schedule and execute background tasks reliably in the Node.js backend without duplicate job executions across scaled instances and without introducing heavy infrastructure?

### Options Considered
1. **Option A: In-Memory `setInterval` / `setTimeout`**
   - Fragile; lost on process restart; duplicates execution on every horizontal server instance.
2. **Option B: `node-cron` with MongoDB Distributed Lease Lock (`SystemLock`) (Recommended)**
   - Use `node-cron` in the Node process. Use a lightweight `SystemLock` collection in MongoDB with a TTL to acquire a distributed mutex before running any job.
3. **Option C: Redis + BullMQ**
   - Full Redis message queue setup. Highly scalable, but requires introducing and maintaining a managed Redis instance immediately.

### Decision
**Adopt Option B for current phase; design adapter interface to allow seamless migration to Option C (BullMQ) if Redis is deployed.**

### Rationale
- Zero new infrastructure dependencies: Runs directly against the existing MongoDB cluster.
- Distributed safety: Even with 5 Node.js replicas, only the instance holding the MongoDB lease lock runs the reconciliation task.
- Crash recovery: The lease lock uses an automatic expiration (TTL e.g. 60 seconds), ensuring that if a worker crashes mid-task, another worker safely takes over on the next interval.

### Consequences
- **Positive:** Simple, reliable, distributed-safe, zero extra infrastructure costs.
- **Negative:** Polling-based interval (30–60s) rather than millisecond-level event-driven dispatch. (As proven in ADR-003, 30s is more than sufficient because in-line checks protect all API boundaries).

### Risks
- Lock clock drift: Solved by using MongoDB server time (`$currentDate`) or short TTLs.

### Reversibility
**High.** The job logic is decoupled behind a clean `JobService` interface.

### Approval Status
**Proposed — Awaiting Owner Approval.**

---

## ADR-008: Real-Time Event Reliability & Socket.IO Resynchronization

### Context
Live auction pages display current prices, active bidders, and countdown timers via Socket.IO. On mobile connections or Wi-Fi handoffs, socket connections frequently drop, reconnect, or drop packets.

### Problem
How should Auction X guarantee that users see accurate prices and auction states despite network disruptions and out-of-order socket events?

### Options Considered
1. **Option A: Socket as Source of Truth**
   - Assume every client receives every socket event in order. If an event is missed, client displays stale or incorrect price indefinitely.
2. **Option B: Best-Effort Push Notifications with Authoritative REST Snapshot Resynchronization (Recommended)**
   - Socket.IO broadcasts lightweight event payloads containing authoritative current state (`productId`, `currentPrice`, `bidCount`, `highestBidder`, `endTime`, `status`).
   - Every socket broadcast includes an auction version/sequence number (`__v`).
   - On socket reconnect or client visibility change (tab refocus), the frontend automatically fetches a fresh REST snapshot (`GET /api/products/:id`) to guarantee synchronization.
3. **Option C: Complex Client-Side Event Sourcing & ACK Queue**
   - Store all missed events in server buffers and replay to reconnected clients. Highly complex and unnecessary for auction display.

### Decision
**Adopt Option B: Best-Effort Push Notifications with Authoritative REST Snapshot Resynchronization.**

### Rationale
- WebSockets over the internet are inherently best-effort. Treating them as authoritative creates desynchronization bugs.
- REST endpoints are authoritative, cacheable, and idempotent. Re-fetching on reconnect ensures 100% convergence.
- Including full snapshot fields (`currentPrice`, `endTime`, `status`) in the socket payload rather than incremental deltas prevents clients from computing invalid running totals.

### Consequences
- **Positive:** Resilient to disconnects, packet loss, and mobile sleep modes. Zero desync bugs.
- **Negative:** Extra REST call on reconnect (negligible load).

### Risks
- High reconnection storms if server restarts.
- Mitigation: Frontend reconnection incorporates randomized exponential backoff.

### Reversibility
**High.**

### Approval Status
**Proposed — Awaiting Owner Approval.**

---

## ADR-009: Post-Auction Winner Settlement & Unpaid Winner Policy

### Context
When an auction ends with a highest bidder, the item is awarded. However, the transaction is not complete until the winner submits payment via Razorpay. Currently, the relationship between auction close, order generation, and winner payment is undefined in the codebase.

### Problem
What is the exact business and technical lifecycle for post-auction settlement, winner payment deadlines, and handling unpaid winners?

### Options Considered
1. **Option A: Upfront Payment Pre-Authorization (Escrow)**
   - Authorize bidder's card before every bid. Prohibitively high friction for users, high Razorpay transaction costs, unsuitable for standard marketplace onboarding.
2. **Option B: Post-Auction Payment Window (Default 24 Hours) with Fallback Policy (Recommended)**
   - When an auction closes with a winner:
     1. An `Order` record is automatically created in `PENDING_PAYMENT` status.
     2. Auction transitions to `ENDED`.
     3. Winner receives notification with a payment link valid for **24 hours** (configurable).
     4. If winner pays within window: Order transitions to `PAID`, Auction transitions to `SETTLED`, Seller is notified to ship.
     5. If winner fails to pay within 24 hours: Order transitions to `EXPIRED`, Winner receives an infraction strike, and the seller can either:
        - Offer to the 2nd highest bidder ("Second Chance Offer").
        - Re-list the item for auction.
3. **Option C: Off-Platform Settlement / Cash on Delivery Only**
   - Platform merely connects buyer and seller; no digital settlement. Bypasses Razorpay and prevents platform fee capture.

### Decision
**Recommend Option B: Post-Auction Payment Window (24h) with Automatic Expiration and Seller Re-list/Second Chance Options.**  
*(This is a major business policy requiring explicit Project Owner confirmation).*

### Rationale
- Standard e-commerce auction flow (eBay model).
- Low barrier to entry for bidders.
- Fully supports Razorpay digital payment and platform fee calculation.
- Protects sellers against non-paying bidders via automatic expiration and relisting workflows.

### Consequences
- **Positive:** Clear, predictable transaction lifecycle; automated enforcement; seller protection.
- **Negative:** Requires background job to monitor and expire unpaid orders after 24 hours.

### Risks
- Non-paying bidders can lock up seller inventory for 24 hours.
- Mitigation: Payment window can be shortened (e.g. to 12 hours) by owner decision, and repeat non-payers can have bidding privileges suspended.

### Reversibility
**Medium.** Directly affects user-facing checkout flows.

### Approval Status
**Pending Project Owner Decision.**

---

## ADR-010: Audit Trail Logging and Analytics/Data Retention

### Context
Financial transactions, bid placements, administrative actions, and user behavior require auditing for dispute resolution, fraud detection, and compliance. Additionally, the Python FastAPI service requires interaction data to generate personalized recommendations.

### Problem
How to implement comprehensive audit logging and analytics data feeds without slowing down the primary MongoDB database or leaking sensitive personal/payment secrets?

### Options Considered
1. **Option A: Log Files on Disk**
   - Output structured logs to files. Difficult to query for dispute resolution; prone to log loss in ephemeral containers.
2. **Option B: Dedicated Immutable Database Collections + Sanitized Structured Logger (Recommended)**
   - Maintain dedicated append-only collections in MongoDB:
     - `AuditLog`: Admin actions, status overrides, dispute outcomes.
     - `Bid`: Immutable history of all bids placed (never modified or deleted).
     - `Payment`: Immutable financial transaction records and Razorpay webhook receipts.
   - Implement a Winston/Pino structured logger that automatically redacts secrets (`password`, `key_secret`, `card`, `signature`, `token`).
   - Provide an authenticated read endpoint (`GET /api/internal/recommendations/interactions`) for the FastAPI service to pull training datasets asynchronously.
3. **Option C: Full Enterprise Event Sourcing & Data Warehouse (ClickHouse / Snowflake)**
   - Overkill for current application stage; excessive infrastructure cost.

### Decision
**Adopt Option B: Dedicated Immutable Collections with Sanitized Structured Logging and Batch Recommendation Ingestion.**

### Rationale
- Provides bulletproof auditability for customer disputes and payment reconciliation.
- Completely adheres to data protection principles by redacting credentials in logging middleware.
- Serves the recommendation engine cleanly without cross-database spaghetti.

### Consequences
- **Positive:** High audit compliance, secure logging, robust recommendation data pipeline.
- **Negative:** Storage growth in MongoDB (managed with proper indexes and TTL where appropriate).

### Risks
- Developers accidentally logging sensitive fields.
- Mitigation: Centralized redaction serializer in the logging configuration.

### Reversibility
**High.**

### Approval Status
**Proposed — Awaiting Owner Approval.**
