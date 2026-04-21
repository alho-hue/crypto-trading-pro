/**
 * NEUROVEST - Trade Widget
 * Widget dashboard affichant les trades ouverts et le PnL temps réel
 */

import React, { useEffect } from 'react';
import { ArrowRightLeft, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { useTradeStore } from '../../stores/tradeStore';
import { useCryptoStore } from '../../stores/cryptoStore';
import { formatXOF } from '../../utils/currency';

export default function TradeWidget() {
  const { openTrades, stats, fetchTrades, getTotalUnrealizedPnl } = useTradeStore();
  const setView = useCryptoStore(state => state.setView);
  
  const totalUnrealizedPnl = getTotalUnrealizedPnl();
  
  // Rafraîchir les trades au montage
  useEffect(() => {
    fetchTrades('open');
  }, [fetchTrades]);
  
  // Rafraîchir toutes les 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTrades('open');
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchTrades]);

  const handleViewAll = () => {
    setView('tradeManager');
  };

  return (
    <div className="bg-crypto-card rounded-xl p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-crypto-blue" />
          <h3 className="font-semibold">Trades Actifs</h3>
        </div>
        <button 
          onClick={handleViewAll}
          className="text-xs text-crypto-blue hover:underline flex items-center gap-1"
        >
          Voir tout
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* PnL Summary */}
      <div className="bg-crypto-dark/50 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">PnL Non Réalisé</span>
          <span className={`text-lg font-bold ${totalUnrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalUnrealizedPnl >= 0 ? '+' : ''}{totalUnrealizedPnl.toFixed(2)} USDT
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {openTrades.length} position{openTrades.length !== 1 ? 's' : ''} ouverte{openTrades.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Trades List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {openTrades.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Aucun trade actif</p>
            <button 
              onClick={handleViewAll}
              className="text-xs text-crypto-blue hover:underline mt-2"
            >
              Créer un trade
            </button>
          </div>
        ) : (
          openTrades.slice(0, 5).map(trade => {
            const pnl = trade.unrealizedPnl || 0;
            const isProfit = pnl >= 0;
            const isLong = trade.side === 'buy' || trade.side === 'LONG';
            
            return (
              <div 
                key={trade._id}
                className="bg-crypto-dark rounded-lg p-3 hover:bg-crypto-dark/80 transition-colors cursor-pointer"
                onClick={handleViewAll}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isLong ? (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                    <span className="font-medium text-sm">{trade.symbol.replace('USDT', '')}</span>
                    {trade.leverage > 1 && (
                      <span className="text-xs text-crypto-accent">{trade.leverage}x</span>
                    )}
                  </div>
                  <span className={`text-sm font-mono ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {isProfit ? '+' : ''}{pnl.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                  <span>Entry: {trade.averageEntryPrice?.toFixed(2) || trade.entryPrice.toFixed(2)}</span>
                  <span>Qty: {trade.filledQuantity || trade.quantity}</span>
                </div>
                
                {/* SL/TP indicators */}
                <div className="flex items-center gap-3 mt-2 text-xs">
                  {trade.stopLoss && (
                    <span className="text-red-400/80">
                      SL: {trade.stopLoss.toFixed(2)}
                    </span>
                  )}
                  {trade.takeProfit && (
                    <span className="text-green-400/80">
                      TP: {trade.takeProfit.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        
        {openTrades.length > 5 && (
          <div className="text-center text-xs text-gray-400 py-2">
            +{openTrades.length - 5} autres trades...
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="mt-4 pt-3 border-t border-crypto-border/50 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold">{stats.winRate.toFixed(0)}%</div>
            <div className="text-xs text-gray-400">Win Rate</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit.toFixed(0)}
            </div>
            <div className="text-xs text-gray-400">Total Profit</div>
          </div>
          <div>
            <div className="text-lg font-bold">{stats.totalTrades}</div>
            <div className="text-xs text-gray-400">Trades</div>
          </div>
        </div>
      )}
    </div>
  );
}
