import type { CandleData } from '../types';

// Simple Moving Average (SMA)
export function calculateSMA(data: CandleData[], period: number): (number | null)[] {
  const sma: (number | null)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
      continue;
    }
    
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    sma.push(sum / period);
  }
  
  return sma;
}

// Exponential Moving Average (EMA)
export function calculateEMA(data: CandleData[], period: number): (number | null)[] {
  const ema: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ema.push(null);
      continue;
    }
    
    if (i === period - 1) {
      // First EMA is SMA
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      ema.push(sum / period);
    } else {
      const prevEMA = ema[i - 1]!;
      ema.push((data[i].close - prevEMA) * multiplier + prevEMA);
    }
  }
  
  return ema;
}

// RSI (Relative Strength Index)
export function calculateRSI(data: CandleData[], period: number = 14): (number | null)[] {
  const rsi: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      rsi.push(null);
      continue;
    }
    
    const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  
  return rsi;
}

// MACD
export function calculateMACD(
  data: CandleData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  const macd: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macd.push(null);
    } else {
      macd.push(fastEMA[i]! - slowEMA[i]!);
    }
  }
  
  // Calculate signal line (EMA of MACD)
  const signal: (number | null)[] = [];
  const multiplier = 2 / (signalPeriod + 1);
  
  let firstSignalIndex = -1;
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] !== null && firstSignalIndex === -1) {
      firstSignalIndex = i;
    }
    
    if (i < firstSignalIndex + signalPeriod - 1 || macd[i] === null) {
      signal.push(null);
      continue;
    }
    
    if (i === firstSignalIndex + signalPeriod - 1) {
      let sum = 0;
      for (let j = 0; j < signalPeriod; j++) {
        sum += macd[i - j]!;
      }
      signal.push(sum / signalPeriod);
    } else {
      const prevSignal = signal[i - 1]!;
      signal.push((macd[i]! - prevSignal) * multiplier + prevSignal);
    }
  }
  
  // Calculate histogram
  const histogram: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (macd[i] === null || signal[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(macd[i]! - signal[i]!);
    }
  }
  
  return { macd, signal, histogram };
}

// Bollinger Bands
export function calculateBollingerBands(
  data: CandleData[],
  period: number = 20,
  stdDev: number = 2
): { middle: (number | null)[]; upper: (number | null)[]; lower: (number | null)[] } {
  const middle = calculateSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (middle[i] === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    
    // Calculate standard deviation
    let sumSquaredDiff = 0;
    for (let j = 0; j < period; j++) {
      const diff = data[i - j].close - middle[i]!;
      sumSquaredDiff += diff * diff;
    }
    const stdDeviation = Math.sqrt(sumSquaredDiff / period);
    
    upper.push(middle[i]! + stdDeviation * stdDev);
    lower.push(middle[i]! - stdDeviation * stdDev);
  }
  
  return { middle, upper, lower };
}

// ATR (Average True Range)
export function calculateATR(data: CandleData[], period: number = 14): (number | null)[] {
  const atr: (number | null)[] = [];
  const trueRanges: number[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const tr1 = data[i].high - data[i].low;
    const tr2 = Math.abs(data[i].high - data[i - 1].close);
    const tr3 = Math.abs(data[i].low - data[i - 1].close);
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      atr.push(null);
      continue;
    }
    
    if (i <= period) {
      atr.push(null);
      continue;
    }
    
    const avgTR = trueRanges.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    atr.push(avgTR);
  }
  
  return atr;
}

// Stochastic Oscillator
export function calculateStochastic(
  data: CandleData[],
  kPeriod: number = 14,
  dPeriod: number = 3
): { k: (number | null)[]; d: (number | null)[] } {
  const k: (number | null)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < kPeriod - 1) {
      k.push(null);
      continue;
    }
    
    let lowestLow = data[i].low;
    let highestHigh = data[i].high;
    
    for (let j = 0; j < kPeriod; j++) {
      lowestLow = Math.min(lowestLow, data[i - j].low);
      highestHigh = Math.max(highestHigh, data[i - j].high);
    }
    
    const range = highestHigh - lowestLow;
    if (range === 0) {
      k.push(50);
    } else {
      k.push(((data[i].close - lowestLow) / range) * 100);
    }
  }
  
  // Calculate %D (SMA of %K)
  const d: (number | null)[] = [];
  for (let i = 0; i < k.length; i++) {
    if (i < kPeriod - 1 + dPeriod - 1) {
      d.push(null);
      continue;
    }
    
    let sum = 0;
    for (let j = 0; j < dPeriod; j++) {
      sum += k[i - j]!;
    }
    d.push(sum / dPeriod);
  }
  
  return { k, d };
}

// VWAP (Volume Weighted Average Price)
export function calculateVWAP(data: CandleData[]): (number | null)[] {
  const vwap: (number | null)[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  
  for (let i = 0; i < data.length; i++) {
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
    const tpv = typicalPrice * data[i].volume;
    
    cumulativeTPV += tpv;
    cumulativeVolume += data[i].volume;
    
    if (cumulativeVolume === 0) {
      vwap.push(null);
    } else {
      vwap.push(cumulativeTPV / cumulativeVolume);
    }
  }
  
  return vwap;
}
