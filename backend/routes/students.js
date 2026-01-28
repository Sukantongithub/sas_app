const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { asyncHandler, handleError, ROLE_GROUPS } = require('../utils/routeHelpers');

// Get all students
router.get('/', requireAuth, requireRoles(...ROLE_GROUPS.TEACHERS), asyncHandler(async (req, res) => {
  const students = await Student.find().sort({ createdAt: -1 });
  res.json(students);
}));

// Get single student
router.get('/:id', requireAuth, requireRoles(...ROLE_GROUPS.TEACHERS), asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }
  res.json(student);
}));

// Create student
router.post('/', requireAuth, requireRoles(...ROLE_GROUPS.TEACHERS), asyncHandler(async (req, res) => {
  const student = new Student({
    name: req.body.name,
    rollNumber: req.body.rollNumber,
    email: req.body.email,
    phone: req.body.phone,
    class: req.body.class
  });

  const newStudent = await student.save();
  res.status(201).json(newStudent);
}));

// Update student
router.put('/:id', requireAuth, requireRoles(...ROLE_GROUPS.TEACHERS), asyncHandler(async (req, res) => {
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
}));

// Delete student
router.delete('/:id', requireAuth, requireRoles(...ROLE_GROUPS.ADMINS), asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  await Student.findByIdAndDelete(req.params.id);
  res.json({ message: 'Student deleted successfully' });
}));

module.exports = router;
