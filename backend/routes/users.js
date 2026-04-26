const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
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

// @route   POST /api/users/avatar
// @desc    Upload user avatar
// @access  Private
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image fournie' });
    }

    // Construire l'URL absolue complète (HTTPS sur Render)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host || req.get('host');
    const avatarUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar: avatarUrl },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
      message: 'Avatar mis à jour',
      avatar: avatarUrl
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Erreur lors du upload' });
  }
});

// @route   GET /api/users
// @desc    Search users by username
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    let query = { isPublic: true };
    if (q) {
      query.username = { $regex: q.toLowerCase(), $options: 'i' };
    }
    
    const users = await User.find(query)
      .select('username displayName avatar stats followers following isPublic allowCopyTrading')
      .limit(parseInt(limit));
    
    res.json({
      users: users.map(u => ({
        id: u._id,
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        stats: u.stats,
        winRate: u.winRate,
        followers: u.followerCount,
        allowCopyTrading: u.allowCopyTrading
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/users/online
// @desc    Get online users count
// @access  Public
router.get('/online', async (req, res) => {
  try {
    // Count users who are currently online (lastActive within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineCount = await User.countDocuments({
      lastActive: { $gte: fiveMinutesAgo }
    });
    
    res.json({ count: onlineCount || 1 }); // Return at least 1
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/users/:id/profile
// @desc    Get user profile by ID
// @access  Public (if profile is public)
router.get('/:id/profile', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const userId = req.params.id;

    console.log('[Users] Profile request for ID:', userId);

    // Vérifier si c'est un ObjectId valide
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log('[Users] Invalid ObjectId:', userId);
      return res.status(400).json({ error: 'ID utilisateur invalide' });
    }

    // Vérifier connexion MongoDB
    if (mongoose.connection.readyState !== 1) {
      console.log('[Users] MongoDB not connected, state:', mongoose.connection.readyState);
      return res.status(503).json({ error: 'Database not connected' });
    }

    const user = await User.findById(userId)
      .populate('followers', 'username displayName avatar')
      .populate('following', 'username displayName avatar');

    if (!user) {
      console.log('[Users] User not found:', userId);
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    console.log('[Users] User found:', user.username);

    if (!user.isPublic) {
      return res.status(403).json({ error: 'Profil privé' });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        stats: user.stats,
        winRate: user.winRate,
        followers: user.followerCount,
        following: user.followingCount,
        allowCopyTrading: user.allowCopyTrading,
        isOnline: user.isOnline,
        lastActive: user.lastActive
      }
    });
  } catch (error) {
    console.error('Get profile by ID error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/users/:username
// @desc    Get user profile by username
// @access  Public (if profile is public)
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() })
      .populate('followers', 'username displayName avatar')
      .populate('following', 'username displayName avatar');

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (!user.isPublic) {
      return res.status(403).json({ error: 'Profil privé' });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        stats: user.stats,
        winRate: user.winRate,
        followers: user.followerCount,
        following: user.followingCount,
        allowCopyTrading: user.allowCopyTrading,
        isOnline: user.isOnline,
        lastActive: user.lastActive
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update own profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const {
      displayName, bio, avatar, isPublic, allowCopyTrading, notifications,
      location, website, occupation, twitter, discord, telegram,
      preferences, phone
    } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Update fields
    if (displayName !== undefined) user.displayName = displayName;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;
    if (isPublic !== undefined) user.isPublic = isPublic;
    if (allowCopyTrading !== undefined) user.allowCopyTrading = allowCopyTrading;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;
    if (occupation !== undefined) user.occupation = occupation;
    if (twitter !== undefined) user.twitter = twitter;
    if (discord !== undefined) user.discord = discord;
    if (telegram !== undefined) user.telegram = telegram;
    if (phone !== undefined) user.phone = phone;
    if (notifications) user.notifications = { ...user.notifications, ...notifications };
    if (preferences) user.preferences = { ...user.preferences, ...preferences };
    
    await user.save();
    
    res.json({
      message: 'Profil mis à jour',
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        phone: user.phone,
        bio: user.bio,
        avatar: user.avatar,
        isPublic: user.isPublic,
        allowCopyTrading: user.allowCopyTrading,
        location: user.location,
        website: user.website,
        occupation: user.occupation,
        twitter: user.twitter,
        discord: user.discord,
        telegram: user.telegram
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/users/:id/follow
// @desc    Follow/unfollow a user
// @access  Private
router.post('/:id/follow', auth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const targetId = new mongoose.Types.ObjectId(req.params.id);
    const currentId = new mongoose.Types.ObjectId(req.userId);

    if (targetId.equals(currentId)) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous suivre vous-même' });
    }
    
    const userToFollow = await User.findById(targetId);
    if (!userToFollow) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const currentUser = await User.findById(currentId);
    
    // Check if already following
    const isFollowing = currentUser.following.some(id => id.equals(targetId));
    
    if (isFollowing) {
      // Unfollow
      currentUser.following.pull(targetId);
      userToFollow.followers.pull(currentId);
    } else {
      // Follow
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
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/users/:id/followers
// @desc    Get user's followers
// @access  Public (if profile is public)
router.get('/:id/followers', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('followers', 'username displayName avatar');
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    if (!user.isPublic) {
      return res.status(403).json({ error: 'Profil privé' });
    }
    
    res.json({
      followers: user.followers.map(f => ({
        id: f._id,
        username: f.username,
        displayName: f.displayName,
        avatar: f.avatar
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/users/:id/following
// @desc    Get who user is following
// @access  Public (if profile is public)
router.get('/:id/following', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('following', 'username displayName avatar');
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    if (!user.isPublic) {
      return res.status(403).json({ error: 'Profil privé' });
    }
    
    res.json({
      following: user.following.map(f => ({
        id: f._id,
        username: f.username,
        displayName: f.displayName,
        avatar: f.avatar
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/users/trade
// @desc    Record a trade (updates stats)
// @access  Private
router.post('/trade', auth, async (req, res) => {
  try {
    const { profit, volume } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    await user.updateStats({ profit: parseFloat(profit) || 0, volume: parseFloat(volume) || 0 });
    
    res.json({
      message: 'Trade enregistré',
      stats: user.stats,
      winRate: user.winRate
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
