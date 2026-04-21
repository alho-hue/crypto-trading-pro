// Auto-trading API service for NEUROVEST
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Types
export interface AutoTradingConfig {
  enabled: boolean;
  strategy: 'conservative' | 'moderate' | 'aggressive';
  symbols: string[];
  maxRiskPerTrade: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  trailingStopPercent: number;
  autoBuy: boolean;
  autoSell: boolean;
  minConfidence: number;
  maxPositions: number;
  useLeverage: boolean;
  leverage: number;
  maxDailyTrades: number;
  maxDailyLossPercent: number;
  maxDrawdownPercent: number;
  useKellyCriterion: boolean;
  kellyFraction: number;
  useMultiTimeframe: boolean;
  paperTrading: boolean;
}

export interface BotStatus {
  enabled: boolean;
  active: boolean;
  strategy: string;
  symbols: string[];
  dailyTradeCount: number;
  maxDailyTrades: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  winRate: number;
  lastTradeTime?: string;
  startTime?: string;
  paperTrading: boolean;
  message?: string;
}

export interface PerformanceStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  dailyTradeCount: number;
  maxDailyTrades: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface BacktestResult {
  symbol: string;
  startDate: string;
  endDate: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  avgTrade: number;
  avgWin: number;
  avgLoss: number;
  trades: Array<{
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    duration: number;
    exitReason: string;
  }>;
}

export interface Trade {
  _id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  pnlPercent?: number;
  status: 'open' | 'closed' | 'cancelled';
  isAutoTrade: boolean;
  strategy?: string;
  reasoning?: string;
  paperTrading?: boolean;
  entryTime: string;
  exitTime?: string;
}

// Helper function to get auth headers
function getHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

// Enable auto-trading
export async function enableAutoTrading(config: Partial<AutoTradingConfig>): Promise<{ success: boolean; config?: AutoTradingConfig; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/auto-trading/enable`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(config)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, config: data.config };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Disable auto-trading
export async function disableAutoTrading(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/auto-trading/disable`, {
      method: 'POST',
      headers: getHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get bot status
export async function getBotStatus(): Promise<BotStatus | null> {
  try {
    const response = await fetch(`${API_URL}/api/auto-trading/status`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    return null;
  }
}

// Get configuration
export async function getAutoTradingConfig(): Promise<AutoTradingConfig | null> {
  try {
    const response = await fetch(`${API_URL}/api/auto-trading/config`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    return null;
  }
}

// Update configuration
export async function updateAutoTradingConfig(updates: Partial<AutoTradingConfig>): Promise<{ success: boolean; config?: AutoTradingConfig; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/auto-trading/config`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, config: data.config };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get performance stats
export async function getPerformanceStats(): Promise<PerformanceStats | null> {
  try {
    const response = await fetch(`${API_URL}/api/auto-trading/performance`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    return null;
  }
}

// Get trade history
export async function getTradeHistory(limit: number = 50): Promise<Trade[]> {
  try {
    const response = await fetch(`${API_URL}/api/auto-trading/trades?limit=${limit}`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      return [];
    }
    
    return await response.json();
  } catch (error) {
    return [];
  }
}

// Get open positions
export async function getOpenPositions(): Promise<Trade[]> {
  try {
    const response = await fetch(`${API_URL}/api/auto-trading/open-positions`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      return [];
    }
    
    return await response.json();
  } catch (error) {
    return [];
  }
}

// Toggle paper trading
export async function togglePaperTrading(enabled: boolean): Promise<{ success: boolean; paperTrading?: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/auto-trading/paper-trading`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ enabled })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, paperTrading: data.paperTrading };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Run backtest
export async function runBacktest(
  symbol: string,
  startDate: string,
  endDate: string,
  strategy: string = 'moderate'
): Promise<{ success: boolean; result?: BacktestResult; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/auto-trading/backtest`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ symbol, startDate, endDate, strategy })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, result: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Execute manual trade
export async function executeManualTrade(
  symbol: string,
  side: 'buy' | 'sell',
  confidence: number = 80
): Promise<{ success: boolean; trade?: Trade; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/auto-trading/manual-trade`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ symbol, side, confidence })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, trade: data.trade };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get correlation matrix
export async function getCorrelationMatrix(symbols: string[]): Promise<Record<string, Record<string, number>> | null> {
  try {
    const response = await fetch(
      `${API_URL}/api/auto-trading/correlation?symbols=${symbols.join(',')}`,
      { headers: getHeaders() }
    );
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    return null;
  }
}
