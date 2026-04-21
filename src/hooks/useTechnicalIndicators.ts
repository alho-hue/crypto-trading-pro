/**
 * 📊 Hook useTechnicalIndicators - Optimisé
 * Calcul des indicateurs techniques avec cache intelligent
 * - Recalcul uniquement sur nouvelles bougies
 * - Cache par symbole et timeframe
 * - Détection automatique de nouvelles données
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { CandleData } from '../stores/marketStore';

// Types
interface RSIResult {
  value: number;
  overbought: boolean;
  oversold: boolean;
}

interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  bullish: boolean;
}

interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  width: number;
  position: number; // 0-1, où 0 = bas, 1 = haut
}

interface ATRResult {
  value: number;
  stopLoss: number;
}

interface IndicatorsResult {
  rsi: RSIResult;
  macd: MACDResult;
  ema20: number;
  ema50: number;
  bollinger: BollingerResult;
  atr: ATRResult;
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100
}

// Cache global pour éviter recalculs
interface CacheKey {
  symbol: string;
  timeframe: string;
  lastCandleTime: number;
}

interface CacheEntry {
  key: CacheKey;
  result: IndicatorsResult;
  timestamp: number;
}

const globalCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Nettoyage périodique du cache
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of globalCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      globalCache.delete(key);
    }
  }
}, 60000); // Nettoyage toutes les minutes

/**
 * 🧮 Calcul RSI optimisé
 */
function calculateRSI(closes: number[], period: number = 14): RSIResult {
  if (closes.length < period + 1) {
    return { value: 50, overbought: false, oversold: false };
  }

  let gains = 0;
  let losses = 0;

  // Calcul initial
  for (let i = 1; i <= period; i++) {
    const change = closes[closes.length - i] - closes[closes.length - i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Lissage
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = ((avgGain * (period - 1)) + (change > 0 ? change : 0)) / period;
    avgLoss = ((avgLoss * (period - 1)) + (change < 0 ? -change : 0)) / period;
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const value = 100 - (100 / (1 + rs));

  return {
    value: Math.round(value * 100) / 100,
    overbought: value > 70,
    oversold: value < 30
  };
}

/**
 * 🧮 Calcul MACD optimisé
 */
function calculateMACD(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): MACDResult {
  if (closes.length < slow + signal) {
    return { macd: 0, signal: 0, histogram: 0, bullish: false };
  }

  const ema = (data: number[], period: number): number[] => {
    const multiplier = 2 / (period + 1);
    const result: number[] = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      result[i] = (data[i] - result[i - 1]) * multiplier + result[i - 1];
    }
    return result;
  };

  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);

  // MACD Line
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine[i] = emaFast[i] - emaSlow[i];
  }

  // Signal Line
  const signalLine = ema(macdLine.slice(slow - 1), signal);

  const currentMACD = macdLine[macdLine.length - 1];
  const currentSignal = signalLine[signalLine.length - 1];
  const histogram = currentMACD - currentSignal;

  return {
    macd: Math.round(currentMACD * 100) / 100,
    signal: Math.round(currentSignal * 100) / 100,
    histogram: Math.round(histogram * 100) / 100,
    bullish: histogram > 0 && histogram > (macdLine[macdLine.length - 2] - signalLine[signalLine.length - 2])
  };
}

/**
 * 🧮 Calcul EMA
 */
function calculateEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0;

  const multiplier = 2 / (period + 1);
  let ema = closes[0];

  for (let i = 1; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
  }

  return Math.round(ema * 100) / 100;
}

/**
 * 🧮 Calcul Bollinger Bands
 */
function calculateBollinger(closes: number[], period: number = 20, stdDev: number = 2): BollingerResult {
  if (closes.length < period) {
    const last = closes[closes.length - 1] || 0;
    return { upper: last * 1.02, middle: last, lower: last * 0.98, width: 4, position: 0.5 };
  }

  const recent = closes.slice(-period);
  const sma = recent.reduce((a, b) => a + b, 0) / period;
  
  const variance = recent.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
  const std = Math.sqrt(variance);

  const upper = sma + (std * stdDev);
  const lower = sma - (std * stdDev);
  const lastPrice = closes[closes.length - 1];
  const position = (lastPrice - lower) / (upper - lower);

  return {
    upper: Math.round(upper * 100) / 100,
    middle: Math.round(sma * 100) / 100,
    lower: Math.round(lower * 100) / 100,
    width: Math.round(((upper - lower) / sma) * 10000) / 100, // %
    position: Math.max(0, Math.min(1, position))
  };
}

/**
 * 🧮 Calcul ATR (Average True Range)
 */
function calculateATR(candles: CandleData[], period: number = 14): ATRResult {
  if (candles.length < period + 1) {
    return { value: 0, stopLoss: 0 };
  }

  const trValues: number[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trValues.push(tr);
  }

  // Simple moving average des TR
  const recentTR = trValues.slice(-period);
  const atr = recentTR.reduce((a, b) => a + b, 0) / period;
  const lastClose = candles[candles.length - 1].close;

  return {
    value: Math.round(atr * 100) / 100,
    stopLoss: Math.round((lastClose - atr * 2) * 100) / 100
  };
}

/**
 * 🎯 Hook principal optimisé
 */
export function useTechnicalIndicators(
  candles: CandleData[],
  symbol: string,
  timeframe: string
): {
  indicators: IndicatorsResult | null;
  isCalculating: boolean;
  lastUpdate: number;
} {
  const [isCalculating, setIsCalculating] = useState(false);
  const lastCandlesRef = useRef<CandleData[]>([]);

  // Détecter si de nouvelles bougies sont ajoutées
  const hasNewData = useMemo(() => {
    if (candles.length === 0) return false;
    if (lastCandlesRef.current.length === 0) return true;
    
    const lastCandle = candles[candles.length - 1];
    const prevLastCandle = lastCandlesRef.current[lastCandlesRef.current.length - 1];
    
    return lastCandle.time !== prevLastCandle.time || candles.length !== lastCandlesRef.current.length;
  }, [candles]);

  // Calcul des indicateurs avec cache
  const indicators = useMemo(() => {
    if (candles.length < 50) return null;

    setIsCalculating(true);

    // Clé de cache
    const lastCandle = candles[candles.length - 1];
    const cacheKey = `${symbol}-${timeframe}-${lastCandle.time}`;
    
    // Vérifier cache
    const cached = globalCache.get(cacheKey);
    if (cached) {
      setIsCalculating(false);
      return cached.result;
    }

    // Calculs
    const closes = candles.map(c => c.close);
    
    const rsi = calculateRSI(closes, 14);
    const macd = calculateMACD(closes, 12, 26, 9);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const bollinger = calculateBollinger(closes, 20, 2);
    const atr = calculateATR(candles, 14);

    // Déterminer tendance
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let strength = 50;

    if (ema20 > ema50 && closes[closes.length - 1] > ema20) {
      trend = 'bullish';
      strength = 50 + (rsi.value > 50 ? rsi.value - 50 : 0) + (macd.histogram > 0 ? 10 : 0);
    } else if (ema20 < ema50 && closes[closes.length - 1] < ema20) {
      trend = 'bearish';
      strength = 50 + (rsi.value < 50 ? 50 - rsi.value : 0) + (macd.histogram < 0 ? 10 : 0);
    }

    strength = Math.min(100, Math.max(0, strength));

    const result: IndicatorsResult = {
      rsi,
      macd,
      ema20,
      ema50,
      bollinger,
      atr,
      trend,
      strength
    };

    // Mettre en cache
    globalCache.set(cacheKey, {
      key: { symbol, timeframe, lastCandleTime: lastCandle.time },
      result,
      timestamp: Date.now()
    });

    // Mettre à jour la référence
    lastCandlesRef.current = candles;

    setIsCalculating(false);
    return result;
  }, [candles, symbol, timeframe, hasNewData]);

  return {
    indicators,
    isCalculating,
    lastUpdate: Date.now()
  };
}

/**
 * 🎯 Hook pour un seul indicateur (plus léger)
 */
export function useRSI(candles: CandleData[], period: number = 14): number {
  return useMemo(() => {
    if (candles.length < period + 1) return 50;
    const closes = candles.map(c => c.close);
    return calculateRSI(closes, period).value;
  }, [candles, period]);
}

export function useEMA(candles: CandleData[], period: number): number {
  return useMemo(() => {
    if (candles.length < period) return 0;
    const closes = candles.map(c => c.close);
    return calculateEMA(closes, period);
  }, [candles, period]);
}

/**
 * 🧹 Fonction de nettoyage du cache (appel manuel si nécessaire)
 */
export function clearIndicatorsCache(): void {
  globalCache.clear();
  console.log('[useTechnicalIndicators] Cache cleared');
}

export function getIndicatorsCacheSize(): number {
  return globalCache.size;
}
