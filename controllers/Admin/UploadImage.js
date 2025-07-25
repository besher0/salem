const axios = require('axios');
const multer = require('multer');
// Load your environment variables
const ACCESS_KEY = process.env.BUNNY_STORAGE_API_KEY; // e.g., "your-bunny-storage-api-key"
const STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE_NAME; // e.g., "your-storage-zone-name"
const REGION = ''; // e.g., "ny" or leave empty for German region

const BASE_HOSTNAME = 'storage.bunnycdn.com';
const HOSTNAME = REGION ? `${REGION}.${BASE_HOSTNAME}` : BASE_HOSTNAME;

/**
 * Controller that:
 * 1. Receives an image file (field name "image") via multipart/form-data.
 * 2. Uploads the image file to Bunny Storage using a PUT request.
 * 3. Returns a success response including the file URL.
 */
exports.uploadImage = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Image file is missing.' });
    }

    const filename = Date.now().toString() + '_' + file.originalname;
    const uploadUrl = `https://${HOSTNAME}/${STORAGE_ZONE_NAME}/${filename}`;

    // Upload the file to Bunny Storage
    await axios.put(uploadUrl, file.buffer, {
      headers: {
        AccessKey: ACCESS_KEY,
        'Content-Type': 'application/octet-stream',
      },
    });

    // Construct the public URL for the uploaded file
    const publicUrl = `https://${HOSTNAME}/${STORAGE_ZONE_NAME}/${filename}`;

    res.status(200).json({
      message: 'Image uploaded successfully!',
      file: {
        filename,
        accessUrl: publicUrl,
      },
    });
  } catch (error) {
    console.error(
      'Error uploading image:',
      error.response?.data || error.message
    );
    res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
};
