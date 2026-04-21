/**
 * 🤖 Bot Store - Zustand
 * Gestion centralisée des bots de trading automatisés
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface BotConfig {
  id: string;
  name: string;
  symbol: string;
  strategy: string;
  timeframe: string;
  isActive: boolean;
  riskPerTrade: number;
  maxPositions: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  trailingStop?: boolean;
  trailingStopPercent?: number;
  useMarketConditions: boolean;
  tradingHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface BotStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  dailyPnl: number;
  maxDrawdown: number;
  currentStreak: number;
  bestStreak: number;
  worstStreak: number;
  avgTradeDuration: number;
  profitFactor: number;
  sharpeRatio: number;
}

export interface BotLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: any;
}

interface BotState {
  // Bots
  bots: BotConfig[];
  selectedBot: string | null;
  
  // Stats
  botStats: Map<string, BotStats>;
  
  // Logs
  logs: BotLog[];
  botLogs: Map<string, BotLog[]>;
  
  // Status global
  isRunning: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
  
  // Paper trading
  paperBalance: number;
  initialPaperBalance: number;
  
  // Actions
  addBot: (bot: BotConfig) => void;
  updateBot: (id: string, updates: Partial<BotConfig>) => void;
  removeBot: (id: string) => void;
  selectBot: (id: string | null) => void;
  toggleBot: (id: string) => void;
  
  setBotStats: (botId: string, stats: BotStats) => void;
  updateBotStats: (botId: string, updates: Partial<BotStats>) => void;
  resetBotStats: (botId: string) => void;
  
  addLog: (log: BotLog) => void;
  addBotLog: (botId: string, log: BotLog) => void;
  clearLogs: () => void;
  clearBotLogs: (botId: string) => void;
  
  setIsRunning: (running: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  updatePaperBalance: (delta: number) => void;
  setPaperBalance: (balance: number) => void;
  resetPaperBalance: () => void;
  
  getBot: (id: string) => BotConfig | undefined;
  getActiveBots: () => BotConfig[];
  getBotStats: (id: string) => BotStats | undefined;
  getTotalPnl: () => number;
  getGlobalWinRate: () => number;
}

const defaultBotStats: BotStats = {
  totalTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  winRate: 0,
  totalPnl: 0,
  dailyPnl: 0,
  maxDrawdown: 0,
  currentStreak: 0,
  bestStreak: 0,
  worstStreak: 0,
  avgTradeDuration: 0,
  profitFactor: 0,
  sharpeRatio: 0
};

export const useBotStore = create<BotState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      bots: [],
      selectedBot: null,
      botStats: new Map(),
      logs: [],
      botLogs: new Map(),
      isRunning: false,
      isLoading: false,
      error: null,
      lastUpdate: Date.now(),
      paperBalance: 10000,
      initialPaperBalance: 10000,

      addBot: (bot) => {
        set(state => {
          state.bots.push(bot);
          state.botStats.set(bot.id, { ...defaultBotStats });
          state.botLogs.set(bot.id, []);
        });
      },

      updateBot: (id, updates) => {
        set(state => {
          const bot = state.bots.find(b => b.id === id);
          if (bot) {
            Object.assign(bot, updates);
          }
        });
      },

      removeBot: (id) => {
        set(state => {
          state.bots = state.bots.filter(b => b.id !== id);
          state.botStats.delete(id);
          state.botLogs.delete(id);
          if (state.selectedBot === id) {
            state.selectedBot = null;
          }
        });
      },

      selectBot: (id) => {
        set(state => {
          state.selectedBot = id;
        });
      },

      toggleBot: (id) => {
        set(state => {
          const bot = state.bots.find(b => b.id === id);
          if (bot) {
            bot.isActive = !bot.isActive;
          }
        });
      },

      setBotStats: (botId, stats) => {
        set(state => {
          state.botStats.set(botId, stats);
          state.lastUpdate = Date.now();
        });
      },

      updateBotStats: (botId, updates) => {
        set(state => {
          const stats = state.botStats.get(botId) || { ...defaultBotStats };
          Object.assign(stats, updates);
          
          // Recalculer winRate
          if (stats.totalTrades > 0) {
            stats.winRate = (stats.winningTrades / stats.totalTrades) * 100;
          }
          
          state.botStats.set(botId, stats);
          state.lastUpdate = Date.now();
        });
      },

      resetBotStats: (botId) => {
        set(state => {
          state.botStats.set(botId, { ...defaultBotStats });
        });
      },

      addLog: (log) => {
        set(state => {
          state.logs.unshift(log);
          if (state.logs.length > 1000) {
            state.logs = state.logs.slice(0, 1000);
          }
        });
      },

      addBotLog: (botId, log) => {
        set(state => {
          const logs = state.botLogs.get(botId) || [];
          logs.unshift(log);
          if (logs.length > 500) {
            logs.pop();
          }
          state.botLogs.set(botId, logs);
        });
      },

      clearLogs: () => {
        set(state => {
          state.logs = [];
        });
      },

      clearBotLogs: (botId) => {
        set(state => {
          state.botLogs.set(botId, []);
        });
      },

      setIsRunning: (running) => {
        set(state => {
          state.isRunning = running;
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

      updatePaperBalance: (delta) => {
        set(state => {
          state.paperBalance = Math.max(0, state.paperBalance + delta);
        });
      },

      setPaperBalance: (balance) => {
        set(state => {
          state.paperBalance = balance;
        });
      },

      resetPaperBalance: () => {
        set(state => {
          state.paperBalance = state.initialPaperBalance;
        });
      },

      getBot: (id) => get().bots.find(b => b.id === id),
      getActiveBots: () => get().bots.filter(b => b.isActive),
      getBotStats: (id) => get().botStats.get(id),
      getTotalPnl: () => {
        let total = 0;
        get().botStats.forEach(stats => {
          total += stats.totalPnl;
        });
        return total;
      },
      getGlobalWinRate: () => {
        let totalTrades = 0;
        let winningTrades = 0;
        get().botStats.forEach(stats => {
          totalTrades += stats.totalTrades;
          winningTrades += stats.winningTrades;
        });
        return totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      }
    }))
  )
);

// Sélecteurs
export const selectBots = (state: BotState) => state.bots;
export const selectActiveBots = (state: BotState) => state.bots.filter(b => b.isActive);
export const selectSelectedBot = (state: BotState) => state.selectedBot;
export const selectIsRunning = (state: BotState) => state.isRunning;
export const selectPaperBalance = (state: BotState) => state.paperBalance;
export const selectTotalBotPnl = (state: BotState) => {
  let total = 0;
  state.botStats.forEach(stats => {
    total += stats.totalPnl;
  });
  return total;
};
