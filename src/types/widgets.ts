/**
 * Types pour le système de widgets NEUROVEST
 */

export type WidgetType = 
  | 'price'           // Prix simple
  | 'change'          // Variation 24h
  | 'mini-chart'      // Mini graphique
  | 'volume'          // Volume 24h
  | 'trend'           // Tendance
  | 'alert'           // Alertes prix
  | 'ai-signal'       // Signal IA Ethernal
  | 'portfolio'       // Portfolio overview
  | 'trades'          // Trades actifs
  | 'performance'     // Performance du jour
  | 'market-overview'; // Vue d'ensemble marché

export type WidgetSize = 'small' | 'medium' | 'large' | 'fullscreen';
export type WidgetTheme = 'dark' | 'light' | 'auto';
export type RefreshInterval = 1000 | 5000 | 15000 | 30000 | 60000 | 300000;

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  symbol?: string;
  symbols?: string[]; // Pour les widgets multi-crypto
  size: WidgetSize;
  theme: WidgetTheme;
  refreshInterval: RefreshInterval;
  position?: WidgetPosition;
  customTitle?: string;
  showChart?: boolean;
  timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  alertsEnabled?: boolean;
  aiEnabled?: boolean;
  compactMode?: boolean;
}

export interface WidgetData {
  price: number;
  change24h: number;
  change24hValue: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: Date;
  trend: 'up' | 'down' | 'sideways';
}

export interface AISignal {
  signal: 'BUY' | 'SELL' | 'WAIT' | 'HOLD';
  confidence: number;
  symbol: string;
  timeframe: string;
  reason: string;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: Date;
  indicators: {
    rsi?: number;
    macd?: string;
    trend?: string;
    volume?: string;
  };
}

export interface AlertWidgetItem {
  id: string;
  symbol: string;
  type: 'price' | 'breakout' | 'bot' | 'ai';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: Date;
  acknowledged: boolean;
}

export interface PortfolioWidgetData {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  activeTrades: number;
  closedTrades: number;
  winRate: number;
  streak?: number;
}

export interface PerformanceWidgetData {
  todayPnL: number;
  todayWinRate: number;
  todayTrades: number;
  bestTrade: number;
  worstTrade: number;
  streak: number;
}

export interface MarketOverviewItem {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  trend: 'up' | 'down' | 'sideways';
}

export interface WidgetPreset {
  id: string;
  name: string;
  description: string;
  widgets: Omit<WidgetConfig, 'id'>[];
  icon: string;
}

export interface WidgetLayout {
  id: string;
  name: string;
  widgets: WidgetConfig[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MobileWidgetConfig {
  enabled: boolean;
  platform: 'ios' | 'android';
  widgetType: WidgetType;
  symbol: string;
  refreshInterval: RefreshInterval;
  compact: boolean;
}

export interface DesktopPanelConfig {
  enabled: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  alwaysOnTop: boolean;
  opacity: number;
  widgets: WidgetConfig[];
}

export interface WidgetCache {
  data: WidgetData;
  timestamp: number;
  ttl: number;
}

export interface WidgetThemeColors {
  bg: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  up: string;
  down: string;
  chart: string;
}

export const WIDGET_THEMES: Record<WidgetTheme, WidgetThemeColors> = {
  dark: {
    bg: 'bg-slate-900',
    card: 'bg-slate-800',
    text: 'text-white',
    textMuted: 'text-gray-400',
    border: 'border-slate-700',
    accent: 'text-blue-400',
    up: 'text-green-400',
    down: 'text-red-400',
    chart: '#3b82f6',
  },
  light: {
    bg: 'bg-gray-100',
    card: 'bg-white',
    text: 'text-gray-900',
    textMuted: 'text-gray-500',
    border: 'border-gray-200',
    accent: 'text-blue-600',
    up: 'text-green-600',
    down: 'text-red-600',
    chart: '#2563eb',
  },
  auto: {
    bg: 'bg-slate-900 dark:bg-gray-100',
    card: 'bg-slate-800 dark:bg-white',
    text: 'text-white dark:text-gray-900',
    textMuted: 'text-gray-400 dark:text-gray-500',
    border: 'border-slate-700 dark:border-gray-200',
    accent: 'text-blue-400 dark:text-blue-600',
    up: 'text-green-400 dark:text-green-600',
    down: 'text-red-400 dark:text-red-600',
    chart: '#3b82f6',
  },
};

export const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
  'price': 'Prix Live',
  'change': 'Variation 24h',
  'mini-chart': 'Mini Graph',
  'volume': 'Volume',
  'trend': 'Tendance',
  'alert': 'Alertes',
  'ai-signal': 'Signal IA',
  'portfolio': 'Portfolio',
  'trades': 'Trades Actifs',
  'performance': 'Performance',
  'market-overview': 'Marché',
};

export const WIDGET_TYPE_ICONS: Record<WidgetType, string> = {
  'price': 'dollar',
  'change': 'activity',
  'mini-chart': 'bar-chart',
  'volume': 'activity',
  'trend': 'trending-up',
  'alert': 'bell',
  'ai-signal': 'brain',
  'portfolio': 'briefcase',
  'trades': 'zap',
  'performance': 'target',
  'market-overview': 'radar',
};

export const REFRESH_INTERVALS: { value: RefreshInterval; label: string }[] = [
  { value: 1000, label: '1s' },
  { value: 5000, label: '5s' },
  { value: 15000, label: '15s' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '1min' },
  { value: 300000, label: '5min' },
];

export const TIMEFRAMES = [
  { value: '1m', label: '1M' },
  { value: '5m', label: '5M' },
  { value: '15m', label: '15M' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
];

export const POPULAR_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT',
  'XRPUSDT', 'DOTUSDT', 'DOGEUSDT', 'AVAXUSDT', 'MATICUSDT',
  'LINKUSDT', 'UNIUSDT', 'LTCUSDT', 'BCHUSDT', 'ETCUSDT',
];

export const WIDGET_PRESETS: WidgetPreset[] = [
  {
    id: 'trader',
    name: 'Trader Actif',
    description: 'Widgets essentiels pour le trading actif',
    icon: 'zap',
    widgets: [
      { type: 'price', size: 'small', theme: 'dark', refreshInterval: 5000, symbol: 'BTCUSDT' },
      { type: 'ai-signal', size: 'medium', theme: 'dark', refreshInterval: 30000, symbol: 'BTCUSDT' },
      { type: 'trades', size: 'medium', theme: 'dark', refreshInterval: 5000 },
      { type: 'alert', size: 'small', theme: 'dark', refreshInterval: 15000 },
    ],
  },
  {
    id: 'investor',
    name: 'Investisseur',
    description: 'Vue d\'ensemble long terme',
    icon: 'briefcase',
    widgets: [
      { type: 'portfolio', size: 'large', theme: 'dark', refreshInterval: 30000 },
      { type: 'market-overview', size: 'medium', theme: 'dark', refreshInterval: 60000, symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'] },
      { type: 'performance', size: 'medium', theme: 'dark', refreshInterval: 60000 },
    ],
  },
  {
    id: 'minimal',
    name: 'Minimaliste',
    description: 'Uniquement l\'essentiel',
    icon: 'search',
    widgets: [
      { type: 'price', size: 'small', theme: 'dark', refreshInterval: 15000, symbol: 'BTCUSDT' },
      { type: 'change', size: 'small', theme: 'dark', refreshInterval: 15000, symbol: 'ETHUSDT' },
    ],
  },
];

// Helper pour détecter la plateforme
export function detectPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  
  const ua = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/win32|win64|macintosh|linux/.test(ua)) return 'desktop';
  
  return 'unknown';
}

// Helper pour vérifier si PWA
export function isPWA(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || 
         (window.navigator as any).standalone === true;
}

// Helper pour vérifier support widgets
export function supportsWidgets(): boolean {
  const platform = detectPlatform();
  return platform === 'ios' || platform === 'android';
}

// Export par défaut
export default {
  WIDGET_THEMES,
  WIDGET_TYPE_LABELS,
  WIDGET_TYPE_ICONS,
  REFRESH_INTERVALS,
  TIMEFRAMES,
  POPULAR_SYMBOLS,
  WIDGET_PRESETS,
  detectPlatform,
  isPWA,
  supportsWidgets,
};
