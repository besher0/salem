const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const SellCenter = require('../../models/SellCenter'); // Adjust path as necessary
const { body, param, validationResult } = require('express-validator');

// Create a new sell center
exports.createSellCenter = [
  // Validate input fields
  body('name').notEmpty().withMessage('Name is required.'),
  body('phone').optional().isString().withMessage('Phone must be a string.'),
  body('address')
    .optional()
    .isString()
    .withMessage('address must be a string.'),
  body('image.filename')
    .optional()
    .isString()
    .withMessage('اسم ملف الأيقونة يجب أن يكون نصاً.'),
  body('image.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط وصول الأيقونة يجب أن يكون نصاً.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const sellCenter = new SellCenter(req.body);
      await sellCenter.save();
      const { _id, name, phone, address, image } = sellCenter;

      res
        .status(201)
        .json({ sellCenter: { _id, name, phone, address, image } });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'An error occurred on the server.' });
    }
  },
];


exports.updateSellCenter = [
  // Validate parameters and input fields
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid Sell Center ID.'),
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Name cannot be empty.'),
  body('phone')
    .optional()
    .isString()
    .withMessage('Phone must be a string.'),
  body('address')
    .optional()
    .isString()
    .withMessage('Address must be a string.'),
  body('image.filename')
    .optional()
    .isString()
    .withMessage('اسم ملف الأيقونة يجب أن يكون نصاً.'),
  body('image.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط وصول الأيقونة يجب أن يكون نصاً.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, phone, address, image } = req.body;
      const updateData = { name, phone, address, image };

      // Update and return the modified document
      const updatedSellCenter = await SellCenter.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).select('name phone address image');

      if (!updatedSellCenter) {
        return res.status(404).json({ error: 'Sell Center not found.' });
      }

      res.status(200).json({ sellCenter: updatedSellCenter });
    } catch (err) {
      res.status(500).json({ 
        error: err.message || 'An error occurred while updating the sell center.' 
      });
    }
  },
];

exports.getSellCenters = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const sellCenters = await SellCenter.paginate(
      {},
      {
        page: page || 1,
        limit: limit || 10,
        select: 'name phone address image',
      }
    );
    res.status(200).json(sellCenters);
  } catch (err) {
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
};

exports.deleteSellCenter = [
  param('id').isMongoId().withMessage('Please provide a valid Sell Center ID.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const sellCenter = await SellCenter.findByIdAndDelete(req.params.id);
      if (!sellCenter) {
        return res.status(404).json({ error: 'Sell Center not found.' });
      }

      res.status(200).json({ message: 'Sell Center successfully deleted.' });
    } catch (err) {
      res.status(500).json({ error: 'An error occurred on the server.' });
    }
  },
];
