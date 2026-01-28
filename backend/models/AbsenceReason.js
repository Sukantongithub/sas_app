const mongoose = require('mongoose');

const absenceReasonSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Student user who submitted
    required: true
  },
  attendanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendance',
    required: true
  },
  date: {
    type: String, // YYYY-MM-DD format
    required: true,
    index: true
  },
  reason: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  reasonType: {
    type: String,
    enum: ['illness', 'family_emergency', 'transportation', 'personal', 'other'],
    default: 'other'
  },
  status: {
    type: String,
    enum: ['pending', 'acknowledged', 'rejected'],
    default: 'pending',
    required: true,
    index: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Teacher/Admin who reviewed
  },
  reviewedAt: {
    type: Date
  },
  reviewRemarks: {
    type: String,
    trim: true,
    maxlength: 500
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for unique constraint
absenceReasonSchema.index({ studentId: 1, date: 1, attendanceId: 1 });

// Update timestamp on save
absenceReasonSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('AbsenceReason', absenceReasonSchema);
