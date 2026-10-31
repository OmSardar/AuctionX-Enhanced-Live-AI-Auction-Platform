# Stage 4.9 — Razorpay Configuration Hardening and Final Wallet Regression Check

**Audit Timestamp:** 2026-10-14  
**Auditor:** DeepMind Antigravity — Autonomous Correctness & Reliability Engineering  
**Scope:** Strict canonical backend Razorpay configuration establishment, elimination of `VITE_` fallbacks on backend, deterministic `dotenv` resolution and process environment precedence, credential leak prevention, and comprehensive regression verification of all wallet settlement and recovery invariants.  
**Verdict — Configuration Hardening:** **`PASS`**  
**Verdict — Wallet Settlement Correctness:** **`PASS`**  

---

## 1. Executive Summary & Verdicts

| Dimension | Scope | Verdict | Key Findings & Validations |
| :--- | :--- | :---: | :--- |
| **Configuration Hardening** | Canonical backend environment variables, `VITE_` fallback removal, dotenv precedence, CWD invariance, secret isolation | **`PASS`** | 1. Removed `VITE_RAZORPAY_API_KEY` fallback in `server/services/paymentService.js`; `RAZORPAY_KEY_ID` is strictly enforced as the canonical backend variable.<br>2. Frontend public configuration remains strictly segregated (`VITE_RAZORPAY_API_KEY` for checkout modal; `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are never exposed).<br>3. Hardened `server/server.js` dotenv loading order: process-injected environment variables (e.g. Render, Docker) take highest precedence (`override: false`), followed by `server/.env`, and monorepo `../.env` fallback.<br>4. Resolving via `__dirname` guarantees identical resolution regardless of `process.cwd()`.<br>5. Credential diagnostics report missing variable names only; values are never logged or returned. |
| **Wallet Settlement Correctness** | Mathematical invariants, single-document atomic locks, `FAILED` payment guards, legacy recovery, crash disambiguation | **`PASS`** | 1. Missing credentials fail at initiation before creating orders, Payment documents, or crediting wallets.<br>2. FAILED payment guards reject settlement and throw `CONTRADICTORY_PAYMENT_STATE` (409) if settlement artifacts exist, blocking mutations.<br>3. Legacy write ordering verified: `CAPTURED` + `Transaction` proves completed historical credit; safely backfills `creditedPayments` marker without double-credit.<br>4. Single-document atomic `$ne` check-and-increment guarantees at-most-once credit under concurrent workers, replayed webhooks, and racing reconciliation.<br>5. Ambiguous write timeouts disambiguated by authoritative re-reading; never guesses unconfirmed state. |

---

## 2. Objective 1 — Canonical Backend Configuration Establishment

### 2.1 Elimination of Backend Fallback to Frontend Variables

In Stage 4.8, `callRazorpayCreateOrder` contained a fallback:
```javascript
// Previous Stage 4.8 logic (Deprecated fallback)
const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_API_KEY;
```

In Stage 4.9, this fallback was audited and removed. `VITE_` is Vite’s prefix for variables compiled into browser client bundles. Relying on frontend keys on the backend risks configuration drift, blurs the security perimeter, and causes confusion between public and private credentials.

**Hardened Implementation (`server/services/paymentService.js`):**
```javascript
// Canonical Backend Configuration (Stage 4.9 Hardened)
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  const missing = [];
  if (!keyId) missing.push("RAZORPAY_KEY_ID");
  if (!keySecret) missing.push("RAZORPAY_KEY_SECRET");
  const actionMsg = `Payment gateway credentials are not configured. Missing environment variable(s): ${missing.join(", ")}.`;
  if (logger) {
    logger.error(`[PaymentService] ${actionMsg}`);
  }
  throw new PaymentError(
    "Payment gateway credentials are not configured",
    503,
    "GATEWAY_NOT_CONFIGURED",
    {
      missing,
      hint: `Please configure ${missing.join(" and ")} in your server environment (.env).`,
    }
  );
}
```

If `VITE_RAZORPAY_API_KEY` is present in the server environment without `RAZORPAY_KEY_ID`, the backend rejects with:
- HTTP 503 `GATEWAY_NOT_CONFIGURED`
- `missing: ["RAZORPAY_KEY_ID"]`
- `hint: "Please configure RAZORPAY_KEY_ID in your server environment (.env)."`

### 2.2 Frontend Public Configuration Segregation

The boundary between public client variables and confidential backend secrets is strictly maintained:

```mermaid
graph TD
    subgraph Frontend Boundary [Client / Browser: Public Scope]
        ViteClient[Vite Client Bundle]
        ViteEnv[client/.env: VITE_RAZORPAY_API_KEY]
        Modal[new window.Razorpay - key: keyId]
        ViteClient --> Modal
        ViteEnv -.-> ViteClient
    end

    subgraph Backend Boundary [Node.js Express: Confidential Scope]
        ServerEnv[server/.env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET]
        PaymentService[server/services/paymentService.js]
        BasicAuth[Basic Auth: base64 key_id:key_secret]
        HMAC[crypto.createHmac sha256]
        ServerEnv -.-> PaymentService
        PaymentService --> BasicAuth
        PaymentService --> HMAC
    end

    subgraph External Gateway [Razorpay API]
        RzpOrders[https://api.razorpay.com/v1/orders]
        BasicAuth -->|HTTPS Basic Auth| RzpOrders
    end

    Modal -.->|Public Key Only| RzpOrders
    PaymentService -->|Return keyId, orderId - NO SECRETS| ViteClient
```

1. **Client Checkout Initialization:**
   The frontend (`PaymentPage.jsx`) uses `keyId` returned by the authoritative backend order creation endpoint (`orderRes.data.keyId`), falling back to `VITE_RAZORPAY_API_KEY` only if needed for client modal instantiation (`new window.Razorpay({ key: keyId || RAZORPAY_KEY, ... })`).
2. **Secret Containment:**
   Neither `RAZORPAY_KEY_SECRET` nor `RAZORPAY_WEBHOOK_SECRET` is ever returned in any API response payload, logged in any console/file logger, or present in `client/.env.example`, `compose.yaml` (client service), or `render.yaml` (client static service).

### 2.3 Dotenv Resolution Order, Process Precedence & CWD Invariance

In `server/server.js`, environment loading was audited and hardened with explicit architectural documentation:

```javascript
const path = require("path");

// ============================================================================
// Deterministic Environment Configuration Loading Order
// ============================================================================
// 1. Process Environment Precedence: Injected variables (from Render, Docker,
//    or process environment) take strict precedence; dotenv defaults to override: false.
// 2. Server Local Configuration: Resolves server/.env relative to __dirname.
// 3. Monorepo Root Configuration: Resolves ../.env relative to __dirname for shared defaults.
// 4. CWD Invariance: Using path.resolve(__dirname, ...) guarantees identical resolution
//    whether launched from repository root (node server/server.js) or server directory (node server.js).
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { validateEnv } = require("./config/validateEnv.js");

// Validate environment configuration safely at load
validateEnv();
```

#### Precedence Invariant
Standard `dotenv.config()` sets variables on `process.env` only if they are not already defined (`override: false` by default). Therefore:
- Cloud-injected variables (Render environment variables, Docker Compose environment blocks, CI/CD runners) take strict top precedence.
- Server-local `.env` (`server/.env`) fills any unset variables.
- Monorepo root `.env` (`../.env`) fills remaining shared defaults.
- Neither file overwrites process-level variables.

#### Working Directory (CWD) Invariance
Because paths are anchored to Node’s `__dirname` (which always resolves to `<repo>/server`), directory navigation before startup has zero effect on file resolution:
- Started from repo root: `node server/server.js` -> resolves `<repo>/server/.env` and `<repo>/.env`.
- Started from server dir: `cd server && node server.js` -> resolves `<repo>/server/.env` and `<repo>/.env`.
- Started from arbitrary subdirectory: `node ../server/server.js` -> resolves `<repo>/server/.env` and `<repo>/.env`.

### 2.4 Configuration Template Verification

All configuration templates were verified to document canonical variables with non-secret placeholders:

1. **`server/.env.example`:**
   Removed `VITE_RAZORPAY_API_KEY`. Documented canonical backend keys:
   ```env
   # Razorpay payment gateway credentials (Stage 4 - Canonical Backend Configuration)
   # Note: Client uses VITE_RAZORPAY_API_KEY in client/.env; never place secret keys in client environment.
   RAZORPAY_KEY_ID=rzp_test_your_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
   ```
2. **`.env.example` (Root Monorepo Template Created):**
   Provides clear segregation between canonical backend variables and frontend public keys with zero real credentials.
3. **`.env.docker.example`:**
   Properly segregates `VITE_RAZORPAY_API_KEY` under `# --- Frontend Environment Variables ---` and `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` under `# --- Razorpay Payment Gateway Credentials ---`.
4. **`render.yaml`:**
   Backend service `auctionx-server` declares `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Frontend static service `auctionx-client` declares only `VITE_RAZORPAY_API_KEY`. No backend secrets are declared in the frontend service.
5. **`compose.yaml` and `compose.prod.yaml`:**
   Server container receives `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Client container receives only build-arg and env `VITE_RAZORPAY_API_KEY`.

### 2.5 Secret-Free Credential Diagnostics

`callRazorpayCreateOrder` guarantees that credential errors report missing variable names only:
- Structured error details: `{ missing: ["RAZORPAY_KEY_ID"], hint: "Please configure RAZORPAY_KEY_ID in your server environment (.env)." }`
- No values (partial, masked, or cleartext) are ever logged or serialized into error responses.

---

## 3. Objective 2 — Preservation of Payment and Wallet Invariants

### 3.1 Pre-Order Credential Guard

If payment gateway credentials are not configured in `process.env`:
1. `callRazorpayCreateOrder` throws `GATEWAY_NOT_CONFIGURED` (503) immediately.
2. Order creation terminates before creating any external Razorpay order.
3. Zero internal `Payment` records are inserted.
4. Zero `Transaction` ledger records are created.
5. User wallet balance is never modified.

### 3.2 Combinatorial Settlement State Matrix

The following table documents all payment states, settlement artifacts, and the hardened system behavior:

| Payment Status | `walletCredited` | Transaction Exists | `creditedPayments` Marker | Action Taken | Wallet Mutation | Post-State | Rationale |
| :---: | :---: | :---: | :---: | :--- | :---: | :---: | :--- |
| **`FAILED`** | `false` | `false` | `false` | Rejected with `INVALID_PAYMENT_STATUS` (400) | None (0) | `FAILED` | Failed payments must never be settled or credited. |
| **`FAILED`** | `true` or `false` | `true` | Any | Rejected with `CONTRADICTORY_PAYMENT_STATE` (409) | None (0) | `FAILED` | Audit alert: Contradictory state. Blocked for investigation. |
| **`CAPTURED`** | `true` | `true` | Present | Returns idempotent success (`alreadyPaid: true`) | None (0) | `CAPTURED` | Normal replayed callback / duplicate webhook. |
| **`CAPTURED`** | `false` (Legacy) | `true` | Absent | Disambiguated as settled; backfills marker | None (0) | `CAPTURED` | Legacy write ordering: `User.updateOne` committed before `Transaction.create`. |
| **`PENDING`** | `false` | `false` | Present | Interrupted crash after Step 5; creates Transaction | None (0) | `CAPTURED` | Balance was incremented before crash; Transaction was missing. |
| **`PENDING`** | `false` | `false` | Absent | Normal initial settlement; acquires lease, updates atomic `$ne` | +Amount | `CAPTURED` | Happy path settlement. |
| **`REQUIRES_RECONCILIATION`** | `false` | `false` | Absent | Reconciled via `reconcileWalletPayment` | +Amount | `CAPTURED` | Quarantined payment safely recovered. |

### 3.3 Atomic `$ne` Idempotency Marker & Ambiguous Driver Timeouts

In `settleWalletTopup`, balance mutation is coupled with marker recording in a single MongoDB document update:
```javascript
const creditResult = await UserModel.updateOne(
  {
    _id: payment.userId,
    creditedPayments: { $ne: paymentIdStr },
  },
  {
    $inc: { amount: creditedRupees },
    $addToSet: { creditedPayments: paymentIdStr },
  }
);
```

If a network reset or socket timeout occurs during `updateOne`:
1. The service executes an authoritative re-read of `UserModel.findById(payment.userId)`.
2. If `creditedPayments.includes(paymentIdStr)` is true: the write committed before the network disconnect. The timeout is disambiguated; balance is **not** re-incremented.
3. If marker is absent: the write did not commit. The error is re-thrown, keeping the payment safely quarantined in `REQUIRES_RECONCILIATION` for reconciliation retry.

---

## 4. Objective 3 — Regression Verification Evidence

### 4.1 Specialized Section 16 Test Suite

Section 16 in `server/tests/unit/stage4_wallet_payment.test.js` was updated and expanded to cover all Stage 4.9 requirements:

1. **`actionable error when Razorpay credentials are not configured without secret exposure`**:
   Verifies 503 `GATEWAY_NOT_CONFIGURED` with structured missing list and no secret leaks.
2. **`canonical backend configuration: strictly requires RAZORPAY_KEY_ID and rejects VITE_RAZORPAY_API_KEY fallback`**:
   Verifies that having `VITE_RAZORPAY_API_KEY` present in the server environment does not satisfy backend `RAZORPAY_KEY_ID`.
3. **`missing key ID independently: fails with actionable error reporting RAZORPAY_KEY_ID missing`**:
   Tests missing Key ID when Key Secret is present.
4. **`missing key secret independently: fails with actionable error reporting RAZORPAY_KEY_SECRET missing`**:
   Tests missing Key Secret when Key ID is present.
5. **`backend configuration: builds authenticated Basic Auth request when all required keys are present`**:
   Verifies that with canonical keys configured, HTTP Basic Auth header `Basic <base64(key_id:key_secret)>` is built and sent to Razorpay API.
6. **`process environment variables take precedence over dotenv file values`**:
   Verifies standard non-overwriting behavior where process-injected variables take precedence over `.env` file entries.
7. **`working directory invariance: server .env and root .env resolve identically regardless of process.cwd()`**:
   Verifies that directory navigation between repo root and server directory produces identical resolved file targets.
8. **`frontend configuration isolation: public checkout config never exposes backend secrets`**:
   Verifies that public endpoint responses, `client/.env.example`, and `render.yaml` client service never leak backend secrets.
9. **`order creation fails safely without credentials: never creates Payment, Transaction, or credits wallet`**:
   Verifies zero database mutations when gateway credentials are unconfigured.
10. **`contradictory state protection: FAILED payment with existing Transaction is blocked with CONTRADICTORY_PAYMENT_STATE`**:
    Verifies 409 rejection and audit preservation.
11. **`contradictory state protection: FAILED payment directly called in settleWalletTopup is rejected without balance mutation`**:
    Verifies rejection of direct settlement on failed payments.
12. **`legacy state protection: historical CAPTURED payment with Transaction and missing marker is recognized as settled and never double-credited`**:
    Verifies legacy settlement disambiguation.
13. **`marker present but transaction missing: safely creates Transaction and finalizes to CAPTURED without balance increment`**:
    Verifies crash recovery between Step 5 and Step 6.

### 4.2 Test Suite Execution Metrics

#### Test Suite 1: Wallet Payment Architecture & Section 16 Hardening
- **Command:** `npm test -- tests/unit/stage4_wallet_payment.test.js`
- **Working Directory:** `<repo>/server`
- **Exit Code:** `0`
- **Result:** **59 passed, 59 total (100% pass rate)**
- **Duration:** 23.654 s

#### Test Suite 2: Auction Payment Settlement Architecture
- **Command:** `npm test -- tests/unit/stage4_payment_settlement.test.js`
- **Working Directory:** `<repo>/server`
- **Exit Code:** `0`
- **Result:** **33 passed, 33 total (100% pass rate)**
- **Duration:** 12.83 s

#### Test Suite 3: Full Backend Test Suite
- **Command:** `npm test -- --runInBand`
- **Working Directory:** `<repo>/server`
- **Exit Code:** `0`
- **Result:** **42 test suites passed, 42 total; 398 tests passed, 398 total (100% pass rate)**
- **Skipped / Failed:** 0
- **Duration:** 100.458 s

---

## 5. Final Repository State & Git Diff

### 5.1 Modified Files Summary

| File | Change Type | Purpose |
| :--- | :---: | :--- |
| `server/services/paymentService.js` | Modified | Removed `VITE_RAZORPAY_API_KEY` fallback on line 59; canonical `RAZORPAY_KEY_ID` enforcement. |
| `server/server.js` | Modified | Documented and hardened deterministic dotenv loading order with process precedence and CWD invariance. |
| `server/.env.example` | Modified | Removed `VITE_RAZORPAY_API_KEY` from backend example; documented canonical variables. |
| `.env.example` | Added | Root monorepo template documenting backend secrets and frontend public keys with non-secret placeholders. |
| `server/tests/unit/stage4_wallet_payment.test.js` | Modified | Added Stage 4.9 regression tests covering canonical config, process precedence, CWD invariance, and secret containment. |

### 5.2 Preservation of Pre-Existing State
Every pre-existing tracked, unstaged, staged, and untracked file across the repository (including client components, recommendation service files, docker compose templates, and earlier audit documents) was fully preserved. No files were reset, stashed, cleaned, or discarded.

---

## 6. Remaining Limitations & Operational Guidance

1. **Production Deployment Configuration:**
   - In production platforms (Render, AWS, GCP, Docker Swarm), inject `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` via platform environment settings.
   - For Render: add them under `auctionx-server` environment variables (`sync: false`). Never add them to `auctionx-client`.
2. **Local Development Setup:**
   - Copy `.env.example` to `.env` in root or `server/.env.example` to `server/.env`.
   - Populate `RAZORPAY_KEY_ID=rzp_test_...` and `RAZORPAY_KEY_SECRET=...` with valid Razorpay test keys from the Razorpay dashboard.
3. **Webhook Endpoint Security:**
   - In production, configure Razorpay Dashboard to send webhooks to `https://<domain>/api/payment/webhook`.
   - Set the identical webhook secret in `RAZORPAY_WEBHOOK_SECRET` for HMAC-SHA256 signature verification.

---

## 7. Formal Verdicts

- **Razorpay Configuration Hardening:** **`PASS`**  
- **Wallet Settlement Correctness:** **`PASS`**  

All requirements of Stage 4.9 have been implemented, mathematically verified, and validated against the full 42-suite regression test suite.
