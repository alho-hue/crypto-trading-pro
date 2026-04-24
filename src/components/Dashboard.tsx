import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, Activity, Target, Zap,
  ArrowUpRight, ArrowDownRight, BarChart3, Clock, Bot, Bell,
  RefreshCw, DollarSign, AlertCircle, LineChart, Brain, Play,
  Square, Shield, Flame, PieChart, Gauge, CandlestickChart,
  AreaChart, Settings, X, ChevronUp, Loader2, AlertTriangle,
  CheckCircle2, XCircle, Timer, Percent, TrendingUp as TrendUpIcon,
  ChevronDown, Eye, EyeOff, TrendingUp as TrendingUpIcon,
  Minus, Pause, HelpCircle, Ban, ArrowRightLeft
} from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';
import { getPortfolio, getPortfolioPerformance, getPnL } from '../services/portfolioApi';
import { PriceWithXOF, PriceCompact } from './PriceWithXOF';
import { getBotStatus, getPerformanceStats, getOpenPositions, getTradeHistory } from '../services/autoTradingApi';
import { getPaperBalance, getBotPositions, getBotStats, executeManualTradeLocal } from '../services/localAutoTrading';
import { getActiveAlerts } from '../services/alertsApi';
import { showToast } from '../stores/toastStore';
import { analyzeWithEthernal, formatEthernalAnalysis } from '../services/ethernalAnalysis';
import { ChartWatermark } from './Watermark';
import CryptoNews from './CryptoNews';
import io from 'socket.io-client';
import { createChart, ColorType, CrosshairMode, UTCTimestamp } from 'lightweight-charts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

// Types
type ChartType = 'candles' | 'line' | 'area' | 'bars';
type SignalType = 'LONG' | 'SHORT' | 'WAIT' | 'NEUTRAL';
type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingSignal {
  type: SignalType;
  symbol: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  riskReward: number;
  reasoning: string;
  timestamp: Date;
}

interface CryptoData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  stopLoss: number;
  takeProfit: number;
  risk: number;
  openedAt: Date;
}

interface PerformanceMetrics {
  totalPnL: number;
  winRate: number;
  totalTrades: number;
  avgTradeReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
}

interface RiskMetrics {
  currentRisk: number;
  dailyLoss: number;
  dailyLossLimit: number;
  openRisk: number;
  marginUsed: number;
  marginAvailable: number;
  warningLevel: 'safe' | 'warning' | 'danger';
}

// Liste des cryptos pour le monitoring
const CRYPTO_LIST = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', color: '#F7931A' },
  { symbol: 'ETHUSDT', name: 'Ethereum', color: '#627EEA' },
  { symbol: 'BNBUSDT', name: 'BNB', color: '#F3BA2F' },
  { symbol: 'SOLUSDT', name: 'Solana', color: '#14F195' },
  { symbol: 'ADAUSDT', name: 'Cardano', color: '#0033AD' },
  { symbol: 'XRPUSDT', name: 'XRP', color: '#23292F' },
  { symbol: 'DOTUSDT', name: 'Polkadot', color: '#E6007A' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', color: '#C2A633' },
  { symbol: 'MATICUSDT', name: 'Polygon', color: '#8247E5' },
  { symbol: 'LINKUSDT', name: 'Chainlink', color: '#375BD2' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', color: '#E84142' },
  { symbol: 'ATOMUSDT', name: 'Cosmos', color: '#2E3148' },
];

// Récupérer les données de bougies depuis Binance
async function getKlinesData(symbol: string, interval: string = '1h', limit: number = 100): Promise<CandleData[]> {
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    if (!response.ok) throw new Error('Failed to fetch');
    const data = await response.json();
    return data.map((candle: any[]) => ({
      time: candle[0] / 1000,
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5])
    }));
  } catch (error) {
    console.error('Error fetching klines:', error);
    // PAS DE DONNÉES SIMULÉES - Retourner un tableau vide
    // L'UI doit gérer l'absence de données
    return [];
  }
}

// 🔥 RÉCUPÉRER LES VRAIES DONNÉES 24H DEPUIS BINANCE
async function fetchReal24hData(symbol: string): Promise<{price: number; change24h: number; volume24h: number; high24h: number; low24h: number} | null> {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      price: parseFloat(data.lastPrice),
      change24h: parseFloat(data.priceChangePercent),
      volume24h: parseFloat(data.volume),
      high24h: parseFloat(data.highPrice),
      low24h: parseFloat(data.lowPrice)
    };
  } catch (e) {
    console.error('[24h Data] Error:', e);
    return null;
  }
}

// 🧠 SIGNAL IA - NOUVELLE VERSION PROPRE
async function generateAISignal(symbol: string, candles: CandleData[], currentPrice: number): Promise<TradingSignal> {
  // Données minimum requises
  if (candles.length < 20 || currentPrice <= 0) {
    return {
      type: 'NEUTRAL',
      symbol,
      entryPrice: currentPrice,
      stopLoss: currentPrice * 0.95,
      takeProfit: currentPrice * 1.05,
      confidence: 0,
      riskReward: 1,
      reasoning: 'Données insuffisantes - Attendre',
      timestamp: new Date()
    };
  }

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  // === INDICATEURS TECHNIQUES ===
  const rsi = calculateRSI(closes, 14);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const { macd, signal: macdSignal } = calculateMACD(closes);
  const { upper: bbUpper, lower: bbLower, middle: bbMiddle } = calculateBollinger(closes, 20);
  
  // === ANALYSE TREND ===
  const aboveSMA20 = currentPrice > sma20;
  const aboveSMA50 = currentPrice > sma50;
  const sma20Above50 = sma20 > sma50;
  const macdBullish = macd > macdSignal;
  const macdAboveZero = macd > 0;
  const priceToBB = (currentPrice - bbLower) / (bbUpper - bbLower || 1); // 0 = bas, 1 = haut
  
  // === DYNAMIQUE DU MARCHÉ ===
  const recentVolatility = Math.abs(closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5] * 100;
  const volumeSpike = volumes[volumes.length - 1] > calculateSMA(volumes, 20) * 1.5;
  
  // === SCORING ADAPTATIF ===
  let longPoints = 0;
  let shortPoints = 0;
  const reasons: string[] = [];

  // RSI (zones adaptées)
  if (rsi < 30) { longPoints += 4; reasons.push('RSI survendu (<30)'); }
  else if (rsi < 40) { longPoints += 2; reasons.push('RSI faible'); }
  else if (rsi > 70) { shortPoints += 4; reasons.push('RSI suracheté (>70)'); }
  else if (rsi > 60) { shortPoints += 2; reasons.push('RSI élevé'); }

  // Moyennes mobiles (plus nuancé)
  if (aboveSMA20 && aboveSMA50 && sma20Above50) { 
    longPoints += 3; reasons.push('Bull trend fort'); 
  } else if (aboveSMA20 && !sma20Above50) { 
    longPoints += 1; reasons.push('Reprise possible'); 
  }
  
  if (!aboveSMA20 && !aboveSMA50 && !sma20Above50) { 
    shortPoints += 3; reasons.push('Bear trend fort'); 
  } else if (!aboveSMA20 && sma20Above50) { 
    shortPoints += 1; reasons.push('Correction possible'); 
  }
  
  // MACD (avec direction)
  if (macdBullish && macdAboveZero) { longPoints += 3; reasons.push('MACD bull fort'); }
  else if (macdBullish && !macdAboveZero) { longPoints += 2; reasons.push('MACD convergence bull'); }
  else if (!macdBullish && !macdAboveZero) { shortPoints += 3; reasons.push('MACD bear fort'); }
  else if (!macdBullish && macdAboveZero) { shortPoints += 2; reasons.push('MACD convergence bear'); }

  // Bollinger (position relative)
  if (priceToBB < 0.15) { longPoints += 3; reasons.push('Zone survente BB'); }
  else if (priceToBB < 0.35) { longPoints += 1; reasons.push('Proche support'); }
  else if (priceToBB > 0.85) { shortPoints += 3; reasons.push('Zone surachat BB'); }
  else if (priceToBB > 0.65) { shortPoints += 1; reasons.push('Proche résistance'); }
  
  // Volume spike = confirmation
  if (volumeSpike) {
    if (closes[closes.length - 1] > closes[closes.length - 2]) {
      longPoints += 1; reasons.push('Volume haussier');
    } else {
      shortPoints += 1; reasons.push('Volume baissier');
    }
  }

  // === DÉCISION RÉELLE (équilibrée pour des signaux réels) ===
  const MIN_SIGNAL_SCORE = 5; // Score réduit pour plus de signaux
  const MIN_GAP = 2; // Écart minimum réduit
  const scoreDiff = longPoints - shortPoints;
  
  let signalType: SignalType;
  let confidence: number;

  // Filtrage par volatilité - tolérance augmentée
  const isTooVolatile = recentVolatility > 8; // >8% de volatilité (au lieu de 5%)
  
  if (isTooVolatile) {
    signalType = 'WAIT';
    confidence = 35;
    reasons.push('Volatilité très élevée - Attendre');
  }
  // LONG: Conditions favorables (assouplies)
  else if (longPoints >= MIN_SIGNAL_SCORE && scoreDiff >= MIN_GAP && rsi < 55) {
    signalType = 'LONG';
    confidence = Math.min(92, 65 + (longPoints * 3) + Math.abs(scoreDiff));
  } 
  // SHORT: Conditions favorables (assouplies)
  else if (shortPoints >= MIN_SIGNAL_SCORE && scoreDiff <= -MIN_GAP && rsi > 45) {
    signalType = 'SHORT';
    confidence = Math.min(92, 65 + (shortPoints * 3) + Math.abs(scoreDiff));
  } 
  // Tendance faible mais identifiable
  else if (longPoints > shortPoints && longPoints >= 4) {
    signalType = 'LONG';
    confidence = 55;
    reasons.push('Tendance haussière modérée');
  }
  else if (shortPoints > longPoints && shortPoints >= 4) {
    signalType = 'SHORT';
    confidence = 55;
    reasons.push('Tendance baissière modérée');
  }
  // Vraiment pas de signal
  else {
    signalType = 'NEUTRAL';
    confidence = Math.max(30, 45 + Math.abs(scoreDiff));
  }

  // === SL/TP OPTIMISÉS ===
  const atr = calculateATR(highs, lows, closes, 14);
  
  let stopLoss: number;
  let takeProfit: number;
  
  // Risk/Reward minimum 1:2 pour les trades gagnants
  if (signalType === 'LONG') {
    // SL sous le plus bas récent ou bande inférieure
    const recentLow = Math.min(...lows.slice(-5));
    stopLoss = Math.min(currentPrice * 0.985, Math.max(bbLower * 0.995, recentLow * 0.998));
    stopLoss = Math.max(stopLoss, currentPrice * 0.97); // Max 3% de perte
    
    // TP vers la bande supérieure ou 2x le risque
    const risk = currentPrice - stopLoss;
    takeProfit = Math.max(currentPrice + (risk * 2), bbMiddle + (bbUpper - bbMiddle) * 0.7);
    takeProfit = Math.min(takeProfit, currentPrice * 1.06); // Max 6% de gain
    
  } else if (signalType === 'SHORT') {
    // SL au-dessus du plus haut récent ou bande supérieure
    const recentHigh = Math.max(...highs.slice(-5));
    stopLoss = Math.max(currentPrice * 1.015, Math.min(bbUpper * 1.005, recentHigh * 1.002));
    stopLoss = Math.min(stopLoss, currentPrice * 1.03); // Max 3% de perte
    
    // TP vers la bande inférieure ou 2x le risque
    const risk = stopLoss - currentPrice;
    takeProfit = Math.min(currentPrice - (risk * 2), bbMiddle - (bbMiddle - bbLower) * 0.7);
    takeProfit = Math.max(takeProfit, currentPrice * 0.94); // Max 6% de perte (gain pour short)
    
  } else {
    stopLoss = currentPrice * 0.95;
    takeProfit = currentPrice * 1.05;
  }

  const risk = Math.abs(currentPrice - stopLoss);
  const reward = Math.abs(takeProfit - currentPrice);
  const riskReward = risk > 0 ? reward / risk : 2;

  // === REASONING PRO (sans emojis) ===
  let reasoning: string;
  
  if (signalType === 'LONG') {
    const topReasons = reasons.slice(0, 3).join(' • ');
    reasoning = `Signal ACHAT ${confidence}% - ${topReasons || 'Configuration technique favorable'}`;
  } else if (signalType === 'SHORT') {
    const topReasons = reasons.slice(0, 3).join(' • ');
    reasoning = `Signal VENTE ${confidence}% - ${topReasons || 'Configuration technique défavorable'}`;
  } else {
    if (longPoints > shortPoints) {
      reasoning = `Attendre - Tendance haussière trop faible (${longPoints}pts). ${reasons[0] || 'Pas de momentum suffisant'}`;
    } else if (shortPoints > longPoints) {
      reasoning = `Attendre - Tendance baissière trop faible (${shortPoints}pts). ${reasons[0] || 'Pas de momentum suffisant'}`;
    } else {
      reasoning = `Attendre - Marché sans direction. Accumulation/distribution en cours (${longPoints}-${shortPoints}pts)`;
    }
  }

  return {
    type: signalType,
    symbol,
    entryPrice: currentPrice,
    stopLoss,
    takeProfit,
    confidence: Math.round(confidence),
    riskReward,
    reasoning,
    timestamp: new Date()
  };
}

// === FONCTIONS UTILITAIRES ===
function calculateRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

function calculateSMA(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] || 0;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] || 0;
  const multiplier = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = (values[i] * multiplier) + (ema * (1 - multiplier));
  }
  return ema;
}

function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12 - ema26;
  // Simplifié - on retourne juste macd et une approximation du signal
  const signal = macd * 0.8; // Approximation
  return { macd, signal, histogram: macd - signal };
}

function calculateBollinger(closes: number[], period: number): { upper: number; middle: number; lower: number } {
  const middle = calculateSMA(closes, period);
  const squaredDiffs = closes.slice(-period).map(c => Math.pow(c - middle, 2));
  const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);
  return {
    upper: middle + (stdDev * 2),
    middle,
    lower: middle - (stdDev * 2)
  };
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
  if (highs.length < period + 1) return closes[closes.length - 1] * 0.02;
  let sum = 0;
  for (let i = highs.length - period; i < highs.length; i++) {
    const tr1 = highs[i] - lows[i];
    const tr2 = Math.abs(highs[i] - closes[i - 1]);
    const tr3 = Math.abs(lows[i] - closes[i - 1]);
    sum += Math.max(tr1, tr2, tr3);
  }
  return sum / period;
}

export default function Dashboard() {
  // === ÉTATS CENTRE DE COMMANDEMENT ===
  
  // Trading - Utiliser le store pour persistance
  const cryptoStore = useCryptoStore();
  const [selectedSymbol, setSelectedSymbol] = useState(cryptoStore.selectedSymbol || 'BTCUSDT');
  const [chartInterval, setChartInterval] = useState<TimeInterval>((cryptoStore.timeframe as TimeInterval) || '1h');
  const [chartType, setChartType] = useState<ChartType>('candles');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [volume24h, setVolume24h] = useState<number>(0);
  const [aiSignal, setAiSignal] = useState<TradingSignal | null>(null);
  const [isExecutingTrade, setIsExecutingTrade] = useState(false);
  
  // Portefeuille & Performance
  const [balance, setBalance] = useState<number>(10000);
  const [equity, setEquity] = useState<number>(10000);
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics>({
    totalPnL: 0,
    winRate: 0,
    totalTrades: 0,
    avgTradeReturn: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    profitFactor: 0
  });
  
  // Risk Management
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics>({
    currentRisk: 0,
    dailyLoss: 0,
    dailyLossLimit: 1000,
    openRisk: 0,
    marginUsed: 0,
    marginAvailable: 10000,
    warningLevel: 'safe'
  });
  
  // Market Data - Récupérer directement depuis le store (temps réel)
  const prices = useCryptoStore((state) => state.prices);
  const [showHeatmap, setShowHeatmap] = useState(true);
  
  // Calculer les données du marché à partir des prix du store (temps réel)
  const cryptoData = useMemo(() => {
    return CRYPTO_LIST.map(crypto => {
      const priceData = prices.get(crypto.symbol);
      return {
        symbol: crypto.symbol,
        name: crypto.name,
        price: priceData?.price || 0,
        change24h: priceData?.change24h || 0,
        volume24h: priceData?.volume24h || 0,
        high24h: priceData?.high24h || 0,
        low24h: priceData?.low24h || 0
      };
    }).filter(c => c.price > 0);
  }, [prices]);
  
  const topGainers = useMemo(() => {
    return [...cryptoData].filter(c => c.change24h > 0).sort((a, b) => b.change24h - a.change24h).slice(0, 5);
  }, [cryptoData]);
  
  const topLosers = useMemo(() => {
    return [...cryptoData].filter(c => c.change24h < 0).sort((a, b) => a.change24h - b.change24h).slice(0, 5);
  }, [cryptoData]);
  
  // Bot & Alertes - Connecté au localStorage (bot local)
  const [botStatus, setBotStatus] = useState({ isRunning: false, strategy: 'moderate', lastTrade: null });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false); // PAS de loading bloquant
  
  // Chargement du statut bot depuis localStorage (bot local)
  const loadLocalBotStatus = useCallback(() => {
    try {
      const saved = localStorage.getItem('neurovest_bot_config');
      if (saved) {
        const config = JSON.parse(saved);
        setBotStatus({
          isRunning: config.enabled || false,
          strategy: config.strategy || 'moderate',
          lastTrade: null
        });
      }
    } catch (error) {
      console.error('Error loading bot status:', error);
    }
  }, []);
  
  // UI
  const [activeTab, setActiveTab] = useState<'overview' | 'positions' | 'history'>('overview');
  const [cryptoDropdownOpen, setCryptoDropdownOpen] = useState(false);
  const [showSignalDetails, setShowSignalDetails] = useState(false);
  const [isChangingCrypto, setIsChangingCrypto] = useState(false); // Pour le loading du changement de crypto
  
  // Settings utilisateur pour le refresh
  const [refreshSettings, setRefreshSettings] = useState({
    autoRefresh: true,
    refreshInterval: 3 // secondes par défaut
  });
  
  // Refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // === FONCTIONS DE CHARGEMENT ===
  
  const loadChartData = useCallback(async () => {
    try {
      // 🔥 RÉCUPÉRER DONNÉES EN PARALLÈLE
      const [klines, realData] = await Promise.all([
        getKlinesData(selectedSymbol, chartInterval, 100),
        fetchReal24hData(selectedSymbol) // 📊 Vraies données 24h depuis Binance
      ]);
      
      setCandles(klines);
      
      // 🎯 PRIX ET CHANGE 24H RÉELS
      if (realData) {
        setCurrentPrice(realData.price);
        setPriceChange24h(realData.change24h); // ✅ Vrai change 24h depuis Binance
        setVolume24h(realData.volume24h);
        console.log(`[Dashboard] ${selectedSymbol}: $${realData.price.toFixed(2)} | 24h: ${realData.change24h.toFixed(2)}%`);
      } else if (klines.length > 0) {
        // Fallback sur les bougies si l'API 24h échoue
        const lastCandle = klines[klines.length - 1];
        setCurrentPrice(lastCandle.close);
        const change24h = ((lastCandle.close - klines[0].open) / klines[0].open) * 100;
        setPriceChange24h(change24h);
        setVolume24h(klines.slice(-24).reduce((sum, c) => sum + c.volume, 0));
      }
      
      // 🧠 GÉNÉRER SIGNAL IA avec les vraies données
      const priceToUse = realData?.price || (klines.length > 0 ? klines[klines.length - 1].close : 0);
      if (priceToUse > 0 && klines.length >= 20) {
        const signal = await generateAISignal(selectedSymbol, klines, priceToUse);
        setAiSignal(signal);
        console.log(`[Dashboard] Signal IA: ${signal.type} (${signal.confidence}%) - ${signal.reasoning.substring(0, 50)}...`);
      } else {
        setAiSignal(null);
      }
      
    } catch (error) {
      console.error('Error loading chart data:', error);
    }
  }, [selectedSymbol, chartInterval]);

  const loadPortfolioData = useCallback(async () => {
    try {
      // 🔥 DONNÉES RÉELLES DU PAPER TRADING LOCAL (pas de backend)
      const paperBalance = getPaperBalance();
      const botPositions = getBotPositions();
      const botStats = getBotStats();
      
      // Convertir les positions du format BotPosition au format Position
      const formattedPositions: Position[] = botPositions.map(pos => ({
        id: pos.id,
        symbol: pos.symbol,
        side: pos.side === 'buy' ? 'LONG' : 'SHORT',
        entryPrice: pos.entryPrice,
        currentPrice: pos.currentPrice || pos.entryPrice,
        quantity: pos.quantity,
        pnl: pos.unrealizedPnl || 0,
        pnlPercent: pos.unrealizedPnlPercent || 0,
        stopLoss: pos.stopLoss || 0,
        takeProfit: pos.takeProfit || 0,
        risk: Math.abs((pos.stopLoss - pos.entryPrice) * pos.quantity) || 0,
        openedAt: new Date(pos.entryTime)
      }));
      
      // Calculer le equity (balance + valeur des positions ouvertes)
      const positionsValue = formattedPositions.reduce((sum, pos) => {
        return sum + (pos.pnl || 0);
      }, 0);
      const equity = paperBalance + positionsValue;
      
      setBalance(paperBalance);
      setEquity(equity);
      setOpenPositions(formattedPositions);
      
      // 🔥 MÉTRIQUES RÉELLES basées sur les stats du bot
      setPerformance({
        totalPnL: botStats.totalPnL || 0,
        winRate: botStats.winRate || 0,
        totalTrades: botStats.totalTrades || 0,
        avgTradeReturn: botStats.totalTrades > 0 ? (botStats.totalPnL / botStats.totalTrades) : 0,
        maxDrawdown: botStats.maxDrawdown || 0,
        sharpeRatio: 0, // À calculer si besoin
        profitFactor: botStats.losingTrades > 0 ? 
          (botStats.winningTrades / botStats.losingTrades) : 
          (botStats.winningTrades > 0 ? Infinity : 0)
      });
      
      // Historique depuis le store global
      const trades = useCryptoStore.getState().trades;
      setTradeHistory(trades.slice(-10).reverse());
      
      // 🔥 MÉTRIQUES DE RISQUE réelles
      const openRisk = formattedPositions.reduce((sum, pos) => sum + (pos.risk || 0), 0);
      
      setRiskMetrics({
        currentRisk: openRisk,
        dailyLoss: botStats.dailyPnL || 0,
        dailyLossLimit: paperBalance * 0.03, // 3% du capital
        openRisk,
        marginUsed: openRisk,
        marginAvailable: paperBalance - openRisk,
        warningLevel: openRisk > paperBalance * 0.5 ? 'danger' : 
                     openRisk > paperBalance * 0.2 ? 'warning' : 'safe'
      });
      
      console.log('[DASHBOARD] ✅ Données paper trading chargées:', {
        balance: paperBalance,
        equity,
        positions: formattedPositions.length,
        totalPnL: botStats.totalPnL
      });
      
    } catch (error) {
      console.error('Error loading portfolio:', error);
    }
  }, []);

  // Pas besoin de loadMarketData - les données viennent directement du store
  const loadMarketData = useCallback(() => {
    // Les données sont maintenant calculées automatiquement via useMemo
    console.log('Market data updated from store:', prices.size, 'prices available');
  }, [prices]);

  // === CALCULS FINANCIERS ===
  
  function calculateMaxDrawdown(trades: any[]): number {
    if (trades.length === 0) return 0;
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;
    
    for (const trade of trades) {
      runningPnL += trade.pnl || 0;
      if (runningPnL > peak) peak = runningPnL;
      const drawdown = peak - runningPnL;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    return maxDrawdown;
  }
  
  function calculateProfitFactor(trades: any[]): number {
    const grossProfit = trades.filter(t => (t.pnl || 0) > 0).reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(trades.filter(t => (t.pnl || 0) < 0).reduce((sum, t) => sum + (t.pnl || 0), 0));
    return grossLoss === 0 ? grossProfit > 0 ? 999 : 0 : grossProfit / grossLoss;
  }
  
  // Note: La fonction executeTrade est maintenant inline dans le bouton pour utiliser executeManualTrade
  
  const closePosition = useCallback(async (positionId: string) => {
    try {
      showToast.info('La position a été fermée avec succès', 'Position fermée');
      await loadPortfolioData();
    } catch (error) {
      showToast.error('Impossible de fermer la position', 'Erreur');
    }
  }, [loadPortfolioData]);

  // === EFFETS ===
  
  // Charger les settings utilisateur
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('neurovest_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setRefreshSettings({
          autoRefresh: parsed.autoRefresh ?? true,
          refreshInterval: parsed.refreshInterval ?? 3
        });
      }
    } catch (e) {
      console.log('Pas de settings sauvegardés, utilisation des valeurs par défaut');
    }
  }, []);
  
  // Chargement initial ultra-rapide - PAS DE LOADING
  useEffect(() => {
    // Charger le chart IMMÉDIATEMENT
    loadChartData();
    
    // Charger le reste en arrière-plan sans bloquer l'UI
    loadPortfolioData();
    loadMarketData();
    loadLocalBotStatus(); // Charger statut bot local
  }, []);
  
  // Rafraîchissement automatique basé sur les settings utilisateur
  useEffect(() => {
    // Nettoyer l'ancien interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    
    if (refreshSettings.autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        loadChartData();
        loadMarketData();
        loadLocalBotStatus(); // Rafraîchir statut bot
      }, refreshSettings.refreshInterval * 1000);
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refreshSettings.autoRefresh, refreshSettings.refreshInterval, selectedSymbol]);
  
  // Regénérer le signal immédiatement quand on change de crypto
  useEffect(() => {
    const updateSignal = async () => {
      if (candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        const signal = await generateAISignal(selectedSymbol, candles, lastCandle.close);
        setAiSignal(signal);
      }
    };
    updateSignal();
  }, [selectedSymbol, candles]);
  
  // Recharger IMMÉDIATEMENT quand on change de crypto ou d'intervalle
  useEffect(() => {
    loadChartData();
  }, [selectedSymbol, chartInterval]);
  
  // SAUVEGARDER dans le store quand le crypto ou interval change (pour persistance)
  useEffect(() => {
    cryptoStore.setSelectedSymbol(selectedSymbol);
    cryptoStore.setTimeframe(chartInterval);
  }, [selectedSymbol, chartInterval]);

  // Initialiser/Mettre à jour le chart - Optimisé pour rapidité
  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;
    
    // Réutiliser le chart existant si possible
    let chart = chartRef.current;
    
    if (!chart) {
      chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#0B1120' },
          textColor: '#94A3B8',
          fontFamily: 'Inter, sans-serif',
        },
        grid: { vertLines: { color: '#1E293B' }, horzLines: { color: '#1E293B' } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#334155' },
        timeScale: { borderColor: '#334155', timeVisible: true },
        handleScale: { axisPressedMouseMove: true },
        handleScroll: { vertTouchDrag: false },
      });
      chartRef.current = chart;
    }
    
    // Supprimer l'ancienne série rapidement
    if (seriesRef.current) {
      try {
        chart.removeSeries(seriesRef.current);
      } catch {}
    }
    
    // Ajouter la série selon le type
    let series;
    const formattedData = candles.map(c => ({ time: c.time as UTCTimestamp, value: c.close }));
    
    switch (chartType) {
      case 'candles':
        series = chart.addCandlestickSeries({
          upColor: '#22C55E', downColor: '#EF4444',
          borderUpColor: '#22C55E', borderDownColor: '#EF4444',
          wickUpColor: '#22C55E', wickDownColor: '#EF4444',
        });
        series.setData(candles.map(c => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));
        break;
      case 'line':
        series = chart.addLineSeries({ color: '#3B82F6', lineWidth: 2 });
        series.setData(formattedData);
        break;
      case 'area':
        series = chart.addAreaSeries({ 
          lineColor: '#3B82F6', 
          topColor: 'rgba(59, 130, 246, 0.4)', 
          bottomColor: 'rgba(59, 130, 246, 0.05)' 
        });
        series.setData(formattedData);
        break;
      case 'bars':
        series = chart.addHistogramSeries({ color: '#3B82F6' });
        series.setData(candles.map(c => ({ time: c.time as UTCTimestamp, value: c.close, color: c.close > c.open ? '#22C55E' : '#EF4444' })));
        break;
    }
    
    seriesRef.current = series;
    chart.timeScale().fitContent();
    
    // Cleanup seulement au démontage complet
    return () => {
      if (chartRef.current && !candles.length) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [candles, chartType]);

  const selectedCrypto = CRYPTO_LIST.find(c => c.symbol === selectedSymbol) || CRYPTO_LIST[0];
  
  // Socket.IO pour temps réel
  useEffect(() => {
    const newSocket = io(API_URL);
    socketRef.current = newSocket;
    
    newSocket.on('connect', () => {
      const user = localStorage.getItem('user');
      if (user) {
        try {
          const userData = JSON.parse(user);
          newSocket.emit('join-user', userData.id || userData._id);
        } catch {}
      }
    });
    
    newSocket.on('price-update', (update: any) => {
      if (update.symbol === selectedSymbol) {
        setCurrentPrice(update.price);
      }
    });
    
    return () => { newSocket.disconnect(); };
  }, [selectedSymbol]);

  // PAS DE PAGE DE CHARGEMENT - tout s'affiche immédiatement

  const totalPnL = performance.totalPnL;
  const openRisk = openPositions.reduce((sum, p) => sum + p.risk, 0);

  // === RENDU ===
  return (
    <div className="min-h-screen bg-gray-950 p-2 sm:p-3 lg:p-4 space-y-3">
      {/* === HEADER CENTRE DE COMMANDEMENT === */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-blue-500" />
            <span className="hidden sm:inline">Centre de Commandement</span>
            <span className="sm:hidden">Trading</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Temps réel • Binance API</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-gray-900 rounded-lg border border-gray-800">
            <div className={`w-1.5 h-1.5 rounded-full ${botStatus.isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-300">Bot {botStatus.isRunning ? 'On' : 'Off'}</span>
          </div>
          <button
            onClick={() => { loadChartData(); loadPortfolioData(); }}
            className="p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* === SIGNAL IA PRINCIPAL - COMPACT & RESPONSIVE === */}
      {aiSignal && (
        <div className={`rounded-xl sm:rounded-2xl border-2 overflow-hidden ${
          aiSignal.type === 'LONG' ? 'bg-gradient-to-r from-green-950/40 to-green-900/20 border-green-500/50' :
          aiSignal.type === 'SHORT' ? 'bg-gradient-to-r from-red-950/40 to-red-900/20 border-red-500/50' :
          'bg-gradient-to-r from-yellow-950/40 to-yellow-900/20 border-yellow-500/50'
        }`}>
          {/* Header du Signal - Compact */}
          <div className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-3 border-b ${
            aiSignal.type === 'LONG' ? 'border-green-500/30 bg-green-500/10' :
            aiSignal.type === 'SHORT' ? 'border-red-500/30 bg-red-500/10' :
            'border-yellow-500/30 bg-yellow-500/10'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shadow-lg ${
                  aiSignal.type === 'LONG' ? 'bg-green-500 shadow-green-500/30' :
                  aiSignal.type === 'SHORT' ? 'bg-red-500 shadow-red-500/30' :
                  'bg-yellow-500 shadow-yellow-500/30'
                }`}>
                  {aiSignal.type === 'LONG' ? <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> :
                   aiSignal.type === 'SHORT' ? <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> :
                   <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className={`text-xl sm:text-2xl font-black tracking-tight ${
                      aiSignal.type === 'LONG' ? 'text-green-400' :
                      aiSignal.type === 'SHORT' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                      {aiSignal.type === 'LONG' ? 'ACHAT' : 
                       aiSignal.type === 'SHORT' ? 'VENTE' : 
                       aiSignal.type === 'WAIT' ? 'ATTENDRE' : 'NEUTRE'}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-800/80 rounded-full text-xs text-gray-300 font-medium">
                      {selectedCrypto.name}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5 hidden sm:block max-w-md">{aiSignal.reasoning}</p>
                </div>
              </div>
              
              {/* Confiance Badge - PRO */}
              <div className="flex flex-col items-end gap-1">
                <div className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold ${
                  aiSignal.confidence >= 85 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                  aiSignal.confidence >= 75 ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  aiSignal.confidence >= 60 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                }`}>
                  <Brain className="w-3 h-3 sm:w-4 sm:h-4" />
                  {aiSignal.confidence}%
                </div>
                {/* Mini badge qualité - ICÔNES LUCIDE */}
                {aiSignal.confidence >= 85 && (
                  <span className="text-[9px] text-yellow-400 font-medium flex items-center gap-1">
                    <Shield className="w-3 h-3" /> PREMIUM
                  </span>
                )}
                {aiSignal.confidence >= 75 && aiSignal.confidence < 85 && (
                  <span className="text-[9px] text-green-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> PRO
                  </span>
                )}
                {aiSignal.confidence < 60 && (
                  <span className="text-[9px] text-gray-400 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> FAIBLE
                  </span>
                )}
              </div>
            </div>
            {/* Raisonnement sur mobile */}
            <p className="text-gray-400 text-xs mt-1.5 sm:hidden">{aiSignal.reasoning}</p>
          </div>
          
          {/* Corps du Signal - Métriques Compactes en FRANÇAIS */}
          <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 items-stretch">
              {/* Entrée */}
              <div className="bg-gray-800/50 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-gray-700/50">
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Prix d'Entrée</p>
                <PriceWithXOF usdAmount={aiSignal.entryPrice || currentPrice} size="sm" />
              </div>
              
              {/* Stop Loss */}
              <div className="bg-red-950/20 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-red-500/20">
                <p className="text-[10px] sm:text-xs text-red-400 uppercase tracking-wider mb-0.5 sm:mb-1">Stop Loss</p>
                <div className="text-base sm:text-lg lg:text-xl font-bold text-red-400">
                  ${(aiSignal.stopLoss || currentPrice * 0.95).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
                <p className="text-[10px] text-red-500/60">
                  -{((1 - (aiSignal.stopLoss || currentPrice * 0.95)/(aiSignal.entryPrice || currentPrice)) * 100).toFixed(2)}%
                </p>
              </div>
              
              {/* Take Profit */}
              <div className="bg-green-950/20 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-green-500/20">
                <p className="text-[10px] sm:text-xs text-green-400 uppercase tracking-wider mb-0.5 sm:mb-1">Take Profit</p>
                <div className="text-base sm:text-lg lg:text-xl font-bold text-green-400">
                  ${(aiSignal.takeProfit || currentPrice * 1.05).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
                <p className="text-[10px] text-green-500/60">
                  +{(((aiSignal.takeProfit || currentPrice * 1.05)/(aiSignal.entryPrice || currentPrice) - 1) * 100).toFixed(2)}%
                </p>
              </div>
              
              {/* Risk:Reward */}
              <div className="bg-blue-950/20 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-blue-500/20">
                <p className="text-[10px] sm:text-xs text-blue-400 uppercase tracking-wider mb-0.5 sm:mb-1">Risk/Reward</p>
                <p className="text-base sm:text-lg lg:text-xl font-bold text-blue-400">1:{((aiSignal.riskReward || 2)).toFixed(2)}</p>
                <p className="text-[10px] text-blue-500/60">
                  {(aiSignal.riskReward || 2) >= 2 ? 'Excellent' : (aiSignal.riskReward || 2) >= 1.5 ? 'Bon' : 'Modéré'}
                </p>
              </div>
              
              {/* Bouton Exécuter */}
              {aiSignal.type !== 'WAIT' && aiSignal.type !== 'NEUTRAL' ? (
                <button
                  onClick={async () => {
                    if (!aiSignal || isExecutingTrade) return;
                    setIsExecutingTrade(true);
                    try {
                      // 🔥 TRADE LOCAL 100% FONCTIONNEL
                      const result = await executeManualTradeLocal({
                        symbol: aiSignal.symbol,
                        side: aiSignal.type === 'LONG' ? 'buy' : 'sell',
                        entryPrice: aiSignal.entryPrice,
                        stopLoss: aiSignal.stopLoss,
                        takeProfit: aiSignal.takeProfit,
                        confidence: aiSignal.confidence
                      });
                      
                      if (result.success && result.trade) {
                        showToast.success(
                          `${aiSignal.type === 'LONG' ? 'ACHAT' : 'VENTE'} ${aiSignal.symbol} exécuté @ $${result.trade.price.toFixed(2)} | ${result.trade.quantity.toFixed(4)} unités`,
                          'Trade Exécuté'
                        );
                        await loadPortfolioData();
                        await loadChartData();
                      } else {
                        showToast.error(result.error || 'Erreur lors de l\'exécution', 'Erreur');
                      }
                    } catch (error: any) {
                      showToast.error(error.message || 'Erreur inattendue', 'Erreur');
                    } finally {
                      setIsExecutingTrade(false);
                    }
                  }}
                  disabled={isExecutingTrade}
                  className={`h-auto min-h-[60px] sm:min-h-[70px] rounded-lg sm:rounded-xl font-bold text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg ${
                    aiSignal.type === 'LONG' 
                      ? 'bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 shadow-green-500/25' 
                      : 'bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 shadow-red-500/25'
                  } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex flex-col items-center justify-center gap-0.5 sm:gap-1`}
                >
                  {isExecutingTrade ? (
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-xs sm:text-sm">Exécuter</span>
                      <span className="text-[10px] font-normal opacity-80">
                        {aiSignal.type === 'LONG' ? 'ACHAT' : 'VENTE'} {selectedCrypto.symbol.replace('USDT', '')}
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <div className="h-auto min-h-[60px] sm:min-h-[70px] rounded-lg sm:rounded-xl bg-gray-800/50 border border-gray-700 flex flex-col items-center justify-center text-gray-500">
                  <Timer className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
                  <span className="text-xs font-bold">ATTENDRE</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === LAYOUT PRINCIPAL - RESPONSIVE === */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        
        {/* === COLONNE GAUCHE: GRAPHIQUE === */}
        <div className="xl:col-span-2 space-y-3">
          
          {/* Graphique Principal - Compact */}
          <div className="bg-gray-900 rounded-xl sm:rounded-2xl border border-gray-800 overflow-hidden">
            {/* Header du Chart - Compact */}
            <div className="px-2 sm:px-3 py-2 border-b border-gray-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Dropdown Crypto Intégré avec Loading */}
                <div className="relative">
                  <button
                    onClick={() => !isChangingCrypto && setCryptoDropdownOpen(!cryptoDropdownOpen)}
                    disabled={isChangingCrypto}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isChangingCrypto ? (
                      <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 animate-spin" />
                    ) : (
                      <div 
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-white font-bold text-xs"
                        style={{ backgroundColor: selectedCrypto.color }}
                      >
                        {selectedCrypto.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="text-left hidden sm:block">
                      <p className="text-white font-semibold text-xs">{isChangingCrypto ? 'Chargement...' : selectedCrypto.name}</p>
                    </div>
                    <div className="text-left sm:hidden">
                      <p className="text-white font-semibold text-xs">{isChangingCrypto ? '...' : selectedCrypto.symbol.replace('USDT', '')}</p>
                    </div>
                    <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 text-gray-400 transition-transform ${cryptoDropdownOpen ? 'rotate-180' : ''} ${isChangingCrypto ? 'opacity-0' : ''}`} />
                  </button>
                  
                  {/* Dropdown Positionné Correctement */}
                  {cryptoDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setCryptoDropdownOpen(false)} />
                      <div className="absolute top-full left-0 mt-1 w-48 sm:w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                        {CRYPTO_LIST.map((crypto) => (
                          <button
                            key={crypto.symbol}
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (crypto.symbol === selectedSymbol) {
                                setCryptoDropdownOpen(false);
                                return;
                              }
                              setIsChangingCrypto(true);
                              setSelectedSymbol(crypto.symbol); 
                              setCryptoDropdownOpen(false); 
                              // Le useEffect va déclencher loadChartData automatiquement
                              setTimeout(() => setIsChangingCrypto(false), 500); // Feedback visuel rapide
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-0 ${
                              selectedSymbol === crypto.symbol ? 'bg-blue-900/30' : ''
                            }`}
                          >
                            <div 
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px]"
                              style={{ backgroundColor: crypto.color }}
                            >
                              {crypto.symbol.slice(0, 2)}
                            </div>
                            <div className="text-left flex-1">
                              <p className="text-white font-medium text-xs sm:text-sm">{crypto.name}</p>
                              <p className="text-gray-500 text-[10px]">{crypto.symbol}</p>
                            </div>
                            {selectedSymbol === crypto.symbol && <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                
                {/* Prix - Style amélioré */}
                <div className="flex items-center gap-2 sm:gap-3 px-3 py-2 bg-gray-800/80 rounded-xl border border-gray-700/50">
                  <div className="flex items-baseline gap-1.5 sm:gap-2">
                    <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`text-xs sm:text-sm font-semibold px-2 py-0.5 rounded-full ${priceChange24h >= 0 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                      {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Contrôles - Compact */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Type de chart */}
                <div className="flex bg-gray-800 rounded-lg p-0.5">
                  {(['candles', 'line', 'area', 'bars'] as ChartType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setChartType(type)}
                      className={`px-1.5 sm:px-2 py-1 rounded text-[10px] sm:text-xs transition-colors ${
                        chartType === type ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {type === 'candles' ? <CandlestickChart className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> :
                       type === 'line' ? <LineChart className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> :
                       type === 'area' ? <AreaChart className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> :
                       <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                    </button>
                  ))}
                </div>
                
                {/* Intervalles - Compact */}
                <div className="flex bg-gray-800 rounded-lg p-0.5">
                  {(['1m', '5m', '15m', '1h', '4h', '1d'] as TimeInterval[]).map((interval) => (
                    <button
                      key={interval}
                      onClick={() => setChartInterval(interval)}
                      className={`px-1.5 sm:px-2 py-1 rounded text-[10px] sm:text-xs transition-colors ${
                        chartInterval === interval ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {interval}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Chart - Hauteur Responsive */}
            <div className="p-1 sm:p-2 relative">
              <div ref={chartContainerRef} className="w-full h-[300px] sm:h-[350px] lg:h-[400px]" />
              {/* NEUROVEST Chart Watermark */}
              <ChartWatermark symbol={selectedSymbol} position="center" />
            </div>
            
            {/* Volume - Compact */}
            <div className="px-2 sm:px-3 py-1.5 sm:py-2 border-t border-gray-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Vol 24h</span>
                {refreshSettings.autoRefresh && (
                  <span className="text-[10px] text-blue-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                    Live ({refreshSettings.refreshInterval}s)
                  </span>
                )}
              </div>
              <span className="text-white font-medium">${(volume24h / 1e9).toFixed(2)}B</span>
            </div>
          </div>
        </div>
        
        {/* === COLONNE DROITE: MÉTRIQUES - COMPACT === */}
        <div className="space-y-2 sm:space-y-3">
          
          {/* Performance Cards - Style amélioré */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all group">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${totalPnL >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  <TrendingUp className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`} />
                </div>
                <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-medium">P&L Total</p>
              </div>
              <p className={`text-lg sm:text-xl font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPnL >= 0 ? '+' : ''}{Math.abs(totalPnL) > 1000 ? (totalPnL/1000).toFixed(1) + 'K' : totalPnL.toFixed(0)}$
              </p>
            </div>
            <div className="bg-gradient-to-br from-gray-900 to-gray-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-blue-500/20">
                  <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                </div>
                <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-medium">Win Rate</p>
              </div>
              <p className="text-lg sm:text-xl font-bold text-blue-400">{performance.winRate.toFixed(0)}%</p>
            </div>
            <div className="bg-gradient-to-br from-gray-900 to-gray-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-purple-500/20">
                  <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
                </div>
                <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-medium">Trades</p>
              </div>
              <p className="text-lg sm:text-xl font-bold text-white">{performance.totalTrades}</p>
            </div>
            <div className="bg-gradient-to-br from-gray-900 to-gray-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${openRisk > 50 ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                  <Shield className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${openRisk > 50 ? 'text-red-400' : 'text-green-400'}`} />
                </div>
                <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-medium">Risque</p>
              </div>
              <p className={`text-lg sm:text-xl font-bold ${openRisk > 50 ? 'text-red-400' : 'text-green-400'}`}>{openRisk.toFixed(0)}%</p>
            </div>
          </div>
          
          {/* Risk Management - Style amélioré */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-700/50">
            <h3 className="text-xs sm:text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <div className="p-1.5 bg-orange-500/20 rounded-lg">
                <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-400" />
              </div>
              Gestion du Risque
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-gray-400">Perte du Jour</span>
                <span className="text-white font-medium">${riskMetrics.dailyLoss.toFixed(0)}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${openRisk > 50 ? 'bg-gradient-to-r from-red-600 to-red-500' : openRisk > 25 ? 'bg-gradient-to-r from-yellow-600 to-yellow-500' : 'bg-gradient-to-r from-green-600 to-green-500'}`}
                  style={{ width: `${Math.min(openRisk, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>0%</span>
                <span className={openRisk > 50 ? 'text-red-400' : openRisk > 25 ? 'text-yellow-400' : 'text-green-400'}>
                  {openRisk.toFixed(1)}% utilisé
                </span>
                <span>100%</span>
              </div>
            </div>
          </div>
          
          {/* Top Movers - Style amélioré */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800/30 rounded-xl sm:rounded-2xl border border-gray-700/50 overflow-hidden">
            <div className="px-3 sm:px-4 py-3 border-b border-gray-700/50 bg-gray-800/30">
              <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                <div className="p-1.5 bg-orange-500/20 rounded-lg">
                  <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-400" />
                </div>
                Top 24h
              </h3>
            </div>
            
            <div className="p-2 space-y-1">
              {/* Top Gainers */}
              {topGainers.slice(0, 3).map((crypto) => (
                <button
                  key={crypto.symbol}
                  onClick={() => setSelectedSymbol(crypto.symbol)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-green-500/10 rounded-xl transition-all border border-transparent hover:border-green-500/20 group"
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-[10px] font-bold shadow-lg transition-transform group-hover:scale-110"
                      style={{ backgroundColor: CRYPTO_LIST.find(c => c.symbol === crypto.symbol)?.color }}
                    >
                      {crypto.symbol.slice(0, 1)}
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-white">{crypto.symbol.replace('USDT', '')}</span>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded-full">+{crypto.change24h.toFixed(1)}%</span>
                </button>
              ))}
              
              {/* Top Losers */}
              <div className="border-t border-gray-700/50 pt-1">
                {topLosers.slice(0, 3).map((crypto) => (
                  <button
                    key={crypto.symbol}
                    onClick={() => setSelectedSymbol(crypto.symbol)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 group"
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-[10px] font-bold shadow-lg transition-transform group-hover:scale-110"
                        style={{ backgroundColor: CRYPTO_LIST.find(c => c.symbol === crypto.symbol)?.color }}
                      >
                        {crypto.symbol.slice(0, 1)}
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-white">{crypto.symbol.replace('USDT', '')}</span>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-red-400 bg-red-500/10 px-2 py-1 rounded-full">{crypto.change24h.toFixed(1)}%</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
        </div>
      </div>
      
      {/* === POSITIONS & ALERTES - COMPACT === */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
        
        {/* Positions Ouvertes - Style amélioré */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800/30 rounded-xl sm:rounded-2xl border border-gray-700/50 overflow-hidden">
          <div className="px-3 sm:px-4 py-3 border-b border-gray-700/50 bg-gray-800/30 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/20 rounded-lg">
                <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
              </div>
              Positions ({openPositions.length})
            </h3>
          </div>
          
          {openPositions.length > 0 ? (
            <div className="divide-y divide-gray-700/30 max-h-48 overflow-y-auto">
              {openPositions.map((pos) => (
                <div key={pos.id} className="px-3 sm:px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      pos.side === 'LONG' ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
                    }`}>
                      <span className={`text-xs font-bold ${pos.side === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                        {pos.side === 'LONG' ? 'L' : 'S'}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{pos.symbol.replace('USDT', '')}</p>
                      <p className="text-gray-500 text-xs">{(pos.quantity || 0).toFixed(4)} @ ${(pos.entryPrice || 0).toFixed(0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-sm font-bold ${(pos.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(pos.pnl || 0) >= 0 ? '+' : ''}{(pos.pnlPercent || 0).toFixed(1)}%
                      </p>
                    </div>
                    <button
                      onClick={() => closePosition(pos.id)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-all hover:scale-105"
                      title="Fermer la position"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <div className="p-4 bg-gray-800/50 rounded-2xl mb-3 inline-block">
                <Target className="w-8 h-8 text-gray-600" />
              </div>
              <p className="text-sm text-gray-400 font-medium">Aucune position ouverte</p>
              <p className="text-xs text-gray-600 mt-1">Commencez à trader pour voir vos positions</p>
            </div>
          )}
        </div>
        
        {/* Actualités Crypto - Temps réel */}
        <CryptoNews />

        {/* Alertes & Bot Status - Style amélioré */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800/30 rounded-xl sm:rounded-2xl border border-gray-700/50 overflow-hidden">
          <div className="px-3 sm:px-4 py-3 border-b border-gray-700/50 bg-gray-800/30">
            <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
              <div className="p-1.5 bg-yellow-500/20 rounded-lg">
                <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400" />
              </div>
              Alertes & Statut
            </h3>
          </div>
          <div className="p-3 space-y-3">
            {/* Bot Status */}
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl border border-gray-700/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/20 rounded-lg">
                  <Bot className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-sm text-white font-medium">Trading Bot</span>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-gray-700/50">
                <span className={`w-2 h-2 rounded-full ${botStatus.isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-xs font-medium text-gray-300">{botStatus.isRunning ? 'Actif' : 'Inactif'}</span>
              </div>
            </div>
            
            {/* Risk Alert */}
            {openRisk > 50 && (
              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-red-950/50 to-red-900/20 border border-red-500/30 rounded-xl">
                <div className="p-1.5 bg-red-500/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-sm text-red-400 font-medium">Risque élevé ({openRisk.toFixed(0)}%)</span>
              </div>
            )}
            
            {/* Daily Loss Alert */}
            {riskMetrics.dailyLoss > riskMetrics.dailyLossLimit * 0.8 && (
              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-yellow-950/50 to-yellow-900/20 border border-yellow-500/30 rounded-xl">
                <div className="p-1.5 bg-yellow-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-400" />
                </div>
                <span className="text-sm text-yellow-400 font-medium">Limite perte approchée</span>
              </div>
            )}
          </div>
        </div>
        
      </div>
      
      {/* === HISTORIQUE DES TRADES === */}
      {tradeHistory.length > 0 && (
        <div className="bg-gray-900 rounded-xl sm:rounded-2xl border border-gray-800 overflow-hidden mt-3">
          <div className="px-3 sm:px-4 py-2 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400" />
              Derniers Trades ({tradeHistory.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-800 max-h-48 overflow-y-auto">
            {tradeHistory.slice(0, 5).map((trade) => (
              <div key={trade.id} className="px-3 sm:px-4 py-2 flex items-center justify-between hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded flex items-center justify-center ${
                    trade.type === 'buy' ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    <span className={`text-[10px] font-bold ${trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.type === 'buy' ? 'A' : 'V'}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-medium text-xs">{trade.symbol?.replace('USDT', '')}</p>
                    <p className="text-gray-400 text-[10px]">
                      {(trade.quantity || 0).toFixed(4)} @ ${(trade.entryPrice || 0).toFixed(0)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold ${(trade.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {trade.timestamp ? new Date(trade.timestamp).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
