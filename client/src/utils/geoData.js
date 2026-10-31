import { allCountries } from "country-region-data";

/**
 * Derives the Unicode flag emoji from an ISO 3166-1 alpha-2 country code.
 * Regional Indicator Symbol letters start at 0x1F1E6 (127397 + code point of 'A').
 *
 * @param {string} isoCode - Two-letter uppercase ISO 3166-1 alpha-2 code (e.g. "IN", "US")
 * @returns {string} The Unicode flag emoji, or empty string if invalid
 */
export function getCountryFlag(isoCode) {
  if (!isoCode || typeof isoCode !== "string" || isoCode.length !== 2) {
    return "";
  }
  const codePoints = isoCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Country helper compatible with the previous country-state-city Country API.
 */
export const Country = {
  /**
   * Retrieves all countries with name, isoCode, and Unicode flag emoji.
   * @returns {Array<{ name: string, isoCode: string, flag: string }>}
   */
  getAllCountries: () => {
    return allCountries.map(([name, isoCode]) => ({
      name,
      isoCode,
      flag: getCountryFlag(isoCode),
    }));
  },

  /**
   * Finds a specific country by its ISO 3166-1 alpha-2 code.
   * @param {string} isoCode
   * @returns {{ name: string, isoCode: string, flag: string } | null}
   */
  getCountryByCode: (isoCode) => {
    if (!isoCode || typeof isoCode !== "string") return null;
    const target = isoCode.toUpperCase();
    const entry = allCountries.find(([, code]) => code === target);
    if (!entry) return null;
    return {
      name: entry[0],
      isoCode: entry[1],
      flag: getCountryFlag(entry[1]),
    };
  },
};

/**
 * State helper compatible with the previous country-state-city State API.
 */
export const State = {
  /**
   * Retrieves all states/provinces/regions for a given country code under ISO 3166-2.
   * @param {string} countryIsoCode - Two-letter ISO country code (e.g. "IN", "US")
   * @returns {Array<{ name: string, isoCode: string }>}
   */
  getStatesOfCountry: (countryIsoCode) => {
    if (!countryIsoCode || typeof countryIsoCode !== "string") return [];
    const target = countryIsoCode.toUpperCase();
    const countryEntry = allCountries.find(([, code]) => code === target);
    if (!countryEntry || !Array.isArray(countryEntry[2])) {
      return [];
    }
    return countryEntry[2].map(([name, shortCode]) => ({
      name,
      isoCode: shortCode || name,
    }));
  },
};

/**
 * Validates a city name string:
 * - Must be non-empty after trimming leading/trailing whitespace
 * - Maximum length of 100 characters to prevent buffer abuse
 * - Allows international names, accents, spaces, hyphens, and apostrophes
 *
 * @param {string} cityName
 * @returns {boolean}
 */
export function isValidCity(cityName) {
  if (typeof cityName !== "string") return false;
  const trimmed = cityName.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    return false;
  }
  return true;
}

/**
 * Normalizes city input by trimming leading/trailing whitespace.
 * @param {string} cityName
 * @returns {string}
 */
export function normalizeCity(cityName) {
  if (typeof cityName !== "string") return "";
  return cityName.trim();
}

/**
 * Infer country code from timezone or browser locale.
 * Prioritizes India ("IN") for users in Indian timezone / locale.
 *
 * @returns {string} Two-letter uppercase ISO 3166-1 alpha-2 code
 */
export function inferUserCountry() {
  if (typeof window === "undefined") return "IN";
  try {
    const tz = Intl.DateTimeFormat?.().resolvedOptions?.().timeZone || "";
    if (
      tz.includes("Kolkata") ||
      tz.includes("Calcutta") ||
      tz.startsWith("Asia/Kolkata")
    ) {
      return "IN";
    }

    const navLanguages = navigator.languages || [navigator.language];
    for (const lang of navLanguages) {
      if (!lang) continue;
      const parts = lang.split("-");
      if (parts.length > 1) {
        const region = parts[parts.length - 1].toUpperCase();
        if (region.length === 2) {
          return region;
        }
      }
    }
  } catch (err) {
    // Non-blocking fallback
  }
  return "IN";
}
