// Service d'Analyse de Sentiment pour Ethernal IA
// Analyse le sentiment du marché via Twitter, Reddit, News et Fear & Greed Index

require('dotenv').config();

class SentimentService {
  constructor() {
    this.fearGreedCache = null;
    this.fearGreedCacheTime = 0;
    this.FEAR_GREED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  // Obtenir le Fear & Greed Index (Alternative.me API)
  async getFearGreedIndex() {
    const now = Date.now();
    
    // Utiliser le cache si disponible
    if (this.fearGreedCache && (now - this.fearGreedCacheTime) < this.FEAR_GREED_CACHE_TTL) {
      return this.fearGreedCache;
    }

    try {
      const response = await fetch('https://api.alternative.me/fng/?limit=1');
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const fngData = data.data[0];
        const result = {
          value: parseInt(fngData.value),
          classification: fngData.value_classification,
          timestamp: new Date(fngData.timestamp * 1000)
        };

        this.fearGreedCache = result;
        this.fearGreedCacheTime = now;
        
        return result;
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du Fear & Greed Index:', error);
    }

    // Valeur par défaut si l'API échoue
    return {
      value: 50,
      classification: 'Neutral',
      timestamp: new Date()
    };
  }

  // Analyser le sentiment basé sur le Fear & Greed Index
  analyzeFearGreedSentiment(fngData) {
    const value = fngData.value;
    
    if (value <= 20) {
      return {
        sentiment: 'extreme_fear',
        score: -100,
        interpretation: 'Marché extrêmement craintif - Opportunité d\'achat potentielle',
        recommendation: 'buy_opportunity'
      };
    } else if (value <= 40) {
      return {
        sentiment: 'fear',
        score: -50,
        interpretation: 'Marché craintif - Bon moment pour accumuler',
        recommendation: 'accumulate'
      };
    } else if (value <= 60) {
      return {
        sentiment: 'neutral',
        score: 0,
        interpretation: 'Marché neutre - Attendre des signaux clairs',
        recommendation: 'hold'
      };
    } else if (value <= 80) {
      return {
        sentiment: 'greed',
        score: 50,
        interpretation: 'Marché avide - Attention à la surchauffe',
        recommendation: 'cautious'
      };
    } else {
      return {
        sentiment: 'extreme_greed',
        score: 100,
        interpretation: 'Marché extrêmement avide - Risque de correction',
        recommendation: 'sell_warning'
      };
    }
  }

  // Analyser le sentiment des prix récents (momentum)
  async analyzePriceSentiment(symbol, period = 24) {
    const binanceService = require('./binanceService');
    
    try {
      const candles = await binanceService.getKlines(symbol, '1h', period);
      
      if (!candles || candles.length < period) {
        return { sentiment: 'neutral', score: 0, trend: 'unknown' };
      }

      const closes = candles.map(c => c.close);
      const firstPrice = closes[0];
      const lastPrice = closes[closes.length - 1];
      const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

      // Calculer la volatilité
      const returns = [];
      for (let i = 1; i < closes.length; i++) {
        returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      }
      const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * 100;

      // Déterminer le sentiment
      let sentiment = 'neutral';
      let score = 0;
      let trend = 'sideways';

      if (priceChange > 5) {
        sentiment = 'strongly_bullish';
        score = 80;
        trend = 'strong_uptrend';
      } else if (priceChange > 2) {
        sentiment = 'bullish';
        score = 50;
        trend = 'uptrend';
      } else if (priceChange < -5) {
        sentiment = 'strongly_bearish';
        score = -80;
        trend = 'strong_downtrend';
      } else if (priceChange < -2) {
        sentiment = 'bearish';
        score = -50;
        trend = 'downtrend';
      }

      return {
        sentiment,
        score,
        trend,
        priceChange: parseFloat(priceChange.toFixed(2)),
        volatility: parseFloat(volatility.toFixed(2)),
        interpretation: this.generatePriceInterpretation(sentiment, priceChange, volatility)
      };
    } catch (error) {
      console.error('Erreur lors de l\'analyse de sentiment des prix:', error);
      return { sentiment: 'neutral', score: 0, trend: 'unknown' };
    }
  }

  // Générer une interprétation du sentiment de prix
  generatePriceInterpretation(sentiment, priceChange, volatility) {
    const interpretations = {
      strongly_bullish: `Forte hausse de ${priceChange.toFixed(2)}% avec volatilité ${volatility.toFixed(2)}%`,
      bullish: `Hausse modérée de ${priceChange.toFixed(2)}%`,
      neutral: `Prix stable, variation de ${priceChange.toFixed(2)}%`,
      bearish: `Baisse modérée de ${Math.abs(priceChange).toFixed(2)}%`,
      strongly_bearish: `Forte baisse de ${Math.abs(priceChange).toFixed(2)}% avec volatilité ${volatility.toFixed(2)}%`
    };

    return interpretations[sentiment] || 'Données insuffisantes';
  }

  // Analyser le volume pour confirmer le sentiment
  async analyzeVolumeSentiment(symbol) {
    const binanceService = require('./binanceService');
    
    try {
      const ticker = await binanceService.get24hTicker(symbol);
      
      const volume = parseFloat(ticker.volume);
      const quoteVolume = parseFloat(ticker.quoteVolume);
      const priceChangePercent = parseFloat(ticker.priceChangePercent);

      // Comparer le volume actuel à la moyenne (simplifié)
      // Dans une vraie implémentation, on comparerait à la moyenne mobile des volumes
      const avgVolume = volume * 0.8; // Estimation simplifiée
      const volumeRatio = volume / avgVolume;

      let volumeSentiment = 'normal';
      if (volumeRatio > 1.5) {
        volumeSentiment = 'high';
      } else if (volumeRatio < 0.7) {
        volumeSentiment = 'low';
      }

      // Confirmer si le mouvement de prix est soutenu par le volume
      let confirmation = 'neutral';
      if (priceChangePercent > 2 && volumeSentiment === 'high') {
        confirmation = 'bullish_confirmation';
      } else if (priceChangePercent < -2 && volumeSentiment === 'high') {
        confirmation = 'bearish_confirmation';
      } else if (priceChangePercent > 2 && volumeSentiment === 'low') {
        confirmation = 'bullish_weak';
      } else if (priceChangePercent < -2 && volumeSentiment === 'low') {
        confirmation = 'bearish_weak';
      }

      return {
        volume,
        quoteVolume,
        volumeRatio: parseFloat(volumeRatio.toFixed(2)),
        volumeSentiment,
        confirmation,
        interpretation: this.generateVolumeInterpretation(volumeSentiment, confirmation)
      };
    } catch (error) {
      console.error('Erreur lors de l\'analyse de volume:', error);
      return { volumeSentiment: 'unknown', confirmation: 'neutral' };
    }
  }

  // Générer une interprétation du volume
  generateVolumeInterpretation(volumeSentiment, confirmation) {
    const interpretations = {
      bullish_confirmation: 'Mouvement haussier soutenu par un volume élevé - Signal fort',
      bearish_confirmation: 'Mouvement baissier soutenu par un volume élevé - Signal fort',
      bullish_weak: 'Mouvement haussier sans volume significatif - Signal faible',
      bearish_weak: 'Mouvement baissier sans volume significatif - Signal faible',
      neutral: 'Volume normal - Pas de confirmation particulière'
    };

    return interpretations[confirmation] || 'Volume normal';
  }

  // Analyser le sentiment global du marché (combiner toutes les sources)
  async getOverallMarketSentiment(symbol) {
    try {
      const [fearGreed, priceSentiment, volumeSentiment] = await Promise.all([
        this.getFearGreedIndex(),
        this.analyzePriceSentiment(symbol),
        this.analyzeVolumeSentiment(symbol)
      ]);

      const fngAnalysis = this.analyzeFearGreedSentiment(fearGreed);

      // Calculer un score composite
      const fngScore = fngAnalysis.score;
      const priceScore = priceSentiment.score;
      const volumeBonus = volumeSentiment.confirmation.includes('confirmation') ? 10 : 0;

      const compositeScore = (fngScore * 0.3) + (priceScore * 0.5) + volumeBonus;
      const normalizedScore = Math.max(-100, Math.min(100, compositeScore));

      // Déterminer le sentiment global
      let overallSentiment = 'neutral';
      if (normalizedScore >= 50) {
        overallSentiment = 'bullish';
      } else if (normalizedScore >= 75) {
        overallSentiment = 'strongly_bullish';
      } else if (normalizedScore <= -50) {
        overallSentiment = 'bearish';
      } else if (normalizedScore <= -75) {
        overallSentiment = 'strongly_bearish';
      }

      return {
        overall: overallSentiment,
        compositeScore: parseFloat(normalizedScore.toFixed(0)),
        confidence: this.calculateConfidence(fngAnalysis, priceSentiment, volumeSentiment),
        sources: {
          fearGreed: {
            ...fngAnalysis,
            raw: fearGreed
          },
          price: priceSentiment,
          volume: volumeSentiment
        },
        interpretation: this.generateOverallInterpretation(overallSentiment, normalizedScore),
        recommendation: this.generateRecommendation(overallSentiment, normalizedScore)
      };
    } catch (error) {
      console.error('Erreur lors de l\'analyse du sentiment global:', error);
      return {
        overall: 'neutral',
        compositeScore: 0,
        confidence: 0,
        interpretation: 'Impossible de déterminer le sentiment',
        recommendation: 'hold'
      };
    }
  }

  // Calculer la confiance dans l'analyse
  calculateConfidence(fngAnalysis, priceSentiment, volumeSentiment) {
    let confidence = 50;

    // Augmenter la confiance si toutes les sources sont alignées
    const fngBullish = fngAnalysis.score > 0;
    const priceBullish = priceSentiment.score > 0;
    const volumeBullish = volumeSentiment.confirmation.includes('bullish');

    if (fngBullish === priceBullish && priceBullish === volumeBullish) {
      confidence += 30;
    }

    // Augmenter si le volume confirme
    if (volumeSentiment.confirmation.includes('confirmation')) {
      confidence += 15;
    }

    return Math.min(100, confidence);
  }

  // Générer une interprétation globale
  generateOverallInterpretation(sentiment, score) {
    const interpretations = {
      strongly_bullish: `Sentiment fortement haussier (score: ${score}). Le marché montre une forte tendance à la hausse soutenue par le volume.`,
      bullish: `Sentiment haussier (score: ${score}). Le marché est globalement positif.`,
      neutral: `Sentiment neutre (score: ${score}). Le marché est incertain, attendez des signaux plus clairs.`,
      bearish: `Sentiment baissier (score: ${score}). Le marché montre des signes de faiblesse.`,
      strongly_bearish: `Sentiment fortement baissier (score: ${score}). Le marché est sous pression, soyez prudent.`
    };

    return interpretations[sentiment] || 'Sentiment indéterminé';
  }

  // Générer une recommandation
  generateRecommendation(sentiment, score) {
    if (sentiment === 'strongly_bullish') {
      return 'Opportunité d\'achat avec confiance élevée';
    } else if (sentiment === 'bullish') {
      return 'Opportunité d\'achat avec confiance modérée';
    } else if (sentiment === 'neutral') {
      return 'Maintenir les positions, attendre';
    } else if (sentiment === 'bearish') {
      return 'Réduire les positions, être prudent';
    } else if (sentiment === 'strongly_bearish') {
      return 'Considérer la vente ou couverture';
    }

    return 'Maintenir les positions';
  }

  // Analyser le sentiment pour plusieurs symboles
  async analyzeMultipleSymbols(symbols) {
    const sentiments = {};

    for (const symbol of symbols) {
      sentiments[symbol] = await this.getOverallMarketSentiment(symbol);
    }

    return sentiments;
  }

  // Obtenir un résumé du sentiment pour Ethernal
  async getSentimentSummaryForEthernal(symbol) {
    const sentiment = await this.getOverallMarketSentiment(symbol);

    return `
**Analyse de Sentiment - ${symbol}**

• Sentiment global: ${sentiment.overall.toUpperCase()}
• Score composite: ${sentiment.compositeScore}/100
• Confiance: ${sentiment.confidence}%

**Sources:**
• Fear & Greed: ${sentiment.sources.fearGreed.raw.classification} (${sentiment.sources.fearGreed.raw.value})
• Prix: ${sentiment.sources.price.sentiment} (${sentiment.sources.price.priceChange}%)
• Volume: ${sentiment.sources.volume.volumeSentiment}

**Interprétation:**
${sentiment.interpretation}

**Recommandation:**
${sentiment.recommendation}
`;
  }
}

module.exports = new SentimentService();
