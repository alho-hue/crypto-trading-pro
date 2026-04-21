/**
 * 🚀 Hook pour le Trading Bot Local
 * 
 * Gère toute la logique du bot de trading automatique
 * avec connexion à l'IA Ethernal et exécution réelle.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import {
  getBotConfig,
  saveBotConfig,
  getBotPositions,
  getBotStats,
  analyzeAndDecide,
  executeBotDecision,
  updatePositionsRealtime,
  startLocalBot,
  stopLocalBot,
  resetLocalBot,
  LocalBotConfig,
  BotPosition,
  BotStats,
  BotDecision
} from '../services/localAutoTrading';

export interface UseLocalTradingBotReturn {
  // État
  config: LocalBotConfig;
  positions: BotPosition[];
  stats: BotStats;
  isRunning: boolean;
  isAnalyzing: boolean;
  lastDecision: BotDecision | null;
  
  // Actions
  startBot: () => void;
  stopBot: () => void;
  updateConfig: (updates: Partial<LocalBotConfig>) => void;
  resetBot: () => void;
  forceAnalyze: (symbol: string) => Promise<BotDecision>;
  closePosition: (positionId: string) => Promise<void>;
  
  // Info
  activePositionsCount: number;
  canTradeToday: boolean;
  currentDrawdown: number;
}

export function useLocalTradingBot(): UseLocalTradingBotReturn {
  const [config, setConfig] = useState<LocalBotConfig>(getBotConfig());
  const [positions, setPositions] = useState<BotPosition[]>(getBotPositions());
  const [stats, setStats] = useState<BotStats>(getBotStats());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastDecision, setLastDecision] = useState<BotDecision | null>(null);
  
  const prices = useCryptoStore((state) => state.prices);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunning = config.enabled;
  
  // Rafraîchir les données
  const refreshData = useCallback(() => {
    setPositions(getBotPositions());
    setStats(getBotStats());
  }, []);
  
  // Mettre à jour positions en temps réel
  useEffect(() => {
    updatePositionsRealtime();
    refreshData();
  }, [prices, refreshData]);
  
  // Boucle principale du bot
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    
    const runAnalysis = async () => {
      setIsAnalyzing(true);
      
      try {
        // Analyser chaque symbole
        for (const symbol of config.symbols) {
          const currentPrice = prices.get(symbol)?.price;
          if (!currentPrice) continue;
          
          const decision = await analyzeAndDecide(symbol, currentPrice);
          setLastDecision(decision);
          
          // Exécuter si nécessaire
          if (decision.action !== 'HOLD') {
            const result = await executeBotDecision(decision);
            if (result.success) {
              console.log(`[BOT] ✅ ${decision.action} exécuté sur ${symbol}`);
            } else {
              console.error(`[BOT] ❌ Échec ${decision.action} sur ${symbol}:`, result.error);
            }
            refreshData();
          }
        }
      } catch (error) {
        console.error('[BOT] Erreur analyse:', error);
      } finally {
        setIsAnalyzing(false);
      }
    };
    
    // Exécuter immédiatement puis toutes les 30 secondes
    runAnalysis();
    intervalRef.current = setInterval(runAnalysis, 30000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, config.symbols, prices, refreshData]);
  
  // Actions
  const startBot = useCallback(() => {
    startLocalBot();
    setConfig(getBotConfig());
  }, []);
  
  const stopBot = useCallback(() => {
    stopLocalBot();
    setConfig(getBotConfig());
  }, []);
  
  const updateConfig = useCallback((updates: Partial<LocalBotConfig>) => {
    const updated = saveBotConfig(updates);
    setConfig(updated);
  }, []);
  
  const resetBot = useCallback(() => {
    resetLocalBot();
    setConfig(getBotConfig());
    setPositions(getBotPositions());
    setStats(getBotStats());
  }, []);
  
  const forceAnalyze = useCallback(async (symbol: string): Promise<BotDecision> => {
    const currentPrice = prices.get(symbol)?.price || 0;
    const decision = await analyzeAndDecide(symbol, currentPrice);
    setLastDecision(decision);
    return decision;
  }, [prices]);
  
  const closePosition = useCallback(async (positionId: string): Promise<void> => {
    const position = positions.find(p => p.id === positionId);
    if (!position) {
      console.error('[closePosition] Position non trouvée:', positionId);
      return;
    }
    
    console.log('[closePosition] Fermeture position:', position.symbol, 'ID:', positionId);
    
    const decision: BotDecision = {
      action: 'CLOSE',
      symbol: position.symbol,
      reason: 'Fermeture manuelle',
      position
    };
    
    const result = await executeBotDecision(decision);
    
    if (result.success) {
      console.log('[closePosition] Position fermée avec succès:', position.symbol);
    } else {
      console.error('[closePosition] Échec fermeture:', result.error);
    }
    
    refreshData();
  }, [positions, refreshData]);
  
  // Calculs dérivés
  const activePositionsCount = positions.filter(p => !p.exitPrice).length;
  const canTradeToday = stats.dailyTradeCount < config.maxDailyTrades;
  const currentDrawdown = stats.maxDrawdown;
  
  return {
    config,
    positions,
    stats,
    isRunning,
    isAnalyzing,
    lastDecision,
    startBot,
    stopBot,
    updateConfig,
    resetBot,
    forceAnalyze,
    closePosition,
    activePositionsCount,
    canTradeToday,
    currentDrawdown
  };
}
