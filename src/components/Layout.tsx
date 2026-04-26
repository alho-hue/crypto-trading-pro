import { useState, useEffect } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import type { ViewType } from '../types';
import type { UserProfile as UserProfileType } from './AuthModal';
import SocialNotifications from './SocialNotifications';
import AuthModal from './AuthModal';
import { Toast } from './Toast';
import { notifications } from '../services/notificationService';
import { 
  LayoutDashboard, 
  LineChart, 
  Bot, 
  Bell, 
  BookOpen, 
  Wallet, 
  Calculator, 
  History, 
  Settings,
  Menu,
  X,
  TrendingUp,
  Receipt,
  Grid3X3,
  ScanLine,
  Zap,
  Users,
  Shield,
  Crown,
  Brain,
  BarChart3,
  Target,
  Sparkles,
  ChevronRight,
  Layers,
  Activity,
  PieChart,
  Radio,
  Cpu,
  Globe2
} from 'lucide-react';

// Navigation organisée par catégories
interface NavCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  items: { id: ViewType | 'profile'; label: string; icon: React.ElementType; badge?: string; description?: string }[];
}

const navCategories: NavCategory[] = [
  {
    id: 'trading',
    label: 'Trading',
    icon: TrendingUp,
    color: 'from-blue-500 to-cyan-500',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Vue d\'ensemble' },
      { id: 'liveTrading', label: 'Trading Réel', icon: Activity, description: 'Exécution live' },
      { id: 'futures', label: 'Futures', icon: Zap, description: 'Contrats à terme' },
      { id: 'tradeManager', label: 'Gestion Trades', icon: Receipt, description: 'Gérer positions' },
      { id: 'tradeHistory', label: 'Historique', icon: History, description: 'Transactions passées' },
    ]
  },
  {
    id: 'analysis',
    label: 'Analyse',
    icon: BarChart3,
    color: 'from-purple-500 to-pink-500',
    items: [
      { id: 'scanner', label: 'Scanner Crypto', icon: ScanLine, description: 'Détection opportunités' },
      { id: 'analysis', label: 'Analyse Technique', icon: LineChart, description: 'Indicateurs & graphiques' },
      { id: 'strategies', label: 'Stratégies', icon: Target, description: 'Backtesting stratégies' },
      { id: 'backtest', label: 'Backtest', icon: History, description: 'Test historique' },
      { id: 'learning', label: 'IA Learning', icon: Brain, description: 'Apprentissage auto' },
    ]
  },
  {
    id: 'automation',
    label: 'Automatisation',
    icon: Cpu,
    color: 'from-emerald-500 to-teal-500',
    items: [
      { id: 'tradingBot', label: 'Bot Trading', icon: Bot, description: 'Trading automatisé' },
      { id: 'alerts', label: 'Alertes', icon: Bell, description: 'Notifications prix' },
      { id: 'widgetSettings', label: 'Widgets', icon: Grid3X3, description: 'Tableaux personnalisés' },
    ]
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: PieChart,
    color: 'from-amber-500 to-orange-500',
    items: [
      { id: 'portfolio', label: 'Portfolio', icon: Wallet, description: 'Performance globale' },
      { id: 'journal', label: 'Journal', icon: BookOpen, description: 'Notes de trading' },
      { id: 'risk', label: 'Risk Manager', icon: Calculator, description: 'Gestion risques' },
    ]
  },
  {
    id: 'social',
    label: 'Communauté',
    icon: Globe2,
    color: 'from-rose-500 to-red-500',
    items: [
      { id: 'community', label: 'Communauté', icon: Users, description: 'Discussions & partage' },
      { id: 'profile', label: 'Mon Profil', icon: Sparkles, description: 'Paramètres perso' },
    ]
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: Shield,
    color: 'from-red-500 to-orange-500',
    items: [
      { id: 'admin', label: 'Panel Admin', icon: Crown, description: 'Gestion système' },
    ]
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const currentView = useCryptoStore((state) => state.currentView);
  const setView = useCryptoStore((state) => state.setView);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfileType | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const saved = localStorage.getItem('current_user');
    if (saved) {
      setCurrentUser(JSON.parse(saved));
    }

    // Écouter les mises à jour de profil depuis UserProfile.tsx
    const handleProfileUpdate = (e: CustomEvent) => {
      setCurrentUser(e.detail);
    };
    window.addEventListener('user-profile-updated', handleProfileUpdate as EventListener);

    return () => {
      window.removeEventListener('user-profile-updated', handleProfileUpdate as EventListener);
    };
  }, []);

  const handleAuthSuccess = (user: UserProfileType) => {
    setCurrentUser(user);
    setShowAuthModal(false);
  };

  const handleNavClick = (id: ViewType) => {
    setView(id);
    localStorage.setItem('current_view', id);
    setMobileMenuOpen(false);
  };

  // Restore view from localStorage on mount
  useEffect(() => {
    const savedView = localStorage.getItem('current_view') as ViewType;
    if (savedView) {
      setView(savedView);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 flex flex-col lg:flex-row">
      {/* Mobile Header - Modern Design */}
      <header className="lg:hidden bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-crypto-blue to-blue-600 rounded-xl shadow-lg shadow-crypto-blue/20">
            <LineChart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">NEUROVEST</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Trading Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SocialNotifications />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 rounded-xl bg-slate-800/80 text-white hover:bg-slate-700 transition-all border border-slate-700/50"
            aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Sidebar - Desktop: Fixed with isolated scroll, Mobile: Overlay */}
      <aside 
        className={`
          fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 w-64 max-w-[80vw] bg-crypto-card border-r border-crypto-border 
          flex flex-col transform transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none
          ${mobileMenuOpen ? 'z-[60] translate-x-0' : 'z-40 -translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Desktop Logo - Modern Design */}
        <div className="hidden lg:block p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-crypto-blue to-blue-600 rounded-xl shadow-lg shadow-crypto-blue/20">
              <LineChart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">NEUROVEST</h1>
              <p className="text-xs text-slate-500">Trading Intelligence</p>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu Header */}
        <div className="lg:hidden p-3 border-b border-crypto-border flex items-center justify-between bg-crypto-dark/50">
          <span className="text-sm font-semibold text-gray-300">Menu</span>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 hover:bg-crypto-border rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        <nav className="flex-1 p-3 sm:p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-crypto-border scrollbar-track-transparent">
          {navCategories.map((category) => {
            const CategoryIcon = category.icon;
            const hasActiveItem = category.items.some(item => currentView === item.id);
            
            return (
              <div key={category.id} className="mb-5">
                {/* Category Header */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-1 bg-gradient-to-r ${category.color} bg-clip-text`}>
                  <div className={`p-1.5 rounded-md bg-gradient-to-br ${category.color} opacity-80`}>
                    <CategoryIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    {category.label}
                  </span>
                </div>
                
                {/* Category Items */}
                <div className="space-y-0.5 pl-2">
                  {category.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = currentView === item.id;
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`w-full group flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 text-left ${
                          isActive
                            ? 'bg-gradient-to-r from-crypto-blue/20 to-crypto-blue/5 text-crypto-blue border-l-2 border-crypto-blue shadow-lg shadow-crypto-blue/10'
                            : 'text-gray-400 hover:bg-white/5 hover:text-white hover:translate-x-0.5'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg transition-all ${
                          isActive 
                            ? 'bg-crypto-blue/20' 
                            : 'bg-gray-800/50 group-hover:bg-gray-700/50'
                        }`}>
                          <ItemIcon className={`w-4 h-4 flex-shrink-0 transition-colors ${
                            isActive ? 'text-crypto-blue' : 'text-gray-500 group-hover:text-gray-300'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`font-medium text-sm truncate block ${
                            isActive ? 'text-white' : ''
                          }`}>
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="text-[10px] text-gray-500 truncate block">
                              {item.description}
                            </span>
                          )}
                        </div>
                        {isActive && (
                          <ChevronRight className="w-3.5 h-3.5 text-crypto-blue flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {/* Settings - Always at bottom */}
          <div className="mt-4 pt-4 border-t border-crypto-border/50">
            <button
              onClick={() => handleNavClick('settings')}
              className={`w-full group flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 text-left ${
                currentView === 'settings'
                  ? 'bg-gradient-to-r from-gray-500/20 to-gray-500/5 text-gray-300 border-l-2 border-gray-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-all ${
                currentView === 'settings' 
                  ? 'bg-gray-500/20' 
                  : 'bg-gray-800/50 group-hover:bg-gray-700/50'
              }`}>
                <Settings className={`w-4 h-4 flex-shrink-0 ${
                  currentView === 'settings' ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-300'
                }`} />
              </div>
              <span className="font-medium text-sm">Paramètres</span>
              {currentView === 'settings' && (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 ml-auto" />
              )}
            </button>
          </div>
        </nav>
        
        {/* User Profile Section - Bottom */}
        <div className="p-3 border-t border-crypto-border">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full bg-crypto-blue flex items-center justify-center font-bold cursor-pointer hover:ring-2 hover:ring-crypto-blue/50 transition-all overflow-hidden"
                onClick={() => handleNavClick('profile')}
                title="Voir mon profil"
              >
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar.startsWith('http')
                      ? currentUser.avatar.replace(/^http:/, 'https:')
                      : `${API_URL.replace('/api', '').replace(/^http:/, 'https:')}${currentUser.avatar}`}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const displayName = currentUser.displayName || currentUser.username || '?';
                      e.currentTarget.parentElement!.textContent = displayName[0].toUpperCase();
                    }}
                  />
                ) : (
                  ((currentUser.displayName || currentUser.username || '?'))[0].toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleNavClick('profile')}>
                <div className="font-medium text-sm text-white truncate">
                  {currentUser.displayName || currentUser.username}
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  En ligne
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full py-2.5 bg-crypto-blue/20 text-crypto-blue rounded-lg hover:bg-crypto-blue/30 text-sm font-medium flex items-center justify-center gap-2"
            >
              Se connecter
            </button>
          )}
        </div>
      </aside>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Mobile Overlay - Improved blur */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      {/* Main Content - Improved design */}
      <main className="flex-1 lg:ml-0 p-4 sm:p-6 lg:p-8 h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {children}
      </main>
      
      {/* Toast Notifications */}
      <Toast />
    </div>
  );
}
