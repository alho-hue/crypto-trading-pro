import { getDecryptedKey } from '../utils/crypto';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const BINANCE_API_URL = 'https://api.binance.com/api/v3';

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

export interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity?: number;
  price?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  symbol?: string;
  side?: string;
  type?: string;
  price?: string;
  origQty?: string;
  executedQty?: string;
  status?: string;
  transactTime?: number;
  fills?: Array<{
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }>;
  message?: string;
}

/**
 * Placer un ordre spot via le BACKEND (sécurisé)
 */
export async function placeSpotOrder(params: OrderParams): Promise<OrderResult> {
  try {
    // 🔥 APPEL AU BACKEND - pas directement à Binance (CORS + sécurité)
    const token = localStorage.getItem('token');
    
    // Récupérer les clés API (chiffrées dans localStorage)
    const apiKey = getDecryptedKey('binance_api_key');
    const secretKey = getDecryptedKey('binance_secret_key');
    
    if (!apiKey || !secretKey) {
      return { success: false, message: 'Clés API Binance non configurées. Allez dans Paramètres.' };
    }
    
    const response = await fetch(`${API_URL}/api/binance/order`, {
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
        price: data.price || data.fills?.[0]?.price || params.price,
        origQty: data.origQty,
        executedQty: data.executedQty,
        status: data.status,
        transactTime: data.transactTime,
        fills: data.fills,
      };
    } else {
      return {
        success: false,
        message: data.error || data.msg || `Erreur ${response.status}`,
      };
    }
  } catch (error) {
    console.error('Order error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur lors du placement de l\'ordre',
    };
  }
}

/**
 * Récupérer les ordres ouverts
 */
export async function getOpenOrders(symbol?: string): Promise<any[]> {
  try {
    const apiKey = getDecryptedKey('binance_api_key');
    const secretKey = getDecryptedKey('binance_secret_key');
    
    if (!apiKey || !secretKey) return [];

    const timestamp = Date.now();
    let queryString = `timestamp=${timestamp}`;
    if (symbol) queryString += `&symbol=${symbol}`;
    
    // Generate signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', 
      encoder.encode(secretKey), 
      { name: 'HMAC', hash: 'SHA-256' }, 
      false, 
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const response = await fetch(`${BINANCE_API_URL}/openOrders?${queryString}&signature=${signature}`, {
      headers: getAuthHeaders(),
    });
    
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Error fetching open orders:', error);
    return [];
  }
}

/**
 * Annuler un ordre
 */
export async function cancelOrder(symbol: string, orderId: string): Promise<boolean> {
  try {
    const apiKey = getDecryptedKey('binance_api_key');
    const secretKey = getDecryptedKey('binance_secret_key');
    
    if (!apiKey || !secretKey) return false;

    const timestamp = Date.now();
    const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
    
    // Generate signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', 
      encoder.encode(secretKey), 
      { name: 'HMAC', hash: 'SHA-256' }, 
      false, 
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const response = await fetch(`${BINANCE_API_URL}/order?${queryString}&signature=${signature}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error cancelling order:', error);
    return false;
  }
}

/**
 * Récupérer l'historique des ordres
 */
export async function getOrderHistory(symbol: string, limit: number = 50): Promise<any[]> {
  try {
    const apiKey = getDecryptedKey('binance_api_key');
    const secretKey = getDecryptedKey('binance_secret_key');
    
    if (!apiKey || !secretKey) return [];

    const timestamp = Date.now();
    const queryString = `symbol=${symbol}&limit=${limit}&timestamp=${timestamp}`;
    
    // Generate signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', 
      encoder.encode(secretKey), 
      { name: 'HMAC', hash: 'SHA-256' }, 
      false, 
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const response = await fetch(`${BINANCE_API_URL}/allOrders?${queryString}&signature=${signature}`, {
      headers: getAuthHeaders(),
    });
    
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Error fetching order history:', error);
    return [];
  }
}
