/**
 * Widget Performance - Affiche la performance du jour
 */

import { Target, TrendingUp, TrendingDown, Zap, Award, Flame } from 'lucide-react';
import { FCFAConverter } from '../FCFAConverter';
import type { PerformanceWidgetData } from '../../types/widgets';

interface PerformanceWidgetProps {
  data: PerformanceWidgetData | null;
  compact?: boolean;
}

export default function PerformanceWidget({ data, compact = false }: PerformanceWidgetProps) {
  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6">
        <div className="p-4 bg-slate-800/50 rounded-2xl mb-4">
          <Target className="w-10 h-10 text-slate-600" />
        </div>
        <span className="text-sm font-medium">Pas encore de trades aujourd'hui</span>
        <p className="text-xs text-gray-500 mt-1">Commencez à trader pour voir vos stats</p>
      </div>
    );
  }
  
  const { todayPnL, todayWinRate, todayTrades, bestTrade, worstTrade, streak } = data;
  const isProfit = todayPnL >= 0;
  
  if (compact) {
    return (
      <div className="flex items-center gap-3 h-full px-1">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${isProfit ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
          {isProfit ? <TrendingUp className="w-6 h-6 text-green-400" /> : <TrendingDown className="w-6 h-6 text-red-400" />}
        </div>
        <div className="flex-1">
          <div className={`text-2xl font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
            {isProfit ? '+' : ''}${todayPnL.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span>{todayTrades} trades</span>
            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
            <span>{todayWinRate.toFixed(0)}% WR</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Target className="w-4 h-4 text-green-400" />
          </div>
          <span className="text-sm font-semibold text-white">Performance</span>
        </div>
        <span className="text-xs font-medium text-gray-500 px-2.5 py-1 bg-slate-800 rounded-full">{new Date().toLocaleDateString()}</span>
      </div>
      
      {/* P&L Principal */}
      <div className={`rounded-2xl p-5 mb-4 border ${isProfit ? 'bg-gradient-to-br from-green-500/15 to-green-600/5 border-green-500/30' : 'bg-gradient-to-br from-red-500/15 to-red-600/5 border-red-500/30'}`}>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">P&L Journalier</div>
        <div className={`text-4xl font-bold font-mono tracking-tight ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
          {isProfit ? '+' : ''}${todayPnL.toFixed(2)}
        </div>
        <div className="text-sm text-gray-500 mt-2 flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-gray-500"></span>
          <FCFAConverter usdAmount={todayPnL} />
        </div>
      </div>
      
      {/* Stats Grid avec meilleur layout */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`rounded-xl p-3 ${isProfit ? 'bg-green-500/10 border border-green-500/20' : 'bg-slate-800/50'}`}>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Zap className="w-3 h-3" />
            Trades Aujourd'hui
          </div>
          <div className="text-2xl font-bold text-white">{todayTrades}</div>
          <div className="text-xs text-gray-500">exécutés</div>
        </div>
        
        <div className={`rounded-xl p-3 ${todayWinRate >= 50 ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-slate-800/50'}`}>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Award className="w-3 h-3" />
            Win Rate
          </div>
          <div className={`text-2xl font-bold ${todayWinRate >= 50 ? 'text-green-400' : todayWinRate >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
            {todayWinRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">{todayWinRate >= 50 ? 'Excellent' : todayWinRate >= 30 ? 'Correct' : 'À améliorer'}</div>
        </div>
        
        <div className="bg-gradient-to-br from-green-500/15 to-green-600/5 rounded-2xl p-4 border border-green-500/30">
          <div className="flex items-center gap-2 text-xs font-medium text-green-400 uppercase tracking-wider mb-2">
            <TrendingUp className="w-3 h-3" />
            Meilleur Trade
          </div>
          <div className="text-xl font-bold text-green-400">+${bestTrade.toFixed(2)}</div>
          <div className="text-xs text-green-500/70 mt-1">max gain</div>
        </div>
        
        <div className="bg-gradient-to-br from-red-500/15 to-red-600/5 rounded-2xl p-4 border border-red-500/30">
          <div className="flex items-center gap-2 text-xs font-medium text-red-400 uppercase tracking-wider mb-2">
            <TrendingDown className="w-3 h-3" />
            Pire Trade
          </div>
          <div className="text-xl font-bold text-red-400">${worstTrade.toFixed(2)}</div>
          <div className="text-xs text-red-500/70 mt-1">max perte</div>
        </div>
      </div>
      
      {/* Streak */}
      {streak > 0 && (
        <div className="mt-auto bg-orange-500/10 rounded-xl p-3 flex items-center gap-3">
          <Flame className="w-6 h-6 text-orange-400" />
          <div>
            <div className="text-sm font-medium text-orange-400">Série en cours!</div>
            <div className="text-xs text-gray-400">{streak} trades gagnants d'affilée</div>
          </div>
        </div>
      )}
    </div>
  );
}
