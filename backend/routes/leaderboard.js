const express = require('express');
const User = require('../models/User');
const router = express.Router();

// @route   GET /api/leaderboard
// @desc    Get top traders
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { sortBy = 'totalProfit', limit = 100, period = 'all' } = req.query;
    
    const validSortFields = ['totalProfit', 'winRate', 'totalTrades', 'monthlyReturn'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'totalProfit';
    
    // Build query
    const query = { isPublic: true };
    
    // Build sort
    let sort = {};
    if (sortField === 'winRate') {
      // For win rate, we need to calculate
      sort = { 'stats.winningTrades': -1, 'stats.totalTrades': -1 };
    } else {
      sort = { [`stats.${sortField}`]: -1 };
    }
    
    const users = await User.find(query)
      .select('username displayName avatar stats followers following isPublic allowCopyTrading')
      .sort(sort)
      .limit(parseInt(limit));
    
    // Calculate rankings
    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      stats: {
        ...user.stats,
        followers: user.followers?.length || 0,
        following: user.following?.length || 0
      },
      winRate: user.winRate || 0,
      followers: user.followers?.length || 0,
      allowCopyTrading: user.allowCopyTrading,
      monthlyReturn: calculateMonthlyReturn(user)
    }));
    
    res.json({ leaderboard });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Helper function (would need real data in production)
function calculateMonthlyReturn(user) {
  // Placeholder - in real app would calculate from trade history
  return ((Math.random() * 40) + 10).toFixed(1);
}

// @route   GET /api/leaderboard/stats
// @desc    Get leaderboard stats
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeTraders = await User.countDocuments({ 'stats.totalTrades': { $gt: 0 } });
    const profitableTraders = await User.countDocuments({ 'stats.totalProfit': { $gt: 0 } });
    
    const topTrader = await User.findOne()
      .sort({ 'stats.totalProfit': -1 })
      .select('username displayName stats');
    
    res.json({
      totalUsers,
      activeTraders,
      profitableTraders,
      topTrader: topTrader ? {
        username: topTrader.username,
        displayName: topTrader.displayName,
        totalProfit: topTrader.stats.totalProfit
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
