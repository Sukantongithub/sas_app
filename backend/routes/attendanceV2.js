const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const Class = require('../models/Class');
const Device = require('../models/Device');
const ProxyLog = require('../models/ProxyLog');
const { requireAuth, requireRoles, requireSelfOrRoles } = require('../middleware/auth');
const { verifyAttendance } = require('../services/bleVerification');

// @route   POST /api/attendance-v2/mark-auto
// @desc    Mark attendance automatically using BLE verification
// @access  Private (Student/Faculty)
router.post('/mark-auto', requireAuth, async (req, res) => {
  try {
        // Safety check - should never happen if requireAuth works correctly
        if (!req.user || !req.user._id) {
          console.error('mark-auto: req.user is null or missing _id');
          return res.status(401).json({ message: 'Authentication required' });
        }

    const {
      sessionId,
      bleData, // { deviceId, rssi, txPower, scanTimestamp, batteryLevel }
      motionData, // { hasMotion, confidence, accelerometer: {x, y, z}, gyroscope: {x, y, z} }
      locationData, // { beaconId, gpsCoordinates: {latitude, longitude, accuracy} }
      detectedDevices // Array of all devices detected during scan
    } = req.body;
    
    if (!sessionId || !bleData) {
      return res.status(400).json({ 
        message: 'Session ID and BLE data are required' 
      });
    }
    
    // Verify attendance using BLE anti-proxy checks
    const verification = await verifyAttendance(
      req.user._id,
      sessionId,
      bleData,
      motionData,
      locationData,
      detectedDevices
    );
    
    if (verification.error) {
      return res.status(400).json({ 
        message: verification.error 
      });
    }
    
    // If verification failed with high risk, reject attendance
    if (verification.shouldReject) {
      return res.status(403).json({
        message: 'Attendance verification failed',
        verified: false,
        riskScore: verification.riskScore,
        errors: verification.errors,
        action: 'rejected',
        reason: verification.errors[0]?.message || 'Security verification failed'
      });
    }
    
    // Check if attendance already exists
    const existing = await Attendance.findOne({
      studentId: req.user._id,
      sessionId
    });
    
    if (existing) {
      // Update exit time if re-detected
      if (existing.entryTime && !existing.exitTime) {
        await existing.markExit();
        
        return res.json({
          message: 'Exit time recorded',
          attendance: existing,
          verified: true,
          action: 'exit_marked'
        });
      }
      
      return res.status(409).json({
        message: 'Attendance already marked for this session',
        attendance: existing
      });
    }
    
    // Get session details
    const session = await Session.findById(sessionId).populate('classId');
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    // Determine attendance status (present or late)
    const now = new Date();
    const sessionStart = new Date(session.startTime);
    const lateThreshold = session.classId.attendanceSettings?.lateThresholdMinutes || 15;
    const minutesLate = (now - sessionStart) / (1000 * 60);
    
    const status = minutesLate > lateThreshold ? 'late' : 'present';
    
    // Create attendance record
    const attendance = new Attendance({
      studentId: req.user._id,
      sessionId,
      classId: session.classId._id,
      date: session.date,
      entryTime: now,
      status,
      verificationMethod: 'ble_auto',
      bleData: {
        ...bleData,
        calculatedDistance: verification.proximityCheck.distance
      },
      motionData: motionData ? {
        hasMotion: motionData.hasMotion,
        confidence: motionData.confidence,
        accelerometerMagnitude: motionData.accelerometer 
          ? Math.sqrt(
              Math.pow(motionData.accelerometer.x, 2) +
              Math.pow(motionData.accelerometer.y, 2) +
              Math.pow(motionData.accelerometer.z, 2)
            )
          : 0,
        verifiedAt: now
      } : undefined,
      locationData: locationData ? {
        beaconId: locationData.beaconId,
        beaconVerified: verification.locationCheck.verified,
        gpsCoordinates: locationData.gpsCoordinates,
        geofenceVerified: true // TODO: Implement geofence check
      } : undefined,
      isProxyAttempt: !verification.verified,
      proxyReason: verification.errors.length > 0 ? verification.errors[0].type : null
    });
    
    await attendance.save();
    
    // Update session statistics
    await session.updateStatistics();
    
    // Update device last seen
    if (verification.device) {
      await verification.device.updateLastSeen();
      if (bleData.batteryLevel !== undefined) {
        await verification.device.updateBattery(bleData.batteryLevel);
      }
    }
    
    res.status(201).json({
      message: `Attendance marked as ${status}`,
      attendance,
      verified: verification.verified,
      riskScore: verification.riskScore,
      warnings: verification.errors.filter(e => e.severity === 'low' || e.severity === 'medium'),
      action: verification.verified ? 'accepted' : 'flagged'
    });
  } catch (error) {
    console.error('Auto attendance marking error:', error);
    res.status(500).json({ 
      message: 'Error marking attendance', 
      error: error.message 
    });
  }
});

// @route   POST /api/attendance-v2/mark-manual
// @desc    Manually mark attendance (faculty only)
// @access  Private (Faculty/Admin)
router.post('/mark-manual', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const {
      studentId,
      sessionId,
      status,
      reason
    } = req.body;
    
    if (!studentId || !sessionId || !status) {
      return res.status(400).json({ 
        message: 'Student ID, session ID, and status are required' 
      });
    }
    
    const session = await Session.findById(sessionId).populate('classId');
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    // Check if attendance already exists
    let attendance = await Attendance.findOne({
      studentId,
      sessionId
    });
    
    const requiresApproval = session.classId.attendanceSettings?.requireApprovalForManualChanges || false;
    
    if (attendance) {
      // Update existing attendance
      const previousStatus = attendance.status;
      
      attendance.addModification(
        req.user._id,
        previousStatus,
        status,
        reason || 'Manual correction by faculty'
      );
      
      attendance.status = status;
      attendance.verificationMethod = 'manual';
      attendance.markedBy = req.user._id;
      attendance.manualReason = reason;
      attendance.requiresApproval = requiresApproval;
      
      await attendance.save();
      
      res.json({
        message: 'Attendance updated successfully',
        attendance,
        previousStatus,
        requiresApproval
      });
    } else {
      // Create new manual attendance
      attendance = new Attendance({
        studentId,
        sessionId,
        classId: session.classId._id,
        date: session.date,
        entryTime: session.startTime,
        status,
        verificationMethod: 'manual',
        markedBy: req.user._id,
        manualReason: reason,
        requiresApproval
      });
      
      await attendance.save();
      
      res.status(201).json({
        message: 'Attendance marked manually',
        attendance,
        requiresApproval
      });
    }
    
    // Update session statistics
    await session.updateStatistics();
  } catch (error) {
    console.error('Manual attendance marking error:', error);
    res.status(500).json({ 
      message: 'Error marking attendance', 
      error: error.message 
    });
  }
});

// @route   PUT /api/attendance-v2/:id/approve
// @desc    Approve manual attendance change (admin only)
// @access  Private (Admin)
router.put('/:id/approve', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
    if (!attendance.requiresApproval) {
      return res.status(400).json({ message: 'This record does not require approval' });
    }
    
    attendance.requiresApproval = false;
    attendance.approvedBy = req.user._id;
    attendance.approvedAt = new Date();
    
    await attendance.save();
    
    res.json({
      message: 'Attendance approved successfully',
      attendance
    });
  } catch (error) {
    console.error('Approve attendance error:', error);
    res.status(500).json({ 
      message: 'Error approving attendance', 
      error: error.message 
    });
  }
});

// @route   GET /api/attendance-v2/my-attendance
// @desc    Get current user's attendance records
// @access  Private (Student)
router.get('/my-attendance', requireAuth, async (req, res) => {
  try {
    const { classId, startDate, endDate } = req.query;
    
    const query = { studentId: req.user._id };
    
    if (classId) query.classId = classId;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const records = await Attendance.find(query)
      .populate('sessionId', 'subject date startTime endTime')
      .populate('classId', 'name code')
      .sort({ date: -1, entryTime: -1 });
    
    // Get statistics
    const stats = await Attendance.getStudentStats(
      req.user._id,
      classId || null,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );
    
    res.json({
      records,
      stats
    });
  } catch (error) {
    console.error('Get my attendance error:', error);
    res.status(500).json({ 
      message: 'Error fetching attendance', 
      error: error.message 
    });
  }
});

// @route   GET /api/attendance-v2/session/:sessionId
// @desc    Get attendance for a specific session
// @access  Private (Faculty/Admin)
router.get('/session/:sessionId', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findById(sessionId)
      .populate('classId')
      .populate('facultyId', 'name email');
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (!session.classId) {
      return res.status(400).json({ message: 'Session has no class assigned' });
    }
    
    const attendance = await Attendance.find({ sessionId })
      .populate('studentId', 'name email rollNumber')
      .populate('markedBy', 'name email')
      .sort({ entryTime: -1 });
    
    // Get all students in class to show absent ones
    const classDoc = await Class.findById(session.classId._id)
      .populate('students', 'name email rollNumber');
    
    const presentStudentIds = attendance.map(a => a.studentId._id.toString());
    const absentStudents = classDoc.students.filter(
      s => !presentStudentIds.includes(s._id.toString())
    );
    
    res.json({
      session,
      attendance,
      absentStudents,
      statistics: session.statistics
    });
  } catch (error) {
    console.error('Get session attendance error:', error);
    res.status(500).json({ 
      message: 'Error fetching session attendance', 
      error: error.message 
    });
  }
});

// @route   GET /api/attendance-v2/class/:classId/stats
// @desc    Get attendance statistics for a class
// @access  Private (Faculty/Admin)
router.get('/class/:classId/stats', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const { classId } = req.params;
    const { startDate, endDate } = req.query;
    
    const classDoc = await Class.findById(classId).populate('students', 'name email rollNumber');
    
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Get stats for each student
    const studentStats = await Promise.all(
      classDoc.students.map(async student => {
        const stats = await Attendance.getStudentStats(
          student._id,
          classId,
          startDate ? new Date(startDate) : null,
          endDate ? new Date(endDate) : null
        );
        
        return {
          student: {
            id: student._id,
            name: student.name,
            email: student.email,
            rollNumber: student.rollNumber
          },
          ...stats
        };
      })
    );
    
    // Overall class statistics
    const totalStudents = studentStats.length;
    const avgAttendance = studentStats.reduce((sum, s) => sum + s.attendancePercentage, 0) / (totalStudents || 1);
    
    res.json({
      class: {
        id: classDoc._id,
        name: classDoc.name,
        code: classDoc.code,
        department: classDoc.department
      },
      statistics: {
        totalStudents,
        averageAttendance: Math.round(avgAttendance * 100) / 100,
        studentStats: studentStats.sort((a, b) => b.attendancePercentage - a.attendancePercentage)
      }
    });
  } catch (error) {
    console.error('Get class stats error:', error);
    res.status(500).json({ 
      message: 'Error fetching class statistics', 
      error: error.message 
    });
  }
});

// @route   GET /api/attendance-v2/defaulters
// @desc    Get list of defaulters (attendance < threshold%)
// @access  Private (Faculty/Admin)
router.get('/defaulters', requireAuth, requireRoles('super_admin', 'admin', 'faculty'), async (req, res) => {
  try {
    const { 
      classId, 
      threshold = 75,
      startDate,
      endDate
    } = req.query;
    
    if (!classId) {
      return res.status(400).json({ message: 'Class ID is required' });
    }
    
    const defaulters = await Attendance.getDefaulters(
      classId,
      parseInt(threshold),
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );
    
    // Populate student details
    const User = require('../models/User');
    const defaultersWithDetails = await Promise.all(
      defaulters.map(async d => {
        const student = await User.findById(d.studentId).select('name email rollNumber');
        return {
          ...d,
          student
        };
      })
    );
    
    res.json({
      defaulters: defaultersWithDetails,
      count: defaultersWithDetails.length,
      threshold: `${threshold}%`
    });
  } catch (error) {
    console.error('Get defaulters error:', error);
    res.status(500).json({ 
      message: 'Error fetching defaulters', 
      error: error.message 
    });
  }
});

// @route   GET /api/attendance-v2/export
// @desc    Export attendance data to CSV
// @access  Private (Faculty/Admin)
router.get('/export', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const { classId, startDate, endDate, format = 'csv' } = req.query;
    
    if (!classId) {
      return res.status(400).json({ message: 'Class ID is required' });
    }
    
    const query = { classId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const records = await Attendance.find(query)
      .populate('studentId', 'name email rollNumber')
      .populate('sessionId', 'subject date')
      .sort({ date: 1, studentId: 1 });
    
    if (format === 'csv') {
      // Generate CSV
      const csv = [
        'Date,Student Name,Roll Number,Email,Subject,Status,Entry Time,Exit Time,Duration (min),Verification Method,RSSI,Motion Confidence',
        ...records.map(r => [
          r.date.toISOString().split('T')[0],
          r.studentId.name,
          r.studentId.rollNumber || '',
          r.studentId.email,
          r.sessionId?.subject || '',
          r.status,
          r.entryTime.toISOString(),
          r.exitTime ? r.exitTime.toISOString() : '',
          r.duration || '',
          r.verificationMethod,
          r.bleData?.rssi || '',
          r.motionData?.confidence || ''
        ].join(','))
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=attendance_${classId}_${Date.now()}.csv`);
      res.send(csv);
    } else {
      // Return JSON
      res.json({
        records,
        count: records.length
      });
    }
  } catch (error) {
    console.error('Export attendance error:', error);
    res.status(500).json({ 
      message: 'Error exporting attendance', 
      error: error.message 
    });
  }
});

module.exports = router;
