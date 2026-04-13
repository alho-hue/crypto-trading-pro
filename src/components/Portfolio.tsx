import { useState, useEffect, useMemo } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { FCFAConverter } from './FCFAConverter';
import { Wallet, TrendingUp, TrendingDown, PieChart, DollarSign, ArrowUpRight, ArrowDownRight, Plus, Trash2 } from 'lucide-react';

interface PortfolioItem {
  id: string;
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  addedAt: number;
  notes?: string;
}

export default function Portfolio() {
  const [holdings, setHoldings] = useState<PortfolioItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newHolding, setNewHolding] = useState({
    symbol: 'BTCUSDT',
    quantity: '',
    avgBuyPrice: '',
    notes: '',
  });

  const prices = useCryptoStore((state) => state.prices);

  // Load portfolio from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('trading_portfolio');
    if (saved) {
      setHoldings(JSON.parse(saved));
    }
  }, []);

  // Save portfolio
  const saveHoldings = (updated: PortfolioItem[]) => {
    setHoldings(updated);
    localStorage.setItem('trading_portfolio', JSON.stringify(updated));
  };

  // Add holding
  const addHolding = () => {
    if (!newHolding.quantity || !newHolding.avgBuyPrice) return;

    const holding: PortfolioItem = {
      id: Date.now().toString(),
      symbol: newHolding.symbol,
      quantity: parseFloat(newHolding.quantity),
      avgBuyPrice: parseFloat(newHolding.avgBuyPrice),
      addedAt: Date.now(),
      notes: newHolding.notes,
    };

    saveHoldings([...holdings, holding]);
    setShowAdd(false);
    setNewHolding({ symbol: 'BTCUSDT', quantity: '', avgBuyPrice: '', notes: '' });
  };

  // Delete holding
  const deleteHolding = (id: string) => {
    if (confirm('Supprimer cette position ?')) {
      saveHoldings(holdings.filter(h => h.id !== id));
    }
  };

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;
    let totalPnl = 0;

    const items = holdings.map(holding => {
      const price = prices.get(holding.symbol);
      const currentPrice = price?.price || holding.avgBuyPrice;
      const currentValue = holding.quantity * currentPrice;
      const costBasis = holding.quantity * holding.avgBuyPrice;
      const pnl = currentValue - costBasis;
      const pnlPercent = ((currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice) * 100;

      totalValue += currentValue;
      totalCost += costBasis;
      totalPnl += pnl;

      return {
        ...holding,
        currentPrice,
        currentValue,
        pnl,
        pnlPercent,
      };
    });

    return {
      items,
      totalValue,
      totalCost,
      totalPnl,
      totalPnlPercent: totalCost > 0 ? (totalPnl / totalCost) * 100 : 0,
    };
  }, [holdings, prices]);

  // Allocation by symbol
  const allocation = useMemo(() => {
    if (portfolioMetrics.totalValue === 0) return [];
    
    return portfolioMetrics.items.map(item => ({
      symbol: item.symbol,
      value: item.currentValue,
      percent: (item.currentValue / portfolioMetrics.totalValue) * 100,
    })).sort((a, b) => b.value - a.value);
  }, [portfolioMetrics]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-crypto-blue" />
          Gestion du Portefeuille
        </h1>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Ajouter Position
        </button>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-crypto-card rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-crypto-green" />
              Ajouter une Position
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Crypto</label>
                <select
                  value={newHolding.symbol}
                  onChange={(e) => setNewHolding({...newHolding, symbol: e.target.value})}
                  className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                >
                  <option value="BTCUSDT">BTC/USDT</option>
                  <option value="ETHUSDT">ETH/USDT</option>
                  <option value="ADAUSDT">ADA/USDT</option>
                  <option value="BNBUSDT">BNB/USDT</option>
                  <option value="SOLUSDT">SOL/USDT</option>
                  <option value="XRPUSDT">XRP/USDT</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Quantité</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={newHolding.quantity}
                    onChange={(e) => setNewHolding({...newHolding, quantity: e.target.value})}
                    placeholder="0.5"
                    className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Prix d'achat moyen</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newHolding.avgBuyPrice}
                    onChange={(e) => setNewHolding({...newHolding, avgBuyPrice: e.target.value})}
                    placeholder="70000"
                    className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400">Notes (optionnel)</label>
                <input
                  type="text"
                  value={newHolding.notes}
                  onChange={(e) => setNewHolding({...newHolding, notes: e.target.value})}
                  placeholder="Stratégie, date d'achat..."
                  className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2 bg-crypto-dark rounded-lg text-gray-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                onClick={addHolding}
                disabled={!newHolding.quantity || !newHolding.avgBuyPrice}
                className="flex-1 py-2 bg-crypto-green rounded-lg text-white hover:bg-crypto-green/80 disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="crypto-card">
            <div className="text-sm text-gray-400">Valeur Totale</div>
            <div className="text-2xl font-bold font-mono">
              ${portfolioMetrics.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <FCFAConverter usdAmount={portfolioMetrics.totalValue} />
          </div>
          <div className="crypto-card">
            <div className="text-sm text-gray-400">P&L Total</div>
            <div className={`text-2xl font-bold font-mono ${
              portfolioMetrics.totalPnl >= 0 ? 'text-crypto-green' : 'text-crypto-red'
            }`}>
              {portfolioMetrics.totalPnl >= 0 ? '+' : ''}
              ${portfolioMetrics.totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {portfolioMetrics.totalPnl !== 0 && <FCFAConverter usdAmount={portfolioMetrics.totalPnl} />}
          </div>
          <div className="crypto-card">
            <div className="text-sm text-gray-400">Performance</div>
            <div className={`text-2xl font-bold ${
              portfolioMetrics.totalPnlPercent >= 0 ? 'text-crypto-green' : 'text-crypto-red'
            }`}>
              {portfolioMetrics.totalPnlPercent >= 0 ? '+' : ''}
              {portfolioMetrics.totalPnlPercent.toFixed(2)}%
            </div>
          </div>
          <div className="crypto-card">
            <div className="text-sm text-gray-400">Positions</div>
            <div className="text-2xl font-bold">{holdings.length}</div>
          </div>
        </div>
      )}

      {/* Holdings Table */}
      {holdings.length === 0 ? (
        <div className="crypto-card text-center py-12">
          <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium mb-2">Portefeuille vide</h3>
          <p className="text-gray-400 mb-4">
            Ajoute tes positions pour suivre tes performances en temps réel
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Ajouter
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Allocation Chart */}
          {allocation.length > 0 && (
            <div className="crypto-card">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Répartition
              </h3>
              <div className="space-y-2">
                {allocation.map((item) => (
                  <div key={item.symbol} className="flex items-center gap-3">
                    <span className="w-16 text-sm">{item.symbol.replace('USDT', '')}</span>
                    <div className="flex-1 h-6 bg-crypto-dark rounded-full overflow-hidden">
                      <div
                        className="h-full bg-crypto-blue rounded-full"
                        style={{ width: `${Math.max(item.percent, 1)}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-sm font-mono">
                      ${item.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                    <span className="w-12 text-right text-xs text-gray-400">
                      {item.percent.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Holdings List */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-crypto-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Crypto</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Quantité</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Prix moyen</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Prix actuel</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Valeur</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">P&L</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {portfolioMetrics.items.map((item) => (
                  <tr key={item.id} className="border-b border-crypto-border/50 hover:bg-crypto-dark/50">
                    <td className="py-4 px-4">
                      <div className="font-medium">{item.symbol}</div>
                      {item.notes && <div className="text-xs text-gray-400">{item.notes}</div>}
                    </td>
                    <td className="text-right py-4 px-4 font-mono">
                      {item.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                    </td>
                    <td className="text-right py-4 px-4 font-mono text-gray-400">
                      ${item.avgBuyPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <FCFAConverter usdAmount={item.avgBuyPrice} className="text-[10px]" />
                    </td>
                    <td className="text-right py-4 px-4 font-mono">
                      ${item.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <FCFAConverter usdAmount={item.currentPrice} className="text-[10px]" />
                    </td>
                    <td className="text-right py-4 px-4 font-mono font-medium">
                      ${item.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <FCFAConverter usdAmount={item.currentValue} className="text-[10px]" />
                    </td>
                    <td className="text-right py-4 px-4">
                      <div className={`font-mono font-medium ${item.pnl >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                        {item.pnl >= 0 ? '+' : ''}{item.pnlPercent.toFixed(2)}%
                      </div>
                      <div className={`text-xs font-mono ${item.pnl >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                        {item.pnl >= 0 ? '+' : ''}${item.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => deleteHolding(item.id)}
                        className="text-gray-400 hover:text-crypto-red transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
