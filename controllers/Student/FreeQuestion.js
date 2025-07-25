const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const { shuffleArray } = require('../../util/shuffleArray');
const Student = require('../../models/Student');
const httpStatus = require('http-status-codes');
const mongoose = require('mongoose');
const { Material, Unit, Lesson, FreeQuestionGroup } = require('../../models');

exports.getFreeQuestionsByMaterial = async (req, res) => {
  try {
    // Validate input parameters
    const { limit = 10, material } = req.query;

    if (!material || !mongoose.Types.ObjectId.isValid(material)) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'معرّف مادة غير صالح',
      });
    }

    const numericLimit = Math.min(Number.parseInt(limit, 10) || 10, 100);

    // Validate material existence
    const materialExists = await Material.exists({ _id: material });
    if (!materialExists) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'المادة المطلوبة غير موجودة',
      });
    }

    // Efficiently gather all related lesson IDs
    const unitIds = await Unit.find({ material }).distinct('_id');
    const lessonIds = await Lesson.find({ unit: { $in: unitIds } }).distinct(
      '_id'
    );

    // Optimized aggregation pipeline
    const aggregationPipeline = [
      { $match: { lesson: { $in: lessonIds } } },
      { $sample: { size: numericLimit } },
      {
        $project: {
          __v: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ];

    const questions = await FreeQuestionGroup.aggregate(aggregationPipeline);

    return res.status(httpStatus.OK).json({
      success: true,
      data: questions,
      meta: {
        count: questions.length,
        limit: numericLimit,
        totalAvailable: await FreeQuestionGroup.countDocuments({
          lesson: { $in: lessonIds },
        }),
      },
    });
  } catch (error) {
    // Log error here (consider implementing a proper logging system)
    console.error('Error fetching free questions:', error);

    return res
      .status(error.statusCode || httpStatus.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message || 'حدث خلل في الخادم الداخلي',
        errorCode: error.code || 'INTERNAL_SERVER_ERROR',
      });
  }
};
exports.getFreeQuestionsjByLesson = async (req, res) => {
  try {
    const { limit, lesson } = req.query;

    const validLesson = await Lesson.findById(lesson);

    if (!validLesson) {
      return res.status(404).json({
        message: 'لم يتم العثور على الدرس',
      });
    }

    // Get random questions
    const sampleSize = parseInt(limit, 10) || 10;
    const questions = await FreeQuestionGroup.aggregate([
      { $match: { lesson: new mongoose.Types.ObjectId(lesson) } },
      { $sample: { size: sampleSize } },
      { $project: { __v: 0 } },
    ]);

    // Populate lesson name
    // const populatedQuestions = await FreeQuestionGroup.populate(questions, {
    //   path: 'lesson',
    //   select: 'name',
    // });

    res.status(200).json({
      docs: questions,
      limit: sampleSize,
      total: questions.length,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      error: err.message || 'حدث خطأ في الخادم.',
    });
  }
};
