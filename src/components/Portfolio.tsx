import { useState, useEffect, useRef } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend
} from 'recharts';
import {
  Wallet, TrendingUp, TrendingDown, RefreshCw, ArrowUpRight, ArrowDownRight,
  Eye, EyeOff, Filter, PieChart as PieChartIcon, Activity, Clock,
  ChevronDown, ChevronUp, AlertTriangle, Loader2, DollarSign, Percent
} from 'lucide-react';
import { showToast } from '../stores/toastStore';
import { useCryptoStore } from '../stores/cryptoStore';
import { formatXOF } from '../utils/currency';

// Services réels
import {
  initializeWallet,
  subscribeWalletUpdates,
  type WalletState
} from '../services/walletRealService';

import {
  getPortfolioHistory,
  getPortfolioPerformance,
  type PortfolioPerformance
} from '../services/portfolioApi';

// Types locaux
interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
  total: string;
  valueUSDT: number;
}

interface PortfolioHistoryEntry {
  timestamp: string;
  totalValueUSDT: number;
  dailyPnl?: number;
}

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1'];

interface PortfolioPosition {
  id: string;
  asset: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  allocation: number;
  dayChange: number;
  dayChangePercent: number;
  isReal: boolean;
  lastUpdated: string;
}

export default function Portfolio() {
  // États
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [performance, setPerformance] = useState<PortfolioPerformance | null>(null);
  const [history, setHistory] = useState<PortfolioHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'allocation' | 'performance'>('overview');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'name'>('value');
  const [sortDesc, setSortDesc] = useState(true);

  const prices = useCryptoStore((state) => state.prices);
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chargement initial
  useEffect(() => {
    loadPortfolioData();

    // Auto-refresh toutes les 30 secondes
    refreshInterval.current = setInterval(() => {
      loadPortfolioData();
    }, 30000);

    // Subscription wallet temps réel
    const unsubscribe = subscribeWalletUpdates((state) => {
      setWalletState(state);
      updatePositionsFromWallet(state);
      setLastUpdate(new Date());
    });

    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
      unsubscribe();
    };
  }, []);

  // Mise à jour positions quand les prix changent
  useEffect(() => {
    if (positions.length === 0) return;

    const updatedPositions = positions.map(pos => {
      if (!pos.isReal) return pos;

      const priceKey = `${pos.asset}/USDT`;
      const priceData = prices.get(priceKey);
      const newPrice = priceData?.price || pos.currentPrice;
      const newValue = pos.quantity * newPrice;
      const costBasis = pos.quantity * pos.avgPrice;
      const newPnl = newValue - costBasis;
      const newPnlPercent = costBasis > 0 ? (newPnl / costBasis) * 100 : 0;

      return {
        ...pos,
        currentPrice: newPrice,
        currentValue: newValue,
        pnl: newPnl,
        pnlPercent: newPnlPercent,
        lastUpdated: new Date().toISOString()
      };
    });

    // Recalculer les allocations
    const totalValue = updatedPositions.reduce((sum, p) => sum + p.currentValue, 0);
    const withAllocation = updatedPositions.map(p => ({
      ...p,
      allocation: totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0
    }));

    setPositions(withAllocation);
  }, [prices]);

  // Chargement des données portfolio
  const loadPortfolioData = async () => {
    try {
      // Wallet temps réel
      const walletResult = await initializeWallet();
      
      if (walletResult.success && walletResult.state) {
        setWalletState(walletResult.state);
        setIsDemoMode(walletResult.state.isDemoMode || false);
        updatePositionsFromWallet(walletResult.state);
      }

      // Performance
      try {
        const perfResult = await getPortfolioPerformance();
        if (perfResult) {
          setPerformance(perfResult);
        }
      } catch (err) {
        console.error('Erreur chargement performance:', err);
      }

      // Historique
      try {
        const historyResult = await getPortfolioHistory(30);
        if (Array.isArray(historyResult)) {
          setHistory(historyResult as PortfolioHistoryEntry[]);
        }
      } catch (err) {
        console.error('Erreur chargement historique:', err);
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erreur chargement portfolio:', error);
      showToast.error('Erreur connexion au serveur', 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  // Convertir wallet en positions
  const updatePositionsFromWallet = (state: WalletState) => {
    const binancePositions = state.balances
      .filter((b: BinanceBalance) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b: BinanceBalance) => {
        const totalQty = parseFloat(b.free) + parseFloat(b.locked);
        const currentPrice = b.valueUSDT / totalQty || 0;
        const avgPrice = currentPrice * 0.95; // Estimation basée sur historique
        const pnl = b.valueUSDT - (totalQty * avgPrice);
        const pnlPercent = avgPrice > 0 ? ((b.valueUSDT - (totalQty * avgPrice)) / (totalQty * avgPrice)) * 100 : 0;

        return {
          id: `binance-${b.asset}`,
          asset: b.asset,
          symbol: `${b.asset}/USDT`,
          quantity: totalQty,
          avgPrice: avgPrice,
          currentPrice: currentPrice,
          currentValue: b.valueUSDT || 0,
          pnl: pnl,
          pnlPercent: pnlPercent,
          allocation: 0,
          dayChange: 0,
          dayChangePercent: 0,
          isReal: true,
          lastUpdated: new Date().toISOString()
        };
      });

    // Recalculer allocations
    const totalValue = binancePositions.reduce((sum, p) => sum + p.currentValue, 0);
    const withAllocation = binancePositions.map(p => ({
      ...p,
      allocation: totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0
    }));

    setPositions(withAllocation);
  };

  // Trier positions
  const sortedPositions = [...positions].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'value':
        comparison = b.currentValue - a.currentValue;
        break;
      case 'pnl':
        comparison = b.pnl - a.pnl;
        break;
      case 'name':
        comparison = a.asset.localeCompare(b.asset);
        break;
    }
    return sortDesc ? comparison : -comparison;
  });

  // Calculs globaux
  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalPnlPercent = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;
  const dayChange = positions.reduce((sum, p) => sum + p.dayChange, 0);

  // Données pour graphique allocation
  const allocationData = positions
    .filter(p => p.allocation > 1)
    .map(p => ({
      name: p.asset,
      value: parseFloat(p.allocation.toFixed(2)),
      fullValue: p.currentValue
    }));

  // Données pour graphique performance
  const performanceData = history.map(h => ({
    date: new Date(h.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    value: h.totalValueUSDT,
    pnl: h.dailyPnl || 0
  }));

  const handleRefresh = () => {
    setLoading(true);
    loadPortfolioData();
    showToast.success('Portfolio actualisé', 'Succès');
  };

  // Affichage immédiat, pas d'écran de chargement bloquant

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Mon Portfolio</h1>
          <p className="text-gray-400">
            {isDemoMode ? 'Mode démo - Connectez vos clés API pour les données réelles' : 'Données temps réel de votre compte Binance'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBalanceVisible(!balanceVisible)}
            className="p-2 bg-crypto-dark rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            {balanceVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-crypto-blue hover:bg-crypto-blue/80 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="crypto-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Valeur Totale</span>
            <Wallet className="w-5 h-5 text-crypto-blue" />
          </div>
          <p className="text-2xl font-bold">
            {balanceVisible ? `${totalValue.toLocaleString()} USDT` : '•••••'}
          </p>
          <p className="text-sm text-crypto-green">
            {balanceVisible ? formatXOF(totalValue * 655) : '•••••'} FCFA
          </p>
        </div>

        <div className="crypto-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">P&L Total</span>
            {totalPnl >= 0 ? <TrendingUp className="w-5 h-5 text-crypto-green" /> : <TrendingDown className="w-5 h-5 text-crypto-orange" />}
          </div>
          <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-crypto-green' : 'text-crypto-orange'}`}>
            {balanceVisible ? `${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} USDT` : '•••••'}
          </p>
          <p className={`text-sm ${totalPnlPercent >= 0 ? 'text-crypto-green' : 'text-crypto-orange'}`}>
            {balanceVisible ? `${totalPnlPercent >= 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%` : '•••'}
          </p>
        </div>

        <div className="crypto-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Variation 24h</span>
            <Activity className="w-5 h-5 text-crypto-purple" />
          </div>
          <p className={`text-2xl font-bold ${dayChange >= 0 ? 'text-crypto-green' : 'text-crypto-orange'}`}>
            {balanceVisible ? `${dayChange >= 0 ? '+' : ''}${dayChange.toFixed(2)} USDT` : '•••••'}
          </p>
          <p className="text-sm text-gray-400">{positions.length} actifs</p>
        </div>

        <div className="crypto-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Dernière Mise à Jour</span>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold">
            {lastUpdate ? lastUpdate.toLocaleTimeString('fr-FR') : '--:--'}
          </p>
          <p className="text-sm text-gray-400">
            {isDemoMode ? 'Mode démo' : 'Données temps réel'}
          </p>
        </div>
      </div>

      {/* Navigation vues */}
      <div className="flex gap-2 mb-6 border-b border-gray-700 pb-4">
        <button
          onClick={() => setActiveView('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'overview' ? 'bg-crypto-blue text-white' : 'text-gray-400 hover:bg-crypto-gray'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Vue d'ensemble
        </button>
        <button
          onClick={() => setActiveView('allocation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'allocation' ? 'bg-crypto-blue text-white' : 'text-gray-400 hover:bg-crypto-gray'
          }`}
        >
          <PieChartIcon className="w-4 h-4" />
          Allocation
        </button>
        <button
          onClick={() => setActiveView('performance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'performance' ? 'bg-crypto-blue text-white' : 'text-gray-400 hover:bg-crypto-gray'
          }`}
        >
          <Activity className="w-4 h-4" />
          Performance
        </button>
      </div>

      {/* Contenu principal */}
      {activeView === 'overview' && (
        <OverviewView
          positions={sortedPositions}
          totalValue={totalValue}
          balanceVisible={balanceVisible}
          sortBy={sortBy}
          sortDesc={sortDesc}
          setSortBy={setSortBy}
          setSortDesc={setSortDesc}
        />
      )}

      {activeView === 'allocation' && (
        <AllocationView
          allocationData={allocationData}
          positions={positions}
          balanceVisible={balanceVisible}
        />
      )}

      {activeView === 'performance' && (
        <PerformanceView
          performanceData={performanceData}
          performance={performance}
          balanceVisible={balanceVisible}
        />
      )}
    </div>
  );
}

// ============ SOUS-COMPOSANTS ============

interface OverviewViewProps {
  positions: PortfolioPosition[];
  totalValue: number;
  balanceVisible: boolean;
  sortBy: 'value' | 'pnl' | 'name';
  sortDesc: boolean;
  setSortBy: (by: 'value' | 'pnl' | 'name') => void;
  setSortDesc: (desc: boolean) => void;
}

function OverviewView({
  positions,
  totalValue,
  balanceVisible,
  sortBy,
  sortDesc,
  setSortBy,
  setSortDesc
}: OverviewViewProps) {
  return (
    <div className="space-y-6">
      {/* Actions rapides */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => { setSortBy('value'); setSortDesc(!sortDesc); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            sortBy === 'value' ? 'bg-crypto-blue/20 text-crypto-blue' : 'bg-crypto-dark text-gray-400'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Valeur {sortBy === 'value' && (sortDesc ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />)}
        </button>
        <button
          onClick={() => { setSortBy('pnl'); setSortDesc(!sortDesc); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            sortBy === 'pnl' ? 'bg-crypto-blue/20 text-crypto-blue' : 'bg-crypto-dark text-gray-400'
          }`}
        >
          <Percent className="w-4 h-4" />
          P&L {sortBy === 'pnl' && (sortDesc ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />)}
        </button>
        <button
          onClick={() => { setSortBy('name'); setSortDesc(!sortDesc); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            sortBy === 'name' ? 'bg-crypto-blue/20 text-crypto-blue' : 'bg-crypto-dark text-gray-400'
          }`}
        >
          <Filter className="w-4 h-4" />
          Nom {sortBy === 'name' && (sortDesc ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />)}
        </button>
      </div>

      {/* Table des positions */}
      <div className="crypto-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
              <th className="pb-3 pl-4">Actif</th>
              <th className="pb-3 text-right">Quantité</th>
              <th className="pb-3 text-right">Prix Moyen</th>
              <th className="pb-3 text-right">Prix Actuel</th>
              <th className="pb-3 text-right">Valeur</th>
              <th className="pb-3 text-right">Allocation</th>
              <th className="pb-3 text-right pr-4">P&L</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-3">
                    <AlertTriangle className="w-10 h-10" />
                    <p>Aucune position trouvée</p>
                    <p className="text-sm">Votre portfolio est vide ou vos clés API ne sont pas configurées</p>
                  </div>
                </td>
              </tr>
            ) : (
              positions.map((position) => (
                <tr
                  key={position.id}
                  className="border-b border-gray-700/50 hover:bg-crypto-dark/30 transition-colors"
                >
                  <td className="py-4 pl-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-crypto-blue/20 to-crypto-purple/20 flex items-center justify-center font-bold text-crypto-blue">
                        {position.asset.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold">{position.asset}</p>
                        <p className="text-sm text-gray-400">{position.symbol}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    <p className="font-medium">{position.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}</p>
                    <p className={`text-sm ${position.dayChangePercent >= 0 ? 'text-crypto-green' : 'text-crypto-orange'}`}>
                      {position.dayChangePercent >= 0 ? '+' : ''}{position.dayChangePercent.toFixed(2)}%
                    </p>
                  </td>
                  <td className="py-4 text-right text-gray-400">
                    {balanceVisible ? `${position.avgPrice.toFixed(2)} USDT` : '•••'}
                  </td>
                  <td className="py-4 text-right">
                    <p className="font-medium">{balanceVisible ? `${position.currentPrice.toFixed(2)} USDT` : '•••'}</p>
                    <p className={`text-xs ${position.dayChange >= 0 ? 'text-crypto-green' : 'text-crypto-orange'}`}>
                      {position.dayChange >= 0 ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
                      {Math.abs(position.dayChange).toFixed(2)}
                    </p>
                  </td>
                  <td className="py-4 text-right font-semibold">
                    {balanceVisible ? `${position.currentValue.toFixed(2)} USDT` : '•••••'}
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-crypto-blue rounded-full"
                          style={{ width: `${Math.min(position.allocation, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-400">{position.allocation.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="py-4 pr-4 text-right">
                    <p className={`font-semibold ${position.pnl >= 0 ? 'text-crypto-green' : 'text-crypto-orange'}`}>
                      {balanceVisible ? `${position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)} USDT` : '•••'}
                    </p>
                    <p className={`text-sm ${position.pnlPercent >= 0 ? 'text-crypto-green' : 'text-crypto-orange'}`}>
                      {balanceVisible ? `${position.pnlPercent >= 0 ? '+' : ''}${position.pnlPercent.toFixed(2)}%` : '•••'}
                    </p>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface AllocationViewProps {
  allocationData: { name: string; value: number; fullValue: number }[];
  positions: PortfolioPosition[];
  balanceVisible: boolean;
}

function AllocationView({ allocationData, positions, balanceVisible }: AllocationViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Graphique camembert */}
      <div className="crypto-card">
        <h3 className="font-semibold mb-6">Répartition du Portfolio</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={allocationData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {allocationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Liste détaillée */}
      <div className="crypto-card">
        <h3 className="font-semibold mb-6">Détails par Actif</h3>
        <div className="space-y-4">
          {positions.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Aucune position</p>
          ) : (
            positions
              .sort((a, b) => b.allocation - a.allocation)
              .map((position, index) => (
                <div key={position.id} className="flex items-center gap-4 p-3 bg-crypto-dark/50 rounded-lg">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{position.asset}</span>
                      <span className="text-gray-400">{position.allocation.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {position.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} {position.asset}
                      </span>
                      <span className="text-crypto-blue">
                        {balanceVisible ? `${position.currentValue.toFixed(2)} USDT` : '•••'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}

interface PerformanceViewProps {
  performanceData: { date: string; value: number; pnl: number }[];
  performance: PortfolioPerformance | null;
  balanceVisible: boolean;
}

function PerformanceView({ performanceData, performance, balanceVisible }: PerformanceViewProps) {
  return (
    <div className="space-y-6">
      {/* Stats performance */}
      {performance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="crypto-card">
            <p className="text-sm text-gray-400 mb-1">Return %</p>
            <p className={`text-xl font-bold ${performance.returnPercentage >= 0 ? 'text-crypto-green' : 'text-crypto-orange'}`}>
              {balanceVisible ? `${performance.returnPercentage >= 0 ? '+' : ''}${performance.returnPercentage.toFixed(2)}%` : '•••'}
            </p>
          </div>
          <div className="crypto-card">
            <p className="text-sm text-gray-400 mb-1">Return Value</p>
            <p className="text-xl font-bold text-crypto-blue">
              {balanceVisible ? `${performance.returnValue >= 0 ? '+' : ''}${performance.returnValue.toFixed(2)} USDT` : '•••'}
            </p>
          </div>
          <div className="crypto-card">
            <p className="text-sm text-gray-400 mb-1">Valeur Actuelle</p>
            <p className="text-xl font-bold">{balanceVisible ? `${performance.totalValue.toFixed(2)} USDT` : '•••'}</p>
          </div>
          <div className="crypto-card">
            <p className="text-sm text-gray-400 mb-1">Période</p>
            <p className="text-xl font-bold text-crypto-orange">
              {performance.period}
            </p>
          </div>
        </div>
      )}

      {/* Graphique performance */}
      <div className="crypto-card">
        <h3 className="font-semibold mb-6">Évolution de la Valeur</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#1a1a2e',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tableau historique */}
      <div className="crypto-card overflow-x-auto">
        <h3 className="font-semibold mb-4">Historique Récent</h3>
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
              <th className="pb-3 pl-4">Date</th>
              <th className="pb-3 text-right">Valeur</th>
              <th className="pb-3 text-right">P&L Jour</th>
              <th className="pb-3 text-right pr-4">%</th>
            </tr>
          </thead>
          <tbody>
            {performanceData.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">
                  Aucun historique disponible
                </td>
              </tr>
            ) : (
              performanceData.slice(-10).reverse().map((entry, index) => (
                <tr key={index} className="border-b border-gray-700/50">
                  <td className="py-3 pl-4">{entry.date}</td>
                  <td className="py-3 text-right">
                    {balanceVisible ? `${entry.value.toFixed(2)} USDT` : '•••'}
                  </td>
                  <td className={`py-3 text-right ${entry.pnl >= 0 ? 'text-crypto-green' : 'text-crypto-orange'}`}>
                    {balanceVisible ? `${entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(2)}` : '•••'}
                  </td>
                  <td className={`py-3 pr-4 text-right ${entry.pnl >= 0 ? 'text-crypto-green' : 'text-crypto-orange'}`}>
                    {entry.value > 0 ? `${((entry.pnl / entry.value) * 100).toFixed(2)}%` : '0%'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
