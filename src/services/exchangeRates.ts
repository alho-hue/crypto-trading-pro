// Exchange rate service for USD to FCFA (XOF) conversion
const CACHE_DURATION = 300000; // 5 minutes cache
const API_URL = 'https://open.er-api.com/v6/latest/USD';

interface ExchangeRates {
  USD: {
    XOF: number;
    EUR: number;
    [key: string]: number;
  };
  timestamp: number;
}

let cachedRates: ExchangeRates | null = null;
let lastFetchTime = 0;

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  const now = Date.now();
  
  // Return cached rates if still valid
  if (cachedRates && now - lastFetchTime < CACHE_DURATION) {
    return cachedRates;
  }

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }

    const data = await response.json();
    
    cachedRates = {
      USD: data.rates,
      timestamp: now,
    };
    
    lastFetchTime = now;
    return cachedRates;
  } catch (error) {
    // Silent fail
    
    // Try alternative API as fallback
    try {
      const fallbackResponse = await fetch('https://api.frankfurter.app/latest?from=USD&to=XOF');
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        cachedRates = {
          USD: {
            XOF: fallbackData.rates.XOF,
            EUR: 1,
          },
          timestamp: now,
        };
        lastFetchTime = now;
        return cachedRates;
      }
    } catch (fallbackError) {
      // Silent fail
    }
    
    // Last resort: use current market rate (will be updated on next successful fetch)
    return {
      USD: {
        XOF: 615, // Current approximate USD to XOF rate (will be replaced by real rate)
        EUR: 0.92,
      },
      timestamp: now,
    };
  }
}

export function getUSDToFCFARate(): Promise<number> {
  return fetchExchangeRates().then(rates => rates.USD.XOF);
}

export function formatUSDToFCFA(usdAmount: number): string {
  const rate = cachedRates?.USD.XOF || 600;
  const fcfaAmount = usdAmount * rate;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(fcfaAmount);
}

// Initialize exchange rates on load
fetchExchangeRates().catch(() => {});
