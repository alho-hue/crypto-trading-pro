import { useState, useEffect } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { FCFAConverter } from './FCFAConverter';
import { Play, RotateCcw, TrendingUp, TrendingDown, DollarSign, Percent, Calendar, BarChart3 } from 'lucide-react';
import { calculateSMA, calculateRSI, calculateMACD, calculateBollingerBands } from '../utils/indicators';

interface BacktestResult {
  totalReturn: number;
  totalReturnPercent: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  trades: BacktestTrade[];
}

interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  type: 'buy' | 'sell';
  pnl: number;
  pnlPercent: number;
}

interface BacktestConfig {
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  strategy: 'sma_cross' | 'rsi' | 'macd' | 'bollinger';
  riskPerTrade: number;
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

  // Run backtest with selected strategy
  const runBacktest = () => {
    if (candleData.length < 50) {
      alert('Pas assez de données historiques');
      return;
    }

    setRunning(true);

    setTimeout(() => {
      let trades: BacktestTrade[] = [];

      // Run selected strategy
      switch (config.strategy) {
        case 'sma_cross':
          trades = runSMACrossStrategy(candleData, config);
          break;
        case 'rsi':
          trades = runRSIStrategy(candleData, config);
          break;
        case 'macd':
          trades = runMACDStrategy(candleData, config);
          break;
        case 'bollinger':
          trades = runBollingerStrategy(candleData, config);
          break;
      }

      const winningTrades = trades.filter(t => t.pnl > 0).length;
      const losingTrades = trades.filter(t => t.pnl <= 0).length;
      const totalProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
      const totalLoss = Math.abs(trades.filter(t => t.pnl <= 0).reduce((sum, t) => sum + t.pnl, 0));
      const totalReturn = trades.reduce((sum, t) => sum + t.pnl, 0);

      // Calculate max drawdown
      const maxDrawdown = calculateMaxDrawdown(trades, config.initialCapital);

      setResult({
        totalReturn,
        totalReturnPercent: (totalReturn / config.initialCapital) * 100,
        winningTrades,
        losingTrades,
        winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0,
        profitFactor: totalLoss > 0 ? totalProfit / totalLoss : 0,
        maxDrawdown,
        trades,
      });

      setRunning(false);
    }, 1000);
  };

  // SMA Crossover Strategy
  const runSMACrossStrategy = (candles: typeof candleData, config: BacktestConfig): BacktestTrade[] => {
    const trades: BacktestTrade[] = [];
    let position: { type: 'long' | 'short'; entry: number; time: number } | null = null;
    const sma20 = calculateSMA(candles, 20);
    const sma50 = calculateSMA(candles, 50);

    for (let i = 50; i < candles.length; i++) {
      if (!sma20[i] || !sma50[i] || !sma20[i-1] || !sma50[i-1]) continue;

      // Golden cross - Buy
      if (sma20[i-1]! <= sma50[i-1]! && sma20[i]! > sma50[i]! && !position) {
        position = { type: 'long', entry: candles[i].close, time: candles[i].time };
      }
      // Death cross - Sell
      else if (sma20[i-1]! >= sma50[i-1]! && sma20[i]! < sma50[i]! && position?.type === 'long') {
        const pnl = candles[i].close - position.entry;
        trades.push({
          entryTime: position.time,
          exitTime: candles[i].time,
          entryPrice: position.entry,
          exitPrice: candles[i].close,
          type: 'buy',
          pnl,
          pnlPercent: (pnl / position.entry) * 100,
        });
        position = null;
      }
    }

    // Close open position
    if (position && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const pnl = lastCandle.close - position.entry;
      trades.push({
        entryTime: position.time,
        exitTime: lastCandle.time,
        entryPrice: position.entry,
        exitPrice: lastCandle.close,
        type: 'buy',
        pnl,
        pnlPercent: (pnl / position.entry) * 100,
      });
    }

    return trades;
  };

  // RSI Strategy
  const runRSIStrategy = (candles: typeof candleData, config: BacktestConfig): BacktestTrade[] => {
    const trades: BacktestTrade[] = [];
    let position: { type: 'long' | 'short'; entry: number; time: number } | null = null;
    const rsi = calculateRSI(candles, 14);

    for (let i = 14; i < candles.length; i++) {
      if (rsi[i] === null || rsi[i-1] === null) continue;

      // RSI < 30 (survente) - Buy signal
      if (rsi[i-1]! >= 30 && rsi[i]! < 30 && !position) {
        position = { type: 'long', entry: candles[i].close, time: candles[i].time };
      }
      // RSI > 70 (surachat) - Sell signal
      else if (rsi[i-1]! <= 70 && rsi[i]! > 70 && position?.type === 'long') {
        const pnl = candles[i].close - position.entry;
        trades.push({
          entryTime: position.time,
          exitTime: candles[i].time,
          entryPrice: position.entry,
          exitPrice: candles[i].close,
          type: 'buy',
          pnl,
          pnlPercent: (pnl / position.entry) * 100,
        });
        position = null;
      }
    }

    // Close open position
    if (position && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const pnl = lastCandle.close - position.entry;
      trades.push({
        entryTime: position.time,
        exitTime: lastCandle.time,
        entryPrice: position.entry,
        exitPrice: lastCandle.close,
        type: 'buy',
        pnl,
        pnlPercent: (pnl / position.entry) * 100,
      });
    }

    return trades;
  };

  // MACD Strategy
  const runMACDStrategy = (candles: typeof candleData, config: BacktestConfig): BacktestTrade[] => {
    const trades: BacktestTrade[] = [];
    let position: { type: 'long' | 'short'; entry: number; time: number } | null = null;
    const macd = calculateMACD(candles);

    for (let i = 35; i < candles.length; i++) {
      const currMACD = macd.macd[i];
      const currSignal = macd.signal[i];
      const prevMACD = macd.macd[i-1];
      const prevSignal = macd.signal[i-1];

      if (currMACD === null || currSignal === null || prevMACD === null || prevSignal === null) continue;

      // MACD crosses above Signal - Buy
      if (prevMACD <= prevSignal && currMACD > currSignal && !position) {
        position = { type: 'long', entry: candles[i].close, time: candles[i].time };
      }
      // MACD crosses below Signal - Sell
      else if (prevMACD >= prevSignal && currMACD < currSignal && position?.type === 'long') {
        const pnl = candles[i].close - position.entry;
        trades.push({
          entryTime: position.time,
          exitTime: candles[i].time,
          entryPrice: position.entry,
          exitPrice: candles[i].close,
          type: 'buy',
          pnl,
          pnlPercent: (pnl / position.entry) * 100,
        });
        position = null;
      }
    }

    // Close open position
    if (position && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const pnl = lastCandle.close - position.entry;
      trades.push({
        entryTime: position.time,
        exitTime: lastCandle.time,
        entryPrice: position.entry,
        exitPrice: lastCandle.close,
        type: 'buy',
        pnl,
        pnlPercent: (pnl / position.entry) * 100,
      });
    }

    return trades;
  };

  // Bollinger Bands Strategy
  const runBollingerStrategy = (candles: typeof candleData, config: BacktestConfig): BacktestTrade[] => {
    const trades: BacktestTrade[] = [];
    let position: { type: 'long' | 'short'; entry: number; time: number } | null = null;
    const bb = calculateBollingerBands(candles, 20, 2);

    for (let i = 20; i < candles.length; i++) {
      const candle = candles[i];
      const upper = bb.upper[i];
      const lower = bb.lower[i];
      const middle = bb.middle[i];

      if (upper === null || lower === null || middle === null) continue;

      // Price touches lower band - Buy (mean reversion)
      if (candle.low <= lower && !position) {
        position = { type: 'long', entry: candle.close, time: candle.time };
      }
      // Price touches upper band - Sell
      else if (candle.high >= upper && position?.type === 'long') {
        const pnl = candle.close - position.entry;
        trades.push({
          entryTime: position.time,
          exitTime: candle.time,
          entryPrice: position.entry,
          exitPrice: candle.close,
          type: 'buy',
          pnl,
          pnlPercent: (pnl / position.entry) * 100,
        });
        position = null;
      }
    }

    // Close open position
    if (position && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const pnl = lastCandle.close - position.entry;
      trades.push({
        entryTime: position.time,
        exitTime: lastCandle.time,
        entryPrice: position.entry,
        exitPrice: lastCandle.close,
        type: 'buy',
        pnl,
        pnlPercent: (pnl / position.entry) * 100,
      });
    }

    return trades;
  };

  // Calculate max drawdown
  const calculateMaxDrawdown = (trades: BacktestTrade[], initialCapital: number): number => {
    let maxDrawdown = 0;
    let peak = initialCapital;
    let currentCapital = initialCapital;

    for (const trade of trades) {
      currentCapital += trade.pnl;
      if (currentCapital > peak) {
        peak = currentCapital;
      }
      const drawdown = ((peak - currentCapital) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-crypto-blue" />
          Backtesting
        </h1>
      </div>

      {/* Configuration */}
      <div className="crypto-card">
        <h2 className="font-semibold mb-4">Configuration</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-gray-400">Crypto</label>
            <select
              value={config.symbol}
              onChange={(e) => setConfig({...config, symbol: e.target.value})}
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
              value={config.timeframe}
              onChange={(e) => setConfig({...config, timeframe: e.target.value})}
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
            >
              <option value="15m">15 minutes</option>
              <option value="1h">1 heure</option>
              <option value="4h">4 heures</option>
              <option value="1d">1 jour</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400">Stratégie</label>
            <select
              value={config.strategy}
              onChange={(e) => setConfig({...config, strategy: e.target.value as any})}
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
            >
              <option value="sma_cross">SMA Crossover</option>
              <option value="rsi">RSI Survente/Achat</option>
              <option value="macd">MACD</option>
              <option value="bollinger">Bollinger Bands</option>
            </select>
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
          <div>
            <label className="text-sm text-gray-400">Risque par Trade (%)</label>
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
          <div className="flex items-end">
            <button
              onClick={runBacktest}
              disabled={running || candleData.length < 50}
              className="w-full py-2 bg-crypto-blue rounded-lg text-white hover:bg-crypto-blue/80 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {running ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Simulation...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Lancer Test
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="crypto-card">
              <div className="text-sm text-gray-400">Rendement Total</div>
              <div className={`text-2xl font-bold font-mono ${
                result.totalReturn >= 0 ? 'text-crypto-green' : 'text-crypto-red'
              }`}>
                {result.totalReturn >= 0 ? '+' : ''}
                {result.totalReturnPercent.toFixed(2)}%
              </div>
              <div className={`text-sm font-mono ${
                result.totalReturn >= 0 ? 'text-crypto-green' : 'text-crypto-red'
              }`}>
                ${result.totalReturn.toFixed(2)}
                <FCFAConverter usdAmount={result.totalReturn} className="text-[10px]" />
              </div>
            </div>
            <div className="crypto-card">
              <div className="text-sm text-gray-400">Win Rate</div>
              <div className="text-2xl font-bold">{result.winRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-400">
                {result.winningTrades}G / {result.losingTrades}P
              </div>
            </div>
            <div className="crypto-card">
              <div className="text-sm text-gray-400">Profit Factor</div>
              <div className={`text-2xl font-bold ${
                result.profitFactor >= 1.5 ? 'text-crypto-green' : 'text-crypto-orange'
              }`}>
                {result.profitFactor.toFixed(2)}
              </div>
            </div>
            <div className="crypto-card">
              <div className="text-sm text-gray-400">Max Drawdown</div>
              <div className="text-2xl font-bold text-crypto-red">
                -{result.maxDrawdown.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Trades Table */}
          <div className="crypto-card">
            <h2 className="font-semibold mb-4">
              Trades ({result.trades.length})
            </h2>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="sticky top-0 bg-crypto-card">
                  <tr className="border-b border-crypto-border">
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">#</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">Entrée</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">Sortie</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-400">Prix Entrée</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-400">Prix Sortie</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-400">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((trade, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelectedTrade(trade)}
                      className={`border-b border-crypto-border/50 hover:bg-crypto-dark/50 cursor-pointer ${
                        trade.pnl >= 0 ? 'hover:bg-crypto-green/5' : 'hover:bg-crypto-red/5'
                      }`}
                    >
                      <td className="py-2 px-3">{i + 1}</td>
                      <td className="py-2 px-3 text-sm">
                        {new Date(trade.entryTime * 1000).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3 text-sm">
                        {new Date(trade.exitTime * 1000).toLocaleDateString()}
                      </td>
                      <td className="text-right py-2 px-3 font-mono">
                        ${trade.entryPrice.toFixed(2)}
                      </td>
                      <td className="text-right py-2 px-3 font-mono">
                        ${trade.exitPrice.toFixed(2)}
                      </td>
                      <td className={`text-right py-2 px-3 font-mono font-medium ${
                        trade.pnl >= 0 ? 'text-crypto-green' : 'text-crypto-red'
                      }`}>
                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                        <span className="text-xs ml-1">
                          ({trade.pnl >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%)
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
