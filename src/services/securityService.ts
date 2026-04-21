/**
 * 🛡️ Service de Sécurité - NEUROVEST
 * Validation 2FA, confirmation transactions, audit logs
 */

import { showToast } from '../stores/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface SecurityConfig {
  require2FA: boolean;
  requireEmailConfirm: boolean;
  maxWithdrawalWithout2FA: number;
  withdrawalCooldown: number; // minutes
}

export interface TransactionLog {
  id: string;
  userId: string;
  type: 'withdrawal' | 'deposit' | 'conversion' | 'login' | 'settings';
  action: string;
  amount?: number;
  currency?: string;
  status: 'success' | 'failed' | 'pending';
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  metadata?: any;
}

export interface VerificationResult {
  success: boolean;
  verified: boolean;
  message: string;
  requires2FA?: boolean;
  requiresConfirmation?: boolean;
}

// Configuration par défaut
const defaultSecurityConfig: SecurityConfig = {
  require2FA: true,
  requireEmailConfirm: true,
  maxWithdrawalWithout2FA: 1000, // 1000 USDT
  withdrawalCooldown: 5 // 5 minutes entre retraits
};

/**
 * Vérifie si une transaction nécessite 2FA
 */
export function requires2FA(
  amount: number,
  type: 'withdrawal' | 'deposit' | 'conversion',
  config: SecurityConfig = defaultSecurityConfig
): boolean {
  if (!config.require2FA) return false;
  
  // Les retraits nécessitent toujours 2FA si activé
  if (type === 'withdrawal') return true;
  
  // Les dépôts > 10k nécessitent 2FA
  if (type === 'deposit' && amount > 10000) return true;
  
  // Conversions > maxWithdrawalWithout2FA nécessitent 2FA
  if (type === 'conversion' && amount > config.maxWithdrawalWithout2FA) return true;
  
  return false;
}

/**
 * Demande une vérification 2FA
 */
export async function request2FAVerification(
  userId: string,
  action: string
): Promise<{ success: boolean; message: string; qrCode?: string }> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }

    const response = await fetch(`${API_URL}/api/security/2fa/request`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId, action })
    });

    const result = await response.json();
    
    if (response.ok) {
      return {
        success: true,
        message: 'Code 2FA envoyé',
        qrCode: result.qrCode // Pour setup initial
      };
    }
    
    return { success: false, message: result.message || 'Erreur 2FA' };
  } catch (error) {
    console.error('Erreur 2FA:', error);
    return { success: false, message: 'Erreur réseau' };
  }
}

/**
 * Vérifie un code 2FA
 */
export async function verify2FACode(
  userId: string,
  code: string
): Promise<VerificationResult> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, verified: false, message: 'Non authentifié' };
    }

    const response = await fetch(`${API_URL}/api/security/2fa/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId, code })
    });

    const result = await response.json();
    
    if (response.ok && result.verified) {
      // Stocker la session 2FA
      sessionStorage.setItem('2fa_verified', 'true');
      sessionStorage.setItem('2fa_verified_at', Date.now().toString());
      
      return {
        success: true,
        verified: true,
        message: '2FA vérifié avec succès'
      };
    }
    
    return {
      success: false,
      verified: false,
      message: result.message || 'Code 2FA invalide'
    };
  } catch (error) {
    console.error('Erreur vérification 2FA:', error);
    return { success: false, verified: false, message: 'Erreur réseau' };
  }
}

/**
 * Vérifie si la session 2FA est valide
 */
export function is2FASessionValid(duration: number = 300000): boolean {
  const verified = sessionStorage.getItem('2fa_verified') === 'true';
  const verifiedAt = parseInt(sessionStorage.getItem('2fa_verified_at') || '0');
  
  if (!verified) return false;
  if (Date.now() - verifiedAt > duration) {
    // Session expirée
    clear2FASession();
    return false;
  }
  
  return true;
}

/**
 * Vide la session 2FA
 */
export function clear2FASession(): void {
  sessionStorage.removeItem('2fa_verified');
  sessionStorage.removeItem('2fa_verified_at');
}

/**
 * Demande une confirmation par email
 */
export async function requestEmailConfirmation(
  userId: string,
  transactionId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }

    const response = await fetch(`${API_URL}/api/security/email/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId, transactionId })
    });

    const result = await response.json();
    
    if (response.ok) {
      return {
        success: true,
        message: 'Email de confirmation envoyé'
      };
    }
    
    return { success: false, message: result.message || 'Erreur email' };
  } catch (error) {
    console.error('Erreur email:', error);
    return { success: false, message: 'Erreur réseau' };
  }
}

/**
 * Log une action de sécurité
 */
export async function logSecurityAction(
  action: string,
  metadata?: any
): Promise<void> {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    await fetch(`${API_URL}/api/security/log`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action,
        metadata,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Erreur log sécurité:', error);
  }
}

/**
 * Récupère l'historique des actions de sécurité
 */
export async function getSecurityLogs(
  limit: number = 50
): Promise<{ success: boolean; logs?: TransactionLog[]; message?: string }> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }

    const response = await fetch(`${API_URL}/api/security/logs?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (response.ok) {
      return { success: true, logs: result.logs };
    }
    
    return { success: false, message: result.message };
  } catch (error) {
    return { success: false, message: 'Erreur réseau' };
  }
}

/**
 * Valide une transaction avec toutes les vérifications de sécurité
 */
export async function validateTransaction(
  type: 'withdrawal' | 'deposit' | 'conversion',
  amount: number,
  currency: string,
  config: SecurityConfig = defaultSecurityConfig
): Promise<VerificationResult> {
  // Vérifier 2FA si requis
  const needs2FA = requires2FA(amount, type, config);
  
  if (needs2FA && !is2FASessionValid()) {
    return {
      success: false,
      verified: false,
      message: 'Vérification 2FA requise',
      requires2FA: true
    };
  }
  
  // Vérifier les limites
  if (type === 'withdrawal' && amount > config.maxWithdrawalWithout2FA && !is2FASessionValid()) {
    return {
      success: false,
      verified: false,
      message: `Les retraits > ${config.maxWithdrawalWithout2FA} USDT nécessitent 2FA`,
      requires2FA: true
    };
  }
  
  // Log de la tentative
  await logSecurityAction(`${type}_attempt`, { amount, currency });
  
  return {
    success: true,
    verified: true,
    message: 'Transaction validée',
    requires2FA: false
  };
}

/**
 * Génère un code de confirmation temporaire (pour retraits)
 */
export function generateConfirmationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Stocke un code de confirmation
 */
export function storeConfirmationCode(code: string, expiry: number = 300): void {
  sessionStorage.setItem('confirm_code', code);
  sessionStorage.setItem('confirm_code_expiry', (Date.now() + expiry * 1000).toString());
}

/**
 * Vérifie un code de confirmation
 */
export function verifyConfirmationCode(code: string): boolean {
  const stored = sessionStorage.getItem('confirm_code');
  const expiry = parseInt(sessionStorage.getItem('confirm_code_expiry') || '0');
  
  if (!stored || Date.now() > expiry) {
    return false;
  }
  
  return stored === code;
}

/**
 * Efface le code de confirmation
 */
export function clearConfirmationCode(): void {
  sessionStorage.removeItem('confirm_code');
  sessionStorage.removeItem('confirm_code_expiry');
}

/**
 * Active la 2FA pour l'utilisateur
 * Retourne un secret pour générer le QR code
 */
export async function enable2FA(): Promise<{ success: boolean; secret?: string; qrCode?: string; message?: string }> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }

    const response = await fetch(`${API_URL}/api/security/2fa/setup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (response.ok) {
      return {
        success: true,
        secret: result.secret,
        qrCode: result.qrCode,
        message: '2FA activé'
      };
    }
    
    return { success: false, message: result.message || 'Erreur activation 2FA' };
  } catch (error) {
    console.error('Erreur activation 2FA:', error);
    return { success: false, message: 'Erreur réseau' };
  }
}

/**
 * Désactive la 2FA pour l'utilisateur
 */
export async function disable2FA(code: string): Promise<{ success: boolean; message?: string }> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Non authentifié' };
    }

    const response = await fetch(`${API_URL}/api/security/2fa/disable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });

    const result = await response.json();
    
    if (response.ok) {
      clear2FASession();
      return { success: true, message: '2FA désactivé' };
    }
    
    return { success: false, message: result.message || 'Code invalide' };
  } catch (error) {
    console.error('Erreur désactivation 2FA:', error);
    return { success: false, message: 'Erreur réseau' };
  }
}

export { defaultSecurityConfig };
