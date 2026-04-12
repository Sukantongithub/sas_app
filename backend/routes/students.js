const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { asyncHandler, handleError, ROLE_GROUPS } = require('../utils/routeHelpers');

// Get all students (accessible by teachers, staff, and admins)
router.get('/', requireAuth, requireRoles(...ROLE_GROUPS.ALL_STAFF), asyncHandler(async (req, res) => {
  const Staff = require('../models/Staff');
  const Class = require('../models/Class');
  
  try {
    // Admins and super_admins can see all students
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      const students = await Student.find().sort({ createdAt: -1 });
      return res.json(students);
    }

    // For regular staff/teachers, return only students from assigned classes
    const staff = await Staff.findOne({ userId: req.user._id }).select('assignedClassIds');
    const assignedClassIds = (staff?.assignedClassIds || []).map(id => id.toString());

    if (assignedClassIds.length === 0) {
      return res.json([]);
    }

    const students = await Student.find({ classId: { $in: assignedClassIds } }).sort({ createdAt: -1 });
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Error fetching students', error: error.message });
  }
}));

// Get single student (accessible by staff and above)
router.get('/:id', requireAuth, requireRoles(...ROLE_GROUPS.ALL_STAFF), asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }
  res.json(student);
}));

// Create student (accessible by teachers and admins only)
router.post('/', requireAuth, requireRoles(...ROLE_GROUPS.TEACHERS), asyncHandler(async (req, res) => {
  const { name, rollNumber, email, phone, class: className, classId, department, section, year } = req.body;

  // Validate all required fields
  if (!name) {
    return res.status(400).json({ 
      status: 'error',
      message: 'Missing required field: name'
    });
  }
  if (!rollNumber) {
    return res.status(400).json({ 
      status: 'error',
      message: 'Missing required field: rollNumber'
    });
  }
  if (!className) {
    return res.status(400).json({ 
      status: 'error',
      message: 'Missing required field: class'
    });
  }
  if (!email) {
    return res.status(400).json({ 
      status: 'error',
      message: 'Missing required field: email'
    });
  }
  if (!phone) {
    return res.status(400).json({ 
      status: 'error',
      message: 'Missing required field: phone'
    });
  }
  if (!department) {
    return res.status(400).json({ 
      status: 'error',
      message: 'Missing required field: department'
    });
  }
  if (!section) {
    return res.status(400).json({ 
      status: 'error',
      message: 'Missing required field: section'
    });
  }
  if (year === undefined || year === null) {
    return res.status(400).json({ 
      status: 'error',
      message: 'Missing required field: year'
    });
  }

  // Find class by ID or name
  let classRecord = null;
  if (classId) {
    classRecord = await Class.findById(classId);
    if (!classRecord) {
      return res.status(404).json({
        status: 'error',
        message: `Class not found for classId: ${classId}`
      });
    }
    if (className && classRecord.name !== className) {
      return res.status(400).json({
        status: 'error',
        message: `Class mismatch: classId belongs to '${classRecord.name}', but class='${className}' was provided`
      });
    }
  } else {
    classRecord = await Class.findOne({ name: className });
    if (!classRecord) {
      return res.status(404).json({ 
        status: 'error',
        message: `Class not found: ${className}. Please create the class first.`,
        hint: 'Available classes can be fetched from GET /api/classes'
      });
    }
  }

  const resolvedClassId = classRecord._id;
  const resolvedClassName = classRecord.name;

  // Check if student already exists
  const existingStudent = await Student.findOne({ rollNumber });
  if (existingStudent) {
    return res.status(409).json({ 
      status: 'error',
      message: `Student with roll number ${rollNumber} already exists`
    });
  }

  // Create student with class mapping
  const student = new Student({
    name,
    rollNumber,
    email,
    phone,
    class: resolvedClassName,
    classId: resolvedClassId,
    department,
    section,
    year
  });

  const newStudent = await student.save();

  // Add student to class's students array
  await Class.findByIdAndUpdate(
    resolvedClassId,
    { $addToSet: { students: newStudent._id } },
    { new: true }
  );

  res.status(201).json({
    status: 'success',
    message: 'Student created and mapped to class successfully',
    data: newStudent
  });
}));

// Update student (accessible by teachers and admins only)
router.put('/:id', requireAuth, requireRoles(...ROLE_GROUPS.TEACHERS), asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  const oldClassId = student.classId;
  let classChanged = false;

  // Update basic fields
  if (req.body.name != null) student.name = req.body.name;
  if (req.body.rollNumber != null) student.rollNumber = req.body.rollNumber;
  if (req.body.email != null) student.email = req.body.email;
  if (req.body.phone != null) student.phone = req.body.phone;
  if (req.body.department != null) student.department = req.body.department;
  if (req.body.section != null) student.section = req.body.section;
  if (req.body.year != null) student.year = req.body.year;

  // Handle class change (if provided)
  if (req.body.class != null || req.body.classId != null) {
    const newClassName = req.body.class || student.class;
    const newClassId = req.body.classId;

    if (newClassName !== student.class || (newClassId && newClassId !== oldClassId?.toString())) {
      classChanged = true;

      // Find class by ID or name
      let classRecord = null;
      if (newClassId) {
        classRecord = await Class.findById(newClassId);
        if (!classRecord) {
          return res.status(404).json({
            status: 'error',
            message: `Class not found for classId: ${newClassId}`
          });
        }
        if (req.body.class && classRecord.name !== req.body.class) {
          return res.status(400).json({
            status: 'error',
            message: `Class mismatch: classId belongs to '${classRecord.name}', but class='${req.body.class}' was provided`
          });
        }
      } else {
        classRecord = await Class.findOne({ name: newClassName });
        if (!classRecord) {
          return res.status(404).json({ 
            status: 'error',
            message: `Class not found: ${newClassName}`
          });
        }
      }

      const resolvedClassId = classRecord._id;

      // Remove from old class if exists
      if (oldClassId) {
        await Class.findByIdAndUpdate(
          oldClassId,
          { $pull: { students: student._id } },
          { new: true }
        );
      }

      // Add to new class
      await Class.findByIdAndUpdate(
        resolvedClassId,
        { $addToSet: { students: student._id } },
        { new: true }
      );

      student.class = classRecord.name;
      student.classId = resolvedClassId;
    }
  }

  const updatedStudent = await student.save();
  res.json({
    status: 'success',
    message: classChanged ? 'Student updated and class mapping changed' : 'Student updated successfully',
    data: updatedStudent
  });
}));

// Delete student (also removes from class)
router.delete('/:id', requireAuth, requireRoles(...ROLE_GROUPS.ADMINS), asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  // Remove student from their class
  if (student.classId) {
    await Class.findByIdAndUpdate(
      student.classId,
      { $pull: { students: student._id } },
      { new: true }
    );
  }

  await Student.findByIdAndDelete(req.params.id);
  res.json({ 
    status: 'success',
    message: 'Student deleted and removed from class successfully' 
  });
}));

// @route   POST /api/students/bulk-import
// @desc    Bulk import/create students with class mapping
// @access  Private (Admin only)
router.post('/bulk-import', requireAuth, requireRoles(...ROLE_GROUPS.ADMINS), asyncHandler(async (req, res) => {
  try {
    const { students: studentRecords, classId } = req.body;

    if (!studentRecords || !Array.isArray(studentRecords) || studentRecords.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request format',
        hint: 'Expected: { students: [{name, rollNumber, email, class}, ...], classId: "optional" }'
      });
    }

    const results = [];
    const errors = [];

    for (const record of studentRecords) {
      try {
        const { name, rollNumber, email, phone, class: className, classId: recordClassId, department, section, year } = record;

        // Validate all required fields
        if (!name) {
          errors.push({ record, error: 'Missing required field: name' });
          continue;
        }
        if (!rollNumber) {
          errors.push({ record, error: 'Missing required field: rollNumber' });
          continue;
        }
        if (!className) {
          errors.push({ record, error: 'Missing required field: class' });
          continue;
        }
        if (!email) {
          errors.push({ record, error: 'Missing required field: email' });
          continue;
        }
        if (!phone) {
          errors.push({ record, error: 'Missing required field: phone' });
          continue;
        }
        if (!department) {
          errors.push({ record, error: 'Missing required field: department' });
          continue;
        }
        if (!section) {
          errors.push({ record, error: 'Missing required field: section' });
          continue;
        }
        if (year === undefined || year === null) {
          errors.push({ record, error: 'Missing required field: year' });
          continue;
        }

        // Determine class
        let classRecord = null;

        if (recordClassId) {
          classRecord = await Class.findById(recordClassId);
          if (!classRecord) {
            errors.push({ record, error: `Class not found for classId: ${recordClassId}` });
            continue;
          }
          if (className && classRecord.name !== className) {
            errors.push({ record, error: `Class mismatch: classId belongs to '${classRecord.name}', but class='${className}' was provided` });
            continue;
          }
        } else {
          classRecord = await Class.findOne({ name: className });
          if (!classRecord) {
            errors.push({ record, error: `Class not found: ${className}` });
            continue;
          }
        }

        const resolvedClassId = classRecord._id;

        // Check duplicate
        const existingStudent = await Student.findOne({ rollNumber });
        if (existingStudent) {
          errors.push({ record, error: `Duplicate roll number: ${rollNumber}` });
          continue;
        }

        // Create student
        const student = new Student({
          name,
          rollNumber,
          email,
          phone,
          class: classRecord.name,
          classId: resolvedClassId,
          department,
          section,
          year
        });

        const savedStudent = await student.save();

        // Add to class if mapping exists
        if (resolvedClassId) {
          await Class.findByIdAndUpdate(
            resolvedClassId,
            { $addToSet: { students: savedStudent._id } },
            { new: true }
          );
        }

        results.push({
          status: 'success',
          rollNumber: savedStudent.rollNumber,
          data: savedStudent
        });
      } catch (error) {
        errors.push({ record, error: error.message });
      }
    }

    res.status(201).json({
      status: 'completed',
      message: `Imported ${results.length} students successfully, ${errors.length} failed`,
      summary: {
        total: studentRecords.length,
        successful: results.length,
        failed: errors.length
      },
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error during bulk import',
      error: error.message
    });
  }
}));

// @route   GET /api/students/attendance/mark
// @desc    Get students with attendance status for marking (by date and optional class)
// @access  Private (Staff, Teachers, Admin)
router.get('/attendance/mark', requireAuth, requireRoles(...ROLE_GROUPS.ALL_STAFF), asyncHandler(async (req, res) => {
  try {
    const { date, classId } = req.query;
    const targetDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    
    let studentQuery = {};
    
    // If classId provided, get students from that class
    if (classId) {
      const classData = await Class.findById(classId).populate('students');
      if (!classData) {
        return res.status(404).json({ 
          status: 'error',
          message: 'Class not found' 
        });
      }
      studentQuery._id = { $in: classData.students.map(s => s._id) };
    }
    
    // Fetch all students (or from specific class)
    const students = await Student.find(studentQuery)
      .select('_id name rollNumber email class section phone')
      .sort({ rollNumber: 1 });
    
    // Get attendance records for the date
    const attendanceRecords = await Attendance.find({
      studentId: { $in: students.map(s => s._id) },
      date: targetDate
    })
      .select('studentId status remarks verificationMethod');
    
    // Create a map of attendance by studentId
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.studentId.toString()] = {
        status: record.status,
        remarks: record.remarks,
        verificationMethod: record.verificationMethod,
        marked: true
      };
    });
    
    // Combine students with their attendance status
    const studentsWithAttendance = students.map(student => ({
      _id: student._id,
      name: student.name,
      rollNumber: student.rollNumber,
      email: student.email,
      class: student.class,
      section: student.section,
      phone: student.phone,
      attendance: attendanceMap[student._id.toString()] || {
        status: null,
        remarks: null,
        verificationMethod: null,
        marked: false
      }
    }));
    
    // Separate marked and unmarked students
    const markedStudents = studentsWithAttendance.filter(s => s.attendance.marked);
    const unmarkedStudents = studentsWithAttendance.filter(s => !s.attendance.marked);
    
    res.json({
      status: 'success',
      date: targetDate,
      classId: classId || null,
      summary: {
        total: students.length,
        marked: markedStudents.length,
        unmarked: unmarkedStudents.length,
        markedPercentage: students.length > 0 ? ((markedStudents.length / students.length) * 100).toFixed(2) : 0
      },
      data: {
        allStudents: studentsWithAttendance,
        markedStudents,
        unmarkedStudents
      }
    });
    
  } catch (error) {
    console.error('Error fetching students for attendance marking:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error fetching students for attendance marking',
      error: error.message 
    });
  }
}));

module.exports = router;
