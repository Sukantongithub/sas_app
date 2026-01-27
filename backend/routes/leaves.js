const express = require('express');
const router = express.Router();
const Leave = require('../models/Leave');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { requireAuth, requireRoles } = require('../middleware/auth');

// @route   POST /api/leaves
// @desc    Create leave request (by parent or student)
// @access  Private (Parent/Student)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { studentId, startDate, endDate, leaveType, reason, attachments } = req.body;
    
    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }
    
    // If parent, verify they have access to this student
    if (req.user.role === 'parent') {
      const student = await Student.findById(studentId);
      if (!student || !student.parentIds.some(id => id.equals(req.user._id))) {
        return res.status(403).json({ message: 'You do not have access to this student' });
      }
    }
    
    // If student, can only request for themselves
    if (req.user.role === 'student' && !req.user.studentId.equals(studentId)) {
      return res.status(403).json({ message: 'You can only request leave for yourself' });
    }
    
    const leave = await Leave.create({
      studentId,
      requestedBy: req.user._id,
      startDate: start,
      endDate: end,
      leaveType,
      reason,
      attachments: attachments || []
    });
    
    await leave.populate('studentId', 'name rollNumber class section');
    
    // Notify teachers/admins about new leave request
    // TODO: Get class teachers and send notification
    
    res.status(201).json({
      message: 'Leave request submitted successfully',
      leave
    });
  } catch (error) {
    console.error('Create leave error:', error);
    res.status(500).json({ message: 'Error creating leave request', error: error.message });
  }
});

// @route   GET /api/leaves
// @desc    Get leave requests (filtered by role)
// @access  Private
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, studentId, startDate, endDate } = req.query;
    let query = {};
    
    // Filter based on role
    if (req.user.role === 'parent') {
      // Get all students linked to this parent
      const students = await Student.find({ parentIds: req.user._id }).select('_id');
      query.studentId = { $in: students.map(s => s._id) };
    } else if (req.user.role === 'student') {
      query.studentId = req.user.studentId;
    }
    // Teachers/admins can see all leaves (filtered by other params)
    
    if (status) query.status = status;
    if (studentId) query.studentId = studentId;
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
    
    res.json(leaves);
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ message: 'Error fetching leaves', error: error.message });
  }
});

// @route   GET /api/leaves/pending
// @desc    Get pending leave requests (for teachers/admins)
// @access  Private (Teacher/Admin)
router.get('/pending', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const leaves = await Leave.getPendingLeaves();
    res.json(leaves);
  } catch (error) {
    console.error('Get pending leaves error:', error);
    res.status(500).json({ message: 'Error fetching pending leaves', error: error.message });
  }
});

// @route   GET /api/leaves/:id
// @desc    Get single leave request
// @access  Private
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id)
      .populate('studentId', 'name rollNumber class section email phone')
      .populate('requestedBy', 'name email role phone')
      .populate('approvedBy', 'name email');
    
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    
    // Check access
    const isParent = req.user.role === 'parent' && leave.requestedBy._id.equals(req.user._id);
    const isStudent = req.user.role === 'student' && leave.requestedBy._id.equals(req.user._id);
    const isStaff = ['super_admin', 'admin', 'faculty', 'teacher'].includes(req.user.role);
    
    if (!isParent && !isStudent && !isStaff) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(leave);
  } catch (error) {
    console.error('Get leave error:', error);
    res.status(500).json({ message: 'Error fetching leave', error: error.message });
  }
});

// @route   PUT /api/leaves/:id/approve
// @desc    Approve leave request
// @access  Private (Teacher/Admin)
router.put('/:id/approve', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const { remarks } = req.body;
    const leave = await Leave.findById(req.params.id)
      .populate('studentId', 'name parentIds')
      .populate('requestedBy', 'name email');
    
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Leave already processed' });
    }
    
    await leave.approve(req.user._id, remarks);
    
    // Send notification to requester
    await Notification.createAndSend(
      leave.requestedBy._id,
      'leave_approved',
      'Leave Request Approved',
      `Your leave request for ${leave.studentId.name} from ${leave.startDate.toDateString()} to ${leave.endDate.toDateString()} has been approved.`,
      { leaveId: leave._id, studentId: leave.studentId._id },
      ['app', 'sms']
    );
    
    res.json({
      message: 'Leave approved successfully',
      leave
    });
  } catch (error) {
    console.error('Approve leave error:', error);
    res.status(500).json({ message: 'Error approving leave', error: error.message });
  }
});

// @route   PUT /api/leaves/:id/reject
// @desc    Reject leave request
// @access  Private (Teacher/Admin)
router.put('/:id/reject', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const { remarks } = req.body;
    const leave = await Leave.findById(req.params.id)
      .populate('studentId', 'name')
      .populate('requestedBy', 'name email');
    
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Leave already processed' });
    }
    
    await leave.reject(req.user._id, remarks);
    
    // Send notification to requester
    await Notification.createAndSend(
      leave.requestedBy._id,
      'leave_rejected',
      'Leave Request Rejected',
      `Your leave request for ${leave.studentId.name} from ${leave.startDate.toDateString()} to ${leave.endDate.toDateString()} has been rejected. ${remarks ? 'Reason: ' + remarks : ''}`,
      { leaveId: leave._id, studentId: leave.studentId._id },
      ['app', 'sms']
    );
    
    res.json({
      message: 'Leave rejected',
      leave
    });
  } catch (error) {
    console.error('Reject leave error:', error);
    res.status(500).json({ message: 'Error rejecting leave', error: error.message });
  }
});

// @route   GET /api/leaves/student/:studentId/summary
// @desc    Get student's leave summary
// @access  Private
router.get('/student/:studentId/summary', requireAuth, async (req, res) => {
  try {
    const summary = await Leave.getStudentSummary(req.params.studentId);
    res.json(summary);
  } catch (error) {
    console.error('Get leave summary error:', error);
    res.status(500).json({ message: 'Error fetching leave summary', error: error.message });
  }
});

// @route   DELETE /api/leaves/:id
// @desc    Cancel leave request (only by requester)
// @access  Private
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    
    // Only requester can cancel
    if (!leave.requestedBy.equals(req.user._id)) {
      return res.status(403).json({ message: 'Only requester can cancel leave' });
    }
    
    // Can only cancel pending leaves
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Can only cancel pending leaves' });
    }
    
    leave.status = 'cancelled';
    await leave.save();
    
    res.json({
      message: 'Leave request cancelled',
      leave
    });
  } catch (error) {
    console.error('Cancel leave error:', error);
    res.status(500).json({ message: 'Error cancelling leave', error: error.message });
  }
});

module.exports = router;
