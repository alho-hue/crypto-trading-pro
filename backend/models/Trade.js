const mongoose = require('mongoose');

/**
 * NEUROVEST - Trade Model
 * Modèle complet pour la persistance des trades en production
 */

const tradeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  side: {
    type: String,
    enum: ['buy', 'sell', 'BUY', 'SELL', 'LONG', 'SHORT'],
    required: true
  },
  type: {
    type: String,
    enum: ['market', 'limit', 'stop_loss', 'take_profit', 'trailing_stop'],
    default: 'market'
  },
  
  // === POSITION SIZE ===
  quantity: {
    type: Number,
    required: true
  },
  filledQuantity: {
    type: Number,
    default: 0
  },
  
  // === PRICES ===
  entryPrice: {
    type: Number,
    required: true
  },
  exitPrice: {
    type: Number
  },
  averageEntryPrice: {
    type: Number
  },
  averageExitPrice: {
    type: Number
  },
  
  // === RISK MANAGEMENT ===
  stopLoss: {
    type: Number
  },
  takeProfit: {
    type: Number
  },
  trailingStopPercent: {
    type: Number
  },
  trailingStopPrice: {
    type: Number
  },
  highWatermark: {
    type: Number
  },
  
  // === P&L ===
  pnl: {
    type: Number,
    default: 0
  },
  pnlPercent: {
    type: Number,
    default: 0
  },
  unrealizedPnl: {
    type: Number,
    default: 0
  },
  fees: {
    type: Number,
    default: 0
  },
  
  // === BINANCE ORDER IDs ===
  orderId: {
    type: String
  },
  clientOrderId: {
    type: String
  },
  stopLossOrderId: {
    type: String
  },
  takeProfitOrderId: {
    type: String
  },
  
  // === TRADE METADATA ===
  status: {
    type: String,
    enum: ['pending', 'open', 'partially_filled', 'closed', 'cancelled', 'rejected'],
    default: 'pending'
  },
  isAutoTrade: {
    type: Boolean,
    default: false
  },
  paperTrading: {
    type: Boolean,
    default: true
  },
  strategy: {
    type: String
  },
  reasoning: {
    type: String
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100
  },
  
  // === TIMESTAMPS ===
  entryTime: {
    type: Date,
    default: Date.now
  },
  exitTime: {
    type: Date
  },
  lastUpdateTime: {
    type: Date,
    default: Date.now
  },
  duration: {
    type: Number // en secondes
  },
  
  // === EXIT REASON ===
  exitReason: {
    type: String,
    enum: ['stop_loss', 'take_profit', 'trailing_stop', 'manual', 'signal', 'liquidation', 'timeout', 'system']
  },
  
  // === LEVERAGE (Futures) ===
  leverage: {
    type: Number,
    default: 1
  },
  marginType: {
    type: String,
    enum: ['isolated', 'crossed'],
    default: 'crossed'
  }
}, {
  timestamps: true
});

// Calculer la durée avant de sauvegarder
tradeSchema.pre('save', function(next) {
  if (this.exitTime && this.entryTime) {
    this.duration = Math.floor((this.exitTime - this.entryTime) / 1000);
  }
  next();
});

// Index pour les requêtes fréquentes
tradeSchema.index({ userId: 1, status: 1 });
tradeSchema.index({ symbol: 1, entryTime: -1 });
tradeSchema.index({ userId: 1, isAutoTrade: 1 });

module.exports = mongoose.model('Trade', tradeSchema);
