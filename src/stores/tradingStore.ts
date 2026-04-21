/**
 * 💼 Trading Store - Zustand
 * Gestion centralisée des trades, positions, ordres, historique
 * Optimisé pour haute fréquence de mises à jour
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  margin: number;
  stopLoss: number;
  takeProfit: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  fees: number;
  openedAt: string;
  status: 'open' | 'partial' | 'closing';
}

export interface Trade {
  id: string;
  positionId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  price: number;
  quantity: number;
  filledQuantity: number;
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'rejected';
  pnl?: number;
  pnlPercent?: number;
  fees: number;
  stopLoss?: number;
  takeProfit?: number;
  createdAt: string;
  filledAt?: string;
  isDemo: boolean;
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
}

interface TradingState {
  // Positions
  positions: Position[];
  selectedPosition: string | null;
  
  // Ordres
  orders: Trade[];
  pendingOrders: string[]; // IDs des ordres en attente
  
  // Historique
  tradeHistory: Trade[];
  
  // Stats
  todayPnl: number;
  todayTrades: number;
  openRisk: number; // % du capital à risque
  
  // UI
  isExecuting: boolean;
  selectedSymbol: string;
  orderForm: {
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT';
    price: number | null;
    quantity: number;
    stopLoss: number | null;
    takeProfit: number | null;
    leverage: number;
  };
  
  // Error
  error: string | null;
  lastError: string | null;
  
  // Actions
  setPositions: (positions: Position[]) => void;
  updatePositionPrice: (symbol: string, price: number) => void;
  addPosition: (position: Position) => void;
  closePosition: (id: string, exitPrice: number, pnl: number) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  selectPosition: (id: string | null) => void;
  
  setOrders: (orders: Trade[]) => void;
  addOrder: (order: Trade) => void;
  updateOrder: (id: string, updates: Partial<Trade>) => void;
  cancelOrder: (id: string) => void;
  clearPendingOrder: (id: string) => void;
  
  addToHistory: (trade: Trade) => void;
  setTradeHistory: (history: Trade[]) => void;
  
  setTodayPnl: (pnl: number) => void;
  incrementTodayTrades: () => void;
  calculateOpenRisk: (balance: number) => void;
  
  setExecuting: (executing: boolean) => void;
  setSelectedSymbol: (symbol: string) => void;
  updateOrderForm: (updates: Partial<TradingState['orderForm']>) => void;
  resetOrderForm: () => void;
  
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Getters
  getOpenPositions: () => Position[];
  getPositionBySymbol: (symbol: string) => Position | undefined;
  getPendingOrders: () => Trade[];
  getTodayStats: () => { pnl: number; count: number; winRate: number };
}

const defaultOrderForm = {
  side: 'BUY' as const,
  type: 'MARKET' as const,
  price: null,
  quantity: 0,
  stopLoss: null,
  takeProfit: null,
  leverage: 1
};

export const useTradingStore = create<TradingState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      positions: [],
      selectedPosition: null,
      orders: [],
      pendingOrders: [],
      tradeHistory: [],
      todayPnl: 0,
      todayTrades: 0,
      openRisk: 0,
      isExecuting: false,
      selectedSymbol: 'BTCUSDT',
      orderForm: { ...defaultOrderForm },
      error: null,
      lastError: null,

      setPositions: (positions) => {
        set(state => {
          state.positions = positions;
        });
      },

      updatePositionPrice: (symbol, price) => {
        set(state => {
          state.positions.forEach(pos => {
            if (pos.symbol === symbol) {
              pos.currentPrice = price;
              const isLong = pos.side === 'LONG';
              const size = pos.quantity;
              const entryPrice = pos.entryPrice;
              
              const rawPnl = isLong
                ? (price - entryPrice) * size
                : (entryPrice - price) * size;
              
              pos.unrealizedPnl = rawPnl - pos.fees;
              pos.unrealizedPnlPercent = (pos.unrealizedPnl / (entryPrice * size)) * 100;
            }
          });
        });
      },

      addPosition: (position) => {
        set(state => {
          state.positions.push(position);
        });
      },

      closePosition: (id, exitPrice, pnl) => {
        set(state => {
          const index = state.positions.findIndex(p => p.id === id);
          if (index !== -1) {
            state.positions.splice(index, 1);
            state.todayPnl += pnl;
            state.todayTrades += 1;
          }
        });
      },

      updatePosition: (id, updates) => {
        set(state => {
          const pos = state.positions.find(p => p.id === id);
          if (pos) {
            Object.assign(pos, updates);
          }
        });
      },

      selectPosition: (id) => {
        set(state => {
          state.selectedPosition = id;
        });
      },

      setOrders: (orders) => {
        set(state => {
          state.orders = orders;
        });
      },

      addOrder: (order) => {
        set(state => {
          state.orders.unshift(order);
          if (order.status === 'pending') {
            state.pendingOrders.push(order.id);
          }
        });
      },

      updateOrder: (id, updates) => {
        set(state => {
          const order = state.orders.find(o => o.id === id);
          if (order) {
            Object.assign(order, updates);
            if (updates.status === 'filled') {
              state.pendingOrders = state.pendingOrders.filter(pid => pid !== id);
            }
          }
        });
      },

      cancelOrder: (id) => {
        set(state => {
          const order = state.orders.find(o => o.id === id);
          if (order) {
            order.status = 'cancelled';
          }
          state.pendingOrders = state.pendingOrders.filter(pid => pid !== id);
        });
      },

      clearPendingOrder: (id) => {
        set(state => {
          state.pendingOrders = state.pendingOrders.filter(pid => pid !== id);
        });
      },

      addToHistory: (trade) => {
        set(state => {
          state.tradeHistory.unshift(trade);
          // Garder seulement 1000 derniers trades
          if (state.tradeHistory.length > 1000) {
            state.tradeHistory = state.tradeHistory.slice(0, 1000);
          }
        });
      },

      setTradeHistory: (history) => {
        set(state => {
          state.tradeHistory = history;
        });
      },

      setTodayPnl: (pnl) => {
        set(state => {
          state.todayPnl = pnl;
        });
      },

      incrementTodayTrades: () => {
        set(state => {
          state.todayTrades += 1;
        });
      },

      calculateOpenRisk: (balance) => {
        set(state => {
          const totalRisk = state.positions.reduce((sum, pos) => {
            const riskPerPos = Math.abs(pos.entryPrice - pos.stopLoss) * pos.quantity;
            return sum + riskPerPos;
          }, 0);
          state.openRisk = balance > 0 ? (totalRisk / balance) * 100 : 0;
        });
      },

      setExecuting: (executing) => {
        set(state => {
          state.isExecuting = executing;
        });
      },

      setSelectedSymbol: (symbol) => {
        set(state => {
          state.selectedSymbol = symbol;
        });
      },

      updateOrderForm: (updates) => {
        set(state => {
          state.orderForm = { ...state.orderForm, ...updates };
        });
      },

      resetOrderForm: () => {
        set(state => {
          state.orderForm = { ...defaultOrderForm };
        });
      },

      setError: (error) => {
        set(state => {
          state.error = error;
          if (error) state.lastError = error;
        });
      },

      clearError: () => {
        set(state => {
          state.error = null;
        });
      },

      getOpenPositions: () => get().positions.filter(p => p.status === 'open'),
      getPositionBySymbol: (symbol) => get().positions.find(p => p.symbol === symbol && p.status === 'open'),
      getPendingOrders: () => get().orders.filter(o => o.status === 'pending'),
      getTodayStats: () => ({
        pnl: get().todayPnl,
        count: get().todayTrades,
        winRate: 0 // Calculé séparément
      })
    }))
  )
);

// Sélecteurs optimisés
export const selectPositions = (state: TradingState) => state.positions;
export const selectOpenPositions = (state: TradingState) => state.positions.filter(p => p.status === 'open');
export const selectTotalUnrealizedPnl = (state: TradingState) => 
  state.positions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
export const selectOpenRisk = (state: TradingState) => state.openRisk;
export const selectIsExecuting = (state: TradingState) => state.isExecuting;
export const selectTodayPnl = (state: TradingState) => state.todayPnl;
