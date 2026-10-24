/**
 * Dashboard Routes
 * GET /api/dashboard - Get all dashboard metrics
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const DashboardService = require('../services/dashboardService');

router.get('/', requireAuth, (req, res) => {
  try {
    const data = DashboardService.getDashboardData();
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[Dashboard] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load dashboard data.' });
  }
});

module.exports = router;
