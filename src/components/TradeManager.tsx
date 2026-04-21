/**
 * NEUROVEST - Trade Manager Component
 * Interface complète pour la gestion des trades
 * Intégration avec tous les modules du système
 */

import React, { useEffect, useState, useCallback } from 'react';
import { 
  LineChart, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  StopCircle, 
  Clock,
  Bot,
  Brain,
  User,
  Filter,
  RefreshCw,
  X,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  History,
  BarChart3,
  PieChart,
  ArrowRightLeft
} from 'lucide-react';
import { useTradeStore } from '../stores/tradeStore';
// WebSocket store mock
const useWebSocketStore = {
  getState: () => ({
    on: () => {},
    off: () => {}
  })
};
import { showToast } from '../stores/toastStore';
import type { Trade } from '../services/tradeService';
import * as tradeService from '../services/tradeService';
import { formatXOF } from '../utils/currency';

// Types
interface TradeFormData {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  leverage: string;
  paperTrading: boolean;
}

// Composant principal
export default function TradeManager() {
  // Store state
  const {
    openTrades,
    closedTrades,
    pendingTrades,
    stats,
    loading,
    error,
    fetchTrades,
    fetchStats,
    refreshAll,
    closeTrade,
    cancelTrade,
    updateTrade,
    selectTrade,
    selectedTrade,
    filters,
    setFilter,
    getTotalUnrealizedPnl
  } = useTradeStore();

  // Local state
  const [activeTab, setActiveTab] = useState<'open' | 'closed' | 'pending' | 'stats'>('open');
  const [showNewTradeForm, setShowNewTradeForm] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [closingTrade, setClosingTrade] = useState<{ trade: Trade; price: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState<TradeFormData>({
    symbol: '',
    side: 'buy',
    type: 'market',
    quantity: '',
    entryPrice: '',
    stopLoss: '',
    takeProfit: '',
    leverage: '1',
    paperTrading: true
  });

  // WebSocket subscription
  useEffect(() => {
    const wsStore = useWebSocketStore.getState();
    
    // Souscrire aux événements de trades
    const unsubscribe = tradeService.subscribeToTradeEvents({
      onTradeCreated: (trade) => {
        showToast.success(`Nouveau trade créé: ${trade.symbol}`, 'Trade');
        fetchTrades();
      },
      onTradeExecuted: (trade) => {
        showToast.success(`Trade exécuté: ${trade.symbol}`, 'Trade');
        fetchTrades();
      },
      onTradeUpdate: (data) => {
        // Mise à jour temps réel du PnL
        useTradeStore.getState().updateTradePnL(data.tradeId, data.unrealizedPnl, data.pnlPercent, data.currentPrice);
      },
      onTradeClosed: (trade) => {
        const isWin = (trade.pnl || 0) > 0;
        const message = `Trade fermé: ${trade.symbol} ${isWin ? '+' : ''}${trade.pnl?.toFixed(2)} USDT`;
        if (isWin) {
          showToast.success(message, 'Profit!');
        } else {
          showToast.error(message, 'Perte');
        }
        fetchTrades();
        fetchStats();
      },
      onNotification: (notification) => {
        showToast.info(notification.message, notification.title);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [fetchTrades, fetchStats]);

  // Initial fetch
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Auto refresh toutes les 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTrades('open');
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchTrades]);

  // Handlers
  const handleCreateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validation
      const validation = await tradeService.validateTrade({
        symbol: formData.symbol,
        side: formData.side,
        quantity: parseFloat(formData.quantity),
        entryPrice: parseFloat(formData.entryPrice),
        stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss) : undefined,
        takeProfit: formData.takeProfit ? parseFloat(formData.takeProfit) : undefined,
        leverage: parseInt(formData.leverage)
      });

      if (!validation.valid) {
        showToast.error(validation.errors.join(', '), 'Validation échouée');
        return;
      }

      // Création
      const result = await tradeService.createTrade({
        symbol: formData.symbol,
        side: formData.side,
        type: formData.type,
        quantity: parseFloat(formData.quantity),
        entryPrice: parseFloat(formData.entryPrice),
        stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss) : undefined,
        takeProfit: formData.takeProfit ? parseFloat(formData.takeProfit) : undefined,
        leverage: parseInt(formData.leverage),
        paperTrading: formData.paperTrading,
        source: 'manual'
      });

      if (result.success) {
        showToast.success('Trade créé avec succès', 'Succès');
        setShowNewTradeForm(false);
        setFormData({
          symbol: '',
          side: 'buy',
          type: 'market',
          quantity: '',
          entryPrice: '',
          stopLoss: '',
          takeProfit: '',
          leverage: '1',
          paperTrading: true
        });
        fetchTrades('open');
      }
    } catch (error: any) {
      showToast.error(error.message, 'Erreur');
    }
  };

  const handleCloseTrade = async () => {
    if (!closingTrade) return;
    
    try {
      const result = await closeTrade(closingTrade.trade._id, parseFloat(closingTrade.price), 'manual');
      if (result) {
        showToast.success('Trade fermé avec succès', 'Succès');
        setClosingTrade(null);
      }
    } catch (error: any) {
      showToast.error(error.message, 'Erreur');
    }
  };

  const handleCancelTrade = async (tradeId: string) => {
    try {
      const result = await cancelTrade(tradeId);
      if (result) {
        showToast.success('Trade annulé', 'Succès');
        fetchTrades('pending');
      }
    } catch (error: any) {
      showToast.error(error.message, 'Erreur');
    }
  };

  const handleUpdateSLTP = async (tradeId: string, updates: { stopLoss?: number; takeProfit?: number }) => {
    try {
      const result = await updateTrade(tradeId, updates);
      if (result) {
        showToast.success('Trade mis à jour', 'Succès');
        setEditingTrade(null);
      }
    } catch (error: any) {
      showToast.error(error.message, 'Erreur');
    }
  };

  // Renders
  const renderNewTradeForm = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-crypto-card rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Nouveau Trade</h3>
          <button onClick={() => setShowNewTradeForm(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateTrade} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400">Symbol</label>
            <input
              type="text"
              value={formData.symbol}
              onChange={e => setFormData({...formData, symbol: e.target.value.toUpperCase()})}
              placeholder="BTCUSDT"
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-400">Direction</label>
              <select
                value={formData.side}
                onChange={e => setFormData({...formData, side: e.target.value as 'buy' | 'sell'})}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
              >
                <option value="buy">Achat (Long)</option>
                <option value="sell">Vente (Short)</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400">Type</label>
              <select
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as 'market' | 'limit'})}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-400">Quantité</label>
              <input
                type="number"
                step="0.0001"
                value={formData.quantity}
                onChange={e => setFormData({...formData, quantity: e.target.value})}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Prix d'entrée</label>
              <input
                type="number"
                step="0.01"
                value={formData.entryPrice}
                onChange={e => setFormData({...formData, entryPrice: e.target.value})}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-400">Stop Loss</label>
              <input
                type="number"
                step="0.01"
                value={formData.stopLoss}
                onChange={e => setFormData({...formData, stopLoss: e.target.value})}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Take Profit</label>
              <input
                type="number"
                step="0.01"
                value={formData.takeProfit}
                onChange={e => setFormData({...formData, takeProfit: e.target.value})}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-400">Levier</label>
              <input
                type="number"
                min="1"
                max="125"
                value={formData.leverage}
                onChange={e => setFormData({...formData, leverage: e.target.value})}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="paperTrading"
                checked={formData.paperTrading}
                onChange={e => setFormData({...formData, paperTrading: e.target.checked})}
                className="rounded"
              />
              <label htmlFor="paperTrading" className="text-sm">Paper Trading</label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-crypto-blue hover:bg-crypto-blue/80 rounded-lg font-medium transition-colors"
          >
            Créer le Trade
          </button>
        </form>
      </div>
    </div>
  );

  const renderCloseModal = () => {
    if (!closingTrade) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-crypto-card rounded-xl p-6 w-full max-w-sm">
          <h3 className="text-lg font-bold mb-4">Fermer le Trade</h3>
          <p className="text-sm text-gray-400 mb-4">
            {closingTrade.trade.symbol} - {closingTrade.trade.side}
          </p>
          
          <div className="mb-4">
            <label className="text-sm text-gray-400">Prix de sortie</label>
            <input
              type="number"
              step="0.01"
              value={closingTrade.price}
              onChange={e => setClosingTrade({...closingTrade, price: e.target.value})}
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setClosingTrade(null)}
              className="flex-1 py-2 bg-crypto-dark hover:bg-crypto-gray rounded-lg"
            >
              Annuler
            </button>
            <button
              onClick={handleCloseTrade}
              className="flex-1 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTradeRow = (trade: Trade) => {
    const isLong = trade.side === 'buy' || trade.side === 'LONG';
    const pnl = trade.status === 'open' ? (trade.unrealizedPnl || 0) : (trade.pnl || 0);
    const pnlPercent = trade.status === 'open' ? (trade.pnlPercent || 0) : (trade.pnlPercent || 0);
    const isProfit = pnl >= 0;

    return (
      <div
        key={trade._id}
        className="bg-crypto-dark/50 rounded-lg p-4 hover:bg-crypto-dark transition-colors"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded ${
              trade.source === 'bot' ? 'bg-purple-500/20 text-purple-400' :
              trade.source === 'ai' ? 'bg-blue-500/20 text-blue-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {trade.source === 'bot' ? <Bot className="w-3 h-3 inline mr-1" /> :
               trade.source === 'ai' ? <Brain className="w-3 h-3 inline mr-1" /> :
               <User className="w-3 h-3 inline mr-1" />}
              {trade.source}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-crypto-gray">
              {trade.paperTrading ? 'Paper' : 'Real'}
            </span>
            {trade.leverage > 1 && (
              <span className="text-xs text-crypto-accent">{trade.leverage}x</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isProfit ? 'text-crypto-green' : 'text-crypto-red'}`}>
              {isProfit ? '+' : ''}{pnl.toFixed(2)} USDT ({pnlPercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-400 text-xs">Symbol</div>
            <div className="font-medium flex items-center gap-1">
              {isLong ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
              {trade.symbol}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Entrée</div>
            <div className="font-mono">{trade.averageEntryPrice?.toFixed(2) || trade.entryPrice.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Quantité</div>
            <div className="font-mono">{trade.filledQuantity || trade.quantity}</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Status</div>
            <span className={`text-xs ${
              trade.status === 'open' ? 'text-blue-400' :
              trade.status === 'closed' ? 'text-gray-400' :
              trade.status === 'pending' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {trade.status}
            </span>
          </div>
        </div>

        {trade.status === 'open' && (
          <div className="mt-3 pt-3 border-t border-crypto-border/50 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs">
              {trade.stopLoss && (
                <span className="text-red-400">
                  <StopCircle className="w-3 h-3 inline mr-1" />
                  SL: {trade.stopLoss.toFixed(2)}
                </span>
              )}
              {trade.takeProfit && (
                <span className="text-green-400">
                  <Target className="w-3 h-3 inline mr-1" />
                  TP: {trade.takeProfit.toFixed(2)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingTrade(trade)}
                className="p-1.5 bg-crypto-gray hover:bg-crypto-gray/80 rounded text-xs"
              >
                Modifier
              </button>
              <button
                onClick={() => setClosingTrade({ trade, price: '' })}
                className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {trade.status === 'closed' && trade.exitReason && (
          <div className="mt-3 pt-3 border-t border-crypto-border/50 text-xs text-gray-400">
            Fermé: {trade.exitReason} | PnL: {trade.pnl?.toFixed(2)} USDT
            {trade.duration && (
              <span className="ml-2">
                | Durée: {tradeService.formatTradeDuration(trade.duration)}
              </span>
            )}
          </div>
        )}

        {trade.status === 'pending' && (
          <div className="mt-3 pt-3 border-t border-crypto-border/50 flex justify-end">
            <button
              onClick={() => handleCancelTrade(trade._id)}
              className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderStats = () => {
    if (!stats) return null;

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-crypto-dark rounded-lg p-4">
          <div className="text-sm text-gray-400">Trades Total</div>
          <div className="text-2xl font-bold">{stats.totalTrades}</div>
          <div className="text-xs text-gray-500">{stats.openTrades} ouverts</div>
        </div>
        <div className="bg-crypto-dark rounded-lg p-4">
          <div className="text-sm text-gray-400">Win Rate</div>
          <div className={`text-2xl font-bold ${stats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.winRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">{stats.winningTrades} gagnants / {stats.losingTrades} perdants</div>
        </div>
        <div className="bg-crypto-dark rounded-lg p-4">
          <div className="text-sm text-gray-400">Profit Total</div>
          <div className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">USDT</div>
        </div>
        <div className="bg-crypto-dark rounded-lg p-4">
          <div className="text-sm text-gray-400">PnL Non Réalisé</div>
          <div className={`text-2xl font-bold ${stats.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.unrealizedPnl >= 0 ? '+' : ''}{stats.unrealizedPnl.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">USDT</div>
        </div>

        <div className="bg-crypto-dark rounded-lg p-4">
          <div className="text-sm text-gray-400">Profit Factor</div>
          <div className={`text-2xl font-bold ${stats.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.profitFactor.toFixed(2)}
          </div>
        </div>
        <div className="bg-crypto-dark rounded-lg p-4">
          <div className="text-sm text-gray-400">Meilleur Trade</div>
          <div className="text-2xl font-bold text-green-400">+{stats.bestTrade.toFixed(2)}</div>
        </div>
        <div className="bg-crypto-dark rounded-lg p-4">
          <div className="text-sm text-gray-400">Pire Trade</div>
          <div className="text-2xl font-bold text-red-400">{stats.worstTrade.toFixed(2)}</div>
        </div>
        <div className="bg-crypto-dark rounded-lg p-4">
          <div className="text-sm text-gray-400">Profit Moyen</div>
          <div className={`text-2xl font-bold ${stats.averageProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.averageProfit >= 0 ? '+' : ''}{stats.averageProfit.toFixed(2)}
          </div>
        </div>

        {/* Répartition par source */}
        <div className="col-span-2 md:col-span-4 bg-crypto-dark rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-3">Répartition par Source</div>
          <div className="flex gap-4">
            <div className="flex-1 bg-gray-500/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.tradesBySource.manual}</div>
              <div className="text-xs text-gray-400">Manuel</div>
            </div>
            <div className="flex-1 bg-purple-500/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-400">{stats.tradesBySource.bot}</div>
              <div className="text-xs text-gray-400">Bot</div>
            </div>
            <div className="flex-1 bg-blue-500/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.tradesBySource.ai}</div>
              <div className="text-xs text-gray-400">IA</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-crypto-blue" />
            Gestion des Trades
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Système centralisé de tracking et d'exécution
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm text-gray-400">PnL Non Réalisé</div>
            <div className={`text-lg font-bold ${getTotalUnrealizedPnl() >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {getTotalUnrealizedPnl() >= 0 ? '+' : ''}{getTotalUnrealizedPnl().toFixed(2)} USDT
            </div>
          </div>
          <button
            onClick={() => refreshAll()}
            disabled={loading}
            className="p-2 bg-crypto-dark hover:bg-crypto-gray rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowNewTradeForm(true)}
            className="px-4 py-2 bg-crypto-blue hover:bg-crypto-blue/80 rounded-lg font-medium transition-colors"
          >
            Nouveau Trade
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-crypto-dark rounded-lg p-1">
        {[
          { id: 'open', label: `Ouverts (${openTrades.length})`, icon: LineChart },
          { id: 'closed', label: `Historique (${closedTrades.length})`, icon: History },
          { id: 'pending', label: `Pending (${pendingTrades.length})`, icon: Clock },
          { id: 'stats', label: 'Statistiques', icon: BarChart3 }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-crypto-blue text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {activeTab === 'open' && (
          openTrades.length > 0 ? (
            openTrades.map(renderTradeRow)
          ) : (
            <div className="text-center py-12 text-gray-400">
              <LineChart className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucun trade ouvert</p>
              <button
                onClick={() => setShowNewTradeForm(true)}
                className="mt-4 text-crypto-blue hover:underline"
              >
                Créer un trade
              </button>
            </div>
          )
        )}

        {activeTab === 'closed' && (
          closedTrades.length > 0 ? (
            <>
              {closedTrades.slice(0, 20).map(renderTradeRow)}
              {closedTrades.length > 20 && (
                <div className="text-center py-4 text-gray-400 text-sm">
                  Et {closedTrades.length - 20} trades supplémentaires...
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucun trade dans l'historique</p>
            </div>
          )
        )}

        {activeTab === 'pending' && (
          pendingTrades.length > 0 ? (
            pendingTrades.map(renderTradeRow)
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucun trade en attente</p>
            </div>
          )
        )}

        {activeTab === 'stats' && renderStats()}
      </div>

      {/* Modals */}
      {showNewTradeForm && renderNewTradeForm()}
      {renderCloseModal()}
    </div>
  );
}
