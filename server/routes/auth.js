/**
 * Authentication Routes
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/logout
 * GET  /api/auth/me
 * POST /api/auth/change-password
 */

const express = require('express');
const router = express.Router();
const AuthService = require('../services/authService');
const { requireAuth } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const result = await AuthService.register(username, email, password);

    if (result.success) {
      req.session.user = result.user;
      return res.status(201).json({ success: true, user: result.user });
    }

    return res.status(400).json(result);
  } catch (err) {
    console.error('[Auth] Registration error:', err.message);
    return res.status(500).json({ success: false, error: 'An error occurred during registration.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await AuthService.login(username, password);

    if (result.success) {
      req.session.user = result.user;
      return res.json({ success: true, user: result.user });
    }

    return res.status(401).json(result);
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    return res.status(500).json({ success: false, error: 'An error occurred during login.' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Logout failed.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
});

// Get current user (includes full profile details)
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    // Enrich with full details from DB
    const fullUser = AuthService.getUser(req.session.user.user_id);
    if (fullUser) {
      // Keep session user updated
      req.session.user = {
        user_id: fullUser.user_id,
        username: fullUser.username,
        email: fullUser.email
      };
      return res.json({ success: true, user: fullUser });
    }
    return res.json({ success: true, user: req.session.user });
  }
  return res.status(401).json({ success: false, error: 'Not authenticated.' });
});

// Change password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user.user_id;
    const result = await AuthService.changePassword(userId, currentPassword, newPassword);
    if (result.success) {
      return res.json({ success: true });
    }
    return res.status(400).json(result);
  } catch (err) {
    console.error('[Auth] Change password error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to change password.' });
  }
});

module.exports = router;

