import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, Filter, TrendingUp, TrendingDown, Star, Activity, BarChart3, 
  Zap, Target, Brain, Bell, LineChart, ArrowUpRight, ArrowDownRight,
  Percent, DollarSign, Activity as ActivityIcon, Bookmark, Trash2,
  ChevronDown, ChevronUp, RefreshCw, Eye, EyeOff, Sparkles
} from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';
import { formatXOF } from '../utils/currency';
import { Modal } from './Modal';
import { showToast } from '../stores/toastStore';

// Types enrichis
interface TechnicalIndicators {
  rsi: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  support: number;
  resistance: number;
  volatility: number;
  macdSignal: 'buy' | 'sell' | 'neutral';
}

interface CryptoData {
  symbol: string;
  price: number;
  change24h: number;
  change24hValue: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  marketCap?: number;
  volatility?: number;
  score?: number;
  technicals?: TechnicalIndicators;
  aiAnalysis?: {
    signal: 'LONG' | 'SHORT' | 'NEUTRAL';
    confidence: number;
    reason: string;
  };
}

interface FilterSettings {
  minChange: number;
  maxChange: number;
  minVolume: number;
  maxVolatility: number;
  type: 'all' | 'spot' | 'futures';
  showFavoritesOnly: boolean;
}

// Constantes
const POPULAR_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT', 
  'DOTUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'UNIUSDT', 'LTCUSDT',
  'BCHUSDT', 'ALGOUSDT', 'MATICUSDT', 'ATOMUSDT', 'ETCUSDT', 'XLMUSDT',
  'VETUSDT', 'FILUSDT', 'TRXUSDT', 'THETAUSDT', 'EOSUSDT', 'AAVEUSDT',
  'SANDUSDT', 'MANAUSDT', 'AXSUSDT', 'FTMUSDT', 'NEARUSDT', 'ICPUSDT'
];

// Scoring configuration
const SCORE_WEIGHTS = {
  trend: 0.3,
  volume: 0.25,
  volatility: 0.2,
  technicals: 0.25,
};

export default function CryptoScanner() {
  // State principal
  const [allCryptos, setAllCryptos] = useState<CryptoData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'volume' | 'change' | 'price' | 'volatility'>('score');
  const [filterMode, setFilterMode] = useState<'all' | 'gainers' | 'losers' | 'breakouts' | 'favorites'>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoData | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  
  // Filtres avancés
  const [filters, setFilters] = useState<FilterSettings>({
    minChange: -100,
    maxChange: 100,
    minVolume: 0,
    maxVolatility: 100,
    type: 'all',
    showFavoritesOnly: false,
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  const prices = useCryptoStore((state) => state.prices);
  const setSelectedSymbol = useCryptoStore((state) => state.setSelectedSymbol);
  const setView = useCryptoStore((state) => state.setView);

  // Load saved data
  useEffect(() => {
    const savedFavorites = localStorage.getItem('crypto_favorites');
    const savedWatchlist = localStorage.getItem('crypto_watchlist');
    const savedFilters = localStorage.getItem('scanner_filters');
    
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));
    if (savedFilters) setFilters(JSON.parse(savedFilters));
  }, []);

  // Save data
  useEffect(() => {
    localStorage.setItem('crypto_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('crypto_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem('scanner_filters', JSON.stringify(filters));
  }, [filters]);

  // WebSocket connection simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setWsConnected(true);
      setLastUpdate(new Date());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Calcul des indicateurs techniques simulés
  const calculateTechnicals = useCallback((crypto: CryptoData): TechnicalIndicators => {
    const range = crypto.high24h - crypto.low24h;
    const volatility = range > 0 ? (range / crypto.price) * 100 : 0;
    
    // RSI simulé basé sur la variation 24h
    let rsi = 50;
    if (crypto.change24h > 10) rsi = 70 + Math.random() * 10;
    else if (crypto.change24h > 5) rsi = 60 + Math.random() * 10;
    else if (crypto.change24h < -10) rsi = 30 - Math.random() * 10;
    else if (crypto.change24h < -5) rsi = 40 - Math.random() * 10;
    else rsi = 45 + Math.random() * 10;
    
    // Tendance
    let trend: TechnicalIndicators['trend'] = 'neutral';
    if (crypto.change24h > 3) trend = 'bullish';
    else if (crypto.change24h < -3) trend = 'bearish';
    
    // Support et résistance simulés
    const support = crypto.low24h * 0.98;
    const resistance = crypto.high24h * 1.02;
    
    // Signal MACD
    let macdSignal: TechnicalIndicators['macdSignal'] = 'neutral';
    if (crypto.change24h > 2 && volatility > 5) macdSignal = 'buy';
    else if (crypto.change24h < -2 && volatility > 5) macdSignal = 'sell';
    
    return {
      rsi: Math.max(0, Math.min(100, rsi)),
      trend,
      support,
      resistance,
      volatility,
      macdSignal,
    };
  }, []);

  // Calcul du score global
  const calculateScore = useCallback((crypto: CryptoData, technicals: TechnicalIndicators): number => {
    let score = 50; // Base score
    
    // Points pour la tendance
    if (technicals.trend === 'bullish') score += SCORE_WEIGHTS.trend * 30;
    else if (technicals.trend === 'bearish') score -= SCORE_WEIGHTS.trend * 20;
    
    // Points pour le volume (normalisé)
    const volumeScore = Math.min(25, (crypto.volume24h / 1e9) * 10);
    score += SCORE_WEIGHTS.volume * volumeScore;
    
    // Points pour la volatilité (optimal: 3-8%)
    if (technicals.volatility >= 3 && technicals.volatility <= 8) {
      score += SCORE_WEIGHTS.volatility * 20;
    } else if (technicals.volatility > 8) {
      score += SCORE_WEIGHTS.volatility * 10;
    }
    
    // Points pour les indicateurs techniques
    if (technicals.rsi >= 40 && technicals.rsi <= 60) score += SCORE_WEIGHTS.technicals * 15;
    if (technicals.macdSignal === 'buy') score += SCORE_WEIGHTS.technicals * 10;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }, []);

  // Analyse IA simulée
  const generateAIAnalysis = useCallback((crypto: CryptoData, technicals: TechnicalIndicators) => {
    let signal: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 50;
    let reason = 'Pas de signal clair';
    
    if (technicals.trend === 'bullish' && technicals.rsi < 70 && technicals.macdSignal === 'buy') {
      signal = 'LONG';
      confidence = 60 + Math.random() * 25;
      reason = `Tendance haussière confirmée avec RSI à ${technicals.rsi.toFixed(1)}. Volume élevé.`;
    } else if (technicals.trend === 'bearish' && technicals.rsi > 30 && technicals.macdSignal === 'sell') {
      signal = 'SHORT';
      confidence = 60 + Math.random() * 25;
      reason = `Tendance baissière avec momentum négatif. Support potentiel à $${technicals.support.toFixed(2)}.`;
    } else if (technicals.volatility > 15) {
      signal = 'NEUTRAL';
      confidence = 40;
      reason = `Volatilité élevée (${technicals.volatility.toFixed(1)}%). Attendre la consolidation.`;
    } else {
      confidence = 50 + Math.random() * 20;
      reason = `Marché stable. Surveiller la rupture de $${technicals.resistance.toFixed(2)}.`;
    }
    
    return {
      signal,
      confidence: Math.round(confidence),
      reason,
    };
  }, []);

  // Convert prices Map to array avec enrichissement
  useEffect(() => {
    const cryptoArray: CryptoData[] = [];
    prices.forEach((price, symbol) => {
      if (symbol.endsWith('USDT')) {
        const baseCrypto: CryptoData = {
          symbol,
          price: price.price,
          change24h: price.change24h,
          change24hValue: price.change24hValue,
          volume24h: price.volume24h,
          high24h: price.high24h,
          low24h: price.low24h,
          marketCap: price.price * (price.volume24h / price.price || 0),
        };
        
        // Calcul des indicateurs
        const technicals = calculateTechnicals(baseCrypto);
        baseCrypto.technicals = technicals;
        baseCrypto.volatility = technicals.volatility;
        
        // Calcul du score
        baseCrypto.score = calculateScore(baseCrypto, technicals);
        
        // Analyse IA
        baseCrypto.aiAnalysis = generateAIAnalysis(baseCrypto, technicals);
        
        cryptoArray.push(baseCrypto);
      }
    });
    
    setAllCryptos(cryptoArray);
    setLastUpdate(new Date());
  }, [prices, calculateTechnicals, calculateScore, generateAIAnalysis]);

  // Filtres avancés avec filtres dynamiques
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
    
    // Mode filter
    if (filterMode === 'gainers') {
      filtered = filtered.filter(c => c.change24h > filters.minChange);
    } else if (filterMode === 'losers') {
      filtered = filtered.filter(c => c.change24h < 0 && c.change24h >= filters.maxChange);
    } else if (filterMode === 'breakouts') {
      filtered = filtered.filter(c => 
        c.technicals?.volatility && c.technicals.volatility > 10 && 
        Math.abs(c.change24h) > 5
      );
    } else if (filterMode === 'favorites') {
      filtered = filtered.filter(c => favorites.includes(c.symbol));
    }
    
    // Advanced filters
    filtered = filtered.filter(c => {
      const meetsVolume = c.volume24h >= filters.minVolume * 1e6;
      const meetsVolatility = c.technicals?.volatility !== undefined && 
        c.technicals.volatility <= filters.maxVolatility;
      return meetsVolume && meetsVolatility;
    });
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'score': return (b.score || 0) - (a.score || 0);
        case 'volume': return b.volume24h - a.volume24h;
        case 'change': return b.change24h - a.change24h;
        case 'price': return b.price - a.price;
        case 'volatility': return (b.technicals?.volatility || 0) - (a.technicals?.volatility || 0);
        default: return 0;
      }
    });
    
    return filtered;
  }, [allCryptos, searchQuery, sortBy, filterMode, favorites, filters]);

  // Pagination
  const paginatedCryptos = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCryptos.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCryptos, currentPage]);

  const totalPages = Math.ceil(filteredCryptos.length / itemsPerPage);

  // Actions
  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => {
      const isFav = prev.includes(symbol);
      if (isFav) {
        showToast.success('Retiré des favoris', 'Info');
        return prev.filter(s => s !== symbol);
      } else {
        showToast.success('Ajouté aux favoris', 'Succès');
        return [...prev, symbol];
      }
    });
  };

  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const selectCrypto = (symbol: string) => {
    setSelectedSymbol(symbol);
    setView('dashboard');
  };

  const openTrading = (symbol: string) => {
    setSelectedSymbol(symbol);
    // Navigation vers trading via le dashboard
    showToast.success(`Trading prêt pour ${symbol.replace('USDT', '')}`, 'Trading');
  };

  const openAnalysis = (symbol: string) => {
    setSelectedSymbol(symbol);
    // Navigation vers analyse
  };

  const createAlert = (crypto: CryptoData) => {
    // Sauvegarder l'alerte dans le localStorage pour le composant Alerts
    const existingAlerts = JSON.parse(localStorage.getItem('trading_alerts') || '[]');
    const newAlert = {
      id: Date.now().toString(),
      symbol: crypto.symbol,
      type: 'price',
      condition: 'above',
      value: crypto.price * 1.05,
      message: `Alerte scanner: ${crypto.symbol.replace('USDT', '')} à +5%`,
      active: true,
      status: 'active',
      createdAt: Date.now(),
      triggeredCount: 0,
      channels: ['in_app', 'push'],
      cooldown: 60,
      priority: 'medium',
    };
    localStorage.setItem('trading_alerts', JSON.stringify([...existingAlerts, newAlert]));
    showToast.success(`Alerte créée pour ${crypto.symbol.replace('USDT', '')}`, 'Alertes');
  };

  const showCryptoDetails = (crypto: CryptoData) => {
    setSelectedCrypto(crypto);
    setShowDetailsModal(true);
  };

  const refreshData = () => {
    setLoading(true);
    setTimeout(() => {
      setLastUpdate(new Date());
      setLoading(false);
      showToast.success('Données actualisées', 'Succès');
    }, 1000);
  };

  // Top sections avec scoring
  const topGainers = useMemo(() => {
    return [...allCryptos]
      .filter(c => c.change24h > 5)
      .sort((a, b) => b.change24h - a.change24h)
      .slice(0, 5);
  }, [allCryptos]);

  const topLosers = useMemo(() => {
    return [...allCryptos]
      .filter(c => c.change24h < -5)
      .sort((a, b) => a.change24h - b.change24h)
      .slice(0, 5);
  }, [allCryptos]);

  const topVolume = useMemo(() => {
    return [...allCryptos]
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 5);
  }, [allCryptos]);

  const topBreakouts = useMemo(() => {
    return [...allCryptos]
      .filter(c => c.technicals?.volatility && c.technicals.volatility > 10)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);
  }, [allCryptos]);

  const bestOpportunities = useMemo(() => {
    return [...allCryptos]
      .filter(c => (c.score || 0) > 70)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);
  }, [allCryptos]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-crypto-blue" />
          Scanner Crypto
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Détection intelligente des meilleures opportunités
          </p>
        </div>
        <div className="flex items-center gap-3">
          {wsConnected && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live
            </span>
          )}
          <span className="text-xs text-gray-400">
            Mis à jour: {lastUpdate.toLocaleTimeString()}
          </span>
          <button
            onClick={refreshData}
            disabled={loading}
            className="p-2 bg-crypto-dark hover:bg-crypto-gray rounded-lg transition-colors"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Lists - 4 colonnes avec Best Opportunities */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Best Opportunities */}
        <div className="crypto-card border-crypto-blue/30">
          <h3 className="text-sm font-semibold text-crypto-blue mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Meilleures Opportunités
          </h3>
          <div className="space-y-2">
            {bestOpportunities.length > 0 ? bestOpportunities.map(crypto => (
              <div 
                key={crypto.symbol}
                onClick={() => showCryptoDetails(crypto)}
                className="flex items-center justify-between p-2 hover:bg-crypto-dark/50 rounded cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{crypto.symbol.replace('USDT', '')}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-crypto-blue/20 rounded">{crypto.score}/100</span>
                </div>
                <span className={crypto.change24h >= 0 ? 'text-crypto-green' : 'text-crypto-red'}>
                  {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(1)}%
                </span>
              </div>
            )) : (
              <p className="text-xs text-gray-500">Aucune opportunité majeure détectée</p>
            )}
          </div>
        </div>

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
                onClick={() => showCryptoDetails(crypto)}
                className="flex items-center justify-between p-2 hover:bg-crypto-dark/50 rounded cursor-pointer"
              >
                <span className="font-medium">{crypto.symbol.replace('USDT', '')}</span>
                <span className="text-crypto-green font-mono">+{crypto.change24h.toFixed(1)}%</span>
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
                onClick={() => showCryptoDetails(crypto)}
                className="flex items-center justify-between p-2 hover:bg-crypto-dark/50 rounded cursor-pointer"
              >
                <span className="font-medium">{crypto.symbol.replace('USDT', '')}</span>
                <span className="text-crypto-red font-mono">{crypto.change24h.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Breakouts */}
        <div className="crypto-card">
          <h3 className="text-sm font-semibold text-crypto-purple mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Breakouts
          </h3>
          <div className="space-y-2">
            {topBreakouts.map(crypto => (
              <div 
                key={crypto.symbol}
                onClick={() => showCryptoDetails(crypto)}
                className="flex items-center justify-between p-2 hover:bg-crypto-dark/50 rounded cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{crypto.symbol.replace('USDT', '')}</span>
                  <span className="text-xs text-gray-400">{crypto.technicals?.volatility?.toFixed(1)}%</span>
                </div>
                <span className={crypto.change24h >= 0 ? 'text-crypto-green' : 'text-crypto-red'}>
                  {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(1)}%
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
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
          >
            <option value="score">Score IA</option>
            <option value="volume">Volume 24h</option>
            <option value="change">Variation 24h</option>
            <option value="price">Prix</option>
            <option value="volatility">Volatilité</option>
          </select>

          <div className="flex bg-crypto-dark rounded-lg p-1">
            {(['all', 'gainers', 'losers', 'breakouts', 'favorites'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setFilterMode(filter)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  filterMode === filter
                    ? 'bg-crypto-blue text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {filter === 'all' ? 'Tous' : 
                 filter === 'gainers' ? 'Gagnants' : 
                 filter === 'losers' ? 'Perdants' :
                 filter === 'breakouts' ? 'Breakouts' : 'Favoris'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              showFilters
                ? 'bg-crypto-blue text-white'
                : 'bg-crypto-dark text-gray-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtres
          </button>
        </div>

        {/* Filtres avancés */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-crypto-border/50 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Variation min (%)</label>
              <input
                type="number"
                value={filters.minChange}
                onChange={(e) => setFilters({...filters, minChange: Number(e.target.value)})}
                className="w-full bg-crypto-dark border border-crypto-border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Volume min (millions)</label>
              <input
                type="number"
                value={filters.minVolume}
                onChange={(e) => setFilters({...filters, minVolume: Number(e.target.value)})}
                className="w-full bg-crypto-dark border border-crypto-border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Volatilité max (%)</label>
              <input
                type="number"
                value={filters.maxVolatility}
                onChange={(e) => setFilters({...filters, maxVolatility: Number(e.target.value)})}
                className="w-full bg-crypto-dark border border-crypto-border rounded px-2 py-1 text-sm"
              />
            </div>
          </div>
        )}
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
              <tr className="text-left text-xs text-gray-400 border-b border-crypto-border">
                <th className="pb-3 pl-2">Score</th>
                <th className="pb-3">Crypto</th>
                <th className="pb-3">Signal IA</th>
                <th className="pb-3">Prix</th>
                <th className="pb-3">Variation</th>
                <th className="pb-3">Volume</th>
                <th className="pb-3">RSI</th>
                <th className="pb-3">Trend</th>
                <th className="pb-3 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {paginatedCryptos.map((crypto) => (
                <tr 
                  key={crypto.symbol}
                  className="border-b border-crypto-border/50 hover:bg-crypto-dark/30"
                >
                  {/* Score */}
                  <td className="py-3 pl-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                          (crypto.score || 0) >= 80 ? 'bg-green-500/20 text-green-400' :
                          (crypto.score || 0) >= 60 ? 'bg-blue-500/20 text-blue-400' :
                          (crypto.score || 0) >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {crypto.score || 0}
                      </div>
                    </div>
                  </td>
                  
                  {/* Crypto name */}
                  <td className="py-3">
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
                      <div>
                        <span className="font-semibold">{crypto.symbol.replace('USDT', '')}</span>
                        <span className="text-gray-400 text-xs ml-1">/USDT</span>
                        {crypto.aiAnalysis?.signal !== 'NEUTRAL' && (
                          <div className="text-xs">
                            <span className={crypto.aiAnalysis?.signal === 'LONG' ? 'text-green-400' : 'text-red-400'}>
                              {crypto.aiAnalysis?.signal} ({crypto.aiAnalysis?.confidence}%)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  {/* Signal IA */}
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <Brain className={`w-4 h-4 ${
                        crypto.aiAnalysis?.signal === 'LONG' ? 'text-green-400' :
                        crypto.aiAnalysis?.signal === 'SHORT' ? 'text-red-400' : 'text-gray-400'
                      }`} />
                      <span className={`text-xs ${
                        crypto.aiAnalysis?.signal === 'LONG' ? 'text-green-400' :
                        crypto.aiAnalysis?.signal === 'SHORT' ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {crypto.aiAnalysis?.signal}
                      </span>
                    </div>
                  </td>
                  
                  {/* Price */}
                  <td className="py-3">
                    <div className="font-mono">${crypto.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
                    <div className="text-xs text-gray-400">
                      {formatXOF(crypto.price)}
                    </div>
                  </td>
                  
                  {/* Change */}
                  <td className="py-3">
                    <span className={`font-mono ${crypto.change24h >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                      {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(1)}%
                    </span>
                    <div className="text-xs text-gray-500">
                      {crypto.technicals?.volatility?.toFixed(1)}% vol
                    </div>
                  </td>
                  
                  {/* Volume */}
                  <td className="py-3">
                    <div className="font-mono">${(crypto.volume24h / 1e6).toFixed(1)}M</div>
                  </td>
                  
                  {/* RSI */}
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            (crypto.technicals?.rsi || 50) > 70 ? 'bg-red-400' :
                            (crypto.technicals?.rsi || 50) < 30 ? 'bg-green-400' : 'bg-blue-400'
                          }`}
                          style={{ width: `${crypto.technicals?.rsi || 50}%` }}
                        />
                      </div>
                      <span className="text-xs">{crypto.technicals?.rsi?.toFixed(0)}</span>
                    </div>
                  </td>
                  
                  {/* Trend */}
                  <td className="py-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      crypto.technicals?.trend === 'bullish' ? 'bg-green-500/20 text-green-400' :
                      crypto.technicals?.trend === 'bearish' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {crypto.technicals?.trend === 'bullish' ? 'Haussier' :
                       crypto.technicals?.trend === 'bearish' ? 'Baissier' : 'Neutre'}
                    </span>
                  </td>
                  
                  {/* Actions */}
                  <td className="py-3 pr-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => showCryptoDetails(crypto)}
                        className="p-1.5 bg-crypto-dark hover:bg-crypto-gray rounded transition-colors"
                        title="Détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openTrading(crypto.symbol)}
                        className="p-1.5 bg-crypto-blue/20 hover:bg-crypto-blue/30 text-crypto-blue rounded transition-colors"
                        title="Trading"
                      >
                        <LineChart className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => createAlert(crypto)}
                        className="p-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded transition-colors"
                        title="Alerte"
                      >
                        <Bell className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-crypto-border/50">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-crypto-dark rounded hover:bg-crypto-gray disabled:opacity-50"
            >
              Précédent
            </button>
            <span className="text-sm text-gray-400">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-crypto-dark rounded hover:bg-crypto-gray disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        )}

        {filteredCryptos.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucune crypto trouvée</p>
          </div>
        )}
      </div>

      {/* Modal détails crypto */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={selectedCrypto ? selectedCrypto.symbol.replace('USDT', '') + ' / USDT' : ''}
        size="lg"
      >
        {selectedCrypto && (
          <div className="space-y-6">
            {/* Score et Signal IA */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-crypto-dark rounded-lg p-4 text-center">
                <div className="text-sm text-gray-400 mb-1">Score Global</div>
                <div className={`text-3xl font-bold ${
                  (selectedCrypto.score || 0) >= 80 ? 'text-green-400' :
                  (selectedCrypto.score || 0) >= 60 ? 'text-blue-400' :
                  (selectedCrypto.score || 0) >= 40 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {selectedCrypto.score}/100
                </div>
              </div>
              <div className="bg-crypto-dark rounded-lg p-4 text-center">
                <div className="text-sm text-gray-400 mb-1">Signal IA</div>
                <div className={`text-2xl font-bold ${
                  selectedCrypto.aiAnalysis?.signal === 'LONG' ? 'text-green-400' :
                  selectedCrypto.aiAnalysis?.signal === 'SHORT' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {selectedCrypto.aiAnalysis?.signal}
                </div>
                <div className="text-xs text-gray-500">
                  Confiance: {selectedCrypto.aiAnalysis?.confidence}%
                </div>
              </div>
            </div>

            {/* Analyse IA */}
            <div className="bg-crypto-dark/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-crypto-purple" />
                <span className="text-sm font-semibold">Analyse IA</span>
              </div>
              <p className="text-sm text-gray-300">
                {selectedCrypto.aiAnalysis?.reason}
              </p>
            </div>

            {/* Prix et variation */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-400">Prix actuel</div>
                <div className="text-xl font-mono">${selectedCrypto.price.toLocaleString()}</div>
                <div className="text-sm text-gray-400">{formatXOF(selectedCrypto.price)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Variation 24h</div>
                <div className={`text-xl font-mono ${selectedCrypto.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {selectedCrypto.change24h >= 0 ? '+' : ''}{selectedCrypto.change24h.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Indicateurs techniques */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Indicateurs techniques</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-crypto-dark rounded-lg p-3">
                  <div className="text-xs text-gray-400">RSI</div>
                  <div className="text-lg font-mono">{selectedCrypto.technicals?.rsi.toFixed(1)}</div>
                  <div className="text-xs text-gray-500">
                    {(selectedCrypto.technicals?.rsi || 50) > 70 ? 'Surachat' :
                     (selectedCrypto.technicals?.rsi || 50) < 30 ? 'Survente' : 'Neutre'}
                  </div>
                </div>
                <div className="bg-crypto-dark rounded-lg p-3">
                  <div className="text-xs text-gray-400">Volatilité</div>
                  <div className="text-lg font-mono">{selectedCrypto.technicals?.volatility.toFixed(1)}%</div>
                </div>
                <div className="bg-crypto-dark rounded-lg p-3">
                  <div className="text-xs text-gray-400">Support</div>
                  <div className="text-lg font-mono">${selectedCrypto.technicals?.support.toFixed(2)}</div>
                </div>
                <div className="bg-crypto-dark rounded-lg p-3">
                  <div className="text-xs text-gray-400">Résistance</div>
                  <div className="text-lg font-mono">${selectedCrypto.technicals?.resistance.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Volume et range */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-crypto-dark rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400">Volume 24h</div>
                <div className="font-mono">${(selectedCrypto.volume24h / 1e6).toFixed(2)}M</div>
              </div>
              <div className="bg-crypto-dark rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400">High 24h</div>
                <div className="font-mono text-green-400">${selectedCrypto.high24h.toLocaleString()}</div>
              </div>
              <div className="bg-crypto-dark rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400">Low 24h</div>
                <div className="font-mono text-red-400">${selectedCrypto.low24h.toLocaleString()}</div>
              </div>
            </div>

            {/* Actions rapides */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  openTrading(selectedCrypto.symbol);
                  setShowDetailsModal(false);
                }}
                className="flex-1 py-2 bg-crypto-blue text-white rounded-lg hover:bg-crypto-blue/80 transition-colors"
              >
                <LineChart className="w-4 h-4 inline mr-2" />
                Trading
              </button>
              <button
                onClick={() => {
                  createAlert(selectedCrypto);
                  setShowDetailsModal(false);
                }}
                className="flex-1 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
              >
                <Bell className="w-4 h-4 inline mr-2" />
                Créer Alerte
              </button>
              <button
                onClick={() => {
                  toggleFavorite(selectedCrypto.symbol);
                }}
                className={`flex-1 py-2 rounded-lg transition-colors ${
                  favorites.includes(selectedCrypto.symbol)
                    ? 'bg-crypto-accent text-white'
                    : 'bg-crypto-dark text-gray-400 hover:text-white'
                }`}
              >
                <Star className={`w-4 h-4 inline mr-2 ${favorites.includes(selectedCrypto.symbol) ? 'fill-current' : ''}`} />
                {favorites.includes(selectedCrypto.symbol) ? 'Retirer' : 'Favori'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
