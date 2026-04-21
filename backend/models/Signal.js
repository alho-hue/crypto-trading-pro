const mongoose = require('mongoose');

const signalSchema = new mongoose.Schema({
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
  stopLoss: {
    type: Number,
    required: true
  },
  takeProfit: {
    type: Number,
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  analysis: {
    type: String,
    default: ''
  },
  timeframe: {
    type: String,
    enum: ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'],
    default: '1h'
  },
  screenshot: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'hit_target', 'hit_stop', 'cancelled'],
    default: 'active'
  },
  aiValidation: {
    isValid: {
      type: Boolean,
      default: false
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    warnings: [{
      type: String
    }]
  },
  votes: {
    bullish: {
      type: Number,
      default: 0
    },
    bearish: {
      type: Number,
      default: 0
    },
    voters: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      vote: {
        type: String,
        enum: ['bullish', 'bearish']
      }
    }]
  },
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
  result: {
    exitPrice: Number,
    pnl: Number,
    pnlPercent: Number,
    exitDate: Date
  },
  channelId: {
    type: String,
    default: 'signals'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Default expiry: 7 days from creation
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
signalSchema.index({ user: 1, createdAt: -1 });
signalSchema.index({ symbol: 1, status: 1 });
signalSchema.index({ status: 1, createdAt: -1 });
signalSchema.index({ channelId: 1, createdAt: -1 });

// Method to calculate risk/reward ratio
signalSchema.methods.calculateRiskReward = function() {
  const risk = Math.abs(this.entryPrice - this.stopLoss);
  const reward = Math.abs(this.takeProfit - this.entryPrice);
  return risk > 0 ? (reward / risk).toFixed(2) : 0;
};

// Method to check if signal has expired
signalSchema.methods.checkExpiry = function() {
  if (this.status === 'active' && new Date() > this.expiresAt) {
    this.status = 'expired';
    return true;
  }
  return false;
};

// Method to add vote
signalSchema.methods.addVote = async function(userId, voteType) {
  const existingVote = this.votes.voters.find(v => v.user.toString() === userId.toString());
  
  if (existingVote) {
    // Change vote
    if (existingVote.vote === voteType) {
      // Remove vote if same
      this.votes.voters = this.votes.voters.filter(v => v.user.toString() !== userId.toString());
      this.votes[existingVote.vote]--;
    } else {
      // Switch vote
      this.votes[existingVote.vote]--;
      this.votes[voteType]++;
      existingVote.vote = voteType;
    }
  } else {
    // New vote
    this.votes.voters.push({ user: userId, vote: voteType });
    this.votes[voteType]++;
  }
  
  await this.save();
  return this.votes;
};

// Method to toggle like
signalSchema.methods.toggleLike = async function(userId) {
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

// Static method to update signal statuses based on market price
signalSchema.statics.updateSignalStatuses = async function(symbol, currentPrice) {
  const signals = await this.find({ 
    symbol: symbol.toUpperCase(), 
    status: 'active' 
  });
  
  const updates = [];
  
  for (const signal of signals) {
    let newStatus = null;
    
    if (signal.direction === 'buy') {
      if (currentPrice >= signal.takeProfit) {
        newStatus = 'hit_target';
      } else if (currentPrice <= signal.stopLoss) {
        newStatus = 'hit_stop';
      }
    } else {
      if (currentPrice <= signal.takeProfit) {
        newStatus = 'hit_target';
      } else if (currentPrice >= signal.stopLoss) {
        newStatus = 'hit_stop';
      }
    }
    
    if (newStatus) {
      signal.status = newStatus;
      signal.result = {
        exitPrice: currentPrice,
        pnl: signal.direction === 'buy' 
          ? (currentPrice - signal.entryPrice) 
          : (signal.entryPrice - currentPrice),
        pnlPercent: ((currentPrice - signal.entryPrice) / signal.entryPrice * 100),
        exitDate: new Date()
      };
      await signal.save();
      updates.push(signal);
    }
  }
  
  return updates;
};

module.exports = mongoose.model('Signal', signalSchema);
