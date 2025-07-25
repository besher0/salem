const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const { body, param, validationResult } = require('express-validator');

// Models
const Admin = require('../../models/Admin');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');

exports.createAdmin = [
  // Validate only complex fields
  body('fname').isString().withMessage('يرجى إدخال الاسم الأول كنص.'),
  body('lname')
    .optional()
    .isString()
    .withMessage('يرجى إدخال اسم العائلة كنص.'),
  body('password').isString().withMessage('يرجى إدخال كلمة المرور كنص.'),
  body('phone').isNumeric().withMessage('يرجى إدخال رقم الهاتف بشكل صحيح.'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      await ensureIsAdmin(req.userId);
      const { fname, lname, phone, password } = req.body;

      const existingAdmin = await Admin.findOne({ phone });
      if (existingAdmin) {
        return res
          .status(400)
          .json({ message: 'عذرًا، يبدو أن رقم الهاتف هذا مسجل بالفعل.' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const admin = new Admin({
        fname,
        lname,
        phone,
        password: hashedPassword,
      });
      await admin.save();
      res
        .status(201)
        .json({ message: 'تمت إضافة المسؤول بنجاح، مرحبًا بك معنا!' });
    } catch (err) {
      if (!err.statusCode && !err[0]) err.statusCode = 500;
      next(err);
    }
  },
];

// Login Admin
exports.login = [
  body('phone').isNumeric().withMessage('يرجى إدخال رقم الهاتف بشكل صحيح.'),
  body('password').isString().withMessage('يرجى إدخال كلمة المرور كنص.'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { phone, password } = req.body;
      const loadedAdmin = await Admin.findOne({ phone });

      if (!loadedAdmin) {
        return res.status(400).json({
          message:
            'رقم الهاتف أو كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.',
        });
      }
      const isEqual = await bcrypt.compare(password, loadedAdmin.password);
      if (!isEqual) {
        return res.status(400).json({
          message:
            'رقم الهاتف أو كلمة المرور غير صحيحة، يرجى التأكد والمحاولة مجددًا.',
        });
      }
      const token = jwt.sign(
        {
          phone: loadedAdmin.phone,
          userId: loadedAdmin._id,
        },
        'thisismysecretkey'
      );
      res.status(200).json({
        message: 'تم تسجيل الدخول بنجاح',
        token: `Bearer ${token}`,
      });
    } catch (error) {
      if (!error.statusCode && !error[0]) error.statusCode = 500;
      next(error);
    }
  },
];
exports.updatePassword = [
  body('currentPassword')
    .isString()
    .withMessage('يرجى إدخال كلمة المرور الحالية كنص.'),
  body('newPassword')
    .isString()
    .withMessage('يرجى إدخال كلمة المرور الجديدة كنص.'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.userId; // تأكد من أن req.userId تم تعيينه بعد التحقق من JWT

      const loadedAdmin = await Admin.findById(userId);
      if (!loadedAdmin) {
        return res.status(404).json({ message: 'المسؤول غير موجود.' });
      }

      const isEqual = await bcrypt.compare(
        currentPassword,
        loadedAdmin.password
      );
      if (!isEqual) {
        return res
          .status(400)
          .json({ message: 'كلمة المرور الحالية غير صحيحة.' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      loadedAdmin.password = hashedPassword;
      await loadedAdmin.save();

      res.status(200).json({ message: 'تم تحديث كلمة المرور بنجاح.' });
    } catch (error) {
      next(error);
    }
  },
];
