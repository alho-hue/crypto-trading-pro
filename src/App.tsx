import { useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TradingJournal from './components/TradingJournal';
import LiveTrading from './components/LiveTrading';
import TradeHistory from './components/TradeHistory';
import TradingBot from './components/TradingBot';
import RiskCalculator from './components/RiskCalculator';
import TechnicalAnalysis from './components/TechnicalAnalysis';
import Strategies from './components/Strategies';
import Alerts from './components/Alerts';
import Portfolio from './components/Portfolio';
import CryptoScanner from './components/CryptoScanner';
import FuturesTrading from './components/FuturesTrading';
import Backtest from './components/Backtest';
import Settings from './components/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AIChatBot } from './components/AIChatBot';
import InstallPrompt from './components/InstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import WidgetSettings from './components/WidgetSettings';
import { useCryptoStore } from './stores/cryptoStore';
import { useBinanceWebSocket } from './hooks/useBinanceWebSocket';

function App() {
  const currentView = useCryptoStore((state) => state.currentView);
  
  // Initialize WebSocket connection
  useBinanceWebSocket();
  
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
      case 'scanner':
        return <CryptoScanner />;
      case 'futures':
        return <FuturesTrading />;
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
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <OfflineIndicator />
      <Layout>
        <ErrorBoundary>
          {renderView()}
        </ErrorBoundary>
      </Layout>
      <AIChatBot />
      <InstallPrompt />
    </>
  );
}

export default App;
