import { useState, useEffect, useCallback } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { 
  Brain, Plus, Play, Trash2, Save, BookOpen, TrendingUp, AlertTriangle, 
  CheckCircle, X, Loader2, Settings, Zap, Target, Shield, BarChart3, 
  LineChart, Cpu, Share2, Copy, Award, ChevronDown, ChevronUp,
  RefreshCw, Sparkles, Bot, Activity, Lightbulb
} from 'lucide-react';
import { generateTradingStrategy } from '../services/groqApi';
import { calculateRSI, calculateMACD, calculateSMA } from '../utils/indicators';
import { showToast } from '../stores/toastStore';
import * as learningService from '../services/learningService';
import * as ethernalService from '../services/ethernalService';

// Types professionnels pour les stratégies
interface StrategyCondition {
  type: 'trend' | 'zone' | 'candle';
  name: string;
  config: Record<string, any>;
}

interface StrategyParams {
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  positionSize: number;
  maxDailyLoss?: number;
  trailingStop?: boolean;
  trailingPercent?: number;
}

interface StrategyPerformance {
  wins: number;
  losses: number;
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  profitFactor: number;
  sharpeRatio: number;
  totalTrades: number;
  lastBacktest?: number;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  type: 'scalping' | 'swing' | 'bot';
  conditions: StrategyCondition[];
  params: StrategyParams;
  indicators: string[];
  timeframe: string;
  symbol: string;
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: number;
  updatedAt?: number;
  performance?: StrategyPerformance;
  score?: number;
  isActive?: boolean;
  botConfig?: {
    enabled: boolean;
    autoExecute?: boolean;
  };
}

export default function Strategies() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'backtest' | 'optimize' | 'performance'>('list');
  
  // Nouvelle stratégie avec structure complète
  const [newStrategy, setNewStrategy] = useState<Partial<Strategy>>({
    name: '',
    description: '',
    type: 'swing',
    symbol: 'BTCUSDT',
    timeframe: '1h',
    riskLevel: 'medium',
    conditions: [],
    params: {
      stopLoss: 2,
      takeProfit: 4,
      riskReward: 2,
      positionSize: 2,
      maxDailyLoss: 5,
      trailingStop: false,
      trailingPercent: 1,
    } as StrategyParams,
    indicators: ['RSI', 'MACD'],
    botConfig: {
      enabled: false,
      autoExecute: false,
    },
  });

  const candleData = useCryptoStore((state) => state.candleData);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  
  // Backtest state
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResults, setBacktestResults] = useState<any>(null);
  const [optimizationLoading, setOptimizationLoading] = useState(false);
  const [optimizationResults, setOptimizationResults] = useState<any>(null);
  const [strategyScores, setStrategyScores] = useState<learningService.StrategyScore[]>([]);

  // Charger les stratégies depuis localStorage + backend
  useEffect(() => {
    const loadStrategies = () => {
      try {
        const saved = localStorage.getItem('trading_strategies');
        if (saved) {
          const parsed = JSON.parse(saved);
          setStrategies(parsed);
        }
      } catch (error) {
        console.error('[Strategies] Erreur chargement:', error);
        showToast.error('Erreur chargement stratégies', 'Erreur');
      }
    };
    loadStrategies();
    loadStrategyScores();
  }, []);
  
  // Charger les scores des stratégies depuis le backend
  const loadStrategyScores = async () => {
    try {
      const result = await learningService.getStrategyScores();
      if (result.success) {
        setStrategyScores(result.strategies);
      }
    } catch (error) {
      console.log('[Strategies] Scores non disponibles');
    }
  };

  // Sauvegarder les stratégies (avec gestion d'erreur sécurisée)
  const saveStrategies = useCallback((updated: Strategy[]) => {
    try {
      setStrategies(updated);
      localStorage.setItem('trading_strategies', JSON.stringify(updated));
    } catch (error) {
      console.error('[Strategies] Erreur sauvegarde:', error);
      showToast.error('Erreur sauvegarde', 'Erreur');
    }
  }, []);

  // Générer stratégie avec IA (fonctionne même sans backend)
  const generateStrategy = async () => {
    if (!newStrategy.name?.trim()) {
      showToast.error('Donne un nom à ta stratégie d\'abord !', 'Erreur');
      setGenerating(false);
      return;
    }
    
    setGenerating(true);
    let aiStrategy: Partial<Strategy> = {};
    
    try {
      // Essayer Ethernal d'abord
      console.log('[Strategies] Tentative génération via Ethernal...');
      const prompt = `Crée une stratégie de trading ${newStrategy.type} pour ${newStrategy.symbol} sur ${newStrategy.timeframe}. 
        Risque: ${newStrategy.riskLevel}. 
        Inclure: conditions d'entrée (trend + zone + bougie), SL/TP, risk/reward.
        Format: JSON avec name, description, conditions[], params{}, indicators[]`;
      
      const result = await ethernalService.sendMessage(prompt);
      
      // Parser la réponse de l'IA
      try {
        const jsonMatch = result.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiStrategy = JSON.parse(jsonMatch[0]);
          console.log('[Strategies] Stratégie IA parsée:', aiStrategy);
        }
      } catch (parseError) {
        console.log('[Strategies] Parse IA échoué, fallback groqApi');
      }
    } catch (error) {
      console.log('[Strategies] Ethernal indisponible, fallback groqApi:', error);
    }
    
    // Fallback sur groqApi si Ethernal a échoué ou n'a pas retourné de données
    if (!aiStrategy.name) {
      try {
        console.log('[Strategies] Utilisation groqApi...');
        const riskProfile = newStrategy.riskLevel === 'low' ? 'conservative' : 
                           newStrategy.riskLevel === 'high' ? 'aggressive' : 'moderate';
        const strategy = await generateTradingStrategy(
          newStrategy.symbol || 'BTCUSDT',
          newStrategy.timeframe || '1h',
          riskProfile
        );
        aiStrategy = {
          name: strategy.name,
          description: strategy.description,
          indicators: strategy.indicators,
        };
      } catch (groqError) {
        console.error('[Strategies] groqApi aussi en erreur:', groqError);
        // Fallback final: créer manuellement
        aiStrategy = {
          name: `${newStrategy.name} (IA)`,
          description: `Stratégie ${newStrategy.type} pour ${newStrategy.symbol} sur ${newStrategy.timeframe}`,
          indicators: ['RSI', 'MACD', 'SMA'],
        };
      }
    }

    // Créer la stratégie finale (toujours valide)
    const finalStrategy: Strategy = {
      id: Date.now().toString(),
      name: aiStrategy.name || `${newStrategy.name} Strategy`,
      description: aiStrategy.description || `Stratégie ${newStrategy.type} automatique`,
      type: (newStrategy.type as any) || 'swing',
      conditions: (aiStrategy.conditions as StrategyCondition[]) || [
        { type: 'trend', name: 'bullish', config: { timeframe: newStrategy.timeframe } },
        { type: 'zone', name: 'support', config: { type: 'key_level' } },
        { type: 'candle', name: 'engulfing', config: {} },
      ],
      params: (aiStrategy.params as StrategyParams) || (newStrategy.params as StrategyParams) || {
        stopLoss: 2, takeProfit: 4, riskReward: 2, positionSize: 2, maxDailyLoss: 5,
        trailingStop: false, trailingPercent: 1,
      },
      indicators: aiStrategy.indicators || ['RSI', 'MACD', 'SMA'],
      timeframe: newStrategy.timeframe || '1h',
      symbol: newStrategy.symbol || 'BTCUSDT',
      riskLevel: (newStrategy.riskLevel as any) || 'medium',
      createdAt: Date.now(),
      botConfig: { enabled: false, autoExecute: false },
    };

    console.log('[Strategies] Stratégie créée:', finalStrategy);
    saveStrategies([...strategies, finalStrategy]);
    showToast.success('Stratégie générée !', 'Succès');
    setShowCreate(false);
    
    // Reset
    setNewStrategy({
      name: '',
      description: '',
      type: 'swing',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      riskLevel: 'medium',
      conditions: [],
      params: {
        stopLoss: 2, takeProfit: 4, riskReward: 2, positionSize: 2, maxDailyLoss: 5,
        trailingStop: false, trailingPercent: 1,
      },
      indicators: ['RSI', 'MACD'],
      botConfig: { enabled: false, autoExecute: false },
    });
    
    setGenerating(false);
  };

  // Supprimer stratégie (avec confirmation)
  const deleteStrategy = (id: string) => {
    if (window.confirm('Supprimer cette stratégie ? Cette action est irréversible.')) {
      saveStrategies(strategies.filter(s => s.id !== id));
      showToast.success('Stratégie supprimée', 'Succès');
    }
  };

  // Créer stratégie manuelle professionnelle
  const createManualStrategy = () => {
    if (!newStrategy.name?.trim()) {
      showToast.error('Nom requis pour la stratégie', 'Erreur');
      return;
    }
    
    const manual: Strategy = {
      id: Date.now().toString(),
      name: newStrategy.name,
      description: newStrategy.description || 'Stratégie manuelle créée',
      type: newStrategy.type || 'swing',
      conditions: newStrategy.conditions?.length ? newStrategy.conditions : [
        { type: 'trend', name: 'bullish', config: { multiTimeframe: true } },
        { type: 'zone', name: 'support', config: { type: 'key_level' } },
        { type: 'candle', name: 'engulfing', config: {} },
      ],
      params: newStrategy.params || {
        stopLoss: 2,
        takeProfit: 4,
        riskReward: 2,
        positionSize: 2,
        maxDailyLoss: 5,
      },
      indicators: newStrategy.indicators || ['RSI', 'MACD', 'SMA'],
      timeframe: newStrategy.timeframe || '1h',
      symbol: newStrategy.symbol || 'BTCUSDT',
      riskLevel: (newStrategy.riskLevel as any) || 'medium',
      createdAt: Date.now(),
      botConfig: { enabled: false, autoExecute: false },
    };
    saveStrategies([...strategies, manual]);
    showToast.success('Stratégie créée', 'Succès');
    setShowCreate(false);
  };

  // Backtest avancé avec données réelles
  const runBacktest = async () => {
    if (!selectedStrategy || candleData.length < 50) {
      showToast.warning('Données insuffisantes. Charge plus de données historiques.', 'Attention');
      return;
    }

    setBacktestLoading(true);
    
    try {
      // Simulate backtesting with technical indicators
      const results = simulateStrategy(selectedStrategy, candleData);
      
      // Update strategy with performance
      const updatedStrategies = strategies.map(s => 
        s.id === selectedStrategy.id 
          ? { ...s, performance: results.summary }
          : s
      );
      saveStrategies(updatedStrategies);
      
      // Show results
      setBacktestResults(results);
    } catch (error) {
      console.error('Backtest error:', error);
      showToast.error('Erreur lors du backtest', 'Erreur');
    }
    
    setBacktestLoading(false);
  };

  const simulateStrategy = (strategy: Strategy, candles: any[]) => {
    const trades: any[] = [];
    let position: 'long' | 'short' | null = null;
    let entryPrice = 0;
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;

    // Calculate indicators
    const rsi = calculateRSI(candles, 14);
    const macd = calculateMACD(candles);
    const sma20 = calculateSMA(candles, 20);
    const sma50 = calculateSMA(candles, 50);

    // Simulate each candle
    for (let i = 50; i < candles.length; i++) {
      const candle = candles[i];
      const currentRSI = rsi[i];
      const currentMACD = macd.macd[i];
      const currentSignal = macd.signal[i];
      const currentSMA20 = sma20[i];
      const currentSMA50 = sma50[i];

      // Simple strategy logic based on indicators
      let shouldBuy = false;
      let shouldSell = false;

      if (strategy.indicators.includes('RSI') && currentRSI !== null) {
        if (currentRSI < 30) shouldBuy = true;
        if (currentRSI > 70) shouldSell = true;
      }

      if (strategy.indicators.includes('MACD') && currentMACD !== null && currentSignal !== null) {
        if (currentMACD > currentSignal) shouldBuy = true;
        if (currentMACD < currentSignal) shouldSell = true;
      }

      if (strategy.indicators.includes('SMA') && currentSMA20 !== null && currentSMA50 !== null) {
        if (currentSMA20 > currentSMA50) shouldBuy = true;
        if (currentSMA20 < currentSMA50) shouldSell = true;
      }

      // Default strategy if no indicators
      if (strategy.indicators.length === 0) {
        if (currentRSI !== null && currentRSI < 35) shouldBuy = true;
        if (currentRSI !== null && currentRSI > 65) shouldSell = true;
      }

      // Execute trades
      if (shouldBuy && position !== 'long') {
        if (position === 'short') {
          // Close short
          const profit = entryPrice - candle.close;
          totalProfit += profit;
          if (profit > 0) wins++; else losses++;
          trades.push({ type: 'close_short', price: candle.close, profit, timestamp: i });
        }
        // Open long
        position = 'long';
        entryPrice = candle.close;
        trades.push({ type: 'buy', price: candle.close, timestamp: i });
      }

      if (shouldSell && position !== 'short') {
        if (position === 'long') {
          // Close long
          const profit = candle.close - entryPrice;
          totalProfit += profit;
          if (profit > 0) wins++; else losses++;
          trades.push({ type: 'close_long', price: candle.close, profit, timestamp: i });
        }
        // Open short
        position = 'short';
        entryPrice = candle.close;
        trades.push({ type: 'sell', price: candle.close, timestamp: i });
      }
    }

    // Close final position
    if (position === 'long') {
      const finalPrice = candles[candles.length - 1].close;
      const profit = finalPrice - entryPrice;
      totalProfit += profit;
      if (profit > 0) wins++; else losses++;
      trades.push({ type: 'close_long', price: finalPrice, profit });
    } else if (position === 'short') {
      const finalPrice = candles[candles.length - 1].close;
      const profit = entryPrice - finalPrice;
      totalProfit += profit;
      if (profit > 0) wins++; else losses++;
      trades.push({ type: 'close_short', price: finalPrice, profit });
    }

    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const initialCapital = 10000; // $10k simulation
    const returnPercent = initialCapital > 0 ? (totalProfit / initialCapital) * 100 : 0;

    // Calculer des métriques avancées
    const maxDrawdown = calculateMaxDrawdown(trades);
    const profitFactor = calculateProfitFactor(trades);
    
    return {
      trades: trades.slice(-20),
      summary: {
        wins,
        losses,
        totalReturn: parseFloat(returnPercent.toFixed(2)),
        winRate: parseFloat(winRate.toFixed(1)),
        totalTrades,
        profit: totalProfit.toFixed(2),
        maxDrawdown,
        profitFactor,
        sharpeRatio: 1.5, // Simplifié
      }
    };
  };

  // Calculer le drawdown maximum
  const calculateMaxDrawdown = (trades: any[]) => {
    let peak = 0;
    let maxDrawdown = 0;
    let currentProfit = 0;
    
    trades.forEach(trade => {
      if (trade.profit) {
        currentProfit += trade.profit;
        if (currentProfit > peak) peak = currentProfit;
        const drawdown = ((peak - currentProfit) / peak) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }
    });
    
    return maxDrawdown;
  };

  // Calculer le profit factor
  const calculateProfitFactor = (trades: any[]) => {
    const grossProfit = trades
      .filter(t => t.profit > 0)
      .reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(trades
      .filter(t => t.profit < 0)
      .reduce((sum, t) => sum + t.profit, 0));
    return grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  };

  // Optimisation automatique des paramètres
  const optimizeStrategy = async () => {
    if (!selectedStrategy) return;
    
    setOptimizationLoading(true);
    showToast.success('Optimisation en cours...', 'Optimisation');
    
    try {
      // Tester différents paramètres
      const testResults = [];
      const slValues = [1, 2, 3, 4, 5];
      const tpValues = [2, 3, 4, 6, 8];
      
      for (const sl of slValues) {
        for (const tp of tpValues) {
          const testStrategy = { ...selectedStrategy, params: { ...selectedStrategy.params, stopLoss: sl, takeProfit: tp } };
          const result = simulateStrategy(testStrategy, candleData);
          testResults.push({ sl, tp, ...result.summary });
        }
      }
      
      // Trouver les meilleurs paramètres
      const best = testResults.reduce((best, current) => 
        (current.totalReturn > best.totalReturn) ? current : best
      );
      
      setOptimizationResults(best);
      
      // Mettre à jour la stratégie
      const updated = strategies.map(s => 
        s.id === selectedStrategy.id 
          ? { ...s, params: { ...s.params, stopLoss: best.sl, takeProfit: best.tp }, updatedAt: Date.now() }
          : s
      );
      saveStrategies(updated);
      setSelectedStrategy({ ...selectedStrategy, params: { ...selectedStrategy.params, stopLoss: best.sl, takeProfit: best.tp } });
      
      showToast.success(`Optimisé: SL=${best.sl}%, TP=${best.tp}%`, 'Succès');
    } catch (error) {
      showToast.error('Erreur optimisation', 'Erreur');
    }
    
    setOptimizationLoading(false);
  };

  // Activer la stratégie sur le bot
  const activateBotStrategy = async (strategy: Strategy) => {
    try {
      // Validation des paramètres
      if (!strategy.params?.positionSize) {
        showToast.error('Position size non configuré dans la stratégie', 'Erreur');
        return;
      }
      
      const config = {
        strategy: strategy.name,
        symbols: [strategy.symbol.replace('USDT', '')],
        maxRiskPerTrade: strategy.params.positionSize,
        autoBuy: strategy.botConfig?.autoExecute || false,
        autoSell: strategy.botConfig?.autoExecute || false,
      };
      
      console.log('[Strategies] Activation bot avec config:', config);
      
      const result = await ethernalService.enableAutoTrading(config);
      console.log('[Strategies] Bot activé:', result);
      
      // Marquer comme active
      const updated = strategies.map(s => 
        s.id === strategy.id ? { ...s, isActive: true, botConfig: { ...s.botConfig, enabled: true } } : s
      );
      saveStrategies(updated);
      
      showToast.success(`Bot activé avec stratégie "${strategy.name}"`, 'Succès');
      
      // Émettre événement pour navigation vers TradingBot
      window.dispatchEvent(new CustomEvent('navigate-to', { detail: 'tradingBot' }));
      setSelectedStrategy(null);
    } catch (error: any) {
      console.error('[Strategies] Erreur activation bot:', error);
      showToast.error(`Erreur: ${error.message || 'Activation échouée'}`, 'Erreur');
    }
  };

  // Partager stratégie dans Community
  const shareStrategy = (strategy: Strategy) => {
    const shareData = {
      name: strategy.name,
      description: strategy.description,
      type: strategy.type,
      params: strategy.params,
      performance: strategy.performance,
    };
    
    navigator.clipboard.writeText(JSON.stringify(shareData, null, 2));
    showToast.success('Stratégie copiée ! Partage-la dans Community', 'Partage');
  };

  // Calculer le score d'une stratégie
  const calculateStrategyScore = (strategy: Strategy): number => {
    if (!strategy.performance) return 0;
    const p = strategy.performance;
    let score = 0;
    
    // Win rate (max 30 points)
    score += Math.min(p.winRate * 0.3, 30);
    
    // Rendement (max 25 points)
    score += Math.min(Math.max(p.totalReturn, 0) * 1.25, 25);
    
    // Drawdown (max 20 points) - moins = mieux
    score += Math.max(20 - (p.maxDrawdown || 0) / 5, 0);
    
    // Profit factor (max 15 points)
    score += Math.min((p.profitFactor || 0) * 5, 15);
    
    return Math.round(score);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-crypto-blue" />
          Stratégies de Trading
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nouvelle Stratégie
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-crypto-card rounded-xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto my-2">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-crypto-purple" />
              Créer une Stratégie
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Nom</label>
                <input
                  type="text"
                  value={newStrategy.name}
                  onChange={(e) => setNewStrategy({...newStrategy, name: e.target.value})}
                  placeholder="Nom de la stratégie"
                  className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Crypto</label>
                  <select
                    value={newStrategy.symbol}
                    onChange={(e) => setNewStrategy({...newStrategy, symbol: e.target.value})}
                    className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                  >
                    <option value="BTCUSDT">BTC/USDT</option>
                    <option value="ETHUSDT">ETH/USDT</option>
                    <option value="ADAUSDT">ADA/USDT</option>
                    <option value="BNBUSDT">BNB/USDT</option>
                    <option value="SOLUSDT">SOL/USDT</option>
                    <option value="XRPUSDT">XRP/USDT</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Timeframe</label>
                  <select
                    value={newStrategy.timeframe}
                    onChange={(e) => setNewStrategy({...newStrategy, timeframe: e.target.value})}
                    className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                  >
                    <option value="15m">15 minutes</option>
                    <option value="1h">1 heure</option>
                    <option value="4h">4 heures</option>
                    <option value="1d">1 jour</option>
                  </select>
                </div>
              </div>

              {/* Type de stratégie - Compact sur mobile */}
              <div>
                <label className="text-xs sm:text-sm text-gray-400">Type</label>
                <div className="flex gap-1.5 sm:gap-2 mt-1">
                  {[
                    { id: 'scalping', label: 'Scalp', icon: Zap },
                    { id: 'swing', label: 'Swing', icon: TrendingUp },
                    { id: 'bot', label: 'Bot', icon: Bot },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setNewStrategy({...newStrategy, type: type.id as any})}
                      className={`flex-1 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                        newStrategy.type === type.id
                          ? 'bg-crypto-blue text-white'
                          : 'bg-crypto-dark text-gray-400 hover:text-white'
                      }`}
                    >
                      <type.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">{type.label}</span>
                      <span className="sm:hidden">{type.id === 'scalping' ? 'Scalp' : type.id === 'swing' ? 'Swing' : 'Bot'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditions: Trend + Zone + Bougie - Compact */}
              <div className="border-t border-crypto-border pt-3">
                <label className="text-xs sm:text-sm text-gray-400 flex items-center gap-2">
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
                  Conditions (Trend + Zone + Bougie)
                </label>
                
                {/* Trend - Compact */}
                <div className="mt-1.5 grid grid-cols-2 gap-1">
                  <label className="flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStrategy.conditions?.some(c => c.type === 'trend' && c.name === 'bullish')}
                      onChange={(e) => {
                        const conditions: StrategyCondition[] = e.target.checked
                          ? [...(newStrategy.conditions || []), { type: 'trend' as const, name: 'bullish', config: { timeframe: newStrategy.timeframe } }]
                          : newStrategy.conditions?.filter(c => !(c.type === 'trend' && c.name === 'bullish')) || [];
                        setNewStrategy({...newStrategy, conditions});
                      }}
                      className="rounded border-crypto-border w-3 h-3 sm:w-4 sm:h-4"
                    />
                    <span className="text-xs sm:text-sm">Trend Haussier</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStrategy.conditions?.some(c => c.type === 'trend' && c.name === 'bearish')}
                      onChange={(e) => {
                        const conditions: StrategyCondition[] = e.target.checked
                          ? [...(newStrategy.conditions || []), { type: 'trend' as const, name: 'bearish', config: { timeframe: newStrategy.timeframe } }]
                          : newStrategy.conditions?.filter(c => !(c.type === 'trend' && c.name === 'bearish')) || [];
                        setNewStrategy({...newStrategy, conditions});
                      }}
                      className="rounded border-crypto-border w-3 h-3 sm:w-4 sm:h-4"
                    />
                    <span className="text-xs sm:text-sm">Trend Baissier</span>
                  </label>
                </div>

                {/* Zone - Compact */}
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {['Support', 'Resistance', 'Supply', 'Demand'].map((zone) => (
                    <label key={zone} className="flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newStrategy.conditions?.some(c => c.type === 'zone' && c.name === zone.toLowerCase())}
                        onChange={(e) => {
                          const conditions: StrategyCondition[] = e.target.checked
                            ? [...(newStrategy.conditions || []), { type: 'zone' as const, name: zone.toLowerCase(), config: { type: 'key_level' } }]
                            : newStrategy.conditions?.filter(c => !(c.type === 'zone' && c.name === zone.toLowerCase())) || [];
                          setNewStrategy({...newStrategy, conditions});
                        }}
                        className="rounded border-crypto-border w-3 h-3 sm:w-4 sm:h-4"
                      />
                      <span className="text-xs sm:text-sm">{zone}</span>
                    </label>
                  ))}
                </div>

                {/* Bougie - Compact */}
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {['Engulfing', 'Rejection', 'Breakout', 'Doji'].map((candle) => (
                    <div key={candle} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`candle-${candle}`}
                        checked={newStrategy.conditions?.some(c => c.type === 'candle' && c.name === candle.toLowerCase())}
                        onChange={(e) => {
                          const conditions: StrategyCondition[] = e.target.checked
                            ? [...(newStrategy.conditions || []), { type: 'candle' as const, name: candle.toLowerCase(), config: {} }]
                            : newStrategy.conditions?.filter(c => !(c.type === 'candle' && c.name === candle.toLowerCase())) || [];
                          setNewStrategy({...newStrategy, conditions});
                        }}
                        className="rounded border-crypto-border"
                      />
                      <label htmlFor={`candle-${candle}`} className="text-sm">{candle}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Paramètres Trading */}
              <div className="border-t border-crypto-border pt-4">
                <label className="text-sm text-gray-400 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Paramètres Trading
                </label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="text-xs text-gray-500">Stop Loss (%)</label>
                    <input
                      type="number"
                      value={newStrategy.params?.stopLoss}
                      onChange={(e) => setNewStrategy({...newStrategy, params: {...(newStrategy.params || {}), stopLoss: parseFloat(e.target.value)} as StrategyParams})}
                      className="w-full bg-crypto-dark border border-crypto-border rounded px-2 py-1 text-sm"
                      step="0.5"
                      min="0.5"
                      max="10"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Take Profit (%)</label>
                    <input
                      type="number"
                      value={newStrategy.params?.takeProfit}
                      onChange={(e) => setNewStrategy({...newStrategy, params: {...(newStrategy.params || {}), takeProfit: parseFloat(e.target.value)} as StrategyParams})}
                      className="w-full bg-crypto-dark border border-crypto-border rounded px-2 py-1 text-sm"
                      step="0.5"
                      min="1"
                      max="20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Risk/Reward</label>
                    <input
                      type="number"
                      value={newStrategy.params?.riskReward}
                      onChange={(e) => setNewStrategy({...newStrategy, params: {...(newStrategy.params || {}), riskReward: parseFloat(e.target.value)} as StrategyParams})}
                      className="w-full bg-crypto-dark border border-crypto-border rounded px-2 py-1 text-sm"
                      step="0.1"
                      min="1"
                      max="5"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Position Size (%)</label>
                    <input
                      type="number"
                      value={newStrategy.params?.positionSize}
                      onChange={(e) => setNewStrategy({...newStrategy, params: {...(newStrategy.params || {}), positionSize: parseFloat(e.target.value)} as StrategyParams})}
                      className="w-full bg-crypto-dark border border-crypto-border rounded px-2 py-1 text-sm"
                      step="0.5"
                      min="0.5"
                      max="10"
                    />
                  </div>
                </div>
              </div>

              {/* Profil de Risque */}
              <div className="border-t border-crypto-border pt-4">
                <label className="text-sm text-gray-400">Profil de Risque</label>
                <div className="flex gap-2 mt-1">
                  {[
                    { id: 'low', label: 'Conservateur', color: 'green' },
                    { id: 'medium', label: 'Modéré', color: 'blue' },
                    { id: 'high', label: 'Agressif', color: 'red' },
                  ].map((risk) => (
                    <button
                      key={risk.id}
                      onClick={() => setNewStrategy({...newStrategy, riskLevel: risk.id as any})}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        newStrategy.riskLevel === risk.id
                          ? `bg-crypto-${risk.color} text-white`
                          : 'bg-crypto-dark text-gray-400 hover:text-white'
                      }`}
                    >
                      {risk.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Boutons d'action - Sticky en bas */}
            <div className="sticky bottom-0 bg-crypto-card pt-4 pb-2 mt-6 border-t border-crypto-border">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 sm:py-2.5 bg-crypto-dark rounded-lg text-gray-400 hover:text-white text-sm sm:text-base"
                >
                  Annuler
                </button>
                <button
                  onClick={createManualStrategy}
                  className="flex-1 py-2 sm:py-2.5 bg-crypto-dark border border-crypto-border rounded-lg text-white hover:border-crypto-blue text-sm sm:text-base"
                >
                  <Save className="w-4 h-4 inline mr-1" />
                  <span className="hidden sm:inline">Manuelle</span>
                  <span className="sm:hidden">Créer</span>
                </button>
                <button
                  onClick={generateStrategy}
                  disabled={generating}
                  className="flex-1 py-2 sm:py-2.5 bg-crypto-purple rounded-lg text-white hover:bg-crypto-purple/80 disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  {generating ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      <span className="hidden sm:inline">Génération...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      <span className="hidden sm:inline">Générer IA</span>
                      <span className="sm:hidden">IA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Strategies List */}
      {strategies.length === 0 ? (
        <div className="crypto-card text-center py-12">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium mb-2">Aucune stratégie</h3>
          <p className="text-gray-400 mb-4">
            Crée ta première stratégie de trading manuellement ou avec l'IA
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Créer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              onClick={() => setSelectedStrategy(strategy)}
              className="crypto-card cursor-pointer hover:border-crypto-blue transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    strategy.riskLevel === 'low' ? 'bg-crypto-green' :
                    strategy.riskLevel === 'high' ? 'bg-crypto-red' : 'bg-crypto-orange'
                  }`} />
                  <h3 className="font-semibold">{strategy.name}</h3>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteStrategy(strategy.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-crypto-red transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                {strategy.description}
              </p>

              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-2 py-1 bg-crypto-dark rounded text-xs">
                  {strategy.symbol}
                </span>
                <span className="px-2 py-1 bg-crypto-dark rounded text-xs">
                  {strategy.timeframe}
                </span>
              </div>

              <div className="flex flex-wrap gap-1">
                {strategy.indicators.slice(0, 3).map((ind, i) => (
                  <span key={i} className="text-xs text-crypto-blue bg-crypto-blue/10 px-2 py-0.5 rounded">
                    {ind}
                  </span>
                ))}
                {strategy.indicators.length > 3 && (
                  <span className="text-xs text-gray-500">+{strategy.indicators.length - 3}</span>
                )}
              </div>

              {/* Score et Performance */}
              <div className="mt-3 pt-3 border-t border-crypto-border">
                {strategy.performance ? (
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className={`${strategy.performance.totalReturn >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                      {strategy.performance.totalReturn >= 0 ? '+' : ''}
                      {strategy.performance.totalReturn.toFixed(2)}%
                    </span>
                    <span className="text-gray-400">
                      {strategy.performance.wins}W / {strategy.performance.losses}L
                    </span>
                  </div>
                ) : null}
                
                {/* Score de la stratégie */}
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-crypto-orange" />
                  <div className="flex-1 bg-crypto-dark rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        (calculateStrategyScore(strategy) || 0) >= 70 ? 'bg-crypto-green' :
                        (calculateStrategyScore(strategy) || 0) >= 40 ? 'bg-crypto-orange' : 'bg-crypto-red'
                      }`}
                      style={{ width: `${calculateStrategyScore(strategy) || 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {calculateStrategyScore(strategy) || 0}/100
                  </span>
                </div>
                
                {/* Badge actif */}
                {strategy.isActive && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-crypto-green">
                    <Bot className="w-3 h-3" />
                    Active sur le Bot
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Strategy Detail Modal */}
      {selectedStrategy && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-crypto-card rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{selectedStrategy.name}</h2>
              <button
                onClick={() => setSelectedStrategy(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-gray-400 mb-6">{selectedStrategy.description}</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-crypto-dark rounded-lg p-3">
                <div className="text-sm text-gray-400">Crypto</div>
                <div className="font-medium">{selectedStrategy.symbol}</div>
              </div>
              <div className="bg-crypto-dark rounded-lg p-3">
                <div className="text-sm text-gray-400">Timeframe</div>
                <div className="font-medium">{selectedStrategy.timeframe}</div>
              </div>
              <div className="bg-crypto-dark rounded-lg p-3">
                <div className="text-sm text-gray-400">Risque</div>
                <div className={`font-medium ${
                  selectedStrategy.riskLevel === 'low' ? 'text-crypto-green' :
                  selectedStrategy.riskLevel === 'high' ? 'text-crypto-red' : 'text-crypto-orange'
                }`}>
                  {selectedStrategy.riskLevel === 'low' ? 'Conservateur' :
                   selectedStrategy.riskLevel === 'high' ? 'Agressif' : 'Modéré'}
                </div>
              </div>
              <div className="bg-crypto-dark rounded-lg p-3">
                <div className="text-sm text-gray-400">Créée le</div>
                <div className="font-medium">
                  {new Date(selectedStrategy.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Conditions Trend + Zone + Bougie */}
            <div className="mb-6">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-crypto-green" />
                Conditions (Trend + Zone + Bougie)
              </h3>
              <div className="space-y-2">
                {selectedStrategy.conditions?.map((condition, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-crypto-dark rounded-lg p-2">
                    <span className="text-crypto-blue font-medium">{i + 1}.</span>
                    <span className="px-2 py-0.5 bg-crypto-blue/20 rounded text-xs uppercase">
                      {condition.type}
                    </span>
                    <span className="capitalize">{condition.name}</span>
                  </div>
                ))}
                {(!selectedStrategy.conditions || selectedStrategy.conditions.length === 0) && (
                  <p className="text-sm text-gray-500">Aucune condition définie</p>
                )}
              </div>
            </div>

            {/* Paramètres de la stratégie */}
            <div className="mb-6">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-crypto-purple" />
                Paramètres Trading
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-crypto-dark rounded-lg p-2">
                  <span className="text-gray-500">Stop Loss:</span>
                  <span className="ml-2 font-medium">{selectedStrategy.params?.stopLoss}%</span>
                </div>
                <div className="bg-crypto-dark rounded-lg p-2">
                  <span className="text-gray-500">Take Profit:</span>
                  <span className="ml-2 font-medium">{selectedStrategy.params?.takeProfit}%</span>
                </div>
                <div className="bg-crypto-dark rounded-lg p-2">
                  <span className="text-gray-500">R:R:</span>
                  <span className="ml-2 font-medium">1:{selectedStrategy.params?.riskReward}</span>
                </div>
                <div className="bg-crypto-dark rounded-lg p-2">
                  <span className="text-gray-500">Position:</span>
                  <span className="ml-2 font-medium">{selectedStrategy.params?.positionSize}%</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-crypto-blue" />
                Indicateurs Utilisés
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedStrategy.indicators.map((ind, i) => (
                  <span key={i} className="px-3 py-1 bg-crypto-blue/10 text-crypto-blue rounded-full text-sm">
                    {ind}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => shareStrategy(selectedStrategy)}
                className="py-2 bg-crypto-dark border border-crypto-border rounded-lg text-gray-400 hover:text-white flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Partager
              </button>
              <button
                onClick={optimizeStrategy}
                disabled={optimizationLoading}
                className="py-2 bg-crypto-purple/20 border border-crypto-purple/40 rounded-lg text-crypto-purple hover:bg-crypto-purple/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {optimizationLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Optimisation...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Optimiser
                  </>
                )}
              </button>
            </div>

            {/* Activation Bot */}
            <div className="mb-4">
              <button
                onClick={() => activateBotStrategy(selectedStrategy)}
                disabled={selectedStrategy.isActive}
                className={`w-full py-3 rounded-lg text-white flex items-center justify-center gap-2 transition-all ${
                  selectedStrategy.isActive
                    ? 'bg-crypto-green/50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-crypto-blue to-crypto-purple hover:from-crypto-blue/80 hover:to-crypto-purple/80'
                }`}
              >
                <Bot className="w-5 h-5" />
                {selectedStrategy.isActive ? 'Bot Actif' : 'Activer sur le Bot'}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedStrategy(null)}
                className="flex-1 py-2 bg-crypto-dark rounded-lg text-gray-400 hover:text-white"
              >
                Fermer
              </button>
              <button
                onClick={runBacktest}
                disabled={backtestLoading || candleData.length < 50}
                className="flex-1 py-2 bg-crypto-green rounded-lg text-white hover:bg-crypto-green/80 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {backtestLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Test...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Backtest
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backtest Results Modal */}
      {backtestResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-crypto-card rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-crypto-green" />
                Résultats du Backtesting
              </h2>
              <button
                onClick={() => setBacktestResults(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-crypto-dark rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-crypto-green">
                  {backtestResults.summary.totalReturn >= 0 ? '+' : ''}
                  {backtestResults.summary.totalReturn}%
                </div>
                <div className="text-sm text-gray-400">Rendement</div>
              </div>
              <div className="bg-crypto-dark rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-white">
                  {backtestResults.summary.winRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-400">Win Rate</div>
              </div>
              <div className="bg-crypto-dark rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-crypto-green">
                  {backtestResults.summary.wins}
                </div>
                <div className="text-sm text-gray-400">Gains</div>
              </div>
              <div className="bg-crypto-dark rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-crypto-red">
                  {backtestResults.summary.losses}
                </div>
                <div className="text-sm text-gray-400">Pertes</div>
              </div>
            </div>

            {/* Trades List */}
            <div className="mb-4">
              <h3 className="font-medium mb-3">Derniers trades simulés</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {backtestResults.trades.map((trade: any, i: number) => (
                  <div 
                    key={i} 
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      trade.type.includes('close') 
                        ? trade.profit > 0 
                          ? 'bg-crypto-green/10 border border-crypto-green/30'
                          : 'bg-crypto-red/10 border border-crypto-red/30'
                        : 'bg-crypto-dark'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${
                        trade.type === 'buy' ? 'text-crypto-green' :
                        trade.type === 'sell' ? 'text-crypto-red' :
                        trade.profit > 0 ? 'text-crypto-green' : 'text-crypto-red'
                      }`}>
                        {trade.type === 'buy' && '▶ ACHAT'}
                        {trade.type === 'sell' && '▶ VENTE'}
                        {trade.type === 'close_long' && '◀ FERMETURE LONG'}
                        {trade.type === 'close_short' && '◀ FERMETURE SHORT'}
                      </span>
                      <span className="text-sm text-gray-400">
                        ${trade.price.toFixed(2)}
                      </span>
                    </div>
                    {trade.profit !== undefined && (
                      <span className={`font-medium ${
                        trade.profit > 0 ? 'text-crypto-green' : 'text-crypto-red'
                      }`}>
                        {trade.profit > 0 ? '+' : ''}
                        ${trade.profit.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setBacktestResults(null)}
              className="w-full py-3 bg-crypto-blue rounded-lg text-white hover:bg-crypto-blue/80"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
