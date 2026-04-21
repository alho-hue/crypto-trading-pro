// Portfolio API service for NEUROVEST
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Types
export interface Portfolio {
  totalValue: number;
  assets: Array<{
    symbol: string;
    free: number;
    locked: number;
    total: number;
    value: number;
    percentage: number;
  }>;
  allocation: Record<string, number>;
  lastUpdated: string;
}

export interface PortfolioPerformance {
  period: string;
  totalValue: number;
  returnValue: number;
  returnPercentage: number;
  startValue: number;
  assets: Array<{
    symbol: string;
    free: number;
    locked: number;
    total: number;
    value: number;
    percentage: number;
    returnPercentage: number;
    startPrice?: number;
    currentPrice?: number;
  }>;
  calculatedAt: string;
}

export interface PnLData {
  totalValue: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  realizedPnLPercentage: number;
  unrealizedPnLPercentage: number;
  totalPnLPercentage: number;
  totalTrades: number;
  openPositions: number;
  assets: Array<{
    symbol: string;
    realizedPnL: number;
    unrealizedPnL: number;
    totalPnL: number;
    trades: number;
  }>;
  calculatedAt: string;
}

export interface RebalancingRecommendation {
  symbol: string;
  currentPercentage: number;
  targetPercentage: number;
  difference: number;
  action: 'buy' | 'sell';
  amount: number;
}

export interface RebalancingResult {
  needsRebalancing: boolean;
  recommendations: RebalancingRecommendation[];
}

// Helper function to get auth headers
function getHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

// Get portfolio
export async function getPortfolio(): Promise<Portfolio | null> {
  try {
    const response = await fetch(`${API_URL}/api/portfolio`, {
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

// Get portfolio performance
export async function getPortfolioPerformance(period: string = '7d'): Promise<PortfolioPerformance | null> {
  try {
    const response = await fetch(`${API_URL}/api/portfolio/performance?period=${period}`, {
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

// Get P&L
export async function getPnL(): Promise<PnLData | null> {
  try {
    const response = await fetch(`${API_URL}/api/portfolio/pnl`, {
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

// Get diversification analysis
export async function getDiversification(): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/portfolio/diversification`, {
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

// Get portfolio report
export async function getPortfolioReport(): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/portfolio/report`, {
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

// Get recommendations
export async function getRecommendations(): Promise<any[]> {
  try {
    const response = await fetch(`${API_URL}/api/portfolio/recommendations`, {
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

// Optimize allocation
export async function optimizeAllocation(
  assets: string[],
  riskProfile: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
): Promise<any[]> {
  try {
    const response = await fetch(`${API_URL}/api/portfolio/optimize`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ assets, riskProfile })
    });
    
    if (!response.ok) {
      return [];
    }
    
    return await response.json();
  } catch (error) {
    return [];
  }
}

// Get rebalancing recommendations
export async function getRebalancingRecommendations(
  targetAllocation: Array<{ symbol: string; percentage: number }>
): Promise<RebalancingResult | null> {
  try {
    const response = await fetch(`${API_URL}/api/portfolio/rebalancing/recommend`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ targetAllocation })
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    return null;
  }
}

// Execute rebalancing
export async function executeRebalancing(
  recommendations: RebalancingRecommendation[]
): Promise<{ success: boolean; executedTrades?: any[]; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/portfolio/rebalancing/execute`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ recommendations })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, executedTrades: data.executedTrades };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get balances
export async function getBalances(): Promise<any[]> {
  try {
    const response = await fetch(`${API_URL}/api/portfolio/balances`, {
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

// Get asset info
export async function getAssetInfo(symbol: string): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/portfolio/asset/${symbol}`, {
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

// Get portfolio history
export async function getPortfolioHistory(days: number = 30): Promise<any[]> {
  try {
    const response = await fetch(`${API_URL}/api/portfolio/history?days=${days}`, {
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
