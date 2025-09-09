const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const questionGroupSchema = new Schema(
  {
    paragraph: String,
    images: [
      {
        name: String,
        accessUrl: String,
      },
    ],
    material: {
      type: Schema.Types.ObjectId,
      ref: 'Material',
      required: true,
    },

    // ربط بالقسم / الوحدة
    section: {
      type: Schema.Types.ObjectId,
      ref: 'Section', // أو Section إذا عندك موديل بهذا الاسم
      required: true,
    },
    questions: [
      {
        isEnglish: {
          type: Boolean,
          default: false,
        },
        text: {
          type: String,
          required: true,
        },
        isMultipleChoice: {
          type: Boolean,
          default: false,
        },
        choices: [
          {
            text: {
              type: String,
              required: true,
            },
            isCorrect: {
              type: Boolean,
              default: false,
            },
          },
        ],
        information: {
          type: String,
        },
        infoImages: [
          {
            name: String,
            accessUrl: String,
          },
        ],
      },
    ],
  }
  // { timestamps: true }
);
questionGroupSchema.plugin(mongoosePaginate);
questionGroupSchema.index({ material: 1 });
questionGroupSchema.index({ section: 1 });
questionGroupSchema.index({ createdAt: -1 });

module.exports = mongoose.model('QuestionGroup', questionGroupSchema);
