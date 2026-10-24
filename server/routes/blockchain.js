/**
 * Blockchain Routes
 * POST   /api/blockchain/block     - Create a new block
 * GET    /api/blockchain/chain     - Get full chain
 * GET    /api/blockchain/block/:id - Get block by ID
 * GET    /api/blockchain/verify    - Verify chain integrity
 * POST   /api/blockchain/tamper    - Tamper with a block (demo)
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const BlockchainService = require('../services/blockchainService');

// Create a new block
router.post('/block', requireAuth, (req, res) => {
  try {
    const { transactions } = req.body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one transaction is required.' });
    }

    // Validate transactions
    for (const tx of transactions) {
      if (!tx.tx_data || !tx.tx_hash) {
        return res.status(400).json({ success: false, error: 'Each transaction must have tx_data and tx_hash.' });
      }
    }

    const block = BlockchainService.createBlock(transactions);
    return res.status(201).json({ success: true, block });
  } catch (err) {
    console.error('[Blockchain] Create block error:', err.message);
    return res.status(500).json({ success: false, error: 'Block creation failed.' });
  }
});

// Get full chain
router.get('/chain', requireAuth, (req, res) => {
  try {
    const chain = BlockchainService.getChain();
    return res.json({ success: true, chain, length: chain.length });
  } catch (err) {
    console.error('[Blockchain] Get chain error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve chain.' });
  }
});

// Get block by ID
router.get('/block/:id', requireAuth, (req, res) => {
  try {
    const blockId = parseInt(req.params.id, 10);
    const block = BlockchainService.getBlock(blockId);

    if (!block) {
      return res.status(404).json({ success: false, error: 'Block not found.' });
    }

    return res.json({ success: true, block });
  } catch (err) {
    console.error('[Blockchain] Get block error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve block.' });
  }
});

// Verify chain integrity
router.get('/verify', requireAuth, (req, res) => {
  try {
    const results = BlockchainService.verifyChain();
    const allValid = results.every(r => r.hashValid && r.linkValid);
    return res.json({ success: true, valid: allValid, results });
  } catch (err) {
    console.error('[Blockchain] Verify chain error:', err.message);
    return res.status(500).json({ success: false, error: 'Chain verification failed.' });
  }
});

// Tamper with a block (educational demonstration)
router.post('/tamper', requireAuth, (req, res) => {
  try {
    const { blockId, newMerkleRoot } = req.body;

    if (!blockId || !newMerkleRoot) {
      return res.status(400).json({ success: false, error: 'blockId and newMerkleRoot are required.' });
    }

    const block = BlockchainService.tamperBlock(blockId, newMerkleRoot);
    const verification = BlockchainService.verifyChain();

    return res.json({
      success: true,
      message: 'Block tampered for demonstration. Chain integrity is now broken.',
      block,
      verification
    });
  } catch (err) {
    console.error('[Blockchain] Tamper error:', err.message);
    return res.status(500).json({ success: false, error: 'Tamper operation failed.' });
  }
});

// Reset blockchain to genesis block
router.post('/reset', requireAuth, (req, res) => {
  try {
    const chain = BlockchainService.resetChain();
    return res.json({ success: true, message: 'Blockchain reset to genesis state.', chain });
  } catch (err) {
    console.error('[Blockchain] Reset error:', err.message);
    return res.status(500).json({ success: false, error: 'Reset failed.' });
  }
});

module.exports = router;
