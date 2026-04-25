const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Device = require('../models/Device');
const Class = require('../models/Class');
const Session = require('../models/Session');
const Timetable = require('../models/Timetable');
const ProxyLog = require('../models/ProxyLog');
const MotionPatternAnalyzer = require('../utils/motionPatternAnalyzer');
const { sendAbsentAlert } = require('./notificationService');

const DEVICE_BUFFER_SIZE = parseInt(process.env.MOTION_BUFFER_SIZE || '10', 10);
const ANALYSIS_WINDOW_SIZE = parseInt(process.env.MOTION_ANALYSIS_WINDOW_SIZE || '6', 10);
const MIN_SAMPLES_FOR_ANALYSIS = parseInt(process.env.MOTION_MIN_SAMPLES_FOR_ANALYSIS || '4', 10);
const MIN_MOTION_MAGNITUDE_FOR_ATTENDANCE = parseFloat(process.env.MOTION_MIN_MAGNITUDE || '1');
const AUTO_ATTENDANCE_WINDOW_MINUTES = parseInt(process.env.AUTO_ATTENDANCE_WINDOW_MINUTES || '15', 10);
const MAJORITY_WINDOW_MINUTES = parseInt(process.env.MOTION_MAJORITY_WINDOW_MINUTES || '10', 10);
const MAX_TRACKED_MINUTES = parseInt(process.env.MOTION_MAX_TRACKED_MINUTES || '30', 10);

const deviceBuffers = new Map();
const minuteClassificationWindows = new Map();
const mongoose = require('mongoose');

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

function buildDateOnlyDate(date = new Date()) {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
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

function normalizeScore(value, fallback = 0.5) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, parsed));
}

function scoreToConfidence(score) {
  const distance = Math.abs(score - 0.5);
  return 0.5 + (distance * 0.5);
}

function buildBlendedAnalysis(shortAnalysis, fullAnalysis, shortWeight = 0.7) {
  const shortScore = normalizeScore(shortAnalysis?.features?.final_score);
  const fullScore = normalizeScore(fullAnalysis?.features?.final_score);
  let blendedScore = normalizeScore((shortScore * shortWeight) + (fullScore * (1 - shortWeight)));

  const recentRangePct = Number(shortAnalysis?.features?.range_percent_of_mean || 0);
  const recentMaxDiffPct = Number(shortAnalysis?.features?.max_diff_percent_of_mean || 0);
  const recentAvgDiffPct = Number(shortAnalysis?.features?.avg_diff_percent_of_mean || 0);
  const recentLooksCalm =
    shortAnalysis?.label === 'Genuine' &&
    recentRangePct < 12 &&
    recentMaxDiffPct < 9 &&
    recentAvgDiffPct < 6;

  // Faster recovery: if recent window is calm, reduce stale influence from older spikes.
  if (recentLooksCalm && fullScore >= 0.6) {
    blendedScore = Math.min(blendedScore, 0.46);
  }

  const blendedConfidence = Math.round(scoreToConfidence(blendedScore) * 100) / 100;
  const isArtificial = blendedScore >= 0.6;

  return {
    ...(shortAnalysis || {}),
    prediction: isArtificial ? 1 : 0,
    label: isArtificial ? 'Artificial' : 'Genuine',
    confidence: blendedConfidence,
    genuine_probability: isArtificial ? 1 - blendedConfidence : blendedConfidence,
    artificial_probability: isArtificial ? blendedConfidence : 1 - blendedConfidence,
    features: {
      ...(shortAnalysis?.features || {}),
      short_window_final_score: Math.round(shortScore * 100) / 100,
      full_window_final_score: Math.round(fullScore * 100) / 100,
      blended_final_score: Math.round(blendedScore * 100) / 100,
      recent_calm_recovery_applied: recentLooksCalm && fullScore >= 0.6,
      blend_short_weight: shortWeight,
      blend_full_weight: Math.round((1 - shortWeight) * 100) / 100
    },
    source: 'threshold_blended_windows'
  };
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

function buildAggregationKey(deviceId, sessionId) {
  return `${deviceId}:${String(sessionId)}`;
}

function parseTimeToMinutes(timeText) {
  const [hours, minutes] = String(timeText || '00:00').split(':').map((part) => parseInt(part, 10) || 0);
  return (hours * 60) + minutes;
}

function getMinuteKey(date = new Date()) {
  const value = new Date(date);
  value.setSeconds(0, 0);
  return value.toISOString();
}

function getOrCreateMinuteWindow(aggregationKey) {
  let window = minuteClassificationWindows.get(aggregationKey);
  if (!window) {
    window = {
      minuteMap: new Map(),
      updatedAt: new Date().toISOString()
    };
    minuteClassificationWindows.set(aggregationKey, window);
  }
  return window;
}

function addMinuteLabel(aggregationKey, timestamp, label, confidence) {
  const window = getOrCreateMinuteWindow(aggregationKey);
  const minuteKey = getMinuteKey(timestamp);
  const minuteEntry = window.minuteMap.get(minuteKey) || {
    genuineCount: 0,
    artificialCount: 0,
    samples: 0,
    confidenceTotal: 0,
    lastLabel: null
  };

  minuteEntry.samples += 1;
  minuteEntry.confidenceTotal += Number(confidence) || 0;
  if (label === 'Genuine') minuteEntry.genuineCount += 1;
  if (label === 'Artificial') minuteEntry.artificialCount += 1;
  minuteEntry.lastLabel = label;

  window.minuteMap.set(minuteKey, minuteEntry);
  window.updatedAt = new Date().toISOString();

  const sortedMinuteKeys = Array.from(window.minuteMap.keys()).sort();
  if (sortedMinuteKeys.length > MAX_TRACKED_MINUTES) {
    const toRemove = sortedMinuteKeys.slice(0, sortedMinuteKeys.length - MAX_TRACKED_MINUTES);
    for (const oldKey of toRemove) {
      window.minuteMap.delete(oldKey);
    }
  }

  minuteClassificationWindows.set(aggregationKey, window);
}

function summarizeMinuteWindow(aggregationKey, requiredMinutes = MAJORITY_WINDOW_MINUTES) {
  const window = minuteClassificationWindows.get(aggregationKey);
  if (!window || window.minuteMap.size === 0) {
    return {
      availableMinutes: 0,
      requiredMinutes,
      genuineMinutes: 0,
      artificialMinutes: 0,
      tieMinutes: 0,
      majorityLabel: null,
      minuteLabels: []
    };
  }

  const sortedMinuteKeys = Array.from(window.minuteMap.keys()).sort();
  const selectedMinuteKeys = sortedMinuteKeys.slice(-requiredMinutes);
  const minuteLabels = selectedMinuteKeys.map((minute) => {
    const entry = window.minuteMap.get(minute);
    let label = 'Tie';
    if (entry.genuineCount > entry.artificialCount) label = 'Genuine';
    else if (entry.artificialCount > entry.genuineCount) label = 'Artificial';

    return {
      minute,
      label,
      samples: entry.samples,
      genuineCount: entry.genuineCount,
      artificialCount: entry.artificialCount,
      avgConfidence: entry.samples > 0
        ? Math.round((entry.confidenceTotal / entry.samples) * 100) / 100
        : 0
    };
  });

  const genuineMinutes = minuteLabels.filter((row) => row.label === 'Genuine').length;
  const artificialMinutes = minuteLabels.filter((row) => row.label === 'Artificial').length;
  const tieMinutes = minuteLabels.filter((row) => row.label === 'Tie').length;

  let majorityLabel = null;
  if (genuineMinutes > artificialMinutes) majorityLabel = 'Genuine';
  else if (artificialMinutes > genuineMinutes) majorityLabel = 'Artificial';

  return {
    availableMinutes: minuteLabels.length,
    requiredMinutes,
    genuineMinutes,
    artificialMinutes,
    tieMinutes,
    majorityLabel,
    minuteLabels
  };
}

async function closeAttendanceIfPeriodEnded(attendance, session, currentDate) {
  if (!attendance || attendance.exitTime) {
    return false;
  }

  if (currentDate >= session.endTime) {
    await attendance.markExit(currentDate);
    return true;
  }

  return false;
}

async function ensureSessionForPeriod({ classDoc, period, currentDate }) {
  const dateKey = buildDateKey(currentDate);
  const dateValue = buildDateOnlyDate(currentDate);
  const startTime = parseTimeToDate(dateKey, period.startTime);
  const endTime = parseTimeToDate(dateKey, period.endTime);
  const facultyId = period.teacherId || classDoc.faculty?.[0] || classDoc.coordinator;

  if (!facultyId) {
    return null;
  }

  let session = await Session.findOne({
    classId: classDoc._id,
    date: dateValue,
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
      date: dateValue,
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

async function finalizeSessionAbsences({ classDoc, timetable, period, currentDate }) {
  const session = await ensureSessionForPeriod({ classDoc, period, currentDate });
  if (!session || session.notificationsSent?.sessionEnded) {
    return { session: session || null, absentCreated: 0, skipped: !session ? 'missing_faculty' : 'already_finalized' };
  }

  const students = await Student.find({ classId: classDoc._id }).select('_id');
  if (!students.length) {
    session.isActive = false;
    session.actualEndTime = currentDate;
    session.notificationsSent.sessionEnded = true;
    await session.updateStatistics();
    await session.save();
    return { session, absentCreated: 0 };
  }

  const existingAttendance = await Attendance.find({ sessionId: session._id }).select('studentId');
  const markedStudentIds = new Set(existingAttendance.map((record) => String(record.studentId)));
  const absentStudents = students.filter((student) => !markedStudentIds.has(String(student._id)));

  let absentCreated = 0;
  for (const student of absentStudents) {
    const absentAttendance = await Attendance.create({
      studentId: student._id,
      sessionId: session._id,
      classId: classDoc._id,
      date: buildDateKey(currentDate),
      entryTime: currentDate,
      exitTime: null,
      status: 'absent',
      verificationMethod: 'ble_auto',
      isProxyAttempt: false,
      motionData: {
        hasMotion: false,
        confidence: 0,
        verifiedAt: currentDate
      },
      bleData: {
        scanTimestamp: currentDate
      },
      periodInfo: {
        timetableId: timetable._id,
        periodNumber: period.periodNumber,
        dayOfWeek: timetable.dayOfWeek,
        scheduledStartTime: period.startTime,
        scheduledEndTime: period.endTime
      },
      remarks: 'Auto-marked absent after period end due to no valid attendance',
      markedAt: currentDate
    });
    absentCreated += 1;
    await sendAbsentAlert(absentAttendance);
  }

  session.isActive = false;
  session.actualEndTime = currentDate;
  session.notificationsSent.sessionEnded = true;
  await session.updateStatistics();
  await session.save();

  return { session, absentCreated };
}

async function finalizeExpiredAttendanceSessions(currentDate = new Date()) {
  if (mongoose.connection.readyState !== 1) {
    return { scanned: 0, finalized: 0, absentCreated: 0, skipped: 'db_not_ready' };
  }

  const dayOfWeek = getDayOfWeek(currentDate);
  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
  const graceMinutes = parseInt(process.env.MOTION_ABSENT_FINALIZATION_DELAY_MINUTES || '0', 10);
  const cutoffMinutes = currentMinutes - graceMinutes;

  const timetables = await Timetable.find({
    dayOfWeek,
    isActive: true,
    effectiveFrom: { $lte: currentDate },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: currentDate } }]
  });

  let finalized = 0;
  let absentCreated = 0;

  for (const timetable of timetables) {
    const classDoc = await Class.findById(timetable.classId).select('students faculty coordinator attendanceSettings beaconId');
    if (!classDoc || !classDoc.attendanceSettings?.autoMarkingEnabled) {
      continue;
    }

    for (const period of timetable.periods || []) {
      if (parseTimeToMinutes(period.endTime) > cutoffMinutes) {
        continue;
      }

      const result = await finalizeSessionAbsences({ classDoc, timetable, period, currentDate });
      if (result.session) {
        finalized += 1;
        absentCreated += result.absentCreated || 0;
      }
    }
  }

  return { scanned: timetables.length, finalized, absentCreated };
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
  const rawDeviceId = payload?.deviceId || payload?.id;
  const deviceId = normalizeDeviceId(rawDeviceId);

  if (!deviceId) {
    console.warn('Motion reading rejected: missing or invalid deviceId', {
      receivedDeviceId: rawDeviceId,
      timestamp: currentDate.toISOString()
    });

    return {
      deviceId: null,
      buffered: false,
      bufferSize: 0,
      analysis: null,
      attendance: null,
      error: {
        code: 'invalid_device_id',
        message: 'Missing or invalid deviceId in motion payload'
      }
    };
  }

  const motionMagnitude = extractMotionMagnitude(payload);

  const sample = {
    timestamp: currentDate.toISOString(),
    motionMagnitude,
    ax: toNumber(payload.ax),
    ay: toNumber(payload.ay),
    az: toNumber(payload.az),
    rssi: toNumber(payload.r, -50)
  };

  if (sample.motionMagnitude < MIN_MOTION_MAGNITUDE_FOR_ATTENDANCE) {
    return {
      deviceId,
      buffered: false,
      bufferSize: 0,
      analysis: {
        autoMarkEligible: false,
        reason: 'below_motion_threshold',
        motionMagnitude: sample.motionMagnitude,
        minRequiredMotionMagnitude: MIN_MOTION_MAGNITUDE_FOR_ATTENDANCE
      },
      attendance: null
    };
  }

  const buffer = appendMotionSample(deviceId, sample.motionMagnitude);
  if (buffer.length < MIN_SAMPLES_FOR_ANALYSIS) {
    return {
      deviceId,
      buffered: true,
      bufferSize: buffer.length,
      analysis: null,
      attendance: null
    };
  }

  const fullSequence = buffer.slice(-DEVICE_BUFFER_SIZE);
  const shortWindowSize = Math.min(Math.max(ANALYSIS_WINDOW_SIZE, MIN_SAMPLES_FOR_ANALYSIS), fullSequence.length);
  const motionSequence = fullSequence.slice(-shortWindowSize);

  const shortAnalysis = await MotionPatternAnalyzer.analyzePattern(motionSequence);
  const fullAnalysis = shortWindowSize === fullSequence.length
    ? shortAnalysis
    : await MotionPatternAnalyzer.analyzePattern(fullSequence);
  const analysis = buildBlendedAnalysis(shortAnalysis, fullAnalysis, 0.7);

  const confidence = normalizeConfidence(analysis.confidence);
  const isGenuineMotion = analysis.label === 'Genuine';
  const isArtificialMotion = analysis.label === 'Artificial';

  const result = {
    deviceId,
    buffered: false,
    bufferSize: buffer.length,
    analysis: {
      ...analysis,
      confidence,
      timestamp: currentDate.toISOString(),
      motionSequence,
      analysisWindowSize: shortWindowSize,
      fullBufferSize: fullSequence.length
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

  const aggregationKey = buildAggregationKey(deviceId, session._id);

  if (isGenuineMotion || isArtificialMotion) {
    addMinuteLabel(aggregationKey, currentDate, analysis.label, confidence);
  }

  const minuteSummary = summarizeMinuteWindow(aggregationKey, MAJORITY_WINDOW_MINUTES);
  const sessionEnded = currentDate >= session.endTime;
  const hasRequiredMinuteWindow = minuteSummary.availableMinutes >= MAJORITY_WINDOW_MINUTES;
  const latestMinuteLabel = minuteSummary.minuteLabels[minuteSummary.minuteLabels.length - 1] || null;
  const shouldMarkProxyImmediately = Boolean(
    latestMinuteLabel &&
    latestMinuteLabel.label === 'Artificial' &&
    latestMinuteLabel.samples >= MIN_SAMPLES_FOR_ANALYSIS &&
    latestMinuteLabel.avgConfidence >= 0.55
  );

  result.analysis.minuteWindow = minuteSummary;
  result.analysis.sessionEnded = sessionEnded;
  result.analysis.majorityWindowMinutes = MAJORITY_WINDOW_MINUTES;
  result.analysis.immediateProxyCandidate = shouldMarkProxyImmediately;

  const existingAttendance = await Attendance.findOne({
    studentId: student._id,
    sessionId: session._id
  });

  if (existingAttendance) {
    const closedNow = await closeAttendanceIfPeriodEnded(existingAttendance, session, currentDate);

    result.analysis.autoMarkEligible = true;
    result.analysis.reason = closedNow ? 'attendance_closed_end_of_period' : 'already_marked';
    result.attendance = {
      status: existingAttendance.status,
      attendanceId: existingAttendance._id,
      entryTime: existingAttendance.entryTime,
      exitTime: closedNow ? currentDate : existingAttendance.exitTime
    };
    return result;
  }

  // If no attendance exists and the period has ended, do not create a late/present/proxy mark from late-arriving data.
  // The absent finalizer will create absent records for no-show students.
  if (sessionEnded) {
    result.analysis.autoMarkEligible = false;
    result.analysis.reason = 'session_ended_no_live_mark';
    return result;
  }

  if (shouldMarkProxyImmediately) {
    const proxyLog = await ProxyLog.create({
      studentId: student._id,
      sessionId: session._id,
      classId: classDoc._id,
      detectionType: 'pattern_anomaly',
      severity: latestMinuteLabel.avgConfidence >= 0.75 ? 'high' : 'medium',
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
        sensorSource: 'accelerometer',
        latestMinuteLabel
      },
      actionTaken: 'manual_review_required',
      status: 'pending'
    });

    const flaggedAttendance = await Attendance.create({
      studentId: student._id,
      sessionId: session._id,
      classId: classDoc._id,
      date: buildDateOnlyDate(currentDate),
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

    await closeAttendanceIfPeriodEnded(flaggedAttendance, session, currentDate);

    result.analysis.autoMarkEligible = false;
    result.analysis.reason = 'instant_artificial_proxy';
    result.analysis.flagged = true;
    result.analysis.proxyLogId = proxyLog._id;
    result.attendance = {
      attendanceId: flaggedAttendance._id,
      status: flaggedAttendance.status,
      flagged: true,
      proxyLogId: proxyLog._id,
      studentId: student._id,
      classId: classDoc._id,
      sessionId: session._id,
      entryTime: flaggedAttendance.entryTime,
      exitTime: flaggedAttendance.exitTime
    };

    return result;
  }

  if (!isGenuineMotion && !isArtificialMotion) {
    result.analysis.autoMarkEligible = false;
    result.analysis.reason = 'classification_uncertain';
    return result;
  }

  if (!hasRequiredMinuteWindow && !sessionEnded) {
    result.analysis.autoMarkEligible = false;
    result.analysis.reason = 'collecting_minute_window';
    return result;
  }

  if (!minuteSummary.majorityLabel) {
    result.analysis.autoMarkEligible = false;
    result.analysis.reason = 'majority_tie_manual_review';
    return result;
  }

  if (minuteSummary.majorityLabel === 'Artificial') {
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
      date: buildDateOnlyDate(currentDate),
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

    await closeAttendanceIfPeriodEnded(flaggedAttendance, session, currentDate);

    result.analysis.autoMarkEligible = false;
    result.analysis.reason = 'majority_artificial_window';
    result.analysis.flagged = true;
    result.analysis.proxyLogId = proxyLog._id;
    result.attendance = {
      attendanceId: flaggedAttendance._id,
      status: flaggedAttendance.status,
      flagged: true,
      proxyLogId: proxyLog._id,
      studentId: student._id,
      classId: classDoc._id,
      sessionId: session._id,
      entryTime: flaggedAttendance.entryTime,
      exitTime: flaggedAttendance.exitTime
    };

    return result;
  }

  // Final boundary check: if marking occurs after session end, reject instead of marking late
  if (currentDate > session.endTime) {
    result.analysis.autoMarkEligible = false;
    result.analysis.reason = 'session_ended_no_live_mark';
    return result;
  }

  const lateThresholdMinutes = parseInt(process.env.MOTION_LATE_GRACE_MINUTES || '3', 10);
  const periodStart = parseTimeToDate(buildDateKey(currentDate), period.startTime);
  const minutesSinceStart = Math.max(0, Math.round((currentDate - periodStart) / 60000));
  const status = minutesSinceStart > lateThresholdMinutes ? 'late' : 'present';

  const attendance = await Attendance.create({
    studentId: student._id,
    sessionId: session._id,
    classId: classDoc._id,
    date: buildDateOnlyDate(currentDate),
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

  await closeAttendanceIfPeriodEnded(attendance, session, currentDate);

  result.analysis.autoMarkEligible = true;
  result.analysis.reason = 'majority_genuine_window';
  result.attendance = {
    attendanceId: attendance._id,
    status: attendance.status,
    studentId: student._id,
    classId: classDoc._id,
    sessionId: session._id,
    entryTime: attendance.entryTime,
    exitTime: attendance.exitTime
  };

  return result;
}

module.exports = {
  processMotionReading,
  normalizeDeviceId,
  extractMotionMagnitude,
  buildDateKey,
  finalizeExpiredAttendanceSessions
};