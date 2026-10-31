# Auction X — Production-Standard Fixes & Improvements

A comprehensive audit of the Auction X MERN stack application revealed **~30 critical issues** spanning security, architecture, real-time functionality, dark mode, and the recommendation system. This plan groups them by priority.

---

## User Review Required

> [!CAUTION]
> **Exposed secrets in `.env` files committed to git** — MongoDB credentials, Google API keys, Cloudinary secrets, and email passwords are all checked into source control. After this fix, you **must rotate every key listed in `.env`**.

> [!WARNING]
> **`csurf` is deprecated** — The `csurf` npm package was deprecated in 2022 due to security vulnerabilities. We will replace it with a modern double-submit-cookie CSRF pattern (custom middleware), eliminating the dependency.

> [!IMPORTANT]
> **Socket.IO bid data stored in-memory only** — If the server restarts, all live bid state is lost. We'll persist bid state in MongoDB so bids survive deployments.

---

## Open Questions

> [!IMPORTANT]
> 1. **Redis availability** — The recommendation service requires Redis. The `.env` has no `REDIS_URL` defined. Is there a Redis instance provisioned on Render, or should we add a graceful fallback (skip caching) when Redis is unavailable?
> 2. **Recommendation DB mismatch** — The recommendation service `.env` connects to `mongodb+srv://...BID` database but sets `MONGODB_DB=Auction-X-Major`. Which database name holds the product data?
> 3. **Admin/Seller route protection** — Currently admin and seller dashboard routes are completely unprotected (no `ProtectedRoute` wrapper). Should we enforce auth + role checks on all dashboard routes?
> 4. **Session duration** — JWT expires in 1 hour. Is this intentional, or would you prefer a longer session (e.g. 7 days) with refresh tokens?

---

## Proposed Changes

### 1. Server — Critical Middleware Ordering Fix

The server has **middleware registered after routes**, meaning Helmet, CSRF, mongo-sanitize, and the error handler are **never applied** to any API request.

#### [MODIFY] [server.js](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/server.js)

- **Move security middleware BEFORE route registrations** — `helmet()`, `httpLogger`, `mongoSanitize()`, and the sanitize middleware must come before `app.use("/api/...", ...)` calls
- **Move `errorHandler` to the very end** — Express error handlers must be the last middleware
- Remove the dead `csrfProtection` — replace with custom double-submit cookie CSRF middleware
- Fix `startServer()` — wrap in proper `async` IIFE with error handling; crash the process on failed DB connection instead of silently continuing
- Remove hardcoded `localhost:8000` recommendation proxy — use `RECOMMENDATION_SERVICE_URL` env variable
- Add `express.json({ limit: '10mb' })` to prevent payload abuse
- Remove duplicate route registrations (e.g. `AuthRoutes` mounted twice, `GoogleAuthRoutes` is the same file as `AuthRoutes`)
- Remove `dns.setServers(["8.8.8.8", "8.8.4.4"])` — production anti-pattern
- Add `process.on('unhandledRejection')` / `uncaughtException` handlers

---

### 2. Server — Socket.IO Production Hardening

#### [MODIFY] [SocketController.js](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/OtherControllers/SocketController.js)

**Current problems:**
- Bid data stored in a plain JS object (`let productData = {}`) — **lost on every server restart**
- No authentication on socket connections — anyone can emit `placeBid` events
- No bid validation — a malicious client can set `currentBid: 999999999`
- No rate limiting on bid events
- `biddingEndTime` is never emitted to the client on `joinProductRoom`

**Fixes:**
- **Persist bid state** — On `joinProductRoom`, load the product's current bid from MongoDB; on `placeBid`, validate and update MongoDB first, then broadcast
- **Add JWT authentication** to socket handshake (`socket.handshake.auth.token`)
- **Validate bid amounts server-side** — must be ≥ currentBid + 200, check user balance
- **Emit full product data** including `biddingEndTime` so the client timer works correctly
- **Add a connected-users count** per room for future UI features

#### [MODIFY] [SocketRoutes.js](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/routes/OtherRoutes/SocketRoutes.js)

- Clean up the unnecessary Express router wrapper (socket.io doesn't use Express routes)

---

### 3. Client — Socket.IO Integration Fix

#### [MODIFY] [ProductDetails.jsx](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/ProductDetails/ProductDetails.jsx)

**Current problems:**
- `alert(winnerEmail)` and `alert(productData)` left in production code (line 196-197) — **must remove**
- Creates a new `axios.create()` instance on every render — wasteful
- Socket reconnection not handled — if connection drops, bids stop updating
- `token` from Redux (`state.auth.token`) is likely always `null` because the store doesn't persist the token (it's in an httpOnly cookie)
- Multiple competing `useEffect` hooks for the same timer cause stale closure issues
- No cleanup of timer intervals on unmount in some cases

**Fixes:**
- Remove debug `alert()` calls
- Move `api` instance creation outside the component or memoize it
- Add socket reconnection handling and connection status indicator
- Remove the broken `token` auth header from axios (credentials are cookie-based)
- Consolidate timer logic into a single clean `useEffect`
- Add proper error boundaries

---

### 4. Recommendation System Fix

#### [MODIFY] [main.py](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/recommendation_service/main.py)

**Current problems:**
- Uses `redis_url` from env but **no `REDIS_URL` is defined in `.env`** — crashes at startup
- CORS only allows `localhost:3000` — production frontend URL is missing
- The "recommendation" algorithm just returns `db.products.find().limit(count)` — no personalization at all
- No error handling for Redis/MongoDB connection failures
- `interaction.dict()` is deprecated in Pydantic v2 — should use `interaction.model_dump()`

**Fixes:**
- Add production frontend URL to CORS origins + use env variable
- Add graceful fallback when Redis is unavailable (skip caching, don't crash)
- Implement a real recommendation algorithm: **collaborative filtering** based on user interactions (users who viewed X also viewed Y) with category-weighted scoring
- Add health check endpoint
- Fix Pydantic v2 deprecation warnings
- Add startup/shutdown event handlers for clean connection management

#### [MODIFY] [ProductList.jsx](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/ProductList/ProductList1/ProductList.jsx)

- Fix the fallback URL: `${API_URL}/products/` is missing `/api` prefix (line 143)
- Add error handling for recommendation API failures — silently fall back to regular products instead of showing an empty list
- Add retry logic with exponential backoff
- Fix timer memory leak — intervals stored on product objects aren't cleaned up properly

#### [MODIFY] [server.js](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/server.js) — Recommendation proxy route

- Replace hardcoded `localhost:8000` with `RECOMMENDATION_SERVICE_URL` env variable
- Add timeout and circuit breaker for the proxy call

---

### 5. Dark Mode Bugs

#### [MODIFY] [ThemeContext.jsx](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/AdminDashboard/utils/ThemeContext.jsx)

**Bug:** Uses invalid Tailwind v4 class `**:transition-none!` — this syntax doesn't exist in any Tailwind version and silently fails, causing a visible flash when toggling themes.

**Fix:**
- Remove the broken transition-suppression logic
- Use proper CSS `transition: none !important` via a temporary `<style>` tag injection instead
- Properly sync with `index.html` dark mode script (which defaults to dark if `!('theme' in localStorage)`)

#### [MODIFY] [index.html](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/index.html)

**Bug:** The pre-React dark mode script defaults to dark mode when no theme is stored (`!(\"theme\" in localStorage)`) — but the React ThemeContext defaults to `'light'`. This causes a **flash from dark→light** on first load.

**Fix:** Align both defaults — default to `'light'` in both places.

#### [MODIFY] [tailwind.config.js](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/tailwind.config.js)

- Add `content` paths (currently missing — Tailwind v4 may not need it with `@tailwindcss/vite`, but the config file exists and has no `content`, which can cause confusion)

#### Skeleton Loading Dark Mode (ProductDetails.jsx)

- The skeleton loading states use hardcoded `bg-white` and `bg-gray-200` without dark mode variants — fix all skeleton loading placeholders

---

### 6. Security Hardening

#### [MODIFY] [ErrorHandler.js](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/middleware/Security/ErrorHandler.js)

- `.red` on a string crashes because `colors` package isn't installed — replace with template literal
- In production, don't leak `err.message` to the client — return a generic message
- Log stack traces to Winston instead of `console.error`

#### [NEW] [csrfMiddleware.js](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/middleware/Security/csrfMiddleware.js)

- Custom double-submit cookie CSRF implementation to replace deprecated `csurf`

#### [MODIFY] [authOtherMiddlewares.js](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/middleware/LoginMiddleware/authOtherMiddlewares.js)

- Remove `console.log("Token being verified:", token)` — leaks tokens to logs in production
- Remove `console.log("Received token:", token)` — same issue

#### [MODIFY] [UserLoginController.js](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/LoginControllers/UserLoginController/UserLoginController.js)

- Remove `console.log("Password hashed:", hashedPassword)` — leaks hashed passwords to logs
- Remove `console.log("Request body:", req.body)` — leaks user data
- Don't send `token` in the response body — it's already in the httpOnly cookie (sending in both places defeats the purpose of httpOnly)

#### [NEW] [.gitignore update](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/.gitignore)

- Add `.env` to root `.gitignore`
- Add `*.pem` to `.gitignore` (SSL certs are committed!)

---

### 7. Client Architecture Cleanup

#### [MODIFY] [App.jsx](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/App.jsx)

- **Duplicate `useEffect` for auth check** — `checkAuthStatus` and `restoreGoogleLogin` do the same thing; merge them
- **Duplicate route definitions** — `/product/:id` appears twice (lines 282, 289), `/category/:category` appears twice (lines 238, 242), `/contact` appears twice
- **`exact` prop is unnecessary** in React Router v7 — all routes match exactly by default
- Remove the unused `useCurrentPath` hook

#### [MODIFY] [main.jsx](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/main.jsx)

- Remove the stray `{" "}` whitespace text node (line 15)

#### [MODIFY] [vite.config.js](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/vite.config.js)

- Remove the `define: { "process.env": {...} }` block — Vite already handles `import.meta.env.VITE_*`, and this manual bridging can cause issues with tree-shaking and HMR

#### [MODIFY] [authService.jsx](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/services/authService.jsx)

- After CSRF replacement, update the CSRF token handling pattern

#### [MODIFY] [store.jsx](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/redux/store.jsx)

- Blacklisting `user` from persist means the user object is lost on refresh and must be re-fetched from `/api/auth/check` every time — this is intentional and fine, but ensure `persist/REHYDRATE` is also in `ignoredActions`

#### [MODIFY] [package.json (server)](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/package.json)

- Move `nodemon` from `dependencies` to `devDependencies`
- Remove duplicate `bcrypt` / `bcryptjs` — pick one (keep `bcryptjs`, it's pure JS and cross-platform)
- Add a proper `start` script for production: `node server.js` (not `nodemon`)
- Remove unused `csurf` dependency after replacing it

---

### 8. Database Connection Hardening

#### [MODIFY] [db.js](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/utlis/Database/db.js)

- **Crash the process on connection failure** — currently it `console.error` and continues, leading to all routes silently failing with unhandled errors
- Add mongoose connection event listeners (`connected`, `disconnected`, `error`)
- Set recommended Mongoose options

---

## Summary of Changes by File Count

| Area | Files Modified | Files Created |
|------|---------------|---------------|
| Server (core) | 6 | 2 |
| Client (React) | 8 | 0 |
| Recommendation Service | 1 | 0 |
| Config/DevOps | 3 | 1 |
| **Total** | **18** | **3** |

---

## Verification Plan

### Automated Tests
1. Build the client with `npm run build` — ensure no compilation errors
2. Start the server and verify middleware ordering with a curl test:
   - `curl -I http://localhost:5000/` → should include Helmet security headers
3. Test socket connection: open two browser tabs on a product page, place a bid in one, verify it updates in the other
4. Test dark mode: toggle dark/light 5 times rapidly — no flash or unstyled content
5. Test recommendation fallback: stop the recommendation service, verify the product list still loads regular products

### Manual Verification
- Verify the full bid flow: login → navigate to product → place bid → verify balance deducted → verify previous bidder refunded
- Verify dark mode on: Navbar, ProductDetails, ProductList, Footer, all skeleton loaders
- Verify the socket reconnects after a brief network interruption (disconnect wifi for 3 seconds)
