// files model removed: replaced by File/Section logic
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const filesSchema = new Schema(
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
    type: {
    type: String,
    enum: ['أوراق ذهبية', 'نوط', 'نموذج وزاري'],
    required: true
  },
  },
  { timestamps: true }
);
filesSchema.index({ material: 1 });
filesSchema.index({ material: 1, num: 1 }, { unique: true });

module.exports = mongoose.model('files', filesSchema);
