import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Bot, 
  Play, 
  Pause, 
  Settings, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertCircle, 
  DollarSign,
  Target,
  Shield,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  Sparkles,
  Lock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  Percent,
  Wallet
} from 'lucide-react';
import { 
  getBotStatus, 
  enableAutoTrading, 
  disableAutoTrading, 
  updateAutoTradingConfig,
  getPerformanceStats,
  getTradeHistory,
  getOpenPositions,
  togglePaperTrading,
  runBacktest,
  executeManualTrade,
  type AutoTradingConfig,
  type BotStatus as BotStatusType,
  type PerformanceStats,
  type Trade
} from '../services/autoTradingApi';
import { showToast } from '../stores/toastStore';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STRATEGY_OPTIONS = [
  { id: 'conservative', name: 'Conservateur', description: 'Risque faible, gains stables', color: 'text-blue-400' },
  { id: 'moderate', name: 'Modéré', description: 'Équilibre risque/rendement', color: 'text-yellow-400' },
  { id: 'aggressive', name: 'Agressif', description: 'Haut risque, haut rendement potentiel', color: 'text-red-400' }
];

const SYMBOL_OPTIONS = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC', 'XRP', 'DOGE'];

export default function TradingBot() {
  // State
  const [botStatus, setBotStatus] = useState<BotStatusType | null>(null);
  const [config, setConfig] = useState<AutoTradingConfig | null>(null);
  const [performance, setPerformance] = useState<PerformanceStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [openPositions, setOpenPositions] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'config' | 'backtest'>('overview');
  const [isPaperTrading, setIsPaperTrading] = useState(true);
  const [socket, setSocket] = useState<any>(null);
  
  // Config form state
  const [selectedStrategy, setSelectedStrategy] = useState('moderate');
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['BTC', 'ETH']);
  const [riskPerTrade, setRiskPerTrade] = useState(2);
  const [maxDailyTrades, setMaxDailyTrades] = useState(10);
  const [minConfidence, setMinConfidence] = useState(70);
  const [useTrailingStop, setUseTrailingStop] = useState(true);
  const [trailingStopPercent, setTrailingStopPercent] = useState(2);
  const [useKelly, setUseKelly] = useState(false);
  const [autoBuy, setAutoBuy] = useState(true);
  const [autoSell, setAutoSell] = useState(true);
  
  // Backtest state
  const [backtestSymbol, setBacktestSymbol] = useState('BTCUSDT');
  const [backtestPeriod, setBacktestPeriod] = useState(30);
  const [backtestResult, setBacktestResult] = useState<any>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load data on mount
  useEffect(() => {
    loadData();
    connectSocket();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Refresh data periodically when bot is active
  useEffect(() => {
    if (botStatus?.active) {
      intervalRef.current = setInterval(() => {
        loadData();
      }, 10000); // Refresh every 10 seconds when active
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [botStatus?.active]);

  const connectSocket = () => {
    const newSocket = io(API_URL);
    
    newSocket.on('connect', () => {
      console.log('Connected to trading socket');
      const token = localStorage.getItem('token');
      if (token) {
        // Extract user ID from token or use stored user
        const user = localStorage.getItem('user');
        if (user) {
          try {
            const userData = JSON.parse(user);
            newSocket.emit('join-user', userData.id || userData._id);
          } catch {
            // Ignore parse error
          }
        }
      }
    });
    
    newSocket.on('trade-executed', (data) => {
      showToast.info(`${data.type.toUpperCase()} ${data.symbol} @ $${data.price.toFixed(2)}`, 'Trade Executed');
      loadData();
    });
    
    newSocket.on('auto-trading-enabled', () => {
      showToast.success('Auto-trading enabled', 'Bot');
    });
    
    newSocket.on('auto-trading-disabled', () => {
      showToast.info('Auto-trading disabled', 'Bot');
    });
    
    setSocket(newSocket);
  };

  const loadData = async () => {
    try {
      const [status, perf, tradeHistory, positions, configData] = await Promise.all([
        getBotStatus(),
        getPerformanceStats(),
        getTradeHistory(20),
        getOpenPositions(),
        getTradeHistory(1)
      ]);
      
      setBotStatus(status);
      setPerformance(perf);
      setTrades(tradeHistory);
      setOpenPositions(positions);
      
      if (status) {
        setIsPaperTrading(status.paperTrading);
        setSelectedStrategy(status.strategy || 'moderate');
        setSelectedSymbols(status.symbols || ['BTC', 'ETH']);
      }
    } catch (error) {
      console.error('Error loading bot data:', error);
    }
  };

  const handleEnableBot = async () => {
    setIsLoading(true);
    
    const result = await enableAutoTrading({
      strategy: selectedStrategy as 'conservative' | 'moderate' | 'aggressive',
      symbols: selectedSymbols,
      maxRiskPerTrade: riskPerTrade,
      maxDailyTrades: maxDailyTrades,
      minConfidence: minConfidence,
      trailingStopPercent: useTrailingStop ? trailingStopPercent : 0,
      useKellyCriterion: useKelly,
      autoBuy,
      autoSell,
      paperTrading: isPaperTrading
    });
    
    if (result.success) {
      showToast.success('Trading bot activated!', 'Success');
      loadData();
    } else {
      showToast.error(result.error || 'Failed to enable bot', 'Error');
    }
    
    setIsLoading(false);
  };

  const handleDisableBot = async () => {
    setIsLoading(true);
    
    const result = await disableAutoTrading();
    
    if (result.success) {
      showToast.info('Trading bot deactivated', 'Bot Stopped');
      loadData();
    } else {
      showToast.error(result.error || 'Failed to disable bot', 'Error');
    }
    
    setIsLoading(false);
  };

  const handleTogglePaperTrading = async () => {
    const newValue = !isPaperTrading;
    const result = await togglePaperTrading(newValue);
    
    if (result.success) {
      setIsPaperTrading(newValue);
      showToast.success(`Paper trading ${newValue ? 'enabled' : 'disabled'}`, 'Mode Changed');
    } else {
      showToast.error(result.error || 'Failed to toggle mode', 'Error');
    }
  };

  const handleRunBacktest = async () => {
    setIsBacktesting(true);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - backtestPeriod);
    
    const result = await runBacktest(
      backtestSymbol,
      startDate.toISOString(),
      endDate.toISOString(),
      selectedStrategy
    );
    
    if (result.success && result.result) {
      setBacktestResult(result.result);
      showToast.success('Backtest completed', 'Success');
    } else {
      showToast.error(result.error || 'Backtest failed', 'Error');
    }
    
    setIsBacktesting(false);
  };

  const handleManualTrade = async (symbol: string, side: 'buy' | 'sell') => {
    const result = await executeManualTrade(symbol, side, 90);
    
    if (result.success) {
      showToast.success(`${side.toUpperCase()} order executed for ${symbol}`, 'Trade');
      loadData();
    } else {
      showToast.error(result.error || 'Trade failed', 'Error');
    }
  };

  const toggleSymbol = (symbol: string) => {
    if (selectedSymbols.includes(symbol)) {
      setSelectedSymbols(selectedSymbols.filter(s => s !== symbol));
    } else {
      setSelectedSymbols([...selectedSymbols, symbol]);
    }
  };

  // Render helpers
  const renderStatusBadge = () => {
    if (!botStatus) return null;
    
    if (botStatus.active) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400 border border-green-500/30">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
          Active
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30">
        <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
        Inactive
      </span>
    );
  };

  const renderPaperTradingBadge = () => (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
      isPaperTrading 
        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
        : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
    }`}>
      {isPaperTrading ? 'Paper Trading' : 'Real Trading'}
    </span>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
            <Bot className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Trading Bot</h2>
            <p className="text-gray-400 text-sm">Automated trading with AI-powered signals</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {renderStatusBadge()}
          {renderPaperTradingBadge()}
          
          {botStatus?.active ? (
            <button
              onClick={handleDisableBot}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border border-red-500/30 transition-colors disabled:opacity-50"
            >
              <Pause className="w-4 h-4" />
              Stop Bot
            </button>
          ) : (
            <button
              onClick={handleEnableBot}
              disabled={isLoading || selectedSymbols.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg border border-green-500/30 transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Start Bot
            </button>
          )}
        </div>
      </div>

      {/* Paper Trading Toggle */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-white font-medium">Paper Trading Mode</p>
              <p className="text-gray-400 text-sm">
                {isPaperTrading 
                  ? 'Trades are simulated. No real money is used.' 
                  : 'Warning: Real money will be used for trading!'}
              </p>
            </div>
          </div>
          <button
            onClick={handleTogglePaperTrading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isPaperTrading ? 'bg-blue-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isPaperTrading ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        {(['overview', 'trades', 'config', 'backtest'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 ${
              activeTab === tab
                ? 'text-blue-400 border-blue-400'
                : 'text-gray-400 border-transparent hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Activity className="w-4 h-4" />
                <span className="text-sm">Total Trades</span>
              </div>
              <p className="text-2xl font-bold text-white">{performance?.totalTrades || 0}</p>
              <p className="text-xs text-gray-500">Auto-executed</p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Win Rate</span>
              </div>
              <p className="text-2xl font-bold text-green-400">{performance?.winRate?.toFixed(1) || 0}%</p>
              <p className="text-xs text-gray-500">
                {performance?.winningTrades || 0} / {performance?.losingTrades || 0}
              </p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">Total P&L</span>
              </div>
              <p className={`text-2xl font-bold ${(performance?.totalPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(performance?.totalPnL || 0) >= 0 ? '+' : ''}${performance?.totalPnL?.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-gray-500">Net profit/loss</p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">Sharpe Ratio</span>
              </div>
              <p className="text-2xl font-bold text-white">{performance?.sharpeRatio?.toFixed(2) || '0.00'}</p>
              <p className="text-xs text-gray-500">Risk-adjusted return</p>
            </div>
          </div>

          {/* Open Positions */}
          {openPositions.length > 0 && (
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-400" />
                  Open Positions ({openPositions.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-700">
                {openPositions.map((trade) => (
                  <div key={trade._id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.side.toUpperCase()}
                      </span>
                      <div>
                        <p className="text-white font-medium">{trade.symbol}</p>
                        <p className="text-gray-400 text-sm">
                          @ ${trade.entryPrice.toFixed(2)} × {trade.quantity.toFixed(6)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleManualTrade(trade.symbol.replace('USDT', ''), 'sell')}
                      className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition-colors"
                    >
                      Close
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strategy Info */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" />
              Current Strategy
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">Strategy Type</p>
                <p className="text-white font-medium capitalize">{selectedStrategy}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Trading Pairs</p>
                <p className="text-white font-medium">{selectedSymbols.join(', ')}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Risk per Trade</p>
                <p className="text-white font-medium">{riskPerTrade}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trades Tab */}
      {activeTab === 'trades' && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              Recent Trades
            </h3>
          </div>
          {trades.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p>No trades yet. Start the bot to begin trading.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700 max-h-96 overflow-auto">
              {trades.map((trade) => (
                <div key={trade._id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.side.toUpperCase()}
                      </span>
                      <span className="text-white font-medium">{trade.symbol}</span>
                      {trade.paperTrading && (
                        <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                          Paper
                        </span>
                      )}
                    </div>
                    <span className="text-gray-400 text-sm">
                      {new Date(trade.entryTime).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-400">
                      Entry: ${trade.entryPrice.toFixed(2)} × {trade.quantity.toFixed(6)}
                    </div>
                    {trade.status === 'closed' && trade.pnl !== undefined && (
                      <span className={trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)} ({trade.pnlPercent?.toFixed(2)}%)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Strategy Selection */}
          <div>
            <label className="block text-gray-400 text-sm mb-3">Trading Strategy</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {STRATEGY_OPTIONS.map((strategy) => (
                <button
                  key={strategy.id}
                  onClick={() => setSelectedStrategy(strategy.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedStrategy === strategy.id
                      ? 'bg-blue-500/20 border-blue-500/50'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <p className={`font-semibold ${strategy.color}`}>{strategy.name}</p>
                  <p className="text-gray-400 text-sm mt-1">{strategy.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Symbols Selection */}
          <div>
            <label className="block text-gray-400 text-sm mb-3">Trading Pairs</label>
            <div className="flex flex-wrap gap-2">
              {SYMBOL_OPTIONS.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => toggleSymbol(symbol)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedSymbols.includes(symbol)
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
            {selectedSymbols.length === 0 && (
              <p className="text-red-400 text-sm mt-2">Select at least one trading pair</p>
            )}
          </div>

          {/* Risk Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Risk per Trade (%)</label>
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={riskPerTrade}
                onChange={(e) => setRiskPerTrade(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Max Daily Trades</label>
              <input
                type="number"
                min="1"
                max="100"
                value={maxDailyTrades}
                onChange={(e) => setMaxDailyTrades(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Percent className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-white font-medium">Score Minimum IA</p>
                  <p className="text-gray-400 text-sm">Confiance requise pour exécuter un trade</p>
                  {/* Légende des niveaux */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded">⭐ 85%+ PREMIUM</span>
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">✅ 75%+ PRO</span>
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded">🔵 60%+ Standard</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseInt(e.target.value))}
                  className={`w-20 px-3 py-2 border rounded-lg text-white text-center font-bold ${
                    minConfidence >= 85 ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' :
                    minConfidence >= 75 ? 'bg-green-500/20 border-green-500/50 text-green-400' :
                    minConfidence >= 60 ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' :
                    'bg-gray-800 border-gray-700'
                  }`}
                />
                <span className="text-[10px] text-gray-400">
                  {minConfidence >= 85 ? 'Mode PREMIUM' : 
                   minConfidence >= 75 ? 'Mode PRO' : 
                   minConfidence >= 60 ? 'Mode Standard' : 'Mode Basique'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-yellow-400" />
                <div>
                  <p className="text-white font-medium">Trailing Stop</p>
                  <p className="text-gray-400 text-sm">Dynamic stop-loss that follows price</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {useTrailingStop && (
                  <input
                    type="number"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={trailingStopPercent}
                    onChange={(e) => setTrailingStopPercent(parseFloat(e.target.value))}
                    className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-center"
                    placeholder="%"
                  />
                )}
                <button
                  onClick={() => setUseTrailingStop(!useTrailingStop)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    useTrailingStop ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    useTrailingStop ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-white font-medium">Kelly Criterion</p>
                  <p className="text-gray-400 text-sm">Optimal position sizing based on win rate</p>
                </div>
              </div>
              <button
                onClick={() => setUseKelly(!useKelly)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  useKelly ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  useKelly ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-white font-medium">Auto Buy/Sell</p>
                  <p className="text-gray-400 text-sm">Automatically execute buy and sell signals</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={autoBuy}
                    onChange={(e) => setAutoBuy(e.target.checked)}
                    className="rounded border-gray-600"
                  />
                  Buy
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={autoSell}
                    onChange={(e) => setAutoSell(e.target.checked)}
                    className="rounded border-gray-600"
                  />
                  Sell
                </label>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={async () => {
              const result = await updateAutoTradingConfig({
                strategy: selectedStrategy as 'conservative' | 'moderate' | 'aggressive',
                symbols: selectedSymbols,
                maxRiskPerTrade: riskPerTrade,
                maxDailyTrades: maxDailyTrades,
                minConfidence: minConfidence,
                trailingStopPercent: useTrailingStop ? trailingStopPercent : 0,
                useKellyCriterion: useKelly,
                autoBuy,
                autoSell
              });
              
              if (result.success) {
                showToast.success('Configuration saved', 'Success');
              } else {
                showToast.error(result.error || 'Failed to save', 'Error');
              }
            }}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Save Configuration
          </button>
        </div>
      )}

      {/* Backtest Tab */}
      {activeTab === 'backtest' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Symbol</label>
              <select
                value={backtestSymbol}
                onChange={(e) => setBacktestSymbol(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              >
                {SYMBOL_OPTIONS.map(s => (
                  <option key={s} value={`${s}USDT`}>{s}/USDT</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Period (days)</label>
              <input
                type="number"
                min="7"
                max="365"
                value={backtestPeriod}
                onChange={(e) => setBacktestPeriod(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Strategy</label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              >
                {STRATEGY_OPTIONS.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleRunBacktest}
            disabled={isBacktesting}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isBacktesting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Running Backtest...
              </>
            ) : (
              <>
                <BarChart3 className="w-5 h-5" />
                Run Backtest
              </>
            )}
          </button>

          {backtestResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm">Total Trades</p>
                  <p className="text-2xl font-bold text-white">{backtestResult.totalTrades}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm">Win Rate</p>
                  <p className="text-2xl font-bold text-green-400">{backtestResult.winRate.toFixed(1)}%</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm">Total Return</p>
                  <p className={`text-2xl font-bold ${backtestResult.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {backtestResult.totalReturn >= 0 ? '+' : ''}{backtestResult.totalReturn.toFixed(2)}%
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm">Max Drawdown</p>
                  <p className="text-2xl font-bold text-red-400">{backtestResult.maxDrawdown.toFixed(2)}%</p>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h4 className="text-white font-semibold mb-3">Additional Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Sharpe Ratio:</span>
                    <span className="text-white ml-2">{backtestResult.sharpeRatio.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Profit Factor:</span>
                    <span className="text-white ml-2">{backtestResult.profitFactor.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Avg Trade:</span>
                    <span className="text-white ml-2">${backtestResult.avgTrade.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Avg Win:</span>
                    <span className="text-green-400 ml-2">${backtestResult.avgWin.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Avg Loss:</span>
                    <span className="text-red-400 ml-2">${backtestResult.avgLoss.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
