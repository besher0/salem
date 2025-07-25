const { StatusCodes } = require('http-status-codes');
const Student = require('../../models/Student');
const Notification = require('../../models/Notification'); // Add this import
const admin = require('../../util/firebase');

// Utility function for rate limiting
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Improved batch sender with retries and notification storage
const sendBatch = async (batch, title, message) => {
  const MAX_RETRIES = 3;
  let attempt = 0;
  const tokens = batch.map((item) => item.token);

  while (attempt < MAX_RETRIES) {
    try {
      // Send notifications through FCM
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body: message },
      });

      // Prepare successful notifications for bulk insert
      const successfulNotifications = [];
      const invalidTokens = new Set();

      response.responses.forEach((result, index) => {
        if (result.success) {
          successfulNotifications.push({
            title,
            message,
            student: batch[index].studentId,
          });
        } else {
          invalidTokens.add(batch[index].token);
        }
      });

      // Store notifications in bulk
      if (successfulNotifications.length > 0) {
        await Notification.insertMany(successfulNotifications, {
          ordered: false,
        });
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
      };
    } catch (error) {
      if (
        ++attempt === MAX_RETRIES ||
        error.code === 'messaging/invalid-argument'
      ) {
        console.error(`Final failure after ${MAX_RETRIES} attempts:`, error);
        return {
          successCount: 0,
          failureCount: batch.length,
          invalidTokens: new Set(tokens),
        };
      }
      await delay(2000 * attempt); // Exponential backoff
    }
  }
};

exports.sendNotificationToAllStudents = async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Title and message are required',
      });
    }

    const BATCH_SIZE = 500;
    let totalSuccess = 0,
      totalFailure = 0;
    const invalidTokens = new Set();
    let processedCount = 0;

    // Stream students with valid FCM tokens
    const cursor = Student.find(
      { fcmToken: { $exists: true, $ne: '' } },
      'fcmToken _id' // Include student ID for notification storage
    ).cursor();
    // console.log(cursor);
    try {
      let batch = [];
      for await (const student of cursor) {
        const token = student.fcmToken.trim();
        if (!token) continue;

        // Store both token and student ID in batch
        batch.push({
          token,
          studentId: student._id,
        });
        processedCount++;

        if (batch.length >= BATCH_SIZE || processedCount % 10000 === 0) {
          console.log(
            `Processing batch ${Math.ceil(processedCount / BATCH_SIZE)}`
          );

          // Process batch and store notifications
          const result = await sendBatch(batch, title, message);

          // Update statistics
          totalSuccess += result.successCount || 0;
          totalFailure += result.failureCount || batch.length;
          result.invalidTokens.forEach((t) => invalidTokens.add(t));

          batch = [];
          await delay(800); // Maintain rate limit
        }
      }

      // Process final partial batch
      if (batch.length > 0) {
        const result = await sendBatch(batch, title, message);
        totalSuccess += result.successCount || 0;
        totalFailure += result.failureCount || batch.length;
        result.invalidTokens.forEach((t) => invalidTokens.add(t));
      }
    } finally {
      cursor.close(); // Prevent memory leaks
    }

    // Clean invalid tokens
    if (invalidTokens.size > 0) {
      await Student.updateMany(
        { fcmToken: { $in: Array.from(invalidTokens) } },
        { $unset: { fcmToken: '' } }
      );
      console.log(`Cleaned ${invalidTokens.size} invalid tokens`);
    }

    return res.status(StatusCodes.OK).json({
      message: 'Notification campaign completed',
      totalRecipients: processedCount,
      totalSuccess,
      totalFailure,
      invalidTokensCleaned: invalidTokens.size,
    });
  } catch (error) {
    console.error('Critical failure:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};
