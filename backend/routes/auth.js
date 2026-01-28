const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const User = require('../models/User');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
};

// Register new user
router.post('/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['super_admin', 'admin', 'faculty', 'teacher', 'student']).withMessage('Invalid role'),
  ],
  validateRequest,
  async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Allow self-registration for student/teacher; other roles require admin flow
    const requestedRole = role || 'student';
    if (!['student', 'teacher'].includes(requestedRole)) {
      return res.status(403).json({ message: 'Only admins can create privileged roles' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create new user (studentId will be linked later if needed)
    const user = new User({
      name,
      email,
      password,
      role: requestedRole
    });

    await user.save();

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    console.error('Request body:', req.body);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    // Handle duplicate email
    if (error.code === 11000) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }
    
    res.status(400).json({ message: error.message });
  }
});

// Login
router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for email:', email);

    // Find user
    const user = await User.findOne({ email }).populate('studentId');
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    console.log('User found:', user.email, 'Role:', user.role);

    // Check if user is active
    if (!user.isActive) {
      console.log('User account is disabled:', email);
      return res.status(403).json({ message: 'Account is disabled. Contact administrator.' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    console.log('Password match:', isMatch);
    
    if (!isMatch) {
      console.log('Password mismatch for user:', email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = generateToken(user._id);
    console.log('JWT token generated');

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Verify JWT token (check if token is valid)
router.post('/verify', requireAuth, async (req, res) => {
  try {
    res.json({
      valid: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        studentId: req.user.studentId,
        lastLogin: req.user.lastLogin
      }
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Logout (JWT is stateless; client removes token. Accept any request since token is cleared client-side.)
router.post('/logout', async (req, res) => {
  try {
    // Optional: could log the logout event if user is authenticated
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('User logged out:', decoded.userId);
      } catch (err) {
        // Token invalid or expired, but that's ok for logout
        console.log('Logout with invalid/expired token');
      }
    }
    res.json({ message: 'Logged out successfully', success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get current user info
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      studentId: req.user.studentId,
      lastLogin: req.user.lastLogin
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all users (admin only)
router.get('/users', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const users = await User.find().populate('studentId').select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user role (admin only)
router.put('/users/:id/role',
  requireAuth,
  requireRoles('super_admin', 'admin'),
  [body('role').isIn(['super_admin', 'admin', 'faculty', 'student']).withMessage('Invalid role')],
  validateRequest,
  async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role, updatedAt: Date.now() },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete user (admin only)
router.delete('/users/:id', requireAuth, requireRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
