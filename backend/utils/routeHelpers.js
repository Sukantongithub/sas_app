/**
 * Common route utilities and helpers
 * Consolidates repetitive patterns across routes
 */

/**
 * Standard error response handler
 * @param {Response} res - Express response object
 * @param {Error} error - Error object
 * @param {string} defaultMessage - Default error message
 * @param {number} statusCode - HTTP status code
 */
const handleError = (res, error, defaultMessage = 'An error occurred', statusCode = 500) => {
  // Handle validation errors
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({ message: messages.join(', ') });
  }
  
  // Handle duplicate key errors
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];
    return res.status(400).json({ 
      message: field ? `${field} already exists` : 'Duplicate entry' 
    });
  }
  
  // Handle cast errors (invalid ObjectId)
  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID format' });
  }
  
  // Default error response
  return res.status(statusCode).json({ 
    message: error.message || defaultMessage 
  });
};

/**
 * Async route handler wrapper
 * Eliminates need for try-catch in every route
 * @param {Function} fn - Async route handler function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Success response formatter
 * @param {Response} res - Express response object
 * @param {any} data - Response data
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Optional success message
 */
const sendSuccess = (res, data, statusCode = 200, message = null) => {
  const response = { success: true };
  if (message) response.message = message;
  if (data !== undefined) response.data = data;
  return res.status(statusCode).json(response);
};

/**
 * Paginated response formatter
 * @param {Response} res - Express response object
 * @param {Array} data - Data array
 * @param {Object} pagination - Pagination info
 */
const sendPaginated = (res, data, pagination = {}) => {
  return res.json({
    success: true,
    count: data.length,
    total: pagination.total || data.length,
    page: pagination.page || 1,
    limit: pagination.limit || data.length,
    data
  });
};

/**
 * Check if resource exists
 * @param {Model} model - Mongoose model
 * @param {string} id - Resource ID
 * @param {string} resourceName - Name for error message
 * @throws {Error} If resource not found
 */
const findOrFail = async (model, id, resourceName = 'Resource') => {
  const resource = await model.findById(id);
  if (!resource) {
    const error = new Error(`${resourceName} not found`);
    error.statusCode = 404;
    throw error;
  }
  return resource;
};

/**
 * Common role definitions
 */
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  FACULTY: 'faculty',
  TEACHER: 'teacher',
  STUDENT: 'student',
  PARENT: 'parent',
  STAFF: 'staff'
};

/**
 * Common role groups
 */
const ROLE_GROUPS = {
  ADMINS: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  TEACHERS: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.FACULTY, ROLES.TEACHER],
  ALL_STAFF: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.FACULTY, ROLES.TEACHER, ROLES.STAFF]
};

module.exports = {
  handleError,
  asyncHandler,
  sendSuccess,
  sendPaginated,
  findOrFail,
  ROLES,
  ROLE_GROUPS
};
