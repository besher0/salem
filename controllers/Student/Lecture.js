const Lecture = require('../../models/Lecture');
const CodesGroup = require('../../models/CodesGroup');
const Student = require('../../models/Student');
const mongoose = require('mongoose');

exports.getLectures = async (req, res) => {
  try {
    console.log('hit');
    const { material } = req.params;
    const studentId = req.userId;

    // Validate input
    if (!material) {
      return res.status(400).json({ message: 'معرف المادة مطلوب.' });
    }
    if (!mongoose.Types.ObjectId.isValid(material)) {
      return res.status(400).json({ message: 'صيغة معرف المادة غير صالحة.' });
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
      materialsWithLectures: materialId,
    });

    // Get all lectures sorted by number
    let lectures = await Lecture.find({ material: materialId })
      .sort({ num: 1 })
      .lean();

    // Modify response based on access
    if (!hasFullAccess) {
      lectures = lectures.map((lecture, index) => {
        // Always return full details for first lecture
        if (index === 0) return lecture;

        // For other lectures, remove accessUrl but keep filename
        const sanitizedFile = lecture.file
          ? {
              filename: lecture.file.filename,
            }
          : null;

        return {
          ...lecture,
          file: sanitizedFile,
        };
      });
    }

    res.status(200).json({
      message: 'تم جلب المحاضرات بنجاح.',
      data: {
        lectures,
        hasFullAccess: !!hasFullAccess,
      },
    });
  } catch (err) {
    console.error('Error in getLectures:', err);
    res.status(500).json({
      error: 'حدث خطأ في الخادم.',
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    });
  }
};
