const { StatusCodes } = require('http-status-codes');
const Student = require('../../models/Student'); // Adjust the path based on your project structure

exports.updateFcmToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;

    // Validate the new FCM token
    if (!fcmToken) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'FCM token is required',
      });
    }

    // Extract student ID from request (assumes middleware sets req.userId)
    const studentId = req.userId;

    // Find the student and update their FCM token
    const updatedStudent = await Student.findByIdAndUpdate(
      studentId, // Find student by their ID
      { fcmToken }, // Update the FCM token
      { new: true } // Return the updated student document
    );

    if (!updatedStudent) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: 'Student not found',
      });
    }

    return res.status(StatusCodes.OK).json({
      message: 'FCM token updated successfully',
      student: updatedStudent, // Optionally return the updated student data
    });
  } catch (error) {
    console.error('Error updating FCM token:', error);
    next(error); // Pass the error to the error-handling middleware
  }
};
