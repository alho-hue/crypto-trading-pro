/**
 * 🤖 Admin AI Service - NEUROVEST
 * Analyse intelligente de la plateforme en temps réel
 * Détection d'anomalies, alertes, recommandations
 */

const Trade = require('../models/Trade');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AutoTradingConfig = require('../models/AutoTradingConfig');
const Alert = require('../models/Alert');
const os = require('os');

class AdminAIService {
  constructor() {
    this.metrics = {
      trading: {},
      users: {},
      payments: {},
      bots: {},
      system: {},
      risk: {}
    };
    this.alerts = [];
    this.healthScore = 100;
    this.lastAnalysis = null;
  }

  /**
   * 📊 Analyse complète de la plateforme
   */
  async analyzePlatform() {
    const analysis = {
      timestamp: new Date(),
      healthScore: 0,
      status: 'healthy', // healthy, warning, critical
      summary: {},
      alerts: [],
      recommendations: [],
      metrics: {}
    };

    try {
      // Analyse parallèle de tous les composants
      const [
        tradingAnalysis,
        userAnalysis,
        paymentAnalysis,
        botAnalysis,
        systemAnalysis,
        riskAnalysis
      ] = await Promise.all([
        this.analyzeTrading(),
        this.analyzeUsers(),
        this.analyzePayments(),
        this.analyzeBots(),
        this.analyzeSystem(),
        this.analyzeRisk()
      ]);

      analysis.metrics = {
        trading: tradingAnalysis,
        users: userAnalysis,
        payments: paymentAnalysis,
        bots: botAnalysis,
        system: systemAnalysis,
        risk: riskAnalysis
      };

      // Générer résumé intelligent
      analysis.summary = this.generateSummary(analysis.metrics);
      
      // Générer alertes
      analysis.alerts = this.generateAlerts(analysis.metrics);
      
      // Générer recommandations
      analysis.recommendations = this.generateRecommendations(analysis.metrics);

      // Calculer score de santé global
      analysis.healthScore = this.calculateHealthScore(analysis.metrics);
      analysis.status = analysis.healthScore >= 80 ? 'healthy' : 
                       analysis.healthScore >= 50 ? 'warning' : 'critical';

      this.lastAnalysis = analysis;
      return analysis;

    } catch (error) {
      console.error('[AdminAI] Analysis error:', error);
      return {
        ...analysis,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * 📈 Analyse Trading
   */
  async analyzeTrading() {
    const now = new Date();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    
    try {
      // Trades des dernières 24h
      const trades24h = await Trade.find({ 
        createdAt: { $gte: last24h } 
      }).lean();

      const activeTrades = await Trade.find({ 
        status: 'open' 
      }).lean();

      // Calculer métriques
      const profitableTrades = trades24h.filter(t => t.pnl > 0);
      const losingTrades = trades24h.filter(t => t.pnl < 0);
      
      const totalVolume = trades24h.reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalPnL = trades24h.reduce((sum, t) => sum + (t.pnl || 0), 0);
      
      // Détecter erreurs (trades avec prix anormaux)
      const errors = trades24h.filter(t => {
        const priceDiff = Math.abs(t.exitPrice - t.entryPrice) / t.entryPrice;
        return priceDiff > 0.5; // >50% de différence = anormal
      });

      // Anomalies de perte
      const abnormalLosses = losingTrades.filter(t => 
        t.pnl < -1000 || (t.pnl / t.amount) < -0.2 // Perte >$1000 ou >20%
      );

      return {
        period: '24h',
        totalTrades: trades24h.length,
        activeTrades: activeTrades.length,
        winRate: trades24h.length > 0 ? (profitableTrades.length / trades24h.length * 100).toFixed(1) : 0,
        totalVolume: totalVolume.toFixed(2),
        totalPnL: totalPnL.toFixed(2),
        profitableTrades: profitableTrades.length,
        losingTrades: losingTrades.length,
        errors: errors.length,
        abnormalLosses: abnormalLosses.length,
        status: errors.length > 5 || abnormalLosses.length > 3 ? 'critical' :
                errors.length > 0 || abnormalLosses.length > 0 ? 'warning' : 'healthy'
      };

    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * 👥 Analyse Utilisateurs
   */
  async analyzeUsers() {
    try {
      const now = new Date();
      const last24h = new Date(now - 24 * 60 * 60 * 1000);
      const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

      const totalUsers = await User.countDocuments();
      const newUsers24h = await User.countDocuments({ createdAt: { $gte: last24h } });
      const activeUsers24h = await User.countDocuments({ lastLogin: { $gte: last24h } });
      
      // Détecter comportements suspects
      const suspiciousUsers = await User.find({
        $or: [
          { loginAttempts: { $gte: 5 } },
          { failedTrades: { $gte: 10 } },
          { createdAt: { $gte: last24h }, tradesCount: { $gte: 50 } } // Bot suspect
        ]
      }).lean();

      // Utilisateurs bannis récemment
      const bannedUsers = await User.countDocuments({
        isBanned: true,
        bannedAt: { $gte: last7d }
      });

      // Spam potentiel (trop de messages)
      const potentialSpam = await User.find({
        messageCount24h: { $gte: 100 }
      }).lean();

      return {
        totalUsers,
        newUsers24h,
        activeUsers24h,
        suspiciousUsers: suspiciousUsers.length,
        bannedUsers7d: bannedUsers,
        potentialSpam: potentialSpam.length,
        status: suspiciousUsers.length > 10 || potentialSpam.length > 5 ? 'warning' : 'healthy'
      };

    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * 💳 Analyse Paiements (Données réelles)
   */
  async analyzePayments() {
    try {
      const now = new Date();
      const last24h = new Date(now - 24 * 60 * 60 * 1000);

      const transactions24h = await Transaction.find({
        createdAt: { $gte: last24h }
      }).lean();

      const pending = transactions24h.filter(t => t.status === 'pending');
      const failed = transactions24h.filter(t => t.status === 'failed');
      const completed = transactions24h.filter(t => t.status === 'completed');

      const totalDeposits = completed
        .filter(t => t.type === 'deposit')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalWithdrawals = completed
        .filter(t => t.type === 'withdrawal')
        .reduce((sum, t) => sum + t.amount, 0);

      // Détecter anomalies
      const suspiciousAmounts = transactions24h.filter(t => 
        t.amount > 50000 || t.amount < 0.01
      );

      const rapidTransactions = await Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: last24h },
            userId: { $exists: true }
          }
        },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 }
          }
        },
        {
          $match: {
            count: { $gte: 20 } // >20 transactions en 24h = suspect
          }
        }
      ]);

      return {
        period: '24h',
        totalTransactions: transactions24h.length,
        pending: pending.length,
        failed: failed.length,
        completed: completed.length,
        totalDeposits: totalDeposits.toFixed(2),
        totalWithdrawals: totalWithdrawals.toFixed(2),
        suspiciousAmounts: suspiciousAmounts.length,
        rapidTransactions: rapidTransactions.length,
        status: failed.length > 10 || suspiciousAmounts.length > 5 ? 'critical' :
                failed.length > 0 || rapidTransactions.length > 0 ? 'warning' : 'healthy'
      };

    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * 🤖 Analyse Bots
   */
  async analyzeBots() {
    try {
      const bots = await AutoTradingConfig.find({
        isActive: true
      }).lean();

      const totalBots = bots.length;
      const runningBots = bots.filter(b => b.status === 'running').length;
      const errorBots = bots.filter(b => b.status === 'error' || b.consecutiveErrors > 3);
      const pausedBots = bots.filter(b => b.status === 'paused');

      // Performance des bots
      const performance = bots.reduce((acc, bot) => {
        acc.totalProfit += bot.totalProfit || 0;
        acc.totalTrades += bot.tradesCount || 0;
        return acc;
      }, { totalProfit: 0, totalTrades: 0 });

      // Détecter bugs (bots avec erreurs répétées)
      const buggyBots = bots.filter(b => 
        b.consecutiveErrors > 5 || b.lastError
      );

      return {
        totalBots,
        runningBots,
        errorBots: errorBots.length,
        pausedBots: pausedBots.length,
        totalProfit: performance.totalProfit.toFixed(2),
        totalTrades: performance.totalTrades,
        buggyBots: buggyBots.length,
        status: errorBots.length > 5 || buggyBots.length > 3 ? 'critical' :
                errorBots.length > 0 || buggyBots.length > 0 ? 'warning' : 'healthy'
      };

    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * ⚙️ Analyse Système
   */
  async analyzeSystem() {
    try {
      const cpuUsage = os.loadavg()[0] * 100 / os.cpus().length;
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memoryUsage = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
      const uptime = process.uptime();

      // Simuler latence API (à remplacer par monitoring réel)
      const apiLatency = Math.random() * 100 + 50; // 50-150ms

      return {
        cpuUsage: cpuUsage.toFixed(1),
        memoryUsage,
        uptime: this.formatUptime(uptime),
        apiLatency: apiLatency.toFixed(0),
        platform: os.platform(),
        status: cpuUsage > 80 || memoryUsage > 90 || apiLatency > 500 ? 'critical' :
                cpuUsage > 60 || memoryUsage > 80 || apiLatency > 200 ? 'warning' : 'healthy'
      };

    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * ⚠️ Analyse Risque Global
   */
  async analyzeRisk() {
    try {
      // Calculer drawdown global (perte depuis le pic)
      const allTrades = await Trade.find().sort({ createdAt: -1 }).limit(1000).lean();
      
      let peak = 0;
      let maxDrawdown = 0;
      let currentEquity = 0;

      allTrades.forEach(trade => {
        currentEquity += trade.pnl || 0;
        if (currentEquity > peak) peak = currentEquity;
        const drawdown = peak - currentEquity;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      });

      // Exposition marché (montant total en position)
      const activeTrades = await Trade.find({ status: 'open' }).lean();
      const totalExposure = activeTrades.reduce((sum, t) => sum + (t.amount || 0), 0);

      // Nombre de positions par paire (concentration)
      const pairExposure = activeTrades.reduce((acc, t) => {
        acc[t.pair] = (acc[t.pair] || 0) + (t.amount || 0);
        return acc;
      }, {});

      const maxPairConcentration = Math.max(...Object.values(pairExposure), 0);
      const concentrationRisk = totalExposure > 0 ? 
        (maxPairConcentration / totalExposure * 100).toFixed(1) : 0;

      return {
        maxDrawdown: maxDrawdown.toFixed(2),
        currentEquity: currentEquity.toFixed(2),
        totalExposure: totalExposure.toFixed(2),
        activePositions: activeTrades.length,
        concentrationRisk,
        status: maxDrawdown > 10000 || concentrationRisk > 50 ? 'critical' :
                maxDrawdown > 5000 || concentrationRisk > 30 ? 'warning' : 'healthy'
      };

    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * 📝 Générer résumé intelligent
   */
  generateSummary(metrics) {
    const summary = {
      keyPoints: [],
      status: 'healthy'
    };

    // Analyser trading
    if (metrics.trading.errors > 0) {
      summary.keyPoints.push(`${metrics.trading.errors} erreurs trading détectées`);
    }
    if (metrics.trading.abnormalLosses > 0) {
      summary.keyPoints.push(`${metrics.trading.abnormalLosses} pertes anormales`);
    }

    // Analyser utilisateurs
    if (metrics.users.suspiciousUsers > 0) {
      summary.keyPoints.push(`${metrics.users.suspiciousUsers} utilisateurs suspects`);
    }

    // Analyser paiements
    if (metrics.payments.failed > 0) {
      summary.keyPoints.push(`${metrics.payments.failed} paiements échoués`);
    }

    // Analyser bots
    if (metrics.bots.errorBots > 0) {
      summary.keyPoints.push(`${metrics.bots.errorBots} bots en erreur`);
    }

    // Analyser système
    if (metrics.system.status !== 'healthy') {
      summary.keyPoints.push(`Système en ${metrics.system.status}`);
    }

    // Analyser risque
    if (metrics.risk.maxDrawdown > 5000) {
      summary.keyPoints.push(`Drawdown élevé: $${metrics.risk.maxDrawdown}`);
    }

    if (summary.keyPoints.length === 0) {
      summary.keyPoints.push('Tous les systèmes fonctionnent normalement');
    }

    return summary;
  }

  /**
   * 🚨 Générer alertes
   */
  generateAlerts(metrics) {
    const alerts = [];

    // Alertes critiques
    if (metrics.trading.errors > 5) {
      alerts.push({
        id: 'trading-errors',
        severity: 'critical',
        title: 'Erreurs Trading Critiques',
        message: `${metrics.trading.errors} erreurs détectées en 24h`,
        category: 'trading',
        timestamp: new Date()
      });
    }

    if (metrics.system.status === 'critical') {
      alerts.push({
        id: 'system-critical',
        severity: 'critical',
        title: 'Système Critique',
        message: `CPU: ${metrics.system.cpuUsage}%, RAM: ${metrics.system.memoryUsage}%`,
        category: 'system',
        timestamp: new Date()
      });
    }

    if (metrics.risk.maxDrawdown > 10000) {
      alerts.push({
        id: 'high-drawdown',
        severity: 'critical',
        title: 'Drawdown Extrême',
        message: `Perte de $${metrics.risk.maxDrawdown} depuis le pic`,
        category: 'risk',
        timestamp: new Date()
      });
    }

    // Alertes warning
    if (metrics.users.suspiciousUsers > 5) {
      alerts.push({
        id: 'suspicious-users',
        severity: 'warning',
        title: 'Activité Suspecte',
        message: `${metrics.users.suspiciousUsers} utilisateurs suspects détectés`,
        category: 'users',
        timestamp: new Date()
      });
    }

    if (metrics.bots.errorBots > 0) {
      alerts.push({
        id: 'bot-errors',
        severity: 'warning',
        title: 'Bots en Erreur',
        message: `${metrics.bots.errorBots} bots nécessitent attention`,
        category: 'bots',
        timestamp: new Date()
      });
    }

    if (metrics.payments.failed > 3) {
      alerts.push({
        id: 'payment-failures',
        severity: 'warning',
        title: 'Paiements Échoués',
        message: `${metrics.payments.failed} transactions échouées`,
        category: 'payments',
        timestamp: new Date()
      });
    }

    return alerts;
  }

  /**
   * 💡 Générer recommandations
   */
  generateRecommendations(metrics) {
    const recommendations = [];

    if (metrics.trading.errors > 0) {
      recommendations.push({
        action: 'review_trades',
        priority: 'high',
        title: 'Réviser les trades en erreur',
        description: 'Vérifier les trades avec des prix anormaux'
      });
    }

    if (metrics.bots.errorBots > 0) {
      recommendations.push({
        action: 'check_bots',
        priority: 'high',
        title: 'Vérifier les bots en erreur',
        description: `${metrics.bots.errorBots} bots nécessitent une inspection`
      });
    }

    if (metrics.users.suspiciousUsers > 0) {
      recommendations.push({
        action: 'review_users',
        priority: 'medium',
        title: 'Examiner les utilisateurs suspects',
        description: `Potentiel fraude détectée sur ${metrics.users.suspiciousUsers} comptes`
      });
    }

    if (parseFloat(metrics.system.memoryUsage) > 80) {
      recommendations.push({
        action: 'optimize_memory',
        priority: 'medium',
        title: 'Optimiser la mémoire',
        description: 'Utilisation mémoire élevée détectée'
      });
    }

    if (parseFloat(metrics.risk.concentrationRisk) > 40) {
      recommendations.push({
        action: 'diversify',
        priority: 'medium',
        title: 'Diversifier les positions',
        description: 'Concentration excessive sur une paire de trading'
      });
    }

    return recommendations;
  }

  /**
   * 📊 Calculer score de santé global
   */
  calculateHealthScore(metrics) {
    let score = 100;

    // Pénalités trading
    if (metrics.trading.errors > 0) score -= metrics.trading.errors * 2;
    if (metrics.trading.abnormalLosses > 0) score -= metrics.trading.abnormalLosses * 3;

    // Pénalités utilisateurs
    if (metrics.users.suspiciousUsers > 0) score -= Math.min(metrics.users.suspiciousUsers, 10);

    // Pénalités paiements
    if (metrics.payments.failed > 0) score -= metrics.payments.failed * 2;

    // Pénalités bots
    if (metrics.bots.errorBots > 0) score -= metrics.bots.errorBots * 3;

    // Pénalités système
    if (metrics.system.status === 'warning') score -= 10;
    if (metrics.system.status === 'critical') score -= 25;

    // Pénalités risque
    if (parseFloat(metrics.risk.maxDrawdown) > 5000) score -= 15;
    if (parseFloat(metrics.risk.concentrationRisk) > 50) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 🎯 Traiter commande IA
   */
  async processCommand(command, params = {}) {
    const cmd = command.toLowerCase().trim();

    switch (cmd) {
      case 'analyse plateforme':
      case 'analyze platform':
        return await this.analyzePlatform();

      case 'problème trading':
      case 'trading problem':
        const trading = await this.analyzeTrading();
        return {
          type: 'trading_analysis',
          hasIssues: trading.errors > 0 || trading.abnormalLosses > 0,
          data: trading,
          message: trading.errors > 0 
            ? `⚠️ ${trading.errors} erreurs trading détectées`
            : trading.abnormalLosses > 0
            ? `⚠️ ${trading.abnormalLosses} pertes anormales`
            : '✅ Trading stable'
        };

      case 'état paiements':
      case 'payment status':
        const payments = await this.analyzePayments();
        return {
          type: 'payment_analysis',
          hasIssues: payments.failed > 0 || payments.suspiciousAmounts > 0,
          data: payments,
          message: payments.failed > 0
            ? `⚠️ ${payments.failed} paiements échoués`
            : '✅ Paiements fluides'
        };

      case 'top erreurs':
      case 'top errors':
        return await this.getTopErrors();

      case 'score santé':
      case 'health score':
        const analysis = await this.analyzePlatform();
        return {
          type: 'health_score',
          score: analysis.healthScore,
          status: analysis.status,
          message: `Score de santé: ${analysis.healthScore}/100 (${analysis.status})`
        };

      case 'actions rapides':
      case 'quick actions':
        return this.getQuickActions();

      default:
        return {
          type: 'unknown',
          message: 'Commande non reconnue. Essayez: "analyse plateforme", "problème trading", "état paiements", "top erreurs", "score santé"'
        };
    }
  }

  /**
   * 🔍 Obtenir top erreurs
   */
  async getTopErrors() {
    // Simuler - à remplacer par logs réels
    return {
      type: 'errors_list',
      errors: [
        { service: 'Trading', count: 3, lastError: 'API timeout' },
        { service: 'Bots', count: 2, lastError: 'Insufficient funds' },
        { service: 'Payments', count: 1, lastError: 'Webhook failed' }
      ]
    };
  }

  /**
   * ⚡ Actions rapides disponibles
   */
  getQuickActions() {
    return {
      type: 'quick_actions',
      actions: [
        { id: 'stop_all_bots', label: 'Stopper tous les bots', icon: 'pause', danger: true },
        { id: 'restart_service', label: 'Redémarrer service trading', icon: 'refresh', danger: false },
        { id: 'clear_cache', label: 'Vider cache', icon: 'trash', danger: false },
        { id: 'notify_users', label: 'Notifier utilisateurs', icon: 'bell', danger: false }
      ]
    };
  }

  /**
   * 🔄 Formater uptime
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}j ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}

module.exports = new AdminAIService();
