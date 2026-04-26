const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Generate JWT Token - utilise 'id' pour correspondre au middleware auth.js
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
};

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit faire au moins 6 caractères'),
  body('username').trim().isLength({ min: 3, max: 20 }).withMessage('Le username doit faire entre 3 et 20 caractères'),
  validate
], async (req, res) => {
  try {
    const { email, password, username, displayName } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username: username.toLowerCase() }] });
    if (existingUser) {
      return res.status(400).json({ 
        error: existingUser.email === email ? 'Email déjà utilisé' : 'Username déjà pris' 
      });
    }
    
    // Create user
    const user = new User({
      email,
      password,
      username: username.toLowerCase(),
      displayName: displayName || username
    });
    
    await user.save();
    
    // Generate token
    const token = generateToken(user._id);
    
    res.status(201).json({
      message: 'Inscription réussie',
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        createdAt: user.createdAt,
        stats: user.stats,
        isPublic: user.isPublic,
        allowCopyTrading: user.allowCopyTrading
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists(),
  validate
], async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    // Update last active
    user.lastActive = new Date();
    user.isOnline = true;
    await user.save();
    
    // Generate token
    const token = generateToken(user._id);
    
    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        createdAt: user.createdAt,
        stats: user.stats,
        isPublic: user.isPublic,
        allowCopyTrading: user.allowCopyTrading
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token manquant' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id)
      .populate('followers', 'username displayName avatar')
      .populate('following', 'username displayName avatar');
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json({
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        phone: user.phone,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location,
        stats: user.stats,
        isPublic: user.isPublic,
        allowCopyTrading: user.allowCopyTrading,
        followers: user.followerCount,
        following: user.followingCount,
        winRate: user.winRate,
        isOnline: user.isOnline,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      await User.findByIdAndUpdate(decoded.id, { isOnline: false });
    }
    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    res.json({ message: 'Déconnexion réussie' });
  }
});

// @route   GET /api/auth/sessions
// @desc    Get user sessions/devices
// @access  Private
router.get('/sessions', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token manquant' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Retourner une session par défaut (current)
    const sessions = [{
      id: 'current',
      device: req.headers['user-agent']?.split(' ')[0] || 'Navigateur',
      browser: req.headers['user-agent'] || 'Unknown',
      ip: req.ip || req.connection.remoteAddress || '127.0.0.1',
      location: 'Local',
      lastActive: new Date().toISOString(),
      current: true
    }];
    
    res.json({ sessions });
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// @route   DELETE /api/auth/sessions/:id
// @desc    Revoke a session
// @access  Private
router.delete('/sessions/:id', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token manquant' });
    }
    
    // Pour l'instant, on accepte toujours la révocation
    res.json({ success: true, message: 'Session révoquée' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
