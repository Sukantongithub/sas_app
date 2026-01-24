const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const { requireAuth, requireRoles, requireSelfOrRoles } = require('../middleware/auth');

// Get all attendance records
router.get('/', requireAuth, requireRoles('super_admin', 'admin', 'faculty'), async (req, res) => {
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
router.get('/today', requireAuth, requireRoles('super_admin', 'admin', 'faculty'), async (req, res) => {
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
router.get('/student/:studentId', requireAuth, requireSelfOrRoles({ roles: ['super_admin', 'admin', 'faculty'] }), async (req, res) => {
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
router.post('/', requireAuth, requireRoles('super_admin', 'admin', 'faculty'), async (req, res) => {
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
router.post('/bulk', requireAuth, requireRoles('super_admin', 'admin', 'faculty'), async (req, res) => {
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

module.exports = router;
