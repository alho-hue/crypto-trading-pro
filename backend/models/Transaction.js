const mongoose = require('mongoose');

/**
 * 💳 Modèle Transaction - Historique des transactions financières
 * Dépôts, retraits, trades, conversions
 */
const transactionSchema = new mongoose.Schema({
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

  // Type de transaction
  type: {
    type: String,
    required: true,
    enum: [
      'deposit',        // Dépôt
      'withdrawal',     // Retrait
      'trade',          // Trade/achat
      'transfer',       // Transfert interne
      'fee',            // Frais
      'referral',       // Bonus parrainage
      'conversion',     // Conversion devise
      'refund',         // Remboursement
      'other'
    ],
    index: true
  },

  // Statut
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'processing'],
    default: 'pending',
    index: true
  },

  // Montants
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'USDT'
  },
  
  // Pour conversions (optionnel)
  fromCurrency: String,
  toCurrency: String,
  exchangeRate: Number,

  // Détails selon le type
  details: {
    // Pour dépôts/retraits
    method: String,           // mobile_money, bank_transfer, crypto
    provider: String,         // Orange, Wave, MTN, Binance
    phoneNumber: String,      // Pour mobile money
    walletAddress: String,    // Pour crypto
    transactionHash: String,  // Pour crypto
    
    // Pour trades
    symbol: String,
    side: String,            // BUY, SELL
    orderType: String,       // MARKET, LIMIT
    price: Number,
    quantity: Number,
    
    // Général
    description: String,
    reference: String,         // ID externe (Orange, Wave, etc.)
    receipt: String          // URL ou données du reçu
  },

  // Frais
  fees: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'USDT' },
    percentage: { type: Number, default: 0 }
  },

  // Métadonnées
  metadata: {
    ip: String,
    userAgent: String,
    location: String,
    device: String,
    notes: String
  },

  // Liens vers d'autres entités
  links: {
    tradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade' },
    alertId: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert' },
    botId: String
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
  },
  completedAt: Date
});

// Index composés
transactionSchema.index({ userId: 1, type: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, status: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1, createdAt: -1 });
transactionSchema.index({ 'details.reference': 1 });
transactionSchema.index({ createdAt: -1 });

// Méthodes statiques
transactionSchema.statics.getByUser = async function(userId, limit = 50, type = null) {
  const query = { userId };
  if (type) query.type = type;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

transactionSchema.statics.getStats = async function(userId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    { 
      $match: { 
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: since },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalFees: { $sum: '$fees.amount' }
      }
    }
  ]);
  
  return stats;
};

transactionSchema.statics.getVolumeStats = async function(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        volume: { $sum: '$amount' },
        fees: { $sum: '$fees.amount' }
      }
    }
  ]);
};

// Middleware pre-save
transactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
