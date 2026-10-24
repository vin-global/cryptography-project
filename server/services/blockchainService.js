/**
 * Blockchain Service
 * Manages blockchain blocks, transactions, and chain integrity.
 */

const { queryOne, queryAll, execute, getDb, saveDb } = require('../database/connection');
const CryptoService = require('./cryptoService');

class BlockchainService {
  /**
   * Create a new block with transactions
   */
  static createBlock(transactions) {
    const lastBlock = queryOne(
      'SELECT block_hash FROM blockchain_blocks ORDER BY block_id DESC LIMIT 1'
    );

    const previousHash = lastBlock ? lastBlock.block_hash : '0'.repeat(64);

    const txHashes = transactions.map(tx => tx.tx_hash);
    const { root: merkleRoot } = CryptoService.buildMerkleTree(txHashes);

    const timestamp = new Date().toISOString();
    const nonce = Math.floor(Math.random() * 1000000);

    const blockHash = CryptoService.computeBlockHash({
      previous_hash: previousHash,
      merkle_root: merkleRoot,
      timestamp,
      nonce
    });

    // Insert block
    const blockResult = execute(
      `INSERT INTO blockchain_blocks (block_hash, previous_hash, merkle_root, timestamp, nonce)
       VALUES (?, ?, ?, ?, ?)`,
      [blockHash, previousHash, merkleRoot, timestamp, nonce]
    );

    const blockId = blockResult.lastInsertRowid;

    // Insert transactions
    const insertedTxs = [];
    for (const tx of transactions) {
      const txResult = execute(
        `INSERT INTO transaction_records (block_id, tx_data, tx_hash, public_key, signature_r, signature_s)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [blockId, tx.tx_data, tx.tx_hash, tx.public_key || null, tx.signature_r || null, tx.signature_s || null]
      );
      insertedTxs.push({ tx_id: txResult.lastInsertRowid, ...tx });
    }

    return {
      block_id: blockId,
      block_hash: blockHash,
      previous_hash: previousHash,
      merkle_root: merkleRoot,
      timestamp,
      nonce,
      transactions: insertedTxs,
      tx_count: insertedTxs.length
    };
  }

  /**
   * Get the full blockchain
   */
  static getChain() {
    return queryAll(
      `SELECT b.*, (SELECT COUNT(*) FROM transaction_records t WHERE t.block_id = b.block_id) AS tx_count
       FROM blockchain_blocks b ORDER BY b.block_id ASC`
    );
  }

  /**
   * Get a specific block with its transactions
   */
  static getBlock(blockId) {
    const block = queryOne('SELECT * FROM blockchain_blocks WHERE block_id = ?', [blockId]);
    if (!block) return null;

    const transactions = queryAll(
      'SELECT * FROM transaction_records WHERE block_id = ? ORDER BY tx_id ASC',
      [blockId]
    );

    return { ...block, transactions };
  }

  /**
   * Get transactions for a block
   */
  static getTransactions(blockId) {
    return queryAll(
      'SELECT * FROM transaction_records WHERE block_id = ? ORDER BY tx_id ASC',
      [blockId]
    );
  }

  /**
   * Record a transaction (unconfirmed)
   */
  static recordTransaction(txData, txHash, publicKey, signatureR, signatureS) {
    const result = execute(
      `INSERT INTO transaction_records (tx_data, tx_hash, public_key, signature_r, signature_s)
       VALUES (?, ?, ?, ?, ?)`,
      [txData, txHash, publicKey || null, signatureR || null, signatureS || null]
    );
    return { tx_id: result.lastInsertRowid };
  }

  /**
   * Verify chain integrity
   */
  static verifyChain() {
    const blocks = queryAll('SELECT * FROM blockchain_blocks ORDER BY block_id ASC');

    const results = [];
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const recomputedHash = CryptoService.computeBlockHash({
        previous_hash: block.previous_hash,
        merkle_root: block.merkle_root,
        timestamp: block.timestamp,
        nonce: block.nonce
      });

      const hashValid = recomputedHash === block.block_hash;
      const linkValid = i === 0
        ? block.previous_hash === '0'.repeat(64)
        : block.previous_hash === blocks[i - 1].block_hash;

      results.push({
        block_id: block.block_id,
        hashValid,
        linkValid,
        storedHash: block.block_hash,
        recomputedHash
      });
    }

    return results;
  }

  /**
   * Save a Merkle proof record
   */
  static saveMerkleProof(txId, blockId, proofPath, merkleRoot, isValid) {
    const result = execute(
      `INSERT INTO merkle_proofs (tx_id, block_id, proof_path, merkle_root, is_valid)
       VALUES (?, ?, ?, ?, ?)`,
      [txId || null, blockId || null, JSON.stringify(proofPath), merkleRoot, isValid ? 1 : 0]
    );
    return { proof_id: result.lastInsertRowid };
  }

  /**
   * Get all Merkle proofs
   */
  static getMerkleProofs() {
    return queryAll('SELECT * FROM merkle_proofs ORDER BY generated_at DESC');
  }

  /**
   * Reset blockchain to a clean genesis block
   */
  static resetChain() {
    execute('DELETE FROM transaction_records');
    execute('DELETE FROM merkle_proofs');
    execute('DELETE FROM blockchain_blocks');

    const timestamp = '2024-01-01T00:00:00.000Z';
    const nonce = 2083236893;
    const previousHash = '0'.repeat(64);
    const merkleRoot = '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';
    const blockHash = CryptoService.computeBlockHash({
      previous_hash: previousHash,
      merkle_root: merkleRoot,
      timestamp,
      nonce
    });

    execute(
      `INSERT INTO blockchain_blocks (block_id, block_hash, previous_hash, merkle_root, timestamp, nonce)
       VALUES (1, ?, ?, ?, ?, ?)`,
      [blockHash, previousHash, merkleRoot, timestamp, nonce]
    );

    execute(
      `INSERT INTO transaction_records (block_id, tx_data, tx_hash)
       VALUES (1, ?, ?)`,
      ['Genesis Block - Educational Blockchain Simulation', merkleRoot]
    );

    return this.getChain();
  }
}

module.exports = BlockchainService;
