import { useState, useEffect } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { calculateRSI, calculateMACD, calculateSMA } from '../utils/indicators';
import { FCFAConverter } from './FCFAConverter';
import { TrendingUp, TrendingDown, Minus, Brain, AlertTriangle, Target, Shield, Loader2 } from 'lucide-react';
import type { AISignal } from '../types';
import { performAdvancedAnalysis, TechnicalAnalysis, formatAnalysisForDisplay } from '../services/advancedAnalysis';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Get API key from user settings (localStorage) or fallback to env
const getGroqApiKey = (): string => {
  try {
    const settings = localStorage.getItem('trading_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.groqApiKey && parsed.groqApiKey !== 'ta_cle_groq_ici') {
        return parsed.groqApiKey;
      }
    }
  } catch (e) {
    // Silent fail
  }
  return import.meta.env.VITE_GROQ_API_KEY || '';
};

// Rate limiting and cache
const CACHE_DURATION = 300000; // 5 minutes cache (augmenté)
const RATE_LIMIT_DELAY = 5000; // 5 seconds between requests
const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 10000; // 10 secondes initiales
const cache = new Map<string, { data: any; timestamp: number }>();
let lastRequestTime = 0;
let consecutive429Errors = 0;
let isFetching = false; // Prevent simultaneous requests

export default function AIRecommendations() {
  const candleData = useCryptoStore((state) => state.candleData);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  const prices = useCryptoStore((state) => state.prices);
  
  const [signal, setSignal] = useState<AISignal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [advancedAnalysis, setAdvancedAnalysis] = useState<TechnicalAnalysis | null>(null);

  // Perform advanced analysis whenever data changes
  useEffect(() => {
    const currentPrice = prices.get(selectedSymbol)?.price;
    if (currentPrice && candleData.length >= 20) {
      const analysis = performAdvancedAnalysis(selectedSymbol, currentPrice);
      setAdvancedAnalysis(analysis);
    }
  }, [candleData, selectedSymbol, prices]);

  useEffect(() => {
    if (candleData.length < 50) {
      setSignal(null);
      return;
    }

    const fetchAIAnalysis = async (retryCount = 0) => {
      // Prevent simultaneous requests
      if (isFetching) {
        return;
      }
      
      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      
      // Exponential backoff after 429 errors
      const backoffDelay = consecutive429Errors > 0 
        ? Math.min(INITIAL_BACKOFF * Math.pow(2, consecutive429Errors - 1), 60000) // Max 1 minute
        : RATE_LIMIT_DELAY;
      
      if (timeSinceLastRequest < backoffDelay) {
        const waitTime = backoffDelay - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      isFetching = true;
      lastRequestTime = Date.now();
      
      // Check cache
      const cacheKey = `${selectedSymbol}`;
      const cached = cache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_DURATION) {
        setSignal(cached.data);
        isFetching = false;
        return;
      }
      setLoading(true);
      setError(null);
      
      try {
        // Calculate technical indicators
        const rsi = calculateRSI(candleData, 14);
        const macd = calculateMACD(candleData);
        const sma20 = calculateSMA(candleData, 20);
        const sma50 = calculateSMA(candleData, 50);
        
        const currentPrice = prices.get(selectedSymbol)?.price || candleData[candleData.length - 1]?.close || 0;
        const lastCandle = candleData[candleData.length - 1];
        
        const lastRSI = rsi[rsi.length - 1];
        const lastMACD = macd.macd[macd.macd.length - 1];
        const lastSignal = macd.signal[macd.signal.length - 1];
        const lastHistogram = macd.histogram[macd.histogram.length - 1];
        const lastSMA20 = sma20[sma20.length - 1];
        const lastSMA50 = sma50[sma50.length - 1];
        
        // Prepare market context
        const marketContext = {
          symbol: selectedSymbol,
          price: currentPrice,
          rsi: lastRSI?.toFixed(2),
          macd: lastMACD?.toFixed(4),
          macdSignal: lastSignal?.toFixed(4),
          sma20: lastSMA20?.toFixed(2),
          sma50: lastSMA50?.toFixed(2),
          high24h: lastCandle.high,
          low24h: lastCandle.low,
          volume: lastCandle.volume,
        };

        const GROQ_API_KEY = getGroqApiKey();
        if (!GROQ_API_KEY) {
          // Fallback to local analysis if no API key
          generateLocalSignal(currentPrice, lastCandle, lastRSI, lastHistogram, lastSMA20, lastSMA50);
          return;
        }

        // Call Groq API for real AI analysis
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getGroqApiKey()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: `Tu es un expert en analyse technique de cryptomonnaies. Analyse les données fournies et donne une recommandation claire: ACHAT, VENTE ou NEUTRE. 

Réponds UNIQUEMENT au format JSON suivant:
{
  "direction": "buy|sell|neutral",
  "confidence": 0-100,
  "entryPrice": number,
  "stopLoss": number,
  "takeProfit": number,
  "reason": "explication courte",
  "riskLevel": "low|medium|high"
}`
              },
              {
                role: 'user',
                content: `Analyse ${selectedSymbol}:
- Prix actuel: $${currentPrice}
- RSI(14): ${lastRSI?.toFixed(2)}
- MACD: ${lastMACD?.toFixed(4)} (Signal: ${lastSignal?.toFixed(4)}, Histogram: ${lastHistogram?.toFixed(4)})
- SMA20: ${lastSMA20?.toFixed(2)}
- SMA50: ${lastSMA50?.toFixed(2)}
- Dernière bougie: Open ${lastCandle.open}, High ${lastCandle.high}, Low ${lastCandle.low}, Close ${lastCandle.close}

Donne ta recommandation:`
              }
            ],
            temperature: 0.3,
            max_tokens: 500,
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            consecutive429Errors++;
            if (retryCount < MAX_RETRIES) {
              isFetching = false;
              return fetchAIAnalysis(retryCount + 1);
            }
          }
          throw new Error(`API Error: ${response.status}`);
        }
        
        // Reset consecutive errors on success
        consecutive429Errors = 0;

        const data = await response.json();
        const aiResponse = data.choices[0]?.message?.content || '';
        
        // Extract JSON from response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const aiSignal = JSON.parse(jsonMatch[0]);
          
          const signalData = {
            symbol: selectedSymbol,
            direction: aiSignal.direction,
            confidence: aiSignal.confidence,
            entryPrice: aiSignal.entryPrice,
            stopLoss: aiSignal.stopLoss,
            takeProfit: aiSignal.takeProfit,
            explanation: aiSignal.reason,
            riskLevel: aiSignal.riskLevel,
            timestamp: Date.now(),
            timeframe: '1h',
          };
          
          // Cache the result
          cache.set(cacheKey, { data: signalData, timestamp: Date.now() });
          setSignal(signalData);
          
          setAnalysis(aiSignal.reason);
        } else {
          throw new Error('Invalid AI response format');
        }
        
      } catch (err) {
        // Silent fail - use local fallback
        setError('API Groq saturée - Analyse locale utilisée');
        // Fallback to local analysis
        const currentPrice = prices.get(selectedSymbol)?.price || candleData[candleData.length - 1]?.close || 0;
        const lastCandle = candleData[candleData.length - 1];
        const rsi = calculateRSI(candleData, 14);
        const macd = calculateMACD(candleData);
        const sma20 = calculateSMA(candleData, 20);
        const sma50 = calculateSMA(candleData, 50);
        generateLocalSignal(currentPrice, lastCandle, rsi[rsi.length - 1], macd.histogram[macd.histogram.length - 1], sma20[sma20.length - 1], sma50[sma50.length - 1]);
      } finally {
        setLoading(false);
        isFetching = false;
      }
    };

    const generateLocalSignal = (currentPrice: number, lastCandle: any, lastRSI: number | null, lastHistogram: number | null, lastSMA20: number | null, lastSMA50: number | null) => {
      let score = 50;
      let factors: string[] = [];

      if (lastRSI !== null) {
        if (lastRSI < 30) { score += 15; factors.push('RSI survente'); }
        else if (lastRSI > 70) { score -= 15; factors.push('RSI surachat'); }
      }

      if (lastHistogram !== null) {
        if (lastHistogram > 0) { score += 10; factors.push('MACD haussier'); }
        else { score -= 10; factors.push('MACD baissier'); }
      }

      if (lastSMA20 !== null && lastSMA50 !== null) {
        if (lastSMA20 > lastSMA50) { score += 10; factors.push('Golden Cross'); }
        else { score -= 10; factors.push('Death Cross'); }
      }

      let direction: 'buy' | 'sell' | 'neutral' = score >= 60 ? 'buy' : score <= 40 ? 'sell' : 'neutral';
      let confidence = Math.abs(score - 50) * 2;
      
      const atr = (lastCandle.high - lastCandle.low) * 1.5;
      
      setSignal({
        symbol: selectedSymbol,
        direction,
        confidence: Math.min(confidence, 95),
        entryPrice: currentPrice,
        stopLoss: direction === 'buy' ? currentPrice - atr : currentPrice + atr,
        takeProfit: direction === 'buy' ? currentPrice + atr * 2 : currentPrice - atr * 2,
        explanation: factors.slice(0, 2).join(', ') || 'Analyse technique',
        riskLevel: confidence > 70 ? 'high' : confidence > 40 ? 'medium' : 'low',
        timestamp: Date.now(),
        timeframe: '1h',
      });
    };

    fetchAIAnalysis();
  }, [selectedSymbol]); // Ne se déclenche que quand on change de paire, pas à chaque candle

  if (!signal) {
    return (
      <div className="crypto-card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-crypto-purple" />
          Analyse IA
        </h2>
        <div className="text-center py-8 text-gray-500">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          Pas assez de données pour l'analyse
        </div>
      </div>
    );
  }

  const getDirectionIcon = () => {
    switch (signal.direction) {
      case 'buy':
        return <TrendingUp className="w-6 h-6 text-crypto-green" />;
      case 'sell':
        return <TrendingDown className="w-6 h-6 text-crypto-red" />;
      default:
        return <Minus className="w-6 h-6 text-gray-400" />;
    }
  };

  const getDirectionColor = () => {
    switch (signal.direction) {
      case 'buy':
        return 'bg-crypto-green/20 text-crypto-green border-crypto-green';
      case 'sell':
        return 'bg-crypto-red/20 text-crypto-red border-crypto-red';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const getDirectionText = () => {
    switch (signal.direction) {
      case 'buy':
        return 'ACHAT';
      case 'sell':
        return 'VENTE';
      default:
        return 'NEUTRE';
    }
  };

  return (
    <div className="crypto-card">
      <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
        <Brain className="w-5 h-5 text-crypto-purple flex-shrink-0" />
        <span className="truncate">Analyse IA</span>
      </h2>

      {/* Signal Direction avec Badges de Qualité PRO */}
      <div className={`p-3 sm:p-4 rounded-lg border mb-3 sm:mb-4 ${getDirectionColor()}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex-shrink-0">{getDirectionIcon()}</div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-bold truncate">{getDirectionText()}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs opacity-80">Signal IA • {signal.timeframe}</span>
                {/* Badge Qualité */}
                {signal.confidence >= 85 && (
                  <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded border border-yellow-500/30">
                    ⭐ PREMIUM
                  </span>
                )}
                {signal.confidence >= 75 && signal.confidence < 85 && (
                  <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded border border-green-500/30">
                    ✅ PRO
                  </span>
                )}
                {signal.confidence < 60 && (
                  <span className="px-1.5 py-0.5 bg-gray-500/20 text-gray-400 text-[10px] rounded border border-gray-500/30">
                    ⚠️ FAIBLE
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl sm:text-3xl font-bold">{signal.confidence}%</div>
            <div className="text-xs opacity-80">Confiance</div>
            {/* Barre de qualité */}
            <div className="w-20 h-1.5 bg-gray-700 rounded-full mt-1.5 overflow-hidden">
              <div 
                className={`h-full rounded-full ${
                  signal.confidence >= 85 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                  signal.confidence >= 75 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                  signal.confidence >= 60 ? 'bg-gradient-to-r from-blue-500 to-blue-400' :
                  'bg-gradient-to-r from-red-500 to-red-400'
                }`}
                style={{ width: `${signal.confidence}%` }}
              />
            </div>
          </div>
        </div>
        
        {/* Indicateurs de fiabilité */}
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-current border-opacity-10">
          {/* Risk/Reward Badge */}
          {(() => {
            const rr = Math.abs((signal.takeProfit - signal.entryPrice) / (signal.stopLoss - signal.entryPrice));
            return (
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                rr >= 2 ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                rr >= 1.5 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
              }`}>
                R/R: 1:{rr.toFixed(1)}
              </span>
            );
          })()}
          
          {/* Risk Level */}
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            signal.riskLevel === 'low' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
            signal.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
            'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            Risque: {signal.riskLevel === 'low' ? 'Faible' : signal.riskLevel === 'medium' ? 'Moyen' : 'Élevé'}
          </span>
          
          {/* SL Distance */}
          {(() => {
            const slDist = Math.abs((signal.stopLoss - signal.entryPrice) / signal.entryPrice * 100);
            return (
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                slDist <= 2 ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                slDist <= 3 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                SL: {slDist.toFixed(1)}%
              </span>
            );
          })()}
        </div>
      </div>

      {/* Trade Levels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3 sm:mb-4">
        <div className="bg-crypto-dark rounded-lg p-2 sm:p-2 overflow-hidden flex sm:block items-center justify-between sm:justify-start gap-2">
          <div className="flex items-center gap-1 text-gray-400 text-xs mb-0 sm:mb-1">
            <Target className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">Entrée</span>
          </div>
          <div>
            <div className="text-sm font-mono font-medium truncate">
              ${signal.entryPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
            <FCFAConverter usdAmount={signal.entryPrice} className="text-[10px] hidden sm:block" />
          </div>
        </div>
        <div className="bg-crypto-dark rounded-lg p-2 sm:p-2 overflow-hidden flex sm:block items-center justify-between sm:justify-start gap-2">
          <div className="flex items-center gap-1 text-crypto-red text-xs mb-0 sm:mb-1">
            <Shield className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">Stop Loss</span>
          </div>
          <div>
            <div className="text-sm font-mono font-medium text-crypto-red truncate">
              ${signal.stopLoss.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
            <FCFAConverter usdAmount={signal.stopLoss} className="text-[10px] hidden sm:block" />
          </div>
        </div>
        <div className="bg-crypto-dark rounded-lg p-2 sm:p-2 overflow-hidden flex sm:block items-center justify-between sm:justify-start gap-2">
          <div className="flex items-center gap-1 text-crypto-green text-xs mb-0 sm:mb-1">
            <TrendingUp className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">Take Profit</span>
          </div>
          <div>
            <div className="text-sm font-mono font-medium text-crypto-green truncate">
              ${signal.takeProfit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
            <FCFAConverter usdAmount={signal.takeProfit} className="text-[10px] hidden sm:block" />
          </div>
        </div>
      </div>

      {/* Advanced Analysis */}
      {advancedAnalysis && advancedAnalysis.setup.confidence > 0 && (
        <div className="bg-crypto-dark rounded-lg p-3 mb-3">
          <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Analyse Avancée (Tendance + Zone + Bougie)
          </div>
          
          {/* Trend */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-400">Tendance:</span>
            <span className={`font-medium ${
              advancedAnalysis.trend === 'HAUSSIERE' ? 'text-crypto-green' : 
              advancedAnalysis.trend === 'BAISSIERE' ? 'text-crypto-red' : 'text-gray-400'
            }`}>
              {advancedAnalysis.trend} ({advancedAnalysis.trendStrength}%)
            </span>
          </div>
          
          {/* Patterns */}
          {advancedAnalysis.candlePatterns.length > 0 && (
            <div className="mb-2">
              <span className="text-sm text-gray-400">Patterns:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {advancedAnalysis.candlePatterns.map((p, i) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded ${
                    p.type === 'bullish' ? 'bg-crypto-green/20 text-crypto-green' :
                    p.type === 'bearish' ? 'bg-crypto-red/20 text-crypto-red' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Indicators */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-gray-500">RSI:</span>
              <div className="font-mono">{advancedAnalysis.indicators.rsi?.toFixed(1) || 'N/A'}</div>
            </div>
            <div>
              <span className="text-gray-500">Vol:</span>
              <div className="font-mono">{advancedAnalysis.indicators.volatility}</div>
            </div>
            <div>
              <span className="text-gray-500">Vol Trend:</span>
              <div className="font-mono">{advancedAnalysis.indicators.volumeTrend}</div>
            </div>
          </div>
          
          {/* Setup */}
          {advancedAnalysis.setup.direction !== 'NEUTRAL' && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Setup {advancedAnalysis.setup.direction}</span>
                <span className={`text-sm font-bold ${
                  advancedAnalysis.setup.confidence > 60 ? 'text-crypto-green' : 'text-yellow-500'
                }`}>
                  {advancedAnalysis.setup.confidence}% confiance
                </span>
              </div>
              {advancedAnalysis.setup.riskReward && (
                <div className="text-xs text-gray-400 mb-2">
                  Risk/Reward: 1:{advancedAnalysis.setup.riskReward.toFixed(1)}
                </div>
              )}
              <div className="text-xs space-y-1">
                {advancedAnalysis.setup.confirmations.slice(0, 3).map((c, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-crypto-green">✓</span>
                    <span className="text-gray-300">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Explanation */}
      <div className="bg-crypto-dark rounded-lg p-3">
        <div className="text-sm text-gray-400 mb-2">Analyse IA:</div>
        <div className="text-sm text-white leading-relaxed">
          {signal.explanation || 'Analyse basée sur les indicateurs techniques'}
        </div>
        {signal.pattern && (
          <div className="mt-2 text-sm">
            <span className="text-crypto-purple">Pattern détecté:</span>{' '}
            <span className="text-white">{signal.pattern}</span>
          </div>
        )}
      </div>
    </div>
  );
}
