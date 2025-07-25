const mongoose = require('mongoose');
const CourseFile = require('../../models/CourseFile');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const Course = require('../../models/Course');

// Create Course File
exports.createCourseFile = [
  body('num')
    .isInt({ min: 1 })
    .withMessage('يجب إدخال رقم ملف صحيح أكبر من الصفر.'),
  body('course').isMongoId().withMessage('معرف الدورة غير صحيح.'),
  body('file.filename')
    .optional()
    .isString()
    .withMessage('اسم الملف يجب أن يكون نصاً.'),
  body('file.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط الملف يجب أن يكون نصاً.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify course exists
      const courseExists = await Course.exists({ _id: req.body.course });
      if (!courseExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الدورة.' });
      }

      // Create course file
      const courseFile = new CourseFile({
        num: req.body.num,
        course: req.body.course,
        file: req.body.file || {},
      });

      await courseFile.save();

      res.status(201).json({
        _id: courseFile._id,
        num: courseFile.num,
        course: courseFile.course,
        file: courseFile.file,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          error: `الملف رقم ${req.body.num} موجود مسبقاً في هذه الدورة`,
        });
      }
      res.status(500).json({
        error: err.message || 'حدث خطأ أثناء إنشاء ملف الدورة.',
      });
    }
  },
];

// Get Course Files by Course
exports.getCourseFilesByCourse = [
  param('courseId').isMongoId().withMessage('معرف الدورة غير صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify course exists
      const courseExists = await Course.exists({ _id: req.params.courseId });
      if (!courseExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الدورة.' });
      }

      const courseFiles = await CourseFile.find({ course: req.params.courseId })
        .select('num course file')
        .sort({ num: 1 })
        .lean();

      res.status(200).json({
        files: courseFiles,
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || 'حدث خطأ أثناء استرجاع ملفات الدورة.',
      });
    }
  },
];

// Delete Course File
exports.deleteCourseFile = [
  param('id').isMongoId().withMessage('معرف الملف غير صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Find the course file
      const courseFile = await CourseFile.findById(req.params.id);
      if (!courseFile) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الملف.' });
      }

      // Delete the file
      await CourseFile.findByIdAndDelete(req.params.id);

      res.status(200).json({
        message: 'تم حذف الملف بنجاح.',
        deletedFile: {
          _id: courseFile._id,
          num: courseFile.num,
        },
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || 'حدث خطأ أثناء حذف الملف.',
      });
    }
  },
];
