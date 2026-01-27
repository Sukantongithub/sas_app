const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  // Unique BLE device identifier (MAC address or UUID)
  deviceId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  
  // AES-128 encrypted device ID for secure transmission
  encryptedId: {
    type: String,
    required: true,
    unique: true
  },
  
  // User this device is paired with (one-to-one relationship)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // Ensures one device per user
    index: true
  },
  
  // Device hardware information
  hardwareModel: {
    type: String,
    enum: ['nRF52840', 'ESP32-C3', 'nRF52832', 'other'],
    default: 'nRF52840'
  },
  
  // Battery information
  batteryLevel: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  
  batteryVoltage: {
    type: Number, // in millivolts (mV)
    default: 3700
  },
  
  lowBatteryAlertSent: {
    type: Boolean,
    default: false
  },
  
  // Device status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isOnline: {
    type: Boolean,
    default: false
  },
  
  lastSeen: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Firmware information
  firmwareVersion: {
    type: String,
    default: '1.0.0'
  },
  
  // IMU sensor data (for motion verification)
  imuModel: {
    type: String,
    enum: ['LSM6DSO', 'MPU6050', 'BMI160', 'other'],
    default: 'LSM6DSO'
  },
  
  // BLE transmission power (for RSSI calibration)
  txPower: {
    type: Number,
    default: -59 // dBm at 1 meter
  },
  
  // Registration and pairing information
  registeredAt: {
    type: Date,
    default: Date.now
  },
  
  pairedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  lastSync: {
    type: Date,
    default: Date.now
  },
  
  // Security and anti-proxy features
  encryptionKey: {
    type: String,
    required: true // AES-128 key for encrypted communication
  },
  
  suspiciousActivityCount: {
    type: Number,
    default: 0
  },
  
  isSuspended: {
    type: Boolean,
    default: false
  },
  
  suspensionReason: {
    type: String
  },
  
  // Device metadata
  metadata: {
    manufacturingDate: Date,
    serialNumber: String,
    batchNumber: String,
    calibrationData: {
      rssiOffset: Number,
      accelerometerBias: [Number],
      gyroscopeBias: [Number]
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
deviceSchema.index({ userId: 1, isActive: 1 });
deviceSchema.index({ lastSeen: -1 });
deviceSchema.index({ batteryLevel: 1, isActive: 1 });

// Virtual for battery health status
deviceSchema.virtual('batteryHealth').get(function() {
  if (this.batteryLevel >= 80) return 'excellent';
  if (this.batteryLevel >= 50) return 'good';
  if (this.batteryLevel >= 20) return 'low';
  return 'critical';
});

// Method to check if device needs battery replacement
deviceSchema.methods.needsBatteryReplacement = function() {
  const monthsSinceRegistration = (Date.now() - this.registeredAt) / (1000 * 60 * 60 * 24 * 30);
  
  // If battery < 20% after < 6 months, needs replacement
  if (monthsSinceRegistration < 6 && this.batteryLevel < 20) {
    return true;
  }
  
  // If battery < 10% after 6-12 months, expected end of life
  if (monthsSinceRegistration >= 6 && this.batteryLevel < 10) {
    return true;
  }
  
  return false;
};

// Method to update battery level and check for alerts
deviceSchema.methods.updateBattery = async function(level, voltage) {
  this.batteryLevel = level;
  if (voltage) this.batteryVoltage = voltage;
  this.lastSync = Date.now();
  
  // Send low battery alert if < 20% and not already sent
  if (level < 20 && !this.lowBatteryAlertSent) {
    this.lowBatteryAlertSent = true;
    // TODO: Trigger notification service
  }
  
  // Reset alert flag if battery recharged/replaced
  if (level > 50 && this.lowBatteryAlertSent) {
    this.lowBatteryAlertSent = false;
  }
  
  await this.save();
};

// Method to mark device as seen (update lastSeen timestamp)
deviceSchema.methods.updateLastSeen = async function() {
  this.lastSeen = Date.now();
  this.isOnline = true;
  await this.save();
};

// Static method to find offline devices (not seen in > 24 hours)
deviceSchema.statics.findOfflineDevices = function(hours = 24) {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({
    lastSeen: { $lt: cutoffTime },
    isActive: true
  }).populate('userId', 'name email rollNumber');
};

// Static method to find low battery devices
deviceSchema.statics.findLowBatteryDevices = function(threshold = 20) {
  return this.find({
    batteryLevel: { $lt: threshold },
    isActive: true
  }).populate('userId', 'name email rollNumber');
};

// Pre-save hook to validate device-user pairing
deviceSchema.pre('save', async function(next) {
  if (this.isModified('userId')) {
    // Check if user already has another device paired
    const existingDevice = await this.constructor.findOne({
      userId: this.userId,
      _id: { $ne: this._id },
      isActive: true
    });
    
    if (existingDevice) {
      throw new Error('User already has an active device paired. Unpair existing device first.');
    }
  }
  next();
});

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
