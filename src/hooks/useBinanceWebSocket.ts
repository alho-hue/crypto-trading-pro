import { useEffect, useCallback } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { fetchPrices as fetchBinancePrices, fetchKlines, testApiConnection } from '../services/binanceApi';
import type { CryptoPrice, CandleData } from '../types';

const BINANCE_API_URL = 'https://api.binance.com/api/v3';

export function useBinanceWebSocket() {
  const setPrice = useCryptoStore((state) => state.setPrice);
  const setCandleData = useCryptoStore((state) => state.setCandleData);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  const timeframe = useCryptoStore((state) => state.timeframe);
  const setApiStatus = useCryptoStore((state) => state.setApiStatus);

  // Fetch prices via REST API
  const fetchPrices = useCallback(async () => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
    
    try {
      const data = await fetchBinancePrices(symbols);
      
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
        setPrice(ticker.symbol, price);
      });
      
      // Update API status
      setApiStatus({ connected: true, source: 'binance-api' });
    } catch (error) {
      // Silent fail
      setApiStatus({ connected: false, source: 'error', error: 'API Binance indisponible' });
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
      
      const klineData = await fetchKlines(selectedSymbol, interval, 500);
      
      const candles: CandleData[] = klineData.map((k: any[]) => ({
        time: k[0] / 1000,
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
      
      setCandleData(candles);
    } catch (error) {
      // Silent fail
      // Ne pas utiliser de mock - afficher l'erreur réelle
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
