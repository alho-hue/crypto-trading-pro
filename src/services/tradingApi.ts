/**
 * NEUROVEST - Trading API Frontend Service
 * 
 * IMPORTANT: Ce service appelle UNIQUEMENT le backend.
 * Aucun appel direct à l'API Binance n'est fait ici.
 * Les clés API restent sécurisées côté backend.
 */

import { createTrade as createCentralizedTrade, type CreateTradeData } from './tradeService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Helper to get auth token from localStorage
function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

// Types
export interface TradeParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  isDemo?: boolean;
}

export interface FuturesTradeParams extends TradeParams {
  leverage?: number;
}

export interface TradeResult {
  success: boolean;
  demoMode: boolean;
  order?: {
    id: string;
    symbol: string;
    side: string;
    type: string;
    quantity: number;
    price: number;
    stopLoss?: number;
    takeProfit?: number;
    fees: number;
    timestamp: number;
  };
  risk?: {
    valid: boolean;
    positionPercent: number;
    riskRewardRatio: number;
    errors?: string[];
  };
  error?: string;
  code?: number;
  timestamp: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT' | 'BUY' | 'SELL';
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage?: number;
  margin?: number;
  unrealizedPnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  liquidationPrice?: number;
  openTime: number;
  fees?: number;
}

export interface Balance {
  balance: number;
  totalBalance?: number;
  locked?: number;
  currency: string;
  demoMode: boolean;
}

// Helper pour les requêtes authentifiées
async function authenticatedRequest(
  endpoint: string, 
  method: string = 'GET', 
  body?: any
): Promise<any> {
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options: RequestInit = {
    method,
    headers
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  
  return data;
}

/**
 * ==================== EXÉCUTION TRADES ====================
 */

/**
 * Placer un ordre Spot (Market ou Limit)
 * SL et TP sont OBLIGATOIRES
 */
export async function placeSpotOrder(params: TradeParams): Promise<TradeResult> {
  try {
    const result = await authenticatedRequest('/api/trading/order/spot', 'POST', params);
    
    // Créer le trade dans le système centralisé si succès
    if (result.success && result.order) {
      try {
        const tradeData: CreateTradeData = {
          symbol: params.symbol,
          side: params.side === 'BUY' ? 'buy' : 'sell',
          type: params.type === 'MARKET' ? 'market' : 'limit',
          quantity: params.quantity,
          entryPrice: result.order.price,
          stopLoss: params.stopLoss,
          takeProfit: params.takeProfit,
          leverage: 1, // Spot = levier 1
          paperTrading: params.isDemo || false,
          source: 'manual'
        };
        
        await createCentralizedTrade(tradeData);
        console.log('[TradingApi] Trade centralisé créé:', result.order.id);
      } catch (tradeError) {
        console.warn('[TradingApi] Échec création trade centralisé:', tradeError);
        // Ne pas bloquer l'exécution si la création centralisée échoue
      }
    }
    
    return result;
  } catch (error) {
    console.error('Spot order failed:', error);
    return {
      success: false,
      demoMode: params.isDemo || false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    };
  }
}

/**
 * Placer un ordre Futures (Long/Short avec levier)
 * SL et TP sont OBLIGATOIRES
 */
export async function placeFuturesOrder(params: FuturesTradeParams): Promise<TradeResult> {
  try {
    const result = await authenticatedRequest('/api/trading/order/futures', 'POST', params);
    
    // Créer le trade dans le système centralisé si succès
    if (result.success && result.order) {
      try {
        const tradeData: CreateTradeData = {
          symbol: params.symbol,
          side: params.side === 'BUY' ? 'LONG' : 'SHORT',
          type: params.type === 'MARKET' ? 'market' : 'limit',
          quantity: params.quantity,
          entryPrice: result.order.price,
          stopLoss: params.stopLoss,
          takeProfit: params.takeProfit,
          leverage: params.leverage || 1,
          paperTrading: params.isDemo || false,
          source: 'manual'
        };
        
        await createCentralizedTrade(tradeData);
        console.log('[TradingApi] Futures trade centralisé créé:', result.order.id);
      } catch (tradeError) {
        console.warn('[TradingApi] Échec création trade centralisé:', tradeError);
        // Ne pas bloquer l'exécution si la création centralisée échoue
      }
    }
    
    return result;
  } catch (error) {
    console.error('Futures order failed:', error);
    return {
      success: false,
      demoMode: params.isDemo || false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    };
  }
}

/**
 * Fermer une position ouverte
 */
export async function closePosition(
  positionId: string,
  symbol: string,
  side: string,
  size: number,
  isDemo: boolean = false
): Promise<{ success: boolean; pnl?: number; error?: string }> {
  try {
    const result = await authenticatedRequest('/api/trading/position/close', 'POST', {
      positionId,
      symbol,
      side,
      size,
      isDemo
    });
    
    return {
      success: true,
      pnl: result.closed?.pnl
    };
  } catch (error) {
    console.error('Close position failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * ==================== DONNÉES COMPTES ====================
 */

/**
 * Récupérer le solde du compte
 */
export async function getTradingBalance(isDemo: boolean = false): Promise<Balance> {
  try {
    const result = await authenticatedRequest(`/api/trading/balance?isDemo=${isDemo}`);
    
    return {
      balance: result.balance,
      totalBalance: result.totalBalance,
      locked: result.locked,
      currency: result.currency || 'USDT',
      demoMode: result.demoMode
    };
  } catch (error) {
    console.error('Get balance failed:', error);
    throw error;
  }
}

/**
 * Récupérer les positions ouvertes avec PnL temps réel
 */
export async function getOpenPositions(isDemo: boolean = false): Promise<{
  positions: Position[];
  summary: {
    count: number;
    totalUnrealizedPnl: number;
    longCount: number;
    shortCount: number;
  };
}> {
  try {
    const result = await authenticatedRequest(`/api/trading/positions?isDemo=${isDemo}`);
    
    return {
      positions: result.positions || [],
      summary: result.summary || {
        count: 0,
        totalUnrealizedPnl: 0,
        longCount: 0,
        shortCount: 0
      }
    };
  } catch (error) {
    console.error('Get positions failed:', error);
    return {
      positions: [],
      summary: {
        count: 0,
        totalUnrealizedPnl: 0,
        longCount: 0,
        shortCount: 0
      }
    };
  }
}

/**
 * Mettre à jour les PnL temps réel
 */
export async function updatePnL(
  positions: Position[],
  isDemo: boolean = false
): Promise<{
  positions: Position[];
  totalUnrealizedPnl: number;
}> {
  try {
    const result = await authenticatedRequest('/api/trading/pnl/update', 'POST', {
      positions,
      isDemo
    });
    
    return {
      positions: result.positions || positions,
      totalUnrealizedPnl: result.totalUnrealizedPnl || 0
    };
  } catch (error) {
    console.error('Update PnL failed:', error);
    return {
      positions,
      totalUnrealizedPnl: positions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0)
    };
  }
}

/**
 * ==================== HISTORIQUE ====================
 */

/**
 * Récupérer l'historique des trades
 */
export async function getTradeHistory(
  isDemo: boolean = false,
  limit: number = 50
): Promise<{ trades: any[]; count: number }> {
  try {
    const result = await authenticatedRequest(
      `/api/trading/history?isDemo=${isDemo}&limit=${limit}`
    );
    
    return {
      trades: result.trades || [],
      count: result.count || 0
    };
  } catch (error) {
    console.error('Get trade history failed:', error);
    return {
      trades: [],
      count: 0
    };
  }
}

/**
 * ==================== MODE DÉMO ====================
 */

/**
 * Réinitialiser le compte démo
 */
export async function resetDemoAccount(): Promise<{ success: boolean; newBalance: number }> {
  try {
    const result = await authenticatedRequest('/api/trading/demo/reset', 'POST');
    return {
      success: true,
      newBalance: result.newBalance
    };
  } catch (error) {
    console.error('Reset demo failed:', error);
    return {
      success: false,
      newBalance: 0
    };
  }
}

/**
 * ==================== STATUS ====================
 */

/**
 * Récupérer le status du service de trading
 */
export async function getTradingStatus(): Promise<{
  binanceConnected: boolean;
  demoMode: boolean;
  riskConfig: {
    MAX_POSITION_PERCENT: number;
    MIN_POSITION_PERCENT: number;
    SL_TP_REQUIRED: boolean;
  };
}> {
  try {
    const result = await authenticatedRequest('/api/trading/status');
    return {
      binanceConnected: result.binanceConnected,
      demoMode: result.demoMode,
      riskConfig: result.riskConfig
    };
  } catch (error) {
    console.error('Get trading status failed:', error);
    return {
      binanceConnected: false,
      demoMode: true,
      riskConfig: {
        MAX_POSITION_PERCENT: 2,
        MIN_POSITION_PERCENT: 0.1,
        SL_TP_REQUIRED: true
      }
    };
  }
}

/**
 * ==================== UTILITAIRES ====================
 */

/**
 * Calculer les niveaux Stop Loss et Take Profit par défaut
 */
export function calculateDefaultSLTP(
  price: number,
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT',
  slPercent: number = 2,
  tpPercent: number = 4
): { stopLoss: number; takeProfit: number } {
  const isLong = side === 'BUY' || side === 'LONG';
  
  if (isLong) {
    return {
      stopLoss: price * (1 - slPercent / 100),
      takeProfit: price * (1 + tpPercent / 100)
    };
  } else {
    return {
      stopLoss: price * (1 + slPercent / 100),
      takeProfit: price * (1 - tpPercent / 100)
    };
  }
}

/**
 * Calculer la taille de position maximale selon les règles de risque
 */
export function calculateMaxPositionSize(
  balance: number,
  price: number,
  maxPercent: number = 2
): number {
  const maxValue = balance * (maxPercent / 100);
  return maxValue / price;
}

/**
 * Valider un trade avant exécution
 */
export function validateTrade(
  params: TradeParams,
  balance: number
): { valid: boolean; errors: string[]; warnings: string[]; positionPercent: number; riskRewardRatio: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const positionValue = params.quantity * (params.price || 0);
  const positionPercent = balance > 0 ? (positionValue / balance) * 100 : 0;
  let riskRewardRatio = 0;
  
  // Validation SL/TP
  if (!params.stopLoss || params.stopLoss <= 0) {
    errors.push('Stop Loss obligatoire');
  }
  if (!params.takeProfit || params.takeProfit <= 0) {
    errors.push('Take Profit obligatoire');
  }
  
  // Validation taille (très permissive comme le backend)
  if (positionPercent > 100) {
    errors.push(`Position ${positionPercent.toFixed(2)}% > 100% maximum`);
  }
  if (positionPercent > 80) {
    warnings.push('Position > 80% - Risqué');
  }
  
  // Validation Risk/Reward
  if (params.stopLoss && params.takeProfit && params.price) {
    const risk = Math.abs(params.price - params.stopLoss);
    const reward = Math.abs(params.takeProfit - params.price);
    riskRewardRatio = reward / risk;
    
    if (riskRewardRatio < 0.1) {
      errors.push(`Risk/Reward ${riskRewardRatio.toFixed(2)} < 0.1 minimum`);
    } else if (riskRewardRatio < 1.5) {
      warnings.push(`Risk/Reward ${riskRewardRatio.toFixed(2)} - Recommandé: 1.5+`);
    }
  }
  
  // Validation solde
  if (positionValue > balance) {
    errors.push(`Solde insuffisant: ${balance.toFixed(2)} USDT disponible`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    positionPercent,
    riskRewardRatio
  };
}
