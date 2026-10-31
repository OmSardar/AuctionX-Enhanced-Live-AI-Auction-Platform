import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard utility for merging Tailwind classes with clsx and twMerge.
 * Eliminates conflicting utility classes and supports conditional expressions.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Standardized INR currency formatter for AuctionX.
 * Formats any monetary amount using Indian numbering system (en-IN) and Rupee symbol (₹).
 */
export function formatCurrency(amount, options = {}) {
  const numericAmount = typeof amount === "number" ? amount : Number(amount);
  if (isNaN(numericAmount) || amount === null || amount === undefined) {
    return options.minimumFractionDigits === 0 ? "₹0" : "₹0.00";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    ...(options.minimumFractionDigits !== undefined ? { minimumFractionDigits: options.minimumFractionDigits } : {}),
  }).format(numericAmount);
}

/**
 * Format compact numbers (e.g. 1.2K, 3.4L) using Indian locale
 */
export function formatCompactNumber(number) {
  if (typeof number !== "number" || isNaN(number)) return "0";
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
}

/**
 * Format date consistently
 */
export function formatDate(input) {
  const date = new Date(input);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Generate absolute URL with API base
 */
export function absoluteUrl(path) {
  return `${import.meta.env.VITE_API_URL || ""}${path}`;
}
