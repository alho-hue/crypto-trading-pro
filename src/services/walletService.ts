import { showToast } from '../stores/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface DepositRequest {
  amount: number;
  currency: 'USDT' | 'BTC' | 'ETH';
  method: 'mobile_money' | 'bank_transfer' | 'crypto';
  phoneNumber?: string;
  network?: 'MTN' | 'Orange' | 'Wave' | 'Moov';
  txHash?: string;
}

export interface WithdrawalRequest {
  amount: number;
  currency: 'USDT' | 'BTC' | 'ETH';
  method: 'mobile_money' | 'bank_transfer' | 'crypto';
  phoneNumber?: string;
  network?: 'MTN' | 'Orange' | 'Wave' | 'Moov';
  walletAddress?: string;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

export interface ConversionRequest {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'conversion';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  method: string;
  createdAt: string;
  completedAt?: string;
  fee?: number;
  metadata?: any;
}

// Helper to get auth token
function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

/**
 * Request a deposit via Mobile Money or other methods
 */
export async function requestDeposit(data: DepositRequest): Promise<{ success: boolean; transaction?: Transaction; message?: string }> {
  try {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }

    const response = await fetch(`${API_URL}/api/wallet/deposit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    
    if (response.ok) {
      showToast.success('Demande de dépôt créée avec succès', 'Dépôt');
      return { success: true, transaction: result.transaction };
    } else {
      showToast.error(result.message || 'Erreur lors de la création du dépôt', 'Erreur');
      return { success: false, message: result.message };
    }
  } catch (error) {
    showToast.error('Erreur réseau', 'Erreur');
    return { success: false, message: 'Erreur réseau' };
  }
}

/**
 * Request a withdrawal
 */
export async function requestWithdrawal(data: WithdrawalRequest): Promise<{ success: boolean; transaction?: Transaction; message?: string }> {
  try {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }

    const response = await fetch(`${API_URL}/api/wallet/withdrawal`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    
    if (response.ok) {
      showToast.success('Demande de retrait créée avec succès', 'Retrait');
      return { success: true, transaction: result.transaction };
    } else {
      showToast.error(result.message || 'Erreur lors de la création du retrait', 'Erreur');
      return { success: false, message: result.message };
    }
  } catch (error) {
    showToast.error('Erreur réseau', 'Erreur');
    return { success: false, message: 'Erreur réseau' };
  }
}

/**
 * Convert between currencies
 */
export async function convertCurrency(data: ConversionRequest): Promise<{ success: boolean; result?: { fromAmount: number; toAmount: number; rate: number; fee: number }; message?: string }> {
  try {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }

    const response = await fetch(`${API_URL}/api/wallet/convert`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    
    if (response.ok) {
      showToast.success(`Conversion ${data.fromCurrency} → ${data.toCurrency} effectuée`, 'Conversion');
      return { success: true, result: result };
    } else {
      showToast.error(result.message || 'Erreur lors de la conversion', 'Erreur');
      return { success: false, message: result.message };
    }
  } catch (error) {
    showToast.error('Erreur réseau', 'Erreur');
    return { success: false, message: 'Erreur réseau' };
  }
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(): Promise<{ success: boolean; transactions?: Transaction[]; message?: string }> {
  try {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }

    const response = await fetch(`${API_URL}/api/wallet/transactions`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    
    if (response.ok) {
      return { success: true, transactions: result.transactions };
    } else {
      return { success: false, message: result.message };
    }
  } catch (error) {
    return { success: false, message: 'Erreur réseau' };
  }
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(): Promise<{ success: boolean; balance?: { usdt: number; btc: number; eth: number; xof: number }; message?: string }> {
  try {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }

    const response = await fetch(`${API_URL}/api/wallet/balance`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    
    if (response.ok) {
      return { success: true, balance: result.balance };
    } else {
      return { success: false, message: result.message };
    }
  } catch (error) {
    return { success: false, message: 'Erreur réseau' };
  }
}

// Mobile Money providers for West Africa
export const MOBILE_MONEY_PROVIDERS = [
  { id: 'MTN', name: 'MTN Mobile Money', countries: ['CI', 'GH', 'CM', 'UG', 'RW', 'ZM'], color: '#FFCC00' },
  { id: 'Orange', name: 'Orange Money', countries: ['CI', 'SN', 'ML', 'BF', 'CM', 'MG'], color: '#FF6600' },
  { id: 'Wave', name: 'Wave', countries: ['CI', 'SN', 'ML'], color: '#1E90FF' },
  { id: 'Moov', name: 'Moov Money', countries: ['CI', 'TG', 'BJ'], color: '#0066CC' },
];

// Conversion rates - Utilise l'API backend pour les taux réels
export async function getRealConversionRate(from: string, to: string): Promise<number> {
  try {
    const response = await fetch(`/api/wallet/exchange-rate`);
    if (response.ok) {
      const data = await response.json();
      if (from === 'USDT' && to === 'XOF') return data.rate;
      if (from === 'XOF' && to === 'USDT') return 1 / data.rate;
    }
    
    // Fallback sur API externe si backend indisponible
    const resp = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await resp.json();
    if (data.rates?.XOF) {
      return from === 'USDT' ? data.rates.XOF : 1 / data.rates.XOF;
    }
    throw new Error('Taux non disponible');
  } catch (error) {
    console.error('Erreur taux conversion:', error);
    throw new Error('Impossible de récupérer le taux de conversion réel');
  }
}

export async function calculateConversion(from: string, to: string, amount: number): Promise<{ toAmount: number; rate: number; fee: number }> {
  const rate = await getRealConversionRate(from, to);
  const toAmount = amount * rate;
  const fee = toAmount * 0.005; // 0.5% fee
  return { toAmount: toAmount - fee, rate, fee };
}
