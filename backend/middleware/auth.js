const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Extract bearer token from Authorization header
function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.replace('Bearer ', '').trim();
  if (req.body && req.body.token) return req.body.token;
  return null;
}

// Verify JWT and attach user
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    console.log('requireAuth: Authorization header present:', !!header, 'Header:', header.substring(0, 50) + '...');
    const token = getToken(req);
    console.log('requireAuth: Token extracted:', !!token);
    
    if (!token) {
      console.log('requireAuth: No token found, returning 401');
      return res.status(401).json({ message: 'Authorization token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('requireAuth: Token verified, userId:', decoded.userId);
    const user = await User.findById(decoded.userId).populate('studentId');
    
    console.log('requireAuth: User found:', user?.email, 'Role:', user?.role);

    if (!user) {
      console.log('requireAuth: User not found in database');
      return res.status(401).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      console.log('requireAuth: User account is disabled');
      return res.status(403).json({ message: 'Account is disabled' });
    }

    req.user = user;
    req.token = token;
    console.log('requireAuth: User attached to request, calling next');
    next();
  } catch (error) {
    console.error('requireAuth: Error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Allow only specific roles
function requireRoles(...roles) {
  return (req, res, next) => {
    console.log('requireRoles: Checking roles:', roles, 'User role:', req.user?.role);
    if (!req.user) {
      console.log('requireRoles: No user on request');
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      console.log('requireRoles: User role', req.user.role, 'not in allowed roles', roles);
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }
    console.log('requireRoles: User role authorized');
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
    const isSelf = studentIdFromParam && req.user.studentId && String(req.user.studentId._id || req.user.studentId) === String(studentIdFromParam);

    if (isSelf || roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({ message: 'Forbidden: insufficient permission' });
  };
}

module.exports = { requireAuth, requireRoles, requireSelfOrRoles };
