const ROLES = require('../constants/roles');

/**
 * Role-Based Access Control (RBAC) middleware
 * Restricts route access based on user roles
 * 
 * Usage:
 *   requireRole('teacher')                    // Single role
 *   requireRole(['teacher', 'admin'])         // Multiple roles
 * 
 * IMPORTANT: Must be used AFTER auth middleware
 * 
 * Returns:
 *   - 403 Forbidden if user lacks required role
 *   - 401 Unauthorized if no user in request (missing auth)
 *   - Continues to next() if authorized
 */

/**
 * @param {string|string[]} allowedRoles - Single role or array of allowed roles
 * @returns {Function} Express middleware function
 */
function requireRole(allowedRoles) {
  // Normalize to array
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return function(req, res, next) {
    // Check if user is authenticated (auth middleware must run first)
    if (!req.user || !req.user.role) {
      return res.status(401).json({ 
        ok: false, 
        error: 'Authentication required' 
      });
    }
    
    // Check if user has one of the allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        ok: false, 
        error: 'Access forbidden: insufficient permissions',
        required: roles,
        current: req.user.role
      });
    }
    
    // User has required role, proceed
    next();
  };
}

module.exports = requireRole;
