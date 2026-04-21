// Service d'Analyse Technique pour Ethernal IA
// Calcul tous les indicateurs techniques nécessaires pour l'analyse de trading

class TechnicalAnalysis {
  // Calculer RSI (Relative Strength Index)
  calculateRSI(candles, period = 14) {
    if (!candles || candles.length < period + 1) {
      return { rsi: 50, signal: 'neutral' };
    }

    let gains = 0;
    let losses = 0;

    // Calculer les gains/pertes initiaux
    for (let i = 1; i <= period; i++) {
      const change = candles[i].close - candles[i - 1].close;
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Calculer le RSI pour chaque bougie
    for (let i = period + 1; i < candles.length; i++) {
      const change = candles[i].close - candles[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      avgGain = ((avgGain * (period - 1)) + gain) / period;
      avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    }

    if (avgLoss === 0) {
      return { rsi: 100, signal: 'strongly_overbought' };
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    let signal = 'neutral';
    if (rsi >= 70) signal = 'overbought';
    if (rsi >= 80) signal = 'strongly_overbought';
    if (rsi <= 30) signal = 'oversold';
    if (rsi <= 20) signal = 'strongly_oversold';

    return { rsi: parseFloat(rsi.toFixed(2)), signal };
  }

  // Calculer MACD (Moving Average Convergence Divergence)
  calculateMACD(candles, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (!candles || candles.length < slowPeriod + signalPeriod) {
      return { macd: 0, signal: 0, histogram: 0, signal: 'neutral' };
    }

    const closes = candles.map(c => c.close);
    
    // Calculer les EMA
    const emaFast = this.calculateEMA(closes, fastPeriod);
    const emaSlow = this.calculateEMA(closes, slowPeriod);
    
    // MACD line
    const macdLine = emaFast - emaSlow;
    
    // Signal line (EMA of MACD)
    const macdValues = [];
    for (let i = slowPeriod - 1; i < candles.length; i++) {
      const fastEMA = this.calculateEMA(closes.slice(0, i + 1), fastPeriod);
      const slowEMA = this.calculateEMA(closes.slice(0, i + 1), slowPeriod);
      macdValues.push(fastEMA - slowEMA);
    }
    
    const signalLine = this.calculateEMA(macdValues, signalPeriod);
    const histogram = macdLine - signalLine;

    let signal = 'neutral';
    if (histogram > 0) signal = 'bullish';
    if (histogram < 0) signal = 'bearish';
    if (macdLine > signalLine && histogram > 0) signal = 'strong_bullish';
    if (macdLine < signalLine && histogram < 0) signal = 'strong_bearish';

    return {
      macd: parseFloat(macdLine.toFixed(4)),
      signal: parseFloat(signalLine.toFixed(4)),
      histogram: parseFloat(histogram.toFixed(4)),
      signal
    };
  }

  // Calculer EMA (Exponential Moving Average)
  calculateEMA(data, period) {
    if (!data || data.length < period) return data[data.length - 1] || 0;

    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < data.length; i++) {
      ema = (data[i] * k) + (ema * (1 - k));
    }

    return ema;
  }

  // Calculer SMA (Simple Moving Average)
  calculateSMA(data, period) {
    if (!data || data.length < period) return data[data.length - 1] || 0;

    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  // Calculer Bollinger Bands
  calculateBollingerBands(candles, period = 20, stdDev = 2) {
    if (!candles || candles.length < period) {
      const price = candles[candles.length - 1]?.close || 0;
      return {
        upper: price * 1.02,
        middle: price,
        lower: price * 0.98,
        bandwidth: 2,
        signal: 'neutral'
      };
    }

    const closes = candles.slice(-period).map(c => c.close);
    const sma = this.calculateSMA(closes, period);
    
    // Calculer l'écart-type
    const squaredDiffs = closes.map(close => Math.pow(close - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    const upper = sma + (standardDeviation * stdDev);
    const lower = sma - (standardDeviation * stdDev);
    const bandwidth = ((upper - lower) / sma) * 100;

    const currentPrice = candles[candles.length - 1].close;
    let signal = 'neutral';
    if (currentPrice >= upper) signal = 'overbought';
    if (currentPrice <= lower) signal = 'oversold';
    if (currentPrice > sma && currentPrice < upper) signal = 'bullish';
    if (currentPrice < sma && currentPrice > lower) signal = 'bearish';

    return {
      upper: parseFloat(upper.toFixed(2)),
      middle: parseFloat(sma.toFixed(2)),
      lower: parseFloat(lower.toFixed(2)),
      bandwidth: parseFloat(bandwidth.toFixed(2)),
      signal
    };
  }

  // Calculer ATR (Average True Range) - pour la volatilité
  calculateATR(candles, period = 14) {
    if (!candles || candles.length < period + 1) {
      return { atr: 0, volatility: 'low' };
    }

    const trueRanges = [];
    
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      
      trueRanges.push(tr);
    }

    const atr = this.calculateSMA(trueRanges.slice(-period), period);
    
    let volatility = 'low';
    if (atr > candles[candles.length - 1].close * 0.02) volatility = 'medium';
    if (atr > candles[candles.length - 1].close * 0.04) volatility = 'high';

    return {
      atr: parseFloat(atr.toFixed(2)),
      volatility
    };
  }

  // Calculer Stochastic Oscillator
  calculateStochastic(candles, kPeriod = 14, dPeriod = 3) {
    if (!candles || candles.length < kPeriod + dPeriod) {
      return { k: 50, d: 50, signal: 'neutral' };
    }

    const recentCandles = candles.slice(-kPeriod);
    const highHigh = Math.max(...recentCandles.map(c => c.high));
    const lowLow = Math.min(...recentCandles.map(c => c.low));
    const currentClose = candles[candles.length - 1].close;

    const k = ((currentClose - lowLow) / (highHigh - lowLow)) * 100;
    
    // Pour le D, on aurait besoin de calculer les K précédents
    // Simplification pour l'instant
    const d = k;

    let signal = 'neutral';
    if (k >= 80) signal = 'overbought';
    if (k <= 20) signal = 'oversold';
    if (k > d && k < 80) signal = 'bullish';
    if (k < d && k > 20) signal = 'bearish';

    return {
      k: parseFloat(k.toFixed(2)),
      d: parseFloat(d.toFixed(2)),
      signal
    };
  }

  // Calculer tous les indicateurs pour une analyse complète
  calculateAllIndicators(candles) {
    return {
      rsi: this.calculateRSI(candles),
      macd: this.calculateMACD(candles),
      bollinger: this.calculateBollingerBands(candles),
      atr: this.calculateATR(candles),
      stochastic: this.calculateStochastic(candles),
      sma20: this.calculateSMA(candles.map(c => c.close), 20),
      sma50: this.calculateSMA(candles.map(c => c.close), 50),
      ema12: this.calculateEMA(candles.map(c => c.close), 12),
      ema26: this.calculateEMA(candles.map(c => c.close), 26)
    };
  }

  // Détecter les patterns chartistes basiques
  detectPatterns(candles) {
    const patterns = [];
    const recent = candles.slice(-20);

    // Trend detection
    const trend = this.detectTrend(recent);
    patterns.push({ type: 'trend', value: trend });

    // Support/Resistance
    const levels = this.findSupportResistance(recent);
    patterns.push({ type: 'levels', value: levels });

    // Double Top/Bottom (simplifié)
    const doublePattern = this.detectDoublePattern(recent);
    if (doublePattern) {
      patterns.push(doublePattern);
    }

    return patterns;
  }

  // Détecter la tendance
  detectTrend(candles) {
    const closes = candles.map(c => c.close);
    const sma20 = this.calculateSMA(closes, Math.min(20, closes.length));
    const sma50 = this.calculateSMA(closes, Math.min(50, closes.length));
    const currentPrice = closes[closes.length - 1];

    if (currentPrice > sma20 && sma20 > sma50) {
      return 'strong_uptrend';
    } else if (currentPrice > sma20) {
      return 'uptrend';
    } else if (currentPrice < sma20 && sma20 < sma50) {
      return 'strong_downtrend';
    } else if (currentPrice < sma20) {
      return 'downtrend';
    }
    return 'sideways';
  }

  // Trouver les supports et résistances
  findSupportResistance(candles) {
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    
    const resistance = Math.max(...highs.slice(-10));
    const support = Math.min(...lows.slice(-10));

    return {
      support: parseFloat(support.toFixed(2)),
      resistance: parseFloat(resistance.toFixed(2))
    };
  }

  // Détecter pattern double top/bottom
  detectDoublePattern(candles) {
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    
    // Double Top
    if (highs.length >= 10) {
      const recentHighs = highs.slice(-10);
      const max1 = Math.max(...recentHighs.slice(0, 5));
      const max2 = Math.max(...recentHighs.slice(5));
      
      if (Math.abs(max1 - max2) / max1 < 0.02) {
        return { type: 'double_top', value: max1, confidence: 0.7 };
      }
    }

    // Double Bottom
    if (lows.length >= 10) {
      const recentLows = lows.slice(-10);
      const min1 = Math.min(...recentLows.slice(0, 5));
      const min2 = Math.min(...recentLows.slice(5));
      
      if (Math.abs(min1 - min2) / min1 < 0.02) {
        return { type: 'double_bottom', value: min1, confidence: 0.7 };
      }
    }

    return null;
  }

  // 🔥 ALGORITHME PRO - Détection tendance + filtrage rigoureux
  generateTradingSignal(candles, volumes = []) {
    if (!candles || candles.length < 30) {
      return { direction: 'neutral', confidence: 0, reasoning: 'Insufficient data' };
    }

    const indicators = this.calculateAllIndicators(candles);
    const patterns = this.detectPatterns(candles);
    
    // === NOUVEAU: Analyse Volume ===
    const volumeAnalysis = this.analyzeVolume(candles, volumes);
    
    // === NOUVEAU: Détection marché latéral (Range) ===
    const isRanging = this.detectRangingMarket(candles);
    
    // === NOUVEAU: Force de tendance (ADX-like) ===
    const trendStrength = this.calculateTrendStrength(candles);

    let bullishScore = 0;
    let bearishScore = 0;
    let signalQuality = 0; // Score qualité 0-100

    // 1. RSI - Divergence detection
    const rsiDivergence = this.detectRSIDivergence(candles, indicators.rsi.rsi);
    if (indicators.rsi.signal === 'strongly_oversold' && rsiDivergence === 'bullish') {
      bullishScore += 3; // Divergence haussière = signal fort
      signalQuality += 25;
    } else if (indicators.rsi.signal === 'strongly_overbought' && rsiDivergence === 'bearish') {
      bearishScore += 3;
      signalQuality += 25;
    } else if (indicators.rsi.signal === 'oversold') {
      bullishScore += 1;
      signalQuality += 10;
    } else if (indicators.rsi.signal === 'overbought') {
      bearishScore += 1;
      signalQuality += 10;
    }

    // 2. MACD - Confirmation momentum
    if (indicators.macd.signal === 'strong_bullish' && indicators.macd.histogram > 0) {
      bullishScore += 3;
      signalQuality += 20;
    } else if (indicators.macd.signal === 'strong_bearish' && indicators.macd.histogram < 0) {
      bearishScore += 3;
      signalQuality += 20;
    } else if (indicators.macd.signal === 'bullish') {
      bullishScore += 1;
      signalQuality += 10;
    } else if (indicators.macd.signal === 'bearish') {
      bearishScore += 1;
      signalQuality += 10;
    }

    // 3. Bollinger - Mean reversion or breakout
    const bbPosition = indicators.bollinger.percentB;
    if (bbPosition < 0.05 && indicators.bollinger.signal === 'oversold') {
      bullishScore += 2; // Proche bande inf
      signalQuality += 15;
    } else if (bbPosition > 0.95 && indicators.bollinger.signal === 'overbought') {
      bearishScore += 2; // Proche bande sup
      signalQuality += 15;
    }

    // 4. Trend - ALIGNEMENT STRICT
    const trend = patterns.find(p => p.type === 'trend');
    const trendValue = trend?.value || 'sideways';
    
    // 🔥 FILTRE IMPORTANT: Pas de signal contre-tendance
    if (trendValue === 'strong_uptrend') {
      bullishScore += 2;
      signalQuality += 15;
      bearishScore = Math.max(0, bearishScore - 2); // Pénalise les signaux baissiers
    } else if (trendValue === 'strong_downtrend') {
      bearishScore += 2;
      signalQuality += 15;
      bullishScore = Math.max(0, bullishScore - 2); // Pénalise les signaux haussiers
    } else if (trendValue === 'sideways') {
      // Marché latéral: réduire les scores
      bullishScore = Math.floor(bullishScore * 0.5);
      bearishScore = Math.floor(bearishScore * 0.5);
    }

    // 5. Trend Strength (ADX-like)
    if (trendStrength > 25) {
      signalQuality += 10; // Tendance forte = meilleur signal
    } else if (trendStrength < 15) {
      signalQuality -= 20; // Tendance faible = signal douteux
    }

    // 6. Volume Confirmation
    if (volumeAnalysis.confirmsBullish) {
      bullishScore += 1;
      signalQuality += 10;
    } else if (volumeAnalysis.confirmsBearish) {
      bearishScore += 1;
      signalQuality += 10;
    }

    // === CALCUL DIRECTION & CONFIANCE ===
    const scoreDiff = bullishScore - bearishScore;
    const totalScore = Math.abs(scoreDiff);
    
    // Confiance basée sur qualité du signal et divergence des scores
    let confidence = Math.min(100, (totalScore / 6) * 50 + signalQuality);
    
    // 🔥 FILTRE: Minimum 65% de confiance
    let direction = 'neutral';
    if (totalScore >= 4 && confidence >= 65) {
      if (scoreDiff > 0 && trendValue !== 'strong_downtrend') {
        direction = 'buy';
      } else if (scoreDiff < 0 && trendValue !== 'strong_uptrend') {
        direction = 'sell';
      }
    }

    // 🔥 FILTRE: Rejeter si marché latéral sans momentum
    if (isRanging && Math.abs(indicators.macd.histogram) < 0.5) {
      direction = 'neutral';
      confidence = Math.floor(confidence * 0.5);
    }

    // 🔥 FILTRE: Rejeter si tendance trop faible
    if (trendStrength < 12 && direction !== 'neutral') {
      direction = 'neutral';
      confidence = Math.floor(confidence * 0.7);
    }

    const currentPrice = candles[candles.length - 1].close;
    const atr = indicators.atr.atr;

    // SL/TP adaptatifs selon qualité du signal
    const slMultiplier = direction === 'buy' ? 2 : 1.5;
    const tpMultiplier = direction === 'buy' ? 
      (confidence > 80 ? 4 : 3) : 
      (confidence > 80 ? 3 : 2);

    return {
      direction,
      confidence: Math.floor(confidence),
      entryPrice: parseFloat(currentPrice.toFixed(2)),
      stopLoss: direction === 'neutral' ? 0 : parseFloat((currentPrice - (direction === 'buy' ? atr * slMultiplier : -atr * slMultiplier)).toFixed(2)),
      takeProfit: direction === 'neutral' ? 0 : parseFloat((currentPrice + (direction === 'buy' ? atr * tpMultiplier : -atr * tpMultiplier)).toFixed(2)),
      indicators,
      patterns,
      isRanging,
      trendStrength,
      volumeConfirmation: volumeAnalysis.confirms,
      reasoning: this.generateProReasoning(indicators, patterns, direction, confidence, trendStrength, volumeAnalysis),
      quality: signalQuality
    };
  }

  // 🆕 NOUVEAU: Détection marché latéral
  detectRangingMarket(candles) {
    const highs = candles.slice(-20).map(c => c.high);
    const lows = candles.slice(-20).map(c => c.low);
    
    const rangeHigh = Math.max(...highs);
    const rangeLow = Math.min(...lows);
    const range = rangeHigh - rangeLow;
    
    const avgPrice = candles.slice(-20).reduce((sum, c) => sum + c.close, 0) / 20;
    const rangePercent = (range / avgPrice) * 100;
    
    // Si range < 5% en 20 périodes = marché latéral
    return rangePercent < 5;
  }

  // 🆕 NOUVEAU: Force de tendance (simplifiée ADX-like)
  calculateTrendStrength(candles) {
    const period = 14;
    if (candles.length < period * 2) return 0;
    
    let dmPlus = 0, dmMinus = 0;
    
    for (let i = candles.length - period; i < candles.length; i++) {
      const current = candles[i];
      const prev = candles[i - 1];
      
      const upMove = current.high - prev.high;
      const downMove = prev.low - current.low;
      
      if (upMove > downMove && upMove > 0) dmPlus += upMove;
      if (downMove > upMove && downMove > 0) dmMinus += downMove;
    }
    
    // Normaliser
    const total = dmPlus + dmMinus;
    if (total === 0) return 0;
    
    return Math.abs((dmPlus - dmMinus) / total) * 100;
  }

  // 🆕 NOUVEAU: Analyse Volume
  analyzeVolume(candles, volumes) {
    const recentVolumes = candles.slice(-10).map(c => c.volume || 0);
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const currentVolume = candles[candles.length - 1].volume || 0;
    const volumeSpike = currentVolume > avgVolume * 1.5;
    
    const recentCandles = candles.slice(-5);
    const priceUp = recentCandles[recentCandles.length - 1].close > recentCandles[0].close;
    
    return {
      confirms: volumeSpike,
      confirmsBullish: volumeSpike && priceUp,
      confirmsBearish: volumeSpike && !priceUp,
      volumeSpike,
      avgVolume
    };
  }

  // 🆕 NOUVEAU: Détection divergence RSI
  detectRSIDivergence(candles, currentRSI) {
    const recentCandles = candles.slice(-10);
    const priceHigher = recentCandles[recentCandles.length - 1].close > recentCandles[0].close;
    const rsiHigher = currentRSI > 50;
    
    // Bearish divergence: prix up, RSI down
    if (priceHigher && !rsiHigher && currentRSI < 60) return 'bearish';
    // Bullish divergence: prix down, RSI up
    if (!priceHigher && rsiHigher && currentRSI > 40) return 'bullish';
    
    return 'none';
  }

  // 🆕 NOUVEAU: Raisonnement détaillé
  generateProReasoning(indicators, patterns, direction, confidence, trendStrength, volumeAnalysis) {
    const reasons = [];
    
    if (direction === 'neutral') {
      if (confidence < 65) reasons.push('Confiance insuffisante (<65%)');
      if (trendStrength < 12) reasons.push('Tendance trop faible');
      return reasons.join('. ') || 'Aucun signal fiable détecté';
    }
    
    const trend = patterns.find(p => p.type === 'trend');
    
    if (direction === 'buy') {
      if (indicators.rsi.signal.includes('oversold')) reasons.push('RSI survendu');
      if (indicators.macd.signal.includes('bullish')) reasons.push('MACD haussier');
      if (trend?.value.includes('uptrend')) reasons.push('Tendance haussière');
      if (volumeAnalysis.confirmsBullish) reasons.push('Volume confirmant');
    } else {
      if (indicators.rsi.signal.includes('overbought')) reasons.push('RSI suracheté');
      if (indicators.macd.signal.includes('bearish')) reasons.push('MACD baissier');
      if (trend?.value.includes('downtrend')) reasons.push('Tendance baissière');
      if (volumeAnalysis.confirmsBearish) reasons.push('Volume confirmant');
    }
    
    reasons.push(`Confiance ${confidence}%`);
    
    return reasons.join(' + ');
  }

  // Ancienne méthode gardée pour compatibilité
  generateReasoning(indicators, patterns, direction, confidence) {
    return this.generateProReasoning(indicators, patterns, direction, confidence, 0, {});
  }
}

module.exports = new TechnicalAnalysis();
