// Routes pour les alertes de prix
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const alertService = require('../services/alertService');
const { authenticateToken: auth, optionalAuth } = require('../middleware/auth');
const Alert = require('../models/Alert');

// @route   GET /api/alerts
// @desc    Get all user alerts
// @access  Public/Private
router.get('/', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.json([]);
    }
    const alerts = await alertService.getUserAlerts(req.user.id);
    res.json(alerts);
  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// @route   GET /api/alerts/active
// @desc    Get active alerts
// @access  Public/Private
router.get('/active', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.json([]);
    }
    const alerts = await alertService.getActiveAlerts(req.user.id);
    res.json(alerts);
  } catch (error) {
    console.error('Error getting active alerts:', error);
    res.status(500).json({ error: 'Failed to get active alerts' });
  }
});

// @route   POST /api/alerts
// @desc    Create new alert
// @access  Private
router.post('/', [
  auth,
  body('symbol').notEmpty().trim(),
  body('condition').isIn(['above', 'below', 'crosses_up', 'crosses_down']),
  body('targetPrice').isFloat({ gt: 0 }),
  body('notificationChannels').optional().isArray()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { symbol, condition, targetPrice, notificationChannels } = req.body;
    const alert = await alertService.createAlert(
      req.user.id,
      symbol,
      condition,
      targetPrice,
      notificationChannels || ['push']
    );
    res.json({ success: true, alert });
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/alerts/:id
// @desc    Delete alert
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const success = await alertService.deleteAlert(req.params.id, req.user.id);
    if (!success) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// @route   POST /api/alerts/:id/deactivate
// @desc    Deactivate alert
// @access  Private
router.post('/:id/deactivate', auth, async (req, res) => {
  try {
    const alert = await alertService.deactivateAlert(req.params.id, req.user.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ success: true, alert });
  } catch (error) {
    console.error('Error deactivating alert:', error);
    res.status(500).json({ error: 'Failed to deactivate alert' });
  }
});

// @route   POST /api/alerts/:id/reactivate
// @desc    Reactivate alert
// @access  Private
router.post('/:id/reactivate', auth, async (req, res) => {
  try {
    const alert = await alertService.reactivateAlert(req.params.id, req.user.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ success: true, alert });
  } catch (error) {
    console.error('Error reactivating alert:', error);
    res.status(500).json({ error: 'Failed to reactivate alert' });
  }
});

// @route   PUT /api/alerts/:id
// @desc    Update alert
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const alert = await alertService.updateAlert(req.params.id, req.user.id, req.body);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ success: true, alert });
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// @route   POST /api/alerts/smart
// @desc    Create smart alert based on indicators
// @access  Private
router.post('/smart', [
  auth,
  body('symbol').notEmpty(),
  body('indicatorType').isIn(['rsi_oversold', 'rsi_overbought', 'support', 'resistance', 'percent_drop', 'percent_rise']),
  body('threshold').optional().isFloat()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { symbol, indicatorType, threshold } = req.body;
    const alert = await alertService.createSmartAlert(req.user.id, symbol, indicatorType, threshold);
    res.json({ success: true, alert });
  } catch (error) {
    console.error('Error creating smart alert:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/alerts/command
// @desc    Create alert from natural language command
// @access  Private
router.post('/command', [
  auth,
  body('command').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { command } = req.body;
    const alert = await alertService.createAlertFromCommand(req.user.id, command);
    res.json({ success: true, alert });
  } catch (error) {
    console.error('Error creating alert from command:', error);
    res.status(400).json({ error: error.message });
  }
});

// @route   GET /api/alerts/stats
// @desc    Get alert statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await alertService.getAlertStats(req.user.id);
    res.json(stats);
  } catch (error) {
    console.error('Error getting alert stats:', error);
    res.status(500).json({ error: 'Failed to get alert stats' });
  }
});

// @route   GET /api/alerts/triggered
// @desc    Get triggered alerts history
// @access  Private
router.get('/triggered', auth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const alerts = await Alert.find({
      userId: req.user.id,
      triggered: true
    })
    .sort({ triggeredAt: -1 })
    .limit(parseInt(limit));
    
    res.json(alerts);
  } catch (error) {
    console.error('Error getting triggered alerts:', error);
    res.status(500).json({ error: 'Failed to get triggered alerts' });
  }
});

// @route   POST /api/alerts/market
// @desc    Create market-based alert
// @access  Private
router.post('/market', [
  auth,
  body('alertType').isIn(['high_volatility', 'breakout', 'breakdown']),
  body('symbol').notEmpty(),
  body('params').optional().isObject()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { alertType, symbol, params } = req.body;
    const alert = await alertService.createMarketAlert(req.user.id, alertType, { symbol, ...params });
    res.json({ success: true, alert });
  } catch (error) {
    console.error('Error creating market alert:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/alerts/bulk-delete
// @desc    Delete multiple alerts
// @access  Private
router.post('/bulk-delete', [
  auth,
  body('alertIds').isArray().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { alertIds } = req.body;
    const result = await Alert.deleteMany({
      _id: { $in: alertIds },
      userId: req.user.id
    });
    
    res.json({ 
      success: true, 
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Error bulk deleting alerts:', error);
    res.status(500).json({ error: 'Failed to delete alerts' });
  }
});

module.exports = router;
