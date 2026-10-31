import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  Country,
  State,
  getCountryFlag,
  isValidCity,
  normalizeCity,
} from "../src/utils/geoData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");

test("Stage 7.10 - Country Selection and ISO Flag Derivation", () => {
  const countries = Country.getAllCountries();
  assert.ok(Array.isArray(countries), "Countries list must be an array");
  assert.ok(countries.length >= 240, `Expected >= 240 countries, found ${countries.length}`);

  // Test India
  const india = countries.find((c) => c.isoCode === "IN");
  assert.ok(india, "India (IN) must exist");
  assert.strictEqual(india.name, "India");
  assert.strictEqual(india.flag, "🇮🇳");

  // Test United States
  const us = countries.find((c) => c.isoCode === "US");
  assert.ok(us, "United States (US) must exist");
  assert.strictEqual(us.name, "United States");
  assert.strictEqual(us.flag, "🇺🇸");

  // Test United Kingdom
  const uk = countries.find((c) => c.isoCode === "GB");
  assert.ok(uk, "United Kingdom (GB) must exist");
  assert.strictEqual(uk.flag, "🇬🇧");

  // getCountryFlag direct lookup
  assert.strictEqual(getCountryFlag("IN"), "🇮🇳");
  assert.strictEqual(getCountryFlag("US"), "🇺🇸");
  assert.strictEqual(getCountryFlag(""), "");

  // getCountryByCode lookup
  assert.strictEqual(Country.getCountryByCode("IN")?.name, "India");
  assert.strictEqual(Country.getCountryByCode("XYZ"), null);
  assert.strictEqual(Country.getCountryByCode(null), null);
});

test("Stage 7.10 - State Options and Regional Coverage (ISO 3166-2)", () => {
  // Test Indian states
  const inStates = State.getStatesOfCountry("IN");
  assert.ok(inStates.length >= 30, `Expected >= 30 Indian states/UTs, found ${inStates.length}`);
  const maharashtra = inStates.find((s) => s.name === "Maharashtra");
  assert.ok(maharashtra, "Maharashtra must exist in India");
  assert.strictEqual(maharashtra.isoCode, "MH");

  const karnataka = inStates.find((s) => s.name === "Karnataka");
  assert.ok(karnataka, "Karnataka must exist in India");

  // Test US states
  const usStates = State.getStatesOfCountry("US");
  assert.ok(usStates.length >= 50, `Expected >= 50 US states, found ${usStates.length}`);
  const california = usStates.find((s) => s.name === "California");
  assert.ok(california, "California must exist in US");
  assert.strictEqual(california.isoCode, "CA");

  // Edge cases
  assert.deepStrictEqual(State.getStatesOfCountry(""), []);
  assert.deepStrictEqual(State.getStatesOfCountry(null), []);
  assert.deepStrictEqual(State.getStatesOfCountry("UNKNOWN"), []);
});

test("Stage 7.10 - Dependent Selection Form Clearing Simulation", () => {
  // Simulate the form state transitions implemented in VerifyProfilePage and VerifySellerProfilePage
  function createFormStateMachine() {
    let country = "IN";
    let state = "MH";
    let city = "Mumbai";
    let stateOptions = State.getStatesOfCountry(country);

    return {
      getState: () => ({ country, state, city, stateCount: stateOptions.length }),
      onCountryChange: (newCountry) => {
        country = newCountry;
        if (newCountry) {
          stateOptions = State.getStatesOfCountry(newCountry);
        } else {
          stateOptions = [];
        }
        state = ""; // Reset state when country changes
        city = "";  // Reset city when country changes
      },
      onStateChange: (newState) => {
        state = newState;
        city = "";  // Reset city when state changes
      },
      onCityInput: (newCity) => {
        city = newCity;
      },
    };
  }

  const form = createFormStateMachine();
  assert.deepStrictEqual(form.getState(), {
    country: "IN",
    state: "MH",
    city: "Mumbai",
    stateCount: State.getStatesOfCountry("IN").length,
  });

  // Changing country to US clears state and city, and populates US states
  form.onCountryChange("US");
  assert.strictEqual(form.getState().country, "US");
  assert.strictEqual(form.getState().state, "");
  assert.strictEqual(form.getState().city, "");
  assert.strictEqual(form.getState().stateCount, State.getStatesOfCountry("US").length);

  // Selecting state and typing city
  form.onStateChange("CA");
  form.onCityInput("Los Angeles");
  assert.strictEqual(form.getState().state, "CA");
  assert.strictEqual(form.getState().city, "Los Angeles");

  // Changing state clears city
  form.onStateChange("NY");
  assert.strictEqual(form.getState().state, "NY");
  assert.strictEqual(form.getState().city, "");

  // Clearing country clears everything
  form.onCountryChange("");
  assert.strictEqual(form.getState().country, "");
  assert.strictEqual(form.getState().state, "");
  assert.strictEqual(form.getState().city, "");
  assert.strictEqual(form.getState().stateCount, 0);
});

test("Stage 7.10 - City Validation Rules (Accepts Valid Names Worldwide)", () => {
  // Standard ASCII cities
  assert.ok(isValidCity("Mumbai"));
  assert.ok(isValidCity("London"));
  assert.ok(isValidCity("Tokyo"));
  assert.ok(isValidCity("Sydney"));

  // Spaces
  assert.ok(isValidCity("New York"));
  assert.ok(isValidCity("Rio de Janeiro"));
  assert.ok(isValidCity("San Francisco"));
  assert.ok(isValidCity("Salt Lake City"));

  // Hyphens
  assert.ok(isValidCity("Winston-Salem"));
  assert.ok(isValidCity("Aix-en-Provence"));
  assert.ok(isValidCity("Clermont-Ferrand"));
  assert.ok(isValidCity("Newcastle-under-Lyme"));

  // Apostrophes and periods
  assert.ok(isValidCity("St. John's"));
  assert.ok(isValidCity("L'Aquila"));
  assert.ok(isValidCity("Presque Isle"));

  // Accents and diacritics
  assert.ok(isValidCity("São Paulo"));
  assert.ok(isValidCity("München"));
  assert.ok(isValidCity("Köln"));
  assert.ok(isValidCity("Łódź"));
  assert.ok(isValidCity("Malmö"));
  assert.ok(isValidCity("Zürich"));
  assert.ok(isValidCity("Bogotá"));

  // Non-Latin scripts
  assert.ok(isValidCity("東京都")); // Tokyo (Japanese Kanji)
  assert.ok(isValidCity("القاهرة")); // Cairo (Arabic)
  assert.ok(isValidCity("Москва")); // Moscow (Cyrillic)
  assert.ok(isValidCity("दिल्ली")); // Delhi (Devanagari)
  assert.ok(isValidCity("北京市")); // Beijing (Chinese)
  assert.ok(isValidCity("서울")); // Seoul (Hangul)
});

test("Stage 7.10 - City Validation Rejections (Empty, Whitespace, Non-String, Oversized)", () => {
  // Empty
  assert.strictEqual(isValidCity(""), false);

  // Whitespace-only
  assert.strictEqual(isValidCity("   "), false);
  assert.strictEqual(isValidCity("\t"), false);
  assert.strictEqual(isValidCity("\n  \r"), false);

  // Non-string types
  assert.strictEqual(isValidCity(null), false);
  assert.strictEqual(isValidCity(undefined), false);
  assert.strictEqual(isValidCity(123), false);
  assert.strictEqual(isValidCity({}), false);
  assert.strictEqual(isValidCity([]), false);

  // Excessive length (> 100 characters)
  const oversized = "A".repeat(101);
  assert.strictEqual(isValidCity(oversized), false);
  assert.strictEqual(isValidCity("A".repeat(100)), true);
});

test("Stage 7.10 - City Normalization", () => {
  assert.strictEqual(normalizeCity("  Mumbai  "), "Mumbai");
  assert.strictEqual(normalizeCity("New York\n"), "New York");
  assert.strictEqual(normalizeCity("\tSt. John's "), "St. John's");
  assert.strictEqual(normalizeCity(null), "");
  assert.strictEqual(normalizeCity(undefined), "");
});

test("Stage 7.10 - User and Seller Verification Payload Compatibility", () => {
  // Simulate VerifyProfilePage payload creation
  const userFormData = {
    address: "42 MG Road",
    phone: "+919876543210",
    gender: "male",
    pinCode: "400001",
    country: "IN",
    state: "MH",
    city: "  Mumbai  ",
    alternativePhoneNo: "",
    email: "user@example.com",
    name: "Test User",
  };

  const userPayload = {
    address: userFormData.address,
    phoneNo: userFormData.phone,
    gender: userFormData.gender,
    pinCode: userFormData.pinCode,
    country: userFormData.country,
    state: userFormData.state,
    city: normalizeCity(userFormData.city),
    alternativePhoneNo: userFormData.alternativePhoneNo || "",
    profilePic: [],
    email: userFormData.email,
    name: userFormData.name,
  };

  assert.strictEqual(userPayload.city, "Mumbai");
  assert.strictEqual(userPayload.country, "IN");
  assert.strictEqual(userPayload.state, "MH");
  assert.strictEqual(typeof userPayload.city, "string");

  // Simulate VerifySellerProfilePage payload creation
  const sellerFormData = {
    ...userFormData,
    storeName: "Vintage Timepieces",
    storeDescription: "Curated antique and luxury horology.",
  };

  const sellerPayload = {
    ...userPayload,
    storeName: sellerFormData.storeName,
    storeDescription: sellerFormData.storeDescription,
  };

  assert.strictEqual(sellerPayload.city, "Mumbai");
  assert.strictEqual(sellerPayload.storeName, "Vintage Timepieces");
  assert.strictEqual(sellerPayload.storeDescription, "Curated antique and luxury horology.");
});

test("Stage 7.10 - Dependency Tree and Source Cleanliness Audit", () => {
  // 1. Verify client/package.json
  const pkgPath = path.join(clientRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  assert.ok(!pkg.dependencies["country-state-city"], "country-state-city must not be in dependencies");
  assert.ok(
    !pkg.devDependencies || !pkg.devDependencies["country-state-city"],
    "country-state-city must not be in devDependencies"
  );
  assert.ok(pkg.dependencies["country-region-data"], "country-region-data must be in dependencies");

  // 2. Verify vite.config.js has no country-state-city chunk
  const viteConfigPath = path.join(clientRoot, "vite.config.js");
  const viteConfigContent = fs.readFileSync(viteConfigPath, "utf-8");
  assert.ok(
    !viteConfigContent.includes("country-state-city"),
    "vite.config.js must not reference country-state-city"
  );

  // 3. Verify VerifyProfilePage.jsx has no country-state-city import
  const userPagePath = path.join(
    clientRoot,
    "src",
    "pages",
    "User",
    "UserLogin",
    "VerifyProfilePage.jsx"
  );
  const userPageContent = fs.readFileSync(userPagePath, "utf-8");
  assert.ok(
    !userPageContent.includes("country-state-city"),
    "VerifyProfilePage.jsx must not import country-state-city"
  );
  assert.ok(
    userPageContent.includes("geoData"),
    "VerifyProfilePage.jsx must import from geoData"
  );
  assert.ok(
    userPageContent.includes('<input\n                id="city"') ||
    userPageContent.includes('<input id="city"') ||
    userPageContent.includes('id="city"'),
    "VerifyProfilePage.jsx must contain an input element for city"
  );

  // 4. Verify VerifySellerProfilePage.jsx has no country-state-city import
  const sellerPagePath = path.join(
    clientRoot,
    "src",
    "pages",
    "User",
    "UserLogin",
    "VerifySellerProfilePage.jsx"
  );
  const sellerPageContent = fs.readFileSync(sellerPagePath, "utf-8");
  assert.ok(
    !sellerPageContent.includes("country-state-city"),
    "VerifySellerProfilePage.jsx must not import country-state-city"
  );
  assert.ok(
    sellerPageContent.includes("geoData"),
    "VerifySellerProfilePage.jsx must import from geoData"
  );
});
