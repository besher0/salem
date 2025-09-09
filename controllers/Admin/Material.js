const { default: axios } = require('axios');
const Material = require('../../models/Material');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');

// Create a new material
// createMaterial (بدل الموجود)
exports.createMaterial = async (req, res) => {
  try {
    const { name, description, icon } = req.body; // icon اختياري
    if (!name) return res.status(400).json({ success: false, message: 'الاسم مطلوب' });

    const material = await Material.create({
      name,
      description: description || '',
      icon: icon || null, // ← اختياري
    });

    return res.json({ success: true, data: material });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// updateMaterial (بدل الموجود)
exports.updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon } = req.body;

    const material = await Material.findByIdAndUpdate(
      id,
      {
        ...(name ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        // icon اختياري: لو بعته null معناته حذف، لو ما بعته ما يغيّر
        ...(icon !== undefined ? { icon } : {}),
      },
      { new: true }
    );

    if (!material) return res.status(404).json({ success: false, message: 'لم يتم العثور على المادة' });
    return res.json({ success: true, data: material });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};


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
