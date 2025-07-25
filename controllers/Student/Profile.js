const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const Student = require('../../models/Student');
const { body, validationResult } = require('express-validator');
// Get student profile controller
exports.getProfile = async (req, res, next) => {
  try {
    const student = await Student.findById(req.userId)
      .select(
        '-password -resetToken -resetTokenExpiration -redeemedCodes -favorites -__v -updatedAt'
      )
      .lean();

    if (!student) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: 'لم يتم العثور على الطالب.',
      });
    }
    res.status(StatusCodes.OK).json({
      message: 'تم جلب بيانات الملف الشخصي بنجاح.',
      profile: student,
    });
  } catch (error) {
    next(error);
  }
};

// Update profile validation middleware
const validateUpdateProfile = [
  body('fname')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('يجب أن يكون طول الاسم أقل من 50 حرفاً.'),

  body('lname')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('يجب أن يكون طول اسم العائلة أقل من 50 حرفاً.'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('صيغة البريد الإلكتروني غير صحيحة.')
    .normalizeEmail(),

  body('phone')
    .optional()
    .trim()
    .isString()
    .withMessage('رقم الهاتف يجب أن يكون نصاً.'),
  body('image.filename')
    .optional()
    .isString()
    .withMessage('صيغة اسم الملف يجب أن تكون نصاً.'),
  body('image.accessUrl')
    .optional()
    .isString()
    .withMessage('صيغة رابط الوصول غير صحيحة.'),

  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('يجب أن تكون كلمة المرور على الأقل 6 أحرف.'),
];

exports.updateProfile = [
  ...validateUpdateProfile,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ errors: errors.array() });
      }

      const updates = req.body;

      const student = await Student.findById(req.userId);
      // console.log(updates);

      if (!student) {
        return res.status(StatusCodes.NOT_FOUND).json({
          message: 'لم يتم العثور على الطالب.',
        });
      }
  if (updates.email && updates.email !== student.email) {
        // التحقق مما إذا كان البريد الإلكتروني الجديد موجودًا بالفعل لطالب آخر
        const emailExists = await Student.findOne({ email: updates.email });
        if (emailExists) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            message: 'البريد الإلكتروني المدخل موجود بالفعل لحساب آخر!',
          });
        }

        student.email = updates.email; // <<-- هنا يتم التحديث المباشر لأغراض التوضيح
      }
      // Handle phone uniqueness
      if (updates.phone && updates.phone !== student.phone) {
        const phoneExists = await Student.findOne({ phone: updates.phone });
        if (phoneExists) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            message: 'رقم الهاتف موجود بالفعل!',
          });
        }
        student.phone = updates.phone;
      }

      // Update other fields
      const allowedUpdates = ['fname', 'lname', 'image',"email"];
      allowedUpdates.forEach((field) => {
        if (updates[field] !== undefined && field !== 'phone' && field !== 'email' && field !== 'password') {
          student[field] = updates[field];
        }
      });

      await student.save();

      // Get updated profile without sensitive data
      const updatedProfile = await Student.findById(req.userId)
        .select(
          '-password -resetToken -resetTokenExpiration -redeemedCodes -favorites -__v -updatedAt'
        )
        .lean();

      res.status(StatusCodes.OK).json({
        message: 'تم تحديث الملف الشخصي بنجاح.',
        profile: updatedProfile,
      });
    } catch (error) {
      next(error);
    }
  },
];
