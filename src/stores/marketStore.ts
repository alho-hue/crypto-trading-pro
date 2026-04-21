/**
 * 📈 Market Store - Zustand
 * Gestion centralisée des données de marché (prix, candles, orderbook)
 * Séparé pour optimiser les performances et éviter les re-renders inutiles
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceData {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high: number;
  low: number;
  volume: number;
  timestamp: number;
}

interface MarketState {
  // Prix
  prices: Map<string, PriceData>;
  selectedSymbol: string;
  
  // Candles
  candles: Map<string, CandleData[]>;
  candleIntervals: Map<string, string>; // symbol -> interval
  
  // Orderbook (L2)
  orderbook: Map<string, {
    bids: [number, number][];
    asks: [number, number][];
    lastUpdateId: number;
  }>;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
  
  // Actions
  setPrice: (symbol: string, data: PriceData) => void;
  setPrices: (prices: Map<string, PriceData>) => void;
  setSelectedSymbol: (symbol: string) => void;
  setCandles: (symbol: string, interval: string, data: CandleData[]) => void;
  appendCandle: (symbol: string, interval: string, candle: CandleData) => void;
  setOrderbook: (symbol: string, data: { bids: [number, number][]; asks: [number, number][]; lastUpdateId: number }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  getPrice: (symbol: string) => number;
  getPriceChange: (symbol: string) => number;
  getCandles: (symbol: string, interval: string) => CandleData[];
}

const initialState = {
  prices: new Map<string, PriceData>(),
  selectedSymbol: 'BTCUSDT',
  candles: new Map<string, CandleData[]>(),
  candleIntervals: new Map<string, string>(),
  orderbook: new Map<string, { bids: [number, number][]; asks: [number, number][]; lastUpdateId: number }>(),
  isLoading: false,
  error: null,
  lastUpdate: 0
};

export const useMarketStore = create<MarketState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      setPrice: (symbol, data) => {
        set(state => {
          state.prices.set(symbol, data);
          state.lastUpdate = Date.now();
        });
      },

      setPrices: (prices) => {
        set(state => {
          prices.forEach((data, symbol) => {
            state.prices.set(symbol, data);
          });
          state.lastUpdate = Date.now();
        });
      },

      setSelectedSymbol: (symbol) => {
        set(state => {
          state.selectedSymbol = symbol;
        });
      },

      setCandles: (symbol, interval, data) => {
        set(state => {
          const key = `${symbol}-${interval}`;
          state.candles.set(key, data);
          state.candleIntervals.set(symbol, interval);
        });
      },

      appendCandle: (symbol, interval, candle) => {
        set(state => {
          const key = `${symbol}-${interval}`;
          const existing = state.candles.get(key) || [];
          // Vérifier si c'est une nouvelle bougie ou update de la dernière
          const lastCandle = existing[existing.length - 1];
          if (lastCandle && lastCandle.time === candle.time) {
            // Update dernière bougie
            existing[existing.length - 1] = candle;
          } else {
            // Nouvelle bougie
            existing.push(candle);
            // Garder seulement les 500 dernières pour performance
            if (existing.length > 500) {
              existing.shift();
            }
          }
          state.candles.set(key, existing);
        });
      },

      setOrderbook: (symbol, data) => {
        set(state => {
          state.orderbook.set(symbol, data);
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

      getPrice: (symbol) => {
        return get().prices.get(symbol)?.price || 0;
      },

      getPriceChange: (symbol) => {
        return get().prices.get(symbol)?.priceChangePercent || 0;
      },

      getCandles: (symbol, interval) => {
        return get().candles.get(`${symbol}-${interval}`) || [];
      }
    }))
  )
);

// Sélecteurs optimisés pour éviter les re-renders
export const selectPrice = (symbol: string) => (state: MarketState) => state.prices.get(symbol);
export const selectSelectedSymbol = (state: MarketState) => state.selectedSymbol;
export const selectIsLoading = (state: MarketState) => state.isLoading;
export const selectLastUpdate = (state: MarketState) => state.lastUpdate;

// Hook optimisé pour souscrire à un seul prix
export function usePrice(symbol: string) {
  return useMarketStore(selectPrice(symbol));
}
