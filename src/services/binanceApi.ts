import CryptoJS from 'crypto-js';
import { getDecryptedKey } from '../utils/crypto';

// Utilise le proxy Netlify pour contourner CORS
const BINANCE_API_URL = '/api/binance';

// Récupère les clés API chiffrées
const getBinanceApiKeys = () => {
  return {
    apiKey: getDecryptedKey('binance_api_key') || '',
    secretKey: getDecryptedKey('binance_secret_key') || '',
  };
};

// Vérifie si on a une clé API configurée
const hasApiKey = () => {
  const { apiKey, secretKey } = getBinanceApiKeys();
  return !!(apiKey && secretKey);
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

// Vérifier la connectivité API (test public)
export async function testApiConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${BINANCE_API_URL}/ping`);
    
    if (response.ok) {
      return { success: true, message: 'Connecté à Binance (mode public)' };
    }
    
    return { success: false, message: `Erreur HTTP ${response.status}` };
  } catch (error) {
    return { success: false, message: 'Impossible de contacter Binance' };
  }
}

// Tester la connexion avec clés API (authentifié)
async function testAuthenticatedConnection(): Promise<{ success: boolean; message: string }> {
  if (!hasApiKey()) {
    return { success: false, message: 'Clés API non configurées' };
  }
  
  try {
    const { apiKey } = getBinanceApiKeys();
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = generateSignature(queryString);
    
    const response = await fetch(
      `${BINANCE_API_URL}/account?${queryString}&signature=${signature}`,
      { headers: getAuthHeaders() }
    );
    
    if (response.ok) {
      return { success: true, message: 'Clés API valides - Accès authentifié' };
    }
    
    if (response.status === 401) {
      return { success: false, message: 'Clés API invalides ou permissions insuffisantes' };
    }
    
    return { success: false, message: `Erreur HTTP ${response.status}` };
  } catch (error) {
    return { success: false, message: 'Erreur de connexion authentifiée' };
  }
}

// Récupérer le solde du compte
async function fetchAccountBalance(): Promise<{ success: boolean; balances?: any[]; message?: string }> {
  if (!hasApiKey()) {
    return { success: false, message: 'Clés API non configurées' };
  }
  
  try {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = generateSignature(queryString);
    
    const response = await fetch(
      `${BINANCE_API_URL}/account?${queryString}&signature=${signature}`,
      { headers: getAuthHeaders() }
    );
    
    if (response.ok) {
      const data = await response.json();
      // Filtrer les balances non nulles
      const nonZeroBalances = data.balances?.filter((b: any) => 
        parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
      );
      return { success: true, balances: nonZeroBalances };
    }
    
    return { success: false, message: `Erreur ${response.status}` };
  } catch (error) {
    return { success: false, message: 'Erreur de récupération du solde' };
  }
}

export { hasApiKey, fetchAccountBalance, testAuthenticatedConnection };
