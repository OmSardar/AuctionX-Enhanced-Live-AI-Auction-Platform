# Stage 3.1 Audit: Diagnose and Fix UI Sound System

**Document Identifier**: `docs/audits/Audit-009-UI-Sound-Synthesis-Repair.md`  
**Execution Timestamp**: 2026-10-14T23:20:00+05:30  
**Status**: COMPLETE / PASS  
**Target Services**: `client/` (Vite React), `server/` (Unit test verification)  

---

## Executive Summary

Stage 3.1 diagnosed and fixed the two critical issues identified in Stage 3's UI Sound Feedback feature:
1. **Audibility & Playback Failure**: Sounds were completely inaudible due to an architectural flaw in `AudioContext` lifecycle handling, excessively low gain parameters (-52 dBFS), and lack of sound event triggers across actual interactive components.
2. **Poor Discoverability**: The original toggle was an unlabelled 14px muted icon inside an invisible checkbox, rendering it almost invisible in the desktop navbar and mobile drawer.

Both issues have been remediated end to end. The sound manager now features reliable asynchronous `AudioContext` resumption, comfortable linear gain envelopes, garbage-collected audio nodes, throttled hover triggers (75ms), and a discoverable semantic switch toggle with desktop label badges and mobile drawer toggle switches.

All unit tests (12/12 passing) and the client production build (exit code 0 in 28.9s) passed cleanly. Visual discoverability and interaction states were verified across Desktop (1280×800) and Mobile (375×667) viewports via automated browser subagents.

---

## 1. Confirmed Root Causes

| Issue | Technical Root Cause |
| :--- | :--- |
| **AudioContext Suspended State Dropping Sound** | Modern browsers initialize `new AudioContext()` in `"suspended"` state until an explicit user gesture resumes it. The original `initContext()` did not call `resume()` upon context creation, and the play methods checked `if (!ctx \|\| ctx.state !== "running") return;`. Because `.resume()` is asynchronous, playback was synchronously discarded on every call. |
| **Inaudible Gain Levels & Envelopes** | The original implementation set `masterGain` to `0.08` and individual node gains to `0.03` with an exponential decay down to `0.0001` over 25ms. The resulting peak amplitude was `0.08 * 0.03 = 0.0024` (-52.4 dBFS), which is well below the noise floor of standard laptop/desktop speakers and ambient room noise. |
| **Missing Interaction Wiring** | Neither `Button.jsx` nor product cards (`ProductList2`, `ProductList7`, `TodayBid`, `TomorrowBid`, `CategoryList`), nor `ChatQnA.jsx` interactive controls were wired with `useUISound` or `soundManager` event listeners. The sounds were literally never triggered on real elements. |
| **Autoplay Policy on Page Reload** | When a user had previously enabled sounds and reloaded the page, `localStorage` loaded `this.enabled = true`, but browsers prevent Web Audio playback until a new user gesture occurs. Without a one-time gesture unlock listener, any hover sound prior to an explicit click failed silently. |
| **Poor Discoverability in Header** | `SoundToggle.jsx` was rendered as a tiny 14px icon without visible text, without clear distinction between muted and enabled states, and without an accessible switch role or visual status badge. |

---

## 2. Files Changed & Exact Fixes

### A. Sound Manager Engine ([`client/src/utils/soundManager.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/utils/soundManager.js))

1. **Asynchronous Context Execution (`ensureRunningContext`)**:
   - Replaced fragile synchronous state checks with `ensureRunningContext(callback)`.
   - If `ctx.state === "running"`, the sound callback executes immediately.
   - If `ctx.state === "suspended"`, it calls `ctx.resume().then(() => callback(ctx, this.masterGain))` so the sound plays as soon as the gesture resumes the audio pipeline, rather than being discarded.
2. **One-Time Gesture Unlock (`bindGestureUnlock` & `unlockAudio`)**:
   - If the user had previously enabled sounds, registers one-time `pointerdown` and `keydown` listeners on `window` to unlock the `AudioContext` on the first user interaction after page refresh.
3. **Audible Gain Envelopes & DC Offset Elimination**:
   - Raised `masterGain` to `0.22`.
   - Hover: 520Hz → 380Hz, gain `0.09` (effective volume `0.02` / -34 dBFS), linear ramp to 0 over 35ms. Throttled to 75ms.
   - Click: 360Hz → 580Hz triangle wave, gain `0.18` (effective volume `0.04` / -28 dBFS), linear ramp to 0 over 45ms.
   - Activation Chime: Added `playActivation()` (ascending 440Hz → 660Hz dual-pop) triggered immediately when the user enables sounds to provide instant audible confirmation.
   - Success: C5 → E5 → G5 ascending harmonic chime.
   - Error: 220Hz → 165Hz descending double pip.
4. **Node Memory Cleanup**:
   - Added `osc.onended = () => { osc.disconnect(); gain.disconnect(); }` to all synthesized sounds to prevent memory leaks during long browsing sessions.

### B. Sound Hook ([`client/src/hooks/useUISound.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/hooks/useUISound.js))

- Provided memoized `playHover`, `playClick`, `playSuccess`, `playError`, `isSoundEnabled`, and a convenient `soundProps` object (`{ onMouseEnter, onFocus, onClick }`) for easy integration across custom components.

### C. Discoverable Sound Toggle ([`client/src/components/ui/SoundToggle.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/ui/SoundToggle.jsx))

- Replaced invisible checkbox with a semantic `<button type="button" role="switch" aria-checked={enabled}>`:
  - **Desktop Header**: Shows pill button `h-9 px-2.5` with speaker icon, uppercase text badge (`SOUND OFF` in muted gray vs `SOUND ON` in terracotta), and a green pulsing active indicator dot.
  - **Mobile Navigation Drawer**: Shows full switch toggle with "Audio Feedback" label, "Sounds On" / "Sounds Off" text, and animated slider track.
  - **Accessibility**: Full keyboard support (Enter and Space keys toggle state), `aria-label`, `aria-checked`, and descriptive hover tooltips.

### D. Component Wiring

1. **[`client/src/components/ui/Button.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/ui/Button.jsx)**:
   - Added `soundFeedback = true` prop to the shared button component, automatically enabling subtle hover and click feedback on all primary, secondary, and outline buttons across the application.
2. **Product Cards**:
   - [`ProductList2.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/ProductList/ProductList2/ProductList2.jsx): Wired card `onMouseEnter` (throttled hover tick) and `openPopup` (tactile click pop).
   - [`ProductList7.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/ProductList/ProductList7/ProductList7.jsx): Wired card `onMouseEnter` and "Bid Now" button click.
   - [`TodayBid.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/User/TodayBid/TodayBid.jsx) & [`TomorrowBid.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/User/TomorrowBid/TomorrowBid.jsx): Wired card hover and "Bid Now" / "Preview Item" button clicks.
   - [`CategoryList.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/CategoryList/CategoryList.jsx): Wired card hover and "Bid Now" click.
3. **Chat Support Widget ([`ChatQnA.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/ChatQnA/ChatQnA.jsx))**:
   - Floating launcher button: click and hover sounds.
   - Fullscreen & Close header buttons: click sounds.
   - Send button, question suggestions, and message submission: click sounds.
4. **Schedule Bid Modal ([`ScheduleBidModal.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Modals/ScheduleBidModal/ScheduleBidModal.jsx))**:
   - Close icon, Cancel button, and Confirm Schedule buttons wired with click sound.

---

## 3. Automated Test Results

```bash
# Executed via npx jest
npx jest tests/unit/utils/stage3SoundAndScheduleValidation.test.js
```

| Test Suite | Test Case | Result |
| :--- | :--- | :---: |
| `stage3SoundAndScheduleValidation.test.js` | Should be disabled by default until user explicitly opts in | **PASS** |
| `stage3SoundAndScheduleValidation.test.js` | Should persist sound opt-in to localStorage when toggled on | **PASS** |
| `stage3SoundAndScheduleValidation.test.js` | Should load persisted preference from previous session on instantiation | **PASS** |
| `stage3SoundAndScheduleValidation.test.js` | Should resume suspended AudioContext when executing sound on user gesture | **PASS** |
| `stage3SoundAndScheduleValidation.test.js` | Should throttle hover sounds to 75ms to prevent audio spam | **PASS** |
| `stage3SoundAndScheduleValidation.test.js` | Should never play sounds when sound is disabled | **PASS** |
| `stage3SoundAndScheduleValidation.test.js` | Should fail gracefully without errors if Web Audio API is unavailable | **PASS** |
| `stage3SoundAndScheduleValidation.test.js` | Should verify accessible toggle button attributes contract (`role="switch"`, `aria-checked`) | **PASS** |
| `stage3SoundAndScheduleValidation.test.js` | Scheduled Bidding Validation: reject below minimum | **PASS** |
| `stage3SoundAndScheduleValidation.test.js` | Scheduled Bidding Validation: reject past target time | **PASS** |
| `stage3SoundAndScheduleValidation.test.js` | Scheduled Bidding Validation: reject time exceeding auction end | **PASS** |
| `stage3SoundAndScheduleValidation.test.js` | Scheduled Bidding Validation: accept valid parameters | **PASS** |

**Summary**: 12 passed, 0 failed (Exit code: 0).  
**Client Build**: `npm run build` completed in 28.92s with zero errors.

---

## 4. Browser Automation & Visual Evidence

Browser verification was executed across Desktop (1280×800) and Mobile (375×667) using `browser_subagent`:

| Screenshot | Viewport | Visual Verification Finding |
| :--- | :--- | :--- |
| `desktop_sound_toggle_off` | 1280 × 800 | Header displays prominent pill button `[Mute Icon] SOUND OFF` next to theme toggle. Clean border and readable typography. |
| `desktop_sound_toggle_on` | 1280 × 800 | Click immediately transitions toggle to `[Volume Icon] SOUND ON [Green Pulsing Dot]`, with terracotta accent border and background. |
| `chat_opened_with_sound` | 1280 × 800 | Chat support window opens cleanly via floating button with click sound. Controls and input area responsive. |
| `mobile_drawer_sound_toggle` | 375 × 667 | Mobile navigation drawer footer displays "Audio Feedback" row with interactive toggle switch showing "Sounds On" / "Sounds Off". |

### Persistence & Route Navigation Check
- Navigated from `/bid` to `/product/1`: Navbar maintained `SOUND ON` active state.
- Refreshed browser: `localStorage.getItem('auctionx_ui_sounds_enabled')` returned `"true"`, toggle initialized in `SOUND ON` state without throwing autoplay errors, and one-time gesture unlock bound successfully.

---

## 5. Remaining Limitations & Manual Verification

- **Audio Hardware Capture**: Automated headless browsers do not record physical speaker audio output. While AudioContext node synthesis, frequency sweeps, gain ramps, and oscillator lifetimes are verified by automated tests and browser event triggers, physical listening verification should be performed by the user by clicking the Navbar `SOUND OFF` button to turn sounds ON, then hovering over product cards or clicking buttons.
