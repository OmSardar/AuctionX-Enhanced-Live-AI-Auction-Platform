# AuctionX — API Overview & Endpoint Contracts

> **Document Classification:** API Specification & Reference  
> **Status:** Active / Normative  
> **Last Verified:** October 2026  

---

## 1. API Architecture & Conventions

- **Base URL:** `/api`
- **Data Exchange Format:** `application/json`
- **Authentication:** `HttpOnly` JWT cookie (`token`, `sellerToken`, `adminToken`) or `Authorization: Bearer <token>`
- **CSRF Protection:** Double-submit cookie with `x-csrf-token` header required on all mutating verbs (`POST`, `PUT`, `PATCH`, `DELETE`). Token acquired via `GET /api/csrf-token`.

---

## 2. Authentication & Account Endpoints

### User Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new buyer user account. |
| `POST` | `/api/auth/login` | Public (Rate-limited) | Authenticate user credentials and issue JWT cookie. |
| `POST` | `/api/auth/logout` | Authenticated | Invalidate session and clear auth cookie. |
| `GET` | `/api/auth/check` | Authenticated | Validate session and retrieve authenticated profile. |
| `POST` | `/api/auth/send-otp` | Public | Generate and email OTP verification token. |
| `POST` | `/api/auth/verify-otp` | Public | Verify submitted OTP token. |
| `PATCH` | `/api/auth/verify-user` | Authenticated | Mark account as verified. |
| `PATCH` | `/api/auth/updateUserProfile/:email` | Owner only | Update profile fields (enforces ownership check). |
| `PATCH` | `/api/auth/updateUserProfileImage/:email` | Owner only | Update avatar selection or custom Cloudinary image. |
| `PATCH` | `/api/auth/resetProfileImage/:email` | Owner only | Reset avatar to default icon while preserving Google photo. |
| `PATCH` | `/api/auth/update-password` | Authenticated | Change user account password. |

### Seller Authentication (`/api/auth/seller`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/seller/register` | Public | Register new seller account. |
| `POST` | `/api/auth/seller/login` | Public (Rate-limited) | Authenticate seller credentials and set `sellerToken`. |
| `POST` | `/api/auth/seller/logout` | Authenticated | Terminate seller session. |
| `GET` | `/api/auth/seller/check` | Authenticated | Validate seller session and status. |
| `PATCH` | `/api/auth/seller/updateUserProfile/:email` | Owner only | Update seller business profile (IDOR-protected). |
| `PATCH` | `/api/auth/seller/updateUserProfileImage/:email` | Owner only | Update seller store branding image. |
| `PATCH` | `/api/auth/seller/resetProfileImage/:email` | Owner only | Reset seller avatar to default. |
| `PATCH` | `/api/auth/seller/update-password` | Authenticated | Change seller account password. |

---

## 3. Product Catalog & Bidding Endpoints (`/api/products`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/products` | Public | Paginated catalog listing of active auctions. |
| `GET` | `/api/products/:id` | Public | Detailed product metadata, bids, and current price. |
| `GET` | `/api/products/category/:category` | Public | Category-filtered active product listings. |
| `POST` | `/api/products` | Seller / Admin | Create new product auction listing with Cloudinary assets. |
| `PUT` | `/api/products/:id` | Owner / Admin | Update product metadata (restricted once auction is concluded). |
| `PATCH` | `/api/products/statuspatch/:id` | Owner / Admin | Update product status (e.g., Active to Closed). |
| `DELETE` | `/api/products/:id` | Owner / Admin | Delete product and clean up Cloudinary assets. |
| `POST` | `/api/products/:id/bid` | Authenticated | Place server-authoritative bid with atomic CAS check. |
| `GET` | `/api/products/:id/bids` | Public | Retrieve deterministic bid history for an auction. |

---

## 4. Orders & Settlements (`/api/orders`, `/api/payment`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/orders` | Authenticated | Create invoice order for winning auction bidder. |
| `GET` | `/api/orders/:id` | Buyer / Admin | Fetch order invoice details (IDOR-protected). |
| `GET` | `/api/orders/user/:email` | Owner only | Fetch order list for authenticated buyer. |
| `POST` | `/api/payment/create-order` | Authenticated | Create Razorpay order with integer paise and INR currency. |
| `POST` | `/api/payment/wallet/verify` | Authenticated | Verify Razorpay checkout signature and credit balance. |
| `POST` | `/api/payment/webhook` | Gateway HMAC | Authoritative webhook receiver for asynchronous settlement. |
| `GET` | `/api/payment/order/:orderId` | Buyer / Admin | Settlement diagnostics and payment transaction state. |

---

## 5. Administrative Oversight Endpoints (`/api/admin`)

*All administrative endpoints require `adminAuthMiddleware` enforcing `role: 'admin'` in `Admin` or `User` collection.*

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/dashboard/stats` | Aggregated metrics (total users, active auctions, volume, disputes). |
| `GET` | `/api/admin/users` | Paginated user directory with status filters and search. |
| `PATCH` | `/api/admin/users/:id/status` | Suspend or restore user account status with audit logging. |
| `GET` | `/api/admin/users/audit-logs` | Global administrative audit log stream. |
| `GET` | `/api/admin/listings` | Product listing directory for moderation inspection. |
| `PATCH` | `/api/admin/listings/:id/moderate` | Approve, reject, or flag a listing with reason. |
| `GET` | `/api/admin/auctions/lifecycle/telemetry`| Scheduler status, batch diagnostics, and anti-sniping rates. |
| `GET` | `/api/admin/orders` | Complete orders directory with payment status filters. |
| `GET` | `/api/admin/disputes` | Contested transactions, buyer complaints, and dispute claims. |
| `POST` | `/api/admin/disputes/:id/hold` | Place dispute financial hold on settlement funds. |
| `POST` | `/api/admin/disputes/:id/release-hold` | Release dispute hold after resolution. |
| `GET` | `/api/admin/reconciliation/summary` | Mismatched amounts, orphan records, and reconciliation telemetry. |

---

## 6. Recommendation & Telemetry Endpoints (`/api/recommendations`, `/api/track`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/recommendations` | Public / Guest | Fetch trending/popular recommendations for guest session. |
| `GET` | `/api/recommendations/:email` | Authenticated | Personalized recommendations. Express proxy overrides URL email with verified JWT identity. |
| `POST` | `/api/track` | Authenticated / Guest | Record user interaction telemetry (`view`, `click`, `impression`). Business events (`bid`, `purchase`) are rejected. |

---

## 7. Real-Time Socket.IO Protocol

Clients connect to the WebSocket gateway at `/socket`:

| Event (Client → Server) | Payload | Purpose |
| :--- | :--- | :--- |
| `joinProductRoom` | `{ productId: string }` | Join room for live product auction updates. |
| `leaveProductRoom` | `{ productId: string }` | Leave product auction room. |
| `placeBid` | `{ productId: string, amount: number }` | Submit live bid. Dispatches atomic CAS update and broadcasts. |

| Event (Server → Client) | Payload | Purpose |
| :--- | :--- | :--- |
| `productData` | Full product document | Initial product state upon joining room. |
| `bidUpdate` | `{ currentPrice, highestBidder, bidCount, endTime }` | Broadcast to all room subscribers on new accepted bid. |
| `auctionEnded` | `{ productId, winner, finalPrice }` | Broadcast when auction timer concludes. |
