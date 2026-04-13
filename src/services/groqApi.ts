import type { CandleData, AISignal } from '../types';

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
    // Silent fail - will use env fallback
  }
  return import.meta.env.VITE_GROQ_API_KEY || '';
};

// Vérifie si on a une clé Groq
const hasGroqKey = () => {
  const key = getGroqApiKey();
  return key && key !== 'ta_cle_groq_ici';
};

// Analyse technique par IA
export async function analyzeWithAI(
  candleData: CandleData[],
  symbol: string,
  currentPrice: number,
  indicators: {
    rsi: number;
    macd: { macd: number; signal: number; histogram: number };
    sma20: number;
    sma50: number;
    bb: { upper: number; middle: number; lower: number };
    atr: number;
  }
): Promise<AISignal & { aiReasoning?: string }> {
  if (!hasGroqKey()) {
    throw new Error('Clé API Groq requise');
  }

  // Préparer les données pour l'IA
  const lastCandles = candleData.slice(-20);
  const priceChange24h = ((lastCandles[lastCandles.length - 1].close - lastCandles[0].open) / lastCandles[0].open) * 100;
  
  const prompt = `Tu es un analyste trading crypto expert. Analyse ces données pour ${symbol}:

PRIX ACTUEL: $${currentPrice.toFixed(2)}
VARIATION 24H: ${priceChange24h.toFixed(2)}%

INDICATEURS TECHNIQUES:
- RSI: ${indicators.rsi.toFixed(2)}
- MACD: ${indicators.macd.macd.toFixed(4)} (Signal: ${indicators.macd.signal.toFixed(4)})
- SMA20: ${indicators.sma20.toFixed(2)}
- SMA50: ${indicators.sma50.toFixed(2)}
- Bollinger Upper: ${indicators.bb.upper.toFixed(2)}
- Bollinger Lower: ${indicators.bb.lower.toFixed(2)}
- ATR: ${indicators.atr.toFixed(2)}

DONNÉES DES 20 DERNIÈRES BOUGIES:
${lastCandles.map(c => `Open: ${c.open.toFixed(2)}, High: ${c.high.toFixed(2)}, Low: ${c.low.toFixed(2)}, Close: ${c.close.toFixed(2)}`).join('\n')}

Fournis une analyse JSON avec:
1. "direction": "buy" | "sell" | "neutral"
2. "confidence": nombre 0-100
3. "entryPrice": prix d'entrée suggéré
4. "stopLoss": stop loss suggéré
5. "takeProfit": take profit suggéré
6. "explanation": analyse textuelle détaillée
7. "riskLevel": "low" | "medium" | "high"

Réponds UNIQUEMENT avec le JSON, pas de texte avant/après.`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getGroqApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          { role: 'system', content: 'Tu es un analyste trading crypto professionnel. Réponds uniquement en JSON valide.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '';

    // Extraire le JSON de la réponse
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const result: AISignal & { aiReasoning?: string } = {
        symbol: symbol,
        direction: parsed.direction || 'neutral',
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        entryPrice: parsed.entryPrice || currentPrice,
        stopLoss: parsed.stopLoss || currentPrice * 0.95,
        takeProfit: parsed.takeProfit || currentPrice * 1.05,
        explanation: parsed.explanation || 'Analyse IA indisponible',
        riskLevel: parsed.riskLevel || 'medium',
        timestamp: Date.now(),
        timeframe: '1h',
        aiReasoning: parsed.explanation,
      };
      return result;
    }

    throw new Error('Format de réponse IA invalide');
  } catch (error) {
    throw error;
  }
}

// Génération de stratégie de trading
export async function generateTradingStrategy(
  symbol: string,
  timeframe: string,
  riskProfile: 'conservative' | 'moderate' | 'aggressive'
): Promise<{
  name: string;
  description: string;
  rules: string[];
  indicators: string[];
}> {
  if (!hasGroqKey()) {
    throw new Error('Clé API Groq requise');
  }

  const prompt = `Crée une stratégie de trading pour ${symbol} sur timeframe ${timeframe}.
Profil de risque: ${riskProfile}

Fournis un JSON avec:
- "name": nom de la stratégie
- "description": description détaillée
- "rules": tableau de règles (5-8 règles)
- "indicators": indicateurs techniques utilisés

Réponds UNIQUEMENT avec le JSON.`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getGroqApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mixtral-8x7b-32768',
      messages: [
        { role: 'system', content: 'Expert en stratégies de trading crypto.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error('Format invalide');
}

// Analyse de sentiment du marché
export async function analyzeMarketSentiment(
  symbol: string,
  recentPrices: number[]
): Promise<{
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
}> {
  if (!hasGroqKey()) {
    throw new Error('Clé API Groq requise');
  }

  const priceChange = ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100;
  const volatility = Math.sqrt(recentPrices.reduce((sum, p, i) => {
    if (i === 0) return 0;
    return sum + Math.pow((p - recentPrices[i-1]) / recentPrices[i-1], 2);
  }, 0) / recentPrices.length) * 100;

  const prompt = `Analyse le sentiment pour ${symbol}:
- Changement prix: ${priceChange.toFixed(2)}%
- Volatilité: ${volatility.toFixed(2)}%
- Derniers prix: ${recentPrices.slice(-5).join(', ')}

Réponds avec JSON: { "sentiment": "bullish|bearish|neutral", "confidence": 0-100, "summary": "texte" }`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getGroqApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error('Format invalide');
}

export { hasGroqKey };
