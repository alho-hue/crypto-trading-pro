/**
 * 📱 Service Mobile Money - NEUROVEST
 * Structure pour intégration opérateurs mobile (MTN, Orange, Wave, etc.)
 * Prêt pour intégration API externe
 */

import { showToast } from '../stores/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Opérateurs supportés en Afrique de l'Ouest
export const MOBILE_MONEY_PROVIDERS = [
  { 
    id: 'MTN', 
    name: 'MTN Mobile Money', 
    countries: ['CI', 'GH', 'CM', 'UG', 'RW', 'ZM'], 
    color: '#FFCC00',
    logo: 'mtn',
    maxAmount: 2000000, // 2M FCFA
    minAmount: 100
  },
  { 
    id: 'Orange', 
    name: 'Orange Money', 
    countries: ['CI', 'SN', 'ML', 'BF', 'CM', 'MG'], 
    color: '#FF6600',
    logo: 'orange',
    maxAmount: 3000000, // 3M FCFA
    minAmount: 100
  },
  { 
    id: 'Wave', 
    name: 'Wave', 
    countries: ['CI', 'SN', 'ML'], 
    color: '#1E90FF',
    logo: 'wave',
    maxAmount: 1000000, // 1M FCFA
    minAmount: 50
  },
  { 
    id: 'Moov', 
    name: 'Moov Money', 
    countries: ['CI', 'TG', 'BJ'], 
    color: '#0066CC',
    logo: 'moov',
    maxAmount: 1500000, // 1.5M FCFA
    minAmount: 100
  }
] as const;

export type MobileMoneyProvider = typeof MOBILE_MONEY_PROVIDERS[number]['id'];

export interface MobileMoneyRequest {
  amount: number; // en FCFA (XOF)
  phoneNumber: string;
  provider: MobileMoneyProvider;
  reference?: string;
  description?: string;
}

export interface MobileMoneyTransaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  provider: MobileMoneyProvider;
  phoneNumber: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  reference: string;
  externalReference?: string;
  createdAt: string;
  processedAt?: string;
  failureReason?: string;
  retryCount: number;
}

export interface ProviderStatus {
  provider: MobileMoneyProvider;
  available: boolean;
  maintenance: boolean;
  processingTime: string; // "instant", "5min", "24h"
  fees: {
    percent: number;
    fixed: number;
  };
}

/**
 * Vérifie si un numéro de téléphone est valide pour un opérateur
 */
export function validatePhoneNumber(phone: string, provider: MobileMoneyProvider): boolean {
  // Nettoyer le numéro
  const clean = phone.replace(/\s/g, '').replace(/\+/g, '');
  
  // Patterns par opérateur (Afrique de l'Ouest)
  const patterns: Record<MobileMoneyProvider, RegExp> = {
    'MTN': /^\+?(225|233|237)\d{8,9}$/,
    'Orange': /^\+?(225|221|223)\d{8,9}$/,
    'Wave': /^\+?(221|223)\d{8,9}$/, // Principalement Sénégal/Mali
    'Moov': /^\+?(225|228|229)\d{8,9}$/
  };
  
  return patterns[provider].test(clean);
}

/**
 * Formatte un numéro de téléphone pour l'affichage
 */
export function formatPhoneNumber(phone: string): string {
  const clean = phone.replace(/\s/g, '').replace(/\+/g, '');
  
  if (clean.length === 10) {
    return `+${clean.slice(0, 3)} ${clean.slice(3, 5)} ${clean.slice(5, 7)} ${clean.slice(7, 10)}`;
  }
  
  if (clean.length === 12) {
    return `+${clean.slice(0, 3)} ${clean.slice(3, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 10)} ${clean.slice(10, 12)}`;
  }
  
  return `+${clean}`;
}

/**
 * Détecte l'opérateur depuis un numéro de téléphone
 */
export function detectProvider(phone: string): MobileMoneyProvider | null {
  const clean = phone.replace(/\s/g, '').replace(/\+/g, '');
  
  // Préfixes par opérateur (Côte d'Ivoire)
  const prefixes: Record<string, MobileMoneyProvider[]> = {
    '05': ['MTN'],
    '06': ['MTN'],
    '07': ['Orange', 'Moov'],
    '01': ['Moov'],
    '04': ['MTN'],
  };
  
  // Extraire le préfixe
  const prefix = clean.slice(-10, -8);
  
  return prefixes[prefix]?.[0] || null;
}

/**
 * Initie un dépôt Mobile Money
 * En production: appelle l'API de l'opérateur
 * En mode dev: simulation avec webhook
 */
export async function initiateMobileMoneyDeposit(
  request: MobileMoneyRequest
): Promise<{ success: boolean; transaction?: MobileMoneyTransaction; message?: string }> {
  try {
    // Validation
    if (!validatePhoneNumber(request.phoneNumber, request.provider)) {
      return { success: false, message: 'Numéro de téléphone invalide' };
    }
    
    const provider = MOBILE_MONEY_PROVIDERS.find(p => p.id === request.provider);
    if (!provider) {
      return { success: false, message: 'Opérateur non supporté' };
    }
    
    if (request.amount < provider.minAmount) {
      return { success: false, message: `Montant minimum: ${provider.minAmount} FCFA` };
    }
    
    if (request.amount > provider.maxAmount) {
      return { success: false, message: `Montant maximum: ${provider.maxAmount.toLocaleString()} FCFA` };
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }
    
    // Appel API
    const response = await fetch(`${API_URL}/api/mobile-money/deposit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showToast.success(
        `Demande de dépôt envoyée. Validez sur ${provider.name}`,
        'Dépôt Mobile Money'
      );
      return { success: true, transaction: result.transaction };
    }
    
    return { success: false, message: result.message || 'Erreur lors de la demande' };
    
  } catch (error) {
    console.error('Erreur Mobile Money dépôt:', error);
    return { success: false, message: 'Erreur réseau' };
  }
}

/**
 * Initie un retrait Mobile Money
 */
export async function initiateMobileMoneyWithdrawal(
  request: MobileMoneyRequest
): Promise<{ success: boolean; transaction?: MobileMoneyTransaction; message?: string }> {
  try {
    // Validation
    if (!validatePhoneNumber(request.phoneNumber, request.provider)) {
      return { success: false, message: 'Numéro de téléphone invalide' };
    }
    
    const provider = MOBILE_MONEY_PROVIDERS.find(p => p.id === request.provider);
    if (!provider) {
      return { success: false, message: 'Opérateur non supporté' };
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }
    
    // Appel API
    const response = await fetch(`${API_URL}/api/mobile-money/withdrawal`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showToast.success(
        `Retrait initié vers ${provider.name}`,
        'Retrait Mobile Money'
      );
      return { success: true, transaction: result.transaction };
    }
    
    return { success: false, message: result.message || 'Erreur lors du retrait' };
    
  } catch (error) {
    console.error('Erreur Mobile Money retrait:', error);
    return { success: false, message: 'Erreur réseau' };
  }
}

/**
 * Vérifie le statut d'une transaction Mobile Money
 */
export async function checkMobileMoneyStatus(
  transactionId: string
): Promise<{ success: boolean; status?: MobileMoneyTransaction['status']; message?: string }> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }
    
    const response = await fetch(`${API_URL}/api/mobile-money/status/${transactionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      return { success: true, status: result.status };
    }
    
    return { success: false, message: result.message };
    
  } catch (error) {
    return { success: false, message: 'Erreur réseau' };
  }
}

/**
 * Récupère le statut des opérateurs
 */
export async function getProvidersStatus(): Promise<{ success: boolean; providers?: ProviderStatus[] }> {
  try {
    // En production: appel API pour vérifier état des services
    // Pour l'instant: simulation
    const statuses: ProviderStatus[] = MOBILE_MONEY_PROVIDERS.map(p => ({
      provider: p.id,
      available: true,
      maintenance: false,
      processingTime: p.id === 'Wave' ? 'instant' : '5min',
      fees: {
        percent: 1.5,
        fixed: 0
      }
    }));
    
    return { success: true, providers: statuses };
    
  } catch (error) {
    return { success: false };
  }
}

/**
 * Annule une transaction en attente
 */
export async function cancelMobileMoneyTransaction(
  transactionId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }
    
    const response = await fetch(`${API_URL}/api/mobile-money/cancel/${transactionId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      return { success: true, message: 'Transaction annulée' };
    }
    
    return { success: false, message: result.message || 'Impossible d\'annuler' };
    
  } catch (error) {
    return { success: false, message: 'Erreur réseau' };
  }
}

/**
 * Calcule les frais Mobile Money
 */
export function calculateMobileMoneyFees(
  amount: number,
  provider: MobileMoneyProvider
): { fees: number; netAmount: number } {
  const feePercent = 1.5; // 1.5%
  const fees = Math.ceil(amount * (feePercent / 100));
  return { fees, netAmount: amount - fees };
}
