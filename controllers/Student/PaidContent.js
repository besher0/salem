const mongoose = require('mongoose');
const CodesGroup = require('../../models/CodesGroup');
const Material = require('../../models/Material');
const Student = require('../../models/Student');
const Question = require('../../models/QuestionGroup');
const Course = require('../../models/Course');
const Video = require('../../models/Video');
const QuestionGroup = require('../../models/QuestionGroup');
const Section = require('../../models/Section');
const FreeQuestionGroup = require('../../models/FreeQuestionGroup');

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
    const filesMaterialIds = new Set();

    // Separate materials into question and files categories
    for (const redemption of student.redeemedCodes) {
      const codesGroup = await CodesGroup.findOne({
        _id: redemption.codesGroup,
        expiration: { $gt: now },
        'codes.value': redemption.code,
        'codes.isUsed': true,
  }).select('materialsWithQuestions materialsWithFiles');

      if (codesGroup) {
        codesGroup.materialsWithQuestions.forEach((id) =>
          questionMaterialIds.add(id.toString())
        );
        codesGroup.materialsWithFiles.forEach((id) =>
          filesMaterialIds.add(id.toString())
        );
      }
    }

    // Convert to arrays of ObjectIds
    const questionIdsArray = Array.from(questionMaterialIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const filesIdsArray = Array.from(filesMaterialIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    // Fetch materials in parallel
  const [materialsWithQuestions, materialsWithFiles] = await Promise.all([
      Material.find({ _id: { $in: questionIdsArray } })
        .select('-__v -createdAt -updatedAt')
        .lean(),

      Material.find({ _id: { $in: filesIdsArray } })
        .select('-__v -createdAt -updatedAt')
        .lean(),
    ]);

    res.status(200).json({
      materialsWithQuestions,
      materialsWithFiles,
      count: {
        questions: materialsWithQuestions.length,
        filess: materialsWithFiles.length,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'حدث خطأ في الخادم.' });
  }
};

// controllers/Student/Question.js
exports.getAccessibleQuestions = async (req, res) => {
  try {
    const { material, section } = req.query;
    if (!material || !section)
      return res.status(400).json({ success: false, message: 'material & section مطلوبة' });

    // Validate student and codes
    const student = await Student.findById(req.userId).select('redeemedCodes').lean();
    if (!student) return res.status(404).json({ success: false, message: 'الطالب غير موجود' });

    const now = new Date();
    const validCodes = await CodesGroup.find({
      _id: { $in: (student.redeemedCodes || []).map(rc => rc.codesGroup) },
      expiration: { $gt: now },
      'codes.value': { $in: (student.redeemedCodes || []).map(rc => rc.code) },
      'codes.isUsed': true,
    }).select('materialsWithQuestions sections sectionsForQuestions access').lean();

    const hasSectionQuestionsAccess = validCodes.some(g => g.access?.questions && (
      (g.sectionsForQuestions || []).some(s => s.toString() === section) ||
      (g.sections || []).some(s => s.toString() === section) // legacy fallback
    ));
    const hasMaterialQuestionsAccess = validCodes.some(g => (g.materialsWithQuestions || []).some(m => m.toString() === material));

    if (!hasSectionQuestionsAccess && !hasMaterialQuestionsAccess) {
      // Fallback to free questions for this section (up to 5)
      const match = {
        material: new mongoose.Types.ObjectId(material),
        section: new mongoose.Types.ObjectId(section),
      };
      const MAX_PER_SECTION = 5;
      const freeGroups = await FreeQuestionGroup.aggregate([
        { $match: match },
        { $sample: { size: MAX_PER_SECTION } },
        { $project: { __v: 0 } },
      ]);

      const totalAvailable = await FreeQuestionGroup.countDocuments(match);
      return res.json({
        success: true,
        data: freeGroups,
        meta: { freeFallback: true, perSectionMax: MAX_PER_SECTION, count: freeGroups.length, totalAvailable },
      });
    }

    const groups = await QuestionGroup.find({ material, section }).lean();
    return res.json({ success: true, data: groups, meta: { hasFullAccess: true, count: groups.length } });
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
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
      .populate({
    path: 'courses', 
    populate: {
      path: 'teacher', 
      select: 'fname lname' 
    }});

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
        path: 'Section',
        select: 'Section',
        populate: { path: 'Section', select: 'material' },
      })
      .select('paragraph questions images')
      .lean();

    if (!questionGroup)
      return res.status(404).json({ message: 'لم يتم العثور على المجموعة.' });
    if (!questionGroup.Section?.Section?.material) {
      return res.status(404).json({ message: 'الدرس أو الوحدة غير موجودة.' });
    }

    const materialId = questionGroup.Section.Section.material;
    const now = new Date();
    let hasAccess = false;

    const redemptionQueries = student.redeemedCodes.map((redemption) => ({
      _id: redemption.codesGroup,
      expiration: { $gt: now },
      'codes.value': redemption.code,
      'codes.isUsed': true,
      $or: [
        { materialsWithQuestions: materialId },
        { materialsWithFiles: materialId },
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


// Get Course Files with Access Verification
exports.getCourseFiles = async (req, res) => {
  try {
    const { course } = req.params;
    const studentId = req.userId;

    // Validate course ID
    if (!course || !mongoose.Types.ObjectId.isValid(course)) {
      return res.status(400).json({ message: 'معرف الدورة غير صالح.' });
    }

    const courseId = new mongoose.Types.ObjectId(course);

    // Get student with redeemed codes
    const student = await Student.findById(studentId)
      .select('redeemedCodes')
      .lean();

    if (!student) {
      return res.status(404).json({ message: 'لم يتم العثور على الطالب.' });
    }

    // Check course access
    let hasAccess = false;
    const now = new Date();

    if (student.redeemedCodes && student.redeemedCodes.length > 0) {
      // Extract codesGroups and codes from student
      const redeemedGroupIds = student.redeemedCodes.map(rc => rc.codesGroup);
      const redeemedCodes = student.redeemedCodes.map(rc => rc.code);

      const accessCheck = await CodesGroup.findOne({
        courses: courseId,
        expiration: { $gt: now },
        _id: { $in: redeemedGroupIds },
        codes: {
          $elemMatch: {
            value: { $in: redeemedCodes },
            isUsed: true, // أو false حسب المنطق المطلوب
          },
        },
      });

      hasAccess = !!accessCheck;
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'ليس لديك صلاحية الوصول لهذه الدورة.' });
    }

    // Fetch course files
    const courseFiles = await CourseFile.find({ course: courseId }).lean();

    res.json({ courseFiles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'حدث خطأ في السيرفر.' });
  }

}
exports.getExamByMaterial = async (req, res) => {
  try {
    const { material } = req.params;

    if (!material) {
      return res.status(400).json({ success: false, message: 'material مطلوب' });
    }

    if (!mongoose.Types.ObjectId.isValid(material)) {
      return res.status(400).json({ success: false, message: 'صيغة معرف المادة غير صالحة' });
    }

    // اجمع كل أسئلة جميع الأقسام ضمن المادة
    const groups = await QuestionGroup.find({ material })
      .select('questions')
      .lean();

    const allQuestions = groups.flatMap(g => g.questions || []);

    if (allQuestions.length === 0) {
      return res.status(404).json({ success: false, message: 'ما في أسئلة لهالمادة' });
    }

    // لو بدك عينة ثابتة (مثلاً 40 سؤال)
    const MAX_Q = 40;
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(MAX_Q, shuffled.length));

    return res.json({ success: true, data: picked });
  } catch (e) {
    console.error('Error in getExamByMaterial:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
}
exports.getVideosByMaterialSection = async (req, res) => {
  try {
    const { material, section, page = 1, limit = 20 } = req.query;
    if (!material || !section) return res.status(400).json({ message: 'material & section مطلوبة' });

    // Check access: either section-level videos access OR material-level legacy videos access
    const student = await Student.findById(req.userId).select('redeemedCodes').lean();
    if (!student) return res.status(404).json({ message: 'الطالب غير موجود' });

    const now = new Date();
    const validCodes = await CodesGroup.find({
      _id: { $in: (student.redeemedCodes || []).map(rc => rc.codesGroup) },
      expiration: { $gt: now },
      'codes.value': { $in: (student.redeemedCodes || []).map(rc => rc.code) },
      'codes.isUsed': true,
  }).select('materialsWithLectures materialsWithFiles sections sectionsForVideos access').lean();

    // Allow if: access.videos + sections contains this section
    const hasSectionVideoAccess = validCodes.some(g => g.access?.videos && (
      (g.sectionsForVideos || []).some(s => s.toString() === section) ||
      (g.sections || []).some(s => s.toString() === section)
    ));
    // Legacy material-level videos access: via materialsWithLectures (preferred), or fallback to materialsWithFiles if used for videos
    const hasMaterialVideoAccess = validCodes.some(g =>
      (g.materialsWithLectures || []).some(m => m.toString() === material) ||
      (g.materialsWithFiles || []).some(m => m.toString() === material)
    );

    const q = { material, section };

    if (!hasSectionVideoAccess && !hasMaterialVideoAccess) {
      // Return only free videos for this section
      const count = await Video.countDocuments({ ...q, isFree: true });
      const docs = await Video.find({ ...q, isFree: true })
        .sort({ order: 1, createdAt: -1 })
        .skip((+page - 1) * +limit)
        .limit(+limit);
      return res.json({ docs, totalDocs: count, page: +page, limit: +limit, totalPages: Math.ceil(count / +limit), hasFullAccess: false });
    }

    // Full access
    const count = await Video.countDocuments(q);
    const docs = await Video.find(q)
      .sort({ order: 1, createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);
    return res.json({ docs, totalDocs: count, page: +page, limit: +limit, totalPages: Math.ceil(count / +limit), hasFullAccess: true });
  } catch (e) {
    console.error('Error in getVideosByMaterialSection:', e);
    return res.status(500).json({ message: e.message });
  }
};



exports.getVideos = async (req, res) => {
  try {
    const student = await Student.findById(req.user._id).lean();
    const redeemedCodes = student.redeemedCodes || [];

    // جلب مجموعات الرموز المستردة التي لا تزال صالحة
    const validCodes = await CodesGroup.find({
      'codes.value': { $in: redeemedCodes.map(c => c.code) },
      'codes.isUsed': true,
      expiration: { $gte: new Date() }
  }).select('sections sectionsForVideos access materialsWithLectures materialsWithFiles').lean();

    // السماح للوصول للفيديوهات فقط عبر:
    // 1) كود قسم للفيديوهات: access.videos + sections
    // 2) وصول قديم على مستوى المادة للفيديوهات: materialsWithLectures
    // 3) قبول materialsWithFiles كبديل قديم إذا كان يُستخدم للفيديوهات
    const allowedSectionIds = new Set(
      validCodes
        .filter(g => g.access?.videos)
        .flatMap(g => ([...(g.sectionsForVideos || []), ...(g.sections || [])].map(s => s.toString())))
    );
    const allowedMaterialIds = new Set([
      ...validCodes.flatMap(g => (g.materialsWithLectures || []).map(m => m.toString())),
      ...validCodes.flatMap(g => (g.materialsWithFiles || []).map(m => m.toString()))
    ]);

    const hasFullAccess = allowedSectionIds.size > 0 || allowedMaterialIds.size > 0;

    let query;
    if (hasFullAccess) {
      query = {
        $or: [
          allowedSectionIds.size ? { section: { $in: Array.from(allowedSectionIds) } } : null,
          allowedMaterialIds.size ? { material: { $in: Array.from(allowedMaterialIds) } } : null,
        ].filter(Boolean)
      };
    } else {
      query = { isFree: true };
    }

    const videos = await Video.find(query)
      .populate('material', 'name')
      .populate('section', 'name')
      .sort({ order: 1 })
      .lean();

    res.status(200).json({ success: true, data: videos, meta: { hasFullAccess } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'حدث خطأ أثناء جلب الفيديوهات' });
  }
}

