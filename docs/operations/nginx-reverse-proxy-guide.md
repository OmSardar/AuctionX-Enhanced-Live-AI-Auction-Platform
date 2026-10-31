# AuctionX — Nginx Same-Origin Reverse Proxy Guide

> **Document Classification:** Operations & Infrastructure  
> **Status:** Active / Normative  
> **Target Platform:** Render Cloud PaaS (Docker Web Service)  
> **Last Verified:** October 2026  

---

## 1. Overview & Architectural Motivation

In modern cloud deployments (such as Render), running the frontend as a static CDN site and the backend as a distinct web service creates a **cross-site (split-origin)** topology:
- Frontend Origin: `https://auctionx-client.onrender.com`
- Backend Origin: `https://auctionx-server.onrender.com`

Because `auctionx-client.onrender.com` and `auctionx-server.onrender.com` are distinct public origins on Render's public suffix (`.onrender.com`), browsers treat API requests between them as cross-site. This leads to:
1. **Third-Party Cookie Restrictions:** Browsers partition or block cross-site cookies, risking authentication session loss if cookies are not partitioned with `SameSite=None; Secure`.
2. **CORS Preflight Overhead:** State-changing requests (`POST`, `PUT`, `DELETE`) with custom headers like `x-csrf-token` trigger an HTTP `OPTIONS` preflight round-trip on every call.
3. **Complex CSRF Exchange:** The double-submit CSRF cookie pattern requires cross-site credentialed exchange.

### The Single Public Origin Solution

The **Nginx Same-Origin Reverse Proxy** unifies the public browser footprint into a **single public origin**:

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

### Key Benefits
- **Zero Cross-Site Cookie Issues:** All browser requests to `/api/*` are same-origin (`window.location.origin`). Cookies (`token`, `_csrf`) are first-party and avoid third-party cookie blocking.
- **Eliminated CORS Preflights for Same-Origin Traffic:** Same-origin requests do not trigger CORS preflight checks.
- **Secure Backend Isolation:** The Express backend does not need to expose a public API endpoint to browsers; it communicates with Nginx over Render's private network.
- **Preserved Real-time Bidding:** Nginx upgrades WebSocket connections on `/socket.io/` with dedicated timeouts (86,400s) to prevent idle disconnections.

---

## 2. Render Service Topology & Configuration

### 2.1 Service Specifications

| Service Name | Render Service Type | Runtime Environment | Public Exposure | Health Check Path | Port |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`auctionx-client`** | Web Service | Docker (`client/Dockerfile`) | **Yes (Public Entry Point)** | `/healthz` | `10000` |
| **`auctionx-server`** | Web Service | Native Node (`node server.js`) | Private / Restricted | `/` | `10000` |
| **`auctionx-recommendation-service`** | Web Service | Native Python (`uvicorn`) | Private / Internal | `/health` | `10000` |

### 2.2 Infrastructure as Code (`render.yaml`)

The frontend service definition in `render.yaml` is configured as a Docker Web Service:

```yaml
services:
  - type: web
    name: auctionx-client
    env: docker
    plan: starter
    rootDir: client
    dockerfilePath: Dockerfile
    healthCheckPath: /healthz
    envVars:
      - key: PORT
        value: 10000
      - key: BACKEND_UPSTREAM_URL
        value: http://auctionx-server:10000
      - key: VITE_API_URL
        value: ""
      - key: VITE_RAZORPAY_API_KEY
        sync: false
```

---

## 3. Environment Variable Specification

### 3.1 Nginx Frontend Service (`auctionx-client`)

| Variable Name | Required | Default / Staging Value | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | Yes | `10000` | HTTP listener port assigned by Render. |
| `BACKEND_UPSTREAM_URL` | Yes | `http://auctionx-server:10000` | Runtime backend upstream address for Nginx reverse proxy. Uses Render's private service DNS. |
| `VITE_API_URL` | Optional | `""` (empty string) | Vite build argument. When empty, frontend API helpers use relative paths (`/api`). |
| `VITE_RAZORPAY_API_KEY` | Yes (Owner) | *(Owner-supplied public key)* | Razorpay public key ID (`rzp_test_...` or `rzp_live_...`) for checkout modal. |

### 3.2 Backend Express Service (`auctionx-server`)

| Variable Name | Required | Example / Notes |
| :--- | :--- | :--- |
| `PORT` | Yes | `10000` (Assigned by Render) |
| `CLIENT_URL` | Yes | Public origin of the frontend (e.g. `https://auctionx-client.onrender.com` or custom domain). Used for CORS validation, auth cookie domain, and OAuth redirects. |
| `MONGODB_URL` | Yes (Owner) | MongoDB Atlas connection string with target database name. |
| `JWT_SECRET` | Yes (Owner) | Cryptographically secure 256-bit secret (>= 32 chars). |
| `RAZORPAY_KEY_ID` | Yes (Owner) | Razorpay public Key ID. |
| `RAZORPAY_KEY_SECRET` | Yes (Owner) | Razorpay Key Secret (strictly backend confidential). |
| `RAZORPAY_WEBHOOK_SECRET` | Yes (Owner) | Razorpay webhook signing secret. |
| `INTERNAL_SERVICE_KEY` | Yes (Owner) | Microservice shared secret for recommendation proxy. |
| `RECOMMENDATION_HMAC_SECRET` | Yes (Owner) | Microservice HMAC secret for user pseudonymization. |

---

## 4. Nginx Routing & Proxy Mechanics

The Nginx configuration template (`client/nginx.conf.template`) implements distinct routing tiers:

### 4.1 Frontend Static Assets & SPA Routing
- **Document Root:** `/usr/share/nginx/html`
- **SPA Fallback:** `try_files $uri $uri/ /index.html;` ensures React Router client-side routes (e.g., `/auctions/:id`, `/admin/users`) load `index.html`.
- **Cache Control:**
  - `index.html` and root routes serve `Cache-Control: "no-cache, no-store, must-revalidate"` so deployments take effect immediately.
  - Fingerprinted static assets (`/assets/*.js`, `/assets/*.css`, images, fonts) serve `Cache-Control: "public, max-age=31536000, immutable"`.
  - Static asset requests that do not exist return an immediate 404 rather than falling back to the API.

### 4.2 Health Check Endpoint
- **Path:** `/healthz`
- **Behavior:** Returns HTTP 200 with text payload `OK` and `Content-Type: text/plain`.
- **Purpose:** Used by Render container orchestrator to assess container readiness without hitting backend or database resources.

### 4.3 Backend API Routes (`/api/`)
- **Upstream Forwarding:**
  ```nginx
  location /api/ {
      proxy_pass ${BACKEND_UPSTREAM_URL};
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $forwarded_proto;

      # Disable caching for authenticated & state-changing API endpoints
      add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;

      # Compatible timeouts and request body limits
      client_max_body_size 10M;
      proxy_connect_timeout 60s;
      proxy_send_timeout 60s;
      proxy_read_timeout 60s;
  }
  ```
- **URI Preservation:** In Nginx, `proxy_pass ${BACKEND_UPSTREAM_URL};` without a trailing path preserves the original URI (`/api/products` $\to$ `http://auctionx-server:10000/api/products`).
- **No Double-Prefixing:** The frontend Axios helper normalizes requests so that calling `axiosWithAuth.get("/api/products")` or `axiosWithAuth.get("/products")` always resolves to `/api/products` when `baseURL: "/api"`.

### 4.4 Real-time Socket.IO Routes (`/socket.io/`)
- **Upstream Forwarding:**
  ```nginx
  location /socket.io/ {
      proxy_pass ${BACKEND_UPSTREAM_URL};
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $forwarded_proto;

      # Long-lived WebSocket timeouts
      proxy_read_timeout 86400s;
      proxy_send_timeout 86400s;
  }
  ```
- **Connection Upgrade:** Evaluated via connection upgrade map:
  ```nginx
  map $http_upgrade $connection_upgrade {
      default upgrade;
      ''      close;
  }
  ```
  This cleanly supports both HTTP long-polling initial handshakes and subsequent WebSocket upgrades without dropping connections.

### 4.5 OAuth Routes (`/auth/`)
- **Upstream Forwarding:** Passes Google OAuth routes (`/auth/google`, `/auth/google/callback`) directly to the backend Express server.

### 4.6 Protocol Forwarding & Cloud TLS Termination
- On Render, TLS is terminated at the edge router. Inbound requests to the container arrive over plain HTTP from the platform edge proxy, but include `X-Forwarded-Proto: https`.
- The Nginx template preserves this via:
  ```nginx
  map $http_x_forwarded_proto $forwarded_proto {
      default $http_x_forwarded_proto;
      ''      $scheme;
  }
  ```
  This ensures the backend Express server (via `app.set("trust proxy", 1)`) accurately detects that the original client request was secure (`req.secure === true`).

---

## 5. Container Lifecycle & Fail-Closed Validation

The frontend container uses `client/docker-entrypoint.sh` to validate the environment before launching Nginx:

1. **Port Fallback:** Defaults `PORT` to `80` if unset.
2. **Upstream Presence Check:** Fails immediately with exit code 1 if `BACKEND_UPSTREAM_URL` is empty.
3. **URL Format Check:** Fails immediately with exit code 1 if `BACKEND_UPSTREAM_URL` does not start with `http://` or `https://`.
4. **Controlled Environment Substitution:** Uses `envsubst '${PORT} ${BACKEND_UPSTREAM_URL}'` to replace only authorized tokens in `/etc/nginx/templates/default.conf.template`, avoiding arbitrary shell evaluation.
5. **Syntax Validation:** Executes `nginx -t` to verify the generated configuration before starting.
6. **Process Replacement:** Replaces the shell process with `exec nginx -g "daemon off;"`.

---

## 6. Local Development vs. Production Topology

| Aspect | Local Development | Local Docker Compose (`compose.prod.yaml`) | Production Render PaaS |
| :--- | :--- | :--- | :--- |
| **Frontend Host** | Vite Dev Server (`localhost:5173`) | Nginx container (`localhost:3000`) | Nginx Docker Web Service (`10000`) |
| **Backend Host** | Express Server (`localhost:5000`) | Server container (`server:5000`) | Render Web Service (`auctionx-server:10000`) |
| **Dev Proxy Mechanism** | Vite internal proxy (`vite.config.js`) | Nginx reverse proxy container | Nginx reverse proxy container |
| **API Path Structure** | Same-origin `/api/*` | Same-origin `/api/*` | Same-origin `/api/*` |
| **Real-time Path Structure** | Same-origin `/socket.io/*` | Same-origin `/socket.io/*` | Same-origin `/socket.io/*` |
| **Backend Port Exposure** | Exposed on `5000` | Internal only (unexposed) | Private network only |

---

## 7. Verification Procedures

### 7.1 Local Configuration & Syntax Validation

To validate the Nginx configuration syntax locally:
```bash
# Test with a local Nginx installation (if available):
nginx -t -c client/nginx.conf

# Test template substitution logic using bash/sh:
PORT=10000 BACKEND_UPSTREAM_URL="http://auctionx-server:10000" envsubst '${PORT} ${BACKEND_UPSTREAM_URL}' < client/nginx.conf.template > /tmp/test-nginx.conf
```

### 7.2 Post-Deployment Smoke Verification

Execute the following checks against the public frontend origin (`https://<client-domain>`):

```bash
# 1. Verify Nginx health check returns HTTP 200
curl -f -s -S https://<client-domain>/healthz
# Expected: OK

# 2. Verify SPA root HTML delivery
curl -f -s -S -I https://<client-domain>/
# Expected: HTTP 200 with text/html and no-cache header

# 3. Verify SPA client-side route fallback
curl -f -s -S -I https://<client-domain>/auctions/active
# Expected: HTTP 200 serving index.html

# 4. Verify API reverse-proxy forwarding
curl -f -s -S -I https://<client-domain>/api/products
# Expected: HTTP 200 from backend Express server

# 5. Verify CSRF token bootstrapping
curl -s -i -c /tmp/cookies.txt https://<client-domain>/api/csrf-token
# Expected: HTTP 200 with X-CSRF-Token and Set-Cookie: _csrf=...

# 6. Verify static assets return 404 for missing files (not SPA fallback)
curl -s -I https://<client-domain>/assets/nonexistent-file.js
# Expected: HTTP 404 Not Found
```

### 7.3 Interactive Browser Verification

After an authorized deployment, complete the following browser verification checklist:
1. **Login Flow:** Open `https://<client-domain>/login`, enter credentials, and confirm successful login. Verify in DevTools Application tab that the `token` cookie is set as `HttpOnly`, `Secure`, and `SameSite=Lax` under the same domain.
2. **CSRF-Protected Write:** Submit a bid, create a listing, or update user profile. Verify the `x-csrf-token` header is attached and the request succeeds with HTTP 200/201.
3. **File Upload:** Upload an auction product image. Verify the multipart form upload passes through Nginx without 413 (Payload Too Large) or timeout errors.
4. **Real-time Bidding:** Open two browser windows on an active auction page. Place a bid in Window 1 and verify Window 2 updates instantaneously via WebSocket (`/socket.io/`).
5. **Logout Flow:** Click Logout. Verify the `token` cookie is cleared and redirected to the login page.

---

## 8. Rollback Procedures

If issues arise with the Nginx reverse-proxy deployment on Render:

1. **Instant Rollback via Dashboard:**
   - Go to Render Dashboard $\to$ `auctionx-client` $\to$ **Deploys**.
   - Select the last known good deployment and click **Rollback to this deploy**.
2. **Split-Origin Fallback Configuration:**
   - If Nginx routing needs to be bypassed temporarily, rebuild the client with `VITE_API_URL=https://<server-domain>` to revert to split-origin communication.
   - Note that split-origin requires restoring cross-site cookie settings on the backend (`SameSite=None; Secure`).
3. **Local Compose Rollback:**
   ```bash
   git checkout <stable-commit>
   docker compose -f compose.prod.yaml up -d --build
   ```

---

## 9. Remaining Owner-Supplied Values & Deployment Prerequisites

The following values cannot be committed to source control and must be supplied by the project owner in the Render platform dashboard:

1. **`VITE_RAZORPAY_API_KEY`:** Public Key ID from Razorpay Dashboard.
2. **`MONGODB_URL`:** Production MongoDB Atlas connection string.
3. **`JWT_SECRET`:** 256-bit cryptographically secure random secret.
4. **`RAZORPAY_KEY_SECRET` & `RAZORPAY_WEBHOOK_SECRET`:** Razorpay backend credentials.
5. **`INTERNAL_SERVICE_KEY` & `RECOMMENDATION_HMAC_SECRET`:** Microservice security keys.
6. **Confirmed Service Hostnames:** Confirmation that `BACKEND_UPSTREAM_URL` matches the exact Render private service name (default: `http://auctionx-server:10000`).
