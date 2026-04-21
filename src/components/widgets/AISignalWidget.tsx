/**
 * Widget IA Signal - Affiche les signaux de trading de l'IA
 */

import { Brain, TrendingUp, TrendingDown, Minus, Target, Shield, Clock } from 'lucide-react';
import type { AISignal } from '../../types/widgets';

interface AISignalWidgetProps {
  signal: AISignal | null;
  compact?: boolean;
}

export default function AISignalWidget({ signal, compact = false }: AISignalWidgetProps) {
  if (!signal) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center p-6">
          <div className="p-4 bg-purple-500/10 rounded-2xl mb-4 border border-purple-500/20">
            <Brain className="w-10 h-10 mx-auto text-purple-400 animate-pulse" />
          </div>
          <span className="text-sm font-medium">Analyse en cours...</span>
          <p className="text-xs text-gray-500 mt-1">Ethernal AI analyse le marché</p>
        </div>
      </div>
    );
  }
  
  const { signal: signalType, confidence, symbol, reason, entryPrice, stopLoss, takeProfit, indicators } = signal;
  
  const signalColors = {
    BUY: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: TrendingUp },
    SELL: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: TrendingDown },
    WAIT: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: Minus },
    HOLD: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: Target },
  };
  
  const colors = signalColors[signalType];
  const Icon = colors.icon;
  
  if (compact) {
    return (
      <div className="flex items-center gap-3 h-full px-1">
        <div className={`w-14 h-14 rounded-2xl ${colors.bg} ${colors.text} flex items-center justify-center border-2 ${colors.border}`}>
          <Icon className="w-7 h-7" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{signalType}</span>
            <span className="text-xs text-gray-500">{symbol}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden max-w-[60px]">
              <div className={`h-full ${signalType === 'BUY' ? 'bg-green-500' : signalType === 'SELL' ? 'bg-red-500' : 'bg-yellow-500'}`} style={{ width: `${confidence}%` }} />
            </div>
            <span className="text-xs text-gray-400">{confidence}%</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Brain className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-sm font-semibold text-white">Ethernal AI</span>
        </div>
        <span className="text-xs font-medium text-gray-500 px-2.5 py-1 bg-slate-800 rounded-full">{symbol}</span>
      </div>
      
      {/* Signal Principal */}
      <div className={`${colors.bg} rounded-xl border ${colors.border} p-4`}>
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl bg-slate-900/60 ${colors.text} flex items-center justify-center shadow-xl border border-slate-700/50`}>
            <Icon className="w-9 h-9" />
          </div>
          <div className="flex-1">
            <div className={`text-3xl font-bold ${colors.text} tracking-tight`}>{signalType}</div>
            <div className="text-sm text-gray-400 mt-2 flex items-center gap-2">
              <span>Confiance</span>
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden max-w-[80px]">
                <div 
                  className={`h-full ${signalType === 'BUY' ? 'bg-green-500' : signalType === 'SELL' ? 'bg-red-500' : 'bg-yellow-500'}`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="font-mono font-semibold text-white">{confidence}%</span>
            </div>
          </div>
        </div>
        
        {/* Raison */}
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium px-2.5 py-1 bg-slate-800/80 rounded-full text-gray-400 border border-slate-700">{signal.timeframe}</span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(signal.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          </div>
          <div className="text-sm text-gray-300 leading-relaxed bg-slate-900/40 rounded-lg p-3 border border-slate-700/50">
            {reason}
          </div>
        </div>
        
        {/* Levels */}
        {(entryPrice || stopLoss || takeProfit) && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {entryPrice && (
              <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-blue-500/20">
                <div className="text-xs font-medium text-blue-400 mb-1.5">Entry</div>
                <div className="text-base font-mono font-semibold text-white">${entryPrice}</div>
              </div>
            )}
            {stopLoss && (
              <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-red-500/20">
                <div className="text-xs font-medium text-red-400 mb-1.5">SL</div>
                <div className="text-base font-mono font-semibold text-white">${stopLoss}</div>
              </div>
            )}
            {takeProfit && (
              <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-green-500/20">
                <div className="text-xs font-medium text-green-400 mb-1.5">TP</div>
                <div className="text-base font-mono font-semibold text-white">${takeProfit}</div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Indicateurs */}
      {indicators && (
        <div className="mt-4 flex flex-wrap gap-2">
          {indicators.rsi && (
            <span className={`text-xs px-3 py-1.5 rounded-xl font-medium border ${
              indicators.rsi > 70 ? 'bg-red-500/15 text-red-400 border-red-500/30' : 
              indicators.rsi < 30 ? 'bg-green-500/15 text-green-400 border-green-500/30' : 
              'bg-slate-800/80 text-gray-400 border-slate-700'
            }`}>
              RSI {indicators.rsi}
            </span>
          )}
          {indicators.trend && (
            <span className={`text-xs px-3 py-1.5 rounded-xl font-medium border ${
              indicators.trend === 'BULLISH' ? 'bg-green-500/15 text-green-400 border-green-500/30' :
              indicators.trend === 'BEARISH' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
              'bg-slate-800/80 text-gray-400 border-slate-700'
            }`}>
              {indicators.trend === 'BULLISH' ? '↗' : indicators.trend === 'BEARISH' ? '↘' : '→'} {indicators.trend}
            </span>
          )}
          {indicators.volume && (
            <span className={`text-xs px-3 py-1.5 rounded-xl font-medium border ${
              indicators.volume === 'HIGH' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
              indicators.volume === 'ABOVE_AVG' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
              'bg-slate-800/80 text-gray-400 border-slate-700'
            }`}>
              Vol {indicators.volume}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
