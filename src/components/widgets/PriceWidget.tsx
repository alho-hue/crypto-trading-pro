/**
 * Widget Prix - Affiche le prix live d'une crypto
 */

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { FCFAConverter } from '../FCFAConverter';
import type { WidgetConfig, WidgetData } from '../../types/widgets';

interface PriceWidgetProps {
  config: WidgetConfig;
  data: WidgetData | null;
  compact?: boolean;
}

export default function PriceWidget({ config, data, compact = false }: PriceWidgetProps) {
  const { symbol, showChart } = config;
  
  const price = data?.price || 0;
  const change24h = data?.change24h || 0;
  const isUp = change24h >= 0;
  
  // Estimations pour le range 24h si données non disponibles
  const lowEstimate = price * (1 - Math.abs(change24h) / 100 * 0.5);
  const highEstimate = price * (1 + Math.abs(change24h) / 100 * 0.5);
  
  // Formater le prix selon sa valeur
  const formattedPrice = useMemo(() => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
    } else if (price >= 1) {
      return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    } else {
      return price.toLocaleString('en-US', { maximumFractionDigits: 6 });
    }
  }, [price]);
  
  if (compact) {
    return (
      <div className="flex items-center justify-between h-full px-1">
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{symbol}</div>
          <div className="text-xl font-bold font-mono text-white tracking-tight">${formattedPrice}</div>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-semibold ${isUp ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
          {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {isUp ? '+' : ''}{change24h.toFixed(2)}%
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{symbol}</span>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isUp ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
          24h
        </span>
      </div>
      
      {/* Price */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-4xl font-bold font-mono tracking-tight text-white">
          ${formattedPrice}
        </div>
        <div className="text-sm text-gray-500 mt-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-crypto-blue animate-pulse"></span>
          <FCFAConverter usdAmount={price} />
        </div>
      </div>
      
      {/* Change */}
      <div className="flex items-center gap-3 mt-4">
        <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold ${isUp ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
          {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{isUp ? '+' : ''}{change24h.toFixed(2)}%</span>
        </div>
        <span className="text-xs text-gray-500 font-mono">
          ${data?.change24hValue?.toFixed(2) || '0.00'}
        </span>
      </div>
      
      {/* Indicateur de tendance 24h - PAS DE SIMULATION */}
      {showChart && data?.change24h !== undefined && (
        <div className="mt-4 h-14 flex items-center justify-center">
          <div className={`text-2xl font-bold ${data.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span className="font-medium">Range 24h</span>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3" />
            {data?.volume24h && (
              <span className="text-gray-400">Vol: ${(data.volume24h / 1000000).toFixed(1)}M</span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-red-400 font-medium font-mono">${data?.low24h?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || lowEstimate.toFixed(2)}</span>
          <div className="flex-1 mx-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
              style={{ width: '100%' }}
            />
          </div>
          <span className="text-green-400 font-medium font-mono">${data?.high24h?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || highEstimate.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
