# Stage 7.20 — Remaining Frontend External Asset Inventory and Remediation Prioritization

**Date:** 2026-10-19  
**Execution Stage:** Stage 7.20  
**Auditor:** Antigravity AI Pair Programmer  
**Target Repository:** AuctionX (Local Workspace)  
**Status:**  
`EXTERNAL ASSET INVENTORY COMPLETE — PUBLIC RELEASE STILL BLOCKED`

---

## 1. Executive Summary

Stages 7.16 through 7.19 successfully remediated the highest-risk public brand assets and celebrity images on the AuctionX homepage:
- **Stage 7.16:** Replaced five celebrity likenesses in `Banner4.jsx` with locally authored auction collectible SVGs.
- **Stage 7.17:** Replaced the external Bewakoof promotional GIF in `Banner4.jsx` with an original SVG promotional badge.
- **Stage 7.18:** Audited all remaining remote image/CDN references and compiled a non-destructive quarantine manifest for 22 unreferenced binary assets.
- **Stage 7.19:** Re-themed the corporate brand showcases in `LogoSlider.jsx` and `SmoothHovering.jsx` into original AuctionX collectible-category showcases with zero external network requests.

Stage 7.20 performed an exhaustive, forensic scan across all remaining frontend source files ([`client/src/`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src), [`client/index.html`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/index.html), and [`client/public/`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/public)) to catalog and prioritize every remaining external visual, media, and typography asset.

### Key Inventory Totals

- **Total External Asset References:** **87 references** across the frontend codebase.
- **Distinct External URLs:** **62 unique URLs**.
- **Affected Frontend Files:** **45 unique files** (1 HTML file, 2 CSS stylesheets, 42 JSX components).
- **External Asset Domains:** **19 distinct third-party domains**.
- **Stage 7.19 Re-scan:** Re-confirmed **0 corporate hotlinks** in both `LogoSlider.jsx` and `SmoothHovering.jsx`.
- **Quarantine Manifest Re-verification:** All **22 unreferenced assets** cataloged in Stage 7.18 remain physically present on disk and unmodified.

---

## 2. Scan Scope and Methodology

### 2.1 Scope
The scan covered:
1. All JavaScript and JSX source files in `client/src/`.
2. All CSS and styling modules in `client/src/` (including dashboard stylesheets).
3. The root HTML template `client/index.html`.
4. Static assets in `client/public/`.

### 2.2 Exclusions
- `node_modules/` and build output directories (`dist/`, `.vite/`).
- Legitimate backend API endpoints, WebSocket connections, OAuth authorization URLs (e.g., Google OAuth redirects), and ordinary navigation hyperlinks (`<a href="...">`).
- Development localhost endpoints (`http://localhost:5000`).

### 2.3 Methodology
A deep AST and regular expression inspection parsed every literal string and template literal matching `https?://`. Each match was inspected in its surrounding syntactic context:
- Direct JSX image elements (`<img src="...">`).
- Inline CSS style properties (`style={{ backgroundImage: "url(...)" }}`).
- Component prop definitions (e.g., fallback images passed to product lists or modals).
- Module-level constants (e.g., `const DEFAULT_AVATAR = "..."`, `const DEFAULT_ITEM_IMAGE = "..."`).
- Array collections (e.g., avatar selection presets, carousel image arrays).
- Embedded media (`<iframe src="...">`, `<video src="...">`).
- Stylesheet `@import` rules and HTML `<link rel="stylesheet">` tags.

---

## 3. Aggregate Domain Breakdown

| Third-Party Domain | Asset Type | Reference Count | Distinct URLs | Primary Usage Context |
|:---|:---|:---:|:---:|:---|
| `images.unsplash.com` | Stock Photography | 21 | 10 | Admin table fallbacks, seller banners, about page portraits |
| `res.cloudinary.com` | Cloud Hosted Assets | 17 | 10 | Primary logo, payment modal logo, avatar selector presets |
| `cdn.rareblocks.xyz` | Stock Illustrations & Photos | 11 | 8 | Seller onboarding, seller banners, support page |
| `via.placeholder.com` | Fallback Placeholders | 8 | 6 | Error fallback for missing banner & product images |
| `cdn-icons-png.flaticon.com` | User Avatar Icon | 6 | 1 | Global default user avatar across navbar and profile |
| `cruip-tutorials.vercel.app` | Demo Articles & Video | 5 | 5 | About us article cards, modal video player demo |
| `fonts.googleapis.com` | Web Fonts (Inter, DM Sans) | 4 | 2 | Root HTML font stylesheet, admin & seller CSS imports |
| `api.cloudinary.com` | Direct Upload API Endpoint | 2 | 1 | Client-side KYC profile & seller verification uploads |
| `open.spotify.com` | Audio Player iframe | 2 | 2 | Spotify embed playlist player on FanBook page |
| `i1.sndcdn.com` | Audio Track Artwork | 2 | 1 | SoundCloud album art for FanBook demo playlist |
| `fonts.gstatic.com` | Font CDN Preconnect | 1 | 1 | Preconnect origin in `client/index.html` |
| `cdnjs.cloudflare.com` | Font Awesome CSS | 1 | 1 | External icon font stylesheet in `client/index.html` |
| `cdn.razorpay.com` | Payment Processor Badge | 1 | 1 | Official Razorpay merchant badge in seller checkout |
| `m.media-amazon.com` | E-commerce Product Photo | 1 | 1 | Fallback order image in user order history |
| `img.freepik.com` | Vector Graphic Background | 1 | 1 | Cover background image in user profile header |
| `cdn.vectorstock.com` | Watermarked Stock Preview | 1 | 1 | Fallback seller profile icon in product list |
| `i.pinimg.com` | Social Media Image | 1 | 1 | Fallback avatar on seller MyAccountPage |
| `cdn.pixabay.com` | Stock Icon | 1 | 1 | Buyer review avatar in seller profile feedback |
| `i.pravatar.cc` | Demo Profile Avatar | 1 | 1 | Mock profile card on seller homepage |
| **Total** | | **87** | **62** | **45 unique files** |

---

## 4. Detailed Findings and Classification Inventory

### 4.1 Core Platform Branding Assets

#### Finding 1: Primary Navbar Logo
- **Locations:**
  - [`client/src/pages/Layouts/Navbar/Navbar.jsx:158`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/Layouts/Navbar/Navbar.jsx#L158)
  - [`client/src/pages/Seller/Layouts/SellerNavbar/SellerNavbar.jsx:115`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/Seller/Layouts/SellerNavbar/SellerNavbar.jsx#L115)
- **URL:** `https://res.cloudinary.com/dszvpb3q5/image/upload/v1731178921/cifsfk5fzryh0iwp3fua.png`
- **Asset Type:** PNG Brand Logo (`alt="Auction X Logo"`)
- **Render State:** Actively rendered on every public and authenticated page in the global header.
- **Classification:** Core Brand Asset (Hotlinked to Personal Cloudinary Account `dszvpb3q5`).
- **Concerns:** Fragility; dependency on a personal developer Cloudinary account. If this bucket is renamed, purged, or bandwidth-throttled, the primary platform logo fails globally.
- **Recommended Disposition:** Replace with a locally authored SVG component or local asset in `client/src/assets/images/Layouts/`.
- **Confidence:** High (100%).

#### Finding 2: Razorpay Payment Modal Brand Mark
- **Location:** [`client/src/pages/User/Dropdown/PaymentPage/PaymentPage.jsx:202`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/Dropdown/PaymentPage/PaymentPage.jsx#L202)
- **URL:** `https://res.cloudinary.com/dszvpb3q5/image/upload/v1738092417/xohxoosm3tnn0jjvquuv.png`
- **Asset Type:** PNG Icon passed to Razorpay checkout options (`image: "..."`)
- **Render State:** Rendered inside Razorpay payment modal during wallet recharge.
- **Classification:** Platform Identity Asset.
- **Concerns:** Dependency on external Cloudinary account during critical payment flow.
- **Recommended Disposition:** Self-host locally or serve via production asset domain.
- **Confidence:** High (100%).

---

### 4.2 Global Avatar and Profile Assets

#### Finding 3: Default User Avatar (Flaticon Hotlink)
- **Locations:**
  - [`client/src/pages/Layouts/Navbar/Navbar.jsx:19`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/Layouts/Navbar/Navbar.jsx#L19)
  - [`client/src/pages/Layouts/Navbar/components/NavbarUserMenu.jsx:8`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/Layouts/Navbar/components/NavbarUserMenu.jsx#L8)
  - [`client/src/pages/Layouts/Navbar/components/NavbarMobileDrawer.jsx:10`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/Layouts/Navbar/components/NavbarMobileDrawer.jsx#L10)
  - [`client/src/components/Common/Profile/ProfilePage.jsx:183`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/Profile/ProfilePage.jsx#L183)
  - [`client/src/components/Common/Profile/AvatarSelector.jsx:22`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/Profile/AvatarSelector.jsx#L22)
  - [`client/src/components/AdminDashboard/pages/AdminUsersPage.jsx:33`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/AdminDashboard/pages/AdminUsersPage.jsx#L33)
- **URL:** `https://cdn-icons-png.flaticon.com/512/3135/3135715.png`
- **Asset Type:** PNG User Profile Silhouette Icon
- **Render State:** Actively rendered as default avatar across all pages for unauthenticated or avatar-less users.
- **Classification:** Third-Party CDN Hotlink.
- **Concerns:** Violates Flaticon terms of service (forbids direct CDN hotlinking without licensing); external tracking and privacy leakage on every visitor; runtime failure if CDN is unreachable.
- **Local Alternative:** An existing file exists at [`client/public/default-profile.png`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/public/default-profile.png) (1,077 bytes), or an inline SVG avatar token can be authored.
- **Recommended Disposition:** Replace with local asset or inline SVG avatar component.
- **Confidence:** High (100%).

#### Finding 4: Avatar Selector Preset Library (Cloudinary)
- **Location:** [`client/src/components/Common/Profile/AvatarSelector.jsx:12-18`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/Profile/AvatarSelector.jsx#L12-L18)
- **Also referenced in:** `ProfilePage.jsx:17`, `ProfileSettingsPage.jsx:33`, `ProductList10.jsx:140, 171`, `ProductList6.jsx:248, 316`
- **URLs (7 distinct images):**
  1. `.../ave3utbydiwk7bkmalxa.jpg` (7 references)
  2. `.../pdvuipbvx8ctetyukiik.jpg` (1 reference)
  3. `.../ysj2bnwwwn3yewjaemyh.jpg` (1 reference)
  4. `.../ygrm3qffojquuodpcle7.jpg` (1 reference)
  5. `.../hwn6uq26vm7xliubjodm.jpg` (1 reference)
  6. `.../uvpavhuusqe9urqzso6a.jpg` (1 reference)
  7. `.../x3lhrg87lqad23oikjyt.jpg` (1 reference)
- **Asset Type:** JPEG Profile Photos (7 selectable user avatars)
- **Render State:** Rendered in avatar selection modal; primary item (`ave3utbydiwk7bkmalxa.jpg`) also used as fallback across product lists.
- **Classification:** Pre-packaged User Demo Avatars on Cloudinary.
- **Concerns:** Unverified rights of individuals depicted in avatar photographs; personal Cloudinary account dependency.
- **Recommended Disposition:** Replace with original illustrated avatar tokens or stylized geometric avatars hosted locally.
- **Confidence:** High (100%).

#### Finding 5: Isolated Third-Party Avatar & Background Hotlinks
1. **VectorStock Preview Avatar:**
   - **Location:** [`client/src/components/ProductList/ProductList4/ProductList4.jsx:369`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/ProductList/ProductList4/ProductList4.jsx#L369)
   - **URL:** `https://cdn.vectorstock.com/i/500p/62/34/user-profile-icon-anonymous-person-symbol-blank-vector-53216234.jpg`
   - **Concerns:** Watermarked stock preview thumbnail used as seller fallback avatar. Direct copyright infringement risk.
   - **Disposition:** Replace with local default avatar.
2. **Freepik Header Background:**
   - **Location:** [`client/src/components/Common/Profile/ProfilePage.jsx:170`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/Profile/ProfilePage.jsx#L170)
   - **URL:** `https://img.freepik.com/free-vector/abstract-colorful-shapes-background_361591-2848.jpg?semt=ais_hybrid`
   - **Concerns:** Hotlinking directly to Freepik CDN (`img.freepik.com`) violates Freepik terms and embeds dynamic tracking parameters (`?semt=ais_hybrid`).
   - **Disposition:** Replace with a CSS gradient banner or locally authored abstract SVG.
3. **Pinterest Admin Avatar:**
   - **Location:** [`client/src/components/SellerDashboard/partials/dashboard/MyAccountPage.jsx:348`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/SellerDashboard/partials/dashboard/MyAccountPage.jsx#L348)
   - **URL:** `https://i.pinimg.com/736x/f1/0f/f7/f10ff70a7155e5ab666bcdd1b45b726d.jpg`
   - **Concerns:** Unverified Pinterest user image hotlinked as admin fallback avatar.
   - **Disposition:** Replace with local default avatar.
4. **Pravatar Mock Profile:**
   - **Location:** [`client/src/components/Common/GlassyProfile/GlassyProfile.jsx:34`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/GlassyProfile/GlassyProfile.jsx#L34)
   - **URL:** `https://i.pravatar.cc/120?img=26`
   - **Concerns:** Third-party demo avatar service hotlinked in demo card.
   - **Disposition:** Replace with local avatar.

---

### 4.3 Marketing & Template Assets (Rareblocks & Cruip)

#### Finding 6: Rareblocks Celebration Template Assets (11 references)
- **Locations & URLs:**
  - `Banner/Banner1/Banner.jsx:25` — `https://cdn.rareblocks.xyz/collection/celebration/images/hero/1/hero-img.png`
  - `SellerComponents/SellerBanner/SellerBanner2/SellerBanner2.jsx:18` — `.../images/team/6/team-member-1.jpg`
  - `SellerComponents/SellerBanner/SellerBanner2/SellerBanner2.jsx:22` — `.../images/team/6/team-member-2.jpg`
  - `SellerComponents/SellerBanner/SellerBanner2/SellerBanner2.jsx:26` — `.../images/team/6/team-member-3.jpg`
  - `SellerComponents/SellerBanner/SellerBanner3/SellerBanner3.jsx:10` — `.../images/features/4/man-eating-noodles.jpg`
  - `SellerComponents/SellerBanner/SellerBanner3/SellerBanner3.jsx:12` — `.../images/features/4/smiling-businessman.jpg`
  - `SellerComponents/SellerSupport/SellerSupport.jsx:41` — `.../images/team/4/group-of-people.png`
  - `SellerComponents/SellProduct/SellProduct.jsx:19` — `.../images/contact/4/curve-line-mobile.svg`
  - `SellerComponents/SellProduct/SellProduct.jsx:25` — `.../images/contact/4/curve-line.svg`
  - `SellerComponents/SellProduct/SellProduct.jsx:53` — `.../images/contact/4/avatar.jpg`
  - `pages/Seller/Layouts/SellerFooter/SellerFooter.jsx:7` — `.../images/cta/5/girl-working-on-laptop.jpg`
- **Asset Type:** Stock PNG/JPG photos of models and decorative SVGs.
- **Classification:** Third-Party Template Demo Assets.
- **Concerns:** Unlicensed hotlinking of Rareblocks marketing template assets; rights of publicity for depicted individuals; brand incongruity with fine collectible auctions.
- **Recommended Disposition:** Replace with original AuctionX vector art, inline decorative curves, or remove redundant template demo components.
- **Confidence:** High (100%).

#### Finding 7: Cruip Tutorial Demo Assets (5 references)
- **Locations & URLs:**
  - `Layouts/Footer/AboutUs/AboutUs1/AboutUs1.jsx:67` — `https://cruip-tutorials.vercel.app/negative-margins//article-01.jpg`
  - `Layouts/Footer/AboutUs/AboutUs1/AboutUs1.jsx:103` — `https://cruip-tutorials.vercel.app/negative-margins//article-02.jpg`
  - `Layouts/Footer/AboutUs/AboutUs1/AboutUs1.jsx:118` — `https://cruip-tutorials.vercel.app/negative-margins//article-03.jpg`
  - `Modals/ModalVideoPlayer/ModalVideoPlayer.jsx:33` — `https://cruip-tutorials.vercel.app/modal-video/modal-video-thumb.jpg`
  - `Modals/ModalVideoPlayer/ModalVideoPlayer.jsx:69` — `https://cruip-tutorials.vercel.app/modal-video/video.mp4`
- **Asset Type:** JPEG mock article cards, video thumbnail, and MP4 video.
- **Classification:** External Free Hobby Vercel Hotlinks.
- **Concerns:** Extreme runtime fragility (free Vercel domain may be taken down or rate-limited without warning, breaking `/about-us` and video modal).
- **Recommended Disposition:** Replace with authentic auction editorial articles or local assets.
- **Confidence:** High (100%).

---

### 4.4 Stock Photography & Third-Party Product Images

#### Finding 8: Unsplash Stock Photos (21 references)
- **Key URLs & Contexts:**
  1. `https://images.unsplash.com/photo-1523275335684-37898b6baf30` (Wristwatch product photo):
     - Used as `DEFAULT_ITEM_IMAGE` in admin auction, listing, and order tables (`AdminAuctionsPage.jsx:40`, `AdminListingsPage.jsx:37`, `AdminOrdersPage.jsx:44`) and user scheduled bids (`ScheduledBids.jsx:344, 500`).
  2. `https://images.unsplash.com/photo-1503614472-8c93d56e92ce` (4K landscape):
     - Repeated 6 times across carousel slides in `SellerBanner1/SellerBanner.jsx:11, 19, 27, 35, 43, 51`.
  3. `AboutUs1.jsx:135-190` (6 workplace & portrait photos):
     - `photo-1461749280684`, `photo-1552664730`, `photo-1519389950`, `photo-1535713875`, `photo-1438761681`, `photo-1500648767`.
  4. `SellerProfileView.jsx:63, 216` (Seller avatar and review photo).
  5. `DetailedOrderPage.jsx:548` & `PendingBids.jsx:534` (Mock item photos).
- **Classification:** Commercial Stock Photography (Unsplash License).
- **Concerns:** While Unsplash allows commercial use without attribution, dynamic CDN hotlinking creates user IP tracking concerns, external network latency, and inconsistent fallback rendering.
- **Recommended Disposition:** Replace default product image fallbacks with locally authored SVG lot silhouettes; replace marketing photos with project theme illustrations.
- **Confidence:** High (100%).

#### Finding 9: Amazon Catalog Product Hotlink
- **Location:** [`client/src/pages/User/Dropdown/OrderHistory/OrdersPage.jsx:127`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/Dropdown/OrderHistory/OrdersPage.jsx#L127)
- **URL:** `https://m.media-amazon.com/images/I/91nkc6fMx1L._AC_SY195_.jpg`
- **Asset Type:** E-commerce product image from Amazon catalog
- **Render State:** Fallback image for order history listings when `order.images[0]` is undefined.
- **Classification:** Unauthorized Amazon CDN Hotlink.
- **Concerns:** Direct hotlink to Amazon's media CDN for commercial auction platform fallback.
- **Recommended Disposition:** Replace with local product fallback SVG.
- **Confidence:** High (100%).

---

### 4.5 Fallback Services, Audio Media, and Typography

#### Finding 10: Placeholder Services (`via.placeholder.com`) (8 references)
- **Locations:**
  - `SellerPage.jsx:405, 609` (`via.placeholder.com/40`, `via.placeholder.com/64`)
  - `Banner3.jsx:218` & `Banner6.jsx:228` (`via.placeholder.com/800x400?text=Banner+Image+Not+Found`)
  - `PopupModal.jsx:137` (`via.placeholder.com/400x300?text=No+Image`)
  - `ProductList7.jsx:221` & `ProductList9.jsx:215` (`via.placeholder.com/150`)
  - `DetailedOrderPage.jsx:541` (`via.placeholder.com/300`)
- **Classification:** External Image Fallback Service.
- **Concerns:** Service instability (via.placeholder.com frequently has DNS/certificate interruptions); results in broken-image placeholders.
- **Recommended Disposition:** Replace with self-contained inline SVG placeholder badges.
- **Confidence:** High (100%).

#### Finding 11: Third-Party Music Media (SoundCloud & Spotify)
- **Locations & URLs:**
  - `FanBook.jsx:24, 36` — `https://i1.sndcdn.com/artworks-8TPHyl9TJ4u0Xt1z-PFUArQ-t500x500.jpg` (SoundCloud artwork)
  - `SpotifyEmbed.jsx:37` — `https://open.spotify.com/embed/playlist/5WToK4EWSLTg7V5lYZQEUX...` (Spotify iframe player)
- **Classification:** Third-Party Music & Streaming Embeds.
- **Concerns:** Third-party tracking cookies (Spotify iframe injects trackers); auto-play audio; copyrighted SoundCloud album art.
- **Recommended Disposition:** Quarantine or disable Spotify auto-play embed on production builds; replace SoundCloud art with original audio artwork.
- **Confidence:** High (100%).

#### Finding 12: External Web Fonts & Font Awesome CDN
- **Locations & URLs:**
  - `client/index.html:49, 50, 52` — Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`)
  - `client/index.html:59` — Font Awesome CSS (`cdnjs.cloudflare.com/.../all.min.css`)
  - `adminStyle.css:1` & `sellerStyle.css:1` — `@import url('https://fonts.googleapis.com/css2?family=Inter...');`
- **Classification:** External Typography and Icon Stylesheets.
- **Concerns:** Visitor IP address transmission to Google and Cloudflare CDNs (EU GDPR compliance consideration).
- **Recommended Disposition:** Bundle fonts locally via npm package (e.g. `@fontsource/inter`, `@fontsource/dm-sans`) in a subsequent release stage.
- **Confidence:** High (100%).

---

### 4.6 Architectural Secret & Upload Pipeline Exposure

#### Finding 13: Direct Client-Side Unsigned Cloudinary Upload Endpoint
- **Locations:**
  - [`client/src/pages/User/UserLogin/VerifyProfilePage.jsx:271`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/UserLogin/VerifyProfilePage.jsx#L271)
  - [`client/src/pages/User/UserLogin/VerifySellerProfilePage.jsx:281`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/UserLogin/VerifySellerProfilePage.jsx#L281)
- **Endpoint:** `https://api.cloudinary.com/v1_1/dszvpb3q5/image/upload`
- **Configuration:** Hardcoded Cloud Name `dszvpb3q5` with unsigned preset `product_image`.
- **Classification:** Sensitive Architectural / Pipeline Exposure.
- **Concerns:** While no private secret API key is committed, exposing an unsigned upload preset directly in client code allows arbitrary file uploads to the owner's Cloudinary account, creating storage exhaustion and abuse vectors for user KYC identity verification.
- **Recommended Disposition:** Route KYC document uploads through the existing authenticated backend API with server-side validation and secure storage.
- **Confidence:** High (100%).

---

## 5. Risk-Ranked Remediation Prioritization (P0–P3)

### Priority Matrix Overview

| Level | Priority Description | Count (Refs / Distinct) | Primary Targets |
|:---:|:---|:---:|:---|
| **P0** | **Security / Secret / Pipeline Exposure** | 2 refs / 1 endpoint | Direct client-side unsigned Cloudinary upload endpoint in KYC verification |
| **P1** | **Public-Release & Legal Liability** | 22 refs / 13 URLs | Primary Brand Logo, Flaticon Default Avatar, VectorStock watermark, Amazon order image, Freepik cover, Rareblocks marketing models |
| **P2** | **Runtime Reliability & Privacy Risks** | 33 refs / 23 URLs | `via.placeholder.com` outages, Cruip Vercel demo files, Spotify iframe tracker, SoundCloud artwork, Razorpay badge, Google Fonts / cdnjs |
| **P3** | **Cleanup & Consistency** | 30 refs / 25 URLs | Admin table Unsplash placeholders, Pravatar demo card, Pixabay review icon, goodies fallbacks, AvatarSelector preset photos |

### Detailed Priority Definitions

#### P0 — Critical Architectural / Security Exposures
- **Target:** `VerifyProfilePage.jsx:271` & `VerifySellerProfilePage.jsx:281`.
- **Rationale:** Exposes development cloud name `dszvpb3q5` and unsigned preset `product_image`. Sensitive user verification documents are uploaded directly to an unauthenticated external service rather than the project's secure backend.
- **Remediation:** Refactor document upload to post to `/api/user/verify-identity` on the Express backend.

#### P1 — Public-Release and Legal Risks
- **Targets:**
  1. **Primary Brand Logo (2 refs):** `Navbar.jsx:158`, `SellerNavbar.jsx:115` (`cifsfk5fzryh0iwp3fua.png`).
  2. **Global Default Avatar (6 refs):** Flaticon hotlink in `Navbar.jsx`, `NavbarUserMenu.jsx`, `NavbarMobileDrawer.jsx`, `ProfilePage.jsx`, `AvatarSelector.jsx`, `AdminUsersPage.jsx`.
  3. **Copyrighted Stock Preview (1 ref):** VectorStock watermarked thumbnail in `ProductList4.jsx:369`.
  4. **Scraped E-commerce Asset (1 ref):** Amazon catalog photo in `OrdersPage.jsx:127`.
  5. **Freepik Hotlink (1 ref):** Profile header background in `ProfilePage.jsx:170`.
  6. **Rareblocks Marketing Assets (11 refs):** Model photos and marketing illustrations in `Banner1`, `SellerBanner2`, `SellerBanner3`, `SellerSupport`, `SellProduct`, `SellerFooter`.
- **Rationale:** These assets appear on prominent public-facing pages, violate third-party terms of service (Flaticon/Freepik hotlinking), infringe copyrights (VectorStock, Amazon), or depict unverified individuals on seller onboarding pages.
- **Remediation:** Replace with locally authored SVG tokens, authorized local assets, or original AuctionX graphics.

#### P2 — Runtime Reliability and Privacy Risks
- **Targets:**
  1. **Placeholder Fallbacks (8 refs):** `via.placeholder.com` in 7 components.
  2. **Vercel Hobby Demo Files (5 refs):** `cruip-tutorials.vercel.app` in `AboutUs1.jsx` and `ModalVideoPlayer.jsx`.
  3. **Third-Party Trackers & Audio (3 refs):** Spotify iframe in `SpotifyEmbed.jsx` and SoundCloud artwork in `FanBook.jsx`.
  4. **External Payment Badge (1 ref):** Razorpay badge in `SellItemPage.jsx:2249`.
  5. **External CDNs (5 refs):** Google Fonts and cdnjs in `index.html` and CSS.
  6. **Cloudinary Identity Asset (1 ref):** Razorpay modal image in `PaymentPage.jsx:202`.
- **Rationale:** External services subject to DNS failure, rate limiting, and visitor IP tracking.
- **Remediation:** Self-host assets locally; replace dynamic placeholders with static vector fallbacks; bundle web fonts locally.

#### P3 — Cleanup, Mock Data, and Consistency
- **Targets:**
  1. **Admin Table Fallbacks (7 refs):** Unsplash wristwatch in `AdminAuctionsPage`, `AdminListingsPage`, `AdminOrdersPage`, `ScheduledBids`.
  2. **Seller Demo Assets (6 refs):** Unsplash landscape in `SellerBanner1`.
  3. **Avatar Selector Library (7 refs):** Stock photos in `AvatarSelector.jsx`.
  4. **Demo Cards (3 refs):** `i.pravatar.cc` in `GlassyProfile.jsx`, Pixabay icon in `SellerProfileView.jsx`, goodies fallback in `FanBook.jsx`.
- **Rationale:** Low-impact development mock data in internal or secondary demonstration pages.
- **Remediation:** Replace with curated mock data and project-owned vector icons during routine codebase maintenance.

---

## 6. Proposed Next Implementation Scope (Stage 7.21)

To maintain safety and achieve high impact without a destabilizing broad rewrite, the next implementation stage should be strictly bounded to **Core Platform Identity and High-Visibility Global Avatars (P1 Focus)**:

### Proposed Stage 7.21 Implementation Scope
1. **Primary AuctionX Brand Logo:**
   - Replace the remote Cloudinary hotlink in [`Navbar.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/Layouts/Navbar/Navbar.jsx) and [`SellerNavbar.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/Seller/Layouts/SellerNavbar/SellerNavbar.jsx) with an original, locally authored SVG brand logo component.
   - Update `PaymentPage.jsx` Razorpay modal image to reference the local logo.
2. **Global Default User Avatar:**
   - Replace the 6 Flaticon hotlink references across `Navbar.jsx`, `NavbarUserMenu.jsx`, `NavbarMobileDrawer.jsx`, `ProfilePage.jsx`, `AvatarSelector.jsx`, and `AdminUsersPage.jsx` with an authorized local asset ([`client/public/default-profile.png`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/public/default-profile.png)) or an inline SVG avatar token matching the AuctionX terracotta design system.
3. **High-Risk Isolated Infringement Purge:**
   - Remove the VectorStock watermark preview in [`ProductList4.jsx:369`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/ProductList/ProductList4/ProductList4.jsx#L369).
   - Remove the Amazon catalog hotlink in [`OrdersPage.jsx:127`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/Dropdown/OrderHistory/OrdersPage.jsx#L127).
   - Replace the Freepik profile header hotlink in [`ProfilePage.jsx:170`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/Profile/ProfilePage.jsx#L170) with a native Tailwind gradient (`from-primary/20 via-surface to-secondary/20`).

---

## 7. Verification of the 22-File Quarantine Manifest

All 22 binary asset candidates cataloged in [`Audit-071-Orphaned-Asset-Quarantine-Manifest.md`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/docs/audits/Audit-071-Orphaned-Asset-Quarantine-Manifest.md) were re-verified on the local disk. None have been moved, renamed, or deleted.

| # | Relative File Path | Format | Size (Bytes) | Verification Status |
|:---:|:---|:---:|:---:|:---:|
| 1 | `client/src/assets/images/components/Banner2/AuctionXAngelina.jpg` | JPEG | 170,373 | **EXISTS — INTACT** |
| 2 | `client/src/assets/images/components/Banner2/AuctionXGill.png` | PNG | 1,321,644 | **EXISTS — INTACT** |
| 3 | `client/src/assets/images/components/Banner2/AuctionXScarlet.png` | PNG | 1,517,828 | **EXISTS — INTACT** |
| 4 | `client/src/assets/images/components/Banner2/AuctionXSwift.png` | PNG | 844,660 | **EXISTS — INTACT** |
| 5 | `client/src/assets/images/components/SlideDeisgn/can 2.png` | PNG | 37,572 | **EXISTS — INTACT** |
| 6 | `client/src/assets/images/components/SlideDeisgn/Contents-2.png` | PNG | 66,235 | **EXISTS — INTACT** |
| 7 | `client/src/assets/images/components/SlideDeisgn/Contents.png` | PNG | 70,186 | **EXISTS — INTACT** |
| 8 | `client/src/assets/images/components/SlideDeisgn/orange-1.png` | PNG | 86,178 | **EXISTS — INTACT** |
| 9 | `client/src/assets/images/components/SlideDeisgn/orange-2.png` | PNG | 88,634 | **EXISTS — INTACT** |
| 10 | `client/src/assets/images/components/SlideDeisgn/orange-3.png` | PNG | 27,462 | **EXISTS — INTACT** |
| 11 | `client/src/assets/images/components/SlideDeisgn/pineapple-1.png` | PNG | 38,486 | **EXISTS — INTACT** |
| 12 | `client/src/assets/images/components/SlideDeisgn/pineapple-2.png` | PNG | 81,937 | **EXISTS — INTACT** |
| 13 | `client/src/assets/images/components/SlideDeisgn/pineapple-3.png` | PNG | 6,536 | **EXISTS — INTACT** |
| 14 | `client/src/assets/images/FooterElements/Footer/slideLogo-1.png` | PNG | 15,425 | **EXISTS — INTACT** |
| 15 | `client/src/assets/images/FooterElements/Footer/slideLogo-2.png` | PNG | 36,025 | **EXISTS — INTACT** |
| 16 | `client/src/assets/images/FooterElements/Footer/slideLogo-3.png` | PNG | 46,960 | **EXISTS — INTACT** |
| 17 | `client/src/assets/images/FooterElements/Footer/slideLogo-4.png` | PNG | 38,004 | **EXISTS — INTACT** |
| 18 | `client/src/assets/images/FooterElements/Footer/slideLogo-5.png` | PNG | 88,613 | **EXISTS — INTACT** |
| 19 | `client/src/assets/images/FooterElements/Footer/slideLogo-6.png` | PNG | 23,216 | **EXISTS — INTACT** |
| 20 | `client/src/assets/images/FooterElements/Footer/slideLogo-7.png` | PNG | 83,233 | **EXISTS — INTACT** |
| 21 | `client/src/assets/images/FooterElements/Footer/slideLogo-8.png` | PNG | 23,529 | **EXISTS — INTACT** |
| 22 | `client/src/assets/images/FooterElements/Footer/slideLogo-9.png` | PNG | 51,953 | **EXISTS — INTACT** |
| **Total** | **22 Files** | | **4,764,689 Bytes** | **100% Verified Preserved** |

---

## 8. Non-Destructive Validation Evidence

### 8.1 Automated Tests
Command: `npm test --prefix client`
- **Result:** PASSED (8/8 test suites, 8 passed, 0 failed)
- **Duration:** 89.88ms

### 8.2 Frontend Production Build
Command: `npm run build --prefix client`
- **Result:** PASSED (Exit code 0, 0 errors)
- **Banner4 Assets Verification:** All 6 locally authored Stage 7.16/7.17 SVGs remain actively bundled in the production output (`client/dist/assets/`):
  - `dist/assets/collectibleArtifact-DKB4rGk7.svg`
  - `dist/assets/auctionxEvent-DK6e4g6h.svg`
  - `dist/assets/collectibleCricket-BC9vjD1b.svg`
  - `dist/assets/collectibleFootball-C76bE8_X.svg`
  - `dist/assets/collectibleTrophy-D0R2c2a0.svg`
  - `dist/assets/collectibleWatch-CH_4Xq2f.svg`

### 8.3 Whitespace and Index Cleanliness
Command: `git diff --check`
- **Result:** PASSED (Exit code 0; zero whitespace or conflict markers).
- **Staged Work:** All 27 staged documentation renames remain untouched in the git index.
- **Root `LICENSE`:** Untracked and untouched.

---

## 9. Remaining Public Release Blockers

Public release remains **STRICTLY BLOCKED** until the following gates are resolved:
1. **Frontend Asset Remediation (Stage 7.21+):** Execution of the proposed P0 and P1 asset remediation (primary logo, default avatar, VectorStock, Amazon, Freepik, and Rareblocks assets).
2. **Orphaned Asset Quarantine Execution:** Explicit owner authorization required to delete or relocate the 22 quarantined binary files cataloged in `Audit-071-Orphaned-Asset-Quarantine-Manifest.md`.
3. **Proprietary License Execution:** Formal owner review and adoption of the proprietary source-available license and inbound Contributor License Agreement (Stages 7.13 and 7.14A).
4. **Third-Party Attribution Compilation:** Publication of `docs/licenses/THIRD_PARTY_NOTICES.md` (Stage 7.15).
