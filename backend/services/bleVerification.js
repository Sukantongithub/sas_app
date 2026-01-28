// BLE Attendance Verification Service
// Handles automatic attendance marking with anti-proxy detection

const ProxyLog = require('../models/ProxyLog');
const Device = require('../models/Device');
const Session = require('../models/Session');
const Class = require('../models/Class');

/**
 * Calculate distance from RSSI using log-distance path loss model
 * @param {number} rssi - Received Signal Strength Indicator (dBm)
 * @param {number} txPower - TX power at 1 meter (default: -59 dBm)
 * @returns {number} Distance in meters
 */
function calculateDistance(rssi, txPower = -59) {
  if (rssi === 0) {
    return -1.0; // Unknown distance
  }
  
  const ratio = rssi / txPower;
  
  if (ratio < 1.0) {
    return Math.pow(ratio, 10);
  } else {
    const distance = 0.89976 * Math.pow(ratio, 7.7095) + 0.111;
    return distance;
  }
}

/**
 * Verify BLE proximity based on RSSI
 * @param {Object} bleData - BLE scan data
 * @param {Object} session - Session object
 * @returns {Promise<Object>} Verification result
 */
async function verifyBLEProximity(bleData, session) {
  const errors = [];
  const rssiThreshold = session.bleSettings?.rssiThreshold || -70;
  const maxDistance = session.bleSettings?.maxDistance || 3;
  
  // Check RSSI threshold
  if (bleData.rssi < rssiThreshold) {
    errors.push({
      type: 'distance_anomaly',
      severity: 'high',
      message: `RSSI too weak (${bleData.rssi} dBm < ${rssiThreshold} dBm)`,
      rssi: bleData.rssi,
      calculatedDistance: calculateDistance(bleData.rssi, bleData.txPower || -59)
    });
  }
  
  // Calculate and verify distance
  const distance = calculateDistance(bleData.rssi, bleData.txPower || -59);
  
  if (distance > maxDistance) {
    errors.push({
      type: 'distance_anomaly',
      severity: 'high',
      message: `Device too far (${distance.toFixed(2)}m > ${maxDistance}m)`,
      rssi: bleData.rssi,
      calculatedDistance: distance
    });
  }
  
  return {
    verified: errors.length === 0,
    distance,
    errors
  };
}

/**
 * Verify motion sensor data
 */
async function verifyMotion(motionData, session) {
  const errors = [];
  
  // Check if motion verification is enabled
  if (!session.bleSettings?.motionVerificationEnabled) {
    return { verified: true, errors: [] };
  }
  
  const threshold = session.bleSettings?.motionConfidenceThreshold || 0.7;
  
  if (!motionData || !motionData.hasMotion) {
    errors.push({
      type: 'no_motion',
      severity: 'medium',
      message: 'No motion detected - device may be stationary',
      confidence: motionData?.confidence || 0
    });
  }
  
  if (motionData && motionData.confidence < threshold) {
    errors.push({
      type: 'no_motion',
      severity: motionData.confidence < 0.3 ? 'high' : 'medium',
      message: `Motion confidence too low (${motionData.confidence} < ${threshold})`,
      confidence: motionData.confidence
    });
  }
  
  return {
    verified: errors.length === 0,
    errors
  };
}

/**
 * Verify device belongs to user
 */
async function verifyDevice(studentId, bleData) {
  const errors = [];
  
  const device = await Device.findOne({
    userId: studentId,
    isActive: true
  });
  
  if (!device) {
    errors.push({
      type: 'device_mismatch',
      severity: 'critical',
      message: 'No device registered for this user'
    });
    return { verified: false, errors, device: null };
  }
  
  if (device.deviceId !== bleData.deviceId) {
    errors.push({
      type: 'device_mismatch',
      severity: 'critical',
      message: 'Device ID mismatch',
      expected: device.deviceId,
      received: bleData.deviceId
    });
  }
  
  if (device.isSuspended) {
    errors.push({
      type: 'device_mismatch',
      severity: 'critical',
      message: 'Device is suspended',
      reason: device.suspensionReason
    });
  }
  
  return {
    verified: errors.length === 0,
    errors,
    device
  };
}

/**
 * Verify time window
 */
function verifyTimeWindow(session, currentTime = new Date()) {
  const errors = [];
  
  if (!session.isWithinTimeWindow(currentTime)) {
    const timeDifference = Math.min(
      Math.abs(currentTime - session.startTime),
      Math.abs(currentTime - session.endTime)
    ) / (1000 * 60); // minutes
    
    errors.push({
      type: 'time_mismatch',
      severity: timeDifference > 30 ? 'high' : 'medium',
      message: `Attendance marked outside session time`,
      sessionStart: session.startTime,
      sessionEnd: session.endTime,
      currentTime,
      timeDifference: Math.round(timeDifference)
    });
  }
  
  return {
    verified: errors.length === 0,
    errors
  };
}

/**
 * Verify classroom location (beacon)
 */
async function verifyLocation(locationData, session) {
  const errors = [];
  
  if (!session.bleSettings?.beaconId) {
    return { verified: true, errors: [] }; // No beacon required
  }
  
  if (!locationData || !locationData.beaconId) {
    errors.push({
      type: 'beacon_mismatch',
      severity: 'medium',
      message: 'No classroom beacon detected'
    });
    return { verified: false, errors };
  }
  
  if (locationData.beaconId !== session.bleSettings.beaconId) {
    errors.push({
      type: 'beacon_mismatch',
      severity: 'high',
      message: 'Wrong classroom detected',
      expected: session.bleSettings.beaconId,
      detected: locationData.beaconId
    });
  }
  
  return {
    verified: errors.length === 0,
    errors
  };
}

/**
 * Check for multiple device detection
 */
async function checkMultipleDevices(studentId, detectedDevices = []) {
  const errors = [];
  
  const studentDevices = detectedDevices.filter(d => d.userId?.equals(studentId));
  
  if (studentDevices.length > 1) {
    errors.push({
      type: 'multiple_devices',
      severity: 'critical',
      message: `Multiple devices detected for same user (${studentDevices.length})`,
      deviceCount: studentDevices.length,
      devices: studentDevices.map(d => ({
        deviceId: d.deviceId,
        rssi: d.rssi
      }))
    });
  }
  
  return {
    verified: errors.length === 0,
    errors
  };
}

/**
 * Main verification function
 * Runs all verification checks and determines if attendance should be marked
 */
async function verifyAttendance(studentId, sessionId, bleData, motionData, locationData, detectedDevices = []) {
  try {
    const session = await Session.findById(sessionId)
      .populate('classId');
    
    if (!session) {
      return {
        verified: false,
        error: 'Session not found'
      };
    }
    
    if (!session.isActive) {
      return {
        verified: false,
        error: 'Session is not active'
      };
    }

    // Ensure session is linked to a class before accessing classId._id
    if (!session.classId) {
      return {
        verified: false,
        error: 'Session has no class assigned'
      };
    }
    
    // Run all verification checks in parallel
    const [
      proximityCheck,
      motionCheck,
      deviceCheck,
      timeCheck,
      locationCheck,
      multipleDeviceCheck
    ] = await Promise.all([
      verifyBLEProximity(bleData, session),
      verifyMotion(motionData, session),
      verifyDevice(studentId, bleData),
      Promise.resolve(verifyTimeWindow(session)),
      verifyLocation(locationData, session),
      checkMultipleDevices(studentId, detectedDevices)
    ]);
    
    // Collect all errors
    const allErrors = [
      ...proximityCheck.errors,
      ...motionCheck.errors,
      ...deviceCheck.errors,
      ...timeCheck.errors,
      ...locationCheck.errors,
      ...multipleDeviceCheck.errors
    ];
    
    // Determine if attendance should be marked
    const verified = allErrors.length === 0;
    const criticalErrors = allErrors.filter(e => e.severity === 'critical');
    const highErrors = allErrors.filter(e => e.severity === 'high');
    
    // If critical or multiple high severity errors, reject attendance
    const shouldReject = criticalErrors.length > 0 || highErrors.length >= 2;
    
    // Calculate risk score
    let riskScore = 0;
    allErrors.forEach(error => {
      if (error.severity === 'critical') riskScore += 30;
      else if (error.severity === 'high') riskScore += 20;
      else if (error.severity === 'medium') riskScore += 10;
      else riskScore += 5;
    });
    
    // If not verified, log proxy attempt
    if (!verified) {
      const primaryError = criticalErrors[0] || highErrors[0] || allErrors[0];
      
      const proxyLog = new ProxyLog({
        studentId,
        sessionId,
        classId: session.classId._id,
        detectionType: primaryError.type,
        severity: primaryError.severity,
        evidenceData: {
          rssi: bleData.rssi,
          calculatedDistance: proximityCheck.distance,
          deviceId: bleData.deviceId,
          expectedDeviceId: deviceCheck.device?.deviceId,
          deviceCount: multipleDeviceCheck.errors[0]?.deviceCount,
          detectedDevices: multipleDeviceCheck.errors[0]?.devices,
          motionConfidence: motionData?.confidence,
          accelerometerData: motionData?.accelerometer,
          gyroscopeData: motionData?.gyroscope,
          beaconId: locationData?.beaconId,
          expectedBeaconId: session.bleSettings?.beaconId,
          attemptTime: new Date(),
          sessionStartTime: session.startTime,
          sessionEndTime: session.endTime,
          timeDifference: timeCheck.errors[0]?.timeDifference
        },
        riskScore,
        actionTaken: shouldReject ? 'attendance_rejected' : 'attendance_flagged'
      });
      
      await proxyLog.save();
      
      // Update device suspicious activity counter
      if (deviceCheck.device) {
        deviceCheck.device.suspiciousActivityCount += 1;
        await deviceCheck.device.save();
      }
    }
    
    return {
      verified,
      shouldReject,
      riskScore,
      errors: allErrors,
      proximityCheck,
      motionCheck,
      deviceCheck,
      timeCheck,
      locationCheck,
      multipleDeviceCheck,
      device: deviceCheck.device
    };
  } catch (error) {
    return {
      verified: false,
      error: error.message
    };
  }
}

module.exports = {
  calculateDistance,
  verifyAttendance,
  verifyBLEProximity,
  verifyMotion,
  verifyDevice,
  verifyTimeWindow,
  verifyLocation,
  checkMultipleDevices
};
