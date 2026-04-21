const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  condition: {
    type: String,
    enum: ['above', 'below', 'crosses_up', 'crosses_down'],
    required: true
  },
  targetPrice: {
    type: Number,
    required: true
  },
  currentPrice: {
    type: Number,
    default: 0
  },
  notificationChannels: [{
    type: String,
    enum: ['push', 'email', 'telegram']
  }],
  active: {
    type: Boolean,
    default: true
  },
  triggered: {
    type: Boolean,
    default: false
  },
  triggeredAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index pour les requêtes fréquentes
alertSchema.index({ userId: 1, active: 1, triggered: 1 });
alertSchema.index({ symbol: 1, active: 1 });

module.exports = mongoose.model('Alert', alertSchema);
