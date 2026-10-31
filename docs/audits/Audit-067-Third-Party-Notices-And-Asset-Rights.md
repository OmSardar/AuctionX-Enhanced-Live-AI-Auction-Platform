# Stage 7.15: Third-Party Notices and Asset-Rights Audit Report

> **Document Type:** Verification & Audit Report  
> **Target Release:** AuctionX — Public Source-Available Repository Release  
> **Classification Verdict:** **`DOCUMENTATION PREPARED — PUBLIC RELEASE STILL BLOCKED`**  
> **Audit Date:** October 18, 2026  
> **Auditors:** DeepMind Agentic Security & Architecture Pair  
> **Target Repository:** `OM-SARDAR/Auction-X-Enhanced` (`AuctionX Monorepo`)  
> **Accompanying Deliverables:**  
> - [`docs/licenses/THIRD_PARTY_NOTICES.md`](../licenses/THIRD_PARTY_NOTICES.md)  
> - [`docs/audits/Audit-066-Asset-Rights-And-Media-Inventory.md`](Audit-066-Asset-Rights-And-Media-Inventory.md)  

---

## 1. Executive Summary

This Stage 7.15 audit formalizes the third-party licensing attribution documentation and non-code asset inventory for AuctionX.

In accordance with strict safety constraints:
- **Documentation Added Only:** Created [`docs/licenses/THIRD_PARTY_NOTICES.md`](../licenses/THIRD_PARTY_NOTICES.md) and [`docs/audits/Audit-066-Asset-Rights-And-Media-Inventory.md`](Audit-066-Asset-Rights-And-Media-Inventory.md).
- **Zero Modifications to Existing Code or Manifests:** No dependencies were added, removed, or upgraded; no source code or assets were edited; and no existing legal drafts were altered.
- **Index Invariants Preserved:** All **27 staged documentation renames** and pre-existing unstaged/untracked changes remain intact in the local Git repository.
- **Final Verdict:** **`DOCUMENTATION PREPARED — PUBLIC RELEASE STILL BLOCKED`**. While third-party open-source attribution has been compiled and the GSAP commercial-use question is resolved, public release remains strictly blocked by outstanding owner approvals on the root license, celebrity demo asset replacement requirements, and cloud infrastructure verification gates.

---

## 2. Third-Party Notice Coverage Evaluation

The newly compiled [`docs/licenses/THIRD_PARTY_NOTICES.md`](../licenses/THIRD_PARTY_NOTICES.md) was validated against actual package manifests and installed `node_modules` across the three runtime tiers:

```
+----------------------------------------------------------------------------------------------------+
| RUNTIME ECOSYSTEM          | TOTAL RUNTIME DEPS | NOTICES COVERAGE STATUS | REMAINING RISK / GAP   |
+----------------------------+--------------------+-------------------------+------------------------+
| Client Production Bundle   | 49 direct packages | 100% Covered            | None (All notices      |
|                            | (171 unique total) | Full notice text added  | verified in manifest)  |
+----------------------------+--------------------+-------------------------+------------------------+
| Server Node.js Runtime     | 23 direct packages | 100% Covered            | None (All packages     |
|                            | (282 unique total) | Full notice text added  | verified as permissive)|
+----------------------------+--------------------+-------------------------+------------------------+
| Recommendation Microservice| 7 direct packages  | 100% Covered            | None (Python runtime   |
|                            | (FastAPI service)  | Full notice text added  | strictly permissive)   |
+----------------------------+--------------------+-------------------------+------------------------+
| Build-Time & Transitive    | lightningcss,      | Documented in Section 4 | None (Build-time only; |
|                            | dompurify          | of THIRD_PARTY_NOTICES  | not bundled at runtime)|
+----------------------------+--------------------+-------------------------+------------------------+
| Vector Illustrations       | unDraw SVGs (2)    | Documented in Section 7 | None (unDraw license   |
|                            |                    | of THIRD_PARTY_NOTICES  | confirmed)             |
+----------------------------+--------------------+-------------------------+------------------------+
```

---

## 3. Reassessment of Critical Licensing Findings

### 3.1 GSAP Commercial-Use & Plugin Terms
- **Version:** `gsap@3.12.7` locked in [`client/package-lock.json`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/package-lock.json).
- **Usage:** [`GreetingAnimation.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/GreetingAnimation/GreetingAnimation.jsx#L2-L5) (`TextPlugin`) and [`Home.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/Home.jsx#L2-L23) (`ScrollTrigger`). Both are standard public plugins; no members-only Club GreenSock plugins are used.
- **License Terms:** The updated **Webflow Standard "No Charge" GSAP License** (`https://gsap.com/standard-license`) grants a worldwide, no-charge commercial license for websites, web applications, and digital interfaces. The only restriction prohibits using GSAP in no-code visual animation builders that compete with Webflow.
- **Verdict:** **`PASS`**. AuctionX is an auction marketplace, not a visual animation builder. Use is completely free without a club membership.

### 3.2 Font Awesome Free Multi-Licensing
- **Version:** `@fortawesome/fontawesome-free@6.7.2`.
- **Tripartite Terms:**
  - Icons are licensed under **Creative Commons Attribution 4.0 (CC BY 4.0)**.
  - Web & desktop fonts are licensed under **SIL Open Font License 1.1 (SIL OFL 1.1)** with Reserved Font Name "Font Awesome".
  - Code (CSS/JS) is licensed under **MIT**.
  - Brand icons carry trademark restrictions.
- **Notice Status:** Fully preserved and documented in Section 3.4 of `THIRD_PARTY_NOTICES.md`.

### 3.3 React Icons & Game Icons CC BY 3.0 Attribution
- **Version:** `react-icons@5.4.0`.
- **Subsets Used:** Font Awesome 5 (CC BY 4.0), Material Design (Apache-2.0), Ionicons (MIT), IcoMoon Free (CC BY 4.0), Remix Icon (Apache-2.0), BoxIcons (MIT), and **Game Icons (CC BY 3.0)** (`GiSandsOfTime` in `ProductList7.jsx` and `ProductList9.jsx`).
- **Notice Status:** Required attribution for Game Icons (*"Icons made by Delapouite and Lorc from https://game-icons.net, licensed under CC BY 3.0"*) has been explicitly included in Section 3.5 of `THIRD_PARTY_NOTICES.md`.

### 3.4 Geodata Clean Provenance
- **Version:** `country-region-data@4.1.0`.
- **Provenance:** MIT License, Copyright (c) 2022 Benjamin Keen. Replaced the former GPL-3.0 geodata package in Stage 7.10. 100% clean of copyleft obligations.

### 3.5 Build-Time & Transitive Dependencies
- **`lightningcss@1.29.1` (MPL-2.0):** Rust-based CSS engine used by `@tailwindcss/vite` during compilation. Not distributed in the browser JavaScript bundle.
- **`dompurify@3.2.4`:** Dual-licensed under `MPL-2.0 OR Apache-2.0`. Accepted and attributed under `Apache-2.0`.

---

## 4. Non-Code Asset-Rights Audit Summary & Blockers

The audit in [`docs/audits/Audit-066-Asset-Rights-And-Media-Inventory.md`](Audit-066-Asset-Rights-And-Media-Inventory.md) evaluated all 56 static image, vector, and animation files across the repository:

```
+----------------------------------------------------------------------------------------------------+
| ASSET CATEGORY              | FILES AUDITED                    | RIGHTS STATUS & RISK LEVEL        |
+-----------------------------+----------------------------------+-----------------------------------+
| Celebrity Demo Photographs  | AuctionXMessi.jpg,               | BLOCKED — RIGHTS UNVERIFIED       |
| (Banner2/)                  | AuctionXRonaldo.jpg,             | HIGH RISK: Right of publicity and |
|                             | AuctionXVirat.jpg, etc. (9 total)| copyright infringement liability. |
|                             |                                  | MUST REPLACE BEFORE PUBLIC RELEASE|
+-----------------------------+----------------------------------+-----------------------------------+
| Team Personal Likenesses    | OmSardar.jpg, KunalSarkar.jpg,   | PROPRIETARY PERSONAL LIKENESS     |
| (AboutUs/)                  | SouravKhanra.jpg,                | LOW RISK: Legitimate team avatars.|
|                             | SubhoSamanta.jpg (4 total)       | Excluded from third-party license.|
+-----------------------------+----------------------------------+-----------------------------------+
| Payment & Social Trademarks | Gpay.png, PhonePe.png,           | NOMINATIVE TRADEMARK FAIR USE     |
| (Payment/ & Layouts/)       | github-logo.png, twitter.png, etc| LOW RISK: Nominative disclaimers  |
|                             |                                  | established in THIRD_PARTY_NOTICES|
+-----------------------------+----------------------------------+-----------------------------------+
| Vector Graphics             | log.svg ("maker launch"),        | VERIFIED UNRESTRICTED             |
| (Pages/Login/)              | register.svg ("press play")      | ZERO RISK: unDraw Open License    |
+-----------------------------+----------------------------------+-----------------------------------+
| Unreferenced Orphaned Media | SlideDeisgn/ (9 images),         | CANDIDATE FOR CLEANUP PRUNING     |
|                             | Footer/slideLogo-* (9 images)    | 0 JSX imports; recommend deletion |
+-----------------------------+----------------------------------+-----------------------------------+
```

---

## 5. Active Release Blockers (Must Remain Unbypassed)

Public repository release remains strictly blocked until the following six gates are resolved:

```
+----------------------------------------------------------------------------------------------------+
| RELEASE BLOCKER AREA        | CURRENT REPOSITORY STATE         | REQUIRED RESOLUTION GATE          |
+-----------------------------+----------------------------------+-----------------------------------+
| 1. Root LICENSE & README    | Root LICENSE is untracked MIT    | Owner must approve Stage 7.14A    |
|    Contradictions           | (?? LICENSE); README displays    | checklist and authorize           |
|                             | MIT badge & text.                | overwriting with proprietary text.|
+-----------------------------+----------------------------------+-----------------------------------+
| 2. Contributor Policy & CLA | CONTRIBUTING.md and CLA do not   | Owner must approve inbound CLA and|
|    Adoption                 | exist at repository root.        | assent mechanism (PR checkbox).   |
+-----------------------------+----------------------------------+-----------------------------------+
| 3. Celebrity Demo Graphics  | 5 celebrity photos imported in   | Replace imported photos with      |
|    in Banner4.jsx           | Banner4.jsx; 4 unreferenced.     | royalty-free synthetic artwork.   |
+-----------------------------+----------------------------------+-----------------------------------+
| 4. Security Disclosure      | SECURITY.md absent; security     | Owner must designate private      |
|    Channel                  | email unpopulated.               | security disclosure email address.|
+-----------------------------+----------------------------------+-----------------------------------+
| 5. Manifest Licensing Align | server/package.json declares ISC;| Update manifests to UNLICENSED    |
|                             | client/ omits license field.     | and private: true atomically.     |
+-----------------------------+----------------------------------+-----------------------------------+
| 6. Staging Cloud Execution  | Docker daemon offline locally;   | Verify container startup, Render  |
|    & Infrastructure         | Render private DNS unverified;   | proxy buffer, and Atlas replica   |
|                             | Atlas replica set unverified.    | set on cloud staging environment. |
+-----------------------------+----------------------------------+-----------------------------------+
```

---

## 6. Verification and Git State Invariants

### 6.1 `git diff --check`
Running `git diff --check` across the repository confirms zero trailing whitespace errors or formatting regressions.

### 6.2 `git status --short` Audit
A thorough inspection of the Git working tree confirms:
- The **27 staged documentation renames** are 100% intact in the Git index.
- Root [`LICENSE`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/LICENSE) remains the pre-existing untracked file (`?? LICENSE`).
- Pre-existing tracked modifications in client, server, docker compose, and CI configurations remain untouched.
- The three documentation deliverables created in this stage appear cleanly as untracked files:
  - `?? docs/licenses/THIRD_PARTY_NOTICES.md`
  - `?? docs/audits/Audit-066-Asset-Rights-And-Media-Inventory.md`
  - `?? docs/audits/Audit-067-Third-Party-Notices-And-Asset-Rights.md`

---

## 7. Recommended Next Safe Steps

With third-party notices compiled and non-code assets cataloged, the project is ready for the owner decision gate:

1. **Owner Decision Review:** Review and complete the 5 factual items from [Stage 7.14A Section 5.1](Audit-064-Proprietary-License-And-CLA-Risk-Review.md#51-factual-decisions-required-from-owner):
   - Copyright Holder Legal Entity Name
   - Copyright Year Span (`2026` or `2024–2026`)
   - Dedicated Private Security Contact Email
   - Governing Jurisdiction and Forum
   - Contributor License Agreement Assent Model
2. **Celebrity Demo Asset Remediation (Stage 7.16):** Generate or import 5 royalty-free synthetic collectible illustrations for `Banner4.jsx` and prune the 4 unreferenced celebrity files.
3. **Atomic Licensing Application (Stage 7.17):** Once authorized by the owner, atomically apply the proprietary license to root `LICENSE`, update `README.md`, set package manifests to `"license": "UNLICENSED"`, and establish root `CONTRIBUTING.md` and `SECURITY.md`.
