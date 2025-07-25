const Admin = require('../models/Admin');

exports.ensureIsAdmin = async (id) => {
  const admin = await Admin.findById(id);
  if (!admin) {
    const error = new Error('Not authorized');
    error.statusCode = 401;
    throw error;
  }
  return admin;
};
