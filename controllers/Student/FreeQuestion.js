const { query, validationResult } = require('express-validator');
const httpStatus = require('http-status-codes');
const mongoose = require('mongoose');
const Material = require('../../models/Material');
const Section = require('../../models/Section');
const FreeQuestionGroup = require('../../models/FreeQuestionGroup');

// Get free questions for a material (optionally by section) with paging/limit
exports.getFreeQuestionsByMaterial = [
  query('material').notEmpty().withMessage('material مطلوب').custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('material غير صالح'),
  query('section').optional().custom((v) => mongoose.Types.ObjectId.isValid(v)).withMessage('section غير صالح'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { material, section } = req.query;
  const MAX_PER_SECTION = 5;

      const matExists = await Material.exists({ _id: material });
      if (!matExists) return res.status(404).json({ success: false, message: 'المادة غير موجودة' });
      if (section) {
        const secExists = await Section.exists({ _id: section, material });
        if (!secExists) return res.status(404).json({ success: false, message: 'القسم غير موجود ضمن المادة' });
      }

      const match = { material: new mongoose.Types.ObjectId(material) };
      if (section) match.section = new mongoose.Types.ObjectId(section);

      let pipeline = [ { $match: match } ];
      if (!section) {
        // Random sample up to MAX_PER_SECTION per section using $rand
        pipeline = pipeline.concat([
          { $addFields: { __rand: { $rand: {} } } },
          { $sort: { section: 1, __rand: 1 } },
          { $group: { _id: '$section', docs: { $push: '$$ROOT' } } },
          { $project: { docs: { $slice: [ '$docs', MAX_PER_SECTION ] } } },
          { $unwind: '$docs' },
          { $replaceRoot: { newRoot: '$docs' } },
        ]);
      } else {
        // When a specific section is requested, sample up to MAX_PER_SECTION directly
        pipeline = pipeline.concat([
          { $sample: { size: MAX_PER_SECTION } },
        ]);
      }
      pipeline.push({ $project: { __v: 0, __rand: 0 } });

      const questions = await FreeQuestionGroup.aggregate(pipeline);

  const totalAvailable = await FreeQuestionGroup.countDocuments(match);

      return res.status(200).json({
        success: true,
        data: questions,
        meta: { count: questions.length, perSectionMax: MAX_PER_SECTION, totalAvailable },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message || 'خطأ في الخادم' });
    }
  },
];
