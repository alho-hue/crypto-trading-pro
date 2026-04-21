/**
 * Widget Portfolio - Vue d'ensemble du portfolio
 */

import { Wallet, TrendingUp, TrendingDown, Activity, PieChart } from 'lucide-react';
import { FCFAConverter } from '../FCFAConverter';
import type { PortfolioWidgetData } from '../../types/widgets';

interface PortfolioWidgetProps {
  data: PortfolioWidgetData | null;
  compact?: boolean;
}

export default function PortfolioWidget({ data, compact = false }: PortfolioWidgetProps) {
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center p-6">
          <div className="p-4 bg-slate-800/50 rounded-2xl mb-4">
            <Wallet className="w-10 h-10 mx-auto text-slate-600" />
          </div>
          <span className="text-sm font-medium">Aucune donnée</span>
          <p className="text-xs text-gray-500 mt-1">Connectez votre portfolio</p>
        </div>
      </div>
    );
  }
  
  const { totalValue, totalPnL, totalPnLPercent, winRate, activeTrades, closedTrades, dayChange, dayChangePercent, streak } = data;
  const isPnLPositive = totalPnL >= 0;
  const isDayPositive = (dayChange || 0) >= 0;
  
  if (compact) {
    return (
      <div className="flex items-center justify-between h-full px-1">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-blue-600/20 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="text-xs text-gray-500">{activeTrades} trades actifs</div>
          </div>
        </div>
        <div className={`text-right px-3 py-2 rounded-xl ${isPnLPositive ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
          <div className={`text-lg font-bold ${isPnLPositive ? 'text-green-400' : 'text-red-400'}`}>{isPnLPositive ? '+' : ''}{totalPnLPercent.toFixed(2)}%</div>
          <div className={`text-xs font-mono ${isPnLPositive ? 'text-green-500/70' : 'text-red-500/70'}`}>{isPnLPositive ? '+' : ''}${totalPnL.toFixed(0)}</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <PieChart className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-sm font-semibold text-white">Portfolio</span>
        </div>
        <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-crypto-blue animate-pulse"></span>
          Live
        </span>
      </div>
      
      {/* Total Value */}
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/50 rounded-2xl p-4 mb-4 border border-slate-700/50">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Valeur Totale</div>
        <div className="text-3xl font-bold font-mono text-white tracking-tight">
          ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div className="text-sm text-gray-500 mt-2 flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-gray-500"></span>
          <FCFAConverter usdAmount={totalValue} />
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* P&L Total */}
        <div className={`rounded-2xl p-4 border ${isPnLPositive ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            <Activity className="w-3 h-3" />
            P&L Total
          </div>
          <div className={`text-2xl font-bold ${isPnLPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPnLPositive ? '+' : ''}${totalPnL.toFixed(0)}
          </div>
          <div className={`text-xs font-medium ${isPnLPositive ? 'text-green-500/80' : 'text-red-500/80'}`}>
            {isPnLPositive ? '+' : ''}{totalPnLPercent.toFixed(2)}%
          </div>
        </div>
        
        {/* Day Change */}
        <div className={`rounded-2xl p-4 border ${isDayPositive ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            {isDayPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            Aujourd'hui
          </div>
          <div className={`text-2xl font-bold ${isDayPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isDayPositive ? '+' : ''}${(dayChange || 0).toFixed(0)}
          </div>
          <div className={`text-xs font-medium ${isDayPositive ? 'text-green-500/80' : 'text-red-500/80'}`}>
            {isDayPositive ? '+' : ''}{(dayChangePercent || 0).toFixed(2)}%
          </div>
        </div>
        
        {/* Win Rate */}
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            <PieChart className="w-3 h-3" />
            Win Rate
          </div>
          <div className="text-2xl font-bold text-blue-400">{winRate.toFixed(1)}%</div>
          <div className="text-xs text-gray-500">{closedTrades} trades fermés</div>
        </div>
        
        {/* Active Trades */}
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            <Wallet className="w-3 h-3" />
            Actifs
          </div>
          <div className="text-2xl font-bold text-purple-400">{activeTrades}</div>
          <div className="text-xs text-gray-500">trades ouverts</div>
        </div>
      </div>
      
      {/* Mini Chart */}
      <div className="bg-gradient-to-b from-slate-800/50 to-slate-900/30 rounded-2xl p-4 border border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Évolution 24h</span>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isDayPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {isDayPositive ? '+' : ''}{(dayChangePercent || 0).toFixed(2)}%
          </span>
        </div>
        <div className="h-16 flex items-end gap-1">
          {Array.from({ length: 24 }).map((_, i) => {
            // Simuler une courbe basée sur le P&L total
            const baseHeight = isPnLPositive ? 40 : 30;
            const variation = Math.sin((i / 24) * Math.PI * 2) * 20;
            const random = (Math.random() - 0.5) * 15;
            const height = Math.max(10, Math.min(90, baseHeight + variation + random));
            const isProfit = height > 40;
            return (
              <div
                key={i}
                className={`flex-1 rounded-t transition-all duration-300 ${
                  isProfit ? 'bg-green-500/50 hover:bg-green-500/70' : 'bg-red-500/50 hover:bg-red-500/70'
                }`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
