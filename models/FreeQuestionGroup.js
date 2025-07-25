const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const freeQuestionGroupSchema = new Schema(
  {
    paragraph: String,
    images: [
      {
        filename: String,
        accessUrl: String,
      },
    ],
    lesson: {
      type: Schema.Types.ObjectId,
      ref: 'Lesson',
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
            filename: String,
            accessUrl: String,
          },
        ],
      },
    ],
  }
  // { timestamps: true }
);
freeQuestionGroupSchema.plugin(mongoosePaginate);
freeQuestionGroupSchema.index({ material: 1 });

module.exports = mongoose.model('FreeQuestionGroup', freeQuestionGroupSchema);
