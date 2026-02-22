const { clerkClient, getAuth } = require('@clerk/express');

/**
 * Authentication middleware
 * Verifies Clerk JWT token and attaches user info to request
 */
async function auth(req, res, next) {
  try {
    // Get auth from Clerk middleware
    const auth = getAuth(req);
    
    console.log('Auth middleware - User ID from Clerk:', auth?.userId);
    
    if (!auth || !auth.userId) {
      console.log('Auth middleware - No authenticated user');
      return res.status(401).json({ ok: false, error: 'Unauthorized - Please sign in' });
    }
    
    // Get user details from Clerk
    console.log('Auth middleware - Fetching user details...');
    const user = await clerkClient.users.getUser(auth.userId);
    
    console.log('Auth middleware - User retrieved:', user.id, 'Email:', user.emailAddresses?.[0]?.emailAddress);
    
    // Attach user info to request
    // Check publicMetadata first (admin-set), then unsafeMetadata (user-set), default to student
    req.user = {
      id: user.id,
      userId: user.id,
      email: user.emailAddresses?.[0]?.emailAddress,
      role: user.publicMetadata?.role || user.unsafeMetadata?.role || 'student'
    };
    
    console.log('Auth middleware - User attached to req.user, role:', req.user.role);
    
    next();
  } catch (err) {
    console.error('Auth error:', err.message || err);
    console.error('Auth error stack:', err.stack);
    return res.status(401).json({ ok: false, error: 'Invalid token or authentication failed' });
  }
}

module.exports = auth;
