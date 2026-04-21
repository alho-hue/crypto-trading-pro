const mongoose = require('mongoose');

/**
 * 📝 Modèle AdminLog - Journal d'audit pour toutes les actions admin
 * Obligatoire pour traçabilité et sécurité
 */
const AdminLogSchema = new mongoose.Schema({
  // Admin qui a effectué l'action
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  adminEmail: {
    type: String,
    required: true
  },
  adminRole: {
    type: String,
    enum: ['super_admin', 'admin', 'moderator'],
    required: true
  },

  // Type d'action
  action: {
    type: String,
    enum: [
      // Users
      'USER_BAN', 'USER_UNBAN', 'USER_DELETE', 'USER_UPDATE', 'USER_CREATE',
      // Wallet/Economy
      'WALLET_DEPOSIT_APPROVE', 'WALLET_WITHDRAWAL_APPROVE', 'WALLET_WITHDRAWAL_REJECT',
      'WALLET_BALANCE_UPDATE', 'TRANSACTION_VERIFY',
      // Trading
      'TRADE_CANCEL', 'TRADE_DELETE', 'POSITION_CLOSE', 'TRADING_CONFIG_UPDATE',
      // Community
      'MESSAGE_DELETE', 'MESSAGE_EDIT', 'CHANNEL_CREATE', 'CHANNEL_DELETE',
      'USER_MUTE', 'USER_UNMUTE', 'REPORT_RESOLVE', 'REPORT_REJECT',
      // System
      'SYSTEM_CONFIG_UPDATE', 'RATE_LIMIT_UPDATE', 'API_KEY_ROTATE',
      'MAINTENANCE_MODE', 'BACKUP_CREATE', 'BACKUP_RESTORE',
      // Bots
      'BOT_START', 'BOT_STOP', 'BOT_CONFIG_UPDATE', 'BOT_DELETE',
      // Security
      'IP_WHITELIST_UPDATE', '2FA_RESET', 'PASSWORD_RESET', 'SESSION_REVOKE',
      // Settings
      'GLOBAL_SETTINGS_UPDATE', 'FEE_STRUCTURE_UPDATE', 'LIMITS_UPDATE'
    ],
    required: true,
    index: true
  },

  // Description lisible de l'action
  description: {
    type: String,
    required: true
  },

  // Cible de l'action (user, trade, message, etc.)
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  targetType: {
    type: String,
    enum: ['User', 'Trade', 'Message', 'Transaction', 'Channel', 'Bot', 'System']
  },
  targetDetails: {
    type: mongoose.Schema.Types.Mixed // Informations additionnelles sur la cible
  },

  // Données avant/après pour traçabilité
  previousData: {
    type: mongoose.Schema.Types.Mixed
  },
  newData: {
    type: mongoose.Schema.Types.Mixed
  },

  // Résultat de l'action
  status: {
    type: String,
    enum: ['success', 'failed', 'partial'],
    default: 'success'
  },
  errorMessage: {
    type: String // En cas d'échec
  },

  // Contexte de la requête
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  requestPath: {
    type: String
  },
  requestMethod: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  },

  // Métadonnées
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  notes: {
    type: String // Notes additionnelles par l'admin
  }
}, {
  timestamps: true
});

// Index composés pour requêtes fréquentes
AdminLogSchema.index({ action: 1, createdAt: -1 });
AdminLogSchema.index({ adminId: 1, createdAt: -1 });
AdminLogSchema.index({ targetId: 1, createdAt: -1 });
AdminLogSchema.index({ severity: 1, createdAt: -1 });

// Méthode statique pour créer un log facilement
AdminLogSchema.statics.log = async function(data) {
  try {
    const log = new this(data);
    await log.save();
    return log;
  } catch (error) {
    console.error('[AdminLog] Failed to create log:', error);
    // Ne pas bloquer l'action principale si le logging échoue
    return null;
  }
};

// Méthode pour récupérer les logs récents avec filtres
AdminLogSchema.statics.getRecent = async function(filters = {}, limit = 100) {
  return this.find(filters)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('adminId', 'username email role')
    .populate('targetId')
    .lean();
};

// Méthode pour stats d'activité admin
AdminLogSchema.statics.getActivityStats = async function(days = 7) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          adminId: '$adminId',
          action: '$action'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.adminId',
        actions: {
          $push: {
            action: '$_id.action',
            count: '$count'
          }
        },
        totalActions: { $sum: '$count' }
      }
    },
    { $sort: { totalActions: -1 } }
  ]);
};

module.exports = mongoose.model('AdminLog', AdminLogSchema);
