/**
 * Widget Trades Actifs
 */

import { Zap, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Trade } from '../../services/tradeService';

interface TradesWidgetProps {
  trades: Trade[];
  prices: Map<string, { price: number; change24h: number }>;
  compact?: boolean;
}

export default function TradesWidget({ trades, prices, compact = false }: TradesWidgetProps) {
  const activeTrades = trades.filter(t => t.status === 'open');
  
  if (activeTrades.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6">
        <div className="p-4 bg-slate-800/50 rounded-2xl mb-4">
          <Zap className="w-10 h-10 text-slate-600" />
        </div>
        <span className="text-sm font-medium">Aucun trade actif</span>
        <span className="text-xs text-gray-500 mt-1">Prêt à trader!</span>
      </div>
    );
  }
  
  // Calculer P&L non réalisé pour chaque trade
  const tradesWithPnL = activeTrades.map(trade => {
    const currentPrice = prices.get(trade.symbol)?.price || trade.entryPrice;
    const pnl = trade.side === 'buy' || trade.side === 'LONG'
      ? (currentPrice - trade.entryPrice) * trade.quantity
      : (trade.entryPrice - currentPrice) * trade.quantity;
    const pnlPercent = (pnl / (trade.entryPrice * trade.quantity)) * 100;
    
    return { ...trade, currentPnL: pnl, currentPnLPercent: pnlPercent };
  });
  
  const totalUnrealizedPnL = tradesWithPnL.reduce((sum, t) => sum + (t.currentPnL || 0), 0);
  const isOverallProfit = totalUnrealizedPnL >= 0;
  
  if (compact) {
    const latest = tradesWithPnL[0];
    const isProfit = (latest.currentPnL || 0) >= 0;
    
    return (
      <div className="flex items-center gap-3 h-full px-1">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${isOverallProfit ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
          <Zap className={`w-6 h-6 ${isOverallProfit ? 'text-green-400' : 'text-red-400'}`} />
        </div>
        <div className="flex-1">
          <div className={`text-2xl font-bold ${isOverallProfit ? 'text-green-400' : 'text-red-400'}`}>
            {isOverallProfit ? '+' : ''}${totalUnrealizedPnL.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500">{activeTrades.length} trades actifs</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header avec P&L total */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <span className="text-sm font-semibold text-white">Trades Actifs</span>
        </div>
        <div className={`text-right px-3 py-1.5 rounded-xl ${isOverallProfit ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
          <div className={`text-lg font-bold ${isOverallProfit ? 'text-green-400' : 'text-red-400'}`}>{isOverallProfit ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}</div>
          <div className="text-xs text-gray-500">{activeTrades.length} ouverts</div>
        </div>
      </div>
      
      {/* Liste des trades avec meilleur layout */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {tradesWithPnL.slice(0, 5).map((trade) => {
          const isLong = trade.side === 'buy' || trade.side === 'LONG';
          const isProfit = (trade.currentPnL || 0) >= 0;
          const symbol = trade.symbol.replace('USDT', '');
          const pnlPercent = (trade.currentPnLPercent || 0).toFixed(2);
          
          return (
            <div key={trade._id} className="p-4 bg-slate-800/30 rounded-2xl hover:bg-slate-800/60 transition-all duration-200 cursor-pointer group border border-transparent hover:border-slate-700/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-110 ${
                    isLong ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {isLong ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <span className="font-bold text-white text-base">{symbol}</span>
                    <span className={`ml-2 text-xs px-2.5 py-1 rounded-full font-semibold ${isLong ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                      {isLong ? 'LONG' : 'SHORT'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {isProfit ? '+' : ''}${(trade.currentPnL || 0).toFixed(2)}
                  </div>
                  <div className={`text-xs font-medium ${isProfit ? 'text-green-500/80' : 'text-red-500/80'}`}>
                    {isProfit ? '+' : ''}{pnlPercent}%
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-slate-700/30">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(trade.entryTime).toLocaleTimeString()}
                </div>
                <div className="font-mono flex items-center gap-2">
                  <span>Entry: <span className="text-gray-400 font-medium">${trade.entryPrice.toFixed(2)}</span></span>
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                  <span>Qty: <span className="text-gray-400 font-medium">{trade.quantity.toFixed(4)}</span></span>
                </div>
              </div>
            </div>
          );
        })}      
        
        {activeTrades.length > 5 && (
          <div className="text-center text-xs text-gray-500 py-3 px-4 bg-slate-800/30 rounded-xl">
            +{activeTrades.length - 5} trades supplémentaires
          </div>
        )}
      </div>
    </div>
  );
}
