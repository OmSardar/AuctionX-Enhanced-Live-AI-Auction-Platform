/**
 * Application Environment Configuration
 * Centralized access to environment variables with fallback defaults.
 */

export const API_URL = import.meta.env.VITE_API_URL || "";
export const IS_PRODUCTION = import.meta.env.PROD;
export const IS_DEVELOPMENT = import.meta.env.DEV;
export const APP_NAME = "AuctionX";

export default {
  API_URL,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  APP_NAME,
};
