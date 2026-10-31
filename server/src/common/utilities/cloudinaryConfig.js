const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = async (filePath, folder, transformation) => {
  return await cloudinary.uploader.upload(filePath, {
    folder,
    transformation,
  });
};

const deleteFromCloudinary = async (publicId, options = {}) => {
  const maxAttempts = options.maxAttempts || 3;
  const initialDelayMs =
    options.initialDelayMs !== undefined
      ? options.initialDelayMs
      : process.env.CLOUDINARY_RETRY_DELAY_MS !== undefined
      ? parseInt(process.env.CLOUDINARY_RETRY_DELAY_MS, 10)
      : 500;
  const backoffMultiplier = options.backoffMultiplier || 3;
  const timeoutMs = options.timeoutMs || 3000;

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 2);
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    let timeoutHandle;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Cloudinary destroy timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      const destroyPromise = cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
      });

      const result = await Promise.race([destroyPromise, timeoutPromise]);

      // Cloudinary treats both "ok" and "not found" as successful resolution
      if (result && (result.result === "ok" || result.result === "not found")) {
        return result;
      }

      lastError = new Error(
        `Cloudinary deletion attempt ${attempt} unconfirmed with result: ${result?.result || "unknown"}`
      );
    } catch (err) {
      lastError = err;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  // Persistent failure after bounded retries are exhausted: log safely without leaking secrets
  const failurePayload = {
    event: "CLOUDINARY_CLEANUP_FAILURE",
    public_id: publicId,
    attempts: maxAttempts,
    error: lastError ? lastError.message : "Unknown error",
  };

  try {
    const { logger } = require("../../infrastructure/logging/winstonLogger");
    if (logger && typeof logger.error === "function") {
      logger.error(failurePayload);
    }
  } catch (logErr) {
    // Logger unavailable, console fallback used below
  }
  console.error("CLOUDINARY_CLEANUP_FAILURE:", JSON.stringify(failurePayload));

  throw lastError;
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
};
