const mongoose = require('mongoose');
const Lesson = require('../../models/Lesson');
const Unit = require('../../models/Unit');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');

// Create a new lesson
exports.createLesson = [
  body('name').notEmpty().withMessage('يرجى إدخال اسم الدرس.'),
  body('color')
    .optional()
    .isString()
    .withMessage('لون الدرس يجب أن يكون نصاً.'),
  body('icon.filename')
    .optional()
    .isString()
    .withMessage('اسم ملف الأيقونة يجب أن يكون نصاً.'),
  body('icon.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط وصول الأيقونة يجب أن يكون نصاً.'),
  body('unit').isMongoId().withMessage('معرف الوحدة غير صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if the referenced Unit exists
      const unitExists = await Unit.exists({ _id: req.body.unit });
      if (!unitExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الوحدة.' });
      }

      const lesson = new Lesson(req.body);
      await lesson.save();
      const { _id, name, color, icon, unit } = lesson;
      res.status(201).json({
        lesson: {
          _id,
          name,
          color,
          icon,
          unit,
        },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];

// Retrieve lessons with optional filters and pagination
exports.getLessons = async (req, res) => {
  try {
    const { page, limit, name, unit } = req.query;
    const filter = {};

    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    if (unit) {
      // Validate that the unit exists
      const unitExists = await Unit.exists({ _id: unit });
      if (!unitExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الوحدة.' });
      }
      filter.unit = new mongoose.Types.ObjectId(unit);
    }

    const lessons = await Lesson.paginate(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      select: 'name color icon unit',
    });

    res.status(200).json(lessons);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
  }
};

// Delete a lesson by ID
exports.deleteLesson = [
  param('id').isMongoId().withMessage('يرجى إدخال رقم تعريف الدرس بشكل صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const lesson = await Lesson.findByIdAndDelete(req.params.id);
      if (!lesson) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الدرس.' });
      }
      res.status(200).json({ message: 'تم حذف الدرس بنجاح.' });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];

// Update Lesson controller
exports.updateLesson = [
  param('id').isMongoId().withMessage('يرجى إدخال رقم تعريف الدرس بشكل صحيح.'),
  body('name').optional().notEmpty().withMessage('يرجى إدخال اسم الدرس.'),
  body('color')
    .optional()
    .isString()
    .withMessage('لون الدرس يجب أن يكون نصاً.'),
  body('icon.filename')
    .optional()
    .isString()
    .withMessage('اسم ملف الأيقونة يجب أن يكون نصاً.'),
  body('icon.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط وصول الأيقونة يجب أن يكون نصاً.'),
  body('unit').optional().isMongoId().withMessage('معرف الوحدة غير صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if lesson exists
      const lesson = await Lesson.findById(req.params.id);
      if (!lesson) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الدرس.' });
      }

      // Check if new unit exists if provided
      if (req.body.unit) {
        const unitExists = await Unit.exists({ _id: req.body.unit });
        if (!unitExists) {
          return res
            .status(400)
            .json({ message: 'عذراً، لم يتم العثور على الوحدة.' });
        }
      }

      const updatedLesson = await Lesson.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      ).select('_id name color icon unit');

      res.status(200).json({
        message: 'تم تحديث الدرس بنجاح.',
        lesson: updatedLesson,
      });
    } catch (err) {
      res.status(err.statusCode || 500).json({
        error: err.message || 'حدث خطأ أثناء معالجة الطلب.',
      });
    }
  },
];
