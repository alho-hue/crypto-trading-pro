// Routes pour la sécurité (2FA, chiffrement API, whitelist IP)
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const securityService = require('../services/securityService');
const User = require('../models/User');
const { authenticateToken: auth } = require('../middleware/auth');

// @route   POST /api/security/2fa/setup
// @desc    Setup 2FA for user
// @access  Private
router.post('/2fa/setup', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }
    
    // Generate TOTP secret
    const secret = securityService.generateTOTPSecret();
    
    // Generate QR code
    const qrCodeUrl = await securityService.generateTOTPQRCode(secret, user.email);
    
    // Store temp secret
    user.twoFactorTempSecret = secret.base32;
    await user.save();
    
    res.json({
      success: true,
      qrCode: qrCodeUrl,
      secret: secret.base32, // Only show once for manual entry
      message: 'Scan the QR code with your authenticator app'
    });
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

// @route   POST /api/security/2fa/verify
// @desc    Verify and enable 2FA
// @access  Private
router.post('/2fa/verify', [
  auth,
  body('token').isLength({ min: 6, max: 6 }).isNumeric()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findById(req.user.id).select('+twoFactorTempSecret');
    
    if (!user.twoFactorTempSecret) {
      return res.status(400).json({ error: '2FA setup not initiated' });
    }
    
    // Verify token
    const isValid = securityService.verifyTOTP(req.body.token, user.twoFactorTempSecret);
    
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Enable 2FA
    user.twoFactorSecret = user.twoFactorTempSecret;
    user.twoFactorEnabled = true;
    user.twoFactorTempSecret = undefined;
    await user.save();
    
    res.json({
      success: true,
      message: '2FA enabled successfully'
    });
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

// @route   POST /api/security/2fa/disable
// @desc    Disable 2FA
// @access  Private
router.post('/2fa/disable', [
  auth,
  body('token').isLength({ min: 6, max: 6 }).isNumeric()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findById(req.user.id).select('+twoFactorSecret');
    
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }
    
    // Verify token before disabling
    const isValid = securityService.verifyTOTP(req.body.token, user.twoFactorSecret);
    
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();
    
    res.json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// @route   POST /api/security/api-keys
// @desc    Store encrypted API keys
// @access  Private
router.post('/api-keys', [
  auth,
  body('apiKey').notEmpty(),
  body('secretKey').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { apiKey, secretKey } = req.body;
    
    // Validate API key security
    const security = securityService.validateApiKeySecurity(apiKey);
    if (!security.isSecure) {
      return res.status(400).json({ 
        error: 'API key security issues detected',
        issues: security.issues 
      });
    }
    
    // Encrypt keys
    const encryptedApiKey = securityService.encryptApiKey(apiKey);
    const encryptedSecretKey = securityService.encryptApiKey(secretKey);
    
    if (!encryptedApiKey || !encryptedSecretKey) {
      return res.status(500).json({ error: 'Failed to encrypt API keys' });
    }
    
    // Update user
    const user = await User.findById(req.user.id);
    user.encryptedApiKeys = {
      binanceApiKey: encryptedApiKey,
      binanceSecretKey: encryptedSecretKey,
      lastRotatedAt: new Date()
    };
    await user.save();
    
    res.json({
      success: true,
      message: 'API keys stored securely'
    });
  } catch (error) {
    console.error('Error storing API keys:', error);
    res.status(500).json({ error: 'Failed to store API keys' });
  }
});

// @route   GET /api/security/api-keys
// @desc    Check if API keys are configured
// @access  Private
router.get('/api-keys', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('encryptedApiKeys');
    
    const hasKeys = !!(user.encryptedApiKeys?.binanceApiKey && user.encryptedApiKeys?.binanceSecretKey);
    const lastRotated = user.encryptedApiKeys?.lastRotatedAt;
    
    // Calculate days since rotation
    let daysSinceRotation = null;
    if (lastRotated) {
      daysSinceRotation = Math.floor((Date.now() - new Date(lastRotated).getTime()) / (1000 * 60 * 60 * 24));
    }
    
    res.json({
      configured: hasKeys,
      lastRotated,
      daysSinceRotation,
      shouldRotate: daysSinceRotation && daysSinceRotation > 90
    });
  } catch (error) {
    console.error('Error checking API keys:', error);
    res.status(500).json({ error: 'Failed to check API keys' });
  }
});

// @route   DELETE /api/security/api-keys
// @desc    Remove stored API keys
// @access  Private
router.delete('/api-keys', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.encryptedApiKeys = undefined;
    await user.save();
    
    res.json({
      success: true,
      message: 'API keys removed'
    });
  } catch (error) {
    console.error('Error removing API keys:', error);
    res.status(500).json({ error: 'Failed to remove API keys' });
  }
});

// @route   POST /api/security/ip-whitelist
// @desc    Add IP to whitelist
// @access  Private
router.post('/ip-whitelist', [
  auth,
  body('ip').isIP()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findById(req.user.id);
    
    if (!user.allowedIPs.includes(req.body.ip)) {
      user.allowedIPs.push(req.body.ip);
      await user.save();
    }
    
    res.json({
      success: true,
      allowedIPs: user.allowedIPs
    });
  } catch (error) {
    console.error('Error adding IP:', error);
    res.status(500).json({ error: 'Failed to add IP' });
  }
});

// @route   DELETE /api/security/ip-whitelist/:ip
// @desc    Remove IP from whitelist
// @access  Private
router.delete('/ip-whitelist/:ip', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    user.allowedIPs = user.allowedIPs.filter(ip => ip !== req.params.ip);
    await user.save();
    
    res.json({
      success: true,
      allowedIPs: user.allowedIPs
    });
  } catch (error) {
    console.error('Error removing IP:', error);
    res.status(500).json({ error: 'Failed to remove IP' });
  }
});

// @route   PUT /api/security/ip-whitelist/toggle
// @desc    Enable/disable IP whitelist
// @access  Private
router.put('/ip-whitelist/toggle', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    user.ipWhitelistEnabled = !user.ipWhitelistEnabled;
    await user.save();
    
    res.json({
      success: true,
      enabled: user.ipWhitelistEnabled
    });
  } catch (error) {
    console.error('Error toggling IP whitelist:', error);
    res.status(500).json({ error: 'Failed to toggle IP whitelist' });
  }
});

// @route   GET /api/security/audit
// @desc    Get security audit for user
// @access  Private
router.get('/audit', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const audit = await securityService.auditSecuritySettings(user);
    
    res.json(audit);
  } catch (error) {
    console.error('Error running security audit:', error);
    res.status(500).json({ error: 'Failed to run security audit' });
  }
});

// @route   POST /api/security/password
// @desc    Change password
// @access  Private
router.post('/password', [
  auth,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findById(req.user.id);
    
    // Verify current password
    const isMatch = await user.comparePassword(req.body.currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Update password
    user.password = req.body.newPassword;
    user.passwordChangedAt = new Date();
    await user.save();
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
