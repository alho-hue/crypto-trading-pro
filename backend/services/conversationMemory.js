// Service de Mémoire Conversationnelle pour Ethernal IA
// Permet à Ethernal de se souvenir du contexte conversationnel de chaque utilisateur

const conversationHistory = new Map();
const MAX_HISTORY_SIZE = 20; // Garder les 20 derniers messages
const HISTORY_TTL = 24 * 60 * 60 * 1000; // 24 heures en millisecondes

class ConversationMemory {
  // Ajouter un message à l'historique d'un utilisateur
  addToHistory(userId, message) {
    if (!conversationHistory.has(userId)) {
      conversationHistory.set(userId, {
        messages: [],
        lastAccess: Date.now()
      });
    }

    const history = conversationHistory.get(userId);
    history.messages.push({
      ...message,
      timestamp: Date.now()
    });
    history.lastAccess = Date.now();

    // Garder seulement les MAX_HISTORY_SIZE derniers messages
    if (history.messages.length > MAX_HISTORY_SIZE) {
      history.messages = history.messages.slice(-MAX_HISTORY_SIZE);
    }

    conversationHistory.set(userId, history);
  }

  // Récupérer l'historique d'un utilisateur
  getHistory(userId) {
    const history = conversationHistory.get(userId);
    
    if (!history) {
      return [];
    }

    // Nettoyer les anciens messages (TTL)
    this.cleanupOldMessages(userId);

    return history.messages;
  }

  // Nettoyer les messages expirés
  cleanupOldMessages(userId) {
    const history = conversationHistory.get(userId);
    
    if (!history) {
      return;
    }

    const now = Date.now();
    history.messages = history.messages.filter(msg => {
      return (now - msg.timestamp) < HISTORY_TTL;
    });

    conversationHistory.set(userId, history);
  }

  // Effacer tout l'historique d'un utilisateur
  clearHistory(userId) {
    conversationHistory.delete(userId);
  }

  // Récupérer l'historique au format pour Groq API
  getHistoryForGroq(userId) {
    const messages = this.getHistory(userId);
    
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  // Récupérer le contexte récent (derniers 5 messages)
  getRecentContext(userId, limit = 5) {
    const messages = this.getHistory(userId);
    return messages.slice(-limit);
  }

  // Extraire les informations importantes de la conversation
  extractImportantInfo(userId) {
    const messages = this.getHistory(userId);
    const importantInfo = {
      mentionedSymbols: new Set(),
      mentionedStrategies: new Set(),
      userPreferences: {},
      lastTopics: []
    };

    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      
      // Extraire les symboles mentionnés (BTC, ETH, etc.)
      const symbols = content.match(/\b(btc|eth|bnb|sol|ada|dot|avax|matic|xrp|doge|shib|ltc|link)\b/gi);
      if (symbols) {
        symbols.forEach(s => importantInfo.mentionedSymbols.add(s.toUpperCase()));
      }

      // Extraire les stratégies mentionnées
      const strategies = content.match(/\b(scalping|day trading|swing trading|hodl|long|short|leverage|futures)\b/gi);
      if (strategies) {
        strategies.forEach(s => importantInfo.mentionedStrategies.add(s.toLowerCase()));
      }

      // Détecter les préférences utilisateur
      if (content.includes('risque') || content.includes('risk')) {
        if (content.includes('faible') || content.includes('low')) {
          importantInfo.userPreferences.riskProfile = 'conservative';
        } else if (content.includes('élevé') || content.includes('high')) {
          importantInfo.userPreferences.riskProfile = 'aggressive';
        }
      }
    });

    return {
      ...importantInfo,
      mentionedSymbols: Array.from(importantInfo.mentionedSymbols),
      mentionedStrategies: Array.from(importantInfo.mentionedStrategies)
    };
  }

  // Générer un résumé de la conversation pour le contexte
  generateConversationSummary(userId) {
    const messages = this.getHistory(userId);
    const importantInfo = this.extractImportantInfo(userId);

    let summary = `Conversation avec l'utilisateur:\n`;
    
    if (importantInfo.mentionedSymbols.length > 0) {
      summary += `Symboles discutés: ${importantInfo.mentionedSymbols.join(', ')}\n`;
    }

    if (importantInfo.mentionedStrategies.length > 0) {
      summary += `Stratégies mentionnées: ${importantInfo.mentionedStrategies.join(', ')}\n`;
    }

    if (importantInfo.userPreferences.riskProfile) {
      summary += `Profil de risque: ${importantInfo.userPreferences.riskProfile}\n`;
    }

    summary += `Nombre de messages: ${messages.length}\n`;

    return summary;
  }

  // Sauvegarder l'historique en base de données (optionnel pour persistance)
  async saveToDatabase(userId) {
    // Cette fonction pourrait être implémentée plus tard avec MongoDB
    // pour persister l'historique entre les redémarrages du serveur
    const history = this.getHistory(userId);
    
    // TODO: Implémenter la sauvegarde en MongoDB
    // const Conversation = require('../models/Conversation');
    // await Conversation.findOneAndUpdate(
    //   { userId },
    //   { messages: history, lastAccess: Date.now() },
    //   { upsert: true }
    // );
    
    return history;
  }

  // Charger l'historique depuis la base de données (optionnel)
  async loadFromDatabase(userId) {
    // Cette fonction pourrait être implémentée plus tard avec MongoDB
    // const Conversation = require('../models/Conversation');
    // const doc = await Conversation.findOne({ userId });
    // if (doc) {
    //   conversationHistory.set(userId, {
    //     messages: doc.messages,
    //     lastAccess: doc.lastAccess
    //   });
    // }
    
    return this.getHistory(userId);
  }

  // Obtenir des statistiques sur la conversation
  getConversationStats(userId) {
    const messages = this.getHistory(userId);
    
    const stats = {
      totalMessages: messages.length,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
      averageMessageLength: 0,
      firstMessageTime: null,
      lastMessageTime: null
    };

    if (messages.length > 0) {
      stats.firstMessageTime = new Date(messages[0].timestamp);
      stats.lastMessageTime = new Date(messages[messages.length - 1].timestamp);
      
      const totalLength = messages.reduce((sum, m) => sum + m.content.length, 0);
      stats.averageMessageLength = Math.round(totalLength / messages.length);
    }

    return stats;
  }

  // Rechercher dans l'historique
  searchHistory(userId, query) {
    const messages = this.getHistory(userId);
    const lowerQuery = query.toLowerCase();
    
    return messages.filter(msg => 
      msg.content.toLowerCase().includes(lowerQuery)
    );
  }
}

module.exports = new ConversationMemory();
