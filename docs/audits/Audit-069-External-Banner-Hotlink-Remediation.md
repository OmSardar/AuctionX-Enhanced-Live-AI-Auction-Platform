# Stage 7.17 — External Promotional Banner Hotlink Remediation Audit

**Date:** 2026-10-19  
**Execution Stage:** Stage 7.17  
**Auditor:** Antigravity AI Pair Programmer  
**Target Repository:** AuctionX (Local Workspace)  
**Final Status:**  
`BANNER HOTLINK REPLACED — PUBLIC RELEASE STILL BLOCKED`

---

## 1. Executive Summary

In Stage 7.16, all five active celebrity-themed image references in [`client/src/components/Banner/Banner4/Banner4.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Banner/Banner4/Banner4.jsx) were replaced with locally authored SVG collectible illustrations. However, the first slot (index 0) of the `images` array remained hardcoded to an external third-party promotional GIF hosted on `images.bewakoof.com`.

In this Stage 7.17 workflow:
1. **External Hotlink Elimination:** The remote URL (`https://images.bewakoof.com/...`) was completely removed from [`Banner4.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Banner/Banner4/Banner4.jsx).
2. **Local Vector Artwork Creation:** A bespoke, lightweight SVG illustration [`auctionxEvent.svg`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/assets/images/components/Banner4/auctionxEvent.svg) was created in the dedicated component asset folder [`client/src/assets/images/components/Banner4/`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/assets/images/components/Banner4).
3. **Seamless Component Integration:** [`Banner4.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Banner/Banner4/Banner4.jsx) now imports `auctionxEvent.svg` directly. All six marquee carousel slots are now 100% self-hosted, locally authored, high-resolution vector assets.
4. **Zero Layout Distortion:** The 1:1 aspect ratio, marquee animation cycle, responsive sizing breakpoints, and visual styling were strictly preserved.
5. **No Scope Creep:** No unrelated images, manifests, lockfiles, or legal drafts were modified. The 27 staged documentation renames and previous stage audit reports were preserved intact.

---

## 2. Forensic Inspection of Replaced Hotlink

### 2.1 Replaced External URL
- **Full URL:** `https://images.bewakoof.com/uploads/grid/app/Mad-Diwali-Sale-IK-RM-1x1-HC-Banner-deals-are-live--1--1730374454.gif`
- **Host Domain:** `images.bewakoof.com` (Third-party e-commerce apparel vendor CDN)
- **Position in Component:** Index 0 of the `images` array in [`Banner4.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Banner/Banner4/Banner4.jsx).
- **Aspect Ratio:** 1:1 square ("1x1-HC-Banner").

### 2.2 Risks Associated with the Hotlink
- **Third-Party Copyright Infringement:** The graphic contained commercial promotional branding and artwork owned by Bewakoof Brands Pvt. Ltd.
- **Content Drift & Availability Failure:** Reliance on an external CDN without integrity guarantees meant the asset could break, change, or serve 404s at any time.
- **Privacy & Security Exposure:** Client browsers made unauthenticated cross-origin GET requests to an external retail CDN on every homepage load, transmitting user IP addresses and Referer headers.

---

## 3. Original Replacement Artwork Specification

### 3.1 File Path & Dimensions
- **File Path:** [`client/src/assets/images/components/Banner4/auctionxEvent.svg`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/assets/images/components/Banner4/auctionxEvent.svg)
- **Dimensions:** `1024 × 1024` pixels (`viewBox="0 0 1024 1024"`), matching the 1:1 square display slot.
- **File Format:** Native SVG (vector XML) with inline gradients and Gaussian blur glow filters.
- **Dependencies Added:** None (0 new npm dependencies).

### 3.2 Visual & Artistic Composition
- **Theme:** AuctionX Premier Live Auction Event.
- **Central Subject:** A sculpted, turned dark-walnut auctioneer's gavel with polished brass accents, held in a dynamic diagonal striking posture above an acoustic sound block / anvil inlay.
- **Atmospheric Staging:**
  - Deep royal obsidian and violet backdrop gradient (`#1e1838` to `#020108`).
  - Warm overhead spotlight cone (`#f59e0b`) casting specular light down upon the dais.
  - Three concentric holographic bidding orbital rings (`#fde047`, `#a855f7`, `#38bdf8`) with dashed line geometries representing active digital bidding pulses.
  - Tiered hexagonal event stage platform with gold rim lighting.
- **Plaque & Badges:**
  - Podium Plaque: "AUCTIONX PREMIER EVENT • CURATED EXCLUSIVE LOTS"
  - Header Pill: "AUCTIONX LIVE AUCTION" (with glowing amber status indicator)
  - Secondary Tag: "FEATURED COLLECTION"
- **Rights & Integrity:**
  - Zero third-party logos, trademarked typography, or external vector paths.
  - No manufactured discounts, promotional countdowns, pricing claims, or dates.
  - Clean, theme-adaptive dark mode palette that matches the AuctionX design tokens.

---

## 4. Component Changes & Code Diff

### 4.1 Modified File
[`client/src/components/Banner/Banner4/Banner4.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Banner/Banner4/Banner4.jsx)

### 4.2 Exact Git Diff
```diff
diff --git a/client/src/components/Banner/Banner4/Banner4.jsx b/client/src/components/Banner/Banner4/Banner4.jsx
index 98bb1d1..ea8701c 100644
--- a/client/src/components/Banner/Banner4/Banner4.jsx
+++ b/client/src/components/Banner/Banner4/Banner4.jsx
@@ -1,18 +1,19 @@
 import React, { useEffect, useState } from "react";
 import { useThemeProvider } from "../../AdminDashboard/utils/ThemeContext"; // Adjust the import path as needed
-import AuctionXJapanese from "../../../assets/images/components/Banner2/AuctionXJapanese.jpg";
-import AuctionXMessi from "../../../assets/images/components/Banner2/AuctionXMessi.jpg";
-import AuctionXVirat from "../../../assets/images/components/Banner2/AuctionXVirat.jpg";
-import AuctionXRonaldo from "../../../assets/images/components/Banner2/AuctionXRonaldo.jpg";
-import AuctionXRock from "../../../assets/images/components/Banner2/AuctionXRock.jpg";
+import auctionxEvent from "../../../assets/images/components/Banner4/auctionxEvent.svg";
+import collectibleArtifact from "../../../assets/images/components/Banner4/collectibleArtifact.svg";
+import collectibleFootball from "../../../assets/images/components/Banner4/collectibleFootball.svg";
+import collectibleCricket from "../../../assets/images/components/Banner4/collectibleCricket.svg";
+import collectibleTrophy from "../../../assets/images/components/Banner4/collectibleTrophy.svg";
+import collectibleWatch from "../../../assets/images/components/Banner4/collectibleWatch.svg";
 
 const images = [
-  "https://images.bewakoof.com/uploads/grid/app/Mad-Diwali-Sale-IK-RM-1x1-HC-Banner-deals-are-live--1--1730374454.gif",
-  AuctionXJapanese,
-  AuctionXMessi,
-  AuctionXVirat,
-  AuctionXRonaldo,
-  AuctionXRock,
+  auctionxEvent,
+  collectibleArtifact,
+  collectibleFootball,
+  collectibleCricket,
+  collectibleTrophy,
+  collectibleWatch,
 ];
 
 const Banner4 = () => {
```

### 4.3 Active Carousel Asset Inventory
[`Banner4.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Banner/Banner4/Banner4.jsx) now renders six completely internal, locally authored SVGs in its infinite marquee:
1. `auctionxEvent.svg` (Premier Live Auction Event)
2. `collectibleArtifact.svg` (Dynasty Porcelain Vase)
3. `collectibleFootball.svg` (Golden Heritage Match Ball)
4. `collectibleCricket.svg` (Heritage Willow & Test Ball)
5. `collectibleTrophy.svg` (Grand Championship Cup)
6. `collectibleWatch.svg` (Tourbillon Skeleton Chronograph)

---

## 5. Verification & Validation Evidence

### 5.1 Elimination of External URL in Component
Static analysis of [`Banner4.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Banner/Banner4/Banner4.jsx):
- Search for `bewakoof`: **0 matches (false)**
- Search for `https://`: **0 matches (false)**

### 5.2 Asset Bundling in Production Build
Vite production build verified:
- `client/dist/assets/auctionxEvent-CK21ntDd.svg` emitted into dist assets.
- All six Banner4 SVGs emitted together in `dist/assets/`:
  - `auctionxEvent-CK21ntDd.svg`
  - `collectibleArtifact-DlvdSXkJ.svg`
  - `collectibleCricket-DnXFeiAg.svg`
  - `collectibleFootball-BbPQny_S.svg`
  - `collectibleTrophy-DDSgRZGW.svg`
  - `collectibleWatch-BjwyTNrR.svg`

### 5.3 Test Suite Execution
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

### 5.4 Production Build Execution
- **Command:** `npm run build --prefix client`
- **Duration:** 15.00s
- **Result:** Clean exit code 0. Zero build warnings, zero missing asset errors.

### 5.5 Whitespace & Git Diff Integrity
- **Command:** `git diff --check`
- **Result:** Clean exit code 0.

### 5.6 Git State Preservation Evidence
Inspection via `git status --short` confirms:
- **27 Staged Renames:** Staged and untouched.
- **Root `LICENSE`:** Untracked MIT intact (awaiting owner licensing gate).
- **Audit Documents:** Stage 7.15 and 7.16 reports (`Audit-067-Third-Party-Notices-And-Asset-Rights.md`, `Audit-066-Asset-Rights-And-Media-Inventory.md`, `Audit-068-Collectible-Artwork-Replacement.md`, `THIRD_PARTY_NOTICES.md`) preserved intact.
- **Only Intended Changes:** Only [`Banner4.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Banner/Banner4/Banner4.jsx) modified in tracked files; only original SVGs added in untracked files.

---

## 6. Remaining Asset-Rights & Public-Release Blockers

Stage 7.17 successfully eliminated the external promotional hotlink from `Banner4.jsx`. However, the repository remains **strictly blocked from public release** due to other unresolved asset and licensing dependencies:

1. **Unreferenced Celebrity Images in `Banner2/` (4 files):**
   - `AuctionXAngelina.jpg`, `AuctionXSwift.png`, `AuctionXScarlet.png`, and `AuctionXGill.png` remain present on disk in `client/src/assets/images/components/Banner2/`.
   - *Status:* Awaiting explicit owner authorization to permanently purge or quarantine.
2. **Unreferenced Mockups & Demo Graphics (18 files):**
   - 9 images in `client/src/assets/images/components/SlideDeisgn/`
   - 9 images in `client/src/assets/images/components/Footer/`
   - *Status:* Dead audit weight awaiting owner purge decision.
3. **Other Remote Asset Hotlinks in the Application:**
   - [`LogoSlider.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/LogoSlider/LogoSlider.jsx) hotlinks external SVGs from `cdn.jsdelivr.net` for major corporate logos (Google, Apple, Meta, etc.).
   - [`SmoothHovering.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/StaticPages/SmoothHovering.jsx) hotlinks brand logos from `upload.wikimedia.org`.
   - [`SellProduct.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/SellerComponents/SellProduct/SellProduct.jsx) hotlinks decorative lines from `cdn.rareblocks.xyz`.
4. **Third-Party Payment & Brand Marks:**
   - Mastercard, Visa, Stripe, PayPal in `client/src/assets/images/components/Payment/`.
5. **Root Licensing Contradiction:**
   - Root `LICENSE` is an untracked MIT file, conflicting with the proprietary source-available licensing direction.
6. **Inbound Contributor Agreement (CLA) Approval:**
   - Proprietary license terms and CLA draft require formal owner sign-off.
7. **Cloud Verification & Infrastructure:**
   - Live integration validation with cloud providers (MongoDB Atlas, Redis Cloud, Stripe Webhook endpoints) is pending.

---

## 7. Final Verdict

```
================================================================================
FINAL STATUS:
BANNER HOTLINK REPLACED — PUBLIC RELEASE STILL BLOCKED
================================================================================
```

---

## 8. Recommended Next Safe Stage (Stage 7.18)

1. **Orphaned Celebrity & Mockup Asset Disposal Plan:** Formulate an owner-reviewable script/manifest to safely delete the 4 unreferenced celebrity files and 18 unreferenced slide/logo mockups without affecting git history or build dependencies.
2. **Remaining Remote CDN Hotlink Audit & Remediation:** Evaluate the corporate brand logos in `LogoSlider.jsx` and `SmoothHovering.jsx` to either self-host vetted vector marks or replace them with generic platform metrics.
3. **Owner Approval Gate for Root Licensing:** Present the Stage 7.13 / 7.14A proprietary license draft and CLA for formal repository owner adoption.
