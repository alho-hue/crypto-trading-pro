import { useState, useEffect } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { FCFAConverter } from './FCFAConverter';
import { LineChart, TrendingUp, Activity, BarChart3, Target } from 'lucide-react';
import { calculateRSI, calculateMACD, calculateBollingerBands, calculateATR, calculateStochastic } from '../utils/indicators';

export default function TechnicalAnalysis() {
  const candleData = useCryptoStore((state) => state.candleData);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  const prices = useCryptoStore((state) => state.prices);
  
  const [analysis, setAnalysis] = useState({
    rsi: 0,
    macd: { macd: 0, signal: 0, histogram: 0 },
    bollinger: { upper: 0, middle: 0, lower: 0 },
    atr: 0,
    stochastic: { k: 0, d: 0 },
    trend: 'neutral' as 'bullish' | 'bearish' | 'neutral',
    support: 0,
    resistance: 0,
  });

  useEffect(() => {
    if (candleData.length === 0) return;

    // Calculate indicators
    const rsiValues = calculateRSI(candleData, 14);
    const macdValues = calculateMACD(candleData, 12, 26, 9);
    const bbValues = calculateBollingerBands(candleData, 20, 2);
    const atrValues = calculateATR(candleData, 14);
    const stochValues = calculateStochastic(candleData, 14, 3);

    const lastRSI = rsiValues[rsiValues.length - 1] || 50;
    const lastMACD = {
      macd: macdValues.macd[macdValues.macd.length - 1] || 0,
      signal: macdValues.signal[macdValues.signal.length - 1] || 0,
      histogram: macdValues.histogram[macdValues.histogram.length - 1] || 0,
    };
    const lastBB = {
      upper: bbValues.upper[bbValues.upper.length - 1] || 0,
      middle: bbValues.middle[bbValues.middle.length - 1] || 0,
      lower: bbValues.lower[bbValues.lower.length - 1] || 0,
    };
    const lastATR = atrValues[atrValues.length - 1] || 0;
    const lastStoch = {
      k: stochValues.k[stochValues.k.length - 1] || 50,
      d: stochValues.d[stochValues.d.length - 1] || 50,
    };

    // Calculate support and resistance
    const highs = candleData.slice(-20).map(c => c.high);
    const lows = candleData.slice(-20).map(c => c.low);
    const resistance = Math.max(...highs);
    const support = Math.min(...lows);

    // Determine trend
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (lastRSI > 55 && lastMACD.macd > lastMACD.signal) {
      trend = 'bullish';
    } else if (lastRSI < 45 && lastMACD.macd < lastMACD.signal) {
      trend = 'bearish';
    }

    setAnalysis({
      rsi: lastRSI,
      macd: lastMACD,
      bollinger: lastBB,
      atr: lastATR,
      stochastic: lastStoch,
      trend,
      support,
      resistance,
    });
  }, [candleData]);

  const currentPrice = prices.get(selectedSymbol)?.price || 0;

  const getSignalColor = (value: number, type: 'rsi' | 'macd' | 'stoch') => {
    if (type === 'rsi') {
      if (value > 70) return 'text-red-400';
      if (value < 30) return 'text-green-400';
      return 'text-yellow-400';
    }
    if (type === 'stoch') {
      if (value > 80) return 'text-red-400';
      if (value < 20) return 'text-green-400';
      return 'text-yellow-400';
    }
    return value > 0 ? 'text-green-400' : 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LineChart className="w-6 h-6 text-crypto-blue" />
          <h2 className="text-xl font-semibold">Analyse Technique - {selectedSymbol}</h2>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold font-mono">${currentPrice.toLocaleString()}</div>
          <FCFAConverter usdAmount={currentPrice} />
          <div className={`text-sm ${analysis.trend === 'bullish' ? 'text-green-400' : analysis.trend === 'bearish' ? 'text-red-400' : 'text-yellow-400'}`}>
            {analysis.trend === 'bullish' ? '↗ Tendance Haussière' : analysis.trend === 'bearish' ? '↘ Tendance Baissière' : '→ Tendance Neutre'}
          </div>
        </div>
      </div>

      {/* Main Indicators Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* RSI */}
        <div className="crypto-card">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-crypto-blue" />
            <span className="text-sm text-gray-400">RSI (14)</span>
          </div>
          <div className={`text-3xl font-bold ${getSignalColor(analysis.rsi, 'rsi')}`}>
            {analysis.rsi.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {analysis.rsi > 70 ? 'Suracheté' : analysis.rsi < 30 ? 'Survendu' : 'Neutre'}
          </div>
        </div>

        {/* MACD */}
        <div className="crypto-card">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-crypto-purple" />
            <span className="text-sm text-gray-400">MACD</span>
          </div>
          <div className={`text-3xl font-bold ${analysis.macd.histogram > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {analysis.macd.histogram > 0 ? '+' : ''}{analysis.macd.histogram.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            MACD: {analysis.macd.macd.toFixed(2)}
          </div>
        </div>

        {/* Stochastic */}
        <div className="crypto-card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-crypto-green" />
            <span className="text-sm text-gray-400">Stochastique</span>
          </div>
          <div className={`text-3xl font-bold ${getSignalColor(analysis.stochastic.k, 'stoch')}`}>
            {analysis.stochastic.k.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            %D: {analysis.stochastic.d.toFixed(2)}
          </div>
        </div>

        {/* ATR */}
        <div className="crypto-card">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-crypto-orange" />
            <span className="text-sm text-gray-400">ATR (14)</span>
          </div>
          <div className="text-3xl font-bold text-white">
            ${analysis.atr.toFixed(2)}
          </div>
          <FCFAConverter usdAmount={analysis.atr} />
          <div className="text-xs text-gray-500 mt-1">
            Volatilité
          </div>
        </div>
      </div>

      {/* Bollinger Bands */}
      <div className="crypto-card">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-crypto-pink" />
          Bandes de Bollinger (20, 2)
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-sm text-gray-400">Résistance</div>
            <div className="text-xl font-mono text-red-400">${analysis.bollinger.upper.toFixed(2)}</div>
            <FCFAConverter usdAmount={analysis.bollinger.upper} />
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400">Moyenne</div>
            <div className="text-xl font-mono text-white">${analysis.bollinger.middle.toFixed(2)}</div>
            <FCFAConverter usdAmount={analysis.bollinger.middle} />
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400">Support</div>
            <div className="text-xl font-mono text-green-400">${analysis.bollinger.lower.toFixed(2)}</div>
            <FCFAConverter usdAmount={analysis.bollinger.lower} />
          </div>
        </div>
        <div className="mt-4 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 via-white to-red-500"
            style={{
              width: analysis.bollinger.upper - analysis.bollinger.lower > 0
                ? `${((currentPrice - analysis.bollinger.lower) / (analysis.bollinger.upper - analysis.bollinger.lower)) * 100}%`
                : '50%'
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Survendu</span>
          <span>Position actuelle</span>
          <span>Suracheté</span>
        </div>
      </div>

      {/* Support/Resistance Levels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="crypto-card border-l-4 border-l-green-500">
          <h4 className="text-sm text-gray-400 mb-2">Support (20 périodes)</h4>
          <div className="text-2xl font-bold font-mono text-green-400">${analysis.support.toFixed(2)}</div>
          <FCFAConverter usdAmount={analysis.support} />
          <p className="text-xs text-gray-500 mt-2">
            Niveau où le prix a tendance à rebondir
          </p>
        </div>
        <div className="crypto-card border-l-4 border-l-red-500">
          <h4 className="text-sm text-gray-400 mb-2">Résistance (20 périodes)</h4>
          <div className="text-2xl font-bold font-mono text-red-400">${analysis.resistance.toFixed(2)}</div>
          <FCFAConverter usdAmount={analysis.resistance} />
          <p className="text-xs text-gray-500 mt-2">
            Niveau où le prix rencontre des difficultés à franchir
          </p>
        </div>
      </div>
    </div>
  );
}
