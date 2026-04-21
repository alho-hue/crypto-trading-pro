/**
 * NEUROVEST - Learning Service (Frontend)
 * Service pour interagir avec le système d'apprentissage automatique Ethernal
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Types
export interface LearningReport {
  memory: {
    userId: string;
    totalTrades: number;
    winningPatterns: {
      bySymbol: Record<string, { count: number; totalPnl: number; avgPnl: number }>;
      byStrategy: Record<string, { count: number; totalPnl: number; winRate: number }>;
      byDirection: Record<string, { count: number; totalPnl: number }>;
    };
    losingPatterns: any;
    bestSetups: Array<{
      symbol: string;
      side: string;
      entryPrice: number;
      stopLoss: number;
      takeProfit: number;
      pnl: number;
      pnlPercent?: number;
      strategy: string;
      reasoning: string;
    }>;
    worstSetups: Array<{
      symbol: string;
      side: string;
      pnl: number;
      pnlPercent?: number;
      exitReason: string;
      strategy: string;
    }>;
    optimalParameters: {
      riskRewardRatio: number;
      avgTradeDuration: number;
      optimalStopDistance: number;
      recommendedLeverage: number;
      positionSizePercent: number;
    } | null;
  };
  strategyScores: StrategyScore[];
  recommendations: string[];
  lastUpdated: Date;
}

export interface StrategyScore {
  strategy: string;
  totalTrades: number;
  winRate: number;
  totalProfit: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  expectancy: number;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendation: 'use' | 'caution' | 'avoid';
}

export interface PatternDetection {
  symbol: string;
  timeframe: string;
  timestamp: Date;
  detected: string[];
  confidence: number;
  trendDirection?: 'up' | 'down';
  support?: number;
  resistance?: number;
  recommendation: {
    action: 'long' | 'short' | 'range' | 'wait';
    confidence: number;
    support?: number;
    resistance?: number;
  };
}

export interface TradeAnalysis {
  tradeId: string;
  symbol: string;
  result: 'win' | 'loss';
  pnl: number;
  pnlPercent: number;
  exitReason: string;
  lessons: string[];
  improvements: string[];
  aiExplanation: string;
  similarTrades: any[];
  marketContext: {
    regime: string;
    volatility: string;
  };
}

export interface SetupRecommendation {
  symbol: string;
  action: string;
  confidence: number;
  reasons: string[];
  optimalParameters: {
    riskRewardRatio: number;
    avgTradeDuration: number;
    optimalStopDistance: number;
    recommendedLeverage: number;
    positionSizePercent: number;
  } | null;
  warnings: string[];
}

// Helper
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// ========== RAPPORT D'APPRENTISSAGE ==========
export async function getLearningReport(): Promise<{ success: boolean; report: LearningReport }> {
  const response = await fetch(`${API_URL}/api/learning/report`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== MÉMOIRE ==========
export async function getUserMemory(): Promise<{ success: boolean; memory: LearningReport['memory'] }> {
  const response = await fetch(`${API_URL}/api/learning/memory`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== STRATÉGIES ==========
export async function getStrategyScores(): Promise<{
  success: boolean;
  strategies: StrategyScore[];
  totalStrategies: number;
  recommended: string[];
  avoid: string[];
}> {
  const response = await fetch(`${API_URL}/api/learning/strategies`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function getStrategyScore(strategyName: string): Promise<{ success: boolean; score: StrategyScore }> {
  const response = await fetch(`${API_URL}/api/learning/strategies/${encodeURIComponent(strategyName)}/score`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== DÉTECTION PATTERNS ==========
export async function detectPatterns(
  symbol: string,
  priceData: Array<{ open: number; high: number; low: number; close: number; volume?: number }>,
  timeframe = '1h'
): Promise<{ success: boolean; patterns: PatternDetection }> {
  const response = await fetch(`${API_URL}/api/learning/detect-patterns`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ symbol, timeframe, priceData })
  });
  return handleResponse(response);
}

// ========== ANALYSE TRADE ==========
export async function analyzeTrade(tradeId: string): Promise<{ success: boolean; analysis: TradeAnalysis }> {
  const response = await fetch(`${API_URL}/api/learning/trades/${tradeId}/analysis`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== RECOMMANDATIONS ==========
export async function getSetupRecommendation(
  symbol: string,
  priceData?: Array<{ open: number; high: number; low: number; close: number }>
): Promise<{ success: boolean; recommendation: SetupRecommendation }> {
  const response = await fetch(`${API_URL}/api/learning/recommend-setup`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ symbol, priceData })
  });
  return handleResponse(response);
}

// ========== OPTIMISATION ==========
export async function optimizeStrategy(strategyName: string): Promise<{
  success: boolean;
  optimization: {
    strategy: string;
    currentScore: number;
    recommendations: string[];
    parameterAdjustments: Record<string, number>;
  }
}> {
  const response = await fetch(`${API_URL}/api/learning/strategies/${encodeURIComponent(strategyName)}/optimize`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== STATS ==========
export async function getLearningStats(): Promise<{
  success: boolean;
  stats: {
    totalBotTrades: number;
    analyzedTrades: number;
    learningProgress: number;
  }
}> {
  const response = await fetch(`${API_URL}/api/learning/stats`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== FEEDBACK ==========
export async function submitFeedback(
  tradeId: string,
  feedback: { accuracy: number; comment?: string; helpful: boolean }
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_URL}/api/learning/feedback`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ tradeId, feedback })
  });
  return handleResponse(response);
}

// ========== UTILITAIRES ==========
export function formatGrade(grade: string): { color: string; text: string } {
  const grades: Record<string, { color: string; text: string }> = {
    'A': { color: 'text-green-400', text: 'Excellente' },
    'B': { color: 'text-blue-400', text: 'Bonne' },
    'C': { color: 'text-yellow-400', text: 'Moyenne' },
    'D': { color: 'text-orange-400', text: 'Faible' },
    'F': { color: 'text-red-400', text: 'À éviter' }
  };
  return grades[grade] || { color: 'text-gray-400', text: 'Inconnue' };
}

export function getRecommendationColor(recommendation: string): string {
  const colors: Record<string, string> = {
    'use': 'text-green-400',
    'caution': 'text-yellow-400',
    'avoid': 'text-red-400'
  };
  return colors[recommendation] || 'text-gray-400';
}
