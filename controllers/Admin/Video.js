const mongoose = require('mongoose');
const Video = require('../../models/Video');
const Course = require('../../models/Course');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const { default: axios } = require('axios');
const Unit = require('../../models/Unit');

// Create a new video
exports.createVideo = [
  body('name').notEmpty().withMessage('اسم الفيديو مطلوب.'),
  body('course').isMongoId().withMessage('معرف الدورة غير صالح.'),
  body('unit').isMongoId().withMessage('معرف الوحدة غير صالح.'),
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

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify if the associated course exists
      const courseExists = await Course.findById(req.body.course);
      if (!courseExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الدورة.' });
      }

      // Verify if the associated unit exists
      const unitExists = await Unit.findById(req.body.unit);
      if (!unitExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الوحدة.' });
      }

      if (unitExists.material.toString() !== courseExists.material.toString()) {
        return res
          .status(400)
          .json({ message: 'الدورة والوحدة لا ينتميان لنفس المادة' });
      }

      // Process video720 information
      if (req.body.video720) {
        const playDataUrl = `https://video.bunnycdn.com/library/${req.body.video720?.libraryId}/videos/${req.body.video720?.videoId}/play?expires=0`;
        const videoPlayData = await axios.get(playDataUrl);
        req.body.video720.downloadUrl = videoPlayData?.data?.fallbackUrl;
      }

      const video = new Video(req.body);
      await video.save();

      // Return selected fields in the response
      const { _id, name, video720, course, unit, seekPoints } = video;
      res.status(201).json({
        video: { _id, name, video720, course, unit, seekPoints },
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
    const { page, limit, name, course, unit } = req.query;
    const filter = {};

    // Filter based on video name using a case-insensitive regex
    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    // Both course and unit ids are required for filtering in this scenario
    if (!course || !unit) {
      return res.status(400).json({ message: 'معرف الدورة والوحدة مطلوبان.' });
    }

    // Verify if the provided course exists
    const courseExists = await Course.exists({ _id: course });
    if (!courseExists) {
      return res
        .status(400)
        .json({ message: 'عذراً، لم يتم العثور على الدورة.' });
    }

    // Verify if the provided unit exists
    const unitExists = await Unit.exists({ _id: unit });
    if (!unitExists) {
      return res
        .status(400)
        .json({ message: 'عذراً، لم يتم العثور على الوحدة.' });
    }

    // Add filters for course and unit
    filter.course = new mongoose.Types.ObjectId(course);
    filter.unit = new mongoose.Types.ObjectId(unit);

    // Paginate videos based on filter and pagination options
    const videos = await Video.paginate(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      populate: [
        { path: 'course', select: 'name description' },
        { path: 'unit', select: 'name color' },
      ],
      select: 'name video course unit video720 seekPoints',
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
      ).select('name seekPoints course video720');

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
