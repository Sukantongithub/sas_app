const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  // ── Basic Info ─────────────────────────────────────────────────
  name: {
    type: String,
    required: true,
    trim: true
  },
  rollNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },

  // ── Contact ────────────────────────────────────────────────────
  mobileNumber: {
    type: String,
    trim: true
  },
  // Legacy alias kept for backwards compat
  phone: {
    type: String,
    trim: true
  },

  // ── Academic ───────────────────────────────────────────────────
  year: {
    type: Number,
    min: 1,
    max: 5,
    comment: '1 = First Year, 2 = Second Year, ...'
  },
  department: {
    type: String,
    trim: true
  },
  section: {
    type: String,
    trim: true,
    default: 'A'
  },
  class: {
    type: String,       // e.g. "CSE-B" or just the class label
    required: true,
    trim: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    index: true
  },

  // ── Family ─────────────────────────────────────────────────────
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',          // Student's User account (for login)
    index: true
  },
  parentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'          // Parent User accounts
  }],

  // ── Optional extras ────────────────────────────────────────────
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  address: {
    type: String,
    trim: true
  },
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
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

// Update timestamp on save
studentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Student', studentSchema);
