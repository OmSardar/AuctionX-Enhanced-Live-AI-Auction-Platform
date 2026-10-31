# AuctionX Backend Testing Guide & System Documentation

## 1. Testing Strategy & Philosophy

The testing architecture for the AuctionX backend is designed around:
- **Zero Production Risk**: Completely isolated test database (`auctionx_test_db`) running on localhost (`127.0.0.1:27017`). Tests never connect to or modify production or development databases.
- **Hermetic & Deterministic Execution**: Every test suite cleans its collections and isolates state, ensuring tests run reliably in any order without inter-test side-effects.
- **External Boundary Isolation**: External third-party networks (Cloudinary media hosting, Nodemailer Gmail SMTP, and the FastAPI recommendation service) are mocked or intercepted at process boundaries.
- **Behavior Over Implementation**: Tests assert observable HTTP status codes, security headers, cookie semantics, database persistence, and Socket.IO broadcast payloads rather than fragile internal implementation details.
- **Strict Anti-Regression**: Every discovered production bug receives a dedicated regression test proving both the failure mode and the fix.

---

## 2. Test Pyramid & Distribution

```
           / \
          /   \
         /  E2E \         (Future Frontend Cypress / Playwright)
        /---------\
       /  Socket   \      (Real-time Auction Bidding, Room Broadcasts: 5 Tests)
      /-------------\
     /  Integration  \    (API Routes, Auth, IDOR, Admin Tasks, Sellers, Media: 90 Tests)
    /-----------------\
   /    Unit Tests     \  (Mongoose Models, Time Restrictions, Middlewares, Utilities: 58 Tests)
  /---------------------\
```

- **Unit Tests (58 Tests across 12 suites)**: Fast, in-memory validation of Mongoose schema rules, default values, custom validators, time restrictions, authentication middlewares (User, Seller, Admin), CSRF double-submit token verification, error handler status propagation, and email utilities.
- **Integration Tests (90 Tests across 13 suites)**: End-to-end Express route testing using Supertest with CSRF tokens, sessions, ownership checks (IDOR/BOLA protection), OTP lifecycle, status transitions, role-based access control, file uploads, Cloudinary boundaries, Admin Tasks (Banners, Events, Calendar), and recommendation service proxy boundaries.
- **Real-Time Socket Tests (5 Tests in 1 suite)**: Live Socket.IO client connections over WebSockets testing authenticated bidding, validation of minimum bid increments (+₹200), auction expiry rejection, and room-wide bid broadcasting.
- **Total**: **26 test suites**, **153 passing tests**, **0 failures**, **0 skipped**.

---

## 3. Test Framework & Tooling Rationale

| Tool | Purpose | Selection Rationale |
| :--- | :--- | :--- |
| **Jest (v30.5)** | Test Runner, Assertion Library & Mock Engine | Standard for Node.js CommonJS backend applications. Provides built-in assertions, spying, function mocking, and native Istanbul coverage reporting with zero extra configuration. |
| **Supertest (v7.2)** | HTTP Integration Testing | Allows making real HTTP requests directly against the Express `app` without binding network ports or requiring a running server process. |
| **socket.io-client (v4.8)** | Real-Time WebSocket Testing | The official client for Socket.IO 4.x. Connects directly to the test HTTP server instance to test rooms, handshakes, JWT authentication, and event broadcasting. |
| **Local Test MongoDB** | Isolated Database | Uses the local MongoDB instance on port 27017 (`auctionx_test_db`), dropping or cleaning collections between suites for complete database isolation. |

---

## 4. Test Directory Structure

```
server/
├── jest.config.js                    # Global Jest configuration & coverage settings
├── TESTING.md                        # This documentation
├── tests/
│   ├── setup.js                      # Environment setup, test DB connection, log silencing
│   ├── teardown.js                   # Global teardown, DB disconnection
│   ├── helpers/
│   │   ├── authHelper.js             # User, Seller, Admin creation & JWT token generators
│   │   ├── csrfHelper.js             # Double-submit CSRF cookie and header generator
│   │   ├── dbHelper.js               # Database cleaner & teardown helpers
│   │   └── socketHelper.js           # Socket.IO client connection factory
│   ├── mocks/
│   │   ├── cloudinaryMock.js         # Cloudinary uploader/destroyer mock
│   │   └── emailMock.js              # Nodemailer OTP email mock
│   ├── unit/
│   │   ├── models/
│   │   │   ├── userModel.test.js         # User schema validations & default roles
│   │   │   ├── sellerModel.test.js       # Seller schema validations & status defaults
│   │   │   ├── productModel.test.js      # Product schema validations & status enums
│   │   │   ├── orderModel.test.js        # Order schema validations & defaults
│   │   │   └── adminModels.test.js       # Admin, Banner, Event, Calendar, Transaction models
│   │   ├── middleware/
│   │   │   ├── authUserMiddleware.test.js       # User JWT cookie/header auth
│   │   │   ├── authSellerMiddleware.test.js     # Seller JWT cookie/header auth
│   │   │   ├── authAdminMiddleware.test.js      # Admin privilege & role check
│   │   │   ├── checkTimeRestriction.test.js     # Bidding time restriction regression unit test
│   │   │   ├── csrfMiddleware.test.js           # Double-submit cookie CSRF validation
│   │   │   └── errorHandler.test.js             # Global error formatting
│   │   └── utils/
│   │       └── emailSender.test.js              # Transporter & OTP email dispatch
│   └── integration/
│       ├── admin/
│       │   ├── adminRoutes.test.js              # Admin RBAC & /check-admin endpoint
│       │   ├── adminSellerManagement.test.js    # Seller listing, stats, verification, status
│       │   └── adminTasks.test.js               # Banners, Events, Calendar (regression)
│       ├── auth/
│       │   ├── userAuth.test.js                 # Register, login, duplicate, logout
│       │   ├── sellerAuth.test.js               # Seller register, login, cookie tokens
│       │   ├── otpFlow.test.js                  # OTP generation, expiry, verification, resend
│       │   └── idorAuthorization.test.js        # Profile, order, and product IDOR boundaries
│       ├── media/
│       │   └── fileUpload.test.js               # Image upload middleware, Cloudinary boundaries
│       ├── orders/
│       │   └── orderFlow.test.js                # Buyer order creation, access control
│       ├── products/
│       │   ├── productCrud.test.js              # Product browsing, status patch, IDOR
│       │   └── productTimeRestriction.test.js   # Active vs expired auction update/delete regression
│       ├── recommendation/
│       │   └── recommendationProxy.test.js      # FastAPI proxy boundary & error handling
│       ├── security/
│       │   └── csrfAndSecurity.test.js          # Helmet headers, CSRF token, NoSQL sanitization
│       └── socket/
│           └── biddingSocket.test.js            # Real-time bidding, minimum increment, room broadcast
```

---

## 5. Test Environment Configuration

Tests execute under:
- `NODE_ENV=test`
- `MONGODB_URL=mongodb://127.0.0.1:27017/auctionx_test_db`
- `JWT_SECRET=auctionx-super-secure-test-jwt-secret-key-32chars`
- `RECOMMENDATION_SERVICE_URL=http://localhost:8000`

---

## 6. Investigation: Redis Architecture Analysis

**Discrepancy Investigation**:
- `compose.yaml` provisions a Redis container (`redis:7-alpine`, port 6379).
- Codebase-wide search confirmed that **the Node.js Express server does NOT import or connect to Redis**. There are zero imports of `ioredis` or `redis` in `server/package.json` or any server source file.
- **Actual Architecture**: Redis is used exclusively by the Python FastAPI microservice (`recommendation_service/main.py`), which uses Redis for caching recommendation scores with an automatic in-memory dictionary fallback when Redis is unavailable.
- **Node.js Integration**: The Node.js Express server communicates with the recommendation service exclusively over HTTP via the `/api/recommendations/:email` proxy endpoint.
- **Test Strategy**: The Node.js backend tests mock the HTTP boundary of the recommendation service with success (200), not-found (404), and network timeout cases. No isolated Redis instance is needed for Node backend testing.

---

## 7. Production Bugs Discovered & Fixed

### 1. Bidding Time Restriction Field Mismatch (`checkTimeRestriction.js`)
- **File**: `server/middleware/SellAnItemMiddleware/checkTimeRestriction.js`
- **Root Cause**: Middleware checked `product.bidEndTime`, but the canonical field in `Product` schema is `biddingEndTime`. `new Date(undefined)` produced `Invalid Date`, which evaluated `currentTime > Invalid Date` as `false`, silently allowing expired auctions to be modified or deleted.
- **Fix**: Updated to `const endTime = product.biddingEndTime || product.bidEndTime;` with an explicit date validity check `if (isNaN(new Date(endTime).getTime()))`.
- **Regression Tests**:
  - `tests/unit/middleware/checkTimeRestriction.test.js`
  - `tests/integration/products/productTimeRestriction.test.js`

### 2. Missing Calendar Model Import in Calendar Routes
- **Files**:
  - `server/routes/AdminRoutes/TASKS/CalendarRoutes.js`
  - `server/routes/AdminRoutes/AdminRoutes.js`
- **Root Cause**: `GET /api/calendar/date/:date` executed `await Calendar.find(...)` without requiring `Calendar`, causing a fatal runtime `ReferenceError: Calendar is not defined` (500 Server Error).
- **Fix**: Added `const Calendar = require("../../../models/AdminModels/TASKS/Calendar");`.
- **Regression Test**: `tests/integration/admin/adminTasks.test.js` ("REGRESSION: should fetch calendar entries by date without ReferenceError").

### 3. Missing `isValidDate` Export in Calendar Controller
- **File**: `server/controllers/AdminControllers/ManageSellersControllers/TASKS/CalendarController.js`
- **Root Cause**: `CalendarRoutes.js` and `AdminRoutes.js` invoked `calendarController.isValidDate(req.params.date)`, but `isValidDate` was declared as an unexported local function, causing `TypeError: calendarController.isValidDate is not a function` (500 Server Error).
- **Fix**: Exported `exports.isValidDate = isValidDate;`.
- **Regression Test**: `tests/integration/admin/adminTasks.test.js`.

### 4. Missing `imagePublicId` in Banner Schema
- **File**: `server/models/AdminModels/TASKS/Banner.js`
- **Root Cause**: `BannerController.js` stored `imagePublicId` from Cloudinary uploads, and `deleteBanner` invoked `deleteFromCloudinary(banner.imagePublicId)`. However, `bannerSchema` did not define `imagePublicId`, so Mongoose stripped the field on save, making Cloudinary asset cleanup impossible upon banner deletion.
- **Fix**: Added `imagePublicId: { type: String }` to `bannerSchema`.
- **Regression Test**: `tests/integration/media/fileUpload.test.js`.

### 5. Duplicate Function Declarations in Seller Controller
- **Files**:
  - `server/controllers/AdminControllers/ManageSellersControllers/SELLER-MANAGEMENT/SellerController.js`
  - `server/controllers/SellerControllers/SellerManageSellersControllers/SELLER-MANAGEMENT/SellerController.js`
- **Root Cause**: Both `capitalizeFirstLetter` and `calculateCommission` were declared twice in the same module scope, causing Babel parser `SyntaxError: Identifier 'capitalizeFirstLetter' has already been declared`.
- **Fix**: Removed duplicate declarations.

---

## 8. Test Execution Commands

```bash
# Run complete test suite (26 suites, 153 tests)
npm test

# Run unit tests only (12 suites, 58 tests)
npm run test:unit

# Run integration tests only (14 suites, 95 tests)
npm run test:integration

# Run Socket.IO real-time bidding tests only
npm run test:socket

# Run security & CSRF tests only
npm run test:security

# Generate full Istanbul code coverage report
npm run test:coverage
```

---

## 9. CI Readiness Analysis

The backend test suite is **fully ready for Continuous Integration (CI)**:
1. **Deterministic**: 100% pass rate (153/153 tests pass consistently across repeated runs).
2. **Hermetic & Isolated**: Zero external network requests; all third-party dependencies (Cloudinary, Nodemailer, FastAPI recommendation service) are mocked or intercepted.
3. **Automated Setup & Teardown**: Automatically initializes against a test MongoDB instance and tears down all connections with zero open handles or hanging sockets.
4. **Environment Independent**: Runs cleanly on Windows and Linux using standard npm scripts.
