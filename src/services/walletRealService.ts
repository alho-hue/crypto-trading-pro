/**
 * 💰 Wallet Service Réel - NEUROVEST
 * Orchestration des opérations financières
 * Intègre: Binance, Mobile Money, Sécurité, Conversions
 */

import { showToast } from '../stores/toastStore';
import { 
  fetchSpotBalance, 
  fetchDepositWithdrawHistory,
  subscribeToWalletUpdates,
  refreshWallet,
  formatBalance,
  BinanceBalance,
  WalletSnapshot
} from './binanceWalletService';
import {
  initiateMobileMoneyDeposit,
  initiateMobileMoneyWithdrawal,
  checkMobileMoneyStatus,
  calculateMobileMoneyFees,
  MobileMoneyProvider,
  MobileMoneyRequest
} from './mobileMoneyService';
import {
  calculateConversion,
  convertToXOF,
  formatXOF,
  formatCrypto,
  ConversionResult
} from './currencyService';
import{
  validateTransaction,
  requires2FA,
  verify2FACode,
  is2FASessionValid,
  generateConfirmationCode,
  storeConfirmationCode,
  verifyConfirmationCode,
  logSecurityAction,
  VerificationResult
} from './securityService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Types
export type TransactionType = 'deposit' | 'withdrawal' | 'conversion' | 'transfer';
export type TransactionMethod = 'mobile_money' | 'crypto' | 'bank_transfer' | 'internal';
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface WalletTransaction {
  id: string;
  type: TransactionType;
  method: TransactionMethod;
  amount: number;
  currency: string;
  status: TransactionStatus;
  fee: number;
  netAmount: number;
  description?: string;
  metadata?: {
    provider?: MobileMoneyProvider;
    phoneNumber?: string;
    txHash?: string;
    address?: string;
    conversionRate?: number;
    fromCurrency?: string;
    toCurrency?: string;
  };
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  userId: string;
}

export interface WalletState {
  balances: BinanceBalance[];
  totalUSDT: number;
  totalXOF: number;
  transactions: WalletTransaction[];
  pendingTransactions: number;
  lastUpdate: number;
  isDemoMode: boolean;
}

export interface DepositCryptoRequest {
  amount: number;
  currency: string;
  txHash: string;
  network: string;
}

export interface WithdrawCryptoRequest {
  amount: number;
  currency: string;
  address: string;
  network: string;
  memo?: string;
}

// État global
let currentState: WalletState | null = null;
const stateCallbacks: Set<(state: WalletState) => void> = new Set();

/**
 * Initialise le wallet avec données réelles
 */
export async function initializeWallet(): Promise<{ success: boolean; state?: WalletState; message?: string }> {
  try {
    // Charger solde Binance
    const balanceResult = await fetchSpotBalance();
    
    if (!balanceResult.success) {
      return { 
        success: false, 
        message: balanceResult.message || 'Erreur chargement wallet'
      };
    }

    // Charger historique transactions
    const historyResult = await fetchWalletTransactions(50);
    
    // Calculer total XOF avec taux réel
    const totalUSDT = balanceResult.totalUSDT || 0;
    const totalXOF = await convertToXOF(totalUSDT);
    
    // 🔥 DEBUG: Vérifier la conversion
    console.log('[WalletReal] Conversion:', {
      totalUSDT,
      totalXOF,
      rateUsed: totalXOF / (totalUSDT || 1),
      timestamp: new Date().toISOString()
    });

    // Créer état
    currentState = {
      balances: balanceResult.balances || [],
      totalUSDT,
      totalXOF,
      transactions: historyResult.success ? historyResult.transactions! : [],
      pendingTransactions: 0,
      lastUpdate: Date.now(),
      isDemoMode: false
    };

    // S'abonner aux mises à jour temps réel
    subscribeToWalletUpdates((snapshot) => {
      if (currentState) {
        currentState.balances = snapshot.balances;
        currentState.totalUSDT = snapshot.totalUSDT;
        // Conversion avec taux réel via API - PAS DE TAUX FIXE
        convertToXOF(snapshot.totalUSDT).then(totalXOF => {
          if (currentState) {
            currentState.totalXOF = totalXOF;
            currentState.lastUpdate = Date.now();
            notifyStateCallbacks(currentState);
          }
        });
      }
    });

    return { success: true, state: currentState };

  } catch (error: any) {
    console.error('Erreur init wallet:', error);
    return {
      success: false,
      message: error.message || 'Erreur lors du chargement du wallet. Vérifiez votre connexion et vos clés API.'
    };
  }
}

/**
 * Effectue un dépôt via Mobile Money
 */
export async function depositMobileMoney(
  amount: number, // en FCFA
  phoneNumber: string,
  provider: MobileMoneyProvider
): Promise<{ success: boolean; transaction?: WalletTransaction; requiresVerification?: boolean; message?: string }> {
  try {
    // Validation
    if (amount < 100) {
      return { success: false, message: 'Montant minimum: 100 FCFA' };
    }

    // Sécurité: vérifier si 2FA requis pour gros montants
    const usdtAmount = amount / 605; // Conversion approximative
    if (requires2FA(usdtAmount, 'deposit')) {
      if (!is2FASessionValid()) {
        return { 
          success: false, 
          requiresVerification: true,
          message: 'Vérification 2FA requise pour ce montant'
        };
      }
    }

    // Appeler service Mobile Money
    const result = await initiateMobileMoneyDeposit({
      amount,
      phoneNumber,
      provider,
      description: 'Dépôt NEUROVEST'
    });

    if (result.success && result.transaction) {
      // Log sécurité
      await logSecurityAction('mobile_deposit_initiated', {
        amount,
        provider,
        transactionId: result.transaction.id
      });

      // Rafraîchir état
      await refreshWallet();

      return {
        success: true,
        transaction: {
          id: result.transaction.id,
          type: 'deposit',
          method: 'mobile_money',
          amount,
          currency: 'XOF',
          status: 'pending',
          fee: calculateMobileMoneyFees(amount, provider).fees,
          netAmount: calculateMobileMoneyFees(amount, provider).netAmount,
          metadata: {
            provider,
            phoneNumber
          },
          createdAt: new Date().toISOString(),
          userId: '' // Rempli par backend
        },
        message: `Dépôt ${amount.toLocaleString()} FCFA initié. Confirmez sur ${provider}.`
      };
    }

    return { success: false, message: result.message || 'Erreur dépôt' };

  } catch (error: any) {
    console.error('Erreur dépôt MM:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Effectue un retrait via Mobile Money
 */
export async function withdrawMobileMoney(
  amountUSDT: number,
  phoneNumber: string,
  provider: MobileMoneyProvider
): Promise<{ success: boolean; transaction?: WalletTransaction; requiresVerification?: boolean; message?: string }> {
  try {
    // Validation sécurité
    const validation = await validateTransaction('withdrawal', amountUSDT, 'USDT');
    if (!validation.success) {
      return {
        success: false,
        requiresVerification: validation.requires2FA,
        message: validation.message
      };
    }

    // Vérifier solde suffisant
    if (currentState && currentState.totalUSDT < amountUSDT) {
      return { success: false, message: 'Solde insuffisant' };
    }

    // Convertir en FCFA
    const amountXOF = await convertToXOF(amountUSDT);

    // Générer code de confirmation
    const confirmCode = generateConfirmationCode();
    storeConfirmationCode(confirmCode, 300); // 5 min

    // Envoyer notification avec code
    showToast.info(
      `Code de confirmation: ${confirmCode}`,
      'Validez votre retrait'
    );

    // Appeler service
    const result = await initiateMobileMoneyWithdrawal({
      amount: amountXOF,
      phoneNumber,
      provider,
      description: 'Retrait NEUROVEST'
    });

    if (result.success) {
      await logSecurityAction('mobile_withdrawal_initiated', {
        amount: amountUSDT,
        provider,
        transactionId: result.transaction?.id
      });

      await refreshWallet();

      return {
        success: true,
        transaction: {
          id: result.transaction?.id || '',
          type: 'withdrawal',
          method: 'mobile_money',
          amount: amountUSDT,
          currency: 'USDT',
          status: 'pending',
          fee: amountUSDT * 0.015, // 1.5%
          netAmount: amountUSDT * 0.985,
          metadata: {
            provider,
            phoneNumber
          },
          createdAt: new Date().toISOString(),
          userId: ''
        },
        message: `Retrait ${amountUSDT.toFixed(2)} USDT initié vers ${phoneNumber}`
      };
    }

    return { success: false, message: result.message };

  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Effectue un dépôt crypto
 */
export async function depositCrypto(
  request: DepositCryptoRequest
): Promise<{ success: boolean; transaction?: WalletTransaction; message?: string }> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }

    const response = await fetch(`${API_URL}/api/wallet/deposit/crypto`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    const result = await response.json();

    if (response.ok) {
      await logSecurityAction('crypto_deposit', {
        amount: request.amount,
        currency: request.currency,
        txHash: request.txHash
      });

      await refreshWallet();

      return {
        success: true,
        transaction: result.transaction,
        message: 'Dépôt crypto enregistré. En attente de confirmation...'
      };
    }

    return { success: false, message: result.message };

  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Effectue un retrait crypto
 */
export async function withdrawCrypto(
  request: WithdrawCryptoRequest
): Promise<{ success: boolean; transaction?: WalletTransaction; requiresVerification?: boolean; message?: string }> {
  try {
    // Validation sécurité
    const validation = await validateTransaction('withdrawal', request.amount, request.currency);
    if (!validation.success) {
      return {
        success: false,
        requiresVerification: true,
        message: validation.message
      };
    }

    // Vérifier solde
    if (currentState) {
      const balance = currentState.balances.find(b => b.asset === request.currency);
      const available = parseFloat(balance?.free || '0');
      if (available < request.amount) {
        return { success: false, message: `Solde ${request.currency} insuffisant` };
      }
    }

    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }

    const response = await fetch(`${API_URL}/api/wallet/withdrawal/crypto`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    const result = await response.json();

    if (response.ok) {
      await logSecurityAction('crypto_withdrawal', {
        amount: request.amount,
        currency: request.currency,
        address: request.address
      });

      await refreshWallet();

      return {
        success: true,
        transaction: result.transaction,
        message: `Retrait ${request.amount} ${request.currency} initié`
      };
    }

    return { success: false, message: result.message };

  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Convertit des devises
 */
export async function convertWalletCurrency(
  fromCurrency: string,
  toCurrency: string,
  amount: number
): Promise<{ success: boolean; result?: ConversionResult; transaction?: WalletTransaction; message?: string }> {
  try {
    // Calculer conversion
    const conversion = await calculateConversion(fromCurrency, toCurrency, amount, {
      includeFees: true,
      feePercent: 0.5
    });

    // Vérifier solde suffisant
    if (currentState) {
      const balance = currentState.balances.find(b => b.asset === fromCurrency);
      const available = parseFloat(balance?.free || '0');
      if (available < amount) {
        return { success: false, message: `Solde ${fromCurrency} insuffisant` };
      }
    }

    // Validation sécurité (si conversion > 1000 USDT)
    const usdtValue = fromCurrency === 'USDT' ? amount : conversion.toAmount;
    if (usdtValue > 1000) {
      const validation = await validateTransaction('conversion', usdtValue, 'USDT');
      if (!validation.success) {
        return { success: false, message: validation.message };
      }
    }

    // Appel API pour exécuter conversion
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/wallet/convert`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fromCurrency, toCurrency, amount })
    });

    const result = await response.json();

    if (response.ok) {
      await refreshWallet();

      return {
        success: true,
        result: conversion,
        transaction: result.transaction,
        message: `Conversion ${amount} ${fromCurrency} → ${conversion.netAmount.toFixed(4)} ${toCurrency}`
      };
    }

    return { success: false, message: result.message };

  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Récupère l'historique des transactions
 */
export async function fetchWalletTransactions(
  limit: number = 50
): Promise<{ success: boolean; transactions?: WalletTransaction[]; message?: string }> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }

    const response = await fetch(`${API_URL}/api/wallet/transactions?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (response.ok) {
      return { success: true, transactions: result.transactions };
    }

    return { success: false, message: result.message };

  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * S'abonne aux mises à jour du wallet
 */
export function subscribeWalletUpdates(
  callback: (state: WalletState) => void
): () => void {
  stateCallbacks.add(callback);
  
  // Retourner fonction de désinscription
  return () => {
    stateCallbacks.delete(callback);
  };
}

function notifyStateCallbacks(state: WalletState): void {
  stateCallbacks.forEach(cb => {
    try {
      cb(state);
    } catch (error) {
      console.error('Erreur callback:', error);
    }
  });
}

/**
 * Récupère l'état actuel
 */
export function getCurrentWalletState(): WalletState | null {
  return currentState;
}

/**
 * Récupère le taux de change USDT/XOF en temps réel
 */
export async function getExchangeRate(): Promise<{ success: boolean; rate?: number; message?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/wallet/exchange-rate`);
    const result = await response.json();
    
    if (response.ok) {
      return { success: true, rate: result.rate };
    }
    
    return { success: false, message: result.error };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Valide une adresse crypto
 */
export async function validateCryptoAddress(
  address: string, 
  network: string
): Promise<{ success: boolean; valid?: boolean; message?: string }> {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/wallet/validate-address`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address, network })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      return { success: true, valid: result.valid };
    }
    
    return { success: false, message: result.error };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Récupère les statistiques du wallet
 */
export async function getWalletStats(): Promise<{ success: boolean; stats?: any; message?: string }> {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/wallet/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      return { success: true, stats: result.stats };
    }
    
    return { success: false, message: result.error };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Vérifie si une transaction est confirmée
 */
export async function checkTransactionStatus(
  transactionId: string
): Promise<{ success: boolean; status?: TransactionStatus; message?: string }> {
  // Vérifier d'abord si c'est une transaction Mobile Money
  const mmResult = await checkMobileMoneyStatus(transactionId);
  if (mmResult.success) {
    return {
      success: true,
      status: mmResult.status as TransactionStatus
    };
  }

  // Sinon, vérifier via API standard
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/wallet/transaction/${transactionId}/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    return {
      success: response.ok,
      status: result.status,
      message: result.message
    };

  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Exporte les données du wallet
 */
export function exportWalletData(): { 
  balances: BinanceBalance[]; 
  totalUSDT: number; 
  totalXOF: string;
  timestamp: string;
} {
  const state = currentState || {
    balances: [],
    totalUSDT: 0,
    totalXOF: 0
  };

  return {
    balances: state.balances,
    totalUSDT: state.totalUSDT,
    totalXOF: formatXOF(state.totalXOF),
    timestamp: new Date().toISOString()
  };
}

// Réexporte pour utilisation dans Wallet.tsx
export {
  formatXOF,
  formatCrypto,
  formatBalance,
  calculateConversion,
  convertToXOF,
  verify2FACode,
  is2FASessionValid,
  generateConfirmationCode,
  verifyConfirmationCode
};
