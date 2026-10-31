# Auction X — Design System & Visual Specification

**Version**: 1.0.0 (Phase 1: Design Foundations)  
**Status**: Active  
**Author**: Principal Frontend Architect & Design Systems Lead  
**Last Updated**: 2026-10-12  

---

## 1. Visual Direction & Brand Philosophy

Auction X is a high-performance, real-time auction marketplace. Trust, speed, clarity, and scannability are foundational to user confidence during consequential transactions (real-time bidding, payments, seller asset management).

### Design Principles

1. **Information Hierarchy First**: In an auction environment, time remaining, current high bid, reserve status, and primary action must be instantly identifiable within 200ms of scanning any card or detail page.
2. **Restraint Over Decoration**: Eliminate arbitrary gradients, heavy drop shadows, inconsistent rounded corners, and gratuitous glassmorphism that degrade information readability.
3. **Domain-Specific Color Semantics**: Distinct, predictable color coding for auction states:
   - **Active / Live Auction**: Vivid Emerald (`--color-auction-live`) with subtle pulse.
   - **Ending Soon / Urgency**: Urgent Coral/Red (`--color-auction-ending`) for auctions concluding in < 15 minutes.
   - **Reserve Met**: Deep Teal (`--color-auction-reserve`).
   - **Outbid**: Soft Rose/Red (`--color-bid-outbid`).
   - **Closed / Settled**: Slate Neutral (`--color-auction-closed`).
4. **Numeric Stability**: Jitter-free countdown clocks, price increments, and data tables through forced tabular figures (`font-variant-numeric: tabular-nums`).
5. **Universal Dark Mode Parity**: Every component, surface, border, and status badge provides equal contrast and visual clarity in both Light and Dark themes.

---

## 2. Token Architecture & Organization

Tokens are arranged in three tiers:

```
[Tier 1: Global Primitive Tokens]  (Raw hex values, scales: Gray, Blue, Red, Green, etc.)
               │
               ▼
[Tier 2: Semantic System Tokens]   (Contextual aliases: surface, text-primary, border-subtle)
               │
               ▼
[Tier 3: Domain & Component Tokens] (auction-live, bid-winning, btn-primary, card-surface)
```

The system lives in modular stylesheets under `client/src/styles/`:
- `styles/tokens.css` — Tailwind `@theme` configuration, typography scale, radii, elevation, and palette definitions.
- `styles/themes.css` — Semantic CSS variables for `:root` (light) and `.dark` (dark), with layout base resets.
- `styles/utilities.css` — Shared domain patterns (tabular figures, auction badges, live pulse, card surfaces, focus rings).

---

## 3. Color Tokens

### 3.1 Foundational Primitives

| Primitive Token | Value | Role |
|---|---|---|
| `--color-white` / `bg-white` / `text-white` | `#FFFFFF` | Absolute white base; essential for Chart.js tooltips, contrast overlays |
| `--color-black` / `bg-black` / `text-black` | `#000000` | Absolute black base; backdrop alpha masks, dark high-contrast layers |

### 3.2 Surface & Background Tokens

| Semantic Token | Tailwind Class / CSS Var | Light Mode | Dark Mode | Usage & When to Use |
|---|---|---|---|---|
| Canvas Background | `bg-canvas` / `var(--color-bg-canvas)` | `#F8FAFC` (Slate-50) | `#0B0F19` (Obsidian Navy) | Global page background canvas. Use on layouts and root page wrappers instead of `#191919`. |
| Surface Card | `bg-surface` / `var(--color-bg-surface)` | `#FFFFFF` | `#111827` (Gray-900) | Default cards, panels, list items, dropdown lists. Replaces hardcoded `#303030`. |
| Raised Surface | `bg-surface-raised` / `var(--color-bg-surface-raised)` | `#FFFFFF` | `#1F2937` (Gray-800) | Floating dialogs, modals, popovers, elevated headers. Replaces `#404040`. |
| Subtle Surface | `bg-surface-subtle` / `var(--color-bg-surface-subtle)` | `#F1F5F9` (Slate-100) | `#162032` (Navy subtle) | Form input backgrounds, table headers, timer backdrops. Replaces `#505050`. |
| Overlay Backdrop | `bg-surface-overlay` / `var(--color-bg-surface-overlay)` | `rgba(15,23,42,0.60)` | `rgba(0,0,0,0.75)` | Modal and drawer backdrop overlays. |

### 3.3 Text & Typography Tokens

| Semantic Token | Tailwind Class / CSS Var | Light Mode | Dark Mode | Contrast | Usage |
|---|---|---|---|---|---|
| Text Primary | `text-foreground` / `var(--color-text-primary)` | `#0F172A` (Slate-900) | `#F8FAFC` (Slate-50) | > 15:1 (AAA) | Headings, primary body text, titles. |
| Text Secondary | `text-foreground-secondary` / `var(--color-text-secondary)` | `#475569` (Slate-600) | `#94A3B8` (Slate-400) | > 5.5:1 (AA) | Descriptions, labels, secondary metadata. |
| Text Muted | `text-foreground-muted` / `var(--color-text-muted)` | `#64748B` (Slate-500) | `#64748B` (Slate-500) | > 4.5:1 (AA) | Placeholders, disabled text, captions. |
| Text Inverse | `text-foreground-inverse` / `var(--color-text-inverse)` | `#FFFFFF` | `#0F172A` | AAA | Text on inverted or colored action backgrounds. |

### 3.4 Border & Focus Tokens

| Semantic Token | Tailwind Class / CSS Variable | Light Mode | Dark Mode | Usage |
|---|---|---|---|---|
| Border Subtle | `border-border-subtle` / `var(--color-border-subtle)` | `#E2E8F0` | `#1E293B` | Card dividers, sub-panels, section outlines. |
| Border Default | `border-border-default` / `var(--color-border-default)` | `#CBD5E1` | `#334155` | Input borders, card containers, separators. |
| Border Strong | `border-border-strong` / `var(--color-border-strong)` | `#94A3B8` | `#475569` | Active tab borders, prominent dividers. |
| Focus Ring | `ring-ring-focus` / `var(--color-ring-focus)` | `rgba(37,99,235,0.4)` | `rgba(96,165,250,0.4)` | Focus-visible outlines (2px ring with offset). |

### 3.5 Action Tokens (Interactive Elements)

| Action Category | Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|---|
| **Primary Action** | `bg-action-primary`<br>`hover:bg-action-primary-hover`<br>`active:bg-action-primary-active` | `#2563EB`<br>`#1D4ED8`<br>`#1E40AF` | `#3B82F6`<br>`#60A5FA`<br>`#93C5FD` | Primary call-to-action buttons (Place Bid, Save, Submit). |
| **Secondary Action** | `bg-action-secondary`<br>`hover:bg-action-secondary-hover`<br>`active:bg-action-secondary-active` | `#F1F5F9`<br>`#E2E8F0`<br>`#CBD5E1` | `#1F2937`<br>`#374151`<br>`#4B5563` | Cancel, dismiss, secondary buttons, filters. |
| **Destructive Action** | `bg-action-destructive`<br>`hover:bg-action-destructive-hover`<br>`active:bg-action-destructive-active` | `#DC2626`<br>`#B91C1C`<br>`#991B1B` | `#EF4444`<br>`#F87171`<br>`#FCA5A5` | Delete item, revoke permission, cancel auction. |

### 3.6 Status Tokens (Feedback & Notifications)

| Status | Foreground Token | Background Tint Token | Usage |
|---|---|---|---|
| **Success** | `text-status-success` (`#10B981` / `#34D399`) | `bg-status-success-bg` (`#ECFDF5` / `rgba(52,211,153,0.12)`) | Successful bid, payment verified, item saved. |
| **Warning** | `text-status-warning` (`#F59E0B` / `#FBBF24`) | `bg-status-warning-bg` (`#FFFBEB` / `rgba(251,191,36,0.12)`) | Unverified profile, pending review, expiring warning. |
| **Error** | `text-status-error` (`#EF4444` / `#F87171`) | `bg-status-error-bg` (`#FEF2F2` / `rgba(248,113,113,0.12)`) | Bid failed, validation error, outbid notice. |
| **Info** | `text-status-info` (`#3B82F6` / `#60A5FA`) | `bg-status-info-bg` (`#EFF6FF` / `rgba(96,165,250,0.12)`) | General system notice, tooltip guidance, help tips. |

### 3.7 Contextual Brand & Subsystem Accents

| Subsystem Accent | Token | Light Mode | Dark Mode | Usage & Scope |
|---|---|---|---|---|
| **Marketplace Gold** | `text-brand-gold`<br>`bg-brand-gold`<br>`bg-brand-gold-subtle` | `#F59E0B`<br>`#D97706`<br>`#FEF3C7` | `#FBBF24`<br>`#F59E0B`<br>`rgba(251,191,36,0.15)` | Public marketplace brand accents: hammer logo, VIP badges, featured ribbons. |
| **Dashboard Violet** | `text-dashboard-accent`<br>`bg-dashboard-accent`<br>`bg-dashboard-accent-subtle` | `#8B5CF6`<br>`#7C3AED`<br>`#F5F3FF` | `#A78BFA`<br>`#8B5CF6`<br>`rgba(167,139,250,0.15)` | Admin and Seller portal sidebar active items, analytic chart series 1. |

### 3.8 Chart & Data Visualization Tokens

| Chart Series | Token | Light Mode | Dark Mode | Semantic Role |
|---|---|---|---|---|
| Series 1 | `var(--color-chart-1)` | `#8B5CF6` (Violet) | `#A78BFA` | Primary dashboard metric (Revenue, Volume) |
| Series 2 | `var(--color-chart-2)` | `#0EA5E9` (Sky) | `#38BDF8` | Secondary metric (Visitors, Views) |
| Series 3 | `var(--color-chart-3)` | `#10B981` (Emerald) | `#34D399` | Positive growth / winning bids |
| Series 4 | `var(--color-chart-4)` | `#F59E0B` (Amber) | `#FBBF24` | Moderate alert / pending status |
| Series 5 | `var(--color-chart-5)` | `#EF4444` (Coral) | `#F87171` | Negative trend / dropped bids |
| Series 6 | `var(--color-chart-6)` | `#6366F1` (Indigo) | `#818CF8` | Category segment / tertiary comparison |
| Grid Lines | `var(--color-chart-grid)` | `#E2E8F0` | `rgba(51,65,85,0.6)` | Canvas axis grids |
| Tooltip Background | `var(--color-chart-tooltip-bg)` | `#FFFFFF` | `#1F2937` | Chart tooltip card surface |

### 3.9 Auction Domain Tokens

| Auction State | Foreground Token | Background Tint | Usage |
|---|---|---|---|
| **Live / Active** | `text-auction-live` (`#10B981` / `#34D399`) | `bg-auction-live-bg` (`#ECFDF5` / `rgba(52,211,153,0.12)`) | Real-time active auction badge |
| **Ending Soon** | `text-auction-ending` (`#EF4444` / `#F87171`) | `bg-auction-ending-bg` (`#FEF2F2` / `rgba(248,113,113,0.12)`) | Urgent countdown (<15 min remaining) |
| **Reserve Met** | `text-auction-reserve` (`#0D9488` / `#2DD4BF`) | `bg-auction-reserve-bg` (`#F0FDFA` / `rgba(45,212,191,0.12)`) | Minimum threshold reached badge |
| **Closed / Ended** | `text-auction-closed` (`#6B7280` / `#9CA3AF`) | `bg-auction-closed-bg` (`#F3F4F6` / `rgba(156,163,175,0.12)`) | Concluded auction badge |
| **Highest Bidder** | `text-bid-highest` (`#1E40AF` / `#60A5FA`) | `bg-primary-50` (`rgba(96,165,250,0.12)`) | Current user is winning |
| **Outbid** | `text-bid-outbid` (`#EF4444` / `#F87171`) | `bg-red-50` (`rgba(248,113,113,0.12)`) | Current user has been outbid alert |

---

## 4. Typography Hierarchy

Primary Font: **Inter**, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.

| Token | Size | Line Height | Tracking | Weight | Role |
|---|---|---|---|---|---|
| `text-6xl` | 3.75rem (60px) | 1.15 | -0.025em | 800 | Hero Display Titles |
| `text-5xl` | 3.00rem (48px) | 1.20 | -0.025em | 800 | Landing Page Major Headings |
| `text-4xl` | 2.25rem (36px) | 1.25 | -0.020em | 700 | Page Title (H1) |
| `text-3xl` | 1.875rem (30px) | 1.33 | -0.015em | 700 | Section Title (H2) |
| `text-2xl` | 1.50rem (24px) | 1.33 | -0.010em | 600 | Card Title / Subsection (H3) |
| `text-xl` | 1.25rem (20px) | 1.50 | -0.010em | 600 | Prominent Price / Bid Counter |
| `text-lg` | 1.125rem (18px) | 1.50 | -0.010em | 500 | Lead Body / Stat Value |
| `text-base` | 1.00rem (16px) | 1.50 | -0.010em | 400/500 | Default Body Copy, Form Inputs |
| `text-sm` | 0.875rem (14px) | 1.57 | normal | 400/500 | Secondary Info, Labels, Buttons |
| `text-xs` | 0.75rem (12px) | 1.50 | normal | 500/600 | Badges, Timestamps, Captions |

### Tabular Numerals Requirement
All countdown timers, bid values, currency figures, and stats must specify `tabular-nums` (or class `font-numeric`) to prevent horizontal jitter as digits update in real time:
```html
<span class="tabular-nums font-semibold text-lg text-emerald-600">
  $14,250.00
</span>
```

---

## 5. Spacing, Radii & Elevation

### 5.1 Spacing Scale
The spacing system follows an 8-point modular grid (with 4-point micro step):
- `0.25rem` (4px) — Micro gap between icon and label
- `0.5rem` (8px) — Badge padding, button gap
- `0.75rem` (12px) — Input vertical padding, list item gap
- `1.0rem` (16px) — Card internal padding (mobile), standard margin
- `1.5rem` (24px) — Card internal padding (desktop), grid gutter
- `2.0rem` (32px) — Section vertical spacing
- `3.0rem` (48px) — Major section spacing
- `4.0rem` (64px) — Page hero section padding

### 5.2 Border Radii
- `rounded-xs` (`0.125rem` / 2px) — Micro indicators
- `rounded-sm` (`0.25rem` / 4px) — Checkboxes, small chips
- `rounded-md` (`0.5rem` / 8px) — Buttons, form inputs, dropdown menus
- `rounded-lg` (`0.75rem` / 12px) — Cards, modals, dialog containers
- `rounded-xl` (`1.0rem` / 16px) — Hero banners, featured auction containers
- `rounded-full` (`9999px`) — Avatars, pill status badges, icon buttons

### 5.3 Elevation & Shadows
- `shadow-xs`: Subtle hairline elevation (`0 1px 2px 0 rgb(0 0 0 / 0.05)`)
- `shadow-sm`: Default resting cards
- `shadow-md`: Hovered cards, dropdown popovers
- `shadow-lg`: Sticky navigation, floating modals
- `shadow-xl`: Major dialogs, lightbox galleries

---

## 6. Z-Index Layering Convention

| Layer | Value | Purpose |
|---|---|---|
| `var(--z-base)` | 0 | Page content, cards, layout grids |
| `var(--z-raised)` | 10 | Sticky table headers, elevated cards |
| `var(--z-sticky)` | 100 | Sticky filter bars, page sidebars |
| `var(--z-header)` | 500 | Main site navigation header |
| `var(--z-drawer)` | 600 | Mobile navigation drawers, side panels |
| `var(--z-overlay)` | 700 | Modal and drawer backdrop overlays |
| `var(--z-modal)` | 800 | Modal dialogs, bid confirmation modals |
| `var(--z-popover)` | 900 | Dropdowns, date pickers, select menus |
| `var(--z-toast)` | 1000 | Global toast notifications |
| `var(--z-tooltip)` | 1100 | Tooltips (always above modals/toasts) |

---

## 7. Unified ThemeProvider API

The theme provider is consolidated at `src/app/providers/ThemeProvider.jsx`.

### Usage
```jsx
import { useTheme } from "@/app/providers/ThemeProvider";

export function ThemeSwitcher() {
  const { currentTheme, isDark, toggleTheme, changeCurrentTheme } = useTheme();

  return (
    <button onClick={toggleTheme} aria-label="Toggle theme">
      {isDark ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
```

### Features
1. **Zero Flash**: Injects a temporary `transition: none` override for 50ms during theme toggles to eliminate jarring multi-property CSS transitions.
2. **System Preference Fallback**: Defaults to `window.matchMedia('(prefers-color-scheme: dark)')` when no manual choice is saved in `localStorage`.
3. **100% Backward Compatibility**: Re-exported from both `AdminDashboard/utils/ThemeContext.jsx` and `SellerDashboard/utils/ThemeContext.jsx` with the identical `useThemeProvider` hook signature.
