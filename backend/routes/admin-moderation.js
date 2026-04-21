const express = require('express');
const router = express.Router();
const { requireRole, logAdminAction } = require('../middleware/adminAuth');
const Report = require('../models/Report');
const User = require('../models/User');
const AdminLog = require('../models/AdminLog');

/**
 * 🛡️ ROUTES DE MODÉRATION
 * Toutes les routes nécessitent au minimum le rôle 'moderator'
 */

// Toutes les routes nécessitent authentification admin/modo
router.use(requireRole(['super_admin', 'admin', 'moderator']));

/**
 * GET /api/admin/moderation/reports
 * Liste tous les signalements avec filtres
 */
router.get('/reports', async (req, res) => {
  try {
    const { 
      status = 'pending', 
      severity, 
      reason, 
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (reason) query.reason = reason;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Report.countDocuments(query)
    ]);

    await logAdminAction(req, 'VIEW_REPORTS', `Consultation des signalements (${status})`, 'Report', 'success');

    res.json({
      success: true,
      reports,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('[Moderation] Error fetching reports:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des signalements' });
  }
});

/**
 * GET /api/admin/moderation/reports/stats
 * Statistiques des signalements
 */
router.get('/reports/stats', async (req, res) => {
  try {
    const stats = await Report.getStats();
    const bySeverity = await Report.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      stats: {
        byStatus: stats,
        bySeverity: bySeverity.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
        totalPending: stats.pending || 0
      }
    });
  } catch (error) {
    console.error('[Moderation] Error fetching stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

/**
 * GET /api/admin/moderation/reports/:id
 * Détail d'un signalement
 */
router.get('/reports/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }

    // Récupérer les infos de l'utilisateur signalé si c'est un user
    let targetUser = null;
    if (report.targetType === 'user' && report.targetUserId) {
      targetUser = await User.findById(report.targetUserId)
        .select('username email isBanned role stats createdAt');
    }

    // Historique des signalements similaires
    const similarReports = await Report.find({
      targetUserId: report.targetUserId,
      _id: { $ne: report._id }
    }).sort({ createdAt: -1 }).limit(5).lean();

    res.json({
      success: true,
      report,
      targetUser,
      similarReports
    });
  } catch (error) {
    console.error('[Moderation] Error fetching report:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du signalement' });
  }
});

/**
 * POST /api/admin/moderation/reports/:id/investigate
 * Marquer un signalement comme en cours d'investigation
 */
router.post('/reports/:id/investigate', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'investigating',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }

    await logAdminAction(req, 'INVESTIGATE_REPORT', `Investigation du signalement #${report._id}`, 'Report', 'success', report._id);

    res.json({
      success: true,
      message: 'Signalement marqué comme en cours d\'investigation',
      report
    });
  } catch (error) {
    console.error('[Moderation] Error investigating report:', error);
    res.status(500).json({ error: 'Erreur lors de l\'investigation' });
  }
});

/**
 * POST /api/admin/moderation/reports/:id/resolve
 * Résoudre un signalement
 */
router.post('/reports/:id/resolve', requireRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const { resolution, note, action } = req.body;

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }

    // Appliquer l'action si spécifiée
    let actionResult = null;
    if (action && report.targetUserId) {
      const targetUser = await User.findById(report.targetUserId);
      
      if (targetUser) {
        switch (action) {
          case 'warn':
            // Ajouter une note/alerte à l'utilisateur
            targetUser.adminNotes = (targetUser.adminNotes || '') + `\n[${new Date().toISOString()}] Avertissement: ${note}`;
            await targetUser.save();
            actionResult = 'Avertissement envoyé';
            break;
            
          case 'temp_ban':
            targetUser.isBanned = true;
            targetUser.bannedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours
            targetUser.banReason = note || 'Violation des règles';
            await targetUser.save();
            actionResult = 'Bannissement temporaire (7j) appliqué';
            break;
            
          case 'perm_ban':
            targetUser.isBanned = true;
            targetUser.bannedUntil = null; // Permanent
            targetUser.banReason = note || 'Violation grave des règles';
            await targetUser.save();
            actionResult = 'Bannissement permanent appliqué';
            break;
            
          case 'unban':
            targetUser.isBanned = false;
            targetUser.bannedUntil = null;
            targetUser.banReason = null;
            await targetUser.save();
            actionResult = 'Débannissement effectué';
            break;
        }
      }
    }

    // Mettre à jour le signalement
    report.status = 'resolved';
    report.resolution = resolution;
    report.resolutionNote = note;
    report.resolvedBy = req.user._id;
    report.resolvedByUsername = req.user.email;
    report.resolvedAt = new Date();
    await report.save();

    await logAdminAction(
      req, 
      'RESOLVE_REPORT', 
      `Signalement résolu: ${resolution}${actionResult ? ` - ${actionResult}` : ''}`, 
      'Report', 
      'success', 
      report._id
    );

    res.json({
      success: true,
      message: 'Signalement résolu',
      report,
      actionResult
    });
  } catch (error) {
    console.error('[Moderation] Error resolving report:', error);
    res.status(500).json({ error: 'Erreur lors de la résolution' });
  }
});

/**
 * POST /api/admin/moderation/reports/:id/dismiss
 * Rejeter un signalement
 */
router.post('/reports/:id/dismiss', requireRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const { reason } = req.body;

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      {
        status: 'dismissed',
        resolution: 'dismissed',
        resolutionNote: reason,
        resolvedBy: req.user._id,
        resolvedByUsername: req.user.email,
        resolvedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ error: 'Signalement non trouvé' });
    }

    await logAdminAction(req, 'DISMISS_REPORT', `Signalement rejeté: ${reason || 'Sans motif'}`, 'Report', 'success', report._id);

    res.json({
      success: true,
      message: 'Signalement rejeté',
      report
    });
  } catch (error) {
    console.error('[Moderation] Error dismissing report:', error);
    res.status(500).json({ error: 'Erreur lors du rejet' });
  }
});

/**
 * POST /api/admin/moderation/reports
 * Créer un signalement (utilisé par les users via l'app, ou admins)
 */
router.post('/reports', async (req, res) => {
  try {
    const { targetType, targetId, targetUserId, targetUsername, reason, description, severity, evidence } = req.body;

    const report = new Report({
      reporterId: req.user._id,
      reporterUsername: req.user.email || req.user.username,
      targetType,
      targetId,
      targetUserId,
      targetUsername,
      reason,
      description,
      severity: severity || 'medium',
      evidence: evidence || [],
      status: 'pending'
    });

    await report.save();

    await logAdminAction(req, 'CREATE_REPORT', `Nouveau signalement: ${reason} contre ${targetUsername || targetId}`, 'Report', 'success', report._id);

    res.status(201).json({
      success: true,
      message: 'Signalement créé',
      report
    });
  } catch (error) {
    console.error('[Moderation] Error creating report:', error);
    res.status(500).json({ error: 'Erreur lors de la création du signalement' });
  }
});

/**
 * GET /api/admin/moderation/users/:id/history
 * Historique d'un utilisateur (signalements reçus et envoyés)
 */
router.get('/users/:id/history', async (req, res) => {
  try {
    const userId = req.params.id;

    const [received, sent] = await Promise.all([
      Report.find({ targetUserId: userId }).sort({ createdAt: -1 }).lean(),
      Report.find({ reporterId: userId }).sort({ createdAt: -1 }).lean()
    ]);

    res.json({
      success: true,
      history: {
        received,
        sent,
        receivedCount: received.length,
        sentCount: sent.length
      }
    });
  } catch (error) {
    console.error('[Moderation] Error fetching user history:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
});

module.exports = router;
