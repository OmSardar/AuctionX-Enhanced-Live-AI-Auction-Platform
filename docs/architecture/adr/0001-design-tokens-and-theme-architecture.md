# ADR 0001: Design Tokens Architecture and ThemeProvider Consolidation

**Status**: Accepted  
**Date**: 2026-10-12  
**Deciders**: Principal Frontend Architect, Frontend Engineering Team  
**Scope**: Client Application Styling, Theming, and Token Infrastructure  

---

## 1. Context

During Phase 0 audit of the Auction X frontend, multiple styling and theming fragmentation issues were identified:
1. **Isolated Dashboard Styles**: `AdminDashboard` and `SellerDashboard` maintained isolated, competing CSS files (`adminStyle.css` and `sellerStyle.css`), both redefining color variables and duplicate `@import 'tailwindcss'`. In `App.jsx`, these imports had been commented out due to cascade conflicts, leaving components dependent on undefined or inconsistent styling.
2. **Duplicated ThemeContext**: An identical 53-line `ThemeContext.jsx` file existed in both `AdminDashboard/utils/ThemeContext.jsx` and `SellerDashboard/utils/ThemeContext.jsx`. Despite wrapping the entire application at `src/main.jsx`, the provider was nested deep inside the admin component directory.
3. **Inconsistent Domain Colors**: Auction statuses (Live, Ending Soon, Reserve Met, Closed) and real-time updates lacked centralized semantic tokens, leading to hardcoded hex codes across 10 ProductList variants and individual page templates.
4. **Number Jitter**: Real-time bidding counters, auction timers, and currency prices suffered from proportional-width font jittering when digits changed.

## 2. Decision

We made the following architectural changes in Phase 1 (Design Foundations):

### 2.1 CSS Modular Token System
We introduced a three-tiered stylesheet structure under `src/styles/`:
- `src/styles/tokens.css`: Declares Tailwind v4 `@theme` tokens including font families, type scale (`text-xs` to `text-6xl`), breakpoint `xs (480px)`, elevation shadows, border radii (`radius-xs` to `radius-full`), and color palettes (Gray, Primary/Blue, Violet, Sky, Green, Red, Yellow).
- `src/styles/themes.css`: Defines semantic CSS custom properties in `:root` (light) and `.dark` (dark), mapping design tokens to surface, text, border, status, and auction domain semantics (`--color-auction-live`, `--color-auction-ending`, etc.). Includes base layer normalization for default borders.
- `src/styles/utilities.css`: Provides shared reusable utility classes, including `.tabular-nums` / `font-numeric`, auction badge variants (`.badge-auction-live`, etc.), live pulse indicator (`.pulse-live`), and surface card styles (`.card-surface`).

All three stylesheets are imported into `src/index.css` following `@import "tailwindcss";` and `@config "../tailwind.config.js";`.

### 2.2 Canonical ThemeProvider at Application Layer
We created a single, canonical provider at `src/app/providers/ThemeProvider.jsx`:
- Supports both Light and Dark modes.
- Falls back to `window.matchMedia('(prefers-color-scheme: dark)')` when no manual choice is saved in `localStorage`.
- Injects a 50ms `transition: none` suppressor during theme switching to eliminate visual flashing.
- Updated `src/main.jsx` to wrap the application with this canonical provider.
- Converted both `AdminDashboard/utils/ThemeContext.jsx` and `SellerDashboard/utils/ThemeContext.jsx` to pure re-export wrappers for 100% backward compatibility with all existing imports.

## 3. Alternatives Considered

1. **Keep Separate CSS Files for Dashboards vs User Portal**:
   - *Rejected*: Caused cascade issues, duplicated CSS bundle size by ~80KB, and broke theme synchronization between portals.
2. **Adopting CSS Modules or CSS-in-JS (e.g. styled-components)**:
   - *Rejected*: The codebase already uses Tailwind CSS v4 and standard Vite tooling. Introducing a CSS-in-JS runtime would increase bundle size and runtime overhead without clear benefits.
3. **Breaking Existing Imports to `ThemeContext.jsx` Immediately**:
   - *Rejected*: Would require modifying 35+ components simultaneously in Phase 1, violating the incremental migration principle and increasing regression risk. Re-exporting preserves stability while establishing the clean foundation.

## 4. Consequences & Verification

- **Positive**:
  - Semantic variables now available application-wide for user, seller, and admin screens.
  - Zero regression: All existing imports continue to function seamlessly.
  - Vite production build compiles with exit code 0 (`built in 17.38s`).
  - Dark mode and light mode share identical token names.
  - Auction domain states now have formal color and badge specifications.
- **Negative / Follow-ups**:
  - Legacy components must be incrementally refactored in subsequent phases to consume the new semantic classes and tokens.
