# Auction X — Global Design-System Consistency Audit Report

**Date:** 2026-10-12
**Status:** AUDIT COMPLETE
**Scope:** Frontend Global Design-System Consistency & Token Unification
**Deliverable:** Architectural Audit, Token Inventory, External Library Analysis & Phased Harmonization Plan
**Target File:** [`\`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/\)
**Reference Documents:**
- [`docs/architecture/frontend-design-system.md`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/docs/architecture/frontend-design-system.md)
- [`\`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/\)
- [`\`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/\)

---

## 1. Executive Summary

This audit assesses visual and color consistency across all subsystems of the Auction X frontend: the **Public Marketplace**, the **Admin Management Dashboard**, the **Seller Portal**, and shared utility views.

### Core Audit Findings:
1. **Strong Architectural Foundation Already in Place:** Phase 1 established a clean three-tier token hierarchy across [`client/src/styles/tokens.css`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/styles/tokens.css), [`themes.css`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/styles/themes.css), and [`utilities.css`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/styles/utilities.css). Phase 2 built accessible UI primitives in [`client/src/components/ui/`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/ui/).
2. **Incomplete Token Surface Mapping (Root Cause of Inconsistencies):** While semantic CSS variables exist in `themes.css`, only 14 semantic tokens are declared in the Tailwind v4 `@theme` block in `tokens.css`. Missing mappings include action tokens (`action-primary`, `action-secondary`), status tokens (`status-success`, `status-error`), and foundational primitives (`--color-white`, `--color-black`). This forced engineers to resort to arbitrary utilities like `bg-[#191919]`, `bg-[#303030]`, and hardcoded `blue-600` or `violet-500`.
3. **Subsystem Accent Fragmentation:**
   - Public Marketplace features Gold/Amber branding (`amber-400`, `amber-500`, `amber-600`).
   - Admin and Seller Dashboards feature Violet accents (`violet-500`, `text-violet-500`, `fill-violet-500`).
   - Shared UI Primitives use Royal Blue (`blue-600`, `blue-700`).
   - Static/FAQ pages use Sky Blue (`sky-400`, `sky-600`).
   - Authentication pages use arbitrary purple/indigo gradients (`from-[#7e22ce] via-[#a855f7] to-[#6366f1]`).
4. **Dark Mode Divergence:**
   - Canonical canvas is `--color-bg-canvas: #0b0f19` (Obsidian Navy).
   - Older pages hardcode pitch black `bg-[#191919]`, `bg-[#303030]`, and `bg-[#404040]` via string ternaries (`currentTheme === 'dark' ? ... : ...`), causing visual jarring and theme flash.
5. **External Library Theme Bypasses:**
   - `sweetalert2`: Bypasses dark theme entirely; requires theme-aware CSS container overrides.
   - `react-toastify`: Imported in 5 files, but `<ToastContainer />` is **not mounted anywhere**, making alerts dead.
   - `react-hot-toast`: Mounted globally as `<Toaster />`, but lacks dark-mode token binding.
   - `chart.js`: Queries missing `--color-white`, resulting in empty string evaluation for light tooltips.
   - `react-phone-number-input`: Uses default unstyled country picker dropdown.
   - `react-day-picker`: Hardcodes `bg-violet-500`.

---

## 2. Existing Design-System Architecture

### 2.1 Styling Pipeline (Tailwind CSS v4 + Vite)

The styling architecture is configured as follows:
- [`client/src/index.css`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/index.css):
  ```css
  @import "tailwindcss";
  @config "../tailwind.config.js";
  @import "./styles/tokens.css";
  @import "./styles/themes.css";
  @import "./styles/utilities.css";
  ```
- **Tailwind Engine:** Tailwind CSS v4.0.8 using `@tailwindcss/vite` and `@tailwindcss/postcss`.
- **Dark Mode Activation:** Class-based (`darkMode: "class"`). Controlled via `document.documentElement.classList.add('dark')`.
- **Early Flash Suppression:** Inline script in `client/index.html` inspects `localStorage.theme === 'dark'` and applies `.dark` before the first frame paints.
- **Runtime Theme Context:** [`ThemeProvider.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/app/providers/ThemeProvider.jsx) synchronizes state, listens to OS preference changes, and suppresses color flashing via a temporary 50ms `transition: none` injection.

### 2.2 Three-Tier Token Architecture

```
[Tier 1: Global Primitive Tokens]  (Raw hex scales: gray-50..950, primary-50..950, violet-50..950)
               │
               ▼
[Tier 2: Semantic System Tokens]   (Theme aliases: canvas, surface, foreground, border-subtle)
               │
               ▼
[Tier 3: Domain & Component Tokens] (auction-live, action-primary, card-surface, tabular-nums)
```

---

## 3. Existing Token Inventory & Missing Categories

### 3.1 Existing Token Inventory

| Category | Defined in `themes.css` | Mapped in `tokens.css` `@theme` | Status |
| :--- | :---: | :---: | :--- |
| **Surfaces** | `--color-bg-canvas`, `--color-bg-surface`, `--color-bg-surface-raised`, `--color-bg-surface-subtle`, `--color-bg-surface-overlay` | `--color-canvas`, `--color-surface`, `--color-surface-raised`, `--color-surface-subtle` | **Available** |
| **Typography** | `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-text-inverse` | `--color-foreground`, `--color-foreground-secondary`, `--color-foreground-muted` | **Available** |
| **Borders** | `--color-border-subtle`, `--color-border-default`, `--color-border-strong`, `--color-ring-focus` | `--color-border-subtle`, `--color-border-default`, `--color-border-strong` | **Available** |
| **Auction Domain** | `--color-auction-live`, `--color-auction-ending`, `--color-auction-reserve`, `--color-auction-closed`, `--color-bid-*` | `--color-auction-live`, `--color-auction-ending`, `--color-auction-reserve`, `--color-auction-closed` | **Available** |
| **Brand Primary Actions** | `--color-action-primary`, `--color-action-primary-hover`, `--color-action-secondary` | **NOT MAPPED** | ⚠️ **Missing in Tailwind `@theme`** |
| **Destructive Actions** | **NOT DEFINED** | **NOT DEFINED** | ⚠️ **Missing entirely** |
| **Semantic Status** | `--color-status-success`, `--color-status-warning`, `--color-status-error`, `--color-status-info` | **NOT MAPPED** | ⚠️ **Missing in Tailwind `@theme`** |
| **Pure White & Black** | **NOT DEFINED** | **NOT DEFINED** | ⚠️ **Breaks Chart.js `getCssVariable`** |
| **Brand Gold / Amber Accent** | Defined only as primitive `--color-yellow-*` | **NOT MAPPED** | ⚠️ **Missing semantic alias** |
| **Chart Series Colors** | **NOT DEFINED** | **NOT DEFINED** | ⚠️ **Charts hardcode ad-hoc palette** |
| **Form Inputs** | Handled via ad-hoc `.form-input` in `utilities.css` | **NOT MAPPED** | ⚠️ **Missing semantic input tokens** |
| **Table Elements** | **NOT DEFINED** | **NOT DEFINED** | ⚠️ **Missing header/hover tokens** |

### 3.2 Impact of Missing Tokens

Because developers lacked utilities such as `bg-action-primary`, `bg-action-destructive`, `text-status-error`, and `border-input`, individual components implemented ad-hoc solutions:
- 266+ arbitrary hex classes (`bg-[#191919]`, `bg-[#303030]`, `bg-[#404040]`, `bg-[#505050]`).
- Hardcoded Tailwind classes (`bg-blue-600`, `text-violet-500`, `text-sky-600`, `bg-amber-500`).
- Divergent hover states (`hover:bg-[#404040]`, `hover:bg-blue-700`, `hover:bg-violet-600`).
- Inline style property queries (`getCssVariable('--color-white')`) failing silently.

---

## 4. Inventory of Inconsistent Styling by Component Category

### Category 1: Buttons and Interactive Triggers (Severity: HIGH)

| Component / File Path | Current Styling | Inconsistency / Conflict | Target Canonical Styling |
| :--- | :--- | :--- | :--- |
| **[`Button.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/ui/Button.jsx)** | `bg-blue-600 hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500` | Hardcodes Tailwind `blue-*` rather than semantic action token. | `bg-action-primary hover:bg-action-primary-hover active:bg-action-primary-active text-white` |
| **[`ProductDetails.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/ProductDetails/ProductDetails.jsx#L744)** | `w-full p-2 border rounded-lg bg-white dark:bg-[#505050] dark:border-gray-600 dark:text-white` | Arbitrary `#505050` dark background; ad-hoc border. | `bg-surface border-border-default text-foreground` |
| **[`CategoryList.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/CategoryList/CategoryList.jsx#L140)** | `bg-blue-600 hover:bg-blue-700 text-white rounded-lg` | Raw button element; bypasses `Button` primitive and token colors. | Shared `Button` primitive variant `"primary"` |
| **[`Home.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/Home.jsx)** | `bg-amber-500 hover:bg-amber-600 text-gray-900 rounded-xl` | Public home CTA uses amber gold; conflicts with blue default. | Intentional brand accent; formalize as `variant="gold"` |
| **[`AdminDashboard`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/AdminDashboard/partials/Header.jsx)** | `btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800` | Inverse monochrome button style unique to dashboard templates. | Formalize as `variant="subtle"` or dashboard utility |
| **[`OtpVerification.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/UserLogin/OtpVerification.jsx#L362)** | `bg-gradient-to-r from-[#7e22ce] via-[#a855f7] to-[#6366f1]` | Arbitrary purple-indigo gradient disconnected from core brand. | Harmonize with canonical brand action or structured gradient token. |

---

### Category 2: Cards, Containers & Surfaces (Severity: HIGH)

| Component / File Path | Current Styling | Inconsistency / Conflict | Target Canonical Styling |
| :--- | :--- | :--- | :--- |
| **[`Card.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/ui/Card.jsx#L5)** | `bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800` | Uses `dark:bg-gray-900` instead of canonical `bg-surface` (`#111827`). | `bg-surface border-border-subtle text-foreground` |
| **[`ProductDetails.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/ProductDetails/ProductDetails.jsx#L403)** | `bg-white dark:bg-[#303030] rounded-lg shadow-lg` | Arbitrary `#303030` dark card background; clashes with `#111827`. | `bg-surface border border-border-subtle rounded-xl shadow-xs` |
| **[`PaymentPage.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/Dropdown/PaymentPage/PaymentPage.jsx#L30)** | `currentTheme === "dark" ? "bg-[#191919]" : "bg-gray-50"` | Manual JS ternary for page canvas; bypasses `bg-canvas`. | `bg-canvas text-foreground` |
| **[`PaymentPage.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/Dropdown/PaymentPage/PaymentPage.jsx#L35)** | `currentTheme === "dark" ? "bg-[#404040]" : "bg-white"` | Arbitrary `#404040` card surface; clashes with dark tokens. | `bg-surface border border-border-subtle` |
| **[`SearchAndPostDetail.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/SearchAndPostDetail/SearchAndPostDetail.jsx#L132)** | `isDarkMode ? "bg-[#303030]" : "bg-white"` | 24+ manual JS ternaries referencing `#303030`, `#505050`, `#191919`. | Unified `bg-surface`, `bg-surface-subtle`, `bg-canvas` |
| **[`OrdersPage.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/Dropdown/OrderHistory/OrdersPage.jsx#L56)** | `bg-gray-50 dark:bg-[#191919]` | Arbitrary `#191919` dark canvas; inconsistent card border. | `bg-canvas text-foreground` |
| **[`PopupModal.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Modals/PopupModal/PopupModal.jsx#L62)** | `bg-white dark:bg-[#191919] p-6 rounded-lg shadow-xl` | Arbitrary `#191919`; timer boxes use `dark:bg-[#303030]`. | `bg-surface-raised border border-border-subtle rounded-xl` |

---

### Category 3: Form Fields & Inputs (Severity: HIGH)

| Component / File Path | Current Styling | Inconsistency / Conflict | Target Canonical Styling |
| :--- | :--- | :--- | :--- |
| **[`Input.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/ui/Input.jsx#L66)** | `bg-white dark:bg-gray-900/60 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700` | Hardcodes Tailwind `gray-*` and `blue-600` focus ring. | `bg-surface text-foreground border-border-default focus:border-action-primary focus:ring-ring-focus` |
| **[`ProductDetails.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/ProductDetails/ProductDetails.jsx#L744)** | `bg-white dark:bg-[#505050] dark:border-gray-600 dark:text-white dark:placeholder-gray-400` | Ad-hoc raw `<input />` with `#505050` dark background. | Use canonical `Input` primitive or `.form-input` |
| **[`NavbarSearch.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/Layouts/Navbar/components/NavbarSearch.jsx#L140)** | `bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-amber-500` | Custom search styling; uses amber focus ring. | Formalize search field with semantic tokens (`bg-surface-subtle`) |
| **[`HelpAndSupportPage.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Layouts/Footer/Help/HelpSupport/HelpAndSupportPage.jsx#L85)** | `bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:ring-gold-500` | Uses ad-hoc `gold-500` focus ring. | Standardize focus tokens (`var(--color-ring-focus)`) |

---

### Category 4: Badges and Status Displays (Severity: MEDIUM)

| Component / File Path | Current Styling | Inconsistency / Conflict | Target Canonical Styling |
| :--- | :--- | :--- | :--- |
| **[`Badge.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/ui/Badge.jsx#L6)** | `bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200` | Hardcodes Tailwind color scales rather than semantic status tokens. | `bg-status-info/10 text-status-info border-status-info/20` |
| **[`Navbar.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/Layouts/Navbar/Navbar.jsx#L159)** | `bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200` | Raw inline span badge for country/region. | Use `Badge` primitive with `variant="warning"` or domain token |
| **[`utilities.css`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/styles/utilities.css#L20)** | `.badge-auction-live`, `.badge-auction-ending`, `.badge-auction-reserve` | Canonical CSS classes exist, but some pages still re-implement ad-hoc pill badges. | Enforce `.badge-auction-*` or `<Badge variant="live" />` |

---

### Category 5: Modals, Dialogs & Dropdowns (Severity: MEDIUM)

| Component / File Path | Current Styling | Inconsistency / Conflict | Target Canonical Styling |
| :--- | :--- | :--- | :--- |
| **[`Dialog.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/ui/Dialog.jsx#L55)** | `bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800` | Uses `dark:bg-gray-900` instead of `bg-surface-raised`. | `bg-surface-raised border-border-subtle text-foreground` |
| **[`Dropdown.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/ui/Dropdown.jsx#L80)** | `bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700` | Uses `dark:bg-gray-800` instead of `bg-surface-raised`. | `bg-surface-raised border-border-subtle shadow-md` |
| **[`PopupModal.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Modals/PopupModal/PopupModal.jsx#L58)** | `backdrop-blur-sm bg-opacity-70` | Missing base backdrop color (opacity without color). | `bg-black/60 backdrop-blur-xs` (matches `Dialog`) |

---

## 5. External Component Libraries: Usage & Theme Integration

Auction X relies on several external packages that render styled UI. Removing or replacing them is neither safe nor necessary. Instead, each can be integrated cleanly through non-invasive theme overrides:

```
┌───────────────────────────────┬───────────────────────────────────┬──────────────────────────────────────────────┐
│ External Component Library    │ Scope of Usage                    │ Least Invasive Integration Strategy          │
├───────────────────────────────┼───────────────────────────────────┼──────────────────────────────────────────────┤
│ 1. Chart.js (v4.4.8)          │ Admin & Seller analytics charts   │ Define missing --color-white; bind tooltips  │
│                               │ (Realtime, Line, Bar, Doughnut)   │ and gridlines to CSS variables in Config.    │
├───────────────────────────────┼───────────────────────────────────┼──────────────────────────────────────────────┤
│ 2. react-day-picker (v9.5.1)  │ Calendar date range selection     │ Retain custom classNames object; replace     │
│                               │ in Admin/Seller DateSelect        │ hardcoded violet with action-primary tokens. │
├───────────────────────────────┼───────────────────────────────────┼──────────────────────────────────────────────┤
│ 3. react-hot-toast (v2.5.2)   │ 11 primary pages & global Toaster │ Configure toastOptions in App.jsx Toaster to │
│                               │ (Navbar, Login, ProductDetails)   │ bind bg-surface, text-foreground, border.    │
├───────────────────────────────┼───────────────────────────────────┼──────────────────────────────────────────────┤
│ 4. react-toastify (v11.0.5)   │ 5 auth & seller pages (unmounted) │ Migrate calls to react-hot-toast; or mount   │
│                               │                                   │ ToastContainer styled with CSS variables.    │
├───────────────────────────────┼───────────────────────────────────┼──────────────────────────────────────────────┤
│ 5. sweetalert2 (v11.22.0)     │ ProductDetails product sold alert │ Add scoped CSS override in utilities.css for │
│                               │                                   │ .dark .swal2-popup using semantic tokens.    │
├───────────────────────────────┼───────────────────────────────────┼──────────────────────────────────────────────┤
│ 6. mdb-react-ui-kit (v9.0.0)  │ FAQ.jsx paper plane MDBIcon only  │ Icon color via text-action-primary; migrate  │
│                               │                                   │ to Lucide Send icon in cleanup cycle.        │
├───────────────────────────────┼───────────────────────────────────┼──────────────────────────────────────────────┤
│ 7. react-phone-number-input   │ VerifySellerProfile, FeedbackForm │ Add scoped CSS overrides in utilities.css    │
│    (v3.4.12)                  │                                   │ for country select & input dark background.  │
├───────────────────────────────┼───────────────────────────────────┼──────────────────────────────────────────────┤
│ 8. @radix-ui/react-popover    │ Headless popovers in dashboard    │ Already headless; update consumer Tailwind   │
│    (v1.1.6)                   │                                   │ classNames to semantic surface tokens.       │
└───────────────────────────────┴───────────────────────────────────┴──────────────────────────────────────────────┘
```

### Detailed Integration Mechanisms

#### 1. Chart.js
- **Mechanism:** Imperative Canvas API configured via [`client/src/lib/chartUtils.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/lib/chartUtils.js) and `ChartjsConfig.jsx`.
- **Correction:** Add `--color-white: #ffffff;` and `--color-black: #000000;` to CSS tokens so `getCssVariable('--color-white')` evaluates correctly. Map chart palette to semantic tokens (`--color-chart-1` through `--color-chart-6`).

#### 2. SweetAlert2
- **Mechanism:** Injects modal DOM at body root with `sweetalert2.min.css`.
- **Correction:** Add scoped CSS rules to [`client/src/styles/utilities.css`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/styles/utilities.css):
  ```css
  .dark .swal2-popup {
    background-color: var(--color-bg-surface-raised) !important;
    color: var(--color-text-primary) !important;
    border: 1px solid var(--color-border-subtle) !important;
  }
  .dark .swal2-title {
    color: var(--color-text-primary) !important;
  }
  .dark .swal2-html-container {
    color: var(--color-text-secondary) !important;
  }
  .dark .swal2-confirm {
    background-color: var(--color-action-primary) !important;
    color: #ffffff !important;
  }
  ```

#### 3. React Hot Toast
- **Mechanism:** React portal rendering customizable toast notifications.
- **Correction:** Update `<Toaster />` in [`client/src/App.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/App.jsx):
  ```jsx
  <Toaster
    position="top-right"
    toastOptions={{
      className: "border text-sm font-medium shadow-md",
      style: {
        background: "var(--color-bg-surface-raised)",
        color: "var(--color-text-primary)",
        borderColor: "var(--color-border-subtle)",
      },
      success: {
        iconTheme: {
          primary: "var(--color-status-success)",
          secondary: "var(--color-bg-surface-raised)",
        },
      },
      error: {
        iconTheme: {
          primary: "var(--color-status-error)",
          secondary: "var(--color-bg-surface-raised)",
        },
      },
    }}
  />
  ```

#### 4. React Phone Number Input
- **Mechanism:** Renders `<input>` and `<select>` with classes defined in `react-phone-number-input/style.css`.
- **Correction:** Add scoped overrides in `utilities.css`:
  ```css
  .dark .PhoneInputCountrySelect {
    background-color: var(--color-bg-surface);
    color: var(--color-text-primary);
  }
  .PhoneInputInput {
    background-color: transparent !important;
    color: var(--color-text-primary) !important;
  }
  ```

---

## 6. Proposed Canonical Color-Token Contract

To achieve full visual consistency without a parallel design system, the existing tokens in [`tokens.css`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/styles/tokens.css) and [`themes.css`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/styles/themes.css) should be expanded to complete the missing Tier 2 and Tier 3 categories:

### 6.1 Complete Semantic Token Specification

```css
/* ==========================================================================
   Proposed Canonical Token Contract Additions
   ========================================================================== */

:root {
  /* Foundational Primitives */
  --color-white: #ffffff;
  --color-black: #000000;

  /* Surfaces */
  --color-bg-canvas: #f8fafc;
  --color-bg-surface: #ffffff;
  --color-bg-surface-raised: #ffffff;
  --color-bg-surface-subtle: #f1f5f9;
  --color-bg-surface-overlay: rgba(15, 23, 42, 0.60);

  /* Typography */
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-text-muted: #64748b;
  --color-text-inverse: #ffffff;

  /* Borders & Focus */
  --color-border-subtle: #e2e8f0;
  --color-border-default: #cbd5e1;
  --color-border-strong: #94a3b8;
  --color-ring-focus: rgba(37, 99, 235, 0.40);

  /* Actions */
  --color-action-primary: #2563eb;
  --color-action-primary-hover: #1d4ed8;
  --color-action-primary-active: #1e40af;
  --color-action-secondary: #f1f5f9;
  --color-action-secondary-hover: #e2e8f0;
  --color-action-destructive: #dc2626;
  --color-action-destructive-hover: #b91c1c;

  /* Status */
  --color-status-success: #10b981;
  --color-status-warning: #f59e0b;
  --color-status-error: #ef4444;
  --color-status-info: #3b82f6;

  /* Domain Accents */
  --color-brand-gold: #f59e0b;
  --color-brand-gold-hover: #d97706;
  --color-dashboard-accent: #8b5cf6;
  --color-dashboard-accent-hover: #7c3aed;

  /* Charts */
  --color-chart-1: #8b5cf6; /* Violet */
  --color-chart-2: #38bdf8; /* Sky */
  --color-chart-3: #22c55e; /* Green */
  --color-chart-4: #f59e0b; /* Amber */
  --color-chart-5: #ef4444; /* Red */
  --color-chart-6: #6366f1; /* Indigo */
  --color-chart-grid: #e2e8f0;
  --color-chart-tooltip-bg: #ffffff;
}

.dark {
  /* Surfaces */
  --color-bg-canvas: #0b0f19;
  --color-bg-surface: #111827;
  --color-bg-surface-raised: #1f2937;
  --color-bg-surface-subtle: #162032;
  --color-bg-surface-overlay: rgba(0, 0, 0, 0.75);

  /* Typography */
  --color-text-primary: #f8fafc;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
  --color-text-inverse: #0f172a;

  /* Borders & Focus */
  --color-border-subtle: #1e293b;
  --color-border-default: #334155;
  --color-border-strong: #475569;
  --color-ring-focus: rgba(96, 165, 250, 0.40);

  /* Actions */
  --color-action-primary: #3b82f6;
  --color-action-primary-hover: #60a5fa;
  --color-action-primary-active: #93c5fd;
  --color-action-secondary: #1f2937;
  --color-action-secondary-hover: #374151;
  --color-action-destructive: #ef4444;
  --color-action-destructive-hover: #f87171;

  /* Status */
  --color-status-success: #34d399;
  --color-status-warning: #fbbf24;
  --color-status-error: #f87171;
  --color-status-info: #60a5fa;

  /* Domain Accents */
  --color-brand-gold: #fbbf24;
  --color-brand-gold-hover: #f59e0b;
  --color-dashboard-accent: #a78bfa;
  --color-dashboard-accent-hover: #8b5cf6;

  /* Charts */
  --color-chart-1: #a78bfa;
  --color-chart-2: #7dd3fc;
  --color-chart-3: #4ade80;
  --color-chart-4: #fbbf24;
  --color-chart-5: #f87171;
  --color-chart-6: #818cf8;
  --color-chart-grid: rgba(51, 65, 85, 0.6);
  --color-chart-tooltip-bg: #1f2937;
}
```

### 6.2 Tailwind v4 `@theme` Block Additions in `tokens.css`

```css
@theme {
  /* Map CSS Variables to Tailwind Utilities */
  --color-white: #ffffff;
  --color-black: #000000;

  --color-canvas: var(--color-bg-canvas);
  --color-surface: var(--color-bg-surface);
  --color-surface-raised: var(--color-bg-surface-raised);
  --color-surface-subtle: var(--color-bg-surface-subtle);

  --color-foreground: var(--color-text-primary);
  --color-foreground-secondary: var(--color-text-secondary);
  --color-foreground-muted: var(--color-text-muted);
  --color-foreground-inverse: var(--color-text-inverse);

  --color-border-subtle: var(--color-border-subtle);
  --color-border-default: var(--color-border-default);
  --color-border-strong: var(--color-border-strong);
  --color-ring-focus: var(--color-ring-focus);

  --color-action-primary: var(--color-action-primary);
  --color-action-primary-hover: var(--color-action-primary-hover);
  --color-action-secondary: var(--color-action-secondary);
  --color-action-secondary-hover: var(--color-action-secondary-hover);
  --color-action-destructive: var(--color-action-destructive);
  --color-action-destructive-hover: var(--color-action-destructive-hover);

  --color-status-success: var(--color-status-success);
  --color-status-warning: var(--color-status-warning);
  --color-status-error: var(--color-status-error);
  --color-status-info: var(--color-status-info);

  --color-gold: var(--color-brand-gold);
  --color-gold-hover: var(--color-brand-gold-hover);
  --color-accent-violet: var(--color-dashboard-accent);
}
```

---

## 7. Risks of Global CSS Overrides & Mitigation Strategy

Global CSS overrides can produce unintended side effects across third-party libraries and deeply nested views. The following table identifies potential hazards and strict mitigation rules:

| Risk Description | Potential Failure Mode | Required Mitigation Rule |
| :--- | :--- | :--- |
| **Overly Broad Base Selector** | Applying `* { border-color: ... }` disrupts elements relying on transparent or inline borders (e.g., SVG icons, Chart.js canvas elements). | Only override borders through utility classes (`border-border-subtle`) or carefully scoped base layers. Never apply blanket `*` resets without specificity locks. |
| **Third-Party Specificity Wars** | Using `!important` on global form elements degrades third-party plugins like `react-phone-number-input` or DatePicker dropdowns. | Scope third-party overrides strictly to library class prefixes (e.g. `.PhoneInputInput`, `.swal2-popup`) inside `utilities.css`. |
| **Theme Flash During Hydration** | Overriding background colors purely in CSS without syncing `index.html` inline script causes a white-to-dark flash on first page load. | Preserve the existing `index.html` `<script>` that adds `.dark` to `<html>` prior to React DOM mounting. |
| **Accidental Invalidation of Intentional Colors** | Replacing intentional status colors (e.g., auction countdown urgency red or live auction emerald) with brand primary. | Keep domain tokens (`--color-auction-live`, `--color-auction-ending`) strictly distinct from action tokens (`--color-action-primary`). |
| **Subsystem Style Leakage** | Applying Admin Dashboard sidebar dark styles to the public navbar or seller portal. | Keep layouts strictly isolated in their respective directories (`layouts/User`, `layouts/Seller`, `layouts/AdminLayout`). |

---

## 8. Safe, Incremental Implementation Plan

To execute this unification safely without regressions or feature loss, the migration must proceed in four structured phases:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 5A: Foundation Token Contract Expansion                               │
│ - Add --color-white, --color-black to themes.css and tokens.css             │
│ - Register action, status, and gold tokens in Tailwind @theme block         │
│ - Verify npm run build (zero breaking changes to existing code)             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 5B: Shared UI Primitives Harmonization                                │
│ - Update Button.jsx, Input.jsx, Card.jsx, Badge.jsx to use semantic tokens  │
│ - Add gold and destructive variants to Button.jsx                           │
│ - Test Button, Input, Card in light and dark themes                          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 5C: External Component Theme Integration                              │
│ - Add scoped overrides for SweetAlert2, PhoneInput in utilities.css         │
│ - Configure Toaster options in App.jsx for react-hot-toast                  │
│ - Migrate 5 react-toastify calls to react-hot-toast                         │
│ - Fix Chart.js getCssVariable('--color-white') evaluation in ChartjsConfig  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 5D: Progressive Page-Level Color Normalization                        │
│ - Batch 1: Public High-Traffic Pages (ProductDetails, SearchAndPostDetail)   │
│ - Batch 2: Account & Order Pages (PaymentPage, OrdersPage, PopupModal)      │
│ - Batch 3: Static & Support Pages (FAQ, HelpSupport, ContactUs)             │
│ - Replace arbitrary #191919/#303030 with bg-canvas / bg-surface             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 5E: Full Regression Verification Gate                                 │
│ - Cross-viewport browser audit (Desktop, Tablet, Mobile)                    │
│ - Light and Dark theme verification                                         │
│ - Production build compilation (npm run build)                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Verification & Repository Integrity Status

### 9.1 Build Verification
- **Command:** `npm run build`
- **Current Exit Code:** `0` (Clean build in 26.83s; 4,624 modules transformed).
- **Core Entry Chunk:** `dist/assets/index-DCOuOz8h.js` (383.95 kB).

### 9.2 Repository Working Tree Status
- **Status:** Clean verification baseline.
- **Git State:** Inspected with `git status --short`. All pre-existing modified files in `client/` and `server/` and all untracked files remain preserved.
- **Packages:** No dependencies were installed, modified, or removed during this audit.

---

*Global Design-System Consistency Audit complete. Stopping here per instructions. Implementation has not been started.*
