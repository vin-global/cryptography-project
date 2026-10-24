/**
 * Authentication Service
 * Handles user registration, login, and session management
 * using bcryptjs for password hashing.
 */

const bcrypt = require('bcryptjs');
const { queryOne, queryAll, execute } = require('../database/connection');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

class AuthService {
  /**
   * Register a new user
   */
  static async register(username, email, password) {
    // Validate inputs
    if (!username || !email || !password) {
      return { success: false, error: 'All fields are required.' };
    }
    if (username.length < 3 || username.length > 30) {
      return { success: false, error: 'Username must be between 3 and 30 characters.' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { success: false, error: 'Username can only contain letters, numbers, and underscores.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Please provide a valid email address.' };
    }
    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    // Check for existing user
    const existing = queryOne(
      'SELECT user_id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing) {
      return { success: false, error: 'Username or email already registered.' };
    }

    // Hash password with bcryptjs
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Insert user
    const result = execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    return {
      success: true,
      user: {
        user_id: result.lastInsertRowid,
        username,
        email
      }
    };
  }

  /**
   * Authenticate a user
   */
  static async login(username, password) {
    if (!username || !password) {
      return { success: false, error: 'Username and password are required.' };
    }

    const user = queryOne(
      'SELECT user_id, username, email, password_hash FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      return { success: false, error: 'Invalid username or password.' };
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return { success: false, error: 'Invalid username or password.' };
    }

    // Update last login
    execute(
      'UPDATE users SET last_login = datetime("now") WHERE user_id = ?',
      [user.user_id]
    );

    return {
      success: true,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email
      }
    };
  }

  /**
   * Get user by ID
   */
  static getUser(userId) {
    return queryOne(
      'SELECT user_id, username, email, created_at, last_login FROM users WHERE user_id = ?',
      [userId]
    );
  }

  /**
   * Change user password
   */
  static async changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      return { success: false, error: 'Both current and new password are required.' };
    }
    if (newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters.' };
    }

    const user = queryOne(
      'SELECT user_id, password_hash FROM users WHERE user_id = ?',
      [userId]
    );
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    execute('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, userId]);

    return { success: true };
  }
}

module.exports = AuthService;
