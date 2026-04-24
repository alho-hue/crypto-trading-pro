import { useState, useEffect, useCallback } from 'react';
import { Newspaper, Filter, RefreshCw, ExternalLink, TrendingUp, TrendingDown, AlertCircle, Bitcoin, Globe, Shield, DollarSign, Loader2 } from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';
import { showToast } from '../stores/toastStore';

// Types pour les news
interface CryptoNewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category: 'bitcoin' | 'ethereum' | 'altcoin' | 'regulation' | 'market' | 'technology' | 'general';
  sentiment: 'positive' | 'negative' | 'neutral';
  imageUrl?: string;
  currencies?: string[];
}

type NewsFilter = 'all' | 'bitcoin' | 'ethereum' | 'altcoin' | 'regulation' | 'market' | 'technology';

// Détecter si on est en local ou production
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocalhost 
  ? 'http://localhost:5000' 
  : (import.meta.env.VITE_API_URL || 'https://crypto-trading-pro.onrender.com');

// Fallback: News mock data si l'API rate limit
const generateMockNews = (): CryptoNewsItem[] => [
  {
    id: '1',
    title: 'Bitcoin dépasse les $100,000 - Nouveau record historique',
    description: 'Le Bitcoin a atteint un nouveau sommet historique dépassant les $100,000 pour la première fois...',
    url: '#',
    source: 'CoinDesk',
    publishedAt: new Date(Date.now() - 5 * 60000).toISOString(),
    category: 'bitcoin',
    sentiment: 'positive',
    currencies: ['BTC']
  },
  {
    id: '2',
    title: 'Ethereum 2.0: La mise à jour Shanghai confirmée pour mars',
    description: 'Les développeurs Ethereum ont confirmé la date de la mise à jour Shanghai...',
    url: '#',
    source: 'The Block',
    publishedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    category: 'ethereum',
    sentiment: 'positive',
    currencies: ['ETH']
  },
  {
    id: '3',
    title: 'La SEC enquête sur les exchanges décentralisés',
    description: 'La Securities and Exchange Commission américaine intensifie ses enquêtes...',
    url: '#',
    source: 'Reuters',
    publishedAt: new Date(Date.now() - 30 * 60000).toISOString(),
    category: 'regulation',
    sentiment: 'negative',
    currencies: ['GENERAL']
  },
  {
    id: '4',
    title: 'Solana atteint 65,000 transactions par seconde',
    description: 'Le réseau Solana continue de montrer sa supériorité en termes de scalabilité...',
    url: '#',
    source: 'CoinTelegraph',
    publishedAt: new Date(Date.now() - 45 * 60000).toISOString(),
    category: 'altcoin',
    sentiment: 'positive',
    currencies: ['SOL']
  },
  {
    id: '5',
    title: 'Le marché crypto perd $200M en liquidations',
    description: 'Une volatilité accrue a entraîné des liquidations massives sur les marchés...',
    url: '#',
    source: 'CryptoSlate',
    publishedAt: new Date(Date.now() - 60 * 60000).toISOString(),
    category: 'market',
    sentiment: 'negative',
    currencies: ['BTC', 'ETH']
  }
];

export default function CryptoNews() {
  const setView = useCryptoStore(state => state.setView);
  
  const [news, setNews] = useState<CryptoNewsItem[]>([]);
  const [filteredNews, setFilteredNews] = useState<CryptoNewsItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<NewsFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(false);
  
  // Sauvegarder les news dans localStorage pour NewsDetail
  useEffect(() => {
    if (news.length > 0) {
      localStorage.setItem('cryptoNewsCache', JSON.stringify(news));
    }
  }, [news]);

  // Catégories avec icônes et couleurs
  const categories = [
    { id: 'all', label: 'Toutes', icon: Globe, color: 'blue' },
    { id: 'bitcoin', label: 'Bitcoin', icon: Bitcoin, color: 'orange' },
    { id: 'ethereum', label: 'Ethereum', icon: DollarSign, color: 'purple' },
    { id: 'altcoin', label: 'Altcoins', icon: TrendingUp, color: 'green' },
    { id: 'regulation', label: 'Régulation', icon: Shield, color: 'red' },
    { id: 'market', label: 'Marché', icon: TrendingDown, color: 'yellow' },
    { id: 'technology', label: 'Technologie', icon: AlertCircle, color: 'cyan' }
  ] as const;

  // Fonction pour classer le sentiment d'une news
  const classifySentiment = (title: string, description: string): 'positive' | 'negative' | 'neutral' => {
    const text = (title + ' ' + description).toLowerCase();
    const positiveWords = ['surge', 'pump', 'bull', 'gain', 'record', 'high', 'breakthrough', 'adoption', 'partnership', 'launch', 'success', 'rise', 'up', 'growth', 'dépass', 'record', 'hausse', 'gagn', 'positif', 'optimiste'];
    const negativeWords = ['crash', 'dump', 'bear', 'loss', 'hack', 'scam', 'ban', 'regulation', 'fall', 'down', 'drop', 'liquidation', 'fear', 'panic', 'baisse', 'perte', 'chute', 'négatif', 'inquiétude'];
    
    const positiveCount = positiveWords.filter(w => text.includes(w)).length;
    const negativeCount = negativeWords.filter(w => text.includes(w)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  };

  // Fonction pour classer la catégorie
  const classifyCategory = (title: string, currencies?: string[]): CryptoNewsItem['category'] => {
    const text = title.toLowerCase();
    
    if (text.includes('bitcoin') || text.includes('btc') || currencies?.includes('BTC')) return 'bitcoin';
    if (text.includes('ethereum') || text.includes('eth') || currencies?.includes('ETH')) return 'ethereum';
    if (text.includes('regulation') || text.includes('sec') || text.includes('law') || text.includes('ban') || text.includes('régulation') || text.includes('interdit')) return 'regulation';
    if (text.includes('market') || text.includes('market') || text.includes('liquidation') || text.includes('marché') || text.includes('volatilité')) return 'market';
    if (text.includes('technology') || text.includes('upgrade') || text.includes('fork') || text.includes('technologie') || text.includes('mise à jour')) return 'technology';
    if (currencies && currencies.length > 0 && !currencies.includes('BTC') && !currencies.includes('ETH')) return 'altcoin';
    
    return 'general';
  };

  // Charger les news depuis le backend (proxy pour éviter CORS)
  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Utiliser le backend comme proxy pour éviter CORS
      const response = await fetch(`${API_BASE_URL}/api/news?limit=50&filter=${activeFilter}`, {
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && Array.isArray(data.news)) {
        const formattedNews: CryptoNewsItem[] = data.news.map((item: any) => ({
          id: item.id.toString(),
          title: item.title,
          description: item.description || item.title,
          url: item.url,
          source: item.source || 'Crypto News',
          publishedAt: item.publishedAt || item.published_at,
          category: item.category || classifyCategory(item.title, item.currencies),
          sentiment: item.sentiment || classifySentiment(item.title, item.description || ''),
          currencies: item.currencies || []
        }));
        
        setNews(formattedNews);
        setUseMockData(data.source === 'fallback' || data.source === 'fallback-error');
        setLastUpdate(new Date());
        
        if (data.source === 'fallback' || data.source === 'fallback-error') {
          setError('Mode démo - API news temporairement indisponible');
        }
      } else {
        throw new Error('Invalid API response');
      }
    } catch (err) {
      console.warn('[CryptoNews] API failed, using mock data:', err);
      // Fallback sur les données mock
      const mockData = generateMockNews();
      setNews(mockData);
      setUseMockData(true);
      setLastUpdate(new Date());
      setError('API limit reached - Using demo data');
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter]);

  // Filtrer les news
  useEffect(() => {
    if (activeFilter === 'all') {
      setFilteredNews(news);
    } else {
      setFilteredNews(news.filter(item => item.category === activeFilter));
    }
  }, [news, activeFilter]);

  // Auto-refresh toutes les 2 minutes
  useEffect(() => {
    fetchNews(); // Chargement initial
    
    const interval = setInterval(() => {
      fetchNews();
    }, 2 * 60 * 1000); // 2 minutes
    
    return () => clearInterval(interval);
  }, [fetchNews]);

  // Format date relative
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}j`;
  };

  return (
    <div className="bg-crypto-card rounded-xl border border-crypto-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-crypto-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 
                          flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Actualités Crypto</h3>
            <p className="text-xs text-gray-400">
              {useMockData ? 'Mode démo' : 'Temps réel'} • 
              Dernière mise à jour: {formatRelativeTime(lastUpdate.toISOString())}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={fetchNews}
            disabled={isLoading}
            className="p-2 rounded-lg bg-crypto-dark hover:bg-crypto-border transition-colors
                       disabled:opacity-50"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="p-3 border-b border-crypto-border">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeFilter === cat.id;
            
            return (
              <button
                key={cat.id}
                onClick={() => setActiveFilter(cat.id as NewsFilter)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                           whitespace-nowrap transition-all
                           ${isActive 
                             ? `bg-${cat.color}-500/20 text-${cat.color}-400 border border-${cat.color}-500/30` 
                             : 'bg-crypto-dark text-gray-400 hover:text-white border border-transparent'
                           }`}
                style={{
                  backgroundColor: isActive 
                    ? cat.id === 'bitcoin' ? 'rgba(249, 115, 22, 0.2)' 
                    : cat.id === 'ethereum' ? 'rgba(168, 85, 247, 0.2)'
                    : cat.id === 'altcoin' ? 'rgba(34, 197, 94, 0.2)'
                    : cat.id === 'regulation' ? 'rgba(239, 68, 68, 0.2)'
                    : cat.id === 'market' ? 'rgba(234, 179, 8, 0.2)'
                    : cat.id === 'technology' ? 'rgba(6, 182, 212, 0.2)'
                    : 'rgba(59, 130, 246, 0.2)'
                    : undefined,
                  color: isActive
                    ? cat.id === 'bitcoin' ? '#fb923c'
                    : cat.id === 'ethereum' ? '#c084fc'
                    : cat.id === 'altcoin' ? '#4ade80'
                    : cat.id === 'regulation' ? '#f87171'
                    : cat.id === 'market' ? '#facc15'
                    : cat.id === 'technology' ? '#22d3ee'
                    : '#60a5fa'
                    : undefined,
                  borderColor: isActive
                    ? cat.id === 'bitcoin' ? 'rgba(249, 115, 22, 0.3)'
                    : cat.id === 'ethereum' ? 'rgba(168, 85, 247, 0.3)'
                    : cat.id === 'altcoin' ? 'rgba(34, 197, 94, 0.3)'
                    : cat.id === 'regulation' ? 'rgba(239, 68, 68, 0.3)'
                    : cat.id === 'market' ? 'rgba(234, 179, 8, 0.3)'
                    : cat.id === 'technology' ? 'rgba(6, 182, 212, 0.3)'
                    : 'rgba(59, 130, 246, 0.3)'
                    : 'transparent'
                }}
              >
                <Icon className="w-3 h-3" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste des news - Scroll fluide avec scrollbar cachée */}
      <div className="max-h-[500px] md:max-h-[600px] lg:max-h-[700px] overflow-y-auto scrollbar-thin scroll-smooth touch-scroll
                      hover:scrollbar-thin">
        {isLoading && news.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
            <p className="text-gray-400 text-sm">Chargement des actualités...</p>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Newspaper className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Aucune actualité dans cette catégorie</p>
          </div>
        ) : (
          <div className="divide-y divide-crypto-border">
            {filteredNews.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setView('newsDetail', { newsId: item.id })}
                className="block w-full text-left p-3 sm:p-4 hover:bg-crypto-dark/50 transition-all duration-200 group 
                           active:scale-[0.98] animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  {/* Sentiment indicator - plus petit sur mobile */}
                  <div className={`w-0.5 sm:w-1 h-10 sm:h-12 rounded-full flex-shrink-0 ${
                    item.sentiment === 'positive' ? 'bg-green-500' :
                    item.sentiment === 'negative' ? 'bg-red-500' : 'bg-gray-500'
                  }`} />
                  
                  <div className="flex-1 min-w-0">
                    {/* Title - responsive */}
                    <h4 className="font-medium text-white text-xs sm:text-sm leading-tight mb-1 
                                   group-hover:text-blue-400 transition-colors line-clamp-2">
                      {item.title}
                    </h4>
                    
                    {/* Meta - responsive et scrollable si trop long */}
                    <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-gray-500 
                                    overflow-x-auto scrollbar-hide">
                      <span className="font-medium text-gray-400 truncate max-w-[100px] sm:max-w-[150px]">{item.source}</span>
                      <span>•</span>
                      <span>{formatRelativeTime(item.publishedAt)}</span>
                      
                      {/* Currencies tags */}
                      {item.currencies && item.currencies.length > 0 && (
                        <>
                          <span>•</span>
                          <div className="flex gap-1">
                            {item.currencies.slice(0, 3).map(c => (
                              <span key={c} className="px-1.5 py-0.5 bg-crypto-border rounded text-[10px]">
                                {c}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Category badge */}
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium
                                      ${item.category === 'bitcoin' ? 'bg-orange-500/10 text-orange-400' :
                                        item.category === 'ethereum' ? 'bg-purple-500/10 text-purple-400' :
                                        item.category === 'altcoin' ? 'bg-green-500/10 text-green-400' :
                                        item.category === 'regulation' ? 'bg-red-500/10 text-red-400' :
                                        item.category === 'market' ? 'bg-yellow-500/10 text-yellow-400' :
                                        item.category === 'technology' ? 'bg-cyan-500/10 text-cyan-400' :
                                        'bg-gray-500/10 text-gray-400'}`}>
                        {categories.find(c => c.id === item.category)?.label || 'General'}
                      </span>
                      
                      {/* Sentiment badge */}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ml-2
                                      ${item.sentiment === 'positive' ? 'bg-green-500/10 text-green-400' :
                                        item.sentiment === 'negative' ? 'bg-red-500/10 text-red-400' :
                                        'bg-gray-500/10 text-gray-400'}`}>
                        {item.sentiment === 'positive' ? '✓ Positif' :
                         item.sentiment === 'negative' ? '✗ Négatif' : '○ Neutre'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Arrow icon */}
                  <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 
                                  transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
        
        {/* Load more indicator */}
        {filteredNews.length > 0 && (
          <div className="p-3 text-center border-t border-crypto-border">
            <p className="text-xs text-gray-500">
              {filteredNews.length} actualités • Mise à jour auto toutes les 2 minutes
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
