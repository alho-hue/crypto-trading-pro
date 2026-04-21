/**
 * 🔄 Service Wallet Binance - NEUROVEST
 * Synchronisation temps réel avec WebSocket
 * Gestion des soldes Spot, Futures et historique
 */

import { getDecryptedKey } from '../utils/crypto';
import { showToast } from '../stores/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';

export interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
  total: string; // free + locked
  valueUSDT: number; // Valeur estimée en USDT
}

export interface WalletSnapshot {
  balances: BinanceBalance[];
  totalUSDT: number;
  totalXOF: number;
  timestamp: number;
  type: 'spot' | 'futures' | 'margin';
}

export interface BinanceTransaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'trade' | 'transfer' | 'fee';
  asset: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: number;
  txHash?: string;
  address?: string;
  network?: string;
  fee?: number;
}

// État global du wallet
let walletState: WalletSnapshot | null = null;
let wsConnection: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000;

// Callbacks pour les mises à jour
const updateCallbacks: Set<(snapshot: WalletSnapshot) => void> = new Set();

/**
 * Récupère les clés API Binance
 */
function getApiKeys() {
  return {
    apiKey: getDecryptedKey('binance_api_key') || '',
    secretKey: getDecryptedKey('binance_secret_key') || ''
  };
}

function hasApiKeys(): boolean {
  const { apiKey, secretKey } = getApiKeys();
  return !!(apiKey && secretKey && apiKey !== 'ta_cle_binance_ici');
}

/**
 * Récupère le solde Spot depuis Binance
 */
export async function fetchSpotBalance(): Promise<{
  success: boolean;
  balances?: BinanceBalance[];
  totalUSDT?: number;
  message?: string;
}> {
  try {
    if (!hasApiKeys()) {
      return {
        success: false,
        message: 'Clés API Binance non configurées. Allez dans Profil > API Binance pour configurer vos clés.'
      };
    }

    const token = localStorage.getItem('token');
    const { apiKey, secretKey } = getApiKeys();

    const response = await fetch(`${API_URL}/api/binance/account`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ apiKey, secretKey })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur ${response.status}`);
    }

    const data = await response.json();

    // Récupérer les prix réels d'abord
    priceCache = await fetchRealPrices();
    lastPriceUpdate = Date.now();
    
    // Calculer les valeurs en USDT avec prix réels
    const balancePromises = data.balances
      .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(async (b: any) => {
        const total = parseFloat(b.free) + parseFloat(b.locked);
        const valueUSDT = await calculateValueUSDT(b.asset, total);
        return {
          asset: b.asset,
          free: b.free,
          locked: b.locked,
          total: total.toFixed(8),
          valueUSDT
        };
      });
    
    const balances = await Promise.all(balancePromises);
    const totalUSDT = balances.reduce((sum, b) => sum + b.valueUSDT, 0);

    // Mettre à jour l'état
    walletState = {
      balances,
      totalUSDT,
      totalXOF: 0, // Sera calculé avec le taux réel dans le service currency
      timestamp: Date.now(),
      type: 'spot'
    };

    // Notifier les listeners
    notifyUpdateCallbacks(walletState);

    return { success: true, balances, totalUSDT };

  } catch (error: any) {
    console.error('Erreur fetchSpotBalance:', error);
    return { 
      success: false, 
      message: error.message || 'Erreur de connexion à Binance'
    };
  }
}

/**
 * Récupère les prix réels depuis Binance
 */
async function fetchRealPrices(): Promise<Record<string, number>> {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price');
    if (!response.ok) throw new Error('Failed to fetch prices');
    
    const data = await response.json();
    const prices: Record<string, number> = { USDT: 1, BUSD: 1, USDC: 1 };
    
    data.forEach((item: { symbol: string; price: string }) => {
      if (item.symbol.endsWith('USDT')) {
        const asset = item.symbol.replace('USDT', '');
        prices[asset] = parseFloat(item.price);
      }
    });
    
    return prices;
  } catch (error) {
    console.error('[binanceWalletService] Erreur prix réels:', error);
    return { USDT: 1, BUSD: 1, USDC: 1 }; // Seulement les stablecoins connus
  }
}

// Cache des prix
let priceCache: Record<string, number> = {};
let lastPriceUpdate = 0;

/**
 * Calcule la valeur USDT d'un actif avec prix réels
 */
async function calculateValueUSDT(asset: string, amount: number): Promise<number> {
  // Rafraîchir le cache si nécessaire (toutes les 30 secondes)
  if (Date.now() - lastPriceUpdate > 30000 || Object.keys(priceCache).length === 0) {
    priceCache = await fetchRealPrices();
    lastPriceUpdate = Date.now();
  }
  
  const price = priceCache[asset];
  if (!price && asset !== 'USDT' && asset !== 'BUSD' && asset !== 'USDC') {
    console.warn(`[binanceWalletService] Prix non disponible pour ${asset}`);
    return 0; // Retourne 0 si pas de prix réel - PAS DE SIMULATION
  }
  
  return amount * (price || 0);
}

/**
 * Calcule le total en USDT (async - utilise prix réels)
 */
async function calculateTotalUSDT(balances: any[]): Promise<number> {
  let total = 0;
  for (const b of balances) {
    const amount = parseFloat(b.free) + parseFloat(b.locked);
    total += await calculateValueUSDT(b.asset, amount);
  }
  return total;
}

/**
 * Récupère l'historique des dépôts/retraits Binance
 */
export async function fetchDepositWithdrawHistory(
  type: 'deposit' | 'withdrawal' = 'deposit',
  startTime?: number,
  endTime?: number
): Promise<{ success: boolean; history?: BinanceTransaction[]; message?: string }> {
  try {
    if (!hasApiKeys()) {
      return { success: false, message: 'Clés API non configurées' };
    }

    const token = localStorage.getItem('token');
    const { apiKey, secretKey } = getApiKeys();

    let url = `${API_URL}/api/binance/${type === 'deposit' ? 'deposits' : 'withdrawals'}`;
    if (startTime) url += `?startTime=${startTime}`;
    if (endTime) url += `${startTime ? '&' : '?'}endTime=${endTime}`;

    const response = await fetch(url, {
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
    
    const history: BinanceTransaction[] = (data[type === 'deposit' ? 'depositList' : 'withdrawList'] || [])
      .map((tx: any) => ({
        id: tx.txId || tx.id,
        type,
        asset: tx.asset || tx.coin,
        amount: parseFloat(tx.amount),
        status: tx.status === 1 ? 'completed' : tx.status === 6 ? 'pending' : 'failed',
        timestamp: tx.insertTime || tx.applyTime,
        txHash: tx.txId,
        address: tx.address,
        network: tx.network
      }));

    return { success: true, history };

  } catch (error: any) {
    console.error('Erreur historique:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Connecte le WebSocket pour mises à jour temps réel
 */
export function connectWalletWebSocket(
  symbols: string[] = ['btcusdt', 'ethusdt', 'bnbusdt']
): WebSocket | null {
  try {
    if (wsConnection?.readyState === WebSocket.OPEN) {
      return wsConnection;
    }

    // Flux de prix en temps réel
    const streams = symbols.map(s => `${s}@ticker`).join('/');
    const ws = new WebSocket(`${BINANCE_WS_URL}/${streams}`);

    ws.onopen = () => {
      console.log('[Wallet WS] Connecté');
      reconnectAttempts = 0;
      showToast.success('Connexion temps réel établie', 'Wallet');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Mettre à jour les prix
        if (data.s && data.c) {
          const symbol = data.s.replace('USDT', '');
          const price = parseFloat(data.c);
          
          // Mettre à jour les valeurs du wallet
          if (walletState) {
            let updated = false;
            walletState.balances = walletState.balances.map(b => {
              if (b.asset === symbol) {
                updated = true;
                return {
                  ...b,
                  valueUSDT: parseFloat(b.total) * price
                };
              }
              return b;
            });
            
            if (updated) {
              walletState.totalUSDT = walletState.balances.reduce((sum, b) => sum + b.valueUSDT, 0);
              walletState.timestamp = Date.now();
              notifyUpdateCallbacks(walletState);
            }
          }
        }
      } catch (error) {
        console.error('[Wallet WS] Erreur parsing:', error);
      }
    };

    ws.onclose = () => {
      console.log('[Wallet WS] Déconnecté');
      
      // Reconnexion automatique
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(() => {
          console.log(`[Wallet WS] Tentative reconnexion ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
          connectWalletWebSocket(symbols);
        }, RECONNECT_DELAY * reconnectAttempts);
      }
    };

    ws.onerror = (error) => {
      console.error('[Wallet WS] Erreur:', error);
    };

    wsConnection = ws;
    return ws;

  } catch (error) {
    console.error('Erreur connexion WS:', error);
    return null;
  }
}

/**
 * Déconnecte le WebSocket
 */
export function disconnectWalletWebSocket(): void {
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
}

/**
 * S'abonne aux mises à jour du wallet
 */
export function subscribeToWalletUpdates(
  callback: (snapshot: WalletSnapshot) => void
): () => void {
  updateCallbacks.add(callback);
  
  // Retourne fonction de désinscription
  return () => {
    updateCallbacks.delete(callback);
  };
}

/**
 * Notifie tous les listeners
 */
function notifyUpdateCallbacks(snapshot: WalletSnapshot): void {
  updateCallbacks.forEach(cb => {
    try {
      cb(snapshot);
    } catch (error) {
      console.error('Erreur callback wallet:', error);
    }
  });
}

/**
 * Récupère l'état actuel du wallet
 */
export function getWalletState(): WalletSnapshot | null {
  return walletState;
}

/**
 * Force le rafraîchissement du wallet
 */
export async function refreshWallet(): Promise<boolean> {
  const result = await fetchSpotBalance();
  return result.success;
}

/**
 * Vérifie si le wallet est en mode démo
 */
export function isDemoMode(): boolean {
  return !hasApiKeys();
}

/**
 * Formatte un solde pour affichage
 */
export function formatBalance(balance: BinanceBalance): string {
  const total = parseFloat(balance.total);
  
  if (balance.asset === 'USDT' || balance.asset === 'BUSD' || balance.asset === 'USDC') {
    return total.toFixed(2);
  }
  
  if (balance.asset === 'BTC') {
    return total.toFixed(6);
  }
  
  if (balance.asset === 'ETH') {
    return total.toFixed(4);
  }
  
  return total.toFixed(4);
}

// Cleanup
window.addEventListener('beforeunload', () => {
  disconnectWalletWebSocket();
});
