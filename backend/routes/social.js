const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Signal = require('../models/Signal');
const TradeShare = require('../models/TradeShare');
const User = require('../models/User');
const ethernalAI = require('../services/ethernalAI');
const upload = require('../config/multer');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify token
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

// ===== SIGNALS ROUTES =====

// @route   GET /api/social/signals
// @desc    Get all signals with filters
// @access  Public
router.get('/signals', async (req, res) => {
  try {
    const { 
      status = 'active', 
      symbol, 
      sortBy = 'createdAt', 
      limit = 50,
      channelId = 'signals'
    } = req.query;
    
    let query = { isPublic: true };
    
    if (status !== 'all') {
      query.status = status;
    }
    if (symbol) {
      query.symbol = symbol.toUpperCase();
    }
    if (channelId) {
      query.channelId = channelId;
    }
    
    const sort = {};
    if (sortBy === 'votes') {
      sort['votes.bullish'] = -1;
    } else if (sortBy === 'likes') {
      sort.likes = -1;
    } else {
      sort.createdAt = -1;
    }
    
    const signals = await Signal.find(query)
      .populate('user', 'username displayName avatar isVerified isPro')
      .sort(sort)
      .limit(parseInt(limit));
    
    res.json({
      signals: signals.map(s => ({
        id: s._id,
        symbol: s.symbol,
        direction: s.direction,
        entryPrice: s.entryPrice,
        stopLoss: s.stopLoss,
        takeProfit: s.takeProfit,
        confidence: s.confidence,
        analysis: s.analysis,
        timeframe: s.timeframe,
        userId: s.user?._id,
        username: s.username,
        avatar: s.avatar,
        likes: s.likes,
        dislikes: 0, // Not used, kept for compatibility
        comments: s.comments.length,
        aiValidation: s.aiValidation,
        timestamp: s.createdAt.getTime(),
        status: s.status,
        votes: {
          bullish: s.votes.bullish,
          bearish: s.votes.bearish
        },
        riskReward: s.calculateRiskReward()
      })),
      total: await Signal.countDocuments(query)
    });
  } catch (error) {
    console.error('Get signals error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/social/signals/:id
// @desc    Get single signal details
// @access  Public
router.get('/signals/:id', async (req, res) => {
  try {
    const signal = await Signal.findById(req.params.id)
      .populate('user', 'username displayName avatar isVerified isPro stats')
      .populate('comments.user', 'username displayName avatar');
    
    if (!signal) {
      return res.status(404).json({ error: 'Signal non trouvé' });
    }
    
    res.json({
      signal: {
        id: signal._id,
        symbol: signal.symbol,
        direction: signal.direction,
        entryPrice: signal.entryPrice,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        confidence: signal.confidence,
        analysis: signal.analysis,
        timeframe: signal.timeframe,
        screenshot: signal.screenshot,
        userId: signal.user?._id,
        username: signal.username,
        avatar: signal.avatar,
        likes: signal.likes,
        comments: signal.comments.map(c => ({
          id: c._id,
          username: c.username,
          avatar: c.avatar,
          content: c.content,
          timestamp: c.createdAt
        })),
        aiValidation: signal.aiValidation,
        timestamp: signal.createdAt.getTime(),
        status: signal.status,
        votes: signal.votes,
        result: signal.result,
        riskReward: signal.calculateRiskReward()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/social/signals
// @desc    Create new signal
// @access  Private
router.post('/signals', auth, upload.single('screenshot'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const {
      symbol,
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      confidence,
      analysis,
      timeframe,
      channelId = 'signals'
    } = req.body;
    
    // Validate required fields
    if (!symbol || !direction || !entryPrice || !stopLoss || !takeProfit) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }
    
    // AI Validation
    let aiValidation = { isValid: true, score: 50, warnings: [] };
    try {
      aiValidation = await ethernalAI.validateSignal({
        symbol,
        direction,
        entryPrice: parseFloat(entryPrice),
        stopLoss: parseFloat(stopLoss),
        takeProfit: parseFloat(takeProfit),
        timeframe
      });
    } catch (e) {
      console.log('AI validation skipped:', e.message);
    }
    
    const signal = new Signal({
      user: req.userId,
      username: user.username,
      avatar: user.avatar,
      symbol: symbol.toUpperCase(),
      direction,
      entryPrice: parseFloat(entryPrice),
      stopLoss: parseFloat(stopLoss),
      takeProfit: parseFloat(takeProfit),
      confidence: parseInt(confidence) || 50,
      analysis,
      timeframe,
      channelId,
      aiValidation,
      screenshot: req.file ? `/uploads/${req.file.filename}` : ''
    });
    
    await signal.save();
    
    // Update user's signal stats
    user.stats.signalsPosted = (user.stats.signalsPosted || 0) + 1;
    await user.save();
    
    // Emit new signal via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`channel-${channelId}`).emit('new-signal', {
        id: signal._id,
        symbol: signal.symbol,
        direction: signal.direction,
        username: signal.username,
        timestamp: signal.createdAt
      });
    }
    
    res.status(201).json({
      message: 'Signal créé avec succès',
      signal: {
        id: signal._id,
        symbol: signal.symbol,
        direction: signal.direction,
        entryPrice: signal.entryPrice,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        confidence: signal.confidence,
        analysis: signal.analysis,
        aiValidation: signal.aiValidation,
        timestamp: signal.createdAt.getTime(),
        status: signal.status
      }
    });
  } catch (error) {
    console.error('Create signal error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/social/signals/:id/vote
// @desc    Vote on signal (bullish/bearish)
// @access  Private
router.post('/signals/:id/vote', auth, async (req, res) => {
  try {
    const { vote } = req.body;
    if (!vote || !['bullish', 'bearish'].includes(vote)) {
      return res.status(400).json({ error: 'Vote invalide' });
    }
    
    const signal = await Signal.findById(req.params.id);
    if (!signal) {
      return res.status(404).json({ error: 'Signal non trouvé' });
    }
    
    const votes = await signal.addVote(req.userId, vote);
    
    res.json({
      message: 'Vote enregistré',
      votes: {
        bullish: votes.bullish,
        bearish: votes.bearish,
        userVote: vote
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/social/signals/:id/like
// @desc    Like/unlike signal
// @access  Private
router.post('/signals/:id/like', auth, async (req, res) => {
  try {
    const signal = await Signal.findById(req.params.id);
    if (!signal) {
      return res.status(404).json({ error: 'Signal non trouvé' });
    }
    
    const result = await signal.toggleLike(req.userId);
    
    res.json({
      liked: result.liked,
      likes: result.likes
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/social/signals/:id/comment
// @desc    Add comment to signal
// @access  Private
router.post('/signals/:id/comment', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Commentaire vide' });
    }
    
    const user = await User.findById(req.userId);
    const signal = await Signal.findById(req.params.id);
    
    if (!signal) {
      return res.status(404).json({ error: 'Signal non trouvé' });
    }
    
    signal.comments.push({
      user: req.userId,
      username: user.username,
      avatar: user.avatar,
      content: content.trim()
    });
    
    await signal.save();
    
    res.json({
      message: 'Commentaire ajouté',
      comments: signal.comments.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   DELETE /api/social/signals/:id
// @desc    Delete own signal
// @access  Private
router.delete('/signals/:id', auth, async (req, res) => {
  try {
    const signal = await Signal.findById(req.params.id);
    
    if (!signal) {
      return res.status(404).json({ error: 'Signal non trouvé' });
    }
    
    if (signal.user.toString() !== req.userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    signal.status = 'cancelled';
    await signal.save();
    
    res.json({ message: 'Signal supprimé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===== TRADES ROUTES =====

// @route   GET /api/social/trades
// @desc    Get shared trades
// @access  Public
router.get('/trades', async (req, res) => {
  try {
    const { status, symbol, limit = 50 } = req.query;
    
    let query = { isPublic: true };
    if (status) query.status = status;
    if (symbol) query.symbol = symbol.toUpperCase();
    
    const trades = await TradeShare.find(query)
      .populate('user', 'username displayName avatar isVerified isPro')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({
      trades: trades.map(t => ({
        id: t._id,
        userId: t.user?._id,
        username: t.username,
        avatar: t.avatar,
        symbol: t.symbol,
        direction: t.direction,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        size: t.size,
        leverage: t.leverage,
        pnl: t.pnl,
        pnlPercent: t.pnlPercent,
        strategy: t.strategy,
        screenshot: t.screenshot,
        isPublic: t.isPublic,
        allowCopy: t.allowCopy,
        copyCount: t.copyCount,
        likes: t.likes,
        comments: t.comments.length,
        timestamp: t.createdAt.getTime(),
        status: t.status
      })),
      total: await TradeShare.countDocuments(query)
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/social/trades
// @desc    Share a trade
// @access  Private
router.post('/trades', auth, upload.single('screenshot'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const {
      symbol,
      direction,
      entryPrice,
      exitPrice,
      size,
      leverage,
      pnl,
      pnlPercent,
      strategy,
      analysis,
      isPublic,
      allowCopy,
      channelId = 'futures'
    } = req.body;
    
    const trade = new TradeShare({
      user: req.userId,
      username: user.username,
      avatar: user.avatar,
      symbol: symbol.toUpperCase(),
      direction,
      entryPrice: parseFloat(entryPrice),
      exitPrice: exitPrice ? parseFloat(exitPrice) : null,
      size: parseFloat(size),
      leverage: parseFloat(leverage) || 1,
      pnl: parseFloat(pnl) || 0,
      pnlPercent: parseFloat(pnlPercent) || 0,
      strategy,
      analysis,
      isPublic: isPublic !== undefined ? isPublic : true,
      allowCopy: allowCopy !== undefined ? allowCopy : false,
      screenshot: req.file ? `/uploads/${req.file.filename}` : '',
      channelId,
      status: exitPrice ? 'closed' : 'open'
    });
    
    await trade.save();
    
    // Update user stats
    if (pnl) {
      await user.updateStats({ profit: parseFloat(pnl) });
    }
    
    res.status(201).json({
      message: 'Trade partagé avec succès',
      trade: {
        id: trade._id,
        symbol: trade.symbol,
        direction: trade.direction,
        pnl: trade.pnl,
        pnlPercent: trade.pnlPercent,
        timestamp: trade.createdAt.getTime()
      }
    });
  } catch (error) {
    console.error('Share trade error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/social/trades/:id/copy
// @desc    Copy a trade
// @access  Private
router.post('/trades/:id/copy', auth, async (req, res) => {
  try {
    const { positionSize } = req.body;
    
    const trade = await TradeShare.findById(req.params.id);
    if (!trade) {
      return res.status(404).json({ error: 'Trade non trouvé' });
    }
    
    if (!trade.allowCopy) {
      return res.status(403).json({ error: 'Ce trade ne peut pas être copié' });
    }
    
    await trade.copyTrade(req.userId, positionSize);
    
    // Notify trade owner
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${trade.user}`).emit('trade-copied', {
        tradeId: trade._id,
        copiedBy: req.userId
      });
    }
    
    res.json({
      message: 'Trade copié avec succès',
      copyCount: trade.copyCount
    });
  } catch (error) {
    console.error('Copy trade error:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// @route   POST /api/social/trades/:id/like
// @desc    Like/unlike trade
// @access  Private
router.post('/trades/:id/like', auth, async (req, res) => {
  try {
    const trade = await TradeShare.findById(req.params.id);
    if (!trade) {
      return res.status(404).json({ error: 'Trade non trouvé' });
    }
    
    const result = await trade.toggleLike(req.userId);
    
    res.json({
      liked: result.liked,
      likes: result.likes
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/social/follow
// @desc    Follow a user (legacy endpoint for compatibility)
// @access  Private
router.post('/follow', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    
    const mongoose = require('mongoose');
    const targetId = new mongoose.Types.ObjectId(userId);
    const currentId = new mongoose.Types.ObjectId(req.userId);
    
    if (targetId.equals(currentId)) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous suivre vous-même' });
    }
    
    const userToFollow = await User.findById(targetId);
    const currentUser = await User.findById(currentId);
    
    if (!userToFollow) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const isFollowing = currentUser.following.some(id => id.equals(targetId));
    
    if (isFollowing) {
      currentUser.following.pull(targetId);
      userToFollow.followers.pull(currentId);
    } else {
      currentUser.following.push(targetId);
      userToFollow.followers.push(currentId);
    }
    
    await currentUser.save();
    await userToFollow.save();
    
    res.json({
      following: !isFollowing,
      followers: userToFollow.followers.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/social/unfollow
// @desc    Unfollow a user
// @access  Private
router.post('/unfollow', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    
    const mongoose = require('mongoose');
    const targetId = new mongoose.Types.ObjectId(userId);
    const currentId = new mongoose.Types.ObjectId(req.userId);
    
    const userToUnfollow = await User.findById(targetId);
    const currentUser = await User.findById(currentId);
    
    if (!userToUnfollow) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    currentUser.following.pull(targetId);
    userToUnfollow.followers.pull(currentId);
    
    await currentUser.save();
    await userToUnfollow.save();
    
    res.json({
      following: false,
      followers: userToUnfollow.followers.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/social/leaderboard
// @desc    Get community leaderboard
// @access  Public
router.get('/leaderboard', async (req, res) => {
  try {
    const { sortBy = 'reputation', limit = 50 } = req.query;
    
    const validSortFields = ['reputation', 'totalProfit', 'winRate', 'followers', 'totalTrades'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'reputation';
    
    const users = await User.find({ isActive: true })
      .select('username displayName avatar isVerified isPro stats followers following reputation')
      .sort({ [`stats.${sortField}`]: -1 })
      .limit(parseInt(limit));
    
    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      userId: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      isVerified: user.isVerified,
      isPro: user.isPro,
      reputation: user.reputation || 0,
      stats: {
        totalProfit: user.stats?.totalProfit || 0,
        winRate: user.stats?.winRate || 0,
        totalTrades: user.stats?.totalTrades || 0,
        followers: user.followers?.length || 0,
        monthlyReturn: user.stats?.monthlyReturn || 0
      }
    }));
    
    res.json({ leaderboard, total: leaderboard.length });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/social/online-users
// @desc    Get online users list
// @access  Public
router.get('/online-users', async (req, res) => {
  try {
    // Get recently active users (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const users = await User.find({ 
      lastActive: { $gte: fiveMinutesAgo },
      isActive: true 
    })
      .select('username displayName avatar isVerified isPro status')
      .limit(100);
    
    const onlineUsers = users.map(user => ({
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      isVerified: user.isVerified,
      isPro: user.isPro,
      status: user.status || 'online'
    }));
    
    res.json({ 
      users: onlineUsers, 
      count: onlineUsers.length,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Online users error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/social/users
// @desc    Get all users for mentions autocomplete
// @access  Public
router.get('/users', async (req, res) => {
  try {
    const { search = '', limit = 20 } = req.query;
    
    let query = { isActive: true };
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .select('username displayName avatar isVerified isPro')
      .limit(parseInt(limit));
    
    res.json({ 
      users: users.map(u => ({
        id: u._id,
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        isVerified: u.isVerified,
        isPro: u.isPro
      }))
    });
  } catch (error) {
    console.error('Users search error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/social/messages/:id/like
// @desc    Like/unlike a message
// @access  Private
router.post('/messages/:id/like', auth, async (req, res) => {
  try {
    const Message = require('../models/Message');
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }
    
    const userId = req.userId;
    const userObjId = new mongoose.Types.ObjectId(userId);
    
    // Toggle like using the model method
    const isLiked = await message.toggleLike(userObjId);
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(message.channelId).emit('message-liked', {
        messageId: message._id,
        likes: message.likes.length,
        likedBy: message.likes,
        isLiked
      });
    }
    
    res.json({ 
      likes: message.likes.length, 
      isLiked,
      likedBy: message.likes
    });
  } catch (error) {
    console.error('Message like error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/social/messages/:id/favorite
// @desc    Add/remove message from favorites
// @access  Private
router.post('/messages/:id/favorite', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const messageId = req.params.id;
    const favorites = user.favorites || [];
    const index = favorites.indexOf(messageId);
    
    let isFavorited = false;
    if (index > -1) {
      favorites.splice(index, 1);
      isFavorited = false;
    } else {
      favorites.push(messageId);
      isFavorited = true;
    }
    
    user.favorites = favorites;
    await user.save();
    
    res.json({ isFavorited, favorites: favorites.length });
  } catch (error) {
    console.error('Favorite error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/social/favorites
// @desc    Get user's favorite messages
// @access  Private
router.get('/favorites', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const Message = require('../models/Message');
    
    const user = await User.findById(req.userId);
    if (!user || !user.favorites || user.favorites.length === 0) {
      return res.json({ favorites: [] });
    }
    
    const messages = await Message.find({
      _id: { $in: user.favorites }
    }).sort({ timestamp: -1 }).limit(50);
    
    res.json({ favorites: messages });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/social/profile/:username
// @desc    Get full user profile with stats
// @access  Public
router.get('/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Get user's signals
    const signals = await Signal.find({ user: user._id, isPublic: true })
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Get user's shared trades
    const trades = await TradeShare.find({ user: user._id, isPublic: true })
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        isVerified: user.isVerified,
        isPro: user.isPro,
        reputation: user.reputation || 0,
        createdAt: user.createdAt,
        stats: user.stats,
        followers: user.followers?.length || 0,
        following: user.following?.length || 0
      },
      signals,
      trades
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/social/voice/upload
// @desc    Upload voice message
// @access  Private
router.post('/voice/upload', auth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier audio' });
    }
    
    const audioUrl = `/uploads/audio/${req.file.filename}`;
    const duration = req.body.duration || 0;
    
    res.json({
      audioUrl,
      duration,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('Voice upload error:', error);
    res.status(500).json({ error: 'Erreur upload' });
  }
});

module.exports = router;
