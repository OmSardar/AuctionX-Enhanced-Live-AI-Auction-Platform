const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure local storage for multer (temporary storage before uploading to Cloudinary)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "./uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// File filter function
const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"));
  }
};

// Configure multer for upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter,
});

// Middleware to handle uploads
const handleImageUploads = async (req, res, next) => {
  // Use multer middleware for file upload
  const uploadMultiple = upload.fields([
    { name: "productImages", maxCount: 4 },
    { name: "bannerImage", maxCount: 1 },
  ]);

  uploadMultiple(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    try {
      // Process product images
      if (req.files && req.files.productImages) {
        const productImages = [];

        for (const file of req.files.productImages) {
          // Upload to Cloudinary with transformation
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "products",
            transformation: [{ width: 1000, height: 1000, crop: "limit" }],
          });

          // Add to images array
          productImages.push({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });

          // Delete local file
          fs.unlinkSync(file.path);
        }

        // Add to request object for controller to use
        req.productImages = productImages;
      }

      // Process banner image if it exists
      if (req.body.hasBanner === "true" && req.files && req.files.bannerImage) {
        const bannerFile = req.files.bannerImage[0];

        // Upload to Cloudinary with banner transformation
        const result = await cloudinary.uploader.upload(bannerFile.path, {
          folder: "banners",
          transformation: [{ width: 1200, height: 300, crop: "fill" }],
        });

        // Add to request object
        req.bannerImage = {
          secure_url: result.secure_url,
          public_id: result.public_id,
        };

        // Delete local file
        fs.unlinkSync(bannerFile.path);
      }

      next();
    } catch (error) {
      // Clean up any uploaded files
      if (req.files) {
        Object.keys(req.files).forEach((key) => {
          req.files[key].forEach((file) => {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });
        });
      }

      return res.status(500).json({
        success: false,
        message: "Error uploading images to Cloudinary",
      });
    }
  });
};

// Helper function to delete images from Cloudinary with bounded retries and exponential backoff
const { deleteFromCloudinary } = require("../../../common/utilities/cloudinaryConfig");

const uploadToCloudinary = async (filePath, folder, transformation) => {
  return await cloudinary.uploader.upload(filePath, {
    folder,
    transformation,
  });
};

module.exports = {
  cloudinary,
  handleImageUploads,
  deleteFromCloudinary,
  uploadToCloudinary,
};
