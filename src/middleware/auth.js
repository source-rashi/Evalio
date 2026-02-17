const { createClerkClient, verifyToken } = require('@clerk/backend');

// Initialize Clerk client with secret key
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY
});

/**
 * Authentication middleware
 * Verifies Clerk JWT token and attaches user info to request
 */
async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  
  console.log('Auth middleware - Authorization header present:', !!header);
  console.log('Auth middleware - Token extracted:', token ? 'Yes' : 'No');
  
  if (!token) {
    console.log('Auth middleware - No token provided');
    return res.status(401).json({ ok: false, error: 'Missing token' });
  }
  
  try {
    // Verify the Clerk session token using standalone verifyToken
    console.log('Auth middleware - Attempting to verify token...');
    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });
    
    console.log('Auth middleware - Token verified, sub:', verified?.sub);
    
    if (!verified || !verified.sub) {
      console.log('Auth middleware - Token verification failed');
      return res.status(401).json({ ok: false, error: 'Invalid token' });
    }
    
    // Get user details from Clerk
    console.log('Auth middleware - Fetching user details...');
    const user = await clerkClient.users.getUser(verified.sub);
    
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
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

module.exports = auth;
