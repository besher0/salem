const FreeQuestionGroup = require('../../models/FreeQuestionGroup');
const QuestionGroup = require('../../models/QuestionGroup');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Lesson = require('../../models/Lesson');

 exports.copyQuestionsToFree = [
  body('numOfGroups')
    .isInt({ min: 1 })
    .withMessage('يرجى إدخال عدد المجموعات كرقم صحيح أكبر من صفر.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { numOfGroups } = req.body;
      let totalCopied = 0;

      // حذف جميع المجموعات المجانية الحالية
      await FreeQuestionGroup.deleteMany({});

      // الحصول على الدروس التي تحتوي على مجموعات أسئلة تحتوي على سؤال واحد فقط
      const lessonsWithSingleQuestionGroups = await Lesson.aggregate([
        {
          $lookup: {
            from: 'questiongroups',
            localField: '_id',
            foreignField: 'lesson',
            as: 'groups',
          },
        },
        {
          $project: {
            _id: 1,
            groups: {
              $filter: {
                input: '$groups',
                as: 'group',
                cond: { $eq: [{ $size: '$$group.questions' }, 1] },
              },
            },
          },
        },
        { $match: { 'groups.0': { $exists: true } } },
      ]);

      // معالجة كل درس يحتوي على مجموعات صالحة
      for (const lesson of lessonsWithSingleQuestionGroups) {
        // اختيار مجموعات عشوائية من الدروس التي تحتوي على سؤال واحد
        const sampledGroups = await QuestionGroup.aggregate([
          { $match: { 
            _id: { $in: lesson.groups.map(g => g._id) },
            $expr: { $eq: [{ $size: '$questions' }, 1] } 
          }},
          { $sample: { size: numOfGroups } },
          {
            $project: {
              __v: 0,
              createdAt: 0,
              updatedAt: 0,
              'questions._id': 0,
              'questions.createdAt': 0,
              'questions.updatedAt': 0,
            },
          },
        ]);

        if (sampledGroups.length === 0) continue;

        // إعداد البيانات للإدخال
        const groupsToInsert = sampledGroups.map(group => ({
          ...group,
          lesson: lesson._id,
          questions: group.questions.map(question => ({
            ...question,
            choices: question.choices.map(choice => ({
              ...choice,
              _id: new mongoose.Types.ObjectId(),
            })),
          })),
        }));

        // إدخال المجموعات المحددة
        const insertedGroups = await FreeQuestionGroup.insertMany(groupsToInsert);
        totalCopied += insertedGroups.length;
      }

      res.status(200).json({
        message: `تم نسخ ${totalCopied} مجموعة تحتوي على سؤال واحد بنجاح.`,
        totalCopied,
        lessonsProcessed: lessonsWithSingleQuestionGroups.length,
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || 'حدث خطأ أثناء معالجة الطلب.',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      });
    }
  },
];