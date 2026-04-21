/**
 * 💰 PriceDisplay - Version Optimisée avec React.memo
 * Exemple de composant haute performance pour l'affichage des prix
 * - React.memo pour éviter re-renders inutiles
 * - useMemo pour calculs coûteux
 * - useCallback pour fonctions stables
 */

import React, { memo, useMemo, useCallback } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useThrottle } from '../hooks/useThrottleDebounce';

interface PriceDisplayProps {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  currency?: string;
  showDetails?: boolean;
  onClick?: (symbol: string) => void;
  className?: string;
}

/**
 * 🚀 Composant PriceDisplay optimisé
 * Ne se re-render que si les props changent réellement
 */
export const PriceDisplay = memo(function PriceDisplay({
  symbol,
  price,
  priceChange,
  priceChangePercent,
  high24h,
  low24h,
  volume24h,
  currency = 'USDT',
  showDetails = false,
  onClick,
  className = ''
}: PriceDisplayProps) {
  
  // 🧮 Calculs mémorisés - ne recalculent que si les dépendances changent
  const isPositive = useMemo(() => priceChange >= 0, [priceChange]);
  
  const formattedPrice = useMemo(() => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: price > 1000 ? 2 : price > 100 ? 3 : 4
    });
  }, [price]);
  
  const formattedChange = useMemo(() => {
    return `${isPositive ? '+' : ''}${priceChange.toFixed(2)} (${priceChangePercent.toFixed(2)}%)`;
  }, [priceChange, priceChangePercent, isPositive]);
  
  const formattedVolume = useMemo(() => {
    if (volume24h >= 1e9) {
      return `${(volume24h / 1e9).toFixed(2)}B`;
    } else if (volume24h >= 1e6) {
      return `${(volume24h / 1e6).toFixed(2)}M`;
    } else if (volume24h >= 1e3) {
      return `${(volume24h / 1e3).toFixed(2)}K`;
    }
    return volume24h.toFixed(2);
  }, [volume24h]);
  
  const priceRange = useMemo(() => {
    if (high24h === 0 || low24h === 0) return 0;
    return ((price - low24h) / (high24h - low24h)) * 100;
  }, [price, high24h, low24h]);

  // 🎯 Callback stable - ne recrée pas la fonction à chaque render
  const handleClick = useCallback(() => {
    onClick?.(symbol);
  }, [onClick, symbol]);

  // 🎨 Classes conditionnelles mémorisées
  const colorClasses = useMemo(() => ({
    text: isPositive ? 'text-green-400' : 'text-red-400',
    bg: isPositive ? 'bg-green-500/10' : 'bg-red-500/10',
    border: isPositive ? 'border-green-500/20' : 'border-red-500/20',
    icon: isPositive ? TrendingUp : TrendingDown
  }), [isPositive]);

  // 🚦 Throttle le clic pour éviter les spams
  const throttledClick = useThrottle(handleClick, 300);

  return (
    <div 
      onClick={throttledClick}
      className={`
        relative p-4 rounded-xl border transition-all duration-200
        hover:scale-[1.02] cursor-pointer
        ${colorClasses.bg} ${colorClasses.border}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{symbol}</span>
          <span className="text-xs text-gray-400">/{currency}</span>
        </div>
        <colorClasses.icon className={`w-4 h-4 ${colorClasses.text}`} />
      </div>

      {/* Price */}
      <div className="mb-3">
        <span className="text-2xl font-bold text-white">
          ${formattedPrice}
        </span>
      </div>

      {/* Change */}
      <div className={`text-sm font-medium ${colorClasses.text}`}>
        {formattedChange}
      </div>

      {/* Details (conditionnel) */}
      {showDetails && (
        <div className="mt-4 pt-3 border-t border-gray-700/50 space-y-2">
          {/* Range 24h */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>24h Range</span>
              <span>{priceRange.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${Math.max(0, Math.min(100, priceRange))}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>${low24h.toLocaleString()}</span>
              <span>${high24h.toLocaleString()}</span>
            </div>
          </div>

          {/* Volume */}
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-gray-400">Vol 24h</span>
            <span className="text-sm text-gray-300">${formattedVolume}</span>
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * 📊 Liste de prix virtualisée et optimisée
 */
interface PriceListProps {
  prices: Array<{
    symbol: string;
    price: number;
    priceChange: number;
    priceChangePercent: number;
    high24h: number;
    low24h: number;
    volume24h: number;
  }>;
  onSelectSymbol: (symbol: string) => void;
}

export const PriceList = memo(function PriceList({ prices, onSelectSymbol }: PriceListProps) {
  // 🎯 Callback stable pour la sélection
  const handleSelect = useCallback((symbol: string) => {
    onSelectSymbol(symbol);
  }, [onSelectSymbol]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {prices.map((priceData) => (
        <PriceDisplay
          key={priceData.symbol}
          {...priceData}
          showDetails={false}
          onClick={handleSelect}
        />
      ))}
    </div>
  );
});

/**
 * 🏷️ Badge de prix minimaliste - ultra léger
 */
interface PriceBadgeProps {
  price: number;
  changePercent: number;
  size?: 'sm' | 'md' | 'lg';
}

export const PriceBadge = memo(function PriceBadge({ 
  price, 
  changePercent, 
  size = 'md' 
}: PriceBadgeProps) {
  const isPositive = changePercent >= 0;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  return (
    <span className={`
      inline-flex items-center gap-1 rounded-lg font-medium
      ${sizeClasses[size]}
      ${isPositive 
        ? 'bg-green-500/15 text-green-400 border border-green-500/20' 
        : 'bg-red-500/15 text-red-400 border border-red-500/20'
      }
    `}>
      {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
    </span>
  );
});

/**
 * 📈 Sparkline optimisé - ne re-render que si data change
 */
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  isPositive?: boolean;
}

export const Sparkline = memo(function Sparkline({
  data,
  width = 120,
  height = 40,
  color,
  isPositive = true
}: SparklineProps) {
  // 🧮 Calculer le path SVG une seule fois
  const pathD = useMemo(() => {
    if (data.length < 2) return '';
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  }, [data, width, height]);

  const strokeColor = color || (isPositive ? '#22c55e' : '#ef4444');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-60"
      />
    </svg>
  );
});

// Export par défaut
export default PriceDisplay;
