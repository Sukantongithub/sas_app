const mongoose = require('mongoose');

/**
 * Parent Profile
 * Every parent has a User account (role = 'parent') for login.
 * This document stores the parent-specific identity and links to student(s).
 */
const parentSchema = new mongoose.Schema({
  // ── Auth Link ──────────────────────────────────────────────────
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  // ── Identity ───────────────────────────────────────────────────
  name: {
    type: String,
    required: true,
    trim: true
  },

  parentId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
    comment: 'Human-readable unique ID, e.g. PAR-2024-001'
  },

  // ── Contact ────────────────────────────────────────────────────
  mobileNumber: {
    type: String,
    required: true,
    trim: true
  },
  altMobileNumber: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },

  // ── Linked Students ────────────────────────────────────────────
  studentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    index: true
  }],

  // ── Optional Extras ────────────────────────────────────────────
  relation: {
    type: String,
    enum: ['father', 'mother', 'guardian', 'other'],
    default: 'guardian'
  },
  address: {
    type: String,
    trim: true
  },
  occupation: {
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

parentSchema.index({ parentId: 1 });

module.exports = mongoose.model('Parent', parentSchema);
