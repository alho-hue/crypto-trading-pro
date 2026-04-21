/**
 * NEUROVEST - Learning Engine Service
 * Système d'apprentissage automatique pour @Ethernal et le Trading Bot
 * Boucle: Analyser → Trader → Apprendre → Optimiser → Recommencer
 */

const Trade = require('../models/Trade');
const User = require('../models/User');
const { getIO } = require('../server');

class LearningEngine {
  constructor() {
    this.memory = new Map(); // Cache mémoire par utilisateur
    this.patterns = new Map(); // Patterns détectés
    this.strategyScores = new Map(); // Scoring des stratégies
    this.marketRegimes = new Map(); // Régimes de marché actuels
    this.initialized = false;
  }

  // ========== INITIALISATION ==========
  async initialize() {
    if (this.initialized) return;
    
    console.log('[LearningEngine] Initialisation...');

    // Charger l'historique d'apprentissage (si disponible)
    try {
      await this.loadHistoricalPatterns?.();
    } catch (e) {
      console.log('[LearningEngine] Pas de patterns historiques à charger');
    }

    // Démarrer la boucle d'apprentissage
    this.startLearningLoop?.();
    
    this.initialized = true;
    console.log('[LearningEngine] ✅ Initialisé');
  }

  // ========== 1. MÉMOIRE INTELLIGENTE ==========
  async buildUserMemory(userId) {
    const trades = await Trade.find({ 
      userId, 
      status: 'closed',
      source: { $in: ['bot', 'ai'] }
    }).sort({ exitTime: -1 }).limit(100);

    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = trades.filter(t => (t.pnl || 0) <= 0);

    // Analyser les patterns gagnants
    const winningPatterns = this.extractPatterns(winningTrades);
    const losingPatterns = this.extractPatterns(losingTrades);

    const memory = {
      userId,
      totalTrades: trades.length,
      winningPatterns,
      losingPatterns,
      bestSetups: this.identifyBestSetups(winningTrades),
      worstSetups: this.identifyWorstSetups(losingTrades),
      optimalParameters: this.calculateOptimalParameters(trades),
      lastUpdated: new Date()
    };

    this.memory.set(userId.toString(), memory);
    return memory;
  }

  extractPatterns(trades) {
    const patterns = {
      bySymbol: {},
      byStrategy: {},
      byTimeframe: {},
      byMarketCondition: {},
      byDirection: {}
    };

    trades.forEach(trade => {
      // Par symbole
      if (!patterns.bySymbol[trade.symbol]) {
        patterns.bySymbol[trade.symbol] = { count: 0, totalPnl: 0, avgPnl: 0 };
      }
      patterns.bySymbol[trade.symbol].count++;
      patterns.bySymbol[trade.symbol].totalPnl += trade.pnl || 0;

      // Par stratégie
      if (trade.strategy) {
        if (!patterns.byStrategy[trade.strategy]) {
          patterns.byStrategy[trade.strategy] = { count: 0, totalPnl: 0, winRate: 0 };
        }
        patterns.byStrategy[trade.strategy].count++;
        patterns.byStrategy[trade.strategy].totalPnl += trade.pnl || 0;
      }

      // Par direction
      const direction = trade.side === 'buy' || trade.side === 'LONG' ? 'long' : 'short';
      if (!patterns.byDirection[direction]) {
        patterns.byDirection[direction] = { count: 0, totalPnl: 0 };
      }
      patterns.byDirection[direction].count++;
      patterns.byDirection[direction].totalPnl += trade.pnl || 0;
    });

    // Calculer les moyennes
    Object.keys(patterns.bySymbol).forEach(key => {
      const p = patterns.bySymbol[key];
      p.avgPnl = p.totalPnl / p.count;
    });

    return patterns;
  }

  identifyBestSetups(winningTrades) {
    const setups = winningTrades.map(trade => ({
      symbol: trade.symbol,
      side: trade.side,
      entryPrice: trade.entryPrice,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      pnl: trade.pnl,
      pnlPercent: trade.pnlPercent,
      duration: trade.duration,
      strategy: trade.strategy,
      reasoning: trade.reasoning
    }));

    // Trier par PnL et retourner les meilleurs
    return setups
      .sort((a, b) => (b.pnl || 0) - (a.pnl || 0))
      .slice(0, 10);
  }

  identifyWorstSetups(losingTrades) {
    const setups = losingTrades.map(trade => ({
      symbol: trade.symbol,
      side: trade.side,
      entryPrice: trade.entryPrice,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      pnl: trade.pnl,
      pnlPercent: trade.pnlPercent,
      exitReason: trade.exitReason,
      strategy: trade.strategy
    }));

    return setups
      .sort((a, b) => (a.pnl || 0) - (b.pnl || 0))
      .slice(0, 5); // Top 5 des pires
  }

  calculateOptimalParameters(trades) {
    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    
    if (winningTrades.length === 0) return null;

    // Calculer les paramètres optimaux basés sur les trades gagnants
    const avgRiskReward = winningTrades.reduce((sum, t) => {
      if (t.stopLoss && t.takeProfit) {
        const risk = Math.abs(t.entryPrice - t.stopLoss);
        const reward = Math.abs(t.takeProfit - t.entryPrice);
        return sum + (reward / risk);
      }
      return sum;
    }, 0) / winningTrades.length;

    const avgDuration = winningTrades.reduce((sum, t) => sum + (t.duration || 0), 0) / winningTrades.length;

    const optimalSL = winningTrades
      .filter(t => t.stopLoss)
      .reduce((sum, t) => sum + Math.abs(t.entryPrice - t.stopLoss), 0) / winningTrades.filter(t => t.stopLoss).length;

    return {
      riskRewardRatio: avgRiskReward || 2,
      avgTradeDuration: avgDuration,
      optimalStopDistance: optimalSL,
      recommendedLeverage: this.calculateOptimalLeverage(trades),
      positionSizePercent: this.calculateOptimalPositionSize(trades)
    };
  }

  calculateOptimalLeverage(trades) {
    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    const avgLeverage = winningTrades.reduce((sum, t) => sum + (t.leverage || 1), 0) / winningTrades.length;
    return Math.min(Math.round(avgLeverage), 10); // Max 10x
  }

  calculateOptimalPositionSize(trades) {
    // Recommander 2-3% du portefeuille par trade
    const riskAnalysis = this.analyzeRisk(trades);
    if (riskAnalysis.avgLossPercent > 5) {
      return 1; // Réduire si pertes élevées
    }
    return riskAnalysis.winRate > 60 ? 3 : 2;
  }

  // ========== 2. SCORING DES STRATÉGIES ==========
  async calculateStrategyScore(userId, strategyName) {
    const trades = await Trade.find({
      userId,
      strategy: strategyName,
      status: 'closed'
    });

    if (trades.length < 5) return null; // Pas assez de données

    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const maxDrawdown = this.calculateMaxDrawdown(trades);

    const score = {
      strategy: strategyName,
      totalTrades: trades.length,
      winRate: (winningTrades.length / trades.length) * 100,
      totalProfit: totalPnl,
      profitFactor: this.calculateProfitFactor(trades),
      maxDrawdown,
      sharpeRatio: this.calculateSharpeRatio(trades),
      expectancy: this.calculateExpectancy(trades),
      score: 0, // Score composite 0-100
      grade: 'F', // A, B, C, D, F
      recommendation: 'avoid'
    };

    // Calculer le score composite (0-100)
    score.score = this.calculateCompositeScore(score);
    score.grade = this.scoreToGrade(score.score);
    score.recommendation = this.getRecommendation(score);

    this.strategyScores.set(`${userId}_${strategyName}`, score);
    return score;
  }

  calculateCompositeScore(metrics) {
    let score = 0;
    
    // Win rate (max 30 points)
    score += Math.min(metrics.winRate * 0.3, 30);
    
    // Profit factor (max 25 points)
    score += Math.min(metrics.profitFactor * 5, 25);
    
    // Drawdown (max 20 points) - moins de drawdown = plus de points
    score += Math.max(20 - (metrics.maxDrawdown / 5), 0);
    
    // Sharpe ratio (max 15 points)
    score += Math.min(metrics.sharpeRatio * 3, 15);
    
    // Expectancy (max 10 points)
    score += Math.min(Math.max(metrics.expectancy * 2, 0), 10);

    return Math.round(score);
  }

  scoreToGrade(score) {
    if (score >= 80) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    if (score >= 35) return 'D';
    return 'F';
  }

  getRecommendation(score) {
    if (score.score >= 70) return 'use';
    if (score.score >= 50) return 'caution';
    return 'avoid';
  }

  calculateProfitFactor(trades) {
    const grossProfit = trades
      .filter(t => (t.pnl || 0) > 0)
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(trades
      .filter(t => (t.pnl || 0) < 0)
      .reduce((sum, t) => sum + (t.pnl || 0), 0));
    return grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  }

  calculateMaxDrawdown(trades) {
    let maxDrawdown = 0;
    let peak = 0;
    let currentBalance = 0;

    trades.forEach(trade => {
      currentBalance += trade.pnl || 0;
      if (currentBalance > peak) {
        peak = currentBalance;
      }
      const drawdown = ((peak - currentBalance) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return maxDrawdown;
  }

  calculateSharpeRatio(trades) {
    const returns = trades.map(t => t.pnlPercent || 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    return stdDev > 0 ? (avgReturn - 2) / stdDev : 0; // 2% = risk-free rate
  }

  calculateExpectancy(trades) {
    const winRate = trades.filter(t => (t.pnl || 0) > 0).length / trades.length;
    const avgWin = trades.filter(t => (t.pnl || 0) > 0).reduce((sum, t) => sum + (t.pnl || 0), 0) / trades.filter(t => (t.pnl || 0) > 0).length || 0;
    const avgLoss = Math.abs(trades.filter(t => (t.pnl || 0) < 0).reduce((sum, t) => sum + (t.pnl || 0), 0)) / trades.filter(t => (t.pnl || 0) < 0).length || 1;
    return (winRate * avgWin) - ((1 - winRate) * avgLoss);
  }

  // ========== 3. DÉTECTION DE PATTERNS ==========
  async detectPatterns(symbol, timeframe, priceData) {
    const patterns = {
      symbol,
      timeframe,
      timestamp: new Date(),
      detected: [],
      confidence: 0,
      recommendation: null
    };

    // Détecter les patterns de prix
    if (this.isTrending(priceData)) {
      patterns.detected.push('trending');
      patterns.trendDirection = this.getTrendDirection(priceData);
    } else if (this.isRanging(priceData)) {
      patterns.detected.push('ranging');
      patterns.support = this.findSupport(priceData);
      patterns.resistance = this.findResistance(priceData);
    }

    // Détecter les bougies significatives
    const lastCandle = priceData[priceData.length - 1];
    if (this.isEngulfingPattern(priceData)) {
      patterns.detected.push('engulfing');
    }
    if (this.isDoji(lastCandle)) {
      patterns.detected.push('doji');
    }

    // Calculer la confiance globale
    patterns.confidence = this.calculatePatternConfidence(patterns, priceData);

    // Générer une recommandation
    patterns.recommendation = this.generateRecommendation(patterns);

    this.patterns.set(`${symbol}_${timeframe}`, patterns);
    return patterns;
  }

  isTrending(priceData) {
    if (priceData.length < 20) return false;
    const sma20 = this.calculateSMA(priceData, 20);
    const currentPrice = priceData[priceData.length - 1].close;
    const deviation = Math.abs(currentPrice - sma20) / sma20;
    return deviation > 0.02; // 2% de déviation = trending
  }

  isRanging(priceData) {
    if (priceData.length < 20) return false;
    const highs = priceData.slice(-20).map(c => c.high);
    const lows = priceData.slice(-20).map(c => c.low);
    const range = Math.max(...highs) - Math.min(...lows);
    const avgPrice = priceData.slice(-20).reduce((sum, c) => sum + c.close, 0) / 20;
    return (range / avgPrice) < 0.05; // < 5% de range = ranging
  }

  getTrendDirection(priceData) {
    const sma50 = this.calculateSMA(priceData, 50);
    const currentPrice = priceData[priceData.length - 1].close;
    return currentPrice > sma50 ? 'up' : 'down';
  }

  findSupport(priceData) {
    const lows = priceData.slice(-20).map(c => c.low);
    return Math.min(...lows);
  }

  findResistance(priceData) {
    const highs = priceData.slice(-20).map(c => c.high);
    return Math.max(...highs);
  }

  isEngulfingPattern(priceData) {
    if (priceData.length < 2) return false;
    const prev = priceData[priceData.length - 2];
    const curr = priceData[priceData.length - 1];
    
    const prevBody = Math.abs(prev.open - prev.close);
    const currBody = Math.abs(curr.open - curr.close);
    
    return currBody > prevBody * 1.5 && 
           ((curr.close > curr.open && prev.close < prev.open) || 
            (curr.close < curr.open && prev.close > prev.open));
  }

  isDoji(candle) {
    const body = Math.abs(candle.open - candle.close);
    const range = candle.high - candle.low;
    return body / range < 0.1; // Corps < 10% de la range
  }

  calculateSMA(priceData, period) {
    const closes = priceData.slice(-period).map(c => c.close);
    return closes.reduce((sum, c) => sum + c, 0) / period;
  }

  calculatePatternConfidence(patterns, priceData) {
    let confidence = 50; // Base
    
    // Augmenter selon le nombre de patterns détectés
    confidence += patterns.detected.length * 10;
    
    // Ajuster selon la volatilité
    const volatility = this.calculateVolatility(priceData);
    if (volatility > 0.05) confidence -= 10; // Haute volatilité = moins confiant
    
    return Math.min(Math.max(confidence, 0), 100);
  }

  calculateVolatility(priceData) {
    const returns = [];
    for (let i = 1; i < priceData.length; i++) {
      returns.push((priceData[i].close - priceData[i-1].close) / priceData[i-1].close);
    }
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  generateRecommendation(patterns) {
    if (patterns.detected.includes('trending') && patterns.trendDirection === 'up') {
      return { action: 'long', confidence: patterns.confidence };
    }
    if (patterns.detected.includes('trending') && patterns.trendDirection === 'down') {
      return { action: 'short', confidence: patterns.confidence };
    }
    if (patterns.detected.includes('ranging')) {
      return { action: 'range', confidence: patterns.confidence, support: patterns.support, resistance: patterns.resistance };
    }
    return { action: 'wait', confidence: patterns.confidence };
  }

  // ========== 4. ANALYSE POST-TRADE ==========
  async analyzeTradeResult(tradeId) {
    const trade = await Trade.findById(tradeId);
    if (!trade || trade.status !== 'closed') return null;

    const analysis = {
      tradeId: trade._id,
      symbol: trade.symbol,
      result: (trade.pnl || 0) > 0 ? 'win' : 'loss',
      pnl: trade.pnl,
      pnlPercent: trade.pnlPercent,
      exitReason: trade.exitReason,
      lessons: [],
      improvements: [],
      similarTrades: await this.findSimilarTrades(trade),
      marketContext: await this.getMarketContext(trade.symbol, trade.entryTime),
      aiExplanation: this.generateAIExplanation(trade)
    };

    // Analyser pourquoi ça a marché/échoué
    if (analysis.result === 'win') {
      analysis.lessons.push(this.analyzeWinningTrade(trade));
    } else {
      analysis.lessons.push(this.analyzeLosingTrade(trade));
      analysis.improvements = this.suggestImprovements(trade);
    }

    // Sauvegarder l'analyse
    await this.saveTradeAnalysis(analysis);

    // Mettre à jour la mémoire
    await this.updateMemoryAfterTrade(trade.userId, analysis);

    return analysis;
  }

  analyzeWinningTrade(trade) {
    const lessons = [];
    
    if (trade.exitReason === 'take_profit') {
      lessons.push('✅ TP bien placé - objectif atteint');
    }
    if (trade.duration && trade.duration < 3600) {
      lessons.push('✅ Trade rapide - bon timing d\'entrée');
    }
    if (trade.stopLoss && trade.pnl > 0) {
      lessons.push('✅ SL protégé - gestion du risque efficace');
    }
    
    return lessons;
  }

  analyzeLosingTrade(trade) {
    const lessons = [];
    
    if (trade.exitReason === 'stop_loss') {
      lessons.push('⚠️ SL touché - peut-être trop serré ou mauvais timing');
    }
    if (trade.exitReason === 'manual') {
      lessons.push('⚠️ Fermeture manuelle - émotion ou changement de plan');
    }
    if (trade.pnlPercent && trade.pnlPercent < -5) {
      lessons.push('⚠️ Perte importante - revoir le sizing ou le SL');
    }
    
    return lessons;
  }

  suggestImprovements(trade) {
    const improvements = [];
    
    if (!trade.stopLoss || Math.abs(trade.entryPrice - trade.stopLoss) / trade.entryPrice < 0.01) {
      improvements.push('Augmenter la distance du SL (actuellement < 1%)');
    }
    if (trade.duration && trade.duration > 86400) {
      improvements.push('Réduire le temps de holding - trade devenu stagnant');
    }
    if (trade.leverage && trade.leverage > 5) {
      improvements.push('Réduire le levier - trop risqué');
    }
    
    return improvements;
  }

  async findSimilarTrades(trade) {
    return await Trade.find({
      userId: trade.userId,
      symbol: trade.symbol,
      side: trade.side,
      status: 'closed',
      _id: { $ne: trade._id }
    }).limit(5);
  }

  async getMarketContext(symbol, timestamp) {
    // Récupérer le contexte du marché au moment du trade
    return {
      timestamp,
      regime: this.marketRegimes.get(symbol) || 'unknown',
      volatility: 'normal' // À calculer avec les données de prix
    };
  }

  generateAIExplanation(trade) {
    const isWin = (trade.pnl || 0) > 0;
    const direction = trade.side === 'buy' || trade.side === 'LONG' ? 'LONG' : 'SHORT';
    
    let explanation = `${direction} sur ${trade.symbol} `;
    
    if (isWin) {
      explanation += `a généré ${trade.pnl?.toFixed(2)} USDT de profit `;
      if (trade.exitReason === 'take_profit') {
        explanation += `car le Take Profit a été atteint.`;
      } else if (trade.exitReason === 'manual') {
        explanation += `grâce à une fermeture manuelle opportune.`;
      }
    } else {
      explanation += `a perdu ${Math.abs(trade.pnl || 0).toFixed(2)} USDT `;
      if (trade.exitReason === 'stop_loss') {
        explanation += `car le Stop Loss a été touché.`;
      } else {
        explanation += `suite à une fermeture ${trade.exitReason}.`;
      }
    }
    
    if (trade.reasoning) {
      explanation += ` Contexte: ${trade.reasoning}`;
    }
    
    return explanation;
  }

  async saveTradeAnalysis(analysis) {
    // Sauvegarder dans une collection dédiée si besoin
    console.log('[LearningEngine] Analyse sauvegardée:', analysis.tradeId);
  }

  async updateMemoryAfterTrade(userId, analysis) {
    const memory = this.memory.get(userId.toString());
    if (memory) {
      memory.totalTrades++;
      memory.lastUpdated = new Date();
      
      // Ajouter à la mémoire récente
      if (!memory.recentAnalyses) memory.recentAnalyses = [];
      memory.recentAnalyses.unshift(analysis);
      if (memory.recentAnalyses.length > 50) {
        memory.recentAnalyses.pop();
      }
    }
  }

  // ========== 5. OPTIMISATION AUTOMATIQUE ==========
  async optimizeStrategy(userId, strategyName) {
    const score = await this.calculateStrategyScore(userId, strategyName);
    if (!score) return null;

    const optimizations = {
      strategy: strategyName,
      currentScore: score.score,
      recommendations: [],
      parameterAdjustments: {}
    };

    if (score.winRate < 40) {
      optimizations.recommendations.push('Win rate faible - envisager de filtrer plus les setups');
      optimizations.parameterAdjustments.minConfidence = 70; // Augmenter la confiance min
    }

    if (score.maxDrawdown > 20) {
      optimizations.recommendations.push('Drawdown élevé - réduire le risque par trade');
      optimizations.parameterAdjustments.riskPerTrade = 1; // 1% au lieu de 2-3%
    }

    if (score.profitFactor < 1.5) {
      optimizations.recommendations.push('Profit factor faible - ajuster les ratios R:R');
      optimizations.parameterAdjustments.minRiskReward = 2.5; // Min 1:2.5
    }

    // Ajuster les SL/TP si nécessaire
    const optimalParams = this.calculateOptimalParameters(
      await Trade.find({ userId, strategy: strategyName, status: 'closed' })
    );
    
    if (optimalParams) {
      optimizations.parameterAdjustments.stopLossDistance = optimalParams.optimalStopDistance;
      optimizations.parameterAdjustments.riskRewardRatio = optimalParams.riskRewardRatio;
    }

    return optimizations;
  }

  // ========== 6. BOUCLE D'APPRENTISSAGE ==========
  startLearningLoop() {
    // Analyser les trades toutes les 5 minutes
    setInterval(async () => {
      await this.processPendingAnalyses();
    }, 5 * 60 * 1000);

    // Recalculer les scores des stratégies toutes les heures
    setInterval(async () => {
      await this.updateAllStrategyScores();
    }, 60 * 60 * 1000);

    console.log('[LearningEngine] Boucle d\'apprentissage démarrée');
  }

  async processPendingAnalyses() {
    const closedTrades = await Trade.find({
      status: 'closed',
      analyzed: { $ne: true }
    }).limit(10);

    for (const trade of closedTrades) {
      await this.analyzeTradeResult(trade._id);
      trade.analyzed = true;
      await trade.save();
    }

    if (closedTrades.length > 0) {
      console.log(`[LearningEngine] ${closedTrades.length} trades analysés`);
    }
  }

  async updateAllStrategyScores() {
    const users = await User.find({ 'stats.totalTrades': { $gt: 0 } });
    
    for (const user of users) {
      const strategies = [...new Set(
        await Trade.distinct('strategy', { userId: user._id, strategy: { $exists: true } })
      )];
      
      for (const strategy of strategies) {
        await this.calculateStrategyScore(user._id, strategy);
      }
    }
  }

  // ========== 7. API PUBLIQUE ==========
  async getLearningReport(userId) {
    const memory = await this.buildUserMemory(userId);
    const strategies = await Trade.distinct('strategy', { userId, strategy: { $exists: true } });
    const strategyScores = [];
    
    for (const strategy of strategies) {
      const score = this.strategyScores.get(`${userId}_${strategy}`);
      if (score) strategyScores.push(score);
    }

    return {
      memory,
      strategyScores: strategyScores.sort((a, b) => b.score - a.score),
      recommendations: this.generateGlobalRecommendations(memory, strategyScores),
      lastUpdated: new Date()
    };
  }

  generateGlobalRecommendations(memory, strategyScores) {
    const recommendations = [];
    
    if (strategyScores.length > 0) {
      const bestStrategy = strategyScores[0];
      if (bestStrategy.score > 70) {
        recommendations.push(`Focus sur la stratégie "${bestStrategy.strategy}" (score: ${bestStrategy.score})`);
      }
      
      const badStrategies = strategyScores.filter(s => s.score < 40);
      if (badStrategies.length > 0) {
        recommendations.push(`Éviter les stratégies: ${badStrategies.map(s => s.strategy).join(', ')}`);
      }
    }

    if (memory.optimalParameters) {
      recommendations.push(`Risk/Reward optimal: 1:${memory.optimalParameters.riskRewardRatio.toFixed(1)}`);
    }

    return recommendations;
  }

  async getSetupRecommendation(userId, symbol, marketData) {
    const memory = this.memory.get(userId.toString()) || await this.buildUserMemory(userId);
    const patterns = await this.detectPatterns(symbol, '1h', marketData);
    
    // Combiner mémoire + patterns actuels
    const recommendation = {
      symbol,
      action: patterns.recommendation.action,
      confidence: patterns.confidence,
      reasons: [],
      optimalParameters: memory.optimalParameters,
      warnings: []
    };

    // Vérifier si ce symbole a historiquement bien performé
    const symbolPattern = memory.winningPatterns?.bySymbol?.[symbol];
    if (symbolPattern && symbolPattern.avgPnl > 0) {
      recommendation.reasons.push(`${symbol} a historiquement bien performé (+${symbolPattern.avgPnl.toFixed(2)} en moyenne)`);
    }

    // Vérifier les patterns à éviter
    const recentLosses = memory.worstSetups?.filter(s => s.symbol === symbol);
    if (recentLosses && recentLosses.length > 2) {
      recommendation.warnings.push(`${symbol} a eu plusieurs pertes récentes`);
      recommendation.confidence -= 10;
    }

    return recommendation;
  }
}

// Singleton
const learningEngine = new LearningEngine();

module.exports = learningEngine;
