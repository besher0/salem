const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const sellCenterSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    address: String,
    phone: String,
    image: {
      filename: String,
      accessUrl: String,
    },
  },
  { timestamps: true }
);
sellCenterSchema.plugin(mongoosePaginate);
sellCenterSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phone: { $type: 'string' },
    },
  }
);
module.exports = mongoose.model('SellCenter', sellCenterSchema);
