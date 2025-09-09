const mongoose = require('mongoose');
const CodesGroup = require('../../models/CodesGroup');
const Material = require('../../models/Material');
const Student = require('../../models/Student');
const Question = require('../../models/QuestionGroup');
const Course = require('../../models/Course');
const Video = require('../../models/Video');
const QuestionGroup = require('../../models/QuestionGroup');
const Section = require('../../models/Section');

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
      }).select('materialsWithQuestions materialsWithfiless');

      if (codesGroup) {
        codesGroup.materialsWithQuestions.forEach((id) =>
          questionMaterialIds.add(id.toString())
        );
        codesGroup.materialsWithfiless.forEach((id) =>
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
    const [materialsWithQuestions, materialsWithfiless] = await Promise.all([
      Material.find({ _id: { $in: questionIdsArray } })
        .select('-__v -createdAt -updatedAt')
        .lean(),

      Material.find({ _id: { $in: filesIdsArray } })
        .select('-__v -createdAt -updatedAt')
        .lean(),
    ]);

    res.status(200).json({
      materialsWithQuestions,
      materialsWithfiless,
      count: {
        questions: materialsWithQuestions.length,
        filess: materialsWithfiless.length,
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

    const groups = await QuestionGroup.find({ material, section }).lean();
    return res.json({ success: true, data: groups });
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
        { materialsWithfiless: materialId },
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
  const { material, section, page = 1, limit = 20 } = req.query;
  if (!material || !section) return res.status(400).json({ message: 'material & section مطلوبة' });

  const q = { material, section };
  const count = await Video.countDocuments(q);
  const docs = await Video.find(q)
    .sort({ order: 1, createdAt: -1 })
    .skip((+page-1)*+limit)
    .limit(+limit);

  res.json({ docs, totalDocs: count, page: +page, limit: +limit, totalPages: Math.ceil(count/+limit) });
};



exports.getVideos = async (req, res) => {
  try {
    const student = await Student.findById(req.user._id).lean();
    const redeemedCodes = student.redeemedCodes || [];

    // جلب مجموعات الرموز المستردة التي لا تزال صالحة
    const validCodes = await CodesGroup.find({
      'codes.value': { $in: redeemedCodes.map(c => c.code) },
      expiration: { $gte: new Date() }
    }).lean();

    // استخراج المواد المرتبطة بالرموز المستردة
    const accessibleMaterials = validCodes.flatMap(group => group.materialsWithQuestions || []).map(id => id.toString());
    const accessibleLectures = validCodes.flatMap(group => group.materialsWithfiless || []).map(id => id.toString());
    const accessibleMaterialsSet = new Set([...accessibleMaterials, ...accessibleLectures]);

    let videos;
    if (accessibleMaterialsSet.size > 0) {
      // إذا كان لديه رموز مفعلة، جلب كل الفيديوهات المرتبطة بالمواد المسموح بها
      videos = await Video.find({
        material: { $in: Array.from(accessibleMaterialsSet) }
      })
        .populate('material', 'name')
        .populate('section', 'name')
        .sort({ order: 1 })
        .lean();
    } else {
      // إذا لم يكن لديه رموز، جلب الفيديوهات المجانية فقط
      videos = await Video.find({ isFree: true })
        .populate('material', 'name')
        .populate('section', 'name')
        .sort({ order: 1 })
        .lean();
    }

    res.status(200).json(videos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'حدث خطأ أثناء جلب الفيديوهات' });
  }
}

