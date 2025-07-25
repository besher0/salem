const mongoose = require('mongoose');
const CodesGroup = require('../../models/CodesGroup');
const Material = require('../../models/Material');
const Student = require('../../models/Student');
const Question = require('../../models/QuestionGroup');
const Course = require('../../models/Course');
const Video = require('../../models/Video');
const QuestionGroup = require('../../models/QuestionGroup');
const Lesson = require('../../models/Lesson');

exports.getAccessibleMaterials = async (req, res) => {
  try {
    const student = await Student.findById(req.userId).select('redeemedCodes');
    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const now = new Date();
    const questionMaterialIds = new Set();
    const lectureMaterialIds = new Set();

    // Separate materials into question and lecture categories
    for (const redemption of student.redeemedCodes) {
      const codesGroup = await CodesGroup.findOne({
        _id: redemption.codesGroup,
        expiration: { $gt: now },
        'codes.value': redemption.code,
        'codes.isUsed': true,
      }).select('materialsWithQuestions materialsWithLectures');

      if (codesGroup) {
        codesGroup.materialsWithQuestions.forEach((id) =>
          questionMaterialIds.add(id.toString())
        );
        codesGroup.materialsWithLectures.forEach((id) =>
          lectureMaterialIds.add(id.toString())
        );
      }
    }

    // Convert to arrays of ObjectIds
    const questionIdsArray = Array.from(questionMaterialIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const lectureIdsArray = Array.from(lectureMaterialIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    // Fetch materials in parallel
    const [materialsWithQuestions, materialsWithLectures] = await Promise.all([
      Material.find({ _id: { $in: questionIdsArray } })
        .select('-__v -createdAt -updatedAt')
        .lean(),

      Material.find({ _id: { $in: lectureIdsArray } })
        .select('-__v -createdAt -updatedAt')
        .lean(),
    ]);

    res.status(200).json({
      materialsWithQuestions,
      materialsWithLectures,
      count: {
        questions: materialsWithQuestions.length,
        lectures: materialsWithLectures.length,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
};

exports.getAccessibleQuestions = async (req, res) => {
  try {
    const { limit = 10, page = 1, lesson } = req.query;
    const studentId = req.userId;

    if (!lesson) return res.status(400).json({ message: 'معرف الدرس مطلوب.' });
    if (!mongoose.Types.ObjectId.isValid(lesson)) {
      return res.status(400).json({ message: 'صيغة معرف الدرس غير صالحة.' });
    }

    const lessonId = new mongoose.Types.ObjectId(lesson);
    const lessonDoc = await Lesson.findById(lessonId)
      .select('unit')
      .populate({ path: 'unit', select: 'material' });
    if (!lessonDoc?.unit?.material) {
      return res.status(404).json({ message: 'الدرس غير موجود.' });
    }

    const materialId = lessonDoc.unit.material;
    const student = await Student.findById(studentId)
      .select('redeemedCodes favorites')
      .lean();

    if (!student)
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });

    const now = new Date();
    let hasAccess = false;
    const redemptionQueries = student.redeemedCodes.map((redemption) => ({
      _id: redemption.codesGroup,
      expiration: { $gt: now },
      'codes.value': redemption.code,
      'codes.isUsed': true,
      $or: [
        { materialsWithQuestions: materialId },
        { materialsWithLectures: materialId },
      ],
    }));

    if (redemptionQueries.length > 0) {
      const codesGroup = await CodesGroup.findOne({ $or: redemptionQueries });
      if (codesGroup) hasAccess = true;
    }

    if (!hasAccess) {
      return res
        .status(403)
        .json({ message: 'ليس لديك صلاحية الوصول لهذه المادة.' });
    }

    const pageSize = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);
    const questionGroups = await QuestionGroup.find({ lesson: lessonId })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const favoriteMap = new Map();
    student.favorites.forEach((fav) => {
      favoriteMap.set(`${fav.questionGroup}_${fav.index}`, true);
    });

    const enhanced = questionGroups.map((group) => ({
      ...group,
      questions: group.questions?.map((q, i) => ({
        ...q,
        isFavorite: favoriteMap.has(`${group._id}_${i}`),
      })),
    }));

    const total = await QuestionGroup.countDocuments({ lesson: lessonId });

    res.status(200).json({
      docs: enhanced,
      totalDocs: total,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
};

exports.getAccessibleCoursesByMaterial = async (req, res) => {
  try {
    const { limit = 10, page = 1, material } = req.query;
    const studentId = req.userId;

    if (!material) {
      return res.status(400).json({ message: 'معرف المادة مطلوب.' });
    }
    if (!mongoose.Types.ObjectId.isValid(material)) {
      return res.status(400).json({ message: 'صيغة معرف المادة غير صالحة.' });
    }

    const materialId = new mongoose.Types.ObjectId(material);
    const student = await Student.findById(studentId).select('redeemedCodes');

    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const now = new Date();
    const accessibleCodesGroups = await CodesGroup.find({
      _id: { $in: student.redeemedCodes.map((rc) => rc.codesGroup) },
      expiration: { $gt: now },
      codes: {
        $elemMatch: {
          value: { $in: student.redeemedCodes.map((rc) => rc.code) },
          isUsed: true,
        },
      },
    })
      .select('courses')
      .populate('courses');

    const courseIds = accessibleCodesGroups.flatMap((group) => group.courses);
    const filteredCourses = courseIds.filter(
      (course) => course.material && course.material.equals(materialId)
    );

    const pageSize = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);

    res.status(200).json({
      docs: filteredCourses.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      ),
      totalDocs: filteredCourses.length,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(filteredCourses.length / pageSize),
    });
  } catch (err) {
    console.error('Error in getAccessibleCoursesByMaterial:', err);
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
};

exports.getAccessibleVideosByCourse = async (req, res) => {
  try {
    const { limit = 10, page = 1, course } = req.query;
    const studentId = req.userId;

    if (!course) return res.status(400).json({ message: 'معرف الدورة مطلوب.' });
    if (!mongoose.Types.ObjectId.isValid(course)) {
      return res.status(400).json({ message: 'صيغة معرف الدورة غير صالحة.' });
    }

    const courseId = new mongoose.Types.ObjectId(course);
    const courseExists = await Course.exists({ _id: courseId });
    if (!courseExists)
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الدورة.' });

    const student = await Student.findById(studentId).select('redeemedCodes');
    if (!student)
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });

    const now = new Date();
    const accessibleCodesGroups = await CodesGroup.find({
      _id: { $in: student.redeemedCodes.map((rc) => rc.codesGroup) },
      expiration: { $gt: now },
      courses: courseId,
      codes: {
        $elemMatch: {
          value: { $in: student.redeemedCodes.map((rc) => rc.code) },
          isUsed: true,
        },
      },
    }).select('_id');

    if (accessibleCodesGroups.length === 0) {
      return res
        .status(403)
        .json({ message: 'ليس لديك صلاحية الوصول لهذه الدورة.' });
    }

    const pageSize = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);
    const totalVideos = await Video.countDocuments({ course: courseId });

    const videos = await Video.find({ course: courseId })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .select('-__v -createdAt -updatedAt')
      .populate('course', 'name');

    res.status(200).json({
      docs: videos,
      totalDocs: totalVideos,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(totalVideos / pageSize),
    });
  } catch (err) {
    console.error('Error in getAccessibleVideosByCourse:', err);
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};

exports.getQuestionGroupWithQuestion = async (req, res) => {
  try {
    const { questionGroupId, questionIndex } = req.query;
    const studentId = req.userId;

    if (!questionGroupId || !questionIndex) {
      return res
        .status(400)
        .json({ message: 'معرف المجموعة وفهرس السؤال مطلوبان.' });
    }
    if (!mongoose.Types.ObjectId.isValid(questionGroupId)) {
      return res.status(400).json({ message: 'صيغة معرف المجموعة غير صالحة.' });
    }
    if (isNaN(questionIndex) || questionIndex < 0) {
      return res
        .status(400)
        .json({ message: 'فهرس السؤال يجب أن يكون عدداً صحيحاً غير سالب.' });
    }

    const student = await Student.findById(studentId).select('redeemedCodes');
    if (!student)
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });

    const questionGroup = await QuestionGroup.findById(questionGroupId)
      .populate({
        path: 'lesson',
        select: 'unit',
        populate: { path: 'unit', select: 'material' },
      })
      .select('paragraph questions images')
      .lean();

    if (!questionGroup)
      return res.status(404).json({ message: 'لم يتم العثور على المجموعة.' });
    if (!questionGroup.lesson?.unit?.material) {
      return res.status(404).json({ message: 'الدرس أو الوحدة غير موجودة.' });
    }

    const materialId = questionGroup.lesson.unit.material;
    const now = new Date();
    let hasAccess = false;

    const redemptionQueries = student.redeemedCodes.map((redemption) => ({
      _id: redemption.codesGroup,
      expiration: { $gt: now },
      'codes.value': redemption.code,
      'codes.isUsed': true,
      $or: [
        { materialsWithQuestions: materialId },
        { materialsWithLectures: materialId },
      ],
    }));

    if (redemptionQueries.length > 0) {
      const codesGroup = await CodesGroup.findOne({ $or: redemptionQueries });
      if (codesGroup) hasAccess = true;
    }

    if (!hasAccess) {
      return res
        .status(403)
        .json({ message: 'ليس لديك صلاحية الوصول لهذه المجموعة.' });
    }

    if (questionIndex >= questionGroup.questions.length) {
      return res.status(400).json({ message: 'فهرس السؤال خارج النطاق.' });
    }

    const response = {
      ...questionGroup,
      material: materialId,
      questions: [questionGroup.questions[questionIndex]],
    };

    res.status(200).json(response);
  } catch (err) {
    console.error('Error in getQuestionGroupWithQuestion:', err);
    res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};
