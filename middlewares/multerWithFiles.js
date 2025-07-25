// utils/multerMiddleware.js
const multer = require('multer');
const path = require('path');

// Generic storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir = 'uploads/';
    if (file.fieldname.includes('video')) {
      dir += 'videos';
    } else {
      dir += 'images';
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

// Generic file filter
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const allowedVideoTypes = ['video/mp4', 'video/quicktime'];

  // Dynamically check file type based on fieldname
  if (
    file.fieldname.includes('image') &&
    allowedImageTypes.includes(file.mimetype)
  ) {
    cb(null, true);
  } else if (
    file.fieldname.includes('video') &&
    allowedVideoTypes.includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

// Create a configured Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// Reusable middleware generator
const multerMiddleware = (allowedFields) => {
  return upload.fields(allowedFields);
};

module.exports = multerMiddleware;
