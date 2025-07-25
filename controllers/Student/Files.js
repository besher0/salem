const { default: axios } = require('axios');
const API_KEY = process.env.BUNNY_API_KEY;
exports.getResolutions = async (req, res) => {
  const { videoId, libraryId } = req.query;
  try {
    const playDataUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}/play?expires=0`;
    const videoPlayData = await axios.get(playDataUrl, {
      AccessKey: API_KEY,
    });
    // console.log(videoPlayData);
    let resolutions = videoPlayData?.data?.video?.availableResolutions;
    if (resolutions) {
      const resolutionsArray = resolutions.split(',');
      resolutions = resolutionsArray.sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        return numA - numB;
      });
    }
    res.status(200).json({ message: 'Available Resolutions: ', resolutions });
  } catch (error) {
    console.error(
      'Error fetching abailable resolutions: ',
      error.response?.data || error.message
    );
    res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
};
