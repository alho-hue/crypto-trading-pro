import { useState, useEffect } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { Brain, Plus, Play, Trash2, Save, BookOpen, TrendingUp, AlertTriangle, CheckCircle, X, Loader2 } from 'lucide-react';
import { generateTradingStrategy } from '../services/groqApi';
import { calculateRSI, calculateMACD, calculateSMA } from '../utils/indicators';

interface Strategy {
  id: string;
  name: string;
  description: string;
  rules: string[];
  indicators: string[];
  timeframe: string;
  symbol: string;
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: number;
  performance?: {
    wins: number;
    losses: number;
    totalReturn: number;
  };
}

export default function Strategies() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [newStrategy, setNewStrategy] = useState({
    name: '',
    symbol: 'BTCUSDT',
    timeframe: '1h',
    riskLevel: 'moderate' as 'conservative' | 'moderate' | 'aggressive',
  });

  const candleData = useCryptoStore((state) => state.candleData);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);

  // Load strategies from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('trading_strategies');
    if (saved) {
      setStrategies(JSON.parse(saved));
    }
  }, []);

  // Save strategies
  const saveStrategies = (updated: Strategy[]) => {
    setStrategies(updated);
    localStorage.setItem('trading_strategies', JSON.stringify(updated));
  };

  // Generate strategy with AI
  const generateStrategy = async () => {
    setGenerating(true);
    try {
      const strategy = await generateTradingStrategy(
        newStrategy.symbol,
        newStrategy.timeframe,
        newStrategy.riskLevel
      );

      const newStrat: Strategy = {
        id: Date.now().toString(),
        name: strategy.name || `${newStrategy.symbol} Strategy`,
        description: strategy.description || 'Stratégie générée par IA',
        rules: strategy.rules || [],
        indicators: strategy.indicators || [],
        timeframe: newStrategy.timeframe,
        symbol: newStrategy.symbol,
        riskLevel: newStrategy.riskLevel === 'conservative' ? 'low' : 
                   newStrategy.riskLevel === 'aggressive' ? 'high' : 'medium',
        createdAt: Date.now(),
      };

      saveStrategies([...strategies, newStrat]);
      setShowCreate(false);
    } catch (error) {
      console.error('Error generating strategy:', error);
      alert('Erreur lors de la génération. Vérifie ta clé API Groq dans .env');
    }
    setGenerating(false);
  };

  // Delete strategy
  const deleteStrategy = (id: string) => {
    if (confirm('Supprimer cette stratégie ?')) {
      saveStrategies(strategies.filter(s => s.id !== id));
    }
  };

  // Create manual strategy
  const createManualStrategy = () => {
    const manual: Strategy = {
      id: Date.now().toString(),
      name: newStrategy.name || 'Nouvelle Stratégie',
      description: 'Stratégie manuelle',
      rules: [],
      indicators: [],
      timeframe: newStrategy.timeframe,
      symbol: newStrategy.symbol,
      riskLevel: 'medium',
      createdAt: Date.now(),
    };
    saveStrategies([...strategies, manual]);
    setShowCreate(false);
  };

  // REAL BACKTESTING
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResults, setBacktestResults] = useState<any>(null);

  const runBacktest = async () => {
    if (!selectedStrategy || candleData.length < 50) {
      alert('Pas assez de données historiques pour le backtesting');
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
      alert('Erreur lors du backtesting');
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

    return {
      trades: trades.slice(-20), // Show last 20 trades
      summary: {
        wins,
        losses,
        totalReturn: parseFloat(returnPercent.toFixed(2)),
        winRate: parseFloat(winRate.toFixed(1)),
        totalTrades,
        profit: totalProfit.toFixed(2)
      }
    };
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-crypto-card rounded-xl p-6 w-full max-w-lg">
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

              <div>
                <label className="text-sm text-gray-400">Profil de Risque</label>
                <div className="flex gap-2 mt-1">
                  {['conservative', 'moderate', 'aggressive'].map((risk) => (
                    <button
                      key={risk}
                      onClick={() => setNewStrategy({...newStrategy, riskLevel: risk as any})}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        newStrategy.riskLevel === risk
                          ? 'bg-crypto-blue text-white'
                          : 'bg-crypto-dark text-gray-400 hover:text-white'
                      }`}
                    >
                      {risk === 'conservative' ? 'Conservateur' : 
                       risk === 'moderate' ? 'Modéré' : 'Agressif'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 bg-crypto-dark rounded-lg text-gray-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                onClick={createManualStrategy}
                className="flex-1 py-2 bg-crypto-dark border border-crypto-border rounded-lg text-white hover:border-crypto-blue"
              >
                <Save className="w-4 h-4 inline mr-1" />
                Manuelle
              </button>
              <button
                onClick={generateStrategy}
                disabled={generating}
                className="flex-1 py-2 bg-crypto-purple rounded-lg text-white hover:bg-crypto-purple/80 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    IA...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4" />
                    Générer IA
                  </>
                )}
              </button>
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

              {strategy.performance && (
                <div className="mt-3 pt-3 border-t border-crypto-border flex items-center justify-between text-sm">
                  <span className={`${strategy.performance.totalReturn >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                    {strategy.performance.totalReturn >= 0 ? '+' : ''}
                    {strategy.performance.totalReturn.toFixed(2)}%
                  </span>
                  <span className="text-gray-400">
                    {strategy.performance.wins}W / {strategy.performance.losses}L
                  </span>
                </div>
              )}
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

            <div className="mb-6">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-crypto-green" />
                Règles
              </h3>
              <ul className="space-y-2">
                {selectedStrategy.rules.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-crypto-blue">{i + 1}.</span>
                    {rule}
                  </li>
                ))}
              </ul>
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
                    Test en cours...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Tester
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
