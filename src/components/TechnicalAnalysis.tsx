/**
 * NEUROVEST - Professional Technical Analysis Platform
 * 
 * Features:
 * - Advanced candlestick chart with lightweight-charts
 * - Multi-timeframe analysis (15m, 1h, 4h, 1d)
 * - Complete indicators (RSI, MACD, Bollinger, SMA/EMA, Volume)
 * - AI Analysis (Ethernal) with pattern detection
 * - Auto-detected support/resistance and supply/demand zones
 * - Trading setup with entry/SL/TP/RiskReward
 * - Manual drawing tools
 * - Bot integration
 * - Alert creation from analysis
 * - Global integration with Trading/Alerts/Portfolio/Strategies
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { FCFAConverter } from './FCFAConverter';
import { 
  LineChart, TrendingUp, Activity, BarChart3, Target, 
  Settings, Clock, ZoomIn, ZoomOut, Move, Edit3,
  AlertTriangle, Bot, Send, Plus, Trash2, Save, Eye,
  ChevronDown, ChevronUp, Maximize2, Minimize2, Crosshair,
  Layers, TrendingDown, Zap, Bell, RefreshCw, Play, Pause
} from 'lucide-react';
import { 
  calculateRSI, calculateMACD, calculateBollingerBands, 
  calculateATR, calculateStochastic, calculateSMA, calculateEMA 
} from '../utils/indicators';
import { analyzeWithEthernal, formatEthernalAnalysis } from '../services/ethernalAnalysis';
import { performAdvancedAnalysis, getAITradingSetup, formatAnalysisForDisplay } from '../services/advancedAnalysis';
import { createAlert } from '../services/alertsApi';
import { placeSpotOrder, placeFuturesOrder, calculateDefaultSLTP } from '../services/tradingApi';
import { fetchKlines } from '../services/binanceApi';
import { useToastStore, showToast } from '../stores/toastStore';
import type { CandleData, Timeframe, Trade } from '../types';
import type { ISeriesApi, IChartApi, Time } from 'lightweight-charts';

// Chart container refs type
type ChartRefs = {
  chart: IChartApi | null;
  candleSeries: ISeriesApi<'Candlestick'> | null;
  volumeSeries: ISeriesApi<'Histogram'> | null;
  rsiSeries: ISeriesApi<'Line'> | null;
  macdSeries: ISeriesApi<'Line'> | null;
  signalSeries: ISeriesApi<'Line'> | null;
  histogramSeries: ISeriesApi<'Histogram'> | null;
  smaSeries: ISeriesApi<'Line'> | null;
  emaSeries: ISeriesApi<'Line'> | null;
  upperBandSeries: ISeriesApi<'Line'> | null;
  lowerBandSeries: ISeriesApi<'Line'> | null;
  middleBandSeries: ISeriesApi<'Line'> | null;
};

// Multi-timeframe data cache
type MTFData = {
  '15m': CandleData[];
  '1h': CandleData[];
  '4h': CandleData[];
  '1d': CandleData[];
};

// Drawing types
type DrawingTool = 'cursor' | 'line' | 'rectangle' | 'fibonacci' | 'text' | 'measure';

// Indicator config type
interface IndicatorConfig {
  rsi: { enabled: boolean; period: number; overbought: number; oversold: number };
  macd: { enabled: boolean; fast: number; slow: number; signal: number };
  bollinger: { enabled: boolean; period: number; stdDev: number };
  sma: { enabled: boolean; period: number };
  ema: { enabled: boolean; period: number };
  volume: { enabled: boolean };
  atr: { enabled: boolean; period: number };
  stochastic: { enabled: boolean; kPeriod: number; dPeriod: number };
}

// AI Analysis result type
interface AIAnalysis {
  trend: 'HAUSSIERE' | 'BAISSIERE' | 'NEUTRE';
  trendStrength: number;
  setup: {
    direction: 'LONG' | 'SHORT' | 'NEUTRAL';
    entryPrice: number | null;
    stopLoss: number | null;
    takeProfit: number | null;
    riskReward: number | null;
    confidence: number;
    score: number;
    isValid: boolean;
    confirmations: string[];
    warnings: string[];
  };
  zones: {
    supports: number[];
    resistances: number[];
    supplyZones: number[];
    demandZones: number[];
  };
  patterns: Array<{ name: string; type: 'bullish' | 'bearish' | 'neutral'; reliability: number }>;
  indicators: {
    rsi: number | null;
    ema9: number | null;
    ema21: number | null;
    volatility: string;
    momentum: number;
  };
}

export default function TechnicalAnalysis() {
  // Store data
  const candleData = useCryptoStore((state) => state.candleData);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  const prices = useCryptoStore((state) => state.prices);
  const timeframe = useCryptoStore((state) => state.timeframe);
  const setTimeframe = useCryptoStore((state) => state.setTimeframe);
  const indicators = useCryptoStore((state) => state.indicators);
  const toggleIndicator = useCryptoStore((state) => state.toggleIndicator);
  const updateIndicatorParams = useCryptoStore((state) => state.updateIndicatorParams);
  const addAlert = useCryptoStore((state) => state.addAlert);
  const addTrade = useCryptoStore((state) => state.addTrade);
  
  // Use showToast helper functions directly

  // Refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRefs = useRef<ChartRefs>({
    chart: null,
    candleSeries: null,
    volumeSeries: null,
    rsiSeries: null,
    macdSeries: null,
    signalSeries: null,
    histogramSeries: null,
    smaSeries: null,
    emaSeries: null,
    upperBandSeries: null,
    lowerBandSeries: null,
    middleBandSeries: null,
  });

  // State
  const [isChartReady, setIsChartReady] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('1h');
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('cursor');
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mtfData, setMtfData] = useState<MTFData>({ '15m': [], '1h': [], '4h': [], '1d': [] });
  const [isLoadingMTF, setIsLoadingMTF] = useState(false);
  const [showSetupPanel, setShowSetupPanel] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [manualDrawings, setManualDrawings] = useState<any[]>([]);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(true);
  const [chartHeight, setChartHeight] = useState(500);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Indicator states
  const [indicatorConfig, setIndicatorConfig] = useState<IndicatorConfig>({
    rsi: { enabled: false, period: 14, overbought: 70, oversold: 30 },
    macd: { enabled: false, fast: 12, slow: 26, signal: 9 },
    bollinger: { enabled: false, period: 20, stdDev: 2 },
    sma: { enabled: false, period: 20 },
    ema: { enabled: false, period: 12 },
    volume: { enabled: true },
    atr: { enabled: false, period: 14 },
    stochastic: { enabled: false, kPeriod: 14, dPeriod: 3 },
  });

  // Derived state
  const priceData = prices.get(selectedSymbol);
  
  // Calculate all indicators
  const calculatedIndicators = useMemo(() => {
    if (candleData.length < 50) return null;
    
    const closes = candleData.map(c => c.close);
    const volumes = candleData.map(c => c.volume);
    
    return {
      rsi: calculateRSI(candleData, 14),
      macd: calculateMACD(candleData, 12, 26, 9),
      bollinger: calculateBollingerBands(candleData, 20, 2),
      atr: calculateATR(candleData, 14),
      stochastic: calculateStochastic(candleData, 14, 3),
      sma20: calculateSMA(candleData, 20),
      sma50: calculateSMA(candleData, 50),
      ema12: calculateEMA(candleData, 12),
      ema26: calculateEMA(candleData, 26),
      volumes,
    };
  }, [candleData]);

  // Get last values
  const lastValues = useMemo(() => {
    if (!calculatedIndicators) return null;
    
    const lastIndex = candleData.length - 1;
    return {
      rsi: calculatedIndicators.rsi[lastIndex] ?? 50,
      macd: {
        macd: calculatedIndicators.macd.macd[lastIndex] ?? 0,
        signal: calculatedIndicators.macd.signal[lastIndex] ?? 0,
        histogram: calculatedIndicators.macd.histogram[lastIndex] ?? 0,
      },
      bollinger: {
        upper: calculatedIndicators.bollinger.upper[lastIndex] ?? 0,
        middle: calculatedIndicators.bollinger.middle[lastIndex] ?? 0,
        lower: calculatedIndicators.bollinger.lower[lastIndex] ?? 0,
      },
      atr: calculatedIndicators.atr[lastIndex] ?? 0,
      stochastic: {
        k: calculatedIndicators.stochastic.k[lastIndex] ?? 50,
        d: calculatedIndicators.stochastic.d[lastIndex] ?? 50,
      },
      sma20: calculatedIndicators.sma20[lastIndex] ?? 0,
      sma50: calculatedIndicators.sma50[lastIndex] ?? 0,
      ema12: calculatedIndicators.ema12[lastIndex] ?? 0,
      ema26: calculatedIndicators.ema26[lastIndex] ?? 0,
    };
  }, [calculatedIndicators, candleData.length]);

  // Calculate support/resistance from recent data
  const keyLevels = useMemo(() => {
    if (candleData.length < 20) return { support: 0, resistance: 0, supports: [] as number[], resistances: [] as number[] };
    
    const recent20 = candleData.slice(-20);
    const highs = recent20.map(c => c.high);
    const lows = recent20.map(c => c.low);
    
    // Find multiple levels using clustering
    const findLevels = (values: number[], count: number): number[] => {
      const sorted = [...values].sort((a, b) => a - b);
      const levels: number[] = [];
      
      for (const val of sorted) {
        const isDuplicate = levels.some(l => Math.abs(l - val) / l < 0.005);
        if (!isDuplicate) levels.push(val);
        if (levels.length >= count) break;
      }
      
      return levels;
    };
    
    const support = Math.min(...lows);
    const resistance = Math.max(...highs);
    const supports = findLevels(lows, 3);
    const resistances = findLevels(highs, 3);
    
    return { support, resistance, supports, resistances };
  }, [candleData]);

  // Determine trend
  const trend = useMemo(() => {
    if (!lastValues || candleData.length < 50) return { direction: 'NEUTRE' as const, strength: 0 };
    
    const isBullish = lastValues.ema12 > lastValues.ema26 && lastValues.rsi > 50;
    const isBearish = lastValues.ema12 < lastValues.ema26 && lastValues.rsi < 50;
    
    let strength = 0;
    if (isBullish) {
      strength = 50 + (lastValues.rsi - 50) + (lastValues.macd.histogram > 0 ? 10 : 0);
    } else if (isBearish) {
      strength = 50 + (50 - lastValues.rsi) + (lastValues.macd.histogram < 0 ? 10 : 0);
    }
    
    return {
      direction: isBullish ? 'HAUSSIERE' as const : isBearish ? 'BAISSIERE' as const : 'NEUTRE' as const,
      strength: Math.min(100, Math.round(strength)),
    };
  }, [lastValues, candleData.length]);

  // Initialize chart
  useEffect(() => {
    let isMounted = true;
    
    const initChart = async () => {
      if (!chartContainerRef.current || chartRefs.current.chart) return;
      
      const { createChart } = await import('lightweight-charts');
      if (!isMounted) return;
      
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: '#0f172a' },
          textColor: '#94a3b8',
        },
        grid: {
          vertLines: { color: '#1e293b' },
          horzLines: { color: '#1e293b' },
        },
        crosshair: {
          mode: 1,
          vertLine: { color: '#3b82f6', width: 1, style: 2 },
          horzLine: { color: '#3b82f6', width: 1, style: 2 },
        },
        rightPriceScale: {
          borderColor: '#1e293b',
        },
        timeScale: {
          borderColor: '#1e293b',
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: { vertTouchDrag: false },
      });
      
      // Create candlestick series
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
      
      // Create volume series
      const volumeSeries = chart.addHistogramSeries({
        color: '#3b82f6',
        priceFormat: { type: 'volume' },
        priceScaleId: 'left',
      });
      
      // Configure volume scale
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      
      chartRefs.current = {
        chart,
        candleSeries,
        volumeSeries,
        rsiSeries: null,
        macdSeries: null,
        signalSeries: null,
        histogramSeries: null,
        smaSeries: null,
        emaSeries: null,
        upperBandSeries: null,
        lowerBandSeries: null,
        middleBandSeries: null,
      };
      
      chart.applyOptions({
        height: chartHeight,
      });
      
      setIsChartReady(true);
      
      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    };
    
    initChart();
    
    return () => {
      isMounted = false;
      if (chartRefs.current.chart) {
        chartRefs.current.chart.remove();
        chartRefs.current.chart = null;
      }
    };
  }, [chartHeight]);

  // Update chart data
  useEffect(() => {
    if (!isChartReady || !chartRefs.current.chart || !chartRefs.current.candleSeries) return;
    
    const { candleSeries, volumeSeries, chart } = chartRefs.current;
    
    // Format data for lightweight-charts
    const chartData = candleData.map(c => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    
    const volumeData = candleData.map((c, i) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
    }));
    
    candleSeries.setData(chartData);
    if (volumeSeries) volumeSeries.setData(volumeData);
    
    // Fit content
    chart.timeScale().fitContent();
    
    // Update overlays
    updateIndicatorOverlays();
    
    // Auto-detect zones if enabled
    if (showZones) {
      drawKeyLevels();
    }
  }, [candleData, isChartReady, showZones]);

  // Update indicator overlays
  const updateIndicatorOverlays = () => {
    const { chart, candleSeries } = chartRefs.current;
    if (!chart || !candleSeries) return;
    
    // SMA overlay
    if (indicatorConfig.sma.enabled && calculatedIndicators) {
      if (!chartRefs.current.smaSeries) {
        chartRefs.current.smaSeries = chart.addLineSeries({
          color: '#f59e0b',
          lineWidth: 2,
          title: `SMA(${indicatorConfig.sma.period})`,
        });
      }
      
      const smaData = candleData.map((c, i) => ({
        time: c.time as Time,
        value: calculatedIndicators.sma20[i] ?? null,
      })).filter(d => d.value !== null);
      
      chartRefs.current.smaSeries.setData(smaData as any);
    } else if (chartRefs.current.smaSeries) {
      chart.removeSeries(chartRefs.current.smaSeries);
      chartRefs.current.smaSeries = null;
    }
    
    // EMA overlay
    if (indicatorConfig.ema.enabled && calculatedIndicators) {
      if (!chartRefs.current.emaSeries) {
        chartRefs.current.emaSeries = chart.addLineSeries({
          color: '#8b5cf6',
          lineWidth: 2,
          title: `EMA(${indicatorConfig.ema.period})`,
        });
      }
      
      const emaData = candleData.map((c, i) => ({
        time: c.time as Time,
        value: calculatedIndicators.ema12[i] ?? null,
      })).filter(d => d.value !== null);
      
      chartRefs.current.emaSeries.setData(emaData as any);
    } else if (chartRefs.current.emaSeries) {
      chart.removeSeries(chartRefs.current.emaSeries);
      chartRefs.current.emaSeries = null;
    }
    
    // Bollinger Bands
    if (indicatorConfig.bollinger.enabled && calculatedIndicators) {
      if (!chartRefs.current.upperBandSeries) {
        chartRefs.current.upperBandSeries = chart.addLineSeries({
          color: 'rgba(239, 68, 68, 0.5)',
          lineWidth: 1,
          title: 'BB Upper',
        });
        chartRefs.current.middleBandSeries = chart.addLineSeries({
          color: 'rgba(148, 163, 184, 0.5)',
          lineWidth: 1,
          title: 'BB Middle',
        });
        chartRefs.current.lowerBandSeries = chart.addLineSeries({
          color: 'rgba(34, 197, 94, 0.5)',
          lineWidth: 1,
          title: 'BB Lower',
        });
      }
      
      const upperData = candleData.map((c, i) => ({
        time: c.time as Time,
        value: calculatedIndicators.bollinger.upper[i] ?? null,
      })).filter(d => d.value !== null);
      
      const middleData = candleData.map((c, i) => ({
        time: c.time as Time,
        value: calculatedIndicators.bollinger.middle[i] ?? null,
      })).filter(d => d.value !== null);
      
      const lowerData = candleData.map((c, i) => ({
        time: c.time as Time,
        value: calculatedIndicators.bollinger.lower[i] ?? null,
      })).filter(d => d.value !== null);
      
      chartRefs.current.upperBandSeries?.setData(upperData as any);
      chartRefs.current.middleBandSeries?.setData(middleData as any);
      chartRefs.current.lowerBandSeries?.setData(lowerData as any);
    } else {
      if (chartRefs.current.upperBandSeries) {
        chart.removeSeries(chartRefs.current.upperBandSeries);
        chartRefs.current.upperBandSeries = null;
      }
      if (chartRefs.current.middleBandSeries) {
        chart.removeSeries(chartRefs.current.middleBandSeries);
        chartRefs.current.middleBandSeries = null;
      }
      if (chartRefs.current.lowerBandSeries) {
        chart.removeSeries(chartRefs.current.lowerBandSeries);
        chartRefs.current.lowerBandSeries = null;
      }
    }
  };

  // Draw key levels (support/resistance)
  const drawKeyLevels = () => {
    const { chart } = chartRefs.current;
    if (!chart) return;
    
    // Use lightweight-charts primitives plugin or markers
    // For now, we'll use price lines
    const currentCandle = candleData[candleData.length - 1];
    if (!currentCandle) return;
    
    // Add price lines for key levels
    keyLevels.supports.forEach((level, i) => {
      const line = chart.addLineSeries({
        color: 'rgba(34, 197, 94, 0.3)',
        lineWidth: 1,
        lastValueVisible: i === 0,
        title: i === 0 ? 'Support' : undefined,
        priceScaleId: 'right',
      });
      
      line.setData(candleData.map(c => ({
        time: c.time as Time,
        value: level,
      })));
    });
    
    keyLevels.resistances.forEach((level, i) => {
      const line = chart.addLineSeries({
        color: 'rgba(239, 68, 68, 0.3)',
        lineWidth: 1,
        lastValueVisible: i === 0,
        title: i === 0 ? 'Résistance' : undefined,
        priceScaleId: 'right',
      });
      
      line.setData(candleData.map(c => ({
        time: c.time as Time,
        value: level,
      })));
    });
  };

  // Update price
  useEffect(() => {
    if (priceData?.price) {
      setCurrentPrice(priceData.price);
    }
  }, [priceData]);

  // Fetch multi-timeframe data
  const fetchMTFData = useCallback(async () => {
    setIsLoadingMTF(true);
    
    try {
      const timeframes: ('15m' | '1h' | '4h' | '1d')[] = ['15m', '1h', '4h', '1d'];
      const newData: Partial<MTFData> = {};
      
      for (const tf of timeframes) {
        try {
          const klines = await fetchKlines(selectedSymbol, tf, 100);
          if (Array.isArray(klines)) {
            const candles: CandleData[] = klines.map((k: any) => ({
              time: k[0] / 1000,
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
            }));
            newData[tf] = candles;
          }
        } catch (e) {
          console.warn(`Failed to fetch ${tf} data:`, e);
        }
      }
      
      setMtfData(prev => ({ ...prev, ...newData }));
    } finally {
      setIsLoadingMTF(false);
    }
  }, [selectedSymbol]);

  // Run AI analysis
  const runAIAnalysis = useCallback(async () => {
    if (candleData.length < 50) {
      showToast.warning('Pas assez de données pour l\'analyse IA');
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      // Use advanced analysis from existing service
      const analysis = performAdvancedAnalysis(selectedSymbol, currentPrice);
      
      // Also try Ethernal analysis
      const ethernalResult = await analyzeWithEthernal(selectedSymbol);
      
      // Combine results
      const combinedAnalysis: AIAnalysis = {
        trend: analysis.trend,
        trendStrength: analysis.trendStrength,
        setup: analysis.setup,
        zones: analysis.zones,
        patterns: analysis.candlePatterns,
        indicators: {
          rsi: analysis.indicators.rsi,
          ema9: analysis.indicators.ema9,
          ema21: analysis.indicators.ema21,
          volatility: analysis.indicators.volatility,
          momentum: analysis.confluence.total,
        },
      };
      
      setAiAnalysis(combinedAnalysis);
      setShowAIAnalysis(true);
      
      showToast.success(`Analyse IA complète - Score: ${combinedAnalysis.setup.score}%`);
    } catch (error) {
      showToast.error('Erreur lors de l\'analyse IA');
    } finally {
      setIsAnalyzing(false);
    }
  }, [candleData, selectedSymbol, currentPrice]);

  // Create alert from analysis
  const createAlertFromAnalysis = useCallback(async (type: 'breakout' | 'zone' | 'signal') => {
    if (!aiAnalysis?.setup.isValid) {
      showToast.warning('Pas de setup valide pour créer une alerte');
      return;
    }
    
    try {
      let condition: 'above' | 'below' | 'crosses_up' | 'crosses_down' = 'above';
      let targetPrice = 0;
      let message = '';
      
      switch (type) {
        case 'breakout':
          condition = aiAnalysis.setup.direction === 'LONG' ? 'above' : 'below';
          targetPrice = aiAnalysis.setup.direction === 'LONG' 
            ? keyLevels.resistance 
            : keyLevels.support;
          message = `Alerte Breakout ${aiAnalysis.setup.direction}`;
          break;
        case 'zone':
          condition = 'crosses_up';
          targetPrice = aiAnalysis.zones.supports[0] || currentPrice * 0.95;
          message = 'Zone de support touchée';
          break;
        case 'signal':
          condition = aiAnalysis.setup.direction === 'LONG' ? 'above' : 'below';
          targetPrice = aiAnalysis.setup.entryPrice || currentPrice;
          message = `Signal ${aiAnalysis.setup.direction} - Score: ${aiAnalysis.setup.score}%`;
          break;
      }
      
      const result = await createAlert(selectedSymbol, condition, targetPrice, ['push']);
      
      if (result.success && result.alert) {
        addAlert({
          id: result.alert._id,
          symbol: result.alert.symbol,
          type: 'price',
          condition: result.alert.condition === 'above' ? 'above' : 'below',
          value: result.alert.targetPrice,
          message,
          active: true,
          createdAt: Date.now(),
        });
        
        showToast.success('Alerte créée avec succès');
      } else {
        showToast.error(result.error || 'Échec de création de l\'alerte');
      }
    } catch (error) {
      showToast.error('Erreur lors de la création de l\'alerte');
    }
  }, [aiAnalysis, selectedSymbol, currentPrice, keyLevels, addAlert]);

  // Send setup to bot
  const sendToBot = useCallback(async () => {
    if (!aiAnalysis?.setup.isValid) {
      showToast.warning('Pas de setup valide à envoyer au bot');
      return;
    }
    
    try {
      const setup = aiAnalysis.setup;
      
      if (setup.direction === 'NEUTRAL' || !setup.entryPrice || !setup.stopLoss || !setup.takeProfit) {
        showToast.warning('Setup incomplet');
        return;
      }
      
      const side = setup.direction === 'LONG' ? 'BUY' : 'SELL';
      
      // Place order via trading API
      const result = await placeSpotOrder({
        symbol: selectedSymbol,
        side,
        type: 'MARKET',
        quantity: 0.001, // Minimum quantity - adjust based on balance
        stopLoss: setup.stopLoss,
        takeProfit: setup.takeProfit,
        isDemo: true, // Default to demo for safety
      });
      
      if (result.success) {
        // Add to trades
        const newTrade: Trade = {
          id: result.order?.id || Date.now().toString(),
          symbol: selectedSymbol,
          type: setup.direction === 'LONG' ? 'buy' : 'sell',
          entryPrice: setup.entryPrice,
          quantity: 0.001,
          stopLoss: setup.stopLoss,
          takeProfit: setup.takeProfit,
          timestamp: Date.now(),
          status: 'open',
          strategy: 'AI_SETUP',
          notes: `Setup IA - Score: ${setup.score}%, R/R: ${setup.riskReward}`,
        };
        
        addTrade(newTrade);
        showToast.success(`Trade ${setup.direction} exécuté via bot`);
      } else {
        showToast.error(result.error || 'Échec de l\'exécution du trade');
      }
    } catch (error) {
        showToast.error('Erreur lors de l\'envoi au bot');
    }
  }, [aiAnalysis, selectedSymbol, addTrade]);

  // Execute trade manually
  const executeTrade = useCallback(async (direction: 'LONG' | 'SHORT') => {
    try {
      const sltp = calculateDefaultSLTP(currentPrice, direction === 'LONG' ? 'BUY' : 'SELL', 2, 4);
      
      const result = await placeSpotOrder({
        symbol: selectedSymbol,
        side: direction === 'LONG' ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity: 0.001,
        stopLoss: sltp.stopLoss,
        takeProfit: sltp.takeProfit,
        isDemo: true,
      });
      
      if (result.success) {
        showToast.success(`Trade ${direction} exécuté`);
      } else {
        showToast.error(result.error || 'Échec de l\'exécution');
      }
    } catch (error) {
        showToast.error('Erreur lors de l\'exécution du trade');
    }
  }, [selectedSymbol, currentPrice]);

  // Change timeframe
  const changeTimeframe = useCallback((tf: Timeframe) => {
    setActiveTimeframe(tf);
    setTimeframe(tf);
  }, [setTimeframe]);

  // Zoom chart
  const zoomChart = useCallback((direction: 'in' | 'out') => {
    const { chart } = chartRefs.current;
    if (!chart) return;
    
    const timeScale = chart.timeScale();
    const visibleLogicalRange = timeScale.getVisibleLogicalRange();
    
    if (visibleLogicalRange) {
      const barsToAdjust = direction === 'in' ? 10 : -10;
      timeScale.setVisibleLogicalRange({
        from: visibleLogicalRange.from,
        to: visibleLogicalRange.to - barsToAdjust,
      });
    }
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
    setChartHeight(prev => prev === 500 ? 700 : 500);
  }, []);

  // Refresh data
  const refreshData = useCallback(() => {
    showToast.info('Rafraîchissement des données...');
    fetchMTFData();
  }, [fetchMTFData]);

  // Auto-refresh MTF data on mount
  useEffect(() => {
    fetchMTFData();
  }, [fetchMTFData]);

  // Format helpers
  const formatPrice = (price: number) => `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  
  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'HAUSSIERE': return 'text-green-400';
      case 'BAISSIERE': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };
  
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'HAUSSIERE': return <TrendingUp className="w-4 h-4" />;
      case 'BAISSIERE': return <TrendingDown className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-900 p-4 overflow-auto' : ''}`}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-crypto-blue/20 rounded-lg">
            <LineChart className="w-6 h-6 text-crypto-blue" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Analyse Technique</h2>
            <p className="text-sm text-gray-400">{selectedSymbol} - {activeTimeframe}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Price Display */}
          <div className="text-right">
            <div className="text-2xl font-bold font-mono">{formatPrice(currentPrice)}</div>
            <FCFAConverter usdAmount={currentPrice} />
          </div>
          
          {/* Trend Badge */}
          <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${
            trend.direction === 'HAUSSIERE' ? 'bg-green-500/20 text-green-400' :
            trend.direction === 'BAISSIERE' ? 'bg-red-500/20 text-red-400' :
            'bg-yellow-500/20 text-yellow-400'
          }`}>
            {getTrendIcon(trend.direction)}
            {trend.direction} ({trend.strength}%)
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-800/50 rounded-lg">
        {/* Timeframe Selector */}
        <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg p-1">
          {(['15m', '1h', '4h', '1d'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => changeTimeframe(tf)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTimeframe === tf
                  ? 'bg-crypto-blue text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-600'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
        
        <div className="w-px h-6 bg-slate-600 mx-2" />
        
        {/* Chart Controls */}
        <button
          onClick={() => zoomChart('in')}
          className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => zoomChart('out')}
          className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={toggleFullscreen}
          className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        
        <div className="w-px h-6 bg-slate-600 mx-2" />
        
        {/* Tools */}
        <button
          onClick={() => setDrawingTool('cursor')}
          className={`p-2 rounded-lg transition-all ${
            drawingTool === 'cursor' ? 'bg-crypto-blue text-white' : 'text-gray-400 hover:text-white hover:bg-slate-700'
          }`}
          title="Cursor"
        >
          <Crosshair className="w-4 h-4" />
        </button>
        <button
          onClick={() => setDrawingTool('line')}
          className={`p-2 rounded-lg transition-all ${
            drawingTool === 'line' ? 'bg-crypto-blue text-white' : 'text-gray-400 hover:text-white hover:bg-slate-700'
          }`}
          title="Draw Line"
        >
          <Edit3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowZones(!showZones)}
          className={`p-2 rounded-lg transition-all ${
            showZones ? 'bg-crypto-blue text-white' : 'text-gray-400 hover:text-white hover:bg-slate-700'
          }`}
          title="Toggle Zones"
        >
          <Layers className="w-4 h-4" />
        </button>
        
        <div className="w-px h-6 bg-slate-600 mx-2" />
        
        {/* Indicator Toggle */}
        <button
          onClick={() => setShowIndicatorPanel(!showIndicatorPanel)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
            showIndicatorPanel ? 'bg-crypto-blue text-white' : 'text-gray-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm">Indicateurs</span>
        </button>
        
        {/* AI Analysis Toggle */}
        <button
          onClick={() => showAIAnalysis ? setShowAIAnalysis(false) : runAIAnalysis()}
          disabled={isAnalyzing}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
            showAIAnalysis ? 'bg-crypto-purple text-white' : 'text-gray-400 hover:text-white hover:bg-slate-700'
          } ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Zap className={`w-4 h-4 ${isAnalyzing ? 'animate-pulse' : ''}`} />
          <span className="text-sm">Analyse IA</span>
        </button>
        
        {/* Refresh */}
        <button
          onClick={refreshData}
          disabled={isLoadingMTF}
          className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingMTF ? 'animate-spin' : ''}`} />
        </button>
        
        {/* Auto-refresh toggle */}
        <button
          onClick={() => setIsAutoRefreshing(!isAutoRefreshing)}
          className={`p-2 rounded-lg transition-all ${
            isAutoRefreshing ? 'text-green-400' : 'text-gray-400'
          }`}
          title="Auto-refresh"
        >
          {isAutoRefreshing ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Chart Area */}
        <div className="xl:col-span-3 space-y-4">
          {/* Indicator Panel */}
          {showIndicatorPanel && (
            <div className="crypto-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4 text-crypto-blue" />
                  Configuration Indicateurs
                </h3>
                <button
                  onClick={() => setShowIndicatorPanel(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* RSI */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={indicatorConfig.rsi.enabled}
                      onChange={(e) => setIndicatorConfig(prev => ({ ...prev, rsi: { ...prev.rsi, enabled: e.target.checked } }))}
                      className="rounded border-slate-600"
                    />
                    <span className="text-sm font-medium">RSI</span>
                  </label>
                  <input
                    type="number"
                    value={indicatorConfig.rsi.period}
                    onChange={(e) => setIndicatorConfig(prev => ({ ...prev, rsi: { ...prev.rsi, period: parseInt(e.target.value) } }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                    placeholder="Période"
                  />
                </div>
                
                {/* MACD */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={indicatorConfig.macd.enabled}
                      onChange={(e) => setIndicatorConfig(prev => ({ ...prev, macd: { ...prev.macd, enabled: e.target.checked } }))}
                      className="rounded border-slate-600"
                    />
                    <span className="text-sm font-medium">MACD</span>
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      value={indicatorConfig.macd.fast}
                      onChange={(e) => setIndicatorConfig(prev => ({ ...prev, macd: { ...prev.macd, fast: parseInt(e.target.value) } }))}
                      className="w-1/3 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                      placeholder="Fast"
                    />
                    <input
                      type="number"
                      value={indicatorConfig.macd.slow}
                      onChange={(e) => setIndicatorConfig(prev => ({ ...prev, macd: { ...prev.macd, slow: parseInt(e.target.value) } }))}
                      className="w-1/3 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                      placeholder="Slow"
                    />
                    <input
                      type="number"
                      value={indicatorConfig.macd.signal}
                      onChange={(e) => setIndicatorConfig(prev => ({ ...prev, macd: { ...prev.macd, signal: parseInt(e.target.value) } }))}
                      className="w-1/3 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                      placeholder="Signal"
                    />
                  </div>
                </div>
                
                {/* Bollinger */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={indicatorConfig.bollinger.enabled}
                      onChange={(e) => setIndicatorConfig(prev => ({ ...prev, bollinger: { ...prev.bollinger, enabled: e.target.checked } }))}
                      className="rounded border-slate-600"
                    />
                    <span className="text-sm font-medium">Bollinger Bands</span>
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      value={indicatorConfig.bollinger.period}
                      onChange={(e) => setIndicatorConfig(prev => ({ ...prev, bollinger: { ...prev.bollinger, period: parseInt(e.target.value) } }))}
                      className="w-1/2 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                      placeholder="Période"
                    />
                    <input
                      type="number"
                      value={indicatorConfig.bollinger.stdDev}
                      onChange={(e) => setIndicatorConfig(prev => ({ ...prev, bollinger: { ...prev.bollinger, stdDev: parseFloat(e.target.value) } }))}
                      className="w-1/2 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                      placeholder="StdDev"
                    />
                  </div>
                </div>
                
                {/* SMA/EMA */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={indicatorConfig.sma.enabled}
                      onChange={(e) => setIndicatorConfig(prev => ({ ...prev, sma: { ...prev.sma, enabled: e.target.checked } }))}
                      className="rounded border-slate-600"
                    />
                    <span className="text-sm font-medium">SMA</span>
                  </label>
                  <input
                    type="number"
                    value={indicatorConfig.sma.period}
                    onChange={(e) => setIndicatorConfig(prev => ({ ...prev, sma: { ...prev.sma, period: parseInt(e.target.value) } }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                    placeholder="Période"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={indicatorConfig.ema.enabled}
                      onChange={(e) => setIndicatorConfig(prev => ({ ...prev, ema: { ...prev.ema, enabled: e.target.checked } }))}
                      className="rounded border-slate-600"
                    />
                    <span className="text-sm font-medium">EMA</span>
                  </label>
                  <input
                    type="number"
                    value={indicatorConfig.ema.period}
                    onChange={(e) => setIndicatorConfig(prev => ({ ...prev, ema: { ...prev.ema, period: parseInt(e.target.value) } }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                    placeholder="Période"
                  />
                </div>
                
                {/* Volume */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={indicatorConfig.volume.enabled}
                      onChange={(e) => setIndicatorConfig(prev => ({ ...prev, volume: { ...prev.volume, enabled: e.target.checked } }))}
                      className="rounded border-slate-600"
                    />
                    <span className="text-sm font-medium">Volume</span>
                  </label>
                  <span className="text-xs text-gray-500">Toujours visible</span>
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    updateIndicatorOverlays();
                    showToast.success('Indicateurs mis à jour');
                  }}
                  className="px-4 py-2 bg-crypto-blue hover:bg-crypto-blue/80 text-white rounded-lg text-sm font-medium transition-all"
                >
                  Appliquer
                </button>
              </div>
            </div>
          )}
          
          {/* Chart Container */}
          <div className="crypto-card p-0 overflow-hidden">
            <div 
              ref={chartContainerRef} 
              className="w-full"
              style={{ height: chartHeight }}
            />
          </div>
          
          {/* Quick Trade Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => executeTrade('LONG')}
              className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
            >
              <TrendingUp className="w-5 h-5" />
              BUY / LONG
            </button>
            <button
              onClick={() => executeTrade('SHORT')}
              className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
            >
              <TrendingDown className="w-5 h-5" />
              SELL / SHORT
            </button>
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-4">
          {/* AI Analysis Panel */}
          {showAIAnalysis && aiAnalysis && (
            <div className="crypto-card border-l-4 border-l-crypto-purple">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-crypto-purple" />
                  Analyse Ethernal
                </h3>
                <div className={`px-2 py-0.5 rounded text-xs font-bold ${
                  aiAnalysis.setup.isValid ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  Score: {aiAnalysis.setup.score}%
                </div>
              </div>
              
              {/* Setup */}
              <div className="space-y-3">
                <div className={`p-3 rounded-lg ${
                  aiAnalysis.setup.direction === 'LONG' ? 'bg-green-500/10 border border-green-500/30' :
                  aiAnalysis.setup.direction === 'SHORT' ? 'bg-red-500/10 border border-red-500/30' :
                  'bg-yellow-500/10 border border-yellow-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Setup Recommandé</span>
                    <span className={`font-bold ${
                      aiAnalysis.setup.direction === 'LONG' ? 'text-green-400' :
                      aiAnalysis.setup.direction === 'SHORT' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                      {aiAnalysis.setup.direction}
                    </span>
                  </div>
                  
                  {aiAnalysis.setup.isValid && (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Entry:</span>
                        <span className="font-mono">{formatPrice(aiAnalysis.setup.entryPrice || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Stop Loss:</span>
                        <span className="font-mono text-red-400">{formatPrice(aiAnalysis.setup.stopLoss || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Take Profit:</span>
                        <span className="font-mono text-green-400">{formatPrice(aiAnalysis.setup.takeProfit || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Risk/Reward:</span>
                        <span className="font-mono text-crypto-blue">1:{aiAnalysis.setup.riskReward?.toFixed(1)}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Confirmations & Warnings */}
                {aiAnalysis.setup.confirmations.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-400 mb-2">Confirmations</h4>
                    <ul className="space-y-1">
                      {aiAnalysis.setup.confirmations.slice(0, 3).map((conf, i) => (
                        <li key={i} className="text-xs text-green-400 flex items-start gap-1">
                          <span className="text-green-500">✓</span> {conf}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {aiAnalysis.setup.warnings.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-400 mb-2">Avertissements</h4>
                    <ul className="space-y-1">
                      {aiAnalysis.setup.warnings.slice(0, 3).map((warn, i) => (
                        <li key={i} className="text-xs text-yellow-400 flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 mt-0.5" /> {warn}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Action Buttons */}
                {aiAnalysis.setup.isValid && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={sendToBot}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-crypto-purple hover:bg-crypto-purple/80 text-white rounded-lg text-sm font-medium transition-all"
                    >
                      <Bot className="w-4 h-4" />
                      Envoyer au Bot
                    </button>
                    <button
                      onClick={() => createAlertFromAnalysis('signal')}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-all"
                    >
                      <Bell className="w-4 h-4" />
                      Créer Alerte
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Key Levels */}
          <div className="crypto-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-crypto-blue" />
              Zones Clés
            </h3>
            
            <div className="space-y-3">
              {/* Resistances */}
              <div>
                <h4 className="text-xs text-gray-400 mb-2">Résistances</h4>
                <div className="space-y-1">
                  {keyLevels.resistances.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-red-500/10 rounded-lg">
                      <span className="text-sm text-red-400">R{i + 1}</span>
                      <span className="font-mono text-sm">{formatPrice(r)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Current Price Marker */}
              <div className="p-3 bg-slate-700/50 rounded-lg text-center">
                <span className="text-xs text-gray-400">Prix Actuel</span>
                <div className="font-mono font-bold text-lg">{formatPrice(currentPrice)}</div>
              </div>
              
              {/* Supports */}
              <div>
                <h4 className="text-xs text-gray-400 mb-2">Supports</h4>
                <div className="space-y-1">
                  {keyLevels.supports.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-green-500/10 rounded-lg">
                      <span className="text-sm text-green-400">S{i + 1}</span>
                      <span className="font-mono text-sm">{formatPrice(s)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Alert Buttons */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => createAlertFromAnalysis('breakout')}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-all"
              >
                <Bell className="w-3 h-3 inline mr-1" />
                Breakout
              </button>
              <button
                onClick={() => createAlertFromAnalysis('zone')}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-all"
              >
                <Target className="w-3 h-3 inline mr-1" />
                Zone
              </button>
            </div>
          </div>
          
          {/* Indicators Summary */}
          {lastValues && (
            <div className="crypto-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-crypto-blue" />
                Indicateurs
              </h3>
              
              <div className="space-y-3">
                {/* RSI */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">RSI (14)</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          lastValues.rsi > 70 ? 'bg-red-500' :
                          lastValues.rsi < 30 ? 'bg-green-500' :
                          'bg-yellow-500'
                        }`}
                        style={{ width: `${lastValues.rsi}%` }}
                      />
                    </div>
                    <span className={`font-mono text-sm ${
                      lastValues.rsi > 70 ? 'text-red-400' :
                      lastValues.rsi < 30 ? 'text-green-400' :
                      'text-yellow-400'
                    }`}>
                      {lastValues.rsi.toFixed(1)}
                    </span>
                  </div>
                </div>
                
                {/* MACD */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">MACD</span>
                  <span className={`font-mono text-sm ${
                    lastValues.macd.histogram > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {lastValues.macd.histogram > 0 ? '+' : ''}{lastValues.macd.histogram.toFixed(2)}
                  </span>
                </div>
                
                {/* Bollinger Position */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Position BB</span>
                    <span className="text-xs">
                      {currentPrice > lastValues.bollinger.upper ? 'Au-dessus' :
                       currentPrice < lastValues.bollinger.lower ? 'En-dessous' :
                       'Dans les bandes'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex">
                    <div className="w-1/3 bg-green-500/50" />
                    <div className="w-1/3 bg-slate-500" />
                    <div className="w-1/3 bg-red-500/50" />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{formatPrice(lastValues.bollinger.lower)}</span>
                    <span>{formatPrice(lastValues.bollinger.middle)}</span>
                    <span>{formatPrice(lastValues.bollinger.upper)}</span>
                  </div>
                </div>
                
                {/* ATR */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">ATR (14)</span>
                  <span className="font-mono text-sm">{formatPrice(lastValues.atr)}</span>
                </div>
                
                {/* Moving Averages */}
                <div className="space-y-1 pt-2 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">SMA 20</span>
                    <span className="font-mono text-sm">{formatPrice(lastValues.sma20)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">EMA 12</span>
                    <span className="font-mono text-sm">{formatPrice(lastValues.ema12)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Multi-Timeframe Summary */}
          <div className="crypto-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-crypto-blue" />
              Multi-Timeframe
            </h3>
            
            <div className="space-y-2">
              {(['15m', '1h', '4h', '1d'] as const).map((tf) => {
                const data = mtfData[tf];
                const hasData = data && data.length >= 20;
                
                // Quick trend calculation
                let tfTrend = 'NEUTRE';
                if (hasData) {
                  const recent = data.slice(-20);
                  const first = recent[0].close;
                  const last = recent[recent.length - 1].close;
                  const change = ((last - first) / first) * 100;
                  tfTrend = change > 2 ? 'HAUSSIERE' : change < -2 ? 'BAISSIERE' : 'NEUTRE';
                }
                
                return (
                  <div key={tf} className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                    <span className="text-sm font-medium">{tf}</span>
                    <div className="flex items-center gap-2">
                      {isLoadingMTF ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                      ) : (
                        <>
                          {tfTrend === 'HAUSSIERE' && <TrendingUp className="w-4 h-4 text-green-400" />}
                          {tfTrend === 'BAISSIERE' && <TrendingDown className="w-4 h-4 text-red-400" />}
                          {tfTrend === 'NEUTRE' && <Activity className="w-4 h-4 text-yellow-400" />}
                          <span className={`text-xs ${
                            tfTrend === 'HAUSSIERE' ? 'text-green-400' :
                            tfTrend === 'BAISSIERE' ? 'text-red-400' :
                            'text-yellow-400'
                          }`}>
                            {tfTrend}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
