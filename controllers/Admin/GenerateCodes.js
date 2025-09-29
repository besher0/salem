const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const CodesGroup = require('../../models/CodesGroup');
const Section = require('../../models/Section');
const Material = require('../../models/Material');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');

// helper to generate a short code (unambiguous alphanumerics)
function generateCode(length = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1
  let code = '';
  for (let i = 0; i < length; i++) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return code;
}

exports.generateCodes = [
  // Either use legacy single-target mode or composite arrays
  body('mode').optional().isIn(['section_videos', 'section_questions', 'material_files']).withMessage('Invalid mode'),
  body('sectionId').optional().isMongoId(),
  body('materialId').optional().isMongoId(),
  body('sectionsForVideos').optional().isArray(),
  body('sectionsForVideos.*').optional().isMongoId(),
  body('sectionsForQuestions').optional().isArray(),
  body('sectionsForQuestions.*').optional().isMongoId(),
  body('materialsForFiles').optional().isArray(),
  body('materialsForFiles.*').optional().isMongoId(),
  body('materialsForAll').optional().isArray(),
  body('materialsForAll.*').optional().isMongoId(),
  body('codeCount').isInt({ min: 1, max: 10000 }).withMessage('codeCount'),
  body('expiration').isISO8601().withMessage('expiration'),
  async (req, res, next) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { mode, sectionId, materialId, sectionsForVideos, sectionsForQuestions, materialsForFiles, materialsForAll, codeCount, expiration, name } = req.body;

      const codes = [];
      const codesSet = new Set();
      while (codes.length < codeCount) {
        const c = generateCode(10);
        if (codesSet.has(c)) continue;
        codesSet.add(c);
        codes.push({ value: c, isUsed: false });
      }

  const cg = new CodesGroup({ name: name || `Codes ${new Date().toISOString()}`, codes, expiration: new Date(expiration) });
  // Ensure required array fields are present
  cg.materialsWithQuestions = [];
  cg.materialsWithLectures = [];

      // Composite handling first (arrays)
  const useComposite = (Array.isArray(sectionsForVideos) && sectionsForVideos.length) ||
                           (Array.isArray(sectionsForQuestions) && sectionsForQuestions.length) ||
           (Array.isArray(materialsForFiles) && materialsForFiles.length) ||
           (Array.isArray(materialsForAll) && materialsForAll.length);

      if (useComposite) {
        // Validate existence
        if (sectionsForVideos && sectionsForVideos.length) {
          const found = await Section.countDocuments({ _id: { $in: sectionsForVideos } });
          if (found !== sectionsForVideos.length) return res.status(400).json({ message: 'بعض الأقسام (videos) غير موجودة' });
          cg.sectionsForVideos = sectionsForVideos;
          cg.access.videos = true;
        }
        if (sectionsForQuestions && sectionsForQuestions.length) {
          const found = await Section.countDocuments({ _id: { $in: sectionsForQuestions } });
          if (found !== sectionsForQuestions.length) return res.status(400).json({ message: 'بعض الأقسام (questions) غير موجودة' });
          cg.sectionsForQuestions = sectionsForQuestions;
          cg.access.questions = true;
        }
        if (materialsForFiles && materialsForFiles.length) {
          const found = await Material.countDocuments({ _id: { $in: materialsForFiles } });
          if (found !== materialsForFiles.length) return res.status(400).json({ message: 'بعض المواد (files) غير موجودة' });
          cg.materialsWithFiles = materialsForFiles;
          cg.access.files = true;
        }
        if (materialsForAll && materialsForAll.length) {
          const found = await Material.countDocuments({ _id: { $in: materialsForAll } });
          if (found !== materialsForAll.length) return res.status(400).json({ message: 'بعض المواد (all) غير موجودة' });
          // Grant everything for these materials
          cg.materialsWithFiles = [...new Set([...(cg.materialsWithFiles || []), ...materialsForAll])];
          cg.materialsWithQuestions = [...new Set([...(cg.materialsWithQuestions || []), ...materialsForAll])];
          cg.materialsWithLectures = [...new Set([...(cg.materialsWithLectures || []), ...materialsForAll])];
          cg.access.files = true;
          cg.access.questions = true;
          cg.access.videos = true;
        }
      } else if (mode === 'section_videos') {
        if (!sectionId) return res.status(400).json({ message: 'sectionId required' });
        const section = await Section.findById(sectionId);
        if (!section) return res.status(404).json({ message: 'section not found' });
        cg.sections = [sectionId];
        cg.access.videos = true;
      } else if (mode === 'section_questions') {
        if (!sectionId) return res.status(400).json({ message: 'sectionId required' });
        const section = await Section.findById(sectionId);
        if (!section) return res.status(404).json({ message: 'section not found' });
        cg.sections = [sectionId];
        cg.access.questions = true;
      } else if (mode === 'material_files') {
        if (!materialId) return res.status(400).json({ message: 'materialId required' });
        const material = await Material.findById(materialId);
        if (!material) return res.status(404).json({ message: 'material not found' });
        cg.materialsWithFiles = [materialId];
        cg.access.files = true;
      } else if (mode === 'material_all') {
        if (!materialId) return res.status(400).json({ message: 'materialId required' });
        const material = await Material.findById(materialId);
        if (!material) return res.status(404).json({ message: 'material not found' });
        cg.materialsWithFiles = [materialId];
        cg.materialsWithQuestions = [materialId];
        cg.materialsWithLectures = [materialId];
        cg.access = { files: true, questions: true, videos: true };
      }

      await cg.save();

      // Return sample of codes
      const sample = cg.codes.slice(0, Math.min(50, cg.codes.length)).map(c => c.value);
  res.status(201).json({ message: 'CodesGroup created', codesGroupId: cg._id, sample, access: cg.access, sectionsForVideos: cg.sectionsForVideos, sectionsForQuestions: cg.sectionsForQuestions, materialsWithFiles: cg.materialsWithFiles, materialsWithQuestions: cg.materialsWithQuestions, materialsWithLectures: cg.materialsWithLectures });
    } catch (err) {
      next(err);
    }
  }
];
