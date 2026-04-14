import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, TrendingUp, TrendingDown, Star, Activity, BarChart3 } from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';
import { formatXOF } from '../utils/currency';

interface CryptoData {
  symbol: string;
  price: number;
  change24h: number;
  change24hValue: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  marketCap?: number;
}

const POPULAR_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT', 
  'DOTUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'UNIUSDT', 'LTCUSDT',
  'BCHUSDT', 'ALGOUSDT', 'MATICUSDT', 'ATOMUSDT', 'ETCUSDT', 'XLMUSDT',
  'VETUSDT', 'FILUSDT', 'TRXUSDT', 'THETAUSDT', 'EOSUSDT', 'AAVEUSDT'
];

export default function CryptoScanner() {
  const [allCryptos, setAllCryptos] = useState<CryptoData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'volume' | 'change' | 'price'>('volume');
  const [filterChange, setFilterChange] = useState<'all' | 'gainers' | 'losers'>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  
  const prices = useCryptoStore((state) => state.prices);
  const setSelectedSymbol = useCryptoStore((state) => state.setSelectedSymbol);
  const setView = useCryptoStore((state) => state.setView);

  useEffect(() => {
    const savedFavorites = localStorage.getItem('crypto_favorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('crypto_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Convert prices Map to array
  useEffect(() => {
    const cryptoArray: CryptoData[] = [];
    prices.forEach((price, symbol) => {
      if (symbol.endsWith('USDT')) {
        cryptoArray.push({
          symbol,
          price: price.price,
          change24h: price.change24h,
          change24hValue: price.change24hValue,
          volume24h: price.volume24h,
          high24h: price.high24h,
          low24h: price.low24h,
        });
      }
    });
    setAllCryptos(cryptoArray);
  }, [prices]);

  const filteredCryptos = useMemo(() => {
    let filtered = allCryptos;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toUpperCase();
      filtered = filtered.filter(c => 
        c.symbol.includes(query) || 
        c.symbol.replace('USDT', '').includes(query)
      );
    }
    
    // Change filter
    if (filterChange === 'gainers') {
      filtered = filtered.filter(c => c.change24h > 0);
    } else if (filterChange === 'losers') {
      filtered = filtered.filter(c => c.change24h < 0);
    }
    
    // Favorites filter
    if (showOnlyFavorites) {
      filtered = filtered.filter(c => favorites.includes(c.symbol));
    }
    
    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'volume') return b.volume24h - a.volume24h;
      if (sortBy === 'change') return b.change24h - a.change24h;
      if (sortBy === 'price') return b.price - a.price;
      return 0;
    });
    
    return filtered;
  }, [allCryptos, searchQuery, sortBy, filterChange, favorites, showOnlyFavorites]);

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const selectCrypto = (symbol: string) => {
    setSelectedSymbol(symbol);
    setView('dashboard');
  };

  // Top gainers and losers
  const topGainers = useMemo(() => {
    return [...allCryptos]
      .filter(c => c.change24h > 0)
      .sort((a, b) => b.change24h - a.change24h)
      .slice(0, 5);
  }, [allCryptos]);

  const topLosers = useMemo(() => {
    return [...allCryptos]
      .filter(c => c.change24h < 0)
      .sort((a, b) => a.change24h - b.change24h)
      .slice(0, 5);
  }, [allCryptos]);

  const topVolume = useMemo(() => {
    return [...allCryptos]
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 5);
  }, [allCryptos]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-crypto-blue" />
          Scanner Crypto
        </h1>
        <div className="text-sm text-gray-400">
          {allCryptos.length} paires disponibles
        </div>
      </div>

      {/* Top Lists */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top Gainers */}
        <div className="crypto-card">
          <h3 className="text-sm font-semibold text-crypto-green mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Top Gainers 24h
          </h3>
          <div className="space-y-2">
            {topGainers.map(crypto => (
              <div 
                key={crypto.symbol}
                onClick={() => selectCrypto(crypto.symbol)}
                className="flex items-center justify-between p-2 hover:bg-crypto-dark/50 rounded cursor-pointer"
              >
                <span className="font-medium">{crypto.symbol.replace('USDT', '')}</span>
                <span className="text-crypto-green font-mono">+{crypto.change24h.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Losers */}
        <div className="crypto-card">
          <h3 className="text-sm font-semibold text-crypto-red mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Top Losers 24h
          </h3>
          <div className="space-y-2">
            {topLosers.map(crypto => (
              <div 
                key={crypto.symbol}
                onClick={() => selectCrypto(crypto.symbol)}
                className="flex items-center justify-between p-2 hover:bg-crypto-dark/50 rounded cursor-pointer"
              >
                <span className="font-medium">{crypto.symbol.replace('USDT', '')}</span>
                <span className="text-crypto-red font-mono">{crypto.change24h.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Volume */}
        <div className="crypto-card">
          <h3 className="text-sm font-semibold text-crypto-blue mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Top Volume 24h
          </h3>
          <div className="space-y-2">
            {topVolume.map(crypto => (
              <div 
                key={crypto.symbol}
                onClick={() => selectCrypto(crypto.symbol)}
                className="flex items-center justify-between p-2 hover:bg-crypto-dark/50 rounded cursor-pointer"
              >
                <span className="font-medium">{crypto.symbol.replace('USDT', '')}</span>
                <span className="text-gray-400 font-mono">
                  ${(crypto.volume24h / 1e6).toFixed(1)}M
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="crypto-card">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une crypto (BTC, ETH...)"
                className="w-full pl-10 pr-4 py-2 bg-crypto-dark border border-crypto-border rounded-lg"
              />
            </div>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
          >
            <option value="volume">Volume 24h</option>
            <option value="change">Variation 24h</option>
            <option value="price">Prix</option>
          </select>

          <div className="flex bg-crypto-dark rounded-lg p-1">
            {(['all', 'gainers', 'losers'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setFilterChange(filter)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  filterChange === filter
                    ? 'bg-crypto-blue text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {filter === 'all' ? 'Tous' : filter === 'gainers' ? 'Gagnants' : 'Perdants'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
            className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              showOnlyFavorites
                ? 'bg-crypto-accent text-white'
                : 'bg-crypto-dark text-gray-400 hover:text-white'
            }`}
          >
            <Star className={`w-4 h-4 ${showOnlyFavorites ? 'fill-current' : ''}`} />
            Favoris ({favorites.length})
          </button>
        </div>
      </div>

      {/* Crypto List */}
      <div className="crypto-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {filteredCryptos.length} résultat{filteredCryptos.length !== 1 ? 's' : ''}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-crypto-border">
                <th className="pb-3 pl-2">Crypto</th>
                <th className="pb-3">Prix</th>
                <th className="pb-3">Variation 24h</th>
                <th className="pb-3">Volume 24h</th>
                <th className="pb-3">Plus Haut/Bas 24h</th>
                <th className="pb-3 pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredCryptos.slice(0, 50).map((crypto) => (
                <tr 
                  key={crypto.symbol}
                  className="border-b border-crypto-border/50 hover:bg-crypto-dark/30"
                >
                  <td className="py-3 pl-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFavorite(crypto.symbol)}
                        className={`p-1 rounded ${
                          favorites.includes(crypto.symbol)
                            ? 'text-crypto-accent'
                            : 'text-gray-500 hover:text-crypto-accent'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${favorites.includes(crypto.symbol) ? 'fill-current' : ''}`} />
                      </button>
                      <span className="font-semibold">{crypto.symbol.replace('USDT', '')}</span>
                      <span className="text-gray-400 text-xs">/USDT</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="font-mono">${crypto.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</div>
                    <div className="text-xs text-gray-400">
                      ≈ {formatXOF(crypto.price)}
                    </div>
                  </td>
                  <td className="py-3">
                    <span className={`font-mono ${crypto.change24h >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                      {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="font-mono">${(crypto.volume24h / 1e6).toFixed(2)}M</div>
                  </td>
                  <td className="py-3">
                    <div className="text-xs">
                      <div className="text-crypto-green">H: ${crypto.high24h.toLocaleString()}</div>
                      <div className="text-crypto-red">L: ${crypto.low24h.toLocaleString()}</div>
                    </div>
                  </td>
                  <td className="py-3 pr-2">
                    <button
                      onClick={() => selectCrypto(crypto.symbol)}
                      className="px-3 py-1.5 bg-crypto-blue/20 text-crypto-blue rounded hover:bg-crypto-blue/30 transition-colors text-xs"
                    >
                      Trader
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCryptos.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucune crypto trouvée</p>
          </div>
        )}
      </div>
    </div>
  );
}
