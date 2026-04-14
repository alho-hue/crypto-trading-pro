import { useState, useEffect, useCallback } from 'react';
import { Bot, Play, Pause, Settings, Trash2, TrendingUp, TrendingDown, Activity, AlertCircle, DollarSign } from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';
import { getDecryptedKey } from '../utils/crypto';
import { hasApiKey } from '../services/binanceApi';
import { formatXOF } from '../utils/currency';

interface BotStrategy {
  id: string;
  name: string;
  description: string;
  symbol: string;
  timeframe: string;
  active: boolean;
  config: {
    investmentAmount: number;
    maxTradesPerDay: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    rsiPeriod: number;
    rsiOverbought: number;
    rsiOversold: number;
  };
  stats: {
    totalTrades: number;
    winningTrades: number;
    totalProfit: number;
    lastTradeTime?: number;
  };
  createdAt: number;
}

interface BotTrade {
  id: string;
  strategyId: string;
  symbol: string;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  timestamp: number;
  reason: string;
  profit?: number;
}

const DEFAULT_STRATEGIES: BotStrategy[] = [
  {
    id: 'rsi-bot-1',
    name: 'RSI Scalper BTC',
    description: 'Achète quand RSI < 30, vend quand RSI > 70',
    symbol: 'BTCUSDT',
    timeframe: '15m',
    active: false,
    config: {
      investmentAmount: 100,
      maxTradesPerDay: 10,
      stopLossPercent: 2,
      takeProfitPercent: 4,
      rsiPeriod: 14,
      rsiOverbought: 70,
      rsiOversold: 30,
    },
    stats: {
      totalTrades: 0,
      winningTrades: 0,
      totalProfit: 0,
    },
    createdAt: Date.now(),
  },
  {
    id: 'macd-bot-1',
    name: 'MACD Trend ETH',
    description: 'Suivi de tendance avec MACD',
    symbol: 'ETHUSDT',
    timeframe: '1h',
    active: false,
    config: {
      investmentAmount: 50,
      maxTradesPerDay: 5,
      stopLossPercent: 3,
      takeProfitPercent: 6,
      rsiPeriod: 14,
      rsiOverbought: 70,
      rsiOversold: 30,
    },
    stats: {
      totalTrades: 0,
      winningTrades: 0,
      totalProfit: 0,
    },
    createdAt: Date.now(),
  },
];

export default function TradingBot() {
  const [strategies, setStrategies] = useState<BotStrategy[]>([]);
  const [trades, setTrades] = useState<BotTrade[]>([]);
  const [hasApiKeys, setHasApiKeys] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<BotStrategy | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeBots, setActiveBots] = useState(0);
  
  const prices = useCryptoStore((state) => state.prices);
  const candleData = useCryptoStore((state) => state.candleData);

  useEffect(() => {
    const saved = localStorage.getItem('trading_bots');
    if (saved) {
      setStrategies(JSON.parse(saved));
    } else {
      setStrategies(DEFAULT_STRATEGIES);
    }
    
    const savedTrades = localStorage.getItem('bot_trades');
    if (savedTrades) {
      setTrades(JSON.parse(savedTrades));
    }
    
    setHasApiKeys(hasApiKey());
    
    // Count active bots
    const active = strategies.filter(s => s.active).length;
    setActiveBots(active);
  }, []);

  useEffect(() => {
    localStorage.setItem('trading_bots', JSON.stringify(strategies));
    const active = strategies.filter(s => s.active).length;
    setActiveBots(active);
  }, [strategies]);

  useEffect(() => {
    localStorage.setItem('bot_trades', JSON.stringify(trades));
  }, [trades]);

  // Bot execution logic
  useEffect(() => {
    if (!hasApiKeys) return;
    
    const interval = setInterval(() => {
      strategies.forEach(strategy => {
        if (!strategy.active) return;
        
        const price = prices.get(strategy.symbol);
        if (!price) return;
        
        // Simple RSI-based logic (simplified)
        const rsi = calculateRSI(candleData, strategy.config.rsiPeriod);
        
        if (rsi < strategy.config.rsiOversold) {
          // BUY signal
          executeTrade(strategy, 'buy', price.price, `RSI oversold: ${rsi.toFixed(2)}`);
        } else if (rsi > strategy.config.rsiOverbought) {
          // SELL signal
          executeTrade(strategy, 'sell', price.price, `RSI overbought: ${rsi.toFixed(2)}`);
        }
      });
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [strategies, prices, candleData, hasApiKeys]);

  const calculateRSI = (data: any[], period: number): number => {
    if (data.length < period) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = data.length - period; i < data.length; i++) {
      const change = data[i].close - data[i].open;
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  const executeTrade = (strategy: BotStrategy, type: 'buy' | 'sell', price: number, reason: string) => {
    // Check if we haven't exceeded max trades per day
    const todayTrades = trades.filter(t => 
      t.strategyId === strategy.id && 
      t.timestamp > Date.now() - 24 * 60 * 60 * 1000
    ).length;
    
    if (todayTrades >= strategy.config.maxTradesPerDay) return;
    
    const quantity = strategy.config.investmentAmount / price;
    
    const trade: BotTrade = {
      id: Date.now().toString(),
      strategyId: strategy.id,
      symbol: strategy.symbol,
      type,
      price,
      quantity,
      timestamp: Date.now(),
      reason,
    };
    
    setTrades(prev => [trade, ...prev]);
    
    // Update strategy stats
    setStrategies(prev => prev.map(s => {
      if (s.id !== strategy.id) return s;
      
      const newTotalTrades = s.stats.totalTrades + 1;
      const newWinningTrades = type === 'sell' && s.stats.lastTradeTime ? 
        s.stats.winningTrades + 1 : s.stats.winningTrades;
      
      return {
        ...s,
        stats: {
          ...s.stats,
          totalTrades: newTotalTrades,
          winningTrades: newWinningTrades,
          lastTradeTime: Date.now(),
        }
      };
    }));
    
    // TODO: Execute real trade via Binance API
    console.log(`BOT TRADE: ${type.toUpperCase()} ${strategy.symbol} @ ${price} - ${reason}`);
  };

  const toggleStrategy = (id: string) => {
    if (!hasApiKeys) {
      alert('Configurez vos clés API pour activer les bots');
      return;
    }
    
    setStrategies(prev => prev.map(s => 
      s.id === id ? { ...s, active: !s.active } : s
    ));
  };

  const deleteStrategy = (id: string) => {
    if (confirm('Supprimer ce bot ?')) {
      setStrategies(prev => prev.filter(s => s.id !== id));
    }
  };

  const createBot = () => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
    const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    
    const newBot: BotStrategy = {
      id: `bot-${Date.now()}`,
      name: `Bot ${strategies.length + 1}`,
      description: 'Stratégie RSI personnalisée',
      symbol: randomSymbol,
      timeframe: '15m',
      active: false,
      config: {
        investmentAmount: 50,
        maxTradesPerDay: 5,
        stopLossPercent: 2,
        takeProfitPercent: 4,
        rsiPeriod: 14,
        rsiOverbought: 70,
        rsiOversold: 30,
      },
      stats: {
        totalTrades: 0,
        winningTrades: 0,
        totalProfit: 0,
      },
      createdAt: Date.now(),
    };
    
    setStrategies(prev => [...prev, newBot]);
    setShowCreateModal(false);
  };

  const totalProfit = strategies.reduce((sum, s) => sum + s.stats.totalProfit, 0);
  const totalTrades = strategies.reduce((sum, s) => sum + s.stats.totalTrades, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6 text-crypto-blue" />
          Trading Bots Automatisés
        </h1>
        <div className="flex gap-2">
          <span className={`px-3 py-1 rounded-full text-sm ${
            activeBots > 0 ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
          }`}>
            {activeBots} actif{activeBots !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {!hasApiKeys && (
        <div className="crypto-card bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-500" />
            <div>
              <p className="font-medium">Clés API requises</p>
              <p className="text-sm text-gray-400">
                Configurez vos clés Binance dans Paramètres pour activer le trading automatique
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Bots Actifs</div>
          <div className="text-2xl font-bold text-crypto-blue">{activeBots}</div>
          <div className="text-sm text-gray-400">sur {strategies.length} configurés</div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Trades Total</div>
          <div className="text-2xl font-bold">{totalTrades}</div>
          <div className="text-sm text-gray-400">24h</div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Profit Total</div>
          <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
            {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
          </div>
          <div className="text-sm text-gray-400">
            ≈ {formatXOF(totalProfit)}
          </div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Win Rate</div>
          <div className="text-2xl font-bold text-crypto-green">
            {totalTrades > 0 ? 
              ((strategies.reduce((sum, s) => sum + s.stats.winningTrades, 0) / totalTrades) * 100).toFixed(1) 
              : '0.0'}%
          </div>
          <div className="text-sm text-gray-400">Taux de réussite</div>
        </div>
      </div>

      {/* Strategy List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Stratégies</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-crypto-blue rounded-lg hover:bg-crypto-blue/80 transition-colors text-sm"
          >
            + Nouveau Bot
          </button>
        </div>

        {strategies.map(strategy => {
          const currentPrice = prices.get(strategy.symbol);
          
          return (
            <div 
              key={strategy.id} 
              className={`crypto-card ${strategy.active ? 'border-crypto-green/30' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    strategy.active ? 'bg-crypto-green/20' : 'bg-crypto-dark'
                  }`}>
                    <Bot className={`w-6 h-6 ${strategy.active ? 'text-crypto-green' : 'text-gray-400'}`} />
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{strategy.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        strategy.active ? 'bg-crypto-green/20 text-crypto-green' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {strategy.active ? 'ACTIF' : 'INACTIF'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{strategy.description}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span>{strategy.symbol}</span>
                      <span>•</span>
                      <span>{strategy.timeframe}</span>
                      <span>•</span>
                      <span>${strategy.config.investmentAmount}/trade</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Prix actuel</div>
                    <div className="font-mono">
                      {currentPrice ? `$${currentPrice.price.toLocaleString()}` : '--'}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedStrategy(strategy)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-crypto-dark rounded-lg"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                    
                    <button
                      onClick={() => toggleStrategy(strategy.id)}
                      className={`p-2 rounded-lg ${
                        strategy.active 
                          ? 'bg-crypto-green/20 text-crypto-green hover:bg-crypto-green/30' 
                          : 'bg-crypto-dark text-gray-400 hover:text-white'
                      }`}
                    >
                      {strategy.active ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    
                    <button
                      onClick={() => deleteStrategy(strategy.id)}
                      className="p-2 text-crypto-red hover:bg-crypto-red/20 rounded-lg"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {strategy.stats.totalTrades > 0 && (
                <div className="mt-4 pt-4 border-t border-crypto-border grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-gray-400">Trades</div>
                    <div className="font-semibold">{strategy.stats.totalTrades}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Gagnants</div>
                    <div className="font-semibold text-crypto-green">{strategy.stats.winningTrades}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Profit</div>
                    <div className={`font-semibold ${strategy.stats.totalProfit >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                      ${strategy.stats.totalProfit.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Dernier trade</div>
                    <div className="font-semibold text-xs">
                      {strategy.stats.lastTradeTime ? 
                        new Date(strategy.stats.lastTradeTime).toLocaleTimeString('fr-FR') : 
                        'Jamais'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Trades */}
      <div className="crypto-card">
        <h2 className="text-lg font-semibold mb-4">Trades Récents (Bots)</h2>
        {trades.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucun trade exécuté</p>
            <p className="text-sm">Activez un bot pour commencer</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {trades.slice(0, 10).map(trade => (
              <div 
                key={trade.id} 
                className={`flex items-center justify-between p-3 rounded-lg ${
                  trade.type === 'buy' ? 'bg-crypto-green/10' : 'bg-crypto-red/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    trade.type === 'buy' ? 'bg-crypto-green/20' : 'bg-crypto-red/20'
                  }`}>
                    {trade.type === 'buy' ? 
                      <TrendingUp className="w-4 h-4 text-crypto-green" /> : 
                      <TrendingDown className="w-4 h-4 text-crypto-red" />
                    }
                  </div>
                  <div>
                    <div className="font-medium">{trade.type.toUpperCase()} {trade.symbol}</div>
                    <div className="text-xs text-gray-400">{trade.reason}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono">${trade.price.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(trade.timestamp).toLocaleTimeString('fr-FR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
