/**
 * NEUROVEST - Binance WebSocket Hook (Production)
 * Utilise le backend pour toutes les données (pas d'appels directs à Binance)
 */

import { useEffect, useCallback } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { fetchPrices as fetchBinancePrices, fetchKlines } from '../services/binanceApi';
import type { CryptoPrice, CandleData } from '../types';

export function useBinanceWebSocket() {
  const setPrice = useCryptoStore((state) => state.setPrice);
  const setCandleData = useCryptoStore((state) => state.setCandleData);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  const timeframe = useCryptoStore((state) => state.timeframe);
  const setApiStatus = useCryptoStore((state) => state.setApiStatus);

  // Fetch prices - APPEL DIRECT BINANCE
  const fetchPrices = useCallback(async () => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOTUSDT', 'DOGEUSDT', 'MATICUSDT', 'LINKUSDT', 'AVAXUSDT', 'ATOMUSDT', 'LTCUSDT', 'UNIUSDT', 'ETCUSDT'];
    
    try {
      const data = await fetchBinancePrices(symbols);
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid response');
      }
      
      data.forEach((ticker: any) => {
        if (!ticker?.symbol) return;
        
        const price: CryptoPrice = {
          symbol: ticker.symbol,
          price: parseFloat(ticker.lastPrice || 0),
          change24h: parseFloat(ticker.priceChangePercent || 0),
          change24hValue: parseFloat(ticker.priceChange || 0),
          volume24h: parseFloat(ticker.volume || 0),
          high24h: parseFloat(ticker.highPrice || 0),
          low24h: parseFloat(ticker.lowPrice || 0),
          lastUpdate: ticker.closeTime || Date.now(),
        };
        setPrice(ticker.symbol, price);
      });
      
      setApiStatus({ connected: true, source: 'binance' });
    } catch (error) {
      console.error('[Prices] Failed:', error);
      setApiStatus({ connected: false, source: 'error', error: 'Failed' });
    }
  }, [setPrice, setApiStatus]);

  // Poll prices every 3 seconds
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 3000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Fetch historical candle data
  const fetchCandleData = useCallback(async () => {
    try {
      const interval = timeframe === '1m' ? '1m' : 
                      timeframe === '5m' ? '5m' : 
                      timeframe === '15m' ? '15m' : 
                      timeframe === '1h' ? '1h' : 
                      timeframe === '4h' ? '4h' : '1d';
      
      const klineData = await fetchKlines(selectedSymbol, interval, 100);
      
      if (!Array.isArray(klineData) || klineData.length === 0) {
        return; // Pas d'erreur, juste pas de données
      }
      
      const candles: CandleData[] = klineData.map((k: any) => ({
        time: k[0] / 1000,
        open: parseFloat(k[1] || 0),
        high: parseFloat(k[2] || 0),
        low: parseFloat(k[3] || 0),
        close: parseFloat(k[4] || 0),
        volume: parseFloat(k[5] || 0),
      }));
      
      setCandleData(candles);
    } catch (error) {
      // Silencieux pour éviter le spam console
    }
  }, [selectedSymbol, timeframe, setCandleData]);

  // Fetch candle data when symbol or timeframe changes
  useEffect(() => {
    fetchCandleData();
    
    // Set up interval to refresh data every 30 seconds
    const interval = setInterval(fetchCandleData, 30000);
    
    return () => clearInterval(interval);
  }, [fetchCandleData]);

  return { fetchCandleData };
}

// Fetch initial prices via REST API
export async function fetchInitialPrices(symbols: string[]): Promise<Map<string, CryptoPrice>> {
  const prices = new Map<string, CryptoPrice>();
  
  try {
    const data = await fetchBinancePrices(symbols);
    
    if (!data) {
      throw new Error('Failed to fetch prices');
    }
    
    
    data.forEach((ticker: any) => {
      const price: CryptoPrice = {
        symbol: ticker.symbol,
        price: parseFloat(ticker.lastPrice),
        change24h: parseFloat(ticker.priceChangePercent),
        change24hValue: parseFloat(ticker.priceChange),
        volume24h: parseFloat(ticker.volume),
        high24h: parseFloat(ticker.highPrice),
        low24h: parseFloat(ticker.lowPrice),
        lastUpdate: ticker.closeTime,
      };
      prices.set(ticker.symbol, price);
    });
  } catch (error) {
    // Silent fail
  }
  
  return prices;
}
