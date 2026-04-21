const express = require('express');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const ethernalAI = require('../services/ethernalAI');
const upload = require('../config/multer');
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

// @route   GET /api/chat/messages
// @desc    Get recent messages for a channel
// @access  Public
router.get('/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;
    const channelId = req.query.channel || 'general';
    
    const messages = await Message.find({ isDeleted: false, channelId })
      .populate('user', 'username displayName avatar')
      .populate('replyTo', 'content username')
      .sort({ createdAt: 1 }) // Ascending order like Discord (oldest first, newest at bottom)
      .limit(limit)
      .skip(skip);
    
    res.json({
      messages: messages.map(msg => ({
        id: msg._id,
        userId: msg.user?._id,
        username: msg.username,
        displayName: msg.user?.displayName,
        avatar: msg.avatar,
        content: msg.content,
        channelId: msg.channelId,
        likes: msg.likeCount,
        timestamp: msg.createdAt,
        replyTo: msg.replyTo
      })),
      total: await Message.countDocuments({ isDeleted: false, channelId })
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/chat/messages
// @desc    Send a message
// @access  Private
router.post('/messages', auth, async (req, res) => {
  try {
    const { content, replyTo, channelId } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message vide' });
    }
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const message = new Message({
      user: req.userId,
      username: user.username,
      avatar: user.avatar,
      content: content.trim(),
      channelId: channelId || 'general',
      replyTo: replyTo || null
    });
    
    await message.save();
    await message.populate('user', 'username displayName avatar');
    
    // Emit to all connected clients via socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`chat-${message.channelId}`).emit('new-message', {
        id: message._id,
        userId: message.user?._id,
        username: message.username,
        displayName: message.user?.displayName,
        avatar: message.avatar,
        content: message.content,
        channelId: message.channelId,
        likes: 0,
        timestamp: message.createdAt
      });
      
      // Check if someone mentioned Ethernal AI (in any channel)
      if (ethernalAI.isMentioningEthernal(content)) {
        // Generate AI response (async with Groq API)
        const aiResponse = await ethernalAI.generateResponse(content, user.username);
        
        // Create AI message
        const aiMessage = new Message({
          user: null, // AI has no user
          username: ethernalAI.ETHERNAL_NAME,
          avatar: ethernalAI.ETHERNAL_AVATAR,
          content: aiResponse,
          channelId: channelId || 'general',
          isSystemMessage: true
        });
        
        await aiMessage.save();
        
        // Emit AI response
        io.to(`chat-${channelId}`).emit('new-message', {
          id: aiMessage._id,
          userId: null,
          username: ethernalAI.ETHERNAL_NAME,
          displayName: ethernalAI.ETHERNAL_NAME,
          avatar: ethernalAI.ETHERNAL_AVATAR,
          content: aiResponse,
          channelId: channelId || 'general',
          likes: 0,
          timestamp: aiMessage.createdAt,
          isSystemMessage: true
        });
      }
    }
    
    res.status(201).json({
      message: 'Message envoyé',
      data: {
        id: message._id,
        username: message.username,
        content: message.content,
        timestamp: message.createdAt
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/chat/messages/:id/like
// @desc    Toggle like on message (one per user)
// @access  Private
router.post('/messages/:id/like', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }
    
    if (message.isDeleted) {
      return res.status(400).json({ error: 'Message supprimé' });
    }
    
    // Toggle like - one per user
    const isLiked = await message.toggleLike(req.userId);
    
    // Notify via socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`chat-${message.channelId || 'general'}`).emit('message-liked', {
        messageId: message._id,
        likes: message.likeCount,
        userId: req.userId,
        isLiked
      });
    }
    
    res.json({
      liked: isLiked,
      likes: message.likeCount
    });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   DELETE /api/chat/messages/:id
// @desc    Delete own message
// @access  Private
router.delete('/messages/:id', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }
    
    // Check if user owns the message
    if (message.user.toString() !== req.userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    message.isDeleted = true;
    message.content = '[Message supprimé]';
    await message.save();
    
    // Notify via socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`chat-${message.channelId || 'general'}`).emit('message-deleted', {
        messageId: message._id
      });
    }
    
    res.json({ message: 'Message supprimé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/chat/online-users
// @desc    Get online users count
// @access  Public
router.get('/online-users', async (req, res) => {
  try {
    const count = await User.countDocuments({ isOnline: true });
    const total = await User.countDocuments();
    
    res.json({
      online: count,
      total: total
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/chat/help-welcome
// @desc    Get Ethernal welcome message for help channel
// @access  Public
router.get('/help-welcome', (req, res) => {
  res.json({
    welcomeMessage: ethernalAI.getWelcomeMessage()
  });
});

// @route   POST /api/chat/upload
// @desc    Upload an image for chat
// @access  Private
router.post('/upload', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image uploadée' });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    
    res.json({
      success: true,
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

module.exports = router;
