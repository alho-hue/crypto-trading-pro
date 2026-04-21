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

// @route   GET /api/stats/system
// @desc    Get system statistics (admin only)
// @access  Private/Admin
router.get('/system', auth, async (req, res) => {
  try {
    // Check if user is admin
    const admin = await User.findById(req.userId);
    if (!admin?.isAdmin) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    // Get real stats from database
    const totalUsers = await User.countDocuments();
    const onlineUsers = await User.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    });
    const activeTraders = await User.countDocuments({ 'stats.totalTrades': { $gt: 0 } });
    const newUsers24h = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    // Aggregate trading stats
    const tradingStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalTrades: { $sum: '$stats.totalTrades' },
          totalProfit: { $sum: '$stats.totalProfit' },
          totalVolume: { $sum: '$stats.totalVolume' },
          avgProfit: { $avg: '$stats.totalProfit' }
        }
      }
    ]);
    
    // Get banned users count
    const bannedUsers = await User.countDocuments({ isBanned: true });
    const adminUsers = await User.countDocuments({ isAdmin: true });
    
    res.json({
      system: {
        totalUsers,
        onlineUsers,
        activeTraders,
        newUsers24h,
        bannedUsers,
        adminUsers
      },
      trading: tradingStats[0] || {
        totalTrades: 0,
        totalProfit: 0,
        totalVolume: 0,
        avgProfit: 0
      },
      uptime: process.uptime(),
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/stats/analytics
// @desc    Get analytics data (admin only)
// @access  Private/Admin
router.get('/analytics', auth, async (req, res) => {
  try {
    const admin = await User.findById(req.userId);
    if (!admin?.isAdmin) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    // User growth by day (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const userGrowth = await User.aggregate([
      {
        $match: { createdAt: { $gte: thirtyDaysAgo } }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Top profitable users
    const topTraders = await User.find({ 'stats.totalProfit': { $gt: 0 } })
      .select('username displayName avatar stats')
      .sort({ 'stats.totalProfit': -1 })
      .limit(10);
    
    // Users by activity level
    const highlyActive = await User.countDocuments({ 'stats.totalTrades': { $gte: 100 } });
    const moderatelyActive = await User.countDocuments({
      'stats.totalTrades': { $gte: 10, $lt: 100 }
    });
    const lowActivity = await User.countDocuments({
      'stats.totalTrades': { $gt: 0, $lt: 10 }
    });
    const noActivity = await User.countDocuments({
      $or: [{ 'stats.totalTrades': 0 }, { 'stats.totalTrades': { $exists: false } }]
    });
    
    res.json({
      userGrowth,
      topTraders: topTraders.map(u => ({
        id: u._id,
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        stats: u.stats,
        winRate: u.winRate
      })),
      activityDistribution: {
        highlyActive,
        moderatelyActive,
        lowActivity,
        noActivity
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/stats/dashboard
// @desc    Get dashboard stats for current user
// @access  Private
router.get('/dashboard', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Get user's ranking
    const higherRanked = await User.countDocuments({
      'stats.totalProfit': { $gt: user.stats?.totalProfit || 0 }
    });
    
    res.json({
      user: {
        stats: user.stats,
        winRate: user.winRate,
        followers: user.followerCount,
        following: user.followingCount,
        rank: higherRanked + 1
      },
      wallet: user.wallet,
      recentActivity: user.transactions?.slice(0, 5) || []
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/stats/public
// @desc    Get public stats
// @access  Public
router.get('/public', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const onlineUsers = await User.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    });
    
    const tradingStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalTrades: { $sum: '$stats.totalTrades' },
          totalProfit: { $sum: '$stats.totalProfit' },
          totalVolume: { $sum: '$stats.totalVolume' }
        }
      }
    ]);
    
    res.json({
      users: { total: totalUsers, online: onlineUsers },
      trading: tradingStats[0] || {
        totalTrades: 0,
        totalProfit: 0,
        totalVolume: 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
