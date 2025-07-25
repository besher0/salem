const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const lectureSchema = new Schema(
  {
    num: {
      type: Number,
      required: true,
    },
    material: {
      type: Schema.Types.ObjectId,
      ref: 'Material',
    },
    file: {
      filename: String,
      accessUrl: String,
    },
  },
  { timestamps: true }
);
lectureSchema.index({ material: 1 });
lectureSchema.index({ material: 1, num: 1 }, { unique: true });

module.exports = mongoose.model('Lecture', lectureSchema);
