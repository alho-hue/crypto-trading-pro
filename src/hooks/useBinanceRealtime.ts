/**
 * NEUROVEST - Hook WebSocket temps réel
 * Connexion Socket.IO au backend pour recevoir les données Binance en temps réel
 * 
 * Pas d'appels directs à Binance - tout passe par le backend
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface PriceData {
  symbol: string;
  price: number;
  priceChange: number;
  high: number;
  low: number;
  volume: number;
  timestamp: number;
}

interface KlineData {
  symbol: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

interface UseBinanceRealtimeOptions {
  autoConnect?: boolean;
  symbols?: string[];
}

export function useBinanceRealtime(options: UseBinanceRealtimeOptions = {}) {
  const { autoConnect = true, symbols = ['BTCUSDT', 'ETHUSDT'] } = options;
  
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [prices, setPrices] = useState<Map<string, PriceData>>(new Map());
  const [klines, setKlines] = useState<Map<string, KlineData>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('Socket already connected');
      return;
    }

    console.log('Connecting to Binance realtime service...');
    
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 10000
    });

    socket.on('connect', () => {
      console.log('Connected to Binance realtime service');
      setIsConnected(true);
      setError(null);
      
      // Subscribe to default price streams
      socket.emit('subscribe-prices', symbols);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected from Binance realtime service:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Connection failed: ' + err.message);
      setIsConnected(false);
    });

    // Handle price updates
    socket.on('price-update', (data: PriceData) => {
      setPrices(prev => {
        const newPrices = new Map(prev);
        newPrices.set(data.symbol, data);
        return newPrices;
      });
      setLastUpdate(Date.now());
    });

    // Handle subscription confirmation
    socket.on('subscribed-prices', (subscribedSymbols: string[]) => {
      console.log('Subscribed to prices:', subscribedSymbols);
    });

    socketRef.current = socket;
  }, [symbols]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Subscribe to klines for a specific symbol
  const subscribeKlines = useCallback((symbol: string, interval: string = '1m') => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe-klines', { symbol, interval });
      
      // Listen for kline updates
      const eventName = `kline-${symbol.toLowerCase()}-${interval}`;
      socketRef.current.on(eventName, (data: KlineData) => {
        setKlines(prev => {
          const newKlines = new Map(prev);
          newKlines.set(`${symbol}-${interval}`, data);
          return newKlines;
        });
      });
    }
  }, []);

  // Unsubscribe from streams
  const unsubscribe = useCallback((streams: string[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe', streams);
    }
  }, []);

  // Subscribe to new symbols
  const subscribePrices = useCallback((newSymbols: string[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe-prices', newSymbols);
    }
  }, []);

  // Get current price for a symbol
  const getPrice = useCallback((symbol: string): number => {
    const data = prices.get(symbol);
    return data?.price || 0;
  }, [prices]);

  // Get 24h change for a symbol
  const getPriceChange = useCallback((symbol: string): number => {
    const data = prices.get(symbol);
    return data?.priceChange || 0;
  }, [prices]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    prices,
    klines,
    lastUpdate,
    error,
    connect,
    disconnect,
    subscribePrices,
    subscribeKlines,
    unsubscribe,
    getPrice,
    getPriceChange
  };
}

// Hook for single symbol price
export function useSymbolPrice(symbol: string) {
  const { prices, isConnected, subscribePrices } = useBinanceRealtime({
    autoConnect: true,
    symbols: [symbol]
  });

  const priceData = prices.get(symbol);

  return {
    price: priceData?.price || 0,
    priceChange: priceData?.priceChange || 0,
    high24h: priceData?.high || 0,
    low24h: priceData?.low || 0,
    volume24h: priceData?.volume || 0,
    isConnected,
    lastUpdate: priceData?.timestamp || 0
  };
}

// Hook for multiple symbols
export function useMultiplePrices(symbols: string[]) {
  const { prices, isConnected, subscribePrices } = useBinanceRealtime({
    autoConnect: true,
    symbols
  });

  // Subscribe to additional symbols if needed
  useEffect(() => {
    if (isConnected && symbols.length > 0) {
      subscribePrices(symbols);
    }
  }, [isConnected, symbols, subscribePrices]);

  return {
    prices: Array.from(prices.values()),
    isConnected,
    getPrice: (symbol: string) => prices.get(symbol)?.price || 0
  };
}
