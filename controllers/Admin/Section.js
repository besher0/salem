const mongoose = require('mongoose');
const Section = require('../../models/Section');
const Material = require('../../models/Material');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');

// Create a new Section
exports.createSection = [
  body('name').notEmpty().withMessage('يرجى إدخال اسم الوحدة.'),
  body('color')
    .optional()
    .isString()
    .withMessage('لون الوحدة يجب أن يكون نصاً.'),
  body('icon.filename')
    .optional()
    .isString()
    .withMessage('اسم ملف الأيقونة يجب أن يكون نصاً.'),
  body('icon.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط وصول الأيقونة يجب أن يكون نصاً.'),
  body('material').isMongoId().withMessage('معرف المادة غير صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if the referenced Material exists
      const materialExists = await Material.exists({ _id: req.body.material });
      if (!materialExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المادة.' });
      }

      const Section = new Section(req.body);
      await Section.save();
      const { _id, name, color, icon, material } = Section;
      res.status(201).json({
        Section: {
          _id,
          name,
          color,
          icon,
          material,
        },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];

// Retrieve Sections with optional filters and pagination
exports.getSections = async (req, res) => {
  try {
    const { page = 1, limit = 10, name, material } = req.query;
    const filter = {};

    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    if (material) {
      // Validate that the material exists
      const materialExists = await Material.exists({ _id: material });
      if (!materialExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المادة.' });
      }
      filter.material = new mongoose.Types.ObjectId(material);
    }

    const aggregateQuery = Section.aggregate()
      .match(filter)
      .lookup({
        from: 'Sections', // collection name for Section documents
        localField: '_id', // the field in Section to match on
        foreignField: 'Section', // the field in Section referencing Section
        as: 'Sections',
      })
      .addFields({
        SectionCount: { $size: '$Sections' },
      })
      .project({ Sections: 0 }); // Optionally remove the Sections array

    // Apply skip and limit for pagination
    aggregateQuery.skip((parseInt(page, 10) - 1) * (parseInt(limit, 10) || 10));
    aggregateQuery.limit(parseInt(limit, 10) || 10);

    const SectionsWithCount = await aggregateQuery.exec();

    res.status(200).json(SectionsWithCount);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
  }
};

// Delete a Section by ID
exports.deleteSection = [
  param('id').isMongoId().withMessage('يرجى إدخال رقم تعريف الوحدة بشكل صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const Section = await Section.findByIdAndDelete(req.params.id);
      if (!Section) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الوحدة.' });
      }
      res.status(200).json({ message: 'تم حذف الوحدة بنجاح.' });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];

// Update Section controller
exports.updateSection = [
  param('id').isMongoId().withMessage('يرجى إدخال رقم تعريف الوحدة بشكل صحيح.'),
  body('name').optional().notEmpty().withMessage('يرجى إدخال اسم الوحدة.'),
  body('color')
    .optional()
    .isString()
    .withMessage('لون الوحدة يجب أن يكون نصاً.'),
  body('icon.filename')
    .optional()
    .isString()
    .withMessage('اسم ملف الأيقونة يجب أن يكون نصاً.'),
  body('icon.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط وصول الأيقونة يجب أن يكون نصاً.'),
  body('material').optional().isMongoId().withMessage('معرف المادة غير صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if Section exists
      const Section = await Section.findById(req.params.id);
      if (!Section) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الوحدة.' });
      }

      // Check if new material exists if provided
      if (req.body.material) {
        const materialExists = await Material.exists({
          _id: req.body.material,
        });
        if (!materialExists) {
          return res
            .status(400)
            .json({ message: 'عذراً، لم يتم العثور على المادة.' });
        }
      }

      const updatedSection = await Section.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      ).select('_id name color icon material');

      res.status(200).json({
        message: 'تم تحديث الوحدة بنجاح.',
        Section: updatedSection,
      });
    } catch (err) {
      res.status(err.statusCode || 500).json({
        error: err.message || 'حدث خطأ أثناء معالجة الطلب.',
      });
    }
  },
];
