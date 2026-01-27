const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Session = require('../models/Session');
const Notification = require('../models/Notification');
const Timetable = require('../models/Timetable');
const { requireAuth, requireRoles, requireSelfOrRoles } = require('../middleware/auth');

// Get all attendance records
router.get('/', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const { date, studentId } = req.query;
    let query = {};
    
    if (date) query.date = date;
    if (studentId) query.studentId = studentId;

    const records = await Attendance.find(query)
      .populate('studentId', 'name rollNumber class')
      .sort({ date: -1, markedAt: -1 });
    
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get today's attendance
router.get('/today', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const records = await Attendance.find({ date: today })
      .populate('studentId', 'name rollNumber class')
      .sort({ markedAt: -1 });
    
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get student's attendance history
router.get('/student/:studentId', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'faculty', 'teacher'] }), async (req, res) => {
  try {
    const records = await Attendance.find({ studentId: req.params.studentId })
      .sort({ date: -1 });
    
    // Calculate statistics
    const totalClasses = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const percentage = totalClasses > 0 ? (present / totalClasses) * 100 : 0;

    res.json({
      records,
      stats: {
        totalClasses,
        present,
        absent,
        late,
        percentage: parseFloat(percentage.toFixed(2))
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark attendance (create or update)
router.post('/', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const { studentId, date, status, remarks } = req.body;

    // Verify student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Check if attendance already exists for this student and date
    let attendance = await Attendance.findOne({ studentId, date });

    if (attendance) {
      // Update existing attendance
      attendance.status = status;
      attendance.remarks = remarks;
      attendance.markedAt = new Date();
      await attendance.save();
      res.json(attendance);
    } else {
      // Create new attendance record
      attendance = new Attendance({
        studentId,
        date,
        status,
        remarks
      });
      const newAttendance = await attendance.save();
      res.status(201).json(newAttendance);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Mark attendance for multiple students
router.post('/bulk', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const { records } = req.body; // Array of { studentId, date, status, remarks }
    
    const results = await Promise.all(
      records.map(async (record) => {
        const { studentId, date, status, remarks } = record;
        
        let attendance = await Attendance.findOne({ studentId, date });
        
        if (attendance) {
          attendance.status = status;
          attendance.remarks = remarks;
          attendance.markedAt = new Date();
          return await attendance.save();
        } else {
          const newAttendance = new Attendance({
            studentId,
            date,
            status,
            remarks
          });
          return await newAttendance.save();
        }
      })
    );

    res.status(201).json(results);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete attendance record
router.delete('/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get attendance statistics for all students
router.get('/stats/all', requireAuth, requireRoles('super_admin', 'admin', 'faculty'), async (req, res) => {
  try {
    const students = await Student.find();
    
    const statsPromises = students.map(async (student) => {
      const records = await Attendance.find({ studentId: student._id });
      const totalClasses = records.length;
      const present = records.filter(r => r.status === 'present').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const late = records.filter(r => r.status === 'late').length;
      const percentage = totalClasses > 0 ? (present / totalClasses) * 100 : 0;

      return {
        student: {
          id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          class: student.class
        },
        stats: {
          totalClasses,
          present,
          absent,
          late,
          percentage: parseFloat(percentage.toFixed(2))
        }
      };
    });

    const allStats = await Promise.all(statsPromises);
    res.json(allStats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attendance/summary/daily
// @desc    Get daily attendance summary
// @access  Private (Teacher/Admin)
router.get('/summary/daily', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const { date, classId, section } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    
    let studentQuery = {};
    if (classId) studentQuery.classId = classId;
    if (section) studentQuery.section = section;
    
    const students = await Student.find(studentQuery);
    const totalStudents = students.length;
    
    const attendanceQuery = { date: dateStr };
    if (classId) {
      const studentIds = students.map(s => s._id);
      attendanceQuery.studentId = { $in: studentIds };
    }
    
    const records = await Attendance.find(attendanceQuery)
      .populate('studentId', 'name rollNumber class section');
    
    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;
    const lateCount = records.filter(r => r.status === 'late').length;
    const unmarkedCount = totalStudents - records.length;
    
    const presentStudents = records.filter(r => r.status === 'present').map(r => r.studentId);
    const absentStudents = records.filter(r => r.status === 'absent').map(r => r.studentId);
    const lateStudents = records.filter(r => r.status === 'late').map(r => r.studentId);
    
    const markedStudentIds = records.map(r => r.studentId._id.toString());
    const unmarkedStudents = students
      .filter(s => !markedStudentIds.includes(s._id.toString()))
      .map(s => ({ _id: s._id, name: s.name, rollNumber: s.rollNumber, class: s.class, section: s.section }));
    
    res.json({
      date: dateStr,
      summary: {
        total: totalStudents,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        unmarked: unmarkedCount,
        attendancePercentage: totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(2) : 0
      },
      details: {
        presentStudents,
        absentStudents,
        lateStudents,
        unmarkedStudents
      }
    });
  } catch (error) {
    console.error('Daily summary error:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attendance/late-arrivals
// @desc    Get late arrival records with analysis
// @access  Private (Teacher/Admin)
router.get('/late-arrivals', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const { startDate, endDate, studentId, classId } = req.query;
    
    let query = { status: 'late' };
    if (studentId) query.studentId = studentId;
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    
    const lateRecords = await Attendance.find(query)
      .populate('studentId', 'name rollNumber class section email')
      .populate('sessionId', 'subject startTime')
      .sort({ date: -1, entryTime: -1 });
    
    // Calculate late duration for each record
    const enrichedRecords = lateRecords.map(record => {
      let lateDuration = null;
      if (record.sessionId && record.sessionId.startTime && record.entryTime) {
        const sessionStart = new Date(record.date);
        const [hours, minutes] = record.sessionId.startTime.split(':');
        sessionStart.setHours(parseInt(hours), parseInt(minutes), 0);
        
        const entry = new Date(record.entryTime);
        lateDuration = Math.floor((entry - sessionStart) / (1000 * 60)); // minutes
      }
      
      return {
        ...record.toObject(),
        lateDuration
      };
    });
    
    // Group by student for summary
    const studentSummary = {};
    enrichedRecords.forEach(record => {
      const studentId = record.studentId._id.toString();
      if (!studentSummary[studentId]) {
        studentSummary[studentId] = {
          student: record.studentId,
          lateCount: 0,
          totalLateMinutes: 0,
          records: []
        };
      }
      studentSummary[studentId].lateCount++;
      if (record.lateDuration) {
        studentSummary[studentId].totalLateMinutes += record.lateDuration;
      }
      studentSummary[studentId].records.push(record);
    });
    
    res.json({
      records: enrichedRecords,
      summary: Object.values(studentSummary)
    });
  } catch (error) {
    console.error('Late arrivals error:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attendance/by-class/:classId
// @desc    Get attendance filtered by class and section
// @access  Private (Teacher/Admin)
router.get('/by-class/:classId', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const { section, startDate, endDate } = req.query;
    
    let studentQuery = { classId: req.params.classId };
    if (section) studentQuery.section = section;
    
    const students = await Student.find(studentQuery);
    const studentIds = students.map(s => s._id);
    
    let attendanceQuery = { studentId: { $in: studentIds } };
    if (startDate || endDate) {
      attendanceQuery.date = {};
      if (startDate) attendanceQuery.date.$gte = startDate;
      if (endDate) attendanceQuery.date.$lte = endDate;
    }
    
    const records = await Attendance.find(attendanceQuery)
      .populate('studentId', 'name rollNumber class section')
      .populate('sessionId', 'subject date startTime endTime')
      .sort({ date: -1 });
    
    res.json({
      students,
      records,
      totalStudents: students.length,
      totalRecords: records.length
    });
  } catch (error) {
    console.error('Get class attendance error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
