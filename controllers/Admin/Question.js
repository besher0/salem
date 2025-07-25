const QuestionGroup = require('../../models/QuestionGroup');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const Lesson = require('../../models/Lesson');
const { default: mongoose } = require('mongoose');
const { default: axios } = require('axios');

exports.createQuestionGroup = [
  body('paragraph')
    .optional()
    .isString()
    .withMessage('يجب أن تكون الفقرة نصية.'),

  // Updated image validations for array
  body('images').optional().isArray().withMessage('يجب أن تكون الصور مصفوفة.'),
  body('images.*.filename')
    .notEmpty()
    .withMessage('اسم ملف الصورة مطلوب.')
    .isString()
    .withMessage('يجب أن يكون اسم الملف نصاً.'),
  body('images.*.accessUrl')
    .notEmpty()
    .withMessage('رابط الوصول للصورة مطلوب.')
    .isString()
    .withMessage('يجب أن يكون رابط الوصول نصاً.'),

  body('lesson').notEmpty().isMongoId().withMessage('معرف الدرس غير صالح.'),

  body('questions')
    .isArray({ min: 1 })
    .withMessage('يجب إدخال مجموعة من الأسئلة.'),

  body('questions.*.infoImages')
    .optional()
    .isArray()
    .withMessage('يجب أن تكون صور المعلومات مصفوفة.'),
  body('questions.*.infoImages.*.filename')
    .notEmpty()
    .withMessage('اسم ملف صورة المعلومات مطلوب.')
    .isString(),
  body('questions.*.infoImages.*.accessUrl')
    .notEmpty()
    .withMessage('رابط الوصول لصورة المعلومات مطلوب.')
    .isString(),

  body('questions').custom((questions) => {
    questions.forEach((question, index) => {
      if (!question.text?.trim()) {
        throw new Error(`نص السؤال مطلوب للسؤال رقم ${index + 1}.`);
      }

      if (!question.choices?.length || question.choices.length < 2) {
        throw new Error(
          `يجب أن يحتوي السؤال رقم ${index + 1} على خيارين على الأقل.`
        );
      }

      question.choices.forEach((choice, choiceIndex) => {
        if (!choice.text?.trim()) {
          throw new Error(
            `نص الاختيار مطلوب في السؤال رقم ${index + 1}, الاختيار رقم ${
              choiceIndex + 1
            }.`
          );
        }
      });

      const correctChoices = question.choices.filter((c) => c.isCorrect).length;
      if (correctChoices < 1) {
        throw new Error(
          `يجب تحديد إجابة صحيحة واحدة على الأقل في السؤال رقم ${index + 1}.`
        );
      }

      if (question.infoImages) {
        question.infoImages.forEach((img, imgIndex) => {
          if (!img.filename?.trim()) {
            throw new Error(
              `اسم الملف مطلوب لصورة المعلومات ${imgIndex + 1} في السؤال ${
                index + 1
              }.`
            );
          }
          if (!img.accessUrl?.trim()) {
            throw new Error(
              `رابط الوصول مطلوب لصورة المعلومات ${imgIndex + 1} في السؤال ${
                index + 1
              }.`
            );
          }
        });
      }
    });
    return true;
  }),

  body('questions.*.text').notEmpty().withMessage('نص السؤال مطلوب.'),
  body('questions.*.isMultipleChoice')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isMultipleChoice قيمة منطقية.'),
  body('questions.*.isEnglish')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isEnglish قيمة منطقية.'),
  body('questions.*.choices')
    .isArray({ min: 2 })
    .withMessage('الخيارات يجب أن تكون قائمة تحتوي على خيارين على الأقل.'),
  body('questions.*.choices.*.text')
    .notEmpty()
    .withMessage('نص الاختيار مطلوب.'),
  body('questions.*.choices.*.isCorrect')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isCorrect قيمة منطقية.'),
  body('questions.*.information')
    .optional()
    .isString()
    .withMessage('يجب أن تكون المعلومات نصاً.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const groupData = req.body;
      const lessonExists = await Lesson.exists({ _id: groupData.lesson });
      if (!lessonExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، الدرس المحدد غير موجود.' });
      }

      const newGroup = new QuestionGroup(groupData);
      await newGroup.save();

      res.status(201).json({
        message: 'تم إنشاء مجموعة الأسئلة بنجاح.',
        group: newGroup,
      });
    } catch (err) {
      res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];

exports.getQuestionGroups = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    const { limit = 10, page = 1, lesson } = req.query;

    if (!lesson) {
      return res.status(400).json({ message: 'معرف الدرس مطلوب.' });
    }

    const filter = { lesson: new mongoose.Types.ObjectId(lesson) };
    const pageSize = parseInt(limit);
    const currentPage = parseInt(page);

    const [groups, totalGroups] = await Promise.all([
      QuestionGroup.find(filter)
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize),
      QuestionGroup.countDocuments(filter),
    ]);

    res.status(200).json({
      docs: groups,
      totalDocs: totalGroups,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(totalGroups / pageSize),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};

exports.deleteQuestionGroup = [
  param('id').isMongoId().withMessage('يرجى إدخال معرف السؤال بشكل صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const questionGroupId = req.params.id;
      const group = await QuestionGroup.findById(questionGroupId);

      if (!group) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على السؤال.' });
      }

      const bunnyDeletions = [];

      // Updated images deletion handling
      if (group.images && group.images.length > 0) {
        group.images.forEach((image) => {
          if (image.accessUrl) {
            bunnyDeletions.push({
              type: 'question_image',
              accessUrl: image.accessUrl,
            });
          }
        });
      }

      group.questions.forEach((question) => {
        if (question.infoImages) {
          question.infoImages.forEach((img) => {
            if (img.accessUrl) {
              bunnyDeletions.push({
                type: 'question_info_image',
                accessUrl: img.accessUrl,
              });
            }
          });
        }
      });

      await QuestionGroup.deleteOne({ _id: questionGroupId });

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
        message: 'تم حذف مجموعة الأسئلة بنجاح.',
        details: {
          databaseDeleted: true,
          bunnyDeletions: deletionResults,
        },
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || 'حدث خطأ في الخادم.',
        details: {
          databaseDeleted: false,
          bunnyDeletions: [],
        },
      });
    }
  },
];

exports.deleteQuestion = [
  // Validate IDs and index
  param('questionGroupId')
    .isMongoId()
    .withMessage('معرف مجموعة الأسئلة غير صالح.'),
  param('questionIndex')
    .isInt({ min: 0 })
    .withMessage('رقم السؤال يجب أن يكون عدداً صحيحاً غير سالب.'),

  // Controller logic
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { questionGroupId, questionIndex } = req.params;
      const group = await QuestionGroup.findById(questionGroupId);

      if (!group) {
        return res.status(404).json({ message: 'مجموعة الأسئلة غير موجودة.' });
      }

      // Check if index is valid
      if (questionIndex >= group.questions.length) {
        return res.status(400).json({
          message: `السؤال رقم ${questionIndex + 1} غير موجود في المجموعة.`,
        });
      }

      // Remove the question
      group.questions.splice(questionIndex, 1);
      await group.save();

      res.json({ message: 'تم حذف السؤال بنجاح.' });
    } catch (err) {
      res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];
exports.updateQuestionGroup = [
  param('id')
    .isMongoId()
    .withMessage('يرجى إدخال معرف مجموعة الأسئلة بشكل صحيح.'),
  
  // Validation for updatable fields
  body('paragraph')
    .optional()
    .isString()
    .withMessage('يجب أن تكون الفقرة نصية.'),
  
  body('images')
    .optional()
    .isArray()
    .withMessage('يجب أن تكون الصور مصفوفة.'),
  body('images.*.filename')
    .if(body('images').exists())
    .notEmpty()
    .withMessage('اسم ملف الصورة مطلوب.')
    .isString()
    .withMessage('يجب أن يكون اسم الملف نصاً.'),
  body('images.*.accessUrl')
    .if(body('images').exists())
    .notEmpty()
    .withMessage('رابط الوصول للصورة مطلوب.')
    .isString()
    .withMessage('يجب أن يكون رابط الوصول نصاً.'),

  body('lesson')
    .optional()
    .isMongoId()
    .withMessage('معرف الدرس غير صالح.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const group = await QuestionGroup.findById(req.params.id);
      if (!group) {
        return res.status(404).json({ error: 'مجموعة الأسئلة غير موجودة.' });
      }

      const { paragraph, images, lesson } = req.body;
      const updateData = {};
      const bunnyDeletions = [];

      // Handle paragraph update
      if (paragraph !== undefined) {
        updateData.paragraph = paragraph;
      }

      // Handle images update
      if (images !== undefined) {
        // Track removed images for deletion
        const oldImages = group.images || [];
        const newImageUrls = new Set((images || []).map(img => img.accessUrl));
        
        oldImages.forEach(img => {
          if (!newImageUrls.has(img.accessUrl)) {
            bunnyDeletions.push(img.accessUrl);
          }
        });

        updateData.images = images;
      }

      // Handle lesson update
      if (lesson) {
        const lessonExists = await Lesson.exists({ _id: lesson });
        if (!lessonExists) {
          return res.status(400).json({ message: 'الدرس المحدد غير موجود.' });
        }
        updateData.lesson = lesson;
      }

      // Update the group
      const updatedGroup = await QuestionGroup.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      // Delete old images from BunnyCDN
      const deletionResults = [];
      for (const accessUrl of bunnyDeletions) {
        try {
          await axios.delete(accessUrl, {
            headers: {
              Accept: 'application/json',
              AccessKey: process.env.BUNNY_STORAGE_API_KEY,
            },
          });
          deletionResults.push({ accessUrl, status: 'success' });
        } catch (error) {
          deletionResults.push({
            accessUrl,
            status: 'error',
            error: error.response?.data || error.message,
          });
        }
      }

      res.status(200).json({
        group: updatedGroup,
        bunnyDeletions: deletionResults,
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || 'حدث خطأ في الخادم.',
        bunnyDeletions: [],
      });
    }
  },
];
exports.updateQuestion = [
  // Validate IDs and index
  param('questionGroupId')
    .isMongoId()
    .withMessage('معرف مجموعة الأسئلة غير صالح.'),
  param('questionIndex')
    .isInt({ min: 0 })
    .withMessage('رقم السؤال يجب أن يكون عدداً صحيحاً غير سالب.'),

  // Validate incoming question data (similar to create)
  body('text').optional().notEmpty().withMessage('نص السؤال مطلوب.'),
  body('isMultipleChoice')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isMultipleChoice قيمة منطقية.'),
  body('isEnglish')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isEnglish قيمة منطقية.'),
  body('information')
    .optional()
    .isString()
    .withMessage('يجب أن تكون المعلومات نصاً.'),
  body('choices')
    .optional()
    .isArray({ min: 2 })
    .withMessage('الخيارات يجب أن تكون قائمة تحتوي على خيارين على الأقل.'),
  body('choices.*.text')
    .optional()
    .notEmpty()
    .withMessage('نص الاختيار مطلوب.'),
  body('choices.*.isCorrect')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isCorrect قيمة منطقية.'),

  // Custom validation for choices and infoImages
  body().custom((bodyData) => {
    const question = bodyData;

    // Validate text (if provided)
    if (question.text && !question.text.trim()) {
      throw new Error('نص السؤال مطلوب.');
    }

    // Validate choices (if provided)
    if (question.choices) {
      if (question.choices.length < 2) {
        throw new Error('يجب أن يحتوي السؤال على خيارين على الأقل.');
      }

      let correctChoices = 0;
      question.choices.forEach((choice, index) => {
        if (!choice.text?.trim()) {
          throw new Error(`نص الاختيار مطلوب للاختيار رقم ${index + 1}.`);
        }
        if (choice.isCorrect) correctChoices++;
      });

      if (correctChoices < 1) {
        throw new Error('يجب تحديد إجابة صحيحة واحدة على الأقل.');
      }
    }

    // Validate infoImages (if provided)
    if (question.infoImages) {
      question.infoImages.forEach((img, index) => {
        if (!img.filename?.trim() || !img.accessUrl?.trim()) {
          throw new Error(
            `يجب تقديم اسم الملف ورابط الوصول لصورة المعلومات رقم ${index + 1}.`
          );
        }
      });
    }

    return true;
  }),

  // Controller logic
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { questionGroupId, questionIndex } = req.params;
      const updates = req.body;

      const group = await QuestionGroup.findById(questionGroupId);
      if (!group) {
        return res.status(404).json({ message: 'مجموعة الأسئلة غير موجودة.' });
      }

      // Check if index is valid
      if (questionIndex >= group.questions.length) {
        return res.status(400).json({
          message: `السؤال رقم ${questionIndex + 1} غير موجود في المجموعة.`,
        });
      }

      // Update the question
      const questionToUpdate = group.questions[questionIndex];
      Object.keys(updates).forEach((key) => {
        questionToUpdate[key] = updates[key];
      });

      await group.save();
      res.json({
        message: 'تم تحديث السؤال بنجاح.',
        question: questionToUpdate,
      });
    } catch (err) {
      res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];
