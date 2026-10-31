# Stage 7.18 — Frontend Remote Hotlink and Asset Audit

**Date:** 2026-10-19  
**Execution Stage:** Stage 7.18  
**Auditor:** Antigravity AI Pair Programmer  
**Target Repository:** AuctionX (Local Workspace)  
**Final Status:**  
`HOTLINK AUDIT COMPLETE — PUBLIC RELEASE STILL BLOCKED`

---

## 1. Executive Summary

Following the remediation of the homepage banner in Stages 7.16 and 7.17, Stage 7.18 performed an exhaustive audit of all remaining remote image and CDN hotlinks across the frontend source code ([`client/src/`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src)).

Primary findings:
1. **Target Component Hotlinks:**  
   - [`client/src/components/Common/LogoSlider/LogoSlider.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/LogoSlider/LogoSlider.jsx) contains **9 remote CDN hotlinks** to major tech brand SVGs via `cdn.jsdelivr.net` (Google, Apple, Meta, Microsoft, Nike, Airbnb, PlayStation, Tesla, Spotify) and **2 fallback placeholder URLs** to `images.ctfassets.net`.
   - [`client/src/components/Common/StaticPages/SmoothHovering.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/StaticPages/SmoothHovering.jsx) contains **10 remote hotlinks** to corporate brand SVGs via `upload.wikimedia.org` (Apple, Google, Microsoft, Amazon, Meta, Tesla, Netflix, Spotify, Adobe, Nvidia) under a "Trusted Brand Showcase / Verified Partners" header.
2. **Legal & Trademark Constraint:**  
   AuctionX holds no verified partnership, commercial sponsorship, or trademark license from Apple, Google, Tesla, Nike, or the other depicted global corporations.
   - Downloading or mirroring these logos locally into the repository would commit unauthorized third-party trademarks and proprietary artwork into source control.
   - Substituting fake corporate metrics, false partner counts, or unverified claims violates release safety rules.
   - Preserving the visual appearance while removing trademark liability requires an owner-authorized product decision: either re-theming the components to generic **AuctionX Collectible Specialties** (e.g., Horology, Fine Art, Rare Books, Sports Relics) or removing the partner showcases.
3. **Repository State:**  
   In compliance with safety instructions ("If the component's intended appearance cannot be preserved safely, leave the reference unchanged and explain why"), the hotlinks in `LogoSlider.jsx` and `SmoothHovering.jsx` were left unchanged in code, fully mapped in this audit, and slated for an owner-approved architectural re-theming stage.

---

## 2. In-Depth Analysis of Target Components

### 2.1 `LogoSlider.jsx`
- **Location:** [`client/src/components/Common/LogoSlider/LogoSlider.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/LogoSlider/LogoSlider.jsx)
- **Render Context:** Imported and rendered by [`client/src/pages/Layouts/Footer/Footer.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/Layouts/Footer/Footer.jsx) (Line 10, Line 109).
- **Behavior:** Renders an infinite linear scrolling marquee (`@keyframes slide 25s linear infinite`) of corporate marks. Applies `brightness-0 invert opacity-80` in dark mode.
- **Hotlink Inventory:**

| Line # | Current Hotlink URL | Brand / Subject | Classification | Rendered Status |
|:---:|:---|:---|:---|:---:|
| 9 | `https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg` | Google | Third-Party Trademark | Actively Rendered |
| 10 | `https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/apple.svg` | Apple | Third-Party Trademark | Actively Rendered |
| 11 | `https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg` | Meta | Third-Party Trademark | Actively Rendered |
| 12 | `https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/microsoft.svg` | Microsoft | Third-Party Trademark | Actively Rendered |
| 13 | `https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/nike.svg` | Nike | Third-Party Trademark | Actively Rendered |
| 14 | `https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/airbnb.svg` | Airbnb | Third-Party Trademark | Actively Rendered |
| 15 | `https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/playstation.svg` | PlayStation | Third-Party Trademark | Actively Rendered |
| 16 | `https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/tesla.svg` | Tesla | Third-Party Trademark | Actively Rendered |
| 17 | `https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/spotify.svg` | Spotify | Third-Party Trademark | Actively Rendered |
| 45 | `https://images.ctfassets.net/.../placeholder.com-1280x720.png...` | Contentful Placeholder | Third-Party Fallback CDN | Fallback only |
| 66 | `https://images.ctfassets.net/.../placeholder.com-1280x720.png...` | Contentful Placeholder | Third-Party Fallback CDN | Fallback only |

### 2.2 `SmoothHovering.jsx`
- **Location:** [`client/src/components/Common/StaticPages/SmoothHovering.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/StaticPages/SmoothHovering.jsx)
- **Render Context:** Imported and rendered by [`client/src/pages/User/Home.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/Home.jsx) (Line 19, Line 160) and [`client/src/pages/Seller/SellerHome.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/Seller/SellerHome.jsx) (Line 18, Line 39).
- **Behavior:** Interactive 10-card hover grid with glowing gradient borders, grayscale-to-color transitions, and category tags.
- **Copy:** "Trusted Brand Showcase — Hover over the verified partners and collectors to see them come alive." "Click on any partner to explore their curated auctions."
- **Hotlink Inventory:**

| Line # | Current Hotlink URL | Brand / Subject | Classification | Rendered Status |
|:---:|:---|:---|:---|:---:|
| 28 | `https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg` | Apple | Third-Party Trademark | Actively Rendered |
| 34 | `https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg` | Google | Third-Party Trademark | Actively Rendered |
| 40 | `https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg` | Microsoft | Third-Party Trademark | Actively Rendered |
| 46 | `https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg` | Amazon | Third-Party Trademark | Actively Rendered |
| 52 | `https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg` | Meta | Third-Party Trademark | Actively Rendered |
| 58 | `https://upload.wikimedia.org/wikipedia/commons/b/bb/Tesla_T_symbol.svg` | Tesla | Third-Party Trademark | Actively Rendered |
| 64 | `https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg` | Netflix | Third-Party Trademark | Actively Rendered |
| 70 | `https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg` | Spotify | Third-Party Trademark | Actively Rendered |
| 76 | `https://upload.wikimedia.org/wikipedia/commons/7/7b/Adobe_Systems_logo_and_wordmark.svg` | Adobe | Third-Party Trademark | Actively Rendered |
| 82 | `https://upload.wikimedia.org/wikipedia/en/2/21/Nvidia_logo.svg` | Nvidia | Third-Party Trademark | Actively Rendered |

---

## 3. Comprehensive Frontend Hotlink Registry

In addition to `LogoSlider` and `SmoothHovering`, an automated source scan identified other remote image references across the frontend:

| Component File | Line # | Remote Asset URL | Category | Recommended Remediation |
|:---|:---:|:---|:---|:---|
| `Banner1/Banner.jsx` | 25 | `https://cdn.rareblocks.xyz/.../hero-img.png` | Stock Hero Demo | Replace with generic AuctionX hero illustration |
| `SellerBanner2.jsx` | 18, 22, 26 | `https://cdn.rareblocks.xyz/.../team-member-*.jpg` | Stock Team Avatars | Replace with stylized AuctionX avatar tokens |
| `SellerBanner3.jsx` | 10, 12 | `https://cdn.rareblocks.xyz/.../features/4/...` | Stock Photos | Replace with AuctionX feature graphics |
| `SellerSupport.jsx` | 41 | `https://cdn.rareblocks.xyz/.../group-of-people.png` | Stock Photo | Replace with vector support badge |
| `SellProduct.jsx` | 19, 25 | `https://cdn.rareblocks.xyz/.../curve-line*.svg` | Decorative Curve Lines | Replace with local inline SVGs |
| `SellProduct.jsx` | 53 | `https://cdn.rareblocks.xyz/.../avatar.jpg` | Stock Avatar | Replace with local avatar token |
| `SellerFooter.jsx` | 7 | `https://cdn.rareblocks.xyz/.../girl-working-on-laptop.jpg` | Stock Photo | Replace with project vector illustration |
| `AboutUs1.jsx` | 67, 103, 118 | `https://cruip-tutorials.vercel.app/.../article-*.jpg` | Tutorial Demo Mockup | Replace with original auction articles |
| `AboutUs1.jsx` | 135-145, 180-190 | `https://images.unsplash.com/photo-...` | Unsplash Stock Photos | Replace with stylized vector team representations |
| `ModalVideoPlayer.jsx` | 33 | `https://cruip-tutorials.vercel.app/.../modal-video-thumb.jpg` | Video Thumbnail | Replace with local video placeholder SVG |
| `SellerBanner1.jsx` | 11, 19, 27, 35, 43, 51 | `https://images.unsplash.com/photo-1503614472...` | Landscape Wallpaper | Replace with generic theme gradients |
| `Navbar.jsx`, `NavbarUserMenu.jsx`, `AdminUsersPage.jsx`, `AvatarSelector.jsx` | Various | `https://cdn-icons-png.flaticon.com/512/3135/3135715.png` | Default User Avatar | Replace with existing local SVG avatar or inline default |
| `ProductList4.jsx` | 369 | `https://cdn.vectorstock.com/.../blank-vector-53216234.jpg` | Anonymous Avatar | Replace with local avatar |
| `SellItemPage.jsx` | 2249 | `https://cdn.razorpay.com/.../badge-dark.png` | Razorpay Merchant Badge | Evaluate Razorpay trademark policy or self-host if permitted |
| Various Admin/Seller product tables | Various | `https://images.unsplash.com/photo-1523275335684...` | Wristwatch Demo Product | Replace with mock seed references |
| Profile & FanBook pages | Various | `https://res.cloudinary.com/dszvpb3q5/...` | Cloudinary Demo Media | User-upload mocks (preserve dynamic contract) |

---

## 4. Legal & Architectural Evaluation of Target Hotlinks

### 4.1 Trademark and Publicity Implications
1. **False Endorsement / Sponsorship:**  
   Displaying Apple, Google, Microsoft, Meta, etc., under the heading `"Trusted Brand Showcase — Hover over the verified partners and collectors"` creates a false legal implication that AuctionX is an authorized partner, vendor, or licensee of these entities.
2. **Third-Party Copyright Infringement:**  
   Downloading simple-icons or Wikimedia SVG files directly into the repository without an explicit trademark/copyright license does not resolve the blocker—it merely moves the infringement from a runtime network request to static repository source code.
3. **Release Rule Compliance:**  
   The release instructions state:
   - *"If a logo's ownership or usage rights are uncertain, do not assume that downloading or copying it is permitted."*
   - *"If no suitable authorized replacement exists, document the blocker and propose an original generic SVG or other project-owned replacement for a later approved implementation."*
   - *"If the component's intended appearance cannot be preserved safely, leave the reference unchanged and explain why."*

### 4.2 Proposed Approved Architectural Replacement (Stage 7.19)
Rather than displaying unauthorized tech corporate trademarks, both components should be refactored into **AuctionX Collectible Category Showcases**:
- **`LogoSlider.jsx`:** Re-theme into an infinite marquee of **Collectible House Seals** (e.g., Numismatics, Fine Art, Rare Timepieces, Sports Relics, Antiquities, Haute Joaillerie, Classic Comics, Vintage Automobilia).
- **`SmoothHovering.jsx`:** Re-theme into **"Featured Auction Categories"** with cards representing authentic auction categories with locally authored vector emblems, eliminating all corporate trademark liability while enhancing platform relevance.

---

## 5. Verification & Validation Evidence

### 5.1 Test Suite Execution
- **Command:** `npm test --prefix client`
- **Output:**
  ```text
  > client@0.0.0 test
  > node --test tests/geoDataRegression.test.js

  # tests 8
  # pass 8
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  ```
- **Result:** 100% pass (8/8 tests).

### 5.2 Production Build Execution
- **Command:** `npm run build --prefix client`
- **Duration:** 14.14s
- **Result:** Exit code 0 (clean build, 0 errors).
- **Banner4 Asset Integrity Check:** Confirmed that all six locally authored Banner4 SVGs remain emitted into `dist/assets/`:
  - `auctionxEvent-CK21ntDd.svg`
  - `collectibleArtifact-DlvdSXkJ.svg`
  - `collectibleCricket-DnXFeiAg.svg`
  - `collectibleFootball-BbPQny_S.svg`
  - `collectibleTrophy-DDSgRZGW.svg`
  - `collectibleWatch-BjwyTNrR.svg`

### 5.3 Git Whitespace & Format Check
- **Command:** `git diff --check`
- **Result:** Clean exit code 0.

### 5.4 Git State Preservation
- **27 Staged Renames:** Staged and untouched.
- **Root `LICENSE`:** Untracked MIT intact (awaiting owner licensing gate).
- **Audit Documents:** Stage 7.15, 7.16, and 7.17 reports intact.
- **No Unrelated Code Changes:** Zero files were modified or deleted.

---

## 6. Final Status

```
================================================================================
HOTLINK AUDIT COMPLETE — PUBLIC RELEASE STILL BLOCKED
================================================================================
```
