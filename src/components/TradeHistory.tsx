import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  History, Download, Calendar, Filter, ChevronDown, ChevronUp, TrendingUp,
  TrendingDown, Target, AlertTriangle, Bot, Brain, User, FileSpreadsheet,
  FileText, Search, X, RefreshCw, BarChart3, PieChart, Activity, ArrowRight
} from 'lucide-react';
import { getDecryptedKey } from '../utils/crypto';
import { fetchMyTrades } from '../services/binanceApi';
import {
  getUserTrades, getTradeHistory, getTradeStats, type Trade, type TradeStats
} from '../services/tradeService';
import { getTradeHistory as getApiTradeHistory } from '../services/tradingApi';
import { formatXOF } from '../utils/currency';
import { notifications } from '../services/notificationService';
import { useToastStore, showToast } from '../stores/toastStore';
import { useTradeStore } from '../stores/tradeStore';
import { performAdvancedAnalysis } from '../services/advancedAnalysis';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts';

// Types
interface UnifiedTrade {
  id: string;
  symbol: string;
  type: 'spot' | 'futures';
  side: 'buy' | 'sell' | 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  pnl?: number;
  pnlPercent?: number;
  fees: number;
  status: 'open' | 'closed' | 'pending' | 'cancelled' | 'tp_hit' | 'sl_hit';
  exitReason?: 'stop_loss' | 'take_profit' | 'trailing_stop' | 'manual' | 'signal' | 'liquidation' | 'timeout' | 'system';
  source: 'binance' | 'bot' | 'ai' | 'manual';
  strategy?: string;
  confidence?: number;
  timestamp: number;
  exitTime?: number;
  duration?: number;
  orderId?: string;
  leverage?: number;
  marginType?: 'isolated' | 'crossed';
}

interface FilterState {
  dateRange: { start: string; end: string };
  symbol: string;
  type: 'all' | 'spot' | 'futures';
  side: 'all' | 'buy' | 'sell' | 'long' | 'short';
  result: 'all' | 'win' | 'loss';
  source: 'all' | 'binance' | 'bot' | 'ai' | 'manual';
  strategy: string;
  status: 'all' | 'open' | 'closed' | 'tp_hit' | 'sl_hit';
}

interface AIAnalysis {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
  avgWin: number;
  avgLoss: number;
  recommendations: string[];
  mistakes: string[];
  strengths: string[];
}

const COLORS = {
  profit: '#22c55e',
  loss: '#ef4444',
  neutral: '#6b7280',
  binance: '#f0b90b',
  bot: '#3b82f6',
  ai: '#8b5cf6',
  manual: '#6b7280'
};

export default function TradeHistory() {
  // State
  const [trades, setTrades] = useState<UnifiedTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasApiKeys, setHasApiKeys] = useState(false);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'trades' | 'analytics' | 'strategies'>('trades');
  const [showExportModal, setShowExportModal] = useState(false);

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    dateRange: { start: '', end: '' },
    symbol: '',
    type: 'all',
    side: 'all',
    result: 'all',
    source: 'all',
    strategy: '',
    status: 'all'
  });

  // Store integration
  const storeTrades = useTradeStore(state => state.trades);
  const storeStats = useTradeStore(state => state.stats);
  const refreshAll = useTradeStore(state => state.refreshAll);

  // Check API keys on mount
  useEffect(() => {
    const apiKey = getDecryptedKey('binance_api_key');
    const secretKey = getDecryptedKey('binance_secret_key');
    setHasApiKeys(!!(apiKey && secretKey));
  }, []);

  // Load all trades from multiple sources
  const loadAllTrades = useCallback(async () => {
    setLoading(true);
    const unifiedTrades: UnifiedTrade[] = [];

    try {
      // 1. Load from NEUROVEST backend (Bot, AI, Manual trades)
      const backendResult = await getUserTrades();
      if (backendResult.success && backendResult.trades) {
        backendResult.trades.forEach(trade => {
          unifiedTrades.push({
            id: trade._id,
            symbol: trade.symbol,
            type: trade.leverage > 1 ? 'futures' : 'spot',
            side: trade.side,
            entryPrice: trade.entryPrice,
            exitPrice: trade.exitPrice,
            quantity: trade.quantity,
            stopLoss: trade.stopLoss,
            takeProfit: trade.takeProfit,
            pnl: trade.pnl,
            pnlPercent: trade.pnlPercent,
            fees: trade.fees,
            status: mapTradeStatus(trade.status, trade.exitReason),
            exitReason: trade.exitReason,
            source: trade.source === 'bot' ? 'bot' : trade.source === 'ai' ? 'ai' : 'manual',
            strategy: trade.strategy,
            confidence: trade.confidence,
            timestamp: new Date(trade.entryTime).getTime(),
            exitTime: trade.exitTime ? new Date(trade.exitTime).getTime() : undefined,
            duration: trade.duration,
            orderId: trade.orderId,
            leverage: trade.leverage,
            marginType: trade.marginType
          });
        });
      }

      // 2. Load from trading API history
      const apiHistory = await getApiTradeHistory(false, 100);
      if (apiHistory.trades) {
        apiHistory.trades.forEach((trade: any) => {
          if (!unifiedTrades.find(t => t.orderId === trade.orderId)) {
            unifiedTrades.push({
              id: `api_${trade.id || Date.now()}_${Math.random()}`,
              symbol: trade.symbol,
              type: 'spot',
              side: trade.side === 'BUY' ? 'buy' : 'sell',
              entryPrice: trade.price || trade.entryPrice,
              exitPrice: trade.exitPrice,
              quantity: trade.quantity || trade.qty,
              stopLoss: trade.stopLoss,
              takeProfit: trade.takeProfit,
              pnl: trade.pnl,
              pnlPercent: trade.pnlPercent,
              fees: trade.fees || (trade as any).commission || 0,
              status: trade.status === 'FILLED' ? 'closed' : 'open',
              source: 'binance',
              timestamp: trade.timestamp || trade.time || Date.now(),
              orderId: trade.orderId || trade.id?.toString()
            });
          }
        });
      }

      // 3. Load from Binance directly if API keys available
      if (hasApiKeys) {
        const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT'];
        for (const symbol of symbols) {
          try {
            const binanceTrades = await fetchMyTrades(symbol, 50);
            if (Array.isArray(binanceTrades)) {
              binanceTrades.forEach(trade => {
                if (!unifiedTrades.find(t => t.orderId === trade.id?.toString())) {
                  unifiedTrades.push({
                    id: `binance_${trade.id}`,
                    symbol: trade.symbol,
                    type: 'spot',
                    side: trade.isBuyer ? 'buy' : 'sell',
                    entryPrice: parseFloat(trade.price),
                    exitPrice: undefined,
                    quantity: parseFloat(trade.qty),
                    fees: parseFloat(trade.commission),
                    status: 'closed',
                    source: 'binance',
                    timestamp: trade.time,
                    orderId: trade.id.toString(),
                    isMaker: trade.isMaker
                  } as UnifiedTrade);
                }
              });
            }
          } catch (e) {
            console.warn(`Failed to load ${symbol} from Binance:`, e);
          }
        }
      }

      // Sort by timestamp desc
      unifiedTrades.sort((a, b) => b.timestamp - a.timestamp);
      setTrades(unifiedTrades);

      showToast.success(`${unifiedTrades.length} trades chargés`);
    } catch (error) {
      console.error('Failed to load trades:', error);
      showToast.error('Erreur lors du chargement des trades');
    } finally {
      setLoading(false);
    }
  }, [hasApiKeys]);

  // Initial load
  useEffect(() => {
    loadAllTrades();
  }, [loadAllTrades]);

  // Map trade status helper
  function mapTradeStatus(status: string, exitReason?: string): UnifiedTrade['status'] {
    if (status === 'closed') {
      if (exitReason === 'take_profit') return 'tp_hit';
      if (exitReason === 'stop_loss') return 'sl_hit';
      return 'closed';
    }
    return status as UnifiedTrade['status'];
  }

  // Apply filters
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      // Date range
      if (filters.dateRange.start) {
        const start = new Date(filters.dateRange.start).getTime();
        if (trade.timestamp < start) return false;
      }
      if (filters.dateRange.end) {
        const end = new Date(filters.dateRange.end).getTime();
        if (trade.timestamp > end) return false;
      }

      // Symbol
      if (filters.symbol && !trade.symbol.toLowerCase().includes(filters.symbol.toLowerCase())) {
        return false;
      }

      // Type
      if (filters.type !== 'all' && trade.type !== filters.type) {
        return false;
      }

      // Side
      if (filters.side !== 'all') {
        const side = trade.side.toLowerCase();
        if (filters.side === 'long' && side !== 'long' && side !== 'buy') return false;
        if (filters.side === 'short' && side !== 'short' && side !== 'sell') return false;
        if (filters.side === 'buy' && side !== 'buy') return false;
        if (filters.side === 'sell' && side !== 'sell') return false;
      }

      // Result
      if (filters.result !== 'all') {
        const isWin = (trade.pnl || 0) > 0;
        if (filters.result === 'win' && !isWin) return false;
        if (filters.result === 'loss' && isWin) return false;
      }

      // Source
      if (filters.source !== 'all' && trade.source !== filters.source) {
        return false;
      }

      // Strategy
      if (filters.strategy && !trade.strategy?.toLowerCase().includes(filters.strategy.toLowerCase())) {
        return false;
      }

      // Status
      if (filters.status !== 'all' && trade.status !== filters.status) {
        return false;
      }

      return true;
    });
  }, [trades, filters]);

  // Statistics calculations
  const stats = useMemo(() => {
    const closed = filteredTrades.filter(t => t.status === 'closed' || t.status === 'tp_hit' || t.status === 'sl_hit');
    const wins = closed.filter(t => (t.pnl || 0) > 0);
    const losses = closed.filter(t => (t.pnl || 0) <= 0);

    const totalPnL = closed.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalFees = filteredTrades.reduce((sum, t) => sum + t.fees, 0);
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;

    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length : 0;

    const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? Infinity : 0;

    const bestTrade = closed.length > 0 ? Math.max(...closed.map(t => t.pnl || 0)) : 0;
    const worstTrade = closed.length > 0 ? Math.min(...closed.map(t => t.pnl || 0)) : 0;

    return {
      totalTrades: filteredTrades.length,
      closedTrades: closed.length,
      openTrades: filteredTrades.filter(t => t.status === 'open').length,
      winRate,
      totalPnL,
      totalFees,
      netProfit: totalPnL - totalFees,
      avgWin,
      avgLoss,
      profitFactor,
      bestTrade,
      worstTrade,
      wins: wins.length,
      losses: losses.length
    };
  }, [filteredTrades]);

  // Chart data
  const chartData = useMemo(() => {
    // Group by date for equity curve
    const byDate = new Map<string, { date: string; pnl: number; cumulative: number }>();
    let cumulative = 0;

    const sorted = [...filteredTrades].sort((a, b) => a.timestamp - b.timestamp);
    sorted.forEach(trade => {
      if (trade.pnl !== undefined) {
        const date = new Date(trade.timestamp).toLocaleDateString('fr-FR');
        cumulative += trade.pnl - trade.fees;

        if (!byDate.has(date)) {
          byDate.set(date, { date, pnl: 0, cumulative });
        }
        byDate.get(date)!.pnl += trade.pnl;
        byDate.get(date)!.cumulative = cumulative;
      }
    });

    return Array.from(byDate.values());
  }, [filteredTrades]);

  const pnlDistribution = useMemo(() => {
    const wins = filteredTrades.filter(t => (t.pnl || 0) > 0).length;
    const losses = filteredTrades.filter(t => (t.pnl || 0) < 0).length;
    const neutral = filteredTrades.filter(t => (t.pnl || 0) === 0).length;

    return [
      { name: 'Gains', value: wins, color: COLORS.profit },
      { name: 'Pertes', value: losses, color: COLORS.loss },
      { name: 'Neutre', value: neutral, color: COLORS.neutral }
    ];
  }, [filteredTrades]);

  const sourceDistribution = useMemo(() => {
    const bySource = new Map<string, number>();
    filteredTrades.forEach(t => {
      const count = bySource.get(t.source) || 0;
      bySource.set(t.source, count + 1);
    });

    return Array.from(bySource.entries()).map(([name, value]) => ({
      name: name === 'binance' ? 'Binance' : name === 'bot' ? 'Bot' : name === 'ai' ? 'IA' : 'Manuel',
      value,
      color: COLORS[name as keyof typeof COLORS] || COLORS.manual
    }));
  }, [filteredTrades]);

  // Strategy performance
  const strategyPerformance = useMemo(() => {
    const byStrategy = new Map<string, { trades: number; wins: number; pnl: number }>();

    filteredTrades.forEach(trade => {
      if (!trade.strategy) return;

      const existing = byStrategy.get(trade.strategy) || { trades: 0, wins: 0, pnl: 0 };
      existing.trades++;
      if ((trade.pnl || 0) > 0) existing.wins++;
      existing.pnl += trade.pnl || 0;
      byStrategy.set(trade.strategy, existing);
    });

    return Array.from(byStrategy.entries())
      .map(([name, data]) => ({
        name,
        trades: data.trades,
        winRate: (data.wins / data.trades) * 100,
        pnl: data.pnl
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [filteredTrades]);

  // Run AI Analysis
  const runAIAnalysis = useCallback(async () => {
    if (filteredTrades.length < 5) {
      showToast.warning('Au moins 5 trades requis pour l\'analyse IA');
      return;
    }

    setAnalyzing(true);
    setShowAIAnalysis(true);

    try {
      // Simulate AI analysis (would integrate with actual AI service)
      const wins = filteredTrades.filter(t => (t.pnl || 0) > 0);
      const losses = filteredTrades.filter(t => (t.pnl || 0) <= 0);

      const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length : 0;

      // Generate recommendations based on data
      const recommendations: string[] = [];
      const mistakes: string[] = [];
      const strengths: string[] = [];

      if (stats.winRate < 50) {
        recommendations.push('Améliorer la sélection des setups - win rate sous 50%');
        mistakes.push('Entrées précipitées sans confirmation technique');
      }

      if (stats.profitFactor < 1.5) {
        recommendations.push('Optimiser le risk/reward ratio minimum 1:2');
        mistakes.push('Take Profits trop proches des entrées');
      }

      if (Math.abs(avgLoss) > avgWin * 1.5) {
        recommendations.push('Réduire les pertes - stop loss trop large');
        mistakes.push('Stop Loss mal positionnés');
      }

      if (wins.length > 0 && avgWin > 0) {
        strengths.push('Capacité à laisser courir les gains');
      }

      if (stats.winRate > 55) {
        strengths.push('Bonne précision dans la sélection des trades');
      }

      const aiResult: AIAnalysis = {
        totalTrades: stats.totalTrades,
        winRate: stats.winRate,
        profitFactor: stats.profitFactor,
        bestTrade: stats.bestTrade,
        worstTrade: stats.worstTrade,
        avgWin,
        avgLoss,
        recommendations,
        mistakes,
        strengths
      };

      setAiAnalysis(aiResult);
      showToast.success('Analyse IA complète');
    } catch (error) {
      showToast.error('Erreur lors de l\'analyse IA');
    } finally {
      setAnalyzing(false);
    }
  }, [filteredTrades, stats]);

  // Export functions
  const exportToCSV = useCallback(() => {
    const headers = [
      'Date', 'Symbol', 'Type', 'Side', 'Entry Price', 'Exit Price',
      'Quantity', 'PnL', 'PnL %', 'Fees', 'Status', 'Source', 'Strategy', 'Exit Reason'
    ];

    const rows = filteredTrades.map(trade => [
      new Date(trade.timestamp).toISOString(),
      trade.symbol,
      trade.type,
      trade.side,
      trade.entryPrice,
      trade.exitPrice || '',
      trade.quantity,
      trade.pnl || '',
      trade.pnlPercent || '',
      trade.fees,
      trade.status,
      trade.source,
      trade.strategy || '',
      trade.exitReason || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trade_journal_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast.success('Export CSV réussi');
    setShowExportModal(false);
  }, [filteredTrades]);

  const exportToPDF = useCallback(() => {
    // Simplified PDF export using print to PDF
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast.error('Veuillez autoriser les popups pour l\'export PDF');
      return;
    }

    const html = `
      <html>
        <head>
          <title>NEUROVEST - Journal de Trading</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #3b82f6; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #1e293b; color: white; padding: 10px; text-align: left; }
            td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
            .profit { color: #22c55e; }
            .loss { color: #ef4444; }
            .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
            .card { background: #f8fafc; padding: 15px; border-radius: 8px; }
            .card h3 { margin: 0 0 10px 0; font-size: 14px; color: #64748b; }
            .card p { margin: 0; font-size: 24px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>📊 NEUROVEST - Journal de Trading</h1>
          <p>Généré le ${new Date().toLocaleString('fr-FR')}</p>

          <div class="summary">
            <div class="card">
              <h3>Profit Net</h3>
              <p class="${stats.netProfit >= 0 ? 'profit' : 'loss'}">$${stats.netProfit.toFixed(2)}</p>
            </div>
            <div class="card">
              <h3>Win Rate</h3>
              <p>${stats.winRate.toFixed(1)}%</p>
            </div>
            <div class="card">
              <h3>Trades</h3>
              <p>${stats.totalTrades}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>PnL</th>
                <th>Status</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTrades.map(t => `
                <tr>
                  <td>${new Date(t.timestamp).toLocaleDateString('fr-FR')}</td>
                  <td>${t.symbol}</td>
                  <td>${t.side}</td>
                  <td>$${t.entryPrice.toFixed(2)}</td>
                  <td>${t.exitPrice ? '$' + t.exitPrice.toFixed(2) : '-'}</td>
                  <td class="${(t.pnl || 0) >= 0 ? 'profit' : 'loss'}">${t.pnl ? '$' + t.pnl.toFixed(2) : '-'}</td>
                  <td>${t.status}</td>
                  <td>${t.source}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();

    showToast.success('Export PDF prêt - utilisez la boîte de dialogue d\'impression');
    setShowExportModal(false);
  }, [filteredTrades, stats]);

  // Format helpers
  const formatPrice = (price: number) => `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString('fr-FR');
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}j ${Math.floor((seconds % 86400) / 3600)}h`;
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
      tp_hit: 'bg-green-500/20 text-green-400 border-green-500/30',
      sl_hit: 'bg-red-500/20 text-red-400 border-red-500/30'
    };

    const labels: Record<string, string> = {
      open: 'OUVERT',
      closed: 'FERMÉ',
      pending: 'EN ATTENTE',
      cancelled: 'ANNULÉ',
      tp_hit: '✓ TP ATTEINT',
      sl_hit: '✗ SL TOUCHÉ'
    };

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${styles[status] || styles.closed}`}>
        {labels[status] || status.toUpperCase()}
      </span>
    );
  };

  // Source badge component
  const SourceBadge = ({ source }: { source: string }) => {
    const icons: Record<string, React.ReactNode> = {
      binance: <span className="text-yellow-400">🏦</span>,
      bot: <Bot className="w-3 h-3 text-blue-400" />,
      ai: <Brain className="w-3 h-3 text-purple-400" />,
      manual: <User className="w-3 h-3 text-gray-400" />
    };

    const labels: Record<string, string> = {
      binance: 'Binance',
      bot: 'Bot',
      ai: 'IA',
      manual: 'Manuel'
    };

    return (
      <div className="flex items-center gap-1">
        {icons[source]}
        <span className="text-xs text-gray-400">{labels[source]}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="w-7 h-7 text-crypto-blue" />
          Journal de Trading
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
              showFilters ? 'bg-crypto-blue text-white' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtres
          </button>
          <button
            onClick={runAIAnalysis}
            disabled={analyzing || filteredTrades.length < 5}
            className="px-4 py-2 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Brain className="w-4 h-4" />
            {analyzing ? 'Analyse...' : 'Analyse IA'}
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            disabled={filteredTrades.length === 0}
            className="px-4 py-2 bg-crypto-green/20 text-crypto-green border border-crypto-green/30 rounded-lg hover:bg-crypto-green/30 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={loadAllTrades}
            disabled={loading}
            className="px-4 py-2 bg-crypto-accent rounded-lg hover:bg-crypto-accent/80 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="crypto-card p-3">
          <div className="text-xs text-gray-400">Trades</div>
          <div className="text-xl font-bold">{stats.totalTrades}</div>
          <div className="text-xs text-gray-500">{stats.openTrades} ouverts</div>
        </div>
        <div className="crypto-card p-3">
          <div className="text-xs text-gray-400">Win Rate</div>
          <div className={`text-xl font-bold ${stats.winRate >= 50 ? 'text-crypto-green' : 'text-crypto-red'}`}>
            {stats.winRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">{stats.wins}W / {stats.losses}L</div>
        </div>
        <div className="crypto-card p-3">
          <div className="text-xs text-gray-400">Profit Net</div>
          <div className={`text-xl font-bold ${stats.netProfit >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
            {formatPrice(stats.netProfit)}
          </div>
          <div className="text-xs text-gray-500">après frais</div>
        </div>
        <div className="crypto-card p-3">
          <div className="text-xs text-gray-400">Profit Factor</div>
          <div className={`text-xl font-bold ${stats.profitFactor >= 1.5 ? 'text-crypto-green' : 'text-yellow-400'}`}>
            {stats.profitFactor.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">R/R moyen</div>
        </div>
        <div className="crypto-card p-3">
          <div className="text-xs text-gray-400">Gain Moyen</div>
          <div className="text-xl font-bold text-crypto-green">
            {formatPrice(stats.avgWin)}
          </div>
          <div className="text-xs text-gray-500">par trade gagnant</div>
        </div>
        <div className="crypto-card p-3">
          <div className="text-xs text-gray-400">Perte Moyenne</div>
          <div className="text-xl font-bold text-crypto-red">
            {formatPrice(Math.abs(stats.avgLoss))}
          </div>
          <div className="text-xs text-gray-500">par trade perdant</div>
        </div>
        <div className="crypto-card p-3">
          <div className="text-xs text-gray-400">Meilleur Trade</div>
          <div className="text-xl font-bold text-crypto-green">
            {formatPrice(stats.bestTrade)}
          </div>
          <div className="text-xs text-gray-500">max profit</div>
        </div>
        <div className="crypto-card p-3">
          <div className="text-xs text-gray-400">Pire Trade</div>
          <div className="text-xl font-bold text-crypto-red">
            {formatPrice(stats.worstTrade)}
          </div>
          <div className="text-xs text-gray-500">max perte</div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="crypto-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtres Avancés
            </h3>
            <button
              onClick={() => setFilters({
                dateRange: { start: '', end: '' },
                symbol: '',
                type: 'all',
                side: 'all',
                result: 'all',
                source: 'all',
                strategy: '',
                status: 'all'
              })}
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Réinitialiser
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Date Début</label>
              <input
                type="date"
                value={filters.dateRange.start}
                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, start: e.target.value } }))}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Date Fin</label>
              <input
                type="date"
                value={filters.dateRange.end}
                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, end: e.target.value } }))}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Symbol */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Crypto</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="BTCUSDT..."
                  value={filters.symbol}
                  onChange={(e) => setFilters(prev => ({ ...prev, symbol: e.target.value }))}
                  className="w-full bg-crypto-dark border border-crypto-border rounded-lg pl-9 pr-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">Tous</option>
                <option value="spot">Spot</option>
                <option value="futures">Futures</option>
              </select>
            </div>

            {/* Side */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Direction</label>
              <select
                value={filters.side}
                onChange={(e) => setFilters(prev => ({ ...prev, side: e.target.value as any }))}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">Tous</option>
                <option value="buy">Achat (Buy)</option>
                <option value="sell">Vente (Sell)</option>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>

            {/* Result */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Résultat</label>
              <select
                value={filters.result}
                onChange={(e) => setFilters(prev => ({ ...prev, result: e.target.value as any }))}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">Tous</option>
                <option value="win">Gains uniquement</option>
                <option value="loss">Pertes uniquement</option>
              </select>
            </div>

            {/* Source */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Source</label>
              <select
                value={filters.source}
                onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value as any }))}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">Toutes sources</option>
                <option value="binance">Binance</option>
                <option value="bot">Bot</option>
                <option value="ai">IA</option>
                <option value="manual">Manuel</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Statut</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">Tous</option>
                <option value="open">Ouverts</option>
                <option value="closed">Fermés</option>
                <option value="tp_hit">TP Atteint</option>
                <option value="sl_hit">SL Touché</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Panel */}
      {showAIAnalysis && aiAnalysis && (
        <div className="crypto-card border-purple-500/30 bg-purple-500/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2 text-purple-400">
              <Brain className="w-5 h-5" />
              Analyse IA Ethernal
            </h3>
            <button
              onClick={() => setShowAIAnalysis(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-crypto-dark rounded-lg p-3">
              <div className="text-sm text-gray-400">Performance Globale</div>
              <div className={`text-2xl font-bold ${aiAnalysis.winRate >= 50 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                {aiAnalysis.winRate.toFixed(1)}% Win Rate
              </div>
              <div className="text-xs text-gray-500">Profit Factor: {aiAnalysis.profitFactor.toFixed(2)}</div>
            </div>
            <div className="bg-crypto-dark rounded-lg p-3">
              <div className="text-sm text-gray-400">Extremes</div>
              <div className="text-sm">
                <span className="text-crypto-green">Best: {formatPrice(aiAnalysis.bestTrade)}</span>
              </div>
              <div className="text-sm">
                <span className="text-crypto-red">Worst: {formatPrice(aiAnalysis.worstTrade)}</span>
              </div>
            </div>
            <div className="bg-crypto-dark rounded-lg p-3">
              <div className="text-sm text-gray-400">Moyennes</div>
              <div className="text-sm text-crypto-green">Gain moyen: {formatPrice(aiAnalysis.avgWin)}</div>
              <div className="text-sm text-crypto-red">Perte moyenne: {formatPrice(Math.abs(aiAnalysis.avgLoss))}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiAnalysis.strengths.length > 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <h4 className="text-green-400 font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Points Forts
                </h4>
                <ul className="space-y-1">
                  {aiAnalysis.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-green-400 mt-1">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiAnalysis.mistakes.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <h4 className="text-red-400 font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Erreurs Détectées
                </h4>
                <ul className="space-y-1">
                  {aiAnalysis.mistakes.map((m, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-red-400 mt-1">✗</span>
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiAnalysis.recommendations.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <h4 className="text-blue-400 font-medium mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Recommandations
                </h4>
                <ul className="space-y-1">
                  {aiAnalysis.recommendations.map((r, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-blue-400 mt-1">→</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts & Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Equity Curve */}
          <div className="crypto-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-crypto-blue" />
              Évolution du Capital
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Cumulé']}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PnL Distribution */}
          <div className="crypto-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-crypto-blue" />
              Distribution Gains/Pertes
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={pnlDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pnlDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                  <Legend />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Source Distribution */}
          <div className="crypto-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-crypto-blue" />
              Trades par Source
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    {sourceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PnL Histogram */}
          <div className="crypto-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-crypto-blue" />
              Histogramme PnL
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredTrades.filter(t => t.pnl !== undefined).map(t => ({
                  name: t.symbol,
                  pnl: t.pnl,
                  fill: (t.pnl || 0) >= 0 ? '#22c55e' : '#ef4444'
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={10} />
                  <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    formatter={(value) => [`$${Number(value).toFixed(2)}`, 'PnL']}
                  />
                  <Bar dataKey="pnl" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Strategies Tab */}
      {activeTab === 'strategies' && (
        <div className="crypto-card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-crypto-blue" />
            Performance par Stratégie
          </h3>

          {strategyPerformance.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucune stratégie définie sur les trades</p>
              <p className="text-sm mt-1">Les stratégies sont attribuées lors de la création des trades</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-crypto-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Stratégie</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Trades</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Win Rate</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">PnL Total</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {strategyPerformance.map((strat) => (
                    <tr key={strat.name} className="border-b border-crypto-border/50 hover:bg-slate-800/50">
                      <td className="py-3 px-4">
                        <span className="font-medium">{strat.name}</span>
                      </td>
                      <td className="py-3 px-4 text-center">{strat.trades}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-medium ${strat.winRate >= 50 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                          {strat.winRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-medium ${strat.pnl >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                          {formatPrice(strat.pnl)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setFilters(prev => ({ ...prev, strategy: strat.name }));
                            setActiveTab('trades');
                          }}
                          className="text-crypto-blue hover:text-crypto-blue/80 text-sm flex items-center gap-1 justify-center"
                        >
                          Voir trades <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-crypto-border">
        {[
          { id: 'trades', label: 'Liste des Trades', icon: History },
          { id: 'analytics', label: 'Analytiques', icon: BarChart3 },
          { id: 'strategies', label: 'Stratégies', icon: Target }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 flex items-center gap-2 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-crypto-blue text-crypto-blue'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Trades List */}
      {activeTab === 'trades' && (
        <div className="crypto-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Trades ({filteredTrades.length})
            </h2>
            <div className="text-sm text-gray-400">
              {stats.closedTrades} fermés • {stats.openTrades} ouverts
            </div>
          </div>

          {filteredTrades.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">Aucun trade trouvé</p>
              <p className="text-sm mt-2">Ajustez les filtres ou chargez vos données</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="p-4 rounded-lg border border-crypto-border bg-slate-800/30 hover:bg-slate-800/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    {/* Left: Symbol & Info */}
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        (trade.pnl || 0) > 0 ? 'bg-green-500/20' : (trade.pnl || 0) < 0 ? 'bg-red-500/20' : 'bg-gray-500/20'
                      }`}>
                        {(trade.pnl || 0) > 0 ? (
                          <TrendingUp className="w-5 h-5 text-green-400" />
                        ) : (trade.pnl || 0) < 0 ? (
                          <TrendingDown className="w-5 h-5 text-red-400" />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{trade.symbol}</span>
                          <StatusBadge status={trade.status} />
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            trade.side === 'buy' || trade.side === 'LONG'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {trade.side.toUpperCase()}
                          </span>
                          {trade.type === 'futures' && (
                            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                              {trade.leverage}x
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                          <SourceBadge source={trade.source} />
                          <span>{formatDate(trade.timestamp)}</span>
                          {trade.duration && (
                            <span>• Durée: {formatDuration(trade.duration)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Center: Prices */}
                    <div className="hidden md:flex flex-col items-end text-sm">
                      <div className="text-gray-400">
                        Entry: <span className="text-white font-mono">{formatPrice(trade.entryPrice)}</span>
                      </div>
                      {trade.exitPrice && (
                        <div className="text-gray-400">
                          Exit: <span className="text-white font-mono">{formatPrice(trade.exitPrice)}</span>
                        </div>
                      )}
                      {trade.stopLoss && (
                        <div className="text-xs text-red-400">
                          SL: {formatPrice(trade.stopLoss)}
                        </div>
                      )}
                      {trade.takeProfit && (
                        <div className="text-xs text-green-400">
                          TP: {formatPrice(trade.takeProfit)}
                        </div>
                      )}
                    </div>

                    {/* Right: PnL */}
                    <div className="text-right">
                      {trade.pnl !== undefined ? (
                        <>
                          <div className={`text-xl font-bold font-mono ${
                            trade.pnl > 0 ? 'text-crypto-green' : trade.pnl < 0 ? 'text-crypto-red' : 'text-gray-400'
                          }`}>
                            {trade.pnl > 0 ? '+' : ''}{formatPrice(trade.pnl)}
                          </div>
                          <div className={`text-sm font-mono ${
                            (trade.pnlPercent || 0) > 0 ? 'text-crypto-green/70' : 'text-crypto-red/70'
                          }`}>
                            {(trade.pnlPercent || 0) > 0 ? '+' : ''}{(trade.pnlPercent || 0).toFixed(2)}%
                          </div>
                        </>
                      ) : (
                        <div className="text-gray-400">-</div>
                      )}
                      <div className="text-xs text-gray-500">
                        Qty: {trade.quantity.toFixed(6)}
                      </div>
                    </div>

                    {/* Expand Button */}
                    <button
                      onClick={() => setExpandedTrade(expandedTrade === trade.id ? null : trade.id)}
                      className="ml-4 p-1 text-gray-400 hover:text-white"
                    >
                      {expandedTrade === trade.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {expandedTrade === trade.id && (
                    <div className="mt-4 pt-4 border-t border-crypto-border">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400 block">Trade ID</span>
                          <span className="font-mono text-xs">{trade.id}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">Order ID</span>
                          <span className="font-mono text-xs">{trade.orderId || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">Frais</span>
                          <span className="font-mono">{formatPrice(trade.fees)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">Type</span>
                          <span className="capitalize">{trade.type}</span>
                        </div>
                        {trade.strategy && (
                          <div>
                            <span className="text-gray-400 block">Stratégie</span>
                            <span className="text-crypto-blue">{trade.strategy}</span>
                          </div>
                        )}
                        {trade.confidence && (
                          <div>
                            <span className="text-gray-400 block">Confiance IA</span>
                            <span className="text-purple-400">{trade.confidence}%</span>
                          </div>
                        )}
                        {trade.exitReason && (
                          <div>
                            <span className="text-gray-400 block">Raison Sortie</span>
                            <span className="capitalize">{trade.exitReason.replace('_', ' ')}</span>
                          </div>
                        )}
                        {trade.marginType && (
                          <div>
                            <span className="text-gray-400 block">Margin</span>
                            <span className="capitalize">{trade.marginType}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-crypto-border rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Exporter le Journal</h3>
            <p className="text-gray-400 text-sm mb-6">
              {filteredTrades.length} trades seront exportés avec tous les détails
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={exportToCSV}
                className="p-4 bg-slate-800 border border-crypto-border rounded-lg hover:bg-slate-700 transition-all flex flex-col items-center gap-2"
              >
                <FileSpreadsheet className="w-8 h-8 text-green-400" />
                <span className="font-medium">Export CSV</span>
                <span className="text-xs text-gray-400">Pour Excel/Sheets</span>
              </button>

              <button
                onClick={exportToPDF}
                className="p-4 bg-slate-800 border border-crypto-border rounded-lg hover:bg-slate-700 transition-all flex flex-col items-center gap-2"
              >
                <FileText className="w-8 h-8 text-red-400" />
                <span className="font-medium">Export PDF</span>
                <span className="text-xs text-gray-400">Pour impression</span>
              </button>
            </div>

            <button
              onClick={() => setShowExportModal(false)}
              className="w-full mt-4 px-4 py-2 bg-slate-800 text-gray-300 rounded-lg hover:bg-slate-700 transition-all"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
