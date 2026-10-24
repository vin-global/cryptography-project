/**
 * Dashboard Service
 * Aggregates metrics from all operation tables for the performance dashboard.
 * All metrics are calculated from actual persisted records.
 */

const { queryOne, queryAll } = require('../database/connection');

class DashboardService {
  static getDashboardData() {
    return {
      summary: this.getSummary(),
      hashPerformance: this.getHashPerformance(),
      signingPerformance: this.getSigningPerformance(),
      merklePerformance: this.getMerklePerformance(),
      recentActivity: this.getRecentActivity(),
      blockchainStats: this.getBlockchainStats()
    };
  }

  static getSummary() {
    const totalBlocks = queryOne('SELECT COUNT(*) AS count FROM blockchain_blocks').count;
    const totalTransactions = queryOne('SELECT COUNT(*) AS count FROM transaction_records').count;
    const totalProofs = queryOne('SELECT COUNT(*) AS count FROM merkle_proofs').count;
    const validProofs = queryOne('SELECT COUNT(*) AS count FROM merkle_proofs WHERE is_valid = 1').count;
    const totalHashOps = queryOne('SELECT COUNT(*) AS count FROM hash_operations').count;
    const totalSignOps = queryOne('SELECT COUNT(*) AS count FROM signing_operations').count;
    const totalMerkleOps = queryOne('SELECT COUNT(*) AS count FROM merkle_operations').count;

    return { totalBlocks, totalTransactions, totalProofs, validProofs, totalHashOps, totalSignOps, totalMerkleOps };
  }

  static getHashPerformance() {
    const sha256Stats = queryOne(`
      SELECT COUNT(*) AS count, AVG(computation_time_ms) AS avgTime,
             MIN(computation_time_ms) AS minTime, MAX(computation_time_ms) AS maxTime,
             AVG(input_length) AS avgInputLength
      FROM hash_operations WHERE algorithm = 'SHA-256'
    `);

    const keccak256Stats = queryOne(`
      SELECT COUNT(*) AS count, AVG(computation_time_ms) AS avgTime,
             MIN(computation_time_ms) AS minTime, MAX(computation_time_ms) AS maxTime,
             AVG(input_length) AS avgInputLength
      FROM hash_operations WHERE algorithm = 'Keccak-256'
    `);

    const recentHashes = queryAll(`
      SELECT algorithm, input_length, computation_time_ms, created_at
      FROM hash_operations ORDER BY created_at DESC LIMIT 20
    `);

    return { sha256Stats, keccak256Stats, recentHashes };
  }

  static getSigningPerformance() {
    const signStats = queryOne(`
      SELECT COUNT(*) AS count, AVG(computation_time_ms) AS avgTime,
             MIN(computation_time_ms) AS minTime, MAX(computation_time_ms) AS maxTime,
             SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successCount,
             SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failCount
      FROM signing_operations WHERE operation_type = 'sign'
    `);

    const verifyStats = queryOne(`
      SELECT COUNT(*) AS count, AVG(computation_time_ms) AS avgTime,
             MIN(computation_time_ms) AS minTime, MAX(computation_time_ms) AS maxTime,
             SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successCount,
             SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failCount
      FROM signing_operations WHERE operation_type = 'verify'
    `);

    const recentOps = queryAll(`
      SELECT operation_type, tx_hash, computation_time_ms, success, created_at
      FROM signing_operations ORDER BY created_at DESC LIMIT 20
    `);

    return { signStats, verifyStats, recentOps };
  }

  static getMerklePerformance() {
    const buildStats = queryOne(`
      SELECT COUNT(*) AS count, AVG(computation_time_ms) AS avgTime,
             MIN(computation_time_ms) AS minTime, MAX(computation_time_ms) AS maxTime,
             AVG(leaf_count) AS avgLeafCount, AVG(tree_depth) AS avgDepth
      FROM merkle_operations WHERE operation_type = 'build'
    `);

    const proofStats = queryOne(`
      SELECT COUNT(*) AS count, AVG(computation_time_ms) AS avgTime,
             AVG(tree_depth) AS avgDepth
      FROM merkle_operations WHERE operation_type = 'proof'
    `);

    const recentOps = queryAll(`
      SELECT operation_type, leaf_count, tree_depth, computation_time_ms, created_at
      FROM merkle_operations ORDER BY created_at DESC LIMIT 20
    `);

    return { buildStats, proofStats, recentOps };
  }

  static getRecentActivity() {
    const hashOps = queryAll(`
      SELECT 'hash' AS type, algorithm AS detail, computation_time_ms AS time_ms, created_at
      FROM hash_operations ORDER BY created_at DESC LIMIT 10
    `);

    const signOps = queryAll(`
      SELECT 'signing' AS type, operation_type AS detail, computation_time_ms AS time_ms, created_at
      FROM signing_operations ORDER BY created_at DESC LIMIT 10
    `);

    const merkleOps = queryAll(`
      SELECT 'merkle' AS type, operation_type AS detail, computation_time_ms AS time_ms, created_at
      FROM merkle_operations ORDER BY created_at DESC LIMIT 10
    `);

    return [...hashOps, ...signOps, ...merkleOps]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 30);
  }

  static getBlockchainStats() {
    const chainLength = queryOne('SELECT COUNT(*) AS count FROM blockchain_blocks').count;
    const latestBlock = queryOne('SELECT * FROM blockchain_blocks ORDER BY block_id DESC LIMIT 1');
    return { chainLength, latestBlock };
  }
}

module.exports = DashboardService;
