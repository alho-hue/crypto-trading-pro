const mongoose = require('mongoose');

/**
 * 📊 Modèle Activity - Journal d'activités utilisateur
 * Historique complet des actions: trades, dépôts, connexions, etc.
 */
const activitySchema = new mongoose.Schema({
  // Utilisateur
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },

  // Type d'activité
  type: {
    type: String,
    required: true,
    enum: [
      'trade',           // Trade exécuté
      'deposit',         // Dépôt effectué
      'withdrawal',      // Retrait effectué
      'login',           // Connexion
      'logout',          // Déconnexion
      'settings_change', // Changement paramètres
      'api_key_update',  // Mise à jour clés API
      'bot_start',       // Démarrage bot
      'bot_stop',        // Arrêt bot
      'alert_triggered', // Alerte déclenchée
      'position_opened', // Position ouverte
      'position_closed', // Position fermée
      'profile_update',  // Mise à jour profil
      'security_event',  // Événement sécurité
      'other'
    ],
    index: true
  },

  // Description
  description: {
    type: String,
    required: true
  },

  // Métadonnées spécifiques selon le type
  metadata: {
    // Pour trades
    symbol: String,
    side: String,      // BUY/SELL
    quantity: Number,
    price: Number,
    pnl: Number,
    
    // Pour dépôts/retraits
    amount: Number,
    currency: String,
    method: String,    // mobile_money, crypto, etc.
    
    // Pour connexions
    ip: String,
    userAgent: String,
    
    // Pour alertes
    alertId: String,
    triggerPrice: Number,
    
    // Generic
    status: String,
    error: String,
    extra: mongoose.Schema.Types.Mixed
  },

  // Niveau d'importance
  level: {
    type: String,
    enum: ['info', 'success', 'warning', 'error', 'critical'],
    default: 'info'
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index composés pour requêtes fréquentes
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ userId: 1, type: 1, createdAt: -1 });
activitySchema.index({ type: 1, level: 1, createdAt: -1 });

// Méthodes statiques
activitySchema.statics.getRecentByUser = async function(userId, limit = 20, type = null) {
  const query = { userId };
  if (type) query.type = type;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

activitySchema.statics.getStatsByUser = async function(userId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: since } } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        lastActivity: { $max: '$createdAt' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

activitySchema.statics.logActivity = async function(userId, username, type, description, metadata = {}, level = 'info') {
  try {
    const activity = new this({
      userId,
      username,
      type,
      description,
      metadata,
      level
    });
    
    await activity.save();
    return activity;
  } catch (error) {
    console.error('[Activity] Failed to log:', error);
    return null;
  }
};

// Hooks
activitySchema.pre('save', function(next) {
  // Cleanup old activities (keep only last 90 days)
  // This would be done via a cron job in production
  next();
});

module.exports = mongoose.model('Activity', activitySchema);
