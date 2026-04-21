/**
 * Hook pour la gestion des widgets temps réel NEUROVEST
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { fetchKlines, fetchPrices } from '../services/binanceApi';
import { showToast } from '../stores/toastStore';
import type { 
  WidgetConfig, 
  WidgetType, 
  WidgetSize, 
  WidgetTheme, 
  RefreshInterval,
  AISignal,
  AlertWidgetItem,
  PortfolioWidgetData,
  PerformanceWidgetData,
  MarketOverviewItem,
  WidgetLayout,
  WidgetData,
} from '../types/widgets';

// Cache pour éviter les re-renders inutiles
const dataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 2000; // 2 secondes

export interface UseWidgetsReturn {
  // État
  widgets: WidgetConfig[];
  layouts: WidgetLayout[];
  activeLayoutId: string | null;
  isLoading: boolean;
  lastUpdate: Date | null;
  
  // Données temps réel
  getWidgetData: (widgetId: string) => WidgetData | null;
  getAISignal: (symbol: string) => AISignal | null;
  getAlerts: () => AlertWidgetItem[];
  getPortfolioData: () => PortfolioWidgetData | null;
  getPerformanceData: () => PerformanceWidgetData | null;
  getMarketOverview: () => MarketOverviewItem[];
  
  // Actions
  addWidget: (config: Omit<WidgetConfig, 'id'>) => void;
  updateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
  removeWidget: (id: string) => void;
  reorderWidgets: (newOrder: string[]) => void;
  
  // Layouts
  saveLayout: (name: string) => void;
  loadLayout: (id: string) => void;
  deleteLayout: (id: string) => void;
  
  // Utilitaires
  refreshWidget: (id: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  exportConfig: () => string;
  importConfig: (json: string) => boolean;
  
  // Mobile/Desktop
  addToHomeScreen: () => void;
  configureMobileWidget: (platform: 'ios' | 'android', config: Partial<WidgetConfig>) => void;
}

export function useWidgets(): UseWidgetsReturn {
  // Stores
  const prices = useCryptoStore((state) => state.prices);
  const trades = useCryptoStore((state) => state.trades);
  const alerts = useCryptoStore((state) => state.alerts);
  const candleData = useCryptoStore((state) => state.candleData);
  
  // État local - Charger depuis localStorage immédiatement
  const getInitialWidgets = (): WidgetConfig[] => {
    try {
      const saved = localStorage.getItem('neurovest_widgets');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.widgets || [];
      }
    } catch (e) {
      console.error('Failed to parse saved widgets:', e);
    }
    // Widgets par défaut si rien n'est sauvegardé
    return [
      {
        id: 'widget-1',
        type: 'price',
        symbol: 'BTCUSDT',
        size: 'medium',
        theme: 'dark',
        refreshInterval: 5000,
        timeframe: '1h',
        showChart: true,
      },
      {
        id: 'widget-2',
        type: 'portfolio',
        size: 'large',
        theme: 'dark',
        refreshInterval: 30000,
      },
      {
        id: 'widget-3',
        type: 'ai-signal',
        symbol: 'BTCUSDT',
        size: 'medium',
        theme: 'dark',
        refreshInterval: 30000,
        aiEnabled: true,
      },
    ];
  };

  const getInitialLayouts = (): WidgetLayout[] => {
    try {
      const saved = localStorage.getItem('neurovest_widgets');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.layouts || [];
      }
    } catch (e) {
      console.error('Failed to parse saved layouts:', e);
    }
    return [];
  };

  const getInitialLayoutId = (): string | null => {
    try {
      const saved = localStorage.getItem('neurovest_widgets');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.activeLayoutId || null;
      }
    } catch (e) {
      console.error('Failed to parse saved layout id:', e);
    }
    return null;
  };

  const [widgets, setWidgets] = useState<WidgetConfig[]>(getInitialWidgets);
  const [layouts, setLayouts] = useState<WidgetLayout[]>(getInitialLayouts);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(getInitialLayoutId);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Réfs pour éviter les re-renders
  const refreshTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const widgetDataCache = useRef<Map<string, WidgetData>>(new Map());
  
  // Sauvegarder automatiquement
  useEffect(() => {
    const data = {
      widgets,
      layouts,
      activeLayoutId,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('neurovest_widgets', JSON.stringify(data));
  }, [widgets, layouts, activeLayoutId]);
  
  // Rafraîchissement automatique des widgets
  useEffect(() => {
    // Nettoyer les anciens timers
    refreshTimers.current.forEach((timer) => clearInterval(timer));
    refreshTimers.current.clear();
    
    // Créer de nouveaux timers pour chaque widget
    widgets.forEach((widget) => {
      const timer = setInterval(async () => {
        await refreshWidgetData(widget);
      }, widget.refreshInterval);
      
      refreshTimers.current.set(widget.id, timer);
    });
    
    return () => {
      refreshTimers.current.forEach((timer) => clearInterval(timer));
    };
  }, [widgets]);
  
  // Fonction pour rafraîchir un widget spécifique
  const refreshWidgetData = async (widget: WidgetConfig): Promise<void> => {
    const cacheKey = `${widget.id}-${widget.type}-${widget.symbol}`;
    const cached = dataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return; // Utiliser le cache
    }
    
    try {
      let data: any = null;
      
      switch (widget.type) {
        case 'price':
        case 'change':
        case 'volume':
        case 'mini-chart':
        case 'trend':
          if (widget.symbol) {
            const allData = await fetchPrices([widget.symbol]);
            const ticker = allData[0];
            if (ticker) {
              data = {
                price: parseFloat(ticker.lastPrice),
                change24h: parseFloat(ticker.priceChangePercent),
                change24hValue: parseFloat(ticker.priceChange),
                volume24h: parseFloat(ticker.volume),
                high24h: parseFloat(ticker.highPrice),
                low24h: parseFloat(ticker.lowPrice),
                lastUpdate: new Date(),
                trend: parseFloat(ticker.priceChangePercent) > 0 ? 'up' : 
                       parseFloat(ticker.priceChangePercent) < 0 ? 'down' : 'sideways',
              };
            }
          }
          break;
          
        case 'market-overview':
          const symbols = widget.symbols || ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
          const overview: MarketOverviewItem[] = [];
          for (const symbol of symbols) {
            const tickerData = await fetchPrices([symbol]);
            const ticker = tickerData[0];
            if (ticker) {
              overview.push({
                symbol,
                price: parseFloat(ticker.lastPrice),
                change24h: parseFloat(ticker.priceChangePercent),
                volume24h: parseFloat(ticker.volume),
                trend: parseFloat(ticker.priceChangePercent) > 0 ? 'up' : 
                       parseFloat(ticker.priceChangePercent) < 0 ? 'down' : 'sideways',
              });
            }
          }
          data = overview;
          break;
      }
      
      if (data) {
        widgetDataCache.current.set(widget.id, data);
        dataCache.set(cacheKey, { data, timestamp: Date.now() });
      }
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error(`Failed to refresh widget ${widget.id}:`, error);
    }
  };
  
  // Actions
  const addWidget = useCallback((config: Omit<WidgetConfig, 'id'>) => {
    const newWidget: WidgetConfig = {
      ...config,
      id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setWidgets((prev) => [...prev, newWidget]);
    showToast.success('Widget ajouté');
  }, []);
  
  const updateWidget = useCallback((id: string, updates: Partial<WidgetConfig>) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates } : w))
    );
  }, []);
  
  const removeWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    showToast.success('Widget supprimé');
  }, []);
  
  const reorderWidgets = useCallback((newOrder: string[]) => {
    setWidgets((prev) => {
      const ordered: WidgetConfig[] = [];
      newOrder.forEach((id) => {
        const widget = prev.find((w) => w.id === id);
        if (widget) ordered.push(widget);
      });
      // Ajouter les widgets non inclus dans l'ordre
      prev.forEach((w) => {
        if (!newOrder.includes(w.id)) ordered.push(w);
      });
      return ordered;
    });
  }, []);
  
  // Layouts
  const saveLayout = useCallback((name: string) => {
    const newLayout: WidgetLayout = {
      id: `layout-${Date.now()}`,
      name,
      widgets: [...widgets],
      isDefault: layouts.length === 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setLayouts((prev) => [...prev, newLayout]);
    setActiveLayoutId(newLayout.id);
    showToast.success(`Layout "${name}" sauvegardé`);
  }, [widgets, layouts.length]);
  
  const loadLayout = useCallback((id: string) => {
    const layout = layouts.find((l) => l.id === id);
    if (layout) {
      setWidgets([...layout.widgets]);
      setActiveLayoutId(id);
      showToast.success(`Layout "${layout.name}" chargé`);
    }
  }, [layouts]);
  
  const deleteLayout = useCallback((id: string) => {
    setLayouts((prev) => prev.filter((l) => l.id !== id));
    if (activeLayoutId === id) {
      setActiveLayoutId(null);
    }
    showToast.success('Layout supprimé');
  }, [activeLayoutId]);
  
  // Refresh
  const refreshWidget = useCallback(async (id: string) => {
    const widget = widgets.find((w) => w.id === id);
    if (widget) {
      await refreshWidgetData(widget);
    }
  }, [widgets]);
  
  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    for (const widget of widgets) {
      await refreshWidgetData(widget);
    }
    setIsLoading(false);
    setLastUpdate(new Date());
  }, [widgets]);
  
  // Getters de données
  const getWidgetData = useCallback((widgetId: string): WidgetData | null => {
    return widgetDataCache.current.get(widgetId) || null;
  }, []);
  
  const getAISignal = useCallback((symbol: string): AISignal | null => {
    const price = prices.get(symbol);
    if (!price) return null;
    
    // Analyse technique basée sur les prix réels
    const change24h = price.change24h || 0;
    const priceValue = price.price || 0;
    const volume24h = price.volume24h || 0;
    const high24h = price.high24h || priceValue;
    const low24h = price.low24h || priceValue;
    
    // Calcul du RSI approximatif basé sur le changement 24h
    const rsiApprox = Math.max(0, Math.min(100, 50 + change24h * 2));
    
    // Déterminer la tendance
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (change24h > 3) trend = 'BULLISH';
    else if (change24h < -3) trend = 'BEARISH';
    
    // Déterminer le signal
    let signal: 'BUY' | 'SELL' | 'WAIT' | 'HOLD' = 'WAIT';
    let confidence = 50;
    let reason = 'Marché sans direction claire, patience recommandée';
    
    if (rsiApprox > 70 && change24h > 5) {
      signal = 'SELL';
      confidence = Math.min(95, 70 + Math.abs(change24h));
      reason = `Surachat détecté (RSI approx: ${rsiApprox.toFixed(0)}), forte hausse sur 24h. Prendre des bénéfices.`;
    } else if (rsiApprox < 30 && change24h < -5) {
      signal = 'BUY';
      confidence = Math.min(95, 70 + Math.abs(change24h));
      reason = `Survente détectée (RSI approx: ${rsiApprox.toFixed(0)}), forte baisse sur 24h. Opportunité d'achat.`;
    } else if (trend === 'BULLISH' && volume24h > 1000000000) {
      signal = 'BUY';
      confidence = Math.min(90, 60 + change24h);
      reason = `Tendance haussière confirmée avec volume élevé (${(volume24h/1000000000).toFixed(2)}B). Momentum positif.`;
    } else if (trend === 'BEARISH' && volume24h > 1000000000) {
      signal = 'SELL';
      confidence = Math.min(90, 60 + Math.abs(change24h));
      reason = `Tendance baissière confirmée avec volume élevé. Cassure de support probable.`;
    } else if (change24h > 10) {
      signal = 'HOLD';
      confidence = 75;
      reason = 'Forte performance détectée, maintenir les positions actuelles.';
    }
    
    // Calcul des niveaux basés sur les données réelles
    const atr = (high24h - low24h) * 0.1; // Approximation ATR
    const entryPrice = priceValue;
    const stopLoss = signal === 'BUY' 
      ? Math.max(low24h * 0.98, priceValue - atr * 1.5)
      : Math.min(high24h * 1.02, priceValue + atr * 1.5);
    const takeProfit = signal === 'BUY'
      ? priceValue + atr * 3
      : priceValue - atr * 3;
    
    return {
      signal,
      confidence: Math.round(confidence),
      symbol,
      timeframe: '1h',
      reason,
      entryPrice: Math.round(entryPrice * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      timestamp: new Date(),
      indicators: {
        rsi: Math.round(rsiApprox),
        trend,
        volume: volume24h > 2000000000 ? 'HIGH' : volume24h > 1000000000 ? 'ABOVE_AVG' : 'NORMAL',
      },
    };
  }, [prices]);
  
  const getAlerts = useCallback((): AlertWidgetItem[] => {
    const widgetAlerts: AlertWidgetItem[] = [];
    
    // Alertes de prix
    prices.forEach((price, symbol) => {
      if (Math.abs(price.change24h || 0) > 5) {
        widgetAlerts.push({
          id: `price-${symbol}`,
          symbol,
          type: 'price',
          message: `${symbol}: ${price.change24h && price.change24h > 0 ? '+' : ''}${price.change24h?.toFixed(2)}%`,
          severity: Math.abs(price.change24h || 0) > 10 ? 'critical' : 'warning',
          timestamp: new Date(),
          acknowledged: false,
        });
      }
    });
    
    // Alertes bot
    const activeAlerts = alerts?.filter((a: any) => !a.acknowledged) || [];
    activeAlerts.forEach((alert: any) => {
      widgetAlerts.push({
        id: alert.id,
        symbol: alert.symbol || 'GENERAL',
        type: 'bot',
        message: alert.message,
        severity: alert.level === 'danger' ? 'critical' : alert.level === 'warning' ? 'warning' : 'info',
        timestamp: new Date(alert.timestamp),
        acknowledged: false,
      });
    });
    
    return widgetAlerts.slice(0, 10); // Max 10 alertes
  }, [prices, alerts]);
  
  const getPortfolioData = useCallback((): PortfolioWidgetData | null => {
    const activeTrades = trades.filter((t) => t.status === 'open');
    const closedTrades = trades.filter((t) => t.status === 'closed');
    
    if (activeTrades.length === 0 && closedTrades.length === 0) {
      return null;
    }
    
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const wins = closedTrades.filter((t) => (t.pnl || 0) > 0);
    
    // Calculer la valeur totale avec les prix actuels
    let totalValue = 0;
    activeTrades.forEach((trade) => {
      const currentPrice = prices.get(trade.symbol)?.price || trade.entryPrice;
      const positionValue = trade.quantity * currentPrice;
      totalValue += positionValue;
    });
    
    return {
      totalValue,
      totalPnL,
      totalPnLPercent: totalValue > 0 ? (totalPnL / totalValue) * 100 : 0,
      dayChange: totalPnL * 0.1, // Simulation
      dayChangePercent: 1.5,
      activeTrades: activeTrades.length,
      closedTrades: closedTrades.length,
      winRate: closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
    };
  }, [trades, prices]);
  
  const getPerformanceData = useCallback((): PerformanceWidgetData | null => {
    const today = new Date().toDateString();
    const todayTrades = trades.filter((t) => 
      t.status === 'closed' && 
      new Date(t.timestamp).toDateString() === today
    );
    
    if (todayTrades.length === 0) return null;
    
    const todayPnL = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const wins = todayTrades.filter((t) => (t.pnl || 0) > 0);
    const pnls = todayTrades.map((t) => t.pnl || 0);
    
    return {
      todayPnL,
      todayWinRate: (wins.length / todayTrades.length) * 100,
      todayTrades: todayTrades.length,
      bestTrade: Math.max(...pnls),
      worstTrade: Math.min(...pnls),
      streak: wins.length, // Simplifié
    };
  }, [trades]);
  
  const getMarketOverview = useCallback((): MarketOverviewItem[] => {
    const overview: MarketOverviewItem[] = [];
    
    // Utiliser les prix disponibles du store
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOTUSDT', 'DOGEUSDT'];
    symbols.forEach((symbol) => {
      const price = prices.get(symbol);
      if (price) {
        const change24h = price.change24h || 0;
        const volume24h = price.volume24h || 0;
        let trend: 'up' | 'down' | 'sideways' = 'sideways';
        if (change24h > 1) trend = 'up';
        else if (change24h < -1) trend = 'down';
        
        overview.push({
          symbol,
          price: price.price,
          change24h,
          volume24h, // Vrai volume depuis l'API
          trend,
        });
      }
    });
    
    // Trier par volume décroissant
    return overview.sort((a, b) => b.volume24h - a.volume24h);
  }, [prices]);
  
  // Export/Import
  const exportConfig = useCallback((): string => {
    const config = {
      widgets,
      layouts,
      version: '2.0',
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(config, null, 2);
  }, [widgets, layouts]);
  
  const importConfig = useCallback((json: string): boolean => {
    try {
      const config = JSON.parse(json);
      if (config.widgets) {
        setWidgets(config.widgets);
      }
      if (config.layouts) {
        setLayouts(config.layouts);
      }
      showToast.success('Configuration importée');
      return true;
    } catch (e) {
      showToast.error('Configuration invalide');
      return false;
    }
  }, []);
  
  // Mobile/Desktop
  const addToHomeScreen = useCallback(() => {
    if ('standalone' in window.navigator) {
      showToast.info('Appuyez sur "Partager" puis "Sur l\'écran d\'accueil"');
    } else if (/Android/.test(navigator.userAgent)) {
      showToast.info('Menu ⋮ → "Ajouter à l\'écran d\'accueil"');
    } else {
      showToast.info('Chrome: ⋮ → Install, Safari: Partager → + Accueil');
    }
  }, []);
  
  const configureMobileWidget = useCallback((platform: 'ios' | 'android', config: Partial<WidgetConfig>) => {
    const mobileConfig = {
      platform,
      enabled: true,
      ...config,
    };
    localStorage.setItem(`mobile_widget_${platform}`, JSON.stringify(mobileConfig));
    showToast.success(`Widget ${platform.toUpperCase()} configuré`);
  }, []);
  
  return {
    widgets,
    layouts,
    activeLayoutId,
    isLoading,
    lastUpdate,
    getWidgetData,
    getAISignal,
    getAlerts,
    getPortfolioData,
    getPerformanceData,
    getMarketOverview,
    addWidget,
    updateWidget,
    removeWidget,
    reorderWidgets,
    saveLayout,
    loadLayout,
    deleteLayout,
    refreshWidget,
    refreshAll,
    exportConfig,
    importConfig,
    addToHomeScreen,
    configureMobileWidget,
  };
}

export default useWidgets;
