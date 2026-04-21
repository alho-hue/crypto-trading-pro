import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { FCFAConverter } from './FCFAConverter';
import { 
  Play, RotateCcw, TrendingUp, TrendingDown, DollarSign, Percent, Calendar, 
  BarChart3, Download, Save, Trash2, ChevronDown, ChevronUp, Settings,
  Target, Shield, Activity, Brain, Clock, Filter, Rocket, FileSpreadsheet
} from 'lucide-react';
import { calculateSMA, calculateRSI, calculateMACD, calculateBollingerBands, calculateATR } from '../utils/indicators';
import { notifications } from '../services/notificationService';
import { excelExport } from '../services/excelExportService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ComposedChart, Bar } from 'recharts';

// 🔥 MÉTRIQUES AVANCÉES
interface BacktestMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgTradeReturn: number;
  avgWin: number;
  avgLoss: number;
  riskRewardRatio: number;
  expectancy: number;
  totalFees: number;
  totalSlippage: number;
  totalTrades: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  avgTradeDuration: number; // en heures
  bestTrade: number;
  worstTrade: number;
}

interface BacktestTrade {
  id: string;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  type: 'buy' | 'sell';
  side: 'long' | 'short';
  size: number;
  pnl: number;
  pnlPercent: number;
  fees: number;
  slippage: number;
  netPnl: number;
  stopLoss?: number;
  takeProfit?: number;
  exitReason: 'tp' | 'sl' | 'signal' | 'end';
  strategySignal: string;
  duration: number; // en millisecondes
}

interface BacktestResult extends BacktestMetrics {
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  drawdownCurve: DrawdownPoint[];
  monthlyReturns: MonthlyReturn[];
  config: BacktestConfig;
  testDate: string;
}

interface EquityPoint {
  timestamp: number;
  date: string;
  equity: number;
  trade?: BacktestTrade;
}

interface DrawdownPoint {
  timestamp: number;
  date: string;
  drawdown: number;
  drawdownPercent: number;
}

interface MonthlyReturn {
  month: string;
  return: number;
  returnPercent: number;
  trades: number;
}

// 🔥 CONFIGURATION AVANCÉE
interface BacktestConfig {
  symbol: string;
  timeframe: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
  startDate: string;
  endDate: string;
  initialCapital: number;
  strategy: 'sma_cross' | 'rsi' | 'macd' | 'bollinger' | 'ai_ethernal' | 'custom';
  riskPerTrade: number; // % du capital
  stopLossPercent: number;
  takeProfitPercent: number;
  useTrailingStop: boolean;
  trailingStopPercent: number;
  maxPositions: number;
  leverage: number; // 1 = spot, >1 = futures
  feesType: 'spot' | 'futures_maker' | 'futures_taker';
  slippagePercent: number;
  useAIConfirmation: boolean;
  aiConfidenceThreshold: number;
}

interface SavedBacktest {
  id: string;
  name: string;
  date: string;
  config: BacktestConfig;
  result: BacktestResult;
}

export default function Backtest() {
  const [config, setConfig] = useState<BacktestConfig>({
    symbol: 'BTCUSDT',
    timeframe: '1h',
    startDate: '',
    endDate: '',
    initialCapital: 10000,
    strategy: 'sma_cross',
    riskPerTrade: 2,
    stopLossPercent: 2,
    takeProfitPercent: 4,
    useTrailingStop: false,
    trailingStopPercent: 1.5,
    maxPositions: 1,
    leverage: 1,
    feesType: 'spot',
    slippagePercent: 0.05,
    useAIConfirmation: false,
    aiConfidenceThreshold: 70,
  });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<BacktestTrade | null>(null);

  const candleData = useCryptoStore((state) => state.candleData);

  // Set default dates
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    
    setConfig(prev => ({
      ...prev,
      endDate: end.toISOString().split('T')[0],
      startDate: start.toISOString().split('T')[0],
    }));
  }, []);

  // 🔥 FRAIS BINANCE RÉELS
  const getTradingFees = (type: 'spot' | 'futures_maker' | 'futures_taker'): number => {
    switch (type) {
      case 'spot': return 0.001; // 0.1%
      case 'futures_maker': return 0.0002; // 0.02%
      case 'futures_taker': return 0.0004; // 0.04%
      default: return 0.001;
    }
  };

  // 🔥 SIMULATION RÉELLE AVEC SL/TP/FRAIS/SLIPPAGE
  const simulateRealTrade = (
    entry: number,
    exit: number,
    entryTime: number,
    exitTime: number,
    side: 'long' | 'short',
    capital: number,
    config: BacktestConfig,
    exitReason: 'tp' | 'sl' | 'signal' | 'end',
    signal: string
  ): BacktestTrade => {
    const feesRate = getTradingFees(config.feesType);
    const slippageRate = config.slippagePercent / 100;
    
    // Appliquer le slippage sur l'entrée et la sortie
    const slippageEntry = entry * slippageRate * (Math.random() * 0.5 + 0.5); // 0.5x à 1x du slippage
    const slippageExit = exit * slippageRate * (Math.random() * 0.5 + 0.5);
    
    const realEntry = side === 'long' 
      ? entry + slippageEntry  // Achat plus cher
      : entry - slippageEntry; // Vente moins cher
    
    const realExit = side === 'long'
      ? exit - slippageExit     // Vente moins cher
      : exit + slippageExit;    // Achat plus cher (pour short cover)
    
    // Calculer la taille basée sur le risque
    const riskAmount = capital * (config.riskPerTrade / 100);
    const stopDistance = config.stopLossPercent / 100;
    const size = riskAmount / (realEntry * stopDistance);
    
    // P&L brut
    const pnl = side === 'long'
      ? (realExit - realEntry) * size
      : (realEntry - realExit) * size;
    
    // Frais (entrée + sortie)
    const fees = (realEntry * size * feesRate) + (realExit * size * feesRate);
    
    // Slippage total en valeur
    const totalSlippage = slippageEntry * size + slippageExit * size;
    
    // P&L net
    const netPnl = pnl - fees;
    
    return {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entryTime,
      exitTime,
      entryPrice: realEntry,
      exitPrice: realExit,
      type: side === 'long' ? 'buy' : 'sell',
      side,
      size,
      pnl,
      pnlPercent: (pnl / capital) * 100,
      fees,
      slippage: totalSlippage,
      netPnl,
      stopLoss: side === 'long' 
        ? realEntry * (1 - config.stopLossPercent / 100)
        : realEntry * (1 + config.stopLossPercent / 100),
      takeProfit: side === 'long'
        ? realEntry * (1 + config.takeProfitPercent / 100)
        : realEntry * (1 - config.takeProfitPercent / 100),
      exitReason,
      strategySignal: signal,
      duration: exitTime - entryTime,
    };
  };

  // 🔥 CALCULER LES MÉTRIQUES AVANCÉES
  const calculateAdvancedMetrics = (
    trades: BacktestTrade[],
    initialCapital: number,
    equityCurve: EquityPoint[]
  ): BacktestMetrics => {
    const winningTrades = trades.filter(t => t.netPnl > 0);
    const losingTrades = trades.filter(t => t.netPnl <= 0);
    const totalTrades = trades.length;
    
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.netPnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnl, 0));
    const totalReturn = trades.reduce((sum, t) => sum + t.netPnl, 0);
    
    const avgWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
    
    // Sharpe Ratio (simplifié)
    const returns = equityCurve.map((p, i) => 
      i === 0 ? 0 : (p.equity - equityCurve[i-1].equity) / equityCurve[i-1].equity
    ).filter(r => r !== 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(
      returns.reduce((sq, n) => sq + Math.pow(n - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(365) : 0;
    
    // Sortino Ratio (downside deviation only)
    const downsideReturns = returns.filter(r => r < 0);
    const downsideDeviation = downsideReturns.length > 0
      ? Math.sqrt(downsideReturns.reduce((sq, n) => sq + n * n, 0) / downsideReturns.length)
      : 0;
    const sortinoRatio = downsideDeviation > 0 ? (avgReturn / downsideDeviation) * Math.sqrt(365) : 0;
    
    // Max Drawdown
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let peak = initialCapital;
    
    for (const point of equityCurve) {
      if (point.equity > peak) peak = point.equity;
      const drawdown = peak - point.equity;
      const drawdownPercent = (drawdown / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }
    
    // Séries
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    
    for (const trade of trades) {
      if (trade.netPnl > 0) {
        if (currentStreak > 0) currentStreak++;
        else currentStreak = 1;
        maxWinStreak = Math.max(maxWinStreak, currentStreak);
      } else {
        if (currentStreak < 0) currentStreak--;
        else currentStreak = -1;
        maxLossStreak = Math.min(maxLossStreak, currentStreak);
      }
    }
    
    // Durée moyenne des trades (en heures)
    const avgTradeDuration = trades.length > 0
      ? trades.reduce((sum, t) => sum + t.duration, 0) / trades.length / (1000 * 60 * 60)
      : 0;
    
    return {
      totalReturn,
      totalReturnPercent: (totalReturn / initialCapital) * 100,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      totalTrades,
      winRate: totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
      maxDrawdown,
      maxDrawdownPercent,
      sharpeRatio,
      sortinoRatio,
      avgTradeReturn: totalTrades > 0 ? totalReturn / totalTrades : 0,
      avgWin,
      avgLoss,
      riskRewardRatio: avgLoss > 0 ? avgWin / avgLoss : 0,
      expectancy: totalTrades > 0 ? totalReturn / totalTrades : 0,
      totalFees: trades.reduce((sum, t) => sum + t.fees, 0),
      totalSlippage: trades.reduce((sum, t) => sum + t.slippage, 0),
      consecutiveWins: maxWinStreak,
      consecutiveLosses: Math.abs(maxLossStreak),
      avgTradeDuration,
      bestTrade: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.netPnl)) : 0,
      worstTrade: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.netPnl)) : 0,
    };
  };

  // 🔥 RUN BACKTEST COMPLÈTEMENT RÉÉCRIT
  const runBacktest = async () => {
    if (candleData.length < 50) {
      alert('Pas assez de données historiques. Chargez des données réelles via l\'API Binance.');
      return;
    }

    setRunning(true);

    // Simulation asynchrone pour ne pas bloquer l'UI
    setTimeout(() => {
      let trades: BacktestTrade[] = [];
      const equityCurve: EquityPoint[] = [{ timestamp: Date.now(), date: new Date().toISOString(), equity: config.initialCapital }];
      let currentCapital = config.initialCapital;

      // 🔥 Exécuter la stratégie sélectionnée avec simulation réelle
      switch (config.strategy) {
        case 'sma_cross':
          trades = runSMACrossStrategyReal(candleData, config, (trade, capital) => {
            currentCapital = capital;
            equityCurve.push({
              timestamp: trade.exitTime * 1000,
              date: new Date(trade.exitTime * 1000).toISOString(),
              equity: capital,
              trade
            });
          });
          break;
        case 'rsi':
          trades = runRSIStrategyReal(candleData, config, (trade, capital) => {
            currentCapital = capital;
            equityCurve.push({
              timestamp: trade.exitTime * 1000,
              date: new Date(trade.exitTime * 1000).toISOString(),
              equity: capital,
              trade
            });
          });
          break;
        case 'macd':
          trades = runMACDStrategyReal(candleData, config, (trade, capital) => {
            currentCapital = capital;
            equityCurve.push({
              timestamp: trade.exitTime * 1000,
              date: new Date(trade.exitTime * 1000).toISOString(),
              equity: capital,
              trade
            });
          });
          break;
        case 'bollinger':
          trades = runBollingerStrategyReal(candleData, config, (trade, capital) => {
            currentCapital = capital;
            equityCurve.push({
              timestamp: trade.exitTime * 1000,
              date: new Date(trade.exitTime * 1000).toISOString(),
              equity: capital,
              trade
            });
          });
          break;
        case 'ai_ethernal':
          trades = runAIStrategyReal(candleData, config, (trade, capital) => {
            currentCapital = capital;
            equityCurve.push({
              timestamp: trade.exitTime * 1000,
              date: new Date(trade.exitTime * 1000).toISOString(),
              equity: capital,
              trade
            });
          });
          break;
      }

      // Calculer toutes les métriques avancées
      const metrics = calculateAdvancedMetrics(trades, config.initialCapital, equityCurve);
      
      // Calculer la courbe de drawdown
      const drawdownCurve: DrawdownPoint[] = [];
      let peak = config.initialCapital;
      for (const point of equityCurve) {
        if (point.equity > peak) peak = point.equity;
        const drawdown = peak - point.equity;
        drawdownCurve.push({
          timestamp: point.timestamp,
          date: point.date,
          drawdown,
          drawdownPercent: (drawdown / peak) * 100
        });
      }

      // Calculer les returns mensuels
      const monthlyReturns: MonthlyReturn[] = [];
      const monthlyMap = new Map<string, { return: number; trades: number }>();
      
      for (const trade of trades) {
        const date = new Date(trade.exitTime * 1000);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const current = monthlyMap.get(monthKey) || { return: 0, trades: 0 };
        monthlyMap.set(monthKey, {
          return: current.return + trade.netPnl,
          trades: current.trades + 1
        });
      }
      
      for (const [month, data] of monthlyMap) {
        monthlyReturns.push({
          month,
          return: data.return,
          returnPercent: (data.return / config.initialCapital) * 100,
          trades: data.trades
        });
      }
      monthlyReturns.sort((a, b) => a.month.localeCompare(b.month));

      setResult({
        ...metrics,
        trades,
        equityCurve,
        drawdownCurve,
        monthlyReturns,
        config: { ...config },
        testDate: new Date().toISOString(),
      });

      setRunning(false);
    }, 100);
  };

  // 🔥 NOUVELLES STRATÉGIES AVEC SIMULATION RÉELLE SL/TP/FRAIS/SLIPPAGE

  type TradeCallback = (trade: BacktestTrade, newCapital: number) => void;

  // SMA Crossover Strategy - VERSION RÉELLE
  const runSMACrossStrategyReal = (
    candles: typeof candleData, 
    config: BacktestConfig,
    onTrade: TradeCallback
  ): BacktestTrade[] => {
    const trades: BacktestTrade[] = [];
    let capital = config.initialCapital;
    let position: { 
      type: 'long' | 'short'; 
      entry: number; 
      time: number;
      stopLoss: number;
      takeProfit: number;
    } | null = null;
    
    const sma20 = calculateSMA(candles, 20);
    const sma50 = calculateSMA(candles, 50);

    for (let i = 50; i < candles.length; i++) {
      if (!sma20[i] || !sma50[i] || !sma20[i-1] || !sma50[i-1]) continue;

      // Vérifier si position ouverte - gérer SL/TP
      if (position) {
        const candle = candles[i];
        let exitPrice: number | null = null;
        let exitReason: 'tp' | 'sl' | 'signal' | 'end' = 'signal';

        // Vérifier SL
        if (position.type === 'long' && candle.low <= position.stopLoss) {
          exitPrice = position.stopLoss;
          exitReason = 'sl';
        } else if (position.type === 'short' && candle.high >= position.stopLoss) {
          exitPrice = position.stopLoss;
          exitReason = 'sl';
        }
        // Vérifier TP
        else if (position.type === 'long' && candle.high >= position.takeProfit) {
          exitPrice = position.takeProfit;
          exitReason = 'tp';
        } else if (position.type === 'short' && candle.low <= position.takeProfit) {
          exitPrice = position.takeProfit;
          exitReason = 'tp';
        }
        // Signal de sortie (Death cross)
        else if (sma20[i-1]! >= sma50[i-1]! && sma20[i]! < sma50[i]! && position.type === 'long') {
          exitPrice = candle.close;
          exitReason = 'signal';
        }

        if (exitPrice !== null) {
          const trade = simulateRealTrade(
            position.entry, exitPrice, position.time, candle.time,
            position.type, capital, config, exitReason, 'SMA Cross Death'
          );
          trades.push(trade);
          capital += trade.netPnl;
          onTrade(trade, capital);
          position = null;
        }
      }

      // Golden cross - Buy signal
      if (sma20[i-1]! <= sma50[i-1]! && sma20[i]! > sma50[i]! && !position) {
        const entry = candles[i].close;
        position = { 
          type: 'long', 
          entry, 
          time: candles[i].time,
          stopLoss: entry * (1 - config.stopLossPercent / 100),
          takeProfit: entry * (1 + config.takeProfitPercent / 100)
        };
      }
    }

    // Fermer position ouverte à la fin
    if (position && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const trade = simulateRealTrade(
        position.entry, lastCandle.close, position.time, lastCandle.time,
        position.type, capital, config, 'end', 'SMA Cross End'
      );
      trades.push(trade);
      capital += trade.netPnl;
      onTrade(trade, capital);
    }

    return trades;
  };

  // RSI Strategy - VERSION RÉELLE
  const runRSIStrategyReal = (
    candles: typeof candleData, 
    config: BacktestConfig,
    onTrade: TradeCallback
  ): BacktestTrade[] => {
    const trades: BacktestTrade[] = [];
    let capital = config.initialCapital;
    let position: { 
      type: 'long' | 'short'; 
      entry: number; 
      time: number;
      stopLoss: number;
      takeProfit: number;
    } | null = null;
    
    const rsi = calculateRSI(candles, 14);

    for (let i = 14; i < candles.length; i++) {
      if (rsi[i] === null || rsi[i-1] === null) continue;

      // Vérifier SL/TP
      if (position) {
        const candle = candles[i];
        let exitPrice: number | null = null;
        let exitReason: 'tp' | 'sl' | 'signal' | 'end' = 'signal';

        if (position.type === 'long' && candle.low <= position.stopLoss) {
          exitPrice = position.stopLoss;
          exitReason = 'sl';
        } else if (position.type === 'long' && candle.high >= position.takeProfit) {
          exitPrice = position.takeProfit;
          exitReason = 'tp';
        }
        // Signal de sortie RSI > 70
        else if (rsi[i-1]! <= 70 && rsi[i]! > 70 && position.type === 'long') {
          exitPrice = candle.close;
          exitReason = 'signal';
        }

        if (exitPrice !== null) {
          const trade = simulateRealTrade(
            position.entry, exitPrice, position.time, candle.time,
            position.type, capital, config, exitReason, 'RSI Overbought'
          );
          trades.push(trade);
          capital += trade.netPnl;
          onTrade(trade, capital);
          position = null;
        }
      }

      // RSI < 30 - Buy signal
      if (rsi[i-1]! >= 30 && rsi[i]! < 30 && !position) {
        const entry = candles[i].close;
        position = { 
          type: 'long', 
          entry, 
          time: candles[i].time,
          stopLoss: entry * (1 - config.stopLossPercent / 100),
          takeProfit: entry * (1 + config.takeProfitPercent / 100)
        };
      }
    }

    if (position && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const trade = simulateRealTrade(
        position.entry, lastCandle.close, position.time, lastCandle.time,
        position.type, capital, config, 'end', 'RSI End'
      );
      trades.push(trade);
      capital += trade.netPnl;
      onTrade(trade, capital);
    }

    return trades;
  };

  // MACD Strategy - VERSION RÉELLE
  const runMACDStrategyReal = (
    candles: typeof candleData, 
    config: BacktestConfig,
    onTrade: TradeCallback
  ): BacktestTrade[] => {
    const trades: BacktestTrade[] = [];
    let capital = config.initialCapital;
    let position: { 
      type: 'long' | 'short'; 
      entry: number; 
      time: number;
      stopLoss: number;
      takeProfit: number;
    } | null = null;
    
    const macd = calculateMACD(candles);

    for (let i = 35; i < candles.length; i++) {
      const currMACD = macd.macd[i];
      const currSignal = macd.signal[i];
      const prevMACD = macd.macd[i-1];
      const prevSignal = macd.signal[i-1];

      if (currMACD === null || currSignal === null || prevMACD === null || prevSignal === null) continue;

      // Vérifier SL/TP
      if (position) {
        const candle = candles[i];
        let exitPrice: number | null = null;
        let exitReason: 'tp' | 'sl' | 'signal' | 'end' = 'signal';

        if (position.type === 'long' && candle.low <= position.stopLoss) {
          exitPrice = position.stopLoss;
          exitReason = 'sl';
        } else if (position.type === 'long' && candle.high >= position.takeProfit) {
          exitPrice = position.takeProfit;
          exitReason = 'tp';
        }
        // MACD cross below signal
        else if (prevMACD >= prevSignal && currMACD < currSignal && position.type === 'long') {
          exitPrice = candle.close;
          exitReason = 'signal';
        }

        if (exitPrice !== null) {
          const trade = simulateRealTrade(
            position.entry, exitPrice, position.time, candle.time,
            position.type, capital, config, exitReason, 'MACD Bearish'
          );
          trades.push(trade);
          capital += trade.netPnl;
          onTrade(trade, capital);
          position = null;
        }
      }

      // MACD cross above signal - Buy
      if (prevMACD <= prevSignal && currMACD > currSignal && !position) {
        const entry = candles[i].close;
        position = { 
          type: 'long', 
          entry, 
          time: candles[i].time,
          stopLoss: entry * (1 - config.stopLossPercent / 100),
          takeProfit: entry * (1 + config.takeProfitPercent / 100)
        };
      }
    }

    if (position && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const trade = simulateRealTrade(
        position.entry, lastCandle.close, position.time, lastCandle.time,
        position.type, capital, config, 'end', 'MACD End'
      );
      trades.push(trade);
      capital += trade.netPnl;
      onTrade(trade, capital);
    }

    return trades;
  };

  // Bollinger Bands Strategy - VERSION RÉELLE
  const runBollingerStrategyReal = (
    candles: typeof candleData, 
    config: BacktestConfig,
    onTrade: TradeCallback
  ): BacktestTrade[] => {
    const trades: BacktestTrade[] = [];
    let capital = config.initialCapital;
    let position: { 
      type: 'long' | 'short'; 
      entry: number; 
      time: number;
      stopLoss: number;
      takeProfit: number;
    } | null = null;
    
    const bb = calculateBollingerBands(candles, 20, 2);

    for (let i = 20; i < candles.length; i++) {
      const candle = candles[i];
      const upper = bb.upper[i];
      const lower = bb.lower[i];
      const middle = bb.middle[i];

      if (upper === null || lower === null || middle === null) continue;

      // Vérifier SL/TP
      if (position) {
        let exitPrice: number | null = null;
        let exitReason: 'tp' | 'sl' | 'signal' | 'end' = 'signal';

        if (position.type === 'long' && candle.low <= position.stopLoss) {
          exitPrice = position.stopLoss;
          exitReason = 'sl';
        } else if (position.type === 'long' && candle.high >= position.takeProfit) {
          exitPrice = position.takeProfit;
          exitReason = 'tp';
        }
        // Retour à la moyenne (middle band)
        else if (candle.high >= middle && position.type === 'long') {
          exitPrice = candle.close;
          exitReason = 'signal';
        }

        if (exitPrice !== null) {
          const trade = simulateRealTrade(
            position.entry, exitPrice, position.time, candle.time,
            position.type, capital, config, exitReason, 'BB Mean Reversion'
          );
          trades.push(trade);
          capital += trade.netPnl;
          onTrade(trade, capital);
          position = null;
        }
      }

      // Prix touche bande inférieure - Buy (mean reversion)
      if (candle.low <= lower && !position) {
        const entry = candle.close;
        position = { 
          type: 'long', 
          entry, 
          time: candle.time,
          stopLoss: entry * (1 - config.stopLossPercent / 100),
          takeProfit: middle // Target: middle band
        };
      }
    }

    if (position && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const trade = simulateRealTrade(
        position.entry, lastCandle.close, position.time, lastCandle.time,
        position.type, capital, config, 'end', 'BB End'
      );
      trades.push(trade);
      capital += trade.netPnl;
      onTrade(trade, capital);
    }

    return trades;
  };

  // 🔥 STRATÉGIE IA ETHERNAL - BACKTEST
  const runAIStrategyReal = (
    candles: typeof candleData,
    config: BacktestConfig,
    onTrade: TradeCallback
  ): BacktestTrade[] => {
    const trades: BacktestTrade[] = [];
    let capital = config.initialCapital;
    let position: {
      type: 'long' | 'short';
      entry: number;
      time: number;
      stopLoss: number;
      takeProfit: number;
      confidence: number;
    } | null = null;

    // Paramètres IA (même logique que Dashboard)
    const MIN_SIGNAL_SCORE = 4;
    const MIN_GAP = 2;

    for (let i = 50; i < candles.length; i++) {
      const currentSlice = candles.slice(0, i + 1);
      const currentPrice = candles[i].close;
      const currentTime = candles[i].time;
      const candle = candles[i];

      // Calculer les indicateurs sur la période actuelle
      const sma20 = calculateSMA(currentSlice, 20);
      const sma50 = calculateSMA(currentSlice, 50);
      const rsi = calculateRSI(currentSlice, 14);
      const macd = calculateMACD(currentSlice);
      const bb = calculateBollingerBands(currentSlice, 20, 2);

      const currentSMA20 = sma20[i];
      const currentSMA50 = sma50[i];
      const currentRSI = rsi[i];
      const currentMACD = macd.macd[i];
      const currentSignal = macd.signal[i];
      const prevMACD = macd.macd[i - 1];
      const prevSignal = macd.signal[i - 1];
      const currentBB = {
        upper: bb.upper[i],
        middle: bb.middle[i],
        lower: bb.lower[i],
      };

      if (currentRSI === null || currentMACD === null || currentSignal === null) continue;

      // 🔥 LOGIQUE IA (même que Dashboard)
      let longPoints = 0;
      let shortPoints = 0;
      const reasons: string[] = [];

      // RSI Analysis
      if (currentRSI < 35) {
        longPoints += 2;
        reasons.push('RSI survente');
      } else if (currentRSI > 65) {
        shortPoints += 2;
        reasons.push('RSI surachat');
      }

      // MACD Analysis
      if (prevMACD !== null && prevSignal !== null) {
        if (prevMACD <= prevSignal && currentMACD > currentSignal) {
          longPoints += 3;
          reasons.push('MACD haussier');
        } else if (prevMACD >= prevSignal && currentMACD < currentSignal) {
          shortPoints += 3;
          reasons.push('MACD baissier');
        }
      }

      // Moving Averages
      if (currentSMA20 !== null && currentSMA50 !== null) {
        const prevSMA20 = sma20[i - 1];
        const prevSMA50 = sma50[i - 1];
        if (prevSMA20 !== null && prevSMA50 !== null) {
          if (prevSMA20 <= prevSMA50 && currentSMA20 > currentSMA50) {
            longPoints += 2;
            reasons.push('SMA20 croise SMA50');
          } else if (prevSMA20 >= prevSMA50 && currentSMA20 < currentSMA50) {
            shortPoints += 2;
            reasons.push('SMA20 descend sous SMA50');
          }
        }
      }

      // Bollinger Bands
      if (currentBB.lower !== null && currentBB.upper !== null) {
        const priceToBB = (currentPrice - currentBB.lower) / (currentBB.upper - currentBB.lower);
        if (candle.low <= currentBB.lower) {
          longPoints += 2;
          reasons.push('Prix touche bande inférieure');
        } else if (candle.high >= currentBB.upper) {
          shortPoints += 2;
          reasons.push('Prix touche bande supérieure');
        }
      }

      // Calcul score
      const scoreDiff = longPoints - shortPoints;
      let signalType: 'LONG' | 'SHORT' | 'WAIT' = 'WAIT';
      let confidence = 40;

      // Conditions pour signal
      if (longPoints >= MIN_SIGNAL_SCORE && scoreDiff >= MIN_GAP && currentRSI < 55) {
        signalType = 'LONG';
        confidence = Math.min(88, 70 + longPoints * 2);
      } else if (shortPoints >= MIN_SIGNAL_SCORE && scoreDiff <= -MIN_GAP && currentRSI > 45) {
        signalType = 'SHORT';
        confidence = Math.min(88, 70 + shortPoints * 2);
      }

      // 🔥 VÉRIFIER SL/TP SI POSITION OUVERTE
      if (position) {
        let exitPrice: number | null = null;
        let exitReason: 'tp' | 'sl' | 'signal' | 'end' = 'signal';

        if (position.type === 'long' && candle.low <= position.stopLoss) {
          exitPrice = position.stopLoss;
          exitReason = 'sl';
        } else if (position.type === 'long' && candle.high >= position.takeProfit) {
          exitPrice = position.takeProfit;
          exitReason = 'tp';
        }
        // Signal inverse ou WAIT = sortie
        else if (position.type === 'long' && (signalType === 'SHORT' || (signalType === 'WAIT' && position.confidence < 60))) {
          exitPrice = currentPrice;
          exitReason = 'signal';
        }

        if (exitPrice !== null) {
          const trade = simulateRealTrade(
            position.entry,
            exitPrice,
            position.time,
            currentTime,
            position.type,
            capital,
            config,
            exitReason,
            `IA ${position.confidence}%`
          );
          trades.push(trade);
          capital += trade.netPnl;
          onTrade(trade, capital);
          position = null;
        }
      }

      // 🔥 ENTRÉE EN POSITION SI SIGNAL ET PAS DE POSITION
      if (!position && signalType !== 'WAIT' && confidence >= config.aiConfidenceThreshold) {
        const atr = calculateATR(candles.slice(i - 14, i + 1), 14);
        const currentATR = atr[atr.length - 1] || currentPrice * 0.02;

        const stopLoss = signalType === 'LONG'
          ? currentPrice - (currentATR * 1.5)
          : currentPrice + (currentATR * 1.5);

        const takeProfit = signalType === 'LONG'
          ? currentPrice + (currentATR * 3)
          : currentPrice - (currentATR * 3);

        position = {
          type: signalType === 'LONG' ? 'long' : 'short',
          entry: currentPrice,
          time: currentTime,
          stopLoss,
          takeProfit,
          confidence,
        };
      }
    }

    // Fermer position ouverte
    if (position && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const trade = simulateRealTrade(
        position.entry,
        lastCandle.close,
        position.time,
        lastCandle.time,
        position.type,
        capital,
        config,
        'end',
        `IA End ${position.confidence}%`
      );
      trades.push(trade);
      capital += trade.netPnl;
      onTrade(trade, capital);
    }

    return trades;
  };

  // 🔥 SAUVEGARDE ET COMPARAISON
  const [savedBacktests, setSavedBacktests] = useState<SavedBacktest[]>(() => {
    const saved = localStorage.getItem('neurovest_saved_backtests');
    return saved ? JSON.parse(saved) : [];
  });
  const [showComparison, setShowComparison] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);

  // 🔥 Notification de sauvegarde
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  
  const saveBacktest = () => {
    if (!result) return;
    const newSaved: SavedBacktest = {
      id: `bt_${Date.now()}`,
      name: `${result.config.strategy} - ${result.config.symbol} (${new Date(result.testDate).toLocaleDateString('fr-FR')})`,
      date: new Date().toISOString(),
      config: result.config,
      result,
    };
    const updated = [...savedBacktests, newSaved];
    setSavedBacktests(updated);
    localStorage.setItem('neurovest_saved_backtests', JSON.stringify(updated));
    
    // 🎉 Notification Toast
    notifications.backtestSaved();
  };

  const deleteSavedBacktest = (id: string) => {
    const updated = savedBacktests.filter(b => b.id !== id);
    setSavedBacktests(updated);
    localStorage.setItem('neurovest_saved_backtests', JSON.stringify(updated));
  };

  const loadBacktest = (saved: SavedBacktest) => {
    setConfig(saved.config);
    setResult(saved.result);
  };

  const exportResults = () => {
    if (!result) return;
    
    // Export Excel Professionnel
    const exportData = {
      config: result.config,
      metrics: {
        totalReturn: result.totalReturn,
        totalReturnPercent: result.totalReturnPercent,
        totalTrades: result.totalTrades,
        winningTrades: result.winningTrades,
        losingTrades: result.losingTrades,
        winRate: result.winRate,
        profitFactor: result.profitFactor,
        maxDrawdown: result.maxDrawdown,
        maxDrawdownPercent: result.maxDrawdownPercent,
        sharpeRatio: result.sharpeRatio,
        sortinoRatio: result.sortinoRatio || 0,
        riskRewardRatio: result.riskRewardRatio || 0,
        expectancy: result.expectancy || 0,
        totalFees: result.totalFees,
        totalSlippage: result.totalSlippage
      },
      trades: result.trades.map(t => ({
        entryTime: new Date(t.entryTime * 1000).toLocaleString(),
        exitTime: new Date(t.exitTime * 1000).toLocaleString(),
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        side: t.side,
        pnl: t.pnl,
        pnlPercent: t.pnlPercent,
        exitReason: t.exitReason
      })),
      equityCurve: result.equityCurve.map(e => ({
        date: new Date(e.timestamp).toLocaleString(),
        equity: e.equity
      }))
    };
    
    const filename = excelExport.exportBacktest(exportData);
    notifications.exportSuccess(filename);
  };

  return (
    <div className="space-y-6">
      {/* Header avec actions */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-crypto-blue" />
          Backtesting
        </h1>
        <div className="flex gap-2">
          {result && (
            <>
              <button
                onClick={saveBacktest}
                className="px-3 py-1.5 bg-crypto-green/20 text-crypto-green rounded-lg text-sm hover:bg-crypto-green/30 flex items-center gap-1"
              >
                <Save className="w-4 h-4" />
                Sauvegarder
              </button>
              <button
                onClick={exportResults}
                className="px-3 py-1.5 bg-crypto-blue/20 text-crypto-blue rounded-lg text-sm hover:bg-crypto-blue/30 flex items-center gap-1"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel
              </button>
            </>
          )}
          <button
            onClick={() => setShowComparison(!showComparison)}
            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
              showComparison ? 'bg-crypto-purple text-white' : 'bg-crypto-dark text-gray-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            Comparer ({savedBacktests.length})
          </button>
        </div>
      </div>

      {/* 🎉 NOTIFICATION DE SAUVEGARDE */}
      {showSaveNotification && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in-right">
          <div className="bg-crypto-green border border-crypto-green/50 rounded-lg px-4 py-3 shadow-lg flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Save className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-semibold text-white">Backtest sauvegardé !</div>
              <div className="text-sm text-white/80">Vous pouvez le retrouver dans la comparaison</div>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 PANEL DE COMPARAISON */}
      {showComparison && (
        <div className="crypto-card border-crypto-purple/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Brain className="w-5 h-5 text-crypto-purple" />
              Backtests Sauvegardés
            </h3>
            <button
              onClick={() => setShowComparison(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          {savedBacktests.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Aucun backtest sauvegardé</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {savedBacktests.map((saved) => (
                <div key={saved.id} className="flex items-center justify-between p-3 bg-crypto-dark/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedForComparison.includes(saved.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedForComparison([...selectedForComparison, saved.id]);
                        } else {
                          setSelectedForComparison(selectedForComparison.filter(id => id !== saved.id));
                        }
                      }}
                      className="w-4 h-4 rounded border-crypto-border"
                    />
                    <div>
                      <div className="font-medium">{saved.name}</div>
                      <div className="text-xs text-gray-500">
                        {saved.result?.totalTrades || 0} trades | 
                        {saved.result?.totalReturnPercent >= 0 ? '+' : ''}{(saved.result?.totalReturnPercent || 0).toFixed(1)}% | 
                        PF: {(saved.result?.profitFactor || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadBacktest(saved)}
                      className="px-2 py-1 text-xs bg-crypto-blue/20 text-crypto-blue rounded hover:bg-crypto-blue/30"
                    >
                      Charger
                    </button>
                    <button
                      onClick={() => deleteSavedBacktest(saved.id)}
                      className="px-2 py-1 text-xs bg-crypto-red/20 text-crypto-red rounded hover:bg-crypto-red/30"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {selectedForComparison.length >= 2 && (
            <div className="mt-4 p-4 bg-crypto-dark/50 rounded-lg">
              <h4 className="font-medium mb-3">📊 Comparaison ({selectedForComparison.length} backtests)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-crypto-border">
                      <th className="text-left py-2">Stratégie</th>
                      <th className="text-right py-2">Return</th>
                      <th className="text-right py-2">Win Rate</th>
                      <th className="text-right py-2">PF</th>
                      <th className="text-right py-2">Max DD</th>
                      <th className="text-right py-2">Sharpe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedBacktests
                      .filter(b => selectedForComparison.includes(b.id))
                      .map(saved => {
                        if (!saved || !saved.result) return null;
                        const totalReturn = saved.result?.totalReturn || 0;
                        const totalReturnPercent = saved.result?.totalReturnPercent || saved.result?.totalReturn || 0;
                        const winRate = saved.result.winRate || 0;
                        const profitFactor = saved.result.profitFactor || 0;
                        const maxDrawdownPercent = saved.result.maxDrawdownPercent || 0;
                        const sharpeRatio = saved.result.sharpeRatio || 0;
                        return (
                          <tr key={saved.id} className="border-b border-crypto-border/50">
                            <td className="py-2">{saved.config?.strategy || '-'}</td>
                            <td className={`text-right ${totalReturn >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                              {totalReturn >= 0 ? '+' : ''}{totalReturnPercent.toFixed(1)}%
                            </td>
                            <td className="text-right">{winRate.toFixed(1)}%</td>
                            <td className="text-right">{profitFactor.toFixed(2)}</td>
                            <td className="text-right text-crypto-red">-{maxDrawdownPercent.toFixed(1)}%</td>
                            <td className="text-right">{sharpeRatio.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🔥 CONFIGURATION AVANCÉE */}
      <div className="crypto-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5 text-crypto-blue" />
            Configuration du Backtest
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setConfig({
                ...config,
                symbol: 'BTCUSDT',
                timeframe: '1h',
                strategy: 'sma_cross',
                initialCapital: 10000,
                riskPerTrade: 2,
                stopLossPercent: 2,
                takeProfitPercent: 4,
                useTrailingStop: false,
                slippagePercent: 0.05,
                feesType: 'spot',
                leverage: 1,
              })}
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Paramètres de base */}
          <div className="relative group">
            <label className="text-sm text-gray-400 flex items-center gap-1 mb-1">
              <BarChart3 className="w-3 h-3" />
              Crypto
            </label>
            <div className="relative">
              <select
                value={config.symbol}
                onChange={(e) => setConfig({...config, symbol: e.target.value})}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 appearance-none cursor-pointer hover:border-crypto-blue/50 transition-colors focus:border-crypto-blue focus:outline-none focus:ring-1 focus:ring-crypto-blue"
              >
                <option value="BTCUSDT">₿ BTC/USDT</option>
                <option value="ETHUSDT">Ξ ETH/USDT</option>
                <option value="ADAUSDT">₳ ADA/USDT</option>
                <option value="BNBUSDT">BNB/USDT</option>
                <option value="SOLUSDT">◎ SOL/USDT</option>
                <option value="XRPUSDT">✕ XRP/USDT</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
          
          <div className="relative group">
            <label className="text-sm text-gray-400 flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3" />
              Timeframe
            </label>
            <div className="relative">
              <select
                value={config.timeframe}
                onChange={(e) => setConfig({...config, timeframe: e.target.value as BacktestConfig['timeframe']})}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 appearance-none cursor-pointer hover:border-crypto-blue/50 transition-colors focus:border-crypto-blue focus:outline-none focus:ring-1 focus:ring-crypto-blue"
              >
                <option value="15m">⏱️ 15 minutes</option>
                <option value="1h">🕐 1 heure</option>
                <option value="4h">🕓 4 heures</option>
                <option value="1d">📅 1 jour</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
          
          <div className="relative group">
            <label className="text-sm text-gray-400 flex items-center gap-1 mb-1">
              <Brain className="w-3 h-3" />
              Stratégie
            </label>
            <div className="relative">
              <select
                value={config.strategy}
                onChange={(e) => setConfig({...config, strategy: e.target.value as BacktestConfig['strategy']})}
                className={`w-full border rounded-lg px-3 py-2 appearance-none cursor-pointer hover:border-crypto-blue/50 transition-colors focus:border-crypto-blue focus:outline-none focus:ring-1 focus:ring-crypto-blue ${
                  config.strategy === 'ai_ethernal' 
                    ? 'bg-crypto-purple/10 border-crypto-purple/50 text-crypto-purple' 
                    : 'bg-crypto-dark border-crypto-border'
                }`}
              >
                <option value="sma_cross">📈 SMA Crossover</option>
                <option value="rsi">📊 RSI Survente/Achat</option>
                <option value="macd">💹 MACD</option>
                <option value="bollinger">🎯 Bollinger Bands</option>
                <option value="ai_ethernal">🤖 IA Ethernal</option>
              </select>
              <ChevronDown className={`w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                config.strategy === 'ai_ethernal' ? 'text-crypto-purple' : 'text-gray-500'
              }`} />
            </div>
            {config.strategy === 'ai_ethernal' && (
              <div className="text-xs text-crypto-purple mt-1 animate-pulse">
                ✨ Intelligence Artificielle Ethernal
              </div>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-400">Capital Initial ($)</label>
            <input
              type="number"
              value={config.initialCapital}
              onChange={(e) => setConfig({...config, initialCapital: parseFloat(e.target.value)})}
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">Date Début</label>
            <input
              type="date"
              value={config.startDate}
              onChange={(e) => setConfig({...config, startDate: e.target.value})}
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">Date Fin</label>
            <input
              type="date"
              value={config.endDate}
              onChange={(e) => setConfig({...config, endDate: e.target.value})}
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
            />
          </div>

          {/* 🔥 Paramètres de risque */}
          <div>
            <label className="text-sm text-gray-400 flex items-center gap-1">
              <Target className="w-3 h-3" />
              Risque/Trade (%)
            </label>
            <input
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              value={config.riskPerTrade}
              onChange={(e) => setConfig({...config, riskPerTrade: parseFloat(e.target.value)})}
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Stop Loss (%)
            </label>
            <input
              type="number"
              min="0.5"
              max="10"
              step="0.1"
              value={config.stopLossPercent}
              onChange={(e) => setConfig({...config, stopLossPercent: parseFloat(e.target.value)})}
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Take Profit (%)
            </label>
            <input
              type="number"
              min="1"
              max="20"
              step="0.5"
              value={config.takeProfitPercent}
              onChange={(e) => setConfig({...config, takeProfitPercent: parseFloat(e.target.value)})}
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Slippage (%)
            </label>
            <input
              type="number"
              min="0"
              max="0.5"
              step="0.01"
              value={config.slippagePercent}
              onChange={(e) => setConfig({...config, slippagePercent: parseFloat(e.target.value)})}
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
            />
          </div>
          <div className="relative group">
            <label className="text-sm text-gray-400 flex items-center gap-1 mb-1">
              <DollarSign className="w-3 h-3" />
              Type de Frais
            </label>
            <div className="relative">
              <select
                value={config.feesType}
                onChange={(e) => setConfig({...config, feesType: e.target.value as BacktestConfig['feesType']})}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 appearance-none cursor-pointer hover:border-crypto-blue/50 transition-colors focus:border-crypto-blue focus:outline-none focus:ring-1 focus:ring-crypto-blue"
              >
                <option value="spot">💰 Spot (0.1%)</option>
                <option value="futures_maker">🏭 Futures Maker (0.02%)</option>
                <option value="futures_taker">⚡ Futures Taker (0.04%)</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400">Levier</label>
            <input
              type="number"
              min="1"
              max="125"
              step="1"
              value={config.leverage}
              onChange={(e) => setConfig({...config, leverage: parseFloat(e.target.value)})}
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
            />
          </div>
          
          {/* 🔥 Paramètre IA - visible seulement si stratégie IA */}
          {config.strategy === 'ai_ethernal' && (
            <div>
              <label className="text-sm text-gray-400 flex items-center gap-1">
                <Brain className="w-3 h-3" />
                Confiance IA Min (%)
              </label>
              <input
                type="number"
                min="50"
                max="90"
                step="5"
                value={config.aiConfidenceThreshold}
                onChange={(e) => setConfig({...config, aiConfidenceThreshold: parseFloat(e.target.value)})}
                className="w-full bg-crypto-dark border border-crypto-purple rounded-lg px-3 py-2 mt-1"
              />
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={runBacktest}
            disabled={running || candleData.length < 50}
            className="px-6 py-2 bg-crypto-blue rounded-lg text-white hover:bg-crypto-blue/80 disabled:opacity-50 flex items-center gap-2"
          >
            {running ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Simulation en cours...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Lancer le Backtest
              </>
            )}
          </button>
          
          {candleData.length < 50 && (
            <span className="text-sm text-crypto-orange">
              Chargez des données historiques depuis le Dashboard
            </span>
          )}
        </div>

        {/* 🔥 INTÉGRATION TRADING BOT - visible si résultat positif */}
        {result && result.totalReturn > 0 && result.profitFactor > 1.2 && result.sharpeRatio > 0.5 && (
          <div className="mt-4 p-4 bg-crypto-green/10 border border-crypto-green/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-crypto-green flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-crypto-green">✅ Stratégie Validée pour Trading Réel</h4>
                  <p className="text-sm text-gray-400">
                    Cette stratégie montre des résultats positifs. Envoyer vers le Trading Bot ?
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const botConfig = {
                    strategy: result.config.strategy,
                    symbol: result.config.symbol,
                    timeframe: result.config.timeframe,
                    stopLossPercent: result.config.stopLossPercent,
                    takeProfitPercent: result.config.takeProfitPercent,
                    riskPerTrade: result.config.riskPerTrade,
                    useTrailingStop: result.config.useTrailingStop,
                    leverage: result.config.leverage,
                    backtestId: `bt_${Date.now()}`,
                    validatedAt: new Date().toISOString(),
                    backtestMetrics: {
                      totalReturn: result.totalReturnPercent,
                      winRate: result.winRate,
                      profitFactor: result.profitFactor,
                      sharpeRatio: result.sharpeRatio,
                    },
                    autoStart: true // 🔥 Flag pour démarrage automatique
                  };
                  localStorage.setItem('neurovest_validated_strategy', JSON.stringify(botConfig));
                  
                  // 🔥 NAVIGATION DIRECTE VERS TRADING BOT
                  window.dispatchEvent(new CustomEvent('navigateToSection', { detail: 'tradingBot' }));
                  
                  // 🎉 Notification Toast au lieu d'alert
                  notifications.strategyValidated(result.config.strategy, result.config.symbol);
                }}
                className="px-4 py-2 bg-crypto-green text-white rounded-lg hover:bg-crypto-green/80 flex items-center gap-2 animate-pulse"
              >
                <Rocket className="w-4 h-4" />
                Lancer dans Trading Bot →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 🔥 RÉSULTATS AVANCÉS */}
      {result && (
        <>
          {/* Badge IA si stratégie IA */}
          {result.config.strategy === 'ai_ethernal' && (
            <div className="flex items-center gap-2 p-3 bg-crypto-purple/10 border border-crypto-purple/30 rounded-lg">
              <Brain className="w-5 h-5 text-crypto-purple" />
              <span className="font-medium text-crypto-purple">🤖 Stratégie IA Ethernal</span>
              <span className="text-sm text-gray-400">- Seuil de confiance: {result.config.aiConfidenceThreshold}%</span>
            </div>
          )}

          {/* 🎯 Métriques Principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="crypto-card">
              <div className="text-sm text-gray-400">Rendement Total</div>
              <div className={`text-2xl font-bold font-mono ${
                result.totalReturn >= 0 ? 'text-crypto-green' : 'text-crypto-red'
              }`}>
                {result.totalReturn >= 0 ? '+' : ''}{(result.totalReturnPercent || result.totalReturn || 0).toFixed(2)}%
              </div>
              <div className={`text-sm font-mono ${result.totalReturn >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                ${(result.totalReturn || 0).toFixed(2)}
              </div>
            </div>
            <div className="crypto-card">
              <div className="text-sm text-gray-400">Win Rate</div>
              <div className="text-2xl font-bold">{(result.winRate || 0).toFixed(1)}%</div>
              <div className="text-sm text-gray-400">
                {result.winningTrades}G / {result.losingTrades}P
              </div>
            </div>
            <div className="crypto-card">
              <div className="text-sm text-gray-400">Profit Factor</div>
              <div className={`text-2xl font-bold ${(result.profitFactor || 0) >= 1.5 ? 'text-crypto-green' : 'text-crypto-orange'}`}>
                {(result.profitFactor || 0).toFixed(2)}
              </div>
            </div>
            <div className="crypto-card">
              <div className="text-sm text-gray-400">Max Drawdown</div>
              <div className="text-2xl font-bold text-crypto-red">
                -{(result.maxDrawdownPercent || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">${(result.maxDrawdown || 0).toFixed(0)}</div>
            </div>
            <div className="crypto-card">
              <div className="text-sm text-gray-400">Sharpe Ratio</div>
              <div className={`text-2xl font-bold ${(result.sharpeRatio || 0) > 1 ? 'text-crypto-green' : 'text-crypto-orange'}`}>
                {(result.sharpeRatio || 0).toFixed(2)}
              </div>
            </div>
            <div className="crypto-card">
              <div className="text-sm text-gray-400">R/R Moyen</div>
              <div className="text-2xl font-bold text-crypto-blue">
                {(result.riskRewardRatio || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* 📊 Métriques Secondaires */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-crypto-dark/50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Total Trades</div>
              <div className="text-lg font-bold">{result.totalTrades}</div>
            </div>
            <div className="bg-crypto-dark/50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Avg Win</div>
              <div className="text-lg font-bold text-crypto-green">${(result.avgWin || 0).toFixed(0)}</div>
            </div>
            <div className="bg-crypto-dark/50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Avg Loss</div>
              <div className="text-lg font-bold text-crypto-red">${(result.avgLoss || 0).toFixed(0)}</div>
            </div>
            <div className="bg-crypto-dark/50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Best Trade</div>
              <div className="text-lg font-bold text-crypto-green">${(result.bestTrade || 0).toFixed(0)}</div>
            </div>
            <div className="bg-crypto-dark/50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Worst Trade</div>
              <div className="text-lg font-bold text-crypto-red">${(result.worstTrade || 0).toFixed(0)}</div>
            </div>
            <div className="bg-crypto-dark/50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Expectancy</div>
              <div className={`text-lg font-bold ${(result.expectancy || 0) >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                ${(result.expectancy || 0).toFixed(0)}
              </div>
            </div>
            <div className="bg-crypto-dark/50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Frais Totaux</div>
              <div className="text-lg font-bold text-crypto-orange">${(result.totalFees || 0).toFixed(2)}</div>
            </div>
            <div className="bg-crypto-dark/50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Slippage</div>
              <div className="text-lg font-bold text-crypto-orange">${(result.totalSlippage || 0).toFixed(2)}</div>
            </div>
          </div>

          {/* 📈 GRAPHIQUES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Equity Curve */}
            <div className="crypto-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-crypto-blue" />
                Equity Curve
              </h3>
              <div className="h-64" style={{ minHeight: '200px' }}>
                {result.equityCurve && result.equityCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                  <AreaChart data={result.equityCurve}>
                    <defs>
                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00c853" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00c853" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(str) => new Date(str).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                      stroke="#6b7280"
                      fontSize={10}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      fontSize={10}
                      tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      formatter={(val) => [`$${Number(val).toFixed(2)}`, 'Capital']}
                      labelFormatter={(label) => new Date(label).toLocaleString('fr-FR')}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="equity" 
                      stroke="#00c853" 
                      fillOpacity={1} 
                      fill="url(#colorEquity)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <TrendingUp className="w-8 h-8 mr-2 opacity-50" />
                    <span>Aucune donnée disponible</span>
                  </div>
                )}
              </div>
            </div>

            {/* Drawdown Chart */}
            <div className="crypto-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-crypto-red" />
                Drawdown
              </h3>
              <div className="h-64" style={{ minHeight: '200px' }}>
                {result.drawdownCurve && result.drawdownCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                  <AreaChart data={result.drawdownCurve}>
                    <defs>
                      <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff1744" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#ff1744" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(str) => new Date(str).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                      stroke="#6b7280"
                      fontSize={10}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      fontSize={10}
                      tickFormatter={(val) => `${(val || 0).toFixed(1)}%`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      formatter={(val) => [`${Number(val).toFixed(2)}%`, 'Drawdown']}
                      labelFormatter={(label) => new Date(label).toLocaleString('fr-FR')}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="drawdownPercent" 
                      stroke="#ff1744" 
                      fillOpacity={1} 
                      fill="url(#colorDrawdown)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <TrendingDown className="w-8 h-8 mr-2 opacity-50" />
                    <span>Aucune donnée disponible</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 📋 Tableau des Trades Détaillé */}
          <div className="crypto-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-crypto-blue" />
                Historique des Trades ({result.trades.length})
              </h2>
              <div className="flex gap-2">
                <span className="text-xs bg-crypto-green/20 text-crypto-green px-2 py-1 rounded">
                  SL: {result.trades.filter(t => t.exitReason === 'sl').length}
                </span>
                <span className="text-xs bg-crypto-blue/20 text-crypto-blue px-2 py-1 rounded">
                  TP: {result.trades.filter(t => t.exitReason === 'tp').length}
                </span>
                <span className="text-xs bg-crypto-orange/20 text-crypto-orange px-2 py-1 rounded">
                  Signal: {result.trades.filter(t => t.exitReason === 'signal').length}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="sticky top-0 bg-crypto-card">
                  <tr className="border-b border-crypto-border">
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">#</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">Signal</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">Entrée</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">Sortie</th>
                    <th className="text-center py-2 px-3 text-sm font-medium text-gray-400">Exit</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-400">Taille</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-400">P&L Brut</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-400">Frais</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-400">P&L Net</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((trade, i) => (
                    <tr
                      key={trade.id}
                      onClick={() => setSelectedTrade(trade)}
                      className={`border-b border-crypto-border/50 hover:bg-crypto-dark/50 cursor-pointer transition-colors ${
                        trade.netPnl >= 0 ? 'hover:bg-crypto-green/5' : 'hover:bg-crypto-red/5'
                      }`}
                    >
                      <td className="py-2 px-3 text-sm">{i + 1}</td>
                      <td className="py-2 px-3 text-xs text-gray-400">{trade.strategySignal}</td>
                      <td className="py-2 px-3 text-sm">
                        {new Date(trade.entryTime * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        <div className="text-xs text-gray-500">${(trade.entryPrice || 0).toFixed(2)}</div>
                      </td>
                      <td className="py-2 px-3 text-sm">
                        {new Date(trade.exitTime * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        <div className="text-xs text-gray-500">${(trade.exitPrice || 0).toFixed(2)}</div>
                      </td>
                      <td className="text-center py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          trade.exitReason === 'tp' ? 'bg-crypto-green/20 text-crypto-green' :
                          trade.exitReason === 'sl' ? 'bg-crypto-red/20 text-crypto-red' :
                          'bg-crypto-orange/20 text-crypto-orange'
                        }`}>
                          {trade.exitReason.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-right py-2 px-3 font-mono text-sm">
                        {(trade.size || 0).toFixed(4)}
                      </td>
                      <td className={`text-right py-2 px-3 font-mono text-sm ${(trade.pnl || 0) >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                        {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toFixed(2)}
                      </td>
                      <td className="text-right py-2 px-3 font-mono text-sm text-crypto-orange">
                        ${(trade.fees || 0).toFixed(2)}
                      </td>
                      <td className={`text-right py-2 px-3 font-mono font-medium ${(trade.netPnl || 0) >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                        {(trade.netPnl || 0) >= 0 ? '+' : ''}${(trade.netPnl || 0).toFixed(2)}
                        <span className="text-xs ml-1 text-gray-500">
                          ({(((trade.netPnl || 0) / (result.config?.initialCapital || 1)) * 100).toFixed(2)}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!result && !running && (
        <div className="crypto-card text-center py-12">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium mb-2">Aucun test effectué</h3>
          <p className="text-gray-400 mb-4">
            Configure les paramètres et lance le backtesting pour tester ta stratégie
          </p>
          <button
            onClick={runBacktest}
            disabled={candleData.length < 50}
            className="btn-primary disabled:opacity-50"
          >
            <Play className="w-4 h-4 inline mr-2" />
            Lancer
          </button>
        </div>
      )}
    </div>
  );
}
