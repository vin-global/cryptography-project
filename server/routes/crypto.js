/**
 * Crypto Routes
 * POST /api/crypto/hash         - Hash input with SHA-256 and Keccak-256
 * POST /api/crypto/verify       - Verify ECDSA signature
 * POST /api/crypto/record-sign  - Record signing operation metrics
 * POST /api/crypto/merkle/build - Build Merkle tree
 * POST /api/crypto/merkle/proof - Generate Merkle proof
 * POST /api/crypto/merkle/verify - Verify Merkle proof
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const CryptoService = require('../services/cryptoService');
const BlockchainService = require('../services/blockchainService');

// Hash input with both algorithms
router.post('/hash', requireAuth, (req, res) => {
  try {
    const { input } = req.body;

    if (input === undefined || input === null) {
      return res.status(400).json({ success: false, error: 'Input is required.' });
    }

    const inputStr = String(input);
    const sha256Result = CryptoService.hashSHA256(inputStr);
    const keccak256Result = CryptoService.hashKeccak256(inputStr);

    // Record operations
    const userId = req.session.user.user_id;
    CryptoService.recordHashOperation(userId, 'SHA-256', inputStr.length, sha256Result.hash, sha256Result.timeMs);
    CryptoService.recordHashOperation(userId, 'Keccak-256', inputStr.length, keccak256Result.hash, keccak256Result.timeMs);

    return res.json({
      success: true,
      sha256: sha256Result,
      keccak256: keccak256Result,
      inputLength: inputStr.length
    });
  } catch (err) {
    console.error('[Crypto] Hash error:', err.message);
    return res.status(500).json({ success: false, error: 'Hashing failed.' });
  }
});

// Generate ECDSA secp256k1 keypair
router.post('/keypair', requireAuth, (req, res) => {
  try {
    const result = CryptoService.generateKeyPair();
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Crypto] Keypair error:', err.message);
    return res.status(500).json({ success: false, error: 'Key generation failed.' });
  }
});

// Sign transaction hash with private key
router.post('/sign', requireAuth, (req, res) => {
  try {
    const { privateKey, messageHash } = req.body;
    if (!privateKey || !messageHash) {
      return res.status(400).json({ success: false, error: 'privateKey and messageHash are required.' });
    }

    const result = CryptoService.signMessage(privateKey, messageHash);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error || 'Signing failed.' });
    }

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Crypto] Sign error:', err.message);
    return res.status(500).json({ success: false, error: 'Signing failed.' });
  }
});

// Verify ECDSA signature
router.post('/verify', requireAuth, (req, res) => {
  try {
    const { messageHash, signature, publicKey } = req.body;

    if (!messageHash || !signature || !publicKey) {
      return res.status(400).json({ success: false, error: 'messageHash, signature, and publicKey are required.' });
    }

    if (!signature.r || !signature.s) {
      return res.status(400).json({ success: false, error: 'Signature must contain r and s components.' });
    }

    const result = CryptoService.verifySignature(messageHash, signature, publicKey);

    // Record the operation
    const userId = req.session.user.user_id;
    CryptoService.recordSigningOperation(userId, 'verify', messageHash, result.timeMs, result.valid);

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Crypto] Verify error:', err.message);
    return res.status(500).json({ success: false, error: 'Verification failed.' });
  }
});

// Record signing operation (called from client after signing)
router.post('/record-sign', requireAuth, (req, res) => {
  try {
    const { txData, txHash, publicKey, signatureR, signatureS, timeMs } = req.body;

    if (!txHash) {
      return res.status(400).json({ success: false, error: 'txHash is required.' });
    }

    // Record as a transaction
    const txResult = BlockchainService.recordTransaction(
      txData || '', txHash, publicKey, signatureR, signatureS
    );

    // Record the signing operation metric
    const userId = req.session.user.user_id;
    CryptoService.recordSigningOperation(userId, 'sign', txHash, timeMs || 0, true);

    return res.json({ success: true, tx_id: txResult.tx_id });
  } catch (err) {
    console.error('[Crypto] Record sign error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to record signing operation.' });
  }
});

// Build Merkle tree
router.post('/merkle/build', requireAuth, (req, res) => {
  try {
    const { txHashes } = req.body;

    if (!txHashes || !Array.isArray(txHashes) || txHashes.length === 0) {
      return res.status(400).json({ success: false, error: 'txHashes array is required.' });
    }

    const result = CryptoService.buildMerkleTree(txHashes);

    // Record
    const userId = req.session.user.user_id;
    CryptoService.recordMerkleOperation(userId, 'build', txHashes.length, result.levels, result.timeMs);

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Crypto] Merkle build error:', err.message);
    return res.status(500).json({ success: false, error: 'Merkle tree construction failed.' });
  }
});

// Generate Merkle proof
router.post('/merkle/proof', requireAuth, (req, res) => {
  try {
    const { txHashes, leafIndex } = req.body;

    if (!txHashes || leafIndex === undefined) {
      return res.status(400).json({ success: false, error: 'txHashes and leafIndex are required.' });
    }

    const start = performance.now();
    const result = CryptoService.generateMerkleProof(txHashes, leafIndex);
    const timeMs = parseFloat((performance.now() - start).toFixed(4));

    // Save the proof record
    const proofRecord = BlockchainService.saveMerkleProof(
      null, null, result.proof, result.root, result.valid
    );

    // Record metric
    const userId = req.session.user.user_id;
    CryptoService.recordMerkleOperation(userId, 'proof', txHashes.length, result.proof.length, timeMs);

    return res.json({
      success: true,
      ...result,
      proof_id: proofRecord.proof_id,
      timeMs
    });
  } catch (err) {
    console.error('[Crypto] Merkle proof error:', err.message);
    return res.status(500).json({ success: false, error: 'Merkle proof generation failed.' });
  }
});

// Verify Merkle proof
router.post('/merkle/verify', requireAuth, (req, res) => {
  try {
    const { leafHash, proof } = req.body;
    const expectedRoot = req.body.expectedRoot || req.body.root;

    if (!leafHash || !proof || !expectedRoot) {
      return res.status(400).json({ success: false, error: 'leafHash, proof, and expectedRoot are required.' });
    }

    const result = CryptoService.verifyMerkleProof(leafHash, proof, expectedRoot);

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Crypto] Merkle verify error:', err.message);
    return res.status(500).json({ success: false, error: 'Merkle proof verification failed.' });
  }
});

module.exports = router;
