# AuctionX — Authentication, OAuth & Authorization Protocol

> **Document Classification:** Security & API Protocol  
> **Status:** Active / Normative  
> **Last Verified:** October 2026  

---

## 1. Authentication Mechanisms

AuctionX employs a multi-tiered identity verification architecture supporting email/password authentication, Google OAuth 2.0 federated login, and role-based access control (RBAC).

```mermaid
sequenceDiagram
    participant Browser as Browser Client
    participant Express as Express Gateway
    participant Mongo as MongoDB
    participant Google as Google Identity

    Note over Browser,Google: 1. CSRF Handshake
    Browser->>Express: GET /api/csrf-token
    Express-->>Browser: Set-Cookie: csrfToken=... + JSON { csrfToken }

    Note over Browser,Google: 2. Local Password Authentication
    Browser->>Express: POST /api/auth/login { email, password } + x-csrf-token
    Express->>Mongo: Query User by email
    Mongo-->>Express: User document with bcrypt password hash
    Express->>Express: Verify bcrypt hash & suspension status
    Express->>Express: Sign 256-bit JWT (HS256)
    Express-->>Browser: Set-Cookie: token=JWT (HttpOnly, SameSite)

    Note over Browser,Google: 3. Google OAuth 2.0 Federated Login
    Browser->>Express: GET /auth/google
    Express->>Google: Redirect with client_id, scope=email,profile
    Google-->>Browser: OAuth Consent Screen
    Browser->>Express: GET /auth/google/callback?code=...
    Express->>Google: Exchange code for OAuth token & profile
    Google-->>Express: Profile (email, name, photoURL)
    Express->>Mongo: Find or create User; retain googlePhoto
    Express-->>Browser: Set-Cookie: token=JWT; 302 Redirect to client
```

---

## 2. JWT Token Structure & Cookies

### 2.1 Claims Payload
Tokens are signed using `HS256` with `JWT_SECRET`:

```json
{
  "id": "670abc1234567890abcdef12",
  "email": "user@example.com",
  "name": "Jane Doe",
  "role": "user",
  "isNewUser": false,
  "iat": 1729180000,
  "exp": 1729266400
}
```

### 2.2 Cookie Configuration
- **Cookie Names:**
  - `token` — Primary session token for buyers/users.
  - `sellerToken` — Session token for marketplace sellers.
  - `adminToken` — Privileged session token for platform administrators.
- **Security Flags:**
  - `httpOnly: true` — Prevents JavaScript access (XSS mitigation).
  - `secure: true` in production (enforces HTTPS).
  - `sameSite: "Lax"` (same-site navigation) or `"None"` (when frontend/backend reside on separate origins).

### 2.3 Bearer Header Fallback
For programmatic clients or non-browser agents, endpoints accept standard HTTP headers:
```http
Authorization: Bearer <JWT_STRING>
```

---

## 3. Double-Submit CSRF Protection

All mutating HTTP verbs (`POST`, `PUT`, `PATCH`, `DELETE`) are guarded by `csrfProtection` middleware:

1. **Client Handshake:** The browser requests `GET /api/csrf-token`.
2. **Double-Submit Token:** The server generates a cryptographic token, setting both an `HttpOnly=false` cookie (`csrfToken`) and returning the token in the JSON response body.
3. **Mutation Header:** The client attaches `x-csrf-token: <TOKEN>` or `X-CSRF-Token` to mutating requests.
4. **Verification:** The server verifies that the header token matches the cookie token before processing the request.

---

## 4. Role-Based Access Control (RBAC) Matrix

| Resource Domain | Public / Guest | Authenticated User | Verified Seller | Administrator |
| :--- | :---: | :---: | :---: | :---: |
| **Catalog Browsing (`GET /api/products`)** | Allowed | Allowed | Allowed | Allowed |
| **Live Bidding (`POST /api/products/:id/bid`)** | Denied (401) | Allowed | Allowed | Allowed |
| **Product Creation (`POST /api/products`)** | Denied (401) | Denied (403) | Allowed | Allowed |
| **Own Profile (`PATCH /api/auth/updateUserProfile`)** | Denied (401) | Allowed | Allowed | Allowed |
| **Other User Profile (IDOR Check)** | Denied (401) | Denied (403) | Denied (403) | Allowed |
| **Admin Dashboard (`GET /api/admin/*`)** | Denied (401) | Denied (403) | Denied (403) | Allowed |
| **User Account Suspension (`PATCH /api/admin/users/:id/status`)** | Denied (401) | Denied (403) | Denied (403) | Allowed |
| **Listing Moderation (`PATCH /api/admin/listings/:id/moderate`)** | Denied (401) | Denied (403) | Denied (403) | Allowed |
| **Dispute Hold Execution (`POST /api/admin/disputes/:id/hold`)** | Denied (401) | Denied (403) | Denied (403) | Allowed |

---

## 5. Google OAuth 2.0 Production Federation, Proxy & Callback Architecture

AuctionX configures Passport with `passport-google-oauth20` in `server/src/infrastructure/security/passportGoogleStrategy.js`.

### 5.1 Reverse-Proxy Trust (`proxy: true`)
When deployed behind cloud reverse proxies (e.g. Render, Nginx, Cloudflare), incoming TLS traffic is terminated at the edge and forwarded to the Node.js application over internal HTTP.
- **The Problem:** Without proxy trust, Passport infers the redirect URI protocol from the internal socket (`http://`), producing a callback URL of `http://.../auth/google/callback`. Google Cloud OAuth strictly requires exact match against registered URIs, triggering Error 400: `redirect_uri_mismatch`.
- **The Hardening:** `GoogleStrategy` is configured with `proxy: true`. Express evaluates `X-Forwarded-Proto: https` from trusted edge proxies.

### 5.2 Canonical HTTPS Callback Resolution
The callback URL is resolved using deterministic precedence:
1. Explicit injection via `options.callbackURL` (unit testing).
2. Explicit `GOOGLE_CALLBACK_URL` from environment configuration.
3. Production canonical host: `https://${RENDER_EXTERNAL_URL}/auth/google/callback` or `https://auctionx-enhanced-live-server.onrender.com/auth/google/callback`.
4. Development fallback: `/auth/google/callback`.
5. Non-localhost production redirect URIs starting with `http://` are automatically normalized to `https://`.

### 5.3 Unconfigured Strategy Graceful Fallback
If `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is omitted at startup, `configureGoogleStrategy()` registers an `UnconfiguredGoogleStrategy`:
- **JSON Requests (API/mobile clients):** Returns HTTP 501 Not Implemented with a descriptive error message.
- **Browser User-Agent Requests:** Redirects user to `${CLIENT_URL}/login?error=oauth_unconfigured` without crashing the Express server.

---

## 6. Transactional Email & Multi-Tier OTP Verification Protocol

AuctionX implements three segregated OTP verification flows:
1. **User Registration Email Verification:** `POST /api/auth/user/send-otp` & `POST /api/auth/user/verify-otp`
2. **Seller Account Email Verification:** `POST /api/auth/seller/send-otp` & `POST /api/auth/seller/verify-otp`
3. **Login Two-Factor Authentication (2FA):** `POST /api/auth/2fa/send-otp` & `POST /api/auth/2fa/verify-otp`

### 6.1 Dual-Provider Delivery Infrastructure
- **Local Development (`EMAIL_PROVIDER=smtp`):** Dispatches OTPs via Nodemailer to local test SMTP or Gmail SMTP. In development, if credentials are unset, delivery failures log a diagnostic warning without blocking the user.
- **Production (`EMAIL_PROVIDER=resend`):** Dispatches OTPs via Resend HTTPS API using verified domain sender `AuctionX <notifications@mail.omslabs.tech>`. Delivery utilizes port 443 HTTPS REST calls, bypassing Render's outbound SMTP port blocking (ports 25, 465, 587).

### 6.2 Failure Semantics & Targeted OTP Cleanup
- **No Error Swallowing:** In production environments (`NODE_ENV === "production"` or `RENDER === "true"`), email delivery failures reject with HTTP 500 status code and diagnostic details. Returning false-positive HTTP 200s is strictly forbidden.
- **Targeted Document Deletion:** If email delivery throws an error after an OTP document is persisted in MongoDB, the catch handler deletes the record targeting its exact document `_id` (`Otp.deleteOne({ _id: otpDoc._id })`). This guarantees that concurrent valid OTPs created by the user in separate tabs or requests are never inadvertently wiped.
- **Non-Retry Invariant on OTP:** To protect users from receiving multiple duplicate OTP emails due to network jitter, the retry engine explicitly disables retries for OTP-category emails (`options.category !== "otp"`). Transient network retries with exponential backoff are reserved for non-OTP transactional notifications.
