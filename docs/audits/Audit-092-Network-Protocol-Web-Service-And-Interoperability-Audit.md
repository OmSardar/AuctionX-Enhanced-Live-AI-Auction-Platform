# Audit 092 — Complete Network Protocol, Web-Service & Interoperability Audit

**Date:** 2026-10-24  
**Auditor:** Antigravity Engineering (Google DeepMind Advanced Agentic Coding)  
**Target:** AuctionX Network Protocols, Web-Services, Transports, API Security & Interoperability  
**Status:** Verified & Documented

---

## 1. Executive Summary

AuctionX implements a modern, resilient, production-ready web application architecture utilizing **HTTP/1.1, HTTP/2 (via Nginx/Cloudflare reverse proxy), WebSockets (Socket.IO v4.8), REST over JSON, GraphQL (selective administrative telemetry), OAuth 2.0 / OpenID Connect (Google Auth), and SMTP (Nodemailer)**.

A rigorous, file-level audit of the entire codebase confirms that **SOAP 1.1 and SOAP 1.2 are entirely absent from AuctionX and are not required by any business requirement, user workflow, or external integration**. All payment processing, image delivery, OAuth flows, and microservice communications rely on modern REST/JSON APIs (Razorpay, Cloudinary, Google OAuth 2.0, FastAPI).

Furthermore, the server's body parsing configuration strictly parses JSON and URL-encoded forms, inherently immunizing the application against XML External Entity (XXE) and XML bomb attacks.

---

## 2. Protocol Inventory Table

| Protocol / Standard | Expected Purpose in AuctionX | Evidence of Implementation | Verification Performed | Status | Required Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **HTTP / HTTPS** | Primary transport for client-server communication, static assets, and REST APIs. | Express 4.21 `http.createServer(app)` in [`server/server.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/server.js); Nginx Alpine template in [`client/nginx.conf.template`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/nginx.conf.template). | Automated tests in [`server/tests/nonfunctional/securityHeaders.test.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/tests/nonfunctional/securityHeaders.test.js); HSTS and security header assertions. | **Implemented & Verified** | Maintain Nginx TLS termination in production. |
| **TLS Configuration & Secure Transport** | Encrypt traffic in transit; enforce HSTS and secure cookies. | Nginx config sets `$http_x_forwarded_proto`; Helmet sets `Strict-Transport-Security` (`maxAge: 31536000, includeSubDomains: true, preload: true`). | Verified via unit tests (`securityHeaders.test.js`); `trust proxy` configuration verified in `stage7_44_securityFindingsClosure.test.js`. | **Implemented & Verified** | Ensure production edge (Cloudflare/Certbot) enforces TLS 1.2/1.3. |
| **REST over HTTP (JSON)** | Core API communication for buyer, seller, admin, catalog, orders, and subscriptions. | Express route mounts across `/api/*`, JSON error handling, status codes (200, 201, 400, 401, 403, 404, 409, 429, 500). | Verified via [`server/tests/nonfunctional/apiContract.test.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/tests/nonfunctional/apiContract.test.js) (8/8 passed). | **Implemented & Verified** | None. Standard REST contract fully established. |
| **SOAP 1.1** | Legacy XML-RPC web service standard (`text/xml`). | No SOAP handlers, WSDLs, or envelope parsers exist in repo or dependencies. | Probed `POST /soap` with SOAP 1.1 payload in [`server/tests/nonfunctional/protocolInteroperability.test.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/tests/nonfunctional/protocolInteroperability.test.js); returns 403 (no CSRF) or 404 (with CSRF). | **Absent (Not Required)** | Do not implement. No business requirement exists. |
| **SOAP 1.2** | Legacy XML-RPC web service standard (`application/soap+xml`). | No SOAP 1.2 handlers, bindings, or WSDLs exist. | Probed `POST /api/soap` with SOAP 1.2 payload; returns 404 Not Found. Tested in `protocolInteroperability.test.js`. | **Absent (Not Required)** | Do not implement. No business requirement exists. |
| **WebSocket / WSS** | Real-time live bidding, auction state sync, countdown countdowns, and room broadcasts. | Socket.IO v4.8 mounted on HTTP server; [`server/controllers/OtherControllers/SocketController.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/OtherControllers/SocketController.js); Nginx proxy upgrade mapping. | Verified via [`server/tests/integration/socket/biddingSocket.test.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/tests/integration/socket/biddingSocket.test.js) and `socketController.test.js`. | **Implemented & Verified** | None. Handshake authentication and room isolation verified. |
| **OAuth 2.0 & OIDC** | Social login via Google Identity Services. | `passport-google-oauth20` and `google-auth-library` in [`server/utlis/Auth2.0/passportGoogleStrategy.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/utlis/Auth2.0/passportGoogleStrategy.js). | Verified via [`server/tests/integration/auth/googleOAuthAndMfaRemediation.test.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/tests/integration/auth/googleOAuthAndMfaRemediation.test.js) and `passportGoogleStrategy.test.js`. | **Implemented & Verified** | Maintain valid `GOOGLE_CLIENT_ID` and secret in production. |
| **JWT & Session Security** | Stateless authentication tokens and cookie security. | `jsonwebtoken` issuing role-scoped tokens (`user_session`, `seller_session`), dual cookies (`token`, `sellerToken`), 24h expiration. | Verified via [`server/tests/unit/middleware/authUserMiddleware.test.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/tests/unit/middleware/authUserMiddleware.test.js) and `stage7_44_securityFindingsClosure.test.js`. | **Implemented & Verified** | None. Cross-role token elevation explicitly blocked. |
| **CORS & CSRF Controls** | Prevent Cross-Origin resource leaks and Cross-Site Request Forgery. | CORS origin allowlisting; double-submit cookie CSRF middleware in [`server/middleware/csrfMiddleware.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/server.js#L306-L309) with timing-safe comparison. | Verified via [`server/tests/integration/security/csrfAndSecurity.test.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/tests/integration/security/csrfAndSecurity.test.js) and `protocolInteroperability.test.js`. | **Implemented & Verified** | None. Webhooks safely bypass CSRF via HMAC validation. |
| **Payment Gateway & Webhooks** | Process buyer orders and seller subscriptions; verify webhooks. | Razorpay HTTP API client; HMAC-SHA256 signature verification over raw request buffers in [`server/services/paymentService.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/services/paymentService.js). | Verified via [`server/tests/unit/stage4_payment_settlement.test.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/tests/unit/stage4_payment_settlement.test.js) and `stage5_end_to_end_settlement.test.js` (44/44 passed). | **Implemented & Verified** | Ensure webhook secret is configured in production. |
| **SMTP / Email Delivery** | Send email OTPs, password resets, contact messages, and notifications. | Nodemailer v6.9 in [`server/utlis/Others/NodeMailer.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/utlis/Others/NodeMailer.js) and `emailSender.js`. | Verified via [`server/tests/unit/utils/emailSender.test.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/tests/unit/utils/emailSender.test.js). | **Implemented & Verified** | Configure production SMTP credentials. |
| **DNS & Deployment Config** | Domain routing, reverse proxy, Docker containerization. | Nginx reverse proxy configuration template, Dockerfiles for client, server, and recommendation service. | Docker compose and Nginx configuration templates inspected in repo. | **Configured Externally** | Verify production DNS A/CNAME and SSL cert renewal. |
| **XML & File Upload Safeguards** | Prevent XXE, unconstrained file uploads, and malicious payload execution. | Express registers only JSON and URL-encoded parsers; image uploads processed with Sharp sanitization & signature sniffing. | Verified via [`server/tests/integration/media/fileUpload.test.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/tests/integration/media/fileUpload.test.js) and `protocolInteroperability.test.js`. | **Implemented & Verified** | None. XML is never parsed; image uploads strictly validated. |
| **GraphQL** | High-performance admin analytics and telemetry composite queries. | GraphQL v16 on `POST /api/graphql` in [`server/graphql/graphqlHandler.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/graphql/graphqlHandler.js). | Verified via [`server/tests/unit/graphql/graphqlAdmin.test.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/tests/unit/graphql/graphqlAdmin.test.js) and `stage7_43_securityHardening.test.js`. | **Implemented & Verified** | Max depth (6), alias limit (15), selection limit (150) enforced. |
| **gRPC / AMQP Message Queues** | Microservice RPC or asynchronous job queue. | Not present. Microservice communication uses REST (`recommendationTrackingService.js`); outbox queue uses MongoDB. | Inspected codebase and package manifests; verified outbox worker handles async delivery. | **Not Applicable / Absent** | Current volume does not justify gRPC/Kafka overhead. |

---

## 3. Dedicated SOAP 1.1 / SOAP 1.2 Assessment

### 3.1 Investigation Findings

A full-text search across all repository directories (`client/`, `server/`, `recommendation_service/`) confirms:
- **SOAP Server Endpoints:** 0 endpoints.
- **SOAP Client Calling External Services:** 0 clients.
- **WSDL Service Descriptions:** 0 `.wsdl` or `.xsd` files.
- **SOAP XML Envelope Parsing/Generation:** None. No dependencies such as `soap`, `easy-soap-request`, `node-soap`, or `fast-xml-parser` exist in package manifests.
- **SOAP Fault Processing:** None.
- **Probe Response:** Probing `POST /soap` or `POST /api/soap` yields HTTP 403 Forbidden (CSRF defense) or HTTP 404 Not Found (standard 404 handler). Querying `?wsdl` returns standard JSON catalog results.

### 3.2 Requirement Justification & Recommendation

AuctionX is a high-concurrency, real-time consumer and merchant auction platform. Its external integrations consist of:
1. **Razorpay Payment Gateway:** Modern REST API with HMAC-SHA256 webhooks.
2. **Cloudinary CDN:** REST API for media storage and transformation.
3. **Google Identity Services:** OAuth 2.0 / OpenID Connect REST endpoints.
4. **FastAPI Recommendation Service:** Internal HTTP REST microservice.

**Definitive Architecture Decision:**  
Neither SOAP 1.1 nor SOAP 1.2 is required by any existing or planned feature of AuctionX. Introducing SOAP would create substantial technical debt, require XML parsing libraries that re-introduce XML External Entity (XXE) and XML bomb vulnerabilities, and provide zero interoperability benefits. **SOAP is correctly marked as Absent and Not Required.**

---

## 4. Confirmed Protocol and Security Strengths

1. **Defense-in-Depth Against Unhandled Protocols:**  
   Probing arbitrary POST endpoints without CSRF cookies immediately halts execution at the CSRF middleware before touching any application logic.
2. **Immunity to XXE Attacks:**  
   Because Express body parsers are restricted to `express.json` and `express.urlencoded`, arbitrary XML documents (including DOCTYPE declarations with external entities) are never parsed into memory.
3. **Cryptographic Webhook Integrity:**  
   Razorpay webhooks bypass CSRF only because they are authenticated via HMAC-SHA256 signatures evaluated over the untouched raw byte buffer (`req.rawBody`).
4. **WebSocket Handshake Auth & Room Isolation:**  
   Sockets strictly require JWT tokens for state-changing actions (placing bids), while anonymous sockets are restricted to read-only auction updates.
5. **Trusted Proxy Spoofing Defenses:**  
   Client IP resolution strictly ignores spoofed `CF-Connecting-IP` or `X-Forwarded-For` headers when incoming connections arrive directly from untrusted public IPs.

---

## 5. Verification Commands and Outcomes

```bash
# Non-functional protocol and contract verification (25 tests passed)
npm test -- server/tests/nonfunctional/
# Exit Code: 0 (apiContract: 8/8, securityHeaders: 8/8, protocolInteroperability: 9/9)

# Payment gateway and cryptographic webhook settlement verification (44 tests passed)
npm test -- server/tests/unit/stage4_payment_settlement.test.js server/tests/integration/stage5_end_to_end_settlement.test.js
# Exit Code: 0

# Security audit and findings closure verification (42 tests passed)
npm test -- server/tests/unit/security/
# Exit Code: 0

# WebSocket bidding and Google OAuth integration verification (12 tests passed)
npm test -- server/tests/integration/socket/biddingSocket.test.js server/tests/integration/auth/googleOAuthAndMfaRemediation.test.js
# Exit Code: 0
```
