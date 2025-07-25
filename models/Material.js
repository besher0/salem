const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const materialSchema = new Schema(
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
  },
  { timestamps: true }
);
materialSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Material', materialSchema);
