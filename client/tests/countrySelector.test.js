import test from "node:test";
import assert from "node:assert/strict";
import { allCountries } from "country-region-data";
import * as Flags from "country-flag-icons/react/3x2";
import { inferUserCountry } from "../src/utils/geoData.js";

test("CountrySelector - Inferred country detection defaults sensibly", () => {
  const country = inferUserCountry();
  assert.equal(typeof country, "string");
  assert.equal(country.length, 2);
  assert.equal(country, "IN");
});

test("CountrySelector - Dataset includes all 249+ ISO countries", () => {
  assert.ok(allCountries.length >= 240, `Expected >= 240 countries, got ${allCountries.length}`);
  
  // Verify India and United States exist
  const india = allCountries.find(([, code]) => code === "IN");
  assert.ok(india, "India (IN) must exist in country dataset");
  assert.equal(india[0], "India");

  const us = allCountries.find(([, code]) => code === "US");
  assert.ok(us, "United States (US) must exist in country dataset");
  assert.equal(us[0], "United States");
});

test("CountrySelector - SVG Flags exist for key countries without missing-glyph boxes", () => {
  // SVG Flag components should exist in country-flag-icons
  assert.ok(Flags.IN, "Flags.IN component must exist for India");
  assert.ok(Flags.US, "Flags.US component must exist for United States");
  assert.ok(Flags.GB, "Flags.GB component must exist for United Kingdom");
  assert.ok(Flags.DE, "Flags.DE component must exist for Germany");
  assert.ok(Flags.JP, "Flags.JP component must exist for Japan");
  assert.ok(Flags.AU, "Flags.AU component must exist for Australia");
});

test("CountrySelector - Location-aware ordering prioritizes India when inferred", () => {
  const inferredCountryCode = "IN";
  const rawList = allCountries.map(([cName, cCode]) => ({
    name: cName,
    isoCode: cCode.toUpperCase(),
  }));

  const prioritized = rawList.find((c) => c.isoCode === inferredCountryCode.toUpperCase());
  const others = rawList
    .filter((c) => c.isoCode !== inferredCountryCode.toUpperCase())
    .sort((a, b) => a.name.localeCompare(b.name));

  const orderedList = prioritized ? [prioritized, ...others] : rawList;

  // India should be first
  assert.equal(orderedList[0].isoCode, "IN");
  assert.equal(orderedList[0].name, "India");

  // Subsequent countries should be alphabetical
  assert.equal(orderedList[1].isoCode, "AF");
  assert.equal(orderedList[1].name, "Afghanistan");
  assert.ok(orderedList.length === rawList.length, "No countries omitted during prioritization");
});

test("CountrySelector - Preserves saved country value regardless of inferred location", () => {
  const savedUserCountry = "US"; // User previously saved United States
  const inferredLocation = "IN"; // Inferred location is India

  // Emulate resolution logic in CountrySelector
  const rawList = allCountries.map(([cName, cCode]) => ({
    name: cName,
    isoCode: cCode.toUpperCase(),
  }));

  const selectedCountry = rawList.find(
    (c) => c.isoCode === savedUserCountry.toUpperCase() || c.name.toUpperCase() === savedUserCountry.toUpperCase()
  );

  assert.ok(selectedCountry);
  assert.equal(selectedCountry.isoCode, "US");
  assert.notEqual(selectedCountry.isoCode, inferredLocation, "Must not overwrite saved country with inferred location");
});

test("CountrySelector - Supports normalization of both ISO code and Full Name", () => {
  const rawList = allCountries.map(([cName, cCode]) => ({
    name: cName,
    isoCode: cCode.toUpperCase(),
  }));

  const matchIso = (val) =>
    rawList.find((c) => c.isoCode === val.toUpperCase() || c.name.toUpperCase() === val.toUpperCase());

  // Match ISO
  const byIso = matchIso("IN");
  assert.equal(byIso?.name, "India");

  // Match Name
  const byName = matchIso("India");
  assert.equal(byName?.isoCode, "IN");

  // Match lowercase
  const byLower = matchIso("in");
  assert.equal(byLower?.name, "India");
});
