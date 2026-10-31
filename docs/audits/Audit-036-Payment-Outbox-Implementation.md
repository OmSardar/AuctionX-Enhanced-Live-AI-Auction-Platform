# Auction X — Stage 4 Implementation & Verification Report
## Production-Grade Payment Architecture & Settlement Engine

**Audit Date:** October 14, 2026  
**Auditor / Specialist:** Senior Payments Architect, Distributed-Systems Specialist, Application Security Engineer  
**Stage:** Stage 4 — Production-Grade Payment Architecture & Settlement  
**Target Baseline:** Stage 3 Finalized Baseline (101/101 Passing)  
**Final Test Result:** **PASS (126 / 126 Tests Passing across 9 Test Suites, Exit Code 0)**  
**Working Tree Integrity:** **100% PRESERVED (Zero destructive Git commands, zero untracked file loss)**

---

## 1. Payment Architecture and State Machine

### 1.1 Separation of Concerns
The Auction X payment subsystem separates four distinct conceptual layers:
1. **Auction Lifecycle State (`Product.status`):**
   - Transitions: `SCHEDULED` $\rightarrow$ `LIVE` $\rightarrow$ `ENDED` $\rightarrow$ `SETTLED`.
   - Invariant: A product only reaches `SETTLED` once its authoritative payment obligation is cryptographically verified and recorded.
2. **Order Lifecycle State (`Order.status`):**
   - Transitions: `PENDING` $\rightarrow$ `PAID` | `EXPIRED` | `CANCELLED` | `REFUNDED`.
   - Invariant: An `Order` can only be transitioned from `PENDING` to `PAID` through atomic dual-path settlement (`Order.findOneAndUpdate({ _id, status: 'PENDING' }, ...)`).
3. **Payment Attempt Ledger (`Payment.status`):**
   - Transitions:
     - `INITIATED` $\rightarrow$ `CAPTURED` (Successful checkout verification or webhook delivery).
     - `INITIATED` $\rightarrow$ `FAILED` (Gateway transaction failure).
     - `INITIATED` $\rightarrow$ `EXPIRED` (Stale checkout attempt timed out after 2 hours without completion).
     - `INITIATED` | `PENDING_VERIFICATION` $\rightarrow$ `REQUIRES_RECONCILIATION` (Amount mismatch, late payment after 24h deadline, or unexpected currency/provider anomaly).
     - `CAPTURED` $\rightarrow$ `REFUNDED` (Provider-confirmed refund event).
4. **Webhook Event Deduplication Ledger (`WebhookEvent.processingStatus`):**
   - Transitions: `PENDING` $\rightarrow$ `PROCESSED` | `IGNORED` | `FAILED`.
   - Enforced by a unique MongoDB index on `eventId`.

```
           +---------------------------------------------+
           |           Order Created (PENDING)           |
           |      paymentDeadline = finalizedAt + 24h    |
           +----------------------+----------------------+
                                  |
                   POST /api/payment/create-order
                                  |
                                  v
           +---------------------------------------------+
           |               Payment Created               |
           |             (status: INITIATED)             |
           +----------------------+----------------------+
                                  |
                 +----------------+----------------+
                 |                                 |
        Client Checkout                   Provider Webhook
      POST /api/payment/verify           POST /api/payment/webhook
                 |                                 |
                 +----------------+----------------+
                                  |
                      HMAC Signature Verification
                                  |
               +------------------+------------------+
               |                                     |
             Valid                                Invalid
               |                                     |
               v                                     v
       Deadline & Amount Valid?                  HTTP 400
               |                              (INVALID_SIGNATURE)
        +------+------+
        |             |
       Yes           No (Late Payment or Mismatch)
        |             |
        v             v
   Order -> PAID    Payment -> REQUIRES_RECONCILIATION
  Product -> SETTLED (Quarantined for Operator Audit)
  Payment -> CAPTURED
```

---

## 2. Files Created or Changed

| Path | Nature of Modification | Rationale / Architectural Responsibility |
|---|---|---|
| `server/models/Payment.js` | **NEW** | Durable payment attempt ledger tracking minor unit paise amounts, provider bindings (`razorpayOrderId`, `razorpayPaymentId`), scoped idempotency keys, and reconciliation states. |
| `server/models/WebhookEvent.js` | **NEW** | Deduplication and audit log for webhook deliveries with unique MongoDB index on `eventId`. |
| `server/models/SellAnItemSchema/orderSchema.js` | **MODIFIED** | Added `paymentId`, `razorpayPaymentId`, `razorpayOrderId`, `paidAt`, and `paymentAttempts` fields with performance indexes. |
| `server/services/paymentService.js` | **NEW** | Server-authoritative payment engine: Razorpay order generation, constant-time checkout/webhook HMAC verification, atomic dual-path settlement, late payment quarantine, and reconciliation worker. |
| `server/controllers/PaymentControllers/paymentController.js` | **NEW** | HTTP handlers for `createPaymentOrder`, `verifyPayment`, `handleWebhook`, and `getPaymentStatus` with structured redaction logging. |
| `server/routes/PaymentRoutes/paymentWebhookRoutes.js` | **MODIFIED** | Mounted endpoints with CSRF protection on client endpoints, raw-body verification on webhooks, and backwards-compatible probe handling. |
| `server/utlis/Database/db.js` | **MODIFIED** | Synchronously initializes schema indexes for `Product`, `Bid`, `Order`, `Payment`, and `WebhookEvent` on database connection. |
| `server/.env.example` | **MODIFIED** | Added documentation for `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and frontend `VITE_RAZORPAY_API_KEY`. |
| `server/config/validateEnv.js` | **MODIFIED** | Added startup warnings in production environments if Razorpay keys are omitted. |
| `server/tests/setup.js` | **MODIFIED** | Seeded non-sensitive test credentials for Razorpay in Jest test environment. |
| `server/tests/unit/stage4_payment_settlement.test.js` | **NEW** | 25 comprehensive unit, integration, concurrency, and security tests validating all Stage 4 invariants. |
| `client/src/pages/User/Dropdown/OrderHistory/DetailedOrderPage.jsx` | **MODIFIED** | Integrated server-authoritative Razorpay modal trigger, public key initialization, backend signature verification, and authoritative order status refresh. |

---

## 3. API Routes and Authorization Rules

### 3.1 Route Matrix
1. **`POST /api/payment/create-order`**
   - **Protection:** `authUserMiddleware` (JWT Bearer / Cookie) + Double-Submit CSRF (`x-csrf-token`).
   - **Authorization:** Authenticated user must be the winning bidder (`order.winnerId === req.user._id` or `order.userEmail === req.user.email`).
   - **Payload:** `{ orderId: string, idempotencyKey?: string }`.
   - **Pricing Invariant:** Amount is strictly derived from the database record (`order.finalPrice || order.highestBid` converted to minor unit paise). Client-provided amounts are discarded.
   - **Response:** Public checkout options (`orderId`, `paymentId`, `razorpayOrderId`, `amount`, `currency`, `keyId`, `title`, `customer`, `paymentDeadline`).

2. **`POST /api/payment/verify`**
   - **Protection:** `authUserMiddleware` + Double-Submit CSRF (`x-csrf-token`).
   - **Authorization:** Authenticated winning bidder.
   - **Payload:** `{ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }`.
   - **Verification:** HMAC-SHA256 signature verification over `${razorpayOrderId}|${razorpayPaymentId}` using `crypto.timingSafeEqual`.
   - **Response:** `{ success: true, message: string, status: 'PAID', order: Object }`.

3. **`POST /api/payment/webhook` & `POST /api/webhooks/razorpay`**
   - **Protection:** CSRF-exempt (server-to-server authenticated via cryptographic signature). Raw request body captured into `req.rawBody` buffer before JSON parsing.
   - **Authorization:** `x-razorpay-signature` header verified against `req.rawBody` using `crypto.timingSafeEqual`.
   - **Probe Backward-Compatibility:** Missing signature returns HTTP 501 `WEBHOOK_STAGE_4_PREREQUISITE` (preserving Stage 1 test contract).
   - **Deduplication:** Durable check against `WebhookEvent.eventId`. Duplicate events return HTTP 200 `{ duplicate: true, success: true }`.

4. **`GET /api/payment/order/:orderId`**
   - **Protection:** `authUserMiddleware` + `validateObjectId('orderId')`.
   - **Authorization:** Winning buyer, seller, or system admin (`req.user.role === 'admin'`). Imposters receive HTTP 403 `FORBIDDEN`.
   - **Response:** Authoritative order status, payment deadline, final price, paid timestamp, attempt count, and payment ledger history.

---

## 4. Signature and Webhook Verification Design

### 4.1 Checkout Signature Verification
Razorpay returns three client-side tokens upon completion of the modal:
- `razorpay_order_id`
- `razorpay_payment_id`
- `razorpay_signature`

The backend computes:
$$\text{Expected} = \text{HMAC-SHA256}_{\text{RAZORPAY\_KEY\_SECRET}}(\text{razorpay\_order\_id} \mathbin{\Vert} \text{"|"} \mathbin{\Vert} \text{razorpay\_payment\_id})$$
Verification is performed in constant time:
```javascript
const expectedBuffer = Buffer.from(expectedSignature, "utf8");
const receivedBuffer = Buffer.from(razorpaySignature, "utf8");
if (expectedBuffer.length !== receivedBuffer.length) return false;
return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
```

### 4.2 Webhook Raw-Body Verification
To prevent encoding and whitespace corruption caused by JSON body parsers, `server.js` mounts:
```javascript
app.use(
  ["/api/payment/webhook", "/api/webhooks/razorpay"],
  express.raw({ type: "*/*" }),
  (req, res, next) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
    }
    next();
  }
);
```
Signature verification calculates HMAC-SHA256 directly on `req.rawBody` against the secret `RAZORPAY_WEBHOOK_SECRET` and compares with `req.headers["x-razorpay-signature"]` using `crypto.timingSafeEqual`.

---

## 5. Idempotency and Recovery Guarantees

### 5.1 Standalone MongoDB Compatibility
The implementation does not require multi-document replica-set transactions. All race conditions are resolved via atomic database operators and unique compound index constraints:
1. **Order Settlement Race (`POST /api/payment/verify` vs Webhook):**
   ```javascript
   const updatedOrder = await Order.findOneAndUpdate(
     { _id: order._id, status: "PENDING" },
     { $set: { status: "PAID", razorpayPaymentId, razorpayOrderId, paidAt: queryTime } },
     { new: true }
   );
   ```
   If both checkout verification and webhook execute concurrently, exactly one MongoDB atomic update succeeds. The second call detects that the document is already in state `PAID` and returns `{ alreadyPaid: true }` without repeating side-effects.
2. **Webhook Event Deduplication:**
   `WebhookEvent.eventId` carries a unique index. Duplicate deliveries throw MongoDB duplicate key error (code 11000), which is caught and gracefully acknowledged with HTTP 200 `{ duplicate: true }`.
3. **Scoped Payment Idempotency:**
   Clients may send `idempotencyKey`. The compound index `{ orderId: 1, idempotencyKey: 1 }` with `partialFilterExpression: { idempotencyKey: { $type: "string" } }` ensures that replaying the same checkout request returns the existing `razorpayOrderId` without calling the provider API a second time.
4. **Out-of-Order Webhook Safety:**
   If a `payment.failed` event arrives after an order has already reached `PAID`, the handler inspects `order.status`. The update explicitly filters `{ razorpayOrderId, status: { $ne: "CAPTURED" } }`, preventing delayed failure webhooks from downgrading paid orders.

---

## 6. Database Index Requirements

The following production indexes are defined and built automatically:

| Collection | Index Fields | Properties | Purpose |
|---|---|---|---|
| `payments` | `{ orderId: 1, createdAt: -1 }` | Standard | Efficient retrieval of order payment attempt history. |
| `payments` | `{ razorpayPaymentId: 1 }` | `unique: true, sparse: true` | Prevents a single provider payment ID from being recorded twice or fulfilling multiple orders. |
| `payments` | `{ orderId: 1, idempotencyKey: 1 }` | `unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } }` | Scoped idempotency per order without blocking multiple keyless attempts. |
| `payments` | `{ status: 1, createdAt: -1 }` | Standard | Reconciliation worker scanning for stale `INITIATED` payments. |
| `webhookevents` | `{ eventId: 1 }` | `unique: true` | Absolute deduplication of incoming webhook events. |
| `webhookevents` | `{ eventType: 1, processingStatus: 1 }` | Standard | Auditing and worker retry queries. |
| `orders` | `{ productId: 1 }` | `unique: true, sparse: true` | Prevents duplicate payment obligations for the same auction item. |
| `orders` | `{ status: 1, paymentDeadline: 1 }` | Standard | Enables the reconciliation worker to find overdue unpaid orders. |

---

## 7. Deadline, Late-Payment, Duplicate-Payment & Reconciliation Behavior

### 7.1 Strict 24-Hour Payment Deadline
- Set authoritatively when the auction closes: `paymentDeadline = finalizedAt + 24 hours`.
- Payment initiation after this deadline throws HTTP 400 `PAYMENT_DEADLINE_EXPIRED` and atomically transitions `Order.status` to `EXPIRED`.
- Multiple payment attempts or background job executions **never** mutate `paymentDeadline`.

### 7.2 Late Payment Quarantine
If a user completes payment at the Razorpay gateway shortly before the deadline, but the webhook or callback reaches Auction X *after* the 24-hour mark:
- The system **refuses** to automatically fulfill the auction item (`Order` remains `EXPIRED` and `Product` is not settled).
- The payment record is updated to `status: "REQUIRES_RECONCILIATION"` with `reconciliationNotes: "Late payment captured after 24h deadline expired..."`.
- The event is quarantined for administrative review or refund rather than silently dropping financial evidence.

### 7.3 Amount and Currency Verification
- If a provider webhook reports an amount differing from the database-authoritative minor unit calculation (`amountPaise !== Math.round(order.finalPrice * 100)`), the payment is placed in `REQUIRES_RECONCILIATION` and an alert is logged. Fulfillments are blocked.

### 7.4 Background Reconciliation Worker
The export `reconcilePaymentStates({ now })` handles automated hygiene:
1. Transitions `PENDING` orders with `paymentDeadline <= now` to `EXPIRED`.
2. Transitions abandoned `INITIATED` payment attempts older than 2 hours to `EXPIRED` (`failureReason: "Payment attempt timed out without checkout completion"`).

---

## 8. Test Execution and Verification Totals

### 8.1 Test Command
```bash
npm test -- tests/smoke/smoke.test.js tests/unit/stage1_security_validation.test.js tests/unit/stage2_bidding_concurrency.test.js tests/unit/stage3_lifecycle_scheduler.test.js tests/unit/stage4_payment_settlement.test.js tests/unit/models/orderModel.test.js tests/unit/controllers/orderController.test.js tests/integration/orders/orderFlow.test.js tests/acceptance/auctionLifecycle.test.js
```

### 8.2 Execution Results
- **Exit Status:** `0` (Success)
- **Total Test Suites:** **9 passed, 9 total**
- **Total Tests:** **126 passed, 126 total (0 skipped, 0 failed)**
- **Total Time:** `23.302 s`

### 8.3 Suite Breakdown
| Test Suite | Tests Passed | Status |
|---|:---:|:---:|
| `tests/smoke/smoke.test.js` | 8 / 8 | **PASS** |
| `tests/unit/stage1_security_validation.test.js` | 13 / 13 | **PASS** |
| `tests/unit/stage2_bidding_concurrency.test.js` | 24 / 24 | **PASS** |
| `tests/unit/stage3_lifecycle_scheduler.test.js` | 24 / 24 | **PASS** |
| `tests/unit/stage4_payment_settlement.test.js` | **25 / 25** | **PASS** |
| `tests/unit/models/orderModel.test.js` | 3 / 3 | **PASS** |
| `tests/unit/controllers/orderController.test.js` | 7 / 7 | **PASS** |
| `tests/integration/orders/orderFlow.test.js` | 6 / 6 | **PASS** |
| `tests/acceptance/auctionLifecycle.test.js` | 16 / 16 | **PASS** |
| **Combined Total** | **126 / 126** | **PASS** |

---

## 9. Operational Safety, Limitations & Scope Discipline

### 9.1 Secrets & Credential Redaction
- All credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) are read exclusively from environment variables.
- The `LoggerMiddleware` automatically scrubs any keys matching `secret`, `signature`, `key`, `token`, `password`, or `authorization`.
- Real financial credentials were never injected into git, tests, or documentation.

### 9.2 Scope Restrictions Strictly Maintained
- **Admin RBAC & Provisioning:** Not implemented; remains explicitly deferred.
- **Runner-Up Charging:** Not implemented; expired auctions are not automatically charged to runners-up.
- **Wallet / Stored-Value System:** Excluded per architecture guidelines.
- **Microservices / Message Brokers:** Avoided; solution relies purely on standalone MongoDB atomic primitives, Express, and Node.js built-in cryptography.
- **Live Financial Transactions:** Strictly mocked via deterministic provider clients in automated tests.

---

## 10. Working Tree State (`git status --short`)

Confirmation that existing user modifications and untracked work remain intact:

```
 M client/src/components/Layouts/Footer/AboutUs/OurReach/OurReach.jsx
 M client/src/components/Layouts/Footer/AboutUs/OurStory/OurStory.jsx
 M client/src/components/Layouts/Footer/AboutUs/WhyUs/WhyUs.jsx
 M client/src/components/Layouts/Footer/ConsumerPolicy/Privacy/Privacy.jsx
 M client/src/components/Layouts/Footer/ConsumerPolicy/Security/Security.jsx
 M client/src/components/Layouts/Footer/ConsumerPolicy/TermsAndConditions/TermsAndConditions.jsx
 M client/src/components/Layouts/Footer/Help/FAQ/FAQ.jsx
 M client/src/components/Layouts/Footer/Help/Feedback/Feedback.jsx
 M client/src/components/Layouts/Footer/Help/HelpSupport/HelpAndSupportPage.jsx
 M client/src/components/Layouts/Footer/Help/HelpSupport/HelpSupport.jsx
 M client/src/components/Layouts/Footer/Help/Payment/Payment.jsx
 M client/src/components/Layouts/Footer/Help/Report/Report.jsx
 M client/src/components/Layouts/Footer/Help/Shipping/Shipping.jsx
 M client/src/components/Modals/PopupModal/PopupModal.jsx
 M client/src/components/ProductList/ProductList1/ProductList.jsx
 M client/src/components/ProductList/ProductList10/ProductList10.jsx
 M client/src/components/ProductList/ProductList2/ProductList2.jsx
 M client/src/components/ProductList/ProductList3/ProductList3.jsx
 M client/src/components/ProductList/ProductList4/ProductList4.jsx
 M client/src/components/ProductList/ProductList5/ProductList5.jsx
 M client/src/components/ProductList/ProductList6/ProductList6.jsx
 M client/src/components/ProductList/ProductList7/ProductList7.jsx
 M client/src/components/ProductList/ProductList8/ProductList8.jsx
 M client/src/components/ProductList/ProductList9/ProductList9.jsx
 M client/src/components/SellerComponents/PricingTable/PricingTable.jsx
 M client/src/components/SellerComponents/SellProduct/SellProduct.jsx
 M client/src/components/SellerComponents/SellerBanner/SellerBanner1/SellerBanner.jsx
 M client/src/components/SellerComponents/SellerBanner/SellerBanner1/SellerBannerCard.jsx
 M client/src/components/SellerComponents/SellerBanner/SellerBanner2/SellerBanner2.jsx
 M client/src/components/SellerComponents/SellerBanner/SellerBanner3/SellerBanner3.jsx
 M client/src/components/SellerComponents/SellerBanner/SellerBanner4/SellerBanner4.jsx
 M client/src/components/SellerComponents/SellerSupport/SellerSupport.jsx
 M client/src/components/SellerDashboard/components/DateSelect.jsx
 M client/src/components/SellerDashboard/components/ThemeToggle.jsx
 M client/src/components/SellerDashboard/components/ui/calendar.jsx
 M client/src/components/SellerDashboard/lib/utils.ts
 M client/src/components/SellerDashboard/partials/dashboard/AddAdminsPage.jsx
 M client/src/components/SellerDashboard/partials/dashboard/AddBannerPage.jsx
 M client/src/components/SellerDashboard/partials/dashboard/CalenderPage.jsx
 M client/src/components/SellerDashboard/partials/dashboard/ContactUsPage.jsx
 M client/src/components/SellerDashboard/partials/dashboard/CustomAuctionPage.jsx
 M client/src/components/SellerDashboard/partials/dashboard/CustomEventsPage.jsx
 M client/src/components/SellerDashboard/partials/dashboard/Customers2.jsx
 M client/src/components/SellerDashboard/partials/dashboard/InvoicePage.jsx
 M client/src/components/SellerDashboard/partials/dashboard/LatestRevenue.jsx
 M client/src/components/SellerDashboard/partials/dashboard/ManageUsersPage.jsx
 M client/src/components/SellerDashboard/partials/dashboard/MyNotificationPage.jsx
 M client/src/components/SellerDashboard/partials/dashboard/PendingBids/PendingBids.jsx
 M client/src/components/SellerDashboard/partials/dashboard/TransactionPage.jsx
 M client/src/components/SellerDashboard/partials/dashboard/WideCard1.jsx
 M client/src/components/SellerDashboard/partials/dashboard/WideCard2.jsx
 M client/src/components/SellerDashboard/partials/dashboard/WideCard3.jsx
 M client/src/components/SellerDashboard/sellerCharts/ChartjsConfig.jsx
 M client/src/components/SellerDashboard/sellercss/sellerStyle.css
 M client/src/components/SellerDashboard/utils/ThemeContext.jsx
 M client/src/components/SellerDashboard/utils/Transition.jsx
 M client/src/components/SellerDashboard/utils/Utils.js
 M client/src/components/User/AnimatedNumbers/AnimatedNumbers.jsx
 M client/src/components/User/TodayBid/TodayBid.jsx
 M client/src/components/User/TomorrowBid/TomorrowBid.jsx
R  client/src/components/UI/SmoothScroll/SmoothScroll.jsx -> client/src/components/ui/SmoothScroll/SmoothScroll.jsx
 M client/src/index.css
 M client/src/layouts/Seller/SellerLayout.jsx
 M client/src/layouts/User/UserLayout.jsx
 M client/src/main.jsx
 M client/src/pages/Layouts/Footer/Footer.jsx
 M client/src/pages/Layouts/Navbar/Navbar.jsx
 M client/src/pages/Seller/Layouts/SellerFooter/SellerFooter.jsx
 M client/src/pages/Seller/Layouts/SellerNavbar/SellerNavbar.jsx
 M client/src/pages/User/CategoryList/CategoryList.jsx
 M client/src/pages/User/Dropdown/OrderHistory/DetailedOrderPage.jsx
 M client/src/pages/User/Home.jsx
 M client/src/pages/User/ProductDetails/ProductDetails.jsx
 M client/src/pages/User/SearchAndPostDetail/SearchAndPostDetail.jsx
 M client/src/pages/User/UserLogin/Login.jsx
 M client/src/pages/User/UserLogin/OtpVerification.jsx
 M client/src/pages/User/UserLogin/PasswordResetFlow.jsx
 M client/src/pages/User/UserLogin/VerifyProfilePage.jsx
 M client/src/pages/User/UserLogin/VerifySellerProfilePage.jsx
 M client/src/redux/slices/authThunks.jsx
 M client/tailwind.config.js
 M client/vite.config.js
 M recommendation_service/main.py
 M recommendation_service/requirements.txt
 M server/.env.example
 M server/controllers/LoginControllers/SellerLoginController/SellerGoogleLoginController.js
 M server/controllers/LoginControllers/SellerLoginController/SellerLoginController.js
 M server/controllers/LoginControllers/UserLoginController/UserGoogleLoginController.js
 M server/controllers/LoginControllers/UserLoginController/UserLoginController.js
 M server/controllers/OtherControllers/SocketController.js
 M server/controllers/SellerControllers/SellerProductController/productController.js
 M server/middleware/Security/ErrorHandler.js
 M server/middleware/Security/LoggerMiddleware.js
 M server/middleware/Security/ValidationMiddleware.js
 M server/middleware/Security/csrfMiddleware.js
 M server/models/SellAnItemSchema/Product.js
 M server/models/SellAnItemSchema/orderSchema.js
 M server/package.json
 M server/routes/LoginRoutes/UserAuthRoutes.js
 M server/routes/SellerRoutes/orderRoutes.js
 M server/routes/SellerRoutes/productRoutes.js
 M server/server.js
 M server/tests/acceptance/auctionLifecycle.test.js
 M server/tests/setup.js
 M server/utlis/Auth2.0/passportGoogleStrategy.js
 M server/utlis/Database/db.js
 M server/utlis/SeedData/syncAtlasToLocal.js
?? PROJECT_STRUCTURE.txt
?? client/public/default-profile.png
?? client/src/app/
?? client/src/components/ui/Badge.jsx
?? client/src/components/ui/Button.jsx
?? client/src/components/ui/Card.jsx
?? client/src/components/ui/DateSelect.jsx
?? client/src/components/ui/Dialog.jsx
?? client/src/components/ui/Dropdown.jsx
?? client/src/components/ui/EmptyState.jsx
?? client/src/components/ui/Input.jsx
?? client/src/components/ui/RouteErrorBoundary.jsx
?? client/src/components/ui/RouteLoadingFallback.jsx
?? client/src/components/ui/Skeleton.jsx
?? client/src/components/ui/Textarea.jsx
?? client/src/components/ui/ThemeToggle.jsx
?? client/src/components/ui/Tooltip.jsx
?? client/src/components/ui/Transition.jsx
?? client/src/components/ui/index.js
?? client/src/lib/
?? client/src/pages/Layouts/Navbar/components/
?? client/src/pages/Layouts/Navbar/constants/
?? client/src/styles/
?? docs/
?? pyproject.toml
?? pyrightconfig.json
?? recommendation_service/pyproject.toml
?? recommendation_service/pyrightconfig.json
?? server/config/
?? server/controllers/PaymentControllers/
?? server/migrations/
?? server/models/Bid.js
?? server/models/Payment.js
?? server/models/SellAnItemSchema/Bid.js
?? server/models/WebhookEvent.js
?? server/routes/PaymentRoutes/
?? server/services/
?? server/tests/unit/stage1_security_validation.test.js
?? server/tests/unit/stage2_bidding_concurrency.test.js
?? server/tests/unit/stage3_lifecycle_scheduler.test.js
?? server/tests/unit/stage4_payment_settlement.test.js
?? server/utlis/SeedData/seedDemoData.js
```

---

## 11. Conclusion & Next Step Gate

Stage 4 is **100% complete, verified, and passing all tests**.
The server-authoritative Razorpay payment architecture, cryptographic signature verification, durable webhook deduplication, late payment quarantine, and dual-path settlement engine are fully operational and verified under high concurrency and failure injection.

Per the prompt instructions:
> **Stop after Stage 4. Do not proceed to Stage 5, admin provisioning, or deployment until explicitly instructed.**
