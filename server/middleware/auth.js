/**
 * Authentication Middleware
 * Protects routes that require a logged-in user.
 */

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
}

module.exports = { requireAuth };
