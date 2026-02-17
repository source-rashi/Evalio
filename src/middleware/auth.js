const { clerkClient } = require('@clerk/express');

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
    const sessionToken = token;
    
    // Use Clerk's backend API to verify the token
    const client = clerkClient();
    const response = await client.verifyToken(sessionToken, {
      secretKey: process.env.CLERK_SECRET_KEY
    });
    
    if (!response || !response.sub) {
      return res.status(401).json({ ok: false, error: 'Invalid token' });
    }
    
    // Get user details from Clerk
    const user = await client.users.getUser(response.sub);
    
    // Attach user info to request
    req.user = {
      id: user.id,
      userId: user.id,
      email: user.emailAddresses?.[0]?.emailAddress,
      role: user.publicMetadata?.role || 'student'
    };
    
    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

module.exports = auth;
