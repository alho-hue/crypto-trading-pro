const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
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

// @route   GET /api/trades
// @desc    Get current user's trades
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    // For now, return from user stats - in production would have Trade collection
    const user = await User.findById(req.userId).select('stats username');
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json({
      trades: user.stats?.tradeHistory || [],
      stats: {
        totalTrades: user.stats?.totalTrades || 0,
        winningTrades: user.stats?.winningTrades || 0,
        totalProfit: user.stats?.totalProfit || 0,
        winRate: user.winRate || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/trades/all
// @desc    Get all trades (admin only)
// @access  Private/Admin
router.get('/all', auth, async (req, res) => {
  try {
    // Check if user is admin
    const admin = await User.findById(req.userId);
    if (!admin?.isAdmin) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    // Get all users with trade stats
    const users = await User.find({ 'stats.totalTrades': { $gt: 0 } })
      .select('username displayName avatar stats createdAt');
    
    // Flatten all trades
    const allTrades = [];
    users.forEach(user => {
      if (user.stats?.tradeHistory) {
        user.stats.tradeHistory.forEach(trade => {
          allTrades.push({
            ...trade,
            userId: user._id,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar
          });
        });
      }
    });
    
    // Sort by date desc
    allTrades.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      trades: allTrades.slice(0, 100),
      total: allTrades.length,
      summary: {
        totalVolume: allTrades.reduce((sum, t) => sum + (t.volume || t.amount * t.price || 0), 0),
        totalProfit: allTrades.reduce((sum, t) => sum + (t.profit || 0), 0),
        activeTraders: users.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/trades/stats
// @desc    Get trading statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const stats = {
      totalTrades: user.stats?.totalTrades || 0,
      winningTrades: user.stats?.winningTrades || 0,
      losingTrades: (user.stats?.totalTrades || 0) - (user.stats?.winningTrades || 0),
      totalProfit: user.stats?.totalProfit || 0,
      totalVolume: user.stats?.totalVolume || 0,
      winRate: user.winRate || 0,
      bestTrade: user.stats?.bestTrade || 0,
      worstTrade: user.stats?.worstTrade || 0,
      averageProfit: user.stats?.totalTrades > 0 ? (user.stats?.totalProfit || 0) / user.stats?.totalTrades : 0,
      currentStreak: user.stats?.currentStreak || 0,
      longestWinStreak: user.stats?.longestWinStreak || 0
    };
    
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/trades
// @desc    Record a new trade
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { pair, type, amount, price, volume, profit, notes } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Create trade record
    const trade = {
      id: Date.now().toString(),
      pair,
      type,
      amount: parseFloat(amount),
      price: parseFloat(price),
      volume: parseFloat(volume) || parseFloat(amount) * parseFloat(price),
      profit: parseFloat(profit) || 0,
      notes,
      status: 'closed',
      createdAt: new Date(),
      closedAt: new Date()
    };
    
    // Add to trade history
    if (!user.stats.tradeHistory) {
      user.stats.tradeHistory = [];
    }
    user.stats.tradeHistory.unshift(trade);
    
    // Update stats
    await user.updateStats({ profit: trade.profit, volume: trade.volume });
    
    res.json({
      message: 'Trade enregistré',
      trade,
      stats: user.stats,
      winRate: user.winRate
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/trades/global
// @desc    Get global trading stats
// @access  Public
router.get('/global', async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalTrades: { $sum: '$stats.totalTrades' },
          totalProfit: { $sum: '$stats.totalProfit' },
          totalVolume: { $sum: '$stats.totalVolume' },
          activeTraders: { $sum: { $cond: [{ $gt: ['$stats.totalTrades', 0] }, 1, 0] } },
          avgProfit: { $avg: '$stats.totalProfit' }
        }
      }
    ]);
    
    // Get top trading pairs (mock data for now - would need Trade collection)
    const topPairs = [
      { pair: 'BTC/USDT', volume: 1234567, trades: 456 },
      { pair: 'ETH/USDT', volume: 987654, trades: 345 },
      { pair: 'SOL/USDT', volume: 456789, trades: 234 },
      { pair: 'BNB/USDT', volume: 345678, trades: 189 },
      { pair: 'XRP/USDT', volume: 234567, trades: 156 }
    ];
    
    res.json({
      global: stats[0] || {
        totalTrades: 0,
        totalProfit: 0,
        totalVolume: 0,
        activeTraders: 0,
        avgProfit: 0
      },
      topPairs,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
