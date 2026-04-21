/**
 * NEUROVEST - Learning API Routes
 * Endpoints pour l'apprentissage automatique et les recommandations IA
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const learningEngine = require('../services/learningEngine');
const Trade = require('../models/Trade');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware auth
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId || decoded.id;
    if (!req.userId) return res.status(401).json({ error: 'Token invalide' });
    next();
  } catch (error) {
    res.status(401).json({ error: 'Veuillez vous connecter' });
  }
};

// ========== 1. RAPPORT D'APPRENTISSAGE ==========
// GET /api/learning/report
router.get('/report', auth, async (req, res) => {
  try {
    const report = await learningEngine.getLearningReport(req.userId);
    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('[Learning API] Erreur rapport:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 2. MÉMOIRE UTILISATEUR ==========
// GET /api/learning/memory
router.get('/memory', auth, async (req, res) => {
  try {
    const memory = await learningEngine.buildUserMemory(req.userId);
    res.json({
      success: true,
      memory
    });
  } catch (error) {
    console.error('[Learning API] Erreur mémoire:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 3. SCORING STRATÉGIES ==========
// GET /api/learning/strategies
router.get('/strategies', auth, async (req, res) => {
  try {
    const strategies = await Trade.distinct('strategy', { 
      userId: req.userId, 
      strategy: { $exists: true, $ne: null } 
    });
    
    const scores = [];
    for (const strategy of strategies) {
      const score = await learningEngine.calculateStrategyScore(req.userId, strategy);
      if (score) scores.push(score);
    }
    
    // Trier par score décroissant
    scores.sort((a, b) => b.score - a.score);
    
    res.json({
      success: true,
      strategies: scores,
      totalStrategies: scores.length,
      recommended: scores.filter(s => s.recommendation === 'use').map(s => s.strategy),
      avoid: scores.filter(s => s.recommendation === 'avoid').map(s => s.strategy)
    });
  } catch (error) {
    console.error('[Learning API] Erreur stratégies:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/learning/strategies/:name/score
router.get('/strategies/:name/score', auth, async (req, res) => {
  try {
    const score = await learningEngine.calculateStrategyScore(req.userId, req.params.name);
    if (!score) {
      return res.status(404).json({ error: 'Stratégie non trouvée ou pas assez de données' });
    }
    
    res.json({
      success: true,
      score
    });
  } catch (error) {
    console.error('[Learning API] Erreur score stratégie:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 4. DÉTECTION DE PATTERNS ==========
// POST /api/learning/detect-patterns
router.post('/detect-patterns', auth, async (req, res) => {
  try {
    const { symbol, timeframe, priceData } = req.body;
    
    if (!symbol || !priceData || !Array.isArray(priceData)) {
      return res.status(400).json({ error: 'symbol et priceData (array) requis' });
    }
    
    const patterns = await learningEngine.detectPatterns(symbol, timeframe || '1h', priceData);
    
    res.json({
      success: true,
      patterns
    });
  } catch (error) {
    console.error('[Learning API] Erreur détection patterns:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 5. ANALYSE POST-TRADE ==========
// GET /api/learning/trades/:id/analysis
router.get('/trades/:id/analysis', auth, async (req, res) => {
  try {
    const analysis = await learningEngine.analyzeTradeResult(req.params.id);
    if (!analysis) {
      return res.status(404).json({ error: 'Trade non trouvé ou non fermé' });
    }
    
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('[Learning API] Erreur analyse trade:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 6. RECOMMANDATIONS SETUP ==========
// POST /api/learning/recommend-setup
router.post('/recommend-setup', auth, async (req, res) => {
  try {
    const { symbol, priceData } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'symbol requis' });
    }
    
    const recommendation = await learningEngine.getSetupRecommendation(
      req.userId,
      symbol,
      priceData || []
    );
    
    res.json({
      success: true,
      recommendation
    });
  } catch (error) {
    console.error('[Learning API] Erreur recommandation:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 7. OPTIMISATION STRATÉGIE ==========
// POST /api/learning/strategies/:name/optimize
router.post('/strategies/:name/optimize', auth, async (req, res) => {
  try {
    const optimization = await learningEngine.optimizeStrategy(req.userId, req.params.name);
    if (!optimization) {
      return res.status(404).json({ error: 'Pas assez de données pour optimiser' });
    }
    
    res.json({
      success: true,
      optimization
    });
  } catch (error) {
    console.error('[Learning API] Erreur optimisation:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 8. RÉGIME DE MARCHÉ ==========
// GET /api/learning/market-regime/:symbol
router.get('/market-regime/:symbol', auth, async (req, res) => {
  try {
    const { timeframe } = req.query;
    const regime = learningEngine.marketRegimes.get(`${req.params.symbol}_${timeframe || '1h'}`);
    
    res.json({
      success: true,
      symbol: req.params.symbol,
      timeframe: timeframe || '1h',
      regime: regime || 'unknown'
    });
  } catch (error) {
    console.error('[Learning API] Erreur régime:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 9. STATISTIQUES D'APPRENTISSAGE ==========
// GET /api/learning/stats
router.get('/stats', auth, async (req, res) => {
  try {
    const trades = await Trade.find({ userId: req.userId, source: { $in: ['bot', 'ai'] } });
    const analyzedTrades = trades.filter(t => t.analyzed);
    
    // Calculer les stats d'amélioration
    const improvementStats = {
      totalBotTrades: trades.length,
      analyzedTrades: analyzedTrades.length,
      learningProgress: analyzedTrades.length > 0 ? (analyzedTrades.length / trades.length) * 100 : 0,
      avgPnlImprovement: 0, // À calculer avec l'historique
      patternRecognitionRate: 0 // À implémenter
    };
    
    res.json({
      success: true,
      stats: improvementStats
    });
  } catch (error) {
    console.error('[Learning API] Erreur stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 10. FEEDBACK LOOP ==========
// POST /api/learning/feedback
router.post('/feedback', auth, async (req, res) => {
  try {
    const { tradeId, feedback } = req.body;
    
    // Stocker le feedback utilisateur pour améliorer l'IA
    const trade = await Trade.findById(tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade non trouvé' });
    }
    
    trade.userFeedback = feedback;
    await trade.save();
    
    res.json({
      success: true,
      message: 'Feedback enregistré'
    });
  } catch (error) {
    console.error('[Learning API] Erreur feedback:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
