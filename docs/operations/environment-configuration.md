# AuctionX — Environment Configuration Catalog

> **Document Classification:** Operations & Infrastructure  
> **Status:** Active / Normative  
> **Last Verified:** October 2026  

---

## 1. Master Environment Variable Catalog

This document defines every configuration variable used across the AuctionX monorepo, its target subsystem, whether it is sensitive, and its default fallback behavior.

| Variable Name | Subsystem | Classification | Description | Default / Example |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Backend, Client | Public | Runtime environment mode (`development`, `staging`, `production`, `test`). | `development` |
| `PORT` | Backend, Rec | Public | HTTP port for service listener. | `5000` (server), `8000` (rec) |
| `MONGODB_URL` | Backend | Sensitive | MongoDB connection string including database name path. | `mongodb://127.0.0.1:27017/Auction-X` |
| `MONGODB_URI` | Rec Service | Sensitive | MongoDB cluster URI without database path (for PyMongo). | `mongodb://127.0.0.1:27017` |
| `MONGODB_DB` | Rec Service | Public | Shared database name. | `Auction-X` |
| `REDIS_URL` | Rec Service | Sensitive | Redis connection URI with authentication credentials. | `redis://127.0.0.1:6379/0` |
| `REDIS_PASSWORD` | Docker Redis | Critical Secret | 64-character hexadecimal authentication password for Redis. | *No default; required in prod* |
| `JWT_SECRET` | Backend | Critical Secret | Cryptographic 256-bit secret for signing/verifying authentication JWTs. | *Minimum 32 chars long* |
| `RECOMMENDATION_HMAC_SECRET` | Backend, Rec | Critical Secret | 256-bit secret used to generate pseudonymous user hashes for telemetry. | *Minimum 32 chars long* |
| `INTERNAL_SERVICE_KEY` | Backend, Rec | Critical Secret | Secret key passed in `x-internal-service-key` header to authenticate proxy. | *Minimum 32 chars long* |
| `CLIENT_URL` | Backend, Rec | Public | Deployed frontend origin without trailing slash (used for CORS & cookies). | `http://localhost:5173` |
| `RECOMMENDATION_SERVICE_URL` | Backend | Public | Target URL for backend recommendation proxy gateway. | `http://localhost:8000` |
| `VITE_API_URL` | Client | Public | Backend API URL injected into React bundle at build time. Leave empty in production to use same-origin relative `/api`. | `http://localhost:5000` (dev) / `""` (prod) |
| `BACKEND_UPSTREAM_URL` | Client / Nginx | Public | Runtime backend upstream address for Nginx reverse proxy (Render private network or internal Docker address). | `http://auctionx-server:10000` |
| `VITE_RECOMMENDATION_API_URL` | Client | Public | Optional direct recommendation URL. Leave empty in prod to route via proxy. | `http://localhost:8000/api` |
| `RAZORPAY_KEY_ID` | Backend | Public ID | Razorpay Key ID (e.g. `rzp_test_...` or `rzp_live_...`). | `rzp_test_your_key_id` |
| `RAZORPAY_KEY_SECRET` | Backend | Critical Secret | Razorpay Key Secret. Strictly backend confidential — never expose to client. | *Must be kept confidential* |
| `RAZORPAY_WEBHOOK_SECRET` | Backend | Critical Secret | Secret for HMAC-SHA256 verification of Razorpay webhook events. | *Must be kept confidential* |
| `VITE_RAZORPAY_API_KEY` | Client | Public ID | Public Key ID supplied to browser Razorpay checkout modal. | `rzp_test_your_key_id` |
| `GOOGLE_CLIENT_ID` | Backend | Public ID | Google OAuth 2.0 Client ID registered in Google Cloud Console. | *Optional in development* |
| `GOOGLE_CLIENT_SECRET` | Backend | Sensitive | Google OAuth 2.0 Client Secret for exchanging authorization codes. | *Optional in development* |
| `GOOGLE_CALLBACK_URL` | Backend | Public | Authorized redirect callback URL registered in Google Cloud Console. | `http://localhost:5000/auth/google/callback` (dev) / `https://auctionx-enhanced-live-server.onrender.com/auth/google/callback` (prod) |
| `EMAIL_PROVIDER` | Backend | Public | Email delivery provider (`smtp` for Nodemailer or `resend` for Resend HTTPS API). Defaults to `smtp` in dev, `resend` in prod. | `smtp` (dev) / `resend` (prod) |
| `RESEND_API_KEY` | Backend | Critical Secret | Production API key for Resend transactional email API (`re_...`). | *Must be kept confidential* |
| `EMAIL_FROM` | Backend | Public | Default sender display name and email address matching verified sending domain DNS. | `AuctionX <notifications@mail.omslabs.tech>` |
| `EMAIL_REPLY_TO` | Backend | Public | Inbound reply recipient address for user inquiries and support routing. | `support@mail.omslabs.tech` |
| `EMAIL_USER` | Backend | Sensitive | SMTP username / sender address for local Nodemailer OTP delivery. | `notifications@auctionx.com` |
| `EMAIL_PASS` | Backend | Sensitive | SMTP application password for Nodemailer transporter. | *App-specific password* |
| `METRICS_AUTH_TOKEN` | Backend | Sensitive | Bearer token required to access Prometheus `/metrics` endpoint in production. | *Must be kept confidential* |
| `CLOUDINARY_CLOUD_NAME` | Backend | Public | Cloudinary cloud account name for media asset uploads. | *Optional in development* |
| `CLOUDINARY_API_KEY` | Backend | Sensitive | Cloudinary API Key. | *Optional in development* |
| `CLOUDINARY_API_SECRET` | Backend | Sensitive | Cloudinary API Secret. | *Optional in development* |
| `SCHEDULER_INTERVAL_MS` | Backend | Public Tuning | Lifecycle scheduler evaluation interval in milliseconds. | `5000` |
| `SCHEDULER_BATCH_SIZE` | Backend | Public Tuning | Maximum auctions evaluated per batch cycle. | `50` |

---

## 2. Environment Templates Location

- Monorepo root: [`.env.example`](../../.env.example)
- Production Docker: [`.env.docker.example`](../../.env.docker.example)
- Backend server: [`server/.env.example`](../../server/.env.example)
- Client frontend: [`client/.env.example`](../../client/.env.example)
- Recommendation microservice: [`recommendation_service/.env.example`](../../recommendation_service/.env.example)

---

## 3. Subsystem-Specific Configuration & Failure Semantics

### 3.1 Email Infrastructure Configuration (Local vs Production)
AuctionX employs a dual-provider email delivery architecture configured in `server/src/common/utilities/email/emailConfig.js`:

| Environment | Configured Provider | Required Variables | Failure Behavior if Missing / Inaccessible |
| :--- | :--- | :--- | :--- |
| **Local Development** | `EMAIL_PROVIDER=smtp` | `EMAIL_USER`, `EMAIL_PASS` | Nodemailer transporter initialization logs warning in non-production. Simulated fallback operates without blocking local development. |
| **Production (Render)** | `EMAIL_PROVIDER=resend` | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Throws configuration error at startup if `RESEND_API_KEY` is missing. Throws explicit error if `EMAIL_PROVIDER=smtp` is set on Render (outbound SMTP ports 25, 465, and 587 are blocked by Render network policy). |

- **Automatic Runtime Auto-Detection:** The backend checks `isProductionEnvironment()`, detecting `NODE_ENV === "production"`, `ENVIRONMENT === "production"`, `RENDER === "true"`, `RENDER_EXTERNAL_URL`, or `RENDER_SERVICE_ID`. If `EMAIL_PROVIDER` is omitted, the runtime defaults to `resend` if `RESEND_API_KEY` is present or if executing within Render.
- **Fail-Safe Controller Handling:** In production, failed email dispatch rejects with HTTP 500 and deletes the stale OTP record by `_id`, allowing the client to re-request immediately without collision. Swallowing delivery errors is strictly disabled in production.
- **Observability:** Non-sensitive runtime email health can be probed via `GET /health/email` or `GET /api/health/email`.

### 3.2 Google OAuth Reverse-Proxy & Redirect Resolution
- **Proxy Trust Requirement:** Because PaaS providers (such as Render) terminate TLS at their edge reverse proxies and forward traffic over plain HTTP to internal web service containers, Passport `GoogleStrategy` requires `proxy: true` in `server/src/infrastructure/security/passportGoogleStrategy.js`.
- **Canonical Callback Resolution:**
  1. Explicit injection via `options.callbackURL` (unit test isolation).
  2. Value of `GOOGLE_CALLBACK_URL` from the environment.
  3. Canonical production host: `https://${RENDER_EXTERNAL_URL}/auth/google/callback` or `https://auctionx-enhanced-live-server.onrender.com/auth/google/callback`.
  4. Non-localhost production redirect URIs starting with `http://` are automatically normalized to `https://` to avoid Google OAuth Error 400 `redirect_uri_mismatch`.

### 3.3 Dashboard Secrets vs Blueprint Setting Separation
In the Render hosting infrastructure (`render.yaml`), settings marked with `sync: false` represent confidential secrets that must be manually configured in the Render Dashboard:
- `JWT_SECRET`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `RESEND_API_KEY` (must match verified domain key, format `re_...`)
- `GOOGLE_CLIENT_SECRET`
- `METRICS_AUTH_TOKEN`
Non-sensitive configuration (`EMAIL_PROVIDER: resend`, `EMAIL_FROM`, `GOOGLE_CALLBACK_URL`, `NODE_ENV: production`) is codified within `render.yaml`.
