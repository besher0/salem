const crypto = require('crypto');
const axios = require('axios');

exports.addVideo = async (req, res) => {
  try {
    // 1. Get title from client request
    const { title = Date.now().toString(), collectionId } = req.body;

    // 2. Create video metadata
    const metadataRes = await axios.post(
      `https://video.bunnycdn.com/library/${process.env.BUNNY_LIBRARY_ID}/videos`,
      { title },
      {
        headers: {
          AccessKey: process.env.BUNNY_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    const videoId = metadataRes.data.guid;
    const libraryId = process.env.BUNNY_LIBRARY_ID;

    // 3. Generate TUS authentication headers
    const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour expiry
    const signatureData = `${libraryId}${process.env.BUNNY_API_KEY}${expiration}${videoId}`;
    const authSignature = crypto
      .createHash('sha256')
      .update(signatureData)
      .digest('hex');

    // 4. Return TUS config to client
    res.json({
      tusEndpoint: 'https://video.bunnycdn.com/tusupload',
      headers: {
        AuthorizationSignature: authSignature,
        AuthorizationExpire: expiration,
        VideoId: videoId,
        LibraryId: libraryId,
      },
      metadata: {
        filetype: 'video/*', // Client will replace with actual MIME type
        title: title,
        collection: collectionId || '',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
};
