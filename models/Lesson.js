const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const lessonSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    color: {
      type: String,
    },
    icon: {
      filename: String,
      accessUrl: String,
    },
    unit: {
      type: Schema.Types.ObjectId,
      ref: 'Unit',
    },
  },
  { timestamps: true }
);
lessonSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Lesson', lessonSchema);
