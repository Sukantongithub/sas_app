const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  section: {
    type: String,
    trim: true
  },
  dayOfWeek: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  periods: [{
    periodNumber: {
      type: Number,
      required: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    startTime: {
      type: String, // HH:MM format
      required: true
    },
    endTime: {
      type: String, // HH:MM format
      required: true
    },
    room: {
      type: String,
      trim: true
    },
    isLab: {
      type: Boolean,
      default: false
    }
  }],
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  effectiveTo: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
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
timetableSchema.index({ classId: 1, section: 1, dayOfWeek: 1 });
timetableSchema.index({ 'periods.teacherId': 1 });

// Update timestamp
timetableSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Get current period for a class
timetableSchema.statics.getCurrentPeriod = async function(classId, section = null) {
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = dayNames[now.getDay()];
  
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0');
  
  const query = { classId, dayOfWeek, isActive: true };
  if (section) query.section = section;
  
  const timetable = await this.findOne(query)
    .populate('periods.teacherId', 'name email');
  
  if (!timetable) return null;
  
  const currentPeriod = timetable.periods.find(period => {
    return currentTime >= period.startTime && currentTime <= period.endTime;
  });
  
  return currentPeriod || null;
};

// Get timetable for a class and day
timetableSchema.statics.getTimetableForDay = function(classId, dayOfWeek, section = null) {
  const query = { classId, dayOfWeek, isActive: true };
  if (section) query.section = section;
  
  return this.findOne(query)
    .populate('periods.teacherId', 'name email')
    .populate('classId', 'name code');
};

// Get teacher's timetable
timetableSchema.statics.getTeacherTimetable = async function(teacherId, dayOfWeek = null) {
  const query = { 'periods.teacherId': teacherId, isActive: true };
  if (dayOfWeek) query.dayOfWeek = dayOfWeek;
  
  return this.find(query)
    .populate('classId', 'name code')
    .sort({ dayOfWeek: 1, 'periods.periodNumber': 1 });
};

module.exports = mongoose.model('Timetable', timetableSchema);
