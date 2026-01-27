const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Parent or student who requested
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  leaveType: {
    type: String,
    enum: ['sick', 'casual', 'emergency', 'vacation', 'other'],
    default: 'casual',
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Teacher/Admin who approved/rejected
  },
  approvalDate: {
    type: Date
  },
  approvalRemarks: {
    type: String,
    trim: true
  },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  notificationSent: {
    type: Boolean,
    default: false
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

// Indexes for faster queries
leaveSchema.index({ studentId: 1, status: 1 });
leaveSchema.index({ startDate: 1, endDate: 1 });
leaveSchema.index({ requestedBy: 1 });

// Update timestamp on save
leaveSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for duration in days
leaveSchema.virtual('duration').get(function() {
  const diffTime = Math.abs(this.endDate - this.startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
});

// Method to approve leave
leaveSchema.methods.approve = async function(userId, remarks) {
  this.status = 'approved';
  this.approvedBy = userId;
  this.approvalDate = new Date();
  if (remarks) this.approvalRemarks = remarks;
  return await this.save();
};

// Method to reject leave
leaveSchema.methods.reject = async function(userId, remarks) {
  this.status = 'rejected';
  this.approvedBy = userId;
  this.approvalDate = new Date();
  if (remarks) this.approvalRemarks = remarks;
  return await this.save();
};

// Static method to get pending leaves
leaveSchema.statics.getPendingLeaves = function(filters = {}) {
  return this.find({ status: 'pending', ...filters })
    .populate('studentId', 'name rollNumber class section')
    .populate('requestedBy', 'name email role')
    .sort({ createdAt: -1 });
};

// Static method to get student's leave summary
leaveSchema.statics.getStudentSummary = async function(studentId, academicYear) {
  const query = { studentId, status: 'approved' };
  
  if (academicYear) {
    const { startDate, endDate } = academicYear;
    query.startDate = { $gte: startDate };
    query.endDate = { $lte: endDate };
  }
  
  const leaves = await this.find(query);
  
  let totalDays = 0;
  const breakdown = {};
  
  leaves.forEach(leave => {
    const days = leave.duration;
    totalDays += days;
    breakdown[leave.leaveType] = (breakdown[leave.leaveType] || 0) + days;
  });
  
  return {
    totalLeaves: leaves.length,
    totalDays,
    breakdown,
    leaves
  };
};

module.exports = mongoose.model('Leave', leaveSchema);
