const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const { requireAuth, requireRoles } = require('../middleware/auth');

// Get all students
router.get('/', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single student
router.get('/:id', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create student
router.post('/', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  const student = new Student({
    name: req.body.name,
    rollNumber: req.body.rollNumber,
    email: req.body.email,
    phone: req.body.phone,
    class: req.body.class
  });

  try {
    const newStudent = await student.save();
    res.status(201).json(newStudent);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Roll number already exists' });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

// Update student
router.put('/:id', requireAuth, requireRoles('super_admin', 'admin', 'faculty', 'teacher'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (req.body.name != null) student.name = req.body.name;
    if (req.body.rollNumber != null) student.rollNumber = req.body.rollNumber;
    if (req.body.email != null) student.email = req.body.email;
    if (req.body.phone != null) student.phone = req.body.phone;
    if (req.body.class != null) student.class = req.body.class;

    const updatedStudent = await student.save();
    res.json(updatedStudent);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete student
router.delete('/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
