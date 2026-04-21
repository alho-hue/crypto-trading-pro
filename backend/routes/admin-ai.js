/**
 * 🤖 Admin AI Routes - API pour l'IA d'analyse NEUROVEST
 */

const express = require('express');
const router = express.Router();
const adminAI = require('../services/adminAIService');
const { requireRole, adminRateLimit } = require('../middleware/adminAuth');

/**
 * 🔐 Middleware auth pour toutes les routes
 */
router.use(adminRateLimit);
router.use(requireRole(['admin', 'super_admin']));

/**
 * 📊 GET /api/admin/ai/analyze - Analyse complète de la plateforme
 */
router.get('/analyze', async (req, res) => {
  try {
    const analysis = await adminAI.analyzePlatform();
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('[AdminAI Route] Analyze error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze platform'
    });
  }
});

/**
 * 📈 GET /api/admin/ai/trading - Analyse trading seule
 */
router.get('/trading', async (req, res) => {
  try {
    const analysis = await adminAI.analyzeTrading();
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 👥 GET /api/admin/ai/users - Analyse utilisateurs
 */
router.get('/users', async (req, res) => {
  try {
    const analysis = await adminAI.analyzeUsers();
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 💳 GET /api/admin/ai/payments - Analyse paiements
 */
router.get('/payments', async (req, res) => {
  try {
    const analysis = await adminAI.analyzePayments();
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 🤖 GET /api/admin/ai/bots - Analyse bots
 */
router.get('/bots', async (req, res) => {
  try {
    const analysis = await adminAI.analyzeBots();
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ⚙️ GET /api/admin/ai/system - Analyse système
 */
router.get('/system', async (req, res) => {
  try {
    const analysis = await adminAI.analyzeSystem();
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ⚠️ GET /api/admin/ai/risk - Analyse risque
 */
router.get('/risk', async (req, res) => {
  try {
    const analysis = await adminAI.analyzeRisk();
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 🚨 GET /api/admin/ai/alerts - Obtenir les alertes actives
 */
router.get('/alerts', async (req, res) => {
  try {
    const analysis = await adminAI.analyzePlatform();
    res.json({
      success: true,
      data: {
        alerts: analysis.alerts,
        count: analysis.alerts.length,
        critical: analysis.alerts.filter(a => a.severity === 'critical').length,
        warning: analysis.alerts.filter(a => a.severity === 'warning').length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 💡 GET /api/admin/ai/recommendations - Obtenir les recommandations
 */
router.get('/recommendations', async (req, res) => {
  try {
    const analysis = await adminAI.analyzePlatform();
    res.json({
      success: true,
      data: {
        recommendations: analysis.recommendations,
        count: analysis.recommendations.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 🎯 POST /api/admin/ai/command - Exécuter une commande IA
 */
router.post('/command', async (req, res) => {
  try {
    const { command, params } = req.body;
    
    if (!command) {
      return res.status(400).json({
        success: false,
        error: 'Command is required'
      });
    }

    const result = await adminAI.processCommand(command, params);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ⚡ GET /api/admin/ai/actions - Obtenir les actions rapides disponibles
 */
router.get('/actions', async (req, res) => {
  try {
    const actions = adminAI.getQuickActions();
    res.json({
      success: true,
      data: actions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 📈 GET /api/admin/ai/health - Score de santé rapide
 */
router.get('/health', async (req, res) => {
  try {
    const analysis = await adminAI.analyzePlatform();
    res.json({
      success: true,
      data: {
        score: analysis.healthScore,
        status: analysis.status,
        timestamp: analysis.timestamp
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 📝 GET /api/admin/ai/summary - Résumé intelligent
 */
router.get('/summary', async (req, res) => {
  try {
    const analysis = await adminAI.analyzePlatform();
    res.json({
      success: true,
      data: {
        summary: analysis.summary,
        alertCount: analysis.alerts.length,
        recommendationCount: analysis.recommendations.length,
        healthScore: analysis.healthScore
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
