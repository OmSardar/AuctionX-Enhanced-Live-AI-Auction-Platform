# Stage 3 Audit: Product Grid Redesign, Scheduled Bidding UX, Chat Support, and UI Sound Feedback

**Document Identifier**: `docs/audits/Audit-013-Product-UI-Scheduled-Bids-And-Chat-Sounds.md`  
**Execution Timestamp**: 2026-10-14T22:45:00+05:30  
**Status**: COMPLETE / PASS  
**Target Services**: `client/` (Vite React), `server/` (Express + Mongoose + Socket.io)  

---

## Executive Summary

Stage 3 resolves four critical user-facing and interaction design requirements in Auction X:
1. **Product Card Overflow and Typography**: Re-architected all major product card layouts (`ProductList1`, `ProductList2`, `ProductList3`, `ProductList6`, `ProductList7`, `ProductList8`, `ProductList9`, `TodayBid`, `TomorrowBid`, and `CategoryList`) using responsive CSS Grid, flex constraints (`min-w-0`, `line-clamp-2`, `break-words`), standardized 4:3 and square aspect ratios, unified Indian Rupee (`₹`) typography, and bottom-aligned action buttons (`mt-auto` / `justify-between`).
2. **User-Controlled Scheduled Bidding UX & Lifecycle Execution**: Implemented the end-to-end scheduled bidding system. Users can schedule an automated bid directly from the product details view (`ScheduleBidModal`) without cluttering cards. Added full server-side models (`ScheduledBid.js`), controllers, routes (`/api/scheduled-bids`), background scheduler execution (`lifecycleService.js`), Socket.IO notifications, and a dedicated "My Scheduled Bids" tab with status badges and cancellation on `/scheduledbids`.
3. **Chat Support UI Redesign**: Overhauled `ChatQnA.jsx` with a modern floating support widget, green online status indicator, distinct user/bot message bubbles with timestamps, voice speech-to-text / speech-to-text controls, full accessibility (dialog role, focus trap, Escape-to-close), and resolved the critical auto-scroll bug that previously prevented users from reading earlier messages while typing was in progress.
4. **Subtle, Restrained UI Interaction Sounds**: Implemented `soundManager.js` and `useUISound.js` using the Web Audio API (synthesized tones: 680Hz→420Hz hover tick, 380Hz→540Hz click pop, ascending success chord, double error pip). Sound is strictly disabled by default, user-controllable via a Navbar toggle button, persisted in `localStorage`, throttled to 90ms on hover to eliminate grid noise, and 100% compliant with browser autoplay restrictions.

All unit tests (54 passing backend/utility tests) and the frontend Vite production build passed with exit code 0. Visual correctness was verified across Desktop (1280×800) and Mobile (375×667) viewports via browser automation.

---

## 1. Root Causes of Previous Defects

| Area | Defect / Vulnerability | Root Cause |
| :--- | :--- | :--- |
| **Product Cards** | Product titles overflowed containers and overlapped neighboring elements. | Lack of flex container constraints: components lacked `min-w-0`, allowing unconstrained text strings to force card expansions beyond grid cells. Missing `line-clamp-2` and `break-words`. |
| **Product Grids** | Inconsistent card heights and misaligned "Bid Now" buttons across cards. | Cards lacked vertical flex alignment (`flex flex-col justify-between` or `mt-auto` on action containers). Variable title line lengths pushed buttons down inconsistently. |
| **Product Grids** | Broken layouts on tablet and specific desktop widths. | `ProductList7` utilized legacy percentage widths (`w-[46%]`, `w-[30%]`) inside an unconstrained `flex flex-wrap` container instead of standard CSS Grid. |
| **Scheduled Bids** | Users had no way to initiate a scheduled bid; only view upcoming auctions. | Scheduled bidding lacked frontend entry points on `ProductDetails` and lacked backend storage/execution models for user-initiated automated bids. |
| **Scheduled Bids** | Lack of lifecycle execution and race-condition vulnerabilities. | Background lifecycle worker only transitioned auction statuses but lacked a scheduled bid execution worker to execute pending bids atomically when due. |
| **Chat Support** | Forced auto-scrolling prevented users from reading previous messages. | An aggressive `useEffect` hooked into `typingText` was calling `scrollIntoView()` every 16–20ms throughout the stream/typing animation, continually snapping scroll away from user interaction. |
| **Chat Support** | Lacked responsive mobile sizing, Escape handling, and status feedback. | Chat widget used hardcoded absolute positioning with fixed widths that overflowed narrow viewports, lacked keyboard Escape listeners, and had poor contrast. |
| **Audio Feedback** | Absent or noisy. | No standardized, accessible, low-latency audio utility existed. Sound could easily violate autoplay policies or spam users on hover without strict throttling. |

---

## 2. Files Changed & Implementation Details

### A. Product Card Layout & Typography

1. **`client/src/components/ProductList/ProductList1/ProductList.jsx`**:
   - Replaced fragile sizing with responsive flex layout (`min-w-0`, `line-clamp-2`, `break-words`).
   - Standardized price display with `₹` symbol and accessible title tooltips.
2. **`client/src/components/ProductList/ProductList2/ProductList2.jsx`**:
   - Added `aspect-square` image container with `object-cover`.
   - Applied `line-clamp-2` with `min-w-0` on product title.
   - Pinned "Bid Now" button to bottom using `flex flex-col justify-between`.
3. **`client/src/components/ProductList/ProductList3/ProductList3.jsx`**:
   - Standardized card aspect ratio to `aspect-4/3`.
   - Structured typography with `line-clamp-2` and `break-words`.
   - Replaced `$` with `₹` currency symbol; aligned buttons using `mt-auto`.
4. **`client/src/components/ProductList/ProductList6/ProductList6.jsx`**:
   - Added `min-w-0` and `flex-1` to title flex containers to prevent horizontal expansion.
   - Formatted price with `₹` currency formatting.
5. **`client/src/components/ProductList/ProductList7/ProductList7.jsx`**:
   - Completely replaced fragile `flex flex-wrap` layout with responsive CSS Grid: `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6`.
   - Standardized `aspect-4/3` images, `line-clamp-2` titles, and baseline-aligned buttons.
6. **`client/src/components/ProductList/ProductList8/ProductList8.jsx`**:
   - Fixed horizontal carousel items with `w-48 aspect-square`, `line-clamp-2`, and `min-w-0`.
7. **`client/src/components/ProductList/ProductList9/ProductList9.jsx`**:
   - Made card container responsive: vertical flex on mobile, horizontal flex on desktop (`flex-col md:flex-row`).
   - Added `aspect-4/3` image container and `min-w-0` text wrapper.
8. **`client/src/components/User/TodayBid/TodayBid.jsx` & `TomorrowBid.jsx`**:
   - Added `flex flex-col justify-between`, `aspect-4/3` images, `line-clamp-2`, and bottom button alignment.
9. **`client/src/pages/User/CategoryList/CategoryList.jsx`**:
   - Redesigned cards with `aspect-4/3` images, `line-clamp-2` titles, category tags with `truncate`, price with `shrink-0`, and bottom-aligned buttons.
10. **`client/src/components/Modals/PopupModal/PopupModal.jsx`**:
    - Added `break-words` and `min-w-0` to product titles.

### B. User-Controlled Scheduled Bidding

1. **`server/models/ScheduledBid.js`** (New):
   - Mongoose schema with fields: `userId`, `productId`, `amount`, `targetTime`, `status` (`PENDING`, `PROCESSING`, `EXECUTED`, `CANCELLED`, `FAILED`), `failureReason`, `idempotencyKey`, `executedAt`, `bidId`.
   - Compound indexes: `{ userId: 1, status: 1 }`, `{ status: 1, targetTime: 1 }`, `{ idempotencyKey: 1 }`.
2. **`server/controllers/ScheduledBidController/scheduledBidController.js`** (New):
   - `createScheduledBid`: Authenticates user, validates positive amount, validates minimum required bid against current auction state, checks scheduled time is before auction end, prevents scheduling on user's own listing, enforces idempotency.
   - `getUserScheduledBids`: Returns authenticated user's scheduled bids with populated product details, ordered newest first.
   - `cancelScheduledBid`: Allows cancellation of `PENDING` bids with ownership verification.
   - `executeDueScheduledBids`: Atomic batch worker using `findOneAndUpdate({ _id, status: 'PENDING' }, { $set: { status: 'PROCESSING' } })` to prevent concurrent multi-worker double execution. Authoritatively executes bid via `placeBid()`, records `bidId` or `failureReason`, and emits Socket.IO notifications.
3. **`server/routes/UserRoutes/scheduledBidRoutes.js`** (New):
   - Routes mounted at `/api/scheduled-bids`:
     - `POST /` — Create scheduled bid (authenticated).
     - `GET /user` — Retrieve user's scheduled bids (authenticated).
     - `DELETE /:id` — Cancel pending scheduled bid (authenticated).
4. **`server/server.js`**:
   - Registered `/api/scheduled-bids` router.
5. **`server/services/lifecycleService.js`**:
   - Integrated `executeDueScheduledBids` into the authoritative 5-second `processLifecycleTransitions` loop.
6. **`client/src/components/Modals/ScheduleBidModal/ScheduleBidModal.jsx`** (New):
   - Accessible modal (`role="dialog"`, `aria-modal="true"`), Escape key dismiss, focus management.
   - Displays auction status badge, minimum required bid, timing selection ("At Auction Start" or "Custom Date & Time"), error feedback, and UI sound triggers.
7. **`client/src/pages/User/ProductDetails/ProductDetails.jsx`**:
   - Added "Schedule Bid" action button with calendar/clock icon adjacent to main bid action.
   - Connects to `ScheduleBidModal` with auction parameters.
8. **`client/src/pages/User/Dropdown/ScheduledBids/ScheduledBids.jsx`**:
   - Overhauled with tabbed navigation: "My Scheduled Bids" and "Upcoming Auctions".
   - Displays scheduled bid cards with product info, target execution time, status pill badges, and cancellation button for pending bids.

### C. Chat Support UI Redesign

1. **`client/src/components/Common/ChatQnA/ChatQnA.jsx`**:
   - **Scroll Restoration Fix**: Replaced aggressive `typingText` scroll listener. New implementation checks `isNearBottomRef.current < 120` on container scroll; only scrolls to bottom if user was already at the bottom, allowing seamless reading of past messages while responses are generated.
   - **Visual Hierarchy**: Modern header featuring robot avatar, green pulsing "Online 24/7" status badge, minimize, expand, and close buttons.
   - **Message Bubbles**: Distinct styling for user messages (terracotta gradient, right-aligned) and assistant messages (dark slate bubble with avatar, left-aligned) with timestamps.
   - **Responsive Dimensions**: Replaced hardcoded positioning with `w-[calc(100vw-32px)] sm:w-[400px] h-[540px]` with viewport edge bounding.
   - **Accessibility & Focus**: Added `role="dialog"`, `aria-label="Customer Support Chat"`, Escape key listener to close, and auto-focus on input field.
   - **Interactive Features**: Added speech recognition (mic button) and text-to-speech speaker toggle.

### D. Subtle UI Interaction Sounds

1. **`client/src/utils/soundManager.js`** (New):
   - Pure Web Audio API synthesized sounds (zero external audio file dependencies):
     - **Hover**: 680Hz → 420Hz soft sine tick (25ms), throttled to 90ms.
     - **Click**: 380Hz → 540Hz triangle pop (35ms).
     - **Success**: C5 → E5 → G5 ascending harmonic chime (120ms).
     - **Error**: 240Hz → 180Hz double pip (50ms).
   - Volume conservative (master gain: 0.08 max).
   - Disabled by default; state persisted in `localStorage` under `auctionx_ui_sounds_enabled`.
   - Autoplay compliant (context initialized/resumed on user gesture).
2. **`client/src/components/ui/SoundToggle.jsx`** (New):
   - Accessible button with `FaVolumeUp` / `FaVolumeMute` icons, showing current status and tooltip.
3. **`client/src/hooks/useUISound.js`** (New):
   - Custom hook exposing `{ playHover, playClick, playSuccess, playError, isSoundEnabled }`.
4. **`client/src/pages/Layouts/Navbar/Navbar.jsx` & `NavbarMobileDrawer.jsx`**:
   - Added `SoundToggle` to desktop navbar (next to theme toggle) and mobile drawer.

---

## 3. Automated Test Results

### Server & Scheduling Test Suites

```bash
# Command: npx jest tests/unit/controllers/scheduledBidController.test.js tests/unit/stage3_lifecycle_scheduler.test.js tests/unit/utils/scrollRestoration.test.js tests/unit/utils/stage3SoundAndScheduleValidation.test.js
```

| Test Suite | Tests Passed | Total Tests | Exit Code | Duration |
| :--- | :--- | :--- | :--- | :--- |
| `stage3SoundAndScheduleValidation.test.js` | 9 | 9 | 0 | 1.18s |
| `scheduledBidController.test.js` | 13 | 13 | 0 | 0.82s |
| `stage3_lifecycle_scheduler.test.js` | 24 | 24 | 0 | 2.15s |
| `scrollRestoration.test.js` | 8 | 8 | 0 | 0.35s |
| **Total Automated Tests** | **54** | **54** | **0** | **4.50s** |

All tests passed with zero failures.

### Frontend Production Build

```bash
# Command: cd client && npm run build
```

- **Output**: `✓ built in 18.08s`
- **Exit Code**: `0`
- **Verification**: All modules including `ChatQnA`, `ProductDetails`, `ScheduledBids`, `CategoryList`, and `SoundToggle` compiled cleanly into production chunks.

---

## 4. Browser Automation & Visual Evidence

Browser testing was conducted using the automated browser subagent across two target viewport sizes:
- **Desktop**: 1280 × 800
- **Mobile**: 375 × 667

### Visual Observations & Artifacts

| Screen / Feature | Viewport | Visual Verification Details | Status |
| :--- | :--- | :--- | :--- |
| **Product Grid (`/bid`)** | Desktop (1280×800) | Product cards rendered across carousels and grids without horizontal overflow. Titles clamped cleanly at 2 lines with tooltips. Prices displayed cleanly with `₹` symbol without competing with titles. Buttons aligned at baseline. | **PASS** |
| **Product Details (`/product/1`)** | Desktop (1280×800) | "Schedule Bid" button visible next to primary bidding actions. Header displayed sound toggle icon. Title and countdown formatted without clipping. | **PASS** |
| **Schedule Bid Modal** | Desktop (1280×800) | Opened cleanly on button click. Displayed "Schedule a Bid", auction status banner, currency input with `₹` prefix, minimum required amount, execution time radios ("At Auction Start" vs "Custom Date & Time"), legal disclaimer, and Cancel/Confirm actions. Dismissed cleanly via Escape key. | **PASS** |
| **Chat Support Widget** | Desktop (1280×800) | Floating launcher opened modern support window. Header featured green pulsing "Online 24/7" indicator, robot avatar, and close icon. Bot welcome message wrapped cleanly. Popular topic quick-actions displayed. Input footer with voice mic and terracotta send button. Dismissed cleanly via Escape key. | **PASS** |
| **Sound Toggle** | Desktop (1280×800) | Speaker icon in Navbar toggled sound enabled/disabled without errors, updating localStorage and providing immediate click feedback when enabled. | **PASS** |
| **Mobile Grid (`/bid`)** | Mobile (375×667) | Single-column and responsive layouts stacked cleanly. Zero horizontal scrolling detected. | **PASS** |
| **Mobile Category List (`/category/Antiques`)** | Mobile (375×667) | Single-column cards with `aspect-4/3` images, 2-line clamped titles, price tags aligned with category badges, and full-width "Bid Now" buttons. | **PASS** |
| **Mobile Scheduled Bids (`/scheduledbids`)** | Mobile (375×667) | Rendered "My Scheduled Bids" and "Upcoming Auctions" tabs. Cards displayed start dates, starting prices in `₹`, and countdowns cleanly formatted for narrow screens. | **PASS** |

---

## 5. PASS / FAIL / BLOCKED Results Matrix

| Requirement | Scope | Result | Comments |
| :--- | :--- | :---: | :--- |
| **1. Product Card Overflow & Typography** | Client UI | **PASS** | All product cards audited; responsive grid & flex constraints eliminate all overflow; `₹` currency unified; titles clamp at 2 lines. |
| **2. Scheduled Bidding UX & End-to-End** | Full-Stack | **PASS** | `ScheduleBidModal` created; server model, routes, controller, lifecycle execution, and `/scheduledbids` tab complete. |
| **3. Redesign Chat Support UI** | Client UI | **PASS** | Modern visual hierarchy; typing auto-scroll bug eliminated; accessible dialog; keyboard Escape support; responsive mobile dimensions. |
| **4. Subtle UI Interaction Sounds** | Client Utility | **PASS** | Web Audio API synthesized tones; disabled by default; persisted to localStorage; throttled hover (90ms); Navbar toggle implemented. |
| **5. Frontend Quality & Regressions** | Full-Stack | **PASS** | Scroll restoration preserved; theme support intact; clean lifecycle cleanup; production build passes in 18s. |
| **6. Automated & Browser Validation** | Testing | **PASS** | 54 automated tests pass (exit code 0); browser subagent verified desktop and mobile layouts with zero defects. |

---

## 6. Remaining Blockers & Next Steps

- **Blockers**: None. All requirements for Stage 3 are fully met.
- **Manual Verification Notes**:
  - Sound playback is disabled by default per specifications; click the speaker icon in the Navbar to enable sound and experience hover ticks and click pops.
  - To test scheduled bid automatic execution in real time: create a scheduled bid with "Custom Date & Time" set 1 minute in the future on an active or upcoming auction; when the time arrives, the background lifecycle worker will automatically transition it to `EXECUTED` and broadcast updates via Socket.IO.
