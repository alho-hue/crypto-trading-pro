const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AdminLog = require('../models/AdminLog');
const adminAuthService = require('../services/adminAuthService');
const { 
  requireRole, 
  adminRateLimit, 
  logAdminAction, 
  generateAdminToken 
} = require('../middleware/adminAuth');
const os = require('os');

// Sous-routeurs
const moderationRouter = require('./admin-moderation');
const chatRouter = require('./admin-chat');
const aiRouter = require('./admin-ai');

const router = express.Router();

// Monter les sous-routeurs
router.use('/moderation', moderationRouter);
router.use('/chat', chatRouter);
router.use('/ai', aiRouter);

// ============================================
// 🔐 AUTHENTIFICATION ADMIN
// ============================================

/**
 * @route   POST /api/admin/login
 * @desc    Connexion admin avec email/password depuis .env
 * @access  Public (avec rate limiting strict)
 */
router.post('/login', adminRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.recordFailedAttempt && req.recordFailedAttempt();
      return res.status(400).json({ 
        error: 'Email and password required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Vérifier les credentials admin depuis .env
    const adminInfo = await adminAuthService.verifyCredentials(email, password);

    if (!adminInfo) {
      req.recordFailedAttempt && req.recordFailedAttempt();
      return res.status(401).json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Synchroniser avec la base de données
    const user = await adminAuthService.syncAdminWithDB(email, adminInfo.role);

    if (!user) {
      return res.status(500).json({ 
        error: 'Failed to sync admin with database',
        code: 'SYNC_ERROR'
      });
    }

    // Générer token JWT spécifique admin
    const token = generateAdminToken(user);

    // Logger la connexion
    await AdminLog.log({
      adminId: user._id,
      adminEmail: user.email,
      adminRole: user.role,
      action: 'ADMIN_LOGIN',
      description: `Admin login successful: ${user.email}`,
      targetType: 'User',
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'],
      status: 'success'
    });

    // Réinitialiser les tentatives échouées
    req.clearAttempts && req.clearAttempts();

    res.json({
      success: true,
      token,
      admin: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        displayName: user.displayName
      },
      expiresIn: '8h'
    });

  } catch (error) {
    console.error('[Admin Login] Error:', error);
    req.recordFailedAttempt && req.recordFailedAttempt();
    res.status(500).json({ 
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

/**
 * @route   POST /api/admin/logout
 * @desc    Déconnexion admin (côté client supprime le token)
 * @access  Private/Admin
 */
router.post('/logout', requireRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  await logAdminAction(req, 'ADMIN_LOGOUT', `Admin logout: ${req.user.email}`);
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * @route   GET /api/admin/me
 * @desc    Récupérer les infos de l'admin connecté
 * @access  Private/Admin
 */
router.get('/me', requireRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  const user = await User.findById(req.user.id).select('-password -loginAttempts -lockUntil');
  res.json({ admin: user });
});

// ============================================
// 👥 GESTION UTILISATEURS
// ============================================

/**
 * @route   GET /api/admin/users
 * @desc    Liste complète des utilisateurs avec filtres et pagination
 * @access  Private/Admin/Moderator
 */
router.get('/users', requireRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const { 
      search, 
      status, 
      role,
      sortBy = 'createdAt', 
      order = 'desc', 
      page = 1, 
      limit = 50 
    } = req.query;
    
    let query = {};
    
    // Recherche texte
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filtre par statut
    if (status === 'banned') query.isBanned = true;
    if (status === 'online') {
      query.lastActive = { $gte: new Date(Date.now() - 5 * 60 * 1000) };
    }
    if (status === 'verified') query.isVerified = true;
    if (status === 'unverified') query.isVerified = false;

    // Filtre par rôle
    if (role && ['user', 'moderator', 'admin', 'super_admin'].includes(role)) {
      query.role = role;
    }
    
    // Tri
    const sortOrder = order === 'asc' ? 1 : -1;
    let sort = {};
    if (sortBy === 'profit') sort = { 'stats.totalProfit': sortOrder };
    else if (sortBy === 'trades') sort = { 'stats.totalTrades': sortOrder };
    else if (sortBy === 'username') sort = { username: sortOrder };
    else if (sortBy === 'balance') sort = { 'wallet.balance': sortOrder };
    else sort = { createdAt: sortOrder };
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [users, total] = await Promise.all([
      User.find(query)
        .select('username email displayName avatar stats wallet role followers following isBanned isAdmin isVerified isPublic createdAt lastActive')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query)
    ]);
    
    res.json({
      users: users.map(u => ({
        id: u._id,
        username: u.username,
        email: u.email,
        displayName: u.displayName,
        avatar: u.avatar,
        stats: u.stats,
        winRate: u.stats?.totalTrades > 0 
          ? ((u.stats.winningTrades / u.stats.totalTrades) * 100).toFixed(1)
          : 0,
        wallet: u.wallet,
        followers: u.followers?.length || 0,
        following: u.following?.length || 0,
        role: u.role || (u.isAdmin ? 'admin' : 'user'),
        isBanned: u.isBanned,
        isVerified: u.isVerified,
        isPublic: u.isPublic,
        isOnline: u.lastActive >= new Date(Date.now() - 5 * 60 * 1000),
        lastLogin: u.lastActive,
        createdAt: u.createdAt
      })),
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        hasMore: skip + users.length < total
      }
    });
  } catch (error) {
    console.error('[Admin Users] Error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * @route   GET /api/admin/users/:id
 * @desc    Détails complets d'un utilisateur
 * @access  Private/Admin/Moderator
 */
router.get('/users/:id', requireRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('followers', 'username displayName avatar')
      .populate('following', 'username displayName avatar');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        bio: user.bio,
        avatar: user.avatar,
        phone: user.phone,
        location: user.location,
        stats: user.stats,
        winRate: user.winRate,
        wallet: user.wallet,
        followers: user.followers,
        following: user.following,
        transactions: user.transactions?.slice(-50) || [], // 50 dernières
        role: user.role || (user.isAdmin ? 'admin' : 'user'),
        isBanned: user.isBanned,
        isAdmin: user.isAdmin,
        isVerified: user.isVerified,
        isPublic: user.isPublic,
        banReason: user.banReason,
        bannedAt: user.bannedAt,
        adminNotes: user.adminNotes,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
        preferences: user.preferences,
        twoFactorEnabled: user.twoFactorEnabled,
        allowedIPs: user.allowedIPs,
        ipWhitelistEnabled: user.ipWhitelistEnabled
      }
    });
  } catch (error) {
    console.error('[Admin User Detail] Error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

/**
 * @route   POST /api/admin/users/:id/ban
 * @desc    Bannir ou débannir un utilisateur
 * @access  Private/Admin/Moderator
 */
router.post('/users/:id/ban', requireRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const { reason, duration } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Protection: pas d'auto-ban
    if (user._id.toString() === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot ban yourself' });
    }
    
    // Protection: pas de ban d'admin par non-super-admin
    const targetRole = user.role || (user.isAdmin ? 'admin' : 'user');
    if (['admin', 'super_admin'].includes(targetRole) && req.userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Cannot ban admin users' });
    }
    
    const wasBanned = user.isBanned;
    user.isBanned = !user.isBanned;
    
    if (user.isBanned) {
      user.banReason = reason || 'Violation of terms';
      user.bannedAt = new Date();
      user.banDuration = duration || 'permanent';
    } else {
      user.banReason = null;
      user.bannedAt = null;
      user.banDuration = null;
    }
    
    await user.save();
    
    // Logger l'action
    await logAdminAction(req, 
      user.isBanned ? 'USER_BAN' : 'USER_UNBAN',
      `${user.isBanned ? 'Banned' : 'Unbanned'} user: ${user.username}`,
      {
        targetId: user._id,
        targetType: 'User',
        targetDetails: { username: user.username, email: user.email },
        previousData: { isBanned: wasBanned },
        newData: { isBanned: user.isBanned, reason: user.banReason },
        severity: user.isBanned ? 'high' : 'medium'
      }
    );
    
    res.json({
      success: true,
      message: user.isBanned ? 'User banned successfully' : 'User unbanned successfully',
      user: {
        id: user._id,
        username: user.username,
        isBanned: user.isBanned,
        banReason: user.banReason
      }
    });
  } catch (error) {
    console.error('[Admin Ban] Error:', error);
    res.status(500).json({ error: 'Failed to ban/unban user' });
  }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Supprimer définitivement un utilisateur
 * @access  Private/Super Admin only
 */
router.delete('/users/:id', requireRole(['super_admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Protection: pas d'auto-suppression
    if (user._id.toString() === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    
    // Protection: pas de suppression d'admin
    if (user.isAdmin || ['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Cannot delete admin users' });
    }
    
    const deletedUserInfo = {
      id: user._id,
      username: user.username,
      email: user.email
    };
    
    await User.findByIdAndDelete(req.params.id);
    
    // Logger l'action
    await logAdminAction(req, 'USER_DELETE', `Deleted user: ${deletedUserInfo.username}`, {
      targetId: deletedUserInfo.id,
      targetType: 'User',
      targetDetails: deletedUserInfo,
      severity: 'critical'
    });
    
    res.json({ 
      success: true,
      message: 'User deleted permanently' 
    });
  } catch (error) {
    console.error('[Admin Delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Mettre à jour un utilisateur (rôle, notes, etc.)
 * @access  Private/Admin
 */
router.put('/users/:id', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const { role, isPublic, notes, isVerified } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const previousData = {
      role: user.role,
      isPublic: user.isPublic,
      isVerified: user.isVerified,
      adminNotes: user.adminNotes
    };
    
    // Mise à jour du rôle (super_admin uniquement)
    if (role !== undefined && req.userRole === 'super_admin') {
      if (user._id.toString() === req.userId.toString() && role !== 'super_admin') {
        return res.status(400).json({ error: 'Cannot remove your own super_admin role' });
      }
      user.role = role;
      user.isAdmin = ['admin', 'super_admin'].includes(role);
    }
    
    if (isPublic !== undefined) user.isPublic = isPublic;
    if (isVerified !== undefined) user.isVerified = isVerified;
    if (notes !== undefined) user.adminNotes = notes;
    
    await user.save();
    
    // Logger l'action
    await logAdminAction(req, 'USER_UPDATE', `Updated user: ${user.username}`, {
      targetId: user._id,
      targetType: 'User',
      previousData,
      newData: { role: user.role, isPublic: user.isPublic, isVerified: user.isVerified, adminNotes: user.adminNotes },
      severity: role !== undefined ? 'high' : 'medium'
    });
    
    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        isAdmin: user.isAdmin,
        isPublic: user.isPublic,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error('[Admin Update] Error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ============================================
// 📊 OVERVIEW & STATISTIQUES
// ============================================

/**
 * @route   GET /api/admin/overview
 * @desc    Vue d'ensemble complète pour le dashboard
 * @access  Private/Admin/Moderator
 */
router.get('/overview', requireRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    
    // Stats utilisateurs
    const [
      totalUsers,
      onlineUsers,
      newUsers24h,
      newUsers7d,
      newUsers30d,
      bannedUsers,
      verifiedUsers,
      adminUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ lastActive: { $gte: new Date(now - 5 * 60 * 1000) } }),
      User.countDocuments({ createdAt: { $gte: twentyFourHoursAgo } }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      User.countDocuments({ isBanned: true }),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ $or: [{ role: { $in: ['admin', 'super_admin'] } }, { isAdmin: true }] })
    ]);
    
    // Stats trading agrégées
    const tradingAgg = await User.aggregate([
      {
        $group: {
          _id: null,
          totalTrades: { $sum: { $ifNull: ['$stats.totalTrades', 0] } },
          totalProfit: { $sum: { $ifNull: ['$stats.totalProfit', 0] } },
          totalVolume: { $sum: { $ifNull: ['$stats.totalVolume', 0] } },
          avgProfit: { $avg: { $ifNull: ['$stats.totalProfit', 0] } },
          winningTraders: { 
            $sum: { 
              $cond: [{ $gt: ['$stats.totalProfit', 0] }, 1, 0] 
            } 
          }
        }
      }
    ]);
    
    const trading = tradingAgg[0] || {
      totalTrades: 0,
      totalProfit: 0,
      totalVolume: 0,
      avgProfit: 0,
      winningTraders: 0
    };
    
    // Stats wallets
    const walletAgg = await User.aggregate([
      {
        $group: {
          _id: null,
          totalBalance: { $sum: { $ifNull: ['$wallet.balance', 0] } },
          totalDeposits: { $sum: { $ifNull: ['$wallet.totalDeposits', 0] } },
          totalWithdrawals: { $sum: { $ifNull: ['$wallet.totalWithdrawals', 0] } },
          avgBalance: { $avg: { $ifNull: ['$wallet.balance', 0] } }
        }
      }
    ]);
    
    const wallet = walletAgg[0] || {
      totalBalance: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      avgBalance: 0
    };
    
    // Utilisateurs récents
    const recentUsers = await User.find()
      .select('username email displayName createdAt role isBanned')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    // Top traders par profit
    const topTraders = await User.find({ 'stats.totalProfit': { $gt: 0 } })
      .select('username displayName avatar stats.totalProfit stats.totalTrades')
      .sort({ 'stats.totalProfit': -1 })
      .limit(10)
      .lean();
    
    res.json({
      users: {
        total: totalUsers,
        online: onlineUsers,
        new24h: newUsers24h,
        new7d: newUsers7d,
        new30d: newUsers30d,
        banned: bannedUsers,
        verified: verifiedUsers,
        admins: adminUsers,
        active: await User.countDocuments({ 'stats.totalTrades': { $gt: 0 } }),
        profitable: await User.countDocuments({ 'stats.totalProfit': { $gt: 0 } })
      },
      trading: {
        totalTrades: trading.totalTrades,
        totalProfit: trading.totalProfit,
        totalVolume: trading.totalVolume,
        avgProfitPerUser: trading.avgProfit,
        winningTraders: trading.winningTraders,
        avgTradesPerUser: totalUsers > 0 ? trading.totalTrades / totalUsers : 0
      },
      wallet: {
        totalBalance: wallet.totalBalance,
        totalDeposits: wallet.totalDeposits,
        totalWithdrawals: wallet.totalWithdrawals,
        avgBalance: wallet.avgBalance,
        netFlow: wallet.totalDeposits - wallet.totalWithdrawals
      },
      recentUsers: recentUsers.map(u => ({
        id: u._id,
        username: u.username,
        email: u.email,
        displayName: u.displayName,
        role: u.role || (u.isAdmin ? 'admin' : 'user'),
        isBanned: u.isBanned,
        createdAt: u.createdAt
      })),
      topTraders: topTraders.map(t => ({
        id: t._id,
        username: t.username,
        displayName: t.displayName,
        avatar: t.avatar,
        totalProfit: t.stats?.totalProfit || 0,
        totalTrades: t.stats?.totalTrades || 0
      })),
      system: {
        uptime: process.uptime(),
        timestamp: now,
        memory: process.memoryUsage(),
        version: process.version,
        platform: process.platform
      }
    });
  } catch (error) {
    console.error('[Admin Overview] Error:', error);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// ============================================
// 📝 LOGS ADMIN
// ============================================

/**
 * @route   GET /api/admin/logs
 * @desc    Récupérer les logs d'actions admin
 * @access  Private/Super Admin
 */
router.get('/logs', requireRole(['super_admin']), async (req, res) => {
  try {
    const { 
      adminId, 
      action, 
      severity, 
      startDate, 
      endDate,
      page = 1, 
      limit = 50 
    } = req.query;
    
    let query = {};
    
    if (adminId) query.adminId = adminId;
    if (action) query.action = action;
    if (severity) query.severity = severity;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [logs, total] = await Promise.all([
      AdminLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('adminId', 'username email')
        .lean(),
      AdminLog.countDocuments(query)
    ]);
    
    res.json({
      logs: logs.map(l => ({
        id: l._id,
        admin: l.adminId,
        adminEmail: l.adminEmail,
        adminRole: l.adminRole,
        action: l.action,
        description: l.description,
        targetType: l.targetType,
        targetDetails: l.targetDetails,
        status: l.status,
        severity: l.severity,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt
      })),
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        hasMore: skip + logs.length < total
      }
    });
  } catch (error) {
    console.error('[Admin Logs] Error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * @route   GET /api/admin/logs/stats
 * @desc    Statistiques d'activité des admins
 * @access  Private/Super Admin
 */
router.get('/logs/stats', requireRole(['super_admin']), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const stats = await AdminLog.getActivityStats(days);
    
    // Stats par type d'action
    const actionStats = await AdminLog.aggregate([
      { 
        $match: { 
          createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } 
        } 
      },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      adminActivity: stats,
      actionBreakdown: actionStats,
      period: `${days} days`
    });
  } catch (error) {
    console.error('[Admin Logs Stats] Error:', error);
    res.status(500).json({ error: 'Failed to fetch log stats' });
  }
});

// ============================================
// 📈 ANALYTICS & RAPPORTS
// ============================================

/**
 * @route   GET /api/admin/analytics
 * @desc    Analytics avancés (PnL, volume, performance)
 * @access  Private/Admin
 */
router.get('/analytics', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    const periods = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    };
    
    const days = periods[period] || 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Evolution des inscriptions
    const signupTrend = await User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Répartition par rôle
    const roleDistribution = await User.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$role', { $cond: ['$isAdmin', 'admin', 'user'] }] },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Performance trading par période
    const tradingPerformance = await User.aggregate([
      { $match: { 'stats.totalTrades': { $gt: 0 } } },
      {
        $group: {
          _id: null,
          avgProfit: { $avg: '$stats.totalProfit' },
          bestProfit: { $max: '$stats.totalProfit' },
          worstProfit: { $min: '$stats.totalProfit' },
          totalTraders: { $sum: 1 }
        }
      }
    ]);
    
    // Volume de transactions
    const transactionVolume = await User.aggregate([
      { $unwind: { path: '$transactions', preserveNullAndEmptyArrays: false } },
      { $match: { 'transactions.createdAt': { $gte: startDate } } },
      {
        $group: {
          _id: '$transactions.type',
          totalAmount: { $sum: '$transactions.amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      period,
      signupTrend,
      roleDistribution: roleDistribution.map(r => ({ role: r._id, count: r.count })),
      tradingPerformance: tradingPerformance[0] || {},
      transactionVolume,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('[Admin Analytics] Error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ============================================
// ⚙️ SYSTEM STATUS
// ============================================

/**
 * @route   GET /api/admin/system
 * @desc    Statut système détaillé (CPU, RAM, API)
 * @access  Private/Super Admin
 */
router.get('/system', requireRole(['super_admin']), async (req, res) => {
  try {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    const cpus = os.cpus();
    
    // Calculer usage CPU moyen (approximatif)
    const loadAvg = os.loadavg();
    const cpuCount = cpus.length;
    const cpuUsage = Math.min((loadAvg[0] / cpuCount) * 100, 100);
    
    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = (usedMem / totalMem) * 100;
    
    res.json({
      server: {
        uptime: {
          seconds: uptime,
          formatted: formatUptime(uptime)
        },
        node: {
          version: process.version,
          platform: process.platform,
          arch: process.arch
        }
      },
      cpu: {
        count: cpuCount,
        model: cpus[0]?.model,
        usage: Math.round(cpuUsage * 100) / 100,
        loadAverage: loadAvg
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: Math.round(memoryUsagePercent * 100) / 100,
        process: {
          rss: memory.rss,
          heapTotal: memory.heapTotal,
          heapUsed: memory.heapUsed,
          external: memory.external
        }
      },
      os: {
        hostname: os.hostname(),
        type: os.type(),
        release: os.release()
      },
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[Admin System] Error:', error);
    res.status(500).json({ error: 'Failed to fetch system status' });
  }
});

/**
 * @route   GET /api/admin/system/apis
 * @desc    Statut des APIs externes (Binance, etc.)
 * @access  Private/Super Admin
 */
router.get('/system/apis', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    // Tester connectivité Binance
    const binanceStatus = await checkBinanceAPI();
    
    res.json({
      binance: binanceStatus,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[Admin System APIs] Error:', error);
    res.status(500).json({ error: 'Failed to check API status' });
  }
});

// Helper pour formater l'uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

// Helper pour vérifier Binance API
async function checkBinanceAPI() {
  try {
    const axios = require('axios');
    const start = Date.now();
    const response = await axios.get('https://api.binance.com/api/v3/ping', {
      timeout: 5000
    });
    const latency = Date.now() - start;
    
    return {
      status: 'operational',
      latency,
      lastChecked: new Date()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      lastChecked: new Date()
    };
  }
}

// ============================================
// 💰 ECONOMY / WALLETS
// ============================================

/**
 * @route   GET /api/admin/economy
 * @desc    Vue d'ensemble économique
 * @access  Private/Admin
 */
router.get('/economy', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const days = parseInt(period) || 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Stats globales wallet
    const walletStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalBalance: { $sum: { $ifNull: ['$wallet.balance', 0] } },
          totalAvailable: { $sum: { $ifNull: ['$wallet.available', 0] } },
          totalLocked: { $sum: { $ifNull: ['$wallet.locked', 0] } },
          totalDeposits: { $sum: { $ifNull: ['$wallet.totalDeposits', 0] } },
          totalWithdrawals: { $sum: { $ifNull: ['$wallet.totalWithdrawals', 0] } },
          avgBalance: { $avg: { $ifNull: ['$wallet.balance', 0] } },
          userCount: { $sum: 1 }
        }
      }
    ]);
    
    // Transactions récentes (tous les utilisateurs)
    const recentTransactions = await User.aggregate([
      { $unwind: '$transactions' },
      { $match: { 'transactions.createdAt': { $gte: startDate } } },
      { $sort: { 'transactions.createdAt': -1 } },
      { $limit: 100 },
      {
        $project: {
          userId: '$_id',
          username: 1,
          transaction: '$transactions'
        }
      }
    ]);
    
    // Stats par type de transaction
    const transactionStats = await User.aggregate([
      { $unwind: '$transactions' },
      { $match: { 'transactions.createdAt': { $gte: startDate } } },
      {
        $group: {
          _id: '$transactions.type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$transactions.amount' },
          avgAmount: { $avg: '$transactions.amount' }
        }
      }
    ]);
    
    const stats = walletStats[0] || {};
    
    res.json({
      overview: {
        totalBalance: stats.totalBalance || 0,
        totalAvailable: stats.totalAvailable || 0,
        totalLocked: stats.totalLocked || 0,
        totalDeposits: stats.totalDeposits || 0,
        totalWithdrawals: stats.totalWithdrawals || 0,
        netFlow: (stats.totalDeposits || 0) - (stats.totalWithdrawals || 0),
        avgBalance: stats.avgBalance || 0,
        userCount: stats.userCount || 0
      },
      transactionStats: transactionStats.map(t => ({
        type: t._id,
        count: t.count,
        totalAmount: t.totalAmount,
        avgAmount: t.avgAmount
      })),
      recentTransactions: recentTransactions.map(t => ({
        userId: t.userId,
        username: t.username,
        ...t.transaction
      })),
      period,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[Admin Economy] Error:', error);
    res.status(500).json({ error: 'Failed to fetch economy data' });
  }
});

/**
 * @route   GET /api/admin/economy/pending
 * @desc    Transactions en attente (à approuver)
 * @access  Private/Admin
 */
router.get('/economy/pending', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    // Trouver toutes les transactions pending
    const pendingTransactions = await User.aggregate([
      { $unwind: '$transactions' },
      { $match: { 'transactions.status': 'pending' } },
      { $sort: { 'transactions.createdAt': -1 } },
      {
        $project: {
          userId: '$_id',
          username: 1,
          email: 1,
          transaction: '$transactions'
        }
      }
    ]);
    
    res.json({
      pending: pendingTransactions.map(t => ({
        userId: t.userId,
        username: t.username,
        email: t.email,
        ...t.transaction
      })),
      count: pendingTransactions.length,
      totalAmount: pendingTransactions.reduce((sum, t) => sum + (t.transaction?.amount || 0), 0)
    });
  } catch (error) {
    console.error('[Admin Economy Pending] Error:', error);
    res.status(500).json({ error: 'Failed to fetch pending transactions' });
  }
});

// ============================================
// 🤖 TRADING & BOTS
// ============================================

/**
 * @route   GET /api/admin/trading
 * @desc    Monitoring trading global
 * @access  Private/Admin
 */
router.get('/trading', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    // Stats trades par utilisateur
    const userTrades = await User.find({ 'stats.totalTrades': { $gt: 0 } })
      .select('username displayName stats transactions')
      .sort({ 'stats.totalProfit': -1 })
      .limit(50)
      .lean();
    
    // Trades actifs (avec status 'open')
    const activeTrades = userTrades.flatMap(u => 
      (u.stats?.tradeHistory || [])
        .filter(t => t.status === 'open')
        .map(t => ({
          ...t,
          userId: u._id,
          username: u.username
        }))
    );
    
    // Agrégations
    const tradeStats = await User.aggregate([
      { $match: { 'stats.totalTrades': { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalTraders: { $sum: 1 },
          totalTrades: { $sum: '$stats.totalTrades' },
          totalProfit: { $sum: '$stats.totalProfit' },
          avgProfit: { $avg: '$stats.totalProfit' },
          profitableTraders: {
            $sum: { $cond: [{ $gt: ['$stats.totalProfit', 0] }, 1, 0] }
          }
        }
      }
    ]);
    
    res.json({
      stats: tradeStats[0] || {
        totalTraders: 0,
        totalTrades: 0,
        totalProfit: 0,
        avgProfit: 0,
        profitableTraders: 0
      },
      activeTrades,
      topTraders: userTrades.slice(0, 10).map(u => ({
        id: u._id,
        username: u.username,
        displayName: u.displayName,
        totalTrades: u.stats?.totalTrades || 0,
        totalProfit: u.stats?.totalProfit || 0,
        winRate: u.stats?.totalTrades > 0 
          ? ((u.stats.winningTrades / u.stats.totalTrades) * 100).toFixed(1)
          : 0
      })),
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[Admin Trading] Error:', error);
    res.status(500).json({ error: 'Failed to fetch trading data' });
  }
});

/**
 * @route   GET /api/admin/bots
 * @desc    Monitoring des bots de trading
 * @access  Private/Admin
 */
router.get('/bots', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    // Récupérer les configs bot des utilisateurs
    const usersWithBots = await User.find({ 
      'settings.trading.botEnabled': true 
    })
    .select('username displayName settings.trading stats')
    .lean();
    
    const bots = usersWithBots.map(u => ({
      userId: u._id,
      username: u.username,
      displayName: u.displayName,
      config: u.settings?.trading,
      stats: {
        totalTrades: u.stats?.totalTrades || 0,
        totalProfit: u.stats?.totalProfit || 0
      },
      status: u.settings?.trading?.botEnabled ? 'active' : 'inactive'
    }));
    
    res.json({
      bots,
      activeCount: bots.filter(b => b.status === 'active').length,
      totalCount: bots.length
    });
  } catch (error) {
    console.error('[Admin Bots] Error:', error);
    res.status(500).json({ error: 'Failed to fetch bot data' });
  }
});

// ============================================
// 💬 COMMUNITY / MODERATION
// ============================================

/**
 * @route   GET /api/admin/moderation
 * @desc    Centre de modération (signalements, etc.)
 * @access  Private/Admin/Moderator
 */
router.get('/moderation', requireRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const Report = require('../models/Report');
    const { status = 'all', limit = 50, page = 1 } = req.query;
    
    // Build query
    const query = {};
    if (status !== 'all') {
      query.status = status;
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Récupérer les signalements
    const [reports, totalCount, pendingCount, resolvedTodayCount, stats] = await Promise.all([
      Report.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Report.countDocuments(query),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({
        status: 'resolved',
        resolvedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),
      Report.getStats()
    ]);
    
    // Formater les résultats
    const formattedReports = reports.map(r => ({
      id: r._id,
      reporter: { id: r.reporterId, username: r.reporterUsername },
      target: { type: r.targetType, id: r.targetId, username: r.targetUsername },
      reason: r.reason,
      description: r.description,
      severity: r.severity,
      status: r.status,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      resolution: r.resolution,
      resolvedBy: r.resolvedByUsername
    }));
    
    res.json({
      reports: {
        pending: formattedReports.filter(r => r.status === 'pending'),
        resolved: formattedReports.filter(r => r.status === 'resolved'),
        all: formattedReports,
        total: totalCount
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        total: totalCount
      },
      stats: {
        totalReports: totalCount,
        pendingReports: pendingCount,
        resolvedToday: resolvedTodayCount,
        byStatus: stats
      }
    });
  } catch (error) {
    console.error('[Admin Moderation] Error:', error);
    res.status(500).json({ error: 'Failed to fetch moderation data' });
  }
});

/**
 * @route   GET /api/admin/community/stats
 * @desc    Stats communauté (messages, utilisateurs actifs)
 * @access  Private/Admin/Moderator
 */
router.get('/community/stats', requireRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const onlineUsers = await User.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    });
    
    const activeToday = await User.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    res.json({
      onlineUsers,
      activeToday,
      totalUsers: await User.countDocuments(),
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[Admin Community Stats] Error:', error);
    res.status(500).json({ error: 'Failed to fetch community stats' });
  }
});

// ============================================
// ⚙️ SETTINGS / CONFIGURATION
// ============================================

/**
 * @route   GET /api/admin/settings
 * @desc    Configuration actuelle du système
 * @access  Private/Super Admin
 */
router.get('/settings', requireRole(['super_admin']), async (req, res) => {
  try {
    res.json({
      settings: {
        rateLimiting: {
          windowMs: process.env.RATE_LIMIT_WINDOW_MS || 900000,
          maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || 10000
        },
        admin: {
          tokenExpiry: process.env.ADMIN_TOKEN_EXPIRY || '8h',
          maxLoginAttempts: process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 5,
          lockoutMinutes: process.env.ADMIN_LOGIN_LOCKOUT_MINUTES || 30
        },
        features: {
          realTrading: process.env.REAL_TRADING_ENABLED === 'true',
          testnet: process.env.BINANCE_TESTNET === 'true'
        }
      },
      env: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    console.error('[Admin Settings] Error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ============================================
// 🚨 MODERATION ACTIONS
// ============================================

/**
 * @route   POST /api/admin/moderation/report
 * @desc    Créer un signalement
 * @access  Private
 */
router.post('/moderation/report', authenticateToken, async (req, res) => {
  try {
    const Report = require('../models/Report');
    const { targetType, targetId, targetUserId, targetUsername, reason, description, severity = 'medium' } = req.body;
    
    // Validation
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ error: 'targetType, targetId et reason sont requis' });
    }
    
    const report = new Report({
      reporterId: req.userId || req.user.id,
      reporterUsername: req.user.username,
      targetType,
      targetId,
      targetUserId,
      targetUsername,
      reason,
      description,
      severity,
      status: 'pending'
    });
    
    await report.save();
    
    // Notifier les admins via Socket.IO
    const { getIO } = require('../server');
    const io = getIO();
    if (io) {
      io.to('admins').emit('new_report', {
        id: report._id,
        type: targetType,
        reason,
        severity,
        reporter: req.user.username
      });
    }
    
    res.json({
      success: true,
      message: 'Signalement créé',
      reportId: report._id
    });
  } catch (error) {
    console.error('[Admin Report Create] Error:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

/**
 * @route   POST /api/admin/moderation/resolve/:reportId
 * @desc    Résoudre un signalement
 * @access  Private/Admin/Moderator
 */
router.post('/moderation/resolve/:reportId', requireRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const Report = require('../models/Report');
    const { reportId } = req.params;
    const { resolution, note } = req.body;
    
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }
    
    if (report.status === 'resolved') {
      return res.status(400).json({ error: 'Signalement déjà résolu' });
    }
    
    // Mettre à jour
    report.status = 'resolved';
    report.resolution = resolution;
    report.resolutionNote = note;
    report.resolvedBy = req.userId || req.user.id;
    report.resolvedByUsername = req.user.username;
    report.resolvedAt = new Date();
    
    await report.save();
    
    // Actions selon la résolution
    if (resolution === 'temp_ban' || resolution === 'perm_ban') {
      const User = require('../models/User');
      const targetUser = await User.findById(report.targetUserId);
      if (targetUser) {
        targetUser.isBanned = true;
        targetUser.bannedAt = new Date();
        targetUser.bannedReason = note || `Violation: ${report.reason}`;
        targetUser.banExpiry = resolution === 'perm_ban' ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours pour temp
        await targetUser.save();
      }
    }
    
    res.json({
      success: true,
      message: 'Signalement résolu',
      report: {
        id: report._id,
        status: report.status,
        resolution: report.resolution,
        resolvedBy: report.resolvedByUsername,
        resolvedAt: report.resolvedAt
      }
    });
  } catch (error) {
    console.error('[Admin Report Resolve] Error:', error);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

/**
 * @route   POST /api/admin/moderation/dismiss/:reportId
 * @desc    Rejeter un signalement
 * @access  Private/Admin/Moderator
 */
router.post('/moderation/dismiss/:reportId', requireRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const Report = require('../models/Report');
    const { reportId } = req.params;
    const { note } = req.body;
    
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }
    
    report.status = 'dismissed';
    report.resolution = 'dismissed';
    report.resolutionNote = note;
    report.resolvedBy = req.userId || req.user.id;
    report.resolvedByUsername = req.user.username;
    report.resolvedAt = new Date();
    
    await report.save();
    
    res.json({
      success: true,
      message: 'Signalement rejeté'
    });
  } catch (error) {
    console.error('[Admin Report Dismiss] Error:', error);
    res.status(500).json({ error: 'Failed to dismiss report' });
  }
});

module.exports = router;
