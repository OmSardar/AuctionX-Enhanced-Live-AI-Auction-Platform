# AuctionX — Code & Engineering Conventions

> **Document Classification:** Engineering Standards  
> **Status:** Active / Normative  
> **Last Verified:** October 2026  

---

## 1. CodeGraph-First Development Workflow

AuctionX utilizes the CodeGraph knowledge graph system for mapping architectural symbols, call graphs, and impact radii. All developers and agents must adhere to the following principles:

1. **Relationships Before File Scans:** Before modifying unfamiliar symbols, use CodeGraph (`codegraph_explore` / `codegraph_get_edit_context`) to evaluate callers, callees, and blast radius.
2. **Preserve Subsystem Separation:**
   - `client/` — Presentation layer only. No server business logic.
   - `server/` — Express authoritative business logic and Socket.io.
   - `recommendation_service/` — Isolated FastAPI microservice.
3. **No Secrets in Memory or Logs:** Never persist credentials, `.env` values, API keys, or private certificates in CodeGraph memories, commit messages, or log output.

---

## 2. Backend Coding Standards

### 2.1 Concurrency & Atomic Database Invariants

Because AuctionX supports standalone MongoDB instances in local and staging environments, **multi-document distributed transactions cannot be assumed**.

- **Atomic Compare-And-Swap (CAS):** All concurrent updates (such as placing a bid, incrementing wallet balance, or claiming an outbox record) must use atomic conditional queries:
  ```javascript
  // Example CAS atomic query
  const updatedProduct = await Product.findOneAndUpdate(
    {
      _id: productId,
      status: "Active",
      currentPrice: expectedCurrentPrice, // Version / amount check
      endTime: { $gt: now },
    },
    {
      $set: { currentPrice: newAmount, highestBidder: userId },
      $inc: { bidCount: 1 }
    },
    { new: true }
  );
  if (!updatedProduct) {
    throw new BidError("Bid rejected: Auction price has advanced", 409, "CONCURRENT_BID_CONFLICT");
  }
  ```
- **Never Overwrite Raw Values Blindly:** Do not perform `doc.price = newPrice; await doc.save();` on concurrent entities.

### 2.2 Standard Error Response Envelope

All API endpoints must return structured JSON error payloads conforming to:

```json
{
  "success": false,
  "code": "ERROR_CODE_ENUM",
  "message": "Human-readable description of error.",
  "details": {}
}
```

HTTP status codes must reflect standard REST semantics:
- `400 Bad Request` — Missing or malformed parameters.
- `401 Unauthorized` — Missing or invalid authentication token.
- `403 Forbidden` — Insufficient role privileges or IDOR access violation.
- `404 Not Found` — Resource does not exist.
- `409 Conflict` — Concurrency collision, duplicate submission, or state conflict.
- `429 Too Many Requests` — Rate limit exceeded.
- `500 Internal Server Error` — Unhandled operational exception.

### 2.3 Administrative Audit Logging

Any mutating administrative operation (e.g. user account suspension, listing moderation, dispute hold placement) must record a durable entry in the audit logging collection:

```javascript
await AuditLog.create({
  action: "USER_SUSPENSION",
  targetType: "User",
  targetId: userId,
  performedBy: req.user._id,
  performedByEmail: req.user.email,
  reason: reasonText,
  metadata: { previousStatus, newStatus },
  timestamp: new Date()
});
```

---

## 3. Frontend Standards

1. **Design Tokens:** Always utilize CSS variables from `src/index.css` via Tailwind v4 semantic utility classes (e.g., `bg-surface`, `text-foreground`, `border-border-default`, `bg-action-primary`). Do not hardcode ad-hoc hex values (`#ff0000`).
2. **No Raw Secrets:** Only variables prefixed with `VITE_` can be read in client code. Never expose private API secrets or internal keys to the client.
3. **Double-Submit CSRF:** All state-modifying client HTTP mutations (`POST`, `PUT`, `PATCH`, `DELETE`) must fetch and include `x-csrf-token` header and cookie credentials.
4. **Resilient Routing & Error Boundaries:** Subsystems are lazy-loaded with `lazyRetry` and wrapped in React `RouteErrorBoundary` to prevent single-chunk network dropouts from crashing the entire application.
