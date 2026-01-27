const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  designation: {
    type: String,
    enum: ['admin', 'staff', 'security', 'maintenance', 'office_manager'],
    required: true
  },
  department: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
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

module.exports = mongoose.model('Staff', staffSchema);
