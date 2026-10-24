/**
 * Database Connection Module
 * Provides a singleton database connection using sql.js (pure JavaScript SQLite).
 * sql.js operates in-memory but we persist to disk on writes.
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const DB_PATH = path.resolve(__dirname, '../../', process.env.DB_PATH || './server/database/blockchain_crypto.db');

let db = null;
let SQL = null;

/**
 * Initialize and return the database instance.
 * Must be called once at app startup (async).
 */
async function initDb() {
  if (db) return db;

  SQL = await initSqlJs();

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign key enforcement
  db.run('PRAGMA foreign_keys = ON;');

  return db;
}

/**
 * Get the current database instance (synchronous after init).
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

/**
 * Save the database to disk.
 * Call this after write operations.
 */
function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

/**
 * Close the database and save to disk.
 */
function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

/**
 * Helper: run a query and return all rows as an array of objects.
 */
function queryAll(sql, params = []) {
  const d = getDb();
  const stmt = d.prepare(sql);
  if (params.length > 0) stmt.bind(params);

  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * Helper: run a query and return the first row as an object, or null.
 */
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Helper: execute a statement (INSERT, UPDATE, DELETE) and return info.
 * Returns { changes, lastInsertRowid }
 */
function execute(sql, params = []) {
  const d = getDb();
  d.run(sql, params);
  const info = d.exec('SELECT last_insert_rowid() AS id, changes() AS changes');
  const lastInsertRowid = info.length > 0 ? info[0].values[0][0] : 0;
  const changes = info.length > 0 ? info[0].values[0][1] : 0;
  saveDb();
  return { lastInsertRowid, changes };
}

module.exports = { initDb, getDb, saveDb, closeDb, queryAll, queryOne, execute, DB_PATH };
