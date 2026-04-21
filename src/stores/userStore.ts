/**
 * 👤 User Store - Zustand
 * Gestion centralisée de l'utilisateur, auth, préférences, sécurité
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatar?: string;
  role: 'user' | 'admin' | 'pro';
  isVerified: boolean;
  twoFactorEnabled: boolean;
  preferences: UserPreferences;
  stats: UserStats;
}

export interface UserPreferences {
  theme: 'dark' | 'light';
  language: string;
  notifications: boolean;
  soundEffects: boolean;
  defaultTimeframe: string;
  riskPerTrade: number;
  maxDailyLoss: number;
  autoLogoutMinutes: number;
}

export interface UserStats {
  totalTrades: number;
  winningTrades: number;
  totalProfit: number;
  winRate: number;
  bestTrade: number;
  worstTrade: number;
  profitFactor: number;
  maxDrawdown: number;
  createdAt: string;
}

export interface ApiKeys {
  binanceApiKey?: string;
  binanceSecretKey?: string;
  // Chiffrées côté client avant stockage
}

interface UserState {
  // Auth
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
  
  // Clés API (chiffrées)
  apiKeys: ApiKeys;
  
  // Session
  lastActivity: number;
  sessionExpiry: number;
  
  // UI
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  setApiKeys: (keys: ApiKeys) => void;
  clearApiKeys: () => void;
  updateStats: (stats: Partial<UserStats>) => void;
  refreshSession: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  isSessionValid: () => boolean;
}

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  language: 'fr',
  notifications: true,
  soundEffects: true,
  defaultTimeframe: '1h',
  riskPerTrade: 1,
  maxDailyLoss: 3,
  autoLogoutMinutes: 30
};

const defaultStats: UserStats = {
  totalTrades: 0,
  winningTrades: 0,
  totalProfit: 0,
  winRate: 0,
  bestTrade: 0,
  worstTrade: 0,
  profitFactor: 0,
  maxDrawdown: 0,
  createdAt: new Date().toISOString()
};

export const useUserStore = create<UserState>()(
  persist(
    subscribeWithSelector(
      immer((set, get) => ({
        isAuthenticated: false,
        token: null,
        user: null,
        apiKeys: {},
        lastActivity: Date.now(),
        sessionExpiry: Date.now() + 30 * 60 * 1000, // 30 min
        isLoading: false,
        error: null,

        login: (token, user) => {
          set(state => {
            state.isAuthenticated = true;
            state.token = token;
            state.user = {
              ...user,
              preferences: { ...defaultPreferences, ...user.preferences },
              stats: { ...defaultStats, ...user.stats }
            };
            state.lastActivity = Date.now();
            state.sessionExpiry = Date.now() + 30 * 60 * 1000;
          });
        },

        logout: () => {
          set(state => {
            state.isAuthenticated = false;
            state.token = null;
            state.user = null;
            state.apiKeys = {};
          });
          localStorage.removeItem('token');
          localStorage.removeItem('binance_api_key');
          localStorage.removeItem('binance_secret_key');
        },

        updateUser: (userData) => {
          set(state => {
            if (state.user) {
              state.user = { ...state.user, ...userData };
            }
          });
        },

        updatePreferences: (prefs) => {
          set(state => {
            if (state.user) {
              state.user.preferences = { ...state.user.preferences, ...prefs };
            }
          });
        },

        setApiKeys: (keys) => {
          set(state => {
            state.apiKeys = keys;
          });
        },

        clearApiKeys: () => {
          set(state => {
            state.apiKeys = {};
          });
          localStorage.removeItem('binance_api_key');
          localStorage.removeItem('binance_secret_key');
        },

        updateStats: (stats) => {
          set(state => {
            if (state.user) {
              state.user.stats = { ...state.user.stats, ...stats };
            }
          });
        },

        refreshSession: () => {
          set(state => {
            state.lastActivity = Date.now();
            state.sessionExpiry = Date.now() + 30 * 60 * 1000;
          });
        },

        setLoading: (loading) => {
          set(state => {
            state.isLoading = loading;
          });
        },

        setError: (error) => {
          set(state => {
            state.error = error;
          });
        },

        clearError: () => {
          set(state => {
            state.error = null;
          });
        },

        isSessionValid: () => {
          const { sessionExpiry, lastActivity } = get();
          const now = Date.now();
          const maxInactivity = 30 * 60 * 1000; // 30 min
          return now < sessionExpiry && (now - lastActivity) < maxInactivity;
        }
      }))
    ),
    {
      name: 'user-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        token: state.token,
        user: state.user,
        apiKeys: state.apiKeys
      })
    }
  )
);

// Sélecteurs
export const selectIsAuthenticated = (state: UserState) => state.isAuthenticated;
export const selectUser = (state: UserState) => state.user;
export const selectToken = (state: UserState) => state.token;
export const selectApiKeys = (state: UserState) => state.apiKeys;
export const selectPreferences = (state: UserState) => state.user?.preferences;
export const selectStats = (state: UserState) => state.user?.stats;
