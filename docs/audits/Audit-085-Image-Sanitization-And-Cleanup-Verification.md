# Stage 7.32 — Independent Verification of Image Sanitization and Cleanup Recovery

## 1. Executive Summary

| Attribute | Details |
| :--- | :--- |
| **Stage** | Stage 7.32 — Independent Verification of Image Sanitization and Cleanup Recovery |
| **Verification Scope** | Independent read-only verification of remediations for **F-06**, **F-07**, and **F-08** |
| **Target Implementation** | [`docs/audits/Audit-084-Residual-Avatar-Security-Implementation.md`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/docs/audits/Audit-084-Residual-Avatar-Security-Implementation.md) |
| **Remediation Plan** | [`docs/audits/Audit-083-Residual-Avatar-Security-Remediation-Plan.md`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/docs/audits/Audit-083-Residual-Avatar-Security-Remediation-Plan.md) |
| **Reference Audit** | [`docs/audits/Audit-082-Avatar-Upload-Independent-Security-Audit.md`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/docs/audits/Audit-082-Avatar-Upload-Independent-Security-Audit.md) |
| **Verification Mode** | Strictly Read-Only Source Inspection, Manifest Audit & Test Execution Verification |
| **Verification Status** | **`INDEPENDENT VERIFICATION PASSED — TESTED SCOPE DOCUMENTED`** |
| **Release Gate Status** | **`PUBLIC RELEASE STILL BLOCKED — REASSESS AFTER VERIFICATION`** |
| **Date** | 2026-10-20 |
| **Author** | Independent Security & Quality Assurance Verification Agent |

This independent verification audit evaluated the changes committed during Stage 7.31 for AuctionX findings **F-06** (Full Image Decoding, Sanitization, and Normalization), **F-07** (Rate-Limit Key Namespacing & Deployment Topology), and **F-08** (Bounded Cloudinary Cleanup Recovery).

The verification confirmed that:
1. **F-06**: `sharp@^0.35.5` is integrated into the upload pipeline. All uploaded image bitstreams undergo preliminary heuristic screening, in-process pixel decoding with decoder-level decompression bomb limits (`limitInputPixels: 16777216`), dimension verification ($\le 4096\text{px}$), orientation normalization via `.rotate()`, complete metadata/script purging, and re-encoding into normalized WebP buffers prior to Cloudinary transmission.
2. **F-07**: Rate-limit keys are namespaced with `user:` and `seller:` prefixes derived strictly from authenticated server context (`req.user` / `req.seller`) and route paths (`/seller`). Client-supplied body or query parameters cannot influence the quota bucket. Deployment manifests (`render.yaml`, `compose.prod.yaml`) confirm a single-instance container topology where `MemoryStore` functions effectively.
3. **F-08**: Cloudinary asset deletion rollback on database save failure implements bounded exponential retries ($N=3$, backoffs: $0\text{ms}, 500\text{ms}, 1500\text{ms}$, per-attempt timeout: $3000\text{ms}$). Provider responses `{ result: "ok" }` and `{ result: "not found" }` are treated as successful cleanup. Failure exhaustion emits structured, secret-free `CLOUDINARY_CLEANUP_FAILURE` log events. The original database save error remains the primary HTTP response.
4. **Test Quality**: Automated tests in `avatarUploadSecurity.test.js` were verified to use genuine, decodable $100 \times 100$ pixel image buffers generated dynamically via `sharp` rather than synthetic header-only mock buffers. All 56 automated tests across 4 test suites passed.
5. **Operational Realities & Residual Risks**: The durable cleanup outbox remains deferred per owner decision; persistent external provider outages leave orphaned Cloudinary assets requiring log monitoring. `MemoryStore` is process-local; horizontal scaling would require Redis. Live Docker/Render builds were not executed in this environment and remain classified as `NOT VERIFIED`.

---

## 2. Image-Sanitization Pipeline Verification (F-06)

### 2.1 Component Source Inspection

The pipeline was inspected across three primary implementation files:
- [`server/utlis/Image/imageSignatureValidator.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/utlis/Image/imageSignatureValidator.js)
- [`server/middleware/Media/ImageUpload.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/middleware/Media/ImageUpload.js)
- [`server/utlis/Image/multerConfig.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/utlis/Image/multerConfig.js)

### 2.2 Core Verification Criteria

| # | Requirement | Source Reference | Evaluation & Evidence | Classification |
| :-: | :--- | :--- | :--- | :---: |
| **1** | **Accepted Formats Restricted to JPEG, PNG, WebP** | `multerConfig.js:18-23`<br>`imageSignatureValidator.js:235-274, 342-349` | Multer's `fileFilter` allows only `image/jpeg`, `image/png`, and `image/webp`. `validateImageBuffer` verifies magic bytes for PNG, JPEG, and WebP (including VP8, VP8L, VP8X chunk headers). `decodeAndSanitizeImage` queries `pipeline.metadata().format` strictly against `['jpeg', 'png', 'webp']`. Non-whitelisted formats return HTTP 400 `UNSUPPORTED_FORMAT`. | `VERIFIED FOR TESTED CASES` |
| **2** | **5 MB Limit Enforced Prior to Expensive Processing** | `multerConfig.js:28`<br>`ImageUpload.js:30-38`<br>`imageSignatureValidator.js:215-217, 288-290` | Multer enforces `limits: { fileSize: 5 * 1024 * 1024 }` before writing to disk. If exceeded, `ImageUpload.js` immediately unlinks temporary files and returns HTTP 400 `LIMIT_FILE_SIZE`. Secondary boundary check in `validateImageFile` verifies `stat.size <= MAX_FILE_SIZE` before memory buffer reading or sharp initialization. | `VERIFIED FOR TESTED CASES` |
| **3** | **Decoding & Re-Encoding Occur Prior to Cloudinary Receipt** | `ImageUpload.js:44-59, 62-87`<br>`imageSignatureValidator.js:333-387` | In `ImageUpload.js`, loop 1 sequentially awaits `decodeAndSanitizeImage(file.path)` for all files. Loop 2 dispatches to `uploadToCloudinary` only after loop 1 succeeds. `decodeAndSanitizeImage` rasterizes pixels and overwrites the disk file with clean WebP bytes (`fs.writeFileSync`). Cloudinary receives only the re-encoded file. | `VERIFIED FOR TESTED CASES` |
| **4** | **Decoder-Level Pixel Limits (16.7 MP) & Dimension Bounds (4,096px)** | `imageSignatureValidator.js:5-6, 334-375` | `sharp(inputBuffer, { failOnError: true, limitInputPixels: 16777216 })` activates decoder-level decompression bomb protection, preventing allocation of excessive memory prior to rasterization. Metadata checks enforce `width <= 4096`, `height <= 4096`, and `width * height <= 16777216`. Oversized inputs return `DIMENSIONS_EXCEEDED` or `PIXELS_EXCEEDED`. | `VERIFIED FOR TESTED CASES` |
| **5** | **Safe Failure on Malformed, Truncated, & Unsupported Streams** | `imageSignatureValidator.js:335, 396-410` | `failOnError: true` forces `sharp` to reject damaged or truncated streams. Errors containing "pixel limit" map to `PIXELS_EXCEEDED`; general decode failures map to `MALFORMED_IMAGE`. No unhandled exceptions or internal stack traces escape to the client. | `VERIFIED FOR TESTED CASES` |
| **6** | **Orientation Normalization & Complete Metadata Stripping** | `imageSignatureValidator.js:380-383` | `.rotate()` auto-rotates pixels according to EXIF orientation and removes the EXIF orientation tag. Re-encoding via `.webp({ quality: 90, effort: 4 })` writes a clean WebP stream. Because `.withMetadata()` is omitted, all EXIF, GPS, XMP, IPTC, and trailing comments/polyglot scripts are stripped. | `VERIFIED FOR TESTED CASES` |
| **7** | **Normalized WebP File on Disk Dispatched to Cloudinary** | `ImageUpload.js:70`<br>`imageSignatureValidator.js:386` | `fs.writeFileSync(filePath, sanitizedBuffer)` overwrites the original Multer temporary file on disk. `uploadToCloudinary(file.path, ...)` reads that identical path. In Criterion 22 test, the disk file content during the upload call was verified to be clean WebP starting with `RIFF....WEBP`. | `VERIFIED FOR TESTED CASES` |
| **8** | **Guaranteed Temporary File Cleanup on Success & Failure** | `ImageUpload.js:9-23, 31, 50, 77-83, 92` | `cleanupAllTempFiles(req.files)` runs on Multer error, validation failure, and Cloudinary error. Inside the upload loop, `try { ... } finally { fs.unlinkSync(file.path); }` guarantees cleanup upon upload completion or network abort. | `VERIFIED FOR TESTED CASES` |
| **9** | **Avatar Preservation on Validation, Upload, or DB Save Failure** | `UserProfileController.js:280-293`<br>`SellerProfileController.js:219-232` | On validation failure, execution halts before Cloudinary or MongoDB is invoked. On Cloudinary failure, the controller is never reached. On database save failure, the catch block triggers Cloudinary rollback and returns HTTP 500 without modifying or unlinking the existing stored avatar. | `VERIFIED FOR TESTED CASES` |

---

## 3. Security-Test Quality & Execution Evidence

### 3.1 Genuine Decodable Fixtures vs Handcrafted Buffers

In Stage 7.29, finding F-06 highlighted that synthetic header-only buffers (`Buffer.from([0x89, 0x50, 0x4e, 0x47, ...])`) do not prove that an image decoder is executing.

Inspection of [`server/tests/integration/auth/avatarUploadSecurity.test.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/tests/integration/auth/avatarUploadSecurity.test.js#L31-L54) confirms that genuine test images are generated in `beforeAll` via `sharp`:

```javascript
beforeAll(async () => {
  VALID_PNG_BUFFER = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 128, b: 255 } },
  }).png().toBuffer();

  VALID_JPEG_BUFFER = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
  }).jpeg().toBuffer();

  VALID_WEBP_BUFFER = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 255, b: 0 } },
  }).webp().toBuffer();
});
```

These are authentic, decodable $100 \times 100$ pixel compressed bitmaps. Handcrafted buffers are retained solely where corrupt, oversized, or malicious payloads must be deterministically simulated (e.g. truncated IHDR chunks, giant dimension headers, embedded script tags).

### 3.2 Security Test Suite Coverage

| Security Test Case | Test File & Criteria | Implementation Verification | Execution Status |
| :--- | :--- | :--- | :---: |
| **Valid JPEG, PNG, WebP** | `avatarUploadSecurity.test.js` Criterion 8 | Submits real decodable buffers for all three formats; confirms HTTP 200 and Cloudinary dispatch. | **PASSED** (Executed) |
| **Invalid Signatures & MIME Spoofing** | `avatarUploadSecurity.test.js` Criterion 9d | Attaches executable binary disguised as `.jpg`; rejected with HTTP 400 `UNSUPPORTED_FORMAT`. | **PASSED** (Executed) |
| **Truncated & Malformed Bitstreams** | `avatarUploadSecurity.test.js` Criteria 9c, 24 | Submits truncated PNG signature and truncated JPEG bitstream (`subarray(0, 120)`); rejected with HTTP 400 `MALFORMED_IMAGE`. | **PASSED** (Executed) |
| **Oversized Dimensions (5000px)** | `avatarUploadSecurity.test.js` Criterion 11 | Submits PNG header specifying $5000 \times 5000\text{px}$; rejected with HTTP 400 `DIMENSIONS_EXCEEDED`. | **PASSED** (Executed) |
| **Decompression Bomb (>16.7 MP)** | `avatarUploadSecurity.test.js` Criterion 23 | Submits $5000 \times 5000$ (25 MP) PNG; rejected with HTTP 400 `DIMENSIONS_EXCEEDED` / `PIXELS_EXCEEDED`. | **PASSED** (Executed) |
| **SVG & HTML Rejection** | `avatarUploadSecurity.test.js` Criteria 9a, 9b | Submits HTML `<script>` and SVG disguised as `.jpg`; rejected with HTTP 400 `DISALLOWED_FORMAT`. | **PASSED** (Executed) |
| **Deep Script Injection Past Byte 2048** | `avatarUploadSecurity.test.js` Criterion 22 | Appends 2500 null bytes + `<script>` tag after valid JPEG. Tests disk file during upload: script purged, clean WebP header confirmed. | **PASSED** (Executed) |
| **Temporary File Cleanup on Failure** | `avatarUploadSecurity.test.js` Criteria 13, 25 | Spies on `fs.unlinkSync`; verifies temp files removed after decode failure, size limits, and Cloudinary failure. | **PASSED** (Executed) |
| **Previous Avatar Preservation** | `avatarUploadSecurity.test.js` Criteria 14, 16 | Verifies old avatar URL in MongoDB is unchanged when Cloudinary or DB save fails, and old Cloudinary asset is not deleted. | **PASSED** (Executed) |
| **Bounded Retry Execution** | `cloudinaryCleanupRetry.test.js` Tests 1–8 | Validates 1st attempt, 2nd/3rd retry with backoff, exhaustion at 3, "not found" handling, and log output. | **PASSED** (Executed) |

### 3.3 Test Execution Evidence

All test suites were executed directly against the local workspace:

```bash
# 1. Cloudinary Cleanup Retry Unit Suite
npm test -- tests/unit/media/cloudinaryCleanupRetry.test.js
# Result: PASS (8 passed, 8 total in 1.011s)

# 2. Avatar Upload Security Integration Suite
npm test -- tests/integration/auth/avatarUploadSecurity.test.js
# Result: PASS (25 passed, 25 total in 13.632s)

# 3. Avatar & Profile Photo Preservation Regression Suite
npm test -- tests/unit/controllers/avatarAndProfilePreservation.test.js
# Result: PASS (13 passed, 13 total in 1.199s)

# 4. IDOR Authorization Integration Suite
npm test -- tests/integration/auth/idorAuthorization.test.js
# Result: PASS (10 passed, 10 total in 4.176s)
```

**Total Automated Tests**: 56 passed, 0 failed, 0 skipped.

---

## 4. Cloudinary Retry & Rollback Verification (F-08)

### 4.1 Bounded Retry Logic Inspection

Inspection of [`server/utlis/Image/cloudinaryConfig.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/utlis/Image/cloudinaryConfig.js#L16-L87) (`deleteFromCloudinary`):

```javascript
const deleteFromCloudinary = async (publicId, options = {}) => {
  const maxAttempts = options.maxAttempts || 3;
  const initialDelayMs = options.initialDelayMs !== undefined ? options.initialDelayMs : 500;
  const backoffMultiplier = options.backoffMultiplier || 3;
  const timeoutMs = options.timeoutMs || 3000;
  ...
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 2);
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
    ...
    const result = await Promise.race([destroyPromise, timeoutPromise]);
    if (result && (result.result === "ok" || result.result === "not found")) {
      return result;
    }
  }
};
```

### 4.2 Retry Behavior Verification

| Verification Aspect | Confirmed Parameter / Behavior | Source Evidence | Classification |
| :--- | :--- | :--- | :---: |
| **Maximum Attempts** | Strictly bounded to `3` attempts. Loop exits after `attempt === 3`. | `cloudinaryConfig.js:29` | `VERIFIED FOR TESTED CASES` |
| **Backoff Schedule** | Attempt 1: 0ms (immediate)<br>Attempt 2: 500ms ($500 \times 3^0$)<br>Attempt 3: 1500ms ($500 \times 3^1$) | `cloudinaryConfig.js:31-34`<br>`cloudinaryCleanupRetry.test.js:106-133` | `VERIFIED FOR TESTED CASES` |
| **Per-Attempt Timeout** | 3,000 ms enforced via `Promise.race([destroyPromise, timeoutPromise])`. | `cloudinaryConfig.js:25, 49` | `VERIFIED FOR TESTED CASES` |
| **Timeout Concurrency & Socket Handling** | When `timeoutPromise` rejects, the timer is cleared (`clearTimeout`). However, Node's background HTTP socket continues until provider close because Cloudinary SDK v2 lacks `AbortSignal` support. Retries execute sequentially without unbounded concurrency. | `cloudinaryConfig.js:61-65` | `RESIDUAL RISK` |
| **Provider Response Semantics** | `{ result: "ok" }` and `{ result: "not found" }` both return immediately as successful cleanup. | `cloudinaryConfig.js:52-54`<br>`cloudinaryCleanupRetry.test.js:39-46` | `VERIFIED FOR TESTED CASES` |
| **Observable Failure Event** | Logs `{ event: "CLOUDINARY_CLEANUP_FAILURE", public_id, attempts: 3, error }` via Winston & console fallback. | `cloudinaryConfig.js:69-85`<br>`cloudinaryCleanupRetry.test.js:84-104` | `VERIFIED FOR TESTED CASES` |
| **Credential / PII Redaction** | Failure payload contains only `public_id`, attempt count, and error string. Zero API keys, secrets, tokens, or emails logged. | `cloudinaryConfig.js:69-74`<br>`cloudinaryCleanupRetry.test.js:100-103` | `VERIFIED FOR TESTED CASES` |
| **Primary Error Preservation** | In `UserProfileController.js:289-292` and `SellerProfileController.js:228-231`, rollback rejection is caught; original HTTP 500 DB error is returned. | `UserProfileController.js:283-293`<br>`avatarUploadSecurity.test.js:383-400` | `VERIFIED FOR TESTED CASES` |
| **Asset Reference Protection** | Previous custom avatars, Google photos, and predefined avatars are never unlinked unless the new image save is fully committed. | `UserProfileController.js:296-311`<br>`avatarUploadSecurity.test.js:403-424` | `VERIFIED FOR TESTED CASES` |
| **Non-Durable Rollback (Orphan Risk)** | If all 3 attempts fail, the asset remains orphaned on Cloudinary. Durable outbox reconciliation remains deferred. | `cloudinaryConfig.js:86` | `RESIDUAL RISK` |

---

## 5. Rate-Limit Keying & Deployment Topology Verification (F-07)

### 5.1 Key Generator Implementation Inspection

Inspection of [`server/middleware/Security/RateLimiter.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/middleware/Security/RateLimiter.js#L23-L64):

```javascript
const avatarUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_AVATAR_MAX ? parseInt(process.env.RATE_LIMIT_AVATAR_MAX, 10) : 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const isSellerContext =
      (req.originalUrl && req.originalUrl.includes("/seller")) ||
      (req.baseUrl && req.baseUrl.includes("/seller")) ||
      req.seller ||
      req.user?.role === "seller";

    if (isSellerContext) {
      const sellerId = req.seller?._id || req.user?._id;
      if (sellerId) return `seller:${sellerId.toString()}`;
    }

    if (req.user?._id) return `user:${req.user._id.toString()}`;

    return `ip:${req.ip}`;
  },
  handler: (req, res) => {
    const retryAfter = Math.ceil(15 * 60);
    res.set("Retry-After", retryAfter.toString());
    return res.status(429).json({
      success: false,
      status: "error",
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many avatar upload attempts. Please try again after 15 minutes.",
      retryAfter,
    });
  },
});
```

### 5.2 Verification of Rate Limiting Controls

1. **Namespace Isolation**:
   - User account generates `user:<ObjectId>`.
   - Seller account generates `seller:<ObjectId>`.
   - Verified via Criterion 20: user and seller with identical string ObjectIds maintain independent quota counters without collision.
2. **Server Context Authentication Only**:
   - `req.body` and `req.query` are completely ignored by `keyGenerator`.
   - Verified via Criterion 21: client sending `role: "seller"`, `sellerId: "..."`, or `userId: "..."` cannot alter the server-generated key.
3. **Middleware Ordering**:
   - In [`UserAuthRoutes.js:200-214`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/routes/LoginRoutes/UserAuthRoutes.js#L200-L214) and [`SellerAuthRoutes.js:210-224`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/routes/LoginRoutes/SellerAuthRoutes.js#L210-L224):
     `authUserMiddleware` runs **before** `loginLimiter.avatarUploadLimiter`.
   - Unauthenticated requests are rejected with HTTP 401 before hitting the rate limiter key generator.
4. **Quota Maintenance**:
   - Quota of 10 uploads per 15 minutes is configured. In test mode (`NODE_ENV === "test"`), the default remains 10 (not relaxed like telemetryLimiter).
   - HTTP 429 response includes standard `Retry-After: 900` header and structured error JSON.
5. **Deployment Topology Verification**:
   - [`render.yaml:5-46`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/render.yaml#L5-L46) defines a single web service `auctionx-server` (`plan: starter`).
   - [`compose.prod.yaml:82-100`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/compose.prod.yaml#L82-L100) defines a single container `auctionx-server-prod`.
   - Redis container (`auctionx-redis-prod`) is isolated on `auctionx-prod-rec-network` exclusively for the recommendation service; `server` does not have network access or credentials for Redis.
   - **Conclusion**: Under the single-instance topology, `MemoryStore` accurately enforces the global rate limit. If horizontal autoscaling is enabled in the future, a shared store dependency must be introduced.

---

## 6. Dependency and Deployment Compatibility Verification

### 6.1 Dependency Analysis

Inspection of [`server/package.json`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/package.json#L50) and [`server/package-lock.json`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/package-lock.json):

| Dependency Package | Locked Version | Runtime / Platform Target | Status |
| :--- | :---: | :--- | :---: |
| `sharp` | `0.35.5` | Node.js `>=20.9.0` | `VERIFIED FOR TESTED CASES` |
| `@img/sharp-win32-x64` | `0.35.5` | Windows x64 (Local Development) | `VERIFIED FOR TESTED CASES` (Executed) |
| `@img/sharp-linux-x64` | `0.35.5` | Linux Glibc x64 (Render Native Node Runtime) | `VERIFIED IN LOCKFILE` |
| `@img/sharp-linuxmusl-x64` | `0.35.5` | Linux Musl x64 (Alpine Container Target) | `VERIFIED IN LOCKFILE` |
| `@img/sharp-libvips-linuxmusl-x64` | `1.3.4` | Patched `libvips 8.18.7` for Alpine Linux | `VERIFIED IN LOCKFILE` |

### 6.2 Deployment Manifest Audit

1. **`server/Dockerfile`**:
   - Base image: `FROM node:20-alpine AS base`
   - Node 20 LTS satisfies `sharp`'s requirement of Node.js `>=20.9.0`.
   - Production target: `RUN npm ci --omit=dev` installs `@img/sharp-linuxmusl-x64` from lockfile.
2. **`render.yaml`**:
   - Service: `auctionx-server`, `runtime: node`, `rootDir: server`, `buildCommand: npm ci`.
   - Render's Node runtime natively executes `npm ci` on Linux x64 with Node 20 LTS.
3. **Deployment Verification Status**:
   - Per safety rules, no live Docker container build (`docker build`) or Render deployment was triggered in this read-only stage.
   - Therefore, live multi-stage Docker container execution and live Render staging deployment are classified as **`NOT VERIFIED`** locally.

---

## 7. Findings Matrix & Classification Summary

| ID | Item Description | Scope | Verification Status | Notes / Residual Risks |
| :---: | :--- | :---: | :---: | :--- |
| **V-01** | Accepted image formats restricted strictly to JPEG, PNG, WebP | F-06 | `VERIFIED FOR TESTED CASES` | Enforced by Multer MIME filter, magic bytes, and sharp decoder. |
| **V-02** | 5 MB upload limit enforced before expensive decoding | F-06 | `VERIFIED FOR TESTED CASES` | Enforced by Multer and preliminary stat check. |
| **V-03** | In-process pixel decoding and WebP re-encoding before Cloudinary dispatch | F-06 | `VERIFIED FOR TESTED CASES` | Verified via disk inspection in Criterion 22 test. |
| **V-04** | Decoder-level decompression bomb limits (16.7 MP) & dimension limits (4,096px) | F-06 | `VERIFIED FOR TESTED CASES` | Sharp `limitInputPixels` and dimension guards verified. |
| **V-05** | Malformed, truncated, and corrupt streams fail safely without crash | F-06 | `VERIFIED FOR TESTED CASES` | Caught and mapped to HTTP 400 `MALFORMED_IMAGE`. |
| **V-06** | EXIF orientation auto-rotated and metadata/polyglots stripped | F-06 | `VERIFIED FOR TESTED CASES` | Tested with trailing script polyglot past byte 2048. |
| **V-07** | Temporary files cleaned up on success and all failure paths | F-06 | `VERIFIED FOR TESTED CASES` | Verified with `fs.unlinkSync` spy across success/failure tests. |
| **V-08** | Existing avatars preserved when upload or DB save fails | F-06 / F-08 | `VERIFIED FOR TESTED CASES` | Verified across unit and integration tests. |
| **V-09** | Rate-limit keys namespaced with `user:` and `seller:` prefixes | F-07 | `VERIFIED FOR TESTED CASES` | Verified with identical ObjectIds between user and seller. |
| **V-10** | Rate-limit key immune to client body/query tampering | F-07 | `VERIFIED FOR TESTED CASES` | Key generator references only server authentication context. |
| **V-11** | Authentication executes before account rate limiting | F-07 | `VERIFIED FOR TESTED CASES` | Unauthenticated requests fail with 401 before rate limiter keying. |
| **V-12** | 10 uploads per 15 minutes quota enforced | F-07 | `VERIFIED FOR TESTED CASES` | Verified via 11th request throttling test. |
| **V-13** | Single-instance topology confirmed in deployment manifests | F-07 | `VERIFIED FOR TESTED CASES` | Verified in `render.yaml` and `compose.prod.yaml`. |
| **V-14** | Process-local `MemoryStore` multi-instance limitation | F-07 | `RESIDUAL RISK` | Horizontal autoscaling requires shared Redis store. |
| **V-15** | Bounded Cloudinary deletion retries (max 3 attempts, exponential backoff) | F-08 | `VERIFIED FOR TESTED CASES` | Backoffs 0ms, 500ms, 1500ms verified with fake timers. |
| **V-16** | Cloudinary per-attempt timeout (3,000 ms) | F-08 | `VERIFIED FOR TESTED CASES` | Timeout enforced via `Promise.race`. |
| **V-17** | Cloudinary SDK v2 socket cancellation on timeout | F-08 | `RESIDUAL RISK` | Cloudinary v2 lacks `AbortSignal`; socket closes on provider disconnect. |
| **V-18** | Provider responses `{ result: "ok" }` and `{ result: "not found" }` treated as clean | F-08 | `VERIFIED FOR TESTED CASES` | Tested in unit test 2. |
| **V-19** | Structured, credential-free logging on cleanup exhaustion | F-08 | `VERIFIED FOR TESTED CASES` | Tested in unit test 6 (`CLOUDINARY_CLEANUP_FAILURE`). |
| **V-20** | Non-durable rollback residual risk (orphaned assets on prolonged outage) | F-08 | `RESIDUAL RISK` | Durable outbox deferred by owner decision; requires log monitoring. |
| **V-21** | Precompiled sharp platform packages locked in `package-lock.json` | F-06 | `VERIFIED FOR TESTED CASES` | Windows, Linux glibc, and Linux musl prebuilds present. |
| **V-22** | Live Docker container compilation and Render deployment verification | Deployment | `NOT VERIFIED` | Live builds not executed locally due to read-only constraints. |

---

## 8. Residual Risks & Operational Follow-Up

The following residual risks are explicitly documented for engineering and operations:

### 8.1 Orphaned Cloudinary Assets on Persistent Outage (F-08)
- **Classification**: `RESIDUAL RISK`
- **Impact**: If Cloudinary's API experiences prolonged downtime exceeding 3 retry attempts, an uploaded avatar will remain in Cloudinary storage without a corresponding database pointer.
- **Operational Procedure**:
  1. Set up an alert rule on Winston log aggregation for `event: "CLOUDINARY_CLEANUP_FAILURE"`.
  2. The alert payload provides the exact `public_id`.
  3. Support operators can verify whether the `public_id` exists in `User` or `Seller` collections and execute manual deletion if unreferenced.
  4. Post-release roadmap should evaluate the durable `AssetCleanupOutbox` when scheduled workers are introduced.

### 8.2 Horizontal Scaling Without Shared Redis Store (F-07)
- **Classification**: `RESIDUAL RISK`
- **Impact**: `express-rate-limit` uses in-memory tracking. If AuctionX is scaled to $N$ backend instances, a user could theoretically execute $10 \times N$ uploads per 15 minutes.
- **Operational Procedure**:
  Prior to deploying multiple replicas in Render or Docker Swarm/K8s, configure `rate-limit-redis` using a shared Redis instance.

### 8.3 Live Deployment Environment Execution
- **Classification**: `NOT VERIFIED`
- **Impact**: While package manifests confirm `@img/sharp-linuxmusl-x64` is locked and Node 20 LTS is targeted, a live Docker build (`docker compose -f compose.prod.yaml build server`) was not executed in this environment.
- **Operational Procedure**:
  Execute a pre-release staging smoke build in a dedicated CI/CD pipeline before general availability.

---

## 9. Repository Safety Checks

All repository safety checks were executed at the conclusion of Stage 7.32:

1. **`git status --short`**:
   - Confirmed only `docs/audits/Audit-085-Image-Sanitization-And-Cleanup-Verification.md` was created.
   - All 22 quarantined visual assets in `client/public/*.svg` remain intact.
   - All 6 Banner4 SVGs in `client/src/assets/images/components/Banner4/*.svg` remain intact.
   - Database `Auction-X-Major` was completely ignored.
   - Root `LICENSE` remains unmodified.
2. **`git diff --check`**:
   - Exited with code 0 (no trailing whitespace or merge conflict markers).
3. **`git diff --cached --name-status`**:
   - Confirmed all 27 pre-existing staged documentation renames remain untouched in the Git index.
4. **Git Remote Safety**:
   - Zero Git commits, pushes, taggings, remotes, or deployment commands were executed.

---

## 10. Final Verification Assessment

### Stage 7.32 Verification Assessment

```
INDEPENDENT VERIFICATION PASSED — TESTED SCOPE DOCUMENTED
```

The Stage 7.31 remediations for findings F-06, F-07, and F-08 are robust, comprehensively tested with genuine decodable fixtures, and correctly integrated into the application pipeline. Known operational limitations (process-local rate limiting, non-durable cleanup recovery) are documented with monitoring procedures.

### Project Release Gate Status

```
PUBLIC RELEASE STILL BLOCKED — REASSESS AFTER VERIFICATION
```

While the avatar upload security and cleanup remediation scope is verified and complete, overall public release remains blocked pending resolution of wider project blockers documented in Stage 7.11 / Stage 7.2.
