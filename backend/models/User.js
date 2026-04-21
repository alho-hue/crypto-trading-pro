const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  // Authentication
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // Profile
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: 30
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 20,
    default: ''
  },
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: 200,
    default: ''
  },
  location: {
    type: String,
    maxlength: 100,
    default: ''
  },
  website: {
    type: String,
    maxlength: 200,
    default: ''
  },
  occupation: {
    type: String,
    maxlength: 100,
    default: ''
  },
  twitter: {
    type: String,
    maxlength: 50,
    default: ''
  },
  discord: {
    type: String,
    maxlength: 50,
    default: ''
  },
  telegram: {
    type: String,
    maxlength: 50,
    default: ''
  },
  preferences: {
    darkMode: { type: Boolean, default: true },
    language: { type: String, default: 'fr' },
    timezone: { type: String, default: 'Europe/Paris' },
    notifications: { type: Boolean, default: true },
    soundEffects: { type: Boolean, default: true }
  },
  
  // Trading Stats
  stats: {
    totalTrades: { type: Number, default: 0 },
    winningTrades: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 },
    totalVolume: { type: Number, default: 0 },
    bestTrade: { type: Number, default: 0 },
    worstTrade: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestWinStreak: { type: Number, default: 0 },
    tradeHistory: [{
      id: String,
      pair: String,
      type: { type: String, enum: ['buy', 'sell'] },
      amount: Number,
      price: Number,
      volume: Number,
      profit: Number,
      notes: String,
      status: { type: String, enum: ['open', 'closed', 'cancelled'], default: 'closed' },
      createdAt: { type: Date, default: Date.now },
      closedAt: Date
    }]
  },

  // Wallet
  wallet: {
    balance: { type: Number, default: 0 },
    available: { type: Number, default: 0 },
    locked: { type: Number, default: 0 },
    totalDeposits: { type: Number, default: 0 },
    totalWithdrawals: { type: Number, default: 0 }
  },

  // Transactions
  transactions: [{
    id: String,
    type: { type: String, enum: ['deposit', 'withdrawal', 'trade', 'fee', 'bonus'] },
    amount: Number,
    fee: { type: Number, default: 0 },
    method: String,
    txId: String,
    address: String,
    status: { type: String, enum: ['pending', 'completed', 'failed', 'cancelled'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Social
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  reputation: {
    type: Number,
    default: 0,
    min: 0,
    max: 1000
  },
  status: {
    type: String,
    enum: ['online', 'away', 'dnd', 'offline'],
    default: 'offline'
  },
  
  // Settings
  isPublic: {
    type: Boolean,
    default: true
  },
  allowCopyTrading: {
    type: Boolean,
    default: false
  },
  notifications: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    trades: { type: Boolean, default: true },
    mentions: { type: Boolean, default: true }
  },
  
  // Status
  isOnline: {
    type: Boolean,
    default: false
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  
  // Admin Role System (remplace isAdmin)
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'moderator', 'user'],
    default: 'user'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  // Pour compatibilité - déprécié
  isAdmin: {
    type: Boolean,
    default: false
  },

  // Ban
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: {
    type: String,
    default: null
  },
  bannedAt: {
    type: Date,
    default: null
  },
  banDuration: {
    type: String,
    default: null
  },

  // Security
  isVerified: {
    type: Boolean,
    default: false
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  
  // 2FA (TOTP)
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  twoFactorTempSecret: {
    type: String,
    select: false
  },
  
  // Encrypted API Keys
  encryptedApiKeys: {
    binanceApiKey: {
      type: String,
      select: false
    },
    binanceSecretKey: {
      type: String,
      select: false
    },
    lastRotatedAt: {
      type: Date
    }
  },
  
  // IP Whitelist
  allowedIPs: [{
    type: String
  }],
  ipWhitelistEnabled: {
    type: Boolean,
    default: false
  },
  
  // Security Settings
  passwordChangedAt: {
    type: Date,
    default: Date.now
  },
  securityNotifications: {
    type: Boolean,
    default: true
  },
  loginNotifications: {
    type: Boolean,
    default: true
  },
  tradingNotifications: {
    type: Boolean,
    default: true
  },
  
  // Session Management
  activeSessions: [{
    sessionId: String,
    device: String,
    ip: String,
    location: String,
    createdAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now }
  }],
  
  // Rate Limiting Tier
  rateLimitTier: {
    type: String,
    enum: ['basic', 'pro', 'enterprise'],
    default: 'basic'
  },
  
  // User Settings
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      theme: 'dark',
      language: 'fr',
      notifications: {
        trades: true,
        alerts: true,
        signals: true,
        marketing: false,
        security: true
      },
      trading: {
        realTradingEnabled: false,
        aiEnabled: false,
        aiAggressiveness: 50,
        aiScoreThreshold: 70,
        botEnabled: false,
        botMode: 'SAFE',
        botRiskPerTrade: 2,
        autoRefresh: true
      }
    }
  }
}, {
  timestamps: true
});

// Indexes
UserSchema.index({ 'stats.totalProfit': -1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update stats method
UserSchema.methods.updateStats = async function(tradeResult) {
  this.stats.totalTrades += 1;
  
  if (tradeResult.profit > 0) {
    this.stats.winningTrades += 1;
    this.stats.currentStreak = this.stats.currentStreak > 0 ? this.stats.currentStreak + 1 : 1;
    if (this.stats.currentStreak > this.stats.longestWinStreak) {
      this.stats.longestWinStreak = this.stats.currentStreak;
    }
    if (tradeResult.profit > this.stats.bestTrade) {
      this.stats.bestTrade = tradeResult.profit;
    }
  } else {
    this.stats.currentStreak = 0;
    if (tradeResult.profit < this.stats.worstTrade) {
      this.stats.worstTrade = tradeResult.profit;
    }
  }
  
  this.stats.totalProfit += tradeResult.profit;
  this.stats.totalVolume += tradeResult.volume;
  
  await this.save();
};

// Virtual for win rate
UserSchema.virtual('winRate').get(function() {
  if (this.stats.totalTrades === 0) return 0;
  return ((this.stats.winningTrades / this.stats.totalTrades) * 100).toFixed(1);
});

// Virtual for follower count
UserSchema.virtual('followerCount').get(function() {
  return this.followers.length;
});

UserSchema.virtual('followingCount').get(function() {
  return this.following.length;
});

// Hide sensitive data
UserSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.loginAttempts;
    delete ret.lockUntil;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema);
