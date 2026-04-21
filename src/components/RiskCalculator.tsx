import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { FCFAConverter } from './FCFAConverter';
import { 
  calculateRisk, 
  calculateTakeProfit, 
  kellyCriterion,
  calculatePositionSizeDetailed,
  calculateATR,
  adjustForVolatility,
  calculateTrailingStop,
  validateTradeRisk,
  calculateGlobalRiskMetrics,
  checkRiskLimits,
  DEFAULT_RISK_CONFIG,
  formatPercent,
  formatCurrency,
  getRiskLevelColor,
  getRiskLevelBg,
  type TrailingStopParams,
} from '../utils/riskCalculator';
import { 
  Calculator, 
  Target, 
  Shield, 
  TrendingUp, 
  Percent, 
  DollarSign, 
  Scale,
  Settings,
  Activity,
  AlertTriangle,
  Lock,
  TrendingDown,
  Wind,
  Zap,
  CheckCircle,
  XCircle,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Timer,
  Maximize2,
  BookOpen,
  Eye,
  EyeOff,
  Ban,
  Circle,
} from 'lucide-react';
import type { RiskCalculation, RiskConfig, TradeRiskValidation, GlobalRiskMetrics, CandleData, Trade } from '../types';

type TabType = 'calculator' | 'dashboard' | 'config' | 'trailing' | 'validation';

export default function RiskCalculator() {
  const prices = useCryptoStore((state) => state.prices);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  const trades = useCryptoStore((state) => state.trades);
  const candleData = useCryptoStore((state) => state.candleData);

  const [activeTab, setActiveTab] = useState<TabType>('calculator');
  const [entryPrice, setEntryPrice] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [takeProfit, setTakeProfit] = useState(0);
  const [riskReward, setRiskReward] = useState(2);
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(2);
  const [isLong, setIsLong] = useState(true);
  const [showFormula, setShowFormula] = useState(true);
  const [riskConfig, setRiskConfig] = useState<RiskConfig>(DEFAULT_RISK_CONFIG);
  const [trailingConfig, setTrailingConfig] = useState<TrailingStopParams>({
    enabled: true,
    activationPercent: 1,
    trailingPercent: 1,
    breakevenAtPercent: 2,
  });
  const [highestPrice, setHighestPrice] = useState(0);
  const [validation, setValidation] = useState<TradeRiskValidation | null>(null);

  const calculation = useMemo(() => {
    if (entryPrice > 0 && stopLoss > 0 && takeProfit > 0 && accountSize > 0) {
      return calculateRisk(entryPrice, stopLoss, takeProfit, accountSize, riskPercent);
    }
    return null;
  }, [entryPrice, stopLoss, takeProfit, accountSize, riskPercent]);

  const detailedCalc = useMemo(() => {
    if (entryPrice > 0 && stopLoss > 0 && takeProfit > 0 && accountSize > 0) {
      return calculatePositionSizeDetailed(accountSize, riskPercent, entryPrice, stopLoss, takeProfit);
    }
    return null;
  }, [entryPrice, stopLoss, takeProfit, accountSize, riskPercent]);

  const volatilityData = useMemo(() => {
    if (candleData.length < 14 || !entryPrice) return null;
    const atr = calculateATR(candleData as CandleData[], 14);
    if (!detailedCalc) return null;
    return adjustForVolatility(entryPrice, stopLoss || entryPrice * 0.98, takeProfit || entryPrice * 1.04, atr, detailedCalc.positionSize, isLong);
  }, [candleData, entryPrice, stopLoss, takeProfit, detailedCalc, isLong]);

  const globalMetrics = useMemo(() => {
    const mappedTrades = trades.map(t => ({
      status: t.status,
      pnl: t.pnl || 0,
      entryPrice: t.entryPrice,
      quantity: t.quantity,
      symbol: t.symbol,
      stopLoss: t.stopLoss,
    }));
    return calculateGlobalRiskMetrics(mappedTrades, accountSize, riskConfig);
  }, [trades, accountSize, riskConfig]);

  const dailyLoss = useMemo(() => {
    const today = new Date().toDateString();
    return trades
      .filter(t => t.status === 'closed' && new Date().toDateString() === today)
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
  }, [trades]);

  const riskLimits = useMemo(() => {
    const maxDrawdown = globalMetrics.currentDrawdown;
    return checkRiskLimits(accountSize, dailyLoss, maxDrawdown, riskConfig);
  }, [accountSize, dailyLoss, globalMetrics.currentDrawdown, riskConfig]);

  const kellyStats = useMemo(() => {
    const closedTrades = trades.filter((t) => t.status === 'closed');
    const winningTrades = closedTrades.filter((t) => (t.pnl || 0) > 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 50;
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length
      : 0;
    const avgLoss = closedTrades.filter((t) => (t.pnl || 0) < 0).length > 0
      ? closedTrades.filter((t) => (t.pnl || 0) < 0).reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / closedTrades.filter((t) => (t.pnl || 0) < 0).length
      : 1;
    const kellyPercent = avgLoss > 0 ? kellyCriterion(winRate, avgWin, avgLoss) : 0;
    return { winRate, avgWin, avgLoss, kellyPercent, totalTrades: closedTrades.length };
  }, [trades]);

  useEffect(() => {
    const currentPrice = prices.get(selectedSymbol)?.price || 0;
    if (currentPrice > 0 && entryPrice === 0) {
      setEntryPrice(currentPrice);
      setHighestPrice(currentPrice);
    }
  }, [prices, selectedSymbol, entryPrice]);

  useEffect(() => {
    if (entryPrice > 0 && stopLoss > 0) {
      const tp = isLong
        ? entryPrice + (entryPrice - stopLoss) * riskReward
        : entryPrice - (stopLoss - entryPrice) * riskReward;
      setTakeProfit(tp);
    }
  }, [entryPrice, stopLoss, riskReward, isLong]);

  useEffect(() => {
    if (entryPrice > 0 && stopLoss > 0 && accountSize > 0) {
      const openTrades = trades.filter(t => t.status === 'open').map(t => ({ symbol: t.symbol, riskPercent: riskPercent }));
      const validation = validateTradeRisk(
        selectedSymbol,
        entryPrice,
        stopLoss,
        takeProfit || entryPrice * 1.04,
        accountSize,
        riskPercent,
        openTrades,
        dailyLoss,
        riskConfig
      );
      setValidation(validation);
    }
  }, [entryPrice, stopLoss, takeProfit, accountSize, riskPercent, selectedSymbol, trades, dailyLoss, riskConfig]);

  const setQuickStopLoss = useCallback((percent: number) => {
    if (entryPrice > 0) {
      const sl = isLong
        ? entryPrice * (1 - percent / 100)
        : entryPrice * (1 + percent / 100);
      setStopLoss(sl);
    }
  }, [entryPrice, isLong]);

  const applyVolatilityAdjustment = useCallback(() => {
    if (volatilityData) {
      setStopLoss(volatilityData.adjustedStopLoss);
      setTakeProfit(volatilityData.adjustedTakeProfit);
    }
  }, [volatilityData]);

  const trailingStatus = useMemo(() => {
    if (!entryPrice || !stopLoss) return null;
    const currentPrice = prices.get(selectedSymbol)?.price || entryPrice;
    const newHighest = Math.max(highestPrice, currentPrice);
    if (newHighest > highestPrice) setHighestPrice(newHighest);
    return calculateTrailingStop(entryPrice, currentPrice, stopLoss, highestPrice, isLong, trailingConfig);
  }, [entryPrice, stopLoss, prices, selectedSymbol, highestPrice, isLong, trailingConfig]);

  return (
    <div className="space-y-6">
      <div className="crypto-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-crypto-blue" />
              Gestion du Risque NEUROVEST
            </h1>
            <p className="text-sm text-gray-400 mt-1">Protection du capital • Maximisation des gains à long terme</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'calculator', icon: Calculator, label: 'Calculateur' },
              { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
              { id: 'config', icon: Settings, label: 'Configuration' },
              { id: 'trailing', icon: TrendingUp, label: 'Trailing Stop' },
              { id: 'validation', icon: CheckCircle, label: 'Validation' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-crypto-blue text-white'
                    : 'bg-crypto-dark text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {riskLimits.blockedReason && (
          <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
            <AlertOctagon className="w-6 h-6 text-red-400" />
            <div>
              <div className="font-semibold text-red-400 flex items-center gap-2"><Ban className="w-4 h-4" /> Trading Bloqué</div>
              <div className="text-sm text-gray-300">{riskLimits.blockedReason}</div>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4">
          <span className="text-sm text-gray-400">Niveau de risque global:</span>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${getRiskLevelBg(globalMetrics.riskLevel)} ${getRiskLevelColor(globalMetrics.riskLevel)}`}>
            {globalMetrics.riskLevel === 'safe' && <span className="flex items-center gap-1"><Circle className="w-3 h-3 fill-green-400 text-green-400" /> SÉCURISÉ</span>}
            {globalMetrics.riskLevel === 'caution' && <span className="flex items-center gap-1"><Circle className="w-3 h-3 fill-yellow-400 text-yellow-400" /> ATTENTION</span>}
            {globalMetrics.riskLevel === 'danger' && <span className="flex items-center gap-1"><Circle className="w-3 h-3 fill-orange-400 text-orange-400" /> DANGER</span>}
            {globalMetrics.riskLevel === 'critical' && <span className="flex items-center gap-1"><Circle className="w-3 h-3 fill-red-400 text-red-400" /> CRITIQUE</span>}
          </span>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="crypto-card">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-crypto-blue" />
              <span className="text-sm text-gray-400">Exposition Totale</span>
            </div>
            <div className="text-2xl font-bold">{formatPercent(globalMetrics.exposurePercent)}</div>
            <div className="text-xs text-gray-500">{formatCurrency(globalMetrics.totalExposure)}</div>
          </div>

          <div className="crypto-card">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-5 h-5 text-crypto-red" />
              <span className="text-sm text-gray-400">Drawdown Actuel</span>
            </div>
            <div className={`text-2xl font-bold ${globalMetrics.currentDrawdown > 5 ? 'text-crypto-red' : 'text-crypto-green'}`}>
              {formatPercent(globalMetrics.currentDrawdown)}
            </div>
            <div className="text-xs text-gray-500">Limite: {formatPercent(riskConfig.maxDrawdown)}</div>
          </div>

          <div className="crypto-card">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-crypto-green" />
              <span className="text-sm text-gray-400">P&L Journalier</span>
            </div>
            <div className={`text-2xl font-bold ${globalMetrics.dailyPnlPercent >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
              {formatPercent(globalMetrics.dailyPnlPercent)}
            </div>
            <div className="text-xs text-gray-500">{formatCurrency(globalMetrics.dailyPnl)}</div>
          </div>

          <div className="crypto-card">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-5 h-5 text-crypto-purple" />
              <span className="text-sm text-gray-400">Perte Restante</span>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(riskLimits.dailyLossRemaining)}</div>
            <div className="text-xs text-gray-500">Utilisé: {formatCurrency(riskLimits.dailyLossUsed)}</div>
          </div>

          <div className="crypto-card col-span-1 md:col-span-2 lg:col-span-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-crypto-blue" />
              Analyse du Risque Global
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-gray-400 mb-2">Trades Ouverts</div>
                <div className="text-3xl font-bold">{globalMetrics.openTradeCount} <span className="text-sm text-gray-500">/ {riskConfig.maxOpenTrades}</span></div>
                <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                  <div className="bg-crypto-blue h-2 rounded-full transition-all" style={{ width: `${(globalMetrics.openTradeCount / riskConfig.maxOpenTrades) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-2">Corrélation</div>
                <div className="text-3xl font-bold">{globalMetrics.correlationRisk}%</div>
                <div className="text-xs text-gray-500">Diversification des positions</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-2">P&L Non Réalisé</div>
                <div className={`text-3xl font-bold ${globalMetrics.unrealizedPnl >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                  {formatCurrency(globalMetrics.unrealizedPnl)}
                </div>
              </div>
            </div>
          </div>

          {riskLimits.maxDrawdownReached && (
            <div className="crypto-card col-span-1 md:col-span-2 lg:col-span-4 bg-red-500/10 border-red-500/30">
              <div className="flex items-center gap-3">
                <AlertOctagon className="w-6 h-6 text-red-400" />
                <div>
                  <div className="font-semibold text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Max Drawdown Atteint</div>
                  <div className="text-sm text-gray-300">Le trading est temporairement suspendu pour protéger votre capital.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'config' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="crypto-card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-crypto-blue" />
              Configuration des Limites
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Risque max par trade (%)</label>
                <input type="range" min="0.5" max="5" step="0.5" value={riskConfig.maxRiskPerTrade} onChange={(e) => setRiskConfig({ ...riskConfig, maxRiskPerTrade: parseFloat(e.target.value) })} className="w-full" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0.5%</span>
                  <span className="text-crypto-blue font-semibold">{riskConfig.maxRiskPerTrade}%</span>
                  <span>5%</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Risque max journalier (%)</label>
                <input type="range" min="1" max="10" step="1" value={riskConfig.maxRiskPerDay} onChange={(e) => setRiskConfig({ ...riskConfig, maxRiskPerDay: parseFloat(e.target.value) })} className="w-full" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1%</span>
                  <span className="text-crypto-blue font-semibold">{riskConfig.maxRiskPerDay}%</span>
                  <span>10%</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Max Drawdown (%)</label>
                <input type="range" min="5" max="20" step="1" value={riskConfig.maxDrawdown} onChange={(e) => setRiskConfig({ ...riskConfig, maxDrawdown: parseFloat(e.target.value) })} className="w-full" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>5%</span>
                  <span className="text-crypto-blue font-semibold">{riskConfig.maxDrawdown}%</span>
                  <span>20%</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Trades simultanés max</label>
                <input type="number" min="1" max="20" value={riskConfig.maxOpenTrades} onChange={(e) => setRiskConfig({ ...riskConfig, maxOpenTrades: parseInt(e.target.value) })} className="crypto-input w-full" />
              </div>
            </div>
          </div>

          <div className="crypto-card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-crypto-green" />
              Sécurités Automatiques
            </h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={riskConfig.autoPauseOnLossLimit} onChange={(e) => setRiskConfig({ ...riskConfig, autoPauseOnLossLimit: e.target.checked })} className="w-5 h-5 rounded border-gray-600" />
                <div>
                  <div className="font-medium">Pause auto sur limite journalière</div>
                  <div className="text-xs text-gray-400">Bloquer les nouveaux trades si la perte quotidienne est atteinte</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={riskConfig.autoPauseOnDrawdown} onChange={(e) => setRiskConfig({ ...riskConfig, autoPauseOnDrawdown: e.target.checked })} className="w-5 h-5 rounded border-gray-600" />
                <div>
                  <div className="font-medium">Pause auto sur drawdown max</div>
                  <div className="text-xs text-gray-400">Bloquer le trading si le drawdown maximum est atteint</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={riskConfig.enableTrailingStop} onChange={(e) => setRiskConfig({ ...riskConfig, enableTrailingStop: e.target.checked })} className="w-5 h-5 rounded border-gray-600" />
                <div>
                  <div className="font-medium">Trailing Stop activé</div>
                  <div className="text-xs text-gray-400">Protection automatique des gains</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={riskConfig.enableKellyCriterion} onChange={(e) => setRiskConfig({ ...riskConfig, enableKellyCriterion: e.target.checked })} className="w-5 h-5 rounded border-gray-600" />
                <div>
                  <div className="font-medium">Utiliser Kelly Criterion</div>
                  <div className="text-xs text-gray-400">Optimisation basée sur l'historique de trades</div>
                </div>
              </label>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Risk/Reward minimum</label>
                <select value={riskConfig.minRiskReward} onChange={(e) => setRiskConfig({ ...riskConfig, minRiskReward: parseFloat(e.target.value) })} className="crypto-input w-full">
                  <option value={1}>1:1</option>
                  <option value={1.5}>1:1.5</option>
                  <option value={2}>1:2</option>
                  <option value={2.5}>1:2.5</option>
                  <option value={3}>1:3</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'trailing' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="crypto-card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-crypto-green" />
              Configuration Trailing Stop
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Activation (% de profit)</label>
                <input type="range" min="0.5" max="5" step="0.5" value={trailingConfig.activationPercent} onChange={(e) => setTrailingConfig({ ...trailingConfig, activationPercent: parseFloat(e.target.value) })} className="w-full" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0.5%</span>
                  <span className="text-crypto-green font-semibold">{trailingConfig.activationPercent}%</span>
                  <span>5%</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Distance du trailing (%)</label>
                <input type="range" min="0.3" max="3" step="0.1" value={trailingConfig.trailingPercent} onChange={(e) => setTrailingConfig({ ...trailingConfig, trailingPercent: parseFloat(e.target.value) })} className="w-full" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0.3%</span>
                  <span className="text-crypto-green font-semibold">{trailingConfig.trailingPercent}%</span>
                  <span>3%</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Breakeven à (% de profit)</label>
                <input type="range" min="1" max="5" step="0.5" value={trailingConfig.breakevenAtPercent || 2} onChange={(e) => setTrailingConfig({ ...trailingConfig, breakevenAtPercent: parseFloat(e.target.value) })} className="w-full" />
                <div className="text-xs text-gray-500 mt-1">Déplacer le SL au prix d'entrée + 0.1% à ce niveau de profit</div>
              </div>
            </div>
          </div>

          <div className="crypto-card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-crypto-blue" />
              Simulation Trailing Stop
            </h3>
            {trailingStatus ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-crypto-dark rounded-lg p-3">
                    <div className="text-xs text-gray-400">Profit Actuel</div>
                    <div className={`text-xl font-bold ${trailingStatus.profitPercent >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>{formatPercent(trailingStatus.profitPercent)}</div>
                  </div>
                  <div className="bg-crypto-dark rounded-lg p-3">
                    <div className="text-xs text-gray-400">Stop Actuel</div>
                    <div className="text-xl font-bold text-crypto-blue">${trailingStatus.newStopLoss.toFixed(2)}</div>
                  </div>
                </div>

                {trailingStatus.triggered ? (
                  <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="font-semibold text-green-400">Trailing Stop ACTIVÉ</span>
                    </div>
                    {trailingStatus.toBreakeven && <div className="mt-2 text-sm text-green-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Stop déplacé à breakeven</div>}
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Timer className="w-5 h-5 text-yellow-400" />
                      <span className="font-semibold text-yellow-400">En attente...</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-400">Le trailing s'activera à +{trailingConfig.activationPercent}% de profit</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">Configurez un trade pour voir la simulation</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'validation' && validation && (
        <div className="space-y-6">
          <div className="crypto-card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className={`w-5 h-5 ${validation.valid ? 'text-green-400' : 'text-red-400'}`} />
              Validation du Trade
            </h3>

            <div className={`p-4 rounded-lg mb-4 ${validation.valid ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
              <div className="flex items-center gap-3">
                {validation.valid ? (
                  <>
                    <CheckCircle className="w-8 h-8 text-green-400" />
                    <div>
                      <div className="font-bold text-green-400 flex items-center gap-2"><CheckCircle className="w-5 h-5" /> TRADE VALIDÉ</div>
                      <div className="text-sm text-gray-300">Ce trade respecte toutes les règles de gestion du risque</div>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-8 h-8 text-red-400" />
                    <div>
                      <div className="font-bold text-red-400 flex items-center gap-2"><Ban className="w-5 h-5" /> TRADE BLOQUÉ</div>
                      <div className="text-sm text-gray-300">Ce trade ne respecte pas les critères de sécurité</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">Score de risque</span>
                <span className={`font-bold ${validation.riskScore < 30 ? 'text-green-400' : validation.riskScore < 60 ? 'text-yellow-400' : 'text-red-400'}`}>{validation.riskScore}/100</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${validation.riskScore < 30 ? 'bg-green-400' : validation.riskScore < 60 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${validation.riskScore}%` }} />
              </div>
            </div>

            {validation.errors.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-red-400 mb-2 flex items-center gap-2"><AlertOctagon className="w-4 h-4" />Erreurs bloquantes</h4>
                <ul className="space-y-2">
                  {validation.errors.map((error, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300"><XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Avertissements</h4>
                <ul className="space-y-2">
                  {validation.warnings.map((warning, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300"><AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {validation.suggestedActions.length > 0 && (
              <div>
                <h4 className="font-semibold text-crypto-blue mb-2 flex items-center gap-2"><Zap className="w-4 h-4" />Actions suggérées</h4>
                <ul className="space-y-2">
                  {validation.suggestedActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300"><CheckCircle className="w-4 h-4 text-crypto-blue mt-0.5 flex-shrink-0" />{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="crypto-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calculator className="w-5 h-5 text-crypto-blue" />
                Calculateur de Position
              </h2>
              <button onClick={() => setShowFormula(!showFormula)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                {showFormula ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showFormula ? 'Masquer' : 'Voir'} la formule
              </button>
            </div>

            {showFormula && (
              <div className="mb-4 p-3 bg-crypto-dark rounded-lg border border-crypto-blue/30">
                <div className="text-xs text-crypto-blue font-semibold mb-1">📐 FORMULE CLÉ:</div>
                <div className="text-sm font-mono text-center py-2">Position Size = <span className="text-crypto-green">(Capital × Risk%)</span> / <span className="text-crypto-red">Distance Stop Loss</span></div>
                {detailedCalc && <div className="text-xs text-gray-400 mt-2 font-mono">{detailedCalc.formula}</div>}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-2">Direction</label>
                <div className="flex gap-2">
                  <button onClick={() => setIsLong(true)} className={`flex-1 py-2 rounded-lg font-medium transition-colors ${isLong ? 'bg-crypto-green text-white' : 'bg-crypto-dark text-gray-400 hover:text-white'}`}>Long</button>
                  <button onClick={() => setIsLong(false)} className={`flex-1 py-2 rounded-lg font-medium transition-colors ${!isLong ? 'bg-crypto-red text-white' : 'bg-crypto-dark text-gray-400 hover:text-white'}`}>Short</button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Prix d'entrée</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="number" step="0.01" value={entryPrice || ''} onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)} className="crypto-input w-full pl-10" placeholder="0.00" />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Stop Loss</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="number" step="0.01" value={stopLoss || ''} onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)} className="crypto-input w-full pl-10" placeholder="0.00" />
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setQuickStopLoss(1)} className="px-2 py-1 text-xs bg-crypto-dark rounded hover:bg-gray-700">1%</button>
                  <button onClick={() => setQuickStopLoss(2)} className="px-2 py-1 text-xs bg-crypto-dark rounded hover:bg-gray-700">2%</button>
                  <button onClick={() => setQuickStopLoss(3)} className="px-2 py-1 text-xs bg-crypto-dark rounded hover:bg-gray-700">3%</button>
                  <button onClick={() => setQuickStopLoss(5)} className="px-2 py-1 text-xs bg-crypto-dark rounded hover:bg-gray-700">5%</button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Ratio R:R</label>
                <div className="relative">
                  <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <select value={riskReward} onChange={(e) => setRiskReward(parseFloat(e.target.value))} className="crypto-input w-full pl-10">
                    <option value={1}>1:1</option>
                    <option value={1.5}>1:1.5</option>
                    <option value={2}>1:2</option>
                    <option value={2.5}>1:2.5</option>
                    <option value={3}>1:3</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Capital ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="number" step="100" value={accountSize || ''} onChange={(e) => setAccountSize(parseFloat(e.target.value) || 0)} className="crypto-input w-full pl-10" placeholder="10000" />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Risque par trade (%)</label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="number" step="0.1" min="0.1" max="5" value={riskPercent || ''} onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 0)} className="crypto-input w-full pl-10" placeholder="1.0" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {calculation ? (
              <div className="crypto-card">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-crypto-green" />
                  Résultats
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-crypto-dark rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Take Profit</div>
                    <div className="text-xl font-mono font-medium text-crypto-green">${calculation.takeProfit.toFixed(2)}</div>
                    <FCFAConverter usdAmount={calculation.takeProfit} />
                  </div>
                  <div className="bg-crypto-dark rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Ratio R:R</div>
                    <div className="text-xl font-mono font-medium">1:{calculation.riskRewardRatio.toFixed(1)}</div>
                  </div>
                  <div className="bg-crypto-dark rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Taille Position</div>
                    <div className="text-xl font-mono font-medium">{calculation.positionSize.toFixed(4)}</div>
                    <div className="text-xs text-gray-500">${calculation.positionValue.toFixed(2)}<FCFAConverter usdAmount={calculation.positionValue} className="text-[10px]" /></div>
                  </div>
                  <div className="bg-crypto-dark rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Risque Max</div>
                    <div className="text-xl font-mono font-medium text-crypto-red">${calculation.maxLoss.toFixed(2)}</div>
                    <FCFAConverter usdAmount={calculation.maxLoss} />
                  </div>
                </div>
                <div className="text-xs text-gray-500 text-center mt-2">Profit potentiel: ${calculation.potentialProfit.toFixed(2)}</div>

                <div className="bg-crypto-dark rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-3">Visualisation des niveaux</div>
                  <div className="relative h-32 bg-crypto-card rounded-lg p-4">
                    <div className="flex flex-col justify-between h-full text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-crypto-green">TP</span>
                        <div className="flex-1 h-0.5 bg-crypto-green/50 relative">
                          <span className="absolute right-0 -top-4 text-crypto-green">${calculation?.takeProfit?.toFixed(2) || '0'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-crypto-blue">Entrée</span>
                        <div className="flex-1 h-0.5 bg-crypto-blue relative">
                          <span className="absolute right-0 -top-4 text-crypto-blue">${calculation?.entryPrice?.toFixed(2) || '0'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-crypto-red">SL</span>
                        <div className="flex-1 h-0.5 bg-crypto-red/50 relative">
                          <span className="absolute right-0 -top-4 text-crypto-red">${calculation?.stopLoss?.toFixed(2) || '0'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="crypto-card">
                <div className="text-center py-8 text-gray-500">
                  <Calculator className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  Entrez les paramètres pour calculer
                </div>
              </div>
            )}

            <div className="crypto-card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-crypto-purple" />
                Critère Kelly (Optimal)
              </h3>

              <div className="bg-crypto-dark rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-4">Basé sur {kellyStats.totalTrades} trades fermés:</div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-gray-500 text-xs">Win Rate</div>
                    <div className="text-lg font-medium">{kellyStats.winRate.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Gain Moyen</div>
                    <div className="text-lg font-medium text-crypto-green">${kellyStats.avgWin.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Perte Moyenne</div>
                    <div className="text-lg font-medium text-crypto-red">${kellyStats.avgLoss.toFixed(2)}</div>
                  </div>
                </div>
                <div className="pt-4 border-t border-crypto-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-gray-400 text-sm">Risque optimal par trade</div>
                      <div className="text-xs text-gray-500">Recommandation Kelly (moitié)</div>
                    </div>
                    <div className="text-2xl font-bold text-crypto-purple">{kellyStats.kellyPercent.toFixed(2)}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
