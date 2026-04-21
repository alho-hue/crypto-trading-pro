// Routes pour l'Auto-Trading
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const autoTradingService = require('../services/autoTradingService');
const { authenticateToken: auth, optionalAuth } = require('../middleware/auth');
const AutoTradingConfig = require('../models/AutoTradingConfig');
const Trade = require('../models/Trade');

// @route   GET /api/auto-trading/status
// @desc    Get auto-trading status
// @access  Public/Private
router.get('/status', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.json({
        enabled: false,
        active: false,
        strategy: 'moderate',
        symbols: ['BTC', 'ETH'],
        dailyTradeCount: 0,
        maxDailyTrades: 10,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalPnL: 0,
        winRate: 0,
        paperTrading: true,
        demo: true
      });
    }
    const status = await autoTradingService.getBotStatus(req.user.id);
    res.json(status);
  } catch (error) {
    console.error('Error getting bot status:', error);
    res.status(500).json({ error: 'Failed to get bot status' });
  }
});

// @route   POST /api/auto-trading/enable
// @desc    Enable auto-trading
// @access  Private
router.post('/enable', [
  auth,
  body('strategy').optional().isIn(['conservative', 'moderate', 'aggressive']),
  body('symbols').optional().isArray(),
  body('maxRiskPerTrade').optional().isFloat({ min: 0.1, max: 10 }),
  body('paperTrading').optional().isBoolean()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const config = await autoTradingService.enableAutoTrading(req.user.id, req.body);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error enabling auto-trading:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/auto-trading/disable
// @desc    Disable auto-trading
// @access  Private
router.post('/disable', auth, async (req, res) => {
  try {
    const config = await autoTradingService.disableAutoTrading(req.user.id);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error disabling auto-trading:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/auto-trading/config
// @desc    Update auto-trading configuration
// @access  Private
router.put('/config', auth, async (req, res) => {
  try {
    const config = await autoTradingService.updateConfig(req.user.id, req.body);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/auto-trading/config
// @desc    Get auto-trading configuration
// @access  Private
router.get('/config', auth, async (req, res) => {
  try {
    const config = await AutoTradingConfig.findOne({ userId: req.user.id });
    res.json(config || { enabled: false });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: 'Failed to get config' });
  }
});

// @route   GET /api/auto-trading/performance
// @desc    Get performance statistics
// @access  Public/Private
router.get('/performance', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.json({
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgPnL: 0,
        dailyTradeCount: 0,
        maxDailyTrades: 10,
        sharpeRatio: 0,
        maxDrawdown: 0,
        demo: true
      });
    }
    const stats = await autoTradingService.getPerformanceStats(req.user.id);
    res.json(stats);
  } catch (error) {
    console.error('Error getting performance:', error);
    res.status(500).json({ error: 'Failed to get performance stats' });
  }
});

// @route   GET /api/auto-trading/trades
// @desc    Get auto-trading trade history
// @access  Public/Private
router.get('/trades', optionalAuth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    if (!req.user) {
      // Return demo trades
      const demoTrades = [
        {
          _id: 'demo1',
          symbol: 'BTCUSDT',
          side: 'buy',
          entryPrice: 65000,
          exitPrice: 67500,
          quantity: 0.1,
          pnl: 250,
          pnlPercent: 3.85,
          status: 'closed',
          isAutoTrade: true,
          entryTime: new Date(Date.now() - 86400000),
          exitTime: new Date(Date.now() - 3600000)
        },
        {
          _id: 'demo2',
          symbol: 'ETHUSDT',
          side: 'buy',
          entryPrice: 3500,
          exitPrice: 3600,
          quantity: 1.5,
          pnl: 150,
          pnlPercent: 2.86,
          status: 'closed',
          isAutoTrade: true,
          entryTime: new Date(Date.now() - 172800000),
          exitTime: new Date(Date.now() - 86400000)
        }
      ];
      return res.json(demoTrades.slice(0, parseInt(limit)));
    }
    
    const query = { userId: req.user.id, isAutoTrade: true };
    
    const trades = await Trade.find(query)
      .sort({ entryTime: -1 })
      .limit(parseInt(limit));
    
    res.json(trades);
  } catch (error) {
    console.error('Error getting trades:', error);
    res.status(500).json({ error: 'Failed to get trades' });
  }
});

// @route   POST /api/auto-trading/paper-trading
// @desc    Toggle paper trading mode
// @access  Private
router.post('/paper-trading', [
  auth,
  body('enabled').isBoolean()
], async (req, res) => {
  try {
    const config = await autoTradingService.togglePaperTrading(req.user.id, req.body.enabled);
    res.json({ success: true, paperTrading: config.paperTrading });
  } catch (error) {
    console.error('Error toggling paper trading:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/auto-trading/backtest
// @desc    Run backtest simulation
// @access  Private
router.post('/backtest', [
  auth,
  body('symbol').notEmpty(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('strategy').optional().isIn(['conservative', 'moderate', 'aggressive'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { symbol, startDate, endDate, strategy } = req.body;
    const result = await autoTradingService.runBacktest(
      req.user.id,
      symbol,
      startDate,
      endDate,
      strategy || 'moderate'
    );
    res.json(result);
  } catch (error) {
    console.error('Error running backtest:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/auto-trading/manual-trade
// @desc    Execute manual trade through auto-trading system
// @access  Private
router.post('/manual-trade', [
  auth,
  body('symbol').notEmpty(),
  body('side').isIn(['buy', 'sell']),
  body('confidence').optional().isInt({ min: 0, max: 100 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const config = await AutoTradingConfig.findOne({ userId: req.user.id });
    if (!config) {
      return res.status(400).json({ error: 'Auto-trading not configured' });
    }

    const { symbol, side, confidence = 80 } = req.body;
    const signal = {
      direction: side,
      confidence,
      entryPrice: 0, // Will be fetched from market
      stopLoss: 0,
      takeProfit: 0,
      reasoning: 'Manual trade'
    };

    let trade;
    if (side === 'buy') {
      trade = await autoTradingService.executeBuy(req.user.id, symbol, signal, config);
    } else {
      trade = await autoTradingService.executeSell(req.user.id, symbol, signal, config);
    }

    res.json({ success: true, trade });
  } catch (error) {
    console.error('Error executing manual trade:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/auto-trading/correlation
// @desc    Get correlation matrix for symbols
// @access  Private
router.get('/correlation', auth, async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      return res.status(400).json({ error: 'Symbols required' });
    }
    
    const symbolList = symbols.split(',').map(s => s.toUpperCase());
    const matrix = await autoTradingService.getCorrelationMatrix(symbolList);
    
    res.json(matrix);
  } catch (error) {
    console.error('Error getting correlation:', error);
    res.status(500).json({ error: 'Failed to get correlation matrix' });
  }
});

// @route   GET /api/auto-trading/open-positions
// @desc    Get open positions
// @access  Public/Private
router.get('/open-positions', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      // Return demo open positions
      const demoPositions = [
        {
          _id: 'demo-pos1',
          symbol: 'BTCUSDT',
          side: 'buy',
          entryPrice: 68000,
          quantity: 0.05,
          stopLoss: 65000,
          takeProfit: 72000,
          confidence: 85,
          status: 'open',
          isAutoTrade: true,
          paperTrading: true,
          entryTime: new Date(Date.now() - 7200000)
        },
        {
          _id: 'demo-pos2',
          symbol: 'ETHUSDT',
          side: 'buy',
          entryPrice: 3800,
          quantity: 0.8,
          stopLoss: 3600,
          takeProfit: 4200,
          confidence: 78,
          status: 'open',
          isAutoTrade: true,
          paperTrading: true,
          entryTime: new Date(Date.now() - 14400000)
        }
      ];
      return res.json(demoPositions);
    }
    
    const trades = await Trade.find({
      userId: req.user.id,
      status: 'open',
      isAutoTrade: true
    }).sort({ entryTime: -1 });
    
    res.json(trades);
  } catch (error) {
    console.error('Error getting open positions:', error);
    res.status(500).json({ error: 'Failed to get open positions' });
  }
});

module.exports = router;
