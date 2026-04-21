const mongoose = require('mongoose');

const tradeShareSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: ''
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  direction: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  },
  entryPrice: {
    type: Number,
    required: true
  },
  exitPrice: {
    type: Number,
    default: null
  },
  size: {
    type: Number,
    required: true
  },
  leverage: {
    type: Number,
    default: 1
  },
  pnl: {
    type: Number,
    default: 0
  },
  pnlPercent: {
    type: Number,
    default: 0
  },
  strategy: {
    type: String,
    default: ''
  },
  screenshot: {
    type: String,
    default: ''
  },
  analysis: {
    type: String,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  allowCopy: {
    type: Boolean,
    default: false
  },
  copyCount: {
    type: Number,
    default: 0
  },
  copiedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    copiedAt: {
      type: Date,
      default: Date.now
    },
    pnl: Number
  }],
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    avatar: String,
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open'
  },
  closedAt: {
    type: Date,
    default: null
  },
  channelId: {
    type: String,
    default: 'futures'
  }
}, {
  timestamps: true
});

// Indexes
tradeShareSchema.index({ user: 1, createdAt: -1 });
tradeShareSchema.index({ symbol: 1, status: 1 });
tradeShareSchema.index({ isPublic: 1, createdAt: -1 });

// Calculate P&L when trade is closed
tradeShareSchema.methods.closeTrade = async function(exitPrice) {
  this.exitPrice = exitPrice;
  this.status = 'closed';
  this.closedAt = new Date();
  
  // Calculate P&L
  const priceDiff = this.direction === 'buy' 
    ? exitPrice - this.entryPrice 
    : this.entryPrice - exitPrice;
  
  this.pnl = priceDiff * this.size * this.leverage;
  this.pnlPercent = (priceDiff / this.entryPrice) * 100 * this.leverage;
  
  await this.save();
  return this;
};

// Copy trade method
tradeShareSchema.methods.copyTrade = async function(userId, positionSize) {
  const alreadyCopied = this.copiedBy.find(c => c.user.toString() === userId.toString());
  if (alreadyCopied) {
    throw new Error('Trade already copied');
  }
  
  this.copiedBy.push({
    user: userId,
    copiedAt: new Date(),
    pnl: 0 // Will be updated when trade closes
  });
  this.copyCount++;
  
  await this.save();
  return this;
};

// Toggle like
tradeShareSchema.methods.toggleLike = async function(userId) {
  const index = this.likedBy.indexOf(userId);
  if (index === -1) {
    this.likedBy.push(userId);
    this.likes++;
  } else {
    this.likedBy.splice(index, 1);
    this.likes--;
  }
  await this.save();
  return { liked: index === -1, likes: this.likes };
};

// Add comment
tradeShareSchema.methods.addComment = async function(userId, username, avatar, content) {
  this.comments.push({
    user: userId,
    username,
    avatar,
    content,
    createdAt: new Date()
  });
  await this.save();
  return this.comments;
};

module.exports = mongoose.model('TradeShare', tradeShareSchema);
