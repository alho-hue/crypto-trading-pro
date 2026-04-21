// Service IA Ethernal - UTILISE L'API GROQ RÉELLE
// Répond automatiquement quand on le tag avec Ethernal
// Intègre l'analyse technique, le sentiment, les alertes, l'auto-trading et la gestion de portefeuille

require('dotenv').config();

// Import des nouveaux services
const technicalAnalysis = require('./technicalAnalysis');
const conversationMemory = require('./conversationMemory');
const alertService = require('./alertService');
const sentimentService = require('./sentimentService');
const autoTradingService = require('./autoTradingService');
const portfolioService = require('./portfolioService');
const binanceService = require('./binanceService');
const tradeManager = require('./tradeManager');
const learningEngine = require('./learningEngine');
const Trade = require('../models/Trade');
const User = require('../models/User');

const ETHERNAL_NAME = 'Ethernal';
const ETHERNAL_AVATAR = 'https://ui-avatars.com/api/?name=Ethernal&background=5865f2&color=fff&size=200&bold=true';

// System prompt pour Ethernal - Version intelligente et contextuelle
const ETHERNAL_SYSTEM_PROMPT = `Tu es **Ethernal**, l'IA intelligente de NEUROVEST.

🎯 MISSION: Aider à prendre de meilleures décisions de trading via l'analyse et l'apprentissage.

📊 FORMAT DE RÉPONSE OBLIGATOIRE (court + structuré):

Pour un SETUP:
📊 PAIRE: [SYMBOL]/USDT
📈 DIRECTION: ACHAT / VENTE / ATTENTE
🎯 ENTRÉE: [prix]
🛑 SL: [prix] 
💰 TP: [prix]
📊 R:R: 1:[ratio]
🔥 CONFIANCE: [X]%
🧠 RAISON: [1 phrase]

Pour une ANALYSE PORTFOLIO:
💼 Valeur: $X | PnL: +/- X%
📈 Actif #1: [symbol] (+/- X%)
⚠️ Risque: [analyse]
💡 Opportunité: [suggestion]

Pour une ANALYSE TRADE:
✅ Gagnant/Perte: $X ([reason])
📊 Erreur: [si perte]
🎯 Leçon: [apprentissage]

🧠 MÉMOIRE: Tu as accès à l'historique des trades, patterns gagnants, et préférences utilisateur.

🚫 INTERDIT:
- Pas de "peut-être"
- Pas de découverte
- Pas de longues explications

✅ OBLIGATOIRE:
- Toujours ACHAT/VENTE/ATTENTE
- Prix exacts
- SL/TP présents
- Réponse en < 30 secondes

CONTEXT UTILISATEUR:
{USER_CONTEXT}

DONNÉES MARCHÉ:
{MARKET_CONTEXT}`;

let groqClient = null;

// Check if Groq API is available
try {
  const Groq = require('groq-sdk');
  if (process.env.GROQ_API_KEY) {
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    console.log('✅ Groq AI connected - Ethernal will use real AI responses');
  } else {
    console.log('⚠️  GROQ_API_KEY not found - Ethernal will use fallback responses');
    console.log('💡 Get your free API key at: https://console.groq.com');
  }
} catch (e) {
  console.log('❌ Groq SDK not installed - Ethernal will use fallback responses');
}

// Fonction de validation de signal
async function validateSignal(signalData) {
  const { symbol, direction, entryPrice, stopLoss, takeProfit, timeframe } = signalData;
  
  const warnings = [];
  let score = 50; // Score de base
  let isValid = true;
  
  // Calculer le risk/reward
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  const riskReward = risk > 0 ? reward / risk : 0;
  
  // Vérifications
  if (riskReward < 1.5) {
    warnings.push(`Risk/Reward ratio faible (${riskReward.toFixed(1)}:1). Recommandé: minimum 2:1`);
    score -= 15;
  } else if (riskReward >= 2) {
    score += 10;
  }
  
  // Vérifier le stop loss
  const stopDistance = (risk / entryPrice) * 100;
  if (stopDistance > 5) {
    warnings.push(`Stop loss éloigné (${stopDistance.toFixed(1)}%). Risque élevé`);
    score -= 10;
  } else if (stopDistance < 1) {
    warnings.push(`Stop loss très serré (${stopDistance.toFixed(1)}%). Risque de whipsaw`);
    score -= 5;
  }
  
  // Vérifier le take profit
  const tpDistance = (reward / entryPrice) * 100;
  if (tpDistance > 20) {
    warnings.push(`Take profit ambitieux (${tpDistance.toFixed(1)}%). Peut être difficile à atteindre`);
    score -= 5;
  }
  
  // Validation timeframe
  const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
  if (!validTimeframes.includes(timeframe)) {
    warnings.push(`Timeframe inhabituel: ${timeframe}`);
    score -= 5;
  }
  
  // Vérifier prix cohérents
  if (direction === 'buy') {
    if (stopLoss >= entryPrice) {
      warnings.push('Stop loss doit être inférieur au prix d\'entrée pour un achat');
      isValid = false;
      score -= 30;
    }
    if (takeProfit <= entryPrice) {
      warnings.push('Take profit doit être supérieur au prix d\'entrée pour un achat');
      isValid = false;
      score -= 30;
    }
  } else {
    if (stopLoss <= entryPrice) {
      warnings.push('Stop loss doit être supérieur au prix d\'entrée pour une vente');
      isValid = false;
      score -= 30;
    }
    if (takeProfit >= entryPrice) {
      warnings.push('Take profit doit être inférieur au prix d\'entrée pour une vente');
      isValid = false;
      score -= 30;
    }
  }
  
  // Score final
  score = Math.max(0, Math.min(100, score));
  
  // Si score très bas, invalider
  if (score < 30) {
    isValid = false;
  }
  
  return {
    isValid,
    score,
    warnings,
    riskReward: riskReward.toFixed(2),
    analysis: {
      stopDistance: stopDistance.toFixed(2) + '%',
      tpDistance: tpDistance.toFixed(2) + '%',
      rewardRatio: riskReward.toFixed(2)
    }
  };
}

// Base de connaissances fallback (quand Groq n'est pas dispo)
const fallbackKnowledgeBase = {
  trading: [
    "Pour le trading, n'oublie jamais de gérer ton risque ! Utilise toujours un stop-loss. 📉",
    "La règle d'or : ne risque jamais plus de 1-2% de ton capital par trade. 🎯",
    "Fais toujours ton analyse technique avant d'entrer en position. 📊",
    "Le trading émotionnel est ton pire ennemi. Reste discipliné ! 🧠"
  ],
  futures: [
    "Les futures sont des contrats à effet de levier. Attention au liquidation ! ⚠️",
    "En futures, le levier amplifie les gains ET les pertes. 📈📉",
    "Surveille toujours ton ratio de marge en futures. 💰",
    "Le mode démo est parfait pour tester tes stratégies de futures. 🎮"
  ],
  crypto: [
    "La volatilité des cryptos offre des opportunités mais aussi des risques. ⚡",
    "Ne mets jamais tout ton capital sur une seule crypto. 🧺",
    "Fais tes propres recherches (DYOR) avant d'investir. 🔍",
    "Le marché crypto est ouvert 24/7, profites-en ! 🌍"
  ],
  general: [
    "Salut ! Je suis Ethernal, l'IA de NEUROVEST. Pose-moi tes questions sur le trading ! 🤖",
    "Besoin d'aide ? Regarde les guides ou demande à la communauté ! 💬",
    "N'oublie pas de consulter le dashboard pour les analyses en temps réel. 📊",
    "Rappelle-toi : le trading est un marathon, pas un sprint. 🏃‍♂️"
  ],
  help: [
    "Pour commencer : 1) Configure ton profil 2) Explore les salons 3) Utilise le simulateur 🎯",
    "Tu peux copier les trades des meilleurs traders via le leaderboard ! 🏆",
    "Le scanner de NEUROVEST te permet de trouver les meilleures opportunités ! 🔍",
    "Join le vocal pour discuter en direct avec les autres traders. 🎙️"
  ]
};

// Détecte si le message mentionne Ethernal
function isMentioningEthernal(content) {
  const mentions = ['@ethernal', '@Ethernal', '@ETHERNAL', 'ethernal'];
  return mentions.some(mention => content.toLowerCase().includes(mention.toLowerCase()));
}

// Extraire le symbole crypto d'un message
function extractSymbol(content) {
  const symbols = content.match(/\b(BTC|ETH|BNB|SOL|ADA|DOT|AVAX|MATIC|XRP|DOGE|SHIB|LTC|LINK)\b/i);
  return symbols ? symbols[0].toUpperCase() : null;
}

// ========== 1. CONTEXTE UTILISATEUR COMPLET ==========
async function getFullUserContext(userId) {
  if (!userId) return '';
  
  try {
    // Récupérer l'utilisateur
    const user = await User.findById(userId);
    if (!user) return '';
    
    // Portfolio
    const portfolio = await portfolioService.getUserPortfolio(userId).catch(() => null);
    
    // Trades actifs
    const activeTrades = await Trade.find({ userId, status: 'open' }).limit(5);
    
    // Derniers trades fermés
    const recentTrades = await Trade.find({ userId, status: 'closed' })
      .sort({ exitTime: -1 })
      .limit(5);
    
    // Mémoire IA
    const memory = await learningEngine.buildUserMemory(userId).catch(() => null);
    
    // Scores des stratégies
    const strategies = await Trade.distinct('strategy', { userId, strategy: { $exists: true } });
    const strategyScores = [];
    for (const strategy of strategies.slice(0, 3)) {
      const score = await learningEngine.calculateStrategyScore(userId, strategy).catch(() => null);
      if (score) strategyScores.push(score);
    }
    
    let context = `
=== PROFIL UTILISATEUR ===
Nom: ${user.username || 'Trader'}
Portfolio: $${portfolio?.totalValue?.toFixed(2) || 'N/A'}
`;

    // Trades actifs
    if (activeTrades.length > 0) {
      context += `\n🟢 TRADES ACTIFS (${activeTrades.length}):\n`;
      activeTrades.forEach(t => {
        context += `• ${t.symbol} ${t.side} | Entry: $${t.entryPrice} | PnL: ${t.pnl?.toFixed(2) || 0} USDT\n`;
      });
    }
    
    // Historique récent
    if (recentTrades.length > 0) {
      context += `\n📊 DERNIERS TRADES:\n`;
      recentTrades.forEach(t => {
        const emoji = (t.pnl || 0) > 0 ? '✅' : '❌';
        context += `${emoji} ${t.symbol} ${t.exitReason}: ${t.pnl?.toFixed(2)} USDT\n`;
      });
    }
    
    // Mémoire IA - patterns gagnants
    if (memory?.bestSetups?.length > 0) {
      context += `\n🏆 PATTERNS GAGNANTS:\n`;
      memory.bestSetups.slice(0, 3).forEach(s => {
        context += `• ${s.symbol} ${s.strategy || 'N/A'}: +${s.pnl?.toFixed(2)} USDT\n`;
      });
    }
    
    // Stratégies recommandées
    if (strategyScores.length > 0) {
      const bestStrategy = strategyScores.sort((a, b) => b.score - a.score)[0];
      if (bestStrategy.score > 50) {
        context += `\n🎯 MEILLEURE STRATÉGIE: ${bestStrategy.strategy} (Score: ${bestStrategy.score}/100)\n`;
      }
    }
    
    // Paramètres optimaux
    if (memory?.optimalParameters) {
      context += `\n⚙️ PARAMÈTRES OPTIMAUX:\n`;
      context += `• Risk/Reward: 1:${memory.optimalParameters.riskRewardRatio?.toFixed(1)}\n`;
      context += `• Levier: ${memory.optimalParameters.recommendedLeverage}x\n`;
      context += `• Size: ${memory.optimalParameters.positionSizePercent}%\n`;
    }
    
    // Calculer des stats
    const totalTrades = recentTrades.length;
    const winningTrades = recentTrades.filter(t => (t.pnl || 0) > 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100).toFixed(0) : 0;
    const totalPnl = recentTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    context += `\n📈 PERFORMANCE RÉCENTE:\n`;
    context += `• Win Rate: ${winRate}% (${winningTrades}/${totalTrades})\n`;
    context += `• PnL Total: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} USDT\n`;
    
    return context;
  } catch (error) {
    console.error('[EthernalAI] Erreur contexte utilisateur:', error);
    return '';
  }
}

// ========== 2. CONTEXTE MARCHÉ AMÉLIORÉ ==========
async function getMarketContext(symbol) {
  if (!symbol) return '';
  
  try {
    const ticker = await binanceService.get24hTicker(symbol + 'USDT');
    const sentiment = await sentimentService.getOverallMarketSentiment(symbol + 'USDT');
    const candles = await binanceService.getKlines(symbol + 'USDT', '1h', 20).catch(() => []);
    
    let context = `
=== DONNÉES MARCHÉ ${symbol} ===
• Prix: $${parseFloat(ticker.lastPrice).toLocaleString()}
• 24h: ${ticker.priceChangePercent}% | Vol: $${(parseFloat(ticker.volume) / 1e6).toFixed(2)}M
• Range: $${parseFloat(ticker.lowPrice).toLocaleString()} - $${parseFloat(ticker.highPrice).toLocaleString()}
• Sentiment: ${sentiment.overall} (${sentiment.compositeScore}/100)
`;

    // Analyse technique basique
    if (candles.length >= 20) {
      const closes = candles.map(c => parseFloat(c.close));
      const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const currentPrice = closes[closes.length - 1];
      const trend = currentPrice > sma20 ? 'HAUSSIÈRE' : 'BAISSIÈRE';
      
      const highs = candles.slice(-20).map(c => parseFloat(c.high));
      const lows = candles.slice(-20).map(c => parseFloat(c.low));
      const support = Math.min(...lows);
      const resistance = Math.max(...highs);
      
      context += `\n📊 TECHNIQUE:\n`;
      context += `• Trend: ${trend} (vs SMA20)\n`;
      context += `• Support: $${support.toLocaleString()}\n`;
      context += `• Resistance: $${resistance.toLocaleString()}\n`;
    }
    
    return context;
  } catch (error) {
    console.error('[EthernalAI] Erreur contexte marché:', error);
    return '';
  }
}

// Générer une analyse technique pour un symbole
async function generateTechnicalAnalysis(symbol) {
  if (!symbol) return null;
  
  try {
    const candles = await binanceService.getKlines(symbol + 'USDT', '1h', 100);
    const signal = technicalAnalysis.generateTradingSignal(candles);
    
    return `
📊 **ANALYSE TECHNIQUE ${symbol}**
• Signal: ${signal.direction.toUpperCase()} (confiance: ${signal.confidence}%)
• Entry: $${signal.entryPrice.toLocaleString()}
• Stop Loss: $${signal.stopLoss.toLocaleString()}
• Take Profit: $${signal.takeProfit.toLocaleString()}
• RSI: ${signal.indicators.rsi.rsi} (${signal.indicators.rsi.signal})
• MACD: ${signal.indicators.macd.signal}
• Raison: ${signal.reasoning}
`;
  } catch (error) {
    console.error('Erreur lors de l\'analyse technique:', error);
    return null;
  }
}

// Génère une réponse avec Groq API - VERSION INTELLIGENTE
async function generateGroqResponse(content, username, userId = null) {
  if (!groqClient || !process.env.GROQ_API_KEY) {
    return null; // Will fallback
  }

  try {
    // Extraire le symbole si mentionné
    const symbol = extractSymbol(content);
    
    // ========== RÉCUPÉRER TOUS LES CONTEXTES ==========
    
    // 1. Contexte utilisateur complet
    let userContext = '';
    if (userId) {
      userContext = await getFullUserContext(userId);
    }
    
    // 2. Contexte de marché
    let marketContext = '';
    if (symbol) {
      marketContext = await getMarketContext(symbol);
    }
    
    // 3. Setup recommandé par l'IA
    let setupRecommendation = '';
    if (symbol && userId) {
      const recommendation = await learningEngine.getSetupRecommendation(userId, symbol, []).catch(() => null);
      if (recommendation) {
        setupRecommendation = `\n🤖 RECOMMANDATION IA:\n• Action: ${recommendation.action}\n• Confiance: ${recommendation.confidence}%\n• Raisons: ${recommendation.reasons.join(', ')}\n`;
      }
    }

    // 4. Historique conversationnel
    let conversationHistory = [];
    if (userId) {
      conversationHistory = conversationMemory.getHistoryForGroq(userId);
    }

    // ========== CONSTRUIRE LE PROMPT FINAL ==========
    const systemPrompt = ETHERNAL_SYSTEM_PROMPT
      .replace('{USER_CONTEXT}', userContext || 'Nouvel utilisateur')
      .replace('{MARKET_CONTEXT}', marketContext + setupRecommendation || 'Pas de symbole spécifié');

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: `@${username}: ${content}` }
    ];

    const completion = await groqClient.chat.completions.create({
      messages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 600,
      top_p: 0.9
    });

    const response = completion.choices[0]?.message?.content || null;

    // Sauvegarder dans la mémoire conversationnelle
    if (userId && response) {
      conversationMemory.addToHistory(userId, { role: 'user', content });
      conversationMemory.addToHistory(userId, { role: 'assistant', content: response });
    }

    return response;
  } catch (error) {
    console.error('Groq API error:', error);
    return null;
  }
}

// ========== 3. DÉTECTION DE COMMANDES INTELLIGENTES ==========
function detectCommandType(content) {
  const lower = content.toLowerCase();
  
  // Analyses techniques et setups
  if (lower.includes('setup') || lower.includes('opportunité') || lower.includes('trade')) return 'setup';
  if (lower.includes('analyse') || lower.includes('analyser') || lower.includes('signal')) return 'analysis';
  if (lower.includes('tendance') || lower.includes('trend')) return 'trend';
  
  // Commandes utilisateur personnalisées
  if (lower.includes('mes trades') || lower.includes('analyse mes trades') || lower.includes('mes erreurs')) return 'my_trades';
  if (lower.includes('portfolio') || lower.includes('portefeuille') || lower.includes('résume')) return 'portfolio';
  if (lower.includes('performance') || lower.includes('résultats') || lower.includes('stats')) return 'performance';
  if (lower.includes('meilleur') || lower.includes('meilleure') || lower.includes('top')) return 'best_opportunity';
  
  // Alertes et notifications
  if (lower.includes('alerte') || lower.includes('alert') || lower.includes('notifie')) return 'alert';
  
  // Bot et auto-trading
  if (lower.includes('auto-trading') || lower.includes('auto trading') || lower.includes('bot')) return 'auto_trading';
  if (lower.includes('lance bot') || lower.includes('démarrer bot') || lower.includes('start bot')) return 'bot_start';
  if (lower.includes('arrête bot') || lower.includes('stop bot') || lower.includes('pause bot')) return 'bot_stop';
  
  // Sentiment et marché
  if (lower.includes('sentiment') || lower.includes('marché') || lower.includes('market')) return 'sentiment';
  if (lower.includes('fear') || lower.includes('greed') || lower.includes('peur')) return 'fear_greed';
  
  // Aide et apprentissage
  if (lower.includes('apprends') || lower.includes('apprentissage') || lower.includes('mémoire')) return 'learning';
  if (lower.includes('pourquoi') && lower.includes('perdu')) return 'trade_analysis';
  if (lower.includes('améliore') || lower.includes('optimise')) return 'optimization';
  
  return null;
}

// ========== 4. TRAITER LES COMMANDES SPÉCIALES ==========
async function handleSpecialCommand(content, username, userId = null) {
  const commandType = detectCommandType(content);
  const symbol = extractSymbol(content);
  
  console.log(`[EthernalAI] Commande détectée: "${commandType}" pour user: ${userId}, symbol: ${symbol}`);
  
  if (!commandType) return null;
  
  switch (commandType) {
    // ========== SETUP COMPLET ==========
    case 'setup':
      console.log(`[EthernalAI] Exécution SETUP pour ${symbol}`);
      if (symbol && userId) {
        try {
          const [analysis, recommendation] = await Promise.all([
            generateTechnicalAnalysis(symbol),
            learningEngine.getSetupRecommendation(userId, symbol, []).catch(() => null)
          ]);
          
          let response = analysis || `📊 ${symbol}/USDT - Analyse technique indisponible`;
          
          if (recommendation) {
            response += `\n\n🤖 AVIS IA:\n`;
            response += `• Recommandation: ${recommendation.action.toUpperCase()} (${recommendation.confidence}% confiance)\n`;
            if (recommendation.warnings?.length > 0) {
              response += `⚠️ Warnings: ${recommendation.warnings.join(', ')}\n`;
            }
          }
          console.log(`[EthernalAI] SETUP réussi pour ${symbol}`);
          return response;
        } catch (error) {
          console.error(`[EthernalAI] Erreur SETUP:`, error);
          return `⚠️ Erreur lors de l'analyse de ${symbol}: ${error.message}`;
        }
      }
      return `⚠️ Spécifie un symbole (ex: "setup BTC")`;
      break;
    
    // ========== ANALYSE TECHNIQUE ==========
    case 'analysis':
      if (symbol) {
        const analysis = await generateTechnicalAnalysis(symbol);
        if (analysis) return analysis;
      }
      break;
    
    // ========== ANALYSE DES TRADES UTILISATEUR ==========
    case 'my_trades':
      console.log(`[EthernalAI] Exécution MY_TRADES pour user: ${userId}`);
      if (userId) {
        try {
          const trades = await Trade.find({ userId, status: 'closed' })
            .sort({ exitTime: -1 })
            .limit(10);
          
          if (trades.length === 0) {
            return '📊 Pas encore de trades fermés. Effectue des trades pour obtenir une analyse!';
          }
          
          const winning = trades.filter(t => (t.pnl || 0) > 0);
          const losing = trades.filter(t => (t.pnl || 0) <= 0);
          const winRate = (winning.length / trades.length * 100).toFixed(0);
          const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
          
          let response = `📊 ANALYSE DE TES TRADES (${trades.length} récents):\n\n`;
          response += `✅ Gagnants: ${winning.length} | ❌ Perdants: ${losing.length}\n`;
          response += `🎯 Win Rate: ${winRate}%\n`;
          response += `💰 PnL Total: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} USDT\n\n`;
          
          // Top 3 erreurs
          if (losing.length > 0) {
            response += `⚠️ ERREURS FRÉQUENTES:\n`;
            const slHits = losing.filter(t => t.exitReason === 'stop_loss').length;
            const manualExits = losing.filter(t => t.exitReason === 'manual').length;
            if (slHits > 0) response += `• ${slHits} trades: SL trop serré\n`;
            if (manualExits > 0) response += `• ${manualExits} trades: Fermeture émotionnelle\n`;
          }
          
          // Meilleur setup
          const bestTrade = trades.reduce((best, t) => (t.pnl || 0) > (best.pnl || 0) ? t : best, trades[0]);
          response += `\n🏆 MEILLEUR TRADE: ${bestTrade.symbol} +${bestTrade.pnl?.toFixed(2)} USDT\n`;
          
          console.log(`[EthernalAI] MY_TRADES réussi: ${trades.length} trades`);
          return response;
        } catch (error) {
          console.error(`[EthernalAI] Erreur MY_TRADES:`, error);
          return `⚠️ Erreur analyse trades: ${error.message}`;
        }
      }
      return `⚠️ Authentification requise`;
      break;
    
    // ========== PORTFOLIO DÉTAILLÉ ==========
    case 'portfolio':
      console.log(`[EthernalAI] Exécution PORTFOLIO pour user: ${userId}`);
      if (userId) {
        try {
          const portfolio = await portfolioService.getUserPortfolio(userId);
          const activeTrades = await Trade.find({ userId, status: 'open' });
          
          let response = `💼 RÉSUMÉ PORTFOLIO\n\n`;
          response += `💰 Valeur Totale: $${portfolio?.totalValue?.toFixed(2) || 'N/A'}\n`;
          response += `📊 Actifs: ${portfolio?.assets?.length || 0}\n`;
          response += `🟢 Trades Actifs: ${activeTrades.length}\n\n`;
          
          if (portfolio?.assets?.length > 0) {
            response += `🏆 TOP ACTIFS:\n`;
            portfolio.assets.slice(0, 3).forEach((asset, i) => {
              response += `${i+1}. ${asset.symbol}: $${asset.value?.toFixed(2)} (${asset.allocation?.toFixed(1)}%)\n`;
            });
          }
          
          // PnL des trades actifs
          if (activeTrades.length > 0) {
            const activePnl = activeTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
            response += `\n📈 PnL Trades Ouverts: ${activePnl >= 0 ? '+' : ''}${activePnl.toFixed(2)} USDT\n`;
          }
          
          console.log(`[EthernalAI] PORTFOLIO réussi`);
          return response;
        } catch (error) {
          console.error(`[EthernalAI] Erreur PORTFOLIO:`, error);
          return `⚠️ Erreur portefeuille: ${error.message}`;
        }
      }
      return `⚠️ Authentification requise`;
      break;
    
    // ========== PERFORMANCE ==========
    case 'performance':
      if (userId) {
        try {
          const report = await learningEngine.getLearningReport(userId);
          if (!report) return '📊 Pas assez de données pour analyser la performance.';
          
          const { memory, strategyScores } = report;
          
          let response = `📈 PERFORMANCE & APPRENTISSAGE\n\n`;
          response += `📊 Trades Analysés: ${memory.totalTrades}\n`;
          
          if (memory.optimalParameters) {
            response += `⚙️ Paramètres Optimaux:\n`;
            response += `• Risk/Reward: 1:${memory.optimalParameters.riskRewardRatio?.toFixed(1)}\n`;
            response += `• Levier: ${memory.optimalParameters.recommendedLeverage}x\n`;
            response += `• Size: ${memory.optimalParameters.positionSizePercent}%\n`;
          }
          
          if (strategyScores?.length > 0) {
            const best = strategyScores[0];
            response += `\n🎯 MEILLEURE STRATÉGIE: ${best.strategy}\n`;
            response += `• Score: ${best.score}/100 | Win Rate: ${best.winRate.toFixed(0)}%\n`;
          }
          
          return response;
        } catch (error) {
          return `⚠️ Erreur performance: ${error.message}`;
        }
      }
      break;
    
    // ========== MEILLEURE OPPORTUNITÉ ==========
    case 'best_opportunity':
      if (userId) {
        try {
          // Analyser les tops cryptos
          const symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA'];
          const opportunities = [];
          
          for (const sym of symbols) {
            const signal = await technicalAnalysis.generateTradingSignal(
              await binanceService.getKlines(sym + 'USDT', '1h', 50).catch(() => [])
            ).catch(() => null);
            
            if (signal && signal.confidence > 60) {
              opportunities.push({ symbol: sym, signal });
            }
          }
          
          if (opportunities.length === 0) {
            return '🤔 Pas d\'opportunité claire détectée actuellement. Attends un meilleur setup!';
          }
          
          // Trier par confiance
          opportunities.sort((a, b) => b.signal.confidence - a.signal.confidence);
          const best = opportunities[0];
          
          return `🎯 MEILLEURE OPPORTUNITÉ ACTUELLE\n\n` +
                 `📊 ${best.symbol}/USDT\n` +
                 `📈 Direction: ${best.signal.direction.toUpperCase()}\n` +
                 `🔥 Confiance: ${best.signal.confidence}%\n` +
                 `🎯 Entry: $${best.signal.entryPrice?.toLocaleString()}\n` +
                 `🛑 SL: $${best.signal.stopLoss?.toLocaleString()}\n` +
                 `💰 TP: $${best.signal.takeProfit?.toLocaleString()}\n` +
                 `📊 R:R: 1:${(Math.abs(best.signal.takeProfit - best.signal.entryPrice) / Math.abs(best.signal.entryPrice - best.signal.stopLoss)).toFixed(1)}\n` +
                 `\n💡 ${best.signal.reasoning}`;
        } catch (error) {
          return `⚠️ Erreur opportunité: ${error.message}`;
        }
      }
      break;
      
    // ========== ALERTES ==========
    case 'alert':
      if (symbol && userId) {
        try {
          const alert = await alertService.createAlertFromCommand(userId, content);
          return `🔔 Alerte créée: ${alert.symbol} ${alert.condition} $${alert.targetPrice.toLocaleString()}`;
        } catch (error) {
          return `⚠️ Erreur alerte: ${error.message}`;
        }
      }
      break;
    
    // ========== BOT AUTO-TRADING ==========
    case 'bot_start':
      console.log(`[EthernalAI] Exécution BOT_START pour user: ${userId}`);
      if (userId) {
        try {
          await autoTradingService.enableAutoTrading(userId, {
            strategy: 'moderate',
            symbols: ['BTC', 'ETH'],
            maxRiskPerTrade: 2,
            autoBuy: false,
            autoSell: false
          });
          return '✅ Bot auto-trading LANCÉ (mode conseil)\n\n⚙️ Paramètres:\n• Stratégie: Moderate\n• Risk max: 2%\n• Auto-exécution: OFF\n\n💡 Utilise "activer auto" pour lancer les trades automatiques';
        } catch (error) {
          return `⚠️ Erreur lancement bot: ${error.message}`;
        }
      }
      break;
    
    case 'bot_stop':
      if (userId) {
        try {
          await autoTradingService.disableAutoTrading(userId);
          return '✅ Bot auto-trading ARRÊTÉ\n\n🛑 Tous les signaux automatiques sont désactivés.';
        } catch (error) {
          return `⚠️ Erreur arrêt bot: ${error.message}`;
        }
      }
      break;
      
    case 'auto_trading':
      if (userId) {
        try {
          const status = autoTradingService.getBotStatus(userId);
          return `🤖 STATUT BOT:\n• Activé: ${status.enabled ? '✅ OUI' : '❌ NON'}\n• Trades: ${status.totalTrades || 0}\n• Win Rate: ${status.winRate || 'N/A'}%`;
        } catch (error) {
          return `⚠️ Erreur statut bot: ${error.message}`;
        }
      }
      break;
    
    // ========== SENTIMENT ==========
    case 'sentiment':
      if (symbol) {
        try {
          const sentiment = await sentimentService.getOverallMarketSentiment(symbol + 'USDT');
          return `📊 SENTIMENT ${symbol}:\n• Global: ${sentiment.overall.toUpperCase()}\n• Score: ${sentiment.compositeScore}/100\n• Recommandation: ${sentiment.recommendation}`;
        } catch (error) {
          return `⚠️ Erreur sentiment: ${error.message}`;
        }
      }
      break;
    
    case 'fear_greed':
      try {
        const fng = await sentimentService.getFearGreedIndex();
        const analysis = sentimentService.analyzeFearGreedSentiment(fng);
        return `😨 FEAR & GREED INDEX\n• Valeur: ${fng.value}/100 (${fng.classification})\n• Sentiment: ${analysis.sentiment}\n• Signal: ${analysis.signal}`;
      } catch (error) {
        return `⚠️ Erreur Fear & Greed: ${error.message}`;
      }
    
    // ========== APPRENTISSAGE ==========
    case 'learning':
      if (userId) {
        try {
          const memory = await learningEngine.buildUserMemory(userId);
          return `🧠 MÉMOIRE IA\n\n📊 Trades analysés: ${memory.totalTrades}\n🏆 Patterns gagnants identifiés: ${Object.keys(memory.winningPatterns.bySymbol).length}\n⚙️ Paramètres optimaux calculés\n\n💡 L'IA apprend de chaque trade pour améliorer les recommandations!`;
        } catch (error) {
          return `⚠️ Erreur mémoire: ${error.message}`;
        }
      }
      break;
    
    // ========== ANALYSE TRADE SPÉCIFIQUE ==========
    case 'trade_analysis':
      if (userId) {
        return `🧐 Pour analyser un trade spécifique:\n• "Analyse mes trades" - Vue d'ensemble\n• Va dans Trades → clique sur un trade fermé\n\n💡 L'IA explique automatiquement chaque trade fermé!`;
      }
      break;
    
    // ========== OPTIMISATION ==========
    case 'optimization':
      if (userId) {
        try {
          const strategies = await Trade.distinct('strategy', { userId, strategy: { $exists: true } });
          const optimizations = [];
          
          for (const strategy of strategies.slice(0, 2)) {
            const opt = await learningEngine.optimizeStrategy(userId, strategy);
            if (opt) optimizations.push(opt);
          }
          
          if (optimizations.length === 0) {
            return '⚙️ Pas assez de données pour optimiser. Effectue plus de trades!';
          }
          
          let response = '⚙️ RECOMMANDATIONS D\'OPTIMISATION\n\n';
          optimizations.forEach(opt => {
            response += `📊 ${opt.strategy} (Score: ${opt.currentScore}/100)\n`;
            if (opt.recommendations?.length > 0) {
              response += `💡 ${opt.recommendations[0]}\n`;
            }
          });
          
          return response;
        } catch (error) {
          return `⚠️ Erreur optimisation: ${error.message}`;
        }
      }
      break;
  }
  
  return null;
}

// Détecte le sujet du message
function detectTopic(content) {
  const lower = content.toLowerCase();
  if (lower.includes('futures') || lower.includes('levier') || lower.includes('margin')) return 'futures';
  if (lower.includes('trading') || lower.includes('trade') || lower.includes('position')) return 'trading';
  if (lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('btc') || lower.includes('eth')) return 'crypto';
  if (lower.includes('aide') || lower.includes('help') || lower.includes('comment') || lower.includes('?')) return 'help';
  return 'general';
}

// Fallback response generator
function generateFallbackResponse(content, username) {
  const topic = detectTopic(content);
  const responses = fallbackKnowledgeBase[topic] || fallbackKnowledgeBase.general;
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  
  return `@${username} ${randomResponse}`;
}

// Génère une réponse (Groq ou fallback)
async function generateResponse(content, username, userId = null) {
  // D'abord, vérifier si c'est une commande spéciale
  const specialCommandResponse = await handleSpecialCommand(content, username, userId);
  if (specialCommandResponse) {
    return specialCommandResponse;
  }
  
  // Try Groq first
  const groqResponse = await generateGroqResponse(content, username, userId);
  
  if (groqResponse) {
    return groqResponse;
  }
  
  // Fallback to knowledge base
  return generateFallbackResponse(content, username);
}

// Message de bienvenue
function getWelcomeMessage() {
  return `👋 **Bienvenue dans le salon #aide !**

Je suis **Ethernal**, l'IA intelligente de **NEUROVEST**. 🤖⚡

**Comment puis-je t'aider ?**
• Tag moi avec **@Ethernal** pour me poser une question
• Je réponds aux questions sur trading, futures, cryptos
• Je donne des conseils pratiques et réels

**Ressources NEUROVEST :**
• 📊 Dashboard - Analyses en temps réel
• 🎯 Simulateur - Teste sans risque
• 🔍 Scanner - Opportunités automatiques
• 🏆 Leaderboard - Copie les meilleurs
• 🎙️ Vocaux - Discute avec la commu

N'hésite pas à demander de l'aide ! 🚀`;
}

/**
 * 🔍 Analyse d'un trade passé pour amélioration continue
 * @param {Object} tradeData - Données du trade
 * @returns {Object} Analyse et recommandations
 */
async function analyzeTradePerformance(tradeData) {
  try {
    console.log('[EthernalAI] Analyse du trade:', tradeData.symbol);
    
    const { symbol, side, entryPrice, exitPrice, pnl, pnlPercent, exitReason, duration, indicators } = tradeData;
    
    // Analyse technique du moment du trade
    const marketContext = await getMarketContext(symbol, '1h');
    
    // Déterminer si le trade était optimal
    const isWin = pnl > 0;
    const isGoodEntry = indicators?.entryQuality > 70;
    const isGoodExit = indicators?.exitQuality > 70;
    
    // Générer des insights
    const insights = [];
    
    if (!isWin && exitReason === 'manual') {
      insights.push('Sortie manuelle sur perte - aurait pu laisser courir selon le plan');
    }
    
    if (isWin && duration < 60) {
      insights.push('Trade rapide gagnant - scalping efficace');
    }
    
    if (pnlPercent > 5) {
      insights.push('Excellent ratio gain - bonne gestion du risque');
    }
    
    if (pnlPercent < -3) {
      insights.push('Perte significative - revoir le position sizing');
    }
    
    // Calculer un score de qualité
    const qualityScore = Math.min(100, Math.max(0, 
      (isWin ? 50 : 0) + 
      (isGoodEntry ? 25 : 0) + 
      (isGoodExit ? 25 : 0)
    ));
    
    // Recommandations pour les prochains trades
    const recommendations = [];
    
    if (!isGoodEntry) {
      recommendations.push('Attendre de meilleures confirmations avant entrée');
    }
    
    if (exitReason === 'stop_loss' && pnlPercent < -2) {
      recommendations.push('Revoir le placement du stop loss - trop serré?');
    }
    
    if (isWin && !isGoodExit) {
      recommendations.push('Prendre des profits partiels pour sécuriser les gains');
    }
    
    return {
      success: true,
      qualityScore,
      isOptimal: qualityScore >= 75,
      insights,
      recommendations,
      marketContext: {
        trend: marketContext.trend,
        volatility: marketContext.volatility
      },
      confidence: qualityScore / 100,
      timestamp: new Date()
    };
    
  } catch (error) {
    console.error('[EthernalAI] Erreur analyse trade:', error);
    return {
      success: false,
      error: error.message,
      qualityScore: 50,
      recommendations: ['Impossible d\'analyser - données insuffisantes']
    };
  }
}

module.exports = {
  isMentioningEthernal,
  generateResponse,
  getWelcomeMessage,
  ETHERNAL_NAME,
  ETHERNAL_AVATAR,
  validateSignal,
  analyzeTradePerformance,
  // Nouvelles fonctions exportées
  extractSymbol,
  getMarketContext,
  getFullUserContext,
  generateTechnicalAnalysis,
  handleSpecialCommand,
  detectCommandType,
  // Services exposés pour usage externe
  technicalAnalysis,
  conversationMemory,
  alertService,
  sentimentService,
  autoTradingService,
  portfolioService,
  tradeManager,
  learningEngine
};
