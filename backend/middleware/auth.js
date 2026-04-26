const jwt = require('jsonwebtoken');
const User = require('../models/User');
const securityService = require('../services/securityService');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET environment variable is required');
  process.exit(1);
}

// Middleware to authenticate JWT token
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch full user to check security settings
    // Support both 'id' and 'userId' token formats for backward compatibility
    const userId = decoded.id || decoded.userId;
    const user = await User.findById(userId).select('+encryptedApiKeys');
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Récupérer les clés API Binance (chiffrées côté client, utilisées telles quelles)
    let binanceApiKey = null;
    let binanceSecretKey = null;
    
    if (user.encryptedApiKeys && user.encryptedApiKeys.binanceApiKey && user.encryptedApiKeys.binanceSecretKey) {
      // Les clés sont chiffrées côté client, on les utilise telles quelles
      // Le client les déchiffrera avec getDecryptedKey()
      binanceApiKey = user.encryptedApiKeys.binanceApiKey;
      binanceSecretKey = user.encryptedApiKeys.binanceSecretKey;
      console.log(`[Auth] Clés API Binance (chiffrées) chargées pour ${user.username}`);
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(403).json({ 
        error: 'Account is locked. Please try again later.' 
      });
    }

    // Check IP whitelist if enabled
    if (user.ipWhitelistEnabled && user.allowedIPs.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress || 
                       req.headers['x-forwarded-for'] || 
                       req.headers['x-real-ip'];
      
      const normalizedIP = clientIP?.split(',')[0]?.trim();
      
      if (!securityService.validateIP(normalizedIP, user.allowedIPs)) {
        return res.status(403).json({ 
          error: 'Access denied. IP not in whitelist.' 
        });
      }
    }

    // Add user to request
    req.user = {
      id: user._id,
      email: user.email,
      username: user.username,
      twoFactorEnabled: user.twoFactorEnabled,
      rateLimitTier: user.rateLimitTier,
      // Clés API Binance (en clair pour compatibilité)
      binanceApiKey: binanceApiKey,
      binanceSecretKey: binanceSecretKey,
      // Clés API Binance dans encryptedApiKeys (pour trading.js)
      encryptedApiKeys: user.encryptedApiKeys || null
    };
    
    // Compatibilité avec routes qui utilisent req.userId
    req.userId = user._id;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    return res.status(403).json({ error: 'Authentication failed' });
  }
}

// Middleware to verify 2FA token
function verify2FA(req, res, next) {
  const { twoFactorToken } = req.body;
  
  if (!req.user.twoFactorEnabled) {
    return next();
  }

  if (!twoFactorToken) {
    return res.status(403).json({ 
      error: '2FA token required',
      requires2FA: true 
    });
  }

  // Note: 2FA verification is handled in the login route
  // This middleware is for additional sensitive operations
  next();
}

// Middleware for optional authentication (public routes that can benefit from user context)
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email };
    req.userId = decoded.id;  // Compatibilité
    next();
  } catch {
    req.user = null;
    next();
  }
}

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email,
      username: user.username 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Generate temporary token for 2FA verification
function generateTempToken(user) {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email,
      pending2FA: true 
    },
    JWT_SECRET,
    { expiresIn: '5m' }
  );
}

module.exports = { 
  authenticateToken, 
  verify2FA, 
  optionalAuth,
  generateToken,
  generateTempToken
};
