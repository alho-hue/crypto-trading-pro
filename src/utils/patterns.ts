import type { CandleData } from '../types';

export interface Pattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  index: number;
}

// Check if a candle is bullish
function isBullish(candle: CandleData): boolean {
  return candle.close > candle.open;
}

// Check if a candle is bearish
function isBearish(candle: CandleData): boolean {
  return candle.close < candle.open;
}

// Get candle body size
function getBodySize(candle: CandleData): number {
  return Math.abs(candle.close - candle.open);
}

// Get upper wick size
function getUpperWick(candle: CandleData): number {
  return candle.high - Math.max(candle.open, candle.close);
}

// Get lower wick size
function getLowerWick(candle: CandleData): number {
  return Math.min(candle.open, candle.close) - candle.low;
}

// Get total candle range
function getRange(candle: CandleData): number {
  return candle.high - candle.low;
}

// Hammer pattern (bullish reversal)
export function detectHammer(data: CandleData[], index: number): Pattern | null {
  if (index < 1) return null;
  
  const candle = data[index];
  const bodySize = getBodySize(candle);
  const lowerWick = getLowerWick(candle);
  const upperWick = getUpperWick(candle);
  const range = getRange(candle);
  
  // Hammer conditions:
  // - Small body at the top of the trading range
  // - Long lower wick (at least 2x body)
  // - Little to no upper wick
  if (bodySize <= range * 0.3 && 
      lowerWick >= bodySize * 2 && 
      upperWick <= bodySize * 0.1) {
    return {
      name: 'Hammer',
      type: 'bullish',
      confidence: 75,
      index,
    };
  }
  
  return null;
}

// Shooting Star pattern (bearish reversal)
export function detectShootingStar(data: CandleData[], index: number): Pattern | null {
  if (index < 1) return null;
  
  const candle = data[index];
  const bodySize = getBodySize(candle);
  const lowerWick = getLowerWick(candle);
  const upperWick = getUpperWick(candle);
  const range = getRange(candle);
  
  // Shooting Star conditions:
  // - Small body at the bottom of the trading range
  // - Long upper wick (at least 2x body)
  // - Little to no lower wick
  if (bodySize <= range * 0.3 && 
      upperWick >= bodySize * 2 && 
      lowerWick <= bodySize * 0.1) {
    return {
      name: 'Shooting Star',
      type: 'bearish',
      confidence: 75,
      index,
    };
  }
  
  return null;
}

// Bullish Engulfing pattern
export function detectBullishEngulfing(data: CandleData[], index: number): Pattern | null {
  if (index < 1) return null;
  
  const current = data[index];
  const previous = data[index - 1];
  
  // Bullish Engulfing conditions:
  // - Previous candle is bearish
  // - Current candle is bullish
  // - Current candle's body completely engulfs previous candle's body
  if (isBearish(previous) && isBullish(current) &&
      current.open < previous.close &&
      current.close > previous.open) {
    return {
      name: 'Bullish Engulfing',
      type: 'bullish',
      confidence: 80,
      index,
    };
  }
  
  return null;
}

// Bearish Engulfing pattern
export function detectBearishEngulfing(data: CandleData[], index: number): Pattern | null {
  if (index < 1) return null;
  
  const current = data[index];
  const previous = data[index - 1];
  
  // Bearish Engulfing conditions:
  // - Previous candle is bullish
  // - Current candle is bearish
  // - Current candle's body completely engulfs previous candle's body
  if (isBullish(previous) && isBearish(current) &&
      current.close < previous.open &&
      current.open > previous.close) {
    return {
      name: 'Bearish Engulfing',
      type: 'bearish',
      confidence: 80,
      index,
    };
  }
  
  return null;
}

// Doji pattern (indecision)
export function detectDoji(data: CandleData[], index: number): Pattern | null {
  const candle = data[index];
  const bodySize = getBodySize(candle);
  const range = getRange(candle);
  
  // Doji conditions:
  // - Very small body (open and close nearly equal)
  // - Body is less than 10% of total range
  if (bodySize <= range * 0.1) {
    return {
      name: 'Doji',
      type: 'neutral',
      confidence: 60,
      index,
    };
  }
  
  return null;
}

// Morning Star pattern (bullish reversal)
export function detectMorningStar(data: CandleData[], index: number): Pattern | null {
  if (index < 2) return null;
  
  const first = data[index - 2];
  const second = data[index - 1];
  const third = data[index];
  
  const secondBodySize = getBodySize(second);
  const firstBodySize = getBodySize(first);
  
  // Morning Star conditions:
  // - First candle is bearish with large body
  // - Second candle is small (indecision)
  // - Third candle is bullish with body closing into first candle's body
  if (isBearish(first) && firstBodySize > getRange(first) * 0.5 &&
      secondBodySize < getRange(second) * 0.3 &&
      isBullish(third) &&
      third.close > (first.open + first.close) / 2) {
    return {
      name: 'Morning Star',
      type: 'bullish',
      confidence: 85,
      index,
    };
  }
  
  return null;
}

// Evening Star pattern (bearish reversal)
export function detectEveningStar(data: CandleData[], index: number): Pattern | null {
  if (index < 2) return null;
  
  const first = data[index - 2];
  const second = data[index - 1];
  const third = data[index];
  
  const secondBodySize = getBodySize(second);
  const firstBodySize = getBodySize(first);
  
  // Evening Star conditions:
  // - First candle is bullish with large body
  // - Second candle is small (indecision)
  // - Third candle is bearish with body closing into first candle's body
  if (isBullish(first) && firstBodySize > getRange(first) * 0.5 &&
      secondBodySize < getRange(second) * 0.3 &&
      isBearish(third) &&
      third.close < (first.open + first.close) / 2) {
    return {
      name: 'Evening Star',
      type: 'bearish',
      confidence: 85,
      index,
    };
  }
  
  return null;
}

// Detect all patterns in the data
export function detectAllPatterns(data: CandleData[]): Pattern[] {
  const patterns: Pattern[] = [];
  
  for (let i = 2; i < data.length; i++) {
    const hammer = detectHammer(data, i);
    if (hammer) patterns.push(hammer);
    
    const shootingStar = detectShootingStar(data, i);
    if (shootingStar) patterns.push(shootingStar);
    
    const bullishEngulfing = detectBullishEngulfing(data, i);
    if (bullishEngulfing) patterns.push(bullishEngulfing);
    
    const bearishEngulfing = detectBearishEngulfing(data, i);
    if (bearishEngulfing) patterns.push(bearishEngulfing);
    
    const doji = detectDoji(data, i);
    if (doji) patterns.push(doji);
    
    const morningStar = detectMorningStar(data, i);
    if (morningStar) patterns.push(morningStar);
    
    const eveningStar = detectEveningStar(data, i);
    if (eveningStar) patterns.push(eveningStar);
  }
  
  return patterns;
}

// Get the latest pattern for the last candle
export function getLatestPattern(data: CandleData[]): Pattern | null {
  if (data.length < 3) return null;
  
  const lastIndex = data.length - 1;
  
  const patterns = [
    detectHammer(data, lastIndex),
    detectShootingStar(data, lastIndex),
    detectBullishEngulfing(data, lastIndex),
    detectBearishEngulfing(data, lastIndex),
    detectDoji(data, lastIndex),
    detectMorningStar(data, lastIndex),
    detectEveningStar(data, lastIndex),
  ].filter(Boolean);
  
  // Return the pattern with highest confidence
  return patterns.length > 0 
    ? patterns.sort((a, b) => b!.confidence - a!.confidence)[0] 
    : null;
}
