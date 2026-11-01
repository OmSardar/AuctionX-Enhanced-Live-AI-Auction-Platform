# AuctionX — Deployment and Rollback Guide

This document describes the deployment architecture, continuous delivery pipelines, pre-flight gates, post-deployment smoke verification, and rollback procedures for AuctionX across all supported environments.

---

## 1. Deployment Topology & Environments

AuctionX supports three primary operational topologies:

| Environment | Host / Platform | Configuration | Purpose |
| :--- | :--- | :--- | :--- |
| **Local Development** | Docker Compose | `compose.yaml` | Local end-to-end integration with live reload, mock/local MongoDB and Redis |
| **Production Containerized** | Docker Compose / Swarm / ECS | `compose.prod.yaml` | Hardened, multi-stage production builds with non-root privileges and health checks |
| **Cloud Managed (PaaS)** | Render | `render.yaml` + GitHub Actions | Automated CI/CD pipeline deploying Docker Nginx frontend (same-origin proxy), Node.js backend, and FastAPI microservice |

```mermaid
graph LR
    subgraph VCS & CI/CD
        GH[GitHub main] --> CI[GitHub Actions CI]
        CI -->|Success on main| CD[GitHub Actions CD]
    end

    subgraph PaaS Staging / Production (Single Public Origin)
        Browser[Browser] -->|HTTPS: One Public Origin| R_Client[Render: auctionx-client<br/>Docker: Vite SPA + Nginx Proxy]
        R_Client -->|Render Private Network<br/>/api/* & /socket.io/*| R_Server[Render: auctionx-server<br/>Express + Socket.IO]
        CD -->|Deploy Hook| R_Client
        CD -->|Deploy Hook| R_Server
        CD -->|Deploy Hook| R_Rec[Render: auctionx-recommendation<br/>FastAPI]
    end

    subgraph Managed Cloud Services
        R_Server --> Atlas[(MongoDB Atlas)]
        R_Server --> RedisCloud[(Redis Cache / Broker)]
        R_Rec --> Atlas
        R_Rec --> RedisCloud
        R_Server --> RZP[Razorpay Payment Gateway]
    end
```

---

## 2. Infrastructure as Code: Render Configuration (`render.yaml`)

The platform defines three managed services in `render.yaml`:

1. **`auctionx-server` (Backend Web Service)**
   - **Runtime:** Node.js 20 (`node server.js`)
   - **Build Command:** `npm ci`
   - **Health Check Path:** `/` (returns `{ message: "Hello from backend!" }` with status 200)
   - **Replica Constraint (Single-Instance Requirement):**
     - **Replicas must be set to 1**. The backend must run as a single instance until distributed coordination is engineered.
     - **Scheduler Exclusivity Limitation:** The scheduler lock (`isProcessing`) is process-local in memory and does not guarantee cross-instance exclusivity. Multi-instance deployment causes redundant 5-second polling cycles.
     - **Socket.IO Cross-Instance Coordination:** Socket.IO runs on the default in-memory EventEmitter adapter. Multi-instance deployments require an external cross-instance pub/sub coordination layer, such as `@socket.io/redis-adapter`; without this, WebSocket clients connected to different server instances will not receive broadcast bid updates.
     - **Pre-Flight Operator Verification:** Operators must explicitly verify that the replica count is set to 1 in the cloud hosting dashboard before enabling production traffic.
     - **Non-Enforcement Notice:** These are operational deployment constraints, not proof that production hosting is already configured correctly. The application code does not enforce a singleton deployment at runtime.

2. **`auctionx-client` (Frontend Web Service with Nginx Reverse Proxy)**
   - **Runtime:** Docker Web Service (`client/Dockerfile`)
   - **Architecture:** Serves the production React/Vite SPA bundle via an internal Nginx web server configured as a single public origin reverse proxy.
   - **Same-Origin Reverse Proxy:** Routes all `/api/*`, `/socket.io/*`, and `/auth/*` traffic over Render's private network directly to the backend upstream service.
   - **Upstream Resolution:** Configured via `BACKEND_UPSTREAM_URL` (default: `http://auctionx-server:10000`). Validated at startup by `docker-entrypoint.sh` using fail-closed HTTP/HTTPS URL checks.
   - **Health Check Path:** `/healthz` (returns static HTTP 200 OK from Nginx).
   - **Build Arguments:** `VITE_API_URL` (empty `""` by default for same-origin relative `/api`), `VITE_RAZORPAY_API_KEY` (public key ID only).
   - **Security Policy:** No server-side secrets (`JWT_SECRET`, `RAZORPAY_KEY_SECRET`, etc.) may ever be passed to client build arguments or runtime environment variables.

3. **`auctionx-recommendation-service` (Recommendation Microservice)**
   - **Runtime:** Python 3.10 / FastAPI (`uvicorn main:app --host 0.0.0.0 --port 10000`)
   - **Health Check Path:** `/health` (returns `{ status: "healthy", ... }`)
   - **Network Exposure:** Can run as a private service behind the Express reverse proxy or public with strict HMAC/Bearer token authentication.

---

## 3. Continuous Delivery Pipeline (`cd.yml`)

Continuous delivery is orchestrated by `.github/workflows/cd.yml`:

- **Automatic Trigger:** Triggered automatically upon successful completion of the `AuctionX CI` workflow on the `main` branch (`workflow_run: completed`).
- **Manual Trigger:** Can be dispatched manually via `workflow_dispatch` with options:
  - `target_service`: `all`, `backend`, `frontend`, or `recommendation-service`
  - `dry_run`: `true` or `false` (validates configuration without triggering webhooks)
- **Deployment Mechanism:** Triggers Render Deploy Webhooks using repository secrets:
  - `RENDER_BACKEND_DEPLOY_HOOK`
  - `RENDER_FRONTEND_DEPLOY_HOOK`
  - `RENDER_RECOMMENDATION_DEPLOY_HOOK`

---

## 4. Pre-Flight Deployment Checklist

Before triggering a deployment, verify:

1. **CI Pipeline Clean:** All unit, smoke, graybox, acceptance, and build checks passed on `main`.
2. **Secrets Configured:**
   - [ ] `MONGODB_URL` configured with SSL/TLS enabled and authenticated user.
   - [ ] `JWT_SECRET` generated with at least 32 cryptographically secure random bytes.
   - [ ] `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` match intended environment (Test mode for staging; Live mode for production).
   - [ ] `RAZORPAY_WEBHOOK_SECRET` matches the webhook secret configured in the Razorpay Dashboard.
   - [ ] `INTERNAL_SERVICE_KEY` and `RECOMMENDATION_HMAC_SECRET` set and distinct.
   - [ ] `EMAIL_PROVIDER` explicitly set to `resend` on backend web service.
   - [ ] `RESEND_API_KEY` configured with production API key (`re_...`) corresponding to verified domain `mail.omslabs.tech`.
   - [ ] `EMAIL_FROM` configured to `AuctionX <notifications@mail.omslabs.tech>`.
   - [ ] `EMAIL_REPLY_TO` configured to `support@mail.omslabs.tech`.
   - [ ] `GOOGLE_CALLBACK_URL` configured to canonical HTTPS URL `https://<server-domain>/auth/google/callback` matching Google Cloud Console.
   - [ ] `NODE_ENV` set to `production`.
3. **Database Pre-requisites:**
   - Verify required indexes exist (e.g., unique index on `WebhookEvent.event_id`, compound indexes on `Bids`, `Products`, `Orders`).
   - MongoDB replica set is operational (required for transactions if replica set is configured).
4. **Instance & Scaling Pre-requisites:**
   - [ ] Backend web service replica count explicitly confirmed as `1` in hosting dashboard (single-instance constraint for scheduler & Socket.IO).
   - [ ] MongoDB deployment verified as an active Replica Set cluster (required for multi-document ACID transactions and atomic outbox event persistence).

---

## 5. Post-Deployment Verification (Smoke Tests)

Immediately after deployment completes, execute the following smoke verification sequence:

### 5.1 Frontend Nginx Health & SPA Routing Verification
```bash
# Verify Nginx proxy health check endpoint
curl -f -s -S https://<client-domain>/healthz
# Expected: OK (HTTP 200)

# Verify root HTML serves Vite bundle
curl -f -s -S -I https://<client-domain>/

# Verify SPA rewrite (nested route returns index.html, not 404)
curl -f -s -S -I https://<client-domain>/auctions/some-id
```

### 5.2 Same-Origin Reverse-Proxy API Verification
```bash
# Verify API proxy forwarding through Nginx client domain
curl -I https://<client-domain>/api/products
# Expected: HTTP 200 from backend Express server via Render private networking

# Verify CSRF token bootstrapping endpoint
curl -c cookies.txt -b cookies.txt https://<client-domain>/api/csrf-token
```

### 5.3 Backend Direct Health & API Verification (Private/Internal)
```bash
# Verify backend root health check (if exposed for direct health checks)
curl -f -s -S https://<server-domain>/

# Verify security headers (Helmet, CORS)
curl -I https://<server-domain>/api/products
```

Expected response headers:
- `x-content-type-options: nosniff`
- `x-frame-options: DENY` (or SAMEORIGIN)
- `access-control-allow-origin`: configured client origin

### 5.4 Recommendation Service Health Verification
```bash
curl -f -s -S https://<recommendation-domain>/health
# Expected: {"status":"healthy", ...}
```

### 5.5 Real-time Socket.IO Connection Test (Same-Origin)
Verify browser or client connection to `wss://<client-domain>/socket.io/?EIO=4&transport=websocket` via Nginx reverse proxy.

### 5.6 Transactional Email Health Verification
```bash
# Verify email subsystem reports healthy status and selects Resend in production
curl -f -s -S https://<server-domain>/health/email
# Expected JSON payload:
# {
#   "status": "healthy",
#   "provider": "resend",
#   "configured": true,
#   "environment": "production",
#   "from": "AuctionX <notifications@mail.omslabs.tech>"
# }
```

### 5.7 Google OAuth Redirect URI Resolution Verification
```bash
# Verify Google OAuth initiation returns 302 redirect with canonical HTTPS redirect_uri
curl -I https://<server-domain>/auth/google
# Verify the Location header starts with https://accounts.google.com/o/oauth2/v2/auth
# and includes redirect_uri=https%3A%2F%2F<server-domain>%2Fauth%2Fgoogle%2Fcallback
```

---

## 6. Rollback Procedures

If an incident or regression occurs post-deployment, follow these procedures based on deployment target:

### 6.1 Render PaaS Instant Rollback

1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Navigate to the affected service (`auctionx-server`, `auctionx-client`, or `auctionx-recommendation-service`).
3. Click on the **Events** or **Deploys** tab.
4. Locate the last known good deployment commit.
5. Click the three dots menu (`...`) on that deploy and select **Rollback to this deploy**.
6. Render will immediately re-activate the previous immutable build artifact without triggering a rebuild.

### 6.2 Docker Compose Rollback

For environments deployed via `compose.prod.yaml`:

```bash
# 1. Check current running container versions
docker compose -f compose.prod.yaml ps

# 2. Checkout the previous known-good git tag/commit
git checkout <previous-tag>

# 3. Rebuild and restart containers
docker compose -f compose.prod.yaml up -d --build --remove-orphans

# 4. Verify health checks pass
docker compose -f compose.prod.yaml ps
```

### 6.3 Database Rollback Safeguards

- **Never drop collections or delete data in response to an application regression.**
- Database schema changes in AuctionX are designed to be backward-compatible (non-destructive field additions).
- If a data migration was executed, refer to the specific migration's reverse script.
- If data corruption is suspected in staging, execute the dry-run guarded cleanup described in [`staging-deployment-runbook.md`](./staging-deployment-runbook.md). **Never execute automated cleanup on production.**

---

## 7. Incident Escalation & Triage Checklist

In the event of an unresolved critical deployment failure:

1. **Check Sentry / Error Monitoring:** Inspect recent uncaught exceptions.
2. **Inspect Server Logs:**
   - Render: Service dashboard -> **Logs** tab.
   - Docker: `docker compose -f compose.prod.yaml logs -f --tail=200 server`
3. **Verify Database Connectivity:** Ensure MongoDB Atlas IP access lists permit the deployment's egress IPs.
4. **Halt Automated CD:** If a regression is on `main`, temporarily disable GitHub Actions workflow or redeploy the stable commit while fixes are prepared in a hotfix branch.
