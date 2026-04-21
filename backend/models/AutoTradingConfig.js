const mongoose = require('mongoose');

/**
 * NEUROVEST - AutoTrading Configuration Model
 * Configuration complète du bot de trading automatique avec risk management
 */

const autoTradingConfigSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  enabled: {
    type: Boolean,
    default: false
  },
  strategy: {
    type: String,
    enum: ['conservative', 'moderate', 'aggressive'],
    default: 'moderate'
  },
  symbols: [{
    type: String,
    uppercase: true
  }],
  
  // === RISK MANAGEMENT ===
  maxRiskPerTrade: {
    type: Number,
    default: 2, // % du capital
    min: 0.1,
    max: 10
  },
  stopLossPercent: {
    type: Number,
    default: 3,
    min: 0.5,
    max: 20
  },
  takeProfitPercent: {
    type: Number,
    default: 6,
    min: 1,
    max: 50
  },
  trailingStopPercent: {
    type: Number,
    default: 2, // % de trailing
    min: 0.5,
    max: 10
  },
  maxDailyTrades: {
    type: Number,
    default: 10,
    min: 1,
    max: 100
  },
  maxDailyLossPercent: {
    type: Number,
    default: 5, // Stop trading après -5%
    min: 1,
    max: 20
  },
  maxDrawdownPercent: {
    type: Number,
    default: 10, // Stop trading après -10% drawdown
    min: 5,
    max: 50
  },
  maxPositions: {
    type: Number,
    default: 3,
    min: 1,
    max: 20
  },
  
  // === POSITION SIZING ===
  useKellyCriterion: {
    type: Boolean,
    default: false
  },
  kellyFraction: {
    type: Number,
    default: 0.5, // Half-Kelly pour plus de sécurité
    min: 0.1,
    max: 1
  },
  useATRSizing: {
    type: Boolean,
    default: true
  },
  atrPeriod: {
    type: Number,
    default: 14,
    min: 5,
    max: 50
  },
  
  // === LEVERAGE SETTINGS ===
  useLeverage: {
    type: Boolean,
    default: false
  },
  leverage: {
    type: Number,
    default: 1,
    min: 1,
    max: 125
  },
  maxLeverage: {
    type: Number,
    default: 5,
    min: 1,
    max: 125
  },
  
  // === TRADING BEHAVIOR ===
  autoBuy: {
    type: Boolean,
    default: false
  },
  autoSell: {
    type: Boolean,
    default: false
  },
  minConfidence: {
    type: Number,
    default: 70,
    min: 0,
    max: 100
  },
  useMultiTimeframe: {
    type: Boolean,
    default: true
  },
  minRRRatio: {
    type: Number,
    default: 1.5, // Minimum risk/reward ratio
    min: 0.5,
    max: 5
  },
  
  // === PAPER TRADING ===
  paperTrading: {
    type: Boolean,
    default: true // Safe by default
  },
  demoBalance: {
    type: Number,
    default: 10000
  },
  
  // === STATISTICS & TRACKING ===
  startTime: {
    type: Date
  },
  dailyTradeCount: {
    type: Number,
    default: 0
  },
  dailyPnL: {
    type: Number,
    default: 0
  },
  lastTradeTime: {
    type: Date
  },
  totalTrades: {
    type: Number,
    default: 0
  },
  winningTrades: {
    type: Number,
    default: 0
  },
  losingTrades: {
    type: Number,
    default: 0
  },
  totalPnL: {
    type: Number,
    default: 0
  },
  peakValue: {
    type: Number,
    default: 0
  },
  maxDrawdown: {
    type: Number,
    default: 0
  },
  
  // === CORRELATION FILTER ===
  maxCorrelation: {
    type: Number,
    default: 0.8, // Max correlation between positions
    min: 0,
    max: 1
  },
  
  // === TIME RESTRICTIONS ===
  tradingHoursStart: {
    type: String,
    default: '00:00'
  },
  tradingHoursEnd: {
    type: String,
    default: '23:59'
  },
  avoidWeekends: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index pour les requêtes fréquentes
autoTradingConfigSchema.index({ userId: 1 });
autoTradingConfigSchema.index({ enabled: 1 });

module.exports = mongoose.model('AutoTradingConfig', autoTradingConfigSchema);
