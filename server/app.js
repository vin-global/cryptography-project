/**
 * BlockchainCrypto Demo - Main Application Server
 *
 * Three-tier architecture:
 *   Presentation: Static frontend files served from /public
 *   Application:  Express routes + service layer
 *   Database:     SQLite via sql.js
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const { initDb, closeDb } = require('./database/connection');
const { initializeDatabase } = require('./database/init');

// Routes
const authRoutes = require('./routes/auth');
const cryptoRoutes = require('./routes/crypto');
const blockchainRoutes = require('./routes/blockchain');
const dashboardRoutes = require('./routes/dashboard');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

const app = express();

// ─── Security Headers ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://d3js.org"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"]
    }
  }
}));

// ─── CORS ───
app.use(cors({
  origin: true,
  credentials: true
}));

// ─── Body Parsing (with size limits) ───
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Session Management ───
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '3600000', 10),
    sameSite: 'lax'
  }
}));

// ─── Static Files ───
app.use(express.static(path.join(__dirname, '../public')));

// ─── API Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ─── SPA Fallback: serve index.html for any non-API route ───
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } else {
    res.status(404).json({ success: false, error: 'API endpoint not found.' });
  }
});

// ─── Error Handler ───
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

// ─── Start Server ───
async function start() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('[Server] Database initialized.');

    app.listen(PORT, () => {
      console.log(`\n${'═'.repeat(56)}`);
      console.log(`  BlockchainCrypto Demo Server`);
      console.log(`  Running at: http://${HOST}:${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`${'═'.repeat(56)}\n`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

start();
