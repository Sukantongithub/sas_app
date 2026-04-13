const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Device = require('../models/Device');
const Class = require('../models/Class');
const Session = require('../models/Session');
const Timetable = require('../models/Timetable');
const ProxyLog = require('../models/ProxyLog');
const MotionPatternAnalyzer = require('../utils/motionPatternAnalyzer');

const DEVICE_BUFFER_SIZE = parseInt(process.env.MOTION_BUFFER_SIZE || '10', 10);
const AUTO_ATTENDANCE_CONFIDENCE = parseFloat(process.env.AUTO_ATTENDANCE_CONFIDENCE || '0.7');
const AUTO_ATTENDANCE_WINDOW_MINUTES = parseInt(process.env.AUTO_ATTENDANCE_WINDOW_MINUTES || '15', 10);

const deviceBuffers = new Map();

function normalizeDeviceId(value) {
  return String(value || '').trim().toUpperCase().replace(/[:-]/g, '');
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildDateKey(date = new Date()) {
  return new Date(date).toISOString().split('T')[0];
}

function getDayOfWeek(date = new Date()) {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
}

function parseTimeToDate(dateKey, timeText) {
  const [hours, minutes] = String(timeText || '00:00').split(':').map((part) => parseInt(part, 10) || 0);
  const value = new Date(`${dateKey}T00:00:00`);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

function normalizeConfidence(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return value > 1 ? value / 100 : value;
}

function extractMotionMagnitude(reading) {
  const suppliedMagnitude = toNumber(reading.m, Number.NaN);
  if (Number.isFinite(suppliedMagnitude) && suppliedMagnitude > 0) {
    return suppliedMagnitude;
  }

  const ax = toNumber(reading.ax);
  const ay = toNumber(reading.ay);
  const az = toNumber(reading.az);

  return Math.sqrt(ax ** 2 + ay ** 2 + az ** 2);
}

function appendMotionSample(deviceId, sample) {
  const buffer = deviceBuffers.get(deviceId) || [];
  buffer.push(sample);

  while (buffer.length > DEVICE_BUFFER_SIZE) {
    buffer.shift();
  }

  deviceBuffers.set(deviceId, buffer);
  return buffer;
}

async function resolveStudentContext(deviceId) {
  const device = await Device.findOne({ deviceId, isActive: true });
  if (!device) {
    return { device: null, student: null, classDoc: null };
  }

  const student = await Student.findOne({ userId: device.userId }).populate('classId');
  if (!student) {
    return { device, student: null, classDoc: null };
  }

  let classDoc = student.classId || null;
  if (!classDoc && student.class) {
    classDoc = await Class.findOne({ name: student.class });
  }

  return { device, student, classDoc };
}

async function resolveCurrentPeriod(classDoc, currentDate = new Date()) {
  if (!classDoc) {
    return null;
  }

  const dayOfWeek = getDayOfWeek(currentDate);
  const timetable = await Timetable.findOne({
    classId: classDoc._id,
    dayOfWeek,
    isActive: true,
    effectiveFrom: { $lte: currentDate },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: currentDate } }]
  });

  if (!timetable || !Array.isArray(timetable.periods) || timetable.periods.length === 0) {
    return null;
  }

  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
  const activePeriod = timetable.periods.find((period) => {
    const [startHour, startMinute] = String(period.startTime || '00:00').split(':').map((part) => parseInt(part, 10) || 0);
    const [endHour, endMinute] = String(period.endTime || '00:00').split(':').map((part) => parseInt(part, 10) || 0);

    const windowStart = (startHour * 60 + startMinute) - AUTO_ATTENDANCE_WINDOW_MINUTES;
    const windowEnd = (endHour * 60 + endMinute) + AUTO_ATTENDANCE_WINDOW_MINUTES;
    return currentMinutes >= windowStart && currentMinutes <= windowEnd;
  });

  if (!activePeriod) {
    return null;
  }

  return {
    timetable,
    period: activePeriod,
    dayOfWeek
  };
}

async function resolveSession({ student, classDoc, timetable, period, currentDate }) {
  const dateKey = buildDateKey(currentDate);
  const startTime = parseTimeToDate(dateKey, period.startTime);
  const endTime = parseTimeToDate(dateKey, period.endTime);
  const facultyId = period.teacherId || classDoc.faculty?.[0] || classDoc.coordinator || student.userId;

  let session = await Session.findOne({
    classId: classDoc._id,
    date: dateKey,
    startTime,
    endTime
  });

  if (!session) {
    session = await Session.create({
      classId: classDoc._id,
      facultyId,
      subject: period.subject,
      subjectCode: period.subjectCode,
      sessionType: period.isLab ? 'lab' : 'lecture',
      date: dateKey,
      startTime,
      endTime,
      isActive: true,
      createdBy: facultyId,
      bleSettings: {
        motionVerificationEnabled: true,
        motionConfidenceThreshold: classDoc.attendanceSettings?.motionConfidenceThreshold || 0.7,
        rssiThreshold: classDoc.attendanceSettings?.rssiThreshold || -70,
        maxDistance: classDoc.attendanceSettings?.maxDistance || 3,
        beaconId: classDoc.beaconId || undefined
      }
    });
  }

  return session;
}

async function processMotionReading(payload) {
  const currentDate = new Date();
  const deviceId = normalizeDeviceId(payload.deviceId || payload.id);
  const motionMagnitude = extractMotionMagnitude(payload);

  const sample = {
    timestamp: currentDate.toISOString(),
    motionMagnitude,
    ax: toNumber(payload.ax),
    ay: toNumber(payload.ay),
    az: toNumber(payload.az),
    rssi: toNumber(payload.r, -50)
  };

  const buffer = appendMotionSample(deviceId, sample.motionMagnitude);
  if (buffer.length < DEVICE_BUFFER_SIZE) {
    return {
      deviceId,
      buffered: true,
      bufferSize: buffer.length,
      analysis: null,
      attendance: null
    };
  }

  const motionSequence = buffer.slice(-DEVICE_BUFFER_SIZE);
  const analysis = await MotionPatternAnalyzer.analyzePattern(motionSequence);
  const confidence = normalizeConfidence(analysis.confidence);
  const isNaturalMotion = analysis.label === 'Genuine' && confidence >= AUTO_ATTENDANCE_CONFIDENCE;

  const result = {
    deviceId,
    buffered: false,
    bufferSize: buffer.length,
    analysis: {
      ...analysis,
      confidence,
      timestamp: currentDate.toISOString(),
      motionSequence
    },
    attendance: null
  };

  const { device, student, classDoc } = await resolveStudentContext(deviceId);
  if (!device || !student || !classDoc) {
    result.analysis.autoMarkEligible = false;
    result.analysis.reason = !device ? 'device_not_registered' : !student ? 'student_not_found' : 'class_not_found';
    return result;
  }

  if (!classDoc.attendanceSettings?.autoMarkingEnabled) {
    result.analysis.autoMarkEligible = false;
    result.analysis.reason = 'auto_marking_disabled_for_class';
    return result;
  }

  const periodContext = await resolveCurrentPeriod(classDoc, currentDate);
  if (!periodContext) {
    result.analysis.autoMarkEligible = false;
    result.analysis.reason = 'outside_class_period_window';
    return result;
  }

  const { timetable, period, dayOfWeek } = periodContext;
  const session = await resolveSession({
    student,
    classDoc,
    timetable,
    period,
    currentDate
  });

  const existingAttendance = await Attendance.findOne({
    studentId: student._id,
    sessionId: session._id
  });

  if (existingAttendance) {
    result.analysis.autoMarkEligible = true;
    result.analysis.reason = 'already_marked';
    result.attendance = {
      status: existingAttendance.status,
      attendanceId: existingAttendance._id
    };
    return result;
  }

  if (!isNaturalMotion) {
    const proxyLog = await ProxyLog.create({
      studentId: student._id,
      sessionId: session._id,
      classId: classDoc._id,
      detectionType: 'pattern_anomaly',
      severity: confidence < 0.5 ? 'high' : 'medium',
      evidenceData: {
        motionConfidence: confidence,
        accelerometerData: {
          x: sample.ax,
          y: sample.ay,
          z: sample.az,
          magnitude: sample.motionMagnitude
        },
        attemptTime: currentDate,
        sessionStartTime: session.startTime,
        sessionEndTime: session.endTime,
        phoneModel: 'ESP32',
        appVersion: 'hardware-imu',
        sensorSource: 'accelerometer'
      },
      actionTaken: 'manual_review_required',
      status: 'pending'
    });

    const flaggedAttendance = await Attendance.create({
      studentId: student._id,
      sessionId: session._id,
      classId: classDoc._id,
      date: buildDateKey(currentDate),
      entryTime: currentDate,
      exitTime: null,
      status: 'excused',
      verificationMethod: 'ble_auto',
      isProxyAttempt: true,
      proxyReason: 'tampered_data',
      proxyLogId: proxyLog._id,
      motionData: {
        hasMotion: true,
        confidence,
        accelerometerMagnitude: Math.sqrt(sample.ax ** 2 + sample.ay ** 2 + sample.az ** 2),
        verifiedAt: currentDate
      },
      bleData: {
        deviceId,
        rssi: sample.rssi,
        scanTimestamp: currentDate
      },
      periodInfo: {
        timetableId: timetable._id,
        periodNumber: period.periodNumber,
        dayOfWeek,
        scheduledStartTime: period.startTime,
        scheduledEndTime: period.endTime
      },
      remarks: 'Flagged due to intentional accelerometer motion pattern',
      markedAt: currentDate,
      requiresApproval: true,
      approvalStatus: 'pending'
    });

    result.analysis.autoMarkEligible = false;
    result.analysis.reason = 'motion_classified_as_artificial';
    result.analysis.flagged = true;
    result.analysis.proxyLogId = proxyLog._id;
    result.attendance = {
      attendanceId: flaggedAttendance._id,
      status: flaggedAttendance.status,
      flagged: true,
      proxyLogId: proxyLog._id,
      studentId: student._id,
      classId: classDoc._id,
      sessionId: session._id
    };

    return result;
  }

  const lateThresholdMinutes = classDoc.attendanceSettings?.lateThresholdMinutes || 15;
  const periodStart = parseTimeToDate(buildDateKey(currentDate), period.startTime);
  const minutesSinceStart = Math.max(0, Math.round((currentDate - periodStart) / 60000));
  const status = minutesSinceStart > lateThresholdMinutes ? 'late' : 'present';

  const attendance = await Attendance.create({
    studentId: student._id,
    sessionId: session._id,
    classId: classDoc._id,
    date: buildDateKey(currentDate),
    entryTime: currentDate,
    exitTime: null,
    status,
    verificationMethod: 'ble_auto',
    motionData: {
      hasMotion: true,
      confidence,
      accelerometerMagnitude: Math.sqrt(sample.ax ** 2 + sample.ay ** 2 + sample.az ** 2),
      verifiedAt: currentDate
    },
    bleData: {
      deviceId,
      rssi: sample.rssi,
      scanTimestamp: currentDate
    },
    periodInfo: {
      timetableId: timetable._id,
      periodNumber: period.periodNumber,
      dayOfWeek,
      scheduledStartTime: period.startTime,
      scheduledEndTime: period.endTime
    },
    remarks: 'Auto-marked via ESP32 accelerometer motion',
    markedAt: currentDate
  });

  result.analysis.autoMarkEligible = true;
  result.analysis.reason = 'attendance_marked';
  result.attendance = {
    attendanceId: attendance._id,
    status: attendance.status,
    studentId: student._id,
    classId: classDoc._id,
    sessionId: session._id
  };

  return result;
}

module.exports = {
  processMotionReading,
  normalizeDeviceId,
  extractMotionMagnitude,
  buildDateKey
};