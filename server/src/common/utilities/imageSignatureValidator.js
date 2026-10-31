const fs = require("fs");
const sharp = require("sharp");

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_DIMENSION = 4096;
const MAX_PIXELS = 4096 * 4096; // 16,777,216

/**
 * Validates a PNG buffer structure and dimensions.
 */
function validatePng(buffer) {
  if (buffer.length < 24) {
    return { valid: false, error: "Malformed or truncated PNG file", code: "MALFORMED_IMAGE" };
  }

  const chunkLength = buffer.readUInt32BE(8);
  const chunkType = buffer.toString("ascii", 12, 16);
  if (chunkType !== "IHDR" || chunkLength < 13) {
    return { valid: false, error: "Invalid PNG header chunk: missing IHDR", code: "MALFORMED_IMAGE" };
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  if (width === 0 || height === 0) {
    return { valid: false, error: "Invalid PNG dimensions: zero width or height", code: "INVALID_DIMENSIONS" };
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return {
      valid: false,
      error: `Image dimensions (${width}x${height}) exceed maximum allowed of ${MAX_DIMENSION}px`,
      code: "DIMENSIONS_EXCEEDED",
    };
  }
  if (width * height > MAX_PIXELS) {
    return {
      valid: false,
      error: `Total pixel count (${width * height}) exceeds maximum allowed of ${MAX_PIXELS}`,
      code: "PIXELS_EXCEEDED",
    };
  }

  const bitDepth = buffer[24];
  const validBitDepths = [1, 2, 4, 8, 16];
  if (!validBitDepths.includes(bitDepth)) {
    return { valid: false, error: "Malformed PNG: invalid bit depth", code: "MALFORMED_IMAGE" };
  }

  return { valid: true, format: "png", width, height, mimeType: "image/png" };
}

/**
 * Validates a JPEG buffer structure, markers, and dimensions.
 */
function validateJpeg(buffer) {
  let offset = 2;
  let width = 0;
  let height = 0;
  let sofFound = false;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      return { valid: false, error: "Malformed JPEG: expected marker delimiter", code: "MALFORMED_IMAGE" };
    }

    // Skip consecutive 0xFF bytes (fill bytes)
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset++;
    }

    if (offset >= buffer.length) {
      break;
    }

    const marker = buffer[offset];
    offset++;

    // Standalone markers without length:
    // 0xD8 (SOI), 0xD9 (EOI), 0x00 (byte stuffing), 0x01 (TEM), 0xD0-0xD7 (RST)
    if (marker === 0xd9) {
      break; // End of image
    }
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      continue;
    }

    if (offset + 2 > buffer.length) {
      return { valid: false, error: "Malformed JPEG: truncated marker length", code: "MALFORMED_IMAGE" };
    }

    const length = buffer.readUInt16BE(offset);
    if (length < 2) {
      return { valid: false, error: "Malformed JPEG: invalid segment length", code: "MALFORMED_IMAGE" };
    }

    // SOF markers (SOF0, SOF1, SOF2, etc.)
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSof) {
      if (offset + length > buffer.length || length < 7) {
        return { valid: false, error: "Malformed JPEG: truncated SOF marker", code: "MALFORMED_IMAGE" };
      }
      height = buffer.readUInt16BE(offset + 3);
      width = buffer.readUInt16BE(offset + 5);
      sofFound = true;
      break;
    }

    offset += length;
  }

  if (!sofFound || width === 0 || height === 0) {
    return { valid: false, error: "Malformed JPEG: could not find valid SOF segment", code: "MALFORMED_IMAGE" };
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return {
      valid: false,
      error: `Image dimensions (${width}x${height}) exceed maximum allowed of ${MAX_DIMENSION}px`,
      code: "DIMENSIONS_EXCEEDED",
    };
  }
  if (width * height > MAX_PIXELS) {
    return {
      valid: false,
      error: `Total pixel count (${width * height}) exceeds maximum allowed of ${MAX_PIXELS}`,
      code: "PIXELS_EXCEEDED",
    };
  }

  return { valid: true, format: "jpeg", width, height, mimeType: "image/jpeg" };
}

/**
 * Validates a WebP buffer structure, sub-format, and dimensions.
 */
function validateWebp(buffer) {
  if (buffer.length < 30) {
    return { valid: false, error: "Malformed or truncated WebP file", code: "MALFORMED_IMAGE" };
  }

  const chunkType = buffer.toString("ascii", 12, 16);
  let width = 0;
  let height = 0;

  if (chunkType === "VP8 ") {
    // Lossy WebP: sync code at bytes 23-25 (0x9D 0x01 0x2A)
    if (buffer.length < 30) {
      return { valid: false, error: "Malformed VP8 WebP file", code: "MALFORMED_IMAGE" };
    }
    if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) {
      return { valid: false, error: "Malformed VP8 WebP: missing keyframe sync code", code: "MALFORMED_IMAGE" };
    }
    width = buffer.readUInt16LE(26) & 0x3fff;
    height = buffer.readUInt16LE(28) & 0x3fff;
  } else if (chunkType === "VP8L") {
    // Lossless WebP
    if (buffer.length < 25) {
      return { valid: false, error: "Malformed VP8L WebP file", code: "MALFORMED_IMAGE" };
    }
    if (buffer[20] !== 0x2f) {
      return { valid: false, error: "Malformed VP8L WebP: missing signature 0x2F", code: "MALFORMED_IMAGE" };
    }
    const b1 = buffer[21];
    const b2 = buffer[22];
    const b3 = buffer[23];
    const b4 = buffer[24];
    width = 1 + (((b2 & 0x3f) << 8) | b1);
    height = 1 + ((((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)));
  } else if (chunkType === "VP8X") {
    // Extended WebP: 24-bit dimensions (LE) + 1
    if (buffer.length < 30) {
      return { valid: false, error: "Malformed VP8X WebP file", code: "MALFORMED_IMAGE" };
    }
    width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
    height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
  } else {
    return { valid: false, error: `Unsupported WebP sub-format (${chunkType})`, code: "UNSUPPORTED_FORMAT" };
  }

  if (width === 0 || height === 0) {
    return { valid: false, error: "Invalid WebP dimensions", code: "INVALID_DIMENSIONS" };
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return {
      valid: false,
      error: `Image dimensions (${width}x${height}) exceed maximum allowed of ${MAX_DIMENSION}px`,
      code: "DIMENSIONS_EXCEEDED",
    };
  }
  if (width * height > MAX_PIXELS) {
    return {
      valid: false,
      error: `Total pixel count (${width * height}) exceeds maximum allowed of ${MAX_PIXELS}`,
      code: "PIXELS_EXCEEDED",
    };
  }

  return { valid: true, format: "webp", width, height, mimeType: "image/webp" };
}

/**
 * Validates an image buffer against strict signature, dimension, and format constraints.
 * Rejects SVG, HTML polyglots, and unsupported binaries.
 */
function validateImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { valid: false, error: "Empty or invalid buffer", code: "EMPTY_BUFFER" };
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, error: "File size exceeds 5MB limit", code: "FILE_TOO_LARGE" };
  }

  // 1. Reject text/HTML/SVG/XML polyglots
  const headerText = buffer.slice(0, Math.min(buffer.length, 2048)).toString("utf8").toLowerCase();
  if (
    headerText.includes("<svg") ||
    headerText.includes("<?xml") ||
    headerText.includes("<!doctype html") ||
    headerText.includes("<html") ||
    headerText.includes("<script")
  ) {
    return {
      valid: false,
      error: "HTML, XML, and SVG formats are not permitted as profile avatars",
      code: "DISALLOWED_FORMAT",
    };
  }

  // 2. PNG Signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return validatePng(buffer);
  }

  // 3. JPEG Signature: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return validateJpeg(buffer);
  }

  // 4. WebP Signature: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return validateWebp(buffer);
  }

  return {
    valid: false,
    error: "Unsupported image format. Only JPEG, PNG, and WebP are allowed.",
    code: "UNSUPPORTED_FORMAT",
  };
}

/**
 * Validates an image file on disk.
 */
function validateImageFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: "File does not exist", code: "FILE_NOT_FOUND" };
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    return { valid: false, error: "File is empty", code: "EMPTY_FILE" };
  }
  if (stat.size > MAX_FILE_SIZE) {
    return { valid: false, error: "File size exceeds 5MB limit", code: "FILE_TOO_LARGE" };
  }

  const buffer = fs.readFileSync(filePath);
  return validateImageBuffer(buffer);
}

/**
 * Decodes, validates, sanitizes, and re-encodes an image file on disk.
 *
 * Requirements:
 * - Preliminary heuristic checks (size, scripts, magic bytes, basic chunk headers).
 * - Full in-process pixel decoding and rasterization with sharp.
 * - Enforces decoder-level limitInputPixels (16,777,216) before expensive processing.
 * - Rejects malformed, truncated, or undecodable image streams.
 * - Enforces maximum width/height of 4096px and maximum pixel count of 16,777,216.
 * - Normalizes orientation via .rotate() (respects EXIF orientation).
 * - Strips all EXIF, GPS, XMP, IPTC, and non-image metadata.
 * - Re-encodes into normalized WebP image.
 * - Overwrites the local temporary file with the sanitized WebP bytes.
 *
 * @param {string} filePath - Absolute path to the temporary file on disk
 * @returns {Promise<{ valid: boolean, code?: string, error?: string, format?: string, width?: number, height?: number }>}
 */
async function decodeAndSanitizeImage(filePath) {
  // 1. Fast preliminary validation
  const preliminary = validateImageFile(filePath);
  if (!preliminary.valid) {
    return preliminary;
  }

  // 2. Read file into memory buffer to avoid filesystem locking on Windows during overwrite
  let inputBuffer;
  try {
    inputBuffer = fs.readFileSync(filePath);
  } catch (readErr) {
    return {
      valid: false,
      code: "FILE_READ_ERROR",
      error: "Unable to read temporary upload file",
    };
  }

  // 3. Sharp in-process decoding & rasterization
  try {
    const pipeline = sharp(inputBuffer, {
      failOnError: true,
      limitInputPixels: MAX_PIXELS, // 16,777,216: mitigates decompression bombs before decoding pixels
    });

    const metadata = await pipeline.metadata();

    // Verify format strictly from decoder
    const allowedFormats = ["jpeg", "png", "webp"];
    if (!metadata.format || !allowedFormats.includes(metadata.format)) {
      return {
        valid: false,
        code: "UNSUPPORTED_FORMAT",
        error: "Unsupported image format. Only JPEG, PNG, and WebP are allowed.",
      };
    }

    const width = metadata.width || 0;
    const height = metadata.height || 0;
    if (width === 0 || height === 0) {
      return {
        valid: false,
        code: "INVALID_DIMENSIONS",
        error: "Invalid image dimensions: zero width or height",
      };
    }

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      return {
        valid: false,
        code: "DIMENSIONS_EXCEEDED",
        error: `Image dimensions (${width}x${height}) exceed maximum allowed of ${MAX_DIMENSION}px`,
      };
    }

    if (width * height > MAX_PIXELS) {
      return {
        valid: false,
        code: "PIXELS_EXCEEDED",
        error: `Total pixel count (${width * height}) exceeds maximum allowed of ${MAX_PIXELS}`,
      };
    }

    // 4. Re-encode & Strip metadata:
    // .rotate() normalizes EXIF orientation and removes the EXIF orientation tag
    // .webp() produces a normalized WebP bitstream, stripping EXIF, GPS, comments, and polyglots
    const sanitizedBuffer = await pipeline
      .rotate()
      .webp({ quality: 90, effort: 4 })
      .toBuffer();

    // 5. Overwrite temporary file on disk with sanitized WebP buffer
    fs.writeFileSync(filePath, sanitizedBuffer);

    return {
      valid: true,
      format: "webp",
      width,
      height,
      mimeType: "image/webp",
      size: sanitizedBuffer.length,
    };
  } catch (err) {
    const msg = err.message || "";
    if (msg.includes("pixel limit") || msg.includes("exceeds pixel limit")) {
      return {
        valid: false,
        code: "PIXELS_EXCEEDED",
        error: `Total pixel count exceeds maximum allowed of ${MAX_PIXELS}`,
      };
    }
    return {
      valid: false,
      code: "MALFORMED_IMAGE",
      error: "Malformed or truncated image file",
    };
  }
}

module.exports = {
  validateImageBuffer,
  validateImageFile,
  decodeAndSanitizeImage,
  MAX_FILE_SIZE,
  MAX_DIMENSION,
  MAX_PIXELS,
};
