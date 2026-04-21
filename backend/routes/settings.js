// Routes pour les paramètres utilisateur
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken: auth } = require('../middleware/auth');

// @route   GET /api/settings
// @desc    Get user settings
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      settings: {
        theme: user.settings?.theme || 'dark',
        language: user.settings?.language || 'fr',
        notifications: user.settings?.notifications || {
          trades: true,
          alerts: true,
          signals: true,
          marketing: false,
          security: true
        },
        trading: user.settings?.trading || {
          realTradingEnabled: false,
          aiEnabled: false,
          aiAggressiveness: 50,
          aiScoreThreshold: 70,
          botEnabled: false,
          botMode: 'SAFE',
          botRiskPerTrade: 2,
          autoRefresh: true
        }
      },
      binanceConnected: !!(user.encryptedApiKeys?.binanceApiKey)
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// @route   PUT /api/settings
// @desc    Update user settings
// @access  Private
router.put('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update settings
    user.settings = { ...user.settings, ...req.body };
    await user.save();

    res.json({
      success: true,
      message: 'Settings updated',
      settings: user.settings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// @route   DELETE /api/data/reset
// @desc    Reset all user data (DANGER)
// @access  Private
router.delete('/data/reset', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Reset settings to default
    user.settings = {
      theme: 'dark',
      language: 'fr',
      notifications: {
        trades: true,
        alerts: true,
        signals: true,
        marketing: false,
        security: true
      },
      trading: {
        realTradingEnabled: false,
        aiEnabled: false,
        aiAggressiveness: 50,
        aiScoreThreshold: 70,
        botEnabled: false,
        botMode: 'SAFE',
        botRiskPerTrade: 2,
        autoRefresh: true
      }
    };

    // Clear API keys
    user.encryptedApiKeys = undefined;
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;

    await user.save();

    res.json({
      success: true,
      message: 'All data reset successfully'
    });
  } catch (error) {
    console.error('Error resetting data:', error);
    res.status(500).json({ error: 'Failed to reset data' });
  }
});

module.exports = router;
