const mongoose = require('mongoose');
const Video = require('../../models/Video');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const { default: axios } = require('axios');
const Section = require('../../models/Section');
const Material = require('../../models/Material');

// Create a new video
exports.createVideo = [
  body('name').notEmpty().withMessage('اسم الفيديو مطلوب.'),
  body('material').isMongoId().withMessage('معرف الدورة غير صالح.'),
  body('Section').isMongoId().withMessage('معرف الوحدة غير صالح.'),
  body('video720.accessUrl')
    .optional()
    .isString()
    .withMessage('يجب أن يكون رابط الوصول لفيديو 720 نصاً.'),
  body('video720.videoId')
    .optional()
    .isString()
    .withMessage('يجب أن يكون معرف الفيديو لفيديو 720 نصاً.'),
  body('video720.libraryId')
    .optional()
    .isString()
    .withMessage('يجب أن يكون معرف المكتبة لفيديو 720 نصاً.'),
  body('video720.downloadUrl')
    .optional()
    .isString()
    .withMessage('يجب أن يكون رابط التنزيل لفيديو 720 نصاً.'),
    body('seekPoints')
    .optional()
    .isArray()
    .withMessage('يجب أن تكون نقاط التمرير مصفوفة.'),
  body('order')
    .optional()
    .isInt({ min: 1 })
    .withMessage('يجب أن يكون الترتيب عددًا صحيحًا أكبر من 0.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

         const { name, material, Section, video720, seekPoints, order } = req.body;

      const materialExists = await Material.findById(req.body.material);
      if (!materialExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الدورة.' });
      }

      // Verify if the associated Section exists
      const SectionExists = await Section.findById(req.body.section);
      if (!SectionExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على القسم.' });
      }

      // if (SectionExists.material.toString() !== materialExists.material.toString()) {
      //   return res
      //     .status(400)
      //     .json({ message: 'الدورة والوحدة لا ينتميان لنفس المادة' });
      // }

      // Process video720 information
      if (req.body.video720) {
        const playDataUrl = `https://video.bunnycdn.com/library/${req.body.video720?.libraryId}/videos/${req.body.video720?.videoId}/play?expires=0`;
        const videoPlayData = await axios.get(playDataUrl);
        req.body.video720.downloadUrl = videoPlayData?.data?.fallbackUrl;
      }
      const videoCount = await Video.countDocuments({ section: Section });
      const isFree = videoCount === 0;

   const video = new Video({
        name,
        video720: finalVideo720,
        seekPoints: seekPoints || [],
        material,
        section: Section,
        isFree,
        order: order || videoCount + 1, // تعيين ترتيب تلقائي إذا لم يُرسل
        cacheVersion: 1
      });
            await video.save();

      // Return selected fields in the response
      // const { _id, name, video720, material, Section, seekPoints } = video;
      res.status(201).json({
        video: { _id, name, video720, material, Section, seekPoints },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];

// Get videos with pagination and filters
exports.getVideos = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    // Destructure pagination and filter parameters from the query string
    const { page, limit, name, Material, Section } = req.query;
    const filter = {};

    // Filter based on video name using a case-insensitive regex
    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    // Both subject and Section ids are required for filtering in this scenario
    if (!Material || !Section) {
      return res.status(400).json({ message: 'معرف الدورة والوحدة مطلوبان.' });
    }

    // Verify if the provided subject exists
    const subjectExists = await Material.exists({ _id: Material });
    if (!subjectExists) {
      return res
        .status(400)
        .json({ message: 'عذراً، لم يتم العثور على الدورة.' });
    }

    // Verify if the provided Section exists
    const SectionExists = await Section.exists({ _id: Section });
    if (!SectionExists) {
      return res
        .status(400)
        .json({ message: 'عذراً، لم يتم العثور على الوحدة.' });
    }

    // Add filters for subject and Section
    filter.Material = new mongoose.Types.ObjectId(Material);
    filter.Section = new mongoose.Types.ObjectId(Section);

    // Paginate videos based on filter and pagination options
    const videos = await Video.paginate(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      populate: [
        { path: 'Material', select: 'name description' },
        { path: 'Section', select: 'name color' },
      ],
      select: 'name video Material Section video720 seekPoints',
    });

    res.status(200).json(videos);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};
exports.updateVideo = [
  param('id')
    .isMongoId()
    .withMessage('يرجى إدخال معرف الفيديو بشكل صحيح.'),
  body('name')
    .optional()
    .isString()
    .withMessage('اسم الفيديو يجب أن يكون نصاً.'),
  body('seekPoints')
    .optional()
    .isArray()
    .withMessage('يجب أن تكون نقاط البحث مصفوفة.'),
  body('seekPoints.*.moment')
    .notEmpty()
    .isString()
    .withMessage('لحظة النقطة مطلوبة.'),
  body('seekPoints.*.description')
    .notEmpty()
    .isString()
    .withMessage('وصف النقطة مطلوب.'),
  body('video720')
    .optional()
    .custom((value) => {
      if (value === null || (typeof value === 'object' && value !== null)) {
        return true;
      }
      return false;
    })
    .withMessage('يجب أن تكون بيانات الفيديو إما null أو كائن.'),
  body('video720.videoId')
    .if(body('video720').exists().isObject())
    .notEmpty()
    .isString()
    .withMessage('معرف الفيديو مطلوب عند التحديث.'),
  body('video720.libraryId')
    .if(body('video720').exists().isObject())
    .notEmpty()
    .isString()
    .withMessage('معرف المكتبة مطلوب عند التحديث.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Get existing video data
      const existingVideo = await Video.findById(req.params.id);
      if (!existingVideo) {
        return res.status(404).json({ error: 'الفيديو غير موجود.' });
      }

      const { name, seekPoints, video720 } = req.body;
      const updateData = { name, seekPoints };
      let oldBunnyVideos = [];

      // Handle video720 updates
      if (req.body.video720) {
          // Check if new video is different from existing
          const newVideoId = req.body.video720.videoId;
          const existingVideoId = existingVideo.video720?.videoId;
          
          if (newVideoId !== existingVideoId) {
            // Mark old video for deletion
            if (existingVideoId) {
              oldBunnyVideos.push({
                videoId: existingVideoId,
                libraryId: existingVideo.video720.libraryId
              });
            }

            // Fetch new download URL
            try {
              const playDataUrl = `https://video.bunnycdn.com/library/${req.body.video720.libraryId}/videos/${newVideoId}/play?expires=0`;
              const videoPlayData = await axios.get(playDataUrl, {
                headers: { AccessKey: process.env.BUNNY_API_KEY },
              });
              
              updateData.video720 = {
                ...req.body.video720,
                downloadUrl: videoPlayData.data?.fallbackUrl,
              };
            } catch (error) {
              return res.status(400).json({
                error: 'فشل في الحصول على بيانات الفيديو من BunnyCDN',
              });
            }
        }
      }

      // Update video in database
      const video = await Video.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      ).select('name seekPoints material video720');

      if (!video) {
        return res.status(404).json({ error: 'الفيديو غير موجود.' });
      }

      // Delete old videos from BunnyCDN
      const deletionResults = [];
      for (const bunnyVideo of oldBunnyVideos) {
        try {
          await axios.delete(
            `https://video.bunnycdn.com/library/${bunnyVideo.libraryId}/videos/${bunnyVideo.videoId}`,
            {
              headers: {
                Accept: 'application/json',
                AccessKey: process.env.BUNNY_API_KEY,
              },
            }
          );
          deletionResults.push({
            videoId: bunnyVideo.videoId,
            status: 'success'
          });
        } catch (error) {
          deletionResults.push({
            videoId: bunnyVideo.videoId,
            status: 'error',
            error: error.response?.data || error.message
          });
        }
      }

      res.status(200).json({
        video,
        bunnyDeletions: deletionResults
      });
    } catch (err) {
      res.status(500).json({ 
        error: err.message || 'حدث خطأ في الخادم.' 
      });
    }
  },
];

// Delete a video by ID
exports.deleteVideo = [
  param('id').isMongoId().withMessage('يرجى إدخال معرف الفيديو بشكل صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Find video first to get video details
      const video = await Video.findById(req.params.id);
      if (!video) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الفيديو.' });
      }

      // Prepare Bunny deletion information
      const bunnyDeletions = [];
      if (video.video720?.videoId) {
        bunnyDeletions.push({
          videoId: video.video720.videoId,
          libraryId: video.video720.libraryId,
        });
      }

      // Delete from database first
      await Video.deleteOne({ _id: video._id });

      // Process Bunny deletions
      const deletionResults = [];
      for (const bunnyVideo of bunnyDeletions) {
        try {
          const response = await axios.delete(
            `https://video.bunnycdn.com/library/${bunnyVideo.libraryId}/videos/${bunnyVideo.videoId}`,
            {
              headers: {
                Accept: 'application/json',
                AccessKey: process.env.BUNNY_API_KEY,
              },
            }
          );

          deletionResults.push({
            videoId: bunnyVideo.videoId,
            status: 'success',
            data: response.data,
          });
        } catch (error) {
          deletionResults.push({
            videoId: bunnyVideo.videoId,
            status: 'error',
            error: error.response?.data || error.message,
          });
        }
      }

      res.status(200).json({
        message: 'تم حذف الفيديو بنجاح.',
        details: {
          databaseDeleted: true,
          bunnyDeletions: deletionResults,
        },
      });
    } catch (err) {
      res.status(err.statusCode || 500).json({
        error: err.message || 'حدث خطأ في الخادم.',
        details: {
          databaseDeleted: false,
          bunnyDeletions: [],
        },
      });
    }
  },
];


// ===== Custom Additions =====

// Refresh videos list (without downloading)
exports.refreshVideos = async (req, res) => {
  try {
    const videos = await Video.find({ section: req.params.sectionId }).sort({ order: 1 });
    return res.json({ success: true, videos });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Delete downloaded video (reset state)
exports.deleteDownload = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });
    video.isDownloaded = false;
    await video.save();
    return res.json({ success: true, message: "Download deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Re-download video (simulate re-flagging download)
exports.reDownload = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });
    video.isDownloaded = true;
    await video.save();
    return res.json({ success: true, message: "Video re-downloaded" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.reorderVideos = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    const { videos,sectionId } = req.body; // توقع مصفوفة: [{ videoId, order }, ...]

    // التحقق من صحة المدخلات
    if (!Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ message: 'يجب إرسال مصفوفة غير فارغة من الفيديوهات.' });
    }

        if (sectionId) {
      const sectionExists = await Section.findById(sectionId);
      if (!sectionExists) return res.status(404).json({ message: 'القسم غير موجود.' });
      filter.section = sectionId;
    }

    // التحقق من أن جميع videoId موجودة
    const videoIds = videos.map(v => v.videoId);
    const existingVideos = await Video.find({ _id: { $in: videoIds } }).select('_id');
    if (existingVideos.length !== videoIds.length) {
      return res.status(400).json({ message: 'بعض معرفات الفيديوهات غير موجودة.' });
    }

    // التحقق من أن قيم order فريدة ومتسلسلة
    const orders = videos.map(v => v.order);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      return res.status(400).json({ message: 'قيم الترتيب يجب أن تكون فريدة.' });
    }

    // التحقق من أن قيم order تبدأ من 1 وتكون متسلسلة
    const sortedOrders = [...uniqueOrders].sort((a, b) => a - b);
    for (let i = 0; i < sortedOrders.length; i++) {
      if (sortedOrders[i] !== i + 1) {
        return res.status(400).json({ message: 'قيم الترتيب يجب أن تكون متسلسلة وتبدأ من 1.' });
      }
    }

    // تحديث حقل order لكل فيديو
    const bulkOps = videos.map(({ videoId, order }) => ({
      updateOne: {
        filter: { _id: videoId },
        update: { $set: { order } }
      }
    }));

    await Video.bulkWrite(bulkOps);

    res.status(200).json({ message: 'تم إعادة ترتيب الفيديوهات بنجاح.' });
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ أثناء إعادة ترتيب الفيديوهات.' });
  }
};

exports.updateVideoFreeStatus = async (req, res) => {
  try {
    await ensureIsAdmin(req, res, () => {}); // التحقق من صلاحيات الإداري
    const { videoId, isFree } = req.body;

    // التحقق من صحة المدخلات
    if (!videoId || typeof isFree !== 'boolean') {
      return res.status(400).json({ message: 'يجب إرسال معرف الفيديو وقيمة isFree (true/false).' });
    }

    // التحقق من وجود الفيديو
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'الفيديو غير موجود.' });
    }

    // تحديث حالة isFree
    video.isFree = isFree;
    await video.save();

    res.status(200).json({ message: 'تم تحديث حالة الفيديو بنجاح.', video });
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ أثناء تحديث حالة الفيديو.' });
  }
};