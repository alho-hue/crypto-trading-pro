import type { 
  RiskCalculation, 
  RiskConfig, 
  RiskLimits, 
  GlobalRiskMetrics,
  TradeRiskValidation,
  TrailingStopStatus,
  VolatilityAdjustment 
} from '../types';

// ==========================================
// FORMULE CLÉ: Position Size = (Capital × Risk%) / Distance Stop Loss
// ==========================================

export function calculateRisk(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  accountSize: number,
  riskPercent: number
): RiskCalculation {
  // Calculate risk per unit (distance stop loss)
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  
  // Calculate dollar risk amount: Capital × Risk%
  const maxRiskAmount = accountSize * (riskPercent / 100);
  
  // FORMULE: Position Size = (Capital × Risk%) / Distance Stop Loss
  const positionSize = riskPerUnit > 0 ? maxRiskAmount / riskPerUnit : 0;
  
  // Calculate position value
  const positionValue = positionSize * entryPrice;
  
  // Calculate risk/reward ratio
  const potentialLoss = maxRiskAmount;
  const potentialProfit = positionSize * Math.abs(takeProfit - entryPrice);
  const riskRewardRatio = potentialLoss > 0 ? potentialProfit / potentialLoss : 0;
  
  return {
    entryPrice,
    stopLoss,
    takeProfit,
    accountSize,
    riskPercent,
    positionSize,
    positionValue,
    riskRewardRatio,
    maxLoss: potentialLoss,
    potentialProfit,
  };
}

// ==========================================
// FORMULE COMPLÈTE AVEC DÉTAILS
// ==========================================

export interface DetailedPositionCalc {
  positionSize: number;
  positionValue: number;
  riskAmount: number;
  riskPercent: number;
  stopDistance: number;
  stopDistancePercent: number;
  riskRewardRatio: number;
  potentialProfit: number;
  leverageRequired: number;
  formula: string;
}

export function calculatePositionSizeDetailed(
  capital: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss: number,
  takeProfit: number
): DetailedPositionCalc {
  // Validation
  if (capital <= 0 || riskPercent <= 0 || entryPrice <= 0 || stopLoss <= 0) {
    return {
      positionSize: 0,
      positionValue: 0,
      riskAmount: 0,
      riskPercent: 0,
      stopDistance: 0,
      stopDistancePercent: 0,
      riskRewardRatio: 0,
      potentialProfit: 0,
      leverageRequired: 0,
      formula: 'Paramètres invalides',
    };
  }

  // Étape 1: Calcul du risque en dollar
  const riskAmount = capital * (riskPercent / 100);
  
  // Étape 2: Distance du stop
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const stopDistancePercent = (stopDistance / entryPrice) * 100;
  
  // Étape 3: FORMULE CLÉ - Position Size
  const positionSize = stopDistance > 0 ? riskAmount / stopDistance : 0;
  
  // Étape 4: Valeur de la position
  const positionValue = positionSize * entryPrice;
  
  // Étape 5: Risk/Reward
  const tpDistance = Math.abs(takeProfit - entryPrice);
  const riskRewardRatio = stopDistance > 0 ? tpDistance / stopDistance : 0;
  const potentialProfit = positionSize * tpDistance;
  
  // Étape 6: Levier nécessaire
  const leverageRequired = capital > 0 ? positionValue / capital : 0;

  return {
    positionSize,
    positionValue,
    riskAmount,
    riskPercent,
    stopDistance,
    stopDistancePercent,
    riskRewardRatio,
    potentialProfit,
    leverageRequired,
    formula: `Position Size = ($${capital.toLocaleString()} × ${riskPercent}%) / $${stopDistance.toFixed(2)} = ${positionSize.toFixed(4)} unités`,
  };
}

export function calculateStopLoss(
  entryPrice: number,
  riskPercent: number,
  isLong: boolean
): number {
  return isLong 
    ? entryPrice * (1 - riskPercent / 100)
    : entryPrice * (1 + riskPercent / 100);
}

export function calculateTakeProfit(
  entryPrice: number,
  stopLoss: number,
  riskRewardRatio: number,
  isLong: boolean
): number {
  const riskDistance = Math.abs(entryPrice - stopLoss);
  const rewardDistance = riskDistance * riskRewardRatio;
  
  return isLong
    ? entryPrice + rewardDistance
    : entryPrice - rewardDistance;
}

// Kelly Criterion for position sizing
export function kellyCriterion(winRate: number, avgWin: number, avgLoss: number): number {
  const b = avgWin / avgLoss; // Win/loss ratio
  const p = winRate / 100; // Win rate as decimal
  const q = 1 - p;
  
  // Kelly percentage
  const kelly = (b * p - q) / b;
  
  // Return half-Kelly (more conservative)
  return Math.max(0, kelly * 0.5 * 100);
}

// Calculate optimal position size based on Kelly
export function calculateOptimalPositionSize(
  accountSize: number,
  winRate: number,
  avgWin: number,
  avgLoss: number,
  entryPrice: number,
  stopLoss: number
): { positionSize: number; riskPercent: number; kellyPercent: number } {
  const kellyPercent = kellyCriterion(winRate, avgWin, avgLoss);
  const riskAmount = accountSize * (kellyPercent / 100);
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  const positionSize = riskPerUnit > 0 ? riskAmount / riskPerUnit : 0;
  
  return {
    positionSize,
    riskPercent: kellyPercent,
    kellyPercent,
  };
}

// ==========================================
// ADAPTATION À LA VOLATILITÉ (ATR)
// ==========================================

export function calculateATR(candles: { high: number; low: number; close: number }[], period: number = 14): number {
  if (candles.length < period) return 0;
  
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i].close),
      Math.abs(candles[i].low - candles[i].close)
    );
    sum += tr;
  }
  return sum / period;
}

export function adjustForVolatility(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  atr: number,
  basePositionSize: number,
  isLong: boolean
): VolatilityAdjustment & { adjustedPositionSize: number } {
  const atrPercent = (atr / entryPrice) * 100;
  
  // Déterminer le niveau de volatilité
  let volatilityLevel: 'low' | 'medium' | 'high' | 'extreme';
  let stopMultiplier: number;
  let positionSizeMultiplier: number;
  
  if (atrPercent < 1.5) {
    volatilityLevel = 'low';
    stopMultiplier = 1;
    positionSizeMultiplier = 1.1;
  } else if (atrPercent < 3) {
    volatilityLevel = 'medium';
    stopMultiplier = 1.5;
    positionSizeMultiplier = 1;
  } else if (atrPercent < 5) {
    volatilityLevel = 'high';
    stopMultiplier = 2;
    positionSizeMultiplier = 0.7;
  } else {
    volatilityLevel = 'extreme';
    stopMultiplier = 2.5;
    positionSizeMultiplier = 0.5;
  }
  
  // Ajuster les niveaux selon l'ATR
  const adjustedStopLoss = isLong
    ? Math.min(stopLoss, entryPrice - atr * stopMultiplier)
    : Math.max(stopLoss, entryPrice + atr * stopMultiplier);
  
  const adjustedTakeProfit = isLong
    ? takeProfit + atr * 0.5
    : takeProfit - atr * 0.5;
  
  const adjustedPositionSize = basePositionSize * positionSizeMultiplier;
  
  return {
    atr14: atr,
    atrPercent,
    volatilityLevel,
    recommendedStopMultiplier: stopMultiplier,
    positionSizeMultiplier,
    adjustedStopLoss,
    adjustedTakeProfit,
    adjustedPositionSize,
  };
}

// ==========================================
// TRAILING STOP
// ==========================================

export interface TrailingStopParams {
  enabled: boolean;
  activationPercent: number; // % de profit pour activer
  trailingPercent: number;   // % de distance du trailing
  breakevenAtPercent?: number; // % pour déplacer à breakeven
}

export function calculateTrailingStop(
  entryPrice: number,
  currentPrice: number,
  initialStopLoss: number,
  highestPrice: number,
  isLong: boolean,
  config: TrailingStopParams
): { newStopLoss: number; profitPercent: number; triggered: boolean; toBreakeven: boolean } {
  if (!config.enabled) {
    return { newStopLoss: initialStopLoss, profitPercent: 0, triggered: false, toBreakeven: false };
  }
  
  const profitPercent = isLong
    ? ((currentPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - currentPrice) / entryPrice) * 100;
  
  let newStopLoss = initialStopLoss;
  let triggered = false;
  let toBreakeven = false;
  
  // Activer le trailing après le seuil de profit
  if (profitPercent >= config.activationPercent) {
    triggered = true;
    
    // Calculer le nouveau stop basé sur le prix le plus haut
    const trailDistance = highestPrice * (config.trailingPercent / 100);
    const proposedStop = isLong ? highestPrice - trailDistance : highestPrice + trailDistance;
    
    // Déplacer le stop vers le haut uniquement (pour long)
    if (isLong && proposedStop > newStopLoss) {
      newStopLoss = proposedStop;
    } else if (!isLong && proposedStop < newStopLoss) {
      newStopLoss = proposedStop;
    }
    
    // Option: déplacer à breakeven à un certain niveau
    if (config.breakevenAtPercent && profitPercent >= config.breakevenAtPercent) {
      const breakevenPrice = isLong ? entryPrice * 1.001 : entryPrice * 0.999;
      if (isLong && initialStopLoss < breakevenPrice && newStopLoss < breakevenPrice) {
        newStopLoss = breakevenPrice;
        toBreakeven = true;
      } else if (!isLong && initialStopLoss > breakevenPrice && newStopLoss > breakevenPrice) {
        newStopLoss = breakevenPrice;
        toBreakeven = true;
      }
    }
  }
  
  return { newStopLoss, profitPercent, triggered, toBreakeven };
}

// ==========================================
// VALIDATION DES TRADES
// ==========================================

export function validateTradeRisk(
  symbol: string,
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  accountBalance: number,
  riskPercent: number,
  openTrades: { symbol: string; riskPercent: number }[],
  dailyLoss: number,
  config: RiskConfig
): TradeRiskValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestedActions: string[] = [];
  
  const calc = calculatePositionSizeDetailed(
    accountBalance,
    riskPercent,
    entryPrice,
    stopLoss,
    takeProfit
  );
  
  // Vérification 1: Risk/Reward minimum
  if (calc.riskRewardRatio < config.minRiskReward) {
    errors.push(`Risk/Reward ${calc.riskRewardRatio.toFixed(2)} < ${config.minRiskReward} minimum`);
    suggestedActions.push(`Augmenter le take profit ou rapprocher le stop loss`);
  }
  
  // Vérification 2: Risque par trade
  if (riskPercent > config.maxRiskPerTrade) {
    errors.push(`Risque ${riskPercent}% > ${config.maxRiskPerTrade}% maximum par trade`);
    suggestedActions.push(`Réduire le risque à ${config.maxRiskPerTrade}%`);
  }
  
  // Vérification 3: Risque journalier
  const projectedDailyLoss = dailyLoss + calc.riskAmount;
  const dailyLossLimit = accountBalance * (config.maxRiskPerDay / 100);
  if (projectedDailyLoss > dailyLossLimit) {
    errors.push(`Limite journalière atteinte: $${projectedDailyLoss.toFixed(0)} / $${dailyLossLimit.toFixed(0)}`);
    suggestedActions.push(`Attendre demain ou réduire le risque`);
  }
  
  // Vérification 4: Nombre max de trades ouverts
  if (openTrades.length >= config.maxOpenTrades) {
    errors.push(`Maximum ${config.maxOpenTrades} trades simultanés atteint`);
    suggestedActions.push(`Fermer un trade avant d'en ouvrir un nouveau`);
  }
  
  // Vérification 5: Exposition totale
  const totalExposure = openTrades.reduce((sum, t) => sum + t.riskPercent, 0) + riskPercent;
  if (totalExposure > config.maxExposure) {
    warnings.push(`Exposition totale ${totalExposure.toFixed(1)}% > ${config.maxExposure}% recommandé`);
    suggestedActions.push(`Réduire la taille des positions ouvertes`);
  }
  
  // Vérification 6: Distance du stop
  if (calc.stopDistancePercent > 5) {
    warnings.push(`Stop loss éloigné (${calc.stopDistancePercent.toFixed(1)}%). Risque de slippage`);
    suggestedActions.push(`Repositionner le stop loss plus proche ou accepter le risque`);
  }
  
  // Vérification 7: Corrélation
  const correlatedTrades = openTrades.filter(t => t.symbol === symbol);
  if (correlatedTrades.length > 0) {
    warnings.push(`Position déjà ouverte sur ${symbol}. Risque de concentration`);
    suggestedActions.push(`Considérer un autre symbole ou augmenter la diversification`);
  }
  
  // Calcul du score de risque (0-100, plus c'est bas mieux c'est)
  let riskScore = 50;
  if (calc.riskRewardRatio >= 2) riskScore -= 15;
  if (calc.riskRewardRatio >= 3) riskScore -= 10;
  if (riskPercent <= 1) riskScore -= 15;
  if (riskPercent <= 2) riskScore -= 10;
  if (totalExposure < 5) riskScore -= 10;
  if (errors.length > 0) riskScore += errors.length * 15;
  if (warnings.length > 0) riskScore += warnings.length * 5;
  riskScore = Math.max(0, Math.min(100, riskScore));
  
  const valid = errors.length === 0;
  
  return {
    tradeId: undefined,
    symbol,
    valid,
    errors,
    warnings,
    riskPercent,
    riskRewardRatio: calc.riskRewardRatio,
    positionSize: calc.positionSize,
    riskScore,
    passesAllChecks: valid && warnings.length === 0,
    suggestedActions,
  };
}

// ==========================================
// MÉTRIQUES GLOBALES DE RISQUE
// ==========================================

export function calculateGlobalRiskMetrics(
  trades: { 
    status: 'open' | 'closed'; 
    pnl: number; 
    entryPrice: number; 
    quantity: number;
    symbol: string;
    stopLoss?: number;
  }[],
  accountBalance: number,
  config: RiskConfig
): GlobalRiskMetrics {
  const openTrades = trades.filter(t => t.status === 'open');
  
  // Exposition totale
  const totalExposure = openTrades.reduce((sum, t) => sum + (t.entryPrice * t.quantity), 0);
  const exposurePercent = accountBalance > 0 ? (totalExposure / accountBalance) * 100 : 0;
  
  // P&L journalier
  const today = new Date().toDateString();
  const dailyPnl = trades
    .filter(t => t.status === 'closed' && new Date().toDateString() === today)
    .reduce((sum, t) => sum + t.pnl, 0);
  const dailyPnlPercent = accountBalance > 0 ? (dailyPnl / accountBalance) * 100 : 0;
  
  // P&L non réalisé
  const unrealizedPnl = openTrades.reduce((sum, t) => sum + t.pnl, 0);
  
  // Drawdown courant
  const peakBalance = accountBalance + Math.max(0, unrealizedPnl);
  const currentDrawdown = peakBalance > 0 ? ((peakBalance - accountBalance) / peakBalance) * 100 : 0;
  const maxDrawdownReached = currentDrawdown >= config.maxDrawdown;
  
  // Risque de corrélation (simplifié)
  const uniqueSymbols = new Set(openTrades.map(t => t.symbol)).size;
  const correlationRisk = openTrades.length > 0 
    ? Math.round((1 - uniqueSymbols / openTrades.length) * 100)
    : 0;
  
  // Niveau de risque global
  let riskLevel: 'safe' | 'caution' | 'danger' | 'critical';
  if (maxDrawdownReached || exposurePercent > 50) {
    riskLevel = 'critical';
  } else if (dailyPnlPercent < -config.maxRiskPerDay || exposurePercent > 30) {
    riskLevel = 'danger';
  } else if (exposurePercent > 15 || openTrades.length > config.maxOpenTrades / 2) {
    riskLevel = 'caution';
  } else {
    riskLevel = 'safe';
  }
  
  return {
    totalExposure,
    exposurePercent,
    openTradeCount: openTrades.length,
    correlationRisk,
    dailyPnl,
    dailyPnlPercent,
    unrealizedPnl,
    currentDrawdown,
    maxDrawdownReached,
    riskLevel,
  };
}

// ==========================================
// LIMITES DE RISQUE
// ==========================================

export function checkRiskLimits(
  accountBalance: number,
  dailyLoss: number,
  maxDrawdown: number,
  config: RiskConfig
): RiskLimits {
  const dailyLossLimit = accountBalance * (config.maxRiskPerDay / 100);
  const dailyLossUsed = Math.abs(dailyLoss);
  const dailyLossRemaining = Math.max(0, dailyLossLimit - dailyLossUsed);
  
  const maxDrawdownReached = maxDrawdown >= config.maxDrawdown;
  
  const currentExposure = 0; // Sera calculé dynamiquement
  const maxExposureLimit = accountBalance * (config.maxExposure / 100);
  const maxExposureReached = currentExposure >= maxExposureLimit;
  
  let tradesAllowed = true;
  let blockedReason: string | undefined;
  
  if (maxDrawdownReached && config.autoPauseOnDrawdown) {
    tradesAllowed = false;
    blockedReason = `Drawdown maximum atteint (${maxDrawdown.toFixed(1)}%)`;
  } else if (dailyLossUsed >= dailyLossLimit && config.autoPauseOnLossLimit) {
    tradesAllowed = false;
    blockedReason = `Limite de perte journalière atteinte`;
  }
  
  return {
    dailyLossUsed,
    dailyLossRemaining,
    maxDrawdownReached,
    currentDrawdown: maxDrawdown,
    maxExposureReached,
    currentExposure,
    tradesAllowed,
    blockedReason,
  };
}

// ==========================================
// CONFIGURATION PAR DÉFAUT
// ==========================================

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxRiskPerTrade: 2,      // 2% par trade
  maxRiskPerDay: 5,        // 5% par jour
  maxDrawdown: 10,         // 10% max drawdown
  maxOpenTrades: 5,        // Max 5 trades ouverts
  maxExposure: 20,         // 20% exposition max
  minRiskReward: 1.5,      // R/R minimum 1:1.5
  autoPauseOnLossLimit: true,
  autoPauseOnDrawdown: true,
  enableTrailingStop: true,
  trailingStopPercent: 1,  // 1% trailing
  enableKellyCriterion: false,
  kellyFraction: 0.5,      // Half-Kelly
};

// ==========================================
// FONCTIONS UTILITAIRES
// ==========================================

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getRiskLevelColor(level: 'safe' | 'caution' | 'danger' | 'critical'): string {
  switch (level) {
    case 'safe': return 'text-green-400';
    case 'caution': return 'text-yellow-400';
    case 'danger': return 'text-orange-400';
    case 'critical': return 'text-red-500';
    default: return 'text-gray-400';
  }
}

export function getRiskLevelBg(level: 'safe' | 'caution' | 'danger' | 'critical'): string {
  switch (level) {
    case 'safe': return 'bg-green-500/20';
    case 'caution': return 'bg-yellow-500/20';
    case 'danger': return 'bg-orange-500/20';
    case 'critical': return 'bg-red-500/20';
    default: return 'bg-gray-500/20';
  }
}
