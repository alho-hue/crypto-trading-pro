import { useState, useEffect, useCallback } from 'react';
import { Wallet, TrendingUp, TrendingDown, DollarSign, AlertCircle, Lock } from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';
import { getDecryptedKey } from '../utils/crypto';
import { fetchAccountBalance, hasApiKey } from '../services/binanceApi';

interface Balance {
  asset: string;
  free: string;
  locked: string;
  usdtValue?: number;
}

export default function LiveTrading() {
  const [hasApiKeys, setHasApiKeys] = useState(false);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalUSDT, setTotalUSDT] = useState(0);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);

  // Vérifier les clés API au chargement et toutes les 5 secondes
  useEffect(() => {
    const checkKeys = () => {
      const hasKeys = hasApiKey();
      setHasApiKeys(hasKeys);
    };
    
    checkKeys();
    const interval = setInterval(checkKeys, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAccountInfo = useCallback(async () => {
    if (!hasApiKeys) return;
    
    setLoading(true);
    try {
      const result = await fetchAccountBalance();
      
      if (result.success && result.balances) {
        setBalances(result.balances);
        
        // Calculer total USDT (approximation)
        const total = result.balances.reduce((sum: number, b: Balance) => {
          return sum + (parseFloat(b.free) + parseFloat(b.locked));
        }, 0);
        setTotalUSDT(total);
      } else {
        console.error('Failed to fetch balance:', result.message);
        alert('Erreur: ' + (result.message || 'Impossible de récupérer le solde'));
      }
    } catch (error) {
      console.error('Failed to fetch account:', error);
      alert('Erreur de connexion à Binance');
    } finally {
      setLoading(false);
    }
  }, [hasApiKeys]);

  if (!hasApiKeys) {
    return (
      <div className="crypto-card">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-6 h-6 text-crypto-accent" />
          <h2 className="text-xl font-bold">Trading Réel</h2>
        </div>
        <div className="bg-crypto-dark/50 rounded-lg p-6 text-center">
          <p className="text-gray-400 mb-4">
            Configurez vos clés API Binance dans les Paramètres pour activer le trading réel
          </p>
          <a 
            href="#/settings" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-crypto-accent rounded-lg hover:bg-crypto-accent/80 transition-colors"
          >
            <Lock className="w-4 h-4" />
            Configurer les clés API
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-crypto-accent" />
          Trading Réel
        </h1>
        <button 
          onClick={fetchAccountInfo}
          disabled={loading}
          className="px-4 py-2 bg-crypto-accent rounded-lg hover:bg-crypto-accent/80 transition-colors disabled:opacity-50"
        >
          {loading ? 'Chargement...' : 'Actualiser'}
        </button>
      </div>

      {/* Balance Totale */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="crypto-card bg-gradient-to-br from-crypto-accent/20 to-crypto-blue/20 border-crypto-accent">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-crypto-accent" />
            <span className="text-gray-400">Balance Totale</span>
          </div>
          <p className="text-3xl font-bold">${totalUSDT.toFixed(2)}</p>
          <p className="text-sm text-gray-400">≈ {totalUSDT.toFixed(6)} USDT</p>
        </div>

        <div className="crypto-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-crypto-green" />
            <span className="text-gray-400">P&L Aujourd'hui</span>
          </div>
          <p className="text-2xl font-bold text-crypto-green">+$0.00</p>
          <p className="text-sm text-gray-400">0.00%</p>
        </div>

        <div className="crypto-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-crypto-red" />
            <span className="text-gray-400">Positions Ouvertes</span>
          </div>
          <p className="text-2xl font-bold">0</p>
          <p className="text-sm text-gray-400">Aucune position active</p>
        </div>
      </div>

      {/* Trading Interface */}
      <div className="crypto-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Nouvel Ordre - {selectedSymbol}</h2>
          <span className="px-2 py-1 bg-crypto-green/20 text-crypto-green text-sm rounded">
            Spot Trading
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* BUY Side */}
          <div className="bg-crypto-dark/50 rounded-lg p-4 border border-crypto-green/30">
            <h3 className="font-semibold text-crypto-green mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              ACHETER
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400">Prix (USDT)</label>
                <input 
                  type="number" 
                  placeholder="Prix du marché"
                  className="w-full bg-crypto-dark border border-crypto-border rounded px-3 py-2 mt-1"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Quantité</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  className="w-full bg-crypto-dark border border-crypto-border rounded px-3 py-2 mt-1"
                />
              </div>
              <button className="w-full py-3 bg-crypto-green hover:bg-crypto-green/80 rounded-lg font-semibold transition-colors">
                Acheter {selectedSymbol.replace('USDT', '')}
              </button>
            </div>
          </div>

          {/* SELL Side */}
          <div className="bg-crypto-dark/50 rounded-lg p-4 border border-crypto-red/30">
            <h3 className="font-semibold text-crypto-red mb-3 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              VENDRE
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400">Prix (USDT)</label>
                <input 
                  type="number" 
                  placeholder="Prix du marché"
                  className="w-full bg-crypto-dark border border-crypto-border rounded px-3 py-2 mt-1"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Quantité</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  className="w-full bg-crypto-dark border border-crypto-border rounded px-3 py-2 mt-1"
                />
              </div>
              <button className="w-full py-3 bg-crypto-red hover:bg-crypto-red/80 rounded-lg font-semibold transition-colors">
                Vendre {selectedSymbol.replace('USDT', '')}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-crypto-green/10 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-crypto-green" />
          <p className="text-sm text-crypto-green">
            Mode RÉEL connecté - Les ordres seront exécutés sur votre compte Binance
          </p>
        </div>
      </div>

      {/* Portefeuille */}
      <div className="crypto-card">
        <h2 className="text-xl font-semibold mb-4">Votre Portefeuille</h2>
        {balances.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            Aucune balance trouvée. Cliquez sur "Actualiser" pour charger vos soldes.
          </p>
        ) : (
          <div className="space-y-2">
            {balances.map((balance) => (
              <div 
                key={balance.asset} 
                className="flex items-center justify-between p-3 bg-crypto-dark/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-crypto-blue/20 rounded-full flex items-center justify-center font-bold">
                    {balance.asset[0]}
                  </div>
                  <div>
                    <p className="font-semibold">{balance.asset}</p>
                    <p className="text-sm text-gray-400">
                      Free: {parseFloat(balance.free).toFixed(8)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {(parseFloat(balance.free) + parseFloat(balance.locked)).toFixed(8)}
                  </p>
                  <p className="text-sm text-gray-400">{balance.asset}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
