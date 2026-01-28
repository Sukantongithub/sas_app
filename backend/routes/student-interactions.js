const express = require('express');
const router = express.Router();
const AbsenceReason = require('../models/AbsenceReason');
const Leave = require('../models/Leave');
const OnDuty = require('../models/OnDuty');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const { requireAuth, requireRoles, requireSelfOrRoles } = require('../middleware/auth');

// ============================================
// ABSENCE REASON REQUESTS
// ============================================

// @route   POST /api/student-interactions/absence-reason
// @desc    Submit absence reason for a specific date
// @access  Private (Student)
router.post('/absence-reason', requireAuth, async (req, res) => {
  try {
    const { date, reason, reasonType, attendanceId } = req.body;
    
    if (!date || !reason) {
      return res.status(400).json({ message: 'Date and reason are required' });
    }

    // Get student ID from user
    const studentId = req.user.studentId || req.user._id;
    
    // Check if attendance record exists
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    // Verify this is the student's own attendance
    if (attendance.studentId.toString() !== studentId.toString()) {
      return res.status(403).json({ message: 'You can only submit reasons for your own absences' });
    }

    // Check if reason already exists for this date
    const existingReason = await AbsenceReason.findOne({ 
      studentId, 
      date,
      attendanceId 
    });

    if (existingReason) {
      return res.status(400).json({ message: 'Absence reason already submitted for this date' });
    }

    const absenceReason = await AbsenceReason.create({
      studentId,
      userId: req.user._id,
      attendanceId,
      date,
      reason,
      reasonType: reasonType || 'other'
    });

    // Notify teachers/admins
    await Notification.create({
      userId: null, // Will be sent to teachers
      title: 'Absence Reason Submitted',
      message: `Student submitted absence reason for ${date}`,
      type: 'absence_reason',
      relatedId: absenceReason._id,
      relatedModel: 'AbsenceReason'
    });

    res.status(201).json({
      message: 'Absence reason submitted successfully',
      absenceReason
    });
  } catch (error) {
    console.error('Submit absence reason error:', error);
    res.status(500).json({ message: 'Error submitting absence reason', error: error.message });
  }
});

// @route   GET /api/student-interactions/absence-reasons/:studentId
// @desc    Get absence reasons for a student
// @access  Private (Self or Teacher/Admin)
router.get('/absence-reasons/:studentId', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'faculty', 'teacher'] }), async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    let query = { studentId: req.params.studentId };

    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const reasons = await AbsenceReason.find(query)
      .populate('attendanceId', 'status date')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(reasons);
  } catch (error) {
    console.error('Get absence reasons error:', error);
    res.status(500).json({ message: 'Error fetching absence reasons', error: error.message });
  }
});

// ============================================
// LEAVE APPLICATION
// ============================================

// @route   POST /api/student-interactions/leave
// @desc    Submit leave application
// @access  Private (Student)
router.post('/leave', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, leaveType, reason } = req.body;
    
    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ message: 'Start date, end date, and reason are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    const studentId = req.user.studentId || req.user._id;

    const leave = await Leave.create({
      studentId,
      requestedBy: req.user._id,
      startDate: start,
      endDate: end,
      leaveType: leaveType || 'casual',
      reason
    });

    await leave.populate('studentId', 'name rollNumber class section');

    // Notify teachers/admins
    await Notification.create({
      userId: null,
      title: 'New Leave Application',
      message: `Leave application from ${leave.studentId.name} for ${Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1} days`,
      type: 'leave_request',
      relatedId: leave._id,
      relatedModel: 'Leave'
    });

    res.status(201).json({
      message: 'Leave application submitted successfully',
      leave
    });
  } catch (error) {
    console.error('Submit leave error:', error);
    res.status(500).json({ message: 'Error submitting leave application', error: error.message });
  }
});

// @route   GET /api/student-interactions/leaves/:studentId
// @desc    Get leave applications for a student
// @access  Private (Self or Teacher/Admin)
router.get('/leaves/:studentId', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'faculty', 'teacher'] }), async (req, res) => {
  try {
    const { status } = req.query;
    let query = { studentId: req.params.studentId };

    if (status) query.status = status;

    const leaves = await Leave.find(query)
      .populate('studentId', 'name rollNumber class section')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ message: 'Error fetching leave applications', error: error.message });
  }
});

// ============================================
// EXAM ELIGIBILITY STATUS
// ============================================

// @route   GET /api/student-interactions/exam-eligibility/:studentId
// @desc    Check exam eligibility based on attendance percentage
// @access  Private (Self or Teacher/Admin)
router.get('/exam-eligibility/:studentId', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'faculty', 'teacher'] }), async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const { examType, startDate, endDate } = req.query;

    // Define minimum attendance requirements
    const eligibilityCriteria = {
      'mid_term': 75,
      'final': 75,
      'quiz': 60,
      'internal': 70,
      'default': 75
    };

    const requiredPercentage = eligibilityCriteria[examType] || eligibilityCriteria.default;

    // Calculate attendance for the period
    let query = { studentId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const records = await Attendance.find(query);
    const totalClasses = records.length;
    const presentCount = records.filter(r => r.status === 'present').length;
    const percentage = totalClasses > 0 ? (presentCount / totalClasses) * 100 : 0;

    const isEligible = percentage >= requiredPercentage;
    const shortfall = isEligible ? 0 : requiredPercentage - percentage;

    // Calculate classes needed to become eligible
    let classesNeeded = 0;
    if (!isEligible && totalClasses > 0) {
      // Formula: (presentCount + x) / (totalClasses + x) >= requiredPercentage/100
      // Solving for x: x >= (requiredPercentage * totalClasses - 100 * presentCount) / (100 - requiredPercentage)
      classesNeeded = Math.ceil((requiredPercentage * totalClasses - 100 * presentCount) / (100 - requiredPercentage));
      if (classesNeeded < 0) classesNeeded = 0;
    }

    res.json({
      studentId,
      examType: examType || 'default',
      requiredPercentage,
      currentPercentage: parseFloat(percentage.toFixed(2)),
      totalClasses,
      presentCount,
      absentCount: records.filter(r => r.status === 'absent').length,
      lateCount: records.filter(r => r.status === 'late').length,
      isEligible,
      shortfall: parseFloat(shortfall.toFixed(2)),
      classesNeeded,
      message: isEligible 
        ? 'You are eligible for the exam' 
        : `You need ${classesNeeded} more classes with 100% attendance to become eligible`
    });
  } catch (error) {
    console.error('Get exam eligibility error:', error);
    res.status(500).json({ message: 'Error checking exam eligibility', error: error.message });
  }
});

// ============================================
// LOW ATTENDANCE NOTIFICATIONS
// ============================================

// @route   GET /api/student-interactions/low-attendance-check/:studentId
// @desc    Check if student has low attendance and create notification
// @access  Private (Self or Teacher/Admin)
router.get('/low-attendance-check/:studentId', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'faculty', 'teacher'] }), async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const lowAttendanceThreshold = 75;

    const records = await Attendance.find({ studentId });
    const totalClasses = records.length;
    const presentCount = records.filter(r => r.status === 'present').length;
    const percentage = totalClasses > 0 ? (presentCount / totalClasses) * 100 : 0;

    const hasLowAttendance = percentage < lowAttendanceThreshold;

    if (hasLowAttendance) {
      // Check if notification already sent recently (within last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const existingNotification = await Notification.findOne({
        userId: req.user._id,
        type: 'low_attendance',
        createdAt: { $gte: sevenDaysAgo }
      });

      if (!existingNotification) {
        // Create notification
        await Notification.create({
          userId: req.user._id,
          title: 'Low Attendance Warning',
          message: `Your attendance is ${percentage.toFixed(1)}% which is below the required ${lowAttendanceThreshold}%. Please improve your attendance to maintain exam eligibility.`,
          type: 'low_attendance',
          priority: 'high',
          relatedId: studentId,
          relatedModel: 'Student'
        });
      }
    }

    res.json({
      studentId,
      totalClasses,
      presentCount,
      percentage: parseFloat(percentage.toFixed(2)),
      threshold: lowAttendanceThreshold,
      hasLowAttendance,
      message: hasLowAttendance 
        ? `Warning: Your attendance is ${percentage.toFixed(1)}%, which is below the required ${lowAttendanceThreshold}%`
        : `Your attendance is ${percentage.toFixed(1)}%, which meets the requirement`
    });
  } catch (error) {
    console.error('Low attendance check error:', error);
    res.status(500).json({ message: 'Error checking attendance', error: error.message });
  }
});

// @route   GET /api/student-interactions/notifications/:studentId
// @desc    Get notifications for student
// @access  Private (Self or Teacher/Admin)
router.get('/notifications/:studentId', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'faculty', 'teacher'] }), async (req, res) => {
  try {
    const { unreadOnly, type } = req.query;
    let query = { userId: req.user._id };

    if (unreadOnly === 'true') query.isRead = false;
    if (type) query.type = type;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });

    res.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
});

// @route   PUT /api/student-interactions/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Error updating notification', error: error.message });
  }
});

// ============================================
// ON-DUTY REQUESTS
// ============================================

// @route   POST /api/student-interactions/on-duty
// @desc    Submit on-duty request
// @access  Private (Student)
router.post('/on-duty', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, dutyType, reason, institution, expectedClassesMissed } = req.body;
    
    if (!startDate || !endDate || !dutyType || !reason) {
      return res.status(400).json({ message: 'Start date, end date, duty type, and reason are required' });
    }

    const studentId = req.user.studentId || req.user._id;

    const onDuty = new OnDuty({
      studentId,
      userId: req.user._id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      dutyType,
      reason,
      institution: institution || '',
      expectedClassesMissed: expectedClassesMissed || 0,
      status: 'pending',
    });

    await onDuty.save();

    res.status(201).json({ 
      message: 'On-duty request submitted successfully', 
      onDuty 
    });
  } catch (error) {
    console.error('Submit on-duty error:', error);
    res.status(500).json({ message: 'Error submitting on-duty request', error: error.message });
  }
});

// @route   GET /api/student-interactions/on-duty/:studentId
// @desc    Get on-duty requests for a student
// @access  Private (Student, Teacher, Admin)
router.get('/on-duty/:studentId', requireAuth, requireSelfOrRoles(['student', 'teacher', 'admin']), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status } = req.query;

    const filter = { studentId };
    if (status) {
      filter.status = status;
    }

    const onDutyRequests = await OnDuty.find(filter)
      .populate('studentId', 'rollNumber')
      .populate('userId', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ 
      count: onDutyRequests.length,
      onDutyRequests 
    });
  } catch (error) {
    console.error('Get on-duty requests error:', error);
    res.status(500).json({ message: 'Error fetching on-duty requests', error: error.message });
  }
});

// @route   PUT /api/student-interactions/on-duty/:id/approve
// @desc    Approve on-duty request (Teacher/Admin only)
// @access  Private (Teacher, Admin)
router.put('/on-duty/:id/approve', requireAuth, requireRoles(['teacher', 'admin', 'super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalRemarks } = req.body;

    const onDuty = await OnDuty.findByIdAndUpdate(
      id,
      {
        status: 'approved',
        approvedBy: req.user._id,
        approvalDate: new Date(),
        approvalRemarks: approvalRemarks || '',
      },
      { new: true }
    );

    if (!onDuty) {
      return res.status(404).json({ message: 'On-duty request not found' });
    }

    // Create notification for student
    await Notification.create({
      studentId: onDuty.studentId,
      userId: onDuty.userId,
      type: 'on_duty_approval',
      title: 'On-Duty Request Approved',
      message: `Your on-duty request from ${new Date(onDuty.startDate).toLocaleDateString()} has been approved`,
      isRead: false,
    });

    res.json({ message: 'On-duty request approved', onDuty });
  } catch (error) {
    console.error('Approve on-duty error:', error);
    res.status(500).json({ message: 'Error approving on-duty request', error: error.message });
  }
});

// @route   PUT /api/student-interactions/on-duty/:id/reject
// @desc    Reject on-duty request (Teacher/Admin only)
// @access  Private (Teacher, Admin)
router.put('/on-duty/:id/reject', requireAuth, requireRoles(['teacher', 'admin', 'super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalRemarks } = req.body;

    const onDuty = await OnDuty.findByIdAndUpdate(
      id,
      {
        status: 'rejected',
        approvedBy: req.user._id,
        approvalDate: new Date(),
        approvalRemarks: approvalRemarks || '',
      },
      { new: true }
    );

    if (!onDuty) {
      return res.status(404).json({ message: 'On-duty request not found' });
    }

    // Create notification for student
    await Notification.create({
      studentId: onDuty.studentId,
      userId: onDuty.userId,
      type: 'on_duty_rejection',
      title: 'On-Duty Request Rejected',
      message: `Your on-duty request from ${new Date(onDuty.startDate).toLocaleDateString()} has been rejected`,
      isRead: false,
    });

    res.json({ message: 'On-duty request rejected', onDuty });
  } catch (error) {
    console.error('Reject on-duty error:', error);
    res.status(500).json({ message: 'Error rejecting on-duty request', error: error.message });
  }
});

module.exports = router;
