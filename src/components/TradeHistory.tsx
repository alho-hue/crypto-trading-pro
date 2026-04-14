import { useState, useEffect } from 'react';
import { History, Download, Calendar, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { getDecryptedKey } from '../utils/crypto';
import { fetchMyTrades } from '../services/binanceApi';
import { formatXOF } from '../utils/currency';

interface Trade {
  id: number;
  symbol: string;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
  isBestMatch: boolean;
}

export default function TradeHistory() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [hasApiKeys, setHasApiKeys] = useState(false);
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');

  useEffect(() => {
    const apiKey = getDecryptedKey('binance_api_key');
    const secretKey = getDecryptedKey('binance_secret_key');
    setHasApiKeys(!!(apiKey && secretKey));
  }, []);

  const loadTrades = async () => {
    if (!hasApiKeys) {
      alert('Configurez vos clés API Binance dans les paramètres');
      return;
    }

    setLoading(true);
    try {
      const result = await fetchMyTrades(symbol, 100);
      if (Array.isArray(result)) {
        setTrades(result);
      } else {
        console.error('Invalid response:', result);
        alert('Erreur lors du chargement des trades');
      }
    } catch (error) {
      console.error('Failed to load trades:', error);
      alert('Erreur de connexion à Binance');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Symbol', 'Type', 'Prix', 'Quantité', 'Total', 'Commission', 'Commission Asset'];
    const rows = filteredTrades.map(trade => [
      new Date(trade.time).toISOString(),
      trade.symbol,
      trade.isBuyer ? 'ACHAT' : 'VENTE',
      trade.price,
      trade.qty,
      trade.quoteQty,
      trade.commission,
      trade.commissionAsset,
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trades_${symbol}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTrades = trades.filter(trade => {
    if (filter === 'buy') return trade.isBuyer;
    if (filter === 'sell') return !trade.isBuyer;
    return true;
  });

  const totalBuy = filteredTrades
    .filter(t => t.isBuyer)
    .reduce((sum, t) => sum + parseFloat(t.quoteQty), 0);
  
  const totalSell = filteredTrades
    .filter(t => !t.isBuyer)
    .reduce((sum, t) => sum + parseFloat(t.quoteQty), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="w-6 h-6 text-crypto-blue" />
          Historique des Trades
        </h1>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            disabled={trades.length === 0}
            className="px-4 py-2 bg-crypto-blue/20 text-crypto-blue rounded-lg hover:bg-crypto-blue/30 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="crypto-card">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Crypto</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
            >
              <option value="BTCUSDT">BTC/USDT</option>
              <option value="ETHUSDT">ETH/USDT</option>
              <option value="BNBUSDT">BNB/USDT</option>
              <option value="ADAUSDT">ADA/USDT</option>
              <option value="SOLUSDT">SOL/USDT</option>
              <option value="XRPUSDT">XRP/USDT</option>
              <option value="DOTUSDT">DOT/USDT</option>
              <option value="DOGEUSDT">DOGE/USDT</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">Filtre</label>
            <div className="flex gap-1 bg-crypto-dark rounded-lg p-1">
              {(['all', 'buy', 'sell'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    filter === f
                      ? 'bg-crypto-blue text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'Tous' : f === 'buy' ? 'Achats' : 'Ventes'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={loadTrades}
            disabled={loading}
            className="px-4 py-2 bg-crypto-accent rounded-lg hover:bg-crypto-accent/80 transition-colors disabled:opacity-50"
          >
            {loading ? 'Chargement...' : 'Charger'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Total Achats</div>
          <div className="text-2xl font-bold text-crypto-green">
            ${totalBuy.toFixed(2)}
          </div>
          <div className="text-sm text-gray-400">
            ≈ {formatXOF(totalBuy)}
          </div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Total Ventes</div>
          <div className="text-2xl font-bold text-crypto-red">
            ${totalSell.toFixed(2)}
          </div>
          <div className="text-sm text-gray-400">
            ≈ {formatXOF(totalSell)}
          </div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Net (P&L)</div>
          <div className={`text-2xl font-bold ${totalSell - totalBuy >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
            ${(totalSell - totalBuy).toFixed(2)}
          </div>
          <div className="text-sm text-gray-400">
            ≈ {formatXOF(totalSell - totalBuy)}
          </div>
        </div>
      </div>

      {/* Trades List */}
      <div className="crypto-card">
        <h2 className="text-lg font-semibold mb-4">Trades ({filteredTrades.length})</h2>
        
        {filteredTrades.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucun trade chargé</p>
            <p className="text-sm mt-1">Cliquez sur "Charger" pour récupérer votre historique</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTrades.map((trade) => (
              <div
                key={trade.id}
                className={`p-3 rounded-lg border ${
                  trade.isBuyer
                    ? 'border-crypto-green/30 bg-crypto-green/5'
                    : 'border-crypto-red/30 bg-crypto-red/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      trade.isBuyer ? 'bg-crypto-green/20' : 'bg-crypto-red/20'
                    }`}>
                      {trade.isBuyer ? (
                        <span className="text-crypto-green font-bold">A</span>
                      ) : (
                        <span className="text-crypto-red font-bold">V</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{trade.symbol}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          trade.isBuyer
                            ? 'bg-crypto-green/20 text-crypto-green'
                            : 'bg-crypto-red/20 text-crypto-red'
                        }`}>
                          {trade.isBuyer ? 'ACHAT' : 'VENTE'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {new Date(trade.time).toLocaleString('fr-FR')}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-semibold">
                      ${parseFloat(trade.quoteQty).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-400">
                      @ ${parseFloat(trade.price).toFixed(2)}
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedTrade(expandedTrade === trade.id ? null : trade.id)}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    {expandedTrade === trade.id ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {expandedTrade === trade.id && (
                  <div className="mt-3 pt-3 border-t border-crypto-border text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-gray-400">Quantité:</span>{' '}
                        <span className="font-mono">{parseFloat(trade.qty).toFixed(8)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Prix unitaire:</span>{' '}
                        <span className="font-mono">${parseFloat(trade.price).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Commission:</span>{' '}
                        <span className="font-mono">{parseFloat(trade.commission).toFixed(8)} {trade.commissionAsset}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Type:</span>{' '}
                        <span>{trade.isMaker ? 'Maker' : 'Taker'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Trade ID:</span>{' '}
                        <span className="font-mono text-xs">{trade.id}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">XOF:</span>{' '}
                        <span className="font-mono">{formatXOF(parseFloat(trade.quoteQty))}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
