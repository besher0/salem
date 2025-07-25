const multer = require('multer');

// Define allowed image file types
const allowedMimeTypes = [
  'image/jpeg', // JPEG
  'image/png', // PNG
  'image/gif', // GIF
  'image/webp', // WebP
  'image/svg+xml', // SVG
  'image/tiff', // TIFF
  'image/bmp', // BMP
  'image/x-icon', // ICO
];

// Configure multer with memory storage and file filter
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Check the file's MIME type
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true); // Accept the file
    } else {
      cb(new Error('Only image files are allowed!'), false); // Reject the file
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // Optional: Limit file size to 10MB
  },
});

// Middleware for handling single image uploads
const BunnyImageUploader = upload.single('image'); // 'image' is the field name in the form-data
module.exports = BunnyImageUploader;
