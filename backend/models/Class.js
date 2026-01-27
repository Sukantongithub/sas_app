const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  // Class identification
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true // e.g., "CSE-4A", "ECE-3B"
  },
  
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    unique: true // e.g., "CSE4A", "ECE3B"
  },
  
  // Academic details
  department: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 12 // Support up to 12 semesters
  },
  
  academicYear: {
    type: String, // e.g., "2025-2026"
    required: true
  },
  
  section: {
    type: String,
    trim: true // e.g., "A", "B", "Morning", "Evening"
  },
  
  // Students enrolled in this class
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Faculty assigned to this class
  faculty: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Class coordinator
  coordinator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // BLE beacon information for classroom location verification
  beaconId: {
    type: String,
    trim: true,
    uppercase: true // BLE MAC address of classroom beacon
  },
  
  classroom: {
    building: String,
    roomNumber: String,
    floor: Number,
    capacity: Number
  },
  
  // GPS coordinates for geofencing (optional)
  location: {
    latitude: {
      type: Number,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180
    },
    radius: {
      type: Number,
      default: 50 // meters
    }
  },
  
  // Class schedule (recurring weekly schedule)
  schedule: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true
    },
    startTime: {
      type: String, // Format: "HH:MM" (24-hour)
      required: true
    },
    endTime: {
      type: String, // Format: "HH:MM" (24-hour)
      required: true
    },
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
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['lecture', 'lab', 'tutorial', 'seminar'],
      default: 'lecture'
    }
  }],
  
  // Attendance settings
  attendanceSettings: {
    minimumRequiredPercentage: {
      type: Number,
      default: 75,
      min: 0,
      max: 100
    },
    
    // Automatic attendance marking settings
    autoMarkingEnabled: {
      type: Boolean,
      default: true
    },
    
    scanInterval: {
      type: Number,
      default: 5, // minutes
      min: 1,
      max: 30
    },
    
    lateThresholdMinutes: {
      type: Number,
      default: 15 // Mark as late if entered after 15 min
    },
    
    // RSSI threshold for presence detection
    rssiThreshold: {
      type: Number,
      default: -70 // dBm
    },
    
    // Maximum distance for attendance (meters)
    maxDistance: {
      type: Number,
      default: 3 // meters
    },
    
    // Motion verification requirement
    motionVerificationRequired: {
      type: Boolean,
      default: true
    },
    
    motionConfidenceThreshold: {
      type: Number,
      default: 0.7, // 70% confidence
      min: 0,
      max: 1
    },
    
    // Allow manual override
    allowManualOverride: {
      type: Boolean,
      default: true
    },
    
    // Require admin approval for manual changes
    requireApprovalForManualChanges: {
      type: Boolean,
      default: true
    }
  },
  
  // Class statistics (updated periodically)
  statistics: {
    totalStudents: {
      type: Number,
      default: 0
    },
    
    averageAttendance: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    
    totalSessionsConducted: {
      type: Number,
      default: 0
    },
    
    defaultersCount: {
      type: Number,
      default: 0
    },
    
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  // Class status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  startDate: {
    type: Date,
    required: true
  },
  
  endDate: {
    type: Date
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  notes: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
classSchema.index({ department: 1, semester: 1, isActive: 1 });
classSchema.index({ 'schedule.day': 1, 'schedule.startTime': 1 });
classSchema.index({ students: 1 });
classSchema.index({ faculty: 1 });

// Virtual for total enrolled students
classSchema.virtual('enrolledCount').get(function() {
  return this.students ? this.students.length : 0;
});

// Virtual for current session (if class is in progress now)
classSchema.virtual('currentSession').get(function() {
  const now = new Date();
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  return this.schedule.find(s => 
    s.day === currentDay && 
    s.startTime <= currentTime && 
    s.endTime >= currentTime
  );
});

// Method to check if a specific time is within class schedule
classSchema.methods.isWithinSchedule = function(dateTime = new Date()) {
  const day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dateTime.getDay()];
  const time = `${String(dateTime.getHours()).padStart(2, '0')}:${String(dateTime.getMinutes()).padStart(2, '0')}`;
  
  return this.schedule.some(s => 
    s.day === day && 
    s.startTime <= time && 
    s.endTime >= time
  );
};

// Method to get today's schedule
classSchema.methods.getTodaySchedule = function() {
  const today = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
  return this.schedule.filter(s => s.day === today).sort((a, b) => a.startTime.localeCompare(b.startTime));
};

// Method to add student to class
classSchema.methods.addStudent = async function(studentId) {
  if (!this.students.includes(studentId)) {
    this.students.push(studentId);
    this.statistics.totalStudents = this.students.length;
    await this.save();
  }
};

// Method to remove student from class
classSchema.methods.removeStudent = async function(studentId) {
  this.students = this.students.filter(id => !id.equals(studentId));
  this.statistics.totalStudents = this.students.length;
  await this.save();
};

// Method to update attendance statistics
classSchema.methods.updateStatistics = async function() {
  const Attendance = mongoose.model('Attendance');
  const Session = mongoose.model('Session');
  
  // Count total sessions
  const totalSessions = await Session.countDocuments({
    classId: this._id,
    isActive: false // Only count completed sessions
  });
  
  // Calculate average attendance percentage
  const attendanceStats = await Attendance.aggregate([
    { $match: { classId: this._id } },
    {
      $group: {
        _id: '$studentId',
        totalPresent: {
          $sum: {
            $cond: [{ $eq: ['$status', 'present'] }, 1, 0]
          }
        },
        totalLate: {
          $sum: {
            $cond: [{ $eq: ['$status', 'late'] }, 1, 0]
          }
        },
        totalAbsent: {
          $sum: {
            $cond: [{ $eq: ['$status', 'absent'] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        percentage: {
          $multiply: [
            {
              $divide: [
                { $add: ['$totalPresent', '$totalLate'] },
                { $add: ['$totalPresent', '$totalLate', '$totalAbsent'] }
              ]
            },
            100
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        avgPercentage: { $avg: '$percentage' },
        belowThreshold: {
          $sum: {
            $cond: [
              { $lt: ['$percentage', this.attendanceSettings.minimumRequiredPercentage] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
  
  if (attendanceStats.length > 0) {
    this.statistics.averageAttendance = Math.round(attendanceStats[0].avgPercentage || 0);
    this.statistics.defaultersCount = attendanceStats[0].belowThreshold || 0;
  }
  
  this.statistics.totalSessionsConducted = totalSessions;
  this.statistics.lastUpdated = Date.now();
  
  await this.save();
};

// Static method to find classes with active sessions right now
classSchema.statics.findActiveClasses = function() {
  const now = new Date();
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  return this.find({
    isActive: true,
    'schedule.day': currentDay,
    'schedule.startTime': { $lte: currentTime },
    'schedule.endTime': { $gte: currentTime }
  }).populate('faculty', 'name email');
};

// Static method to find classes for a specific student
classSchema.statics.findStudentClasses = function(studentId) {
  return this.find({
    students: studentId,
    isActive: true
  }).populate('faculty', 'name email')
    .populate('coordinator', 'name email');
};

// Static method to find classes for a specific faculty
classSchema.statics.findFacultyClasses = function(facultyId) {
  return this.find({
    $or: [
      { faculty: facultyId },
      { coordinator: facultyId }
    ],
    isActive: true
  }).populate('students', 'name email rollNumber');
};

// Pre-save hook to update statistics
classSchema.pre('save', function(next) {
  if (this.isModified('students')) {
    this.statistics.totalStudents = this.students.length;
  }
  next();
});

const Class = mongoose.model('Class', classSchema);

module.exports = Class;
