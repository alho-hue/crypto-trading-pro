import { useEffect, useRef, useCallback, useState } from 'react';
import { 
  createChart, 
  IChartApi, 
  ISeriesApi,
  SeriesType
} from 'lightweight-charts';
import { useCryptoStore } from '../stores/cryptoStore';
import { calculateSMA, calculateEMA, calculateBollingerBands, calculateRSI, calculateMACD } from '../utils/indicators';
import { ZoomIn, ZoomOut, Maximize2, CandlestickChart, LineChart, BarChart3, Activity } from 'lucide-react';
import type { Timeframe } from '../types';

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
];

type ChartType = 'candlestick' | 'line' | 'area' | 'bar';

const CHART_TYPES: { label: string; value: ChartType; icon: React.ElementType }[] = [
  { label: 'Bougies', value: 'candlestick', icon: CandlestickChart },
  { label: 'Ligne', value: 'line', icon: LineChart },
  { label: 'Zone', value: 'area', icon: Activity },
  { label: 'Barres', value: 'bar', icon: BarChart3 },
];

export default function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const barSeriesRef = useRef<ISeriesApi<'Bar'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistogramRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const candleData = useCryptoStore((state) => state.candleData);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  const timeframe = useCryptoStore((state) => state.timeframe);
  const setTimeframe = useCryptoStore((state) => state.setTimeframe);
  const indicators = useCryptoStore((state) => state.indicators);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  // Initialize chart with aggressive retry logic
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    let retryCount = 0;
    const maxRetries = 50; // Increased retries
    let cleanupFn: (() => void) | undefined;

    const initChart = () => {
      // Clean up existing chart if any
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      // Check dimensions
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initChart, 100);
          return;
        }
        return;
      }

      try {
        const chart = createChart(container, {
          layout: {
            background: { color: '#0a0e1a' },
            textColor: '#d1d5db',
          },
          grid: {
            vertLines: { color: '#1f2937' },
            horzLines: { color: '#1f2937' },
          },
          crosshair: {
            mode: 1,
            vertLine: {
              color: '#3b82f6',
              labelBackgroundColor: '#3b82f6',
            },
            horzLine: {
              color: '#3b82f6',
              labelBackgroundColor: '#3b82f6',
            },
          },
          rightPriceScale: {
            borderColor: '#1f2937',
            visible: true,
          },
          leftPriceScale: {
            borderColor: '#1f2937',
            visible: false, // Hidden by default, shown when RSI/MACD enabled
          },
          timeScale: {
            borderColor: '#1f2937',
            timeVisible: true,
            barSpacing: 12,
            minBarSpacing: 4,
            rightOffset: 12,
          },
          handleScroll: {
            vertTouchDrag: false,
          },
          width: container.clientWidth,
          height: container.clientHeight,
        });

        chartRef.current = chart;

        // Create all series types (only one will be visible at a time)
        // Candlestick series
        const candleSeries = chart.addCandlestickSeries({
          upColor: '#10b981',
          downColor: '#ef4444',
          borderUpColor: '#10b981',
          borderDownColor: '#ef4444',
          wickUpColor: '#10b981',
          wickDownColor: '#ef4444',
          borderVisible: true,
          wickVisible: true,
          visible: chartType === 'candlestick',
        });
        candleSeriesRef.current = candleSeries;

        // Line series
        const lineSeries = chart.addLineSeries({
          color: '#3b82f6',
          lineWidth: 2,
          visible: chartType === 'line',
        });
        lineSeriesRef.current = lineSeries;

        // Area series
        const areaSeries = chart.addAreaSeries({
          topColor: '#3b82f6',
          bottomColor: 'rgba(59, 130, 246, 0.1)',
          lineColor: '#3b82f6',
          lineWidth: 2,
          visible: chartType === 'area',
        });
        areaSeriesRef.current = areaSeries;

        // Bar series
        const barSeries = chart.addBarSeries({
          upColor: '#10b981',
          downColor: '#ef4444',
          visible: chartType === 'bar',
        });
        barSeriesRef.current = barSeries;

        // Volume series - v4 API
        const volumeSeries = chart.addHistogramSeries({
          color: '#3b82f6',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '',
        });
        volumeSeriesRef.current = volumeSeries;
        volumeSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });

        // Indicator series - v4 API uses addLineSeries
        const smaSeries = chart.addLineSeries({
          color: '#f59e0b',
          lineWidth: 2,
          title: 'SMA 20',
          lastValueVisible: false,
        });
        smaSeriesRef.current = smaSeries;

        const emaSeries = chart.addLineSeries({
          color: '#8b5cf6',
          lineWidth: 2,
          title: 'EMA 12',
          lastValueVisible: false,
        });
        emaSeriesRef.current = emaSeries;

        const bbUpper = chart.addLineSeries({
          color: '#ec4899',
          lineWidth: 1,
          lineStyle: 2,
          title: 'BB Upper',
          lastValueVisible: false,
        });
        bbUpperRef.current = bbUpper;

        const bbLower = chart.addLineSeries({
          color: '#ec4899',
          lineWidth: 1,
          lineStyle: 2,
          title: 'BB Lower',
          lastValueVisible: false,
        });
        bbLowerRef.current = bbLower;

        // RSI series - overlay on main price scale
        const rsiSeries = chart.addLineSeries({
          color: '#06b6d4',
          lineWidth: 2,
          title: 'RSI',
          lastValueVisible: false,
          priceScaleId: 'left', // Use left scale to separate from price
        });
        rsiSeries.applyOptions({ visible: false });
        rsiSeriesRef.current = rsiSeries;

        // MACD series - overlay on main price scale
        const macdSeries = chart.addLineSeries({
          color: '#3b82f6',
          lineWidth: 2,
          title: 'MACD',
          lastValueVisible: false,
          priceScaleId: 'left',
        });
        macdSeries.applyOptions({ visible: false });
        macdSeriesRef.current = macdSeries;

        const macdSignal = chart.addLineSeries({
          color: '#f59e0b',
          lineWidth: 2,
          title: 'Signal',
          lastValueVisible: false,
          priceScaleId: 'left',
        });
        macdSignal.applyOptions({ visible: false });
        macdSignalRef.current = macdSignal;

        const macdHistogram = chart.addHistogramSeries({
          title: 'Histogram',
          lastValueVisible: false,
          priceScaleId: 'left',
        });
        macdHistogram.applyOptions({ visible: false });
        macdHistogramRef.current = macdHistogram;

        // Handle resize
        const handleResize = () => {
          if (chartContainerRef.current) {
            chart.applyOptions({
              width: chartContainerRef.current.clientWidth,
              height: chartContainerRef.current.clientHeight,
            });
          }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
          window.removeEventListener('resize', handleResize);
          chart.remove();
        };
      } catch (error) {
        // Silent fail - chart will retry
      }
    };

    // Start initialization immediately
    initChart();
    
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [selectedSymbol, timeframe, chartType]); // Re-init when symbol, timeframe or chart type changes

  // Update data when candleData changes
  useEffect(() => {
    if (candleData.length === 0) return;

    const candleChartData = candleData.map((c) => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const lineData = candleData.map((c) => ({
      time: c.time as any,
      value: c.close,
    }));

    const barData = candleData.map((c) => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    // Update candlestick series
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData(candleChartData);
    }

    // Update line series
    if (lineSeriesRef.current) {
      lineSeriesRef.current.setData(lineData);
    }

    // Update area series
    if (areaSeriesRef.current) {
      areaSeriesRef.current.setData(lineData);
    }

    // Update bar series
    if (barSeriesRef.current) {
      barSeriesRef.current.setData(barData);
    }

    // Update volume
    if (volumeSeriesRef.current) {
      const volumeData = candleData.map((c) => ({
        time: c.time as any,
        value: c.volume,
        color: c.close >= c.open ? '#10b981' : '#ef4444',
      }));
      volumeSeriesRef.current.setData(volumeData);
    }

    // Update indicators
    updateIndicators();

    // Fit content
    chartRef.current?.timeScale().fitContent();
  }, [candleData]);

  // Update indicators visibility
  const updateIndicators = useCallback(() => {
    if (candleData.length === 0) return;

    // SMA
    const smaIndicator = indicators.find((i) => i.type === 'sma');
    if (smaSeriesRef.current && smaIndicator) {
      if (smaIndicator.enabled) {
        const smaValues = calculateSMA(candleData, smaIndicator.params.period || 20);
        const smaData = candleData
          .map((c, i) => ({
            time: c.time as any,
            value: smaValues[i],
          }))
          .filter((d) => d.value !== null) as any;
        smaSeriesRef.current.setData(smaData);
        smaSeriesRef.current.applyOptions({ visible: true });
      } else {
        smaSeriesRef.current.applyOptions({ visible: false });
      }
    }

    // EMA
    const emaIndicator = indicators.find((i) => i.type === 'ema');
    if (emaSeriesRef.current && emaIndicator) {
      if (emaIndicator.enabled) {
        const emaValues = calculateEMA(candleData, emaIndicator.params.period || 12);
        const emaData = candleData
          .map((c, i) => ({
            time: c.time as any,
            value: emaValues[i],
          }))
          .filter((d) => d.value !== null) as any;
        emaSeriesRef.current.setData(emaData);
        emaSeriesRef.current.applyOptions({ visible: true });
      } else {
        emaSeriesRef.current.applyOptions({ visible: false });
      }
    }

    // Bollinger Bands
    const bbIndicator = indicators.find((i) => i.type === 'bollinger');
    if (bbUpperRef.current && bbLowerRef.current && bbIndicator) {
      if (bbIndicator.enabled) {
        const bb = calculateBollingerBands(
          candleData,
          bbIndicator.params.period || 20,
          bbIndicator.params.stdDev || 2
        );
        const upperData = candleData
          .map((c, i) => ({
            time: c.time as any,
            value: bb.upper[i],
          }))
          .filter((d) => d.value !== null) as any;
        const lowerData = candleData
          .map((c, i) => ({
            time: c.time as any,
            value: bb.lower[i],
          }))
          .filter((d) => d.value !== null) as any;
        bbUpperRef.current.setData(upperData);
        bbLowerRef.current.setData(lowerData);
        bbUpperRef.current.applyOptions({ visible: true });
        bbLowerRef.current.applyOptions({ visible: true });
      } else {
        bbUpperRef.current.applyOptions({ visible: false });
        bbLowerRef.current.applyOptions({ visible: false });
      }
    }

    // Check if RSI or MACD is enabled to show left scale
    const rsiEnabled = indicators.find((i) => i.type === 'rsi')?.enabled;
    const macdEnabled = indicators.find((i) => i.type === 'macd')?.enabled;
    if (chartRef.current) {
      chartRef.current.applyOptions({
        leftPriceScale: {
          visible: !!(rsiEnabled || macdEnabled),
        },
      });
    }

    // RSI - shows on left scale
    const rsiIndicator = indicators.find((i) => i.type === 'rsi');
    if (rsiSeriesRef.current && rsiIndicator) {
      if (rsiIndicator.enabled) {
        const rsiValues = calculateRSI(candleData, rsiIndicator.params.period || 14);
        const rsiData = candleData
          .map((c, i) => ({
            time: c.time as any,
            value: rsiValues[i],
          }))
          .filter((d) => d.value !== null) as any;
        rsiSeriesRef.current.setData(rsiData);
        rsiSeriesRef.current.applyOptions({ visible: true });
      } else {
        rsiSeriesRef.current.applyOptions({ visible: false });
      }
    }

    // MACD - shows on left scale
    const macdIndicator = indicators.find((i) => i.type === 'macd');
    if (macdSeriesRef.current && macdSignalRef.current && macdHistogramRef.current && macdIndicator) {
      if (macdIndicator.enabled) {
        const macd = calculateMACD(candleData);
        const macdData = candleData
          .map((c, i) => ({
            time: c.time as any,
            value: macd.macd[i],
          }))
          .filter((d) => d.value !== null) as any;
        const signalData = candleData
          .map((c, i) => ({
            time: c.time as any,
            value: macd.signal[i],
          }))
          .filter((d) => d.value !== null) as any;
        const histogramData = candleData
          .map((c, i) => ({
            time: c.time as any,
            value: macd.histogram[i],
            color: (macd.histogram[i] || 0) >= 0 ? '#10b981' : '#ef4444',
          }))
          .filter((d) => d.value !== null) as any;
        macdSeriesRef.current.setData(macdData);
        macdSignalRef.current.setData(signalData);
        macdHistogramRef.current.setData(histogramData);
        macdSeriesRef.current.applyOptions({ visible: true });
        macdSignalRef.current.applyOptions({ visible: true });
        macdHistogramRef.current.applyOptions({ visible: true });
      } else {
        macdSeriesRef.current.applyOptions({ visible: false });
        macdSignalRef.current.applyOptions({ visible: false });
        macdHistogramRef.current.applyOptions({ visible: false });
      }
    }
  }, [candleData, indicators]);

  // Update indicators when they change
  useEffect(() => {
    updateIndicators();
  }, [indicators, updateIndicators]);

  // Listen for fullscreen change (e.g. when user presses Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      // Resize chart after fullscreen change
      setTimeout(() => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          });
          chartRef.current.timeScale().fitContent();
        }
      }, 100);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Update chart type visibility
  const changeChartType = (newType: ChartType) => {
    setChartType(newType);
    if (candleSeriesRef.current) {
      candleSeriesRef.current.applyOptions({ visible: newType === 'candlestick' });
    }
    if (lineSeriesRef.current) {
      lineSeriesRef.current.applyOptions({ visible: newType === 'line' });
    }
    if (areaSeriesRef.current) {
      areaSeriesRef.current.applyOptions({ visible: newType === 'area' });
    }
    if (barSeriesRef.current) {
      barSeriesRef.current.applyOptions({ visible: newType === 'bar' });
    }
  };

  const toggleIndicator = useCryptoStore((state) => state.toggleIndicator);

  // Zoom functions
  const handleZoomIn = () => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const logicalRange = timeScale.getVisibleLogicalRange();
      if (logicalRange) {
        const newRange = {
          from: logicalRange.from + (logicalRange.to - logicalRange.from) * 0.2,
          to: logicalRange.to - (logicalRange.to - logicalRange.from) * 0.2,
        };
        timeScale.setVisibleLogicalRange(newRange);
      }
    }
  };

  const handleZoomOut = () => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const logicalRange = timeScale.getVisibleLogicalRange();
      if (logicalRange) {
        const range = logicalRange.to - logicalRange.from;
        const newRange = {
          from: logicalRange.from - range * 0.25,
          to: logicalRange.to + range * 0.25,
        };
        timeScale.setVisibleLogicalRange(newRange);
      }
    }
  };

  const handleFitContent = () => {
    chartRef.current?.timeScale().fitContent();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      chartWrapperRef.current?.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(console.error);
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(console.error);
    }
  };

  return (
    <div ref={chartWrapperRef} className={`crypto-card h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 p-4 bg-crypto-dark' : ''}`}>
      {/* Header - responsive layout */}
      <div className="flex flex-col gap-2 sm:gap-3 mb-2 sm:mb-4 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <h2 className="text-sm sm:text-lg font-semibold whitespace-nowrap">{selectedSymbol}</h2>
          
          {/* Timeframe selector */}
          <div className="flex gap-0.5 sm:gap-1 flex-wrap">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded font-medium transition-colors ${
                  timeframe === tf.value
                    ? 'bg-crypto-blue text-white'
                    : 'bg-crypto-dark text-gray-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Chart type selector */}
          <div className="flex gap-0.5 sm:gap-1 flex-wrap border-l border-gray-700 pl-1.5 sm:pl-2">
            {CHART_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  onClick={() => changeChartType(type.value)}
                  className={`p-1 sm:p-1.5 rounded font-medium transition-colors ${
                    chartType === type.value
                      ? 'bg-crypto-blue text-white'
                      : 'bg-crypto-dark text-gray-400 hover:text-white'
                  }`}
                  title={type.label}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Zoom controls */}
          <div className="flex gap-1">
            <button
              onClick={handleZoomIn}
              className="p-1 sm:p-1.5 bg-crypto-dark hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors"
              title="Zoomer"
            >
              <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 sm:p-1.5 bg-crypto-dark hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors"
              title="Dézoomer"
            >
              <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1 sm:p-1.5 bg-crypto-dark hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors"
              title={isFullscreen ? "Quitter plein écran" : "Plein écran"}
            >
              <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Indicators toggle - show all except volume */}
          <div className="flex gap-1 flex-wrap">
            {indicators.filter(i => i.type !== 'volume').map((indicator) => (
              <button
                key={indicator.type}
                onClick={() => toggleIndicator(indicator.type)}
                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded font-medium transition-colors ${
                  indicator.enabled
                    ? 'bg-crypto-green text-white'
                    : 'bg-crypto-dark text-gray-400 hover:text-white'
                }`}
              >
                {indicator.type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div 
        ref={chartContainerRef} 
        className="flex-1 w-full min-h-0 bg-gray-800/30 rounded-lg relative border border-gray-700/50 overflow-hidden"
      >
        {candleData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-crypto-blue border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm">Chargement des données...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
