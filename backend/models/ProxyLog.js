const mongoose = require('mongoose');

const proxyLogSchema = new mongoose.Schema({
  // Student who triggered the proxy detection
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
  },

  // Session during which proxy was detected
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true
  },

  // Class information
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    index: true
  },

  // Type of proxy detection
  detectionType: {
    type: String,
    required: true,
    enum: [
      'multiple_devices',      // More than 1 device detected for user
      'no_motion',             // Phone not moving (stationary proxy)
      'distance_anomaly',      // RSSI indicates device too far
      'time_mismatch',         // Attendance outside session time
      'device_mismatch',       // Wrong device ID detected
      'rapid_location_change', // Attended multiple classes too quickly
      'pattern_anomaly',       // AI detected unusual pattern
      'beacon_mismatch',       // Wrong classroom beacon detected
      'tampered_data'          // Encrypted data validation failed
    ],
    index: true
  },

  // Severity level
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },

  // Detection evidence data
  evidenceData: {
    // BLE RSSI data
    rssi: {
      type: Number,
      min: -100,
      max: 0
    },

    calculatedDistance: {
      type: Number // in meters
    },

    // Device information
    deviceId: String,
    expectedDeviceId: String,
    deviceCount: Number,
    detectedDevices: [{
      deviceId: String,
      rssi: Number,
      timestamp: Date
    }],

    // Motion sensor data
    motionConfidence: Number, // 0.0 to 1.0
    accelerometerData: {
      x: Number,
      y: Number,
      z: Number,
      magnitude: Number
    },
    gyroscopeData: {
      x: Number,
      y: Number,
      z: Number
    },

    // Location data
    beaconId: String,
    expectedBeaconId: String,
    gpsCoordinates: {
      latitude: Number,
      longitude: Number,
      accuracy: Number
    },

    // Timing data
    attemptTime: Date,
    sessionStartTime: Date,
    sessionEndTime: Date,
    timeDifference: Number, // minutes outside session window

    // Previous attendance data (for pattern analysis)
    recentAttendancePattern: [{
      date: Date,
      classId: String,
      location: String,
      timeDifference: Number // minutes between consecutive attendance
    }],

    // Additional metadata
    phoneModel: String,
    appVersion: String,
    batteryLevel: Number
  },

  // Auto-calculated risk score (0-100)
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },

  // Action taken by system
  actionTaken: {
    type: String,
    enum: [
      'attendance_rejected',
      'attendance_flagged',
      'user_notified',
      'admin_alerted',
      'device_suspended',
      'manual_review_required',
      'no_action'
    ],
    default: 'manual_review_required'
  },

  // Review status
  status: {
    type: String,
    enum: ['pending', 'under_review', 'confirmed_proxy', 'false_positive', 'dismissed'],
    default: 'pending',
    index: true
  },

  // Admin review
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  reviewedAt: {
    type: Date
  },

  reviewNotes: {
    type: String
  },

  // Attendance record that was flagged (if exists)
  attendanceRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendance'
  },

  // Student notification sent
  studentNotified: {
    type: Boolean,
    default: false
  },

  notificationSentAt: {
    type: Date
  },

  // Repeat offender tracking
  isRepeatOffender: {
    type: Boolean,
    default: false
  },

  previousOffenseCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
proxyLogSchema.index({ studentId: 1, status: 1, createdAt: -1 });
proxyLogSchema.index({ sessionId: 1, severity: 1 });
proxyLogSchema.index({ detectionType: 1, status: 1 });
proxyLogSchema.index({ riskScore: -1, status: 1 });

// Calculate risk score based on detection type and evidence
proxyLogSchema.methods.calculateRiskScore = function () {
  let score = 0;

  // Base score by detection type
  const typeScores = {
    'multiple_devices': 90,
    'device_mismatch': 85,
    'tampered_data': 95,
    'rapid_location_change': 80,
    'distance_anomaly': 60,
    'no_motion': 50,
    'beacon_mismatch': 70,
    'time_mismatch': 40,
    'pattern_anomaly': 65
  };

  score = typeScores[this.detectionType] || 50;

  // Adjust based on evidence
  const evidence = this.evidenceData;

  // RSSI adjustment
  if (evidence.rssi && evidence.rssi < -80) {
    score += 10; // Very weak signal = likely proxy
  }

  // Motion confidence adjustment
  if (evidence.motionConfidence !== undefined) {
    if (evidence.motionConfidence < 0.3) {
      score += 15; // Very low motion = stationary device
    } else if (evidence.motionConfidence < 0.5) {
      score += 5;
    } else {
      score -= 10; // Good motion reduces suspicion
    }
  }

  // Multiple devices adjustment
  if (evidence.deviceCount > 1) {
    score += (evidence.deviceCount - 1) * 20;
  }

  // Time mismatch adjustment
  if (evidence.timeDifference && Math.abs(evidence.timeDifference) > 30) {
    score += 15; // More than 30 min outside session
  }

  // Repeat offender
  if (this.previousOffenseCount > 0) {
    score += this.previousOffenseCount * 5;
  }

  // Cap at 100
  this.riskScore = Math.min(score, 100);

  // Set severity based on score
  if (this.riskScore >= 80) {
    this.severity = 'critical';
  } else if (this.riskScore >= 60) {
    this.severity = 'high';
  } else if (this.riskScore >= 40) {
    this.severity = 'medium';
  } else {
    this.severity = 'low';
  }

  return this.riskScore;
};

// Static method to get proxy statistics for a student
proxyLogSchema.statics.getStudentProxyStats = async function (studentId) {
  const stats = await this.aggregate([
    { $match: { studentId: mongoose.Types.ObjectId(studentId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const typeBreakdown = await this.aggregate([
    { $match: { studentId: mongoose.Types.ObjectId(studentId) } },
    {
      $group: {
        _id: '$detectionType',
        count: { $sum: 1 },
        avgRiskScore: { $avg: '$riskScore' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return {
    statusBreakdown: stats,
    typeBreakdown: typeBreakdown,
    total: stats.reduce((sum, s) => sum + s.count, 0)
  };
};

// Static method to get high-risk pending logs
proxyLogSchema.statics.getHighRiskPending = function (limit = 50) {
  return this.find({
    status: { $in: ['pending', 'under_review'] },
    riskScore: { $gte: 60 }
  })
    .populate('studentId', 'name email rollNumber')
    .populate('sessionId', 'subject date')
    .sort({ riskScore: -1, createdAt: -1 })
    .limit(limit);
};

// Static method to get repeat offenders
proxyLogSchema.statics.getRepeatOffenders = async function (minOffenses = 3, days = 30) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: cutoffDate },
        status: { $in: ['confirmed_proxy', 'under_review'] }
      }
    },
    {
      $group: {
        _id: '$studentId',
        offenseCount: { $sum: 1 },
        lastOffense: { $max: '$createdAt' },
        avgRiskScore: { $avg: '$riskScore' }
      }
    },
    {
      $match: {
        offenseCount: { $gte: minOffenses }
      }
    },
    {
      $sort: { offenseCount: -1 }
    }
  ]);
};

// Pre-save hook to check for repeat offenders
proxyLogSchema.pre('save', async function (next) {
  if (this.isNew) {
    // Count previous offenses for this student
    const previousOffenses = await this.constructor.countDocuments({
      studentId: this.studentId,
      status: { $in: ['confirmed_proxy', 'under_review'] },
      _id: { $ne: this._id }
    });

    this.previousOffenseCount = previousOffenses;
    this.isRepeatOffender = previousOffenses >= 2;

    // Calculate risk score
    this.calculateRiskScore();
  }
  next();
});

const ProxyLog = mongoose.model('ProxyLog', proxyLogSchema);

module.exports = ProxyLog;
