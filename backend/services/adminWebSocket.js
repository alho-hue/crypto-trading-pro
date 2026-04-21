const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AdminMessage = require('../models/AdminMessage');
const WebSocket = require('ws');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * 📡 Service WebSocket Admin - Temps réel pour le panel admin
 * Envoie les mises à jour live: trades, paiements, connexions, erreurs
 * 💬 Chat temps réel entre admins/modérateurs
 */
class AdminWebSocketService {
  constructor() {
    this.clients = new Map(); // Map<ws, {userId, role, subscriptions}>
    this.broadcastInterval = null;
    this.messageHistory = new Map(); // Cache des messages récents par canal
  }

  /**
   * Initialiser le WebSocket server
   */
  initialize(wss) {
    this.wss = wss;
    
    wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Démarrer les broadcasts périodiques
    this.startPeriodicBroadcasts();

    console.log('✅ [AdminWebSocket] Service initialisé');
  }

  /**
   * Gérer une nouvelle connexion
   */
  async handleConnection(ws, req) {
    try {
      // Vérifier le token depuis l'URL query
      const url = new URL(req.url, 'ws://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        ws.close(1008, 'Token required');
        return;
      }

      // Vérifier le JWT
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id).select('role email username');

      if (!user || !['super_admin', 'admin', 'moderator'].includes(user.role)) {
        ws.close(1008, 'Admin access required');
        return;
      }

      // Stocker le client
      this.clients.set(ws, {
        userId: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        subscriptions: new Set(['overview', 'system']),
        connectedAt: new Date()
      });

      console.log(`✅ [AdminWebSocket] Admin connecté: ${user.email} (${user.role})`);

      // Envoyer message de bienvenue
      this.sendToClient(ws, {
        type: 'connection',
        data: {
          status: 'connected',
          admin: {
            email: user.email,
            role: user.role
          },
          timestamp: new Date()
        }
      });

      // Gérer les messages entrants
      ws.on('message', (data) => this.handleMessage(ws, data));

      // Gérer la déconnexion
      ws.on('close', () => this.handleDisconnect(ws));

      // Gérer les erreurs
      ws.on('error', (error) => {
        console.error('[AdminWebSocket] Error:', error);
      });

    } catch (error) {
      console.error('[AdminWebSocket] Connection error:', error);
      ws.close(1008, 'Invalid token');
    }
  }

  /**
   * Gérer les messages du client
   */
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      const client = this.clients.get(ws);

      if (!client) return;

      switch (message.type) {
        case 'subscribe':
          // S'abonner à des canaux spécifiques
          if (message.channels) {
            message.channels.forEach(channel => client.subscriptions.add(channel));
          }
          break;

        case 'unsubscribe':
          // Se désabonner
          if (message.channels) {
            message.channels.forEach(channel => client.subscriptions.delete(channel));
          }
          break;

        case 'ping':
          // Répondre au ping
          this.sendToClient(ws, { type: 'pong', timestamp: new Date() });
          break;

        case 'get_stats':
          // Demande explicite de stats
          this.sendImmediateStats(ws, client);
          break;

        case 'chat_message':
          // Nouveau message de chat
          this.handleChatMessage(ws, client, message);
          break;

        case 'chat_typing':
          // Indicateur de frappe
          this.broadcastTypingIndicator(client, message);
          break;

        case 'chat_read':
          // Marquer comme lu
          this.markMessageAsRead(message.messageId, client.userId);
          break;

        case 'chat_history':
          // Demande d'historique
          this.sendChatHistory(ws, client, message.channel);
          break;

        default:
          console.log('[AdminWebSocket] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[AdminWebSocket] Message handling error:', error);
    }
  }

  /**
   * Gérer la déconnexion
   */
  handleDisconnect(ws) {
    const client = this.clients.get(ws);
    if (client) {
      console.log(`📡 [AdminWebSocket] Admin déconnecté: ${client.email}`);
      this.clients.delete(ws);
    }
  }

  /**
   * Envoyer un message à un client spécifique
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast à tous les admins connectés
   */
  broadcast(message, filter = null) {
    this.clients.forEach((client, ws) => {
      if (filter && !filter(client)) return;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Broadcast aux abonnés d'un canal spécifique
   */
  broadcastToChannel(channel, message) {
    this.clients.forEach((client, ws) => {
      if (client.subscriptions.has(channel) && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Démarrer les broadcasts périodiques
   */
  startPeriodicBroadcasts() {
    // Stats système toutes les 5 secondes
    this.broadcastInterval = setInterval(() => {
      this.broadcastSystemStats();
    }, 5000);
  }

  /**
   * Arrêter les broadcasts
   */
  stop() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
  }

  /**
   * Envoyer les stats système
   */
  async broadcastSystemStats() {
    try {
      const stats = {
        type: 'system_stats',
        timestamp: new Date(),
        data: {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          activeConnections: this.clients.size
        }
      };

      this.broadcastToChannel('system', stats);
    } catch (error) {
      console.error('[AdminWebSocket] Error broadcasting system stats:', error);
    }
  }

  /**
   * Envoyer stats immédiates à un client
   */
  async sendImmediateStats(ws, client) {
    try {
      // Compter utilisateurs en ligne
      const onlineUsers = await User.countDocuments({
        lastActive: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
      });

      const stats = {
        type: 'immediate_stats',
        data: {
          onlineUsers,
          adminConnections: this.clients.size,
          yourRole: client.role
        }
      };

      this.sendToClient(ws, stats);
    } catch (error) {
      console.error('[AdminWebSocket] Error sending immediate stats:', error);
    }
  }

  /**
   * Notifier d'un nouvel événement important
   */
  notifyEvent(eventType, data, severity = 'info') {
    const message = {
      type: 'event',
      eventType,
      severity,
      timestamp: new Date(),
      data
    };

    // Tous les super_admin reçoivent tous les événements
    // Les admin reçoivent seulement medium+
    // Les moderator reçoivent seulement high+
    this.broadcast(message, (client) => {
      if (client.role === 'super_admin') return true;
      if (client.role === 'admin' && ['medium', 'high', 'critical'].includes(severity)) return true;
      if (client.role === 'moderator' && ['high', 'critical'].includes(severity)) return true;
      return false;
    });
  }

  /**
   * Notifier d'un nouveau trade
   */
  notifyTrade(tradeData) {
    this.broadcastToChannel('trades', {
      type: 'new_trade',
      timestamp: new Date(),
      data: tradeData
    });
  }

  /**
   * Notifier d'une nouvelle transaction (dépôt/retrait)
   */
  notifyTransaction(txData) {
    this.broadcastToChannel('economy', {
      type: 'new_transaction',
      timestamp: new Date(),
      data: txData
    });
  }

  /**
   * Notifier d'une erreur système
   */
  notifyError(errorData) {
    this.notifyEvent('system_error', errorData, 'high');
  }

  /**
   * Notifier d'une nouvelle inscription
   */
  notifyNewUser(userData) {
    this.broadcastToChannel('overview', {
      type: 'new_user',
      timestamp: new Date(),
      data: userData
    });
  }

  /**
   * Notifier d'un signalement
   */
  notifyReport(reportData) {
    this.notifyEvent('new_report', reportData, 'medium');
  }

  /**
   * Obtenir les stats de connexion
   */
  getConnectionStats() {
    const stats = {
      total: this.clients.size,
      byRole: {}
    };

    this.clients.forEach((client) => {
      const role = client.role;
      stats.byRole[role] = (stats.byRole[role] || 0) + 1;
    });

    return stats;
  }

  // ============================================
  // 💬 MÉTHODES DE CHAT TEMPS RÉEL
  // ============================================

  /**
   * Gérer un nouveau message de chat
   */
  async handleChatMessage(ws, client, messageData) {
    try {
      const { content, channel = 'all_admins', type = 'text', replyTo } = messageData;

      // Vérifier les permissions de canal
      if (channel === 'super_admins_only' && client.role !== 'super_admin') {
        this.sendToClient(ws, {
          type: 'chat_error',
          error: 'Accès réservé aux super admins'
        });
        return;
      }

      // Sauvegarder en base de données
      const recipients = await this.getChatRecipients(channel, client.userId);
      
      const message = new AdminMessage({
        senderId: client.userId,
        senderUsername: client.email,
        senderRole: client.role,
        content: content.trim(),
        type,
        channel,
        replyTo: replyTo || undefined,
        recipients: recipients.map(r => ({ userId: r.userId, read: false }))
      });

      await message.save();

      // Notifier tous les destinataires connectés
      const chatMessage = {
        type: 'new_chat_message',
        message: {
          id: message._id,
          senderId: client.userId,
          senderUsername: client.email,
          senderRole: client.role,
          content: content.trim(),
          channel,
          type,
          replyTo: replyTo || undefined,
          createdAt: message.createdAt
        }
      };

      this.broadcastChatMessage(chatMessage, channel);

      // Confirmation à l'expéditeur
      this.sendToClient(ws, {
        type: 'chat_message_sent',
        messageId: message._id
      });

    } catch (error) {
      console.error('[AdminWebSocket] Chat message error:', error);
      this.sendToClient(ws, {
        type: 'chat_error',
        error: 'Erreur lors de l\'envoi du message'
      });
    }
  }

  /**
   * Récupérer les destinataires d'un canal de chat
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

    return users.map(u => ({ userId: u._id }));
  }

  /**
   * Diffuser un message de chat
   */
  broadcastChatMessage(message, channel) {
    this.clients.forEach((client, ws) => {
      // Vérifier les permissions de canal
      if (channel === 'super_admins_only' && client.role !== 'super_admin') return;
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Diffuser l'indicateur de frappe
   */
  broadcastTypingIndicator(client, data) {
    const typingMessage = {
      type: 'chat_typing',
      userId: client.userId,
      username: client.email,
      role: client.role,
      channel: data.channel,
      isTyping: data.isTyping,
      timestamp: new Date()
    };

    this.clients.forEach((c, ws) => {
      // Ne pas renvoyer à l'expéditeur
      if (c.userId === client.userId) return;
      
      // Vérifier les permissions de canal
      if (data.channel === 'super_admins_only' && c.role !== 'super_admin') return;
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(typingMessage));
      }
    });
  }

  /**
   * Marquer un message comme lu
   */
  async markMessageAsRead(messageId, userId) {
    try {
      await AdminMessage.markAsRead(messageId, userId);
      
      // Informer les autres que le message a été lu
      this.broadcast({
        type: 'chat_message_read',
        messageId,
        userId,
        timestamp: new Date()
      }, (client) => client.userId !== userId);
    } catch (error) {
      console.error('[AdminWebSocket] Mark as read error:', error);
    }
  }

  /**
   * Envoyer l'historique des messages
   */
  async sendChatHistory(ws, client, channel) {
    try {
      // Vérifier les permissions
      if (channel === 'super_admins_only' && client.role !== 'super_admin') {
        this.sendToClient(ws, {
          type: 'chat_error',
          error: 'Accès réservé aux super admins'
        });
        return;
      }

      const messages = await AdminMessage.getRecentMessages(channel, 50);
      
      this.sendToClient(ws, {
        type: 'chat_history',
        channel,
        messages
      });
    } catch (error) {
      console.error('[AdminWebSocket] Send history error:', error);
    }
  }

  /**
   * Notifier d'un nouveau message de chat (pour appels externes)
   */
  notifyChatMessage(message) {
    this.broadcastChatMessage({
      type: 'new_chat_message',
      message
    }, message.channel || 'all_admins');
  }
}

// Singleton
module.exports = new AdminWebSocketService();
