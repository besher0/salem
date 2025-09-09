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
    material: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    section: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
    },

    isFree: { type: Boolean, default: false }, // أول فيديو مجاني
    order: { type: Number,  index: true  },       // ترتيب الفيديوهات
    cacheVersion: { type: Number, default: 0 } 
  },
  { timestamps: true }
);




videoSchema.plugin(mongoosePaginate);

// فهارس على الحقول الجديدة
videoSchema.index({ material: 1, order: 1 });
videoSchema.index({ section: 1 });
videoSchema.index({ order: 1 });

module.exports = mongoose.model('Video', videoSchema);
