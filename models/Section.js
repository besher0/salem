const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const SectionSchema = new Schema(
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
    material: {
      type: Schema.Types.ObjectId,
      ref: 'Material',
    },
  },
  { timestamps: true }
);
SectionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('section', SectionSchema);
