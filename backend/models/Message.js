const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  username: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: null
  },
  content: {
    type: String,
    required: true,
    maxlength: 500
  },
  channelId: {
    type: String,
    default: 'general'
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  imageUrl: {
    type: String,
    default: null
  },
  voiceUrl: {
    type: String,
    default: null
  },
  voiceDuration: {
    type: Number,
    default: 0
  },
  reactions: [{
    emoji: String,
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  isSystemMessage: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for performance
MessageSchema.index({ createdAt: -1 });
MessageSchema.index({ user: 1 });

// Virtual for like count
MessageSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Method to check if user liked
MessageSchema.methods.isLikedBy = function(userId) {
  return this.likes.includes(userId);
};

// Method to toggle like (one per user)
MessageSchema.methods.toggleLike = async function(userId) {
  const index = this.likes.indexOf(userId);
  
  if (index === -1) {
    // User hasn't liked yet - add like
    this.likes.push(userId);
  } else {
    // User already liked - remove like
    this.likes.splice(index, 1);
  }
  
  await this.save();
  return index === -1; // Returns true if liked, false if unliked
};

module.exports = mongoose.model('Message', MessageSchema);
