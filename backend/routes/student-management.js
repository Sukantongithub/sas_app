const express = require('express');
const router = express.Router();
const { asyncHandler, handleError, sendSuccess, findOrFail, ROLE_GROUPS } = require('../utils/routeHelpers');
const { requireAuth, requireRoles, requireSelfOrRoles } = require('../middleware/auth');

// Models
const Student = require('../models/Student');
const User = require('../models/User');
const Parent = require('../models/Parent');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Notification = require('../models/Notification');

// ============================================================================
// PARENT VIEW - GET THEIR CHILDREN
// ============================================================================

// @route   GET /api/student-management/my-children
// @desc    Get all children linked to the logged-in parent
// @access  Private (Parent)
router.get('/my-children', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'parent') {
    return res.status(403).json({ success: false, message: 'Only parents can access this endpoint' });
  }

  try {
    console.log('👨‍👩‍👧 Fetching children for parent User:', req.user._id);
    
    // Get parent document
    const parent = await Parent.findOne({ userId: req.user._id })
      .populate({
        path: 'studentIds',
        model: 'Student',
        select: 'name rollNumber email class department section year parentIds'
      });

    console.log('📋 Parent Document:', parent);
    console.log('📚 Parent studentIds:', parent?.studentIds?.length || 0);

    if (!parent) {
      console.log('⚠️  No parent document found');
      return sendSuccess(res, [], 200, 'No children found');
    }

    // Verify all students have this parent linked and get their User accounts
    const childrenWithUserAccounts = await Promise.all(
      parent.studentIds.map(async (student) => {
        console.log('\n  🔍 Checking student:', student._id, student.name);
        console.log('    Student parentIds:', student.parentIds);
        console.log('    Has this parent?', student.parentIds?.some(pId => pId.toString() === req.user._id.toString()));
        
        // Verify this student has this parent linked
        if (!(student.parentIds && student.parentIds.some(pId => pId.toString() === req.user._id.toString()))) {
          console.log('    ❌ Student does NOT have this parent in parentIds');
          return null;
        }

        // Find the User account for this student (if it exists)
        const studentUser = await User.findOne({ studentId: student._id }).select('_id');
        console.log('    ✅ Student has parent. User account:', studentUser?._id);
        
        return {
          _id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          email: student.email,
          class: student.class,
          department: student.department,
          section: student.section,
          year: student.year,
          userId: studentUser?._id  // Include student's user _id for attendance queries
        };
      })
    );

    // Filter out null entries
    const children = childrenWithUserAccounts.filter(child => child !== null);

    console.log('✅ Final children count:', children.length);
    sendSuccess(res, children, 200, 'Children retrieved successfully');
  } catch (error) {
    console.error('❌ Error in my-children:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}));

// ============================================================================
// MANAGE STUDENTS - ADMIN/TEACHER VIEW
// ============================================================================

// @route   GET /api/student-management/list
// @desc    Get all students with filters
// @access  Private (Admin, Teacher)
router.get('/list', requireAuth, requireRoles('super_admin', 'admin', 'staff', 'hod'), asyncHandler(async (req, res) => {
  const { class: classId, department, search, page = 1, limit = 20, status = 'active' } = req.query;

  let query = { role: 'student' };

  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { rollNumber: new RegExp(search, 'i') }
    ];
  }

  if (classId) query.class = classId;
  if (department) query.department = department;
  if (status) query.isActive = status === 'active';

  // For staff/hod, only show students in their assigned classes
  if (req.user.role === 'staff' || req.user.role === 'hod') {
    const staffClasses = await Class.find({ faculty: req.user._id }).select('students');
    const studentIds = staffClasses.flatMap(c => c.students);
    query._id = { $in: studentIds };
  }

  const students = await User.find(query)
    .select('name email rollNumber class department phone guardianContact emergencyContact isActive')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ name: 1 });

  const total = await User.countDocuments(query);

  sendSuccess(res, {
    students,
    totalRecords: total,
    page: page * 1,
    totalPages: Math.ceil(total / limit)
  }, 200, 'Students retrieved');
}));

// @route   GET /api/student-management/:studentId/profile
// @desc    Get complete student profile with stats and parent info
// @access  Private (Self, Parent, Teacher, Admin)
router.get('/:studentId/profile', requireAuth, asyncHandler(async (req, res) => {
  // Try to find by Student._id first (from parent's perspective)
  let student = await Student.findById(req.params.studentId)
    .populate('userId', 'email isActive')
    .lean();

  if (!student) {
    // Try to find by User._id (from student's perspective)
    const userStudent = await User.findById(req.params.studentId)
      .select('-password')
      .lean();

    if (!userStudent || userStudent.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Find the Student document linked to this User
    student = await Student.findById(userStudent.studentId)
      .populate('userId', 'email isActive')
      .lean();
  }

  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  // Authorization check
  if (req.user.role === 'student' && !req.user._id.equals(student.userId?._id)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  if (req.user.role === 'parent') {
    // Check if parent has access to this student
    if (!student.parentIds?.some(p => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }
  }

  // Fetch parent documents for all parent User IDs
  let parentDetails = [];
  if (student.parentIds && student.parentIds.length > 0) {
    console.log('🔍 Fetching parent details for parentIds:', student.parentIds);
    
    const parentDocs = await Parent.find({ userId: { $in: student.parentIds } })
      .select('userId name mobileNumber email relation')
      .lean();
    
    console.log('📋 Found parent documents:', parentDocs.length);
    parentDetails = parentDocs;
  }

  // Get attendance stats using userId
  const totalAttendance = await Attendance.countDocuments({ studentId: student.userId });
  const presentCount = await Attendance.countDocuments({ studentId: student.userId, status: 'present' });
  const attendancePercentage = totalAttendance > 0 ? ((presentCount / totalAttendance) * 100).toFixed(2) : 0;

  // Get leave stats using userId
  const totalLeaves = await Leave.countDocuments({ studentId: student._id });
  const approvedLeaves = await Leave.countDocuments({ studentId: student._id, status: 'approved' });

  sendSuccess(res, {
    ...student,
    parentDetails,  // Include full parent information
    statistics: {
      totalAttendance,
      presentCount,
      attendancePercentage,
      totalLeaves,
      approvedLeaves
    }
  }, 200, 'Student profile retrieved');
}));

// @route   PUT /api/student-management/:studentId/update
// @desc    Update student information
// @access  Private (Self, Admin)
router.put('/:studentId/update', requireAuth, asyncHandler(async (req, res) => {
  const { name, email, phone, guardianContact, emergencyContact, address } = req.body;

  // Authorization
  if (req.user.role === 'student' && !req.user._id.equals(req.params.studentId)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const student = await findOrFail(User, req.params.studentId);

  if (name) student.name = name;
  if (email) student.email = email;
  if (phone) student.phone = phone;
  if (guardianContact) student.guardianContact = guardianContact;
  if (emergencyContact) student.emergencyContact = emergencyContact;
  if (address) student.address = address;

  await student.save();

  sendSuccess(res, student, 200, 'Student profile updated');
}));

// @route   PUT /api/student-management/:studentId/status
// @desc    Update student status (active/inactive)
// @access  Private (Admin only)
router.put('/:studentId/status', requireAuth, requireRoles('super_admin', 'admin'), asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ message: 'isActive must be a boolean' });
  }

  const student = await findOrFail(User, req.params.studentId);

  student.isActive = isActive;
  await student.save();

  sendSuccess(res, student, 200, `Student ${isActive ? 'activated' : 'deactivated'}`);
}));

// ============================================================================
// REQUEST APPROVAL MANAGEMENT
// ============================================================================

// @route   GET /api/student-management/:studentId/pending-requests
// @desc    Get all pending requests for a student
// @access  Private (Self, Teacher, Admin)
router.get('/:studentId/pending-requests', requireAuth, asyncHandler(async (req, res) => {
  // Authorization check
  const isStudent = req.user.role === 'student' && req.user._id.equals(req.params.studentId);
  const isStaff = req.user.role === 'staff' || req.user.role === 'hod';
  const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';

  if (!isStudent && !isStaff && !isAdmin) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const requests = {
    leaveRequests: await Leave.find({
      studentId: req.params.studentId,
      status: 'pending'
    })
      .populate('studentId', 'name rollNumber email')
      .sort({ createdAt: -1 }),

    onDutyRequests: [], // Implement based on OnDuty model
    absenceRequests: [] // Implement based on Absence model
  };

  sendSuccess(res, requests, 200, 'Pending requests retrieved');
}));

// @route   GET /api/student-management/requests/approval-queue
// @desc    Get all requests awaiting approval (for admin/teacher)
// @access  Private (Admin, Teacher)
router.get('/requests/approval-queue', requireAuth, requireRoles('super_admin', 'admin', 'staff', 'hod'), asyncHandler(async (req, res) => {
  const { type = 'all', priority = 'all' } = req.query;

  let query = { status: 'pending' };

  if (type && type !== 'all') {
    query.type = type; // 'leave', 'on_duty', 'absence'
  }

  const requests = await Leave.find(query)
    .populate('studentId', 'name rollNumber email class')
    .populate('requestedBy', 'name email')
    .sort({ createdAt: -1 });

  const grouped = {
    urgent: requests.filter(r => new Date(r.startDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    normal: requests.filter(r => new Date(r.startDate) > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  };

  sendSuccess(res, grouped, 200, 'Approval queue retrieved');
}));

// @route   POST /api/student-management/requests/:requestId/approve
// @desc    Approve a student request
// @access  Private (Admin, Teacher)
router.post('/requests/:requestId/approve', requireAuth, requireRoles('super_admin', 'admin', 'staff', 'hod'), asyncHandler(async (req, res) => {
  const { comments, priority } = req.body;

  const request = await findOrFail(Leave, req.params.requestId);

  request.status = 'approved';
  request.approvedBy = req.user._id;
  request.approvedAt = new Date();
  if (comments) request.approverComments = comments;
  if (priority) request.priority = priority;

  await request.save();

  // Notify student
  await Notification.create({
    userId: request.requestedBy,
    type: 'leave_approved',
    title: 'Request Approved',
    message: `Your ${request.leaveType || 'leave'} request has been approved`,
  });

  sendSuccess(res, request, 200, 'Request approved');
}));

// @route   POST /api/student-management/requests/:requestId/reject
// @desc    Reject a student request
// @access  Private (Admin, Teacher)
router.post('/requests/:requestId/reject', requireAuth, requireRoles('super_admin', 'admin', 'staff', 'hod'), asyncHandler(async (req, res) => {
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ message: 'Rejection reason is required' });
  }

  const request = await findOrFail(Leave, req.params.requestId);

  request.status = 'rejected';
  request.rejectedBy = req.user._id;
  request.rejectedAt = new Date();
  request.rejectionReason = reason;

  await request.save();

  // Notify student
  await Notification.create({
    userId: request.requestedBy,
    type: 'leave_rejected',
    title: 'Request Rejected',
    message: `Your ${request.leaveType || 'leave'} request has been rejected. Reason: ${reason}`,
  });

  sendSuccess(res, request, 200, 'Request rejected');
}));

// ============================================================================
// STUDENT FEATURES & RELEVANT INFO
// ============================================================================

// @route   GET /api/student-management/:studentId/academic-info
// @desc    Get student's academic information
// @access  Private (Self, Teacher, Admin)
router.get('/:studentId/academic-info', requireAuth, asyncHandler(async (req, res) => {
  const student = await User.findById(req.params.studentId)
    .populate('class', 'name code department semester');

  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  const classInfo = await Class.findOne({ students: req.params.studentId })
    .populate('faculty', 'name email');

  sendSuccess(res, {
    studentName: student.name,
    rollNumber: student.rollNumber,
    email: student.email,
    class: classInfo,
    enrollmentDate: student.createdAt
  }, 200, 'Academic information retrieved');
}));

// @route   GET /api/student-management/:studentId/performance
// @desc    Get student performance metrics
// @access  Private (Self, Teacher, Admin)
router.get('/:studentId/performance', requireAuth, asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  let attendanceQuery = { studentId: req.params.studentId };
  if (startDate || endDate) {
    attendanceQuery.date = {};
    if (startDate) attendanceQuery.date.$gte = startDate;
    if (endDate) attendanceQuery.date.$lte = endDate;
  }

  const totalClasses = await Attendance.countDocuments(attendanceQuery);
  const presentDays = await Attendance.countDocuments({ ...attendanceQuery, status: 'present' });
  const absentDays = await Attendance.countDocuments({ ...attendanceQuery, status: 'absent' });
  const lateDays = await Attendance.countDocuments({ ...attendanceQuery, status: 'late' });

  const attendancePercentage = totalClasses > 0 ? ((presentDays / totalClasses) * 100).toFixed(2) : 0;

  // Get recent leaves
  const recentLeaves = await Leave.find({ studentId: req.params.studentId })
    .limit(5)
    .sort({ startDate: -1 });

  sendSuccess(res, {
    attendance: {
      totalClasses,
      presentDays,
      absentDays,
      lateDays,
      attendancePercentage
    },
    recentLeaves,
    performanceStatus: attendancePercentage >= 75 ? 'Good' : 'Needs Improvement'
  }, 200, 'Performance data retrieved');
}));

// @route   GET /api/student-management/:studentId/documents
// @desc    Get student documents/certificates
// @access  Private (Self, Admin)
router.get('/:studentId/documents', requireAuth, asyncHandler(async (req, res) => {
  const student = await findOrFail(User, req.params.studentId);

  const documents = {
    admissionForm: student.documents?.admissionForm || null,
    enrollmentCertificate: student.documents?.enrollmentCertificate || null,
    bonafideCertificate: student.documents?.bonafideCertificate || null,
    attendanceCertificate: student.documents?.attendanceCertificate || null,
    transcripts: student.documents?.transcripts || []
  };

  sendSuccess(res, documents, 200, 'Documents retrieved');
}));

// @route   POST /api/student-management/:studentId/generate-certificate
// @desc    Generate student certificate (attendance/bonafide)
// @access  Private (Admin only)
router.post('/:studentId/generate-certificate', requireAuth, requireRoles('super_admin', 'admin'), asyncHandler(async (req, res) => {
  const { certificateType } = req.body; // 'bonafide', 'attendance', 'enrollment'

  if (!certificateType) {
    return res.status(400).json({ message: 'Certificate type is required' });
  }

  const student = await findOrFail(User, req.params.studentId);

  // In production, generate actual PDF
  const certificate = {
    type: certificateType,
    generatedDate: new Date(),
    studentName: student.name,
    rollNumber: student.rollNumber,
    class: student.class,
    status: 'generated'
  };

  sendSuccess(res, certificate, 201, `${certificateType} certificate generated`);
}));

// @route   GET /api/student-management/:studentId/notifications
// @desc    Get student notifications
// @access  Private (Self, Admin)
router.get('/:studentId/notifications', requireAuth, asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ userId: req.params.studentId })
    .limit(20)
    .sort({ createdAt: -1 });

  sendSuccess(res, notifications, 200, 'Notifications retrieved');
}));

// @route   GET /api/student-management/:studentId/schedule
// @desc    Get student timetable/schedule
// @access  Private (Self, Teacher, Admin)
router.get('/:studentId/schedule', requireAuth, asyncHandler(async (req, res) => {
  console.log('📋 Fetching schedule for ID:', req.params.studentId);
  
  const Student = require('../models/Student');
  
  // Try to find Student document directly
  let StudentDoc = await Student.findById(req.params.studentId);
  
  // If not found, it might be a User ID - check if this User has a studentId reference
  if (!StudentDoc) {
    console.log('📋 Not a Student ID, checking if it\'s a User ID with studentId reference');
    const userRef = await User.findById(req.params.studentId);
    
    if (userRef?.studentId) {
      console.log('📋 Found User with studentId reference:', userRef.studentId);
      StudentDoc = await Student.findById(userRef.studentId);
    }
  }
  
  if (!StudentDoc) {
    console.log('❌ Student document not found for ID:', req.params.studentId);
    return res.status(404).json({ message: 'Student not found' });
  }
  
  console.log('📋 Student found:', { studentId: StudentDoc._id, class: StudentDoc.class, classId: StudentDoc.classId });

  const Class = require('../models/Class');
  let classData = null;

  // Try classId first (preferred)
  if (StudentDoc.classId) {
    classData = await Class.findById(StudentDoc.classId).select('schedule name');
    console.log('📋 Found class by classId:', { className: classData?.name });
  }

  // If no classId or classId lookup failed, try by name
  if (!classData && StudentDoc.class) {
    classData = await Class.findOne({ name: StudentDoc.class }).select('schedule name');
    console.log('📋 Found class by name:', { className: classData?.name });
  }

  // Fallback: find by student in students array (legacy support)
  if (!classData) {
    classData = await Class.findOne({ students: StudentDoc.userId }).select('schedule name');
    console.log('📋 Found class by students array:', { className: classData?.name });
  }

  if (!classData) {
    console.log('❌ Class not found for student:', { class: StudentDoc.class, classId: StudentDoc.classId });
    return sendSuccess(res, [], 200, 'No schedule found for this student');
  }

  console.log('✅ Schedule found for class:', classData.name);
  sendSuccess(res, classData?.schedule || [], 200, 'Student schedule retrieved');
}));

module.exports = router;
