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
    // Unified field for granting access to files of a material
    materialsWithFiles: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Material',
      },
    ],
    // Backwards-compatible alias for old typo used across student controllers
    // Some controllers reference `materialsWithfiless` (typo). Provide a virtual
    // so both names map to the same underlying data.
    materialsWithLectures: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Material',
        required: true,
      },
    ],
    // Legacy sections field (backward compatibility):
    sections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Section' }],
    // New precise per-type section grants:
    sectionsForVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Section' }],
    sectionsForQuestions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Section' }],
      // Access flags indicate what this codes group grants when redeemed
      access: {
        videos: { type: Boolean, default: false },
        questions: { type: Boolean, default: false },
        files: { type: Boolean, default: false },
      },
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
codesGroupSchema.index({ sectionsForVideos: 1 });
codesGroupSchema.index({ sectionsForQuestions: 1 });

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

// Virtual alias for backward compatibility with controllers that expect the
// misspelled `materialsWithfiless` field. This exposes the same array and
// allows pushing/setting via either name.
codesGroupSchema.virtual('materialsWithfiless')
  .get(function () {
    return this.materialsWithFiles;
  })
  .set(function (v) {
    this.materialsWithFiles = v;
  });

// Ensure virtuals are included when converting to objects/JSON
codesGroupSchema.set('toObject', { virtuals: true });
codesGroupSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('CodesGroup', codesGroupSchema);
