const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AdminMessage = require('../models/AdminMessage');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * 📡 Service Socket.IO Admin - Temps réel pour le panel admin
 * 💬 Chat temps réel entre admins/modérateurs
 */
class AdminSocketIOService {
  constructor() {
    this.io = null;
    this.adminNamespace = null;
    this.connectedAdmins = new Map(); // Map<socketId, {userId, email, role}>
  }

  /**
   * Initialiser le service avec l'instance Socket.IO
   */
  initialize(io) {
    this.io = io;
    
    // Créer un namespace dédié pour l'admin
    this.adminNamespace = io.of('/admin');
    
    this.adminNamespace.use(async (socket, next) => {
      try {
        // Authentification via token
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Token required'));
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).select('role email username');

        if (!user || !['super_admin', 'admin', 'moderator'].includes(user.role)) {
          return next(new Error('Admin access required'));
        }

        // Attacher les infos utilisateur au socket
        socket.userId = user._id.toString();
        socket.userEmail = user.email;
        socket.userRole = user.role;
        socket.username = user.username || user.email;
        
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    this.adminNamespace.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('✅ [AdminSocketIO] Service initialisé sur /admin');
  }

  /**
   * Gérer une nouvelle connexion admin
   */
  handleConnection(socket) {
    const { userId, userEmail, userRole, username } = socket;
    
    this.connectedAdmins.set(socket.id, {
      userId,
      email: userEmail,
      role: userRole,
      username,
      socketId: socket.id
    });

    console.log(`✅ [AdminSocketIO] Admin connecté: ${userEmail} (${userRole})`);

    // Envoyer message de bienvenue
    socket.emit('connection', {
      status: 'connected',
      admin: {
        email: userEmail,
        role: userRole,
        username
      },
      timestamp: new Date()
    });

    // Rejoindre les rooms selon le rôle
    socket.join('all_admins');
    if (userRole === 'super_admin') {
      socket.join('super_admins_only');
    }
    if (['super_admin', 'admin', 'moderator'].includes(userRole)) {
      socket.join('mods_only');
    }

    // Notifier les autres admins de la connexion
    socket.to('all_admins').emit('admin-connected', {
      email: userEmail,
      role: userRole,
      username,
      timestamp: new Date()
    });

    // Gérer les événements
    this.setupEventHandlers(socket);

    // Gérer la déconnexion
    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  /**
   * Configurer les gestionnaires d'événements
   */
  setupEventHandlers(socket) {
    // Demande d'historique
    socket.on('get-chat-history', async ({ channel = 'all_admins' }, callback) => {
      try {
        // Vérifier les permissions
        if (channel === 'super_admins_only' && socket.userRole !== 'super_admin') {
          return callback?.({ error: 'Access denied' });
        }

        const messages = await AdminMessage.getRecentMessages(channel, 50);
        callback?.({ messages });
      } catch (error) {
        console.error('[AdminSocketIO] Get history error:', error);
        callback?.({ error: 'Failed to fetch messages' });
      }
    });

    // Nouveau message
    socket.on('chat-message', async (data, callback) => {
      try {
        const { content, channel = 'all_admins', type = 'text', replyTo } = data;

        // Vérifier les permissions
        if (channel === 'super_admins_only' && socket.userRole !== 'super_admin') {
          return callback?.({ error: 'Access denied' });
        }

        // Sauvegarder en base
        const recipients = await this.getChatRecipients(channel, socket.userId);
        
        const message = new AdminMessage({
          senderId: socket.userId,
          senderUsername: socket.username,
          senderRole: socket.userRole,
          content: content.trim(),
          type,
          channel,
          replyTo: replyTo || undefined,
          recipients: recipients.map(r => ({ userId: r.userId, read: false }))
        });

        await message.save();

        const messageData = {
          id: message._id.toString(),
          senderId: socket.userId,
          senderUsername: socket.username,
          senderRole: socket.userRole,
          content: content.trim(),
          channel,
          type,
          replyTo: replyTo || undefined,
          createdAt: message.createdAt
        };

        // Diffuser à tous les membres du canal
        this.adminNamespace.to(channel).emit('new-chat-message', { message: messageData });

        callback?.({ success: true, messageId: message._id.toString() });
      } catch (error) {
        console.error('[AdminSocketIO] Chat message error:', error);
        callback?.({ error: 'Failed to send message' });
      }
    });

    // Indicateur de frappe
    socket.on('typing', ({ channel, isTyping }) => {
      socket.to(channel).emit('chat-typing', {
        userId: socket.userId,
        username: socket.username,
        role: socket.userRole,
        channel,
        isTyping,
        timestamp: new Date()
      });
    });

    // Marquer comme lu
    socket.on('mark-read', async ({ messageId }) => {
      try {
        await AdminMessage.markAsRead(messageId, socket.userId);
        
        // Notifier l'expéditeur original
        this.adminNamespace.emit('message-read', {
          messageId,
          userId: socket.userId,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('[AdminSocketIO] Mark read error:', error);
      }
    });

    // Ping/Pong pour garder la connexion vivante
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    // Get online users
    socket.on('get-online-users', (callback) => {
      const users = Array.from(this.connectedAdmins.values()).map(admin => ({
        userId: admin.userId,
        email: admin.email,
        role: admin.role,
        username: admin.username,
        isOnline: true
      }));
      callback?.({ users });
    });
  }

  /**
   * Gérer la déconnexion
   */
  handleDisconnect(socket) {
    const admin = this.connectedAdmins.get(socket.id);
    if (admin) {
      console.log(`📡 [AdminSocketIO] Admin déconnecté: ${admin.email}`);
      this.connectedAdmins.delete(socket.id);
      
      // Notifier les autres
      socket.to('all_admins').emit('admin-disconnected', {
        email: admin.email,
        role: admin.role,
        timestamp: new Date()
      });
    }
  }

  /**
   * Récupérer les destinataires d'un canal
   */
  async getChatRecipients(channel, excludeUserId) {
    let roles;
    switch (channel) {
      case 'super_admins_only':
        roles = ['super_admin'];
        break;
      case 'mods_only':
        roles = ['super_admin', 'admin', 'moderator'];
        break;
      case 'all_admins':
      default:
        roles = ['super_admin', 'admin', 'moderator'];
    }

    const users = await User.find({
      role: { $in: roles },
      _id: { $ne: excludeUserId }
    }).select('_id').lean();

    return users.map(u => ({ userId: u._id.toString() }));
  }

  /**
   * Diffuser un événement à tous les admins
   */
  broadcast(event, data, filter = null) {
    if (!this.adminNamespace) return;
    
    this.connectedAdmins.forEach((admin, socketId) => {
      if (filter && !filter(admin)) return;
      this.adminNamespace.to(socketId).emit(event, data);
    });
  }

  /**
   * Notifier d'un nouvel événement
   */
  notifyEvent(eventType, data, severity = 'info') {
    const message = {
      type: 'event',
      eventType,
      severity,
      timestamp: new Date(),
      data
    };

    this.broadcast('admin-event', message, (client) => {
      if (client.role === 'super_admin') return true;
      if (client.role === 'admin' && ['medium', 'high', 'critical'].includes(severity)) return true;
      if (client.role === 'moderator' && ['high', 'critical'].includes(severity)) return true;
      return false;
    });
  }

  /**
   * Notifier d'un nouveau signalement
   */
  notifyReport(reportData) {
    this.broadcast('new-report', {
      type: 'new_report',
      timestamp: new Date(),
      data: reportData
    }, (client) => ['super_admin', 'admin', 'moderator'].includes(client.role));
  }

  /**
   * Obtenir les stats de connexion
   */
  getConnectionStats() {
    const stats = {
      total: this.connectedAdmins.size,
      byRole: {}
    };

    this.connectedAdmins.forEach((admin) => {
      const role = admin.role;
      stats.byRole[role] = (stats.byRole[role] || 0) + 1;
    });

    return stats;
  }

  /**
   * Émettre à un canal spécifique
   */
  emitToChannel(channel, event, data) {
    if (this.adminNamespace) {
      this.adminNamespace.to(channel).emit(event, data);
    }
  }
}

// Singleton
module.exports = new AdminSocketIOService();
