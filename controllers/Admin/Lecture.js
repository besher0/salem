const mongoose = require('mongoose');
const Lecture = require('../../models/Lecture');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const Material = require('../../models/Material');

// إنشاء محاضرة جديدة
exports.createLecture = [
  body('num')
    .isInt({ min: 1 })
    .withMessage('يجب إدخال رقم محاضرة صحيح أكبر من الصفر.'),
  body('material').isMongoId().withMessage('معرف المادة غير صحيح.'),
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

      // التحقق من وجود المادة
      const materialExists = await Material.exists({ _id: req.body.material });
      if (!materialExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المادة.' });
      }

      // إنشاء المحاضرة
      const lecture = new Lecture({
        num: req.body.num,
        material: req.body.material,
        file: req.body.file || {},
      });

      await lecture.save();

      res.status(201).json({
        _id: lecture._id,
        num: lecture.num,
        material: lecture.material,
        file: lecture.file,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          error: `المحاضرة رقم ${req.body.num} موجودة مسبقاً في هذه المادة`,
        });
      }
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء إنشاء المحاضرة.' });
    }
  },
];

exports.updateLecture = [
  param('id').isMongoId().withMessage('معرف المحاضرة غير صحيح.'),
  body('num')
    .optional()
    .isInt({ min: 1 })
    .withMessage('يجب أن يكون رقم المحاضرة عدد صحيح أكبر من الصفر.'),
  body('material')
    .optional()
    .isMongoId()
    .withMessage('معرف المادة غير صحيح.'),
  body('file')
    .optional()
    .custom((value) => {
      if (value === null || (typeof value === 'object' && !Array.isArray(value))) {
        return true;
      }
      return false;
    })
    .withMessage('يجب أن يكون الملف إما null أو كائن.'),
  body('file.filename')
    .if(body('file').exists().isObject())
    .optional()
    .isString()
    .withMessage('اسم الملف يجب أن يكون نصاً.'),
  body('file.accessUrl')
    .if(body('file').exists().isObject())
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

      // البحث عن المحاضرة الحالية
      const existingLecture = await Lecture.findById(req.params.id);
      if (!existingLecture) {
        return res.status(404).json({ error: 'المحاضرة غير موجودة.' });
      }

      const updateData = {};
      const bunnyDeletions = [];

      // معالجة تحديث الرقم
      if (req.body.num !== undefined) {
        updateData.num = req.body.num;
        
        // التحقق من عدم تكرار الرقم في نفس المادة
        const duplicate = await Lecture.findOne({
          material: existingLecture.material,
          num: req.body.num,
          _id: { $ne: existingLecture._id }
        });
        
        if (duplicate) {
          return res.status(400).json({
            error: `رقم المحاضرة ${req.body.num} موجود مسبقاً في هذه المادة.`
          });
        }
      }

      // معالجة تحديث المادة
      if (req.body.material) {
        const materialExists = await Material.exists({ _id: req.body.material });
        if (!materialExists) {
          return res.status(400).json({ error: 'المادة المحددة غير موجودة.' });
        }
        updateData.material = req.body.material;
      }

      // معالجة تحديث الملف
      if (req.body.file !== undefined) {
        // تحديد الملف القديم للحذف
        if (existingLecture.file?.accessUrl) {
          bunnyDeletions.push(existingLecture.file.accessUrl);
        }
        
        if (req.body.file === null) {
          updateData.file = null;
        } else {
          updateData.file = { 
            ...existingLecture.file.toObject(), 
            ...req.body.file 
          };
        }
      }

      // تحديث البيانات في قاعدة البيانات
      const updatedLecture = await Lecture.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).select('num material file');

      // حذف الملفات القديمة من BunnyCDN
      const deletionResults = [];
      for (const accessUrl of bunnyDeletions) {
        try {
          await axios.delete(accessUrl, {
            headers: {
              Accept: 'application/json',
              AccessKey: process.env.BUNNY_STORAGE_API_KEY,
            }
          });
          deletionResults.push({ accessUrl, status: 'success' });
        } catch (error) {
          deletionResults.push({
            accessUrl,
            status: 'error',
            error: error.response?.data || error.message
          });
        }
      }

      res.status(200).json({
        lecture: updatedLecture,
        bunnyDeletions: deletionResults
      });

    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          error: 'رقم المحاضرة موجود مسبقاً في المادة الجديدة.'
        });
      }
      res.status(500).json({
        error: err.message || 'حدث خطأ أثناء تحديث المحاضرة.',
        bunnyDeletions: []
      });
    }
  },
];

// controllers/lectureController.js

exports.getLecturesByMaterial = [
  param('materialId').isMongoId().withMessage('معرف المادة غير صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // التحقق من وجود المادة
      const materialExists = await Material.exists({
        _id: req.params.materialId,
      });
      if (!materialExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المادة.' });
      }
      const lectures = await Lecture.find({ material: req.params.materialId })
        .select('num material file')
        .sort({ num: 1 })
        .lean();

      res.status(200).json({
        lectures,
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || 'حدث خطأ أثناء استرجاع المحاضرات.',
      });
    }
  },
];
// حذف محاضرة
exports.deleteLecture = [
  param('id').isMongoId().withMessage('معرف المحاضرة غير صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // البحث عن المحاضرة
      const lecture = await Lecture.findById(req.params.id);
      if (!lecture) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على المحاضرة.' });
      }

      // حذف المحاضرة
      await Lecture.findByIdAndDelete(req.params.id);

      res.status(200).json({
        message: 'تم حذف المحاضرة بنجاح.',
        deletedLecture: {
          _id: lecture._id,
          num: lecture.num,
        },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء حذف المحاضرة.' });
    }
  },
];
