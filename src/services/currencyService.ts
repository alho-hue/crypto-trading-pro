/**
 * 💱 Service de Conversion de Devises - NEUROVEST
 * Taux réels via API de marché (CoinGecko, Binance)
 * Conversion USDT ↔ XOF et crypto ↔ crypto
 */

import { fetchPrices } from './binanceApi';

// Cache des taux pour éviter les appels API excessifs
interface RateCache {
  rate: number;
  timestamp: number;
  source: string;
}

const rateCache: Map<string, RateCache> = new Map();
const CACHE_DURATION = 30000; // 30 secondes

// Taux de référence USD/XOF (FCFA) - sera mis à jour via API
let USD_XOF_RATE = 605;
let lastRateUpdate = 0;
const RATE_CACHE_DURATION = 300000; // 5 minutes

export interface ConversionResult {
  fromAmount: number;
  toAmount: number;
  rate: number;
  fee: number;
  feePercent: number;
  netAmount: number;
  timestamp: number;
  source: string;
}

export interface ExchangeRates {
  USDT_XOF: number;
  BTC_USDT: number;
  ETH_USDT: number;
  BNB_USDT: number;
  timestamp: number;
}

/**
 * Récupère le taux de change USDT/XOF en temps réel
 * Utilise l'API open.er-api.com pour les taux réels
 */
export async function getUSDTToXOFRate(): Promise<number> {
  const now = Date.now();
  
  // Return cached rate if still valid
  if (now - lastRateUpdate < RATE_CACHE_DURATION) {
    return USD_XOF_RATE;
  }

  try {
    // Fetch real USD to XOF rate from open.er-api.com
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error('Failed to fetch rate');
    
    const data = await response.json();
    if (data.rates && data.rates.XOF) {
      USD_XOF_RATE = data.rates.XOF;
      lastRateUpdate = now;
      console.log('[Currency] Real USD/XOF rate updated:', USD_XOF_RATE);
      return USD_XOF_RATE;
    }
    throw new Error('XOF rate not found in response');
  } catch (error) {
    console.error('[Currency] Error fetching real XOF rate:', error);
    // Try alternative API
    try {
      const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=XOF');
      if (response.ok) {
        const data = await response.json();
        if (data.rates && data.rates.XOF) {
          USD_XOF_RATE = data.rates.XOF;
          lastRateUpdate = now;
          console.log('[Currency] Real USD/XOF rate from fallback:', USD_XOF_RATE);
          return USD_XOF_RATE;
        }
      }
    } catch (fallbackError) {
      console.error('[Currency] Fallback API also failed:', fallbackError);
    }
    console.warn('[Currency] Using cached rate:', USD_XOF_RATE);
    return USD_XOF_RATE;
  }
}

/**
 * Récupère les prix crypto depuis Binance
 */
export async function getCryptoPrices(): Promise<Record<string, number>> {
  const cacheKey = 'crypto-prices';
  const cached = rateCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    // Retourner depuis le cache
    const prices: Record<string, number> = {};
    rateCache.forEach((value, key) => {
      if (key.includes('-USDT') || key.includes('USDT-')) {
        const [from, to] = key.split('-');
        if (to === 'USDT') prices[from] = value.rate;
      }
    });
    return prices;
  }

  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT'];
    const prices = await fetchPrices(symbols);
    
    const result: Record<string, number> = {
      USDT: 1
    };
    
    prices.forEach(p => {
      const asset = p.symbol.replace('USDT', '');
      const price = parseFloat(p.lastPrice);
      result[asset] = price;
      
      // Mettre en cache
      rateCache.set(`${asset}-USDT`, {
        rate: price,
        timestamp: Date.now(),
        source: 'binance'
      });
      
      rateCache.set(`USDT-${asset}`, {
        rate: 1 / price,
        timestamp: Date.now(),
        source: 'binance'
      });
    });
    
    return result;
  } catch (error) {
    console.error('Erreur prix crypto:', error);
    // PAS DE FALLBACK SIMULÉ - On retourne un objet vide pour indiquer l'erreur
    // Les composants doivent gérer l'absence de données
    return {
      USDT: 1
      // Pas de valeurs fictives - l'application doit attendre les vraies données
    };
  }
}

/**
 * Calcule une conversion complète avec frais
 */
export async function calculateConversion(
  from: string,
  to: string,
  amount: number,
  options: { includeFees?: boolean; feePercent?: number } = {}
): Promise<ConversionResult> {
  const { includeFees = true, feePercent = 0.5 } = options;
  
  let rate = 1;
  let source = 'direct';
  
  if (from === to) {
    rate = 1;
  } else if (from === 'USDT' && to === 'XOF') {
    rate = await getUSDTToXOFRate();
    source = 'forex';
  } else if (from === 'XOF' && to === 'USDT') {
    rate = 1 / await getUSDTToXOFRate();
    source = 'forex';
  } else {
    // Conversion crypto-crypto via USDT
    const prices = await getCryptoPrices();
    
    const fromPriceUSD = prices[from] || 1;
    const toPriceUSD = prices[to] || 1;
    
    rate = fromPriceUSD / toPriceUSD;
    source = 'binance';
  }
  
  const grossAmount = amount * rate;
  const fee = includeFees ? grossAmount * (feePercent / 100) : 0;
  const netAmount = grossAmount - fee;
  
  return {
    fromAmount: amount,
    toAmount: grossAmount,
    rate,
    fee,
    feePercent: includeFees ? feePercent : 0,
    netAmount,
    timestamp: Date.now(),
    source
  };
}

/**
 * Convertit un montant en XOF (FCFA)
 */
export async function convertToXOF(amountUSDT: number): Promise<number> {
  const rate = await getUSDTToXOFRate();
  return amountUSDT * rate;
}

/**
 * Convertit un montant XOF en USDT
 */
export async function convertFromXOF(amountXOF: number): Promise<number> {
  const rate = await getUSDTToXOFRate();
  return amountXOF / rate;
}

/**
 * Formate un montant en XOF
 */
export function formatXOF(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Formate un montant crypto
 */
export function formatCrypto(amount: number, currency: string): string {
  const decimals = currency === 'BTC' ? 6 : currency === 'ETH' ? 4 : 2;
  return `${amount.toFixed(decimals)} ${currency}`;
}

/**
 * Récupère tous les taux disponibles
 */
export async function getAllExchangeRates(): Promise<ExchangeRates> {
  const [xofRate, cryptoPrices] = await Promise.all([
    getUSDTToXOFRate(),
    getCryptoPrices()
  ]);
  
  return {
    USDT_XOF: xofRate,
    BTC_USDT: cryptoPrices.BTC, // PAS DE FALLBACK - null si pas de données réelles
    ETH_USDT: cryptoPrices.ETH,
    BNB_USDT: cryptoPrices.BNB,
    timestamp: Date.now()
  };
}

/**
 * Vide le cache des taux
 */
export function clearRateCache(): void {
  rateCache.clear();
}

/**
 * Vérifie si les taux sont à jour
 */
export function areRatesFresh(maxAge: number = CACHE_DURATION): boolean {
  const usdtXof = rateCache.get('USDT-XOF');
  if (!usdtXof) return false;
  return Date.now() - usdtXof.timestamp < maxAge;
}
