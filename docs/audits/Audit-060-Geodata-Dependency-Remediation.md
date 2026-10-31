# Stage 7.10: Geodata Dependency Remediation and GPL Replacement Audit

> **Target Package Remediated:** `country-state-city` (v3.2.1, GPL-3.0)  
> **Replacement Package:** `country-region-data` (v4.1.0, MIT)  
> **Scope:** Frontend client application (`client/`), verification pages, Vite chunk configuration, and regression test suite  
> **Audit Date:** October 18, 2026  
> **Final Status:** **`PASS`**  

---

## 1. Executive Summary

During the Stage 7.8 and Stage 7.9 audits, an automated inspection of production dependencies identified that **`country-state-city` (v3.2.1)** was licensed under the **GNU General Public License v3.0 (GPL-3.0)**. Vite was compiling this dependency and its bundled 148,000-city database directly into a standalone client chunk (`vendor-country-state-city-DaTLf9H0.js`, **8,716.47 kB** uncompressed). Distributing GPL-3.0 compiled object code to web browsers created an immediate copyleft contradiction with the project owner's mandate in Stage 7.7 that **AuctionX must remain proprietary, with all rights reserved and no general permission for external redistribution or commercial derivative works**.

In Stage 7.10, the frontend GPL dependency was safely replaced with a verified, permissively licensed geodata architecture:
1. **Permissive Data Sourcing:** `country-state-city` was replaced with **`country-region-data` (v4.1.0)**, licensed under the **MIT License** and sourced from official ISO 3166-1 (countries) and ISO 3166-2 (subdivisions).
2. **City Selector Evolution:** In both [`VerifyProfilePage.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/UserLogin/VerifyProfilePage.jsx) and [`VerifySellerProfilePage.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/UserLogin/VerifySellerProfilePage.jsx), the problematic 148,000-entry city dropdown was replaced with a responsive, accessible text `<input id="city">` featuring trimmed non-empty validation that supports international characters, spaces, accents, hyphens, and apostrophes.
3. **Cascading State Transition Fidelity:** Country and state dropdowns remain interactive. Changing country resets both state and city; changing state resets city.
4. **Bundle Volume Reduction:** Eliminating the city database reduced the production distribution bundle by **8,716 kB (~8.7 MB)** uncompressed and **~2,324 kB (~2.3 MB)** gzipped. The client dist directory dropped from ~23.5 MB to **14.74 MB** (a 37% overall reduction).
5. **Clean Verification:** All 8 automated regression test suites passed (`npm test --prefix client`), Vite production build succeeded in 15.78s (`npm run build --prefix client`), `git diff --check` reported 0 errors, and all 27 staged documentation renames remain preserved.

---

## 2. Task 1 — Dataset Source, Exact License Evidence, and Provenance

### 2.1 Package Metadata and Source Verification

| Property | Verified Value |
| :--- | :--- |
| **Package Name** | `country-region-data` |
| **Installed Version** | `4.1.0` |
| **Author** | Benjamin Keen |
| **Upstream Git Repository** | `https://github.com/country-regions/country-region-data.git` |
| **NPM Package URL** | `https://www.npmjs.com/package/country-region-data` |
| **License Declared** | `MIT` |
| **License File** | `client/node_modules/country-region-data/LICENSE.txt` |
| **Data Format** | ESM (`dist/data.js`), UMD (`dist/data-umd.js`), raw JSON (`data.json`) |
| **Total Unpacked Size** | 632 kB (raw JSON: 339 kB, compiled ESM: 130 kB) |
| **Sub-Dependencies** | 0 (zero runtime dependencies) |

### 2.2 Exact License Text

The package license was inspected directly from `client/node_modules/country-region-data/LICENSE.txt`:

```text
The MIT License (MIT)

Copyright (c) 2022 Benjamin Keen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 2.3 Scope of License and Data Provenance

1. **Both Code and Data Covered:** The copyright notice and MIT grant explicitly apply to *"this software and associated documentation files (the 'Software')"*, which legally encompasses the raw data files (`data.json`) and the compiled bundle (`dist/data.js`).
2. **Authoritative Standards:** The dataset represents ISO international standards:
   - **ISO 3166-1 alpha-2:** 2-letter country short codes (e.g., `IN`, `US`, `GB`) and English country names.
   - **ISO 3166-2:** Principal country subdivisions (states, provinces, union territories, regions).
3. **Regional Coverage Assessment:**
   - Total Countries: **249** countries and sovereign territories.
   - India (`IN`): All 36 states and union territories (including Maharashtra `MH`, Karnataka `KA`, Delhi `DL`).
   - United States (`US`): All 50 states plus DC and outlying territories (62 regional entries total).
   - Complete coverage for all major world economies (EU, UK, Canada, Australia, Japan, Brazil, etc.).
4. **Attribution Obligations:** Standard MIT notice retention. The copyright notice is preserved in `client/node_modules/country-region-data/LICENSE.txt` and referenced in [`client/src/utils/geoData.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/utils/geoData.js).

### 2.4 Why Unverified Third-Party Mirrors Were Rejected

During Stage 7.9 research, third-party packages claiming to be "MIT drop-in replacements for `country-state-city`" (such as `country-state-city-slim`, `countries-states-cities`, and `@countrystatecity/countries`) were audited. All of them traced their underlying 150,000-city database directly back to `dr5hn/countries-states-cities-database`, which is licensed under the **Open Database License v1.0 (ODbL-1.0)** with strict Share-Alike copyleft terms, or `harpreetkhalsagtbit/country-state-city` (GPL-3.0). Repackaging copyleft datasets with an MIT `package.json` declaration constitutes "license washing". Adopting `country-region-data` + city text input strictly avoids this legal risk by using verified ISO standards without embedding copyleft geodata.

---

## 3. Task 2 — Implementation & Behavioral Compatibility Details

### 3.1 Geodata Adapter Utility (`client/src/utils/geoData.js`)

A clean, modular utility was created at [`client/src/utils/geoData.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/utils/geoData.js) to provide a drop-in API compatible with the existing component state while adding input validation and normalization:

```javascript
import { allCountries } from "country-region-data";

export function getCountryFlag(isoCode) {
  if (!isoCode || typeof isoCode !== "string" || isoCode.length !== 2) return "";
  const codePoints = isoCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export const Country = {
  getAllCountries: () =>
    allCountries.map(([name, isoCode]) => ({
      name,
      isoCode,
      flag: getCountryFlag(isoCode),
    })),
  getCountryByCode: (isoCode) => { ... },
};

export const State = {
  getStatesOfCountry: (countryIsoCode) => {
    if (!countryIsoCode || typeof countryIsoCode !== "string") return [];
    const countryEntry = allCountries.find(([, code]) => code === countryIsoCode.toUpperCase());
    if (!countryEntry || !Array.isArray(countryEntry[2])) return [];
    return countryEntry[2].map(([name, shortCode]) => ({
      name,
      isoCode: shortCode || name,
    }));
  },
};

export function isValidCity(cityName) {
  if (typeof cityName !== "string") return false;
  const trimmed = cityName.trim();
  return trimmed.length > 0 && trimmed.length <= 100;
}

export function normalizeCity(cityName) {
  if (typeof cityName !== "string") return "";
  return cityName.trim();
}
```

### 3.2 Form Updates in Both Verification Pages

The changes were applied identically to:
- [`client/src/pages/User/UserLogin/VerifyProfilePage.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/UserLogin/VerifyProfilePage.jsx) (User verification)
- [`client/src/pages/User/UserLogin/VerifySellerProfilePage.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/UserLogin/VerifySellerProfilePage.jsx) (Seller verification)

#### 1. Import Replacement
```diff
-import { Country, State, City } from "country-state-city";
+import { Country, State, isValidCity, normalizeCity } from "../../../utils/geoData";
```

#### 2. Obsolete State Removal
```diff
-const [cities, setCities] = useState([]);
```

#### 3. Cascading State Transitions
```javascript
// Load states when country changes
useEffect(() => {
  if (country) {
    const countryStates = State.getStatesOfCountry(country);
    setStates(countryStates);
    setState(""); // Reset state when country changes
    setCity("");  // Reset city when country changes
  } else {
    setStates([]);
    setState("");
    setCity("");
  }
}, [country]);

// Reset city when state changes
useEffect(() => {
  setCity("");
}, [state]);
```

#### 4. City Input Field Replacement
```jsx
<div>
  <label
    htmlFor="city"
    className="block text-sm font-medium text-foreground-secondary"
  >
    City
  </label>
  <input
    id="city"
    type="text"
    placeholder="Enter your city"
    value={city}
    onChange={(e) => setCity(e.target.value)}
    required
    disabled={!state}
    className="mt-1 block w-full rounded-lg border border-border-subtle bg-surface py-2.5 px-3.5 text-foreground shadow-xs focus:border-action-primary focus:ring-1 focus:ring-ring-focus outline-none disabled:bg-surface-subtle disabled:text-foreground-muted"
  />
  {formErrors.city && (
    <p className="mt-1 text-sm text-status-error">{formErrors.city}</p>
  )}
</div>
```

#### 5. Form Validation & Submission Payload
```javascript
// In validateForm():
if (!isValidCity(city)) {
  errors.city = "Please enter a valid city name";
  isValid = false;
}

// In handleSubmit():
const payload = {
  address,
  phoneNo: phone,
  gender,
  pinCode,
  country,
  state,
  city: normalizeCity(city), // Trimmed string
  ...
};
```

### 3.3 Backend Contract Compatibility

The backend schema and controllers were inspected to verify compatibility:
- [`server/models/LoginSchema/user.js:L38-41`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/models/LoginSchema/user.js#L38-L41): `city: { type: String, default: "" }`
- [`server/models/LoginSchema/seller.js:L68-71`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/models/LoginSchema/seller.js#L68-L71): `city: { type: String, default: "" }`
- [`server/controllers/LoginControllers/UserLoginController/UserVerificationController.js:L150-177`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/LoginControllers/UserLoginController/UserVerificationController.js#L150-L177): Accepts `city` directly from `req.body` as a string and persists it to MongoDB without enum constraints.
- [`server/controllers/LoginControllers/SellerLoginController/SellerVerificationController.js:L150-175`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/server/controllers/LoginControllers/SellerLoginController/SellerVerificationController.js#L150-L175): Accepts `city` directly from `req.body` as a string.

**Result:** The backend has always accepted arbitrary string values for `city`. No backend schema, route, or controller changes were required.

---

## 4. Task 3 — Dependency Removal & Vite Configuration

### 4.1 Dependency Removal Evidence

1. **Manifest (`client/package.json`):**
   - Removed: `"country-state-city": "^3.2.1"`
   - Added: `"country-region-data": "^4.1.0"`
2. **Lockfile (`client/package-lock.json`):**
   - Completely unlinked `node_modules/country-state-city`.
   - Verified via `lock.packages['node_modules/country-state-city'] === undefined`.
3. **Package Tree Inspection:**
   ```bash
   $ npm list country-state-city --prefix client
   client@0.0.0
   `-- (empty)

   $ npm list country-region-data --prefix client
   client@0.0.0
   `-- country-region-data@4.1.0
   ```

### 4.2 Vite Manual Chunk Configuration Cleanup

In [`client/vite.config.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/vite.config.js), the Phase 3c chunk splitting rule that isolated `country-state-city` was removed, while keeping the vendor chunk for `libphonenumber-js`:

```diff
           manualChunks: (id) => {
-            if (id.includes("node_modules/country-state-city")) {
-              return "vendor-country-state-city";
-            }
             if (id.includes("node_modules/libphonenumber-js")) {
               return "vendor-libphonenumber";
             }
           },
```

---

## 5. Task 4 — Regression Testing

A comprehensive regression test suite was implemented at [`client/tests/geoDataRegression.test.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/tests/geoDataRegression.test.js), executable via `npm test --prefix client` (using Node.js v22's native ESM test runner):

```bash
$ npm test --prefix client

> client@0.0.0 test
> node --test tests/geoDataRegression.test.js

TAP version 13
# Subtest: Stage 7.10 - Country Selection and ISO Flag Derivation
ok 1 - Stage 7.10 - Country Selection and ISO Flag Derivation
# Subtest: Stage 7.10 - State Options and Regional Coverage (ISO 3166-2)
ok 2 - Stage 7.10 - State Options and Regional Coverage (ISO 3166-2)
# Subtest: Stage 7.10 - Dependent Selection Form Clearing Simulation
ok 3 - Stage 7.10 - Dependent Selection Form Clearing Simulation
# Subtest: Stage 7.10 - City Validation Rules (Accepts Valid Names Worldwide)
ok 4 - Stage 7.10 - City Validation Rules (Accepts Valid Names Worldwide)
# Subtest: Stage 7.10 - City Validation Rejections (Empty, Whitespace, Non-String, Oversized)
ok 5 - Stage 7.10 - City Validation Rejections (Empty, Whitespace, Non-String, Oversized)
# Subtest: Stage 7.10 - City Normalization
ok 6 - Stage 7.10 - City Normalization
# Subtest: Stage 7.10 - User and Seller Verification Payload Compatibility
ok 7 - Stage 7.10 - User and Seller Verification Payload Compatibility
# Subtest: Stage 7.10 - Dependency Tree and Source Cleanliness Audit
ok 8 - Stage 7.10 - Dependency Tree and Source Cleanliness Audit
1..8
# tests 8
# suites 0
# pass 8
# fail 0
# duration_ms 86.5
```

### Coverage Breakdown

| Test Area | Scenarios Validated | Result |
| :--- | :--- | :--- |
| **Country Options** | 249 countries returned; India (`IN`), US (`US`), UK (`GB`) verified with accurate Unicode emoji flags (`🇮🇳`, `🇺🇸`, `🇬🇧`). | **PASS** |
| **State Options** | Regional coverage under ISO 3166-2 verified for India (36 states/UTs) and US (62 states/territories); invalid country returns `[]`. | **PASS** |
| **Form State Transitions** | Country change resets state and city; state change resets city; clearing country clears all selections. | **PASS** |
| **Worldwide City Input** | Validates ASCII, spaces ("San Francisco"), hyphens ("Aix-en-Provence"), apostrophes ("St. John's"), accents ("São Paulo", "München", "Zürich"), and non-Latin scripts (Kanji "東京都", Arabic "القاهرة", Cyrillic "Москва", Devanagari "दिल्ली", Chinese "北京市", Hangul "서울"). | **PASS** |
| **Input Rejections** | Rejects empty strings (`""`), whitespace-only (`"   "`, `"\t\n"`), non-strings (`null`, `undefined`, `123`), and oversized strings (> 100 characters). | **PASS** |
| **City Normalization** | Trims leading and trailing whitespace while preserving internal spaces. | **PASS** |
| **Payload Contracts** | Form payload construction matches backend User and Seller Mongoose models. | **PASS** |
| **Source Cleanliness** | Validates 0 references to `country-state-city` in `client/package.json`, `client/vite.config.js`, `VerifyProfilePage.jsx`, and `VerifySellerProfilePage.jsx`. | **PASS** |

> [!NOTE]
> **Testing Environment Note:** The client application does not have a browser DOM test runner (e.g., Vitest + jsdom). Full unit verification of the data adapter, form transition state machine, city validation, normalization, payload structure, and dependency cleanliness is executed natively via `node --test` under `npm test --prefix client`.

---

## 6. Task 5 — Verification Results, Bundle Metrics & Safety Audit

### 6.1 Production Bundle Size Comparison

| Chunk / Asset | Stage 7.9 (Before) | Stage 7.10 (After) | Net Change |
| :--- | :--- | :--- | :--- |
| **`vendor-country-state-city`** | 8,716.47 kB (gzip: 2,323.89 kB) | **0.00 kB** | **-8,716.47 kB (-100%)** |
| **`VerifyProfilePage`** | 13.00 kB (gzip: 3.70 kB) | **13.17 kB** (gzip: 3.72 kB) | +0.17 kB |
| **`VerifySellerProfilePage`** | 14.30 kB (gzip: 3.90 kB) | **14.49 kB** (gzip: 3.91 kB) | +0.19 kB |
| **`index-DET-AEG0.js`** (shared geodata chunk) | N/A | **224.84 kB** (gzip: 81.39 kB) | +224.84 kB (MIT geodata) |
| **Total `client/dist` Directory Volume** | **~23.5 MB** | **14.74 MB** | **-8.72 MB (-37.1%)** |
| **Largest Chunk in Client Build** | 8,716.47 kB (`vendor-country-state-city`) | 462.03 kB (`index-CKSNNSUq.js`) | **-8,254.44 kB (-94.7%)** |

### 6.2 Build Verification

Command: `npm run build --prefix client`  
Exit Code: `0`  
Time: `15.78s`  
Summary: 4,267 modules transformed into 95 production chunks. Zero chunk size warnings exceeding 500 kB (excluding non-JS static assets).

### 6.3 Git Diff & Staged Change Preservation Check

Command: `git diff --check`  
Exit Code: `0` (Zero whitespace errors, no unresolved merge conflict markers).

Command: `git status --short`  
All 27 staged documentation renames from previous stages remain fully intact:
- `docs/architecture/` (8 renamed system-design documents)
- `docs/audits/frontend/` (18 renamed frontend audit documents)
- `docs/testing/` (1 renamed test-strategy document)
- Untracked files and working tree modifications are strictly preserved.

---

## 7. Licensing Risk Assessment Post-Remediation

| Concern | Assessment | Status |
| :--- | :--- | :--- |
| **Direct GPL Copyleft Infection in Frontend** | `country-state-city` has been uninstalled from `package.json`, purged from `package-lock.json`, and eliminated from Vite bundles. | **RESOLVED** |
| **License Washing Risk** | No unverified third-party city mirrors (which copy ODbL-1.0 or GPL-3.0 data) were used. Sourced strictly from MIT-licensed `country-region-data` (ISO 3166-1/2). | **RESOLVED** |
| **Proprietary Commercial Distribution Conflict** | The client bundle no longer conveys any GPL-3.0 or ODbL-1.0 object code to end-user browsers. | **RESOLVED** |
| **Root Repository License** | The root license decision remains pending owner review under [`Audit-057-Proprietary-Licensing-And-Policy-Proposal.md`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/docs/audits/Audit-057-Proprietary-Licensing-And-Policy-Proposal.md) and [`Audit-058-Proprietary-License-Proposal-Validation.md`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/docs/audits/Audit-058-Proprietary-License-Proposal-Validation.md). | **PRESERVED** |

---

## 8. Final Status

**`PASS`**

The GPL geodata dependency (`country-state-city`) has been completely removed and replaced with a clean, MIT-licensed, ISO 3166-compliant country/state dataset and a validated city input. The production client bundle has been reduced by 8.7 MB, all regression tests pass, and all non-negotiable safety constraints were strictly honored.
