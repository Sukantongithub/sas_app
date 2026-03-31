const mongoose = require('mongoose');

/**
 * HOD (Head of Department) Profile
 * One HOD per department. The login account is in the User model (role = 'hod').
 * This document stores the department-specific profile.
 */
const hodSchema = new mongoose.Schema({
  // ── Auth Link ──────────────────────────────────────────────────
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  // ── Identity ───────────────────────────────────────────────────
  staffId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
    comment: 'Same as employeeId — e.g. HOD-CSE-001'
  },

  designation: {
    type: String,
    default: 'hod',
    trim: true
  },

  // ── Department ─────────────────────────────────────────────────
  department: {
    type: String,
    required: true,
    trim: true
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    index: true
  },

  // ── Contact  ───────────────────────────────────────────────────
  // email is stored on the User model; copied here for quick access
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },

  // ── HR Fields ──────────────────────────────────────────────────
  dateOfJoining: {
    type: Date
  },
  qualifications: {
    type: String,
    trim: true
  },

  // ── Status ─────────────────────────────────────────────────────
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true   // adds createdAt & updatedAt automatically
});

hodSchema.index({ department: 1 });

module.exports = mongoose.model('HOD', hodSchema);
