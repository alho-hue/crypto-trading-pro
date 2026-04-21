import { getDecryptedKey } from '../utils/crypto';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const FUTURES_API_URL = 'https://fapi.binance.com/fapi/v1';

async function generateSignature(queryString: string): Promise<string> {
  const secret = getDecryptedKey('binance_secret_key');
  if (!secret) throw new Error('Clé secrète non configurée');
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', 
    encoder.encode(secret), 
    { name: 'HMAC', hash: 'SHA-256' }, 
    false, 
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function getAuthHeaders() {
  const apiKey = getDecryptedKey('binance_api_key');
  return {
    'X-MBX-APIKEY': apiKey || '',
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

export interface FuturesOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  leverage?: number;
}

export interface FuturesOrderResult {
  success: boolean;
  orderId?: string;
  symbol?: string;
  side?: string;
  type?: string;
  price?: string;
  origQty?: string;
  executedQty?: string;
  status?: string;
  avgPrice?: string;
  message?: string;
}

export interface FuturesPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unrealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  isolatedMargin: string;
  notionalValue: string;
  marginType: string;
}

export interface FuturesAccountInfo {
  totalWalletBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  availableBalance: string;
  positions: FuturesPosition[];
}

/**
 * Récupérer les informations du compte Futures
 */
export async function getFuturesAccountInfo(): Promise<{ success: boolean; data?: FuturesAccountInfo; message?: string }> {
  try {
    const apiKey = getDecryptedKey('binance_api_key');
    const secretKey = getDecryptedKey('binance_secret_key');
    
    if (!apiKey || !secretKey) {
      return { success: false, message: 'Clés API non configurées' };
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = await generateSignature(queryString);
    
    const response = await fetch(`${FUTURES_API_URL}/account?${queryString}&signature=${signature}`, {
      headers: getAuthHeaders(),
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        data: {
          totalWalletBalance: data.totalWalletBalance,
          totalUnrealizedProfit: data.totalUnrealizedProfit,
          totalMarginBalance: data.totalMarginBalance,
          availableBalance: data.availableBalance,
          positions: data.positions.filter((p: any) => parseFloat(p.positionAmt) !== 0)
        }
      };
    } else {
      const error = await response.json();
      return { success: false, message: error.msg || 'Erreur de récupération du compte' };
    }
  } catch (error) {
    return { success: false, message: 'Erreur réseau' };
  }
}

/**
 * Placer un ordre Futures via le BACKEND (sécurisé)
 */
export async function placeFuturesOrder(params: FuturesOrderParams): Promise<FuturesOrderResult> {
  try {
    // 🔥 APPEL AU BACKEND - pas directement à Binance (CORS + sécurité)
    const token = localStorage.getItem('token');
    
    // Récupérer les clés API (chiffrées dans localStorage)
    const apiKey = getDecryptedKey('binance_api_key');
    const secretKey = getDecryptedKey('binance_secret_key');
    
    if (!apiKey || !secretKey) {
      return { success: false, message: 'Clés API Binance non configurées. Allez dans Paramètres.' };
    }
    
    const response = await fetch(`${API_URL}/api/binance/futures/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity,
        price: params.price,
        timeInForce: params.timeInForce || 'GTC',
        leverage: params.leverage,
        apiKey,      // 🔥 Envoyer au backend
        secretKey    // 🔥 Envoyer au backend
      })
    });
    
    const data = await response.json();
    
    if (response.ok && !data.error) {
      return {
        success: true,
        orderId: data.orderId?.toString(),
        symbol: data.symbol,
        side: data.side,
        type: data.type,
        price: data.price || data.avgPrice,
        origQty: data.origQty,
        executedQty: data.executedQty,
        status: data.status,
        avgPrice: data.avgPrice,
      };
    } else {
      return {
        success: false,
        message: data.error || data.msg || `Erreur ${response.status}`,
      };
    }
  } catch (error) {
    console.error('Futures order error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur lors du placement de l\'ordre',
    };
  }
}

/**
 * Définir le type de marge (ISOLATED ou CROSSED)
 */
export async function setMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSSED'): Promise<boolean> {
  try {
    const apiKey = getDecryptedKey('binance_api_key');
    const secretKey = getDecryptedKey('binance_secret_key');
    
    if (!apiKey || !secretKey) return false;

    const timestamp = Date.now();
    const queryString = `symbol=${symbol}&marginType=${marginType}&timestamp=${timestamp}`;
    const signature = await generateSignature(queryString);
    
    const response = await fetch(`${FUTURES_API_URL}/marginType?${queryString}&signature=${signature}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    
    return response.ok || response.status === 404; // 404 = déjà configuré
  } catch (error) {
    return false;
  }
}

/**
 * Définir le levier pour un symbole
 */
export async function setLeverage(symbol: string, leverage: number): Promise<boolean> {
  try {
    const apiKey = getDecryptedKey('binance_api_key');
    const secretKey = getDecryptedKey('binance_secret_key');
    
    if (!apiKey || !secretKey) return false;

    const timestamp = Date.now();
    const queryString = `symbol=${symbol}&leverage=${leverage}&timestamp=${timestamp}`;
    const signature = await generateSignature(queryString);
    
    const response = await fetch(`${FUTURES_API_URL}/leverage?${queryString}&signature=${signature}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Fermer une position (market close)
 */
export async function closePosition(symbol: string, side: 'BUY' | 'SELL', quantity: number): Promise<FuturesOrderResult> {
  return placeFuturesOrder({
    symbol,
    side,
    type: 'MARKET',
    quantity,
  });
}

/**
 * Récupérer les positions ouvertes
 */
export async function getOpenPositions(): Promise<FuturesPosition[]> {
  const result = await getFuturesAccountInfo();
  if (result.success && result.data) {
    return result.data.positions;
  }
  return [];
}
