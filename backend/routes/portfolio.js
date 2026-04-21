// Routes pour la gestion de portefeuille
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const portfolioService = require('../services/portfolioService');
const binanceService = require('../services/binanceService');
const { authenticateToken: auth, optionalAuth } = require('../middleware/auth');

// @route   GET /api/portfolio
// @desc    Get user portfolio (public for demo)
// @access  Public/Private
router.get('/', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      // Return demo data for unauthenticated users
      return res.json({
        totalValue: 10000,
        assets: [
          { symbol: 'BTCUSDT', free: 0.1, locked: 0, total: 0.1, value: 6500, percentage: 65 },
          { symbol: 'ETHUSDT', free: 1.5, locked: 0, total: 1.5, value: 3000, percentage: 30 },
          { symbol: 'USDT', free: 500, locked: 0, total: 500, value: 500, percentage: 5 }
        ],
        lastUpdated: new Date(),
        demo: true
      });
    }
    const portfolio = await portfolioService.getUserPortfolio(req.user.id);
    res.json(portfolio);
  } catch (error) {
    console.error('Error getting portfolio:', error);
    res.status(500).json({ error: 'Failed to get portfolio' });
  }
});

// @route   GET /api/portfolio/performance
// @desc    Get portfolio performance (public for demo)
// @access  Public/Private
router.get('/performance', optionalAuth, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    if (!req.user) {
      return res.json({
        period,
        totalValue: 10000,
        returnValue: 500,
        returnPercentage: 5,
        startValue: 9500,
        demo: true
      });
    }
    const performance = await portfolioService.calculatePortfolioPerformance(req.user.id, period);
    res.json(performance);
  } catch (error) {
    console.error('Error getting performance:', error);
    res.status(500).json({ error: 'Failed to get performance' });
  }
});

// @route   GET /api/portfolio/pnl
// @desc    Get portfolio P&L (public for demo)
// @access  Public/Private
router.get('/pnl', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.json({
        totalValue: 10000,
        realizedPnL: 350,
        unrealizedPnL: 150,
        totalPnL: 500,
        realizedPnLPercentage: 3.5,
        unrealizedPnLPercentage: 1.5,
        totalPnLPercentage: 5,
        totalTrades: 12,
        openPositions: 3,
        demo: true
      });
    }
    const pnl = await portfolioService.calculatePortfolioPnL(req.user.id);
    res.json(pnl);
  } catch (error) {
    console.error('Error getting P&L:', error);
    res.status(500).json({ error: 'Failed to get P&L' });
  }
});

// @route   GET /api/portfolio/diversification
// @desc    Analyze portfolio diversification
// @access  Private
router.get('/diversification', auth, async (req, res) => {
  try {
    const analysis = await portfolioService.analyzeDiversification(req.user.id);
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing diversification:', error);
    res.status(500).json({ error: 'Failed to analyze diversification' });
  }
});

// @route   GET /api/portfolio/report
// @desc    Generate portfolio report
// @access  Private
router.get('/report', auth, async (req, res) => {
  try {
    const report = await portfolioService.generatePortfolioReport(req.user.id);
    res.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// @route   GET /api/portfolio/recommendations
// @desc    Get portfolio recommendations
// @access  Private
router.get('/recommendations', auth, async (req, res) => {
  try {
    const recommendations = await portfolioService.getPortfolioRecommendations(req.user.id);
    res.json(recommendations);
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// @route   POST /api/portfolio/optimize
// @desc    Optimize portfolio allocation
// @access  Private
router.post('/optimize', [
  auth,
  body('assets').isArray().notEmpty(),
  body('riskProfile').optional().isIn(['conservative', 'moderate', 'aggressive'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { assets, riskProfile = 'moderate' } = req.body;
    const allocations = await portfolioService.optimizeAllocation(assets, riskProfile);
    res.json(allocations);
  } catch (error) {
    console.error('Error optimizing allocation:', error);
    res.status(500).json({ error: 'Failed to optimize allocation' });
  }
});

// @route   POST /api/portfolio/rebalancing/recommend
// @desc    Get rebalancing recommendations
// @access  Private
router.post('/rebalancing/recommend', [
  auth,
  body('targetAllocation').isArray().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { targetAllocation } = req.body;
    const recommendations = await portfolioService.recommendRebalancing(req.user.id, targetAllocation);
    res.json(recommendations);
  } catch (error) {
    console.error('Error getting rebalancing recommendations:', error);
    res.status(500).json({ error: 'Failed to get rebalancing recommendations' });
  }
});

// @route   POST /api/portfolio/rebalancing/execute
// @desc    Execute rebalancing
// @access  Private
router.post('/rebalancing/execute', [
  auth,
  body('recommendations').isArray().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { recommendations } = req.body;
    const executedTrades = await portfolioService.executeRebalancing(req.user.id, recommendations);
    res.json({ success: true, executedTrades });
  } catch (error) {
    console.error('Error executing rebalancing:', error);
    res.status(500).json({ error: 'Failed to execute rebalancing' });
  }
});

// @route   GET /api/portfolio/balances
// @desc    Get raw account balances from Binance
// @access  Private
router.get('/balances', auth, async (req, res) => {
  try {
    const balances = await binanceService.getAccountBalances();
    res.json(balances);
  } catch (error) {
    console.error('Error getting balances:', error);
    res.status(500).json({ error: 'Failed to get balances' });
  }
});

// @route   GET /api/portfolio/asset/:symbol
// @desc    Get detailed info for specific asset
// @access  Private
router.get('/asset/:symbol', auth, async (req, res) => {
  try {
    const { symbol } = req.params;
    const portfolio = await portfolioService.getUserPortfolio(req.user.id);
    const asset = portfolio.assets.find(a => a.symbol === symbol.toUpperCase());
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found in portfolio' });
    }
    
    // Get current price
    const currentPrice = await binanceService.getPrice(symbol.toUpperCase() + 'USDT');
    
    res.json({
      ...asset,
      currentPrice,
      value: asset.total * currentPrice
    });
  } catch (error) {
    console.error('Error getting asset info:', error);
    res.status(500).json({ error: 'Failed to get asset info' });
  }
});

// @route   GET /api/portfolio/history
// @desc    Get portfolio value history (simplified)
// @access  Private
router.get('/history', auth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const Trade = require('../models/Trade');
    
    // Get trades from the last N days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const trades = await Trade.find({
      userId: req.user.id,
      status: 'closed',
      exitTime: { $gte: startDate }
    }).sort({ exitTime: 1 });
    
    // Aggregate by day
    const history = {};
    let runningPnL = 0;
    
    trades.forEach(trade => {
      const date = new Date(trade.exitTime).toISOString().split('T')[0];
      runningPnL += trade.pnl || 0;
      history[date] = {
        date,
        realizedPnL: runningPnL,
        trades: (history[date]?.trades || 0) + 1
      };
    });
    
    res.json(Object.values(history));
  } catch (error) {
    console.error('Error getting portfolio history:', error);
    res.status(500).json({ error: 'Failed to get portfolio history' });
  }
});

module.exports = router;
