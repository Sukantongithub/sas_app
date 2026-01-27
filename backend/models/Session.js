const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  // Class and faculty information
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    index: true
  },
  
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Subject details
  subject: {
    type: String,
    required: true,
    trim: true
  },
  
  subjectCode: {
    type: String,
    trim: true,
    uppercase: true
  },
  
  sessionType: {
    type: String,
    enum: ['lecture', 'lab', 'tutorial', 'seminar', 'exam', 'other'],
    default: 'lecture'
  },
  
  // Date and time
  date: {
    type: Date,
    required: true,
    index: true
  },
  
  startTime: {
    type: Date,
    required: true
  },
  
  endTime: {
    type: Date,
    required: true
  },
  
  actualStartTime: {
    type: Date // When faculty actually started the session
  },
  
  actualEndTime: {
    type: Date // When faculty actually ended the session
  },
  
  // BLE attendance settings for this session
  bleSettings: {
    scanInterval: {
      type: Number,
      default: 5, // minutes (randomized 5-10)
      min: 1,
      max: 30
    },
    
    rssiThreshold: {
      type: Number,
      default: -70 // dBm
    },
    
    maxDistance: {
      type: Number,
      default: 3 // meters
    },
    
    motionVerificationEnabled: {
      type: Boolean,
      default: true
    },
    
    motionConfidenceThreshold: {
      type: Number,
      default: 0.7
    },
    
    beaconId: String, // Classroom beacon for this session
    
    autoMarkingEnabled: {
      type: Boolean,
      default: true
    }
  },
  
  // Session status
  isActive: {
    type: Boolean,
    default: false,
    index: true
  },
  
  isCancelled: {
    type: Boolean,
    default: false
  },
  
  cancellationReason: {
    type: String
  },
  
  // Attendance statistics
  statistics: {
    totalStudents: {
      type: Number,
      default: 0
    },
    
    presentCount: {
      type: Number,
      default: 0
    },
    
    lateCount: {
      type: Number,
      default: 0
    },
    
    absentCount: {
      type: Number,
      default: 0
    },
    
    autoMarkedCount: {
      type: Number,
      default: 0
    },
    
    manualMarkedCount: {
      type: Number,
      default: 0
    },
    
    proxyAttemptCount: {
      type: Number,
      default: 0
    },
    
    attendancePercentage: {
      type: Number,
      default: 0
    },
    
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  // Notes and remarks
  notes: {
    type: String,
    maxlength: 1000
  },
  
  topics: [{
    type: String,
    trim: true
  }],
  
  // Notification settings
  notificationsSent: {
    sessionStarted: {
      type: Boolean,
      default: false
    },
    
    sessionEnding: {
      type: Boolean,
      default: false
    },
    
    sessionEnded: {
      type: Boolean,
      default: false
    }
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound indexes
sessionSchema.index({ classId: 1, date: 1 });
sessionSchema.index({ facultyId: 1, isActive: 1 });
sessionSchema.index({ date: 1, isActive: 1 });
sessionSchema.index({ startTime: 1, endTime: 1 });

// Virtual for session duration in minutes
sessionSchema.virtual('duration').get(function() {
  if (this.actualEndTime && this.actualStartTime) {
    return Math.round((this.actualEndTime - this.actualStartTime) / (1000 * 60));
  }
  return Math.round((this.endTime - this.startTime) / (1000 * 60));
});

// Virtual to check if session is currently ongoing
sessionSchema.virtual('isOngoing').get(function() {
  const now = new Date();
  return this.isActive && 
         this.actualStartTime && 
         this.actualStartTime <= now && 
         (!this.actualEndTime || this.actualEndTime >= now);
});

// Method to start session
sessionSchema.methods.startSession = async function() {
  this.isActive = true;
  this.actualStartTime = new Date();
  await this.save();
  
  // TODO: Send notification to students
  return this;
};

// Method to end session
sessionSchema.methods.endSession = async function() {
  this.isActive = false;
  this.actualEndTime = new Date();
  await this.updateStatistics();
  await this.save();
  
  // TODO: Send session ended notification
  return this;
};

// Method to update session statistics
sessionSchema.methods.updateStatistics = async function() {
  const Attendance = mongoose.model('Attendance');
  const Class = mongoose.model('Class');
  
  // Get total students in class
  const classDoc = await Class.findById(this.classId);
  const totalStudents = classDoc ? classDoc.students.length : 0;
  
  // Aggregate attendance data
  const stats = await Attendance.aggregate([
    { $match: { sessionId: this._id } },
    {
      $group: {
        _id: null,
        presentCount: {
          $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
        },
        lateCount: {
          $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
        },
        absentCount: {
          $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
        },
        autoMarkedCount: {
          $sum: { $cond: [{ $eq: ['$verificationMethod', 'ble_auto'] }, 1, 0] }
        },
        manualMarkedCount: {
          $sum: { $cond: [{ $eq: ['$verificationMethod', 'manual'] }, 1, 0] }
        },
        proxyAttemptCount: {
          $sum: { $cond: ['$isProxyAttempt', 1, 0] }
        }
      }
    }
  ]);
  
  if (stats.length > 0) {
    const data = stats[0];
    this.statistics = {
      totalStudents,
      presentCount: data.presentCount || 0,
      lateCount: data.lateCount || 0,
      absentCount: data.absentCount || 0,
      autoMarkedCount: data.autoMarkedCount || 0,
      manualMarkedCount: data.manualMarkedCount || 0,
      proxyAttemptCount: data.proxyAttemptCount || 0,
      attendancePercentage: totalStudents > 0 
        ? Math.round(((data.presentCount + data.lateCount) / totalStudents) * 100) 
        : 0,
      lastUpdated: Date.now()
    };
  } else {
    this.statistics.totalStudents = totalStudents;
  }
  
  return this;
};

// Method to check if current time is within session window
sessionSchema.methods.isWithinTimeWindow = function(dateTime = new Date()) {
  return dateTime >= this.startTime && dateTime <= this.endTime;
};

// Static method to find active sessions
sessionSchema.statics.findActiveSessions = function() {
  return this.find({
    isActive: true,
    isCancelled: false
  })
  .populate('classId', 'name code department')
  .populate('facultyId', 'name email')
  .sort({ startTime: 1 });
};

// Static method to find today's sessions for a class
sessionSchema.statics.findTodaySessions = function(classId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.find({
    classId,
    date: { $gte: today, $lt: tomorrow },
    isCancelled: false
  }).sort({ startTime: 1 });
};

// Static method to find faculty's sessions
sessionSchema.statics.findFacultySessions = function(facultyId, startDate = null, endDate = null) {
  const query = {
    facultyId,
    isCancelled: false
  };
  
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
  }
  
  return this.find(query)
    .populate('classId', 'name code')
    .sort({ date: -1, startTime: -1 });
};

// Pre-save hook to set default values
sessionSchema.pre('save', function(next) {
  // Set date from startTime if not set
  if (!this.date && this.startTime) {
    this.date = new Date(this.startTime);
    this.date.setHours(0, 0, 0, 0);
  }
  
  // Copy beacon ID from class settings if not set
  if (!this.bleSettings.beaconId && this.classId) {
    const Class = mongoose.model('Class');
    Class.findById(this.classId).then(classDoc => {
      if (classDoc && classDoc.beaconId) {
        this.bleSettings.beaconId = classDoc.beaconId;
      }
    });
  }
  
  next();
});

module.exports = mongoose.model('Session', sessionSchema);

