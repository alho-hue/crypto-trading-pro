const mongoose = require('mongoose');

/**
 * 🚨 Modèle Report - Signalements utilisateurs pour modération
 */
const reportSchema = new mongoose.Schema({
  // Qui signale
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  reporterUsername: {
    type: String,
    required: true
  },

  // Quoi est signalé
  targetType: {
    type: String,
    enum: ['user', 'message', 'post', 'comment', 'trade', 'other'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  targetUsername: {
    type: String
  },

  // Pourquoi
  reason: {
    type: String,
    required: true,
    enum: [
      'spam',
      'harassment',
      'hate_speech',
      'inappropriate_content',
      'scam',
      'fake_account',
      'cheating',
      'other'
    ]
  },
  description: {
    type: String,
    maxlength: 1000
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },

  // Statut
  status: {
    type: String,
    enum: ['pending', 'investigating', 'resolved', 'dismissed'],
    default: 'pending',
    index: true
  },

  // Preuves
  evidence: [{
    type: String // URLs ou références
  }],

  // Résolution
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedByUsername: {
    type: String
  },
  resolution: {
    type: String,
    enum: ['warning', 'temp_ban', 'perm_ban', 'content_removed', 'dismissed', 'other']
  },
  resolutionNote: {
    type: String
  },
  resolvedAt: {
    type: Date
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index composés
reportSchema.index({ status: 1, severity: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1 });

// Middleware pre-save
reportSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Méthodes statiques
reportSchema.statics.getPendingCount = async function() {
  return this.countDocuments({ status: 'pending' });
};

reportSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return stats.reduce((acc, stat) => {
    acc[stat._id] = stat.count;
    return acc;
  }, { pending: 0, investigating: 0, resolved: 0, dismissed: 0 });
};

module.exports = mongoose.model('Report', reportSchema);
