/**
 * Crypto Service
 * Server-side cryptographic operations for hashing, ECDSA verification,
 * and Merkle tree computation.
 *
 * NOTE: Private keys are NEVER handled server-side.
 */

const crypto = require('crypto');
const { keccak256 } = require('js-sha3');
const EC = require('elliptic').ec;
const { execute } = require('../database/connection');

const ec = new EC('secp256k1');

class CryptoService {
  // ─── Hashing ───

  static hashSHA256(input) {
    const start = performance.now();
    const hash = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    const timeMs = parseFloat((performance.now() - start).toFixed(4));
    return {
      hash,
      algorithm: 'SHA-256',
      outputLength: 256,
      outputHexLength: hash.length,
      timeMs
    };
  }

  static hashKeccak256(input) {
    const start = performance.now();
    const hash = keccak256(input);
    const timeMs = parseFloat((performance.now() - start).toFixed(4));
    return {
      hash,
      algorithm: 'Keccak-256',
      outputLength: 256,
      outputHexLength: hash.length,
      timeMs
    };
  }

  static recordHashOperation(userId, algorithm, inputLength, hashOutput, timeMs) {
    execute(
      `INSERT INTO hash_operations (user_id, algorithm, input_length, hash_output, computation_time_ms)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, algorithm, inputLength, hashOutput, timeMs]
    );
  }

  // ─── ECDSA Key Generation & Signing ───

  static generateKeyPair() {
    const start = performance.now();
    const key = ec.genKeyPair();
    const publicKey = key.getPublic('hex');
    const privateKey = key.getPrivate('hex');
    const timeMs = parseFloat((performance.now() - start).toFixed(4));
    return { publicKey, privateKey, timeMs };
  }

  static signMessage(privateKeyHex, messageHash) {
    const start = performance.now();
    try {
      const key = ec.keyFromPrivate(privateKeyHex, 'hex');
      const signature = key.sign(messageHash);
      const r = signature.r.toString(16).padStart(64, '0');
      const s = signature.s.toString(16).padStart(64, '0');
      const timeMs = parseFloat((performance.now() - start).toFixed(4));
      return {
        success: true,
        signature: { r, s },
        signatureHex: r + s,
        timeMs
      };
    } catch (err) {
      const timeMs = parseFloat((performance.now() - start).toFixed(4));
      return { success: false, error: err.message, timeMs };
    }
  }

  // ─── ECDSA Verification ───

  static verifySignature(messageHash, signature, publicKeyHex) {
    const start = performance.now();
    try {
      const key = ec.keyFromPublic(publicKeyHex, 'hex');
      const valid = key.verify(messageHash, { r: signature.r, s: signature.s });
      const timeMs = parseFloat((performance.now() - start).toFixed(4));
      return { valid, timeMs };
    } catch (err) {
      const timeMs = parseFloat((performance.now() - start).toFixed(4));
      return { valid: false, timeMs, error: err.message };
    }
  }

  static recordSigningOperation(userId, operationType, txHash, timeMs, success) {
    execute(
      `INSERT INTO signing_operations (user_id, operation_type, tx_hash, computation_time_ms, success)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, operationType, txHash, timeMs, success ? 1 : 0]
    );
  }

  // ─── Merkle Tree ───

  static buildMerkleTree(txHashes) {
    const start = performance.now();

    if (!txHashes || txHashes.length === 0) {
      return { root: '', tree: [], levels: 0, timeMs: 0 };
    }

    const tree = [];
    let currentLevel = txHashes.map((h, i) => ({
      hash: h,
      level: 0,
      index: i,
      isLeaf: true,
      isDuplicate: false
    }));

    tree.push([...currentLevel]);
    let level = 0;

    while (currentLevel.length > 1) {
      const nextLevel = [];

      if (currentLevel.length % 2 !== 0) {
        const dup = { ...currentLevel[currentLevel.length - 1], isDuplicate: true };
        currentLevel.push(dup);
      }

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1];
        const combinedHash = crypto.createHash('sha256')
          .update(left.hash + right.hash, 'hex')
          .digest('hex');

        nextLevel.push({
          hash: combinedHash,
          left: left.hash,
          right: right.hash,
          level: level + 1,
          index: Math.floor(i / 2),
          isLeaf: false,
          isDuplicate: false
        });
      }

      level++;
      tree.push([...nextLevel]);
      currentLevel = nextLevel;
    }

    const timeMs = parseFloat((performance.now() - start).toFixed(4));
    const root = currentLevel.length > 0 ? currentLevel[0].hash : '';

    return { root, tree, levels: level + 1, timeMs };
  }

  static generateMerkleProof(txHashes, leafIndex) {
    if (!txHashes || leafIndex < 0 || leafIndex >= txHashes.length) {
      return { proof: [], root: '', valid: false };
    }

    const proof = [];
    let currentLevel = [...txHashes];
    let idx = leafIndex;

    while (currentLevel.length > 1) {
      if (currentLevel.length % 2 !== 0) {
        currentLevel.push(currentLevel[currentLevel.length - 1]);
      }

      const nextLevel = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const combined = crypto.createHash('sha256')
          .update(currentLevel[i] + currentLevel[i + 1], 'hex')
          .digest('hex');
        nextLevel.push(combined);
      }

      if (idx % 2 === 0) {
        proof.push({ hash: currentLevel[idx + 1], position: 'right' });
      } else {
        proof.push({ hash: currentLevel[idx - 1], position: 'left' });
      }

      idx = Math.floor(idx / 2);
      currentLevel = nextLevel;
    }

    return {
      proof,
      root: currentLevel[0],
      leafHash: txHashes[leafIndex],
      leafIndex,
      valid: true
    };
  }

  static verifyMerkleProof(leafHash, proof, expectedRoot) {
    let currentHash = leafHash;

    for (const step of proof) {
      if (step.position === 'left') {
        currentHash = crypto.createHash('sha256')
          .update(step.hash + currentHash, 'hex')
          .digest('hex');
      } else {
        currentHash = crypto.createHash('sha256')
          .update(currentHash + step.hash, 'hex')
          .digest('hex');
      }
    }

    return {
      valid: currentHash === expectedRoot,
      computedRoot: currentHash
    };
  }

  static recordMerkleOperation(userId, operationType, leafCount, treeDepth, timeMs) {
    execute(
      `INSERT INTO merkle_operations (user_id, operation_type, leaf_count, tree_depth, computation_time_ms)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, operationType, leafCount, treeDepth, timeMs]
    );
  }

  // ─── Blockchain ───

  static computeBlockHash(blockHeader) {
    const headerString = JSON.stringify({
      previous_hash: blockHeader.previous_hash,
      merkle_root: blockHeader.merkle_root,
      timestamp: blockHeader.timestamp,
      nonce: blockHeader.nonce
    });
    return crypto.createHash('sha256').update(headerString, 'utf8').digest('hex');
  }
}

module.exports = CryptoService;
