const express = require('express');
const router = express.Router();
const { requireRole, logAdminAction } = require('../middleware/adminAuth');
const AdminMessage = require('../models/AdminMessage');
const User = require('../models/User');

/**
 * 💬 ROUTES DU CHAT ADMIN/MODÉRATEUR
 * Communication privée entre l'équipe de modération
 */

// Toutes les routes nécessitent au minimum le rôle 'moderator'
router.use(requireRole(['super_admin', 'admin', 'moderator']));

/**
 * GET /api/admin/chat/messages
 * Récupérer les messages récents d'un canal
 */
router.get('/messages', async (req, res) => {
  try {
    const { 
      channel = 'all_admins', 
      limit = 50, 
      before // Pour pagination (messages avant cette date)
    } = req.query;

    // Vérifier les permissions de canal
    if (channel === 'super_admins_only' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Accès réservé aux super admins' });
    }

    const query = { 
      channel, 
      deleted: false 
    };
    
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await AdminMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Marquer comme lus pour l'utilisateur courant
    const messageIds = messages.map(m => m._id);
    await AdminMessage.updateMany(
      { 
        _id: { $in: messageIds },
        'recipients.userId': req.user._id,
        'recipients.read': false
      },
      { 
        $set: { 
          'recipients.$.read': true, 
          'recipients.$.readAt': new Date() 
        } 
      }
    );

    res.json({
      success: true,
      messages: messages.reverse(), // Ordre chronologique
      channel
    });
  } catch (error) {
    console.error('[AdminChat] Error fetching messages:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
  }
});

/**
 * GET /api/admin/chat/unread
 * Nombre de messages non lus
 */
router.get('/unread', async (req, res) => {
  try {
    const count = await AdminMessage.getUnreadCount(req.user._id, req.user.role);
    
    // Détail par canal
    const byChannel = await AdminMessage.aggregate([
      {
        $match: {
          'recipients.userId': req.user._id,
          'recipients.read': false,
          deleted: false,
          ...(req.user.role !== 'super_admin' ? { channel: { $in: ['all_admins', 'mods_only'] } } : {})
        }
      },
      {
        $group: {
          _id: '$channel',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      total: count,
      byChannel: byChannel.reduce((acc, c) => { acc[c._id] = c.count; return acc; }, {})
    });
  } catch (error) {
    console.error('[AdminChat] Error fetching unread:', error);
    res.status(500).json({ error: 'Erreur lors du comptage' });
  }
});

/**
 * POST /api/admin/chat/messages
 * Envoyer un message
 */
router.post('/messages', async (req, res) => {
  try {
    const { content, channel = 'all_admins', type = 'text', replyTo } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message vide' });
    }

    // Vérifier les permissions de canal
    if (channel === 'super_admins_only' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Accès réservé aux super admins' });
    }

    // Récupérer tous les admins/modos pour les destinataires
    let recipientsQuery = { 
      role: { $in: ['super_admin', 'admin', 'moderator'] },
      _id: { $ne: req.user._id } // Exclure l'expéditeur
    };

    if (channel === 'mods_only') {
      recipientsQuery.role = { $in: ['super_admin', 'admin', 'moderator'] };
    } else if (channel === 'super_admins_only') {
      recipientsQuery.role = 'super_admin';
    }

    const recipients = await User.find(recipientsQuery).select('_id').lean();

    // Préparer le message avec info de reply si applicable
    let replyToContent = null;
    if (replyTo) {
      const repliedMessage = await AdminMessage.findById(replyTo).select('content senderUsername').lean();
      if (repliedMessage) {
        replyToContent = repliedMessage.content.substring(0, 100);
      }
    }

    const message = new AdminMessage({
      senderId: req.user._id,
      senderUsername: req.user.email || req.user.username,
      senderRole: req.user.role,
      content: content.trim(),
      type,
      channel,
      replyTo: replyTo || undefined,
      replyToContent,
      recipients: recipients.map(r => ({ userId: r._id, read: false }))
    });

    await message.save();

    // Log l'action si c'est une annonce importante
    if (type === 'announcement') {
      await logAdminAction(req, 'CHAT_ANNOUNCEMENT', `Annonce: ${content.substring(0, 50)}...`, 'AdminMessage', 'success', message._id);
    }

    // Peupler l'expéditeur pour la réponse
    const populatedMessage = await AdminMessage.findById(message._id)
      .populate('senderId', 'username avatar')
      .lean();

    res.status(201).json({
      success: true,
      message: populatedMessage
    });
  } catch (error) {
    console.error('[AdminChat] Error sending message:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
  }
});

/**
 * PUT /api/admin/chat/messages/:id
 * Modifier un message
 */
router.put('/messages/:id', async (req, res) => {
  try {
    const { content } = req.body;
    const messageId = req.params.id;

    const message = await AdminMessage.findOne({
      _id: messageId,
      senderId: req.user._id,
      deleted: false
    });

    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé ou non autorisé' });
    }

    // Vérifier que le message n'est pas trop vieux (max 10 min pour éditer)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (message.createdAt < tenMinutesAgo) {
      return res.status(400).json({ error: 'Délai d\'édition dépassé (10 minutes)' });
    }

    message.content = content.trim();
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('[AdminChat] Error editing message:', error);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

/**
 * DELETE /api/admin/chat/messages/:id
 * Supprimer un message (soft delete)
 */
router.delete('/messages/:id', async (req, res) => {
  try {
    const messageId = req.params.id;

    const message = await AdminMessage.findOne({
      _id: messageId,
      deleted: false
    });

    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }

    // Vérifier les permissions: son propre message OU super_admin
    if (message.senderId.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Non autorisé à supprimer ce message' });
    }

    await message.markDeleted(req.user._id);

    await logAdminAction(req, 'DELETE_CHAT_MESSAGE', `Message supprimé du canal ${message.channel}`, 'AdminMessage', 'success', messageId);

    res.json({
      success: true,
      message: 'Message supprimé'
    });
  } catch (error) {
    console.error('[AdminChat] Error deleting message:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

/**
 * GET /api/admin/chat/users
 * Liste des admins/modos en ligne/pour le chat
 */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({
      role: { $in: ['super_admin', 'admin', 'moderator'] }
    })
    .select('username email role avatar lastActive')
    .sort({ lastActive: -1 })
    .lean();

    // Déterminer qui est en ligne (5 dernières minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const formattedUsers = users.map(u => ({
      ...u,
      isOnline: u.lastActive && new Date(u.lastActive) > fiveMinutesAgo
    }));

    res.json({
      success: true,
      users: formattedUsers
    });
  } catch (error) {
    console.error('[AdminChat] Error fetching users:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

/**
 * POST /api/admin/chat/messages/:id/read
 * Marquer un message comme lu
 */
router.post('/messages/:id/read', async (req, res) => {
  try {
    await AdminMessage.markAsRead(req.params.id, req.user._id);
    res.json({ success: true });
  } catch (error) {
    console.error('[AdminChat] Error marking as read:', error);
    res.status(500).json({ error: 'Erreur' });
  }
});

module.exports = router;
