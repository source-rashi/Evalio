const { createClerkClient } = require('@clerk/backend');

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
  
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Missing token' });
  }
  
  try {
    // Verify the Clerk session token
    const verified = await clerkClient.verifyToken(token);
    
    if (!verified || !verified.sub) {
      return res.status(401).json({ ok: false, error: 'Invalid token' });
    }
    
    // Get user details from Clerk
    const user = await clerkClient.users.getUser(verified.sub);
    
    // Attach user info to request
    req.user = {
      id: user.id,
      userId: user.id,
      email: user.emailAddresses?.[0]?.emailAddress,
      role: user.publicMetadata?.role || 'student'
    };
    
    next();
  } catch (err) {
    console.error('Auth error:', err.message || err);
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

module.exports = auth;
