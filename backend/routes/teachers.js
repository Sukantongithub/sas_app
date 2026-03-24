const express = require('express');
const router = express.Router();
const { asyncHandler, handleError, sendSuccess, findOrFail, ROLE_GROUPS } = require('../utils/routeHelpers');
const { requireAuth, requireRoles, requireSelfOrRoles } = require('../middleware/auth');

// Models
const User = require('../models/User');
const Class = require('../models/Class');
const Timetable = require('../models/Timetable');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Student = require('../models/Student');
const Notification = require('../models/Notification');

// ============================================================================
// CLASS & SUBJECT MANAGEMENT
// ============================================================================

// @route   GET /api/teachers/:teacherId/classes
// @desc    Get all classes assigned to a teacher
// @access  Private (Teacher, Self or Admin)
router.get('/:teacherId/classes', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'teacher'] }), asyncHandler(async (req, res) => {
  const classes = await Class.find({ faculty: req.params.teacherId })
    .populate('students', 'name rollNumber email')
    .populate('coordinator', 'name email')
    .sort({ name: 1 });
  
  sendSuccess(res, classes, 200, 'Classes retrieved successfully');
}));

// @route   GET /api/teachers/classes/:classId/details
// @desc    Get detailed class information including schedule and students
// @access  Private (Teacher assigned to class, Admin)
router.get('/classes/:classId/details', requireAuth, asyncHandler(async (req, res) => {
  const classData = await findOrFail(Class, req.params.classId);
  
  // Check if teacher is assigned to this class
  const isTeacherAssigned = classData.faculty.some(id => id.equals(req.user._id));
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin' && !isTeacherAssigned) {
    return res.status(403).json({ message: 'Not authorized to access this class' });
  }
  
  await classData.populate([
    { path: 'students', select: 'name rollNumber email class section' },
    { path: 'faculty', select: 'name email' },
    { path: 'coordinator', select: 'name email' }
  ]);
  
  sendSuccess(res, classData, 200, 'Class details retrieved');
}));

// @route   PUT /api/teachers/classes/:classId
// @desc    Update class details (schedule, coordinator, etc.)
// @access  Private (Admin only)
router.put('/classes/:classId', requireAuth, requireRoles('super_admin', 'admin'), asyncHandler(async (req, res) => {
  const { schedule, coordinator, beaconId, location, classroom } = req.body;
  
  const classData = await findOrFail(Class, req.params.classId);
  
  if (schedule) classData.schedule = schedule;
  if (coordinator) classData.coordinator = coordinator;
  if (beaconId) classData.beaconId = beaconId;
  if (location) classData.location = location;
  if (classroom) classData.classroom = classroom;
  
  await classData.save();
  
  sendSuccess(res, classData, 200, 'Class updated successfully');
}));

// @route   GET /api/teachers/:teacherId/subjects
// @desc    Get all subjects/courses taught by teacher
// @access  Private (Teacher, Self or Admin)
router.get('/:teacherId/subjects', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'teacher'] }), asyncHandler(async (req, res) => {
  const classes = await Class.find({ faculty: req.params.teacherId })
    .select('name code department semester academicYear')
    .sort({ name: 1 });
  
  // Extract unique subjects/courses
  const subjects = classes.map(cls => ({
    classId: cls._id,
    className: cls.name,
    code: cls.code,
    department: cls.department,
    semester: cls.semester,
    academicYear: cls.academicYear
  }));
  
  sendSuccess(res, subjects, 200, 'Subjects retrieved successfully');
}));

// ============================================================================
// MARK & VERIFY ATTENDANCE
// ============================================================================

// @route   GET /api/teachers/:teacherId/attendance/today
// @desc    Get today's attendance records for teacher's classes
// @access  Private (Teacher, Self or Admin)
router.get('/:teacherId/attendance/today', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'teacher'] }), asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  // Get all classes for this teacher
  const classes = await Class.find({ faculty: req.params.teacherId }).select('_id');
  const classIds = classes.map(c => c._id);
  
  // Get attendance for these classes today
  const attendance = await Attendance.find({
    date: today,
    classId: { $in: classIds }
  })
    .populate('studentId', 'name rollNumber email')
    .populate('markedBy', 'name email')
    .sort({ markedAt: -1 });
  
  sendSuccess(res, attendance, 200, 'Today\'s attendance retrieved');
}));

// @route   POST /api/teachers/attendance/mark
// @desc    Mark attendance for students in a class
// @access  Private (Teacher)
router.post('/attendance/mark', requireAuth, requireRoles('teacher', 'super_admin', 'admin'), asyncHandler(async (req, res) => {
  const { classId, sessionId, studentIds, date, markedAt } = req.body;
  
  if (!classId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ message: 'classId and studentIds (array) are required' });
  }
  
  // Verify teacher is assigned to this class
  const classData = await findOrFail(Class, classId);
  const isAssigned = classData.faculty.some(id => id.equals(req.user._id));
  if (req.user.role === 'teacher' && !isAssigned) {
    return res.status(403).json({ message: 'Not assigned to this class' });
  }
  
  const attendanceDate = date || new Date().toISOString().split('T')[0];
  const attendanceRecords = [];
  
  for (const studentId of studentIds) {
    const attendance = await Attendance.findOneAndUpdate(
      {
        studentId,
        classId,
        date: attendanceDate
      },
      {
        studentId,
        classId,
        sessionId,
        date: attendanceDate,
        status: 'present',
        markedBy: req.user._id,
        markedAt: markedAt || new Date()
      },
      { upsert: true, new: true }
    );
    attendanceRecords.push(attendance);
  }
  
  sendSuccess(res, attendanceRecords, 201, `Attendance marked for ${attendanceRecords.length} students`);
}));

// @route   POST /api/teachers/attendance/verify
// @desc    Verify BLE-based attendance marking
// @access  Private (Teacher)
router.post('/attendance/verify', requireAuth, requireRoles('teacher', 'super_admin', 'admin'), asyncHandler(async (req, res) => {
  const { attendanceId, status, comments } = req.body;
  
  if (!attendanceId || !status) {
    return res.status(400).json({ message: 'attendanceId and status (verified/rejected/needs-review) are required' });
  }
  
  const attendance = await findOrFail(Attendance, attendanceId);
  
  attendance.verificationStatus = status;
  attendance.verifiedBy = req.user._id;
  attendance.verifiedAt = new Date();
  if (comments) attendance.verificationComments = comments;
  
  await attendance.save();
  
  // Notify student if rejected
  if (status === 'rejected') {
    await Notification.create({
      userId: attendance.studentId,
      type: 'attendance_rejected',
      message: `Your attendance for ${attendance.date} was rejected. Comments: ${comments || 'None'}`,
      relatedId: attendanceId
    });
  }
  
  sendSuccess(res, attendance, 200, `Attendance ${status} successfully`);
}));

// ============================================================================
// EDIT ATTENDANCE WITH REASON
// ============================================================================

// @route   PUT /api/teachers/attendance/:attendanceId/edit
// @desc    Edit attendance record with reason/comments
// @access  Private (Teacher, Admin)
router.put('/attendance/:attendanceId/edit', requireAuth, requireRoles('teacher', 'super_admin', 'admin'), asyncHandler(async (req, res) => {
  const { status, reason, comments } = req.body;
  
  const attendance = await findOrFail(Attendance, req.params.attendanceId);
  
  // Verify teacher is from same class
  const classData = await Class.findById(attendance.classId);
  const isAssigned = classData.faculty.some(id => id.equals(req.user._id));
  if (req.user.role === 'teacher' && !isAssigned) {
    return res.status(403).json({ message: 'Not authorized to edit this record' });
  }
  
  const oldStatus = attendance.status;
  
  if (status) attendance.status = status;
  if (reason) attendance.editReason = reason;
  if (comments) attendance.editComments = comments;
  
  attendance.editedBy = req.user._id;
  attendance.editedAt = new Date();
  
  await attendance.save();
  
  // Notify student of status change
  if (oldStatus !== status) {
    await Notification.create({
      userId: attendance.studentId,
      type: 'attendance_edited',
      message: `Your attendance status for ${attendance.date} was changed from ${oldStatus} to ${status}. Reason: ${reason || 'No reason provided'}`,
      relatedId: req.params.attendanceId
    });
  }
  
  sendSuccess(res, attendance, 200, 'Attendance record updated with reason');
}));

// @route   GET /api/teachers/attendance/:attendanceId/edit-history
// @desc    Get edit history of an attendance record
// @access  Private (Teacher, Student, Admin)
router.get('/attendance/:attendanceId/edit-history', requireAuth, asyncHandler(async (req, res) => {
  const attendance = await Attendance.findById(req.params.attendanceId)
    .populate('markedBy', 'name email')
    .populate('verifiedBy', 'name email')
    .populate('editedBy', 'name email');
  
  if (!attendance) {
    return res.status(404).json({ message: 'Attendance record not found' });
  }
  
  // Check access
  const isStudent = req.user._id.equals(attendance.studentId);
  const isTeacher = attendance.classId && (await Class.findOne({ _id: attendance.classId, faculty: req.user._id }));
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin' && !isStudent && !isTeacher) {
    return res.status(403).json({ message: 'Not authorized' });
  }
  
  const history = {
    originalStatus: attendance.status,
    markedBy: attendance.markedBy,
    markedAt: attendance.markedAt,
    verificationStatus: attendance.verificationStatus,
    verifiedBy: attendance.verifiedBy,
    verifiedAt: attendance.verifiedAt,
    verificationComments: attendance.verificationComments,
    editedStatus: attendance.status,
    editReason: attendance.editReason,
    editComments: attendance.editComments,
    editedBy: attendance.editedBy,
    editedAt: attendance.editedAt
  };
  
  sendSuccess(res, history, 200, 'Edit history retrieved');
}));

// ============================================================================
// VIEW STUDENT ATTENDANCE LIST
// ============================================================================

// @route   GET /api/teachers/:teacherId/classes/:classId/attendance-list
// @desc    Get attendance list for all students in a class (date range)
// @access  Private (Teacher assigned to class, Admin)
router.get('/:teacherId/classes/:classId/attendance-list', requireAuth, asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const classData = await findOrFail(Class, req.params.classId);
  
  // Check authorization
  const isAssigned = classData.faculty.some(id => id.equals(req.user._id));
  if (req.user.role === 'teacher' && !isAssigned) {
    return res.status(403).json({ message: 'Not assigned to this class' });
  }
  
  // Build query
  const query = { classId: req.params.classId };
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
  }
  
  const attendanceList = await Attendance.find(query)
    .populate('studentId', 'name rollNumber email')
    .sort({ date: -1, studentId: 1 });
  
  // Group by date and calculate statistics
  const groupedByDate = {};
  attendanceList.forEach(record => {
    if (!groupedByDate[record.date]) {
      groupedByDate[record.date] = [];
    }
    groupedByDate[record.date].push(record);
  });
  
  // Calculate per-student statistics
  const studentStats = {};
  classData.students.forEach(studentId => {
    studentStats[studentId] = { present: 0, absent: 0, total: 0 };
  });
  
  attendanceList.forEach(record => {
    if (studentStats[record.studentId]) {
      studentStats[record.studentId].total++;
      if (record.status === 'present') {
        studentStats[record.studentId].present++;
      } else {
        studentStats[record.studentId].absent++;
      }
    }
  });
  
  sendSuccess(res, {
    className: classData.name,
    groupedByDate,
    studentStats
  }, 200, 'Attendance list retrieved');
}));

// @route   GET /api/teachers/classes/:classId/student/:studentId/attendance
// @desc    Get attendance history for specific student in a class
// @access  Private (Teacher, Student, Admin)
router.get('/classes/:classId/student/:studentId/attendance', requireAuth, asyncHandler(async (req, res) => {
  const { limit = 30, page = 1 } = req.query;
  
  const attendance = await Attendance.find({
    classId: req.params.classId,
    studentId: req.params.studentId
  })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ date: -1 })
    .populate('markedBy', 'name email')
    .populate('editedBy', 'name email');
  
  const total = await Attendance.countDocuments({
    classId: req.params.classId,
    studentId: req.params.studentId
  });
  
  sendSuccess(res, {
    attendance,
    totalRecords: total,
    page: page * 1,
    totalPages: Math.ceil(total / limit)
  }, 200, 'Student attendance history retrieved');
}));

// ============================================================================
// APPROVE LEAVE REQUESTS
// ============================================================================

// @route   GET /api/teachers/:teacherId/leave-requests
// @desc    Get all leave requests for students in teacher's classes
// @access  Private (Teacher, Self or Admin)
router.get('/:teacherId/leave-requests', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'teacher'] }), asyncHandler(async (req, res) => {
  const { status = 'pending' } = req.query;
  
  // Get all classes for this teacher
  const classes = await Class.find({ faculty: req.params.teacherId }).select('students');
  const studentIds = classes.flatMap(c => c.students);
  
  // Get leave requests for these students
  const leaves = await Leave.find({
    studentId: { $in: studentIds },
    status: status
  })
    .populate('studentId', 'name rollNumber email class')
    .populate('requestedBy', 'name email')
    .sort({ createdAt: -1 });
  
  sendSuccess(res, leaves, 200, 'Leave requests retrieved');
}));

// @route   POST /api/teachers/leave-requests/:leaveId/approve
// @desc    Approve a leave request
// @access  Private (Teacher, Admin)
router.post('/leave-requests/:leaveId/approve', requireAuth, requireRoles('teacher', 'super_admin', 'admin'), asyncHandler(async (req, res) => {
  const { comments } = req.body;
  
  const leave = await findOrFail(Leave, req.params.leaveId);
  
  leave.status = 'approved';
  leave.approvedBy = req.user._id;
  leave.approvedAt = new Date();
  if (comments) leave.approverComments = comments;
  
  await leave.save();
  
  // Notify student
  await Notification.create({
    userId: leave.studentId,
    type: 'leave_approved',
    message: `Your leave request from ${leave.startDate} to ${leave.endDate} has been approved`,
    relatedId: req.params.leaveId
  });
  
  sendSuccess(res, leave, 200, 'Leave request approved');
}));

// @route   POST /api/teachers/leave-requests/:leaveId/reject
// @desc    Reject a leave request
// @access  Private (Teacher, Admin)
router.post('/leave-requests/:leaveId/reject', requireAuth, requireRoles('teacher', 'super_admin', 'admin'), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  
  if (!reason) {
    return res.status(400).json({ message: 'Rejection reason is required' });
  }
  
  const leave = await findOrFail(Leave, req.params.leaveId);
  
  leave.status = 'rejected';
  leave.rejectedBy = req.user._id;
  leave.rejectedAt = new Date();
  leave.rejectionReason = reason;
  
  await leave.save();
  
  // Notify student
  await Notification.create({
    userId: leave.studentId,
    type: 'leave_rejected',
    message: `Your leave request from ${leave.startDate} to ${leave.endDate} has been rejected. Reason: ${reason}`,
    relatedId: req.params.leaveId
  });
  
  sendSuccess(res, leave, 200, 'Leave request rejected');
}));

// @route   GET /api/teachers/leave-requests/:leaveId/details
// @desc    Get detailed view of a leave request
// @access  Private (Teacher, Student, Admin)
router.get('/leave-requests/:leaveId/details', requireAuth, asyncHandler(async (req, res) => {
  const leave = await Leave.findById(req.params.leaveId)
    .populate('studentId', 'name rollNumber email class')
    .populate('requestedBy', 'name email')
    .populate('approvedBy', 'name email')
    .populate('rejectedBy', 'name email');
  
  if (!leave) {
    return res.status(404).json({ message: 'Leave request not found' });
  }
  
  sendSuccess(res, leave, 200, 'Leave request details retrieved');
}));

// @route   GET /api/teachers/:teacherId/leave-summary
// @desc    Get summary of leave requests (pending, approved, rejected)
// @access  Private (Teacher, Self or Admin)
router.get('/:teacherId/leave-summary', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'teacher'] }), asyncHandler(async (req, res) => {
  // Get all classes for this teacher
  const classes = await Class.find({ faculty: req.params.teacherId }).select('students');
  const studentIds = classes.flatMap(c => c.students);
  
  const summary = await Leave.aggregate([
    {
      $match: { studentId: { $in: studentIds } }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    pending: 0,
    approved: 0,
    rejected: 0,
    on_leave: 0
  };
  
  summary.forEach(item => {
    result[item._id] = item.count;
  });
  
  sendSuccess(res, result, 200, 'Leave summary retrieved');
}));

// ============================================================================
// TIMETABLE MANAGEMENT (Staff / HOD)
// ============================================================================

// @route   GET /api/teachers/timetable/my-classes
// @desc    Get list of classes assigned to the logged-in teacher
// @access  Private (Staff, HOD, Admin)
router.get('/timetable/my-classes', requireAuth, requireRoles('staff', 'hod', 'super_admin', 'admin'), asyncHandler(async (req, res) => {
  // Return ALL active classes so staff can manage timetables for any class
  const classes = await Class.find({ isActive: true })
    .select('name code department semester section students faculty')
    .sort({ name: 1 });

  sendSuccess(res, classes, 200, 'Classes retrieved successfully');
}));

// @route   GET /api/teachers/timetable/class/:classId
// @desc    Get full weekly timetable for a specific class
// @access  Private (Staff, HOD, Admin)
router.get('/timetable/class/:classId', requireAuth, asyncHandler(async (req, res) => {
  const timetableEntries = await Timetable.find({
    classId: req.params.classId,
    isActive: true
  }).sort({ dayOfWeek: 1, 'periods.periodNumber': 1 });

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const weekly = {};
  days.forEach(d => { weekly[d] = []; });

  timetableEntries.forEach(entry => {
    entry.periods.forEach(period => {
      weekly[entry.dayOfWeek].push({
        timetableId: entry._id,
        dayOfWeek: entry.dayOfWeek,
        periodNumber: period.periodNumber,
        subject: period.subject,
        startTime: period.startTime,
        endTime: period.endTime,
        room: period.room,
        isLab: period.isLab
      });
    });
    // sort periods within day
    weekly[entry.dayOfWeek].sort((a, b) => a.periodNumber - b.periodNumber);
  });

  sendSuccess(res, { timetable: weekly, entries: timetableEntries }, 200, 'Class timetable retrieved');
}));

// @route   GET /api/teachers/timetable/:teacherId
// @desc    Get teacher's full weekly timetable (across all classes)
// @access  Private (Teacher, Admin)
router.get('/timetable/:teacherId', requireAuth, asyncHandler(async (req, res) => {
  const timetableEntries = await Timetable.find({
    'periods.teacherId': req.params.teacherId,
    isActive: true
  })
    .populate('classId', 'name code department semester')
    .sort({ dayOfWeek: 1 });

  sendSuccess(res, timetableEntries, 200, 'Teacher timetable retrieved');
}));

// @route   POST /api/teachers/timetable
// @desc    Create or upsert a timetable entry for a class/day
// @access  Private (Staff, HOD, Admin)
router.post('/timetable', requireAuth, requireRoles('staff', 'hod', 'super_admin', 'admin'), asyncHandler(async (req, res) => {
  const { classId, section, dayOfWeek, periods } = req.body;

  if (!classId || !dayOfWeek || !periods || !Array.isArray(periods) || periods.length === 0) {
    return res.status(400).json({ message: 'classId, dayOfWeek, and periods[] are required' });
  }

  // Validate periods
  for (const p of periods) {
    if (!p.subject || !p.startTime || !p.endTime || p.periodNumber == null) {
      return res.status(400).json({ message: 'Each period must have periodNumber, subject, startTime, endTime' });
    }
  }

  const query = { classId, dayOfWeek };
  if (section) query.section = section;

  let entry = await Timetable.findOne(query);

  if (entry) {
    entry.periods = periods;
    entry.updatedAt = Date.now();
  } else {
    entry = new Timetable({
      classId,
      section,
      dayOfWeek,
      periods,
      createdBy: req.user._id
    });
  }

  await entry.save();
  sendSuccess(res, entry, 201, 'Timetable saved successfully');
}));

// @route   PUT /api/teachers/timetable/:timetableId
// @desc    Update a timetable entry (replace all periods for that day)
// @access  Private (Staff, HOD, Admin)
router.put('/timetable/:timetableId', requireAuth, requireRoles('staff', 'hod', 'super_admin', 'admin'), asyncHandler(async (req, res) => {
  const { periods, section } = req.body;

  const entry = await findOrFail(Timetable, req.params.timetableId);

  if (periods && Array.isArray(periods)) {
    // Validate
    for (const p of periods) {
      if (!p.subject || !p.startTime || !p.endTime || p.periodNumber == null) {
        return res.status(400).json({ message: 'Each period must have periodNumber, subject, startTime, endTime' });
      }
    }
    entry.periods = periods;
  }
  if (section !== undefined) entry.section = section;
  entry.updatedAt = Date.now();

  await entry.save();
  sendSuccess(res, entry, 200, 'Timetable updated successfully');
}));

// @route   DELETE /api/teachers/timetable/:timetableId
// @desc    Soft-delete (deactivate) a timetable entry
// @access  Private (Staff, HOD, Admin)
router.delete('/timetable/:timetableId', requireAuth, requireRoles('staff', 'hod', 'super_admin', 'admin'), asyncHandler(async (req, res) => {
  const entry = await findOrFail(Timetable, req.params.timetableId);
  entry.isActive = false;
  entry.updatedAt = Date.now();
  await entry.save();
  sendSuccess(res, {}, 200, 'Timetable entry deleted');
}));

module.exports = router;

