/**
 * AuctionX — Client-Side Image Delivery & Optimization Utility
 *
 * Provides responsive srcset generation, automatic modern format negotiation (WebP/AVIF),
 * dimensions-based downscaling, and safe fallbacks for Cloudinary, Unsplash, and local assets.
 */

/**
 * Optimizes an image URL for given display constraints.
 * Supports Cloudinary and Unsplash dynamic transformations.
 * Safely falls back to the original URL for unmanaged or local assets.
 *
 * @param {string} url - Source image URL
 * @param {Object} options - Transformation options
 * @param {number} [options.width] - Target display width in pixels
 * @param {number} [options.height] - Target display height in pixels
 * @param {number|string} [options.quality=80] - Compression quality (1-100 or 'auto')
 * @param {string} [options.format='auto'] - Output format ('auto', 'webp', 'avif', etc.)
 * @param {string} [options.crop='limit'] - Resize crop mode ('limit', 'fill', 'fit', 'crop')
 * @returns {string} Optimized URL
 */
export function getOptimizedImageUrl(url, options = {}) {
  if (!url || typeof url !== "string") return url || "";

  const {
    width,
    height,
    quality = 80,
    format = "auto",
    crop = "limit",
  } = options;

  // Cloudinary Transformation Pipeline
  if (url.includes("res.cloudinary.com") && url.includes("/image/upload/")) {
    const uploadIdx = url.indexOf("/image/upload/");
    const prefix = url.slice(0, uploadIdx + "/image/upload/".length);
    const rest = url.slice(uploadIdx + "/image/upload/".length);

    const transforms = [];
    if (format) transforms.push(`f_${format}`);
    if (quality) transforms.push(typeof quality === "number" ? `q_${quality}` : `q_${quality}`);
    if (crop) transforms.push(`c_${crop}`);
    if (width) transforms.push(`w_${Math.round(width)}`);
    if (height) transforms.push(`h_${Math.round(height)}`);

    // Check if rest already has transformations preceding a version tag or public_id
    // Simple rule: insert new transformations right after /image/upload/
    const transformStr = transforms.join(",");
    return `${prefix}${transformStr}/${rest}`;
  }

  // Unsplash Transformation Pipeline
  if (url.includes("images.unsplash.com")) {
    try {
      const parsed = new URL(url);
      if (width) parsed.searchParams.set("w", String(Math.round(width)));
      if (height) parsed.searchParams.set("h", String(Math.round(height)));
      if (quality) parsed.searchParams.set("q", String(quality));
      if (format === "auto") parsed.searchParams.set("auto", "format");
      if (crop) parsed.searchParams.set("fit", crop === "limit" ? "max" : "crop");
      return parsed.toString();
    } catch {
      return url;
    }
  }

  // Unmanaged / Local fallback
  return url;
}

/**
 * Builds a responsive HTML srcset string for multi-DPR and responsive viewports.
 * Returns undefined for local/unmanaged assets to avoid redundant or invalid downloads.
 *
 * @param {string} url - Source image URL
 * @param {number[]} [widths=[360, 720, 1080]] - Desired responsive widths in pixels
 * @param {Object} [options={}] - Additional transformation options
 * @returns {string|undefined} srcset attribute string or undefined
 */
export function getResponsiveSrcSet(url, widths = [360, 720, 1080], options = {}) {
  if (!url || typeof url !== "string") return undefined;
  const isCloudinary = url.includes("res.cloudinary.com") && url.includes("/image/upload/");
  const isUnsplash = url.includes("images.unsplash.com");

  if (!isCloudinary && !isUnsplash) {
    return undefined;
  }

  return widths
    .map((w) => `${getOptimizedImageUrl(url, { ...options, width: w })} ${w}w`)
    .join(", ");
}

/**
 * Generates an optimized thumbnail URL for small cards, avatar previews, and carousel strips.
 *
 * @param {string} url - Source image URL
 * @param {number} [size=160] - Max bounding box size
 * @returns {string} Thumbnail URL
 */
export function getOptimizedThumbnail(url, size = 160) {
  return getOptimizedImageUrl(url, {
    width: size,
    height: size,
    quality: 75,
    crop: "fill",
    format: "auto",
  });
}

/**
 * Generates an optimized image URL for product cards in catalog and search grids.
 *
 * @param {string} url - Source image URL
 * @param {number} [width=450] - Card image width
 * @returns {string} Card image URL
 */
export function getOptimizedCardImage(url, width = 450) {
  return getOptimizedImageUrl(url, {
    width,
    quality: 80,
    crop: "limit",
    format: "auto",
  });
}

/**
 * Generates an optimized main image URL for high-resolution product detail slides.
 *
 * @param {string} url - Source image URL
 * @param {number} [width=900] - Detail image width
 * @returns {string} Detail image URL
 */
export function getOptimizedDetailImage(url, width = 900) {
  return getOptimizedImageUrl(url, {
    width,
    quality: 80,
    crop: "limit",
    format: "auto",
  });
}

export default {
  getOptimizedImageUrl,
  getResponsiveSrcSet,
  getOptimizedThumbnail,
  getOptimizedCardImage,
  getOptimizedDetailImage,
};
