const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const courseFileSchema = new Schema(
  {
    num: {
      type: Number,
      required: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
    },
    file: {
      filename: String,
      accessUrl: String,
    },
  },
  { timestamps: true }
);
courseFileSchema.index({ course: 1 });
courseFileSchema.index({ course: 1, num: 1 }, { unique: true });

module.exports = mongoose.model('CourseFile', courseFileSchema);
