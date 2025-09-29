const mongoose = require('mongoose');
const Files = require('../../models/file');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const Material = require('../../models/Material');

// إنشاء محاضرة جديدة
exports.createfiles = [
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

      if (!['أوراق ذهبية', 'نوط', 'نموذج وزاري'].includes(req.body.type)) {
    return res.status(400).json({ message: 'نوع الملف غير صالح' });
  }
      // إنشاء المحاضرة
      const files = new Files({
        num: req.body.num,
        material: req.body.material,
        file: req.body.file || {},
        type:req.body.type
      });

      await files.save();

      res.status(201).json({
        _id: files._id,
        num: files.num,
        material: files.material,
        file: files.file,
        type:files.type
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

exports.updatefiles = [
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
      const existingfiles = await Files.findById(req.params.id);
      if (!existingfiles) {
        return res.status(404).json({ error: 'المحاضرة غير موجودة.' });
      }

      const updateData = {};
      const bunnyDeletions = [];

      // معالجة تحديث الرقم
      if (req.body.num !== undefined) {
        updateData.num = req.body.num;
        
        // التحقق من عدم تكرار الرقم في نفس المادة
        const duplicate = await Files.findOne({
          material: existingfiles.material,
          num: req.body.num,
          _id: { $ne: existingfiles._id }
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
        if (existingfiles.file?.accessUrl) {
          bunnyDeletions.push(existingfiles.file.accessUrl);
        }
        
        if (req.body.file === null) {
          updateData.file = null;
        } else {
          updateData.file = { 
            ...existingfiles.file.toObject(), 
            ...req.body.file 
          };
        }
      }

      // تحديث البيانات في قاعدة البيانات
      const updatedfiles = await Files.findByIdAndUpdate(
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
        files: updatedfiles,
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


exports.getfilessByMaterial = [
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
      const filess = await Files.find({ material: req.params.materialId })
        .select('num material file type')
        .sort({ num: 1 })
        .lean();

      res.status(200).json({
        filess,
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || 'حدث خطأ أثناء استرجاع المحاضرات.',
      });
    }
  },
];
// حذف محاضرة
exports.deletefiles = [
  param('id').isMongoId().withMessage('معرف المحاضرة غير صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = await Files.findById(req.params.id);
      if (!files) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على المحاضرة.' });
      }

      // حذف المحاضرة
      await Files.findByIdAndDelete(req.params.id);

      res.status(200).json({
        message: 'تم حذف المحاضرة بنجاح.',
        deletedfiles: {
          _id: files._id,
          num: files.num,
        },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء حذف المحاضرة.' });
    }
  },
];
