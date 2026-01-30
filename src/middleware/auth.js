const jwt = require('jsonwebtoken');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to request
 * Supports both legacy (id) and new (userId) token formats
 */
module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Missing token' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    
    // Support both legacy and new token formats
    req.user = {
      id: decoded.userId || decoded.id,  // Backward compatible
      userId: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role  // Now available for RBAC
    };
    
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}
