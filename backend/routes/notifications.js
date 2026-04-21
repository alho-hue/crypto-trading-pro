const express = require('express');
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');
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

// @route   GET /api/notifications
// @desc    Get user's notifications
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    
    const notifications = await Notification.find({ user: req.userId })
      .populate('fromUser', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const unreadCount = await Notification.countDocuments({ 
      user: req.userId, 
      isRead: false 
    });
    
    res.json({
      notifications: notifications.map(n => ({
        id: n._id,
        type: n.type,
        message: n.message,
        fromUser: n.fromUser,
        isRead: n.isRead,
        createdAt: n.createdAt
      })),
      unreadCount,
      total: await Notification.countDocuments({ user: req.userId })
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/notifications/mark-read
// @desc    Mark all notifications as read
// @access  Private
router.post('/mark-read', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.userId, isRead: false },
      { isRead: true }
    );
    
    res.json({ message: 'Notifications marquées comme lues' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.userId
    });
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }
    
    await notification.deleteOne();
    res.json({ message: 'Notification supprimée' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
