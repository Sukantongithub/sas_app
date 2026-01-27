const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  // Student information
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Session and class information
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true
  },
  
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    index: true
  },
  
  // Date and time
  date: {
    type: Date,
    required: true,
    index: true
  },
  
  entryTime: {
    type: Date,
    required: true
  },
  
  exitTime: {
    type: Date
  },
  
  // Duration in minutes
  duration: {
    type: Number,
    default: 0
  },
  
  // Attendance status
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'excused'],
    required: true,
    index: true
  },
  
  // Verification method
  verificationMethod: {
    type: String,
    enum: ['ble_auto', 'manual', 'face_verified', 'nfc', 'qr_code'],
    default: 'ble_auto',
    required: true
  },
  
  // BLE verification data
  bleData: {
    deviceId: String,
    rssi: {
      type: Number,
      min: -100,
      max: 0
    },
    calculatedDistance: Number, // in meters
    txPower: Number,
    scanTimestamp: Date,
    batteryLevel: Number,
    firmwareVersion: String
  },
  
  // Motion sensor verification
  motionData: {
    hasMotion: {
      type: Boolean,
      default: false
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    accelerometerMagnitude: Number,
    gyroscopeActivity: Number,
    verifiedAt: Date
  },
  
  // Location verification
  locationData: {
    beaconId: String,
    beaconVerified: {
      type: Boolean,
      default: false
    },
    gpsCoordinates: {
      latitude: Number,
      longitude: Number,
      accuracy: Number
    },
    geofenceVerified: {
      type: Boolean,
      default: false
    }
  },
  
  // Anti-proxy flags
  isProxyAttempt: {
    type: Boolean,
    default: false,
    index: true
  },
  
  proxyReason: {
    type: String,
    enum: [
      'multiple_devices',
      'no_motion',
      'distance_anomaly',
      'time_mismatch',
      'device_mismatch',
      'beacon_mismatch',
      'tampered_data',
      null
    ]
  },
  
  proxyLogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProxyLog'
  },
  
  // Manual marking information
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Faculty/Admin who manually marked
  },
  
  manualReason: {
    type: String,
    maxlength: 500
  },
  
  requiresApproval: {
    type: Boolean,
    default: false
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  approvedAt: {
    type: Date
  },

  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },

  rejectionReason: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Audit trail
  modificationHistory: [{
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    modifiedAt: {
      type: Date,
      default: Date.now
    },
    previousStatus: String,
    newStatus: String,
    reason: String
  }],
  
  // Legacy field for backward compatibility
  remarks: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  markedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes
attendanceSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });
attendanceSchema.index({ studentId: 1, date: 1 });
attendanceSchema.index({ classId: 1, date: 1 });
attendanceSchema.index({ sessionId: 1, status: 1 });
attendanceSchema.index({ date: 1, status: 1 });

// Virtual for attendance percentage
attendanceSchema.virtual('attendancePercentage').get(function() {
  if (this.duration && this.sessionDuration) {
    return Math.round((this.duration / this.sessionDuration) * 100);
  }
  return this.status === 'present' || this.status === 'late' ? 100 : 0;
});

// Method to mark exit time and calculate duration
attendanceSchema.methods.markExit = async function(exitTime = new Date()) {
  this.exitTime = exitTime;
  this.duration = Math.round((exitTime - this.entryTime) / (1000 * 60)); // minutes
  await this.save();
};

// Method to add modification to history
attendanceSchema.methods.addModification = function(modifiedBy, previousStatus, newStatus, reason) {
  this.modificationHistory.push({
    modifiedBy,
    modifiedAt: new Date(),
    previousStatus,
    newStatus,
    reason
  });
};

// Static method to get attendance stats for a student
attendanceSchema.statics.getStudentStats = async function(studentId, classId = null, startDate = null, endDate = null) {
  const query = { studentId };
  
  if (classId) query.classId = classId;
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
  }
  
  const stats = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalClasses: { $sum: 1 },
        present: {
          $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
        },
        late: {
          $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
        },
        absent: {
          $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
        },
        excused: {
          $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] }
        },
        proxyAttempts: {
          $sum: { $cond: ['$isProxyAttempt', 1, 0] }
        },
        autoMarked: {
          $sum: { $cond: [{ $eq: ['$verificationMethod', 'ble_auto'] }, 1, 0] }
        },
        manualMarked: {
          $sum: { $cond: [{ $eq: ['$verificationMethod', 'manual'] }, 1, 0] }
        },
        totalDuration: { $sum: '$duration' }
      }
    },
    {
      $project: {
        _id: 0,
        totalClasses: 1,
        present: 1,
        late: 1,
        absent: 1,
        excused: 1,
        proxyAttempts: 1,
        autoMarked: 1,
        manualMarked: 1,
        totalDuration: 1,
        attendancePercentage: {
          $multiply: [
            {
              $divide: [
                { $add: ['$present', '$late'] },
                '$totalClasses'
              ]
            },
            100
          ]
        },
        avgDuration: {
          $divide: ['$totalDuration', '$totalClasses']
        }
      }
    }
  ]);
  
  return stats.length > 0 ? stats[0] : {
    totalClasses: 0,
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    proxyAttempts: 0,
    autoMarked: 0,
    manualMarked: 0,
    totalDuration: 0,
    attendancePercentage: 0,
    avgDuration: 0
  };
};

// Static method to get defaulters list
attendanceSchema.statics.getDefaulters = async function(classId, threshold = 75, startDate = null, endDate = null) {
  const matchStage = { classId };
  if (startDate || endDate) {
    matchStage.date = {};
    if (startDate) matchStage.date.$gte = startDate;
    if (endDate) matchStage.date.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$studentId',
        totalClasses: { $sum: 1 },
        present: {
          $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
        },
        late: {
          $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        studentId: '$_id',
        totalClasses: 1,
        present: 1,
        late: 1,
        percentage: {
          $multiply: [
            {
              $divide: [
                { $add: ['$present', '$late'] },
                '$totalClasses'
              ]
            },
            100
          ]
        }
      }
    },
    {
      $match: {
        percentage: { $lt: threshold }
      }
    },
    {
      $sort: { percentage: 1 }
    }
  ]);
};

module.exports = mongoose.model('Attendance', attendanceSchema);
