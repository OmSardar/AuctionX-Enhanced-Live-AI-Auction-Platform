# Auction X — Staging Deployment & Operations Runbook

**Document Version:** 1.0.0  
**Target Environment:** Isolated Cloud Staging  
**Platform Architecture:** MERN Stack (React 18 / Vite 5, Node.js 20 / Express 4, MongoDB 7 / Mongoose 8, Socket.IO 4) + Razorpay REST Integration (Paise Precision & Webhook Lease Fencing)  
**Execution Authority:** DevOps / Release Engineering / Infrastructure Operator  
**Verification Level:** Local Stage 6 Passed (346/346 Tests); Cloud Staging Pending Authorization  

---

## 1. Overview & Architecture

This runbook specifies the step-by-step operational procedure for deploying **Auction X** to an isolated staging cloud environment. The architecture is designed to validate the complete auction-to-settlement lifecycle, Razorpay test-mode transactions, and real-time Socket.IO bidding under real network conditions, without exposing production infrastructure or live financial credentials.

### 1.1 Staging Topology Diagram

```mermaid
graph TD
    subgraph External Provider
        RZP[Razorpay Test Gateway]
    end

    subgraph User / Tester
        Browser[Browser / Tester]
    end

    subgraph Staging Infrastructure (Render Cloud)
        subgraph Public Entry Point
            ClientApp[auctionx-client<br/>Docker: React Vite SPA + Nginx Reverse Proxy<br/>Port 10000 / Single Public HTTPS Origin]
        end

        subgraph Private Networking
            ServerApp[auctionx-server<br/>Node.js 20 / Express 4 / Socket.IO<br/>Replicas: 1 Dedicated Worker<br/>Internal: http://auctionx-server:10000]
            RecService[auctionx-recommendation-service<br/>Python FastAPI / Uvicorn<br/>Internal: http://auctionx-recommendation-service:10000]
        end

        subgraph Database & Cache
            MongoAtlas[(MongoDB Atlas Staging<br/>DB: Auction-X-Staging<br/>M0/M2 Dedicated Cluster)]
            Redis[(Optional: Redis Staging)]
        end
    end

    Browser -->|HTTPS: One Public Origin<br/>SPA, /api/*, /socket.io/*| ClientApp
    ClientApp -->|Render Private Network<br/>/api/* & /socket.io/*| ServerApp
    RZP -->|Webhook Delivery POST /api/payment/webhook| ClientApp
    ServerApp -->|MongoDB Connection String| MongoAtlas
    ServerApp -->|HTTP Basic Auth REST API| RZP
    ServerApp -.->|HTTP Proxy| RecService
    RecService -.->|Queries| MongoAtlas
```

### 1.2 Core Architectural Principles

1. **Mandatory Single Backend Replica Constraint:**
   - **Singleton Deployment Requirement:** The backend MUST run as strictly **one instance (`replicas: 1`)** in both staging and production until distributed coordination is engineered.
   - **Process-Local Scheduler Lock Limitation:** The auction lifecycle scheduler (`schedulerService.js`) and recommendation outbox sweeper (`recommendationTrackingService.js`) rely on process-local in-memory state (`isProcessing = false`). A process-local lock does **not** provide cross-instance exclusivity; running multiple instances will cause redundant 5-second polling cycles and duplicate Socket.IO status event emissions.
   - **Socket.IO Cross-Instance Coordination:** Socket.IO runs on the default in-memory EventEmitter adapter. Multi-instance deployments require an external cross-instance pub/sub coordination layer, such as `@socket.io/redis-adapter`; without this, WebSocket clients connected to different server instances will not receive broadcast bid updates.
   - **Operator Verification Obligation:** The operator must actively inspect the cloud hosting dashboard (e.g. Render Web Service settings) to confirm the instance replica count is set to 1 before routing live traffic.
   - **Operational Boundary Notice:** These are deployment and operational constraints, not an assertion that production infrastructure has already been correctly provisioned or verified. The application does not enforce singleton mode at startup.
2. **Raw Webhook Stream Preservation:** Reverse proxies (Render, Cloudflare, ALB, Nginx) MUST forward the inbound HTTP body to `/api/payment/webhook` and `/api/webhooks/razorpay` verbatim without body decoding, re-encoding, or compression alterations. The server computes cryptographic HMAC-SHA256 signatures over raw buffer bytes.
3. **HTTPS Enforcement:** Both frontend and backend domains MUST use HTTPS. Browsers reject session authentication cookies if `secure: true` is set over unencrypted HTTP.
4. **Data Isolation:** The staging database MUST be physically or logically isolated (`Auction-X-Staging`) from production databases. Seeding or wiping staging data MUST never target production clusters.

---

## 2. Prerequisites & External Accounts

Before initiating deployment, verify that the following accounts and resources are accessible:

| Service / Resource | Required Tier / Setting | Purpose | Estimated Cost |
| :--- | :--- | :--- | :--- |
| **Cloud Hosting (e.g. Render, Railway, AWS ECS)** | 2x Web Services (1x Backend Node.js 512MB RAM min; 1x Frontend Docker Nginx reverse proxy 512MB RAM min) | Hosting backend API and frontend static assets + Nginx reverse proxy | ~$14–$25/month (Platform dependent; verify current billing) |
| **MongoDB Atlas** | Dedicated M0 (Shared) or M2/M5 (Dedicated) Staging Cluster | Isolated database for auction state, bids, orders, webhooks | Free tier (M0) or ~$9–$25/month |
| **Razorpay Account** | Test Mode Dashboard enabled (`https://dashboard.razorpay.com`) | Generating test API keys and configuring webhook endpoints | Free for test mode |
| **Google Cloud Console (Optional)** | OAuth 2.0 Credentials (Authorized redirect URIs) | Testing Google Social Login on staging domain | Free |
| **Cloudinary (Optional)** | Staging Cloudinary account or sub-folder | Image uploads for auction items | Free tier |

> [!CAUTION]
> **No Cost-Free Assumption:** Always verify cloud provider billing thresholds. Do not assume services will remain indefinitely free. Set up billing alerts on hosting and database providers.

---

## 3. Verified Build & Startup Commands

All commands below have been tested and verified directly against the repository codebase:

### Backend (`server/`)
- **Package Manager:** npm (Node.js 20 LTS recommended)
- **Dependency Installation:** `npm ci --omit=dev` (Production) or `npm ci` (Staging / Development)
- **Startup Command:** `node server.js`
- **Health Check Command:**
  ```bash
  node -e "require('http').get('http://localhost:' + (process.env.PORT || 5000) + '/', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"
  ```
- **HTTP Health Probe URL:** `GET /` $\to$ Returns HTTP 200 with text `Server is running!`

### Frontend (`client/`)
- **Build Command:** `npm ci && npm run build`
- **Output Directory:** `dist/`
- **Static Web Server:** Nginx (or cloud static hosting platform)
- **Routing Rewrite Rule (SPA):** All routes must rewrite to `/index.html`:
  ```nginx
  location / {
      try_files $uri $uri/ /index.html;
  }
  ```

### Recommendation Service (`recommendation_service/`) — Optional
- **Build Command:** `pip install -r requirements.txt`
- **Startup Command:** `uvicorn main:app --host 0.0.0.0 --port 10000`
- **Health Check Probe URL:** `GET /health` $\to$ Returns HTTP 200

---

## 4. Environment Variables Boundary Specification

Configure the following environment variables in your staging deployment management consoles. **Use placeholders only during setup. Never commit secrets to source control.**

### 4.1 Backend Service (`auctionx-server`)

| Variable Name | Required? | Secret? | Target Component | Description / Placeholder |
| :--- | :---: | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | No | Runtime | Set to `production` (enables proxy trust, secure cookies, error redaction) |
| `PORT` | **Yes** | No | HTTP Listener | Port to bind (e.g. `10000` on Render, `5000` default) |
| `MONGODB_URL` | **Yes** | **YES** | Database | `mongodb+srv://<staging_user>:<staging_password>@<staging_cluster>.mongodb.net/Auction-X-Staging?retryWrites=true&w=majority` |
| `CLIENT_URL` | **Yes** | No | CORS & Redirects | Staging frontend origin: `https://staging.auctionx.com` (no trailing slash) |
| `JWT_SECRET` | **Yes** | **YES** | Auth Tokens | 256-bit random cryptographic secret ($\ge 32$ chars, e.g. `openssl rand -hex 32`) |
| `RECOMMENDATION_HMAC_SECRET` | **Yes** | **YES** | Telemetry / PII | 256-bit random cryptographic secret (64 hex characters, `openssl rand -hex 32`). Used exclusively for user pseudonymization HMAC. Must match recommendation service. Never expose to frontend. |
| `INTERNAL_SERVICE_KEY` | **Yes** | **YES** | Inter-Service Auth | 256-bit random cryptographic pre-shared key (64 hex characters, `openssl rand -hex 32`). Used for backend-to-microservice authentication. Must match recommendation service. Never expose to frontend. |
| `RAZORPAY_KEY_ID` | **Yes** | No | Payment Gateway | Razorpay Test Key ID (starts with `rzp_test_...`) |
| `RAZORPAY_KEY_SECRET` | **Yes** | **YES** | Payment Gateway | Razorpay Test Key Secret (used for REST basic auth and checkout HMAC) |
| `RAZORPAY_WEBHOOK_SECRET` | **Yes** | **YES** | Webhooks | Razorpay Webhook Secret configured in the Test Dashboard |
| `SCHEDULER_INTERVAL_MS` | No | No | Lifecycle | Polling interval in ms (default: `5000`) |
| `SCHEDULER_BATCH_SIZE` | No | No | Lifecycle | Maximum auctions processed per batch (default: `50`) |
| `RECOMMENDATION_SERVICE_URL` | No | No | Auxiliary Proxy | URL of staging recommendation service (`http://recommendation-service:8000` or cloud URL) |
| `GOOGLE_CLIENT_ID` | No | No | OAuth | Google OAuth 2.0 Staging Client ID |
| `GOOGLE_CLIENT_SECRET` | No | **YES** | OAuth | Google OAuth 2.0 Staging Client Secret |
| `GOOGLE_CALLBACK_URL` | No | No | OAuth | `https://staging-api.auctionx.com/auth/google/callback` |
| `EMAIL_USER` | No | No | SMTP OTP | Staging email user for OTP testing |
| `EMAIL_PASS` | No | **YES** | SMTP OTP | Staging email app password |
| `CLOUDINARY_CLOUD_NAME` | No | No | Media Storage | Staging Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | No | No | Media Storage | Staging Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | **YES** | Media Storage | Staging Cloudinary API secret |

### 4.2 Frontend Service (`auctionx-client`)

| Variable Name | Required? | Secret? | Target Component | Description / Placeholder |
| :--- | :---: | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | No | HTTP / Socket.IO | Backend staging API URL: `https://staging-api.auctionx.com` (required at build time) |
| `VITE_RAZORPAY_API_KEY` | **Yes** | No | Razorpay Modal | Public Razorpay Test Key ID (`rzp_test_...`) |
| `VITE_RECOMMENDATION_API_URL` | No | No | Recommendations | Leave empty (`""`) so recommendation and telemetry requests route securely through the authenticated Express gateway proxy (`/api/recommendations` and `/api/track`). Only specify a URL if an external reverse proxy explicitly exposes the microservice. |

> [!WARNING]
> **Zero Secrets in Frontend:** The frontend bundle is public. Only `VITE_`-prefixed variables are bundled, and they must contain **NO secret keys, database passwords, or webhook secrets**.

### 4.3 Recommendation Service (`auctionx-recommendation-service`) — When Deployed

| Variable Name | Required? | Secret? | Target Component | Description / Generation Standard |
| :--- | :---: | :---: | :--- | :--- |
| `MONGODB_URI` | **Yes** | **YES** | Database | Staging MongoDB connection URI (e.g. `mongodb+srv://...` or `mongodb://mongodb:27017`) |
| `MONGODB_DB` | **Yes** | No | Database | Target database name: `Auction-X-Staging` (must match backend database) |
| `RECOMMENDATION_HMAC_SECRET` | **Yes** | **YES** | Telemetry / PII | Must match `RECOMMENDATION_HMAC_SECRET` configured in the backend service. |
| `INTERNAL_SERVICE_KEY` | **Yes** | **YES** | Inter-Service Auth | Must match `INTERNAL_SERVICE_KEY` configured in the backend service. Fails closed if missing. |
| `REDIS_PASSWORD` | **Yes** (Prod Compose) | **YES** | Redis Cache | 64-character hexadecimal string (`openssl rand -hex 32`). Required when cache is active. |
| `REDIS_URL` | No | **YES** | Cache | Redis connection string: `redis://:${REDIS_PASSWORD}@redis:6379/0` (or cloud Redis) |
| `CLIENT_URL` | **Yes** | No | CORS | Staging frontend origin: `https://staging.auctionx.com` |

### 4.4 Secret Boundaries & Cryptographic Key Generation Standards

> [!SECURITY]
> **Inter-Service & Cache Security Boundaries:**
> 1. **Key Independence:** `RECOMMENDATION_HMAC_SECRET`, `INTERNAL_SERVICE_KEY`, `REDIS_PASSWORD`, and `JWT_SECRET` serve distinct cryptographic functions and **MUST BE GENERATED AS SEPARATE RANDOM KEYS**. Under no circumstances should secret values be shared, duplicated across roles, or committed to source control.
> 2. **Key Generation Standard:** Generate each secret independently using OpenSSL:
>    ```bash
>    # Generate RECOMMENDATION_HMAC_SECRET (256-bit hex)
>    openssl rand -hex 32
>
>    # Generate INTERNAL_SERVICE_KEY (256-bit hex)
>    openssl rand -hex 32
>
>    # Generate REDIS_PASSWORD (strictly 64-character hex, 256-bit entropy)
>    openssl rand -hex 32
>
>    # Generate JWT_SECRET (256-bit hex)
>    openssl rand -hex 32
>    ```
> 3. **Redis Hardening in Docker Compose (`compose.prod.yaml`):**
>    - `REDIS_PASSWORD` must be a valid 64-character hexadecimal string. The production container startup wrapper verifies this format before launching `redis-server`.
>    - Redis is attached exclusively to the dedicated internal bridge network `auctionx-prod-rec-network` (`internal: true`) and publishes zero host ports, preventing lateral container access and host ingress.
>    - The production Redis startup wrapper delegates to `docker-entrypoint.sh redis-server -`, triggering image privilege-dropping (`gosu redis`) to ensure Redis runs under the dedicated unprivileged `redis` user (UID 999).
> 4. **Host Administrator Threat Model:** Environment-based secret delivery injects credentials into the container environment. It does **not** protect secrets against privileged host administrators with root or Docker daemon (`docker` group) access. Local development Redis (`compose.yaml`) remains completely unauthenticated and unchanged.

---

## 5. Step-by-Step Staging Setup Procedure

### Step 1: Provision Isolated Staging MongoDB Cluster
1. Log in to MongoDB Atlas $\to$ Create an isolated cluster named `auctionx-staging-cluster`.
2. Create a database user with read/write access restricted specifically to database `Auction-X-Staging`.
3. Configure the IP Access List: Allow the cloud hosting provider's egress IPs (or `0.0.0.0/0` with strong authentication password).
4. Save the connection string placeholder:
   ```
   mongodb+srv://<staging_user>:<password>@auctionx-staging-cluster.mongodb.net/Auction-X-Staging?retryWrites=true&w=majority
   ```

### Step 2: Deploy Staging Backend Service
1. In your cloud provider (e.g. Render $\to$ New Web Service):
   - **Repository:** Connect your Git repository.
   - **Root Directory:** `server`
   - **Environment:** Node.js
   - **Build Command:** `npm ci`
   - **Start Command:** `node server.js`
   - **Health Check Path:** `/`
2. Populate the backend environment variables specified in Section 4.1.
3. Deploy the service and verify logs indicate:
   ```
   Connected to MongoDB Database: Auction-X-Staging
   [Scheduler] Starting Auction Lifecycle Scheduler (polling interval: 5000ms)
   Server is running on port 10000
   ```
4. Note your backend public URL (e.g., `https://staging-api.auctionx.com`).

### Step 3: Deploy Staging Frontend Static Site
1. In your cloud provider (e.g. Render $\to$ New Static Site):
   - **Root Directory:** `client`
   - **Build Command:** `npm ci && npm run build`
   - **Publish Directory:** `dist`
   - **Rewrite Rules:** Set rewrite rule `/*` $\to$ `/index.html`.
2. Populate the build environment variables:
   - `VITE_API_URL=https://staging-api.auctionx.com`
   - `VITE_RAZORPAY_API_KEY=rzp_test_...`
3. Deploy the frontend and note your frontend public URL (e.g., `https://staging.auctionx.com`).
4. Update the backend `CLIENT_URL` environment variable to match `https://staging.auctionx.com`.

### Step 4: Configure Razorpay Test-Mode Webhooks
1. Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Toggle the switch in the top header to **Test Mode**.
3. Navigate to **Settings** $\to$ **Webhooks** $\to$ **Add New Webhook**.
4. In the Webhook configuration form:
   - **Webhook URL:** `https://staging-api.auctionx.com/api/payment/webhook`
   - **Secret:** Generate a strong secret string ($\ge 20$ alphanumeric characters).
   - **Alert Email:** Operator notification email.
   - **Active Events:** Select the following events:
     - `payment.captured`
     - `payment.failed`
     - `refund.processed`
5. Save the Webhook. Copy the secret into the backend `RAZORPAY_WEBHOOK_SECRET` environment variable and restart the backend service.

---

## 6. Staging Validation & Verification Procedures

Execute these operational verification tests after deployment completes:

### 6.1 Health Probes & Connectivity
1. **Root Probe:**
   ```bash
   curl -i -X GET https://staging-api.auctionx.com/
   ```
   *Expected:* HTTP 200 OK, body contains `Server is running!`.
2. **CSRF Token Endpoint:**
   ```bash
   curl -i -X GET https://staging-api.auctionx.com/api/csrf-token
   ```
   *Expected:* HTTP 200 OK, response includes `Set-Cookie: _csrf=...` and JSON `{ csrfToken: "..." }`.
3. **Public Product Endpoint:**
   ```bash
   curl -i -X GET https://staging-api.auctionx.com/api/products
   ```
   *Expected:* HTTP 200 OK, response includes valid JSON array.

### 6.2 Raw Webhook Handshake Verification
Verify that the staging backend properly captures raw request bytes:
```bash
curl -i -X POST https://staging-api.auctionx.com/api/payment/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"probe","payload":{}}'
```
*Expected Response:*
```http
HTTP/1.1 501 Not Implemented
Content-Type: application/json

{
  "success": false,
  "code": "WEBHOOK_STAGE_4_PREREQUISITE",
  "message": "Payment webhook endpoint infrastructure is ready. Signature verification requires x-razorpay-signature header.",
  "rawBytesReceived": 31
}
```
*Interpretation:* This proves that the cloud hosting load balancer and reverse proxy successfully passed verbatim raw body buffers to the Express application without corrupting body streams.

### 6.3 End-to-End Test Checkout Journey
1. Open the staging frontend at `https://staging.auctionx.com` in a browser.
2. Register a new buyer account and log in.
3. Open an active auction listing and place a valid bid.
4. Verify real-time Socket.IO price updates on the page.
5. In the database or admin interface, set `endTime` to 1 minute ago.
6. Verify the scheduler marks the product as `ENDED` and generates the unique `Order` with `status: PENDING`.
7. Click **Proceed to Payment** on the Order page.
8. Complete checkout in the Razorpay Test Modal using [Razorpay Test Card Credentials](https://razorpay.com/docs/payments/payments/test-card-details/):
   - Card: `4111 1111 1111 1111`
   - Expiry: Any future date
   - CVV: `123`
   - OTP: `123456` (Success)
9. Verify that:
   - Order transitions immediately to `PAID`.
   - Product status updates to `SETTLED`.
   - Payment record reflects `CAPTURED`.
   - Socket.IO broadcasts `payment:settled`.

### 6.4 Duplicate Webhook Delivery Verification
1. In the Razorpay Dashboard $\to$ **Webhooks** $\to$ Click on the webhook endpoint $\to$ Select the `payment.captured` event from the test checkout.
2. Click **Resend Webhook**.
3. Inspect backend logs:
   ```
   [Payment] Webhook event evt_... already processed. Returning duplicate acknowledgement.
   ```
4. Verify that the order balance and payment status are unchanged (no double-crediting).

---

## 7. Data Reset & Maintenance Procedures

### 7.1 Staging-Only Scoped Data Maintenance & Validation Reset Procedure

> [!CAUTION]
> **PRODUCTION FINANCIAL RECORD INTEGRITY INVARIANT:**
> Production financial ledgers (`payments`, `orders`), payment audit logs (`webhookevents`), and pending authoritative outbox events (`recommendationoutboxes`) **MUST NEVER BE INDISCRIMINATELY WIPED, PURGED, OR DELETED**.
> Wiping production financial documents destroys non-repudiation audit trails, breaks dual-path settlement idempotency fences, and causes unrecoverable ledger divergence.
>
> The reset procedure below is strictly scoped for **isolated staging validation environments (`Auction-X-Staging`)** to clear disposable test cycles. It must never be automated in unattended scripts or executed against production or shared clusters.

#### Pre-Execution Safeguards
Before running any maintenance or cleanup operations:
1. **Target Verification:** The operator must positively verify that the connection string points specifically to the verified staging cluster and that `db.getName()` strictly matches the approved staging database allowlist (`Auction-X-Staging`). In `mongosh`, `db.getMongo()` exposes the active connection representation via `conn._uri` (the authoritative connection URI string) or `conn.host` (the connected server node). In replica sets and MongoDB Atlas, `conn.host` may report an individual replica-set shard member (e.g. `*-shard-00-01.*.mongodb.net`) rather than the cluster-level SRV hostname. The operator must not assume `conn.host` is always the original Atlas SRV hostname, nor blindly trust or add guessed shard hostnames to the allowlist. If the connection representation cannot be verified or its target semantics are ambiguous, cleanup aborts immediately.
2. **Explicit Allowlist Guard (No Substring Matching):** Only the exact, case-sensitive database name `Auction-X-Staging` is allowlisted. Substring matching, regular expressions, and generic patterns (such as `test` or `staging`) are strictly prohibited to prevent accidental targeting of MongoDB default databases (e.g. `test`) or production databases.
3. **Strict Cluster Hostname Allowlist Verification (No Substring Matching):** Do not rely on database name alone. Broad substring checks (such as verifying a host does not contain `prod`) are insufficient to prove a target is the legitimate staging cluster. The procedure safely extracts hostnames from the active connection without printing raw URIs or credentials, supporting only standard MongoDB URIs (`mongodb://` and `mongodb+srv://`, case-insensitively) and direct host targets (including bracketed IPv6), and rejecting unsupported schemes (`ftp://`, `http://`, `redis://`, etc.) as well as legacy scheme-less replica-set formats (`rsName/host`). Hostnames are verified against an explicit allowlist of verified staging cluster hostnames using exact equality. Because the staging Atlas cluster has not yet been provisioned in the cloud infrastructure (the repository defines `auctionx-staging-cluster` as a friendly UI label and `auctionx-staging-cluster.mongodb.net` as a placeholder), this allowlist fails closed by default. An operator must explicitly populate the verified provisioned hostname(s) before cleanup can run.
4. **Dry-Run Preview (Fail-Closed):** Count and display existing document volumes across all target collections. If query execution fails for any reason, the procedure halts immediately without running cleanup commands.
5. **Unconditional Outbox Abort Gate:** Check for pending or in-flight authoritative events in `recommendationoutboxes` (`status: "PENDING"` or `"PROCESSING"`). If any pending outbox events exist, **cleanup aborts unconditionally**. No bypass mechanism is permitted. The operator must verify recommendation service connectivity and let the background worker safely drain and deliver all in-flight events before retrying cleanup. This ensures parent records (`bids`, `orders`, `products`) needed for delivery are never deleted prematurely.
6. **Explicit Operator Opt-In:** Deletions require explicit variable confirmation (`CONFIRM_STAGING_CLEANUP = true`). By default, the script operates in preview-only mode.

#### Environment-Scoped Staging Maintenance Script (Mongo Shell)

Connect to the verified staging cluster via mongosh (using your provisioned staging cluster connection string):
```bash
mongosh "mongodb+srv://<staging_user>:<password>@<staging_cluster_hostname>/Auction-X-Staging"
```

Execute the guarded, opt-in inspection and maintenance block:
```javascript
// ==============================================================================
// AUCTIONX STAGING CLEANUP & VALIDATION RESET PROTOCOL
// ==============================================================================

(function runStagingMaintenance() {
  const currentDb = db.getName();

  // Helper: safely extract hostnames without exposing credentials, schemes, or query parameters
  function parseTargetHostnames(raw) {
    if (!raw || typeof raw !== "string") return [];
    let str = raw.trim();

    // 1. Strict URI Scheme Validation (Case-Insensitive)
    // Only standard MongoDB URIs (mongodb:// and mongodb+srv://) are accepted.
    // Unsupported schemes (e.g. ftp://, http://, redis://) are rejected immediately.
    if (str.includes("://")) {
      if (!/^mongodb(\+srv)?:\/\//i.test(str)) {
        return [];
      }
      str = str.replace(/^mongodb(\+srv)?:\/\//i, "");
    } else {
      // Direct host targets: reject scheme-less legacy replica set prefixes ('rs0/host:port')
      // and reject credentials without an explicit URI scheme ('user:pass@host')
      if (str.includes("/") || str.includes("@")) {
        return [];
      }
    }

    // 2. Identify authority boundary (prior to database path '/' or query '?')
    const slashIdx = str.indexOf("/");
    const qIdx = str.indexOf("?");
    let endOfAuthority = str.length;
    if (slashIdx !== -1) endOfAuthority = slashIdx;
    if (qIdx !== -1 && qIdx < endOfAuthority) endOfAuthority = qIdx;

    const authority = str.substring(0, endOfAuthority);

    // 3. Strip userinfo/credentials (everything before the last '@' within the authority component)
    const atIdx = authority.lastIndexOf("@");
    let hostPart = atIdx !== -1 ? authority.substring(atIdx + 1) : authority;

    if (!hostPart) return [];

    // Helper: validate and extract a single hostname/address without scope errors
    function parseSingleHost(item) {
      let h = item.trim();
      if (!h) return null;

      // Handle bracketed IPv6: e.g. [2001:db8::1]:27017 or [2001:db8::1]
      if (h.startsWith("[")) {
        const closeBracket = h.indexOf("]");
        if (closeBracket === -1) return null;
        const ipv6Addr = h.substring(1, closeBracket).trim();
        const afterBracket = h.substring(closeBracket + 1).trim();
        if (afterBracket && !/^:[0-9]+$/.test(afterBracket)) return null;
        if (!ipv6Addr || ipv6Addr.includes("@") || ipv6Addr.includes("/")) return null;
        return ipv6Addr.toLowerCase();
      }

      // Handle standard IPv4 / DNS hostname: e.g. hostname:27017 or hostname
      const parts = h.split(":");
      if (parts.length > 2) return null; // Reject unbracketed raw IPv6 or invalid colons
      const hostname = parts[0].trim();
      if (parts.length === 2) {
        const port = parts[1].trim();
        if (!/^[0-9]+$/.test(port)) return null;
      }
      if (!hostname || hostname.includes("@") || hostname.includes("/")) return null;
      return hostname.toLowerCase();
    }

    // 4. Split comma-separated hostnames and validate every host (fail-closed if any host fails)
    const rawHosts = hostPart.split(",");
    const hosts = [];
    for (const item of rawHosts) {
      const parsed = parseSingleHost(item);
      if (!parsed) return []; // Any malformed host item causes immediate fail-closed abort
      hosts.push(parsed);
    }
    return hosts;
  }

  // Retrieve raw connection string from mongosh environment
  // In mongosh, db.getMongo() exposes the active target via conn._uri (the original
  // connection URI passed to mongosh) and/or conn.host (the current server node or connection string).
  // In replica sets and MongoDB Atlas, conn.host often reflects a specific shard member node
  // (e.g. '*-shard-00-01.*.mongodb.net') rather than the cluster-level SRV hostname.
  //
  // Semantics & Precedence:
  // 1. Authoritative URI (conn._uri): Preferred when available, as it captures the explicit
  //    cluster connection string supplied by the operator.
  // 2. Direct Node Host (conn.host): Evaluated when conn._uri is unavailable (e.g., direct host:port connections).
  //
  // OPERATOR VERIFICATION INVARIANT:
  // - Never assume conn.host is always the original Atlas SRV hostname.
  // - Never blindly trust or allowlist an unknown or guessed shard hostname.
  // - If neither property can be obtained or target parsing is ambiguous, the script fails closed immediately.
  let rawTarget = "";
  try {
    if (typeof db.getMongo === "function") {
      const conn = db.getMongo();
      rawTarget = conn._uri || conn.host || "";
    }
  } catch (_) {
    rawTarget = "";
  }

  // 1. Mandatory Explicit Hostname Allowlist (Strict Case-Sensitive Exact Matching)
  //
  // SECURITY REQUIREMENT & FAIL-CLOSED BLOCKER:
  // Repository documentation (Section 5.1 & Stage 6 Audit) defines 'auctionx-staging-cluster'
  // as a friendly Atlas cluster label and 'auctionx-staging-cluster.mongodb.net' as a placeholder.
  // The actual remote staging MongoDB Atlas cluster has not yet been provisioned. In MongoDB Atlas,
  // real connection hostnames resolve to provisioned subdomains (e.g. 'auctionx-staging-cluster.<hash>.mongodb.net')
  // or shard replica hosts. Because no live staging cluster hostname can be established from
  // repository evidence, this allowlist is intentionally left unpopulated.
  //
  // Cleanup execution is strictly prohibited and fails closed until the operator provisions the
  // staging cluster and explicitly enters the verified, exact staging hostname(s) below.
  const APPROVED_STAGING_HOSTNAMES = [
    // OPERATOR ACTION REQUIRED UPON STAGING ATLAS PROVISIONING:
    // Enter the exact provisioned staging cluster hostname(s) here, e.g.:
    // "auctionx-staging-cluster.abc12.mongodb.net",
  ];

  if (!Array.isArray(APPROVED_STAGING_HOSTNAMES) || APPROVED_STAGING_HOSTNAMES.length === 0) {
    throw new Error(
      "ABORT: APPROVED_STAGING_HOSTNAMES is empty. Cleanup execution is strictly prohibited until an operator " +
      "explicitly configures the verified provisioned staging cluster hostname(s) in the allowlist."
    );
  }

  const parsedHosts = parseTargetHostnames(rawTarget);
  if (parsedHosts.length === 0) {
    throw new Error(
      "ABORT: Unable to parse a valid connection hostname from current target, or connection target is missing/unsupported. " +
      "Cleanup is strictly blocked. In mongosh, verify that db.getMongo()._uri or db.getMongo().host is populated and points " +
      "to the approved staging cluster. Only standard MongoDB URI formats (mongodb:// or mongodb+srv://) or direct host:port targets are supported. " +
      "Do not assume conn.host is the original SRV hostname or blindly allowlist unverified shard hosts."
    );
  }

  for (const host of parsedHosts) {
    if (!APPROVED_STAGING_HOSTNAMES.includes(host)) {
      throw new Error(
        `ABORT: Target host '${host}' is not in the approved staging hostname allowlist: ` +
        `[${APPROVED_STAGING_HOSTNAMES.join(", ")}]. Refusing to proceed.`
      );
    }
  }

  // 2. Mandatory Explicit Database Allowlist (Strict Case-Sensitive Equality)
  // Intentionally approved staging database name established in repository architecture
  const APPROVED_STAGING_DATABASES = ["Auction-X-Staging"];

  if (!APPROVED_STAGING_DATABASES.includes(currentDb)) {
    throw new Error(
      `ABORT: Database '${currentDb}' is not in the approved staging allowlist: [${APPROVED_STAGING_DATABASES.join(", ")}]. ` +
      `Cleanup is strictly blocked. Never execute reset commands on unapproved, production, or default databases.`
    );
  }

  print(`\n[Audit Check] Target database verified: '${currentDb}'`);
  print(`[Audit Check] Target host(s) verified against allowlist: ${parsedHosts.join(", ")}`);

  // 2. Pre-Deletion Record Count Preview (Fail-Closed)
  let preview;
  try {
    preview = {
      bids: db.bids.countDocuments(),
      orders: db.orders.countDocuments(),
      payments: db.payments.countDocuments(),
      webhookEvents: db.webhookevents.countDocuments(),
      demoProducts: db.products.countDocuments({ isDemo: true }),
      outboxDelivered: db.recommendationoutboxes ? db.recommendationoutboxes.countDocuments({ status: "DELIVERED" }) : 0,
      outboxPending: db.recommendationoutboxes ? db.recommendationoutboxes.countDocuments({ status: { $in: ["PENDING", "PROCESSING"] } }) : 0,
      outboxFailed: db.recommendationoutboxes ? db.recommendationoutboxes.countDocuments({ status: "FAILED" }) : 0,
    };
  } catch (queryErr) {
    throw new Error(`ABORT: Failed to collect pre-cleanup record counts: ${queryErr.message}. Halting cleanup.`);
  }

  print("\n--- [Pre-Cleanup Record Counts Preview] ---");
  printjson(preview);

  // 3. Unconditional In-Flight Outbox Abort Gate (No Bypass Permitted)
  if (preview.outboxPending > 0) {
    throw new Error(
      `ABORT: Found ${preview.outboxPending} PENDING/PROCESSING recommendation outbox events awaiting delivery. ` +
      `Cleanup is aborted unconditionally to prevent event loss and parent record orphaning. ` +
      `The operator must verify recommendation-service connectivity and allow the background outbox ` +
      `worker to safely drain all in-flight events before retrying this cleanup procedure.`
    );
  }
  print("✓ Outbox check passed: 0 pending/processing events in-flight.");

  // 4. Explicit Opt-In Confirmation Flag (Default: FALSE)
  // To authorize execution after reviewing the preview counts above, set this to true:
  const CONFIRM_STAGING_CLEANUP = false;

  if (CONFIRM_STAGING_CLEANUP !== true) {
    print("\nℹ️  PREVIEW ONLY: CONFIRM_STAGING_CLEANUP is set to false.");
    print("   No documents were modified or deleted. Set CONFIRM_STAGING_CLEANUP = true to proceed.\n");
    return;
  }

  // 5. Scoped Staging Deletion (Executed only with explicit confirmation and zero pending outbox events)
  print("\nExecuting authorized staging cleanup...");

  const resBids = db.bids.deleteMany({});
  const resOrders = db.orders.deleteMany({});
  const resPayments = db.payments.deleteMany({});
  const resWebhooks = db.webhookevents.deleteMany({});
  const resProducts = db.products.deleteMany({ isDemo: true });

  // Strictly purge historical delivered/failed staging outbox events; pending events were verified as 0
  let resOutbox = { deletedCount: 0 };
  if (db.recommendationoutboxes) {
    resOutbox = db.recommendationoutboxes.deleteMany({ status: { $in: ["DELIVERED", "FAILED"] } });
  }

  print("\n--- [Cleanup Execution Results] ---");
  printjson({
    bidsDeleted: resBids.deletedCount,
    ordersDeleted: resOrders.deletedCount,
    paymentsDeleted: resPayments.deletedCount,
    webhooksDeleted: resWebhooks.deletedCount,
    demoProductsDeleted: resProducts.deletedCount,
    deliveredOrFailedOutboxDeleted: resOutbox.deletedCount,
  });
  print("✓ Staging maintenance reset completed successfully.\n");
})();
```

---

## 8. Rollback & Emergency Procedures

If deployment encounters critical errors:
1. **Frontend Rollback:** In the hosting provider console, select the previous stable build and click **Rollback to this version**.
2. **Backend Rollback:** Revert environment variables or roll back container image to the prior stable SHA.
3. **Webhook Pause:** In the Razorpay Dashboard, toggle the webhook endpoint to **Inactive** to pause inbound webhooks during backend maintenance. Razorpay queues webhooks for up to 24 hours with exponential backoff.
4. **Order Reconciliation:** After backend restoration, the `reconcilePaymentStates` recurring worker automatically catches up un-settled orders.
