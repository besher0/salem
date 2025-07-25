const Student = require('../../models/Student');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');

exports.getStudents = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);

    // Extract query parameters
    const { page, limit, name, phone, email, isBlocked } = req.query;
    const filter = {};

    // Filter by name (fname or lname)
    if (name) {
      filter.$or = [
        { fname: { $regex: name, $options: 'i' } },
        { lname: { $regex: name, $options: 'i' } },
      ];
    }

    // Filter by phone number
    if (phone) {
      filter.phone = { $regex: phone, $options: 'i' };
    }

    // Filter by email
    if (email) {
      filter.email = { $regex: email, $options: 'i' };
    }

    // Filter by block status (true/false)
    if (isBlocked === true || isBlocked === 'true') {
      filter.isBlocked = isBlocked === 'true';
    }

    // Fetch students with pagination
    const students = await Student.paginate(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      select: 'fname lname phone email isBlocked', // Return only necessary fields
    });

    res.status(200).json(students);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};

exports.blockStudent = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId); // Ensure only admins can perform this action

    const { id } = req.params;
    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({ message: 'الطالب غير موجود' });
    }

    student.isBlocked = !student.isBlocked; // Toggle block status
    await student.save();

    res.status(200).json({
      message: `تم ${student.isBlocked ? 'حظر' : 'إلغاء حظر'} الطالب بنجاح`,
      student,
    });
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};
const { StatusCodes } = require('http-status-codes');

exports.checkBlockedStatus = async (req, res) => {
  try {
    const { id } = req.params; // User ID from request parameters
    const student = await Student.findById(id).select('isBlocked fname lname');

    if (!student) {
      return res.status(404).json({ message: 'الطالب غير موجود' });
    }

    res.status(StatusCodes.OK).json({
      isBlocked: student.isBlocked,
      message: student.isBlocked
        ? 'تم حظر هذا المستخدم من قبل الإدارة'
        : 'المستخدم غير محظور',
      student: {
        id: student._id,
        fname: student.fname,
        lname: student.lname,
      },
    });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: 'حدث خطأ في الخادم.' });
  }
};
