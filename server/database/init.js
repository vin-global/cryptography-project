/**
 * Database Initialization Script
 * Creates the SQLite database schema using sql.js.
 */

const { initDb, saveDb, closeDb } = require('./connection');

async function initializeDatabase() {
  console.log('[DB Init] Creating database schema...');

  const db = await initDb();

  // ─── Users table for authentication ───
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );
  `);

  // ─── Core Table 1: blockchain_blocks ───
  db.run(`
    CREATE TABLE IF NOT EXISTS blockchain_blocks (
      block_id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_hash TEXT NOT NULL,
      previous_hash TEXT NOT NULL,
      merkle_root TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      nonce INTEGER DEFAULT 0
    );
  `);

  // ─── Core Table 2: transaction_records ───
  db.run(`
    CREATE TABLE IF NOT EXISTS transaction_records (
      tx_id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_id INTEGER,
      tx_data TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      public_key TEXT,
      signature_r TEXT,
      signature_s TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (block_id) REFERENCES blockchain_blocks(block_id)
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  // ─── Core Table 3: merkle_proofs ───
  db.run(`
    CREATE TABLE IF NOT EXISTS merkle_proofs (
      proof_id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_id INTEGER,
      block_id INTEGER,
      proof_path TEXT NOT NULL,
      merkle_root TEXT NOT NULL,
      is_valid INTEGER DEFAULT 1,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tx_id) REFERENCES transaction_records(tx_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY (block_id) REFERENCES blockchain_blocks(block_id)
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  // ─── Supporting table: hash_operations ───
  db.run(`
    CREATE TABLE IF NOT EXISTS hash_operations (
      op_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      algorithm TEXT NOT NULL,
      input_length INTEGER NOT NULL,
      hash_output TEXT NOT NULL,
      computation_time_ms REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  // ─── Supporting table: signing_operations ───
  db.run(`
    CREATE TABLE IF NOT EXISTS signing_operations (
      op_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      operation_type TEXT NOT NULL,
      tx_hash TEXT,
      computation_time_ms REAL NOT NULL,
      success INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  // ─── Supporting table: merkle_operations ───
  db.run(`
    CREATE TABLE IF NOT EXISTS merkle_operations (
      op_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      operation_type TEXT NOT NULL,
      leaf_count INTEGER,
      tree_depth INTEGER,
      computation_time_ms REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  // ─── Indexes ───
  db.run('CREATE INDEX IF NOT EXISTS idx_tx_block ON transaction_records(block_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_proofs_tx ON merkle_proofs(tx_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_proofs_block ON merkle_proofs(block_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_blocks_hash ON blockchain_blocks(block_hash);');
  db.run('CREATE INDEX IF NOT EXISTS idx_tx_hash ON transaction_records(tx_hash);');
  db.run('CREATE INDEX IF NOT EXISTS idx_hash_ops_user ON hash_operations(user_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_signing_ops_user ON signing_operations(user_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_merkle_ops_user ON merkle_operations(user_id);');

  saveDb();

  console.log('[DB Init] Database schema created successfully.');

  return db;
}

// If run directly, initialize and close
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('[DB Init] Done.');
      closeDb();
      process.exit(0);
    })
    .catch(err => {
      console.error('[DB Init] Error:', err);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };
