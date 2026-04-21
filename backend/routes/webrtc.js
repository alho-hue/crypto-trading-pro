// WebRTC Signaling Routes for Voice Channels
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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

// Store active voice channels
const activeVoiceChannels = new Map(); // channel -> Set of userIds

// Join voice channel
router.post('/join', auth, (req, res) => {
  const { channel } = req.body;
  const userId = req.userId;
  
  if (!activeVoiceChannels.has(channel)) {
    activeVoiceChannels.set(channel, new Set());
  }
  
  activeVoiceChannels.get(channel).add(userId);
  
  // Notify others in channel
  const io = req.app.get('io');
  if (io) {
    io.to(`voice-${channel}`).emit('voice-user-joined', { userId });
  }
  
  res.json({ success: true, users: Array.from(activeVoiceChannels.get(channel)) });
});

// Leave voice channel
router.post('/leave', auth, (req, res) => {
  const { channel } = req.body;
  const userId = req.userId;
  
  if (activeVoiceChannels.has(channel)) {
    activeVoiceChannels.get(channel).delete(userId);
    
    // Notify others
    const io = req.app.get('io');
    if (io) {
      io.to(`voice-${channel}`).emit('voice-user-left', { userId });
    }
  }
  
  res.json({ success: true });
});

// Get active users in channel
router.get('/users/:channel', auth, (req, res) => {
  const { channel } = req.params;
  const users = activeVoiceChannels.has(channel) 
    ? Array.from(activeVoiceChannels.get(channel))
    : [];
  
  res.json({ users });
});

module.exports = router;
