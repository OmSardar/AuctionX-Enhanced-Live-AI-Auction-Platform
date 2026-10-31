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
