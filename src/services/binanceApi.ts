import CryptoJS from 'crypto-js';

const BINANCE_API_URL = '/api/binance'; // Proxy through Vite to bypass CORS

// Get API keys from user settings (localStorage) or fallback to env
const getBinanceApiKeys = () => {
  try {
    const settings = localStorage.getItem('trading_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return {
        apiKey: parsed.binanceApiKey || '',
        secretKey: parsed.binanceSecretKey || '',
      };
    }
  } catch (e) {
    // Silent fail
  }
  return {
    apiKey: import.meta.env.VITE_BINANCE_API_KEY || '',
    secretKey: import.meta.env.VITE_BINANCE_SECRET_KEY || '',
  };
};

// Vérifie si on a une clé API
const hasApiKey = () => {
  const { apiKey } = getBinanceApiKeys();
  return apiKey && apiKey !== 'ta_cle_binance_ici';
};

// Génère la signature HMAC pour les requêtes signées
function generateSignature(queryString: string): string {
  const { secretKey } = getBinanceApiKeys();
  if (!secretKey || secretKey === 'ta_secret_binance_ici') {
    return '';
  }
  return CryptoJS.HmacSHA256(queryString, secretKey).toString();
}

// Headers pour requêtes publiques (sans CORS issues)
function getPublicHeaders(): Record<string, string> {
  // Pas de Content-Type pour éviter le preflight CORS
  return {};
}

// Headers avec la clé API (pour endpoints privés)
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const { apiKey } = getBinanceApiKeys();
  
  if (hasApiKey()) {
    headers['X-MBX-APIKEY'] = apiKey;
  }
  
  return headers;
}

// Prix en temps réel (public)
export async function fetchPrices(symbols: string[]): Promise<any[]> {
  try {
    const response = await fetch(
      `${BINANCE_API_URL}/ticker/24hr?symbols=[${symbols.map(s => `"${s}"`).join(',')}]`,
      { headers: getPublicHeaders() }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Données de bougies (public)
export async function fetchKlines(
  symbol: string, 
  interval: string, 
  limit: number = 500
): Promise<any[]> {
  try {
    const response = await fetch(
      `${BINANCE_API_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { headers: getPublicHeaders() }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Profil utilisateur (nécessite API key)
export async function fetchAccountInfo(): Promise<any> {
  if (!hasApiKey()) {
    throw new Error('API Key required');
  }
  
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = generateSignature(queryString);
  
  const response = await fetch(
    `${BINANCE_API_URL}/account?${queryString}&signature=${signature}`,
    { headers: getAuthHeaders() }
  );
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return await response.json();
}

// Ordres ouverts (nécessite API key)
export async function fetchOpenOrders(symbol?: string): Promise<any[]> {
  if (!hasApiKey()) {
    throw new Error('API Key required');
  }
  
  const timestamp = Date.now();
  let queryString = `timestamp=${timestamp}`;
  if (symbol) {
    queryString += `&symbol=${symbol}`;
  }
  const signature = generateSignature(queryString);
  
  const response = await fetch(
    `${BINANCE_API_URL}/openOrders?${queryString}&signature=${signature}`,
    { headers: getAuthHeaders() }
  );
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return await response.json();
}

// Historique des trades (nécessite API key)
export async function fetchMyTrades(symbol: string, limit: number = 500): Promise<any[]> {
  if (!hasApiKey()) {
    throw new Error('API Key required');
  }
  
  const timestamp = Date.now();
  const queryString = `symbol=${symbol}&limit=${limit}&timestamp=${timestamp}`;
  const signature = generateSignature(queryString);
  
  const response = await fetch(
    `${BINANCE_API_URL}/myTrades?${queryString}&signature=${signature}`,
    { headers: getAuthHeaders() }
  );
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return await response.json();
}

// Vérifier la connectivité API
export async function testApiConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${BINANCE_API_URL}/ping`, { 
      method: 'GET',
      headers: getPublicHeaders()
    });
    
    if (response.ok) {
      if (hasApiKey()) {
        return { success: true, message: 'Connecté avec clé API' };
      }
      return { success: true, message: 'Connecté (mode public)' };
    }
    
    return { success: false, message: `Erreur HTTP ${response.status}` };
  } catch (error) {
    return { success: false, message: 'Impossible de contacter Binance' };
  }
}

export { hasApiKey };
