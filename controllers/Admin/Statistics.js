const mongoose = require('mongoose');
const Teacher = require('../../models/Teacher');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
exports.getTeachersStatistics = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    const stats = await mongoose.model('Teacher').aggregate([
      {
        $lookup: {
          from: 'courses',
          localField: '_id',
          foreignField: 'teacher',
          as: 'courses',
        },
      },
      // Filter out teachers with empty courses array immediately
      {
        $match: {
          'courses.0': { $exists: true },
        },
      },
      { $unwind: '$courses' },
      {
        $lookup: {
          from: 'codesgroups',
          let: { courseId: '$courses._id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$$courseId', '$courses'] },
                'codes.isUsed': true,
              },
            },
            { $unwind: '$codes' },
            { $match: { 'codes.isUsed': true } },
            { $count: 'usedCount' },
          ],
          as: 'redemptions',
        },
      },
      {
        $group: {
          _id: '$_id',
          name: {
            $first: {
              $concat: ['$fname', ' ', '$lname'],
            },
          },
          courses: {
            $push: {
              courseId: '$courses._id',
              name: '$courses.name',
              material: '$courses.material',
              numberOfRedemptions: {
                $ifNull: [{ $arrayElemAt: ['$redemptions.usedCount', 0] }, 0],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          teacherId: '$_id',
          name: 1,
          courses: 1,
        },
      },
    ]);

    res.status(200).json(stats);
  } catch (err) {
    console.error('Error fetching teacher statistics:', err);
    res.status(500).json({
      error: err.message || 'حدث خطأ في الخادم.',
    });
  }
};
