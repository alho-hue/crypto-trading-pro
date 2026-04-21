const mongoose = require('mongoose');

const conversationMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  messages: [conversationMessageSchema],
  lastAccess: {
    type: Date,
    default: Date.now
  },
  // Informations extraites de la conversation
  importantInfo: {
    mentionedSymbols: [{
      type: String,
      uppercase: true
    }],
    mentionedStrategies: [{
      type: String
    }],
    userPreferences: {
      riskProfile: {
        type: String,
        enum: ['conservative', 'moderate', 'aggressive']
      },
      preferredSymbols: [{
        type: String,
        uppercase: true
      }]
    }
  }
}, {
  timestamps: true
});

// Limiter le nombre de messages conservés
conversationSchema.pre('save', function(next) {
  if (this.messages.length > 50) {
    this.messages = this.messages.slice(-50);
  }
  next();
});

// Méthode pour ajouter un message
conversationSchema.methods.addMessage = function(role, content) {
  this.messages.push({ role, content });
  this.lastAccess = new Date();
  return this.save();
};

// Méthode pour obtenir l'historique au format Groq
conversationSchema.methods.getGroqHistory = function() {
  return this.messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
};

// Méthode pour nettoyer les anciens messages (TTL)
conversationSchema.methods.cleanupOldMessages = function(ttl = 24 * 60 * 60 * 1000) {
  const now = Date.now();
  this.messages = this.messages.filter(msg => {
    return (now - msg.timestamp.getTime()) < ttl;
  });
  return this.save();
};

module.exports = mongoose.model('Conversation', conversationSchema);
