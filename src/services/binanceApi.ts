import CryptoJS from 'crypto-js';
import { getDecryptedKey, decryptValue } from '../utils/crypto';

// Backend API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Utilise le proxy backend pour contourner CORS
const BINANCE_API_URL = `${API_URL}/api/binance`;

// Récupère les clés API depuis localStorage (en clair)
const getBinanceApiKeys = () => {
  return {
    apiKey: localStorage.getItem('binance_api_key') || '',
    secretKey: localStorage.getItem('binance_secret_key') || '',
  };
};

// Récupère les clés API chiffrées depuis le backend et les déchiffre
const getBinanceApiKeysFromBackend = async () => {
  const token = localStorage.getItem('token');
  if (!token) return { apiKey: '', secretKey: '' };

  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return { apiKey: '', secretKey: '' };

    const data = await res.json();
    const encryptedApiKey = data.user?.encryptedApiKeys?.binanceApiKey;
    const encryptedSecretKey = data.user?.encryptedApiKeys?.binanceSecretKey;

    if (!encryptedApiKey || !encryptedSecretKey) {
      return { apiKey: '', secretKey: '' };
    }

    // Déchiffrer les clés
    const decryptedApiKey = decryptValue(encryptedApiKey);
    const decryptedSecretKey = decryptValue(encryptedSecretKey);

    return { apiKey: decryptedApiKey, secretKey: decryptedSecretKey };
  } catch (error) {
    console.error('Erreur récupération clés backend:', error);
    return { apiKey: '', secretKey: '' };
  }
};

// Vérifie si on a une clé API configurée (localStorage ou backend)
const hasApiKey = () => {
  const localKeys = getBinanceApiKeys();
  return !!(localKeys.apiKey && localKeys.secretKey);
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

// Prix en temps réel - APPEL DIRECT BINANCE (backend optionnel)
export async function fetchPrices(symbols: string[]): Promise<any[]> {
  // Appel direct à Binance - plus fiable que backend local
  const response = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols.map(s => `"${s}"`).join(',')}]`,
    { headers: getPublicHeaders() }
  );
  
  if (!response.ok) {
    throw new Error(`Binance HTTP ${response.status}`);
  }
  
  return await response.json();
}

// Données de bougies - APPEL DIRECT BINANCE
export async function fetchKlines(
  symbol: string, 
  interval: string, 
  limit: number = 500
): Promise<any[]> {
  const response = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    { headers: getPublicHeaders() }
  );
  
  if (!response.ok) {
    throw new Error(`Binance HTTP ${response.status}`);
  }
  
  return await response.json();
}

// Profil utilisateur (nécessite API key + JWT auth)
export async function fetchAccountInfo(): Promise<any> {
  if (!hasApiKey()) {
    throw new Error('API Key required');
  }

  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('JWT token required');
  }

  const { apiKey, secretKey } = getBinanceApiKeys();

  // 🔥 Utiliser POST /account avec JWT + clés API dans le body
  const response = await fetch(`${BINANCE_API_URL}/account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ apiKey, secretKey })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
}

// Ordres ouverts (nécessite API key + JWT auth)
export async function fetchOpenOrders(symbol?: string): Promise<any[]> {
  if (!hasApiKey()) {
    throw new Error('API Key required');
  }

  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('JWT token required');
  }

  const { apiKey, secretKey } = getBinanceApiKeys();

  const response = await fetch(`${BINANCE_API_URL}/orders/open${symbol ? `?symbol=${symbol}` : ''}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ apiKey, secretKey })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.orders || [];
}

// Historique des trades (nécessite API key + JWT auth)
export async function fetchMyTrades(symbol: string, limit: number = 500): Promise<any[]> {
  if (!hasApiKey()) {
    throw new Error('API Key required');
  }

  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('JWT token required');
  }

  const { apiKey, secretKey } = getBinanceApiKeys();

  const response = await fetch(`${BINANCE_API_URL}/orders/history?symbol=${symbol}&limit=${limit}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ apiKey, secretKey })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.orders || [];
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
    const { apiKey, secretKey } = getBinanceApiKeys();
    const token = localStorage.getItem('token');
    
    // 🔥 Envoyer les clés au backend via POST (plus sécurisé)
    const response = await fetch(`${BINANCE_API_URL}/account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ apiKey, secretKey })
    });
    
    if (response.ok) {
      return { success: true, message: 'Clés API valides - Accès authentifié' };
    }
    
    const error = await response.json();
    if (response.status === 401 || error.error?.includes('API key')) {
      return { success: false, message: 'Clés API invalides ou permissions insuffisantes' };
    }
    
    return { success: false, message: error.error || `Erreur HTTP ${response.status}` };
  } catch (error) {
    return { success: false, message: 'Erreur de connexion authentifiée' };
  }
}

// Helper to get auth token from localStorage
function getAuthToken(): string | null {
  const token = localStorage.getItem('token');
  return token;
}

// Récupérer le solde du compte via backend
async function fetchAccountBalance(): Promise<{ success: boolean; balances?: any[]; message?: string; demoMode?: boolean }> {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/binance/account`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check if in demo mode
    if (data.demoMode) {
      return { 
        success: true, 
        balances: data.balances,
        demoMode: true,
        message: data.message
      };
    }
    
    return { success: true, balances: data.balances };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export { hasApiKey, fetchAccountBalance, testAuthenticatedConnection };
