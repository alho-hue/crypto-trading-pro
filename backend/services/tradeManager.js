/**
 * NEUROVEST - Trade Manager Service
 * Système centralisé de gestion des trades
 * Pipeline: Validation → Exécution → Suivi → Fermeture → Analyse
 */

const Trade = require('../models/Trade');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getIO } = require('../server');
const learningEngine = require('./learningEngine');

class TradeManager {
  constructor() {
    this.activeTrades = new Map(); // Cache des trades actifs
    this.priceListeners = new Map(); // Listeners de prix par symbol
    this.initialized = false;
  }

  // Initialisation du service
  async initialize() {
    if (this.initialized) return;
    
    // Charger tous les trades ouverts au démarrage
    const openTrades = await Trade.find({ status: { $in: ['open', 'partially_filled'] } });
    for (const trade of openTrades) {
      this.activeTrades.set(trade._id.toString(), trade);
    }
    
    this.initialized = true;
    console.log(`[TradeManager] ${openTrades.length} trades actifs chargés`);
  }

  // ========== PIPELINE ÉTAPE 1: VALIDATION ==========
  async validateTrade(userId, tradeData) {
    const errors = [];
    let riskPercent = 0;

    // 1. Vérifier l'utilisateur
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }
    
    // 2. Vérifier le solde (pour spot)
    if (tradeData.type === 'spot') {
      const requiredBalance = tradeData.quantity * tradeData.entryPrice;
      const userBalance = user.wallet?.balance || 0;
      if (userBalance < requiredBalance) {
        errors.push(`Solde insuffisant. Requis: ${requiredBalance}, Disponible: ${userBalance}`);
      }
    }
    
    // 3. Vérifier la cohérence des prix (si SL et TP sont définis)
    if (tradeData.stopLoss && tradeData.takeProfit) {
      const isLong = tradeData.side === 'buy' || tradeData.side === 'BUY' || tradeData.side === 'LONG';
      if (isLong) {
        if (tradeData.stopLoss >= tradeData.entryPrice) {
          errors.push('SL doit être inférieur au prix d\'entrée pour un LONG');
        }
        if (tradeData.takeProfit <= tradeData.entryPrice) {
          errors.push('TP doit être supérieur au prix d\'entrée pour un LONG');
        }
      } else {
        if (tradeData.stopLoss <= tradeData.entryPrice) {
          errors.push('SL doit être supérieur au prix d\'entrée pour un SHORT');
        }
        if (tradeData.takeProfit >= tradeData.entryPrice) {
          errors.push('TP doit être inférieur au prix d\'entrée pour un SHORT');
        }
      }
    }
    
    // 4. Vérifier le risque maximum (max 5% du portefeuille par trade) - ignoré pour paper trading
    if (!tradeData.paperTrading) {
      const portfolioValue = user.wallet?.totalValue || 1000;
      const tradeRisk = Math.abs(tradeData.entryPrice - (tradeData.stopLoss || tradeData.entryPrice * 0.95)) * tradeData.quantity;
      riskPercent = (tradeRisk / portfolioValue) * 100;
      if (riskPercent > 5) {
        errors.push(`Risque trop élevé: ${riskPercent.toFixed(2)}% (max 5%)`);
      }
    }

    if (errors.length > 0) {
      console.log('[TradeManager] Validation échouée:', errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      user,
      riskPercent
    };
  }

  // ========== PIPELINE ÉTAPE 2: CRÉATION ==========
  async createTrade(userId, tradeData) {
    try {
      // Validation
      const validation = await this.validateTrade(userId, tradeData);
      if (!validation.valid) {
        throw new Error(`Validation échouée: ${validation.errors.join(', ')}`);
      }
      
      // Créer le trade
      const trade = new Trade({
        userId,
        symbol: tradeData.symbol.toUpperCase(),
        side: tradeData.side,
        type: tradeData.type || 'market',
        quantity: tradeData.quantity,
        entryPrice: tradeData.entryPrice,
        stopLoss: tradeData.stopLoss,
        takeProfit: tradeData.takeProfit,
        leverage: tradeData.leverage || 1,
        marginType: tradeData.marginType || 'isolated',
        status: 'pending',
        isAutoTrade: tradeData.source === 'bot' || tradeData.source === 'ai',
        paperTrading: tradeData.paperTrading !== false, // Par défaut paper trading
        strategy: tradeData.strategy,
        reasoning: tradeData.reasoning,
        confidence: tradeData.confidence,
        source: tradeData.source || 'manual', // manual, bot, ai
        highWatermark: tradeData.entryPrice
      });
      
      await trade.save();
      
      // Notifier le frontend
      this.emitTradeEvent(userId, 'trade_created', trade);
      
      return {
        success: true,
        trade,
        message: 'Trade créé avec succès'
      };
    } catch (error) {
      console.error('[TradeManager] Erreur création trade:', error);
      throw error;
    }
  }

  // ========== PIPELINE ÉTAPE 3: EXÉCUTION ==========
  async executeTrade(tradeId, executionData) {
    try {
      const trade = await Trade.findById(tradeId);
      if (!trade) {
        throw new Error('Trade non trouvé');
      }
      
      // Mettre à jour avec les données d'exécution Binance
      trade.status = 'open';
      trade.filledQuantity = executionData.filledQuantity || trade.quantity;
      trade.averageEntryPrice = executionData.averagePrice || trade.entryPrice;
      trade.orderId = executionData.orderId;
      trade.clientOrderId = executionData.clientOrderId;
      trade.entryTime = new Date();
      trade.fees = executionData.fees || 0;
      
      await trade.save();
      
      // Ajouter au cache des trades actifs
      this.activeTrades.set(trade._id.toString(), trade);
      
      // Mettre à jour les stats utilisateur
      await this.updateUserStats(trade.userId);
      
      // Créer notification
      await this.createNotification(trade.userId, 'trade_opened', {
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.quantity,
        price: trade.averageEntryPrice
      });
      
      // Notifier en temps réel
      this.emitTradeEvent(trade.userId.toString(), 'trade_executed', trade);
      
      return {
        success: true,
        trade
      };
    } catch (error) {
      console.error('[TradeManager] Erreur exécution trade:', error);
      throw error;
    }
  }

  // ========== PIPELINE ÉTAPE 4: SUIVI TEMPS RÉEL ==========
  async updateTradePnL(tradeId, currentPrice) {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return;
    
    const entryPrice = trade.averageEntryPrice || trade.entryPrice;
    const quantity = trade.filledQuantity || trade.quantity;
    const leverage = trade.leverage || 1;
    
    // Calculer le PnL non réalisé
    let pnl = 0;
    const isLong = trade.side === 'buy' || trade.side === 'BUY' || trade.side === 'LONG';
    
    if (isLong) {
      pnl = (currentPrice - entryPrice) * quantity * leverage;
    } else {
      pnl = (entryPrice - currentPrice) * quantity * leverage;
    }
    
    // Calculer le % de PnL
    const invested = entryPrice * quantity / leverage;
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
    
    // Mettre à jour le high watermark pour le trailing stop
    if (isLong && currentPrice > trade.highWatermark) {
      trade.highWatermark = currentPrice;
    } else if (!isLong && currentPrice < trade.highWatermark) {
      trade.highWatermark = currentPrice;
    }
    
    // Vérifier le trailing stop
    if (trade.trailingStopPercent) {
      const trailingDistance = isLong 
        ? trade.highWatermark - currentPrice
        : currentPrice - trade.highWatermark;
      const trailingPercent = (trailingDistance / trade.highWatermark) * 100;
      
      if (trailingPercent >= trade.trailingStopPercent) {
        await this.closeTrade(tradeId, currentPrice, 'trailing_stop');
        return;
      }
    }
    
    // Vérifier SL et TP
    if (trade.stopLoss) {
      if ((isLong && currentPrice <= trade.stopLoss) || (!isLong && currentPrice >= trade.stopLoss)) {
        await this.closeTrade(tradeId, trade.stopLoss, 'stop_loss');
        return;
      }
    }
    
    if (trade.takeProfit) {
      if ((isLong && currentPrice >= trade.takeProfit) || (!isLong && currentPrice <= trade.takeProfit)) {
        await this.closeTrade(tradeId, trade.takeProfit, 'take_profit');
        return;
      }
    }
    
    // Mettre à jour en DB uniquement si changement significatif (> 1%)
    if (Math.abs(pnlPercent - (trade.pnlPercent || 0)) > 1) {
      trade.unrealizedPnl = pnl;
      trade.pnlPercent = pnlPercent;
      trade.lastUpdateTime = new Date();
      await trade.save();
      
      // Émettre mise à jour temps réel
      this.emitTradeEvent(trade.userId.toString(), 'trade_update', {
        tradeId: trade._id,
        unrealizedPnl: pnl,
        pnlPercent,
        currentPrice,
        highWatermark: trade.highWatermark
      });
    }
  }

  // ========== PIPELINE ÉTAPE 5: FERMETURE ==========
  async closeTrade(tradeId, exitPrice, exitReason) {
    try {
      const trade = await Trade.findById(tradeId);
      if (!trade || trade.status === 'closed') {
        throw new Error('Trade déjà fermé ou inexistant');
      }
      
      const entryPrice = trade.averageEntryPrice || trade.entryPrice;
      const quantity = trade.filledQuantity || trade.quantity;
      const leverage = trade.leverage || 1;
      const isLong = trade.side === 'buy' || trade.side === 'BUY' || trade.side === 'LONG';
      
      // Calculer le PnL final
      let pnl = 0;
      if (isLong) {
        pnl = (exitPrice - entryPrice) * quantity * leverage;
      } else {
        pnl = (entryPrice - exitPrice) * quantity * leverage;
      }
      
      // Soustraire les frais
      const totalFees = (trade.fees || 0) + (exitPrice * quantity * 0.001); // 0.1% frais de sortie
      pnl -= totalFees;
      
      // Calculer le % de PnL
      const invested = entryPrice * quantity / leverage;
      const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
      
      // Mettre à jour le trade
      trade.status = 'closed';
      trade.exitPrice = exitPrice;
      trade.averageExitPrice = exitPrice;
      trade.pnl = pnl;
      trade.pnlPercent = pnlPercent;
      trade.fees = totalFees;
      trade.exitTime = new Date();
      trade.exitReason = exitReason;
      
      if (trade.entryTime) {
        trade.duration = Math.floor((trade.exitTime - trade.entryTime) / 1000);
      }
      
      await trade.save();
      
      // Retirer du cache
      this.activeTrades.delete(tradeId);
      
      // Mettre à jour les stats utilisateur
      await this.updateUserStats(trade.userId);
      
      // Mettre à jour le portefeuille
      await this.updatePortfolio(trade.userId, trade);
      
      // Créer notification
      const isWin = pnl > 0;
      await this.createNotification(trade.userId, isWin ? 'trade_win' : 'trade_loss', {
        symbol: trade.symbol,
        pnl: pnl.toFixed(2),
        pnlPercent: pnlPercent.toFixed(2),
        exitReason
      });
      
      // Notifier en temps réel
      this.emitTradeEvent(trade.userId.toString(), 'trade_closed', trade);
      
      // Analyser le trade pour l'IA via LearningEngine
      try {
        await learningEngine.analyzeTradeResult(trade._id);
        console.log(`[TradeManager] Analyse IA effectuée pour trade ${trade._id}`);
      } catch (analysisError) {
        console.warn('[TradeManager] Erreur analyse IA:', analysisError.message);
      }
      
      return {
        success: true,
        trade,
        pnl,
        pnlPercent
      };
    } catch (error) {
      console.error('[TradeManager] Erreur fermeture trade:', error);
      throw error;
    }
  }

  // ========== MISE À JOUR PORTEFEUILLE ==========
  async updatePortfolio(userId, trade) {
    const user = await User.findById(userId);
    if (!user || !user.wallet) return;
    
    // Ajouter le PnL au solde
    user.wallet.balance += trade.pnl || 0;
    user.wallet.totalValue += trade.pnl || 0;
    
    // Mettre à jour les actifs
    if (trade.symbol && user.wallet.assets) {
      const assetIndex = user.wallet.assets.findIndex(a => a.symbol === trade.symbol.replace('USDT', ''));
      if (assetIndex !== -1) {
        const asset = user.wallet.assets[assetIndex];
        if (trade.side === 'sell' || trade.side === 'SELL') {
          asset.quantity -= trade.quantity;
          if (asset.quantity <= 0) {
            user.wallet.assets.splice(assetIndex, 1);
          }
        }
      }
    }
    
    await user.save();
  }

  // ========== MISE À JOUR STATS UTILISATEUR ==========
  async updateUserStats(userId) {
    const trades = await Trade.find({ userId, status: 'closed' });
    
    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    const totalProfit = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.pnl || 0)) : 0;
    const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.pnl || 0)) : 0;
    
    await User.findByIdAndUpdate(userId, {
      'stats.totalTrades': trades.length,
      'stats.winningTrades': winningTrades.length,
      'stats.totalProfit': totalProfit,
      'stats.bestTrade': bestTrade,
      'stats.worstTrade': worstTrade
    });
  }

  // ========== ANALYSE POST-TRADE ==========
  async analyzeTrade(trade) {
    try {
      console.log(`[TradeManager] Analyse du trade ${trade._id}: PnL=${trade.pnl}, Raison=${trade.exitReason}`);
      
      // 🔥 ANALYSE IA DU TRADE POUR AMÉLIORATION
      const ethernalAI = require('./ethernalAI');
      
      // Préparer les données pour l'IA
      const tradeData = {
        symbol: trade.symbol,
        side: trade.side,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        quantity: trade.quantity,
        pnl: trade.pnl,
        pnlPercent: trade.pnlPercent,
        exitReason: trade.exitReason,
        duration: trade.exitTime ? (new Date(trade.exitTime) - new Date(trade.entryTime)) / 1000 : 0,
        indicators: trade.indicators || {},
        marketConditions: trade.marketConditions || {},
        timestamp: new Date()
      };
      
      // Analyser via l'IA
      const analysis = await ethernalAI.analyzeTradePerformance(tradeData);
      
      // Sauvegarder l'analyse
      trade.aiAnalysis = analysis;
      await trade.save();
      
      // Logger
      console.log(`[TradeManager] Analyse IA complétée pour ${trade._id}:`, {
        recommendation: analysis?.recommendation,
        confidence: analysis?.confidence
      });
      
    } catch (error) {
      // Ne pas bloquer si l'analyse échoue
      console.error(`[TradeManager] Erreur analyse IA:`, error.message);
    }
  }

  // ========== NOTIFICATIONS ==========
  async createNotification(userId, type, data) {
    const messages = {
      trade_opened: `Nouveau trade ouvert: ${data.symbol} ${data.side} @ ${data.price}`,
      trade_win: `Profit pris: ${data.symbol} +${data.pnl} USDT (${data.pnlPercent}%)`,
      trade_loss: `Perte: ${data.symbol} ${data.pnl} USDT (${data.pnlPercent}%)`,
      stop_loss: `Stop Loss touché: ${data.symbol}`,
      take_profit: `Take Profit atteint: ${data.symbol}`
    };
    
    const notification = new Notification({
      userId,
      type,
      title: type.includes('win') ? 'Profit!' : type.includes('loss') ? 'Perte' : 'Trade',
      message: messages[type] || 'Mise à jour trade',
      data
    });
    
    await notification.save();
    
    // Émettre via WebSocket
    try {
      const io = typeof getIO === 'function' ? getIO() : null;
      if (io) {
        io.to(`user_${userId}`).emit('notification', notification);
      }
    } catch (e) {
      // WebSocket non disponible
    }
  }

  // ========== WEBSOCKET EVENTS ==========
  emitTradeEvent(userId, event, data) {
    try {
      const io = typeof getIO === 'function' ? getIO() : null;
      if (io) {
        io.to(`user_${userId}`).emit(event, data);
      }
    } catch (e) {
      // WebSocket non disponible - pas critique
    }
  }

  // ========== GETTERS ==========
  async getUserTrades(userId, status = null) {
    const query = { userId };
    if (status) {
      query.status = status;
    }
    
    return await Trade.find(query).sort({ entryTime: -1 });
  }

  async getActiveTrades(userId) {
    return await this.getUserTrades(userId, 'open');
  }

  async getTradeHistory(userId, limit = 50) {
    return await Trade.find({ userId, status: 'closed' })
      .sort({ exitTime: -1 })
      .limit(limit);
  }

  async getTradeStats(userId) {
    const trades = await Trade.find({ userId, status: 'closed' });
    const openTrades = await Trade.find({ userId, status: 'open' });
    
    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = trades.filter(t => (t.pnl || 0) <= 0);
    
    const totalProfit = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    return {
      totalTrades: trades.length,
      openTrades: openTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      totalProfit,
      totalWins,
      totalLosses,
      profitFactor: Math.abs(totalLosses) > 0 ? totalWins / Math.abs(totalLosses) : 0,
      averageProfit: trades.length > 0 ? totalProfit / trades.length : 0,
      bestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.pnl || 0)) : 0,
      worstTrade: trades.length > 0 ? Math.min(...trades.map(t => t.pnl || 0)) : 0,
      unrealizedPnl: openTrades.reduce((sum, t) => sum + (t.unrealizedPnl || 0), 0),
      tradesBySource: {
        manual: trades.filter(t => t.source === 'manual').length,
        bot: trades.filter(t => t.source === 'bot').length,
        ai: trades.filter(t => t.source === 'ai').length
      },
      tradesByExitReason: trades.reduce((acc, t) => {
        acc[t.exitReason || 'unknown'] = (acc[t.exitReason || 'unknown'] || 0) + 1;
        return acc;
      }, {})
    };
  }

  // ========== GESTION PRIX TEMPS RÉEL ==========
  onPriceUpdate(symbol, price) {
    // Mettre à jour tous les trades actifs pour ce symbol
    for (const [tradeId, trade] of this.activeTrades) {
      if (trade.symbol === symbol) {
        this.updateTradePnL(tradeId, price);
      }
    }
  }
}

// Singleton instance
const tradeManager = new TradeManager();

module.exports = tradeManager;
