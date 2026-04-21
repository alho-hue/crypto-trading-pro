/**
 * 🚀 NEUROVEST - Local Auto Trading Service
 * 
 * Service de trading automatique qui fonctionne 100% en local
 * sans nécessiter de backend MongoDB.
 * 
 * Fonctionnalités:
 * - Stocke config en localStorage
 * - Utilise l'IA Ethernal pour les signaux
 * - Exécute trades via l'API trading existante
 * - Gestion des positions en temps réel
 * - Risk management intégré
 */

import { getAITradingSetup, makeAIPriceDecision } from './advancedAnalysis';
import { placeSpotOrder, placeFuturesOrder, closePosition, getTradingBalance, TradeParams } from './tradingApi';
import { useCryptoStore } from '../stores/cryptoStore';

// Types
export interface LocalBotConfig {
  enabled: boolean;
  strategy: 'conservative' | 'moderate' | 'aggressive';
  symbols: string[];
  maxRiskPerTrade: number; // % du capital
  stopLossPercent: number;
  takeProfitPercent: number;
  trailingStopPercent: number;
  autoBuy: boolean;
  autoSell: boolean;
  minConfidence: number; // score IA minimum
  minRR: number; // Risk/Reward minimum
  maxDailyTrades: number;
  maxPositions: number;
  paperTrading: boolean;
  isFutures: boolean;
  leverage: number;
  useKellyCriterion: boolean; // Critère de Kelly pour sizing optimal
  
  // Risk management
  maxDailyLossPercent: number;
  maxDrawdownPercent: number;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
}

export interface BotPosition {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  entryTime: number;
  exitPrice?: number; // Prix de sortie si position fermée
  exitTime?: number; // Date de sortie
  realizedPnl?: number; // P&L réalisé si fermée
  isAutoTrade: boolean;
  strategy: string;
  score: number; // Score IA
  orderId?: string;
}

export interface BotStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  dailyPnL: number;
  dailyTradeCount: number;
  maxDrawdown: number;
  peakValue: number;
  currentValue: number;
  
  // Par stratégie
  conservativeTrades: number;
  moderateTrades: number;
  aggressiveTrades: number;
  
  // IA stats
  signalsReceived: number;
  signalsExecuted: number;
  signalsIgnored: number;
  
  // Cooldown management
  lastTradeTime?: number;
}

// Configuration par défaut - PARAMÈTRES STRICTS PRO
const DEFAULT_CONFIG: LocalBotConfig = {
  enabled: false,
  strategy: 'moderate',
  symbols: ['BTCUSDT', 'ETHUSDT'],
  maxRiskPerTrade: 2,        // Max 2% risque par trade
  stopLossPercent: 2,        // SL 2%
  takeProfitPercent: 4,      // TP 4%
  trailingStopPercent: 2,
  autoBuy: true,
  autoSell: false,           // Désactivé par défaut ( Short plus risqué)
  minConfidence: 75,         // Score minimum 75% (strict)
  minRR: 2.0,              // Risk/Reward min 2:1
  maxDailyTrades: 5,       // Max 5 trades/jour (éviter overtrading)
  maxPositions: 2,         // Max 2 positions simultanées
  paperTrading: true,      // Démo par défaut
  isFutures: false,
  leverage: 1,
  useKellyCriterion: false,
  maxDailyLossPercent: 3,  // Stop si -3% dans la journée
  maxDrawdownPercent: 5,   // Stop si -5% drawdown
  createdAt: Date.now(),
  updatedAt: Date.now()
};

// ===== FONCTION POUR OBTENIR L'UTILISATEUR COURANT =====
function getCurrentUserId(): string {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.id || user._id || 'guest';
    }
  } catch {
    // Fallback
  }
  return 'guest';
}

// Clés localStorage ISOLÉES PAR UTILISATEUR
function getStorageKeys() {
  const userId = getCurrentUserId();
  return {
    config: `neurovest_bot_config_${userId}`,
    positions: `neurovest_bot_positions_${userId}`,
    stats: `neurovest_bot_stats_${userId}`,
    trades: `neurovest_bot_trades_${userId}`,
    dailyReset: `neurovest_bot_daily_reset_${userId}`,
    paperBalance: `neurovest_paper_balance_${userId}`
  };
}

// ===== FONCTIONS DE STOCKAGE =====

export function getBotConfig(): LocalBotConfig {
  const saved = localStorage.getItem(getStorageKeys().config);
  if (saved) {
    return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  }
  return DEFAULT_CONFIG;
}

export function saveBotConfig(config: Partial<LocalBotConfig>): LocalBotConfig {
  const current = getBotConfig();
  const updated = { 
    ...current, 
    ...config, 
    updatedAt: Date.now() 
  };
  localStorage.setItem(getStorageKeys().config, JSON.stringify(updated));
  return updated;
}

export function getBotPositions(): BotPosition[] {
  const saved = localStorage.getItem(getStorageKeys().positions);
  return saved ? JSON.parse(saved) : [];
}

export function saveBotPositions(positions: BotPosition[]): void {
  localStorage.setItem(getStorageKeys().positions, JSON.stringify(positions));
}

export function getBotStats(): BotStats {
  const saved = localStorage.getItem(getStorageKeys().stats);
  const defaultStats: BotStats = {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    totalPnL: 0,
    dailyPnL: 0,
    dailyTradeCount: 0,
    maxDrawdown: 0,
    peakValue: 10000, // Balance démo par défaut
    currentValue: 10000,
    conservativeTrades: 0,
    moderateTrades: 0,
    aggressiveTrades: 0,
    signalsReceived: 0,
    signalsExecuted: 0,
    signalsIgnored: 0
  };
  return saved ? { ...defaultStats, ...JSON.parse(saved) } : defaultStats;
}

export function saveBotStats(stats: Partial<BotStats>): void {
  const current = getBotStats();
  localStorage.setItem(getStorageKeys().stats, JSON.stringify({ ...current, ...stats }));
}

// ===== GESTION QUOTIDIENNE =====

function checkDailyReset(): void {
  const keys = getStorageKeys();
  const lastReset = localStorage.getItem(keys.dailyReset);
  const today = new Date().toDateString();
  
  if (lastReset !== today) {
    // Reset quotidien
    const stats = getBotStats();
    saveBotStats({
      ...stats,
      dailyPnL: 0,
      dailyTradeCount: 0
    });
    localStorage.setItem(keys.dailyReset, today);
    console.log('[BOT] 🌅 Reset quotidien effectué pour', getCurrentUserId());
  }
}

// ===== LOGIQUE DE TRADING =====

export interface BotDecision {
  action: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  symbol: string;
  reason: string;
  setup?: ReturnType<typeof getAITradingSetup>;
  position?: BotPosition;
}

/**
 * 🧠 Fonction principale de décision du bot
 * Analyse le marché et décide d'acheter, vendre ou attendre
 */
export async function analyzeAndDecide(
  symbol: string,
  currentPrice: number
): Promise<BotDecision> {
  checkDailyReset();
  
  const config = getBotConfig();
  const positions = getBotPositions();
  const stats = getBotStats();
  
  // Vérifier si bot activé
  if (!config.enabled) {
    return { action: 'HOLD', symbol, reason: 'Bot désactivé' };
  }
  
  // Vérifier si symbole autorisé
  if (!config.symbols.includes(symbol)) {
    return { action: 'HOLD', symbol, reason: 'Symbole non autorisé' };
  }
  
  // Vérifier limites quotidiennes
  if (stats.dailyTradeCount >= config.maxDailyTrades) {
    return { action: 'HOLD', symbol, reason: `Limite trades/jour atteinte (${config.maxDailyTrades})` };
  }
  
  // Vérifier drawdown
  if (stats.maxDrawdown >= config.maxDrawdownPercent) {
    return { action: 'HOLD', symbol, reason: `Drawdown max atteint (${stats.maxDrawdown}%)` };
  }
  
  // Vérifier perte journalière
  if (stats.dailyPnL <= -(stats.peakValue * config.maxDailyLossPercent / 100)) {
    return { action: 'HOLD', symbol, reason: 'Perte journalière max atteinte' };
  }
  
  // Vérifier positions ouvertes
  const existingPosition = positions.find(p => p.symbol === symbol && !p.exitPrice);
  const openPositionsCount = positions.filter(p => !p.exitPrice).length;
  
  // ===== DÉCISION IA PRO =====
  const decision = makeAIPriceDecision(symbol, currentPrice, {
    minScore: config.minConfidence,
    minRR: config.minRR,
    maxDailyTrades: config.maxDailyTrades,
    dailyTradeCount: stats.dailyTradeCount,
    lastTradeTime: stats.lastTradeTime,
    minTradeInterval: 5 // 5 minutes minimum entre trades (éviter overtrading)
  });
  
  // Mettre à jour stats signaux
  saveBotStats({
    signalsReceived: stats.signalsReceived + 1
  });
  
  // ===== LOGIQUE DE FERMETURE =====
  if (existingPosition) {
    // Vérifier SL/TP atteints
    if (existingPosition.side === 'buy') {
      if (currentPrice <= existingPosition.stopLoss) {
        return { action: 'CLOSE', symbol, reason: 'Stop Loss atteint', position: existingPosition };
      }
      if (currentPrice >= existingPosition.takeProfit) {
        return { action: 'CLOSE', symbol, reason: 'Take Profit atteint', position: existingPosition };
      }
    } else {
      if (currentPrice >= existingPosition.stopLoss) {
        return { action: 'CLOSE', symbol, reason: 'Stop Loss atteint', position: existingPosition };
      }
      if (currentPrice <= existingPosition.takeProfit) {
        return { action: 'CLOSE', symbol, reason: 'Take Profit atteint', position: existingPosition };
      }
    }
    
    // Vérifier signal inverse IA (fermeture anticipée)
    if (decision.setup?.direction === 'SHORT' && existingPosition.side === 'buy') {
      return { action: 'CLOSE', symbol, reason: 'Signal inverse IA détecté', position: existingPosition };
    }
    if (decision.setup?.direction === 'LONG' && existingPosition.side === 'sell') {
      return { action: 'CLOSE', symbol, reason: 'Signal inverse IA détecté', position: existingPosition };
    }
    
    return { action: 'HOLD', symbol, reason: 'Position ouverte - surveillance SL/TP' };
  }
  
  // ===== LOGIQUE D'OUVERTURE =====
  if (!config.autoBuy) {
    return { action: 'HOLD', symbol, reason: 'Auto-achat désactivé' };
  }
  
  if (openPositionsCount >= config.maxPositions) {
    return { action: 'HOLD', symbol, reason: `Max positions atteint (${config.maxPositions})` };
  }
  
  if (decision.decision !== 'EXECUTE') {
    saveBotStats({ signalsIgnored: stats.signalsIgnored + 1 });
    return { action: 'HOLD', symbol, reason: decision.reason, setup: decision.setup || undefined };
  }
  
  // Exécuter le trade selon direction IA
  if (decision.setup?.direction === 'LONG' && config.autoBuy) {
    saveBotStats({ signalsExecuted: stats.signalsExecuted + 1 });
    return { action: 'BUY', symbol, reason: decision.reason, setup: decision.setup };
  }
  
  if (decision.setup?.direction === 'SHORT' && config.autoSell) {
    saveBotStats({ signalsExecuted: stats.signalsExecuted + 1 });
    return { action: 'SELL', symbol, reason: decision.reason, setup: decision.setup };
  }
  
  return { action: 'HOLD', symbol, reason: 'Conditions non remplies' };
}

/**
 * 💰 Calculer la taille de position selon la stratégie
 */
export function calculatePositionSize(
  balance: number,
  entryPrice: number,
  stopLoss: number,
  config: LocalBotConfig
): number {
  const riskAmount = balance * (config.maxRiskPerTrade / 100);
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  
  if (riskPerUnit === 0) return 0;
  
  const quantity = riskAmount / riskPerUnit;
  
  // Ajustement selon stratégie
  let multiplier = 1;
  switch (config.strategy) {
    case 'conservative':
      multiplier = 0.5;
      break;
    case 'moderate':
      multiplier = 1;
      break;
    case 'aggressive':
      multiplier = 1.5;
      break;
  }
  
  return quantity * multiplier;
}

/**
 * 🎯 Exécuter une décision du bot
 */
export async function executeBotDecision(
  decision: BotDecision
): Promise<{ success: boolean; error?: string; orderId?: string }> {
  const config = getBotConfig();
  const isDemo = config.paperTrading;
  
  try {
    if (decision.action === 'BUY' || decision.action === 'SELL') {
      if (!decision.setup?.entryPrice || !decision.setup.stopLoss || !decision.setup.takeProfit) {
        return { success: false, error: 'Setup incomplet' };
      }
      
      // Calculer taille position
      const balance = await getTradingBalance(isDemo);
      const quantity = calculatePositionSize(
        balance.balance,
        decision.setup.entryPrice,
        decision.setup.stopLoss,
        config
      );
      
      if (quantity <= 0) {
        return { success: false, error: 'Quantité calculée invalide' };
      }
      
      // Exécuter l'ordre
      const params: TradeParams = {
        symbol: decision.symbol,
        side: decision.action === 'BUY' ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity,
        stopLoss: decision.setup.stopLoss,
        takeProfit: decision.setup.takeProfit,
        isDemo
      };
      
      let result;
      if (config.isFutures) {
        result = await placeFuturesOrder({ ...params, leverage: config.leverage });
      } else {
        result = await placeSpotOrder(params);
      }
      
      if (result.success && result.order) {
        // Créer position
        const newPosition: BotPosition = {
          id: `pos_${Date.now()}`,
          symbol: decision.symbol,
          side: decision.action === 'BUY' ? 'buy' : 'sell',
          entryPrice: result.order.price,
          currentPrice: result.order.price,
          quantity: result.order.quantity,
          stopLoss: decision.setup.stopLoss,
          takeProfit: decision.setup.takeProfit,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
          entryTime: Date.now(),
          isAutoTrade: true,
          strategy: config.strategy,
          score: decision.setup.score,
          orderId: result.order.id
        };
        
        const positions = getBotPositions();
        positions.push(newPosition);
        saveBotPositions(positions);
        
        // 🔥 AJOUTER LE TRADE AU STORE GLOBAL (pour affichage dans l'UI)
        useCryptoStore.getState().addTrade({
          id: result.order.id,
          symbol: decision.symbol,
          type: decision.action === 'BUY' ? 'buy' : 'sell',
          entryPrice: result.order.price,
          quantity: result.order.quantity,
          pnl: 0,
          pnlPercent: 0,
          timestamp: Date.now(),
          status: 'open',
          strategy: config.strategy,
          stopLoss: decision.setup.stopLoss,
          takeProfit: decision.setup.takeProfit,
          notes: 'Trade auto par Bot IA'
        });
        
        // 🔥 METTRE À JOUR LE BALANCE VIRTUEL (paper trading)
        if (isDemo) {
          const tradeValue = result.order.price * result.order.quantity;
          updatePaperBalance(-tradeValue); // Déduire le montant du trade
        }
        
        // Mettre à jour stats + timestamp pour cooldown
        const stats = getBotStats();
        saveBotStats({
          totalTrades: stats.totalTrades + 1,
          dailyTradeCount: stats.dailyTradeCount + 1,
          lastTradeTime: Date.now(), // Pour cooldown entre trades
          [`${config.strategy}Trades`]: (stats[`${config.strategy}Trades` as keyof BotStats] as number || 0) + 1
        });
        
        console.log(`[BOT] ✅ Trade ${decision.action} exécuté: ${decision.symbol} @ $${result.order.price} | Quantité: ${result.order.quantity} | Valeur: $${(result.order.price * result.order.quantity).toFixed(2)}`);
        
        return { success: true, orderId: result.order.id };
      }
      
      return { success: false, error: result.error };
      
    } else if (decision.action === 'CLOSE' && decision.position) {
      // 🔥 FERMETURE LOCALE (pas besoin de backend !)
      const position = decision.position;
      const currentPrice = useCryptoStore.getState().prices.get(position.symbol)?.price || position.entryPrice;
      
      // Calculer PnL réel
      const pnl = position.side === 'buy' 
        ? (currentPrice - position.entryPrice) * position.quantity
        : (position.entryPrice - currentPrice) * position.quantity;
      
      // Mettre à jour la position en localStorage
      const positions = getBotPositions();
      const posIndex = positions.findIndex(p => p.id === position.id);
      
      if (posIndex !== -1) {
        positions[posIndex].exitPrice = currentPrice;
        positions[posIndex].exitTime = Date.now();
        positions[posIndex].unrealizedPnl = pnl;
        positions[posIndex].unrealizedPnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;
        saveBotPositions(positions);
        
        // Mettre à jour stats
        const stats = getBotStats();
        const isWin = pnl > 0;
        const newTotalTrades = stats.totalTrades + 1;
        
        saveBotStats({
          totalTrades: newTotalTrades,
          totalPnL: stats.totalPnL + pnl,
          dailyPnL: stats.dailyPnL + pnl,
          winningTrades: stats.winningTrades + (isWin ? 1 : 0),
          losingTrades: stats.losingTrades + (isWin ? 0 : 1),
          winRate: Math.round(((stats.winningTrades + (isWin ? 1 : 0)) / newTotalTrades) * 100),
          maxDrawdown: Math.max(stats.maxDrawdown, stats.dailyPnL < 0 ? Math.abs(stats.dailyPnL) : 0)
        });
        
        // 🔥 METTRE À JOUR LE TRADE DANS LE STORE (le marquer comme fermé)
        useCryptoStore.getState().closeTrade(position.orderId || position.id, currentPrice);
        
        // 🔥 METTRE À JOUR LE BALANCE VIRTUEL avec le PnL (paper trading)
        if (isDemo) {
          const positionValue = position.entryPrice * position.quantity;
          updatePaperBalance(positionValue + pnl); // Rendre le capital + PnL
        }
        
        console.log(`[BOT] ✅ Position fermée: ${position.symbol} | PnL: ${pnl.toFixed(2)} USDT`);
        return { success: true };
      }
      
      return { success: false, error: 'Position non trouvée' };
    }
    
    return { success: true };
    
  } catch (error: any) {
    console.error('[BOT] Erreur exécution:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 🔄 Mettre à jour les positions en temps réel
 */
export function updatePositionsRealtime(): void {
  const positions = getBotPositions();
  const prices = useCryptoStore.getState().prices;
  
  let updated = false;
  
  positions.forEach(pos => {
    if (!pos.exitPrice) {
      const currentPrice = prices.get(pos.symbol)?.price;
      if (currentPrice) {
        pos.currentPrice = currentPrice;
        
        if (pos.side === 'buy') {
          pos.unrealizedPnl = (currentPrice - pos.entryPrice) * pos.quantity;
        } else {
          pos.unrealizedPnl = (pos.entryPrice - currentPrice) * pos.quantity;
        }
        
        pos.unrealizedPnlPercent = (pos.unrealizedPnl / (pos.entryPrice * pos.quantity)) * 100;
        updated = true;
      }
    }
  });
  
  if (updated) {
    saveBotPositions(positions);
  }
}

/**
 * 🚀 Démarrer le bot
 */
export function startLocalBot(): void {
  saveBotConfig({ enabled: true });
  console.log('[BOT] ✅ Bot démarré');
}

/**
 * ⏹️ Arrêter le bot
 */
export function stopLocalBot(): void {
  saveBotConfig({ enabled: false });
  console.log('[BOT] ⏹️ Bot arrêté');
}

/**
 * 🔄 Reset complet du bot
 */
export function resetLocalBot(): void {
  const keys = getStorageKeys();
  localStorage.removeItem(keys.positions);
  localStorage.removeItem(keys.stats);
  localStorage.removeItem(keys.trades);
  localStorage.removeItem(keys.paperBalance);
  saveBotConfig(DEFAULT_CONFIG);
  console.log('[BOT] 🔄 Bot réinitialisé pour', getCurrentUserId());
}

const INITIAL_PAPER_BALANCE = 10000; // $10,000 USDT

/**
 * 💰 Mettre à jour le balance virtuel du paper trading (ISOLÉ PAR USER)
 */
export function updatePaperBalance(delta: number): void {
  const currentBalance = getPaperBalance();
  const newBalance = Math.max(0, currentBalance + delta);
  localStorage.setItem(getStorageKeys().paperBalance, newBalance.toString());
  console.log(`[BOT] 💰 Paper Balance (${getCurrentUserId()}): $${currentBalance.toFixed(2)} → $${newBalance.toFixed(2)} (Δ$${delta.toFixed(2)})`);
}

/**
 * 💰 Obtenir le balance virtuel du paper trading (ISOLÉ PAR USER)
 */
export function getPaperBalance(): number {
  const stored = localStorage.getItem(getStorageKeys().paperBalance);
  if (!stored) {
    localStorage.setItem(getStorageKeys().paperBalance, INITIAL_PAPER_BALANCE.toString());
    return INITIAL_PAPER_BALANCE;
  }
  return parseFloat(stored) || INITIAL_PAPER_BALANCE;
}

/**
 * 🔄 Réinitialiser le balance paper trading (ISOLÉ PAR USER)
 */
export function resetPaperBalance(): void {
  localStorage.setItem(getStorageKeys().paperBalance, INITIAL_PAPER_BALANCE.toString());
  console.log(`[BOT] 💰 Paper Balance réinitialisé à $${INITIAL_PAPER_BALANCE} pour ${getCurrentUserId()}`);
}

// Types pour trade manuel
export interface ManualTradeParams {
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  quantity?: number;
}

/**
 * 🎯 Exécuter un TRADE MANUEL depuis le Dashboard
 * Fonctionne 100% en local sans backend
 */
export async function executeManualTradeLocal(
  params: ManualTradeParams
): Promise<{ success: boolean; trade?: any; error?: string }> {
  try {
    const { symbol, side, entryPrice, stopLoss, takeProfit, confidence, quantity } = params;
    
    console.log(`[MANUAL TRADE] ${side.toUpperCase()} ${symbol} @ $${entryPrice} (conf: ${confidence}%)`);
    
    // Calculer la quantité si non fournie
    let qty = quantity;
    if (!qty || qty <= 0) {
      const balance = getPaperBalance();
      const positionSizePercent = 0.1; // 10% du balance par défaut
      const positionValue = balance * positionSizePercent;
      qty = positionValue / entryPrice;
      
      // Minimum 0.0001 pour BTC, 0.001 pour ETH, etc.
      const minQty = symbol.includes('BTC') ? 0.0001 : symbol.includes('ETH') ? 0.001 : 0.01;
      qty = Math.max(qty, minQty);
    }
    
    // Vérifier que le balance est suffisant
    const tradeValue = entryPrice * qty;
    const currentBalance = getPaperBalance();
    
    if (tradeValue > currentBalance * 1.5) {
      return { success: false, error: 'Balance insuffisant pour ce trade' };
    }
    
    // Créer l'ordre simulé (comme si ça venait de l'API)
    const orderId = `manual_${Date.now()}`;
    const now = Date.now();
    
    // Créer la position
    const newPosition: BotPosition = {
      id: `pos_manual_${now}`,
      symbol,
      side,
      entryPrice,
      currentPrice: entryPrice,
      quantity: qty,
      stopLoss,
      takeProfit,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      entryTime: now,
      isAutoTrade: false, // Manuel !
      strategy: 'manual',
      score: confidence,
      orderId
    };
    
    // Sauvegarder la position
    const positions = getBotPositions();
    positions.push(newPosition);
    saveBotPositions(positions);
    
    // Ajouter au store global pour l'affichage
    useCryptoStore.getState().addTrade({
      id: orderId,
      symbol,
      type: side,
      entryPrice,
      quantity: qty,
      pnl: 0,
      pnlPercent: 0,
      timestamp: now,
      status: 'open',
      strategy: 'manual',
      stopLoss,
      takeProfit,
      notes: `Trade manuel - Confiance ${confidence}%`
    });
    
    // Mettre à jour le balance
    updatePaperBalance(-tradeValue);
    
    // Mettre à jour les stats
    const stats = getBotStats();
    saveBotStats({
      totalTrades: stats.totalTrades + 1,
      dailyTradeCount: stats.dailyTradeCount + 1,
      lastTradeTime: now
    });
    
    console.log(`[MANUAL TRADE] ✅ ${side.toUpperCase()} exécuté: ${qty.toFixed(6)} ${symbol} @ $${entryPrice} = $${tradeValue.toFixed(2)}`);
    
    return {
      success: true,
      trade: {
        id: orderId,
        symbol,
        side: side.toUpperCase(),
        price: entryPrice,
        quantity: qty,
        value: tradeValue,
        timestamp: now
      }
    };
    
  } catch (error: any) {
    console.error('[MANUAL TRADE] ❌ Erreur:', error);
    return { success: false, error: error.message || 'Erreur lors de l\'exécution' };
  }
}
