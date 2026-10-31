# AuctionX — Application Threat Model & Risk Analysis

> **Document Classification:** Security Architecture & Threat Analysis  
> **Status:** Active / Normative  
> **Methodology:** STRIDE / OWASP Top 10 Application Security Risks  
> **Last Verified:** October 2026  

---

## 1. Threat Modeling Scope & Assets

AuctionX processes competitive live bids, personal user identities, seller catalog assets, and financial payment settlement. Key protected assets include:

1. **Financial Integrity:** Buyer wallet balances, Razorpay transaction records, seller payouts.
2. **Auction Concurrency:** Sequence and validity of winning bids; immutability of concluded auction results.
3. **User Data & PII:** Buyer/seller emails, hashed passwords, phone numbers, addresses, OAuth identifiers.
4. **Platform Governance:** Administrative privileges, listing moderation statuses, account suspension flags.

---

## 2. STRIDE Threat Analysis Matrix

| Threat Category | Target Vector | Potential Impact | Implemented Mitigation | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing Identity** | Fake admin tokens / registration privilege escalation | Unprivileged user executes admin actions | Server enforces `role='user'` on registration; admin tokens validated against `Admin`/`User` DB collections. | **VERIFIED** (`adminFoundation.test.js`) |
| **Tampering with Data** | Razorpay checkout amount or webhook signature modification | Wallet credited without corresponding payment | Authoritative order creation in paise; HMAC-SHA256 signature verification on both client verify and webhooks. | **VERIFIED** (`stage4_payment_settlement.test.js`) |
| **Repudiation** | Denying placed bids or dispute resolutions | Unaccountable bids or destructive admin changes | Durable immutable `Bid` records with bidder IDs; administrative `AuditLog` records for all status updates. | **VERIFIED** (`adminStage7DisputeHold.test.js`) |
| **Information Disclosure** | IDOR on order endpoints or profile queries | Attacker inspects another user's invoice or PII | Server enforces owner check (`req.user.email === resource.email`); unverified callers receive 403 Forbidden. | **VERIFIED** (`idorAuthorization.test.js`) |
| **Denial of Service** | Sniping race conditions or brute force login | Server thread starvation or crushed auction | Anti-sniping dynamic soft-close (+2m cap +15m); `RateLimiter` on auth routes; atomic CAS MongoDB queries. | **VERIFIED** (`stage2_bidding_concurrency.test.js`) |
| **Elevation of Privilege** | Profile update with `{ role: 'admin' }` | Attacker gains administrative control | Mongoose update filters explicitly whitelist permitted fields; `role` field ignored in profile mutations. | **VERIFIED** (`adminFoundation.test.js`) |

---

## 3. High-Priority Threat Scenarios & Mitigations

### 3.1 Insecure Direct Object References (IDOR / BOLA)
- **Attack:** An authenticated user queries `/api/orders/:id` or sends `PATCH /api/auth/updateUserProfile/:email` with another user's ID or email.
- **Defense:** Express route controllers and `verifyOwnership` middleware strictly extract `req.user` from the validated JWT token and verify that `req.user.email.toLowerCase() === resource.email.toLowerCase()`.
- **Status:** Tested and verified across both user and seller route surfaces.

### 3.2 Bid Race Conditions & Price Sniping
- **Attack:** Automated bots submit simultaneous concurrent bids with the same amount in the final 500ms of an auction.
- **Defense:**
  1. Atomic Compare-And-Swap (CAS) in MongoDB ensures only the first bid matching the expected current price succeeds; conflicting bids fail fast with `409 Conflict`.
  2. Bids placed within the final 2 minutes dynamically extend the auction deadline by 2 minutes (up to a cumulative ceiling of +15 minutes).
- **Status:** Verified under concurrent simulated load tests.

### 3.3 Microservice Telemetry PII Leakage
- **Attack:** The recommendation microservice is queried or compromised to extract user purchase habits and email addresses.
- **Defense:**
  1. The Express proxy gate replaces raw user emails with HMAC-SHA256 pseudonyms (`RECOMMENDATION_HMAC_SECRET`).
  2. Internal communication requires `x-internal-service-key` authentication.
  3. Direct external browser access to the recommendation service is disabled in production via network isolation.
- **Status:** Verified in proxy integration suites.
