import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CryptoPrice, CandleData, Trade, Alert, Timeframe, ViewType, ChartIndicator } from '../types';

// Fonction pour obtenir l'ID utilisateur
function getUserId(): string {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.id || user._id || 'guest';
    }
  } catch {}
  return 'guest';
}

interface ApiStatus {
  connected: boolean;
  source: string;
  error?: string;
}

interface CryptoState {
  // Prices
  prices: Map<string, CryptoPrice>;
  selectedSymbol: string;
  timeframe: Timeframe;
  
  // Chart data
  candleData: CandleData[];
  indicators: ChartIndicator[];
  
  // Trading
  trades: Trade[];
  
  // Alerts
  alerts: Alert[];
  
  // UI
  currentView: ViewType;
  selectedNewsId: string | null;
  
  // API Status
  apiStatus: ApiStatus;
  
  // Actions
  setPrice: (symbol: string, price: CryptoPrice) => void;
  setSelectedSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: Timeframe) => void;
  setCandleData: (data: CandleData[]) => void;
  setApiStatus: (status: ApiStatus) => void;
  addTrade: (trade: Trade) => void;
  updateTrade: (id: string, updates: Partial<Trade>) => void;
  closeTrade: (id: string, exitPrice: number) => void;
  deleteTrade: (id: string) => void;
  addAlert: (alert: Alert) => void;
  removeAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
  setView: (view: ViewType, params?: { newsId?: string }) => void;
  setSelectedNewsId: (id: string | null) => void;
  toggleIndicator: (type: string) => void;
  updateIndicatorParams: (type: string, params: Record<string, number>) => void;
}

export const useCryptoStore = create<CryptoState>()(
  persist(
    (set, get) => ({
      prices: new Map(),
      selectedSymbol: 'BTCUSDT',
      timeframe: '1h',
      candleData: [],
      indicators: [
        { type: 'sma', enabled: false, params: { period: 20 } },
        { type: 'ema', enabled: false, params: { period: 12 } },
        { type: 'rsi', enabled: false, params: { period: 14 } },
        { type: 'macd', enabled: false, params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
        { type: 'bollinger', enabled: false, params: { period: 20, stdDev: 2 } },
        { type: 'volume', enabled: true, params: {} },
      ],
      trades: [],
      alerts: [],
      currentView: 'dashboard',
      selectedNewsId: null,
      apiStatus: { connected: false, source: 'none' },
      
      setPrice: (symbol, price) => {
        const newPrices = new Map(get().prices);
        newPrices.set(symbol, price);
        set({ prices: newPrices });
      },
      
      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
      setTimeframe: (timeframe) => set({ timeframe }),
      setCandleData: (data) => set({ candleData: data }),
      setApiStatus: (status) => set({ apiStatus: status }),
      
      addTrade: (trade) => {
        const trades = [...get().trades, trade];
        set({ trades });
      },
      
      updateTrade: (id, updates) => {
        const trades = get().trades.map(t => 
          t.id === id ? { ...t, ...updates } : t
        );
        set({ trades });
      },
      
      closeTrade: (id, exitPrice) => {
        const trade = get().trades.find(t => t.id === id);
        if (!trade) return;
        
        const isBuy = trade.type === 'buy';
        const pnl = isBuy 
          ? (exitPrice - trade.entryPrice) * trade.quantity
          : (trade.entryPrice - exitPrice) * trade.quantity;
        const pnlPercent = (pnl / (trade.entryPrice * trade.quantity)) * 100;
        
        const trades = get().trades.map(t => 
          t.id === id 
            ? { ...t, exitPrice, pnl, pnlPercent, status: 'closed' as const }
            : t
        );
        set({ trades });
      },
      
      deleteTrade: (id) => {
        const trades = get().trades.filter(t => t.id !== id);
        set({ trades });
      },
      
      addAlert: (alert) => {
        const alerts = [...get().alerts, alert];
        set({ alerts });
      },
      
      removeAlert: (id) => {
        const alerts = get().alerts.filter(a => a.id !== id);
        set({ alerts });
      },
      
      toggleAlert: (id) => {
        const alerts = get().alerts.map(a => 
          a.id === id ? { ...a, active: !a.active } : a
        );
        set({ alerts });
      },
      
      setView: (view, params) => set({ 
        currentView: view, 
        selectedNewsId: params?.newsId || null 
      }),
      setSelectedNewsId: (id) => set({ selectedNewsId: id }),
      
      toggleIndicator: (type) => {
        const indicators = get().indicators.map(i => 
          i.type === type ? { ...i, enabled: !i.enabled } : i
        );
        set({ indicators });
      },
      
      updateIndicatorParams: (type, params) => {
        const indicators = get().indicators.map(i => 
          i.type === type ? { ...i, params: { ...i.params, ...params } } : i
        );
        set({ indicators });
      },
    }),
    {
      name: `crypto-trading-storage-${getUserId()}`, // ISOLÉ PAR UTILISATEUR
      partialize: (state) => ({ 
        trades: state.trades, 
        alerts: state.alerts,
        indicators: state.indicators,
        selectedSymbol: state.selectedSymbol,
        timeframe: state.timeframe,
      }),
    }
  )
);

// Export pour réinitialiser le store quand l'utilisateur change
export const getStorageName = () => `crypto-trading-storage-${getUserId()}`;
