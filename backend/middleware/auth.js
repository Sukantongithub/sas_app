const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('Missing required environment variable: JWT_SECRET');
}

// Extract bearer token from Authorization header
function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.replace('Bearer ', '').trim();
  if (req.body && req.body.token) return req.body.token;
  return null;
}
            
// Verify JWT and attach user
const requireAuth = async (req, res, next) => {
  try {
    const token = getToken(req);
    
    if (!token) {
      return res.status(401).json({ message: 'Authorization token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).populate('studentId');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is disabled' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Allow only specific roles
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }
    next();
  };
}

// Allow if user has role OR matches resource (e.g., student self)
function requireSelfOrRoles(options = {}) {
  const { studentParam = 'studentId', roles = [] } = options;
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const studentIdFromParam = req.params[studentParam] || req.body[studentParam];

    // Check if user has required role
    if (roles.includes(req.user.role)) {
      return next();
    }

    // Check if student is accessing their own data
    // The studentIdFromParam could be either:
    // 1. The User's _id (when student logs in, they might use their user ID)
    // 2. The User's studentId (reference to Student document)
    const userIdStr = String(req.user._id);
    const userStudentIdStr = req.user.studentId ? String(req.user.studentId._id || req.user.studentId) : null;
    const paramIdStr = String(studentIdFromParam);

    const isSelf = paramIdStr === userIdStr || (userStudentIdStr && paramIdStr === userStudentIdStr);

    if (isSelf) {
      return next();
    }

    return res.status(403).json({ message: 'Forbidden: insufficient permission' });
  };
}

module.exports = { requireAuth, requireRoles, requireSelfOrRoles };
