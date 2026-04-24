import { useEffect, useState, lazy, Suspense, memo } from 'react';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AIChatBot } from './components/AIChatBot';
import InstallPrompt from './components/InstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import ToastContainer from './components/ToastContainer';
import { useCryptoStore } from './stores/cryptoStore';
import { websocketManager } from './services/websocketManager';
import { WatermarkSystem } from './components/Watermark';
import './styles/watermark.css';

// 🚀 Lazy loading pour code splitting et performance
const Dashboard = lazy(() => import('./components/Dashboard'));
const TradingJournal = lazy(() => import('./components/TradingJournal'));
const LiveTrading = lazy(() => import('./components/LiveTrading'));
const TradeHistory = lazy(() => import('./components/TradeHistory'));
const TradingBot = lazy(() => import('./components/TradingBotV2'));
const RiskCalculator = lazy(() => import('./components/RiskCalculator'));
const TechnicalAnalysis = lazy(() => import('./components/TechnicalAnalysis'));
const Strategies = lazy(() => import('./components/Strategies'));
const Alerts = lazy(() => import('./components/Alerts'));
const Portfolio = lazy(() => import('./components/Portfolio'));
const Wallet = lazy(() => import('./components/Wallet'));
const CryptoScanner = lazy(() => import('./components/CryptoScanner'));
const FuturesTrading = lazy(() => import('./components/FuturesTrading'));
const Community = lazy(() => import('./components/Community'));
const Backtest = lazy(() => import('./components/Backtest'));
const Settings = lazy(() => import('./components/Settings'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const TradeManager = lazy(() => import('./components/TradeManager'));
const LearningDashboard = lazy(() => import('./components/LearningDashboard'));
const WidgetSettings = lazy(() => import('./components/WidgetSettings'));
const NewsDetail = lazy(() => import('./components/NewsDetail'));

// 🔄 Composant de loading optimisé
const PageLoader = memo(() => (
  <div className="flex items-center justify-center h-screen bg-gray-950">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      <span className="text-sm text-gray-400">Chargement...</span>
    </div>
  </div>
));

function App() {
  const currentView = useCryptoStore((state) => state.currentView);
  const setView = useCryptoStore((state) => state.setView);
  const [showSplash, setShowSplash] = useState(true);
  
  // Initialize WebSocket connection global
  useEffect(() => {
    websocketManager.connect();
    return () => {
      // Pas de déconnexion ici - connexion persistante
    };
  }, []);
  
  // Load theme on app startup
  useEffect(() => {
    const savedSettings = localStorage.getItem('trading_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      if (parsed.theme === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
    }
  }, []);

  // 🔥 ÉCOUTER LES DEMANDES DE NAVIGATION DEPUIS LE BACKTEST
  useEffect(() => {
    const handleNavigate = (event: CustomEvent<string>) => {
      const section = event.detail;
      if (section) {
        console.log(`[App] Navigation automatique vers: ${section}`);
        setView(section as any);
      }
    };
    
    window.addEventListener('navigateToSection' as any, handleNavigate);
    return () => window.removeEventListener('navigateToSection' as any, handleNavigate);
  }, [setView]);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'analysis':
        return <TechnicalAnalysis />;
      case 'strategies':
        return <Strategies />;
      case 'tradingBot':
        return <TradingBot />;
      case 'alerts':
        return <Alerts />;
      case 'journal':
        return <TradingJournal />;
      case 'liveTrading':
        return <LiveTrading />;
      case 'portfolio':
        return <Portfolio />;
      case 'wallet':
        return <Wallet />;
      case 'scanner':
        return <CryptoScanner />;
      case 'futures':
        return <FuturesTrading />;
      case 'community':
        return <Community />;
      case 'tradeHistory':
        return <TradeHistory />;
      case 'risk':
        return <RiskCalculator />;
      case 'backtest':
        return <Backtest />;
      case 'settings':
        return <Settings />;
      case 'widgetSettings':
        return <WidgetSettings />;
      case 'profile':
        return <UserProfile />;
      case 'admin':
        return <AdminPanel />;
      case 'tradeManager':
        return <TradeManager />;
      case 'learning':
        return <LearningDashboard />;
      case 'newsDetail':
        return <NewsDetail />;
      default:
        return <Dashboard />;
    }
  };

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  return (
    <>
      {/* NEUROVEST Watermark System - Protection anti-leak */}
      <WatermarkSystem mode="full" dynamic={true} />
      
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <OfflineIndicator />
      <Layout>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            {renderView()}
          </Suspense>
          <ToastContainer />
        </ErrorBoundary>
      </Layout>
      <AIChatBot />
      <InstallPrompt />
    </>
  );
}

export default App;
