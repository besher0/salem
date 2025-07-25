const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const codesGroupSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    codes: [
      {
        value: {
          type: String,
          required: true,
        },
        isUsed: {
          type: Boolean,
          default: false,
        },
      },
    ],
    expiration: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value > new Date();
        },
        message: 'Expiration date should be in the future.',
      },
    },
    materialsWithQuestions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Material',
        required: true,
      },
    ],
    materialsWithLectures: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Material',
        required: true,
      },
    ],
    courses: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],
  },
  { timestamps: true }
);

// Indexes
codesGroupSchema.index(
  { 'codes.value': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'codes.value': { $exists: true },
    },
  }
);

codesGroupSchema.index({ expiration: 1 });
codesGroupSchema.index({ materialsWithQuestions: 1 });
codesGroupSchema.index({ materialsWithLectures: 1 });
codesGroupSchema.index({ courses: 1 });
codesGroupSchema.index({
  'codes.isUsed': 1,
  expiration: 1,
});
codesGroupSchema.index({ name: 'text' });
codesGroupSchema.index({ createdAt: -1 });

// Compound index for materials appearing in both arrays
codesGroupSchema.plugin(mongoosePaginate);

// Add helper methods for easy access checking
codesGroupSchema.methods = {
  hasQuestionAccess: function (materialId) {
    return this.materialsWithQuestions.includes(materialId);
  },
  hasLectureAccess: function (materialId) {
    return this.materialsWithLectures.includes(materialId);
  },
  hasAnyAccess: function (materialId) {
    return (
      this.hasQuestionAccess(materialId) || this.hasLectureAccess(materialId)
    );
  },
};

module.exports = mongoose.model('CodesGroup', codesGroupSchema);
