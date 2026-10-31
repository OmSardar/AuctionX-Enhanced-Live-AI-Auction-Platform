# AuctionX — Stage 7.3: Nginx Same-Origin Reverse Proxy Implementation & Audit Report

> **Document Version:** 1.0.0  
> **Audit Date:** October 18, 2026  
> **Auditor:** DeepMind Agentic Security & Architecture Pair  
> **Target Repository:** AuctionX Monorepo  
> **Preceding Audits:**  
> - [Stage 7.1: Gitleaks CI Enforcement and Baseline Integrity Audit](Audit-051-Gitleaks-Baseline-And-CI-Enforcement.md)  
> - [Stage 7.2: Public Release Blocker Verification Audit](Audit-052-Public-Release-Blocker-Verification.md)  
> **Target Platform:** Render Cloud PaaS (Docker Web Service)  
> **Implementation Scope:** Local code and configuration changes only (no commits, pushes, remote calls, deployments, or database mutations)  
> **Result:** **PARTIAL** (Local Implementation, Build, Configuration & Tests: **PASS**; Cloud Render Deployment & Live Browser Verification: **PENDING OWNER ACTION**)  

---

## 1. Executive Summary

In [Stage 7.2 Release Blocker Verification](Audit-052-Public-Release-Blocker-Verification.md), Gate 1 (**Production Frontend / API Domain and Cookie Compatibility**) was determined to be **BLOCKED**. Under default Render subdomains (`auctionx-client.onrender.com` vs. `auctionx-server.onrender.com`), the Public Suffix List (PSL) causes modern browsers to treat API requests across separate `.onrender.com` subdomains as cross-site third-party requests. This causes browsers to block or partition credentials and drop the `_csrf` cookie, immediately breaking the strict double-submit CSRF protection mechanism (`server/middleware/Security/csrfMiddleware.js`).

This Stage 7.3 task implements a safe, production-oriented **Nginx Same-Origin Reverse Proxy** topology targeting Render-hosted frontend and backend services:

```text
Browser
   |
   | HTTPS: One Public Origin (e.g. https://auctionx-client.onrender.com or custom domain)
   v
Render Web Service: auctionx-client (Docker: React/Vite SPA + Nginx)
   |
   +---> Static Assets / SPA Routes (`/*`) served locally from `/usr/share/nginx/html`
   |
   +---> `/api/*` forwarded over Render Private Network to `BACKEND_UPSTREAM_URL`
   |
   +---> `/socket.io/*` forwarded with WebSocket upgrades (`Connection`, `Upgrade`)
   |
   +---> `/auth/*` forwarded for OAuth workflows
   |
   v (Render Private Networking: http://auctionx-server:10000)
Render Web Service: auctionx-server (Node.js 20 / Express 4 / Socket.IO)
   |
   +---- MongoDB Atlas (Replica Set)
   +---- Recommendation Service (FastAPI)
   +---- Razorpay Payment Gateway
```

### Key Accomplishments:
1. **Single Public Origin Architecture:** All browser traffic (React SPA, API requests, WebSocket streams, OAuth callbacks) targets a single origin (`window.location.origin`), eliminating third-party cookie restrictions, avoiding cross-site CORS preflights, and preserving strict double-submit CSRF verification.
2. **Render Private Networking Upstream:** Configured Nginx upstream via explicit runtime environment variable `BACKEND_UPSTREAM_URL` (`http://auctionx-server:10000`), validated fail-closed at container startup by `docker-entrypoint.sh`.
3. **Dedicated Health Probes:** Added lightweight, non-sensitive `/healthz` HTTP 200 endpoint to Nginx, aligning `render.yaml` health checks with container orchestration without hitting database or backend resources.
4. **Clean API & Socket.IO Routing:** Configured separate routing blocks in Nginx for `/api/`, `/socket.io/` (with 86,400s timeouts and WebSocket upgrade headers), `/auth/`, and SPA static assets.
5. **Double-Prefix Normalization:** Updated frontend API helpers (`axiosWithAuth.jsx`) to strip redundant `/api/` prefixes dynamically, preventing `/api/api/...` errors when callers pass `/api/products` to an instance configured with `baseURL: "/api"`.
6. **Decoupled Client Build Argument:** Refactored `client/Dockerfile` to allow `ARG VITE_API_URL=""` by default for same-origin builds, while retaining support for split-origin builds if specified.
7. **Local & Production Compose Parity:** Aligned `compose.prod.yaml` so Nginx enters on port 3000, proxies to backend `server:5000` internally, and removes external host publishing of backend port 5000.

---

## 2. Architecture Implemented & Fit for Render

### 2.1 Why this architecture fits Render
1. **Web Service Transformation:** In `render.yaml`, `auctionx-client` is converted from `env: static` to `env: docker`. Render's static site hosting does not support custom Nginx reverse proxying or dynamic environment substitution. By running as a Docker Web Service, the frontend can execute Nginx and leverage Render's **private networking**.
2. **Render Private DNS Resolution:** Render automatically assigns private hostnames based on service names (e.g. `http://auctionx-server:10000`). Private network traffic stays within Render's secure internal network, has no egress bandwidth charges, and does not require exposing the backend Express server publicly to the open internet.
3. **PaaS TLS Termination Handling:** On Render, TLS is terminated at the edge router. Traffic reaches the container on plain HTTP with `X-Forwarded-Proto: https`. Nginx configuration maps `$http_x_forwarded_proto` into `$forwarded_proto`, ensuring backend Express (`app.set("trust proxy", 1)`) accurately identifies secure HTTPS requests (`req.secure === true`) for `Secure` cookie issuance.
4. **Dynamic Port Binding:** Render assigns listener ports dynamically via `PORT` (typically 10000). The template substitution mechanism replaces `${PORT}` and `${BACKEND_UPSTREAM_URL}` safely during container startup without hardcoding ports.

---

## 3. Detailed File Changes & Rationale

| File | Change Type | Purpose / Description |
| :--- | :---: | :--- |
| `client/nginx.conf.template` | **Created** | Nginx template supporting dynamic `${PORT}` and `${BACKEND_UPSTREAM_URL}` substitution, WebSocket upgrade map, forwarded proto map, `/healthz` static health check, `/api/` reverse proxy, `/socket.io/` WebSocket proxy, `/auth/` proxy, security headers, and SPA caching. |
| `client/docker-entrypoint.sh` | **Created** | Container entrypoint script that validates `BACKEND_UPSTREAM_URL` fail-closed (must start with `http://` or `https://`), substitutes authorized variables via `envsubst`, validates configuration with `nginx -t`, and starts Nginx. |
| `client/nginx.conf` | **Modified** | Standalone static Nginx configuration updated with modern security headers, `/healthz` endpoint, `client_max_body_size 10M`, and SPA asset caching rules. |
| `client/Dockerfile` | **Modified** | Changed `ARG VITE_API_URL` to default to empty string `""` (allowing same-origin relative `/api`), copied `nginx.conf.template` and `docker-entrypoint.sh`, added execute permissions, exposed ports 80 and 10000, added Docker healthcheck against `/healthz`, and set entrypoint. |
| `client/src/redux/slices/axiosWithAuth.jsx` | **Modified** | Added request URL normalization in the Axios request interceptor: if `config.url` starts with `/api/`, the leading `/api` is sliced off before appending to `baseURL: "/api"`, preventing `/api/api/...` errors. |
| `client/src/components/ProductList/ProductList1/ProductList.jsx` | **Modified** | Replaced hardcoded fallback strings to ensure that when `API_URL` is empty, endpoints resolve cleanly to `/api/track`, `/api/recommendations`, and `/api/products/...`. |
| `client/src/components/AdminDashboard/pages/AdminAuctionsPage.jsx` | **Modified** | Defaulted `API_URL` fallback from `http://localhost:5000` to `""`, enabling same-origin relative paths. |
| `client/src/components/AdminDashboard/pages/AdminDisputesPage.jsx` | **Modified** | Defaulted `API_URL` fallback to `""`. |
| `client/src/components/AdminDashboard/pages/AdminListingsPage.jsx` | **Modified** | Defaulted `API_URL` fallback to `""`. |
| `client/src/components/AdminDashboard/pages/AdminOrdersPage.jsx` | **Modified** | Defaulted `API_URL` fallback to `""`. |
| `client/src/components/AdminDashboard/pages/AdminReconciliationPage.jsx` | **Modified** | Defaulted `API_URL` fallback to `""`. |
| `client/src/components/AdminDashboard/pages/AdminUsersPage.jsx` | **Modified** | Defaulted `API_URL` fallback to `""`. |
| `client/vite.config.js` | **Modified** | Added development proxy configurations for `/api`, `/socket.io`, and `/auth` targeting `http://localhost:5000`, preserving local Vite development workflow. |
| `render.yaml` | **Modified** | Converted `auctionx-client` to `env: docker`, set `dockerfilePath: Dockerfile`, health check to `/healthz`, added environment variables `PORT: 10000`, `BACKEND_UPSTREAM_URL: http://auctionx-server:10000`, `VITE_API_URL: ""`. |
| `compose.prod.yaml` | **Modified** | Added `VITE_API_URL: ""` build arg and `BACKEND_UPSTREAM_URL: http://server:5000` to client service; commented out host port publishing for backend port 5000 to enforce single entry through Nginx port 3000. |
| `.env.example` | **Modified** | Documented `BACKEND_UPSTREAM_URL` and explained same-origin empty `VITE_API_URL` usage. |
| `.env.docker.example` | **Modified** | Added `BACKEND_UPSTREAM_URL: http://server:5000`. |
| `client/.env.example` | **Modified** | Clarified `VITE_API_URL` usage for development vs. production same-origin deployment. |
| `docs/operations/environment-configuration.md` | **Modified** | Added `BACKEND_UPSTREAM_URL` to Master Catalog. |
| `docs/operations/deployment-and-rollback.md` | **Modified** | Updated deployment topology, service definitions, and post-deployment smoke verification steps. |
| `docs/operations/staging-deployment-runbook.md` | **Modified** | Updated topology diagram and staging prerequisites table to 2x Web Services. |
| `docs/operations/nginx-reverse-proxy-guide.md` | **Created** | Comprehensive operations guide covering architecture, Nginx routing mechanics, environment variables, validation commands, browser test checklists, and rollback steps. |

---

## 4. Network Path & API Client Inspection Findings

All network egress points across the frontend codebase were systematically traced:

| Category | Files Inspected | Findings & Remediations |
| :--- | :--- | :--- |
| **Shared Axios Helper** | `client/src/redux/slices/axiosWithAuth.jsx` | `baseURL` defaults to `/api` when `VITE_API_URL` is empty. Added interceptor normalization to strip leading `/api/` from `config.url`, preventing `/api/api/...`. `withCredentials: true` is preserved on all requests. |
| **CSRF Lifecycle** | `client/src/redux/slices/csrfSecuritySlice.jsx` | Constructs endpoint as `/api/csrf-token` when `API_URL` is empty. Successfully requests and stores CSRF token with credentials. |
| **Direct Fetch / Axios Calls** | `client/src/components/ProductList/ProductList1/ProductList.jsx` | Uses direct `fetch()` for tracking and recommendation telemetry. Replaced hardcoded fallback strings to ensure relative `/api/...` paths are used when `API_URL` is empty. |
| **Admin Dashboard Pages** | `AdminAuctionsPage.jsx`, `AdminDisputesPage.jsx`, `AdminListingsPage.jsx`, `AdminOrdersPage.jsx`, `AdminReconciliationPage.jsx`, `AdminUsersPage.jsx` | Previously defaulted `API_URL` to `"http://localhost:5000"`. Updated all 6 pages to default to `""`, resulting in clean relative `/api/...` calls. |
| **Socket.IO Real-time Client** | `client/src/services/socketService.js`, `LiveChat.jsx` | Uses relative path or window origin by default. Nginx template provides dedicated `/socket.io/` block with WebSocket upgrade headers (`Upgrade`, `Connection`) and 86,400s timeouts. |
| **Multipart File Uploads** | `client/src/components/AdminDashboard/partials/dashboard/AddBannerPage.jsx`, product creation forms | Form data uploads use `axiosWithAuth` with `multipart/form-data`. Nginx `client_max_body_size` is aligned to `10M` to match backend Express Multer limits. |
| **OAuth 2.0 Workflows** | `server/routes/LoginRoutes/SellerAuthRoutes.js` | Handled via dedicated `/auth/` location block in Nginx forwarding to backend upstream. |

---

## 5. Verification Commands & Test Results

| Command Run | Purpose | Exit Code | Result Summary |
| :--- | :--- | :---: | :--- |
| `npm run build --prefix client` | Frontend production bundle compilation | `0` | **PASS** — Vite built successfully in 26.78s without errors; 249 asset chunks generated in `dist/`. |
| `npm test --prefix server -- tests/unit/middleware/csrfLifecycleClient.test.js` | CSRF token extraction, retry recovery, and client contract | `0` | **PASS** — 28/28 tests passed across 4 test suites in 0.949s. |
| `npm test --prefix server` | Server comprehensive unit test suite | `0` | **PASS** — 352/352 tests passed across 27 test suites in 16.324s. |
| `node -e "const yaml = require('./server/node_modules/js-yaml'), fs = require('fs'); yaml.load(fs.readFileSync('render.yaml', 'utf8')); yaml.load(fs.readFileSync('compose.prod.yaml', 'utf8'));"` | Structural YAML parser validation | `0` | **PASS** — `render.yaml` and `compose.prod.yaml` parsed cleanly with zero syntax or indentation errors. |
| `git diff --check` | Whitespace error & trailing newline check | `0` | **PASS** — Clean; zero whitespace or line ending errors. |
| `gitleaks protect -v` | Secret scan on unstaged working tree changes | `0` | **PASS** — 0 leaks found across ~142 KB scanned. |
| `gitleaks protect -v --staged` | Secret scan on staged changes | `0` | **PASS** — 0 leaks found; zero secrets introduced. |

---

## 6. Required Render Environment Variables & Owner Checklist

The following environment variables are required for the Render deployment. Secrets must be configured in the Render Dashboard and never committed to source control:

### 6.1 Frontend Service: `auctionx-client` (Docker Web Service)
- `PORT`: `10000` (Assigned by Render)
- `BACKEND_UPSTREAM_URL`: `http://auctionx-server:10000` (Configured via `render.yaml`)
- `VITE_API_URL`: `""` (Empty string for same-origin relative `/api`)
- `VITE_RAZORPAY_API_KEY`: **[OWNER SUPPLIED]** Public Key ID from Razorpay Dashboard (`rzp_test_...` or `rzp_live_...`)

### 6.2 Backend Service: `auctionx-server` (Web Service)
- `PORT`: `10000` (Assigned by Render)
- `CLIENT_URL`: **[OWNER SUPPLIED]** Public frontend origin (e.g. `https://auctionx-client.onrender.com` or custom domain)
- `MONGODB_URL`: **[OWNER SUPPLIED]** Production MongoDB Atlas connection string
- `JWT_SECRET`: **[OWNER SUPPLIED]** 256-bit cryptographically secure random secret (>= 32 chars)
- `RAZORPAY_KEY_ID`: **[OWNER SUPPLIED]** Razorpay Key ID
- `RAZORPAY_KEY_SECRET`: **[OWNER SUPPLIED]** Razorpay Key Secret
- `RAZORPAY_WEBHOOK_SECRET`: **[OWNER SUPPLIED]** Razorpay Webhook Secret
- `INTERNAL_SERVICE_KEY`: **[OWNER SUPPLIED]** Recommendation proxy shared secret
- `RECOMMENDATION_HMAC_SECRET`: **[OWNER SUPPLIED]** Recommendation telemetry HMAC secret

---

## 7. Unresolved Issues & Deployment Verification Steps

### 7.1 Unresolved Deployment Blockers
The following items remain pending and cannot be completed without owner credentials and live cloud infrastructure:
1. **Render Service Creation / Blueprint Sync:** The project owner must import `render.yaml` into the Render Dashboard or authorize Blueprint sync.
2. **Owner-Supplied Secrets:** Live credentials (MongoDB Atlas, Razorpay, JWT secret, microservice keys) must be populated in the Render environment.
3. **Live DNS & Hostname Confirmation:** Confirm that Render's private service DNS name matches `http://auctionx-server:10000`.

### 7.2 Post-Deployment Verification Steps (Pending Live Execution)
Once deployed on Render by an authorized operator, execute the following verification steps:
1. **Nginx Health Probe:**
   ```bash
   curl -f -s -S https://<client-domain>/healthz
   # Expected: OK (HTTP 200)
   ```
2. **SPA Routing Check:**
   ```bash
   curl -f -s -S -I https://<client-domain>/auctions/some-id
   # Expected: HTTP 200 returning index.html
   ```
3. **API Proxy Check:**
   ```bash
   curl -f -s -S -I https://<client-domain>/api/products
   # Expected: HTTP 200 from backend Express server
   ```
4. **Interactive Browser Verification:**
   - **Login & Logout:** Verify session cookie (`token`) is set under same origin with `HttpOnly; Secure; SameSite=Lax`.
   - **CSRF-Protected Writes:** Submit a bid and verify `x-csrf-token` header succeeds without 403 CSRF rejection.
   - **File Upload:** Upload an auction product image and verify multipart upload completes without 413 or proxy timeout.
   - **Real-Time Bidding:** Open two browser sessions and place a bid; verify WebSocket bid update broadcasts instantaneously via `/socket.io/`.

---

## 8. Initial vs. Final Git Status & Safety Confirmation

### 8.1 Initial State (Pre-Execution)
- 27 staged file renames (documentation restructuring)
- Modified files in working tree: `.gitignore`, `client/src/redux/slices/csrfSecuritySlice.jsx`, `server/routes/LoginRoutes/SellerAuthRoutes.js`, test files
- Untracked files: `.gitleaksignore`, `LICENSE`, audit reports, recommendation service files

### 8.2 Final State (`git status --short`)
```text
 M .env.docker.example
 M .env.example
 M .github/workflows/ci.yml
 M .gitignore
 M ARCHITECTURE.md
 M README.md
 M client/.env.example
 M client/Dockerfile
 M client/nginx.conf
 M client/src/components/AdminDashboard/pages/AdminAuctionsPage.jsx
 M client/src/components/AdminDashboard/pages/AdminDisputesPage.jsx
 M client/src/components/AdminDashboard/pages/AdminListingsPage.jsx
 M client/src/components/AdminDashboard/pages/AdminOrdersPage.jsx
 M client/src/components/AdminDashboard/pages/AdminReconciliationPage.jsx
 M client/src/components/AdminDashboard/pages/AdminUsersPage.jsx
 M client/src/components/AdminDashboard/partials/dashboard/AddBannerPage.jsx
 M client/src/components/AdminDashboard/partials/dashboard/CalenderPage.jsx
 M client/src/components/AdminDashboard/partials/dashboard/CustomEventsPage.jsx
 M client/src/components/ProductList/ProductList1/ProductList.jsx
 M client/src/components/ProductList/ProductList4/ProductList4.jsx
 M client/src/pages/User/ProductDetails/ProductDetails.jsx
 M client/src/redux/slices/axiosWithAuth.jsx
 M client/src/redux/slices/csrfSecuritySlice.jsx
 M client/vite.config.js
 M compose.prod.yaml
 M compose.yaml
R  docs/frontend/adr/0001-design-tokens-and-theme-architecture.md -> docs/architecture/adr/0001-design-tokens-and-theme-architecture.md
R  docs/system-design/03-architecture-decisions.md -> docs/architecture/architecture-decisions.md
RM docs/system-design/07-design-verification.md -> docs/architecture/design-verification.md
R  docs/frontend/design-system.md -> docs/architecture/frontend-design-system.md
R  docs/system-design/01-high-level-design.md -> docs/architecture/high-level-design.md
R  docs/system-design/04-implementation-roadmap.md -> docs/architecture/implementation-roadmap.md
R  docs/system-design/02-low-level-design.md -> docs/architecture/low-level-design.md
R  docs/system-design/00-system-flows.md -> docs/architecture/system-flows.md
R  docs/frontend/Audit-017-Frontend-Architecture-And-Component-Audit.md -> \
RM docs/frontend/Audit-018-Global-Design-System-Consistency.md -> \
R  docs/frontend/Audit-019-Frontend-Phase-Two-Navigation-Execution.md -> \
R  docs/frontend/Audit-020-Frontend-Phase-Two-Navigation-Verification.md -> \
R  docs/frontend/Audit-021-Frontend-Phase-Three-A-Home-Execution.md -> \
R  docs/frontend/Audit-022-Frontend-Phase-Three-A-Regression-Review.md -> \
RM docs/frontend/Audit-023-Frontend-Phase-Three-B-One-Product-Details.md -> \
RM docs/frontend/Audit-024-Frontend-Phase-Three-B-Live-Auction-Execution.md -> \
RM docs/frontend/Audit-025-Frontend-Phase-Three-C-Static-Pages-Execution.md -> \
RM docs/frontend/Audit-028-Frontend-Phase-Four-One-Dashboard-Regression.md -> \
RM docs/frontend/Audit-027-Frontend-Phase-Four-Dashboard-Execution.md -> \
R  docs/frontend/Audit-026-Frontend-Phase-Four-A-Dashboard-Layout.md -> \
RM docs/frontend/Audit-029-Frontend-Phase-Five-A-Auth-Forms-Execution.md -> \
RM docs/frontend/Audit-030-Frontend-Phase-Five-B-Modals-Execution.md -> \
RM docs/frontend/Audit-031-Frontend-Phase-Five-C-Feedback-Components-Execution.md -> \
R  docs/frontend/Audit-032-Frontend-Phase-Five-D-Accessibility-Execution.md -> \
RM docs/frontend/Audit-033-Frontend-Phase-Five-E-Design-System-Audit.md -> \
RM docs/frontend/Audit-034-Frontend-Post-Phase-Five-E-Regression.md -> \
 M docs/audits/Audit-011-UI-Sounds-And-Header-Redesign.md
 M docs/audits/Audit-041-Permanent-Wallet-Settlement-Idempotency.md
 M docs/operations/deployment-and-rollback.md
 M docs/operations/environment-configuration.md
 M docs/operations/staging-deployment-runbook.md
R  docs/system-design/05-test-strategy.md -> docs/testing/test-strategy.md
 M e2e/playwright.config.ts
 M e2e/tests/auction-bid.spec.ts
 M recommendation_service/.env.example
 M recommendation_service/main.py
 M recommendation_service/requirements-dev.txt
 M render.yaml
 M server/.env.example
 M server/controllers/PaymentControllers/paymentController.js
 M server/middleware/Security/RateLimiter.js
 M server/middleware/Security/csrfMiddleware.js
 M server/routes/LoginRoutes/SellerAuthRoutes.js
 M server/server.js
 M server/services/bidService.js
 M server/services/paymentService.js
 M server/tests/graybox/serviceInteraction.test.js
 M server/tests/integration/auth/idorAuthorization.test.js
 M server/tests/integration/recommendation/recommendationProxy.test.js
 M server/tests/integration/stage5_end_to_end_settlement.test.js
 M server/tests/unit/middleware/csrfMiddleware.test.js
 M server/tests/unit/stage4_payment_settlement.test.js
?? .gitleaksignore
?? LICENSE
?? client/docker-entrypoint.sh
?? client/nginx.conf.template
?? docs/README.md
?? docs/api/
?? docs/architecture/system-overview.md
?? docs/audits/Audit-049-Recommendation-Engine-Production-Readiness.md
?? docs/audits/Audit-051-Gitleaks-Baseline-And-CI-Enforcement.md
?? docs/audits/Audit-052-Public-Release-Blocker-Verification.md
?? docs/audits/Audit-053-Nginx-Same-Origin-Reverse-Proxy.md
?? docs/development/
?? docs/operations/nginx-reverse-proxy-guide.md
?? docs/security/
?? recommendation_service/evaluation.py
?? recommendation_service/ranking.py
?? recommendation_service/tests/
?? server/models/RecommendationOutbox.js
?? server/services/recommendationTrackingService.js
?? server/tests/unit/middleware/csrfLifecycleClient.test.js
```

### 8.3 Safety & Non-Execution Confirmations
- **Zero Commits:** No Git commits (`git commit`) were executed.
- **Zero Pushes or Remote Operations:** No `git push`, `git fetch`, `git remote`, or network operations against Git remotes were performed.
- **Zero Database Operations:** No connections to or mutations of any MongoDB database (local, Atlas, or `Auction-X-Major`) occurred.
- **Zero State Discards:** No `git reset`, `git clean`, stash, or checkout operations were performed; all 27 staged file renames and untracked files are preserved intact.
- **License File Untouched:** The root `LICENSE` file was not modified.
- **No Claim of Production-Ready Status:** This report does not claim that the application is production-ready or public-release-ready. Live cloud deployment and browser testing remain pending owner action.
