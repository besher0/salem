// models/Notification.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      index: true, // Add index for frequently searched fields
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true, // Crucial index for fast lookups
    },
  },
  {
    timestamps: true,
    // Add compound index for common query patterns
    index: {
      student: 1,
      createdAt: -1,
    },
  }
);

module.exports = mongoose.model('Notification', notificationSchema);
