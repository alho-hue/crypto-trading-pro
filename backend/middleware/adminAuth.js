const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AdminLog = require('../models/AdminLog');

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_TOKEN_EXPIRY = process.env.ADMIN_TOKEN_EXPIRY || '8h'; // Durée de vie du token admin

// Hierarchie des rôles (du plus élevé au plus bas)
const ROLE_HIERARCHY = {
  'super_admin': 4,
  'admin': 3,
  'moderator': 2,
  'user': 1
};

// Permissions par rôle
const ROLE_PERMISSIONS = {
  'super_admin': ['*'], // Toutes les permissions
  'admin': [
    'users:read', 'users:ban', 'users:unban', 'users:update',
    'trades:read', 'trades:cancel', 'trades:delete',
    'wallet:read', 'transactions:read', 'transactions:verify',
    'analytics:read', 'system:read', 'settings:read', 'logs:read',
    'bots:read', 'bots:config', 'bots:start', 'bots:stop'
  ],
  'moderator': [
    'users:read', 'users:ban', 'users:unban',
    'messages:read', 'messages:delete', 'messages:edit',
    'channels:read', 'reports:read', 'reports:resolve',
    'community:moderate'
  ],
  'user': [] // Aucune permission admin
};

/**
 * 🔐 Middleware requireRole - Vérifie le JWT et les permissions requises
 * @param {Array} allowedRoles - Rôles autorisés ['super_admin', 'admin', 'moderator']
 * @param {String} permission - Permission spécifique requise (optionnel)
 */
function requireRole(allowedRoles, permission = null) {
  return async (req, res, next) => {
    try {
      // 1. Vérifier le token
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        return res.status(401).json({ 
          error: 'Access denied. No token provided.',
          code: 'NO_TOKEN'
        });
      }

      // 2. Vérifier et décoder le JWT
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          return res.status(403).json({ 
            error: 'Token expired. Please login again.',
            code: 'TOKEN_EXPIRED'
          });
        }
        return res.status(403).json({ 
          error: 'Invalid token.',
          code: 'INVALID_TOKEN'
        });
      }

      // 3. Récupérer l'utilisateur avec son rôle
      const userId = decoded.id || decoded.userId;
      const user = await User.findById(userId).select('+role +isAdmin +isBanned');

      if (!user) {
        return res.status(401).json({ 
          error: 'User not found.',
          code: 'USER_NOT_FOUND'
        });
      }

      // 4. Vérifier si l'utilisateur est banni
      if (user.isBanned) {
        return res.status(403).json({ 
          error: 'Account is banned.',
          code: 'ACCOUNT_BANNED',
          banReason: user.banReason
        });
      }

      // 5. Migration : si isAdmin=true mais pas de role spécifique
      let userRole = user.role;
      if (user.isAdmin && user.role === 'user') {
        userRole = 'admin';
      }

      // 6. Vérifier le rôle
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ 
          error: 'Access denied. Insufficient privileges.',
          code: 'INSUFFICIENT_ROLE',
          required: allowedRoles,
          current: userRole
        });
      }

      // 7. Vérifier la permission spécifique si demandée
      if (permission && userRole !== 'super_admin') {
        const permissions = ROLE_PERMISSIONS[userRole] || [];
        if (!permissions.includes(permission) && !permissions.includes('*')) {
          return res.status(403).json({ 
            error: 'Access denied. Missing permission.',
            code: 'MISSING_PERMISSION',
            required: permission
          });
        }
      }

      // 8. Ajouter les infos utilisateur à la requête
      req.user = {
        id: user._id,
        email: user.email,
        username: user.username,
        role: userRole,
        isAdmin: user.isAdmin || userRole !== 'user'
      };
      req.userId = user._id;
      req.userRole = userRole;

      next();
    } catch (error) {
      console.error('[requireRole] Error:', error);
      return res.status(500).json({ 
        error: 'Authentication error.',
        code: 'AUTH_ERROR'
      });
    }
  };
}

/**
 * 🔐 Middleware optionnel - Authentification admin optionnelle
 * Utile pour les routes qui peuvent bénéficier du contexte admin
 */
async function optionalAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      req.userRole = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id || decoded.userId;
    const user = await User.findById(userId).select('role email username');

    if (user && ['super_admin', 'admin', 'moderator'].includes(user.role)) {
      req.user = {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role
      };
      req.userRole = user.role;
    } else {
      req.user = null;
      req.userRole = null;
    }

    next();
  } catch {
    req.user = null;
    req.userRole = null;
    next();
  }
}

/**
 * 📝 Fonction pour logger les actions admin
 * À appeler dans les handlers de routes admin
 */
async function logAdminAction(req, action, description, options = {}) {
  try {
    if (!req.user || !req.userRole) return;

    const clientIP = req.ip || req.connection.remoteAddress || 
                      req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                      req.headers['x-real-ip'] || 'unknown';

    await AdminLog.log({
      adminId: req.user.id,
      adminEmail: req.user.email,
      adminRole: req.userRole,
      action,
      description,
      targetId: options.targetId,
      targetType: options.targetType,
      targetDetails: options.targetDetails,
      previousData: options.previousData,
      newData: options.newData,
      status: options.status || 'success',
      errorMessage: options.errorMessage,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      requestPath: req.path,
      requestMethod: req.method,
      severity: options.severity || 'low',
      notes: options.notes
    });
  } catch (error) {
    console.error('[logAdminAction] Failed to log:', error);
  }
}

/**
 * 🛡️ Middleware de rate limiting spécifique pour admin
 * Stocké en mémoire (pour production, utiliser Redis)
 */
const adminLoginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function adminRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  const attempts = adminLoginAttempts.get(ip);
  
  if (attempts) {
    // Vérifier si lockout actif
    if (attempts.lockedUntil && attempts.lockedUntil > now) {
      const remainingMinutes = Math.ceil((attempts.lockedUntil - now) / 60000);
      return res.status(429).json({
        error: `Too many failed attempts. Account locked for ${remainingMinutes} minutes.`,
        code: 'ACCOUNT_LOCKED',
        lockedUntil: attempts.lockedUntil
      });
    }

    // Réinitialiser si le lockout est expiré
    if (attempts.lockedUntil && attempts.lockedUntil <= now) {
      adminLoginAttempts.delete(ip);
    }
  }

  req.recordFailedAttempt = () => {
    const current = adminLoginAttempts.get(ip) || { count: 0, lastAttempt: now };
    current.count++;
    current.lastAttempt = now;

    if (current.count >= MAX_LOGIN_ATTEMPTS) {
      current.lockedUntil = now + LOCKOUT_DURATION;
    }

    adminLoginAttempts.set(ip, current);
  };

  req.clearAttempts = () => {
    adminLoginAttempts.delete(ip);
  };

  next();
}

/**
 * 🎯 Helper pour vérifier si un rôle a accès à un autre rôle
 * (ex: super_admin peut gérer admin, mais admin ne peut pas gérer super_admin)
 */
function canManageRole(adminRole, targetRole) {
  return ROLE_HIERARCHY[adminRole] > ROLE_HIERARCHY[targetRole];
}

/**
 * 🔑 Générer un token JWT spécifique pour admin (avec durée plus courte)
 */
function generateAdminToken(user) {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email,
      username: user.username,
      role: user.role,
      type: 'admin'
    },
    JWT_SECRET,
    { expiresIn: ADMIN_TOKEN_EXPIRY }
  );
}

module.exports = {
  requireRole,
  optionalAdminAuth,
  logAdminAction,
  adminRateLimit,
  canManageRole,
  generateAdminToken,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  ADMIN_TOKEN_EXPIRY
};
