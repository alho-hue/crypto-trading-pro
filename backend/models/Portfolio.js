const mongoose = require('mongoose');

/**
 * NEUROVEST - Portfolio Model
 * Persistance complète du portfolio en production
 */

const portfolioSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // === BALANCES ===
  balances: [{
    asset: {
      type: String,
      required: true
    },
    free: {
      type: Number,
      default: 0
    },
    locked: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    },
    usdValue: {
      type: Number,
      default: 0
    }
  }],
  
  // === TOTAL VALUES ===
  totalBalance: {
    type: Number,
    default: 0
  },
  totalBalanceUSD: {
    type: Number,
    default: 0
  },
  availableBalanceUSD: {
    type: Number,
    default: 0
  },
  
  // === POSITIONS ===
  positions: [{
    symbol: {
      type: String,
      required: true
    },
    side: {
      type: String,
      enum: ['LONG', 'SHORT'],
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    entryPrice: {
      type: Number,
      required: true
    },
    markPrice: {
      type: Number
    },
    liquidationPrice: {
      type: Number
    },
    leverage: {
      type: Number,
      default: 1
    },
    margin: {
      type: Number
    },
    unrealizedPnl: {
      type: Number,
      default: 0
    },
    unrealizedPnlPercent: {
      type: Number,
      default: 0
    },
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
    tradeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trade'
    },
    isPaperTrading: {
      type: Boolean,
      default: true
    },
    openedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // === P&L TRACKING ===
  dailyPnL: {
    type: Number,
    default: 0
  },
  dailyPnLPercent: {
    type: Number,
    default: 0
  },
  totalPnL: {
    type: Number,
    default: 0
  },
  totalPnLPercent: {
    type: Number,
    default: 0
  },
  
  // === RISK METRICS ===
  peakValue: {
    type: Number,
    default: 0
  },
  maxDrawdown: {
    type: Number,
    default: 0
  },
  maxDrawdownPercent: {
    type: Number,
    default: 0
  },
  currentDrawdown: {
    type: Number,
    default: 0
  },
  
  // === DAILY TRACKING ===
  dailyStats: {
    date: {
      type: Date,
      default: Date.now
    },
    startingBalance: {
      type: Number,
      default: 0
    },
    tradesCount: {
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
    }
  },
  
  // === METADATA ===
  lastUpdate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index pour les requêtes fréquentes
portfolioSchema.index({ userId: 1 });
portfolioSchema.index({ 'positions.symbol': 1 });
portfolioSchema.index({ lastUpdate: -1 });

// Méthode pour calculer le drawdown
portfolioSchema.methods.calculateDrawdown = function() {
  if (this.totalBalanceUSD > this.peakValue) {
    this.peakValue = this.totalBalanceUSD;
  }
  
  if (this.peakValue > 0) {
    this.currentDrawdown = this.peakValue - this.totalBalanceUSD;
    this.maxDrawdownPercent = (this.currentDrawdown / this.peakValue) * 100;
    
    if (this.maxDrawdownPercent > this.maxDrawdown) {
      this.maxDrawdown = this.maxDrawdownPercent;
    }
  }
  
  return {
    peakValue: this.peakValue,
    currentDrawdown: this.currentDrawdown,
    maxDrawdown: this.maxDrawdown,
    maxDrawdownPercent: this.maxDrawdownPercent
  };
};

// Méthode pour ajouter une position
portfolioSchema.methods.addPosition = function(position) {
  this.positions.push(position);
  this.lastUpdate = new Date();
  return this.save();
};

// Méthode pour fermer une position
portfolioSchema.methods.closePosition = function(tradeId, exitData) {
  const positionIndex = this.positions.findIndex(p => 
    p.tradeId && p.tradeId.toString() === tradeId.toString()
  );
  
  if (positionIndex === -1) return null;
  
  const position = this.positions[positionIndex];
  
  // Mettre à jour le P&L
  this.totalPnL += exitData.pnl || 0;
  this.dailyPnL += exitData.pnl || 0;
  
  // Mettre à jour les stats journalières
  this.dailyStats.tradesCount += 1;
  if (exitData.pnl > 0) {
    this.dailyStats.winningTrades += 1;
  } else {
    this.dailyStats.losingTrades += 1;
  }
  
  // Retirer la position
  this.positions.splice(positionIndex, 1);
  this.lastUpdate = new Date();
  
  // Recalculer le drawdown
  this.calculateDrawdown();
  
  return this.save();
};

// Méthode pour réinitialiser les compteurs journaliers
portfolioSchema.methods.resetDailyStats = function() {
  this.dailyPnL = 0;
  this.dailyPnLPercent = 0;
  this.dailyStats = {
    date: new Date(),
    startingBalance: this.totalBalanceUSD,
    tradesCount: 0,
    winningTrades: 0,
    losingTrades: 0
  };
  return this.save();
};

module.exports = mongoose.model('Portfolio', portfolioSchema);
