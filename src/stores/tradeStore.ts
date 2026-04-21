/**
 * NEUROVEST - Trade Store
 * Store centralisé pour la gestion des trades en temps réel
 * Intégration avec tous les composants de l'application
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Trade, TradeStats, CreateTradeData } from '../services/tradeService';
import * as tradeService from '../services/tradeService';

// Types pour le store
interface TradeState {
  // Données
  trades: Trade[];
  openTrades: Trade[];
  closedTrades: Trade[];
  pendingTrades: Trade[];
  stats: TradeStats | null;
  selectedTrade: Trade | null;
  
  // UI State
  loading: boolean;
  error: string | null;
  
  // Filtres
  filters: {
    symbol: string;
    status: 'all' | 'open' | 'closed' | 'pending';
    source: 'all' | 'manual' | 'bot' | 'ai';
    dateRange: { start: Date | null; end: Date | null };
  };
}

interface TradeActions {
  // Actions CRUD
  createTrade: (data: CreateTradeData) => Promise<Trade | null>;
  executeTrade: (tradeId: string, executionData: any) => Promise<boolean>;
  closeTrade: (tradeId: string, exitPrice: number, exitReason: string) => Promise<boolean>;
  cancelTrade: (tradeId: string) => Promise<boolean>;
  updateTrade: (tradeId: string, updates: any) => Promise<boolean>;
  
  // Récupération
  fetchTrades: (status?: 'open' | 'closed' | 'pending') => Promise<void>;
  fetchStats: () => Promise<void>;
  refreshAll: () => Promise<void>;
  
  // Sélection
  selectTrade: (trade: Trade | null) => void;
  
  // Mise à jour temps réel
  updateTradePnL: (tradeId: string, unrealizedPnl: number, pnlPercent: number, currentPrice: number) => void;
  addTrade: (trade: Trade) => void;
  updateTradeStatus: (trade: Trade) => void;
  removeTrade: (tradeId: string) => void;
  
  // Filtres
  setFilter: (key: keyof TradeState['filters'], value: any) => void;
  getFilteredTrades: () => Trade[];
  
  // Calculs
  getTotalUnrealizedPnl: () => number;
  getTotalRealizedPnlToday: () => number;
  
  // Nettoyage
  clearError: () => void;
  reset: () => void;
}

const initialState: TradeState = {
  trades: [],
  openTrades: [],
  closedTrades: [],
  pendingTrades: [],
  stats: null,
  selectedTrade: null,
  loading: false,
  error: null,
  filters: {
    symbol: '',
    status: 'all',
    source: 'all',
    dateRange: { start: null, end: null }
  }
};

// Création du store avec Immer pour les mutations
export const useTradeStore = create<TradeState & TradeActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // ========== CRÉATION ==========
      createTrade: async (data) => {
        set(state => { state.loading = true; state.error = null; });
        
        try {
          const result = await tradeService.createTrade(data);
          if (result.success) {
            set(state => {
              state.trades.unshift(result.trade);
              state.openTrades.unshift(result.trade);
              state.loading = false;
            });
            return result.trade;
          }
          return null;
        } catch (error: any) {
          set(state => {
            state.loading = false;
            state.error = error.message;
          });
          return null;
        }
      },

      // ========== EXÉCUTION ==========
      executeTrade: async (tradeId, executionData) => {
        try {
          const result = await tradeService.executeTrade(tradeId, executionData);
          if (result.success) {
            set(state => {
              const index = state.trades.findIndex(t => t._id === tradeId);
              if (index !== -1) {
                state.trades[index] = result.trade;
              }
              // Mettre à jour les listes filtrées
              state.openTrades = state.trades.filter(t => t.status === 'open');
              state.pendingTrades = state.pendingTrades.filter(t => t._id !== tradeId);
            });
            return true;
          }
          return false;
        } catch (error: any) {
          set(state => { state.error = error.message; });
          return false;
        }
      },

      // ========== FERMETURE ==========
      closeTrade: async (tradeId, exitPrice, exitReason) => {
        set(state => { state.loading = true; });
        
        try {
          const result = await tradeService.closeTrade(tradeId, exitPrice, exitReason);
          if (result.success) {
            set(state => {
              const index = state.trades.findIndex(t => t._id === tradeId);
              if (index !== -1) {
                state.trades[index] = result.trade;
              }
              // Mettre à jour les listes
              state.openTrades = state.openTrades.filter(t => t._id !== tradeId);
              state.closedTrades.unshift(result.trade);
              state.loading = false;
            });
            
            // Rafraîchir les stats
            get().fetchStats();
            return true;
          }
          return false;
        } catch (error: any) {
          set(state => {
            state.loading = false;
            state.error = error.message;
          });
          return false;
        }
      },

      // ========== ANNULATION ==========
      cancelTrade: async (tradeId) => {
        try {
          const result = await tradeService.cancelTrade(tradeId);
          if (result.success) {
            set(state => {
              state.pendingTrades = state.pendingTrades.filter(t => t._id !== tradeId);
              state.trades = state.trades.map(t => 
                t._id === tradeId ? { ...t, status: 'cancelled' } as Trade : t
              );
            });
            return true;
          }
          return false;
        } catch (error: any) {
          set(state => { state.error = error.message; });
          return false;
        }
      },

      // ========== MISE À JOUR ==========
      updateTrade: async (tradeId, updates) => {
        try {
          const result = await tradeService.updateTrade(tradeId, updates);
          if (result.success) {
            set(state => {
              const index = state.trades.findIndex(t => t._id === tradeId);
              if (index !== -1) {
                state.trades[index] = result.trade;
              }
              // Mettre à jour les listes
              const tradeIndex = state.openTrades.findIndex(t => t._id === tradeId);
              if (tradeIndex !== -1) {
                state.openTrades[tradeIndex] = result.trade;
              }
            });
            return true;
          }
          return false;
        } catch (error: any) {
          set(state => { state.error = error.message; });
          return false;
        }
      },

      // ========== RÉCUPÉRATION ==========
      fetchTrades: async (status) => {
        set(state => { state.loading = true; });
        
        try {
          const result = await tradeService.getUserTrades(status);
          if (result.success) {
            set(state => {
              state.trades = result.trades;
              
              // Mettre à jour les listes filtrées
              state.openTrades = result.trades.filter(t => t.status === 'open');
              state.closedTrades = result.trades.filter(t => t.status === 'closed');
              state.pendingTrades = result.trades.filter(t => t.status === 'pending');
              
              state.loading = false;
            });
          }
        } catch (error: any) {
          set(state => {
            state.loading = false;
            state.error = error.message;
          });
        }
      },

      fetchStats: async () => {
        try {
          const result = await tradeService.getTradeStats();
          if (result.success) {
            set(state => { state.stats = result.stats; });
          }
        } catch (error: any) {
          set(state => { state.error = error.message; });
        }
      },

      refreshAll: async () => {
        await Promise.all([
          get().fetchTrades(),
          get().fetchStats()
        ]);
      },

      // ========== SÉLECTION ==========
      selectTrade: (trade) => {
        set(state => { state.selectedTrade = trade; });
      },

      // ========== MISES À JOUR TEMPS RÉEL ==========
      updateTradePnL: (tradeId, unrealizedPnl, pnlPercent, currentPrice) => {
        set(state => {
          const trade = state.openTrades.find(t => t._id === tradeId);
          if (trade) {
            trade.unrealizedPnl = unrealizedPnl;
            trade.pnlPercent = pnlPercent;
            trade.lastUpdateTime = new Date();
          }
          
          const allTrade = state.trades.find(t => t._id === tradeId);
          if (allTrade) {
            allTrade.unrealizedPnl = unrealizedPnl;
            allTrade.pnlPercent = pnlPercent;
            allTrade.lastUpdateTime = new Date();
          }
        });
      },

      addTrade: (trade) => {
        set(state => {
          state.trades.unshift(trade);
          if (trade.status === 'open') {
            state.openTrades.unshift(trade);
          } else if (trade.status === 'pending') {
            state.pendingTrades.unshift(trade);
          }
        });
      },

      updateTradeStatus: (trade) => {
        set(state => {
          const index = state.trades.findIndex(t => t._id === trade._id);
          if (index !== -1) {
            state.trades[index] = trade;
          }
          
          // Mettre à jour les listes
          state.openTrades = state.trades.filter(t => t.status === 'open');
          state.closedTrades = state.trades.filter(t => t.status === 'closed');
          state.pendingTrades = state.trades.filter(t => t.status === 'pending');
        });
      },

      removeTrade: (tradeId) => {
        set(state => {
          state.trades = state.trades.filter(t => t._id !== tradeId);
          state.openTrades = state.openTrades.filter(t => t._id !== tradeId);
          state.closedTrades = state.closedTrades.filter(t => t._id !== tradeId);
          state.pendingTrades = state.pendingTrades.filter(t => t._id !== tradeId);
        });
      },

      // ========== FILTRES ==========
      setFilter: (key, value) => {
        set(state => {
          state.filters[key] = value;
        });
      },

      getFilteredTrades: () => {
        const { trades, filters } = get();
        
        return trades.filter(trade => {
          // Filtre par statut
          if (filters.status !== 'all' && trade.status !== filters.status) {
            return false;
          }
          
          // Filtre par source
          if (filters.source !== 'all' && trade.source !== filters.source) {
            return false;
          }
          
          // Filtre par symbol
          if (filters.symbol && !trade.symbol.includes(filters.symbol.toUpperCase())) {
            return false;
          }
          
          // Filtre par date
          if (filters.dateRange.start || filters.dateRange.end) {
            const tradeDate = new Date(trade.entryTime);
            if (filters.dateRange.start && tradeDate < filters.dateRange.start) {
              return false;
            }
            if (filters.dateRange.end && tradeDate > filters.dateRange.end) {
              return false;
            }
          }
          
          return true;
        });
      },

      // ========== CALCULS ==========
      getTotalUnrealizedPnl: () => {
        const { openTrades } = get();
        return openTrades.reduce((sum, t) => sum + (t.unrealizedPnl || 0), 0);
      },

      getTotalRealizedPnlToday: () => {
        const { closedTrades } = get();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return closedTrades
          .filter(t => {
            const exitDate = new Date(t.exitTime || t.updatedAt);
            return exitDate >= today;
          })
          .reduce((sum, t) => sum + (t.pnl || 0), 0);
      },

      // ========== NETTOYAGE ==========
      clearError: () => {
        set(state => { state.error = null; });
      },

      reset: () => {
        set(initialState);
      }
    }))
  )
);

// ========== SELECTORS ==========
export const selectOpenTrades = (state: TradeState & TradeActions) => state.openTrades;
export const selectClosedTrades = (state: TradeState & TradeActions) => state.closedTrades;
export const selectTradeStats = (state: TradeState & TradeActions) => state.stats;
export const selectTradeLoading = (state: TradeState & TradeActions) => state.loading;
export const selectTradeError = (state: TradeState & TradeActions) => state.error;

// ========== HOOKS UTILITAIRES ==========
export function useOpenTrades() {
  return useTradeStore(selectOpenTrades);
}

export function useClosedTrades() {
  return useTradeStore(selectClosedTrades);
}

export function useTradeStats() {
  return useTradeStore(selectTradeStats);
}

export function useTotalUnrealizedPnl() {
  return useTradeStore(state => state.getTotalUnrealizedPnl());
}
