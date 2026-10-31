# Stage 7.25 — Authenticated Avatar Upload Readiness Audit

**Execution Date:** October 19, 2026  
**Auditor:** Antigravity Agentic Security & Compliance Subagent  
**Scope:** In-depth technical readiness evaluation of `POST /api/auth/user/upload-profile-pic` and `POST /api/auth/seller/upload-profile-pic` to safely replace direct, unsigned Cloudinary uploads in onboarding workflows  
**Repository:** `D:\THE OMS DEVS\WEB DEVS\MERN PROJECTS\PCMT\SEM 6\OMS\Auction X ✅`  
**Target Public Repository:** `https://github.com/OmSardar/AuctionX-Enhanced-Live-AI-Auction-Platform.git`  
**Conclusion Status:** `AVATAR UPLOAD READINESS AUDIT COMPLETE — IMPLEMENTATION AWAITS OWNER APPROVAL`  
**Release Readiness Gate:** `PUBLIC RELEASE STILL BLOCKED`

---

## 1. Executive Summary

Continuing from [`docs/audits/Audit-077-KYC-Upload-Security-Architecture.md`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/docs/audits/Audit-077-KYC-Upload-Security-Architecture.md), Stage 7.25 conducted an exhaustive readiness inspection of the backend profile picture upload endpoints:
- `POST /api/auth/user/upload-profile-pic` (mounted via [`UserAuthRoutes.js:200`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/routes/LoginRoutes/UserAuthRoutes.js#L200))
- `POST /api/auth/seller/upload-profile-pic` (mounted via [`SellerAuthRoutes.js:210`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/routes/LoginRoutes/SellerAuthRoutes.js#L210))

The objective was to evaluate whether these endpoints can safely replace the direct, unauthenticated browser-to-Cloudinary uploads currently present in [`VerifyProfilePage.jsx:270`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/UserLogin/VerifyProfilePage.jsx#L270) and [`VerifySellerProfilePage.jsx:280`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/UserLogin/VerifySellerProfilePage.jsx#L280) without introducing security regressions or breaking profile persistence.

### Key Audit Findings:
1. **Existing Endpoint is Functional but NOT Yet Hardened:**
   While the endpoints utilize `authUserMiddleware` to verify JWT session cookies/headers, **they currently harbor a critical Insecure Direct Object Reference (IDOR) defect**: the controllers ([`UserProfileController.js:187`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/LoginControllers/UserLoginController/UserProfileController.js#L187) and [`SellerProfileController.js:123`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/LoginControllers/SellerLoginController/SellerProfileController.js#L123)) locate target users by unvalidated `req.body.email` rather than enforcing ownership against the authenticated session `req.user.email`. Any authenticated user can overwrite another user's avatar.
2. **Missing Rate Limiting and Magic-Byte Validation:**
   - Neither route has upload rate limiting attached.
   - MIME type validation in [`multerConfig.js:17`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/utlis/Image/multerConfig.js#L17) relies exclusively on client-supplied `file.mimetype` headers without inspecting binary magic bytes.
3. **Local Disk and Cloudinary Orphan Leaks on Failure:**
   If Cloudinary upload fails, temporary local files in `./uploads/` are not unlinked in the error path. If database persistence fails after upload, the Cloudinary asset is orphaned.
4. **Onboarding Compatibility:**
   Replacing direct uploads with the backend endpoint will preserve avatar preview (which is generated client-side via `URL.createObjectURL`), selected avatar state, profile persistence, and the email OTP verification sequence.
5. **Marketing Discrepancy Inventory:**
   A complete inventory of four explicit marketing claims asserting government ID and tax document collection was conducted. These claims remain unfulfilled by the actual code.

---

## 2. Current Request Flow & Component Architecture

### 2.1 Complete Request Sequence Trace

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client App (AvatarSelector / ProfileSettings / Onboarding)
    participant AuthMW as authUserMiddleware
    participant MulterMW as Multer Disk Storage (multerConfig.js)
    participant CloudMW as handleImageUploads (ImageUpload.js)
    participant Cloudinary as Cloudinary API (dszvpb3q5)
    participant Ctrl as uploadProfilePicture (UserProfileController.js)
    participant DB as MongoDB (UserModel / SellerModel)

    Client->>AuthMW: POST /api/auth/user/upload-profile-pic<br/>Headers: Cookie: token / sellerToken, X-CSRF-Token<br/>Body: multipart/form-data (profilePic=File, email=String)
    
    Note over AuthMW: 1. Authentication Gate
    AuthMW->>AuthMW: Verify JWT with JWT_SECRET
    AuthMW->>DB: User.findById(decoded.id)
    AuthMW-->>Client: 401 Unauthorized (if invalid / missing token)
    AuthMW->>MulterMW: req.user = user; next()

    Note over MulterMW: 2. Local Disk Ingestion
    MulterMW->>MulterMW: Check fileSize <= 5MB
    MulterMW->>MulterMW: Check file.mimetype (header only: jpeg/png/webp)
    MulterMW->>MulterMW: Writes file to ./uploads/{timestamp}-{name}
    
    Note over CloudMW,Cloudinary: 3. Cloudinary Upload
    MulterMW->>CloudMW: req.files.profilePic available
    CloudMW->>Cloudinary: upload(filePath, { folder: "Auction X/Components/Profile", transformation: [crop:"fill", gravity:"face"] })
    Cloudinary-->>CloudMW: 200 OK { secure_url, public_id }
    CloudMW->>CloudMW: fs.unlinkSync(filePath) [ONLY IF SUCCESSFUL]
    CloudMW->>Ctrl: req.cloudinaryUploads.profilePic = [{ secure_url, public_id }]; next()

    Note over Ctrl,DB: 4. Database Persistence & Old Avatar Deletion
    Ctrl->>DB: UserModel.findOne({ email: req.body.email })<br/>[CRITICAL: Uses unverified req.body.email!]
    opt Old image exists with public_id (not predefined/Google)
        Ctrl->>Cloudinary: uploader.destroy(oldPublicId)
    end
    Ctrl->>DB: user.selectedAvatar = secure_url; user.profilePic = [...]; user.save()
    Ctrl-->>Client: 200 OK { message: "Profile picture updated successfully", image: { secure_url, public_id } }
```

### 2.2 Relevant Source Code Components

| Component / Layer | Physical Path | Key Responsibilities & Line References |
| :--- | :--- | :--- |
| **User Route** | [`server/routes/LoginRoutes/UserAuthRoutes.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/routes/LoginRoutes/UserAuthRoutes.js#L200-L213) | Mounts `/upload-profile-pic` with `authUserMiddleware`, `handleImageUploads`, and `uploadProfilePicture`. |
| **Seller Route** | [`server/routes/LoginRoutes/SellerAuthRoutes.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/routes/LoginRoutes/SellerAuthRoutes.js#L210-L223) | Mounts `/upload-profile-pic` with `authUserMiddleware`, `handleImageUploads`, and `uploadProfilePicture`. |
| **Auth Middleware** | [`server/middleware/LoginMiddleware/authUserMiddleware.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/middleware/LoginMiddleware/authUserMiddleware.js#L7-L98) | Validates JWT from cookies (`token` or `sellerToken`) or Authorization header; attaches `req.user`. |
| **Upload Middleware** | [`server/middleware/Media/ImageUpload.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/middleware/Media/ImageUpload.js#L5-L46) | Coordinates Multer processing, calls `uploadToCloudinary`, attaches `req.cloudinaryUploads`. |
| **Multer Config** | [`server/utlis/Image/multerConfig.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/utlis/Image/multerConfig.js#L1-L33) | Enforces 5MB file size limit and header-based MIME filter (`jpeg`, `png`, `webp`). |
| **Cloudinary Helper** | [`server/middleware/Media/cloudinaryMiddleware.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/middleware/Media/cloudinaryMiddleware.js#L138-L150) | Executes `cloudinary.uploader.upload` and `cloudinary.uploader.destroy`. |
| **User Controller** | [`server/controllers/LoginControllers/UserLoginController/UserProfileController.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/LoginControllers/UserLoginController/UserProfileController.js#L185-L280) | Updates `UserModel.profilePic` and `selectedAvatar`; purges previous Cloudinary custom asset. |
| **Seller Controller** | [`server/controllers/LoginControllers/SellerLoginController/SellerProfileController.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/LoginControllers/SellerLoginController/SellerProfileController.js#L121-L200) | Updates `SellerModel.profilePic` and `selectedAvatar`; purges previous Cloudinary custom asset. |

---

## 3. Analysis of Confirmed vs. Missing Security Controls

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY CONTROLS BREAKDOWN                            │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
     ┌─────────────────────────────────┴─────────────────────────────────┐
     ▼                                                                   ▼
┌──────────────────────────────┐                   ┌──────────────────────────────┐
│      CONFIRMED CONTROLS      │                   │       MISSING CONTROLS       │
├──────────────────────────────┤                   ├──────────────────────────────┤
│ • JWT Session Authentication │                   │ • User Ownership Check (IDOR)│
│ • Account Suspension Check   │                   │ • Magic-Byte File Validation │
│ • 5MB Request Size Limit     │                   │ • Dedicated Rate Limiting    │
│ • CSRF Protection Active     │                   │ • Local Disk Leak on Error   │
│ • Old Avatar Purge (Cleanup) │                   │ • Cloudinary Rollback on Err │
│ • Hardcoded Transformations  │                   │ • Predefined Avatar Protect  │
└──────────────────────────────┘                   └──────────────────────────────┘
```

### 3.1 Detailed Evaluation Table

| Control Category | Current Implementation State | Code Location | Verdict | Defect / Vulnerability Details |
| :--- | :--- | :--- | :---: | :--- |
| **Authentication Gate** | Enforces valid JWT token from cookie (`token`/`sellerToken`) or Bearer header. Rejects unauthenticated requests with 401. | [`authUserMiddleware.js:22-26`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/middleware/LoginMiddleware/authUserMiddleware.js#L22-L26) | **PASS** | Verified working as expected. |
| **Account Suspension Gate** | Rejects suspended users with 403 Forbidden and clears session cookies. | [`authUserMiddleware.js:53-71`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/middleware/LoginMiddleware/authUserMiddleware.js#L53-L71) | **PASS** | Robust check against deactivated accounts. |
| **User Ownership (IDOR)** | **CRITICAL DEFECT:** Controller retrieves user via `req.body.email` without verifying `req.user.email === req.body.email`. | [`UserProfileController.js:187-209`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/LoginControllers/UserLoginController/UserProfileController.js#L187-L209) | **FAIL** | **High Severity IDOR:** An authenticated user can submit another user's email in `req.body.email` and overwrite their profile avatar. |
| **File Content Validation** | Checks client HTTP header `file.mimetype` (`image/jpeg`, `image/png`, `image/webp`). | [`multerConfig.js:17-24`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/utlis/Image/multerConfig.js#L17-L24) | **FAIL** | **MIME Spoofing Risk:** Client controls `Content-Type` header. No magic-byte file signature verification is performed. |
| **Request Size Limits** | Multer config specifies `limits: { fileSize: 5 * 1024 * 1024 }` (5MB). | [`multerConfig.js:28`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/utlis/Image/multerConfig.js#L28) | **PASS** | Rejects payloads over 5MB. |
| **Upload Rate Limiting** | **None.** No rate limiter middleware is attached to `POST /upload-profile-pic`. | [`UserAuthRoutes.js:200`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/routes/LoginRoutes/UserAuthRoutes.js#L200) | **FAIL** | **Denial-of-Wallet Risk:** Authenticated users can spam upload requests in a loop without rate throttling. |
| **Disk Cleanup on Upload Error** | `fs.unlinkSync(file.path)` is located inside the `try` block after `uploadToCloudinary`. | [`ImageUpload.js:31-43`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/middleware/Media/ImageUpload.js#L31-L43) | **FAIL** | **Disk Storage Leak:** If Cloudinary upload throws an error, `unlinkSync` is skipped, leaving orphaned files in `./uploads/`. |
| **Cloudinary Rollback on DB Error** | If MongoDB `user.save()` fails after upload, newly created Cloudinary image is not destroyed. | [`UserProfileController.js:279`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/LoginControllers/UserLoginController/UserProfileController.js#L279) | **FAIL** | **Cloudinary Garbage Accumulation:** Failed DB transactions leave permanently orphaned files in Cloudinary. |
| **Predefined Avatar Protection** | Controller maintains a list of default avatar URLs and Google Photos to exempt from deletion. | [`UserProfileController.js:191-225`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/LoginControllers/UserLoginController/UserProfileController.js#L191-L225) | **PASS** | Prevents deleting shared platform avatars when users upload custom photos. |

---

## 4. Proposed Frontend and Backend Changes

### 4.1 Required Backend Hardening (Before Onboarding Migration)

1. **Enforce Ownership Verification (Fix IDOR):**
   In both `UserProfileController.js` and `SellerProfileController.js`, eliminate reliance on unverified `req.body.email`. Derive the target user strictly from the authenticated session:
   ```javascript
   // Secure implementation
   const targetEmail = req.user.email;
   const user = await UserModel.findById(req.user._id);
   ```
   If `req.body.email` is provided, assert `req.body.email.toLowerCase() === req.user.email.toLowerCase()`, returning `403 Forbidden` if mismatched.
2. **Implement Magic-Byte File Signature Inspection:**
   Add `file-type` inspection in `ImageUpload.js` before executing `uploadToCloudinary`:
   ```javascript
   const { fileTypeFromFile } = require("file-type");
   const type = await fileTypeFromFile(file.path);
   if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type.mime)) {
     fs.unlinkSync(file.path);
     return res.status(400).json({ success: false, message: "Invalid file signature. Only real JPEG, PNG, or WEBP images are allowed." });
   }
   ```
3. **Attach Dedicated Upload Rate Limiter:**
   Add an upload-specific rate limiter in `UserAuthRoutes.js` and `SellerAuthRoutes.js`:
   ```javascript
   const uploadLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 10, // 10 avatar uploads per user/IP
     message: { success: false, message: "Too many upload attempts, please try again after 15 minutes." },
     standardHeaders: true,
     legacyHeaders: false,
   });
   AuthRoutes.post("/upload-profile-pic", authUserMiddleware, uploadLimiter, handleImageUploads([...]), uploadProfilePicture);
   ```
4. **Guaranteed Local Disk and Cloudinary Rollback:**
   Wrap Multer file processing in a `try...finally` block ensuring `fs.unlinkSync(file.path)` always executes. If `user.save()` fails in the controller, trigger `deleteFromCloudinary(uploadedImage.public_id)` to prevent orphaned assets.

### 4.2 Proposed Frontend Changes in Onboarding Pages

In [`VerifyProfilePage.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/UserLogin/VerifyProfilePage.jsx) and [`VerifySellerProfilePage.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/UserLogin/VerifySellerProfilePage.jsx):

```diff
- // Direct unsigned Cloudinary upload
- const cloudinaryFormData = new FormData();
- cloudinaryFormData.append("file", file);
- cloudinaryFormData.append("upload_preset", "product_image");
- const response = await axios.post(
-   "https://api.cloudinary.com/v1_1/dszvpb3q5/image/upload",
-   cloudinaryFormData,
-   ...
- );
- profileImage = {
-   secure_url: response.data.secure_url,
-   public_id: response.data.public_id,
- };

+ // Authenticated backend-mediated upload
+ const uploadFormData = new FormData();
+ uploadFormData.append("profilePic", file);
+ uploadFormData.append("email", email);
+ const uploadResponse = await axios.post(
+   `${API_URL}/api/auth/user/upload-profile-pic`,
+   uploadFormData,
+   {
+     headers: {
+       "Content-Type": "multipart/form-data",
+       "X-CSRF-Token": csrfToken,
+     },
+     withCredentials: true,
+     onUploadProgress: (progressEvent) => {
+       const { loaded, total } = progressEvent;
+       setUploadProgress(Math.floor((loaded * 100) / total));
+     },
+   }
+ );
+ profileImage = uploadResponse.data.image;
```

---

## 5. Existing Callers & Compatibility Assessment

The audit identified four existing client components utilizing `upload-profile-pic`:

| Caller File | Invoked Endpoint Path | Request Payload Format | Expected Response Format | Compatibility Impact of Proposed Hardening |
| :--- | :--- | :--- | :--- | :--- |
| [`AvatarSelector.jsx:437`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/Profile/AvatarSelector.jsx#L437) | `/auth/upload-profile-pic` (resolves via proxy to `/api/auth/upload-profile-pic`) | `FormData` with fields: `profilePic` (File), `email` (String) | `{ message: string, image: { secure_url: string, public_id: string } }` | **100% Compatible:** Field names, request method, and response payload structure match. Ownership validation succeeds because user passes their own email. |
| [`ProfileSettingsPage.jsx:124`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/Profile/ProfilePages/ProfileSettingsPage/ProfileSettingsPage.jsx#L124) | `${API_URL}/api/auth/upload-profile-pic` | `FormData` with fields: `profilePic` (File), `email` (String) | `{ message: string, image: { ... } }` | **100% Compatible:** Passes authenticated cookies with matching user email. |
| [`AdminAccount/ProfileTab.jsx:46`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/AdminDashboard/partials/dashboard/AdminAccount/ProfileTab.jsx#L46) | `${API_BASE_URL}/api/auth/user/upload-profile-pic` | `FormData` with `profilePic` and `email` | `{ message: string, image: { ... } }` | **100% Compatible:** Admin updates their own profile avatar; ownership check passes. |
| [`SellerDashboard/.../ProfileTab.jsx:45`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/SellerDashboard/partials/dashboard/AdminAccount/ProfileTab.jsx#L45) | `${API_BASE_URL}/api/auth/user/upload-profile-pic` | `FormData` with `profilePic` and `email` | `{ message: string, image: { ... } }` | **100% Compatible:** Seller updates their own profile avatar; ownership check passes. |

---

## 6. Inventory of Unfulfilled Marketing KYC Claims

As mandated, the following exact marketing claims asserting government ID collection and compliance reviews were inventoried without editing:

1. **Seller FAQ — Government ID & Compliance Review Claim:**
   - **File:** [`client/src/components/Layouts/Footer/Help/FAQ/FAQ.jsx:35`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Layouts/Footer/Help/FAQ/FAQ.jsx#L35)
   - **Exact Text:**
     > `"To list lots, navigate to 'Become a Seller' and complete our KYC verification. You must submit valid government identification, address proof, and tax details. Our compliance team reviews seller submissions within 24 to 48 hours."`
2. **Backend Seed Data — Seller KYC FAQ:**
   - **File:** [`server/utlis/SeedData/seedData.js:504`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/utlis/SeedData/seedData.js#L504)
   - **Exact Text:**
     > `"Submit your KYC documents through the 'Become a Seller' page, including ID proof, address proof, and PAN/GST details."`
3. **Platform Brand Story — Seller KYC Claim:**
   - **File:** [`client/src/components/Layouts/Footer/AboutUs/OurStory/OurStory.jsx:86`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Layouts/Footer/AboutUs/OurStory/OurStory.jsx#L86)
   - **Exact Text:**
     > `"Engineered with real-time WebSockets, verified seller KYC, automated escrow settlement, and intelligent recommendation rankings."`
4. **Payment Help & Banking — Profile KYC Claim:**
   - **File:** [`client/src/components/Layouts/Footer/Help/Payment/Payment.jsx:390`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Layouts/Footer/Help/Payment/Payment.jsx#L390)
   - **Exact Text:**
     > `"Bank transfers verified via profile KYC"`

*Code Reality: None of these four claims are supported by code. The actual platform implements onboarding profile fields + email OTP verification.*

---

## 7. Security & Regression Test Specifications

The following test suite must be implemented alongside the remediation in Stage 7.26:

```javascript
describe("Stage 7.26 - Authenticated Avatar Upload Security & Hardening", () => {
  // Test 1: Unauthenticated request rejection
  it("rejects POST /upload-profile-pic without auth token with 401", async () => {
    const res = await request(app).post("/api/auth/user/upload-profile-pic").attach("profilePic", dummyImage);
    expect(res.status).toBe(401);
  });

  // Test 2: IDOR Prevention
  it("rejects upload when body.email does not match authenticated token email with 403", async () => {
    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [`token=${userAToken}`])
      .field("email", "victim@example.com")
      .attach("profilePic", dummyImage);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/forbidden|ownership/i);
  });

  // Test 3: Magic Byte Content Inspection
  it("rejects file with .jpg extension containing HTML/JS polyglot with 400", async () => {
    const fakeJpg = Buffer.from("<script>alert('xss')</script>");
    const res = await request(app)
      .post("/api/auth/user/upload-profile-pic")
      .set("Cookie", [`token=${userAToken}`])
      .attach("profilePic", fakeJpg, "avatar.jpg");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid file signature/i);
  });

  // Test 4: Rate Limiting Enforcement
  it("throttles upload attempts exceeding 10 requests within 15 minutes with 429", async () => {
    for (let i = 0; i < 10; i++) {
      await request(app).post("/api/auth/user/upload-profile-pic").set("Cookie", [`token=${userAToken}`]).attach("profilePic", dummyImage);
    }
    const throttled = await request(app).post("/api/auth/user/upload-profile-pic").set("Cookie", [`token=${userAToken}`]).attach("profilePic", dummyImage);
    expect(throttled.status).toBe(429);
  });

  // Test 5: Onboarding Workflow Preservation
  it("allows user to complete onboarding and receive email OTP after avatar upload", async () => {
    // 1. Upload avatar
    const upRes = await request(app).post("/api/auth/user/upload-profile-pic").set("Cookie", [`token=${newUserToken}`]).attach("profilePic", dummyImage);
    expect(upRes.status).toBe(200);
    // 2. Update profile
    const profRes = await request(app).patch("/api/auth/user/updateProfile").set("Cookie", [`token=${newUserToken}`]).send(validProfileData);
    expect(profRes.status).toBe(200);
    // 3. Send OTP
    const otpRes = await request(app).post("/api/auth/user/send-otp").send({ email: newUser.email });
    expect(otpRes.status).toBe(200);
  });
});
```

---

## 8. Rollback Considerations

1. **Frontend Rollback:**
   If backend-mediated avatar uploads encounter Cloudinary timeouts during peak load, the client onboarding pages can be configured via feature flag (`VITE_USE_BACKEND_AVATAR_UPLOAD=true/false`) to temporarily make avatar selection optional during onboarding without breaking registration.
2. **Backend Route Isolation:**
   Because `/upload-profile-pic` is already mounted and active in production for `AvatarSelector` and `ProfileSettingsPage`, hardening its controller logic (`req.user.email` enforcement) does not modify the route path or HTTP response structure, ensuring zero downtime.
3. **Database Schema Stability:**
   `UserModel` and `SellerModel` require no schema migrations for this remediation. The target fields (`profilePic`, `selectedAvatar`) remain identical.

---

## 9. Owner Decisions Required

Before proceeding to code implementation in Stage 7.26, the repository owner must provide decisions on the following items:

1. **Owner Approval of IDOR & Rate-Limiter Hardening:**
   Approve hardening `POST /api/auth/user/upload-profile-pic` and `POST /api/auth/seller/upload-profile-pic` with user ownership checks (`req.user.email`), magic-byte inspection, and a 10-request/15-minute rate limit.
2. **Owner Approval of Onboarding Migration:**
   Approve replacing the direct unsigned Cloudinary upload in `VerifyProfilePage.jsx` and `VerifySellerProfilePage.jsx` with calls to the hardened backend route.
3. **Owner Decision on Marketing Claim Reconciliation:**
   Approve updating the text in `FAQ.jsx`, `OurStory.jsx`, and `Payment.jsx` to accurately describe the platform's automated email/phone OTP verification rather than claiming uncollected government KYC document collection.

---

## 10. Non-Destructive Verification Results

- **`git diff --check` Execution:** Completed with exit code 0 (clean, no whitespace errors or merge conflict markers).
- **Staged Documentation Renames:** Exactly 27 staged renames preserved untouched in Git index (`git diff --cached --name-status`).
- **Quarantined Asset Verification:** All 22 quarantined binary files remain physically present on disk.
- **Banner4 SVGs:** All 6 original Banner4 SVG assets remain intact.
- **Zero Mutating Changes:** No application code was altered; no endpoints were added; no database connections were opened; no live remote calls were made.

---

## 11. Conclusion & Release Gate Status

The authenticated avatar upload readiness inspection is complete. The backend route `POST /api/auth/user/upload-profile-pic` can safely replace the direct unsigned Cloudinary upload, provided that the identified **IDOR vulnerability**, **lack of rate limiting**, and **magic-byte inspection gaps** are remediated as part of the implementation.

### Final Status:

`AVATAR UPLOAD READINESS AUDIT COMPLETE — IMPLEMENTATION AWAITS OWNER APPROVAL`

`PUBLIC RELEASE STILL BLOCKED`
