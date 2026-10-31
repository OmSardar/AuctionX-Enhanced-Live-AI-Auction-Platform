const fs = require("fs");
const upload = require("../../../common/utilities/multerConfig");
const { uploadToCloudinary } = require("./cloudinaryMiddleware");
const {
  validateImageFile,
  decodeAndSanitizeImage,
} = require("../../../common/utilities/imageSignatureValidator");

const cleanupAllTempFiles = (files) => {
  if (!files) return;
  for (const key of Object.keys(files)) {
    const fileList = Array.isArray(files[key]) ? files[key] : [files[key]];
    for (const f of fileList) {
      if (f && f.path && fs.existsSync(f.path)) {
        try {
          fs.unlinkSync(f.path);
        } catch (e) {
          console.error("Temp file cleanup failed:", e.message);
        }
      }
    }
  }
};

const handleImageUploads = (fields = []) => {
  return (req, res, next) => {
    const uploadMultiple = upload.fields(fields);

    uploadMultiple(req, res, async (err) => {
      if (err) {
        cleanupAllTempFiles(req.files);
        const isLimit = err.code === "LIMIT_FILE_SIZE";
        return res.status(isLimit ? 400 : 400).json({
          success: false,
          code: err.code || "UPLOAD_ERROR",
          message: isLimit ? "File size exceeds 5MB limit" : err.message,
        });
      }

      try {
        const uploadedFiles = {};

        // 1. Pre-validate, decode, sanitize, and re-encode all uploaded files before contacting Cloudinary
        for (const field of fields) {
          const { name } = field;
          if (req.files && req.files[name]) {
            for (const file of req.files[name]) {
              const validation = await decodeAndSanitizeImage(file.path);
              if (!validation.valid) {
                cleanupAllTempFiles(req.files);
                return res.status(400).json({
                  success: false,
                  code: validation.code,
                  message: validation.error,
                });
              }
            }
          }
        }

        // 2. Upload to Cloudinary with guaranteed temp file removal
        for (const field of fields) {
          const { name, folder, transformation } = field;

          if (req.files && req.files[name]) {
            uploadedFiles[name] = [];

            for (const file of req.files[name]) {
              try {
                const result = await uploadToCloudinary(file.path, folder, transformation);
                uploadedFiles[name].push({
                  secure_url: result.secure_url,
                  public_id: result.public_id,
                });
              } finally {
                // Guarantee local temporary file is unlinked on success and failure
                if (file.path && fs.existsSync(file.path)) {
                  try {
                    fs.unlinkSync(file.path);
                  } catch (unlinkErr) {
                    console.error("Temp file cleanup failed:", unlinkErr.message);
                  }
                }
              }
            }
          }
        }

        req.cloudinaryUploads = uploadedFiles;
        next();
      } catch (error) {
        cleanupAllTempFiles(req.files);
        return res.status(500).json({
          success: false,
          code: "CLOUDINARY_UPLOAD_FAILED",
          message: "Image upload to Cloudinary failed.",
        });
      }
    });
  };
};

module.exports = handleImageUploads;
