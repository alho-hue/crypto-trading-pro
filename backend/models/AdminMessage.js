const mongoose = require('mongoose');

/**
 * 💬 Modèle AdminMessage - Chat privé entre admins/modérateurs
 * Communication sécurisée et loguée
 */
const adminMessageSchema = new mongoose.Schema({
  // Expéditeur
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  senderUsername: {
    type: String,
    required: true
  },
  senderRole: {
    type: String,
    enum: ['super_admin', 'admin', 'moderator'],
    required: true
  },

  // Contenu
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  type: {
    type: String,
    enum: ['text', 'announcement', 'alert', 'system'],
    default: 'text'
  },

  // Canal/Destinataires
  channel: {
    type: String,
    enum: ['all_admins', 'super_admins_only', 'mods_only', 'direct'],
    default: 'all_admins'
  },
  recipients: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    read: {
      type: Boolean,
      default: false
    },
    readAt: {
      type: Date
    }
  }],

  // Référence (optionnel - pour répondre à un message)
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminMessage'
  },
  replyToContent: {
    type: String
  },

  // Métadonnées
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'file', 'link']
    },
    url: String,
    name: String,
    size: Number
  }],

  // Statut
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index pour requêtes rapides
adminMessageSchema.index({ channel: 1, createdAt: -1 });
adminMessageSchema.index({ senderId: 1, createdAt: -1 });
adminMessageSchema.index({ 'recipients.userId': 1, 'recipients.read': 1 });

// Méthodes statiques
adminMessageSchema.statics.getUnreadCount = async function(userId, role) {
  const query = {
    'recipients.userId': userId,
    'recipients.read': false,
    deleted: false
  };

  // Super admins voient tout
  if (role !== 'super_admin') {
    query.channel = { $in: ['all_admins', 'mods_only'] };
  }

  return this.countDocuments(query);
};

adminMessageSchema.statics.getRecentMessages = async function(channel, limit = 50) {
  return this.find({ channel, deleted: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('senderId', 'username avatar')
    .lean();
};

adminMessageSchema.statics.markAsRead = async function(messageId, userId) {
  return this.updateOne(
    { _id: messageId, 'recipients.userId': userId },
    { $set: { 'recipients.$.read': true, 'recipients.$.readAt': new Date() } }
  );
};

// Méthode d'instance
adminMessageSchema.methods.markDeleted = async function(userId) {
  this.deleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

module.exports = mongoose.model('AdminMessage', adminMessageSchema);
