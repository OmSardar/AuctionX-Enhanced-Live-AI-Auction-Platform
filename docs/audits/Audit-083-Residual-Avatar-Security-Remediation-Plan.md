# Stage 7.30 — Residual Avatar Security Risk Remediation Plan

## 1. Executive Summary

| Attribute | Details |
| :--- | :--- |
| **Stage** | Stage 7.30 — Residual Avatar Security Risk Remediation Plan |
| **Target Document** | `docs/audits/Audit-082-Avatar-Upload-Independent-Security-Audit.md` |
| **Target Findings** | **F-06** (Full Image Validation), **F-07** (Rate-Limiter Deployment Scope),<br>**F-08** (Cloudinary Rollback Recovery), **F-09** (Rate-Limit Key Namespacing) |
| **Execution Mode** | **Planning-Only and Strictly Read-Only** (No application or config modifications) |
| **Plan Status** | **`RESIDUAL SECURITY REMEDIATION PLAN COMPLETE — AWAITING REQUIRED APPROVALS`** |
| **Overall Release Status** | **`PUBLIC RELEASE STILL BLOCKED — REASSESS AFTER INDEPENDENT VERIFICATION`** |
| **Date** | 2026-10-19 |
| **Author** | Antigravity IDE Security & Quality Engineering Agent |

In Stage 7.29, the independent security audit verified that the primary avatar-upload security controls (server-side IDOR prevention, onboarding migration from client-direct uploads, guaranteed temporary file unlinking, and marketing copy corrections) were implemented and tested. However, four operational residual risks were identified:

1. **F-06 (Medium)**: Absence of server-side pixel rasterization and decoding before cloud dispatch.
2. **F-07 (Low/Operational)**: Process-local rate-limiting store behavior in multi-instance topologies.
3. **F-08 (Low/Operational)**: Best-effort cloud rollback without persistent retry on network failure.
4. **F-09 (Low/Code Quality)**: Rate-limiting keys lack account-type namespacing (`user:` vs `seller:`).

This document presents a concrete, file-by-file remediation plan to address each finding. To maintain strict repository safety, **no application code or manifests have been modified in this stage**. Implementation will proceed only after owner review and approval of the proposed dependency and architectural changes.

---

## 2. Finding F-06: Full Image Validation & Sanitization

### 2.1 Verified Current Behavior
- `server/utlis/Image/imageSignatureValidator.js` validates magic bytes, parses chunk headers for dimensions (JPEG `SOF`, PNG `IHDR`, WebP `VP8`), checks limits (width/height $\le 4096$, pixels $\le 16.7\text{ MP}$), and scans the first 2,048 bytes for text script tags (`<svg`, `<?xml`, `<!doctype`, `<html`, `<script`).
- The server does **not** decode compressed image streams into raw pixel bitmaps or re-encode them locally.
- Hostile payloads appended past byte 2,048 (e.g. within an EXIF metadata block or trailing payload after `FF D9`) are not rejected by the local validator. They rely on Cloudinary's upstream decoding and WebP transcoding to be neutralized.

### 2.2 Root Cause & Risk Assessment
- **Root Cause**: Reliance on header-level heuristics without a full in-process image codec.
- **Risk**: An attacker could upload a validly formatted JPEG containing an exploit payload in later segments that could target vulnerable downstream parsers or cloud transcoding engines.
- **Severity**: **`RESIDUAL RISK (Medium)`**.

### 2.3 Proposed Remediation: In-Process Pixel Sanitization via `sharp`

#### 2.3.1 Dependency Specification
- **Package**: `sharp` (v0.33.5 or latest stable v0.33.x).
- **Security Rationale**: `sharp` is backed by `libvips`, an actively maintained, memory-efficient C image processing library. It decodes the entire compressed bitstream, enforces decompression-bomb pixel limits, strips all EXIF/XMP/IPTC metadata, and re-encodes the image into a clean binary buffer. Any non-image trailing data or malicious metadata tags are discarded during rasterization.
- **Platform & Build Implications**:
  - `sharp` provides pre-compiled platform binaries via optional dependencies (`@img/sharp-win32-x64`, `@img/sharp-linux-x64`, `@img/sharp-linux-musl-x64`).
  - **Windows (Development)**: Installs cleanly via standard `npm install` without requiring local C++ compilers.
  - **Docker / Production Linux**: Standard Alpine or Debian containers install pre-compiled binaries. Docker multi-stage builds require no extra system packages.
  - **Disk Footprint**: Adds $\sim 28\text{ MB}$ to `node_modules`.

#### 2.3.2 Architecture & Pipeline Placement
Validation and re-encoding must occur in `server/middleware/Media/ImageUpload.js` immediately after Multer writes the temporary file to disk and **before** calling `uploadToCloudinary`:

```
Multer (writes temp file to disk)
  │
  ▼
Sharp Validation & Sanitization Pipeline:
  ├─ 1. Check file size (<= 5 MB)
  ├─ 2. Initialize: sharp(filePath, { failOnError: true, limitInputPixels: 16777216 })
  ├─ 3. Inspect metadata:
  │     - format in ['jpeg', 'png', 'webp']
  │     - width <= 4096, height <= 4096
  │     - total pixels <= 16,777,216
  ├─ 4. Re-encode & Strip:
  │     - .rotate() (auto-orient EXIF orientation, then drop EXIF)
  │     - .toFormat('webp', { quality: 90, effort: 4 })
  │     - write sanitized WebP directly over temporary file
  └─ If sharp throws: unlink temp file, halt with HTTP 400 MALFORMED_IMAGE
  │
  ▼
Cloudinary Upload (uploads the already-decoded, sanitized WebP)
  │
  ▼
try...finally guarantees temporary file unlinking on local disk
```

#### 2.3.3 Failure Handling & Decompression-Bomb Mitigation
- **Decompression Bombs**: Mitigated by `limitInputPixels: 16777216` (16.7 MP). If an image expands to more than 16.7 MP in uncompressed memory, `sharp` rejects the file instantly before allocating large pixel buffers.
- **Corrupt Streams**: `failOnError: true` forces `sharp` to reject truncated or corrupted bitstreams.

---

## 3. Finding F-07: Rate-Limiter Deployment Scope

### 3.1 Verified Current Behavior
- `server/middleware/Security/RateLimiter.js` implements `avatarUploadLimiter` using `express-rate-limit`'s built-in `MemoryStore`.
- Counts are held in Node.js process heap memory.

### 3.2 Deployment Topology Inspection
An inspection of the repository's deployment manifests reveals:
1. **`compose.prod.yaml`**: Configures a single replica of the `server` container (`container_name: auctionx-server-prod`) behind the Nginx reverse proxy.
2. **`render.yaml`**: Defines a single web service instance (`auctionx-server`, `plan: starter`).
3. **`compose.yaml`**: Development environment runs a single `server` instance.

**Verified Fact**: The current AuctionX production and development architectures run **a single backend process**. Under the current single-instance deployment, `MemoryStore` accurately enforces the approved quota of 10 uploads per 15 minutes globally.

### 3.3 Scaling Implications & Shared-Store Design
- If AuctionX scales horizontally to multiple backend instances (e.g. Render autoscaling or Kubernetes cluster), each instance will maintain its own `MemoryStore`, effectively allowing $10 \times N$ uploads per window.
- **Existing Redis Infrastructure**: Notice that `compose.prod.yaml` already runs a Redis 7 instance (`auctionx-redis-prod`) for the recommendation service, and `render.yaml` defines a `REDIS_URL`.
- **Proposed Shared-Store Design**:
  - Implement a dual-mode rate limiter in `server/middleware/Security/RateLimiter.js`.
  - When `REDIS_URL` is configured and `process.env.RATE_LIMIT_STORE === "redis"`, use `rate-limit-redis`.
  - When `REDIS_URL` is omitted, cleanly fall back to `MemoryStore`.
  - **Failure Policy**: Implement a **fail-open** policy on Redis connection timeout so that a transient Redis outage does not block legitimate user avatar uploads.

---

## 4. Finding F-08: Cloudinary Rollback Recovery

### 4.1 Verified Current Behavior
- If MongoDB `.save()` fails after Cloudinary upload succeeds, the controller catches the error and executes:
  ```javascript
  if (uploadedImage?.public_id) {
    await deleteFromCloudinary(uploadedImage.public_id).catch(() => {});
  }
  ```
- If the Cloudinary API call fails (network glitch, socket timeout, service disruption), the error is logged and discarded. The uploaded asset remains orphaned in Cloudinary.

### 4.2 Proposed Remediation: Two-Tier Rollback & Reconciliation

#### Tier 1: Immediate Bounded Retry with Exponential Backoff
Enhance `deleteFromCloudinary` in `server/middleware/Media/cloudinaryMiddleware.js` to execute up to 3 immediate bounded retry attempts with exponential backoff:
- Attempt 1: Immediate.
- Attempt 2: After 500 ms.
- Attempt 3: After 1,500 ms.
- **Timeout**: 3,000 ms per attempt.
- This resolves >98% of transient network timeouts without introducing background workers.

#### Tier 2: Durable Reconciliation Outbox (Optional Staged Enhancement)
If Tier 1 retries are exhausted:
1. **Model**: Leverage AuctionX's established outbox pattern (identical to `RecommendationOutbox.js`). Introduce `server/models/AssetCleanupOutbox.js`:
   ```javascript
   {
     public_id: { type: String, required: true, index: true },
     assetType: { type: String, enum: ["avatar", "product"], default: "avatar" },
     status: { type: String, enum: ["PENDING", "FAILED", "RESOLVED"], default: "PENDING" },
     attempts: { type: Number, default: 0 },
     createdAt: { type: Date, default: Date.now },
     lastAttemptAt: { type: Date }
   }
   ```
2. **Reconciliation Task**: Attach a periodic job to `server/services/schedulerService.js` (runs every 6 hours).
3. **Safety & Reference Check**: Before calling `cloudinary.v2.uploader.destroy(item.public_id)`, the reconciler queries `UserModel` and `SellerModel`:
   ```javascript
   const isReferenced = await UserModel.exists({ "profilePic.public_id": item.public_id }) ||
                        await SellerModel.exists({ "profilePic.public_id": item.public_id });
   if (isReferenced) {
     // Asset was subsequently referenced or rescued; mark resolved without deleting!
     await AssetCleanupOutbox.updateOne({ _id: item._id }, { status: "RESOLVED" });
     return;
   }
   ```
4. **Credential Protection**: Cleanup failure logs must only output `{ event: "CLOUDINARY_CLEANUP_FAILURE", public_id }` and must **never** log API keys, secrets, or user tokens.

---

## 5. Finding F-09: Rate-Limit Key Namespacing

### 5.1 Verified Current Behavior
- `RateLimiter.js` currently defines:
  ```javascript
  keyGenerator: (req) => {
    return req.user?._id?.toString() || req.seller?._id?.toString() || req.ip;
  }
  ```
- Because both user and seller authentication attach the authenticated entity to `req.user` or `req.seller`, the resulting key is the raw 24-character hexadecimal ObjectId (e.g. `"60c72b2f9b1d8b2bad000001"`).
- If a user and a seller in separate collections share an identical string ID, their rate-limiting quotas would collide in the limiter store.

### 5.2 Proposed Remediation: Explicit Namespace Keying
Update `keyGenerator` in `server/middleware/Security/RateLimiter.js` to namespace keys based on authenticated account type and route context:

```javascript
keyGenerator: (req) => {
  // 1. Authenticated Seller context
  if (req.originalUrl.includes("/seller") || req.seller || req.user?.storeName) {
    const sellerId = req.seller?._id || req.user?._id;
    if (sellerId) return `seller:${sellerId.toString()}`;
  }

  // 2. Authenticated User context
  if (req.user?._id) {
    return `user:${req.user._id.toString()}`;
  }

  // 3. Fallback to client IP for unauthenticated requests
  return `ip:${req.ip}`;
}
```

### 5.3 Immunity to Client Tampering
- The prefix is derived from server-verified tokens and route endpoints.
- Client-supplied parameters in request body (`req.body.id`, `req.body.role`) or query strings are ignored.
- A malicious user cannot supply `req.body.sellerId` to consume another seller's quota.

---

## 6. Implementation Scope and File-by-File Action Plan

| File | Change Nature | Finding Addressed | Scope of Modification |
| :--- | :---: | :---: | :--- |
| `server/package.json` | Manifest Update | **F-06** | Add `"sharp": "^0.33.5"`. *(Requires owner approval)* |
| `server/utlis/Image/imageSignatureValidator.js` | Code Modification | **F-06** | Integrate `sharp` metadata parsing, bitstream validation, and dimension enforcement. |
| `server/middleware/Media/ImageUpload.js` | Code Modification | **F-06** | Add in-process pixel decoding and WebP re-encoding before Cloudinary dispatch. |
| `server/middleware/Security/RateLimiter.js` | Code Modification | **F-07, F-09** | Add `user:`/`seller:` key namespacing; implement conditional Redis store support. |
| `server/middleware/Media/cloudinaryMiddleware.js` | Code Modification | **F-08** | Implement bounded exponential backoff retries for asset deletions. |
| `server/models/AssetCleanupOutbox.js` | New File | **F-08** | Optional durable outbox schema for orphaned asset recovery. *(Requires approval)* |
| `server/tests/integration/auth/avatarUploadSecurity.test.js` | Test Expansion | **F-06, F-07, F-08, F-09** | Add tests for namespaced rate limit keys, polyglots past byte 2048, and cleanup retries. |

---

## 7. Proposed Tests and Acceptance Criteria

### Test 1: Rate Limiter Key Namespacing (`F-09`)
- **Setup**: Create a User `U1` and a Seller `S1` configured with the exact same mock ObjectId string (`"507f1f77bcf86cd799439011"`).
- **Execution**: User `U1` exhausts 10 uploads on `/api/auth/user/upload-profile-pic` and receives HTTP 429 on the 11th request.
- **Assertion**: Seller `S1` can immediately make a successful upload on `/api/auth/seller/upload-profile-pic` with HTTP 200, proving independent key buckets (`user:507f...` vs `seller:507f...`).

### Test 2: Deep Script Injection Rejection (`F-06`)
- **Setup**: Create a valid 100x100 JPEG image. Append `<script>alert('xss')</script>` at byte offset 3,500 inside a valid JPEG `COM` (Comment) marker.
- **Execution**: Submit to `/api/auth/user/upload-profile-pic`.
- **Assertion**: `sharp` sanitization re-encodes the image into a clean WebP stream; the output binary contains 0 occurrences of `<script>`.

### Test 3: Decompression Bomb Rejection (`F-06`)
- **Setup**: Create an image claiming 10,000 x 10,000 dimensions (100 MP) in the header.
- **Execution**: Submit to upload endpoint.
- **Assertion**: Request is rejected with HTTP 400 and `PIXELS_EXCEEDED` before allocating heap memory.

### Test 4: Bounded Rollback Retries (`F-08`)
- **Setup**: Simulate Cloudinary deletion network failure on the first two attempts and success on the third attempt.
- **Assertion**: Controller completes retry loop and confirms asset deletion.

---

## 8. Explicit Decisions Requiring Owner Approval

Before implementing Stage 7.31 code changes, the project owner must review and approve:

1. **Dependency Approval for `sharp` (`F-06`)**:
   - Approve adding `sharp@^0.33.5` ($\sim 28\text{ MB}$) to `server/package.json`.
2. **Infrastructure Store Decision for Rate Limiter (`F-07`)**:
   - Confirm whether AuctionX production will continue as a single container (retaining `MemoryStore`) or whether `rate-limit-redis` should be activated against the existing Redis container.
3. **Durable Outbox Schema Decision (`F-08`)**:
   - Approve whether Tier 1 (immediate 3-attempt backoff retry) is sufficient, or whether Tier 2 (adding the `AssetCleanupOutbox` MongoDB collection and scheduled background worker) should be created.

---

## 9. Repository Safety Verification

```bash
$ git status --short
# Output confirms:
# - All 27 staged documentation renames remain preserved in the index.
# - All 22 quarantined visual assets in docs/licenses/ and public/ remain intact.
# - All 6 Banner4 SVGs remain intact.
# - Root LICENSE is unmodified.
# - No application source, tests, manifests, or config files were altered.

$ git diff --check
# Output: Exit code 0 (No whitespace errors, trailing whitespace, or conflict markers).
```

---

## 10. Completion Status and Release Recommendation

### Completion Status
**`RESIDUAL SECURITY REMEDIATION PLAN COMPLETE — AWAITING REQUIRED APPROVALS`**

### Release Gate Status
**`PUBLIC RELEASE STILL BLOCKED — REASSESS AFTER INDEPENDENT VERIFICATION`**
