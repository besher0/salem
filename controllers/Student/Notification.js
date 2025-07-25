// controllers/notificationController.js
const { StatusCodes } = require('http-status-codes');
const Notification = require('../../models/Notification');

exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.userId; // Assuming authentication middleware sets this
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Validate input
    if (page < 1 || limit < 1) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: 'Invalid pagination parameters',
      });
    }

    const skip = (page - 1) * limit;

    // Get notifications with pagination
    const notifications = await Notification.find({ student: userId })
      .select('title message createdAt') // Only return essential fields
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean(); // Faster response with plain objects

    // Get total count for pagination metadata
    const total = await Notification.countDocuments({ student: userId });

    res.status(StatusCodes.OK).json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Failed to retrieve notifications',
    });
  }
};
