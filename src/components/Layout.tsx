import { useState } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import type { ViewType } from '../types';
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
  TrendingUp
} from 'lucide-react';

const navItems: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'liveTrading', label: 'Trading Réel', icon: TrendingUp },
  { id: 'analysis', label: 'Analyse', icon: LineChart },
  { id: 'strategies', label: 'Stratégies', icon: Bot },
  { id: 'alerts', label: 'Alertes', icon: Bell },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'risk', label: 'Risque', icon: Calculator },
  { id: 'backtest', label: 'Backtest', icon: History },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const currentView = useCryptoStore((state) => state.currentView);
  const setView = useCryptoStore((state) => state.setView);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (id: ViewType) => {
    setView(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-crypto-dark flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="lg:hidden bg-crypto-card border-b border-crypto-border p-4 flex items-center justify-between sticky top-0 z-50">
        <h1 className="text-lg font-bold text-crypto-blue flex items-center gap-2">
          <LineChart className="w-6 h-6" />
          Crypto Trading Pro
        </h1>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-crypto-dark text-white hover:bg-crypto-border transition-colors"
          aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar - Desktop: Fixed, Mobile: Overlay */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 w-64 max-w-[80vw] bg-crypto-card border-r border-crypto-border 
          flex flex-col transform transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none
          ${mobileMenuOpen ? 'z-[60] translate-x-0' : 'z-40 -translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Desktop Logo - Hidden on mobile */}
        <div className="hidden lg:block p-4 border-b border-crypto-border">
          <h1 className="text-xl font-bold text-crypto-blue flex items-center gap-2">
            <LineChart className="w-6 h-6 flex-shrink-0" />
            <span className="truncate">Crypto Trading Pro</span>
          </h1>
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
        
        <nav className="flex-1 p-3 sm:p-4 space-y-0.5 sm:space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg transition-colors text-left ${
                  isActive
                    ? 'bg-crypto-blue/20 text-crypto-blue border border-crypto-blue/30'
                    : 'text-gray-400 hover:bg-crypto-border hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base truncate">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-crypto-blue flex-shrink-0" />
                )}
              </button>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-crypto-border">
          <div className="text-xs text-gray-500 text-center">
            v1.0.0 MVP
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      {/* Main Content */}
      <main className="flex-1 lg:ml-0 p-4 sm:p-6 overflow-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}
