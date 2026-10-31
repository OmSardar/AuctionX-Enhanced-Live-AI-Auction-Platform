# AuctionX — Stage 7.2: Public Release Blocker Verification Audit

> **Document Version:** 1.0.0  
> **Audit Date:** October 18, 2026  
> **Auditor:** DeepMind Agentic Security & Architecture Pair  
> **Target Repository:** AuctionX Monorepo  
> **Preceding Audit:** [Stage 7.1: Gitleaks CI Enforcement and Baseline Integrity Audit](Audit-051-Gitleaks-Baseline-And-CI-Enforcement.md)  
> **Audit Status:** Complete — Read-Only Evidence Gathering  
> **Overall Release Gate Status:** **BLOCKED** (3 of 3 Gates require owner decisions or infrastructure verification)

---

## 1. Executive Summary

Following the successful completion and verification of the Stage 7.1 Gitleaks secret-scanning CI gate, this audit conducts a rigorous, evidence-based verification of the three remaining public-release blockers for AuctionX:

1. **Production Frontend / API Domain and Cookie Compatibility**
2. **Root Open-Source License Selection and Manifest Consistency**
3. **Production MongoDB Topology and Transaction Support**

### Primary Audit Findings:

- **Gate 1 (Domains & Cookies — BLOCKED):** The repository does not define a production reverse proxy for `/api` (`client/nginx.conf` serves static assets only; `compose.prod.yaml` publishes split ports). The client build strictly enforces a non-empty `VITE_API_URL` build argument ([`client/Dockerfile:45-51`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/Dockerfile#L45-L51)). Authentication and CSRF cookies are configured in production with `SameSite=None; Secure` but lack an explicit `domain` attribute (host-only to the API origin). While compatible with same-site subdomains (e.g. `app.auctionx.com` and `api.auctionx.com`), this topology fails under default cloud provider subdomains (e.g. `*.onrender.com`), where public suffix rules cause modern browsers (Safari ITP, Firefox, Chrome) to treat the requests as cross-site third-party, blocking the `_csrf` cookie and immediately failing the strict double-submit CSRF check ([`server/middleware/Security/csrfMiddleware.js:72-80`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/middleware/Security/csrfMiddleware.js#L72-L80)).
- **Gate 2 (License Selection — BLOCKED):** The root [`LICENSE`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/LICENSE) file remains **untracked** (`?? LICENSE`) and contains an unconfirmed MIT License template. A significant manifest contradiction exists: [`server/package.json:26-27`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/package.json#L26-L27) declares `"license": "ISC"` and `"author": "Invincibles"`, [`client/package.json:3`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/package.json#L3) declares `"private": true`, and [`README.md:3, 253-255`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/README.md#L3) displays an MIT badge and claims MIT licensing. Formal owner selection and copyright attribution are required before publication.
- **Gate 3 (MongoDB Topology & Transactions — UNKNOWN / BLOCKED):** Local Docker Compose configurations ([`compose.yaml:7-20`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/compose.yaml#L7-L20) and [`compose.prod.yaml:7-20`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/compose.prod.yaml#L7-L20)) provision MongoDB in **standalone mode without replica-set support**. In [`server/services/bidService.js:441-625`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/services/bidService.js#L441-L625), the application contains an advanced **Dual Consistency Architecture**: on replica sets (Atlas), it executes multi-document ACID transactions with transactional outbox queuing; on standalone nodes, it safely degrades to a durable ledger-first protocol. In contrast, [`server/services/paymentService.js:460-720`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/services/paymentService.js#L460-L720) does not use transactions, relying instead on single-document atomic CAS updates and background reconciliation. The actual production MongoDB cluster topology cannot be verified locally because live connection strings are external secrets.

---

## 2. Release Decision Matrix

| Gate | Evidence Found | Status | Owner Input or Verification Required |
| :--- | :--- | :---: | :--- |
| **Domain & Cookie Compatibility** | • `client/src/redux/slices/axiosWithAuth.jsx` builds `baseURL` via `VITE_API_URL`.<br/>• `client/Dockerfile` mandates non-empty `VITE_API_URL` in production static builds.<br/>• `client/nginx.conf` has no `/api` reverse proxy block.<br/>• `server/server.js` restricts CORS to `CLIENT_URL` and `ALLOWED_ORIGINS`.<br/>• `csrfMiddleware.js` and `UserLoginController.js` omit `domain` (host-only) and set `SameSite=None; Secure` in production.<br/>• `csrfMiddleware.js` strictly rejects requests lacking `_csrf` cookie.<br/>• On PSL domains (`*.onrender.com`), browsers block 3P cookies, breaking CSRF & session auth. | **BLOCKED** | **Required Owner Decisions:**<br/>1. Supply canonical public frontend URL and backend API URL.<br/>2. Decide whether to use same-site subdomains (e.g. `app.auctionx.com` / `api.auctionx.com`) or deploy a unified-domain reverse proxy (`auctionx.com` / `auctionx.com/api`).<br/>3. Execute deployed browser tests in Safari (ITP enabled) and Chrome. |
| **License Selection** | • Root `LICENSE` is untracked (`?? LICENSE`) with MIT template text.<br/>• `README.md` displays MIT badge and claims MIT license.<br/>• `server/package.json` specifies `"license": "ISC"` and `"author": "Invincibles"`.<br/>• `client/package.json` specifies `"private": true`.<br/>• `recommendation_service/pyproject.toml` omits license. | **BLOCKED** | **Required Owner Decisions:**<br/>1. Explicitly select open-source license (MIT, ISC, Apache 2.0, or proprietary).<br/>2. Authorize canonical copyright holder entity ("Om Sardar", "Invincibles", or organization).<br/>3. Authorize tracking and staging of the finalized root `LICENSE` and align `package.json` manifests. |
| **MongoDB Transaction Support** | • `server/services/bidService.js` detects topology via `isReplicaSetTopology()`.<br/>• Branch A executes `session.withTransaction` for atomic bid placement and outbox queuing.<br/>• Branch B executes Durable Ledger-First Protocol on standalone MongoDB.<br/>• `server/services/paymentService.js` does not use transactions; relies on single-document CAS and background reconciliation.<br/>• `compose.yaml` and `compose.prod.yaml` provision standalone MongoDB without `--replSet`.<br/>• Production MongoDB Atlas cluster topology is documented as intention but unverified locally. | **UNKNOWN** | **Required Owner Verifications:**<br/>1. Confirm production MongoDB instance is a verified replica set (e.g., MongoDB Atlas M0/M2+ cluster or 3-node standalone replica set).<br/>2. Verify connection string provides `retryWrites=true&w=majority`.<br/>3. Confirm whether local Docker Compose should be upgraded to provision a single-node replica set for dev/test consistency. |

---

## 3. Phase 1 — Production Domain and Cookie Compatibility

### 3.1 Frontend API URL Construction
In [`client/src/redux/slices/axiosWithAuth.jsx:5-36`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/redux/slices/axiosWithAuth.jsx#L5-L36):
```javascript
const API_URL = import.meta.env.VITE_API_URL || "";
...
const axiosWithAuth = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : "/api",
  withCredentials: true,
});
```
Similarly, [`client/src/redux/slices/csrfSecuritySlice.jsx:10-13`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/redux/slices/csrfSecuritySlice.jsx#L10-L13) constructs the endpoint:
```javascript
const endpoint = API_URL ? `${API_URL}/api/csrf-token` : "/api/csrf-token";
const response = await axios.get(endpoint, { withCredentials: true });
```
In [`client/Dockerfile:45-51`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/Dockerfile#L45-L51), the build stage actively prohibits an empty `VITE_API_URL`:
```dockerfile
ARG VITE_API_URL
RUN trimmed="$(printf '%s' "$VITE_API_URL" | tr -d '[:space:]')"; \
    if [ -z "$trimmed" ]; then \
      echo "FATAL: VITE_API_URL build argument is required and cannot be empty for production build." >&2; \
      exit 1; \
    fi
```
Consequently, the production static bundle cannot be compiled without an explicit, non-empty `VITE_API_URL`.

### 3.2 Reverse Proxy Configuration
- **Nginx (`client/nginx.conf`)**: Contains **no reverse proxy block**. It listens on port 80, enables gzip compression, serves `/usr/share/nginx/html`, and redirects all non-file paths to `/index.html` for client-side routing:
  ```nginx
  location / {
      try_files $uri $uri/ /index.html;
  }
  ```
- **Docker Compose (`compose.prod.yaml`)**: The `client` service publishes port `3000:80` and the `server` service publishes port `5000:5000`. No gateway reverse proxy (such as an Nginx reverse proxy or Traefik container) routes traffic between them.
- **Render Specification (`render.yaml:48-60`)**: The client is declared as a `runtime: static` site with rewrite rule `/* -> /index.html`. It has no route proxying `/api/*` to the `auctionx-server` web service.
- **Development Vite Proxy (`client/vite.config.js:16-26`)**: Defines a proxy for `/api` only when running the Vite development server (`npm run dev`). This dev server proxy is not included in production static bundles.

### 3.3 Backend CORS Configuration
In [`server/server.js:37-58, 216-229`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/server.js#L37-L58):
```javascript
const configuredOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : [];

const allowedOrigins = [
  ...configuredOrigins,
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "x-csrf-token",
      "X-CSRF-Token",
      "Authorization",
    ],
    credentials: true,
    origin: allowedOrigins,
  })
);
```
- Allowed origins are restricted strictly to `CLIENT_URL` and items in `ALLOWED_ORIGINS`.
- If neither variable is configured in the production environment, `allowedOrigins` evaluates to `[]`, causing the CORS middleware to reject cross-origin requests from the frontend.

### 3.4 Cookie Configuration and Cross-Origin Behavior
1. **Authentication Token Cookie (`token`)**:
   - Location: [`server/controllers/LoginControllers/UserLoginController/UserLoginController.js:66-72, 131-137`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/LoginControllers/UserLoginController/UserLoginController.js#L66-L72)
   - Attributes:
     - `httpOnly: true`
     - `secure: isProduction` (`true` when `NODE_ENV=production`)
     - `sameSite: isProduction ? "None" : "Lax"` (`"None"` in production)
     - `maxAge: 86400000` (24 hours)
     - `domain`: Omitted (defaults to host-only for the API domain)
2. **CSRF Token Cookie (`_csrf` and `XSRF-TOKEN`)**:
   - Location: [`server/middleware/Security/csrfMiddleware.js:110-125`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/middleware/Security/csrfMiddleware.js#L110-L125)
   - Attributes:
     - `httpOnly: false` (client-readable by design for Angular/Axios auto-detection)
     - `secure: isProduction` (`true` when `NODE_ENV=production`)
     - `sameSite: isProduction ? "none" : "lax"` (`"none"` in production)
     - `maxAge: 3600000` (1 hour)
     - `domain`: Omitted (defaults to host-only for the API domain)
3. **CSRF Enforcement Validation**:
   - Location: [`server/middleware/Security/csrfMiddleware.js:72-80`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/middleware/Security/csrfMiddleware.js#L72-L80)
   - On all mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`), the server executes:
     ```javascript
     const cookieToken = req.cookies[CSRF_COOKIE_NAME];
     const headerToken = req.headers[CSRF_HEADER_NAME];

     if (!cookieToken || !headerToken) {
       return res.status(403).json({
         success: false,
         message: "CSRF token missing",
       });
     }
     ```
   - If the browser does not transmit `_csrf` in the `Cookie` header, the request is rejected with HTTP 403 Forbidden.

### 3.5 Cookie and Domain Compatibility Analysis
- **Same-Site Subdomains (`app.auctionx.com` and `api.auctionx.com`)**:
  - Both origins share the exact same effective Top-Level Domain plus one label (`eTLD+1`: `auctionx.com`).
  - In modern browsers, requests between these origins are treated as **same-site**.
  - Cookies set with `SameSite=None; Secure` are accepted and sent across same-site subdomains when `withCredentials: true` is configured.
  - Because `domain` is omitted, cookies are host-only to `api.auctionx.com`. When Axios sends requests to `api.auctionx.com`, the browser attaches the host-only cookies.
  - While JavaScript executing on `app.auctionx.com` cannot read `document.cookie` from `api.auctionx.com`, `csrfSecuritySlice.jsx` receives the CSRF token in the JSON response payload (`res.json({ csrfToken })`) and stores it in Redux, which `axiosWithAuth.jsx` attaches as the `x-csrf-token` header. This configuration is mutually compatible.
- **Cross-Site Platform Subdomains (`auctionx-client.onrender.com` and `auctionx-server.onrender.com`)**:
  - `onrender.com` is listed in the [Public Suffix List (PSL)](https://publicsuffix.org/).
  - Therefore, `auctionx-client.onrender.com` and `auctionx-server.onrender.com` have distinct `eTLD+1` roots and are treated by browsers as **separate sites (cross-site)**.
  - Modern browser privacy protections (Apple Safari Intelligent Tracking Prevention [ITP], Firefox Enhanced Tracking Protection [ETP], and Google Chrome third-party cookie restrictions) **block or partition third-party cookies** on cross-site fetch calls.
  - Under these conditions, the browser will not transmit `req.cookies._csrf`. Mutating requests will fail with HTTP 403 "CSRF token missing".
- **Reverse Proxy Topology (Unified Origin `auctionx.com` / `auctionx.com/api`)**:
  - If an edge reverse proxy (such as Cloudflare, AWS CloudFront, or an Nginx ingress) routes all requests under a single domain (`https://auctionx.com/` for client, `https://auctionx.com/api` for server), all requests become same-origin.
  - Third-party cookie restrictions are completely eliminated.
  - However, [`client/Dockerfile:45-51`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/Dockerfile#L45-L51) currently fails during build if `VITE_API_URL` is empty, which would need adjustment if an empty URL is used to target same-origin `/api`.

### 3.6 Production Environment Variable Status

| Variable Name | Subsystem | Configured in Repo Templates? | Verified in Production? | Classification |
| :--- | :--- | :---: | :---: | :--- |
| `CLIENT_URL` | Server | Example (`http://localhost:5173`) | **Unverified** | Owner-supplied origin |
| `VITE_API_URL` | Client | Example (`http://localhost:5000`) | **Unverified** | Owner-supplied URL |
| `ALLOWED_ORIGINS` | Server | Unset / Optional | **Unverified** | Owner-supplied list |
| `JWT_SECRET` | Server | Dev example (insecure string) | **Unverified** | Critical Secret |
| `RAZORPAY_KEY_ID` | Server | Test placeholder (`rzp_test_...`) | **Unverified** | Public Provider ID |
| `RAZORPAY_KEY_SECRET` | Server | Placeholder | **Unverified** | Critical Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Server | Placeholder | **Unverified** | Critical Secret |
| `VITE_RAZORPAY_API_KEY` | Client | Test placeholder (`rzp_test_...`) | **Unverified** | Public Provider ID |

### 3.7 Owner-Input Checklist: Domains & Reverse Proxy
Before authorizing deployment:
1. [ ] Confirm the exact production frontend public URL (e.g., `https://app.auctionx.com`).
2. [ ] Confirm the exact production API public URL (e.g., `https://api.auctionx.com`).
3. [ ] Confirm the deployment topology:
   - **Option A (Recommended):** Same-site subdomains on a shared custom root domain (`app.auctionx.com` and `api.auctionx.com`).
   - **Option B (Alternative):** Unified origin with an external reverse proxy (e.g. Cloudflare) mapping `/api/*` to the backend.
   - **Disallowed:** Split platform domains (`*.onrender.com` or `*.vercel.app` + `*.railway.app`) without custom domains.
4. [ ] **Deployed Browser Testing Requirement:** Perform end-to-end verification in:
   - Apple Safari on macOS and iOS (verifying ITP does not drop `token` or `_csrf`).
   - Google Chrome with "Block third-party cookies" enabled.
   - Verify that login, CSRF token retrieval, auction bid placement, and Razorpay modal initialization succeed with credentials transmitted.

---

## 4. Phase 2 — License Decision and Repository State

### 4.1 Root LICENSE Git State
- Path: [`LICENSE`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/LICENSE)
- Git Tracking Status: **Untracked** (`?? LICENSE` in `git status --short`).
- `git ls-files LICENSE` returns empty. The file has never been staged or committed to repository history.

### 4.2 Content of Root LICENSE File
The untracked root `LICENSE` file contains standard MIT License text:
```text
MIT License

Copyright (c) 2026 Om Sardar and AuctionX Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
...
```

### 4.3 Documentation & Manifest Contradictions
1. **README.md Claims**:
   - [`README.md:3`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/README.md#L3): Displays `[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)`
   - [`README.md:253-255`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/README.md#L253-L255): Claims `This project is licensed under the [MIT License](LICENSE).`
2. **Backend Manifest (`server/package.json`)**:
   - [`server/package.json:26-27`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/package.json#L26-L27):
     ```json
     "author": "Invincibles",
     "license": "ISC",
     ```
   - Contradicts the MIT claim in `README.md` and attributes the author to "Invincibles" rather than "Om Sardar and AuctionX Contributors".
3. **Frontend Manifest (`client/package.json`)**:
   - [`client/package.json:3`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/package.json#L3):
     ```json
     "private": true,
     ```
   - Marks the client package as strictly private.
4. **Recommendation Microservice Manifest (`recommendation_service/pyproject.toml`)**:
   - [`recommendation_service/pyproject.toml:1-14`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/recommendation_service/pyproject.toml#L1-L14):
     Omits license metadata entirely.

### 4.4 Owner Decision Checklist: Licensing
The project cannot be released publicly until the project owner resolves the following:
1. [ ] **Select Primary License:** Confirm whether AuctionX is released under MIT, ISC, Apache-2.0, or a proprietary / all-rights-reserved license.
2. [ ] **Authoritative Copyright Entity:** Confirm the exact legal name(s) for the copyright header (e.g. `Om Sardar`, `Invincibles`, or `AuctionX Authors`).
3. [ ] **Manifest Alignment:** Update `server/package.json`, `client/package.json`, and `recommendation_service/pyproject.toml` to accurately reflect the owner's license choice.
4. [ ] **Stage & Commit:** Track and commit the verified `LICENSE` file into Git history.

---

## 5. Phase 3 — MongoDB Topology and Transaction Requirements

### 5.1 Transaction-Sensitive Code Paths
1. **Authoritative Bidding (`server/services/bidService.js`)**:
   - Updating auction product current price, bid count, extension deadline, and version counter (`__v`).
   - Inserting an accepted bid record into the `bids` collection.
   - Updating `Product.lastBidId` with the winning bid identifier.
   - Enqueueing an authoritative interaction record into `RecommendationOutbox`.
2. **Order Settlement (`server/services/paymentService.js`)**:
   - Transitioning `Order` from `PENDING` to `PAID`.
   - Transitioning `Product` from `ENDED` to `SETTLED`.
   - Transitioning `Payment` to `CAPTURED`.
   - Enqueueing authoritative purchase telemetry into `RecommendationOutbox`.
3. **Outbox Event Sweeper (`server/services/recommendationTrackingService.js`)**:
   - Reading `RecommendationOutbox` events with status `PENDING`.
   - Dispatching events via HTTP to `recommendation-service:8000/api/track`.
   - Marking outbox events as `PROCESSED` or scheduling retries with exponential backoff.

### 5.2 Dual Consistency Architecture in Bidding
In [`server/services/bidService.js:32-43`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/services/bidService.js#L32-L43):
```javascript
function isReplicaSetTopology() {
  try {
    const client = mongoose.connection.client;
    const topologyType = client?.topology?.description?.type;
    return (
      topologyType === "ReplicaSetWithPrimary" ||
      topologyType === "Sharded"
    );
  } catch {
    return false;
  }
}
```
The bidding engine checks this topology predicate before executing database operations:

- **Branch A — Replica-Set Topology (ACID Transaction)**:
  - Invoked when connected to a replica set or sharded cluster.
  - Opens a Mongoose session: `session = await mongoose.startSession()`.
  - Wraps the entire sequence in `session.withTransaction(...)`:
    1. Atomic CAS `Product.findOneAndUpdate` with `{ session, new: true }`.
    2. `Bid.create([...], { session })`.
    3. Direct link `Product.updateOne({ _id: productId }, { $set: { lastBidId } }, { session })`.
    4. Outbox enqueue: `enqueueAuthoritativeEvent(..., { session })`.
  - Invariant: If any step fails or an `OUTBID` condition occurs, all writes roll back atomically.
- **Branch B — Standalone Topology (Durable Ledger-First Protocol)**:
  - Invoked when connected to a standalone MongoDB node (e.g. local development or Docker Compose).
  - Step 1: Creates durable `Bid` record with `status: "PENDING"`. Handles duplicate `idempotencyKey` collisions (`E11000`).
  - Step 2: Executes single-document atomic CAS `Product.findOneAndUpdate(...)`.
  - Step 3: Evaluates outcome:
    - If CAS update returns `null` (outbid / condition failed): updates `Bid` to `status: "REJECTED"` and throws 409 `BID_OUTBID`. `Product` was never altered.
    - If CAS update succeeds: updates `Bid` to `status: "ACCEPTED"`.
  - Step 4: Dispatches recommendation telemetry non-blockingly outside a transaction.

### 5.3 Payment Settlement Correctness & Atomicity
In [`server/services/paymentService.js:608-695`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/services/paymentService.js#L608-L695):
- Settlement is **not executed within a multi-document transaction**, even when connected to a replica set.
- Instead, it uses sequenced single-document atomic operations:
  1. `Order.findOneAndUpdate({ _id: order._id, status: "PENDING" }, { $set: { status: "PAID" } })`
  2. `Product.findOneAndUpdate({ _id: order.productId, status: { $in: ["ENDED", "LIVE", "Active"] } }, { $set: { status: "SETTLED" } })`
  3. `Payment.findOneAndUpdate(paymentFilter, { $set: { status: "CAPTURED" } })`
  4. `enqueueAuthoritativeEvent({ ... })` outside a transaction.
- **Self-Healing & Convergence Mechanisms**:
  - If a duplicate or racing webhook arrives, [`paymentService.js:477-503`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/services/paymentService.js#L477-L503) detects `order.status === "PAID"` and executes a self-healing write ensuring `Product` is `SETTLED` and `Payment` is `CAPTURED`.
  - Background reconciliation worker in [`paymentService.js:1941-1950`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/services/paymentService.js#L1941-L1950) (`reconcilePaymentStates`) scans for paid orders and heals un-settled products.
- **Residual Correctness Risk**:
  - If the server process crashes between `Order -> PAID` and `Product -> SETTLED`, state is temporarily inconsistent until the periodic reconciliation worker runs.
  - If the server crashes before `enqueueAuthoritativeEvent` or the outbox write fails, the purchase telemetry signal is permanently dropped.

### 5.4 Docker Compose vs Production Topology
- **Local Compose (`compose.yaml:7-20`)**:
  ```yaml
  mongodb:
    image: mongo:7.0
    container_name: auctionx-mongodb
    restart: unless-stopped
    ports:
      - "${MONGO_PORT:-27017}:27017"
  ```
  Runs a **standalone** MongoDB instance without `--replSet`.
- **Production Compose (`compose.prod.yaml:7-20`)**:
  ```yaml
  mongodb:
    image: mongo:7.0
    container_name: auctionx-mongodb-prod
    restart: always
  ```
  Also runs a **standalone** MongoDB instance without `--replSet`.
- **Production Environment (`render.yaml:18-19`)**:
  `MONGODB_URL` is configured with `sync: false`. The documentation references MongoDB Atlas (`staging-deployment-runbook.md`), which defaults to replica sets, but the active repository has no automated check verifying that the target database connection supports transactions.

---

## 6. Smallest Safe Follow-Up Tasks & Risks

### Task 1: License Formalization (Lowest Risk)
- **Action**: Obtain owner confirmation on license selection. Update `server/package.json` and `client/package.json` to match root `LICENSE`. Track and stage `LICENSE`.
- **Risk**: Zero operational or runtime risk.

### Task 2: Domain and Build Configuration (Low Risk)
- **Action**: Record confirmed production URLs (`CLIENT_URL`, `VITE_API_URL`, `ALLOWED_ORIGINS`). If a same-origin reverse proxy is chosen, update `client/Dockerfile` to allow empty `VITE_API_URL` for same-origin routing (`/api`).
- **Risk**: Low; build-time and config-time validation.

### Task 3: MongoDB Single-Node Replica Set for Compose (Low/Medium Risk)
- **Action**: In `compose.yaml` and `compose.prod.yaml`, add `--replSet rs0` to the MongoDB command and an initialization healthcheck/script (`rs.initiate()`).
- **Risk**: Low; enables Branch A multi-document transactions in local development and staging Compose without requiring Atlas.

---

## 7. Final Audit Conclusion

AuctionX displays mature defensive architecture:
1. Bid concurrency is protected on standalone nodes via the Durable Ledger-First Protocol and on replica sets via multi-document ACID transactions.
2. Payment settlement is resilient to webhooks and duplicate charges via lease fencing, paise precision, and self-healing reconciliation.
3. Secret scanning is enforced in CI via Gitleaks v8.30.1.

However, **public release is BLOCKED** until the project owner provides authoritative input on:
1. Public deployment domains and reverse-proxy topology.
2. Open-source license selection and repository manifest alignment.
3. Verification of MongoDB replica-set topology in the target production environment.
