# Stage 7.21 — KYC Upload Security Review and High-Priority Local Asset Remediation Audit

**Date:** 2026-10-19  
**Execution Stage:** Stage 7.21  
**Auditor:** Antigravity AI Pair Programmer  
**Target Repository:** AuctionX (Local Local Workspace)  
**Status:**  
`PARTIAL REMEDIATION — PUBLIC RELEASE STILL BLOCKED`

---

## 1. Executive Summary

Stage 7.21 addressed the top-priority security and intellectual property findings identified in Stage 7.20 across two strictly bounded workstreams:

1. **Workstream A — KYC Upload Security Review & Investigation (P0):**
   - Conducted an in-depth code and architecture inspection of the profile verification pages (`VerifyProfilePage.jsx` and `VerifySellerProfilePage.jsx`), backend routes, middleware, controllers, database models, and upload pipelines.
   - Verified that both verification pages execute direct, unauthenticated client-side uploads to Cloudinary (`api.cloudinary.com/v1_1/dszvpb3q5/image/upload`) using an unsigned upload preset named `product_image`.
   - Determined that the uploaded files in the current implementation are actually user avatar images (`profilePic`) rather than structured government KYC documents (e.g., Aadhaar, passport, GST/tax certificates).
   - Determined that existing backend upload routes (`/api/auth/user/upload-profile-pic` and `/api/auth/seller/upload-profile-pic`) were designed exclusively for public profile avatars: they enforce public Cloudinary delivery, apply facial crop transformations (`crop: "fill", gravity: "face"`), lack content-inspection magic-byte MIME validation, and publish asset URLs directly to public user schemas.
   - In accordance with mandatory repository safety rules ("Do not invent API routes or assume an existing upload endpoint supports KYC documents. If safe remediation requires production configuration changes, migration of existing documents, or an unapproved architectural decision, stop at the implementation boundary, document the blocker, and provide a concrete owner-review plan"), this finding has been investigated and documented as an architectural blocker requiring an owner decision before production deployment.

2. **Workstreams B, C & D — High-Priority Visual Asset Remediation (P1):**
   - **Workstream B (Primary Logo):** Created an original, locally authored SVG brand identity component (`AuctionXLogo.jsx`) using the platform's terracotta design tokens and adaptive light/dark mode styling. Replaced remote Cloudinary logo hotlinks in `Navbar.jsx` and `SellerNavbar.jsx`. Inspected and documented `PaymentPage.jsx:202` (isolated Razorpay checkout modal parameter requiring an external HTTPS delivery endpoint for its iframe).
   - **Workstream C (Default Avatars):** Verified the presence and integrity of `client/public/default-profile.png` (1,077 bytes). Replaced all 6 remote Flaticon CDN hotlinks across `Navbar.jsx`, `NavbarUserMenu.jsx`, `NavbarMobileDrawer.jsx`, `ProfilePage.jsx`, `AvatarSelector.jsx`, and `AdminUsersPage.jsx` with `/default-profile.png`.
   - **Workstream D (Isolated Inappropriate Visuals):**
     - Replaced the watermarked VectorStock preview seller avatar in `ProductList4.jsx` with `/default-profile.png`.
     - Replaced the Amazon catalog image order fallback in `OrdersPage.jsx` with a neutral, self-contained SVG placeholder (`DEFAULT_ORDER_THUMBNAIL`) that avoids misrepresenting auction lots.
     - Replaced the external Freepik cover image hotlink in `ProfilePage.jsx` with a native CSS gradient adhering to the platform's terracotta design system.

---

## 2. Workstream A — KYC Upload Security Architecture & Investigation

### 2.1 Codebase Locations Inspected
- `client/src/pages/User/UserLogin/VerifyProfilePage.jsx` (Lines 263–287, 592–643)
- `client/src/pages/User/UserLogin/VerifySellerProfilePage.jsx` (Lines 273–297, 600–650)
- `server/server.js` (Routes mounting at `/api/auth`, `/api/auth/user`, `/api/auth/seller`)
- `server/routes/LoginRoutes/UserAuthRoutes.js` (Lines 185–213)
- `server/routes/LoginRoutes/SellerAuthRoutes.js` (Lines 196–224)
- `server/controllers/LoginControllers/UserLoginController/UserVerificationController.js` (Lines 148–209)
- `server/controllers/LoginControllers/SellerLoginController/SellerVerificationController.js` (Lines 140–205)
- `server/controllers/LoginControllers/UserLoginController/UserProfileController.js` (Lines 185–294)
- `server/controllers/LoginControllers/SellerLoginController/SellerProfileController.js` (Lines 121–218)
- `server/middleware/Media/ImageUpload.js` & `server/utlis/Image/multerConfig.js`
- `server/utlis/Image/cloudinaryConfig.js` & `server/middleware/Media/cloudinaryMiddleware.js`
- `server/models/LoginSchema/user.js` & `server/models/LoginSchema/seller.js`

### 2.2 Forensic Findings: The Six Core Investigation Questions

#### 1. Actual Request Payload and Upload Preset Usage
- **Confirmed Client Request:** Both `VerifyProfilePage.jsx` and `VerifySellerProfilePage.jsx` construct an unauthenticated multipart `FormData` object directly in the browser:
  ```javascript
  const cloudinaryFormData = new FormData();
  cloudinaryFormData.append("file", file);
  cloudinaryFormData.append("upload_preset", "product_image");
  const response = await axios.post(
    "https://api.cloudinary.com/v1_1/dszvpb3q5/image/upload",
    cloudinaryFormData,
    ...
  );
  ```
- **Finding:** The upload preset `"product_image"` was created for e-commerce catalog items. It is configured as an unsigned preset on Cloudinary cloud name `dszvpb3q5`. Both verification pages send files directly to Cloudinary without routing through the AuctionX backend.

#### 2. Storage Privacy and Access Control
- **Confirmed Storage Model:** Unsigned uploads to Cloudinary with `product_image` preset default to standard public asset delivery (`type: "upload"`). The returned `secure_url` points to `https://res.cloudinary.com/dszvpb3q5/image/upload/...`.
- **Finding:** Files uploaded via this preset are **completely public and unauthenticated**. Anyone possessing or guessing the URL can view and download the asset. There are no signed access tokens, no IP restrictions, and no private access-control lists (ACLs).

#### 3. Preset Abuse Vector, Overwrites, and Size Limits
- **Confirmed Exposure:** Because the cloud name `dszvpb3q5` and upload preset `"product_image"` are exposed in client-side JavaScript bundles, any external actor can send arbitrary POST requests directly to Cloudinary's API using standard HTTP tools (e.g. `curl`, Postman).
- **Finding:** Cloudinary accepts arbitrary files up to the account's preset quota. The client-side `<input accept="image/*">` tag is easily bypassed. This creates a severe denial-of-service / storage-exhaustion risk and allows unvetted files to be hosted under the project owner's Cloudinary account.

#### 4. Pre-Upload Authentication and Authorization Enforcement
- **Confirmed Execution Flow:** In both verification components, the Cloudinary POST request executes inside `handleSubmit` **prior to** sending any request to the AuctionX backend (`/api/auth/user/updateProfile` or `/api/auth/seller/updateProfile`).
- **Finding:** Cloudinary has zero awareness of AuctionX session cookies, JWT authentication tokens, or user roles. Even if a caller has invalid credentials or is blocked, the file is uploaded to Cloudinary first. Authentication and authorization are completely absent from the upload step.

#### 5. Existing Backend Architecture Analysis
- **Inspected Endpoints:** The backend provides `POST /api/auth/user/upload-profile-pic` and `POST /api/auth/seller/upload-profile-pic`.
- **Why Existing Endpoints Cannot Safely Support KYC Documents:**
  1. **Public Storage:** Both routes invoke `handleImageUploads`, which routes to Cloudinary folder `"Auction X/Components/Profile"` under public delivery mode.
  2. **Facial Cropping Destroys Documents:** The middleware applies a rigid image transformation: `[{ width: 300, height: 300, crop: "fill", gravity: "face" }]`. If an identity document, passport, or utility bill were uploaded, Cloudinary would crop a 300×300 box around any detected face, destroying text, serial numbers, and validity.
  3. **Inadequate File Validation:** `multerConfig.js` relies strictly on `file.mimetype` (`image/jpeg`, `image/png`, `image/webp`). It does not verify file signatures (magic bytes) and rejects PDF documents commonly required for KYC verification.
  4. **Schema Exposure:** `uploadProfilePicture` saves the URL into `user.profilePic` and `user.selectedAvatar`. Public endpoints like `getUserByEmail` return `profilePic` and `selectedAvatar` to any caller, and front-end components render it in headers and bid logs. Storing identity documents here would leak personal identity documents across the platform.

#### 6. Private Storage, Restricted Retrieval, and Retention Requirements
- **Required KYC Architecture:** Genuine KYC verification requires:
  - Private storage (e.g., an S3/GCS bucket with `BlockPublicAccess=true` or Cloudinary `type: "authenticated"` / `type: "private"`).
  - Short-lived, cryptographic presigned URLs generated exclusively for compliance administrators with role-based access control.
  - Strict server-side content-inspection (magic bytes) validating allowed formats (PDF, JPEG, PNG) and enforcing a maximum file size (e.g., 10MB).
  - Dedicated `KycDocument` schema isolated from the user's public profile and avatar.
  - Retention, encryption-at-rest, and scheduled deletion policies adhering to GDPR / DPDP compliance.

### 2.3 Boundary Decision and Owner-Review Action Plan

Per repository safety rules:
> "Do not invent API routes or assume an existing upload endpoint supports KYC documents. If safe remediation requires production configuration changes, migration of existing documents, or an unapproved architectural decision, stop at the implementation boundary, document the blocker, and provide a concrete owner-review plan."

#### Owner-Review Remediation Plan
1. **Decision Gate 1 (Storage Engine):** Owner must decide whether identity verification documents will be stored in:
   - Cloudinary private/authenticated storage (`type: "authenticated"` with token-based access).
   - Dedicated private object storage (AWS S3 / Google Cloud Storage / Azure Blob with SSE-KMS encryption).
2. **Decision Gate 2 (Data Modeling):** Create a dedicated `KycVerification` schema containing encrypted file references, verification status (`PENDING`, `APPROVED`, `REJECTED`), reviewer audit trail, and document expiration dates.
3. **Decision Gate 3 (Backend Endpoint):** Implement an authenticated `POST /api/compliance/kyc/upload` endpoint enforcing JWT authentication, CSRF tokens, magic-byte inspection (using `file-type`), virus scanning, and rate limiting.
4. **Decision Gate 4 (Onboarding UI Alignment):** Update `VerifyProfilePage.jsx` and `VerifySellerProfilePage.jsx` to route avatar updates to `/upload-profile-pic` (with appropriate multi-part form handling) and route identity verification documents to the dedicated compliance endpoint once approved.

---

## 3. Workstream B — Primary AuctionX Logo Remediation

### 3.1 Implemented Component
Created `client/src/components/ui/AuctionXLogo.jsx`:
- **Format:** Locally authored, pure SVG React component.
- **Visual Design:** Dynamic geometric faceted monogram combining the AuctionX "A" with an auction gavel angled into an "X", filled with platform terracotta brand gradients (`#C65D3A`, `#D97A56`, `#7F3828`).
- **Typography:** Display wordmark "AUCTION" using `fill-foreground` to automatically adapt to light/dark themes, followed by a bold terracotta "X".
- **Tokens Used:** Standard `--color-primary-500` palette, `--font-display`, `text-foreground`, `fill-primary-50`, `stroke-border-subtle`.
- **Accessibility:** `role="img"`, configurable `aria-label` (defaults to "Auction X Logo"), SVG `<title>` tag.
- **Export:** Exported in `client/src/components/ui/index.js`.

### 3.2 Navigation Updates
1. `client/src/pages/Layouts/Navbar/Navbar.jsx`:
   - Removed hotlinked Cloudinary image URL: `https://res.cloudinary.com/dszvpb3q5/image/upload/v1731178921/cifsfk5fzryh0iwp3fua.png`.
   - Imported and rendered `<AuctionXLogo className="w-auto h-8 lg:h-9 object-contain" />`.
   - Preserved home navigation link (`to="/"`), country badge, and click targets.
2. `client/src/pages/Seller/Layouts/SellerNavbar/SellerNavbar.jsx`:
   - Removed hotlinked Cloudinary image URL: `https://res.cloudinary.com/dszvpb3q5/image/upload/v1731178921/cifsfk5fzryh0iwp3fua.png`.
   - Imported and rendered `<AuctionXLogo className="w-auto h-10 object-contain" />`.
   - Preserved home navigation link (`to="/"`), accessibility labels, and flex layout.

### 3.3 Payment Page Reference Inspection
- **Location:** `client/src/pages/User/Dropdown/PaymentPage/PaymentPage.jsx:202`
- **Reference:** `image: "https://res.cloudinary.com/dszvpb3q5/image/upload/v1738092417/xohxoosm3tnn0jjvquuv.png"`
- **Inspection Finding:** This URL is passed as a configuration property to the Razorpay checkout script (`window.Razorpay(options)`), which renders inside a third-party checkout iframe hosted by `api.razorpay.com`.
- **Disposition:** Kept unchanged and documented. Replacing this property with a React component or relative local path (e.g. `/default-profile.png`) causes Razorpay's external iframe to fail image loading. It is an isolated P2 runtime dependency requiring a public production asset CDN URL upon deployment, not an infringing visual asset.

---

## 4. Workstream C — Default Avatar Hotlinks Remediation

### 4.1 Local Asset Verification
- Verified file: `client/public/default-profile.png`
- File size: 1,077 bytes
- Format: PNG silhouette icon, optimized for avatars.
- Delivery: Served directly by Vite at root path `/default-profile.png` with 0 external network requests.

### 4.2 Updated Code Locations
All 6 Flaticon hotlink references (`https://cdn-icons-png.flaticon.com/512/3135/3135715.png`) were replaced with `/default-profile.png`:

| # | File Path | Line | Modification Description |
|:---:|:---|:---:|:---|
| 1 | `client/src/pages/Layouts/Navbar/Navbar.jsx` | 19 | Changed `DEFAULT_AVATAR` constant to `"/default-profile.png"` |
| 2 | `client/src/pages/Layouts/Navbar/components/NavbarUserMenu.jsx` | 8 | Changed `DEFAULT_AVATAR` constant to `"/default-profile.png"` |
| 3 | `client/src/pages/Layouts/Navbar/components/NavbarMobileDrawer.jsx` | 10 | Changed `DEFAULT_AVATAR` constant to `"/default-profile.png"` |
| 4 | `client/src/components/Common/Profile/ProfilePage.jsx` | 183 | Changed `onError` fallback image to `"/default-profile.png"` |
| 5 | `client/src/components/Common/Profile/AvatarSelector.jsx` | 22 | Changed `DEFAULT_AVATAR` constant to `"/default-profile.png"` |
| 6 | `client/src/components/AdminDashboard/pages/AdminUsersPage.jsx` | 33 | Changed `DEFAULT_AVATAR` constant to `"/default-profile.png"` |

### 4.3 Behavioral Preservation
- Genuine user-uploaded avatars, Cloudinary profile pictures, and preserved Google OAuth profile photos continue to display correctly.
- Fallback `onError` handlers in all components now gracefully point to the local `/default-profile.png` asset.
- Profile photo selection and reset actions continue to function without database schema modifications.

---

## 5. Workstream D — Isolated Inappropriate Visuals Remediation

### 5.1 VectorStock Watermarked Preview
- **Location:** `client/src/components/ProductList/ProductList4/ProductList4.jsx:369`
- **Original Reference:** `https://cdn.vectorstock.com/i/500p/62/34/user-profile-icon-anonymous-person-symbol-blank-vector-53216234.jpg`
- **Fix:** Replaced with local fallback `"/default-profile.png"`.
- **Result:** Watermarked stock preview removed; seller avatar falls back to clean local silhouette.

### 5.2 Amazon Catalog Product Image
- **Location:** `client/src/pages/User/Dropdown/OrderHistory/OrdersPage.jsx:127`
- **Original Reference:** `https://m.media-amazon.com/images/I/91nkc6fMx1L._AC_SY195_.jpg`
- **Fix:** Defined `DEFAULT_ORDER_THUMBNAIL` as a neutral local SVG data URI depicting an unpictured auction lot silhouette with label "No Lot Image", and added an `onError` fallback handler.
- **Result:** Scraped Amazon catalog image completely purged; auction lots without pictures display a neutral placeholder that does not misrepresent goods.

### 5.3 Freepik Profile Header Banner
- **Location:** `client/src/components/Common/Profile/ProfilePage.jsx:170`
- **Original Reference:** `https://img.freepik.com/free-vector/abstract-colorful-shapes-background_361591-2848.jpg?semt=ais_hybrid`
- **Fix:** Replaced inline `backgroundImage` style with native Tailwind gradient:
  `className="... bg-gradient-to-r from-primary-600/20 via-surface to-primary-400/20 border border-border shadow-warm-sm ..."`
- **Result:** Unlicensed Freepik hotlink with AIS hybrid tracking parameters removed; profile header renders an elegant, restrained terracotta banner matching light and dark themes.

---

## 6. Verification and Validation Evidence

### 6.1 Automated Test Execution

#### Client Tests (`npm test --prefix client`)
- **Command:** `npm test --prefix client`
- **Runner:** Node.js native test runner (`node --test tests/geoDataRegression.test.js`)
- **Result:** 8/8 tests passed (0 failed, 0 cancelled). Duration: ~208ms.

#### Stage 7.21 Regression Tests
- **Command:** `node --test client/tests/stage7_21_assetRemediation.test.js`
- **Suites:** 5 focused regression tests:
  1. `Stage 7.21 - Workstream B: Primary Brand Logo Remediation` — PASSED
  2. `Stage 7.21 - Workstream C: Default Avatar Hotlinks Removed` — PASSED
  3. `Stage 7.21 - Workstream D: Isolated Inappropriate Visual References Purged` — PASSED
  4. `Stage 7.21 - Repository Safety: 22 Quarantined Assets Intact` — PASSED
  5. `Stage 7.21 - Repository Safety: Banner4 SVGs Intact` — PASSED
- **Result:** 5/5 tests passed (0 failed). Duration: ~115ms.

### 6.2 Frontend Production Build
- **Command:** `npm run build --prefix client`
- **Output:** Exit code 0, 0 compilation errors.
- **Verification of Assets:**
  - `AuctionXLogo.jsx` cleanly compiled into client chunk bundles.
  - All 6 Banner4 SVGs remain bundled in production output:
    - `dist/assets/collectibleArtifact-*.svg`
    - `dist/assets/auctionxEvent-*.svg`
    - `dist/assets/collectibleCricket-*.svg`
    - `dist/assets/collectibleFootball-*.svg`
    - `dist/assets/collectibleTrophy-*.svg`
    - `dist/assets/collectibleWatch-*.svg`

### 6.3 Whitespace and Git Cleanliness
- **Command:** `git diff --check`
- **Result:** Clean exit code 0. Zero trailing whitespace errors, zero conflict markers.
- **Staged Work:** All 27 staged documentation renames remain untouched in the git index.
- **Quarantined Files:** All 22 quarantined binary files remain physically present and untouched on disk.

---

## 7. Audit Summary of Modified and Preserved Assets

### 7.1 Asset References Replaced (Remediated)
1. `Navbar.jsx:158` — Primary Cloudinary Logo (`cifsfk5fzryh0iwp3fua.png`) -> `<AuctionXLogo />`
2. `SellerNavbar.jsx:115` — Primary Cloudinary Logo (`cifsfk5fzryh0iwp3fua.png`) -> `<AuctionXLogo />`
3. `Navbar.jsx:19` — Flaticon default avatar -> `/default-profile.png`
4. `NavbarUserMenu.jsx:8` — Flaticon default avatar -> `/default-profile.png`
5. `NavbarMobileDrawer.jsx:10` — Flaticon default avatar -> `/default-profile.png`
6. `ProfilePage.jsx:183` — Flaticon default avatar -> `/default-profile.png`
7. `AvatarSelector.jsx:22` — Flaticon default avatar -> `/default-profile.png`
8. `AdminUsersPage.jsx:33` — Flaticon default avatar -> `/default-profile.png`
9. `ProductList4.jsx:369` — VectorStock watermarked seller preview -> `/default-profile.png`
10. `OrdersPage.jsx:127` — Amazon catalog photo -> `DEFAULT_ORDER_THUMBNAIL` (local SVG)
11. `ProfilePage.jsx:170` — Freepik profile cover banner -> Native Tailwind CSS gradient

### 7.2 Asset References Left Unchanged (With Documented Rationale)
1. `PaymentPage.jsx:202` — Razorpay modal icon (`xohxoosm3tnn0jjvquuv.png`): Passed to external Razorpay iframe checkout options requiring public HTTPS delivery; documented for production asset CDN configuration.
2. `AvatarSelector.jsx:12-18` (and related list fallbacks) — Cloudinary character avatars: Predefined character selection photos; classified as P3 cleanup for future artwork pass.
3. Marketing model photos (Rareblocks & Cruip) in secondary pages: Classified as P1/P2 for dedicated subsequent remediation stages.

---

## 8. Remaining Public Release Blockers

Public release remains **STRICTLY BLOCKED** pending resolution of the following gates:

1. **KYC Document Upload Pipeline Decision (Workstream A):** Owner review and approval of the dedicated private KYC storage architecture (encrypted private S3/GCS or authenticated Cloudinary bucket, signed access URLs, `file-type` magic-byte inspection, compliance data modeling).
2. **Orphaned Asset Quarantine Execution:** Explicit repository owner authorization to delete or archive the 22 quarantined binary files cataloged in `Audit-071-Orphaned-Asset-Quarantine-Manifest.md`.
3. **Proprietary License Execution:** Formal owner review and adoption of the proprietary source-available license and inbound Contributor License Agreement (Stages 7.13 and 7.14A).
4. **Third-Party Attribution Compilation:** Publication of `docs/licenses/THIRD_PARTY_NOTICES.md` (Stage 7.15).
5. **Remaining Marketing Assets:** Remediation of Rareblocks template model photos and Cruip tutorial demo assets.

---

## 9. Final Stage Status

`PARTIAL REMEDIATION — PUBLIC RELEASE STILL BLOCKED`
