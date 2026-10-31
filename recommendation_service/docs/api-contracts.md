# AuctionX Recommendation Service — API Specifications & Contracts

All endpoints support optional legacy aliases to maintain complete backward compatibility with the AuctionX Express gateway and frontend clients.

---

## 1. Health & Liveness Endpoints

### `GET /health` | `GET /api/health`
Liveness probe verifying process execution and dependency reachability.

- **Authentication**: None required.
- **Success Response (200 OK)**:
  ```json
  {
    "status": "healthy",
    "service": "recommendation_service",
    "database": "Auction-X",
    "mongodb": true,
    "redis": true
  }
  ```
- **Degraded Response (200 OK)**:
  Returns `"status": "degraded"` if MongoDB ping fails, keeping process alive for container diagnosis.

---

### `GET /ready` | `GET /api/ready`
Readiness probe verifying active database connection before routing live traffic.

- **Authentication**: None required.
- **Success Response (200 OK)**:
  ```json
  {
    "status": "ready",
    "database": "Auction-X",
    "mongodb": true,
    "redis": true
  }
  ```
- **Failure Response (503 Service Unavailable)**:
  ```json
  {
    "detail": "Database readiness ping failed: ..."
  }
  ```

---

### `GET /metrics` | `GET /api/metrics`
Operational observability probe returning aggregated in-memory request telemetry.

- **Authentication**: None required (internal network/scraping).
- **Success Response (200 OK)**:
  ```json
  {
    "http_requests_total": 42,
    "http_status_200": 40,
    "http_status_403": 2,
    "http_request_duration_ms_avg_ms": 1.45,
    "http_request_duration_ms_p95_ms": 3.20
  }
  ```

---

## 2. Telemetry Ingestion Endpoints

### `POST /api/track` | `POST /track`
Ingests user telemetry interactions.

- **Authentication**:
  - `x-internal-service-key`: Required only for authoritative events (`bid`, `purchase`).
  - Client-observable events (`view`, `click`, `impression`): Open to authenticated or guest sessions.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "session_id": "sess_optional_guest_123",
    "product_id": "60c72b2f9b1d8b2bad000001",
    "interaction_type": "view",
    "event_id": "optional_client_uuid_for_idempotency",
    "recommendation_id": "optional_slate_attribution_uuid",
    "position": 1,
    "surface": "catalog",
    "timestamp": "2026-10-27T00:00:00Z"
  }
  ```
- **Status Codes**:
  - `200 OK`: `{"status": "success", "tracked": true}`
  - `400 Bad Request`: Validation failure (missing email/session_id, invalid product_id ObjectId, unknown interaction type).
  - `403 Forbidden`: Client attempted to forge authoritative event without `x-internal-service-key` or product is moderated.
  - `404 Not Found`: Product does not exist in catalog.
  - `409 Conflict`: `event_id` previously recorded with different user/product attributes.
  - `503 Service Unavailable`: Database uninitialized or `INTERNAL_SERVICE_KEY` unconfigured.

---

### `POST /api/track/batch` | `POST /track/batch`
Batched ingestion for viewport impressions and client telemetry buffers.

- **Constraints**: Bounded batch size `<= 25` items.
- **Request Body**:
  ```json
  {
    "interactions": [
      {
        "email": "user@example.com",
        "product_id": "60c72b2f9b1d8b2bad000001",
        "interaction_type": "impression"
      }
    ]
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "success": true,
    "processed_count": 1,
    "results": [{"status": "success", "tracked": true}]
  }
  ```

---

## 3. Recommendation Serving Endpoints

### `GET /api/recommendations` | `GET /recommendations`
Query-parameter recommendation endpoint supporting anonymous guest and session recommendations.

- **Parameters**:
  - `email` (optional query string): Target user email.
  - `session_id` (optional query string): Active guest session token.
  - `count` (optional query string, default=10, min=1, max=50): Number of recommendations requested.
- **Authentication**:
  - If `email` is provided, requires valid `x-internal-service-key` header.
  - Unauthenticated requests fall back cleanly to guest recommendations.

---

### `GET /api/recommendations/{email}` | `GET /recommendations/{email}`
Path-parameter recommendation endpoint.

- **Parameters**:
  - `email` (path string): User email or literal string `"guest"`.
  - `session_id` (optional query string).
  - `count` (optional query string, default=10).
- **Authentication**:
  - Strict internal service authentication: requires `x-internal-service-key` matching `INTERNAL_SERVICE_KEY`.
- **Success Response (200 OK)**:
  ```json
  {
    "recommendation_id": "e4b6d43e-b8d1-4475-8494-df0041b6ce39",
    "products": [
      {
        "_id": "60c72b2f9b1d8b2bad000001",
        "name": "Vintage Chronograph",
        "category": "Watches",
        "currentPrice": 250,
        "bidCount": 8,
        "lifecycleStatus": "LIVE",
        "secondsRemaining": 14200.0
      }
    ],
    "recommendations": [ ... ],
    "count": 1,
    "cache_hit": false,
    "personalized": true,
    "diagnostics": {
      "channel_counts": {
        "category_channel": 2,
        "collaborative_channel": 1,
        "popular_channel": 4,
        "freshness_channel": 2,
        "upcoming_channel": 0
      },
      "algorithm": "heuristic_hybrid_ranker_v2",
      "model_type": "heuristic_rule_composite",
      "is_ml_trained": false
    }
  }
  ```
