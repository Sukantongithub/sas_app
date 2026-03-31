const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const AbsenceReason = require('../models/AbsenceReason');
const Leave = require('../models/Leave');
const OnDuty = require('../models/OnDuty');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Parent = require('../models/Parent');
const Class = require('../models/Class');
const { requireAuth, requireRoles, requireSelfOrRoles } = require('../middleware/auth');
const { asyncHandler, handleError, ROLE_GROUPS } = require('../utils/routeHelpers');

// Constants
const ABSENCE_REASON_DEADLINE_HOURS = process.env.ABSENCE_REASON_DEADLINE_HOURS || 24;
const EXAM_ELIGIBILITY_THRESHOLD = parseFloat(process.env.EXAM_ELIGIBILITY_THRESHOLD || 75);
const LEAVE_BALANCE = {
  'casual': 10,
  'sick': 5,
  'emergency': 3,
  'vacation': 15
};

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

    // Extract plain ObjectId from studentId (may be a populated Student document)
    const studentId = req.user.studentId
      ? (req.user.studentId._id || req.user.studentId)
      : req.user._id;
    
    // Check if attendance record exists
    const attendance = await Attendance.findById(attendanceId)
      .populate('sessionId', 'classId');
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    // Verify this is the student's own attendance
    if (attendance.studentId.toString() !== studentId.toString()) {
      return res.status(403).json({ message: 'You can only submit reasons for your own absences' });
    }

    // ✓ FIX 1: Check submission deadline (within 24 hours)
    const attendanceDate = new Date(attendance.date || date);
    const hoursSinceMissing = (Date.now() - attendanceDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceMissing > ABSENCE_REASON_DEADLINE_HOURS) {
      return res.status(400).json({ 
        message: `Cannot submit reason after ${ABSENCE_REASON_DEADLINE_HOURS} hours of absence` 
      });
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
      reasonType: reasonType || 'other',
      status: 'pending'
    });

    // ✓ FIX 2: Find and notify specific class teachers
    const student = await Student.findById(studentId).select('name class');
    const classDoc = await Class.findOne({ name: student.class || attendance.sessionId?.classId })
      .select('_id');
    
    if (!classDoc) {
      console.warn(`[Absence] Could not find class for student ${studentId}`);
    } else {
      // Get all teachers assigned to this class
      const teachers = await Staff.find({ 
        assignedClassIds: classDoc._id,
        designation: { $in: ['teacher', 'hod'] }
      }).populate('userId', '_id email');

      // Notify each teacher
      for (const teacher of teachers) {
        await Notification.create({
          userId: teacher.userId._id,  // ✓ FIX: Target actual user
          title: 'Absence Reason Submitted',
          message: `${student.name} submitted reason for absence on ${date}`,
          type: 'absence_reason_review',
          priority: 'high',
          relatedId: absenceReason._id,
          relatedModel: 'AbsenceReason',
          requiresAction: true,
          actionDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days to review
        });
      }
    }

    res.status(201).json({
      message: 'Absence reason submitted successfully',
      absenceReason,
      submissionDeadline: new Date(attendanceDate.getTime() + ABSENCE_REASON_DEADLINE_HOURS * 60 * 60 * 1000)
    });
  } catch (error) {
    console.error('Absence reason submission error:', error);
    res.status(500).json({ message: 'Error submitting absence reason', error: error.message });
  }
});

// ✓ NEW ENDPOINT: Approve absence reason (for teachers)
// @route   PUT /api/student-interactions/absence-reason/:id/approve
// @desc    Approve absence reason (Teacher/Admin only)
// @access  Private (Teacher, Admin)
router.put('/absence-reason/:id/approve', requireAuth, requireRoles('staff', 'admin', 'hod', 'super_admin'), async (req, res) => {
  try {
    const { approvalRemarks } = req.body;
    const absenceReason = await AbsenceReason.findByIdAndUpdate(
      req.params.id,
      {
        status: 'acknowledged',
        reviewedBy: req.user._id,
        reviewRemarks: approvalRemarks || '',
        reviewedAt: new Date()
      },
      { new: true }
    ).populate('studentId', 'name').populate('userId', 'email');

    if (!absenceReason) {
      return res.status(404).json({ message: 'Absence reason not found' });
    }

    // Notify student and parent
    await Notification.create({
      userId: absenceReason.userId._id,
      title: 'Absence Reason Approved',
      message: `Your absence reason for ${absenceReason.date} has been approved by your teacher`,
      type: 'absence_reason_approved',
      relatedId: absenceReason._id
    });

    // Notify parent
    const student = await Student.findById(absenceReason.studentId);
    if (student && student.parentIds && student.parentIds.length > 0) {
      const parent = await Parent.findById(student.parentIds[0]);
      if (parent) {
        await Notification.create({
          userId: parent.userId,
          title: 'Child\'s Absence Reason Approved',
          message: `${student.name}'s absence reason for ${absenceReason.date} has been approved`,
          type: 'absence_reason_approved_parent',
          relatedId: absenceReason._id
        });
      }
    }

    res.json({ 
      message: 'Absence reason approved',
      absenceReason 
    });
  } catch (error) {
    console.error('Absence reason approval error:', error);
    res.status(500).json({ message: 'Error approving absence reason', error: error.message });
  }
});

// ✓ NEW ENDPOINT: Reject absence reason (for teachers)
// @route   PUT /api/student-interactions/absence-reason/:id/reject
// @desc    Reject absence reason (Teacher/Admin only)
// @access  Private (Teacher, Admin)
router.put('/absence-reason/:id/reject', requireAuth, requireRoles('staff', 'admin', 'hod', 'super_admin'), async (req, res) => {
  try {
    const { approvalRemarks } = req.body;
    const absenceReason = await AbsenceReason.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        reviewedBy: req.user._id,
        reviewRemarks: approvalRemarks || 'Reason not accepted',
        reviewedAt: new Date()
      },
      { new: true }
    ).populate('studentId', 'name').populate('userId', 'email');

    if (!absenceReason) {
      return res.status(404).json({ message: 'Absence reason not found' });
    }

    // Notify student
    await Notification.create({
      userId: absenceReason.userId._id,
      title: 'Absence Reason Rejected',
      message: `Your absence reason for ${absenceReason.date} has been rejected. Reason: ${approvalRemarks || 'Not specified'}`,
      type: 'absence_reason_rejected',
      priority: 'high',
      relatedId: absenceReason._id
    });

    res.json({ 
      message: 'Absence reason rejected',
      absenceReason 
    });
  } catch (error) {
    console.error('Absence reason rejection error:', error);
    res.status(500).json({ message: 'Error rejecting absence reason', error: error.message });
  }
});

// @route   GET /api/student-interactions/absence-reasons/:studentId
// @desc    Get absence reasons for a student with detailed status
// @access  Private (Self or Teacher/Admin)
router.get('/absence-reasons/:studentId', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'faculty', 'teacher', 'hod'] }), async (req, res) => {
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
      .populate('attendanceId', 'status date sessionId')
      .populate('reviewedBy', 'name email')
      .populate('userId', 'email name')
      .sort({ createdAt: -1 });

    // Add submission deadline info
    const enrichedReasons = reasons.map(reason => {
      const submissionDeadline = new Date(reason.date);
      submissionDeadline.setHours(submissionDeadline.getHours() + ABSENCE_REASON_DEADLINE_HOURS);
      const isOverdue = Date.now() > submissionDeadline.getTime() && reason.status === 'pending';

      return {
        ...reason.toObject(),
        submissionDeadline,
        isOverdue,
        daysUntilDeadline: Math.ceil((submissionDeadline - Date.now()) / (1000 * 60 * 60 * 24))
      };
    });

    res.json(enrichedReasons);
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
// @access  Private (Student/Parent)
router.post('/leave', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, leaveType, reason } = req.body;

    // DEBUG — remove after fixing
    console.log('[LEAVE] body:', { startDate, endDate, leaveType, reason });
    console.log('[LEAVE] user:', { id: req.user._id, role: req.user.role, studentId: req.user.studentId });

    if (!startDate || !endDate || !reason) {
      console.log('[LEAVE] 400 – missing fields');
      return res.status(400).json({ message: 'Start date, end date, and reason are required' });
    }

    // Parse YYYY-MM-DD format properly
    const parseDate = (dateString) => {
      const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    };

    const start = parseDate(startDate);
    const end = parseDate(endDate);

    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.log('[LEAVE] 400 – invalid date format:', { startDate, endDate });
      return res.status(400).json({ message: 'Invalid date format. Please use YYYY-MM-DD format (e.g., 2026-03-30)' });
    }

    if (end < start) {
      console.log('[LEAVE] 400 – end before start');
      return res.status(400).json({ message: 'End date must be after or equal to start date' });
    }

    // Extract plain ObjectId from studentId (may be a populated Student document)
    const rawStudentId = req.user.studentId
      ? (req.user.studentId._id || req.user.studentId)  // handle populated object
      : req.user._id;

    // Check if student exists
    let student = await Student.findById(rawStudentId).select('name class parentIds');
    if (!student) {
      student = await Student.findOne({ userId: rawStudentId }).select('name class parentIds');
    }
    
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found. Please contact administration.' });
    }

    // Use the actual student _id (not the userId)
    const actualStudentId = student._id.toString();

    // ✓ FIX 3: Check leave balance
    const leaveDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const detectedLeaveType = leaveType || 'casual';
    const allowedBalance = LEAVE_BALANCE[detectedLeaveType] || 10;

    // Initialize balance variables (outside try-catch to avoid scope issues)
    let usedDays = 0;
    let remainingBalance = allowedBalance;

    // Count used leaves of this type for the academic year
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 3, 1); // April 1st
    const yearEnd = new Date(currentYear + 1, 2, 31); // March 31st

    try {
      const usedLeaves = await Leave.aggregate([
        {
          $match: {
            studentId: new mongoose.Types.ObjectId(actualStudentId),
            leaveType: detectedLeaveType,
            status: { $in: ['approved', 'pending'] },
            startDate: { $gte: yearStart, $lte: yearEnd }
          }
        },
        {
          $group: {
            _id: null,
            totalDays: {
              $sum: {
                $divide: [
                  { $subtract: ['$endDate', '$startDate'] },
                  1000 * 60 * 60 * 24
                ]
              }
            }
          }
        }
      ]);

      usedDays = usedLeaves.length > 0 ? Math.ceil(usedLeaves[0].totalDays) : 0;
      remainingBalance = allowedBalance - usedDays;

      if (leaveDays > remainingBalance) {
        console.log('[LEAVE] 400 – insufficient balance:', { leaveDays, remainingBalance, usedDays, allowedBalance, detectedLeaveType });
        return res.status(400).json({
          message: `Insufficient leave balance. Requested: ${leaveDays} days, Available: ${remainingBalance} days`,
          balance: {
            leaveType: detectedLeaveType,
            total: allowedBalance,
            used: usedDays,
            remaining: remainingBalance
          }
        });
      }
    } catch (balanceError) {
      console.error('Error calculating leave balance:', balanceError);
      // Continue with submission if balance check fails, don't block the request
    }

    // Check conflicting leaves
    try {
      const conflicts = await Leave.findOne({
        studentId: new mongoose.Types.ObjectId(actualStudentId),
        status: { $in: ['approved', 'pending'] },
        $or: [
          { startDate: { $lte: end }, endDate: { $gte: start } }
        ]
      });

      if (conflicts) {
        return res.status(400).json({
          message: `You already have a ${conflicts.status} ${conflicts.leaveType} leave request that overlaps these dates (${new Date(conflicts.startDate).toLocaleDateString()} – ${new Date(conflicts.endDate).toLocaleDateString()}). Please cancel it first or choose different dates.`
        });
      }
    } catch (conflictError) {
      console.error('Error checking leave conflicts:', conflictError);
      // Non-blocking: don't stop submission if conflict check fails
    }

    // Create leave request
    const leave = await Leave.create({
      studentId: actualStudentId,
      requestedBy: req.user._id,
      startDate: start,
      endDate: end,
      leaveType: detectedLeaveType,
      reason,
      status: 'pending'
    });

    // ✓ FIX 5: Notify class teachers for approval (non-blocking)
    try {
      const classDoc = await Class.findOne({ name: student.class })
        .select('_id');
      
      if (classDoc) {
        const teachers = await Staff.find({
          assignedClassIds: classDoc._id,
          designation: { $in: ['teacher', 'hod'] }
        }).populate('userId', '_id email name');

        for (const teacher of teachers) {
          await Notification.create({
            userId: teacher.userId._id,
            title: 'Leave Application for Approval',
            message: `${student.name} submitted leave request from ${start.toLocaleDateString()} to ${end.toLocaleDateString()} (${leaveDays} days)`,
            type: 'leave_approval_requested',
            priority: 'high',
            relatedId: leave._id,
            relatedModel: 'Leave',
            requiresAction: true,
            actionDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
          });
        }
      }
    } catch (teacherNotificationError) {
      console.error('Error notifying teachers:', teacherNotificationError);
      // Continue - don't block the submission if notifications fail
    }

    // ✓ FIX 6: Notify parent immediately (non-blocking)
    try {
      if (student.parentIds && student.parentIds.length > 0) {
        const parent = await Parent.findById(student.parentIds[0]);
        if (parent) {
          await Notification.create({
            userId: parent.userId,
            title: 'Leave Application Submitted',
            message: `Your child ${student.name} has submitted a leave request from ${start.toLocaleDateString()} to ${end.toLocaleDateString()} and is pending approval`,
            type: 'leave_submitted',
            relatedId: leave._id
          });
        }
      }
    } catch (parentNotificationError) {
      console.error('Error notifying parent:', parentNotificationError);
      // Continue - don't block the submission if notifications fail
    }

    res.status(201).json({
      message: 'Leave application submitted successfully',
      leave: {
        _id: leave._id,
        startDate,
        endDate,
        leaveType: detectedLeaveType,
        daysRequested: leaveDays,
        status: leave.status
      },
      balance: {
        leaveType: detectedLeaveType,
        total: allowedBalance,
        used: usedDays,
        remaining: remainingBalance - leaveDays
      }
    });
  } catch (error) {
    console.error('Leave submission error:', error);
    res.status(500).json({ message: 'Error submitting leave application', error: error.message });
  }
});

// ✓ NEW ENDPOINT: Approve leave (for teachers)
// @route   PUT /api/student-interactions/leave/:id/approve
// @desc    Approve leave application (Teacher/Admin only)
// @access  Private (Teacher, Admin)
router.put('/leave/:id/approve', requireAuth, requireRoles('staff', 'admin', 'hod', 'super_admin'), async (req, res) => {
  try {
    const { approvalRemarks } = req.body;
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      {
        status: 'approved',
        approvedBy: req.user._id,
        approvalDate: new Date(),
        approvalRemarks: approvalRemarks || '',
        notificationSent: true
      },
      { new: true }
    ).populate('studentId', 'name parentIds').populate('requestedBy', 'email');

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Notify student
    await Notification.create({
      userId: leave.requestedBy._id,
      title: 'Leave Application Approved',
      message: `Your leave from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been approved`,
      type: 'leave_approved',
      priority: 'high',
      relatedId: leave._id
    });

    // Notify parent
    const student = await Student.findById(leave.studentId);
    if (student && student.parentIds && student.parentIds.length > 0) {
      const parent = await Parent.findById(student.parentIds[0]);
      if (parent) {
        await Notification.create({
          userId: parent.userId,
          title: 'Child\'s Leave Approved',
          message: `${student.name}'s leave from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been approved`,
          type: 'leave_approved_parent',
          relatedId: leave._id
        });
      }
    }

    res.json({
      message: 'Leave application approved',
      leave
    });
  } catch (error) {
    console.error('Leave approval error:', error);
    res.status(500).json({ message: 'Error approving leave', error: error.message });
  }
});

// ✓ NEW ENDPOINT: Reject leave (for teachers)
// @route   PUT /api/student-interactions/leave/:id/reject
// @desc    Reject leave application (Teacher/Admin only)
// @access  Private (Teacher, Admin)
router.put('/leave/:id/reject', requireAuth, requireRoles('staff', 'admin', 'hod', 'super_admin'), async (req, res) => {
  try {
    const { approvalRemarks } = req.body;
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      {
        status: 'rejected',
        approvedBy: req.user._id,
        approvalDate: new Date(),
        approvalRemarks: approvalRemarks || 'Leave request rejected',
        notificationSent: true
      },
      { new: true }
    ).populate('studentId', 'name parentIds').populate('requestedBy', 'email');

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Notify student
    await Notification.create({
      userId: leave.requestedBy._id,
      title: 'Leave Application Rejected',
      message: `Your leave from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been rejected. Reason: ${approvalRemarks || 'Not specified'}`,
      type: 'leave_rejected',
      priority: 'high',
      relatedId: leave._id
    });

    // Notify parent
    const student = await Student.findById(leave.studentId);
    if (student && student.parentIds && student.parentIds.length > 0) {
      const parent = await Parent.findById(student.parentIds[0]);
      if (parent) {
        await Notification.create({
          userId: parent.userId,
          title: 'Child\'s Leave Rejected',
          message: `${student.name}'s leave request has been rejected`,
          type: 'leave_rejected_parent',
          priority: 'high',
          relatedId: leave._id
        });
      }
    }

    res.json({
      message: 'Leave application rejected',
      leave
    });
  } catch (error) {
    console.error('Leave rejection error:', error);
    res.status(500).json({ message: 'Error rejecting leave', error: error.message });
  }
});

// ✓ NEW ENDPOINT: Get leave balance
// @route   GET /api/student-interactions/leave-balance/:studentId
// @desc    Get leave balance for current academic year
// @access  Private (Student, Parent, Teacher, Admin)
router.get('/leave-balance/:studentId', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'teacher', 'hod'] }), async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-04-01`);
    const yearEnd = new Date(`${currentYear + 1}-03-31`);

    const balances = {};
    for (const leaveType of Object.keys(LEAVE_BALANCE)) {
      const usedLeaves = await Leave.aggregate([
        {
          $match: {
            studentId: new mongoose.Types.ObjectId(studentId),
            leaveType,
            status: { $in: ['approved'] },
            startDate: { $gte: yearStart, $lte: yearEnd }
          }
        },
        {
          $group: {
            _id: null,
            totalDays: {
              $sum: {
                $divide: [
                  { $subtract: ['$endDate', '$startDate'] },
                  1000 * 60 * 60 * 24
                ]
              }
            }
          }
        }
      ]);

      const usedDays = usedLeaves.length > 0 ? Math.ceil(usedLeaves[0].totalDays) : 0;
      const totalDays = LEAVE_BALANCE[leaveType];

      balances[leaveType] = {
        total: totalDays,
        used: usedDays,
        remaining: Math.max(0, totalDays - usedDays)
      };
    }

    res.json({
      studentId,
      academicYear: `${currentYear}-${currentYear + 1}`,
      balances
    });
  } catch (error) {
    console.error('Leave balance error:', error);
    res.status(500).json({ message: 'Error fetching leave balance', error: error.message });
  }
});

// @route   GET /api/student-interactions/leaves/:studentId
// @desc    Get leave applications for a student with detailed info
// @access  Private (Self or Teacher/Admin)
router.get('/leaves/:studentId', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'faculty', 'teacher', 'hod'] }), async (req, res) => {
  try {
    const { status, startDate, endDate, leaveType } = req.query;
    let query = { studentId: req.params.studentId };

    if (status) query.status = status;
    if (leaveType) query.leaveType = leaveType;
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const leaves = await Leave.find(query)
      .populate('studentId', 'name rollNumber class section')
      .populate('requestedBy', 'name email role')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    // Calculate days for each leave request
    const enrichedLeaves = leaves.map(leave => {
      const days = Math.ceil((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1;
      return {
        ...leave.toObject(),
        daysCount: days
      };
    });

    res.json(enrichedLeaves);
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ message: 'Error fetching leave applications', error: error.message });
  }
});

// ============================================
// EXAM ELIGIBILITY STATUS
// ============================================

// @route   GET /api/student-interactions/exam-eligibility/:studentId
// @desc    Check exam eligibility based on attendance, leaves, and fees
// @access  Private (Self or Teacher/Admin)
router.get('/exam-eligibility/:studentId', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'faculty', 'teacher', 'hod'] }), async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const { examType, startDate, endDate } = req.query;

    // Define minimum attendance requirements
    const eligibilityCriteria = {
      'mid_term': 75,
      'final': 75,
      'quiz': 60,
      'internal': 70,
      'default': EXAM_ELIGIBILITY_THRESHOLD
    };

    const requiredPercentage = eligibilityCriteria[examType] || eligibilityCriteria.default;

    // ✓ FIX 9: Calculate attendance for the period
    let query = { studentId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const records = await Attendance.find(query);
    const totalClasses = records.length;
    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;
    const onDutyCount = records.filter(r => r.status === 'on_duty').length;
    
    // Percentage includes both present and on_duty as eligible
    const eligibleCount = presentCount + (onDutyCount || 0);
    const percentage = totalClasses > 0 ? (eligibleCount / totalClasses) * 100 : 0;

    // Check pending leaves (should not block exam)
    const pendingLeaves = await Leave.countDocuments({
      studentId,
      status: 'pending'
    });

    // Check for outstanding absences without reasons
    const unresolvedAbsences = await AbsenceReason.countDocuments({
      studentId,
      status: 'pending'
    });

    // Check exam eligibility status
    const isEligible = percentage >= requiredPercentage && unresolvedAbsences === 0;
    const shortfall = isEligible ? 0 : requiredPercentage - percentage;

    // Calculate classes needed to become eligible
    let classesNeeded = 0;
    if (!isEligible && totalClasses > 0) {
      classesNeeded = Math.ceil((requiredPercentage * totalClasses - 100 * presentCount) / (100 - requiredPercentage));
      if (classesNeeded < 0) classesNeeded = 0;
    }

    // Build detailed eligibility report
    const reasons = [];
    if (percentage < requiredPercentage) {
      reasons.push({
        type: 'LOW_ATTENDANCE',
        detail: `Attendance is ${percentage.toFixed(2)}% (Required: ${requiredPercentage}%)`
      });
    }
    if (unresolvedAbsences > 0) {
      reasons.push({
        type: 'UNRESOLVED_ABSENCES',
        detail: `${unresolvedAbsences} absence(s) pending review`
      });
    }

    res.json({
      studentId,
      examType: examType || 'default',
      eligibility: {
        isEligible,
        status: isEligible ? 'eligible' : 'not_eligible'
      },
      attendance: {
        requiredPercentage,
        currentPercentage: parseFloat(percentage.toFixed(2)),
        totalClasses,
        present: presentCount,
        absent: absentCount,
        onDuty: onDutyCount,
        eligible: eligibleCount,
        shortfall: parseFloat(shortfall.toFixed(2)),
        classesNeededForEligibility: classesNeeded
      },
      leaves: {
        pendingCount: pendingLeaves,
        note: 'Pending leaves do not affect exam eligibility but must be resolved'
      },
      absences: {
        unresolvedCount: unresolvedAbsences,
        note: 'Unresolved absences must be approved to maintain eligibility'
      },
      blockers: reasons,
      message: isEligible 
        ? 'You are eligible for the exam' 
        : `You are not eligible for the exam. ${classesNeeded > 0 ? `You need ${classesNeeded} more classes with 100% attendance to become eligible.` : ''}`
    });
  } catch (error) {
    console.error('Exam eligibility error:', error);
    res.status(500).json({ message: 'Error checking exam eligibility', error: error.message });
  }
});

// ============================================
// LOW ATTENDANCE NOTIFICATIONS
// ============================================

// @route   GET /api/student-interactions/low-attendance-check/:studentId
// @desc    Check if student has low attendance and send alerts to teachers/parents
// @access  Private (Self or Teacher/Admin)
router.get('/low-attendance-check/:studentId', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'faculty', 'teacher', 'hod'] }), async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const lowAttendanceThreshold = parseFloat(process.env.LOW_ATTENDANCE_THRESHOLD || 75);
    const criticalThreshold = 60;

    // ✓ FIX: Validate student ID format first
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return sendSuccess(res, null, 400, 'Invalid student ID format');
    }

    let student = await Student.findById(studentId).select('name class parentIds _id');
    
    // Try userId lookup if not found by ID (in case frontend passed userId instead of studentId)
    if (!student) {
      student = await Student.findOne({ userId: studentId }).select('name class parentIds _id');
    }

    // Return empty attendance data for non-existent students instead of 404
    if (!student) {
      return sendSuccess(res, {
        status: 'normal',
        message: 'Student record not found',
        attendance: { total: 0, present: 0, eligible: 0, percentage: 0 }
      }, 200, 'No attendance data available');
    }

    // Get current month's attendance
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const endOfMonth = new Date();

    const records = await Attendance.find({ 
      studentId: student._id,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const totalClasses = records.length;
    const presentCount = records.filter(r => r.status === 'present').length;
    const onDutyCount = records.filter(r => r.status === 'on_duty').length;
    const eligibleCount = presentCount + onDutyCount;
    const percentage = totalClasses > 0 ? (eligibleCount / totalClasses) * 100 : 0;

    const status = percentage < criticalThreshold ? 'critical'
                 : percentage < lowAttendanceThreshold ? 'warning'
                 : 'normal';

    if (status !== 'normal') {
      // Get class teachers
      const classDoc = await Class.findOne({ name: student.class }).select('_id');
      if (classDoc) {
        const teachers = await Staff.find({
          assignedClassIds: classDoc._id,
          designation: { $in: ['teacher', 'hod'] }
        }).populate('userId', '_id email name');

        for (const teacher of teachers) {
          await Notification.create({
            userId: teacher.userId._id,
            title: status === 'critical' ? 'CRITICAL: Low Student Attendance' : 'WARNING: Low Student Attendance',
            message: `${student.name}'s attendance this month is ${percentage.toFixed(2)}% (${presentCount}/${totalClasses} classes)`,
            type: 'low_attendance_alert',
            priority: status === 'critical' ? 'high' : 'medium',
            relatedId: student._id,
            requiresAction: true
          });
        }
      }

      // Notify parent
      if (student.parentIds && student.parentIds.length > 0) {
        const parent = await Parent.findById(student.parentIds[0]);
        if (parent) {
          await Notification.create({
            userId: parent.userId,
            title: status === 'critical' ? 'URGENT: Your Child\'s Attendance is Critical' : 'Warning: Your Child\'s Attendance is Low',
            message: `${student.name}'s attendance this month is only ${percentage.toFixed(2)}% (${presentCount}/${totalClasses} classes). Please take necessary action.`,
            type: 'low_attendance_parent_alert',
            priority: status === 'critical' ? 'high' : 'medium',
            relatedId: student._id
          });
        }
      }
    }

    res.json({
      studentId: student._id,
      period: {
        month: startOfMonth.toLocaleString('default', { month: 'long', year: 'numeric' })
      },
      attendance: {
        total: totalClasses,
        present: presentCount,
        onDuty: onDutyCount,
        eligible: eligibleCount,
        absent: totalClasses - eligibleCount,
        percentage: parseFloat(percentage.toFixed(2))
      },
      thresholds: {
        critical: criticalThreshold,
        warning: lowAttendanceThreshold
      },
      status,
      message: status === 'normal' 
        ? `Your attendance (${percentage.toFixed(2)}%) meets the requirement`
        : `${status.toUpperCase()}: Your attendance is ${percentage.toFixed(2)}%, which is below the required ${lowAttendanceThreshold}%`,
      alertsSent: status !== 'normal'
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

    // Parse YYYY-MM-DD format properly
    const parseDate = (dateString) => {
      const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      // Convert all matched groups to integers
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    };

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    
    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format. Please use YYYY-MM-DD format (e.g., 2026-03-30)' });
    }
    
    if (end < start) {
      return res.status(400).json({ message: 'End date must be after or equal to start date' });
    }

    // Extract plain ObjectId from studentId (may be a populated Student document)
    const rawStudentId = req.user.studentId
      ? (req.user.studentId._id || req.user.studentId)
      : req.user._id;

    // Check if student exists
    let student = await Student.findById(rawStudentId).select('name class');
    if (!student) {
      student = await Student.findOne({ userId: rawStudentId }).select('name class');
    }
    
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found. Please contact administration.' });
    }

    // Use the actual student _id
    const actualStudentId = student._id.toString();

    const onDuty = new OnDuty({
      studentId: actualStudentId,
      userId: req.user._id,
      startDate: start,
      endDate: end,
      dutyType,
      reason,
      institution: institution || '',
      expectedClassesMissed: expectedClassesMissed || 0,
      status: 'pending',
    });

    await onDuty.save();

    // Notify class teachers for approval (non-blocking)
    try {
      const classDoc = await Class.findOne({ name: student.class }).select('_id');
      
      if (classDoc) {
        const teachers = await Staff.find({
          assignedClassIds: classDoc._id,
          designation: { $in: ['teacher', 'hod'] }
        }).populate('userId', '_id email name');

        for (const teacher of teachers) {
          await Notification.create({
            userId: teacher.userId._id,
            title: 'On-Duty Request for Approval',
            message: `${student.name} submitted on-duty request from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
            type: 'on_duty_approval',
            priority: 'high',
            relatedId: onDuty._id,
            requiresAction: true,
            actionDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
          });
        }
      }
    } catch (notificationError) {
      console.error('Error notifying teachers for on-duty:', notificationError);
      // Continue - don't block the submission if notifications fail
    }

    res.status(201).json({ 
      message: 'On-duty request submitted successfully',
      success: true,
      onDuty: {
        _id: onDuty._id,
        startDate,
        endDate,
        dutyType,
        reason,
        status: onDuty.status
      }
    });
  } catch (error) {
    console.error('On-duty submission error:', error);
    res.status(500).json({ message: 'Error submitting on-duty request', error: error.message });
  }
});

// @route   GET /api/student-interactions/on-duty/:studentId
// @desc    Get on-duty requests for a student
// @access  Private (Student, Teacher, Admin)
router.get('/on-duty/:studentId', requireAuth, requireSelfOrRoles({ roles: ['student', 'teacher', 'admin', 'hod', 'staff', 'super_admin'] }), async (req, res) => {
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
    res.status(500).json({ message: 'Error fetching on-duty requests', error: error.message });
  }
});

// @route   PUT /api/student-interactions/on-duty/:id/approve
// @desc    Approve on-duty request (Teacher/Admin only)
// @access  Private (Teacher, Admin)
router.put('/on-duty/:id/approve', requireAuth, requireRoles('teacher', 'admin', 'hod', 'staff', 'super_admin'), async (req, res) => {
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
    res.status(500).json({ message: 'Error approving on-duty request', error: error.message });
  }
});

// @route   PUT /api/student-interactions/on-duty/:id/reject
// @desc    Reject on-duty request (Teacher/Admin only)
// @access  Private (Teacher, Admin)
router.put('/on-duty/:id/reject', requireAuth, requireRoles('teacher', 'admin', 'hod', 'staff', 'super_admin'), async (req, res) => {
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
    res.status(500).json({ message: 'Error rejecting on-duty request', error: error.message });
  }
});

module.exports = router;
