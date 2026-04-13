import { useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TradingJournal from './components/TradingJournal';
import RiskCalculator from './components/RiskCalculator';
import TechnicalAnalysis from './components/TechnicalAnalysis';
import Strategies from './components/Strategies';
import Alerts from './components/Alerts';
import Portfolio from './components/Portfolio';
import Backtest from './components/Backtest';
import Settings from './components/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AIChatBot } from './components/AIChatBot';
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
      case 'alerts':
        return <Alerts />;
      case 'journal':
        return <TradingJournal />;
      case 'portfolio':
        return <Portfolio />;
      case 'risk':
        return <RiskCalculator />;
      case 'backtest':
        return <Backtest />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <Layout>
        <ErrorBoundary>
          {renderView()}
        </ErrorBoundary>
      </Layout>
      <AIChatBot />
    </>
  );
}

export default App;
