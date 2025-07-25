const { query, validationResult } = require('express-validator');
const Student = require('../../models/Student');
const Course = require('../../models/Course');
const Video = require('../../models/Video');
const Material = require('../../models/Material');
const mongoosePaginate = require('mongoose-paginate-v2');

exports.getFreeCourses = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('يجب أن يكون رقم الصفحة عدداً صحيحاً موجباً')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('يجب أن يكون الحد الأقصى للعناصر عدداً صحيحاً موجباً')
    .toInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { page, limit } = req.query;
      // Get courses for these materials
      const courses = await Course.paginate(
        {},
        {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
          populate: [
            { path: 'material', select: 'name' },
            { path: 'teacher', select: 'fname lname' },
          ],
          select: '-__v -createdAt -updatedAt',
        }
      );

      res.status(200).json(courses);
    } catch (err) {
      res.status(err.statusCode || 500).json({
        error: err.message || 'حدث خطأ في الخادم.',
      });
    }
  },
];

exports.getFreeVideos = [
  query('course')
    .isMongoId()
    .withMessage('معرف الدورة يجب أن يكون معرفاً نصاً'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('يجب أن يكون رقم الصفحة عدداً صحيحاً موجباً')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('يجب أن يكون الحد الأقصى للعناصر عدداً صحيحاً موجباً')
    .toInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { page, limit, course } = req.query;
      // Get videos for the course
      const videos = await Video.paginate(
        { course },
        {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 10,
          select: '-video720 -__v -createdAt -updatedAt -course -seekPoints',
        }
      );

      res.status(200).json(videos);
    } catch (err) {
      res.status(err.statusCode || 500).json({
        error: err.message || 'حدث خطأ في الخادم.',
      });
    }
  },
];
