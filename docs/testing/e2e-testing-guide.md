# AuctionX — E2E Testing Strategy & Execution Guide

## 1. Overview & Test Classification

AuctionX enforces multi-tier test automation covering the complete platform stack. Tests are partitioned into clear layers to ensure high feedback velocity and robust regression coverage:

| Category | Location | Runner | Purpose & Scope |
| :--- | :--- | :--- | :--- |
| **Unit Tests** | `server/tests/unit/` | Jest | Tests discrete controllers, auth middleware, token verification, dispute validations, and utilities in isolation. |
| **Smoke Tests** | `server/tests/smoke/` | Jest / Supertest | Verifies basic server boots, route accessibility, and health endpoints. |
| **Graybox Tests** | `server/tests/graybox/` | Jest / MongoDB Memory Server | Tests API endpoints hitting an in-memory database with actual database constraints. |
| **Acceptance Tests** | `server/tests/acceptance/` | Jest / Supertest | Validates complete multi-step business transactions (e.g. order lifecycles and administrative dispute holds). |
| **Microservice Regression** | `recommendation_service/test_cors_regression.py` | Python `unittest` | Verifies CORS policy enforcement, preflight headers, and recommendations endpoints against live daemon. |
| **E2E Browser Tests** | `e2e/tests/` | Playwright | Validates full-stack user journeys across the browser UI and backend APIs. |

---

## 2. Playwright E2E Test Suite Structure

The E2E test suite lives in `e2e/` and uses `@playwright/test`:

```
e2e/
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── tests/
    ├── admin-flow.spec.ts       # Validates admin dashboard route guards and unauthenticated redirects
    ├── auction-bid.spec.ts      # Validates today's bids, scheduled bids, and bid authentication barriers
    ├── auth.spec.ts             # Validates sign-in form rendering, invalid credentials, and navigation
    ├── product-browse.spec.ts   # Validates homepage catalog browsing, category links, and legal/footer links
    └── seller-flow.spec.ts      # Validates seller onboarding, seller dashboard guards, and verification UI
```

---

## 3. Cross-Platform Configuration

`e2e/playwright.config.ts` automatically boots both the React client (`localhost:3000`) and Express server (`localhost:5000`) via Playwright's `webServer` orchestration.

To support both Windows local development and Linux CI runners (`ubuntu-latest`), commands are resolved dynamically:

```typescript
webServer: [
  {
    command: process.platform === "win32" ? "cmd /c npm run dev" : "npm run dev",
    cwd: "../client",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60000,
  },
  {
    command: process.platform === "win32" ? "cmd /c node server.js" : "node server.js",
    cwd: "../server",
    url: "http://localhost:5000",
    reuseExistingServer: true,
    timeout: 60000,
  },
]
```

---

## 4. Financial & Payment Safety Invariants

For all tests involving financial, escrow, or payment operations:

1. **Sandbox Credentials Only**: Live Razorpay or payment credentials MUST NEVER be loaded in tests. Use placeholder test keys (`rzp_test_*`).
2. **Deterministic Mocks**: Payment settlements and webhooks are mocked using cryptographic HMAC test signatures.
3. **No Runner-Up Auto-Charges**: In accordance with AuctionX financial invariants, runner-up bidders are never automatically debited without active user authorization.
4. **No Real Money Movement**: Real charges, captures, and refunds are prohibited in both local and CI environments.

---

## 5. Running E2E Tests Locally

### Prerequisites
1. Node.js 20+ installed.
2. MongoDB running locally or via Docker.
3. Client and server dependencies installed.

### Commands
```bash
# Navigate to e2e directory
cd e2e

# Install Playwright browsers (first run only)
npx playwright install chromium

# Run all E2E tests headless
npm test

# Run tests with interactive UI
npm run test:ui

# View HTML report of previous run
npm run test:report
```
