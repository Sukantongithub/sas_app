const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const User = require('../models/User');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ROLE_VALUES = ['super_admin', 'admin', 'hod', 'staff', 'student', 'parent'];

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
    body('role').optional().isIn(ROLE_VALUES).withMessage('Invalid role'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      const requestedRole = role || 'student';

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
      console.log('[LOGIN DEBUG] Received request - email:', JSON.stringify(email), '| passwordLength:', password?.length);

      // Find user
      const user = await User.findOne({ email: email.toLowerCase().trim() }).populate('studentId');
      console.log('[LOGIN DEBUG] User lookup result:', user ? 'FOUND' : 'NOT FOUND', 'role:', user?.role);
      
      if (!user) {
        console.log('[LOGIN DEBUG] No user found for email:', email);
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Check if user is active
      if (!user.isActive) {
        console.log('[LOGIN DEBUG] User inactive');
        return res.status(403).json({ message: 'Account is disabled. Contact administrator.' });
      }

      // Verify password
      const isMatch = await user.comparePassword(password);
      console.log('[LOGIN DEBUG] Password match:', isMatch, '| role:', user.role);

      if (!isMatch) {
        console.log('[LOGIN DEBUG] Password mismatch');
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = generateToken(user._id);
      console.log('[LOGIN DEBUG] Token generated:', token.substring(0, 20) + '...');

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      const responseData = {
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          studentId: user.studentId?._id || user.studentId,
          lastLogin: user.lastLogin
        }
      };
      
      console.log('[LOGIN DEBUG] Sending response:', {
        hasToken: !!responseData.token,
        userId: responseData.user.id,
        role: responseData.user.role
      });

      res.json(responseData);
    } catch (error) {
      console.error('[LOGIN DEBUG] Error:', error.message);
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
        studentId: req.user.studentId?._id || req.user.studentId,
        lastLogin: req.user.lastLogin
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Change password (authenticated users only)
router.post('/change-password',
  requireAuth,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('New password must contain at least one uppercase letter')
      .matches(/[0-9]/)
      .withMessage('New password must contain at least one number'),
    body('confirmPassword')
      .notEmpty()
      .withMessage('Please confirm your new password'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

      // Confirm passwords match
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'New passwords do not match' });
      }

      // Re-fetch user with password field (normally excluded by toJSON)
      const user = await User.findById(req.user._id).select('+password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      // Prevent reusing the same password
      const isSame = await user.comparePassword(newPassword);
      if (isSame) {
        return res.status(400).json({ message: 'New password must be different from the current password' });
      }

      // Update password (pre-save hook will hash it)
      user.password = newPassword;
      await user.save();

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: 'Failed to change password. Please try again.' });
    }
  }
);

// Logout (JWT is stateless; client removes token)
router.post('/logout', async (req, res) => {
  try {
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
  [body('role').isIn(ROLE_VALUES).withMessage('Invalid role')],
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
