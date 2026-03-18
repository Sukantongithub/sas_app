const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const User = require('../models/User');
const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Timetable = require('../models/Timetable');
const Class = require('../models/Class');
const Device = require('../models/Device');
const Department = require('../models/Department');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
};

// Encrypt device ID (admin-side assignment)
const encryptDeviceId = (deviceId, secretKey = process.env.DEVICE_ENCRYPTION_KEY || 'default-secret-key-change-in-production') => {
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(secretKey.slice(0, 16)), Buffer.alloc(16, 0));
  let encrypted = cipher.update(deviceId, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

// ==================== STAFF MANAGEMENT ====================

/**
 * @route   GET /api/admin/staff
 * @desc    Get all staff members
 * @access  Admin only
 */
router.get('/staff', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const staff = await Staff.find()
      .populate('userId', 'name email phone role isActive')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: staff.length,
      data: staff
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/admin/staff/:id
 * @desc    Get single staff member
 * @access  Admin only
 */
router.get('/staff/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id)
      .populate('userId', 'name email phone role isActive');
    
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }
    
    res.json({ success: true, data: staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/admin/staff
 * @desc    Create new staff member
 * @access  Admin only
 */
router.post('/staff',
  requireAuth,
  requireRoles('super_admin', 'admin'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('employeeId').notEmpty().withMessage('Employee ID is required'),
    body('designation').isIn(['admin', 'staff', 'security', 'maintenance', 'office_manager']).withMessage('Invalid designation'),
    body('department').notEmpty().withMessage('Department is required'),
    body('dateOfJoining').isISO8601().withMessage('Valid date is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { name, email, password, employeeId, designation, department, phone, address, salary, qualifications, dateOfJoining } = req.body;

      // Check if email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }

      // Check if employee ID already exists
      const existingStaff = await Staff.findOne({ employeeId });
      if (existingStaff) {
        return res.status(400).json({ success: false, message: 'Employee ID already exists' });
      }

      // Create user account for staff
      const user = new User({
        name,
        email,
        password,
        role: designation === 'admin' ? 'admin' : 'staff',
        phone,
        isActive: true
      });

      const savedUser = await user.save();

      // Create staff profile
      const staff = new Staff({
        userId: savedUser._id,
        employeeId,
        designation,
        department,
        phone,
        address,
        salary,
        qualifications,
        dateOfJoining: new Date(dateOfJoining),
        isActive: true
      });

      const savedStaff = await staff.save();

      // Populate user details in response
      await savedStaff.populate('userId', 'name email phone role isActive');

      res.status(201).json({
        success: true,
        message: 'Staff member created successfully',
        data: savedStaff
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * @route   PUT /api/admin/staff/:id
 * @desc    Update staff member
 * @access  Admin only
 */
router.put('/staff/:id',
  requireAuth,
  requireRoles('super_admin', 'admin'),
  async (req, res) => {
    try {
      const staff = await Staff.findById(req.params.id);
      if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff member not found' });
      }

      // Update staff fields
      if (req.body.designation) staff.designation = req.body.designation;
      if (req.body.department) staff.department = req.body.department;
      if (req.body.phone) staff.phone = req.body.phone;
      if (req.body.address) staff.address = req.body.address;
      if (req.body.salary !== undefined) staff.salary = req.body.salary;
      if (req.body.qualifications) staff.qualifications = req.body.qualifications;
      if (req.body.isActive !== undefined) staff.isActive = req.body.isActive;
      if (req.body.performanceRating !== undefined) staff.performanceRating = req.body.performanceRating;

      staff.updatedAt = new Date();
      const updatedStaff = await staff.save();

      // Update user record if needed
      if (req.body.name || req.body.email || req.body.phone) {
        const user = await User.findById(staff.userId);
        if (user) {
          if (req.body.name) user.name = req.body.name;
          if (req.body.email) user.email = req.body.email;
          if (req.body.phone) user.phone = req.body.phone;
          await user.save();
        }
      }

      await updatedStaff.populate('userId', 'name email phone role isActive');
      res.json({ success: true, message: 'Staff member updated successfully', data: updatedStaff });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * @route   DELETE /api/admin/staff/:id
 * @desc    Delete staff member (soft delete)
 * @access  Admin only
 */
router.delete('/staff/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    // Soft delete staff
    staff.isActive = false;
    await staff.save();

    // Deactivate user account
    await User.findByIdAndUpdate(staff.userId, { isActive: false });

    res.json({ success: true, message: 'Staff member deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== STUDENT MANAGEMENT ====================

/**
 * @route   GET /api/admin/students
 * @desc    Get all students with analytics
 * @access  Admin only
 */
router.get('/students', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    
    // Get attendance stats for each student
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const attendanceRecords = await Attendance.find({ studentId: student._id });
        const present = attendanceRecords.filter(r => r.status === 'present').length;
        const absent = attendanceRecords.filter(r => r.status === 'absent').length;
        const late = attendanceRecords.filter(r => r.status === 'late').length;
        const percentage = attendanceRecords.length > 0 
          ? parseFloat(((present / attendanceRecords.length) * 100).toFixed(2))
          : 0;

        return {
          ...student.toObject(),
          stats: {
            totalClasses: attendanceRecords.length,
            present,
            absent,
            late,
            attendancePercentage: percentage
          }
        };
      })
    );

    res.json({
      success: true,
      count: studentsWithStats.length,
      data: studentsWithStats
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/admin/students/:id
 * @desc    Get single student with detailed analytics
 * @access  Admin only
 */
router.get('/students/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const attendanceRecords = await Attendance.find({ studentId: student._id });
    const leaveRecords = await Leave.find({ userId: student._id });

    const present = attendanceRecords.filter(r => r.status === 'present').length;
    const absent = attendanceRecords.filter(r => r.status === 'absent').length;
    const late = attendanceRecords.filter(r => r.status === 'late').length;
    const percentage = attendanceRecords.length > 0 
      ? parseFloat(((present / attendanceRecords.length) * 100).toFixed(2))
      : 0;

    res.json({
      success: true,
      data: {
        ...student.toObject(),
        analytics: {
          attendance: {
            total: attendanceRecords.length,
            present,
            absent,
            late,
            percentage
          },
          leaves: {
            total: leaveRecords.length,
            approved: leaveRecords.filter(l => l.status === 'approved').length,
            pending: leaveRecords.filter(l => l.status === 'pending').length,
            rejected: leaveRecords.filter(l => l.status === 'rejected').length
          }
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/admin/students
 * @desc    Create new student
 * @access  Admin only
 */
router.post('/students',
  requireAuth,
  requireRoles('super_admin', 'admin'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('rollNumber').notEmpty().withMessage('Roll number is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('class').notEmpty().withMessage('Class is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { name, rollNumber, email, phone, class: studentClass } = req.body;

      const student = new Student({
        name,
        rollNumber,
        email,
        phone,
        class: studentClass
      });

      const newStudent = await student.save();
      res.status(201).json({
        success: true,
        message: 'Student created successfully',
        data: newStudent
      });
    } catch (error) {
      if (error.code === 11000) {
        res.status(400).json({ success: false, message: 'Roll number or email already exists' });
      } else {
        res.status(400).json({ success: false, message: error.message });
      }
    }
  }
);

/**
 * @route   PUT /api/admin/students/:id
 * @desc    Update student
 * @access  Admin only
 */
router.put('/students/:id',
  requireAuth,
  requireRoles('super_admin', 'admin'),
  async (req, res) => {
    try {
      const student = await Student.findById(req.params.id);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found' });
      }

      if (req.body.name) student.name = req.body.name;
      if (req.body.rollNumber) student.rollNumber = req.body.rollNumber;
      if (req.body.email) student.email = req.body.email;
      if (req.body.phone) student.phone = req.body.phone;
      if (req.body.class) student.class = req.body.class;

      const updatedStudent = await student.save();
      res.json({ success: true, message: 'Student updated successfully', data: updatedStudent });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * @route   DELETE /api/admin/students/:id
 * @desc    Delete student
 * @access  Admin only
 */
router.delete('/students/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Delete associated attendance records
    await Attendance.deleteMany({ studentId: student._id });

    res.json({ success: true, message: 'Student and records deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== DATA ANALYTICS ====================

/**
 * @route   GET /api/admin/analytics/dashboard
 * @desc    Get comprehensive dashboard analytics
 * @access  Admin only
 */
router.get('/analytics/dashboard', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    // Overall statistics
    const totalStudents = await Student.countDocuments();
    const totalStaff = await Staff.countDocuments({ isActive: true });
    const totalAttendanceRecords = await Attendance.countDocuments();
    const totalLeaveRequests = await Leave.countDocuments();

    // Attendance statistics
    const attendanceStats = await Attendance.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const attendanceSummary = {
      present: 0,
      absent: 0,
      late: 0
    };

    attendanceStats.forEach(stat => {
      if (stat._id === 'present') attendanceSummary.present = stat.count;
      if (stat._id === 'absent') attendanceSummary.absent = stat.count;
      if (stat._id === 'late') attendanceSummary.late = stat.count;
    });

    // Leave statistics
    const leaveStats = await Leave.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const leaveSummary = {
      approved: 0,
      pending: 0,
      rejected: 0
    };

    leaveStats.forEach(stat => {
      if (stat._id === 'approved') leaveSummary.approved = stat.count;
      if (stat._id === 'pending') leaveSummary.pending = stat.count;
      if (stat._id === 'rejected') leaveSummary.rejected = stat.count;
    });

    // Class-wise student distribution
    const classDistribution = await Student.aggregate([
      {
        $group: {
          _id: '$class',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Staff designation distribution
    const staffDistribution = await Staff.aggregate([
      {
        $group: {
          _id: '$designation',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalStudents,
          totalStaff,
          totalAttendanceRecords,
          totalLeaveRequests
        },
        attendance: attendanceSummary,
        leaves: leaveSummary,
        classDistribution,
        staffDistribution
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/admin/analytics/attendance
 * @desc    Get detailed attendance analytics
 * @access  Admin only
 */
router.get('/analytics/attendance', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const { startDate, endDate, class: studentClass } = req.query;

    let filter = {};
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const attendanceRecords = await Attendance.find(filter)
      .populate({
        path: 'studentId',
        select: 'name rollNumber class email',
        match: studentClass ? { class: studentClass } : {}
      })
      .sort({ date: -1 });

    // Filter out null studentId from populate
    const validRecords = attendanceRecords.filter(r => r.studentId);

    // Calculate statistics
    const statsByClass = {};
    const statsByStudent = {};

    validRecords.forEach(record => {
      const className = record.studentId.class;
      const studentId = record.studentId._id.toString();
      const studentName = record.studentId.name;

      // Class stats
      if (!statsByClass[className]) {
        statsByClass[className] = { present: 0, absent: 0, late: 0, total: 0 };
      }
      statsByClass[className][record.status]++;
      statsByClass[className].total++;

      // Student stats
      if (!statsByStudent[studentId]) {
        statsByStudent[studentId] = {
          name: studentName,
          rollNumber: record.studentId.rollNumber,
          present: 0,
          absent: 0,
          late: 0,
          total: 0
        };
      }
      statsByStudent[studentId][record.status]++;
      statsByStudent[studentId].total++;
    });

    // Calculate percentages
    const classStats = Object.entries(statsByClass).map(([className, stats]) => ({
      class: className,
      ...stats,
      percentage: parseFloat(((stats.present / stats.total) * 100).toFixed(2))
    }));

    const studentStats = Object.entries(statsByStudent).map(([_, stats]) => ({
      ...stats,
      percentage: parseFloat(((stats.present / stats.total) * 100).toFixed(2))
    }));

    res.json({
      success: true,
      data: {
        totalRecords: validRecords.length,
        byClass: classStats,
        byStudent: studentStats.sort((a, b) => b.percentage - a.percentage)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/admin/analytics/staff-performance
 * @desc    Get staff performance analytics
 * @access  Admin only
 */
router.get('/analytics/staff-performance', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const staffMembers = await Staff.find({ isActive: true })
      .populate('userId', 'name email lastLogin')
      .sort({ performanceRating: -1 });

    const performance = staffMembers.map(staff => ({
      _id: staff._id,
      name: staff.userId.name,
      employeeId: staff.employeeId,
      designation: staff.designation,
      department: staff.department,
      performanceRating: staff.performanceRating || 0,
      attendanceCount: staff.attendanceCount,
      leaveBalance: staff.leaveBalance,
      lastLogin: staff.userId.lastLogin,
      joiningDate: staff.dateOfJoining
    }));

    // Department-wise stats
    const departmentStats = {};
    staffMembers.forEach(staff => {
      if (!departmentStats[staff.department]) {
        departmentStats[staff.department] = {
          total: 0,
          avgRating: 0,
          ratings: []
        };
      }
      departmentStats[staff.department].total++;
      if (staff.performanceRating) {
        departmentStats[staff.department].ratings.push(staff.performanceRating);
      }
    });

    // Calculate average ratings
    Object.keys(departmentStats).forEach(dept => {
      const ratings = departmentStats[dept].ratings;
      departmentStats[dept].avgRating = ratings.length > 0
        ? parseFloat((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
        : 0;
      delete departmentStats[dept].ratings;
    });

    res.json({
      success: true,
      data: {
        staffPerformance: performance,
        departmentStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/admin/analytics/leave-analytics
 * @desc    Get leave request analytics
 * @access  Admin only
 */
router.get('/analytics/leave-analytics', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const leaveRecords = await Leave.find()
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 });

    // Leave type distribution
    const leaveTypeStats = {};
    const leaveStatusStats = {
      approved: 0,
      pending: 0,
      rejected: 0
    };

    leaveRecords.forEach(leave => {
      // Type stats
      if (!leaveTypeStats[leave.leaveType]) {
        leaveTypeStats[leave.leaveType] = 0;
      }
      leaveTypeStats[leave.leaveType]++;

      // Status stats
      if (leaveStatusStats[leave.status] !== undefined) {
        leaveStatusStats[leave.status]++;
      }
    });

    // Top leave takers
    const leaveByUser = {};
    leaveRecords.forEach(leave => {
      const userId = leave.userId._id.toString();
      if (!leaveByUser[userId]) {
        leaveByUser[userId] = {
          name: leave.userId.name,
          email: leave.userId.email,
          role: leave.userId.role,
          totalLeaves: 0,
          approvedLeaves: 0,
          pendingLeaves: 0
        };
      }
      leaveByUser[userId].totalLeaves++;
      if (leave.status === 'approved') leaveByUser[userId].approvedLeaves++;
      if (leave.status === 'pending') leaveByUser[userId].pendingLeaves++;
    });

    const topLeaveTakers = Object.values(leaveByUser)
      .sort((a, b) => b.totalLeaves - a.totalLeaves)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        leaveTypeDistribution: leaveTypeStats,
        leaveStatusSummary: leaveStatusStats,
        topLeaveTakers,
        totalLeaveRequests: leaveRecords.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/admin/analytics/export
 * @desc    Export analytics data as JSON
 * @access  Admin only
 */
router.get('/analytics/export', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const { type } = req.query; // students, staff, attendance, leaves, all

    const data = {};

    if (type === 'students' || type === 'all') {
      data.students = await Student.find().lean();
    }

    if (type === 'staff' || type === 'all') {
      data.staff = await Staff.find()
        .populate('userId', 'name email role')
        .lean();
    }

    if (type === 'attendance' || type === 'all') {
      data.attendance = await Attendance.find()
        .populate('studentId', 'name rollNumber')
        .lean();
    }

    if (type === 'leaves' || type === 'all') {
      data.leaves = await Leave.find()
        .populate('userId', 'name email')
        .lean();
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${type}-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== USER & ROLE MANAGEMENT ====================

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with filtering and pagination
 * @access  Admin only
 */
router.get('/users', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const { role, isActive, page = 1, limit = 50, search } = req.query;
    
    const query = { isDeleted: { $ne: true } };
    
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .populate('studentId', 'rollNumber class section')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const totalCount = await User.countDocuments(query);

    res.json({
      success: true,
      count: users.length,
      total: totalCount,
      page: Number(page),
      pages: Math.ceil(totalCount / Number(limit)),
      data: users
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get single user details
 * @access  Admin only
 */
router.get('/users/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('studentId', 'rollNumber class section parentContact');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get additional data based on role
    let additionalData = {};
    if (user.role === 'student' && user.studentId) {
      const attendance = await Attendance.find({ studentId: user.studentId });
      const leaves = await Leave.find({ userId: user._id });
      additionalData = { attendanceCount: attendance.length, leavesCount: leaves.length };
    } else if (user.role === 'staff' || user.role === 'admin') {
      const staffRecord = await Staff.findOne({ userId: user._id });
      if (staffRecord) additionalData = { staffDetails: staffRecord };
    }

    res.json({ success: true, data: { ...user.toObject(), ...additionalData } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   PUT /api/admin/users/:id/role
 * @desc    Update user role
 * @access  Super Admin only
 */
router.put('/users/:id/role',
  requireAuth,
  requireRoles('super_admin'),
  [
    body('role').isIn(['super_admin', 'admin', 'faculty', 'teacher', 'student', 'parent', 'staff', 'hr'])
      .withMessage('Invalid role')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { role } = req.body;
      
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      user.role = role;
      user.updatedAt = new Date();
      await user.save();

      res.json({
        success: true,
        message: `User role updated to ${role}`,
        data: user
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * @route   PUT /api/admin/users/:id/status
 * @desc    Activate/Deactivate user
 * @access  Admin only
 */
router.put('/users/:id/status', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const { isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isActive = isActive;
    user.updatedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: user
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user details
 * @access  Admin only
 */
router.put('/users/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name;
    if (email) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
      user.email = email;
    }
    if (phone) user.phone = phone;
    
    user.updatedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Soft delete user
 * @access  Super Admin only
 */
router.delete('/users/:id', requireAuth, requireRoles('super_admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isDeleted = true;
    user.isActive = false;
    user.updatedAt = new Date();
    await user.save();

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== DEPARTMENT MANAGEMENT ====================

/**
 * @route   GET /api/admin/departments
 * @desc    List departments
 * @access  Admin only
 */
router.get('/departments', requireAuth, requireRoles('super_admin', 'admin'), async (_req, res) => {
  try {
    const departments = await Department.find({}).sort({ name: 1 });
    res.json({ success: true, count: departments.length, data: departments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/admin/departments
 * @desc    Create department
 * @access  Admin only
 */
router.post('/departments',
  requireAuth,
  requireRoles('super_admin', 'admin'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('code').notEmpty().withMessage('Code is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { name, code, headOfDepartment, contactEmail, contactPhone, description } = req.body;

      const existing = await Department.findOne({ $or: [{ name }, { code: code.toUpperCase() }] });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Department name or code already exists' });
      }

      const department = await Department.create({
        name,
        code: code.toUpperCase(),
        headOfDepartment,
        contactEmail,
        contactPhone,
        description,
      });

      res.status(201).json({ success: true, message: 'Department created', data: department });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * @route   PUT /api/admin/departments/:id
 * @desc    Update department
 * @access  Admin only
 */
router.put('/departments/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });

    const { name, code, headOfDepartment, contactEmail, contactPhone, description, isActive } = req.body;

    if (name) dept.name = name;
    if (code) dept.code = code.toUpperCase();
    if (headOfDepartment !== undefined) dept.headOfDepartment = headOfDepartment;
    if (contactEmail !== undefined) dept.contactEmail = contactEmail;
    if (contactPhone !== undefined) dept.contactPhone = contactPhone;
    if (description !== undefined) dept.description = description;
    if (isActive !== undefined) dept.isActive = isActive;

    await dept.save();
    res.json({ success: true, message: 'Department updated', data: dept });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/admin/departments/:id
 * @desc    Delete department
 * @access  Admin only
 */
router.delete('/departments/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });

    await dept.deleteOne();
    res.json({ success: true, message: 'Department deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== CLASS MANAGEMENT ====================

/**
 * @route   POST /api/admin/classes
 * @desc    Create class
 * @access  Admin only
 */
router.post('/classes',
  requireAuth,
  requireRoles('super_admin', 'admin'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('code').notEmpty().withMessage('Code is required'),
    body('department').notEmpty().withMessage('Department is required'),
    body('semester').isInt({ min: 1 }).withMessage('Semester must be a positive integer'),
    body('academicYear').notEmpty().withMessage('Academic year is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const existing = await Class.findOne({ $or: [{ name: req.body.name }, { code: req.body.code.toUpperCase() }] });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Class name or code already exists' });
      }

      const klass = await Class.create({
        ...req.body,
        code: req.body.code.toUpperCase(),
      });

      res.status(201).json({ success: true, message: 'Class created', data: klass });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * @route   PUT /api/admin/classes/:id
 * @desc    Update class
 * @access  Admin only
 */
router.put('/classes/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const klass = await Class.findById(req.params.id);
    if (!klass) return res.status(404).json({ success: false, message: 'Class not found' });

    const fields = ['name', 'code', 'department', 'semester', 'academicYear', 'section', 'coordinator', 'beaconId', 'classroom', 'location', 'attendanceSettings'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'code') {
          klass.code = req.body.code.toUpperCase();
        } else {
          klass[field] = req.body[field];
        }
      }
    });

    await klass.save();
    res.json({ success: true, message: 'Class updated', data: klass });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/admin/classes/:id
 * @desc    Delete class
 * @access  Admin only
 */
router.delete('/classes/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const klass = await Class.findById(req.params.id);
    if (!klass) return res.status(404).json({ success: false, message: 'Class not found' });

    await klass.deleteOne();
    res.json({ success: true, message: 'Class deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   PUT /api/admin/classes/:id/attendance-settings
 * @desc    Update attendance rules for a class
 * @access  Admin only
 */
router.put('/classes/:id/attendance-settings',
  requireAuth,
  requireRoles('super_admin', 'admin'),
  [
    body('minimumRequiredPercentage').optional().isFloat({ min: 0, max: 100 }),
    body('autoMarkingEnabled').optional().isBoolean(),
    body('scanInterval').optional().isInt({ min: 1, max: 30 }),
    body('lateThresholdMinutes').optional().isInt({ min: 0, max: 180 }),
    body('rssiThreshold').optional().isInt({ min: -120, max: 0 }),
    body('maxDistance').optional().isInt({ min: 1, max: 100 }),
    body('motionVerificationRequired').optional().isBoolean(),
    body('motionConfidenceThreshold').optional().isFloat({ min: 0, max: 1 }),
    body('allowManualOverride').optional().isBoolean(),
    body('requireApprovalForManualChanges').optional().isBoolean(),
    body('manualOverrideRoles').optional().isArray(),
    body('manualOverrideApprovalRoles').optional().isArray(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const klass = await Class.findById(req.params.id);
      if (!klass) return res.status(404).json({ success: false, message: 'Class not found' });

      const settings = [
        'minimumRequiredPercentage',
        'autoMarkingEnabled',
        'scanInterval',
        'lateThresholdMinutes',
        'rssiThreshold',
        'maxDistance',
        'motionVerificationRequired',
        'motionConfidenceThreshold',
        'allowManualOverride',
        'requireApprovalForManualChanges',
        'manualOverrideRoles',
        'manualOverrideApprovalRoles',
      ];

      settings.forEach((key) => {
        if (req.body[key] !== undefined) {
          klass.attendanceSettings[key] = req.body[key];
        }
      });

      await klass.save();
      res.json({ success: true, message: 'Attendance settings updated', data: klass.attendanceSettings });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

// ==================== TIMETABLE & SHIFT MANAGEMENT ====================

/**
 * @route   GET /api/admin/timetables
 * @desc    Get all timetables
 * @access  Admin only
 */
router.get('/timetables', requireAuth, requireRoles('super_admin', 'admin', 'teacher'), async (req, res) => {
  try {
    const { classId, section, dayOfWeek, isActive } = req.query;
    
    const query = {};
    if (classId) query.classId = classId;
    if (section) query.section = section;
    if (dayOfWeek) query.dayOfWeek = dayOfWeek;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const timetables = await Timetable.find(query)
      .populate('classId', 'name semester')
      .populate('periods.teacherId', 'name email')
      .populate('createdBy', 'name')
      .sort({ classId: 1, dayOfWeek: 1 });

    res.json({
      success: true,
      count: timetables.length,
      data: timetables
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/admin/timetables/:id
 * @desc    Get single timetable
 * @access  Admin only
 */
router.get('/timetables/:id', requireAuth, requireRoles('super_admin', 'admin', 'teacher'), async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id)
      .populate('classId', 'name semester')
      .populate('periods.teacherId', 'name email')
      .populate('createdBy', 'name');

    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable not found' });
    }

    res.json({ success: true, data: timetable });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/admin/timetables
 * @desc    Create new timetable
 * @access  Admin only
 */
router.post('/timetables',
  requireAuth,
  requireRoles('super_admin', 'admin'),
  [
    body('classId').notEmpty().withMessage('Class ID is required'),
    body('dayOfWeek').isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
      .withMessage('Invalid day of week'),
    body('periods').isArray({ min: 1 }).withMessage('At least one period is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { classId, section, dayOfWeek, periods, effectiveFrom, effectiveTo } = req.body;

      console.log('Creating timetable:', { classId, section, dayOfWeek, periodsCount: periods.length });

      // Check if timetable already exists for this class, section, and day
      const existing = await Timetable.findOne({ 
        classId, 
        section: section || null, 
        dayOfWeek, 
        isActive: true 
      });
      
      if (existing) {
        console.log('Duplicate timetable found:', existing._id);
        return res.status(400).json({
          success: false,
          message: 'Active timetable already exists for this class, section, and day'
        });
      }

      const timetable = new Timetable({
        classId,
        section: section || null,
        dayOfWeek,
        periods,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        isActive: true,
        createdBy: req.userId
      });

      const savedTimetable = await timetable.save();
      await savedTimetable.populate('classId', 'name semester');
      await savedTimetable.populate('periods.teacherId', 'name email');

      console.log('Timetable created successfully:', savedTimetable._id);

      res.status(201).json({
        success: true,
        message: 'Timetable created successfully',
        data: savedTimetable
      });
    } catch (error) {
      console.error('Timetable creation error:', error);
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * @route   PUT /api/admin/timetables/:id
 * @desc    Update timetable
 * @access  Admin only
 */
router.put('/timetables/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable not found' });
    }

    const { section, periods, effectiveFrom, effectiveTo, isActive } = req.body;

    if (section !== undefined) timetable.section = section;
    if (periods) timetable.periods = periods;
    if (effectiveFrom) timetable.effectiveFrom = new Date(effectiveFrom);
    if (effectiveTo) timetable.effectiveTo = new Date(effectiveTo);
    if (isActive !== undefined) timetable.isActive = isActive;

    timetable.updatedAt = new Date();
    const updatedTimetable = await timetable.save();

    await updatedTimetable.populate('classId', 'name semester');
    await updatedTimetable.populate('periods.teacherId', 'name email');

    res.json({
      success: true,
      message: 'Timetable updated successfully',
      data: updatedTimetable
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/admin/timetables/:id
 * @desc    Delete timetable
 * @access  Admin only
 */
router.delete('/timetables/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable not found' });
    }

    await timetable.deleteOne();
    res.json({ success: true, message: 'Timetable deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/admin/classes
 * @desc    Get all classes
 * @access  Admin only
 */
router.get('/classes', requireAuth, requireRoles('super_admin', 'admin', 'teacher'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.semester) filter.semester = Number(req.query.semester);

    const classes = await Class.find(filter).sort({ name: 1 });
    res.json({ success: true, count: classes.length, data: classes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== DEVICE ASSIGNMENT (ADMIN) ====================

/**
 * @route   GET /api/admin/devices
 * @desc    List devices with user mapping
 * @access  Admin only
 */
router.get('/devices', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const devices = await Device.find()
      .populate('userId', 'name email role')
      .populate('pairedBy', 'name email');
    res.json({ success: true, count: devices.length, data: devices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/admin/devices/assign
 * @desc    Assign/map a device to a user (hardware ID)
 * @access  Admin only
 */
router.post('/devices/assign', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const { userId, deviceId, hardwareModel = 'nRF52840', imuModel = 'LSM6DSO', firmwareVersion = '1.0.0', txPower = -59 } = req.body;

    if (!userId || !deviceId) {
      return res.status(400).json({ success: false, message: 'userId and deviceId are required' });
    }

    const normalizedDeviceId = deviceId.toUpperCase().replace(/[:-]/g, '');

    // Ensure device not mapped to another user
    const existingDevice = await Device.findOne({ deviceId: normalizedDeviceId, isActive: true });
    if (existingDevice && existingDevice.userId.toString() !== userId) {
      return res.status(409).json({ success: false, message: 'Device already assigned to another user' });
    }

    // Ensure user not holding another active device
    const existingUserDevice = await Device.findOne({ userId, isActive: true });
    if (existingUserDevice && existingUserDevice.deviceId !== normalizedDeviceId) {
      return res.status(409).json({ success: false, message: 'User already has an active device. Unassign first.' });
    }

    const encryptionKey = crypto.randomBytes(16).toString('hex');
    const encryptedId = encryptDeviceId(normalizedDeviceId, encryptionKey);

    const device = await Device.findOneAndUpdate(
      { deviceId: normalizedDeviceId },
      {
        deviceId: normalizedDeviceId,
        encryptedId,
        encryptionKey,
        userId,
        hardwareModel,
        imuModel,
        firmwareVersion,
        txPower,
        isActive: true,
        isSuspended: false,
        isOnline: false,
        registeredAt: new Date(),
        lastSeen: new Date(),
        pairedBy: req.userId,
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(201).json({ success: true, message: 'Device assigned successfully', data: device });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   PUT /api/admin/devices/:id/unassign
 * @desc    Unassign/deactivate device
 * @access  Admin only
 */
router.put('/devices/:id/unassign', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });

    device.isActive = false;
    device.isOnline = false;
    await device.save();

    res.json({ success: true, message: 'Device unassigned', data: device });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== MANUAL ATTENDANCE APPROVAL WORKFLOW ====================

/**
 * @route   GET /api/admin/attendance/pending
 * @desc    List attendance records requiring approval
 * @access  Admin/Approvers
 */
router.get('/attendance/pending', requireAuth, requireRoles('super_admin', 'admin', 'teacher'), async (req, res) => {
  try {
    const filter = { approvalStatus: 'pending', requiresApproval: true };
    if (req.query.classId) filter.classId = req.query.classId;
    if (req.query.studentId) filter.studentId = req.query.studentId;

    const records = await Attendance.find(filter)
      .populate('studentId', 'name email')
      .populate('classId', 'name code department attendanceSettings')
      .populate('markedBy', 'name email role');

    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   PUT /api/admin/attendance/:id/approve
 * @desc    Approve a manual attendance change
 * @access  Admin/Approvers based on class settings
 */
router.put('/attendance/:id/approve', requireAuth, requireRoles('super_admin', 'admin', 'teacher'), async (req, res) => {
  try {
    const record = await Attendance.findById(req.params.id).populate('classId');
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });

    const klass = record.classId;
    const approvalRoles = (klass?.attendanceSettings?.manualOverrideApprovalRoles) || ['super_admin', 'admin'];
    if (!approvalRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to approve this attendance change' });
    }

    record.approvalStatus = 'approved';
    record.requiresApproval = false;
    record.approvedBy = req.user._id;
    record.approvedAt = new Date();
    record.rejectionReason = undefined;
    record.modificationHistory.push({
      modifiedBy: req.user._id,
      previousStatus: 'pending',
      newStatus: 'approved',
      reason: req.body.reason || 'Approved manual override'
    });

    await record.save();
    res.json({ success: true, message: 'Attendance approved', data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   PUT /api/admin/attendance/:id/reject
 * @desc    Reject a manual attendance change
 * @access  Admin/Approvers based on class settings
 */
router.put('/attendance/:id/reject', requireAuth, requireRoles('super_admin', 'admin', 'teacher'), async (req, res) => {
  try {
    const record = await Attendance.findById(req.params.id).populate('classId');
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });

    const klass = record.classId;
    const approvalRoles = (klass?.attendanceSettings?.manualOverrideApprovalRoles) || ['super_admin', 'admin'];
    if (!approvalRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to reject this attendance change' });
    }

    record.approvalStatus = 'rejected';
    record.requiresApproval = false;
    record.approvedBy = req.user._id;
    record.approvedAt = new Date();
    record.rejectionReason = req.body.reason || 'Rejected manual override';
    record.modificationHistory.push({
      modifiedBy: req.user._id,
      previousStatus: 'pending',
      newStatus: 'rejected',
      reason: record.rejectionReason
    });

    await record.save();
    res.json({ success: true, message: 'Attendance rejected', data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
