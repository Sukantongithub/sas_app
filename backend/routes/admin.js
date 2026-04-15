const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const multer = require('multer');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Parent = require('../models/Parent');
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

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('Missing required environment variable: JWT_SECRET');
}

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ];

    const isAllowedMime = allowedMimeTypes.includes(file.mimetype);
    const hasAllowedExtension = /\.(xlsx|xls|csv)$/i.test(file.originalname || '');

    if (isAllowedMime || hasAllowedExtension) {
      return cb(null, true);
    }

    return cb(new Error('Only .xlsx, .xls, or .csv files are allowed'));
  }
});

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
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const staffFilter = includeInactive ? {} : { isActive: true };

    const staff = await Staff.find(staffFilter)
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
    body('designation').isIn(['admin', 'hod', 'staff', 'security', 'maintenance', 'office_manager']).withMessage('Invalid designation'),
    body('department').notEmpty().withMessage('Department is required'),
    body('dateOfJoining').isISO8601().withMessage('Valid date is required'),
    body('classIds').isArray({ min: 1 }).withMessage('At least one classId is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { name, email, password, employeeId, designation, department, phone, address, salary, qualifications, dateOfJoining, classIds } = req.body;
      const normalizedClassIds = [...new Set((classIds || []).map(String))];

      // Validate classIds is provided and is an array with at least one element
      if (!Array.isArray(classIds) || classIds.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'classIds is required and must be an array with at least one element' 
        });
      }

      // Validate all provided classes exist
      const classCount = await Class.countDocuments({ _id: { $in: normalizedClassIds } });
      if (classCount !== normalizedClassIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more classIds are invalid'
        });
      }

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
        assignedClassIds: normalizedClassIds,
        phone,
        address,
        salary,
        qualifications,
        dateOfJoining: new Date(dateOfJoining),
        isActive: true
      });

      const savedStaff = await staff.save();

      // Assign staff to selected classes (add to faculty array)
      if (normalizedClassIds.length > 0) {
        await Class.updateMany(
          { _id: { $in: normalizedClassIds } },
          { $addToSet: { faculty: savedUser._id } }
        );
      }

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
 * @route   POST /api/admin/staff/import
 * @desc    Bulk import staff from Excel/CSV
 * @access  Admin only
 * Excel columns: Name, Email, Employee ID, Designation, Department
 * Default password = Employee ID
 */
router.post('/staff/import',
  requireAuth,
  requireRoles('super_admin', 'admin'),
  (req, res, next) => {
    excelUpload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || 'File upload error' });
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Please upload an Excel/CSV file' });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return res.status(400).json({ success: false, message: 'The uploaded file has no sheets' });
      }

      const sheet = workbook.Sheets[firstSheetName];

      // Parse all rows — keys are the first row (headers) automatically
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows.length) {
        return res.status(400).json({ success: false, message: 'No data rows found in the file. Make sure the first row is the header.' });
      }

      // Normalise helper: strips spaces/case so "Employee ID" → "employeeid"
      const normalizeHeader = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const validDesignations = ['admin', 'hod', 'staff', 'security', 'maintenance', 'office_manager'];

      const getVal = (normalizedRow, key) => String(normalizedRow[key] || '').trim();

      const parsedRows = rows.map((rawRow, index) => {
        const normalizedRow = Object.entries(rawRow).reduce((acc, [k, v]) => {
          acc[normalizeHeader(k)] = v;
          return acc;
        }, {});
        return {
          rowNumber: index + 2,
          name: getVal(normalizedRow, 'name'),
          email: getVal(normalizedRow, 'email').toLowerCase(),
          employeeId: getVal(normalizedRow, 'employeeid'),
          designation: getVal(normalizedRow, 'designation').toLowerCase().replace(/\s+/g, '_'),
          department: getVal(normalizedRow, 'department'),
          phone: getVal(normalizedRow, 'phone') || '',
        };
      });

      const skipped = [];
      const seenEmployeeIds = new Set();
      const candidates = [];

      for (const row of parsedRows) {
        if (!row.name || !row.email || !row.employeeId || !row.designation || !row.department) {
          skipped.push({ row: row.rowNumber, reason: 'Missing required values: Name, Email, Employee ID, Designation, Department' });
          continue;
        }
        if (!validDesignations.includes(row.designation)) {
          skipped.push({ row: row.rowNumber, reason: `Invalid designation "${row.designation}". Must be one of: ${validDesignations.join(', ')}` });
          continue;
        }
        if (seenEmployeeIds.has(row.employeeId.toLowerCase())) {
          skipped.push({ row: row.rowNumber, reason: `Duplicate Employee ID in file: ${row.employeeId}` });
          continue;
        }
        seenEmployeeIds.add(row.employeeId.toLowerCase());
        candidates.push(row);
      }

      // Check existing records
      const existingEmails = new Set(
        (await User.find({ email: { $in: candidates.map(c => c.email) } }).select('email -_id'))
          .map(u => u.email.toLowerCase())
      );
      const existingEmpIds = new Set(
        (await Staff.find({ employeeId: { $in: candidates.map(c => c.employeeId) } }).select('employeeId -_id'))
          .map(s => s.employeeId.toLowerCase())
      );

      const staffToCreate = [];
      for (const row of candidates) {
        if (existingEmails.has(row.email)) {
          skipped.push({ row: row.rowNumber, reason: `Email already registered: ${row.email}` });
          continue;
        }
        if (existingEmpIds.has(row.employeeId.toLowerCase())) {
          skipped.push({ row: row.rowNumber, reason: `Employee ID already exists: ${row.employeeId}` });
          continue;
        }
        staffToCreate.push(row);
      }

      let createdCount = 0;
      const rowErrors = [];

      for (const row of staffToCreate) {
        try {
          const user = new User({
            name: row.name,
            email: row.email,
            password: row.employeeId, // default password = employee ID
            role: row.designation === 'admin' ? 'admin' : 'staff',
            phone: row.phone || undefined,
            isActive: true
          });
          await user.save();

          const staff = new Staff({
            userId: user._id,
            employeeId: row.employeeId,
            designation: row.designation,
            department: row.department,
            phone: row.phone || undefined,
            dateOfJoining: new Date(),
            isActive: true
          });
          await staff.save();
          createdCount++;
        } catch (rowErr) {
          console.error(`Import row ${row.rowNumber} failed:`, rowErr.message);
          rowErrors.push({ row: row.rowNumber, reason: rowErr.message });
        }
      }

      const allSkipped = [...skipped, ...rowErrors];
      res.status(201).json({
        success: true,
        message: `Imported ${createdCount} staff member(s). Default password is their Employee ID.`,
        data: {
          totalRows: rows.length,
          created: createdCount,
          skipped: allSkipped.length,
          skippedRows: allSkipped.slice(0, 50)
        }
      });
    } catch (error) {
      console.error('Staff import error:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to import staff' });
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

      // Sync staff <-> class mapping if classIds provided
      if (req.body.classIds !== undefined) {
        if (!Array.isArray(req.body.classIds) || req.body.classIds.length === 0) {
          return res.status(400).json({ success: false, message: 'classIds must be a non-empty array' });
        }

        const nextClassIds = [...new Set(req.body.classIds.map(String))];
        const nextClassCount = await Class.countDocuments({ _id: { $in: nextClassIds } });
        if (nextClassCount !== nextClassIds.length) {
          return res.status(400).json({ success: false, message: 'One or more classIds are invalid' });
        }

        const previousClassIds = (staff.assignedClassIds || []).map(id => id.toString());
        const removedClassIds = previousClassIds.filter(id => !nextClassIds.includes(id));
        const addedClassIds = nextClassIds.filter(id => !previousClassIds.includes(id));

        if (removedClassIds.length > 0) {
          await Class.updateMany(
            { _id: { $in: removedClassIds } },
            { $pull: { faculty: staff.userId } }
          );
        }

        if (addedClassIds.length > 0) {
          await Class.updateMany(
            { _id: { $in: addedClassIds } },
            { $addToSet: { faculty: staff.userId } }
          );
        }

        staff.assignedClassIds = nextClassIds;
      }

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
    const { id } = req.params;
    let staff = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      staff = await Staff.findById(id);
      if (!staff) {
        staff = await Staff.findOne({ userId: id });
      }
    }

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    // Remove staff user from faculty list in assigned classes
    if (Array.isArray(staff.assignedClassIds) && staff.assignedClassIds.length > 0) {
      await Class.updateMany(
        { _id: { $in: staff.assignedClassIds } },
        { $pull: { faculty: staff.userId } }
      );
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

/**
 * @route   POST /api/admin/staff/:id/delete
 * @desc    Delete staff member (fallback for clients that cannot send DELETE)
 * @access  Admin only
 */
router.post('/staff/:id/delete', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    let staff = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      staff = await Staff.findById(id);
      if (!staff) {
        staff = await Staff.findOne({ userId: id });
      }
    }

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    if (Array.isArray(staff.assignedClassIds) && staff.assignedClassIds.length > 0) {
      await Class.updateMany(
        { _id: { $in: staff.assignedClassIds } },
        { $pull: { faculty: staff.userId } }
      );
    }

    staff.isActive = false;
    await staff.save();
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
 * Helper function to generate unique parent ID
 * Format: PAR-YYYY-XXXX
 */
const generateParentId = async () => {
  const year = new Date().getFullYear();
  const count = await Parent.countDocuments();
  return `PAR-${year}-${String(count + 1).padStart(4, '0')}`;
};

/**
 * @route   POST /api/admin/students
 * @desc    Create new student with parent account
 * @access  Admin only
 */
router.post('/students',
  requireAuth,
  requireRoles('super_admin', 'admin'),
  [
    body('name').notEmpty().withMessage('Student name is required'),
    body('rollNumber').notEmpty().withMessage('Roll number is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('class').notEmpty().withMessage('Class is required'),
    body('parentName').notEmpty().withMessage('Parent name is required'),
    body('parentPhone').notEmpty().withMessage('Parent phone is required'),
    body('parentEmail').optional({ checkFalsy: true }).isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { name, rollNumber, email, phone, class: studentClass, parentName, parentPhone, parentEmail, parentRelation } = req.body;

      const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
      const looksLikePhone = (value) => /^\+?[0-9 ()-]{7,20}$/.test(String(value || '').trim());

      let normalizedParentPhone = parentPhone ? String(parentPhone).trim() : '';
      let normalizedParentEmail = parentEmail ? String(parentEmail).toLowerCase().trim() : '';

      // Auto-correct common UI/input mistake: phone and email entered in opposite fields.
      if (looksLikeEmail(normalizedParentPhone) && looksLikePhone(normalizedParentEmail)) {
        const temp = normalizedParentPhone;
        normalizedParentPhone = normalizedParentEmail;
        normalizedParentEmail = temp;
      }

      if (!normalizedParentPhone) {
        return res.status(400).json({
          success: false,
          message: 'Parent phone is required'
        });
      }

      if (!looksLikePhone(normalizedParentPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Parent phone number format is invalid'
        });
      }

      if (normalizedParentEmail && !looksLikeEmail(normalizedParentEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Parent email format is invalid'
        });
      }

      // Validate class and resolve classId before creating student
      const resolvedClass = await Class.findOne({ name: studentClass });
      if (!resolvedClass) {
        return res.status(404).json({ success: false, message: `Class not found: ${studentClass}` });
      }

      // ============ Create Student ============
      const student = new Student({
        name,
        rollNumber,
        email,
        phone,
        class: studentClass,
        classId: resolvedClass._id,
        parentIds: [] // Will be populated after parent is created
      });

      const newStudent = await student.save();

      // Always link student to class mapping
      await Class.findByIdAndUpdate(
        resolvedClass._id,
        { $addToSet: { students: newStudent._id } }
      );

      // ============ Create Student User Account ============
      let studentUser = null;
      try {
        const studentUserEmail = email || `${rollNumber}@school.local`;
        const studentDefaultPassword = rollNumber; // Default password = roll number

        studentUser = new User({
          name,
          email: studentUserEmail,
          password: studentDefaultPassword, // Will be hashed by pre-save hook
          role: 'student',
          studentId: newStudent._id, // Link to Student document
          isActive: true
        });

        studentUser = await studentUser.save();

        // Update Student with User linkage
        newStudent.userId = studentUser._id;
        await newStudent.save();

      } catch (studentUserError) {
        console.error('Error creating student user account:', studentUserError.message);
        // Continue anyway - student document is created even if user creation fails
      }

      // ============ Create Parent Account ============
      try {
        const fallbackParentEmail = `parent_${rollNumber}@school.local`;

        let savedParentUser = null;
        let savedParent = null;
        let linkedExistingParent = false;
        let defaultPassword = null;

        // Prefer matching by email; then fallback to phone via Parent profile lookup.
        if (normalizedParentEmail) {
          savedParentUser = await User.findOne({ email: normalizedParentEmail, role: 'parent' });
        }

        if (!savedParentUser && normalizedParentPhone) {
          const parentByPhone = await Parent.findOne({ mobileNumber: normalizedParentPhone }).populate('userId');
          if (parentByPhone?.userId && parentByPhone.userId.role === 'parent') {
            savedParentUser = parentByPhone.userId;
            savedParent = parentByPhone;
          }
        }

        if (savedParentUser) {
          linkedExistingParent = true;
          if (!savedParent) {
            savedParent = await Parent.findOne({ userId: savedParentUser._id });
          }

          // Backfill missing Parent document if user exists without profile.
          if (!savedParent) {
            const parentId = await generateParentId();
            savedParent = await Parent.create({
              userId: savedParentUser._id,
              name: parentName || savedParentUser.name,
              parentId,
              mobileNumber: normalizedParentPhone || savedParentUser.phone || 'N/A',
              email: normalizedParentEmail || savedParentUser.email,
              studentIds: [],
              relation: parentRelation || 'guardian',
              isActive: true
            });
          }

          // Keep parent profile contact fields fresh when possible.
          await Parent.findByIdAndUpdate(savedParent._id, {
            $set: {
              name: parentName || savedParent.name,
              mobileNumber: normalizedParentPhone || savedParent.mobileNumber,
              email: normalizedParentEmail || savedParent.email,
              relation: parentRelation || savedParent.relation || 'guardian'
            },
            $addToSet: { studentIds: newStudent._id }
          });
        } else {
          // Generate default password for parent (parentPhone + studentRollNumber)
          defaultPassword = `${normalizedParentPhone}${rollNumber}`;

          // Create User account for parent
          const parentUser = new User({
            name: parentName,
            email: normalizedParentEmail || fallbackParentEmail,
            password: defaultPassword, // Will be hashed by pre-save hook
            role: 'parent',
            phone: normalizedParentPhone,
            isActive: true
          });

          savedParentUser = await parentUser.save();

          // Generate unique parent ID
          const parentId = await generateParentId();

          // Create Parent document
          const parentDoc = new Parent({
            userId: savedParentUser._id,
            name: parentName,
            parentId: parentId,
            mobileNumber: normalizedParentPhone,
            email: normalizedParentEmail || fallbackParentEmail,
            studentIds: [newStudent._id],
            relation: parentRelation || 'guardian',
            isActive: true
          });

          savedParent = await parentDoc.save();
        }

        // ============ Link Parent to Student ============
        console.log('🔗 Linking parent to student');
        console.log('  Student ID:', newStudent._id);
        console.log('  Parent User ID:', savedParentUser._id);
        console.log('  Parent Doc ID:', savedParent._id);
        
        // Ensure the Student document is fresh from DB before updating
        await Student.findByIdAndUpdate(newStudent._id, {
          $addToSet: { parentIds: savedParentUser._id }
        });
        const updatedStudent = await Student.findById(newStudent._id);
        
        console.log('✅ Student parentIds after update:', updatedStudent.parentIds);
        console.log('✅ Parent studentIds after create:', savedParent.studentIds);

        // Update User with parentId reference
        savedParentUser.parentId = savedParent._id;
        await savedParentUser.save();

        res.status(201).json({
          success: true,
          message: linkedExistingParent
            ? 'Student created and linked to existing parent account successfully'
            : 'Student and parent account created successfully',
          data: {
            student: {
              id: newStudent._id,
              name: newStudent.name,
              rollNumber: newStudent.rollNumber,
              email: newStudent.email,
              class: newStudent.class,
              accountCreated: studentUser ? true : false,
              loginCredentials: studentUser ? {
                email: studentUser.email,
                defaultPassword: rollNumber,
                note: 'Default password is the roll number. Please ask student to change it on first login.'
              } : null
            },
            parent: {
              id: savedParent._id,
              name: savedParent.name,
              phone: savedParent.mobileNumber,
              email: savedParent.email,
              accountCreated: !linkedExistingParent,
              linkedExistingParent,
              defaultPassword: linkedExistingParent ? null : defaultPassword,
              note: linkedExistingParent
                ? 'Linked student to the existing parent account'
                : 'Please share this default password with parent and ask them to change it on first login'
            }
          }
        });
      } catch (parentError) {
        // If parent creation fails, delete the student
        await Student.findByIdAndDelete(newStudent._id);
        return res.status(400).json({ 
          success: false, 
          message: `Failed to create parent account: ${parentError.message}` 
        });
      }
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
 * @route   POST /api/admin/students/import
 * @desc    Bulk import students from Excel/CSV
 * @access  Admin only
 */
router.post('/students/import',
  requireAuth,
  requireRoles('super_admin', 'admin'),
  (req, res, next) => {
    // Wrap multer so its errors are caught and returned as JSON
    excelUpload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message || 'File upload error' });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Please upload an Excel/CSV file' });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        return res.status(400).json({ success: false, message: 'The uploaded file has no sheets' });
      }

      const sheet = workbook.Sheets[firstSheetName];
      const headerRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (!headerRows.length) {
        return res.status(400).json({ success: false, message: 'The uploaded file is empty' });
      }

      const normalizeHeader = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const actualHeaders = (headerRows[0] || []).map(normalizeHeader).filter(Boolean);
      const expectedHeaders = ['fullname', 'rollnumber', 'email', 'class'];
      const hasExactFormat =
        actualHeaders.length === expectedHeaders.length
        && expectedHeaders.every((header, index) => actualHeaders[index] === header);

      if (!hasExactFormat) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file format. Header must be exactly: Full Name, Roll Number, Email, Class'
        });
      }

      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!rows.length) {
        return res.status(400).json({ success: false, message: 'No student rows found in the file' });
      }

      const getValueFromRow = (normalizedRow, key) => {
        if (normalizedRow[key]) {
          return String(normalizedRow[key]).trim();
        }
        return '';
      };

      const parsedRows = rows.map((rawRow, index) => {
        const normalizedRow = Object.entries(rawRow).reduce((acc, [key, value]) => {
          const normalizedKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
          acc[normalizedKey] = value;
          return acc;
        }, {});

        const name = getValueFromRow(normalizedRow, 'fullname');
        const rollNumber = getValueFromRow(normalizedRow, 'rollnumber');
        const email = getValueFromRow(normalizedRow, 'email');
        const studentClass = getValueFromRow(normalizedRow, 'class');

        return {
          rowNumber: index + 2,
          name,
          rollNumber,
          class: studentClass,
          email
        };
      });

      const skipped = [];
      const seenRollNumbers = new Set();
      const candidates = [];

      for (const row of parsedRows) {
        if (!row.name || !row.rollNumber || !row.email || !row.class) {
          skipped.push({ row: row.rowNumber, reason: 'Missing required values: Full Name, Roll Number, Email, or Class' });
          continue;
        }

        const normalizedRoll = row.rollNumber.toLowerCase();
        if (seenRollNumbers.has(normalizedRoll)) {
          skipped.push({ row: row.rowNumber, reason: `Duplicate roll number in file: ${row.rollNumber}` });
          continue;
        }

        seenRollNumbers.add(normalizedRoll);
        candidates.push(row);
      }

      // Check existing roll numbers in Student collection
      const existingRolls = new Set(
        (await Student.find({ rollNumber: { $in: candidates.map(c => c.rollNumber) } }).select('rollNumber -_id'))
          .map(s => s.rollNumber.toLowerCase())
      );

      // Check existing emails in User collection (so login account duplication is avoided)
      const existingEmails = new Set(
        (await User.find({ email: { $in: candidates.map(c => c.email.toLowerCase()) } }).select('email -_id'))
          .map(u => u.email.toLowerCase())
      );

      const studentsToCreate = [];
      for (const row of candidates) {
        if (existingRolls.has(row.rollNumber.toLowerCase())) {
          skipped.push({ row: row.rowNumber, reason: `Roll number already exists: ${row.rollNumber}` });
          continue;
        }
        if (existingEmails.has(row.email.toLowerCase())) {
          skipped.push({ row: row.rowNumber, reason: `Email already registered: ${row.email}` });
          continue;
        }
        studentsToCreate.push(row);
      }

      let createdCount = 0;
      const rowErrors = [];

      for (const row of studentsToCreate) {
        try {
          const classDoc = await Class.findOne({ name: row.class });
          if (!classDoc) {
            rowErrors.push({ row: row.rowNumber, reason: `Class not found: ${row.class}` });
            continue;
          }

          // Save Student profile first to get its _id
          const student = new Student({
            name: row.name,
            rollNumber: row.rollNumber,
            email: row.email.toLowerCase(),
            class: row.class,
            classId: classDoc._id
          });
          await student.save();

          // Create User login account linked to Student.
          // Default password = roll number (student should change on first login).
          const user = new User({
            name: row.name,
            email: row.email.toLowerCase(),
            password: row.rollNumber,
            role: 'student',
            studentId: student._id,
            isActive: true
          });
          await user.save();

          // Link student profile and class mapping
          student.userId = user._id;
          await student.save();
          await Class.findByIdAndUpdate(classDoc._id, { $addToSet: { students: student._id } });

          createdCount++;
        } catch (rowErr) {
          console.error(`Import row ${row.rowNumber} failed:`, rowErr.message);
          rowErrors.push({ row: row.rowNumber, reason: rowErr.message });
        }
      }

      const allSkipped = [...skipped, ...rowErrors];

      res.status(201).json({
        success: true,
        message: `Imported ${createdCount} student(s). Default password is their roll number.`,
        data: {
          totalRows: rows.length,
          created: createdCount,
          skipped: allSkipped.length,
          skippedRows: allSkipped.slice(0, 50)
        }
      });
    } catch (error) {
      console.error('Student import error:', error);
      res.status(400).json({ success: false, message: error.message || 'Failed to import students' });
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

      const oldClassId = student.classId ? student.classId.toString() : null;

      if (req.body.name) student.name = req.body.name;
      if (req.body.rollNumber) student.rollNumber = req.body.rollNumber;
      if (req.body.email) student.email = req.body.email;
      if (req.body.phone) student.phone = req.body.phone;

      if (req.body.class || req.body.classId) {
        let nextClass = null;

        if (req.body.classId) {
          nextClass = await Class.findById(req.body.classId);
        } else if (req.body.class) {
          nextClass = await Class.findOne({ name: req.body.class });
        }

        if (!nextClass) {
          return res.status(404).json({ success: false, message: 'Target class not found' });
        }

        const nextClassId = nextClass._id.toString();
        student.class = nextClass.name;
        student.classId = nextClass._id;

        if (oldClassId && oldClassId !== nextClassId) {
          await Class.findByIdAndUpdate(oldClassId, { $pull: { students: student._id } });
        }

        if (oldClassId !== nextClassId) {
          await Class.findByIdAndUpdate(nextClass._id, { $addToSet: { students: student._id } });
        }
      }

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
    const { id } = req.params;
    let student = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      student = await Student.findById(id);
      if (!student) {
        student = await Student.findOne({ userId: id });
      }
    }

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await Student.findByIdAndDelete(student._id);

    // Remove student from class mapping
    if (student.classId) {
      await Class.findByIdAndUpdate(student.classId, { $pull: { students: student._id } });
    }

    // Delete associated attendance records
    await Attendance.deleteMany({ studentId: student._id });

    // Delete linked User account (matched by studentId reference or email)
    await User.findOneAndDelete({
      $or: [
        { studentId: student._id },
        { email: student.email }
      ]
    });

    res.json({ success: true, message: 'Student and records deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/admin/students/:id/delete
 * @desc    Delete student (fallback for clients that cannot send DELETE)
 * @access  Admin only
 */
router.post('/students/:id/delete', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    let student = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      student = await Student.findById(id);
      if (!student) {
        student = await Student.findOne({ userId: id });
      }
    }

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await Student.findByIdAndDelete(student._id);

    if (student.classId) {
      await Class.findByIdAndUpdate(student.classId, { $pull: { students: student._id } });
    }

    await Attendance.deleteMany({ studentId: student._id });
    await User.findOneAndDelete({
      $or: [
        { studentId: student._id },
        { email: student.email }
      ]
    });

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
    body('role').isIn(['super_admin', 'admin', 'hod', 'staff', 'student', 'parent'])
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
 * @route   GET /api/admin/classes
 * @desc    Get all classes with optional filtering
 * @access  Admin, Teacher
 */
router.get('/classes', requireAuth, requireRoles('super_admin', 'admin', 'teacher'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const classes = await Class.find(filter)
      .populate('coordinator', 'name email')
      .populate('faculty', 'name email role')
      .sort({ name: 1 });
    
    res.json({ success: true, count: classes.length, data: classes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/admin/classes/:id
 * @desc    Get single class by ID
 * @access  Admin, Teacher
 */
router.get('/classes/:id', requireAuth, requireRoles('super_admin', 'admin', 'teacher'), async (req, res) => {
  try {
    const klass = await Class.findById(req.params.id)
      .populate('coordinator', 'name email')
      .populate('faculty', 'name email role')
      .populate('students', 'name email rollNumber');
    
    if (!klass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    
    res.json({ success: true, data: klass });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/admin/classes
 * @desc    Create a new class
 * @access  Admin only
 */
router.post('/classes',
  requireAuth,
  requireRoles('super_admin', 'admin'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('code').notEmpty().withMessage('Code is required'),
    body('department').notEmpty().withMessage('Department is required'),
    body('semester').isInt({ min: 1, max: 12 }).withMessage('Semester must be between 1 and 12'),
    body('academicYear').notEmpty().withMessage('Academic year is required'),
    body('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { name, code, department, semester, academicYear, section, classroom, coordinator, startDate, endDate } = req.body;
      
      // Check for duplicates
      const existing = await Class.findOne({ $or: [{ name }, { code: code.toUpperCase() }] });
      if (existing) {
        return res.status(400).json({ success: false, message: 'A class with this name or code already exists' });
      }

      const klass = await Class.create({
        name,
        code: code.toUpperCase(),
        department,
        semester: Number(semester),
        academicYear,
        section,
        classroom,
        coordinator,
        startDate: startDate || new Date(),
        endDate,
        isActive: true
      });

      res.status(201).json({ success: true, message: 'Class created successfully', data: klass });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ success: false, message: 'Class name or code already exists' });
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * @route   PUT /api/admin/classes/:id
 * @desc    Update a class
 * @access  Admin only
 */
router.put('/classes/:id', 
  requireAuth, 
  requireRoles('super_admin', 'admin'),
  [
    body('code').optional().custom(value => {
      if (value && !/^[A-Za-z0-9\-]+$/.test(value)) {
        throw new Error('Code must be alphanumeric');
      }
      return true;
    }),
    body('semester').optional().isInt({ min: 1, max: 12 }),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const klass = await Class.findById(req.params.id);
      if (!klass) {
        return res.status(404).json({ success: false, message: 'Class not found' });
      }

      // List of updatable fields
      const updatableFields = [
        'name', 'code', 'department', 'semester', 'academicYear', 
        'section', 'coordinator', 'beaconId', 'classroom', 'location', 
        'isActive', 'startDate', 'endDate'
      ];

      updatableFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          if (field === 'code') {
            klass[field] = req.body[field].toUpperCase();
          } else {
            klass[field] = req.body[field];
          }
        }
      });

      await klass.save();
      res.json({ success: true, message: 'Class updated successfully', data: klass });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ success: false, message: 'Class name or code already exists' });
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * @route   DELETE /api/admin/classes/:id
 * @desc    Delete/deactivate a class
 * @access  Admin only
 */
router.delete('/classes/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const klass = await Class.findById(req.params.id);
    if (!klass) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // Soft delete - deactivate instead of hard delete
    klass.isActive = false;
    await klass.save();
    
    res.json({ success: true, message: 'Class deactivated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   PUT /api/admin/classes/:id/attendance-settings
 * @desc    Update attendance rules/settings for a class
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
      if (!klass) {
        return res.status(404).json({ success: false, message: 'Class not found' });
      }

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
      res.json({ success: true, message: 'Attendance settings updated successfully', data: klass.attendanceSettings });
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
    body('periods').isArray({ min: 1 }).withMessage('At least one period is required'),
    body('periods.*.subject').trim().notEmpty().withMessage('Period subject is required'),
    body('periods.*.startTime').matches(/^\d{2}:\d{2}$/).withMessage('Invalid start time format'),
    body('periods.*.endTime').matches(/^\d{2}:\d{2}$/).withMessage('Invalid end time format'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { classId, section, dayOfWeek, periods, effectiveFrom, effectiveTo } = req.body;

      console.log('[CREATE_TIMETABLE] Request:', { classId, section, dayOfWeek, periodsCount: periods?.length });

      // Additional validation: validate period integrity
      for (let i = 0; i < periods.length; i++) {
        const p = periods[i];
        
        // Validate subject is not date-like (prevent corruption)
        if (/^\d{4}-\d{2}-\d{2}$/.test(p.subject)) {
          console.error('[CREATE_TIMETABLE] Period subject looks like a date:', p.subject);
          return res.status(400).json({
            success: false,
            message: `Period ${i + 1}: Subject cannot be a date format. Please enter a valid subject name.`
          });
        }

        // Validate time range
        const [startH, startM] = p.startTime.split(':').map(Number);
        const [endH, endM] = p.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (startMinutes >= endMinutes) {
          return res.status(400).json({
            success: false,
            message: `Period ${i + 1}: Start time must be before end time`
          });
        }

        // Validate period number sequence
        if (p.periodNumber !== i + 1) {
          return res.status(400).json({
            success: false,
            message: `Period numbers must be sequential (1, 2, 3, ...)`
          });
        }
      }

      // Check if timetable already exists for this class, section, and day
      const existing = await Timetable.findOne({ 
        classId, 
        section: section || null, 
        dayOfWeek, 
        isActive: true 
      });
      
      if (existing) {
        console.log('[CREATE_TIMETABLE] Duplicate found:', existing._id);
        return res.status(400).json({
          success: false,
          message: 'Active timetable already exists for this class, section, and day'
        });
      }

      const timetable = new Timetable({
        classId,
        section: section?.trim() || null,
        dayOfWeek,
        periods: periods.map(p => ({
          periodNumber: p.periodNumber,
          subject: p.subject?.trim() || '',
          teacherId: p.teacherId || null,
          startTime: p.startTime,
          endTime: p.endTime,
          room: p.room?.trim() || null,
          isLab: Boolean(p.isLab) || false
        })),
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        isActive: true,
        createdBy: req.userId
      });

      const savedTimetable = await timetable.save();
      await savedTimetable.populate('classId', 'name semester');
      await savedTimetable.populate('periods.teacherId', 'name email');

      console.log('[CREATE_TIMETABLE] Success:', savedTimetable._id);

      res.status(201).json({
        success: true,
        message: 'Timetable created successfully',
        data: savedTimetable
      });
    } catch (error) {
      console.error('[CREATE_TIMETABLE] Error:', error);
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

    // Validate periods if provided
    if (periods) {
      if (!Array.isArray(periods) || periods.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'At least one period is required' 
        });
      }

      // Validate each period has required fields
      for (let i = 0; i < periods.length; i++) {
        const p = periods[i];

        if (!p.subject?.trim()) {
          return res.status(400).json({
            success: false,
            message: `Period ${i + 1}: Subject is required`
          });
        }

        if (!p.startTime?.trim()) {
          return res.status(400).json({
            success: false,
            message: `Period ${i + 1}: Start time is required`
          });
        }

        if (!p.endTime?.trim()) {
          return res.status(400).json({
            success: false,
            message: `Period ${i + 1}: End time is required`
          });
        }

        // Validate subject is not date-like (prevent corruption)
        if (/^\d{4}-\d{2}-\d{2}$/.test(p.subject)) {
          console.error('[UPDATE_TIMETABLE] Period subject looks like a date:', p.subject);
          return res.status(400).json({
            success: false,
            message: `Period ${i + 1}: Subject cannot be a date format. Please enter a valid subject name.`
          });
        }

        // Validate time range
        const [startH, startM] = p.startTime.split(':').map(Number);
        const [endH, endM] = p.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (startMinutes >= endMinutes) {
          return res.status(400).json({
            success: false,
            message: `Period ${i + 1}: Start time must be before end time`
          });
        }

        // Validate period number sequence
        if (p.periodNumber !== i + 1) {
          return res.status(400).json({
            success: false,
            message: `Period numbers must be sequential (1, 2, 3, ...)`
          });
        }
      }

      // Update periods with consistent formatting
      timetable.periods = periods.map(p => ({
        periodNumber: p.periodNumber,
        subject: p.subject?.trim() || '',
        teacherId: p.teacherId || null,
        startTime: p.startTime?.trim() || '',
        endTime: p.endTime?.trim() || '',
        room: p.room?.trim() || null,
        isLab: Boolean(p.isLab) || false
      }));
    }

    if (section !== undefined) timetable.section = section?.trim() || null;
    if (effectiveFrom) timetable.effectiveFrom = new Date(effectiveFrom);
    if (effectiveTo) timetable.effectiveTo = new Date(effectiveTo);
    if (isActive !== undefined) timetable.isActive = isActive;

    timetable.updatedAt = new Date();
    const updatedTimetable = await timetable.save();

    await updatedTimetable.populate('classId', 'name semester');
    await updatedTimetable.populate('periods.teacherId', 'name email');

    console.log('[UPDATE_TIMETABLE] Success:', updatedTimetable._id);

    res.json({
      success: true,
      message: 'Timetable updated successfully',
      data: updatedTimetable
    });
  } catch (error) {
    console.error('[UPDATE_TIMETABLE] Error:', error);
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
    const { id } = req.params;
    console.log('[DELETE_TIMETABLE] Request for ID:', id);

    // Validate ID format
    if (!id || !id.match(/^[0-9a-f]{24}$/i)) {
      console.log('[DELETE_TIMETABLE] Invalid ID format:', id);
      return res.status(400).json({
        success: false,
        message: 'Invalid timetable ID format',
        code: 'INVALID_ID'
      });
    }

    // Check if timetable exists
    const timetable = await Timetable.findById(id);
    if (!timetable) {
      console.log('[DELETE_TIMETABLE] Not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Timetable not found',
        code: 'NOT_FOUND',
        timetableId: id
      });
    }

    console.log('[DELETE_TIMETABLE] Found timetable:', {
      id: timetable._id,
      class: timetable.classId,
      day: timetable.dayOfWeek,
      periodCount: timetable.periods.length
    });

    // Store timetable data before deletion for response
    const deletedTimetableData = timetable.toObject();
    
    // Delete the timetable
    const deleteResult = await timetable.deleteOne();
    console.log('[DELETE_TIMETABLE] deleteOne result:', deleteResult);

    // Verify deletion
    const verifyDelete = await Timetable.findById(id);
    console.log('[DELETE_TIMETABLE] Verify deletion - document exists after delete:', !!verifyDelete);

    if (verifyDelete) {
      console.error('[DELETE_TIMETABLE] CRITICAL: Document still exists after deleteOne()');
      return res.status(500).json({
        success: false,
        message: 'Delete operation completed but document still exists',
        code: 'DELETE_VERIFICATION_FAILED'
      });
    }

    console.log('[DELETE_TIMETABLE] Successfully deleted:', id);
    
    res.status(200).json({
      success: true,
      message: 'Timetable deleted successfully',
      data: {
        _id: deletedTimetableData._id,
        classId: deletedTimetableData.classId,
        section: deletedTimetableData.section,
        dayOfWeek: deletedTimetableData.dayOfWeek,
        periods: deletedTimetableData.periods,
        isActive: deletedTimetableData.isActive,
        deletedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[DELETE_TIMETABLE] Error:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    // Specific error handling
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid timetable ID format',
        code: 'INVALID_ID',
        details: error.message
      });
    }

    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      return res.status(500).json({
        success: false,
        message: 'Database error occurred while deleting timetable',
        code: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    // Generic error fallback
    res.status(500).json({
      success: false,
      message: 'Failed to delete timetable',
      code: 'DELETE_FAILED',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   POST /api/admin/timetables/:id/periods
 * @desc    Add a new period to a timetable
 * @access  Admin only
 */
router.post('/timetables/:id/periods',
  requireAuth,
  requireRoles('super_admin', 'admin'),
  [
    body('periodNumber').isInt({ min: 1 }).withMessage('Period number must be a positive integer'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('Start time must be in HH:MM format'),
    body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('End time must be in HH:MM format'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      console.log('[ADD_PERIOD] Request:', { timetableId: id, body: req.body });

      const timetable = await Timetable.findById(id);
      if (!timetable) {
        console.log('[ADD_PERIOD] Timetable not found:', id);
        return res.status(404).json({ success: false, message: 'Timetable not found' });
      }

      const { periodNumber, subject, teacherId, startTime, endTime, room, isLab } = req.body;

      // Check if period number already exists
      const existingPeriod = timetable.periods.find(p => p.periodNumber === periodNumber);
      if (existingPeriod) {
        console.log('[ADD_PERIOD] Period number already exists:', periodNumber);
        return res.status(400).json({
          success: false,
          message: `Period ${periodNumber} already exists in this timetable`
        });
      }

      // Validate time range
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      
      if (startMinutes >= endMinutes) {
        console.log('[ADD_PERIOD] Invalid time range:', { startTime, endTime });
        return res.status(400).json({
          success: false,
          message: 'Start time must be before end time'
        });
      }

      // Add new period
      const newPeriod = {
        periodNumber,
        subject: subject.trim(),
        teacherId: teacherId || null,
        startTime,
        endTime,
        room: room ? room.trim() : null,
        isLab: isLab || false
      };

      console.log('[ADD_PERIOD] Adding new period:', newPeriod);
      timetable.periods.push(newPeriod);
      timetable.updatedAt = new Date();

      const updatedTimetable = await timetable.save();
      await updatedTimetable.populate('classId', 'name semester');
      await updatedTimetable.populate('periods.teacherId', 'name email');

      console.log('[ADD_PERIOD] Success - Period added to timetable:', updatedTimetable._id);

      res.status(201).json({
        success: true,
        message: `Period ${periodNumber} added successfully`,
        data: updatedTimetable
      });
    } catch (error) {
      console.error('[ADD_PERIOD] Error:', error);
      res.status(400).json({ success: false, message: error.message });
    }
  }
);

/**
 * @route   DELETE /api/admin/timetables/:id/periods/:periodNumber
 * @desc    Delete a specific period from a timetable
 * @access  Admin only
 */
router.delete('/timetables/:id/periods/:periodNumber', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const { id, periodNumber } = req.params;
    console.log('[DELETE_PERIOD] Request:', { timetableId: id, periodNumber });

    const timetable = await Timetable.findById(id);
    if (!timetable) {
      console.log('[DELETE_PERIOD] Timetable not found:', id);
      return res.status(404).json({ success: false, message: 'Timetable not found' });
    }

    const periodNum = parseInt(periodNumber, 10);
    if (isNaN(periodNum)) {
      console.log('[DELETE_PERIOD] Invalid period number:', periodNumber);
      return res.status(400).json({ success: false, message: 'Invalid period number' });
    }

    const periodIndex = timetable.periods.findIndex(p => p.periodNumber === periodNum);
    console.log('[DELETE_PERIOD] Period search:', { periodNum, found: periodIndex !== -1, totalPeriods: timetable.periods.length });

    if (periodIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Period ${periodNum} not found in this timetable`
      });
    }

    if (timetable.periods.length === 1) {
      console.log('[DELETE_PERIOD] Cannot delete last period');
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the last period. Delete the entire timetable instead.'
      });
    }

    // Remove the period
    const removedPeriod = timetable.periods[periodIndex];
    timetable.periods.splice(periodIndex, 1);
    console.log('[DELETE_PERIOD] Removed period:', { subject: removedPeriod.subject, number: removedPeriod.periodNumber });

    // Renumber remaining periods
    timetable.periods.forEach((period, idx) => {
      period.periodNumber = idx + 1;
    });
    console.log('[DELETE_PERIOD] Renumbered periods. New count:', timetable.periods.length);

    timetable.updatedAt = new Date();
    const updatedTimetable = await timetable.save();
    await updatedTimetable.populate('classId', 'name semester');
    await updatedTimetable.populate('periods.teacherId', 'name email');

    console.log('[DELETE_PERIOD] Success - Updated timetable:', updatedTimetable._id);

    res.json({
      success: true,
      message: `Period ${periodNum} deleted successfully`,
      data: updatedTimetable
    });
  } catch (error) {
    console.error('[DELETE_PERIOD] Error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * @route   PUT /api/admin/timetables/:id/periods/:periodNumber
 * @desc    Update a specific period in a timetable
 * @access  Admin only
 */
router.put('/timetables/:id/periods/:periodNumber', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable not found' });
    }

    const periodNumber = parseInt(req.params.periodNumber, 10);
    const period = timetable.periods.find(p => p.periodNumber === periodNumber);

    if (!period) {
      return res.status(404).json({
        success: false,
        message: `Period ${periodNumber} not found in this timetable`
      });
    }

    const { subject, startTime, endTime, teacherId, room, isLab } = req.body;

    // Update fields if provided
    if (subject) {
      if (!subject.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Subject cannot be empty'
        });
      }
      period.subject = subject.trim();
    }

    if (startTime || endTime) {
      const newStartTime = startTime || period.startTime;
      const newEndTime = endTime || period.endTime;

      const [startH, startM] = newStartTime.split(':').map(Number);
      const [endH, endM] = newEndTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes >= endMinutes) {
        return res.status(400).json({
          success: false,
          message: 'Start time must be before end time'
        });
      }

      if (startTime) period.startTime = startTime;
      if (endTime) period.endTime = endTime;
    }

    if (teacherId !== undefined) period.teacherId = teacherId || null;
    if (room !== undefined) period.room = room ? room.trim() : null;
    if (isLab !== undefined) period.isLab = isLab;

    timetable.updatedAt = new Date();
    const updatedTimetable = await timetable.save();
    await updatedTimetable.populate('periods.teacherId', 'name email');

    console.log(`Period ${periodNumber} updated in timetable:`, updatedTimetable._id);

    res.json({
      success: true,
      message: `Period ${periodNumber} updated successfully`,
      data: updatedTimetable
    });
  } catch (error) {
    console.error('Period update error:', error);
    res.status(400).json({ success: false, message: error.message });
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
        pairedBy: req.user?._id,
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
