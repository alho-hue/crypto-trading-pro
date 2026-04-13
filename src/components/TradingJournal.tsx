import { useState } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { FCFAConverter } from './FCFAConverter';
import { Plus, Trash2, X, BookOpen, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Trade } from '../types';

const STRATEGIES = [
  'Support/Résistance',
  'Trend Following',
  'Breakout',
  'Pullback',
  'Pattern Trading',
  'Scalping',
  'RSI Strategy',
  'MACD Crossover',
  'Bollinger Bounce',
  'Golden/Death Cross',
  'Autre',
];

export default function TradingJournal() {
  const trades = useCryptoStore((state) => state.trades);
  const addTrade = useCryptoStore((state) => state.addTrade);
  const updateTrade = useCryptoStore((state) => state.updateTrade);
  const closeTrade = useCryptoStore((state) => state.closeTrade);
  const deleteTrade = useCryptoStore((state) => state.deleteTrade);
  const prices = useCryptoStore((state) => state.prices);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState<string | null>(null);

  const [newTrade, setNewTrade] = useState<Partial<Trade>>({
    symbol: 'BTCUSDT',
    type: 'buy',
    entryPrice: 0,
    quantity: 0,
    strategy: STRATEGIES[0],
    notes: '',
  });

  const handleAddTrade = () => {
    if (!newTrade.symbol || !newTrade.entryPrice || !newTrade.quantity) return;

    const trade: Trade = {
      id: Date.now().toString(),
      symbol: newTrade.symbol!,
      type: newTrade.type!,
      entryPrice: newTrade.entryPrice!,
      quantity: newTrade.quantity!,
      strategy: newTrade.strategy || '',
      notes: newTrade.notes || '',
      timestamp: Date.now(),
      status: 'open',
      stopLoss: newTrade.stopLoss,
      takeProfit: newTrade.takeProfit,
    };

    addTrade(trade);
    setShowAddModal(false);
    setNewTrade({
      symbol: 'BTCUSDT',
      type: 'buy',
      entryPrice: 0,
      quantity: 0,
      strategy: STRATEGIES[0],
      notes: '',
    });
  };

  const handleCloseTrade = (id: string) => {
    const trade = trades.find((t) => t.id === id);
    if (!trade) return;

    const currentPrice = prices.get(trade.symbol)?.price || trade.entryPrice;
    closeTrade(id, currentPrice);
  };

  // Calculate stats
  const closedTrades = trades.filter((t) => t.status === 'closed');
  const winningTrades = closedTrades.filter((t) => (t.pnl || 0) > 0);
  const losingTrades = closedTrades.filter((t) => (t.pnl || 0) < 0);
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="crypto-card">
          <div className="text-gray-400 text-sm mb-1">Total Trades</div>
          <div className="text-2xl font-bold">{trades.length}</div>
        </div>
        <div className="crypto-card">
          <div className="text-gray-400 text-sm mb-1">Win Rate</div>
          <div className={`text-2xl font-bold ${winRate >= 50 ? 'text-crypto-green' : 'text-crypto-red'}`}>
            {winRate.toFixed(1)}%
          </div>
        </div>
        <div className="crypto-card">
          <div className="text-gray-400 text-sm mb-1">Trades Gagnants</div>
          <div className="text-2xl font-bold text-crypto-green">{winningTrades.length}</div>
        </div>
        <div className="crypto-card">
          <div className="text-gray-400 text-sm mb-1">P&L Total</div>
          <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
            ${totalPnl.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Add Trade Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddModal(true)}
          className="crypto-button-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nouveau Trade
        </button>
      </div>

      {/* Trades List */}
      <div className="crypto-card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-crypto-blue" />
          Journal de Trading
        </h2>

        {trades.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
            Aucun trade enregistré
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="text-left text-gray-400 text-sm border-b border-crypto-border">
                  <th className="pb-2 whitespace-nowrap pr-4">Date</th>
                  <th className="pb-2 whitespace-nowrap pr-4">Paire</th>
                  <th className="pb-2 whitespace-nowrap pr-4">Type</th>
                  <th className="pb-2 whitespace-nowrap pr-4">Prix Entrée</th>
                  <th className="pb-2 whitespace-nowrap pr-4">Prix Sortie</th>
                  <th className="pb-2 whitespace-nowrap pr-4">Quantité</th>
                  <th className="pb-2 whitespace-nowrap pr-4">P&L</th>
                  <th className="pb-2 whitespace-nowrap pr-4">Stratégie</th>
                  <th className="pb-2 whitespace-nowrap pr-4">Statut</th>
                  <th className="pb-2 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trades.slice().reverse().map((trade) => (
                  <tr key={trade.id} className="border-b border-crypto-border/50">
                    <td className="py-3 text-sm">
                      {format(trade.timestamp, 'dd/MM HH:mm', { locale: fr })}
                    </td>
                    <td className="py-3 font-medium">{trade.symbol}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.type === 'buy' 
                          ? 'bg-crypto-green/20 text-crypto-green' 
                          : 'bg-crypto-red/20 text-crypto-red'
                      }`}>
                        {trade.type === 'buy' ? 'Achat' : 'Vente'}
                      </span>
                    </td>
                    <td className="py-3 font-mono">
                      ${trade.entryPrice.toFixed(2)}
                      <FCFAConverter usdAmount={trade.entryPrice} className="text-[10px]" />
                    </td>
                    <td className="py-3 font-mono">
                      {trade.exitPrice ? (
                        <>
                          ${trade.exitPrice.toFixed(2)}
                          <FCFAConverter usdAmount={trade.exitPrice} className="text-[10px]" />
                        </>
                      ) : '-'}
                    </td>
                    <td className="py-3 font-mono">{trade.quantity.toFixed(4)}</td>
                    <td className="py-3 font-mono">
                      {trade.pnl !== undefined ? (
                        <span className={trade.pnl >= 0 ? 'text-crypto-green' : 'text-crypto-red'}>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                          <span className="text-xs ml-1">
                            ({trade.pnlPercent && trade.pnlPercent >= 0 ? '+' : ''}
                            {trade.pnlPercent?.toFixed(2)}%)
                          </span>
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 text-sm">{trade.strategy || '-'}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.status === 'open' 
                          ? 'bg-crypto-blue/20 text-crypto-blue' 
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {trade.status === 'open' ? 'Ouvert' : 'Fermé'}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        {trade.status === 'open' && (
                          <button
                            onClick={() => handleCloseTrade(trade.id)}
                            className="text-crypto-green hover:text-emerald-400"
                            title="Fermer le trade"
                          >
                            <TrendingUp className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteTrade(trade.id)}
                          className="text-crypto-red hover:text-red-400"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Trade Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-crypto-card border border-crypto-border rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Nouveau Trade</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Paire</label>
                <select
                  value={newTrade.symbol}
                  onChange={(e) => setNewTrade({ ...newTrade, symbol: e.target.value })}
                  className="crypto-input w-full"
                >
                  <option value="BTCUSDT">BTCUSDT</option>
                  <option value="ETHUSDT">ETHUSDT</option>
                  <option value="ADAUSDT">ADAUSDT</option>
                  <option value="BNBUSDT">BNBUSDT</option>
                  <option value="SOLUSDT">SOLUSDT</option>
                  <option value="XRPUSDT">XRPUSDT</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewTrade({ ...newTrade, type: 'buy' })}
                    className={`flex-1 py-2 rounded-lg font-medium ${
                      newTrade.type === 'buy'
                        ? 'bg-crypto-green text-white'
                        : 'bg-crypto-dark text-gray-400'
                    }`}
                  >
                    Achat
                  </button>
                  <button
                    onClick={() => setNewTrade({ ...newTrade, type: 'sell' })}
                    className={`flex-1 py-2 rounded-lg font-medium ${
                      newTrade.type === 'sell'
                        ? 'bg-crypto-red text-white'
                        : 'bg-crypto-dark text-gray-400'
                    }`}
                  >
                    Vente
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Prix d'entrée</label>
                <input
                  type="number"
                  step="0.01"
                  value={newTrade.entryPrice || ''}
                  onChange={(e) => setNewTrade({ ...newTrade, entryPrice: parseFloat(e.target.value) })}
                  className="crypto-input w-full"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Quantité</label>
                <input
                  type="number"
                  step="0.0001"
                  value={newTrade.quantity || ''}
                  onChange={(e) => setNewTrade({ ...newTrade, quantity: parseFloat(e.target.value) })}
                  className="crypto-input w-full"
                  placeholder="0.0000"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Stop Loss (optionnel)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newTrade.stopLoss || ''}
                  onChange={(e) => setNewTrade({ ...newTrade, stopLoss: parseFloat(e.target.value) })}
                  className="crypto-input w-full"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Take Profit (optionnel)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newTrade.takeProfit || ''}
                  onChange={(e) => setNewTrade({ ...newTrade, takeProfit: parseFloat(e.target.value) })}
                  className="crypto-input w-full"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Stratégie</label>
                <select
                  value={newTrade.strategy}
                  onChange={(e) => setNewTrade({ ...newTrade, strategy: e.target.value })}
                  className="crypto-input w-full"
                >
                  {STRATEGIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Notes</label>
                <textarea
                  value={newTrade.notes}
                  onChange={(e) => setNewTrade({ ...newTrade, notes: e.target.value })}
                  className="crypto-input w-full h-20 resize-none"
                  placeholder="Notes sur ce trade..."
                />
              </div>

              <button
                onClick={handleAddTrade}
                className="crypto-button-success w-full"
              >
                Ajouter le Trade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
