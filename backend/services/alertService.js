/**
 * NEUROVEST - Alert Service Production-Ready
 * Gestion des alertes de prix et notifications multi-canal
 * 
 * FEATURES:
 * - Push notifications via Socket.IO
 * - Email notifications (nodemailer)
 * - Telegram bot notifications
 * - Price monitoring with caching
 */

require('dotenv').config();
const binanceService = require('./binanceService');
const Alert = require('../models/Alert');
const User = require('../models/User');

// Import nodemailer si disponible
let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.warn('nodemailer not installed, email notifications disabled');
}

// Import telegram bot si disponible
let TelegramBot;
try {
  TelegramBot = require('node-telegram-bot-api');
} catch (e) {
  console.warn('node-telegram-bot-api not installed, Telegram notifications disabled');
}

class AlertService {
  constructor() {
    this.io = null;
    this.monitoringInterval = null;
    this.priceCache = new Map();
    this.isInitialized = false;
  }

  // Initialiser le service avec Socket.IO
  initialize(io) {
    this.io = io;
    this.isInitialized = true;
    
    // Démarrer le monitoring
    this.startMonitoring();
    
    console.log('✅ AlertService initialisé avec Socket.IO');
  }

  // === CRÉATION D'ALERTES ===

  async createAlert(userId, symbol, condition, targetPrice, notificationChannels = ['push']) {
    try {
      const currentPrice = await this.getCurrentPrice(symbol);
      
      const alert = new Alert({
        userId,
        symbol: symbol.toUpperCase(),
        condition, // 'above', 'below', 'crosses_up', 'crosses_down'
        targetPrice: parseFloat(targetPrice),
        currentPrice,
        notificationChannels,
        active: true,
        triggered: false,
        triggeredAt: null
      });

      await alert.save();

      // Émettre l'alerte créée au client
      this.emitToUser(userId, 'alert-created', alert);

      return alert;
    } catch (error) {
      console.error('❌ Erreur création alerte:', error);
      throw error;
    }
  }

  // === GESTION DES ALERTES ===

  async getUserAlerts(userId) {
    return await Alert.find({ userId }).sort({ createdAt: -1 });
  }

  async getActiveAlerts(userId) {
    return await Alert.find({ userId, active: true, triggered: false });
  }

  async deleteAlert(alertId, userId) {
    const alert = await Alert.findOneAndDelete({ _id: alertId, userId });
    if (alert) {
      this.emitToUser(userId, 'alert-deleted', { alertId });
    }
    return !!alert;
  }

  async deactivateAlert(alertId, userId) {
    const alert = await Alert.findOneAndUpdate(
      { _id: alertId, userId },
      { active: false },
      { new: true }
    );
    
    if (alert) {
      this.emitToUser(userId, 'alert-updated', alert);
    }
    
    return alert;
  }

  async reactivateAlert(alertId, userId) {
    const currentPrice = await this.getCurrentPrice(
      (await Alert.findById(alertId))?.symbol
    );
    
    const alert = await Alert.findOneAndUpdate(
      { _id: alertId, userId },
      { 
        active: true, 
        triggered: false, 
        triggeredAt: null,
        currentPrice
      },
      { new: true }
    );
    
    if (alert) {
      this.emitToUser(userId, 'alert-updated', alert);
    }
    
    return alert;
  }

  async updateAlert(alertId, userId, updates) {
    const alert = await Alert.findOneAndUpdate(
      { _id: alertId, userId },
      { $set: updates },
      { new: true }
    );
    
    if (alert) {
      this.emitToUser(userId, 'alert-updated', alert);
    }
    
    return alert;
  }

  // === PRIX ET MONITORING ===

  async getCurrentPrice(symbol) {
    try {
      // Vérifier le cache d'abord (valide 5 secondes)
      const cached = this.priceCache.get(symbol.toUpperCase());
      if (cached && Date.now() - cached.timestamp < 5000) {
        return cached.price;
      }
      
      const ticker = await binanceService.get24hTicker(symbol.toUpperCase());
      const price = parseFloat(ticker.lastPrice);
      
      // Mettre en cache
      this.priceCache.set(symbol.toUpperCase(), {
        price,
        timestamp: Date.now()
      });
      
      return price;
    } catch (error) {
      console.error(`❌ Erreur prix ${symbol}:`, error);
      return 0;
    }
  }

  startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Vérifier les alertes toutes les 30 secondes
    this.monitoringInterval = setInterval(async () => {
      await this.checkAllAlerts();
    }, 30000);

    console.log('✅ Monitoring des alertes démarré');
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('⏸️ Monitoring des alertes arrêté');
    }
  }

  async checkAllAlerts() {
    try {
      const activeAlerts = await Alert.find({ active: true, triggered: false });
      
      if (activeAlerts.length === 0) return;

      // Grouper par symbole pour optimiser les appels API
      const alertsBySymbol = {};
      activeAlerts.forEach(alert => {
        if (!alertsBySymbol[alert.symbol]) {
          alertsBySymbol[alert.symbol] = [];
        }
        alertsBySymbol[alert.symbol].push(alert);
      });

      // Vérifier chaque symbole
      for (const [symbol, alerts] of Object.entries(alertsBySymbol)) {
        try {
          const currentPrice = await this.getCurrentPrice(symbol);
          
          for (const alert of alerts) {
            await this.checkAlert(alert, currentPrice);
          }
        } catch (error) {
          console.error(`❌ Erreur vérification alertes ${symbol}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Erreur checkAllAlerts:', error);
    }
  }

  async checkAlert(alert, currentPrice) {
    try {
      const previousPrice = alert.currentPrice;
      
      // Mettre à jour le prix actuel
      alert.currentPrice = currentPrice;
      await alert.save();

      let triggered = false;

      switch (alert.condition) {
        case 'above':
          if (currentPrice > alert.targetPrice) {
            triggered = true;
          }
          break;
        case 'below':
          if (currentPrice < alert.targetPrice) {
            triggered = true;
          }
          break;
        case 'crosses_up':
          if (previousPrice < alert.targetPrice && currentPrice >= alert.targetPrice) {
            triggered = true;
          }
          break;
        case 'crosses_down':
          if (previousPrice > alert.targetPrice && currentPrice <= alert.targetPrice) {
            triggered = true;
          }
          break;
      }

      if (triggered) {
        await this.triggerAlert(alert, currentPrice);
      }
    } catch (error) {
      console.error(`❌ Erreur vérification alerte ${alert._id}:`, error);
    }
  }

  async triggerAlert(alert, currentPrice) {
    try {
      alert.triggered = true;
      alert.triggeredAt = new Date();
      alert.active = false;
      await alert.save();

      // Envoyer les notifications
      await this.sendNotifications(alert, currentPrice);

      console.log(`🚨 Alerte déclenchée: ${alert.symbol} ${alert.condition} ${alert.targetPrice} (actuel: ${currentPrice})`);
    } catch (error) {
      console.error('❌ Erreur trigger alerte:', error);
    }
  }

  // === NOTIFICATIONS ===

  async sendNotifications(alert, currentPrice) {
    const notification = {
      type: 'price_alert',
      symbol: alert.symbol,
      condition: alert.condition,
      targetPrice: alert.targetPrice,
      currentPrice: currentPrice,
      timestamp: new Date(),
      userId: alert.userId,
      alertId: alert._id
    };

    // Notification push via Socket.IO
    if (alert.notificationChannels.includes('push')) {
      await this.sendPushNotification(alert.userId, notification);
    }

    // Notification email
    if (alert.notificationChannels.includes('email')) {
      await this.sendEmailNotification(alert.userId, notification);
    }

    // Notification Telegram
    if (alert.notificationChannels.includes('telegram')) {
      await this.sendTelegramNotification(alert.userId, notification);
    }
  }

  async sendPushNotification(userId, notification) {
    try {
      if (this.io) {
        this.io.to(`user-${userId}`).emit('price-alert', notification);
        this.io.to(`user-${userId}`).emit('notification', {
          type: 'alert',
          title: `🚨 Alerte ${notification.symbol}`,
          message: `Prix ${notification.condition} ${notification.targetPrice} (actuel: ${notification.currentPrice})`,
          data: notification
        });
      }
      console.log(`📱 Push notification envoyée à ${userId}`);
    } catch (error) {
      console.error('❌ Erreur push notification:', error);
    }
  }

  async sendEmailNotification(userId, notification) {
    try {
      // Vérifier si nodemailer est disponible
      if (!nodemailer) {
        console.log(`📧 Email notification (disabled) for ${userId}`);
        return;
      }
      
      // Récupérer l'utilisateur
      const user = await User.findById(userId);
      if (!user?.email) {
        console.log(`📧 No email for user ${userId}`);
        return;
      }
      
      // Configurer le transporteur email (à configurer dans les variables d'environnement)
      const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      
      // Construire le message
      const subject = `🚨 Alerte Prix ${notification.symbol}`;
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #e74c3c;">Alerte Prix Déclenchée</h2>
          <p><strong>Symbole:</strong> ${notification.symbol}</p>
          <p><strong>Condition:</strong> ${notification.condition}</p>
          <p><strong>Prix cible:</strong> ${notification.targetPrice}</p>
          <p><strong>Prix actuel:</strong> ${notification.currentPrice}</p>
          <p><strong>Date:</strong> ${new Date(notification.timestamp).toLocaleString()}</p>
          <hr>
          <p style="font-size: 12px; color: #666;">NEUROVEST Trading Bot</p>
        </div>
      `;
      
      // Envoyer l'email
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'alerts@neurovest.com',
        to: user.email,
        subject,
        html
      });
      
      console.log(`📧 Email sent to ${user.email}`);
    } catch (error) {
      console.error('❌ Email notification error:', error.message);
    }
  }

  async sendTelegramNotification(userId, notification) {
    try {
      // Vérifier si Telegram est configuré
      if (!TelegramBot || !process.env.TELEGRAM_BOT_TOKEN) {
        console.log(`📱 Telegram notification (disabled) for ${userId}`);
        return;
      }
      
      // Récupérer l'utilisateur
      const user = await User.findById(userId);
      if (!user?.telegramChatId) {
        console.log(`📱 No Telegram chat ID for user ${userId}`);
        return;
      }
      
      // Initialiser le bot si nécessaire
      if (!this.telegramBot) {
        this.telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
      }
      
      // Construire le message
      const message = `
🚨 *ALERTE PRIX* 🚨

*Symbole:* ${notification.symbol}
*Condition:* ${notification.condition}
*Prix cible:* ${notification.targetPrice}
*Prix actuel:* ${notification.currentPrice}
*Date:* ${new Date(notification.timestamp).toLocaleString()}

_NEUROVEST Trading Bot_
      `;
      
      // Envoyer le message
      await this.telegramBot.sendMessage(user.telegramChatId, message, {
        parse_mode: 'Markdown'
      });
      
      console.log(`📱 Telegram sent to ${user.telegramChatId}`);
    } catch (error) {
      console.error('❌ Telegram notification error:', error.message);
    }
  }

  // === COMMANDES INTELLIGENTES ===

  async createAlertFromCommand(userId, command) {
    const lowerCommand = command.toLowerCase();
    
    // Extraire le symbole
    const symbolMatch = command.match(/\b(btc|eth|bnb|sol|ada|dot|avax|matic|xrp|doge|shib|ltc|link|arb|op|sui)\b/i);
    if (!symbolMatch) {
      throw new Error('Symbole non trouvé dans la commande');
    }
    const symbol = symbolMatch[1].toUpperCase();

    // Extraire le prix
    const priceMatch = command.match(/(\d{1,6}(?:\.\d+)?)/);
    if (!priceMatch) {
      throw new Error('Prix non trouvé dans la commande');
    }
    const targetPrice = parseFloat(priceMatch[0]);

    // Déterminer la condition
    let condition = 'above';
    if (lowerCommand.includes('en dessous') || lowerCommand.includes('below') || lowerCommand.includes('sous')) {
      condition = 'below';
    } else if (lowerCommand.includes('dépasse') || lowerCommand.includes('au-dessus') || lowerCommand.includes('above') || lowerCommand.includes('dépasser')) {
      condition = 'above';
    } else if (lowerCommand.includes('croise') || lowerCommand.includes('crosses')) {
      condition = lowerCommand.includes('haut') || lowerCommand.includes('up') ? 'crosses_up' : 'crosses_down';
    }

    return await this.createAlert(userId, symbol, condition, targetPrice);
  }

  // === STATISTIQUES ===

  async getAlertStats(userId) {
    const [total, active, triggered, bySymbol] = await Promise.all([
      Alert.countDocuments({ userId }),
      Alert.countDocuments({ userId, active: true, triggered: false }),
      Alert.countDocuments({ userId, triggered: true }),
      Alert.aggregate([
        { $match: { userId } },
        { $group: { _id: '$symbol', count: { $sum: 1 } } }
      ])
    ]);
    
    const symbolStats = {};
    bySymbol.forEach(item => {
      symbolStats[item._id] = item.count;
    });
    
    return {
      total,
      active,
      triggered,
      inactive: total - active - triggered,
      bySymbol: symbolStats
    };
  }

  // === ALERTES INTELLIGENTES ===

  async createSmartAlert(userId, symbol, indicatorType, threshold) {
    const currentPrice = await this.getCurrentPrice(symbol);
    
    let targetPrice;
    let condition;

    switch (indicatorType) {
      case 'rsi_oversold':
        targetPrice = currentPrice * 0.95;
        condition = 'below';
        break;
      case 'rsi_overbought':
        targetPrice = currentPrice * 1.05;
        condition = 'above';
        break;
      case 'support':
        targetPrice = currentPrice * 0.97;
        condition = 'below';
        break;
      case 'resistance':
        targetPrice = currentPrice * 1.03;
        condition = 'above';
        break;
      case 'percent_drop':
        targetPrice = currentPrice * (1 - (threshold || 5) / 100);
        condition = 'below';
        break;
      case 'percent_rise':
        targetPrice = currentPrice * (1 + (threshold || 5) / 100);
        condition = 'above';
        break;
      default:
        targetPrice = currentPrice * (threshold || 1.05);
        condition = 'above';
    }

    return await this.createAlert(userId, symbol, condition, targetPrice, ['push']);
  }

  // === ALERTES DE MARCHÉ ===

  async createMarketAlert(userId, alertType, params = {}) {
    switch (alertType) {
      case 'high_volatility':
        return await this.createSmartAlert(userId, params.symbol, 'percent_drop', 10);
      case 'breakout':
        return await this.createAlert(userId, params.symbol, 'crosses_up', params.resistance, ['push']);
      case 'breakdown':
        return await this.createAlert(userId, params.symbol, 'crosses_down', params.support, ['push']);
      default:
        throw new Error('Type d\'alerte non supporté');
    }
  }

  // === UTILITAIRES SOCKET.IO ===

  emitToUser(userId, event, data) {
    if (this.io) {
      this.io.to(`user-${userId}`).emit(event, data);
    }
  }

  // === ARRÊT ===

  stop() {
    this.stopMonitoring();
    this.io = null;
    this.isInitialized = false;
  }
}

module.exports = new AlertService();
