const { default: axios } = require('axios');
const Material = require('../../models/Material');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');

// Create a new material
exports.createMaterial = [
  body('name').notEmpty().withMessage('اسم المادة مطلوب.'),
  body('color').optional().isString().withMessage('يجب أن يكون اللون نصاً.'),
  body('icon.filename')
    .optional()
    .isString()
    .withMessage('يجب أن يكون اسم الملف نصاً.'),
  body('icon.accessUrl')
    .optional()
    .isString()
    .withMessage('يجب أن يكون رابط الوصول نصاً.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const material = new Material(req.body);
      await material.save();
      const { _id, name, color, icon } = material;
      res.status(201).json({
        material: { _id, name, color, icon },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];

// Get materials with filters
exports.getMaterials = async (req, res) => {
  try {
    const materials = await Material.find().select(
      '-__v -createdAt -updatedAt'
    );
    res.status(200).json(materials);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};
exports.updateMaterial = [
  param('id')
    .isMongoId()
    .withMessage('يرجى إدخال معرف المادة بشكل صحيح.'),
  body('name')
    .optional()
    .notEmpty()
    .withMessage('اسم المادة مطلوب في حالة التحديث.'),
  body('color')
    .optional()
    .isString()
    .withMessage('يجب أن يكون اللون نصاً.'),
  body('icon')
    .optional()
    .custom((value) => {
      if (value === null || (typeof value === 'object' && value !== null)) {
        return true;
      }
      return false;
    })
    .withMessage('يجب أن تكون الأيقونة إما null أو كائن.'),
  body('icon.filename')
    .if(body('icon').exists().isObject())
    .optional()
    .isString()
    .withMessage('يجب أن يكون اسم الملف نصاً.'),
  body('icon.accessUrl')
    .if(body('icon').exists().isObject())
    .optional()
    .isString()
    .withMessage('يجب أن يكون رابط الوصول نصاً.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const existingMaterial = await Material.findById(req.params.id);
      if (!existingMaterial) {
        return res.status(404).json({ error: 'المادة غير موجودة.' });
      }

      const { name, color, icon } = req.body;
      const updateData = { name, color };
      const bunnyDeletions = [];

      // Handle icon updates
      if (req.body.icon !== undefined) {
        if (req.body.icon === null) {
          // Remove icon and mark for deletion
          if (existingMaterial.icon?.accessUrl) {
            bunnyDeletions.push(existingMaterial.icon.accessUrl);
          }
          updateData.icon = null;
        } else {
          // Merge existing and new icon data
          const newIcon = { ...existingMaterial.icon?.toObject(), ...req.body.icon };
          
          // Check if access URL changed
          if (existingMaterial.icon?.accessUrl !== newIcon.accessUrl) {
            if (existingMaterial.icon?.accessUrl) {
              bunnyDeletions.push(existingMaterial.icon.accessUrl);
            }
          }
          
          updateData.icon = newIcon;
        }
      }

      const updatedMaterial = await Material.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).select('-__v -createdAt -updatedAt');

      // Delete old icons from Bunny Storage
      const deletionResults = [];
      for (const accessUrl of bunnyDeletions) {
        try {
          await axios.delete(accessUrl, {
            headers: {
              Accept: 'application/json',
              AccessKey: process.env.BUNNY_STORAGE_API_KEY,
            },
          });
          deletionResults.push({ accessUrl, status: 'success' });
        } catch (error) {
          deletionResults.push({
            accessUrl,
            status: 'error',
            error: error.response?.data || error.message,
          });
        }
      }

      res.status(200).json({
        material: updatedMaterial,
        bunnyDeletions: deletionResults,
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || 'حدث خطأ في الخادم.',
        bunnyDeletions: [],
      });
    }
  },
];
// Delete a material by ID
exports.deleteMaterial = [
  param('id').isMongoId().withMessage('يرجى إدخال معرف المادة بشكل صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const material = await Material.findById(req.params.id);
      if (!material) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على المادة.' });
      }

      const bunnyDeletions = [];
      if (material.icon?.accessUrl) {
        bunnyDeletions.push({
          type: 'icon',
          accessUrl: material.icon.accessUrl,
        });
      }

      await Material.deleteOne({ _id: req.params.id });

      const deletionResults = [];
      for (const file of bunnyDeletions) {
        try {
          await axios.delete(file.accessUrl, {
            headers: {
              Accept: 'application/json',
              AccessKey: process.env.BUNNY_STORAGE_API_KEY,
            },
          });
          deletionResults.push({ type: file.type, status: 'success' });
        } catch (error) {
          deletionResults.push({
            type: file.type,
            status: 'error',
            error: error.response?.data || error.message,
          });
        }
      }

      res.status(200).json({
        message: 'تم حذف المادة بنجاح.',
        details: {
          databaseDeleted: true,
          bunnyDeletions: deletionResults,
        },
      });
    } catch (err) {
      res.status(500).json({
        error: 'حدث خطأ في الخادم.',
        details: {
          databaseDeleted: false,
          bunnyDeletions: [],
        },
      });
    }
  },
];
