/**
 * Ethernal Technical Analysis Service
 * Analyse professionnelle pour trading décisionnel
 */

import { getKlines, CandleData } from './chartApi';

interface TechnicalAnalysis {
  symbol: string;
  timestamp: number;
  trend: {
    direction: 'UP' | 'DOWN' | 'SIDEWAYS';
    strength: number; // 0-100
    timeframes: Record<string, string>;
  };
  indicators: {
    rsi: number;
    rsiSignal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
    sma20: number;
    sma50: number;
    smaSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    atr: number;
    volatility: number;
  };
  levels: {
    support: number[];
    resistance: number[];
    pivot: number;
  };
  volume: {
    trend: 'HIGH' | 'NORMAL' | 'LOW';
    ratio: number;
  };
  signal: {
    direction: 'LONG' | 'SHORT' | 'WAIT';
    entry: number;
    stopLoss: number;
    takeProfit: number;
    riskReward: number;
    confidence: number;
    reasoning: string;
  };
}

// Calcul RSI
function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calcul SMA
function calculateSMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;
  const sum = data.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

// Calcul ATR
function calculateATR(candles: { high: number; low: number; close: number }[], period = 14): number {
  if (candles.length < period) return 0;
  
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1]?.close || 0),
      Math.abs(candles[i].low - candles[i - 1]?.close || 0)
    );
    sum += tr;
  }
  return sum / period;
}

// Identifier supports et résistances
function findKeyLevels(candles: CandleData[]): { support: number[]; resistance: number[] } {
  const highs = candles.map((c: CandleData) => c.high);
  const lows = candles.map((c: CandleData) => c.low);
  
  // Trouver les niveaux récents
  const recentHighs = highs.slice(-20);
  const recentLows = lows.slice(-20);
  
  const resistance = [Math.max(...recentHighs)];
  const support = [Math.min(...recentLows)];
  
  return { support, resistance };
}

// Analyser la tendance multi-timeframe
async function analyzeMultiTimeframe(symbol: string): Promise<Record<string, string>> {
  const timeframes = ['15m', '1h', '4h', '1d'];
  const results: Record<string, string> = {};
  
  for (const tf of timeframes) {
    try {
      const klines = await getKlines(symbol, tf, 50);
      if (klines.length >= 20) {
        const closes = klines.map((k: CandleData) => k.close);
        const sma20 = calculateSMA(closes, 20);
        const lastClose = closes[closes.length - 1];
        
        if (lastClose > sma20 * 1.02) results[tf] = 'BULLISH';
        else if (lastClose < sma20 * 0.98) results[tf] = 'BEARISH';
        else results[tf] = 'NEUTRAL';
      }
    } catch (e) {
      results[tf] = 'UNKNOWN';
    }
  }
  
  return results;
}

// Analyse complète
export async function analyzeWithEthernal(symbol: string): Promise<TechnicalAnalysis | null> {
  try {
    // Récupérer données 1h par défaut
    const candles = await getKlines(symbol, '1h', 100);
    
    if (candles.length < 50) {
      console.log('Pas assez de données pour analyse Ethernal');
      return null;
    }
    
    const closes = candles.map(c => c.close);
    const currentPrice = closes[closes.length - 1];
    
    // Calculs indicateurs
    const rsi = calculateRSI(closes, 14);
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const atr = calculateATR(candles, 14);
    
    // Tendance
    const isAboveSMA20 = currentPrice > sma20;
    const isAboveSMA50 = currentPrice > sma50;
    const sma20Above50 = sma20 > sma50;
    
    // Volume
    const volumes = candles.map(c => c.volume || 0).filter(v => v > 0);
    const avgVolume = volumes.length > 0 ? calculateSMA(volumes, 20) : 0;
    const lastVolume = volumes.length > 0 ? volumes[volumes.length - 1] : 0;
    const volumeRatio = avgVolume > 0 ? lastVolume / avgVolume : 1;
    
    // Niveaux clés
    const levels = findKeyLevels(candles);
    
    // Analyse multi-timeframe
    const tfAnalysis = await analyzeMultiTimeframe(symbol);
    
    // Déterminer direction globale
    let trendDirection: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
    let trendStrength = 50;
    
    const bullishCount = Object.values(tfAnalysis).filter(v => v === 'BULLISH').length;
    const bearishCount = Object.values(tfAnalysis).filter(v => v === 'BEARISH').length;
    
    if (bullishCount >= 3) {
      trendDirection = 'UP';
      trendStrength = 60 + (bullishCount * 10);
    } else if (bearishCount >= 3) {
      trendDirection = 'DOWN';
      trendStrength = 60 + (bearishCount * 10);
    }
    
    // Générer signal
    let signal: TechnicalAnalysis['signal'] = {
      direction: 'WAIT',
      entry: currentPrice,
      stopLoss: currentPrice * 0.97,
      takeProfit: currentPrice * 1.06,
      riskReward: 2,
      confidence: 50,
      reasoning: 'Marché indécis'
    };
    
    // Logique de signal avancée
    if (trendDirection === 'UP' && isAboveSMA20 && isAboveSMA50 && rsi > 40 && rsi < 70) {
      const stopDistance = atr * 2;
      const targetDistance = atr * 4;
      
      signal = {
        direction: 'LONG',
        entry: currentPrice,
        stopLoss: currentPrice - stopDistance,
        takeProfit: currentPrice + targetDistance,
        riskReward: targetDistance / stopDistance,
        confidence: Math.min(85, 55 + trendStrength * 0.3),
        reasoning: `Tendance haussière confirmée sur ${bullishCount}/4 timeframes. RSI: ${rsi.toFixed(1)}, prix au-dessus des moyennes mobiles. Volume: ${volumeRatio > 1.5 ? 'élevé' : 'normal'}.`
      };
    } else if (trendDirection === 'DOWN' && !isAboveSMA20 && !isAboveSMA50 && rsi < 60 && rsi > 30) {
      const stopDistance = atr * 2;
      const targetDistance = atr * 4;
      
      signal = {
        direction: 'SHORT',
        entry: currentPrice,
        stopLoss: currentPrice + stopDistance,
        takeProfit: currentPrice - targetDistance,
        riskReward: targetDistance / stopDistance,
        confidence: Math.min(85, 55 + trendStrength * 0.3),
        reasoning: `Tendance baissière confirmée sur ${bearishCount}/4 timeframes. RSI: ${rsi.toFixed(1)}, prix sous les moyennes mobiles.`
      };
    }
    
    return {
      symbol,
      timestamp: Date.now(),
      trend: {
        direction: trendDirection,
        strength: trendStrength,
        timeframes: tfAnalysis
      },
      indicators: {
        rsi,
        rsiSignal: rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL',
        sma20,
        sma50,
        smaSignal: sma20Above50 ? 'BULLISH' : 'BEARISH',
        atr,
        volatility: (atr / currentPrice) * 100
      },
      levels: {
        support: levels.support,
        resistance: levels.resistance,
        pivot: (levels.support[0] + levels.resistance[0]) / 2
      },
      volume: {
        trend: volumeRatio > 1.5 ? 'HIGH' : volumeRatio < 0.7 ? 'LOW' : 'NORMAL',
        ratio: volumeRatio
      },
      signal
    };
    
  } catch (error) {
    console.error('Erreur analyse Ethernal:', error);
    return null;
  }
}

// Formater l'analyse pour affichage
export function formatEthernalAnalysis(analysis: TechnicalAnalysis): string {
  const { signal, indicators, trend, levels, volume } = analysis;
  
  return `
🎯 **SETUP ETHERNAL** - ${analysis.symbol}

📈 **SIGNAL: ${signal.direction}** | Confiance: ${signal.confidence.toFixed(0)}%

💰 **Niveaux:**
• Entry: $${signal.entry.toFixed(2)}
• Stop Loss: $${signal.stopLoss.toFixed(2)}
• Take Profit: $${signal.takeProfit.toFixed(2)}
• R:R = 1:${signal.riskReward.toFixed(2)}

📊 **Indicateurs:**
• RSI(14): ${indicators.rsi.toFixed(1)} ${indicators.rsiSignal === 'OVERBOUGHT' ? '🔴' : indicators.rsiSignal === 'OVERSOLD' ? '🟢' : '⚪'}
• Tendance: ${trend.direction} (${trend.strength.toFixed(0)}%)
• Volatilité: ${indicators.volatility.toFixed(2)}%
• Volume: ${volume.trend} (${volume.ratio.toFixed(1)}x)

🎯 **Niveaux Clés:**
• Support: $${levels.support[0]?.toFixed(2) || 'N/A'}
• Résistance: $${levels.resistance[0]?.toFixed(2) || 'N/A'}

💡 **Analyse:** ${signal.reasoning}
`;
}
