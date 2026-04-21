const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Activity = require('../models/Activity');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId || decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Veuillez vous connecter' });
  }
};

// @route   GET /api/activity/recent
// @desc    Get recent user activity from database
// @access  Private
router.get('/recent', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const { type, days = 30 } = req.query;
    
    // Récupérer l'utilisateur pour avoir le username
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Date de début pour le filtre
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    
    // Build query
    const query = { 
      userId: req.userId,
      createdAt: { $gte: since }
    };
    if (type) query.type = type;
    
    // Récupérer les activités depuis MongoDB
    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    // Formater les résultats
    const formattedActivities = activities.map(a => ({
      id: a._id,
      type: a.type,
      description: a.description,
      level: a.level,
      metadata: a.metadata,
      createdAt: a.createdAt
    }));
    
    // Récupérer les statistiques
    const stats = await Activity.getStatsByUser(req.userId, parseInt(days));
    
    res.json({ 
      success: true, 
      activities: formattedActivities,
      count: formattedActivities.length,
      stats: stats.reduce((acc, stat) => {
        acc[stat._id] = { count: stat.count, lastActivity: stat.lastActivity };
        return acc;
      }, {}),
      filters: { days: parseInt(days), type: type || 'all' }
    });
  } catch (error) {
    console.error('Activity fetch error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/activity
// @desc    Log a new activity (internal use)
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { type, description, metadata = {}, level = 'info' } = req.body;
    
    // Validation
    if (!type || !description) {
      return res.status(400).json({ error: 'type et description requis' });
    }
    
    // Récupérer l'utilisateur
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Créer et sauvegarder l'activité
    const activity = new Activity({
      userId: req.userId,
      username: user.username,
      type,
      description,
      metadata,
      level,
      createdAt: new Date()
    });
    
    await activity.save();
    
    res.json({
      success: true,
      message: 'Activité enregistrée',
      activity: {
        id: activity._id,
        type: activity.type,
        description: activity.description,
        level: activity.level,
        metadata: activity.metadata,
        createdAt: activity.createdAt
      }
    });
  } catch (error) {
    console.error('Activity create error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/activity/stats
// @desc    Get activity statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const stats = await Activity.getStatsByUser(req.userId, parseInt(days));
    const totalCount = await Activity.countDocuments({ 
      userId: req.userId,
      createdAt: { $gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000) }
    });
    
    res.json({
      success: true,
      total: totalCount,
      byType: stats.reduce((acc, stat) => {
        acc[stat._id] = { count: stat.count, lastActivity: stat.lastActivity };
        return acc;
      }, {}),
      period: `${days} days`
    });
  } catch (error) {
    console.error('Activity stats error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
