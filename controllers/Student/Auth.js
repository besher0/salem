const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const Student = require('../../models/Student');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// controllers/auth.js
const Otp = require('../../models/Otp');
const { default: axios } = require('axios');

exports.sendOtp = async (req, res) => {
  const { email } = req.body;
  try {
    // // Validate email format.
    // if (!/^\S+@\S+\.\S+$/.test(email)) {
    //   return res.status(StatusCodes.BAD_REQUEST).json({
    //     message: 'صيغة البريد الإلكتروني غير صالحة',
    //   });
    // }

    // Check if email is already registered.
    const existingStudent = await Student.findOne({ email });
    if (existingStudent) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'البريد الإلكتروني مسجل مسبقاً',
      });
    }

    const now = new Date();

    // Attempt to find an existing OTP record for the email.
    let otpDoc = await Otp.findOne({ email });

    // Generate a secure 6-digit OTP.
    // Note: crypto.randomInt(100000, 1000000) ensures a six-digit value (upper bound is exclusive).
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // OTP valid for 5 minutes

    // If no record exists, or the current 12-hour window has passed, create/reset the document.
    if (!otpDoc || now - otpDoc.firstOtpSentAt >= 12 * 60 * 60 * 1000) {
      otpDoc = await Otp.findOneAndUpdate(
        { email },
        {
          otp,
          expiresAt,
          attempts: 1, // first attempt
          firstOtpSentAt: now, // reset the window
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );
    } else {
      // If the user has already requested 3 times in the current window, block further requests.
      if (otpDoc.attempts >= 3) {
        const nextAvailable = new Date(
          otpDoc.firstOtpSentAt.getTime() + 12 * 60 * 60 * 1000
        );
        return res
          .status(StatusCodes.TOO_MANY_REQUESTS)
          .set(
            'Retry-After',
            Math.ceil((nextAvailable.getTime() - now.getTime()) / 1000)
          )
          .json({
            message:
              'لقد تجاوزت الحد المسموح من المحاولات. يرجى المحاولة مرة أخرى بعد 12 ساعة',
            retryAfter: nextAvailable.toISOString(),
          });
      }
      // Otherwise, update the existing record with a new OTP and increment the attempt counter.
      otpDoc = await Otp.findOneAndUpdate(
        { email },
        {
          otp,
          expiresAt,
          $inc: { attempts: 1 },
        },
        { new: true }
      );
    }

    // Configure the email transporter.
    const transporter = nodemailer.createTransport({
      host: process.env.HOSTINGER_SMTP_HOST,
      port: parseInt(process.env.HOSTINGER_SMTP_PORT),
      secure: true, // Use SSL (port 465)
      auth: {
        user: process.env.HOSTINGER_EMAIL,
        pass: process.env.HOSTINGER_EMAIL_PASSWORD,
      },
      pool: true, // Enable connection pooling
      maxConnections: 5, // Limit concurrent connections
    });

    // Send the OTP via email.
    await transporter.sendMail({
      from: `فريق فهيم <${process.env.HOSTINGER_EMAIL}>`,
      to: email,
      subject: 'كلمة المرور لمرة واحدة',
      html: `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #2c3e50;">رمز التحقق الخاص بك</h2>
          <p style="font-size: 16px; line-height: 1.6;">الرجاء استخدام رمز التحقق التالي:</p>
          <div style="
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 4px;
            color: #ffffff;
            background: #3498db;
            padding: 15px 25px;
            border-radius: 8px;
            text-align: center;
            margin: 25px 0;
            display: inline-block;
          ">
            ${otp}
          </div>
          <p style="font-size: 14px; color: #7f8c8d;">
            هذا الرمز صالح لمدة 5 دقائق فقط<br>
            عدد المحاولات المتبقية: ${3 - otpDoc.attempts}
          </p>
        </div>
      `,
    });

    return res.status(StatusCodes.OK).json({
      message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني',
      attemptsRemaining: 3 - otpDoc.attempts,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('OTP Error:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'حدث خطأ أثناء معالجة طلبك. يرجى المحاولة لاحقاً',
    });
  }
};

const validateSignup = [
  body('fname')
    .trim()
    .notEmpty()
    .withMessage('الاسم الأول مطلوب.')
    .isLength({ max: 50 })
    .withMessage('يجب أن يكون طول الاسم أقل من 50 حرفاً.'),

  body('lname')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('يجب أن يكون طول اسم العائلة أقل من 50 حرفاً.'),
  body('city')
    .trim()
    .isLength({ max: 50 })
    .withMessage('يجب أن يكون طول اسم العائلة أقل من 50 حرفاً.'),
  body('email')
  //  .notEmpty()
    // .isEmail()
    // .withMessage('صيغة البريد الإلكتروني غير صحيحة.')
    ,
  body('deviceId')
    .trim()
    .notEmpty()
    .withMessage('رمز deviceId مطلوب')
    .isString()
    .withMessage('رمز deviceId يجب أن يكون نصاً'),
  // body('otp')
  //   .trim()
  //   .notEmpty()
  //   .withMessage('رمز otp مطلوب')
  //   .isString()
  //   .withMessage('رمز otp يجب أن يكون نصاً'),

  body('password').trim().notEmpty().withMessage('كلمة المرور مطلوبة.'),
  body('phone')
    .trim()
    .isString().notEmpty().isLength({ max: 10,min:10 })
    .withMessage('رقم الهاتف مطلوب ويجب أن يكون نصاًولا يكون الطول 10 ارقام.'),
  body('image.filename')
    .optional()
    .isString()
    .withMessage('صيغة اسم الملف يجب أن تكون نصاً.'),
  body('image.accessUrl')
    .optional()
    .isString()
    .withMessage('صيغة رابط الوصول غير صحيحة.'),
];

// Student login validation middleware
const validateLogin = [
  body('email')
  //.notEmpty().withMessage('البريد الالكتروني مطلوب.')
  ,
  body('password').trim().notEmpty().withMessage('كلمة المرور مطلوبة.'),
  body('deviceId')
    .trim()
    .notEmpty()
    .withMessage('رمز deviceId مطلوب')
    .isString()
    .withMessage('رمز deviceId يجب أن يكون نصاً'),
  body('city')
    .trim()
    .isLength({ max: 50 })
    .withMessage('يجب أن يكون طول اسم العائلة أقل من 50 حرفاً.'),
      body('phone')
    .trim()
    .isString().notEmpty().isLength({ max: 10,min:10 })
    .withMessage('رقم الهاتف مطلوب ويجب أن يكون نصاًولا يكون الطول 10 ارقام.'),
];

exports.signup = [
  ...validateSignup,
  async (req, res, next) => {
    try {
      // Validate any errors collected by express-validator middleware.
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ errors: errors.array() });
      }

      const { fname, lname, email, otp, password, deviceId, phone, image,city } =
        req.body;

      // console.log(`Signup requested for email: ${email}`);

      // Validate required fields.
      if (!fname) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: 'الاسم الأول مطلوب!' });
      }

      // Optionally, validate that the phone number is not already used.
      if (phone) {
        const phoneExists = await Student.exists({ phone });
        if (phoneExists) {
          return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ message: 'رقم الهاتف موجود بالفعل!' });
        }
      }

      // // Ensure an OTP code was provided.
      // if (!otp) {
      //   return res
      //     .status(StatusCodes.BAD_REQUEST)
      //     .json({ message: 'الرجاء إدخال الرمز التأكيدي.' });
      // }
      if (!deviceId) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: 'الرجاء إدخال معرف الجهاز.' });
      }

      // const existingStudent = await Student.findOne({ email });
      // if (existingStudent) {
      //   return res.status(StatusCodes.BAD_REQUEST).json({
      //     message: 'البريد الالكتروني موجود بالفعل!',
      //   });
      // }

      // Hash the user's password.
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create and save the new student.
      const student = new Student({
        fname,
        lname,
        city,
        email,
        deviceId,
        phone,
        password: hashedPassword,
        image: image || { filename: '', accessUrl: '' },
      });
      await student.save();
      // await Otp.deleteOne({ email });
      // Generate a JWT token.
      const token = jwt.sign(
        {
          userId: student._id,
          phone: student.phone,
          role: 'student',
        },
        'thisismysecretkey'
      );

      return res.status(StatusCodes.CREATED).json({
        message: 'تم تسجيل الطالب بنجاح.',
        token: `Bearer ${token}`,
      });
    } catch (err) {
      if (!err.statusCode) err.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
      next(err);
    }
  },
];

exports.login = [
  ...validateLogin,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { phone, password, deviceId } = req.body;
      const loadedStudent = await Student.findOne({ phone })
        .select('+password')
        .lean();

      if (!loadedStudent) {
        return res
          .status(401)
          .json({ message: 'بيانات تسجيل الدخول غير صالحة!' });
      }
      // Check if the student is blocked
      if (loadedStudent.isBlocked) {
        return res
          .status(403)
          .json({ message: 'تم حظر حسابك من قبل الإدارة!' });
      }
      const isEqual = await bcrypt.compare(password, loadedStudent.password);
      if (!isEqual) {
        return res
          .status(401)
          .json({ message: 'بيانات تسجيل الدخول غير صالحة!' });
      }
      // if (loadedStudent.deviceId !== deviceId) {
      //   return res
      //     .status(401)
      //     .json({ message: 'لا يمكن فتح الحساب من جهاز مختلف' });
      // }

      const token = jwt.sign(
        {
          userId: loadedStudent._id,
          phone: loadedStudent.phone,
          role: 'student',
        },
        'thisismysecretkey'
      );

      res.status(StatusCodes.OK).json({
        message: 'تم تسجيل الدخول بنجاح.',
        token: `Bearer ${token}`,
      });
    } catch (error) {
      if (!error.statusCode)
        error.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
      next(error);
    }
  },
];

// Delete account validation middleware
const validateDeleteAccount = [
  body('password').trim().notEmpty().withMessage('كلمة المرور مطلوبة للتحقق.'),
];

exports.deleteAccount = [
  ...validateDeleteAccount,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const studentId = req.userId;
      const { password } = req.body;

      const student = await Student.findById(studentId)
        .select('+password')
        .lean();

      if (!student) {
        return res.status(404).json({ message: 'الطالب غير موجود!' });
      }

      const isMatch = await bcrypt.compare(password, student.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'كلمة المرور غير صحيحة!' });
      }

      const bunnyDeletions = [];
      if (student.image?.accessUrl) {
        bunnyDeletions.push({
          type: 'profile_image',
          accessUrl: student.image.accessUrl,
        });
      }

      await Student.deleteOne({ _id: studentId });

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

      res.status(StatusCodes.OK).json({
        message: 'تم حذف الحساب بنجاح.',
        details: {
          databaseDeleted: true,
          bunnyDeletions: deletionResults,
        },
      });
    } catch (err) {
      res.status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: err.message || 'حدث خطأ في الخادم.',
        details: {
          databaseDeleted: false,
          bunnyDeletions: [],
        },
      });
    }
  },
];