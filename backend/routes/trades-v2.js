/**
 * NEUROVEST - Trade API Routes v2
 * Routes centralisées pour la gestion des trades
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const Trade = require('../models/Trade');
const tradeManager = require('../services/tradeManager');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware d'authentification
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

// ========== CRÉATION D'UN TRADE ==========
// POST /api/trades/v2/create
router.post('/v2/create', auth, async (req, res) => {
  try {
    const {
      symbol,
      side,
      type,
      quantity,
      entryPrice,
      stopLoss,
      takeProfit,
      leverage,
      marginType,
      source,
      strategy,
      reasoning,
      confidence,
      paperTrading
    } = req.body;

    // Validation des champs requis
    if (!symbol || !side || !quantity || !entryPrice) {
      return res.status(400).json({ 
        error: 'Champs requis manquants: symbol, side, quantity, entryPrice' 
      });
    }

    const result = await tradeManager.createTrade(req.userId, {
      symbol,
      side,
      type: type || 'market',
      quantity: parseFloat(quantity),
      entryPrice: parseFloat(entryPrice),
      stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      takeProfit: takeProfit ? parseFloat(takeProfit) : null,
      leverage: leverage ? parseInt(leverage) : 1,
      marginType: marginType || 'isolated',
      source: source || 'manual',
      strategy,
      reasoning,
      confidence: confidence ? parseFloat(confidence) : null,
      paperTrading: paperTrading !== false
    });

    res.json({
      success: true,
      trade: result.trade,
      message: result.message
    });
  } catch (error) {
    console.error('[Trades API] Erreur création:', error.message);
    console.error('[Trades API] Données reçues:', { symbol, side, type, quantity, entryPrice, stopLoss, takeProfit, leverage });
    res.status(400).json({ error: error.message });
  }
});

// ========== EXÉCUTION D'UN TRADE ==========
// POST /api/trades/v2/execute/:id
router.post('/v2/execute/:id', auth, async (req, res) => {
  try {
    const { orderId, filledQuantity, averagePrice, fees } = req.body;

    const result = await tradeManager.executeTrade(req.params.id, {
      orderId,
      filledQuantity: parseFloat(filledQuantity),
      averagePrice: parseFloat(averagePrice),
      fees: parseFloat(fees) || 0
    });

    res.json({
      success: true,
      trade: result.trade
    });
  } catch (error) {
    console.error('[Trades API] Erreur exécution:', error);
    res.status(400).json({ error: error.message });
  }
});

// ========== FERMETURE D'UN TRADE ==========
// POST /api/trades/v2/close/:id
router.post('/v2/close/:id', auth, async (req, res) => {
  try {
    const { exitPrice, exitReason } = req.body;

    if (!exitPrice) {
      return res.status(400).json({ error: 'Prix de sortie requis' });
    }

    const result = await tradeManager.closeTrade(
      req.params.id,
      parseFloat(exitPrice),
      exitReason || 'manual'
    );

    res.json({
      success: true,
      trade: result.trade,
      pnl: result.pnl,
      pnlPercent: result.pnlPercent
    });
  } catch (error) {
    console.error('[Trades API] Erreur fermeture:', error);
    res.status(400).json({ error: error.message });
  }
});

// ========== RÉCUPÉRER LES TRADES DE L'UTILISATEUR ==========
// GET /api/trades/v2/my-trades
router.get('/v2/my-trades', auth, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    let trades;
    if (status === 'open') {
      trades = await tradeManager.getActiveTrades(req.userId);
    } else if (status === 'closed') {
      trades = await tradeManager.getTradeHistory(req.userId, parseInt(limit));
    } else {
      trades = await tradeManager.getUserTrades(req.userId);
    }

    res.json({
      success: true,
      trades,
      count: trades.length
    });
  } catch (error) {
    console.error('[Trades API] Erreur récupération:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== STATISTIQUES DE TRADING ==========
// GET /api/trades/v2/stats
router.get('/v2/stats', auth, async (req, res) => {
  try {
    const stats = await tradeManager.getTradeStats(req.userId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[Trades API] Erreur stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== VALIDATION D'UN TRADE ==========
// POST /api/trades/v2/validate
router.post('/v2/validate', auth, async (req, res) => {
  try {
    const validation = await tradeManager.validateTrade(req.userId, req.body);
    
    res.json({
      success: true,
      valid: validation.valid,
      errors: validation.errors,
      riskPercent: validation.riskPercent
    });
  } catch (error) {
    console.error('[Trades API] Erreur validation:', error);
    res.status(400).json({ error: error.message });
  }
});

// ========== MISE À JOUR D'UN TRADE OUVERT ==========
// PATCH /api/trades/v2/:id
router.patch('/v2/:id', auth, async (req, res) => {
  try {
    const trade = await Trade.findOne({ _id: req.params.id, userId: req.userId });
    
    if (!trade) {
      return res.status(404).json({ error: 'Trade non trouvé' });
    }

    // Champs modifiables sur un trade ouvert
    const { stopLoss, takeProfit, trailingStopPercent } = req.body;
    
    if (stopLoss !== undefined) trade.stopLoss = parseFloat(stopLoss);
    if (takeProfit !== undefined) trade.takeProfit = parseFloat(takeProfit);
    if (trailingStopPercent !== undefined) trade.trailingStopPercent = parseFloat(trailingStopPercent);
    
    await trade.save();
    
    res.json({
      success: true,
      trade
    });
  } catch (error) {
    console.error('[Trades API] Erreur mise à jour:', error);
    res.status(400).json({ error: error.message });
  }
});

// ========== ANNULATION D'UN TRADE PENDING ==========
// DELETE /api/trades/v2/:id
router.delete('/v2/:id', auth, async (req, res) => {
  try {
    const trade = await Trade.findOne({ _id: req.params.id, userId: req.userId });
    
    if (!trade) {
      return res.status(404).json({ error: 'Trade non trouvé' });
    }

    if (trade.status !== 'pending') {
      return res.status(400).json({ error: 'Seuls les trades pending peuvent être annulés' });
    }

    trade.status = 'cancelled';
    await trade.save();
    
    res.json({
      success: true,
      message: 'Trade annulé'
    });
  } catch (error) {
    console.error('[Trades API] Erreur annulation:', error);
    res.status(400).json({ error: error.message });
  }
});

// ========== SYNCHRONISATION DES PRIX (WebSocket callback) ==========
// POST /api/trades/v2/price-update (interne)
router.post('/v2/price-update', auth, async (req, res) => {
  try {
    const { symbol, price } = req.body;
    
    if (!symbol || !price) {
      return res.status(400).json({ error: 'Symbol et prix requis' });
    }

    tradeManager.onPriceUpdate(symbol.toUpperCase(), parseFloat(price));
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== HISTORIQUE COMPLET AVEC FILTRES ==========
// GET /api/trades/v2/history
router.get('/v2/history', auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      symbol, 
      source, 
      minPnl, 
      maxPnl,
      page = 1,
      limit = 20
    } = req.query;

    const query = { 
      userId: req.userId,
      status: 'closed'
    };

    if (startDate || endDate) {
      query.exitTime = {};
      if (startDate) query.exitTime.$gte = new Date(startDate);
      if (endDate) query.exitTime.$lte = new Date(endDate);
    }

    if (symbol) query.symbol = symbol.toUpperCase();
    if (source) query.source = source;
    if (minPnl !== undefined || maxPnl !== undefined) {
      query.pnl = {};
      if (minPnl !== undefined) query.pnl.$gte = parseFloat(minPnl);
      if (maxPnl !== undefined) query.pnl.$lte = parseFloat(maxPnl);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const trades = await Trade.find(query)
      .sort({ exitTime: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Trade.countDocuments(query);

    res.json({
      success: true,
      trades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('[Trades API] Erreur historique:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
