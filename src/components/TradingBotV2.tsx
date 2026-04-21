/**
 * 🤖 NEUROVEST - Trading Bot V2
 * 
 * Bot de trading automatique 100% fonctionnel avec:
 * ✅ Connexion IA Ethernal (score >= 70)
 * ✅ Risk Management intégré
 * ✅ Exécution réelle via API
 * ✅ Logs visuels en temps réel
 * ✅ Statistiques de performance
 * ✅ Modes SAFE/NORMAL/AGGRESSIVE
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Bot, Play, Pause, Settings, Trash2, TrendingUp, TrendingDown, 
  Activity, AlertCircle, DollarSign, Target, Shield, BarChart3,
  Clock, CheckCircle2, XCircle, History, Zap, Percent, Wallet,
  Brain, ChevronRight, ChevronDown, ArrowUpRight, ArrowDownRight,
  Signal, Ban, Sparkles
} from 'lucide-react';
import { useLocalTradingBot } from '../hooks/useLocalTradingBot';
import { getAITradingSetup } from '../services/advancedAnalysis';
import { useCryptoStore } from '../stores/cryptoStore';
import { showToast } from '../stores/toastStore';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT'];

const STRATEGIES = {
  conservative: { 
    name: 'SAFE', 
    color: 'text-blue-400', 
    bg: 'bg-blue-500/20',
    desc: 'Risque faible (0.5% par trade)',
    riskMultiplier: 0.5,
    minScore: 75
  },
  moderate: { 
    name: 'NORMAL', 
    color: 'text-yellow-400', 
    bg: 'bg-yellow-500/20',
    desc: 'Équilibré (1% par trade)',
    riskMultiplier: 1,
    minScore: 70
  },
  aggressive: { 
    name: 'AGGRESSIF', 
    color: 'text-red-400', 
    bg: 'bg-red-500/20',
    desc: 'Haut risque (2% par trade)',
    riskMultiplier: 2,
    minScore: 65
  }
};

export default function TradingBotV2() {
  const bot = useLocalTradingBot();
  const prices = useCryptoStore((state) => state.prices);
  const [logs, setLogs] = useState<Array<{time: string; type: string; message: string}>>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [testAnalysis, setTestAnalysis] = useState<ReturnType<typeof getAITradingSetup> | null>(null);
  const [loadedBacktestConfig, setLoadedBacktestConfig] = useState<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  
  // Fonction pour scroller manuellement vers le bas
  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // 🔥 CHARGEMENT AUTO DE LA STRATÉGIE VALIDÉE DEPUIS LE BACKTEST
  useEffect(() => {
    const validatedStrategy = localStorage.getItem('neurovest_validated_strategy');
    if (validatedStrategy) {
      const config = JSON.parse(validatedStrategy);
      setLoadedBacktestConfig(config);
      addLog('info', `📊 Stratégie validée chargée: ${config.strategy} sur ${config.symbol}`);
      const metrics = config.backtestMetrics || {};
      addLog('success', `✅ Backtest: ${(metrics.totalReturn || 0).toFixed(1)}% | WinRate: ${(metrics.winRate || 0).toFixed(1)}% | PF: ${(metrics.profitFactor || 0).toFixed(2)}`);
      
      // Auto-select le symbole
      if (SYMBOLS.includes(config.symbol)) {
        setSelectedSymbol(config.symbol);
      }
      
      // 🔥 DÉMARRAGE AUTOMATIQUE SI AUTO-START
      if (config.autoStart) {
        setTimeout(() => {
          addLog('success', '🚀 Démarrage automatique du Trading Bot...');
          bot.startBot();
          showToast.success('Bot démarré automatiquement avec stratégie validée!', 'Trading Bot');
          // Nettoyer le flag après utilisation
          localStorage.removeItem('neurovest_validated_strategy');
          setLoadedBacktestConfig(null); // Clear après utilisation
        }, 1000);
      }
    }
  }, []); // Une seule fois au montage

  // Ajouter log quand le bot décide
  useEffect(() => {
    if (bot.lastDecision) {
      const decision = bot.lastDecision;
      addLog(
        decision.action === 'HOLD' ? 'info' : decision.action === 'BUY' ? 'success' : 'warning',
        `${decision.symbol}: ${decision.action} - ${decision.reason}`
      );
    }
  }, [bot.lastDecision]);
  
  const addLog = (type: string, message: string) => {
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev.slice(-49), { time, type, message }]);
  };
  
  const handleStart = () => {
    bot.startBot();
    addLog('success', '🚀 Bot démarré');
    showToast.success('Bot de trading activé!', 'Trading Bot');
  };
  
  const handleStop = () => {
    bot.stopBot();
    addLog('warning', '⏹️ Bot arrêté');
    showToast.info('Bot de trading arrêté', 'Trading Bot');
  };
  
  const handleReset = () => {
    if (confirm('Réinitialiser toutes les données du bot?')) {
      bot.resetBot();
      setLogs([]);
      addLog('info', '🔄 Bot réinitialisé');
      showToast.success('Bot réinitialisé', 'Reset');
    }
  };
  
  const testAI = () => {
    const price = prices.get(selectedSymbol)?.price || 0;
    if (price === 0) {
      addLog('error', '❌ Prix non disponible');
      return;
    }
    
    const setup = getAITradingSetup(selectedSymbol, price);
    setTestAnalysis(setup);
    
    if (setup) {
      addLog('info', `🧠 Analyse IA ${selectedSymbol}: Score ${setup.score}/100, Direction: ${setup.direction}`);
      if (setup.isValid) {
        addLog('success', `✅ Setup validé - Entry: $${setup.entryPrice}, SL: $${setup.stopLoss}, TP: $${setup.takeProfit}`);
      } else {
        addLog('warning', `⚠️ Setup invalide: ${setup.warnings.join(', ')}`);
      }
    } else {
      addLog('warning', `⚠️ Pas de setup valide pour ${selectedSymbol} (score < 70)`);
    }
  };
  
  const activePositions = bot.positions.filter(p => !p.exitPrice);
  const closedPositions = bot.positions.filter(p => p.exitPrice);
  
  const openTradesPnL = activePositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const totalPnL = bot.stats.totalPnL;
  
  return (
    <div className="space-y-6 p-4">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl border ${bot.isRunning ? 'bg-green-500/20 border-green-500/30' : 'bg-gray-700/50 border-gray-600'}`}>
            <Bot className={`w-8 h-8 ${bot.isRunning ? 'text-green-400' : 'text-gray-400'}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Trading Bot V2
              <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                IA Powered
              </span>
            </h1>
            <p className="text-gray-400 text-sm flex items-center gap-2">
              {bot.isRunning ? (
                <><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>Actif - {bot.activePositionsCount} position(s)</>
              ) : (
                <><span className="w-2 h-2 rounded-full bg-red-400"/>Inactif - En attente</>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Badge */}
          <span className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
            bot.isRunning 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${bot.isRunning ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {bot.isRunning ? 'EN COURS' : 'ARRÊTÉ'}
          </span>
          
          {/* Paper Trading Badge */}
          <span className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 ${
            bot.config.paperTrading 
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
              : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
          }`}>
            {bot.config.paperTrading ? <><Wallet className="w-3 h-3"/> PAPER</> : <><DollarSign className="w-3 h-3"/> RÉEL</>}
          </span>
          
          {/* Strategy Badge */}
          <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${STRATEGIES[bot.config.strategy].bg} ${STRATEGIES[bot.config.strategy].color} border border-current border-opacity-30`}>
            {STRATEGIES[bot.config.strategy].name}
          </span>
        </div>
      </div>
      
      {/* CONTROLS */}
      <div className="flex flex-wrap gap-3">
        {bot.isRunning ? (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl border border-red-500/30 transition-all font-semibold"
          >
            <Pause className="w-5 h-5" />
            ARRÊTER LE BOT
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={bot.config.symbols.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl border border-green-500/30 transition-all font-semibold disabled:opacity-50"
          >
            <Play className="w-5 h-5" />
            DÉMARRER LE BOT
          </button>
        )}
        
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
            showConfig ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:text-white'
          }`}
        >
          <Settings className="w-5 h-5" />
          Configuration
          {showConfig ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-3 bg-gray-700/50 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl border border-gray-600 transition-all"
        >
          <Trash2 className="w-5 h-5" />
          Reset
        </button>
      </div>
      
      {/* PERFORMANCE STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Total P&L */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-400"><DollarSign className="w-5 h-5" /></span>
            <span className="text-sm text-gray-400">Total P&L</span>
          </div>
          <div className={`text-xl font-bold ${(totalPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {`${(totalPnL || 0) >= 0 ? '+' : ''}$${(totalPnL || 0).toFixed(2)}`}
          </div>
        </div>
        {/* P&L Ouvert */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-400"><Activity className="w-5 h-5" /></span>
            <span className="text-sm text-gray-400">P&L Ouvert</span>
          </div>
          <div className={`text-xl font-bold ${(openTradesPnL || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {`${(openTradesPnL || 0) >= 0 ? '+' : ''}$${(openTradesPnL || 0).toFixed(2)}`}
          </div>
        </div>
        {/* Win Rate */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-400"><Target className="w-5 h-5" /></span>
            <span className="text-sm text-gray-400">Win Rate</span>
          </div>
          <div className="text-xl font-bold text-blue-400">{`${bot.stats.winRate}%`}</div>
        </div>
        {/* Trades */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-400"><BarChart3 className="w-5 h-5" /></span>
            <span className="text-sm text-gray-400">Trades</span>
          </div>
          <div className="text-xl font-bold text-purple-400">{`${bot.stats.totalTrades}`}</div>
        </div>
        {/* Aujourd'hui */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-400"><Clock className="w-5 h-5" /></span>
            <span className="text-sm text-gray-400">Aujourd'hui</span>
          </div>
          <div className={`text-xl font-bold ${bot.stats.dailyTradeCount >= bot.config.maxDailyTrades ? 'text-red-400' : 'text-yellow-400'}`}>
            {`${bot.stats.dailyTradeCount}/${bot.config.maxDailyTrades}`}
          </div>
        </div>
        {/* Drawdown */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-400"><TrendingDown className="w-5 h-5" /></span>
            <span className="text-sm text-gray-400">Drawdown</span>
          </div>
          <div className={`text-xl font-bold ${(bot.currentDrawdown || 0) > 10 ? 'text-red-400' : 'text-gray-400'}`}>
            {`${(bot.currentDrawdown || 0).toFixed(1)}%`}
          </div>
        </div>
      </div>
      
      {/* CONFIGURATION PANEL */}
      {showConfig && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 space-y-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuration du Bot
          </h3>
          
          {/* Strategy Selection */}
          <div className="space-y-3">
            <label className="text-sm text-gray-400">Stratégie</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(Object.keys(STRATEGIES) as Array<keyof typeof STRATEGIES>).map((key) => (
                <button
                  key={key}
                  onClick={() => bot.updateConfig({ strategy: key })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    bot.config.strategy === key 
                      ? `${STRATEGIES[key].bg} border-current` 
                      : 'bg-gray-700/30 border-gray-600 hover:border-gray-500'
                  } ${STRATEGIES[key].color}`}
                >
                  <div className="font-semibold">{STRATEGIES[key].name}</div>
                  <div className="text-xs opacity-80 mt-1">{STRATEGIES[key].desc}</div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Symbols */}
            <div className="space-y-3">
              <label className="text-sm text-gray-400">Symboles à trader</label>
              <div className="flex flex-wrap gap-2">
                {SYMBOLS.map(sym => (
                  <button
                    key={sym}
                    onClick={() => {
                      const newSymbols = bot.config.symbols.includes(sym)
                        ? bot.config.symbols.filter(s => s !== sym)
                        : [...bot.config.symbols, sym];
                      bot.updateConfig({ symbols: newSymbols });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      bot.config.symbols.includes(sym)
                        ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50'
                        : 'bg-gray-700/50 text-gray-500 border border-gray-600'
                    }`}
                  >
                    {sym.replace('USDT', '')}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Risk Settings */}
            <div className="space-y-3">
              <label className="text-sm text-gray-400">Paramètres de risque</label>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-gray-700/30 p-3 rounded-lg">
                  <span className="text-sm">Risque max/trade</span>
                  <span className="text-sm font-mono text-blue-400">{bot.config.maxRiskPerTrade}%</span>
                </div>
                <div className="flex items-center justify-between bg-gray-700/30 p-3 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-purple-400">Score Minimum IA</span>
                    <p className="text-xs text-gray-500">Score de confiance IA minimum pour exécuter les trades</p>
                    {/* Légende des niveaux */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[9px] rounded">⭐ 85%+</span>
                      <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] rounded">✅ 75%+</span>
                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] rounded">🔵 60%+</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <input
                      type="number"
                      min="50"
                      max="95"
                      value={bot.config.minConfidence}
                      onChange={(e) => bot.updateConfig({ minConfidence: parseInt(e.target.value) })}
                      className={`w-16 border rounded px-2 py-1 text-center text-sm font-mono font-bold ${
                        bot.config.minConfidence >= 85 ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' :
                        bot.config.minConfidence >= 75 ? 'bg-green-500/20 border-green-500/50 text-green-400' :
                        bot.config.minConfidence >= 60 ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' :
                        'bg-gray-800 border-gray-600 text-purple-400'
                      }`}
                    />
                    <span className="text-[9px] text-gray-400">
                      {bot.config.minConfidence >= 85 ? '⭐ PREMIUM' : 
                       bot.config.minConfidence >= 75 ? '✅ PRO' : 
                       bot.config.minConfidence >= 60 ? '🔵 Standard' : '⚪ Basique'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-gray-700/30 p-3 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-orange-400">Stop Suiveur (Trailing Stop)</span>
                    <p className="text-xs text-gray-500">Stop-loss dynamique qui suit le prix</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={bot.config.trailingStopPercent}
                      onChange={(e) => bot.updateConfig({ trailingStopPercent: parseFloat(e.target.value) })}
                      className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-center text-sm font-mono text-orange-400"
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Paper Trading Toggle */}
          <div className="flex items-center justify-between bg-gray-700/30 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-blue-400" />
              <div>
                <div className="font-medium text-white">Mode Paper Trading</div>
                <div className="text-sm text-gray-400">
                  {bot.config.paperTrading 
                    ? 'Les trades sont simulés avec des prix réels' 
                    : '⚠️ Les trades seront exécutés avec de VRAIS fonds'}
                </div>
              </div>
            </div>
            <button
              onClick={() => bot.updateConfig({ paperTrading: !bot.config.paperTrading })}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                bot.config.paperTrading ? 'bg-blue-600' : 'bg-red-600'
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                bot.config.paperTrading ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          
          {/* Kelly Criterion Toggle */}
          <div className="flex items-center justify-between bg-gray-700/30 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <Percent className="w-5 h-5 text-green-400" />
              <div>
                <div className="font-medium text-white">Critère de Kelly</div>
                <div className="text-sm text-gray-400">Taille de position optimale basée sur le win rate</div>
              </div>
            </div>
            <button
              onClick={() => bot.updateConfig({ useKellyCriterion: !bot.config.useKellyCriterion })}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                bot.config.useKellyCriterion ? 'bg-green-600' : 'bg-gray-600'
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                bot.config.useKellyCriterion ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          
          {/* Auto Buy/Sell Toggle */}
          <div className="flex items-center justify-between bg-gray-700/30 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-yellow-400" />
              <div>
                <div className="font-medium text-white">Achat/Vente Auto</div>
                <div className="text-sm text-gray-400">Exécuter automatiquement les signaux d'achat et de vente</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={bot.config.autoBuy}
                  onChange={(e) => bot.updateConfig({ autoBuy: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 text-green-500 focus:ring-green-500"
                />
                <span className={bot.config.autoBuy ? 'text-green-400' : 'text-gray-500'}>Achat</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={bot.config.autoSell}
                  onChange={(e) => bot.updateConfig({ autoSell: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 text-red-500 focus:ring-red-500"
                />
                <span className={bot.config.autoSell ? 'text-red-400' : 'text-gray-500'}>Vente</span>
              </label>
            </div>
          </div>
        </div>
      )}
      
      {/* ACTIVE POSITIONS */}
      {activePositions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Positions Actives ({activePositions.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePositions.map(pos => (
              <div key={pos.id} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{pos.symbol.replace('USDT', '')}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      pos.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {pos.side === 'buy' ? 'LONG' : 'SHORT'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{pos.strategy}</span>
                </div>
                
                <div className="space-y-1 text-sm mb-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Entry:</span>
                    <span className="font-mono">${(pos.entryPrice || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current:</span>
                    <span className="font-mono">${(pos.currentPrice || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">SL / TP:</span>
                    <span className="font-mono text-xs">
                      ${(pos.stopLoss || 0).toFixed(0)} / ${(pos.takeProfit || 0).toFixed(0)}
                    </span>
                  </div>
                </div>
                
                <div className={`text-lg font-bold ${(pos.unrealizedPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(pos.unrealizedPnl || 0) >= 0 ? '+' : ''}${(pos.unrealizedPnl || 0).toFixed(2)} 
                  <span className="text-sm font-normal">({(pos.unrealizedPnlPercent || 0).toFixed(1)}%)</span>
                </div>
                
                <button
                  onClick={() => bot.closePosition(pos.id)}
                  className="mt-3 w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm border border-red-500/30 transition-colors"
                >
                  Fermer Position
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* AI TESTER */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-purple-400" />
          Testeur IA - Analyse Manuelle
        </h3>
        
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
          >
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          
          <button
            onClick={testAI}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg border border-purple-500/30 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Analyser avec IA
          </button>
        </div>
        
        {testAnalysis && (
          <div className={`p-4 rounded-lg border ${
            testAnalysis.isValid 
              ? 'bg-green-500/10 border-green-500/30' 
              : 'bg-yellow-500/10 border-yellow-500/30'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-2xl font-bold ${testAnalysis.isValid ? 'text-green-400' : 'text-yellow-400'}`}>
                {testAnalysis.direction}
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-lg">Score: <span className={`font-bold ${testAnalysis.score >= 70 ? 'text-green-400' : 'text-yellow-400'}`}>{testAnalysis.score}/100</span></span>
              {testAnalysis.isValid && <CheckCircle2 className="w-6 h-6 text-green-400" />}
            </div>
            
            {testAnalysis.isValid ? (
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="bg-gray-800/50 p-3 rounded-lg text-center">
                  <div className="text-xs text-gray-400 mb-1">Entry</div>
                  <div className="font-mono text-white">${testAnalysis.entryPrice?.toFixed(2)}</div>
                </div>
                <div className="bg-red-500/10 p-3 rounded-lg text-center border border-red-500/20">
                  <div className="text-xs text-red-400 mb-1">Stop Loss</div>
                  <div className="font-mono text-red-400">${testAnalysis.stopLoss?.toFixed(2)}</div>
                </div>
                <div className="bg-green-500/10 p-3 rounded-lg text-center border border-green-500/20">
                  <div className="text-xs text-green-400 mb-1">Take Profit</div>
                  <div className="font-mono text-green-400">${testAnalysis.takeProfit?.toFixed(2)}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {testAnalysis.warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-yellow-400">
                    <AlertCircle className="w-4 h-4" />
                    {w}
                  </div>
                ))}
              </div>
            )}
            
            {testAnalysis.confirmations.slice(0, 3).map((c, i) => (
              <div key={i} className="text-sm text-gray-400 flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-400" />
                {c}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STRATÉGIE VALIDÉE CHARGÉE */}
      {loadedBacktestConfig && (
        <div className="bg-crypto-purple/10 border border-crypto-purple/30 rounded-lg p-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-crypto-purple flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-crypto-purple flex items-center gap-2">
                  Stratégie Validée Chargée
                </h3>
                <p className="text-sm text-gray-400">
                  {loadedBacktestConfig.strategy === 'ai_ethernal' ? 'IA Ethernal' : loadedBacktestConfig.strategy} sur {loadedBacktestConfig.symbol}
                </p>
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="text-crypto-green font-bold">
                  +{(loadedBacktestConfig.backtestMetrics?.totalReturn || 0).toFixed(1)}%
                </div>
                <div className="text-gray-500 text-xs">Return</div>
              </div>
              <div className="text-center">
                <div className="text-crypto-blue font-bold">
                  {(loadedBacktestConfig.backtestMetrics?.winRate || 0).toFixed(1)}%
                </div>
                <div className="text-gray-500 text-xs">Win Rate</div>
              </div>
              <div className="text-center">
                <div className="text-crypto-purple font-bold">
                  {(loadedBacktestConfig.backtestMetrics?.profitFactor || 0).toFixed(2)}
                </div>
                <div className="text-gray-500 text-xs">PF</div>
              </div>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-crypto-purple/20 flex items-center gap-2 text-sm">
            <Settings className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      )}

      {/* LOGS */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <History className="w-5 h-5" />
            Logs en temps réel
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={scrollToBottom}
              className="text-sm text-blue-400 hover:text-blue-300"
              title="Descendre aux derniers logs"
            >
              ↓ Bas
            </button>
            <button
              onClick={() => setLogs([])}
              className="text-sm text-gray-400 hover:text-white"
            >
              Effacer
            </button>
          </div>
        </div>
        <div 
          ref={logsContainerRef}
          className="h-64 overflow-y-auto p-4 space-y-1 font-mono text-sm"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">Les logs apparaîtront ici...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-gray-500 shrink-0">[{log.time}]</span>
                <span className={
                  log.type === 'success' ? 'text-green-400' :
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'warning' ? 'text-yellow-400' :
                  'text-gray-300'
                }>
                  {log.message}
                </span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

