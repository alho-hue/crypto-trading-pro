/**
 * NEUROVEST - Hook Trading
 * Gestion complète du trading Spot et Futures avec synchronisation temps réel
 * 
 * Fonctionnalités:
 * - Exécution trades (Market/Limit, Spot/Futures)
 * - PnL temps réel
 * - Gestion positions
 * - Mode démo/réel switchable
 * - WebSocket pour mises à jour temps réel
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  placeSpotOrder,
  placeFuturesOrder,
  closePosition,
  getTradingBalance,
  getOpenPositions,
  updatePnL,
  getTradeHistory,
  resetDemoAccount,
  getTradingStatus,
  calculateDefaultSLTP,
  validateTrade,
  TradeParams,
  FuturesTradeParams,
  Position,
  Balance
} from '../services/tradingApi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface UseTradingOptions {
  autoConnect?: boolean;
  defaultIsDemo?: boolean;
}

interface TradingState {
  balance: number;
  positions: Position[];
  totalUnrealizedPnl: number;
  isLoading: boolean;
  isExecuting: boolean;
  error: string | null;
  isDemo: boolean;
  isConnected: boolean;
}

interface TradeExecutionResult {
  success: boolean;
  orderId?: string;
  error?: string;
  risk?: {
    positionPercent: number;
    riskRewardRatio: number;
  };
}

export function useTrading(options: UseTradingOptions = {}) {
  const { autoConnect = true, defaultIsDemo = true } = options;
  
  const socketRef = useRef<Socket | null>(null);
  const pricesRef = useRef<Map<string, number>>(new Map());
  
  const [state, setState] = useState<TradingState>({
    balance: 0,
    positions: [],
    totalUnrealizedPnl: 0,
    isLoading: false,
    isExecuting: false,
    error: null,
    isDemo: defaultIsDemo,
    isConnected: false
  });

  // Connect WebSocket pour mises à jour temps réel
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('[Trading] Connected to realtime service');
      setState(prev => ({ ...prev, isConnected: true }));
      
      // Subscribe to price updates for tracked symbols
      const symbols = state.positions.map(p => p.symbol);
      if (symbols.length > 0) {
        socket.emit('subscribe-prices', [...new Set(symbols)]);
      }
    });

    socket.on('disconnect', () => {
      console.log('[Trading] Disconnected from realtime service');
      setState(prev => ({ ...prev, isConnected: false }));
    });

    socket.on('connect_error', (error) => {
      console.log('[Trading] Connection error (retrying):', error.message);
      setState(prev => ({ ...prev, isConnected: false }));
    });

    socket.on('price-update', (data) => {
      pricesRef.current.set(data.symbol, data.price);
      
      // Mettre à jour les PnL des positions concernées
      setState(prev => {
        const updatedPositions = prev.positions.map(pos => {
          if (pos.symbol === data.symbol) {
            const entryPrice = pos.entryPrice;
            const isLong = pos.side === 'LONG' || pos.side === 'BUY';
            const size = pos.size;
            
            const rawPnl = isLong
              ? (data.price - entryPrice) * size
              : (entryPrice - data.price) * size;
            
            const pnlPercent = (rawPnl / (entryPrice * size)) * 100;
            
            return {
              ...pos,
              markPrice: data.price,
              unrealizedPnl: rawPnl - (pos.fees || 0),
              pnlPercent
            };
          }
          return pos;
        });
        
        const totalPnl = updatedPositions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
        
        return {
          ...prev,
          positions: updatedPositions,
          totalUnrealizedPnl: totalPnl
        };
      });
    });

    socketRef.current = socket;
  }, [state.positions]);

  const disconnect = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.disconnect();
    }
    socketRef.current = null;
    setState(prev => ({ ...prev, isConnected: false }));
  }, []);

  // Charger les données initiales
  const loadData = useCallback(async (demoMode: boolean) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [balanceData, positionsData] = await Promise.all([
        getTradingBalance(demoMode),
        getOpenPositions(demoMode)
      ]);

      console.log('[useTrading] Balance loaded:', balanceData);
      console.log('[useTrading] Positions loaded:', positionsData);

      setState(prev => ({
        ...prev,
        balance: balanceData.balance,
        positions: positionsData.positions,
        totalUnrealizedPnl: positionsData.summary.totalUnrealizedPnl,
        isLoading: false
      }));
    } catch (error) {
      console.error('[useTrading] Load data error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load data'
      }));
    }
  }, []);

  // Exécuter un trade Spot
  const executeSpotTrade = useCallback(async (
    params: Omit<TradeParams, 'isDemo'>
  ): Promise<TradeExecutionResult> => {
    setState(prev => ({ ...prev, isExecuting: true, error: null }));
    
    try {
      // Validation pré-trade
      const validation = validateTrade(params, state.balance);
      if (!validation.valid) {
        setState(prev => ({
          ...prev,
          isExecuting: false,
          error: validation.errors.join(', ')
        }));
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }
      
      const result = await placeSpotOrder({
        ...params,
        isDemo: state.isDemo
      });
      
      if (result.success && result.order) {
        // Recharger les données après trade
        await loadData(state.isDemo);
        
        setState(prev => ({ ...prev, isExecuting: false }));
        
        return {
          success: true,
          orderId: result.order.id,
          risk: result.risk
        };
      } else {
        setState(prev => ({
          ...prev,
          isExecuting: false,
          error: result.error || 'Trade failed'
        }));
        return {
          success: false,
          error: result.error || 'Trade failed'
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isExecuting: false,
        error: message
      }));
      return {
        success: false,
        error: message
      };
    }
  }, [state.isDemo, state.balance, loadData]);

  // Exécuter un trade Futures
  const executeFuturesTrade = useCallback(async (
    params: Omit<FuturesTradeParams, 'isDemo'>
  ): Promise<TradeExecutionResult> => {
    setState(prev => ({ ...prev, isExecuting: true, error: null }));
    
    try {
      // Validation pré-trade
      const validation = validateTrade(params, state.balance);
      if (!validation.valid) {
        setState(prev => ({
          ...prev,
          isExecuting: false,
          error: validation.errors.join(', ')
        }));
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }
      
      const result = await placeFuturesOrder({
        ...params,
        isDemo: state.isDemo
      });
      
      if (result.success && result.order) {
        await loadData(state.isDemo);
        
        setState(prev => ({ ...prev, isExecuting: false }));
        
        return {
          success: true,
          orderId: result.order.id,
          risk: result.risk
        };
      } else {
        setState(prev => ({
          ...prev,
          isExecuting: false,
          error: result.error || 'Futures trade failed'
        }));
        return {
          success: false,
          error: result.error || 'Futures trade failed'
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isExecuting: false,
        error: message
      }));
      return {
        success: false,
        error: message
      };
    }
  }, [state.isDemo, state.balance, loadData]);

  // Fermer une position
  const closeTradingPosition = useCallback(async (
    position: Position
  ): Promise<{ success: boolean; pnl?: number; error?: string }> => {
    setState(prev => ({ ...prev, isExecuting: true }));
    
    try {
      const result = await closePosition(
        position.id,
        position.symbol,
        position.side,
        position.size,
        state.isDemo
      );
      
      if (result.success) {
        await loadData(state.isDemo);
      }
      
      setState(prev => ({ ...prev, isExecuting: false }));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, isExecuting: false, error: message }));
      return { success: false, error: message };
    }
  }, [state.isDemo, loadData]);

  // Toggle mode démo/réel
  const toggleDemoMode = useCallback((isDemoMode: boolean) => {
    setState(prev => ({ ...prev, isDemo: isDemoMode }));
  }, []);

  // Réinitialiser compte démo
  const resetDemo = useCallback(async () => {
    if (!state.isDemo) {
      setState(prev => ({ ...prev, error: 'Can only reset demo account' }));
      return { success: false };
    }
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await resetDemoAccount();
      await loadData(state.isDemo);
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: true };
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false };
    }
  }, [state.isDemo, loadData]);

  // Calculer SL/TP par défaut
  const getDefaultSLTP = useCallback((
    price: number,
    side: 'BUY' | 'SELL' | 'LONG' | 'SHORT'
  ) => {
    return calculateDefaultSLTP(price, side);
  }, []);

  // Calculer taille max position
  const getMaxPositionSize = useCallback((
    price: number,
    maxPercent: number = 2
  ) => {
    return (state.balance * (maxPercent / 100)) / price;
  }, [state.balance]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Auto-connect et load initial - exécuter une seule fois au mount
  useEffect(() => {
    if (autoConnect) {
      connect();
      loadData(state.isDemo);
    }
    
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rafraîchir périodiquement
  useEffect(() => {
    const interval = setInterval(() => {
      if (!state.isLoading && state.isConnected) {
        loadData(state.isDemo);
      }
    }, 30000); // Toutes les 30 secondes
    
    return () => clearInterval(interval);
  }, [state.isLoading, state.isConnected, state.isDemo]);

  return {
    // État
    balance: state.balance,
    positions: state.positions,
    totalUnrealizedPnl: state.totalUnrealizedPnl,
    isLoading: state.isLoading,
    isExecuting: state.isExecuting,
    error: state.error,
    isDemo: state.isDemo,
    isConnected: state.isConnected,
    
    // Actions
    executeSpotTrade,
    executeFuturesTrade,
    closePosition: closeTradingPosition,
    toggleDemoMode,
    resetDemo,
    loadData,
    clearError,
    
    // Utilitaires
    getDefaultSLTP,
    getMaxPositionSize,
    validateTrade: useCallback((params: TradeParams) => validateTrade(params, state.balance), [state.balance]),
    
    // Connexion
    connect,
    disconnect
  };
}

// Hook simplifié pour un seul symbole
export function useSymbolTrading(symbol: string, isDemo: boolean = true) {
  const trading = useTrading({ defaultIsDemo: isDemo });
  
  // Filtrer positions pour ce symbole
  const symbolPositions = trading.positions.filter(p => p.symbol === symbol);
  
  // Calculer PnL pour ce symbole
  const symbolPnl = symbolPositions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
  
  // Exécuter trade pour ce symbole
  const executeTrade = useCallback((
    params: Omit<TradeParams, 'symbol'>
  ) => {
    return trading.executeSpotTrade({
      ...params,
      symbol
    });
  }, [trading, symbol]);
  
  return {
    ...trading,
    symbolPositions,
    symbolPnl,
    executeTrade
  };
}
