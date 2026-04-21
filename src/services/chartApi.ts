// Service pour les données de graphiques
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Récupérer les données de bougies (klines) depuis le backend uniquement
// PAS DE DONNÉES FAKE - Si l'API échoue, on retourne une erreur
export async function getKlines(
  symbol: string = 'BTCUSDT',
  interval: string = '1h',
  limit: number = 100
): Promise<CandleData[]> {
  try {
    const response = await fetch(
      `${API_URL}/api/binance/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch klines');
    }
    
    // Les données sont déjà formatées par le backend
    return data.data.map((candle: any) => ({
      time: candle.time / 1000, // timestamp en secondes
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    }));
  } catch (error) {
    console.error('Error fetching klines:', error);
    // Pas de données fake - on propage l'erreur
    throw error;
  }
}

// Fonction de retry avec exponential backoff
export async function getKlinesWithRetry(
  symbol: string = 'BTCUSDT',
  interval: string = '1h',
  limit: number = 100,
  maxRetries: number = 3
): Promise<CandleData[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await getKlines(symbol, interval, limit);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`Retry ${attempt}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries reached');
}

// Récupérer le prix actuel depuis le backend
export async function getCurrentPrice(symbol: string = 'BTCUSDT'): Promise<number> {
  try {
    const response = await fetch(`${API_URL}/api/binance/price/${symbol}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch price');
    }
    const data = await response.json();
    return data.price;
  } catch (error) {
    console.error('Error fetching price:', error);
    // Pas de prix fake - on propage l'erreur
    throw error;
  }
}

// Récupérer le prix avec retry
export async function getCurrentPriceWithRetry(
  symbol: string = 'BTCUSDT',
  maxRetries: number = 3
): Promise<number> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await getCurrentPrice(symbol);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries reached');
}
