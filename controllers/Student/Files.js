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

const files = require('../../models/file');
const CodesGroup = require('../../models/CodesGroup');
const Student = require('../../models/Student');
const mongoose = require('mongoose');

exports.getfiless = async (req, res) => {
  try {
    console.log('hit');
    const { material } = req.params;
    const { type } = req.query;
    const studentId = req.userId;

    // Validate input
    if (!material) {
      return res.status(400).json({ message: 'معرف المادة مطلوب.' });
    }
    if (!mongoose.Types.ObjectId.isValid(material)) {
      return res.status(400).json({ message: 'صيغة معرف المادة غير صالحة.' });
    }

    const validTypes = ['أوراق ذهبية', 'نوط', 'نموذج وزاري'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ message: 'نوع الملف غير صالح. يجب أن يكون أحد القيم: ' + validTypes.join(', ') });
    }

    const materialId = new mongoose.Types.ObjectId(material);

    // Get student with redeemed codes
    const student = await Student.findById(studentId)
      .select('redeemedCodes')
      .lean();
    if (!student) {
      return res.status(404).json({ message: 'الطالب غير موجود.' });
    }

    const now = new Date();

    // Check if student has full access
    const hasFullAccess = await CodesGroup.exists({
      _id: { $in: student.redeemedCodes.map((rc) => rc.codesGroup) },
      expiration: { $gt: now },
      'codes.value': { $in: student.redeemedCodes.map((rc) => rc.code) },
      'codes.isUsed': true,
      materialsWithfiless: materialId,
    });

    const filter = { material: materialId };
    if (type) {
      filter.type = type; // إضافة فلترة حسب type إذا تم تمريره
    }

    // Get all filess sorted by number
    let filess = await files.find({ material: materialId })
      .sort({ num: 1 })
      .lean();

    // Modify response based on access
    if (!hasFullAccess) {
      filess = filess.map((files, index) => {
        // Always return full details for first files
        if (index === 0) return files;

        // For other filess, remove accessUrl but keep filename
        const sanitizedFile = files.file
          ? {
              filename: files.file.filename,
            }
          : null;

        return {
          ...files,
          file: sanitizedFile,
        };
      });
    }

    res.status(200).json({
      message: 'تم جلب المحاضرات بنجاح.',
      data: {
        filess,
        hasFullAccess: !!hasFullAccess,
      },
    });
  } catch (err) {
    console.error('Error in getfiless:', err);
    res.status(500).json({
      error: 'حدث خطأ في الخادم.',
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    });
  }
};
