/**
 * Widget Vue d'ensemble du Marché
 */

import { Globe, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import type { MarketOverviewItem } from '../../types/widgets';

interface MarketOverviewWidgetProps {
  data: MarketOverviewItem[];
  compact?: boolean;
}

export default function MarketOverviewWidget({ data, compact = false }: MarketOverviewWidgetProps) {
  if (data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6">
        <div className="p-4 bg-slate-800/50 rounded-2xl mb-4">
          <Globe className="w-10 h-10 text-slate-600 animate-pulse" />
        </div>
        <span className="text-sm font-medium">Chargement du marché...</span>
        <p className="text-xs text-gray-500 mt-1">Récupération des données temps réel</p>
      </div>
    );
  }
  
  // Calculer les tendances globales
  const upCount = data.filter(d => d.trend === 'up').length;
  const downCount = data.filter(d => d.trend === 'down').length;
  const marketSentiment = upCount > downCount ? 'bullish' : downCount > upCount ? 'bearish' : 'neutral';
  
  if (compact) {
    return (
      <div className="flex items-center gap-3 h-full px-1">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${
          marketSentiment === 'bullish' ? 'bg-green-500/20 border-green-500/30' : 
          marketSentiment === 'bearish' ? 'bg-red-500/20 border-red-500/30' : 'bg-gray-500/20 border-gray-500/30'
        }`}>
          <Globe className={`w-6 h-6 ${
            marketSentiment === 'bullish' ? 'text-green-400' : 
            marketSentiment === 'bearish' ? 'text-red-400' : 'text-gray-400'
          }`} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">Marché {marketSentiment === 'bullish' ? 'Haussier' : marketSentiment === 'bearish' ? 'Baissier' : 'Neutre'}</div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span className="text-green-400">{upCount}↑</span>
            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
            <span className="text-red-400">{downCount}↓</span>
            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
            <span>{data.length}</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header avec sentiment */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Globe className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-sm font-semibold text-white">Marché</span>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
          marketSentiment === 'bullish' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
          marketSentiment === 'bearish' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
          'bg-gray-500/20 text-gray-400 border-gray-500/30'
        }`}>
          {marketSentiment === 'bullish' ? <TrendingUp className="w-4 h-4" /> :
           marketSentiment === 'bearish' ? <TrendingDown className="w-4 h-4" /> :
           <Minus className="w-4 h-4" />}
          <span className="text-xs font-semibold">
            {marketSentiment === 'bullish' ? 'Haussier' : marketSentiment === 'bearish' ? 'Baissier' : 'Neutre'}
          </span>
        </div>
      </div>
      
      {/* Liste des cryptos avec vrai volume */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {data.map((item) => {
          const isUp = item.change24h >= 0;
          const symbol = item.symbol.replace('USDT', '');
          const volumeFormatted = item.volume24h > 1000000000 
            ? `${(item.volume24h / 1000000000).toFixed(2)}B` 
            : `${(item.volume24h / 1000000).toFixed(1)}M`;
          
          return (
            <div key={item.symbol} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-2xl hover:bg-slate-800/60 transition-all duration-200 cursor-pointer group border border-transparent hover:border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg ${
                  isUp ? 'bg-green-500/20 text-green-400 shadow-green-500/10' : 'bg-red-500/20 text-red-400 shadow-red-500/10'
                }`}>
                  {symbol.slice(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{symbol}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <Activity className="w-3 h-3" />
                    Vol ${volumeFormatted}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-base font-mono font-bold text-white tracking-tight">
                  ${item.price >= 1000 
                    ? item.price.toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : item.price.toFixed(2)
                  }
                </div>
                <div className={`text-xs flex items-center justify-end gap-1 font-semibold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                  {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isUp ? '+' : ''}{item.change24h.toFixed(2)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Footer avec stats et vrai volume total */}
      <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-green-400 flex items-center gap-1.5 font-medium">
            <TrendingUp className="w-4 h-4" /> {upCount} en hausse
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-red-400 flex items-center gap-1.5 font-medium">
            <TrendingDown className="w-4 h-4" /> {downCount} en baisse
          </span>
        </div>
        <div className="text-xs text-gray-500 text-center px-3 py-2 bg-slate-800/50 rounded-xl">
          Volume 24h total: <span className="font-mono font-medium text-gray-400">${(data.reduce((sum, d) => sum + d.volume24h, 0) / 1000000000).toFixed(2)}B</span>
        </div>
      </div>
    </div>
  );
}
