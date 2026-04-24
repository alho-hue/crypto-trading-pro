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

export type Timeframe = '1s' | '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M';

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

export type ViewType = 'dashboard' | 'analysis' | 'strategies' | 'alerts' | 'journal' | 'liveTrading' | 'tradeHistory' | 'portfolio' | 'wallet' | 'risk' | 'backtest' | 'settings' | 'widgetSettings' | 'tradingBot' | 'scanner' | 'futures' | 'community' | 'profile' | 'admin' | 'tradeManager' | 'learning' | 'newsDetail';

// ==================== RISK MANAGEMENT TYPES ====================

export interface RiskConfig {
  maxRiskPerTrade: number; // % (1-5%)
  maxRiskPerDay: number; // % (3-10%)
  maxDrawdown: number; // % (10-20%)
  maxOpenTrades: number;
  maxExposure: number; // % of capital
  minRiskReward: number; // minimum R:R (e.g., 1.5)
  autoPauseOnLossLimit: boolean;
  autoPauseOnDrawdown: boolean;
  enableTrailingStop: boolean;
  trailingStopPercent: number;
  enableKellyCriterion: boolean;
  kellyFraction: number; // 0.25, 0.5 (half-Kelly), 1.0 (full)
}

export interface RiskLimits {
  dailyLossUsed: number;
  dailyLossRemaining: number;
  maxDrawdownReached: boolean;
  currentDrawdown: number;
  maxExposureReached: boolean;
  currentExposure: number;
  tradesAllowed: boolean;
  blockedReason?: string;
}

export interface PositionSizingInput {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  accountBalance: number;
  riskPercent: number;
  symbol: string;
  leverage?: number;
}

export interface PositionSizingResult {
  positionSize: number; // in units
  positionValue: number; // in USD
  riskAmount: number; // max loss in USD
  riskPercent: number; // actual risk %
  riskRewardRatio: number;
  recommendedLeverage: number;
  maxLeverage: number;
  valid: boolean;
  warnings: string[];
}

export interface VolatilityAdjustment {
  atr14: number; // Average True Range
  atrPercent: number; // ATR as % of price
  volatilityLevel: 'low' | 'medium' | 'high' | 'extreme';
  recommendedStopMultiplier: number; // 1x, 1.5x, 2x ATR
  positionSizeMultiplier: number; // reduce size in high vol
  adjustedStopLoss: number;
  adjustedTakeProfit: number;
}

export interface TrailingStopConfig {
  enabled: boolean;
  activationPercent: number; // % of profit to activate
  trailingPercent: number; // % distance from price
  breakevenAtPercent?: number; // move to breakeven at this profit %
}

export interface KellyCriterionInput {
  winRate: number; // 0-100
  avgWin: number;
  avgLoss: number;
  currentStreak: number;
}

export interface KellyCriterionResult {
  fullKelly: number; // optimal risk %
  halfKelly: number; // conservative
  quarterKelly: number; // very conservative
  recommended: number; // based on settings
  confidence: number; // 0-1 based on sample size
}

export interface TradeRiskValidation {
  tradeId?: string;
  symbol: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  riskPercent: number;
  riskRewardRatio: number;
  positionSize: number;
  riskScore: number; // 0-100
  passesAllChecks: boolean;
  suggestedActions: string[];
}

export interface GlobalRiskMetrics {
  totalExposure: number; // total position value
  exposurePercent: number; // % of capital
  openTradeCount: number;
  correlationRisk: number; // 0-100
  dailyPnl: number;
  dailyPnlPercent: number;
  unrealizedPnl: number;
  currentDrawdown: number;
  maxDrawdownReached: boolean;
  riskLevel: 'safe' | 'caution' | 'danger' | 'critical';
}

export interface RiskDashboardData {
  config: RiskConfig;
  limits: RiskLimits;
  metrics: GlobalRiskMetrics;
  activeTrailingStops: TrailingStopStatus[];
  recentValidations: TradeRiskValidation[];
  lastUpdated: number;
}

export interface TrailingStopStatus {
  tradeId: string;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  highestPrice: number;
  currentStop: number;
  profitPercent: number;
  stopTriggered: boolean;
}

export interface RiskAlert {
  id: string;
  type: 'drawdown' | 'daily_loss' | 'exposure' | 'correlation' | 'volatility' | 'validation_failed';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
  autoAction?: string;
}
