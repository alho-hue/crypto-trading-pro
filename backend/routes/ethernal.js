// Routes pour Ethernal IA - API pour les fonctionnalités avancées
const express = require('express');
const jwt = require('jsonwebtoken');
const ethernalAI = require('../services/ethernalAI');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify token - supporte id et userId
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();

    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId || decoded.id;

    if (!req.userId) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Veuillez vous connecter' });
  }
};

// @route   POST /api/ethernal/chat
// @desc    Envoyer un message à Ethernal IA avec contexte utilisateur
// @access  Private
router.post('/chat', auth, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message vide' });
    }
    
    const user = await require('../models/User').findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const response = await ethernalAI.generateResponse(content, user.username, req.userId);
    
    res.json({
      response,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Ethernal chat error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/ethernal/analysis/:symbol
// @desc    Obtenir une analyse technique pour un symbole
// @access  Private
router.get('/analysis/:symbol', auth, async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const analysis = await ethernalAI.generateTechnicalAnalysis(symbol.toUpperCase());
    
    if (!analysis) {
      return res.status(404).json({ error: 'Impossible de générer l\'analyse' });
    }
    
    res.json({
      analysis,
      symbol: symbol.toUpperCase(),
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/ethernal/market/:symbol
// @desc    Obtenir le contexte de marché pour un symbole
// @access  Private
router.get('/market/:symbol', auth, async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const context = await ethernalAI.getMarketContext(symbol.toUpperCase());
    
    res.json({
      context,
      symbol: symbol.toUpperCase(),
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Market context error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/ethernal/alerts
// @desc    Créer une alerte de prix
// @access  Private
router.post('/alerts', auth, async (req, res) => {
  try {
    const { symbol, condition, targetPrice, notificationChannels } = req.body;
    
    if (!symbol || !condition || !targetPrice) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }
    
    const alert = await ethernalAI.alertService.createAlert(
      req.userId,
      symbol.toUpperCase(),
      condition,
      targetPrice,
      notificationChannels || ['push']
    );
    
    res.json({
      alert,
      message: 'Alerte créée avec succès'
    });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/ethernal/alerts
// @desc    Obtenir toutes les alertes de l'utilisateur
// @access  Private
router.get('/alerts', auth, async (req, res) => {
  try {
    const alerts = ethernalAI.alertService.getUserAlerts(req.userId);
    
    res.json({ alerts });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   DELETE /api/ethernal/alerts/:alertId
// @desc    Supprimer une alerte
// @access  Private
router.delete('/alerts/:alertId', auth, async (req, res) => {
  try {
    const { alertId } = req.params;
    
    const deleted = ethernalAI.alertService.deleteAlert(alertId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Alerte non trouvée' });
    }
    
    res.json({ message: 'Alerte supprimée' });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/ethernal/auto-trading/enable
// @desc    Activer le mode auto-trading
// @access  Private
router.post('/auto-trading/enable', auth, async (req, res) => {
  try {
    const config = req.body;
    
    console.log('[Ethernal Route] Activation auto-trading:', { 
      userId: req.userId, 
      user: req.user?.id,
      config 
    });
    
    if (!req.userId && !req.user?.id) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }
    
    const userId = req.userId || req.user?.id;
    const botConfig = await ethernalAI.autoTradingService.enableAutoTrading(userId, config);
    
    res.json({
      config: botConfig,
      message: 'Auto-trading activé'
    });
  } catch (error) {
    console.error('[Ethernal Route] Enable auto-trading error:', error);
    res.status(500).json({ 
      error: 'Erreur serveur', 
      message: error.message,
      details: error.stack 
    });
  }
});

// @route   POST /api/ethernal/auto-trading/disable
// @desc    Désactiver le mode auto-trading
// @access  Private
router.post('/auto-trading/disable', auth, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    await ethernalAI.autoTradingService.disableAutoTrading(userId);
    
    res.json({ message: 'Auto-trading désactivé' });
  } catch (error) {
    console.error('Disable auto-trading error:', error);
    res.status(500).json({ error: 'Erreur serveur', message: error.message });
  }
});

// @route   GET /api/ethernal/auto-trading/status
// @desc    Obtenir le statut du bot de trading
// @access  Private
router.get('/auto-trading/status', auth, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    const status = ethernalAI.autoTradingService.getBotStatus(userId);
    
    res.json({ status });
  } catch (error) {
    console.error('Get auto-trading status error:', error);
    res.status(500).json({ error: 'Erreur serveur', message: error.message });
  }
});

// @route   GET /api/ethernal/auto-trading/performance
// @desc    Obtenir les statistiques de performance du bot
// @access  Private
router.get('/auto-trading/performance', auth, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    const stats = ethernalAI.autoTradingService.getPerformanceStats(userId);
    
    res.json({ stats });
  } catch (error) {
    console.error('Get auto-trading performance error:', error);
    res.status(500).json({ error: 'Erreur serveur', message: error.message });
  }
});

// ...
router.get('/portfolio', auth, async (req, res) => {
  try {
    const portfolio = await ethernalAI.portfolioService.getUserPortfolio(req.userId);
    
    res.json({ portfolio });
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/ethernal/portfolio/performance
// @desc    Obtenir la performance du portefeuille
// @access  Private
router.get('/portfolio/performance', auth, async (req, res) => {
  try {
    const { period } = req.query;
    const performance = await ethernalAI.portfolioService.calculatePortfolioPerformance(req.userId, period);
    
    res.json({ performance });
  } catch (error) {
    console.error('Get portfolio performance error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/ethernal/portfolio/recommendations
// @desc    Obtenir les recommandations de portefeuille
// @access  Private
router.get('/portfolio/recommendations', auth, async (req, res) => {
  try {
    const recommendations = await ethernalAI.portfolioService.getPortfolioRecommendations(req.userId);
    
    res.json({ recommendations });
  } catch (error) {
    console.error('Get portfolio recommendations error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/ethernal/sentiment/:symbol
// @desc    Obtenir le sentiment de marché pour un symbole
// @access  Private
router.get('/sentiment/:symbol', auth, async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const sentiment = await ethernalAI.sentimentService.getOverallMarketSentiment(symbol.toUpperCase() + 'USDT');
    
    res.json({ sentiment, symbol: symbol.toUpperCase() });
  } catch (error) {
    console.error('Get sentiment error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/ethernal/fear-greed
// @desc    Obtenir le Fear & Greed Index
// @access  Private
router.get('/fear-greed', auth, async (req, res) => {
  try {
    const fng = await ethernalAI.sentimentService.getFearGreedIndex();
    const analysis = ethernalAI.sentimentService.analyzeFearGreedSentiment(fng);
    
    res.json({
      fng,
      analysis
    });
  } catch (error) {
    console.error('Get fear-greed error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/ethernal/conversation/history
// @desc    Obtenir l'historique conversationnel de l'utilisateur
// @access  Private
router.get('/conversation/history', auth, async (req, res) => {
  try {
    const history = ethernalAI.conversationMemory.getHistory(req.userId);
    const summary = ethernalAI.conversationMemory.generateConversationSummary(req.userId);
    const stats = ethernalAI.conversationMemory.getConversationStats(req.userId);
    
    res.json({
      history,
      summary,
      stats
    });
  } catch (error) {
    console.error('Get conversation history error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   DELETE /api/ethernal/conversation/history
// @desc    Effacer l'historique conversationnel de l'utilisateur
// @access  Private
router.delete('/conversation/history', auth, async (req, res) => {
  try {
    ethernalAI.conversationMemory.clearHistory(req.userId);
    
    res.json({ message: 'Historique effacé' });
  } catch (error) {
    console.error('Clear conversation history error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
