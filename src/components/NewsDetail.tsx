import { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink, Calendar, User, Tag, Loader2, AlertCircle, Share2, Clock } from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';
import { showToast } from '../stores/toastStore';

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  description: string;
  url: string;
  source: string;
  author?: string;
  publishedAt: string;
  imageUrl?: string;
  category: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  currencies?: string[];
  readingTime?: number;
}

// Mock détaillé pour fallback
const generateDetailedArticle = (id: string, title: string, source: string): NewsArticle => ({
  id,
  title,
  description: 'Analyse détaillée de cette actualité crypto majeure...',
  content: `
    <h2>Contexte du Marché</h2>
    <p>Cette actualité intervient dans un contexte de volatilité accrue sur les marchés crypto. 
    Les investisseurs surveillent attentivement les mouvements de prix et les annonces majeures 
    qui pourraient influencer la direction du marché dans les prochains jours.</p>
    
    <h2>Analyse Technique</h2>
    <p>Du point de vue technique, les indicateurs montrent une tendance qui pourrait se confirmer 
    si les niveaux de support actuels tiennent. Les volumes d'échange ont augmenté significativement, 
    ce qui indique un fort intérêt des traders institutionnels et retail.</p>
    
    <h2>Impact Potentiel</h2>
    <p>Cette nouvelle pourrait avoir plusieurs conséquences :
    <ul>
      <li>Variation des prix à court terme</li>
      <li>Changement de sentiment du marché</li>
      <li>Réactions des régulateurs</li>
      <li>Mouvements des baleines (whales)</li>
    </ul>
    </p>
    
    <h2>Conclusion</h2>
    <p>Il est recommandé de surveiller de près l'évolution de cette situation et d'ajuster 
    vos positions en conséquence. Restez informé via NEUROVEST pour les dernières mises à jour.</p>
  `,
  url: '#',
  source,
  author: 'Équipe NEUROVEST',
  publishedAt: new Date().toISOString(),
  imageUrl: `https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=1200&h=600&fit=crop`,
  category: 'general',
  sentiment: 'neutral',
  currencies: ['BTC', 'ETH'],
  readingTime: 3
});

export default function NewsDetail() {
  const selectedNewsId = useCryptoStore(state => state.selectedNewsId);
  const setView = useCryptoStore(state => state.setView);
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedNewsId) {
      setError('ID de l\'article manquant');
      setIsLoading(false);
      return;
    }

    loadArticle(selectedNewsId);
  }, [selectedNewsId]);

  const loadArticle = async (articleId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Essayer de récupérer depuis localStorage d'abord (si stocké depuis CryptoNews)
      const cachedNews = localStorage.getItem('cryptoNewsCache');
      if (cachedNews) {
        const news = JSON.parse(cachedNews);
        const found = news.find((n: any) => n.id === articleId);
        if (found) {
          // Enrichir avec du contenu détaillé
          const detailed = await enrichArticleContent(found);
          setArticle(detailed);
          setIsLoading(false);
          return;
        }
      }

      // Fallback: générer un article de démo
      const demoArticle = generateDetailedArticle(
        articleId, 
        'Actualité Crypto Importante', 
        'Crypto News'
      );
      setArticle(demoArticle);

    } catch (err) {
      console.error('Error loading article:', err);
      setError('Erreur lors du chargement de l\'article');
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour enrichir le contenu (simulation d'API ou scraping)
  const enrichArticleContent = async (basicArticle: any): Promise<NewsArticle> => {
    // Ici tu pourrais appeler une API de scraping ou une IA pour générer du contenu
    // Pour l'instant, on enrichit avec des données réalistes
    
    return {
      ...basicArticle,
      content: generateRichContent(basicArticle.title, basicArticle.category),
      readingTime: Math.ceil(basicArticle.description?.length / 1000) || 3,
      imageUrl: getCategoryImage(basicArticle.category),
      author: basicArticle.source || 'Journaliste Crypto'
    };
  };

  const generateRichContent = (title: string, category: string): string => {
    const contents: Record<string, string> = {
      bitcoin: `
        <h2>Bitcoin : Une Évolution Majeure</h2>
        <p>Le Bitcoin, première et plus importante cryptomonnaie, continue de captiver l'attention des investisseurs institutionnels et particuliers du monde entier.</p>
        
        <h3>Situation Actuelle du Marché</h3>
        <p>Les récents mouvements de prix du Bitcoin reflètent une consolidation du marché. Les analystes techniques observent des niveaux de support solides autour des zones clés de résistance.</p>
        
        <h3>Facteurs Clés à Surveiller</h3>
        <ul>
          <li><strong>Adoption Institutionnelle :</strong> Les grandes entreprises continuent d'ajouter BTC à leurs trésoreries.</li>
          <li><strong>Régulation :</strong> Les cadres réglementaires évoluent dans plusieurs juridictions majeures.</li>
          <li><strong>Technologie :</strong> Les mises à niveau du réseau Lightning améliorent l'évolutivité.</li>
          <li><strong>Macro-économie :</strong> L'inflation et les politiques monétaires influencent le prix.</li>
        </ul>
        
        <h3>Perspectives</h3>
        <p>Les experts prévoient une volatilité continue mais avec une tendance haussière à long terme, soutenue par l'adoption croissante et la rareté programmée (halving).</p>
      `,
      ethereum: `
        <h2>Ethereum : L'Écosystème DeFi en Expansion</h2>
        <p>Ethereum reste la plateforme dominante pour les contrats intelligents et la finance décentralisée (DeFi).</p>
        
        <h3>Développements Réseau</h3>
        <p>La transition vers Ethereum 2.0 apporte des améliorations significatives en termes d'évolutivité et d'efficacité énergétique. Les rollups et solutions de couche 2 continuent de gagner en adoption.</p>
        
        <h3>Ecosystème DeFi et NFT</h3>
        <ul>
          <li><strong>TVL (Total Value Locked) :</strong> Plus de 50 milliards de dollars dans les protocoles DeFi.</li>
          <li><strong>NFTs :</strong> Le marché des tokens non fongibles reste actif malgré la correction.</li>
          <li><strong>DAO :</strong> Les organisations autonomes décentralisées se multiplient.</li>
        </ul>
      `,
      regulation: `
        <h2>Régulation Crypto : Un Cadre en Évolution</h2>
        <p>Les autorités réglementaires du monde entier travaillent à établir des cadres clairs pour l'industrie crypto.</p>
        
        <h3>Impact sur le Marché</h3>
        <p>Les annonces réglementaires peuvent créer de la volatilité à court terme mais apportent une légitimité à long terme au marché.</p>
        
        <h3>Régions Clés</h3>
        <ul>
          <li><strong>États-Unis (SEC) :</strong> Définition des classifications des actifs numériques.</li>
          <li><strong>Europe (MiCA) :</strong> Cadre harmonisé pour les crypto-actifs.</li>
          <li><strong>Asie :</strong> Approches variées entre interdiction et adoption.</li>
        </ul>
      `,
      market: `
        <h2>Analyse du Marché Crypto</h2>
        <p>Les marchés des cryptomonnaies montrent des signes de maturité avec une corrélation accrue avec les marchés traditionnels.</p>
        
        <h3>Tendances Actuelles</h3>
        <ul>
          <li>Corrélation avec les indices tech (NASDAQ)</li>
          <li>Volatilité en diminution progressive</li>
          <li>Participation institutionnelle croissante</li>
          <li>Innovation dans les produits dérivés</li>
        </ul>
        
        <h3>Indicateurs Techniques</h3>
        <p>Les volumes d'échange, la dominance de Bitcoin et le Fear & Greed Index sont des indicateurs clés à surveiller.</p>
      `,
      altcoin: `
        <h2>Altcoins : Diversification et Innovation</h2>
        <p>Au-delà de Bitcoin et Ethereum, l'écosystème altcoin continue d'innover dans divers secteurs.</p>
        
        <h3>Catégories Performantes</h3>
        <ul>
          <li><strong>Layer 1 :</strong> Solana, Avalanche, Polygon</li>
          <li><strong>DeFi :</strong> Uniswap, Aave, Compound</li>
          <li><strong>Gaming :</strong> Axie Infinity, The Sandbox</li>
          <li><strong>Infrastructure :</strong> Chainlink, Filecoin</li>
        </ul>
        
        <h3>Risques et Opportunités</h3>
        <p>Les altcoins offrent des rendements potentiels plus élevés mais avec une volatilité accrue.</p>
      `,
      technology: `
        <h2>Innovation Technologique Blockchain</h2>
        <p>La technologie blockchain continue d'évoluer avec des améliorations en scalabilité, sécurité et interopérabilité.</p>
        
        <h3>Avancées Clés</h3>
        <ul>
          <li><strong>Sharding :</strong> Amélioration de la capacité transactionnelle</li>
          <li><strong>ZK-Proofs :</strong> Confidentialité et scalabilité</li>
          <li><strong>Cross-chain :</strong> Interopérabilité entre blockchains</li>
          <li><strong>Smart Contracts 2.0 :</strong> Plus de fonctionnalités et sécurité</li>
        </ul>
      `
    };

    return contents[category] || contents.market;
  };

  const getCategoryImage = (category: string): string => {
    const images: Record<string, string> = {
      bitcoin: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=1200',
      ethereum: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1200',
      altcoin: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=1200',
      regulation: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=1200',
      market: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200',
      technology: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=1200'
    };
    return images[category] || images.bitcoin;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-crypto-dark flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Chargement de l'article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-crypto-dark flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Article non trouvé</h2>
          <p className="text-gray-400 mb-6">{error || 'Cet article n\'existe pas ou a été supprimé.'}</p>
          <button
            onClick={() => setView('dashboard')}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            Retour au Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-crypto-dark">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-crypto-card/95 backdrop-blur-md border-b border-crypto-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => setView('dashboard')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Retour</span>
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                showToast.success('Lien copié !', 'Partage');
              }}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Copier le lien"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 
                       text-blue-400 rounded-lg transition-colors text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Source
            </a>
          </div>
        </div>
      </header>

      {/* Article Content - Scroll fluide et responsive */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-y-auto scroll-smooth touch-scroll
                       max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-150px)]">
        {/* Category & Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium
            ${article.category === 'bitcoin' ? 'bg-orange-500/20 text-orange-400' :
              article.category === 'ethereum' ? 'bg-purple-500/20 text-purple-400' :
              article.category === 'altcoin' ? 'bg-green-500/20 text-green-400' :
              article.category === 'regulation' ? 'bg-red-500/20 text-red-400' :
              article.category === 'market' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-blue-500/20 text-blue-400'}`}>
            {article.category.toUpperCase()}
          </span>
          
          <span className={`px-3 py-1 rounded-full text-xs font-medium
            ${article.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
              article.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
              'bg-gray-500/20 text-gray-400'}`}>
            {article.sentiment === 'positive' ? '✓ Sentiment Positif' :
             article.sentiment === 'negative' ? '✗ Sentiment Négatif' : '○ Neutre'}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-6 leading-tight">
          {article.title}
        </h1>

        {/* Author & Date */}
        <div className="flex flex-wrap items-center gap-4 text-gray-400 text-sm mb-8 pb-8 border-b border-crypto-border">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>{article.author || article.source}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(article.publishedAt)}</span>
          </div>
          {article.readingTime && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{article.readingTime} min de lecture</span>
            </div>
          )}
        </div>

        {/* Featured Image */}
        {article.imageUrl && (
          <div className="mb-8 rounded-xl overflow-hidden">
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-full h-64 sm:h-80 lg:h-96 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=1200';
              }}
            />
          </div>
        )}

        {/* Content */}
        <div 
          className="prose prose-invert prose-lg max-w-none
            prose-headings:text-white prose-headings:font-bold
            prose-p:text-gray-300 prose-p:leading-relaxed
            prose-strong:text-white
            prose-ul:text-gray-300 prose-li:marker:text-blue-400
            prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-500/10 
            prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:rounded-r-lg"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {/* Crypto Tags */}
        {article.currencies && article.currencies.length > 0 && (
          <div className="mt-12 pt-8 border-t border-crypto-border">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">Cryptomonnaies concernées :</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {article.currencies.map(currency => (
                <span
                  key={currency}
                  className="px-3 py-1.5 bg-crypto-card border border-crypto-border 
                           rounded-lg text-sm text-white hover:border-blue-500/50 transition-colors"
                >
                  {currency}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-12 pt-8 border-t border-crypto-border flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => setView('dashboard')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour aux actualités
          </button>
          
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 
                     text-white rounded-lg font-medium transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
            Lire l'article original
          </a>
        </div>
      </article>
    </div>
  );
}
