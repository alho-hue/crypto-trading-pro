export interface CryptoPrice {
  symbol: string;
  price: number;
  change24h: number;
  change24hValue: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  pnlPercent?: number;
  strategy?: string;
  notes?: string;
  timestamp: number;
  status: 'open' | 'closed';
  stopLoss?: number;
  takeProfit?: number;
}

export interface TradingStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
}

export interface Alert {
  id: string;
  symbol: string;
  type: 'price' | 'indicator' | 'pattern';
  condition: 'above' | 'below' | 'crosses';
  value: number;
  message?: string;
  active: boolean;
  createdAt: number;
  triggeredAt?: number;
}

export interface RiskCalculation {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  accountSize: number;
  riskPercent: number;
  positionSize: number;
  positionValue: number;
  riskRewardRatio: number;
  maxLoss: number;
  potentialProfit: number;
}

export interface AISignal {
  symbol: string;
  direction: 'buy' | 'sell' | 'neutral';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  pattern?: string;
  explanation: string;
  timestamp: number;
  timeframe: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface IndicatorConfig {
  name: string;
  enabled: boolean;
  params: Record<string, number>;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type IndicatorType = 'sma' | 'ema' | 'rsi' | 'macd' | 'bollinger' | 'volume' | 'atr' | 'stochastic' | 'cci' | 'williams';

export type PatternType = 'hammer' | 'shootingStar' | 'engulfingBullish' | 'engulfingBearish' | 'doji' | 'morningStar' | 'eveningStar';

export interface ChartIndicator {
  type: IndicatorType;
  enabled: boolean;
  params: {
    period?: number;
    fastPeriod?: number;
    slowPeriod?: number;
    signalPeriod?: number;
    stdDev?: number;
  };
}

export type ViewType = 'dashboard' | 'analysis' | 'strategies' | 'alerts' | 'journal' | 'portfolio' | 'risk' | 'backtest' | 'settings';
