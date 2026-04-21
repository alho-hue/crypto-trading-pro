/**
 * NEUROVEST - Trade Service (Frontend)
 * Service centralisé pour la gestion des trades côté client
 * Intégration avec tous les composants
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// WebSocket store mock pour la compatibilité
type WebSocketStore = {
  on: (event: string, callback: Function) => void;
  off: (event: string, callback: Function) => void;
  getState: () => any;
};

const useWebSocketStore: WebSocketStore = {
  getState: () => ({
    on: () => {},
    off: () => {}
  }),
  on: () => {},
  off: () => {}
};

export interface Trade {
  _id: string;
  userId: string;
  symbol: string;
  side: 'buy' | 'sell' | 'LONG' | 'SHORT';
  type: 'market' | 'limit' | 'stop_loss' | 'take_profit' | 'trailing_stop';
  quantity: number;
  filledQuantity: number;
  entryPrice: number;
  averageEntryPrice?: number;
  exitPrice?: number;
  averageExitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStopPercent?: number;
  pnl?: number;
  pnlPercent?: number;
  unrealizedPnl?: number;
  fees: number;
  status: 'pending' | 'open' | 'partially_filled' | 'closed' | 'cancelled' | 'rejected';
  orderId?: string;
  clientOrderId?: string;
  isAutoTrade: boolean;
  paperTrading: boolean;
  leverage: number;
  marginType: 'isolated' | 'crossed';
  source: 'manual' | 'bot' | 'ai';
  strategy?: string;
  reasoning?: string;
  confidence?: number;
  entryTime: Date;
  exitTime?: Date;
  exitReason?: 'stop_loss' | 'take_profit' | 'trailing_stop' | 'manual' | 'signal' | 'liquidation' | 'timeout' | 'system';
  duration?: number;
  lastUpdateTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TradeStats {
  totalTrades: number;
  openTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalWins: number;
  totalLosses: number;
  profitFactor: number;
  averageProfit: number;
  bestTrade: number;
  worstTrade: number;
  unrealizedPnl: number;
  tradesBySource: {
    manual: number;
    bot: number;
    ai: number;
  };
  tradesByExitReason: Record<string, number>;
}

export interface CreateTradeData {
  symbol: string;
  side: 'buy' | 'sell' | 'LONG' | 'SHORT';
  type?: 'market' | 'limit';
  quantity: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
  marginType?: 'isolated' | 'crossed';
  source?: 'manual' | 'bot' | 'ai';
  strategy?: string;
  reasoning?: string;
  confidence?: number;
  paperTrading?: boolean;
}

export interface TradeValidationResult {
  valid: boolean;
  errors: string[];
  riskPercent: number;
}

export interface TradeHistoryFilters {
  startDate?: string;
  endDate?: string;
  symbol?: string;
  source?: 'manual' | 'bot' | 'ai';
  minPnl?: number;
  maxPnl?: number;
  page?: number;
  limit?: number;
}

// ========== AUTH UTILS ==========
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    return response.json().then(err => {
      throw new Error(err.error || `HTTP ${response.status}`);
    });
  }
  return response.json();
}

// ========== CRÉATION ==========
export async function createTrade(data: CreateTradeData): Promise<{ success: boolean; trade: Trade; message: string }> {
  const response = await fetch(`${API_URL}/api/trades/v2/create`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
}

export async function validateTrade(data: CreateTradeData): Promise<TradeValidationResult> {
  const response = await fetch(`${API_URL}/api/trades/v2/validate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse(response);
}

// ========== EXÉCUTION ==========
export async function executeTrade(
  tradeId: string, 
  executionData: { 
    orderId: string; 
    filledQuantity: number; 
    averagePrice: number; 
    fees?: number 
  }
): Promise<{ success: boolean; trade: Trade }> {
  const response = await fetch(`${API_URL}/api/trades/v2/execute/${tradeId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(executionData)
  });
  return handleResponse(response);
}

// ========== FERMETURE ==========
export async function closeTrade(
  tradeId: string, 
  exitPrice: number, 
  exitReason: string = 'manual'
): Promise<{ success: boolean; trade: Trade; pnl: number; pnlPercent: number }> {
  const response = await fetch(`${API_URL}/api/trades/v2/close/${tradeId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ exitPrice, exitReason })
  });
  return handleResponse(response);
}

// ========== RÉCUPÉRATION ==========
export async function getUserTrades(status?: 'open' | 'closed' | 'pending'): Promise<{ success: boolean; trades: Trade[]; count: number }> {
  const url = new URL(`${API_URL}/api/trades/v2/my-trades`);
  if (status) url.searchParams.append('status', status);
  
  const response = await fetch(url.toString(), {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function getTradeHistory(filters?: TradeHistoryFilters): Promise<{
  success: boolean;
  trades: Trade[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}> {
  const url = new URL(`${API_URL}/api/trades/v2/history`);
  
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.append(key, String(value));
    });
  }
  
  const response = await fetch(url.toString(), {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function getTradeStats(): Promise<{ success: boolean; stats: TradeStats }> {
  const response = await fetch(`${API_URL}/api/trades/v2/stats`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== MISE À JOUR ==========
export async function updateTrade(
  tradeId: string, 
  updates: { 
    stopLoss?: number; 
    takeProfit?: number; 
    trailingStopPercent?: number 
  }
): Promise<{ success: boolean; trade: Trade }> {
  const response = await fetch(`${API_URL}/api/trades/v2/${tradeId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  return handleResponse(response);
}

export async function cancelTrade(tradeId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_URL}/api/trades/v2/${tradeId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== WEBSOCKET INTÉGRATION ==========
export function subscribeToTradeEvents(
  callbacks: {
    onTradeCreated?: (trade: Trade) => void;
    onTradeExecuted?: (trade: Trade) => void;
    onTradeUpdate?: (data: { tradeId: string; unrealizedPnl: number; pnlPercent: number; currentPrice: number }) => void;
    onTradeClosed?: (trade: Trade) => void;
    onNotification?: (notification: any) => void;
  }
) {
  // TODO: Implémenter avec Socket.IO réel
  console.log('[TradeService] WebSocket subscription initialized');
  
  // Retourner fonction de nettoyage
  return () => {
    console.log('[TradeService] WebSocket subscription cleaned up');
  };
}

// ========== UTILITAIRES ==========
export function calculatePositionSize(
  accountBalance: number,
  entryPrice: number,
  stopLoss: number,
  riskPercent: number = 2,
  leverage: number = 1
): number {
  const riskAmount = accountBalance * (riskPercent / 100);
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const positionSize = (riskAmount / stopDistance) * leverage;
  return Math.floor(positionSize * 1000) / 1000; // Arrondir à 3 décimales
}

export function calculatePnL(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  side: 'buy' | 'sell' | 'LONG' | 'SHORT',
  leverage: number = 1
): { pnl: number; pnlPercent: number } {
  const isLong = side.toLowerCase() === 'buy' || side === 'LONG';
  const priceDiff = isLong ? exitPrice - entryPrice : entryPrice - exitPrice;
  const pnl = priceDiff * quantity * leverage;
  const invested = entryPrice * quantity / leverage;
  const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
  
  return { pnl, pnlPercent };
}

export function formatTradeDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}j ${Math.floor((seconds % 86400) / 3600)}h`;
}

export function getTradeStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'text-yellow-400',
    open: 'text-blue-400',
    partially_filled: 'text-purple-400',
    closed: 'text-gray-400',
    cancelled: 'text-red-400',
    rejected: 'text-red-500'
  };
  return colors[status] || 'text-gray-400';
}

export function getTradeSourceIcon(source: string): string {
  const icons: Record<string, string> = {
    manual: '👤',
    bot: '🤖',
    ai: '🧠'
  };
  return icons[source] || '👤';
}
