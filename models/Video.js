// models/Video.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const videoSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    video720: {
      accessUrl: String,
      videoId: String,
      libraryId: String,
      downloadUrl: String,
    },
    seekPoints: [
      {
        moment: String,
        description: String,
      },
    ],
    course: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    unit: {
      type: Schema.Types.ObjectId,
      ref: 'Unit',
      required: true,
    },
  },
  { timestamps: true }
);

videoSchema.plugin(mongoosePaginate);
videoSchema.index({ course: 1 });
videoSchema.index({ unit: 1 });

module.exports = mongoose.model('Video', videoSchema);
