// controllers/favoriteController.js

const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Student = require('../../models/Student');
const QuestionGroup = require('../../models/QuestionGroup');

exports.addFavoriteQuestionGroup = [
  body('questionGroupId')
    .notEmpty()
    .withMessage('معرف مجموعة الأسئلة مطلوب.')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('صيغة معرف مجموعة الأسئلة غير صالحة.'),
  body('index')
    .notEmpty()
    .withMessage('موقع السؤال مطلوب')
    .custom((value) => {
      if (typeof value !== 'number') {
        throw new Error('موقع السؤال يجب أن يكون رقما');
      }
      return true;
    }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const studentId = req.userId;
      const { questionGroupId, index = 0 } = req.body;

      const questionGroup = await QuestionGroup.findById(
        questionGroupId
      ).populate({
        path: 'lesson',
        select: 'unit',
        populate: { path: 'unit', select: 'material' },
      });

      if (!questionGroup?.lesson?.unit?.material) {
        return res.status(404).json({
          message:
            'عذراً، لم يتم العثور على مجموعة الأسئلة أو الدرس أو الوحدة.',
        });
      }

      const materialId = questionGroup.lesson.unit.material.toString();
      const student = await Student.findById(studentId).populate(
        'redeemedCodes.codesGroup'
      );

      if (!student) {
        return res
          .status(404)
          .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
      }

      // Updated access check for new materials structure
      const hasAccess = student.redeemedCodes.some((redemption) => {
        const codesGroup = redemption.codesGroup;
        const materialAccess =
          codesGroup.materialsWithQuestions.some(
            (m) => m.toString() === materialId
          ) ||
          codesGroup.materialsWithLectures.some(
            (m) => m.toString() === materialId
          );

        return (
          codesGroup.expiration > new Date() &&
          codesGroup.codes.some(
            (c) => c.value === redemption.code && c.isUsed
          ) &&
          materialAccess
        );
      });

      if (!hasAccess) {
        return res
          .status(403)
          .json({ message: 'ليس لديك صلاحية الوصول إلى هذا السؤال.' });
      }

      if (index >= questionGroup.questions?.length) {
        return res.status(400).json({
          message: `موقع السؤال غير صالح، يجب أن يكون بين 0 و ${
            questionGroup.questions?.length - 1
          }`,
        });
      }

      const exists = student.favorites.some(
        (fav) =>
          fav.questionGroup.equals(questionGroupId) && fav.index === index
      );

      if (exists) {
        return res
          .status(400)
          .json({ message: 'مجموعة الأسئلة مضافة للمفضلة من قبل.' });
      }

      student.favorites.push({ questionGroup: questionGroupId, index });
      await student.save();

      res
        .status(200)
        .json({ message: 'تمت إضافة مجموعة الأسئلة إلى المفضلة بنجاح.' });
    } catch (err) {
      console.error('Error in addFavoriteQuestionGroup:', err);
      res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];

exports.removeFavoriteQuestionGroup = [
  body('questionGroupId')
    .notEmpty()
    .withMessage('معرف مجموعة الأسئلة مطلوب.')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('صيغة معرف مجموعة الأسئلة غير صالحة.'),
  body('index')
    .notEmpty()
    .withMessage('موقع السؤال مطلوب')
    .isNumeric()
    .withMessage('موقع السؤال يجب أن يكون رقما'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const studentId = req.userId;
      const { questionGroupId, index } = req.body;

      const student = await Student.findById(studentId);
      if (!student) {
        return res
          .status(404)
          .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
      }

      const favoriteIndex = student.favorites.findIndex(
        (fav) =>
          fav.questionGroup?.toString() === questionGroupId &&
          parseInt(index) === fav.index
      );

      if (favoriteIndex !== -1) {
        student.favorites.splice(favoriteIndex, 1);
        await student.save();
      }

      res.status(200).json({
        message:
          favoriteIndex !== -1
            ? 'تم حذف السؤال من المفضلة بنجاح.'
            : 'السؤال ليس موجودا في المفضلة مسبقا',
      });
    } catch (err) {
      console.error('Error in removeFavoriteQuestionGroup:', err);
      res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];

exports.getFavoriteQuestionGroups = async (req, res) => {
  try {
    const studentId = req.userId;
    const student = await Student.findById(studentId).populate(
      'favorites.questionGroup',
      '-__v -createdAt -updatedAt'
    );

    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const returnedFavorites = student.favorites.map((f) => ({
      ...f.questionGroup._doc,
      questions: [f.questionGroup.questions[f.index]],
      index: f.index,
    }));

    res.status(200).json({ favorites: returnedFavorites });
  } catch (err) {
    console.error('Error in getFavoriteQuestionGroups:', err);
    res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};
