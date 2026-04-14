import { useEffect, useState } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { useBinanceWebSocket } from '../hooks/useBinanceWebSocket';
import Watchlist from './Watchlist';
import TradingChart from './TradingChart';
import AIRecommendations from './AIRecommendations';
import { FCFAConverter } from './FCFAConverter';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3 } from 'lucide-react';
import { formatXOF } from '../utils/currency';

export default function Dashboard() {
  useBinanceWebSocket();
  
  const prices = useCryptoStore((state) => state.prices);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  const timeframe = useCryptoStore((state) => state.timeframe);
  const trades = useCryptoStore((state) => state.trades);

  const [stats, setStats] = useState({
    totalTrades: 0,
    winRate: 0,
    totalPnl: 0,
    dailyChange: 0,
  });

  useEffect(() => {
    const closedTrades = trades.filter((t) => t.status === 'closed');
    const winningTrades = closedTrades.filter((t) => (t.pnl || 0) > 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    setStats({
      totalTrades: trades.length,
      winRate,
      totalPnl,
      dailyChange: 0,
    });
  }, [trades]);

  const selectedPrice = prices.get(selectedSymbol);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="crypto-card flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-crypto-blue/20 flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-crypto-blue" />
          </div>
          <div className="min-w-0">
            <div className="text-gray-400 text-xs sm:text-sm">Paire Active</div>
            <div className="text-lg sm:text-xl font-bold truncate">{selectedSymbol}</div>
          </div>
        </div>

        <div className="crypto-card flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-crypto-green/20 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-crypto-green" />
          </div>
          <div className="min-w-0">
            <div className="text-gray-400 text-xs sm:text-sm">Prix Actuel</div>
            <div>
              {selectedPrice ? (
                <>
                  <div className="text-lg sm:text-xl font-bold font-mono">
                    ${selectedPrice.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-gray-400">
                    ≈ {formatXOF(selectedPrice.price)}
                  </div>
                </>
              ) : (
                <span className="text-lg sm:text-xl font-bold">--</span>
              )}
            </div>
          </div>
        </div>

        <div className="crypto-card flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-crypto-purple/20 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-crypto-purple" />
          </div>
          <div className="min-w-0">
            <div className="text-gray-400 text-xs sm:text-sm">Trades</div>
            <div className="text-lg sm:text-xl font-bold">{stats.totalTrades}</div>
          </div>
        </div>

        <div className="crypto-card flex items-center gap-3 overflow-hidden">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            stats.totalPnl >= 0 ? 'bg-crypto-green/20' : 'bg-crypto-red/20'
          }`}>
            {stats.totalPnl >= 0 ? (
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-crypto-green" />
            ) : (
              <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-crypto-red" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-gray-400 text-xs sm:text-sm">P&L Total</div>
            <div className={stats.totalPnl >= 0 ? 'text-crypto-green' : 'text-crypto-red'}>
              <div className="text-lg sm:text-xl font-bold font-mono">
                {stats.totalPnl >= 0 ? '+' : ''}
                ${stats.totalPnl.toFixed(2)}
              </div>
              <div className="text-sm text-gray-400">
                ≈ {formatXOF(stats.totalPnl)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {/* Watchlist - Full width on mobile, sidebar on desktop */}
        <div className="xl:col-span-1 order-2 xl:order-1">
          <Watchlist />
        </div>

        {/* Chart - Takes center stage - Always visible minimum 350px on mobile */}
        <div className="xl:col-span-2 order-1 xl:order-2 h-[350px] sm:h-[450px] md:h-[500px] lg:h-[550px] xl:h-[600px] min-h-[350px]">
          <TradingChart key={`${selectedSymbol}-${timeframe}`} />
        </div>

        {/* AI Recommendations */}
        <div className="xl:col-span-1 order-3">
          <AIRecommendations />
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="crypto-card">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Performance</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Win Rate</span>
              <span className={`font-medium ${stats.winRate >= 50 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                {stats.winRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Trades Ouverts</span>
              <span className="font-medium">
                {trades.filter((t) => t.status === 'open').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Trades Fermés</span>
              <span className="font-medium">
                {trades.filter((t) => t.status === 'closed').length}
              </span>
            </div>
          </div>
        </div>

        <div className="crypto-card">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Marché 24h</h3>
          {selectedPrice && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Plus Haut</span>
                <div className="text-right">
                  <div className="font-mono">${selectedPrice.high24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="text-xs text-gray-400">≈ {formatXOF(selectedPrice.high24h)}</div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Plus Bas</span>
                <div className="text-right">
                  <div className="font-mono">${selectedPrice.low24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="text-xs text-gray-400">≈ {formatXOF(selectedPrice.low24h)}</div>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Volume 24h</span>
                <span className="font-mono">
                  {(selectedPrice.volume24h / 1e6).toFixed(2)}M
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Variation 24h</span>
                <span className={`font-mono ${selectedPrice.change24h >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                  {selectedPrice.change24h >= 0 ? '+' : ''}{selectedPrice.change24h.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="crypto-card">
          <h3 className="text-sm font-medium text-gray-400 mb-3">À Propos</h3>
          <div className="text-sm text-gray-500 space-y-2">
            <p>
              <strong className="text-white">Crypto Trading Pro</strong> est une application de trading crypto professionnelle.
            </p>
            <p>
              Version: <span className="text-white">1.0.0 MVP</span>
            </p>
            <p>
              Données: <span className="text-white">Binance</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
