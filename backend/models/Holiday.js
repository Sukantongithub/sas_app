const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date // For multi-day holidays
  },
  type: {
    type: String,
    enum: ['national', 'regional', 'institutional', 'festival', 'other'],
    default: 'institutional',
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  applicableTo: [{
    type: String // 'all', 'class:10A', 'department:CS', etc.
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// Indexes
holidaySchema.index({ date: 1 });
holidaySchema.index({ type: 1 });

// Update timestamp
holidaySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Check if a date is a holiday
holidaySchema.statics.isHoliday = async function(date, filters = {}) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const holiday = await this.findOne({
    $or: [
      { date: { $gte: startOfDay, $lte: endOfDay } },
      { date: { $lte: startOfDay }, endDate: { $gte: endOfDay } }
    ],
    ...filters
  });
  
  return !!holiday;
};

// Get holidays in a date range
holidaySchema.statics.getHolidaysInRange = function(startDate, endDate, filters = {}) {
  return this.find({
    $or: [
      { date: { $gte: startDate, $lte: endDate } },
      { date: { $lte: startDate }, endDate: { $gte: endDate } },
      { date: { $lte: endDate }, endDate: { $gte: startDate } }
    ],
    ...filters
  }).sort({ date: 1 });
};

module.exports = mongoose.model('Holiday', holidaySchema);
