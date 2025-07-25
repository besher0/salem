const { body, param, query, validationResult } = require('express-validator');
const {
  Types: { ObjectId },
  mongoose,
} = require('mongoose');
const CodesGroup = require('../../models/CodesGroup');
const Material = require('../../models/Material');
const Course = require('../../models/Course');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { v4: uuidv4 } = require('uuid');
const Student = require('../../models/Student');

// Create Codes Group
exports.createCodesGroup = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('يرجى إدخال اسم المجموعة.')
    .isLength({ max: 100 })
    .withMessage('اسم المجموعة يجب أن يكون أقل من 100 حرف.'),
  body('materialsWithQuestions')
    .optional()
    .isArray()
    .withMessage('المواد مع الأسئلة يجب أن تكون في شكل قائمة.')
    .custom((value) => value.every((id) => mongoose.Types.ObjectId.isValid(id)))
    .withMessage('يحتوي أحد العناصر على معرف مادة غير صحيح.'),
  body('materialsWithLectures')
    .optional()
    .isArray()
    .withMessage('المواد مع المحاضرات يجب أن تكون في شكل قائمة.')
    .custom((value) => value.every((id) => mongoose.Types.ObjectId.isValid(id)))
    .withMessage('يحتوي أحد العناصر على معرف مادة غير صحيح.'),
  body('courses')
    .optional()
    .isArray()
    .withMessage('الدورات يجب أن تكون في شكل قائمة.')
    .custom((value) => value.every((id) => ObjectId.isValid(id)))
    .withMessage('رقم تعريف الدورة غير صحيح.'),
  body('codeCount')
    .isInt({ min: 1, max: 10000 })
    .withMessage('عدد الأكواد يجب أن يكون بين 1 و 10000.'),
  body('expiration')
    .isISO8601()
    .withMessage('صيغة تاريخ الانتهاء غير صحيحة.')
    .custom((value) => new Date(value) > new Date())
    .withMessage('يجب أن يكون تاريخ الانتهاء في المستقبل.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const {
        name,
        materialsWithQuestions = [],
        materialsWithLectures = [],
        courses = [],
        codeCount,
        expiration,
      } = req.body;
      // Verify materials exist
      const allMaterials = [
        ...materialsWithQuestions,
        ...materialsWithLectures,
      ];
      if (allMaterials.length > 0) {
        const existingMaterials = await Material.countDocuments({
          _id: { $in: allMaterials },
        });
        if (existingMaterials !== new Set(allMaterials).size) {
          return res.status(404).json({ error: 'بعض المواد غير موجودة.' });
        }
      }

      // Verify courses exist
      if (courses.length > 0) {
        const existingCourses = await Course.countDocuments({
          _id: { $in: courses },
        });
        if (existingCourses !== courses.length) {
          return res.status(404).json({ error: 'بعض الدورات غير موجودة.' });
        }
      }

      // Generate unique codes
      const codes = Array.from({ length: codeCount }, () => ({
        value: uuidv4().replace(/-/g, '').substring(0, 12),
        isUsed: false,
      }));

      const codesGroup = new CodesGroup({
        name,
        codes,
        materialsWithQuestions,
        materialsWithLectures,
        courses,
        expiration: new Date(expiration),
      });

      await codesGroup.save();

      // Updated response with codes array
      res.status(201).json({
        message: 'تم إنشاء مجموعة الأكواد بنجاح.',
        data: {
          _id: codesGroup._id,
          name: codesGroup.name,
          codeCount: codesGroup.codes.length,
          expiration: codesGroup.expiration,
          codes: codesGroup.codes,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: err.message || 'حدث خطأ أثناء إنشاء مجموعة الأكواد.',
      });
    }
  },
];

// Get Codes Groups
exports.getCodesGroups = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1 }).toInt(),
  query('name').optional().trim(),
  query('material').optional().isMongoId(),
  query('course').optional().isMongoId(),
  query('expirationFrom').optional().isISO8601(),
  query('expirationTo').optional().isISO8601(),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        page = 1,
        limit = 10,
        name,
        material,
        course,
        expirationFrom,
        expirationTo,
      } = req.query;

      const filter = {};
      if (name) filter.name = { $regex: name, $options: 'i' };

      if (material) {
        filter.$or = [
          { materialsWithQuestions: material },
          { materialsWithLectures: material },
        ];
      }

      if (course) filter.courses = new mongoose.Types.ObjectId(course);

      if (expirationFrom || expirationTo) {
        filter.expiration = {};
        if (expirationFrom) filter.expiration.$gte = new Date(expirationFrom);
        if (expirationTo) filter.expiration.$lte = new Date(expirationTo);
      }

      const result = await CodesGroup.paginate(filter, {
        page,
        limit,
        sort: { createdAt: -1 },
        populate: [
          {
            path: 'materialsWithQuestions',
            select: 'name',
          },
          {
            path: 'materialsWithLectures',
            select: 'name',
          },
          {
            path: 'courses',
            select: 'name material teacher',
            populate: [
              {
                path: 'material',
                select: 'name',
              },
              {
                path: 'teacher',
                select: 'fname lname',
              },
            ],
          },
        ],
        select:
          'name codes expiration materialsWithQuestions materialsWithLectures courses createdAt',
      });

      // Format response with usage statistics
      const enhancedDocs = result.docs.map((group) => ({
        _id: group._id,
        name: group.name,
        expiration: group.expiration,
        createdAt: group.createdAt,
        totalCodes: group.codes.length,
        usedCodes: group.codes.filter((c) => c.isUsed).length,
        materialsWithQuestions: group.materialsWithQuestions.map(
          (material) => ({
            _id: material._id,
            name: material.name,
          })
        ),
        materialsWithLectures: group.materialsWithLectures.map((material) => ({
          _id: material._id,
          name: material.name,
        })),
        courses: group.courses.map((course) => ({
          _id: course._id,
          name: course.name,
          material: course.material?.name,
          teacher: course.teacher
            ? `${course.teacher.fname} ${course.teacher.lname}`
            : null,
        })),
      }));

      res.status(200).json({
        message: 'تم جلب مجموعات الأكواد بنجاح.',
        data: enhancedDocs,
        total: result.totalDocs,
        page: result.page,
        pages: result.totalPages,
        limit: result.limit,
      });
    } catch (err) {
      console.error('Error in getCodesGroups:', err);
      res.status(500).json({
        error: 'حدث خطأ في جلب مجموعات الأكواد.',
        details: err.message,
      });
    }
  },
];

exports.getCodesFromGroup = [
  param('id')
    .isMongoId()
    .withMessage('يرجى إدخال رقم تعريف المجموعة بشكل صحيح.'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1 }).toInt(),
  query('usage')
    .optional()
    .isIn(['all', 'used', 'unused'])
    .withMessage('يرجى اختيار فلتر الاستخدام بشكل صحيح.'),

  async (req, res) => {
    // await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { usage = 'all', page = 1, limit = 10 } = req.query;

      const codesGroup = await CodesGroup.findById(id).select(
        'name expiration codes'
      );
      if (!codesGroup) {
        return res
          .status(404)
          .json({ error: 'لم يتم العثور على مجموعة الأكواد المطلوبة.' });
      }

      // Apply usage filter
      let filteredCodes = codesGroup.codes;
      switch (usage) {
        case 'used':
          filteredCodes = codesGroup.codes.filter((c) => c.isUsed);
          break;
        case 'unused':
          filteredCodes = codesGroup.codes.filter((c) => !c.isUsed);
          break;
      }

      // Pagination calculations
      const totalCodes = filteredCodes.length;
      const totalPages = Math.ceil(totalCodes / limit);
      const startIndex = (page - 1) * limit;
      const paginatedCodes = filteredCodes.slice(
        startIndex,
        startIndex + limit
      );

      // Response data
      const response = {
        _id: codesGroup._id,
        name: codesGroup.name,
        expiration: codesGroup.expiration,
        totalCodes: totalCodes,
        totalUsed: codesGroup.codes.filter((c) => c.isUsed).length,
        codes: paginatedCodes,
        filter: usage,
      };

      return res.status(200).json({
        message: 'تم جلب الأكواد بنجاح.',
        data: response,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          totalCodes,
          totalPages,
        },
      });
    } catch (err) {
      return res.status(500).json({
        error: err.message || 'حدث خطأ أثناء جلب الأكواد.',
      });
    }
  },
];

// Delete Codes Group
exports.deleteCodesGroup = [
  param('id')
    .isMongoId()
    .withMessage('يرجى إدخال رقم تعريف المجموعة بشكل صحيح.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const group = await CodesGroup.findById(req.params.id);

      if (!group) {
        return res
          .status(404)
          .json({ error: 'عذرًا، لم يتم العثور على المجموعة المطلوبة.' });
      }

      // Check if any codes are used
      const hasUsedCodes = group.codes.some((c) => c.isUsed);
      if (hasUsedCodes) {
        return res.status(400).json({
          error: 'لا يمكن حذف المجموعة لأنها تحتوي على أكواد مستخدمة.',
        });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Delete the codes group
        await CodesGroup.deleteOne({ _id: req.params.id }, { session });

        // Remove references from students
        await Student.updateMany(
          { 'redeemedCodes.codesGroup': req.params.id },
          { $pull: { redeemedCodes: { codesGroup: req.params.id } } },
          { session }
        );

        await session.commitTransaction();
        res.status(200).json({ message: 'تم حذف المجموعة بنجاح.' });
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: 'حدث خطأ أثناء محاولة حذف المجموعة.' });
    }
  },
];

// generate pdf
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
exports.exportCodeCardsPDF = [
  param('id')
    .isMongoId()
    .withMessage('يرجى إدخال رقم تعريف المجموعة بشكل صحيح.'),

  async (req, res) => {
    // await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const codesGroup = await mongoose
        .model('CodesGroup')
        .findById(req.params.id)
        .populate([
          { path: 'materials', select: 'name' },
          { path: 'courses', select: 'name' },
        ])
        .lean();

      if (!codesGroup) {
        return res
          .status(404)
          .json({ error: 'عذرًا، لم يتم العثور على المجموعة المطلوبة.' });
      }

      const unusedCodes = codesGroup.codes.filter((c) => !c.isUsed);
      if (unusedCodes.length === 0) {
        return res
          .status(400)
          .json({ error: 'لا توجد أكواد غير مستخدمة متوفرة.' });
      }

      const doc = new PDFDocument({
        layout: 'portrait',
        size: 'A4',
        margin: 0,
        info: {
          Title: `${codesGroup.name} Access Cards`,
          Author: 'Education Platform',
          CreationDate: new Date(),
        },
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${codesGroup.name}_Access_Cards.pdf"`
      );

      doc.pipe(res);

      const centeredText = (text, y, size = 12) => {
        doc.fontSize(size).text(text, 0, y, { align: 'center', width: 612 });
      };

      const createCodeCard = async (code) => {
        const lineHeights = {
          header: 19.2,
          subheader: 14.4,
          qr: 200,
          section: 16.8,
        };

        let totalHeight =
          lineHeights.header + lineHeights.subheader * 2 + 40 + lineHeights.qr;
        const hasMaterials = codesGroup.materials.length > 0;
        const hasCourses = codesGroup.courses.length > 0;

        if (hasMaterials) totalHeight += lineHeights.section + 20;
        if (hasCourses) totalHeight += lineHeights.section + 20;

        const startY = (842 - totalHeight) / 2;
        let currentY = startY;

        centeredText(codesGroup.name, currentY, 16);
        currentY += lineHeights.header;

        centeredText(
          `تاريخ الانتهاء: ${new Date(
            codesGroup.expiration
          ).toLocaleDateString()}`,
          currentY
        );
        currentY += lineHeights.subheader;

        centeredText(`الكود: ${code.value}`, currentY);
        currentY += lineHeights.subheader + 20;

        const qrBuffer = await QRCode.toBuffer(code.value, {
          errorCorrectionLevel: 'H',
          width: 200,
          margin: 1,
        });
        const qrX = (612 - 200) / 2;
        doc.image(qrBuffer, qrX, currentY, { width: 200 });
        currentY += lineHeights.qr + 20;

        if (hasMaterials) {
          const materialsText = `المواد: ${codesGroup.materials
            .map((m) => m.name)
            .join(' - ')}`;
          centeredText(materialsText, currentY, 14);
          currentY += lineHeights.section + 20;
        }

        if (hasCourses) {
          const coursesText = `الدورات: ${codesGroup.courses
            .map((c) => c.name)
            .join(' - ')}`;
          centeredText(coursesText, currentY, 14);
        }
      };

      for (const code of unusedCodes) {
        await createCodeCard(code);
        if (code !== unusedCodes[unusedCodes.length - 1]) {
          doc.addPage();
        }
      }

      doc.end();
    } catch (err) {
      console.error('خطأ في إنشاء ملف PDF:', err);
      res.status(500).json({
        error: err.message || 'حدث خطأ أثناء إنشاء بطاقات الأكواد.',
      });
    }
  },
];
