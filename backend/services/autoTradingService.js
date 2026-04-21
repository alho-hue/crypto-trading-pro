/**
 * NEUROVEST - AutoTrading Service Production-Ready
 * Exécution automatique de trades avec persistance MongoDB complète
 * 
 * PRODUCTION CHANGES:
 * - trailingStops → Stocké dans Trade model (trailingStopPrice, highWatermark)
 * - dailyRiskTracker → Stocké dans AutoTradingConfig (dailyPnL)
 * - activeBots → Seul élément en mémoire (intervals éphémères)
 */

require('dotenv').config();
const binanceService = require('./binanceService');
const technicalAnalysis = require('./technicalAnalysis');
const sentimentService = require('./sentimentService');
const Trade = require('../models/Trade');
const AutoTradingConfig = require('../models/AutoTradingConfig');
const Portfolio = require('../models/Portfolio');
const User = require('../models/User');

// Logger structuré
const logger = {
  info: (msg, meta = {}) => console.log(`[AUTO-TRADING][INFO] ${new Date().toISOString()} - ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`[AUTO-TRADING][ERROR] ${new Date().toISOString()} - ${msg}`, meta),
  warn: (msg, meta = {}) => console.warn(`[AUTO-TRADING][WARN] ${new Date().toISOString()} - ${msg}`, meta),
  debug: (msg, meta = {}) => process.env.NODE_ENV === 'development' && console.log(`[AUTO-TRADING][DEBUG] ${new Date().toISOString()} - ${msg}`, meta)
};

// Seul les intervals sont en mémoire (nécessaire pour le fonctionnement)
const activeBots = new Map();
const trailingStops = new Map(); // 🔥 Ajouté - définition manquante

class AutoTradingService {
  constructor() {
    this.io = null;
    this.isInitialized = false;
  }

  // Initialiser le service avec Socket.IO
  initialize(io) {
    this.io = io;
    this.isInitialized = true;
    console.log('✅ AutoTradingService initialisé avec Socket.IO');
    
    // Démarrer les bots actifs au redémarrage
    this.restartActiveBots();
    
    // Reset des compteurs quotidiens à minuit
    this.scheduleDailyReset();
  }

  // Redémarrer les bots actifs après un redémarrage serveur
  async restartActiveBots() {
    try {
      const activeConfigs = await AutoTradingConfig.find({ enabled: true });
      console.log(`🔄 Redémarrage de ${activeConfigs.length} bots actifs...`);
      
      for (const config of activeConfigs) {
        await this.startBot(config.userId.toString());
      }
    } catch (error) {
      console.error('❌ Erreur lors du redémarrage des bots:', error);
    }
  }

  // Programmer le reset quotidien
  scheduleDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow - now;
    
    setTimeout(() => {
      this.resetAllDailyCounters();
      this.scheduleDailyReset(); // Reschedule for next day
    }, msUntilMidnight);
  }

  // Reset tous les compteurs journaliers
  async resetAllDailyCounters() {
    try {
      await AutoTradingConfig.updateMany({}, { 
        $set: { 
          dailyTradeCount: 0,
          dailyPnL: 0
        } 
      });
      
      // Reset daily stats in Portfolio
      await Portfolio.updateMany({}, {
        $set: {
          dailyPnL: 0,
          dailyPnLPercent: 0,
          'dailyStats.date': new Date(),
          'dailyStats.tradesCount': 0,
          'dailyStats.winningTrades': 0,
          'dailyStats.losingTrades': 0
        }
      });
      
      logger.info('Daily counters reset completed');
    } catch (error) {
      logger.error('Error resetting daily counters', { error: error.message });
    }
  }

  // === GESTION DES CONFIGURATIONS ===

  async enableAutoTrading(userId, configData) {
    try {
      console.log('[AutoTrading] enableAutoTrading called:', { userId, configData });
      
      if (!userId) {
        throw new Error('userId requis');
      }
      
      let config = await AutoTradingConfig.findOne({ userId });
      
      const botConfig = {
        userId,
        enabled: true,
        strategy: configData.strategy || 'moderate',
        symbols: configData.symbols || ['BTC', 'ETH'],
        maxRiskPerTrade: configData.maxRiskPerTrade || 2,
        stopLossPercent: configData.stopLossPercent || 3,
        takeProfitPercent: configData.takeProfitPercent || 6,
        trailingStopPercent: configData.trailingStopPercent || 2,
        autoBuy: configData.autoBuy !== undefined ? configData.autoBuy : false,
        autoSell: configData.autoSell !== undefined ? configData.autoSell : false,
        minConfidence: configData.minConfidence || 70,
        maxPositions: configData.maxPositions || 3,
        useLeverage: configData.useLeverage || false,
        leverage: configData.leverage || 1,
        maxDailyTrades: configData.maxDailyTrades || 10,
        maxDailyLossPercent: configData.maxDailyLossPercent || 5,
        maxDrawdownPercent: configData.maxDrawdownPercent || 10,
        useKellyCriterion: configData.useKellyCriterion || false,
        kellyFraction: configData.kellyFraction || 0.5,
        useMultiTimeframe: configData.useMultiTimeframe !== undefined ? configData.useMultiTimeframe : true,
        paperTrading: configData.paperTrading !== undefined ? configData.paperTrading : true,
        startTime: new Date(),
        dailyTradeCount: 0,
        lastTradeTime: null,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalPnL: 0,
        maxDrawdown: 0,
        peakValue: 0
      };
      
      console.log('[AutoTrading] botConfig créé:', botConfig);

      if (config) {
        Object.assign(config, botConfig);
      } else {
        config = new AutoTradingConfig(botConfig);
      }

      await config.save();
      
      // Démarrer le bot
      await this.startBot(userId);
      
      this.emitToUser(userId, 'auto-trading-enabled', config);
      
      return config;
    } catch (error) {
      console.error('❌ Erreur enableAutoTrading:', error);
      throw error;
    }
  }

  async disableAutoTrading(userId) {
    try {
      const config = await AutoTradingConfig.findOneAndUpdate(
        { userId },
        { enabled: false },
        { new: true }
      );
      
      if (config) {
        this.stopBot(userId);
        this.emitToUser(userId, 'auto-trading-disabled', config);
        return config;
      }

      throw new Error('Configuration auto-trading non trouvée');
    } catch (error) {
      console.error('❌ Erreur disableAutoTrading:', error);
      throw error;
    }
  }

  // === BOT MANAGEMENT ===

  async startBot(userId) {
    if (activeBots.has(userId)) {
      console.log(`Bot déjà actif pour ${userId}`);
      return;
    }

    const config = await AutoTradingConfig.findOne({ userId });
    if (!config || !config.enabled) {
      return;
    }

    const interval = setInterval(async () => {
      await this.runBotCycle(userId);
    }, 60000); // Vérifier toutes les minutes

    activeBots.set(userId, interval);
    console.log(`🤖 Bot démarré pour ${userId}`);
    
    this.emitToUser(userId, 'bot-started', { userId, timestamp: new Date() });
  }

  stopBot(userId) {
    const interval = activeBots.get(userId);
    if (interval) {
      clearInterval(interval);
      activeBots.delete(userId);
      console.log(`🛑 Bot arrêté pour ${userId}`);
    }
  }

  // === CYCLE DE TRADING ===

  async runBotCycle(userId) {
    try {
      const config = await AutoTradingConfig.findOne({ userId });
      if (!config || !config.enabled) return;

      // Vérifier les limites de risque
      if (await this.isRiskLimitReached(userId, config)) {
        return;
      }

      // Vérifier le nombre de trades journaliers
      if (config.dailyTradeCount >= config.maxDailyTrades) {
        return;
      }

      // Mettre à jour les trailing stops
      await this.updateTrailingStops(userId);

      // Vérifier les signaux pour chaque symbole
      for (const symbol of config.symbols) {
        if (config.dailyTradeCount >= config.maxDailyTrades) break;
        
        await this.processSymbol(userId, symbol, config);
      }
    } catch (error) {
      console.error(`❌ Erreur cycle bot ${userId}:`, error);
    }
  }

  // === ANALYSE MULTI-TIMEFRAME ===

  async analyzeMultiTimeframe(symbol) {
    try {
      const timeframes = ['15m', '1h', '4h', '1d'];
      const analysis = {};
      
      for (const tf of timeframes) {
        const candles = await binanceService.getKlines(symbol, tf, 100);
        if (candles && candles.length >= 50) {
          analysis[tf] = technicalAnalysis.calculateAllIndicators(candles);
          analysis[tf].trend = technicalAnalysis.detectTrend(candles.slice(-20));
          analysis[tf].adx = this.calculateADX(candles);
        }
      }
      
      return analysis;
    } catch (error) {
      console.error(`❌ Erreur analyse multi-timeframe ${symbol}:`, error);
      return null;
    }
  }

  // Calculer ADX (Average Directional Index)
  calculateADX(candles, period = 14) {
    if (!candles || candles.length < period + 1) {
      return { adx: 25, plusDI: 20, minusDI: 20, trend: 'neutral' };
    }

    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);

    const tr = [];
    const plusDM = [];
    const minusDM = [];

    for (let i = 1; i < candles.length; i++) {
      tr.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      ));

      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];

      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    const atr = this.calculateSMA(tr.slice(-period), period);
    const plusDI = 100 * this.calculateSMA(plusDM.slice(-period), period) / atr;
    const minusDI = 100 * this.calculateSMA(minusDM.slice(-period), period) / atr;
    const dx = 100 * Math.abs(plusDI - minusDI) / (plusDI + minusDI);
    const adx = this.calculateSMA([dx], period) || 25;

    let trend = 'neutral';
    if (adx > 25) {
      trend = plusDI > minusDI ? 'trending_up' : 'trending_down';
    } else if (adx < 20) {
      trend = 'ranging';
    }

    return { adx: Math.round(adx), plusDI: Math.round(plusDI), minusDI: Math.round(minusDI), trend };
  }

  calculateSMA(data, period) {
    if (!data || data.length < period) return null;
    return data.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  // === DÉTECTION DE RÉGIME ===

  detectRegime(multiTfAnalysis) {
    if (!multiTfAnalysis) return 'unknown';
    
    const adxValues = Object.values(multiTfAnalysis)
      .map(a => a?.adx?.adx)
      .filter(Boolean);
    
    const avgADX = adxValues.length > 0 ? adxValues.reduce((a, b) => a + b, 0) / adxValues.length : 25;
    
    if (avgADX > 25) return 'trending';
    if (avgADX < 20) return 'ranging';
    return 'mixed';
  }

  // === SIZING DE POSITION ===

  calculatePositionSize(accountBalance, riskPercent, entryPrice, stopLoss, config, multiTfAnalysis = null) {
    // Risk-based sizing de base
    const riskAmount = accountBalance * (riskPercent / 100);
    const stopDistance = Math.abs(entryPrice - stopLoss);
    
    if (stopDistance === 0) return 0;
    
    let positionSize = riskAmount / stopDistance;
    
    // Ajustement selon la volatilité (ATR)
    if (multiTfAnalysis && multiTfAnalysis['1h']) {
      const atr = multiTfAnalysis['1h'].atr.atr;
      const volatilityFactor = Math.min(2, Math.max(0.5, 0.02 / (atr / entryPrice)));
      positionSize *= volatilityFactor;
    }
    
    // Kelly Criterion (si activé)
    if (config.useKellyCriterion) {
      const winRate = config.totalTrades > 0 ? config.winningTrades / config.totalTrades : 0.5;
      const avgWin = config.totalPnL > 0 && config.winningTrades > 0 ? 
        config.totalPnL / config.winningTrades : 1;
      const avgLoss = config.losingTrades > 0 ? 
        Math.abs(config.totalPnL) / config.losingTrades : 1;
      
      const kelly = winRate - ((1 - winRate) / (avgWin / avgLoss));
      const halfKelly = Math.max(0, kelly * config.kellyFraction);
      
      positionSize *= (1 + halfKelly);
    }
    
    // Limiter la taille maximale
    const maxPositionValue = accountBalance * 0.25; // Max 25% du capital par position
    const maxPositionSize = maxPositionValue / entryPrice;
    
    return Math.min(positionSize, maxPositionSize);
  }

  // === ANALYSE DE CORRÉLATION ===

  async getCorrelationMatrix(symbols) {
    const correlations = {};
    
    for (let i = 0; i < symbols.length; i++) {
      correlations[symbols[i]] = {};
      
      for (let j = 0; j < symbols.length; j++) {
        if (i === j) {
          correlations[symbols[i]][symbols[j]] = 1;
        } else if (i < j) {
          const corr = await this.calculateCorrelation(symbols[i], symbols[j]);
          correlations[symbols[i]][symbols[j]] = corr;
          correlations[symbols[j]][symbols[i]] = corr;
        }
      }
    }
    
    return correlations;
  }

  async calculateCorrelation(symbol1, symbol2, period = 30) {
    try {
      const [candles1, candles2] = await Promise.all([
        binanceService.getKlines(symbol1 + 'USDT', '1d', period),
        binanceService.getKlines(symbol2 + 'USDT', '1d', period)
      ]);
      
      if (candles1.length < period || candles2.length < period) return 0;
      
      const returns1 = this.calculateReturns(candles1.map(c => c.close));
      const returns2 = this.calculateReturns(candles2.map(c => c.close));
      
      const n = Math.min(returns1.length, returns2.length);
      const avg1 = returns1.slice(-n).reduce((a, b) => a + b, 0) / n;
      const avg2 = returns2.slice(-n).reduce((a, b) => a + b, 0) / n;
      
      let numerator = 0;
      let denom1 = 0;
      let denom2 = 0;
      
      for (let i = 0; i < n; i++) {
        const diff1 = returns1[returns1.length - n + i] - avg1;
        const diff2 = returns2[returns2.length - n + i] - avg2;
        numerator += diff1 * diff2;
        denom1 += diff1 * diff1;
        denom2 += diff2 * diff2;
      }
      
      const correlation = numerator / Math.sqrt(denom1 * denom2);
      return isNaN(correlation) ? 0 : correlation;
    } catch (error) {
      return 0;
    }
  }

  calculateReturns(prices) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  // === GESTION DU RISQUE ===

  async isRiskLimitReached(userId, config) {
    // Récupérer le portfolio pour les métriques de risque
    const portfolio = await Portfolio.findOne({ userId });
    const todayPnL = portfolio?.dailyPnL || 0;
    const accountValue = portfolio?.totalBalanceUSD || await this.getAccountValue(userId);
    
    // Vérifier la perte journalière maximale
    if (todayPnL < 0) {
      const dailyLossPercent = Math.abs(todayPnL) / accountValue * 100;
      if (dailyLossPercent >= config.maxDailyLossPercent) {
        logger.warn(`Daily loss limit reached for ${userId}`, { dailyLossPercent });
        await this.emitToUser(userId, 'risk-limit-reached', {
          type: 'daily_loss',
          value: dailyLossPercent,
          limit: config.maxDailyLossPercent
        });
        return true;
      }
    }
    
    // Vérifier le drawdown maximal
    const currentDrawdown = portfolio?.maxDrawdownPercent || 0;
    if (currentDrawdown >= config.maxDrawdownPercent) {
      logger.warn(`Max drawdown reached for ${userId}`, { currentDrawdown });
      await this.emitToUser(userId, 'risk-limit-reached', {
        type: 'max_drawdown',
        value: currentDrawdown,
        limit: config.maxDrawdownPercent
      });
      await this.disableAutoTrading(userId);
      return true;
    }
    
    return false;
  }

  async getAccountValue(userId) {
    try {
      const balances = await binanceService.getAccountBalances();
      let totalValue = 0;
      
      for (const balance of balances) {
        if (balance.total > 0) {
          if (balance.asset === 'USDT') {
            totalValue += balance.total;
          } else {
            try {
              const price = await binanceService.getPrice(balance.asset + 'USDT');
              totalValue += balance.total * price;
            } catch (e) {}
          }
        }
      }
      
      return totalValue;
    } catch (error) {
      return 0;
    }
  }

  // === TRAILING STOP ===

  async updateTrailingStops(userId) {
    // Récupérer les trades ouverts avec trailing stop depuis MongoDB
    const openTrades = await Trade.find({ 
      userId, 
      status: 'open',
      trailingStopPercent: { $gt: 0 }
    });
    
    if (!openTrades.length) return;
    
    for (const trade of openTrades) {
      try {
        const currentPrice = await binanceService.getPrice(trade.symbol);
        const highWatermark = trade.highWatermark || trade.entryPrice;
        const trailingStopPrice = trade.trailingStopPrice || trade.stopLoss;
        
        // Mettre à jour le high watermark
        if (currentPrice > highWatermark) {
          const newHighWatermark = currentPrice;
          const newTrailingStop = newHighWatermark * (1 - trade.trailingStopPercent / 100);
          
          // Mettre à jour seulement si le nouveau stop est plus haut
          if (newTrailingStop > trailingStopPrice) {
            await Trade.updateOne(
              { _id: trade._id },
              { 
                $set: { 
                  highWatermark: newHighWatermark,
                  trailingStopPrice: newTrailingStop,
                  lastUpdateTime: new Date()
                }
              }
            );
            
            logger.debug(`Trailing stop updated for ${trade.symbol}`, {
              newStop: newTrailingStop,
              newHighWatermark
            });
            
            // Mettre à jour l'ordre stop sur Binance si trading réel
            if (!trade.paperTrading && trade.stopLossOrderId) {
              // TODO: Implémenter mise à jour ordre Binance
              // await this.updateStopLossOrder(userId, trade.symbol, newTrailingStop, trade.stopLossOrderId);
            }
          }
        }
        
        // Vérifier si le stop est触é
        const currentTrailingStop = trade.trailingStopPrice || trade.stopLoss;
        if (currentPrice <= currentTrailingStop) {
          await this.executeTrailingStopClose(userId, trade);
        }
      } catch (error) {
        logger.error(`Trailing stop error for ${trade.symbol}`, { error: error.message });
      }
    }
  }

  async executeTrailingStopClose(userId, trade) {
    try {
      const config = await AutoTradingConfig.findOne({ userId });
      
      // Fermer la position
      await this.executeSell(userId, trade.symbol.replace('USDT', ''), {
        entryPrice: trade.entryPrice,
        confidence: 100,
        reasoning: 'Trailing stop triggered'
      }, config, true);
      
      // Marquer le trade comme fermé avec raison
      await Trade.updateOne(
        { _id: trade._id },
        {
          $set: {
            status: 'closed',
            exitReason: 'trailing_stop',
            exitTime: new Date(),
            exitPrice: trade.trailingStopPrice
          }
        }
      );
      
      logger.info(`Trailing stop executed for ${trade.symbol}`, {
        tradeId: trade._id,
        exitPrice: trade.trailingStopPrice
      });
    } catch (error) {
      logger.error(`Trailing stop execution error for ${trade.symbol}`, { error: error.message });
    }
  }

  // === TRAITEMENT DES SYMBOLES ===

  async processSymbol(userId, symbol, config) {
    try {
      const symbolUSDT = symbol + 'USDT';
      
      // Analyse multi-timeframe
      let multiTfAnalysis = null;
      if (config.useMultiTimeframe) {
        multiTfAnalysis = await this.analyzeMultiTimeframe(symbolUSDT);
      }
      
      // Analyse principale (1h)
      const candles = await binanceService.getKlines(symbolUSDT, '1h', 100);
      if (!candles || candles.length < 50) return;
      
      // Générer le signal
      const signal = technicalAnalysis.generateTradingSignal(candles);
      
      // Vérifier la confirmation multi-timeframe
      if (config.useMultiTimeframe && multiTfAnalysis) {
        const confirmations = this.getTimeframeConfirmations(multiTfAnalysis, signal.direction);
        if (confirmations < 2) return; // Besoin d'au moins 2 confirmations
      }
      
      // Obtenir le sentiment
      const sentiment = await sentimentService.getOverallMarketSentiment(symbolUSDT);
      
      // Combiner les signaux
      const combinedSignal = this.combineSignals(signal, sentiment, config);
      
      if (combinedSignal.confidence < config.minConfidence) return;
      
      // Vérifier la corrélation avec les positions existantes
      const openTrades = await Trade.find({ userId, status: 'open' });
      if (openTrades.length >= config.maxPositions) return;
      
      // Exécuter le trade
      if (combinedSignal.direction === 'buy' && config.autoBuy) {
        await this.executeBuy(userId, symbol, combinedSignal, config, false, multiTfAnalysis);
      } else if (combinedSignal.direction === 'sell' && config.autoSell) {
        await this.executeSell(userId, symbol, combinedSignal, config, false);
      }
      
    } catch (error) {
      console.error(`❌ Erreur traitement ${symbol}:`, error);
    }
  }

  getTimeframeConfirmations(multiTfAnalysis, direction) {
    let confirmations = 0;
    const timeframes = ['15m', '1h', '4h'];
    
    for (const tf of timeframes) {
      const analysis = multiTfAnalysis[tf];
      if (!analysis) continue;
      
      const trend = analysis.trend;
      if (direction === 'buy' && (trend === 'uptrend' || trend === 'strong_uptrend')) {
        confirmations++;
      } else if (direction === 'sell' && (trend === 'downtrend' || trend === 'strong_downtrend')) {
        confirmations++;
      }
    }
    
    return confirmations;
  }

  // === EXÉCUTION DES TRADES ===

  async executeBuy(userId, symbol, signal, config, isTrailingStop = false, multiTfAnalysis = null) {
    try {
      // Récupérer le solde USDT
      const balances = await binanceService.getAccountBalances();
      const usdtBalance = balances.find(b => b.asset === 'USDT');
      
      if (!usdtBalance || usdtBalance.free < 10) {
        console.log(`⚠️ Solde USDT insuffisant pour ${userId}`);
        return null;
      }
      
      const accountBalance = usdtBalance.free;
      
      // Calculer la taille de position
      const positionSize = this.calculatePositionSize(
        accountBalance,
        config.maxRiskPerTrade,
        signal.entryPrice,
        signal.stopLoss,
        config,
        multiTfAnalysis
      );
      
      const notionalValue = positionSize * signal.entryPrice;
      
      if (notionalValue < 10) {
        console.log(`⚠️ Position trop petite pour ${symbol}`);
        return null;
      }

      const symbolUSDT = symbol + 'USDT';
      let order = null;
      
      // Paper trading ou réel
      if (config.paperTrading) {
        order = {
          orderId: `paper_${Date.now()}`,
          symbol: symbolUSDT,
          status: 'FILLED',
          side: 'BUY',
          type: 'MARKET',
          price: signal.entryPrice,
          origQty: positionSize,
          executedQty: positionSize,
          cummulativeQuoteQty: notionalValue,
          time: Date.now()
        };
      } else {
        // Trading réel
        order = await binanceService.placeMarketOrder(symbolUSDT, 'BUY', positionSize);
      }
      
      // Enregistrer le trade
      const trade = await this.recordTrade(userId, {
        symbol: symbolUSDT,
        side: 'buy',
        entryPrice: order.price || signal.entryPrice,
        quantity: order.executedQty || positionSize,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        confidence: signal.confidence,
        isAutoTrade: true,
        strategy: config.strategy,
        reasoning: signal.reasoning,
        status: 'open',
        entryTime: new Date(),
        paperTrading: config.paperTrading
      });
      
      // Configurer le trailing stop (déjà stocké dans le trade via MongoDB)
      if (config.trailingStopPercent > 0) {
        await Trade.updateOne(
          { _id: trade._id },
          {
            $set: {
              trailingStopPercent: config.trailingStopPercent,
              highWatermark: order.price || signal.entryPrice,
              trailingStopPrice: signal.stopLoss
            }
          }
        );
      }
      
      // Mettre à jour les statistiques
      await this.updateBotStats(userId, 'buy', notionalValue);
      
      // Placer les ordres stop loss et take profit sur Binance (si pas de trailing stop)
      let stopLossOrderId = null;
      let takeProfitOrderId = null;
      
      if (!config.paperTrading && config.trailingStopPercent === 0) {
        try {
          const slOrder = await binanceService.placeStopLossOrder(symbolUSDT, 'SELL', positionSize, signal.stopLoss);
          stopLossOrderId = slOrder?.orderId;
          
          const tpOrder = await binanceService.placeTakeProfitOrder(symbolUSDT, 'SELL', positionSize, signal.takeProfit);
          takeProfitOrderId = tpOrder?.orderId;
          
          // Mettre à jour le trade avec les order IDs
          await Trade.updateOne(
            { _id: trade._id },
            {
              $set: {
                stopLossOrderId,
                takeProfitOrderId
              }
            }
          );
        } catch (error) {
          logger.error(`Error placing SL/TP orders`, { error: error.message, symbol: symbolUSDT });
        }
      }
      
      // Notifier
      this.emitToUser(userId, 'trade-executed', {
        type: 'buy',
        symbol,
        price: order.price || signal.entryPrice,
        quantity: order.executedQty || positionSize,
        value: notionalValue,
        paperTrading: config.paperTrading
      });
      
      console.log(`🟢 BUY ${symbol} @ ${order.price || signal.entryPrice} - Size: ${positionSize.toFixed(4)} - Paper: ${config.paperTrading}`);
      
      return trade;
      
    } catch (error) {
      console.error(`❌ Erreur exécution buy ${symbol}:`, error);
      return null;
    }
  }

  async executeSell(userId, symbol, signal, config, isTrailingStop = false) {
    try {
      const symbolUSDT = symbol + 'USDT';
      
      // Récupérer la position
      const balances = await binanceService.getAccountBalances();
      const symbolBalance = balances.find(b => b.asset === symbol);
      
      if (!symbolBalance || symbolBalance.free < 0.0001) {
        console.log(`⚠️ Pas de position ${symbol} pour ${userId}`);
        return null;
      }
      
      const quantity = symbolBalance.free;
      const currentPrice = await binanceService.getPrice(symbolUSDT);
      
      // Trouver le trade ouvert
      const openTrade = await Trade.findOne({ userId, symbol: symbolUSDT, status: 'open' });
      
      let order = null;
      
      if (config.paperTrading) {
        order = {
          orderId: `paper_${Date.now()}`,
          symbol: symbolUSDT,
          status: 'FILLED',
          side: 'SELL',
          type: 'MARKET',
          price: currentPrice,
          origQty: quantity,
          executedQty: quantity,
          cummulativeQuoteQty: quantity * currentPrice,
          time: Date.now()
        };
      } else {
        // Trading réel
        order = await binanceService.placeMarketOrder(symbolUSDT, 'SELL', quantity);
      }
      
      // Calculer le P&L
      let pnl = 0;
      let pnlPercent = 0;
      
      if (openTrade) {
        const entryValue = openTrade.quantity * openTrade.entryPrice;
        const exitValue = (order.executedQty || quantity) * (order.price || currentPrice);
        pnl = exitValue - entryValue;
        pnlPercent = (pnl / entryValue) * 100;
        
        // Fermer le trade
        openTrade.status = 'closed';
        openTrade.exitPrice = order.price || currentPrice;
        openTrade.exitTime = new Date();
        openTrade.pnl = pnl;
        openTrade.pnlPercent = pnlPercent;
        await openTrade.save();
        
        // Mettre à jour le P&L journalier dans AutoTradingConfig
        await AutoTradingConfig.updateOne(
          { userId },
          { $inc: { dailyPnL: pnl } }
        );
        
        // Mettre à jour le portfolio
        await Portfolio.updateOne(
          { userId },
          {
            $inc: { dailyPnL: pnl, totalPnL: pnl },
            $push: {
              'dailyStats.trades': {
                symbol: symbolUSDT,
                pnl,
                pnlPercent,
                timestamp: new Date()
              }
            }
          }
        );
      }
      
      // Mettre à jour les statistiques
      await this.updateBotStats(userId, 'sell', Math.abs(pnl), pnl > 0);
      
      // Notifier
      this.emitToUser(userId, 'trade-executed', {
        type: 'sell',
        symbol,
        price: order.price || currentPrice,
        quantity: order.executedQty || quantity,
        pnl,
        pnlPercent,
        paperTrading: config.paperTrading
      });
      
      console.log(`🔴 SELL ${symbol} @ ${order.price || currentPrice} - P&L: ${pnl.toFixed(2)} - Paper: ${config.paperTrading}`);
      
      return { order, pnl };
      
    } catch (error) {
      console.error(`❌ Erreur exécution sell ${symbol}:`, error);
      return null;
    }
  }

  // === ENREGISTREMENT DES TRADES ===

  async recordTrade(userId, tradeData) {
    try {
      const trade = new Trade({
        userId,
        ...tradeData
      });
      
      await trade.save();
      return trade;
    } catch (error) {
      console.error('❌ Erreur enregistrement trade:', error);
      throw error;
    }
  }

  // === MISE À JOUR DES STATISTIQUES ===

  async updateBotStats(userId, type, value, isWin = null) {
    try {
      const update = {
        $inc: { totalTrades: 1, dailyTradeCount: 1 },
        $set: { lastTradeTime: new Date() }
      };
      
      if (type === 'sell' && isWin !== null) {
        if (isWin) {
          update.$inc.winningTrades = 1;
        } else {
          update.$inc.losingTrades = 1;
        }
        update.$inc.totalPnL = value * (isWin ? 1 : -1);
      }
      
      await AutoTradingConfig.updateOne({ userId }, update);
    } catch (error) {
      console.error('❌ Erreur mise à jour stats:', error);
    }
  }

  // === UTILITAIRES ===

  combineSignals(technicalSignal, sentiment, config) {
    let combinedScore = technicalSignal.confidence;
    
    // Ajuster selon le sentiment
    if (sentiment.overall === 'bullish' || sentiment.overall === 'strongly_bullish') {
      combinedScore += 10;
    } else if (sentiment.overall === 'bearish' || sentiment.overall === 'strongly_bearish') {
      combinedScore -= 10;
    }
    
    // Ajuster selon la stratégie
    if (config.strategy === 'conservative') {
      combinedScore *= 0.8;
    } else if (config.strategy === 'aggressive') {
      combinedScore *= 1.2;
    }
    
    combinedScore = Math.max(0, Math.min(100, combinedScore));
    
    let direction = technicalSignal.direction;
    
    if (sentiment.overall === 'strongly_bearish' && direction === 'buy') {
      direction = 'neutral';
    } else if (sentiment.overall === 'strongly_bullish' && direction === 'sell') {
      direction = 'neutral';
    }
    
    return {
      direction,
      confidence: Math.round(combinedScore),
      entryPrice: technicalSignal.entryPrice,
      stopLoss: technicalSignal.stopLoss,
      takeProfit: technicalSignal.takeProfit,
      reasoning: `${technicalSignal.reasoning}. Sentiment: ${sentiment.overall}`
    };
  }

  // === API PUBLIQUE ===

  async getAutoTradingConfig(userId) {
    return await AutoTradingConfig.findOne({ userId });
  }

  async getBotStatus(userId) {
    const config = await AutoTradingConfig.findOne({ userId });
    const isActive = activeBots.has(userId);
    
    if (!config) {
      return {
        enabled: false,
        active: false,
        message: 'Auto-trading non configuré'
      };
    }
    
    const winRate = config.totalTrades > 0 ? 
      (config.winningTrades / config.totalTrades * 100).toFixed(2) : 0;
    
    return {
      enabled: config.enabled,
      active: isActive,
      strategy: config.strategy,
      symbols: config.symbols,
      dailyTradeCount: config.dailyTradeCount,
      maxDailyTrades: config.maxDailyTrades,
      totalTrades: config.totalTrades,
      winningTrades: config.winningTrades,
      losingTrades: config.losingTrades,
      totalPnL: config.totalPnL,
      winRate: parseFloat(winRate),
      lastTradeTime: config.lastTradeTime,
      startTime: config.startTime,
      paperTrading: config.paperTrading
    };
  }

  async updateConfig(userId, updates) {
    const config = await AutoTradingConfig.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true, upsert: true }
    );
    
    return config;
  }

  async getPerformanceStats(userId) {
    const config = await AutoTradingConfig.findOne({ userId });
    if (!config) return null;
    
    const winRate = config.totalTrades > 0 ? 
      (config.winningTrades / config.totalTrades * 100) : 0;
    
    const avgPnL = config.totalTrades > 0 ? 
      config.totalPnL / config.totalTrades : 0;
    
    // Calculer le Sharpe ratio (simplifié)
    const trades = await Trade.find({ userId, status: 'closed' }).sort({ exitTime: -1 }).limit(30);
    const returns = trades.map(t => t.pnlPercent || 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length || 0;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length || 1;
    const sharpeRatio = avgReturn / Math.sqrt(variance);
    
    return {
      totalTrades: config.totalTrades,
      winningTrades: config.winningTrades,
      losingTrades: config.losingTrades,
      winRate: parseFloat(winRate.toFixed(2)),
      totalPnL: parseFloat(config.totalPnL.toFixed(2)),
      avgPnL: parseFloat(avgPnL.toFixed(2)),
      dailyTradeCount: config.dailyTradeCount,
      maxDailyTrades: config.maxDailyTrades,
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      maxDrawdown: config.maxDrawdown
    };
  }

  // === BACKTESTING ===

  async runBacktest(userId, symbol, startDate, endDate, strategy = 'moderate') {
    try {
      const startTime = new Date(startDate).getTime();
      const endTime = new Date(endDate).getTime();
      
      // Récupérer les données historiques
      const candles = await binanceService.getKlines(symbol, '1h', 1000);
      const filteredCandles = candles.filter(c => 
        c.openTime >= startTime && c.closeTime <= endTime
      );
      
      if (filteredCandles.length < 100) {
        throw new Error('Données historiques insuffisantes');
      }
      
      // Simuler le trading
      let capital = 10000; // Capital initial simulé
      let trades = [];
      let position = null;
      
      for (let i = 50; i < filteredCandles.length; i++) {
        const candleSlice = filteredCandles.slice(0, i);
        const signal = technicalAnalysis.generateTradingSignal(candleSlice);
        const currentPrice = filteredCandles[i].close;
        
        if (!position && signal.direction === 'buy' && signal.confidence > 70) {
          // Ouvrir position
          const positionSize = (capital * 0.02) / Math.abs(currentPrice - signal.stopLoss);
          position = {
            entryPrice: currentPrice,
            quantity: positionSize,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            entryTime: filteredCandles[i].closeTime
          };
        } else if (position) {
          // Vérifier exit
          const shouldExit = 
            currentPrice <= position.stopLoss ||
            currentPrice >= position.takeProfit ||
            (signal.direction === 'sell' && signal.confidence > 70);
          
          if (shouldExit) {
            const exitPrice = currentPrice <= position.stopLoss ? position.stopLoss :
                             currentPrice >= position.takeProfit ? position.takeProfit : currentPrice;
            const pnl = (exitPrice - position.entryPrice) * position.quantity;
            
            trades.push({
              entryPrice: position.entryPrice,
              exitPrice: exitPrice,
              quantity: position.quantity,
              pnl,
              pnlPercent: (pnl / (position.entryPrice * position.quantity)) * 100,
              duration: (filteredCandles[i].closeTime - position.entryTime) / 1000 / 3600, // hours
              exitReason: currentPrice <= position.stopLoss ? 'stop_loss' :
                         currentPrice >= position.takeProfit ? 'take_profit' : 'signal'
            });
            
            capital += pnl;
            position = null;
          }
        }
      }
      
      // Calculer les métriques
      const winningTrades = trades.filter(t => t.pnl > 0);
      const losingTrades = trades.filter(t => t.pnl <= 0);
      const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
      const maxDrawdown = this.calculateMaxDrawdown(trades);
      
      return {
        symbol,
        startDate,
        endDate,
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: trades.length > 0 ? (winningTrades.length / trades.length * 100) : 0,
        totalReturn: (totalPnL / 10000) * 100,
        maxDrawdown,
        sharpeRatio: this.calculateBacktestSharpe(trades),
        profitFactor: this.calculateProfitFactor(trades),
        avgTrade: trades.length > 0 ? totalPnL / trades.length : 0,
        avgWin: winningTrades.length > 0 ? 
          winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0,
        avgLoss: losingTrades.length > 0 ? 
          losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length : 0,
        trades: trades.slice(0, 50) // Limiter le nombre de trades retournés
      };
      
    } catch (error) {
      console.error('❌ Erreur backtest:', error);
      throw error;
    }
  }

  calculateMaxDrawdown(trades) {
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;
    
    for (const trade of trades) {
      runningPnL += trade.pnl;
      if (runningPnL > peak) peak = runningPnL;
      const drawdown = peak - runningPnL;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    return maxDrawdown;
  }

  calculateBacktestSharpe(trades) {
    if (trades.length < 2) return 0;
    const returns = trades.map(t => t.pnlPercent);
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
    return avg / Math.sqrt(variance || 1);
  }

  calculateProfitFactor(trades) {
    const grossProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    return grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
  }

  // === SOCKET.IO ===

  emitToUser(userId, event, data) {
    if (this.io) {
      this.io.to(`user-${userId}`).emit(event, data);
    }
  }

  // === PAPER TRADING ===

  async togglePaperTrading(userId, enabled) {
    return await this.updateConfig(userId, { paperTrading: enabled });
  }

  // === STOPPING ALL BOTS ===

  stopAllBots() {
    for (const [userId, interval] of activeBots.entries()) {
      clearInterval(interval);
      console.log(`🛑 Bot arrêté pour ${userId}`);
    }
    activeBots.clear();
    trailingStops.clear();
  }
}

module.exports = new AutoTradingService();
