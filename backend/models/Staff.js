const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  // ── Auth Link ──────────────────────────────────────────────────
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  // ── Identity ───────────────────────────────────────────────────
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  // staffId is an alias exposed in APIs (same value as employeeId)
  staffId: {
    type: String,
    trim: true
  },

  designation: {
    type: String,
    enum: ['admin', 'staff', 'hod', 'security', 'maintenance', 'office_manager'],
    required: true
  },

  // ── Academic Assignment ────────────────────────────────────────
  department: {
    type: String,
    required: true,
    trim: true
  },
  section: {
    type: String,
    trim: true
  },
  assignedClassIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }],

  // ── Contact ────────────────────────────────────────────────────
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },

  // ── HR Fields ──────────────────────────────────────────────────
  dateOfJoining: {
    type: Date,
    required: true
  },
  salary: {
    type: Number,
    min: 0
  },
  qualifications: {
    type: String,
    trim: true
  },

  // ── Status ─────────────────────────────────────────────────────
  isActive: {
    type: Boolean,
    default: true
  },
  attendanceCount: {
    type: Number,
    default: 0
  },
  leaveBalance: {
    type: Number,
    default: 20
  },
  performanceRating: {
    type: Number,
    min: 0,
    max: 5,
    default: null
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

// Keep staffId in sync with employeeId
staffSchema.pre('save', function (next) {
  if (this.isModified('employeeId')) {
    this.staffId = this.employeeId;
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Staff', staffSchema);
