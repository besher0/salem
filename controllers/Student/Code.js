const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const CodesGroup = require('../../models/CodesGroup');
const Student = require('../../models/Student');

exports.redeemCode = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('الكود مطلوب.')
    .isLength({ min: 12, max: 12 })
    .withMessage('يجب أن يكون طول الكود 12 حرفاً.'),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { code } = req.body;
      const studentId = req.userId;

      // 1. Find the code in CodesGroups with material relationships
      const codesGroup = await CodesGroup.findOne(
        { 'codes.value': code },
        {
          'codes.$': 1,
          expiration: 1,
          materialsWithQuestions: 1,
          materialsWithLectures: 1,
          courses: 1,
        }
      )
        .populate([
          {
            path: 'materialsWithQuestions',
            select: 'name color icon',
          },
          {
            path: 'materialsWithLectures',
            select: 'name color icon',
          },
          {
            path: 'courses',
            populate: {
              path: 'material',
              select: 'name color icon',
            },
          },
        ])
        .session(session);

      if (!codesGroup) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الكود.' });
      }

      // 2. Check code status and expiration
      const targetCode = codesGroup.codes[0];
      if (targetCode.isUsed) {
        return res.status(400).json({ error: 'الكود مستخدم بالفعل.' });
      }

      if (new Date() > codesGroup.expiration) {
        return res
          .status(400)
          .json({ error: 'مجموعة الأكواد منتهية الصلاحية.' });
      }

      // 3. Check existing redemption
      const student = await Student.findById(studentId)
        .session(session)
        .select('redeemedCodes');

      if (!student) return res.status(401).json({ message: 'غير مصرح!' });

      const existingRedemption = student.redeemedCodes?.some((redemption) =>
        redemption?.codesGroup?.equals(codesGroup._id)
      );

      if (existingRedemption) {
        return res.status(409).json({
          error: 'لقد قمت باسترداد كود من هذه المجموعة مسبقاً.',
        });
      }

      // 4. Update records
      await CodesGroup.updateOne(
        { _id: codesGroup._id, 'codes.value': code },
        { $set: { 'codes.$.isUsed': true } }
      ).session(session);

      const newRedemption = {
        code,
        codesGroup: codesGroup._id,
        redeemedAt: new Date(),
      };

      await Student.updateOne(
        { _id: studentId },
        { $push: { redeemedCodes: newRedemption } }
      ).session(session);

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        message: 'تم استرداد الكود بنجاح.',
        data: {
          code,
          materialsWithQuestions: codesGroup.materialsWithQuestions,
          materialsWithLectures: codesGroup.materialsWithLectures,
          courses: codesGroup.courses,
          expiration: codesGroup.expiration,
        },
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      next(err);
    }
  },
];

exports.getCodesInfo = async (req, res) => {
  try {
    const userId = req.userId;

    const student = await Student.findById(userId).populate({
      path: 'redeemedCodes.codesGroup',
      select: 'expiration materialsWithQuestions materialsWithLectures courses',
      populate: [
        {
          path: 'materialsWithQuestions',
          select: 'name color icon',
        },
        {
          path: 'materialsWithLectures',
          select: 'name color icon',
        },
        {
          path: 'courses',
          populate: {
            path: 'material',
            select: 'name color icon',
          },
        },
      ],
    });

    if (!student) {
      return res.status(404).json({ message: 'لم يتم العثور على الطالب' });
    }

    const enhancedCodes = student.redeemedCodes.map((redemption) => ({
      ...redemption.toObject(),
      codesGroup: {
        ...redemption.codesGroup.toObject(),
        materialsWithQuestions: redemption.codesGroup.materialsWithQuestions,
        materialsWithLectures: redemption.codesGroup.materialsWithLectures,
        courses: redemption.codesGroup.courses.map((course) => ({
          ...course.toObject(),
          material: course.material,
        })),
      },
    }));

    return res.status(200).json(enhancedCodes);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'حدث خطأ في الخادم.',
    });
  }
};
