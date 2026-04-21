/**
 * NEUROVEST - Widget Settings V2
 * Système complet de widgets temps réel, personnalisables et multi-plateformes
 */

import { useState, useEffect, useCallback, memo } from 'react';
import {
  Smartphone, Grid, Info, CheckCircle, Plus, Trash2, RefreshCw,
  Layout, Save, Download, Upload, Monitor, Moon, Sun,
  Settings, ChevronDown, ChevronUp, Eye, EyeOff, Clock,
  Palette, ArrowUp, ArrowDown, Copy, Check, Globe,
  DollarSign, BarChart3, TrendingUp, Activity, Bell, Brain, Briefcase, Zap, Target, Radar,
  Apple, Bot, Laptop, Search, Sparkles
} from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';
import { useWidgets } from '../hooks/useWidgets';
import { showToast } from '../stores/toastStore';

// Widget components
import PriceWidget from './widgets/PriceWidget';
import AISignalWidget from './widgets/AISignalWidget';
import PortfolioWidget from './widgets/PortfolioWidget';
import AlertWidget from './widgets/AlertWidget';
import PerformanceWidget from './widgets/PerformanceWidget';
import MarketOverviewWidget from './widgets/MarketOverviewWidget';
import TradesWidget from './widgets/TradesWidget';

// Types
import type {
  WidgetType, WidgetSize, WidgetTheme, WidgetConfig
} from '../types/widgets';
import {
  POPULAR_SYMBOLS, REFRESH_INTERVALS, TIMEFRAMES,
  WIDGET_TYPE_LABELS, WIDGET_PRESETS, detectPlatform, isPWA, supportsWidgets
} from '../types/widgets';

// Widget type icons - Lucide components
const WIDGET_ICON_COMPONENTS: Record<WidgetType, React.ElementType> = {
  'price': DollarSign,
  'change': Activity,
  'mini-chart': BarChart3,
  'volume': Activity,
  'trend': TrendingUp,
  'alert': Bell,
  'ai-signal': Brain,
  'portfolio': Briefcase,
  'trades': Zap,
  'performance': Target,
  'market-overview': Radar,
};

// Helper pour render l'icon
const WidgetIcon = ({ type, className = "w-4 h-4" }: { type: WidgetType; className?: string }) => {
  const IconComponent = WIDGET_ICON_COMPONENTS[type];
  return <IconComponent className={className} />;
};

// Preset icon mapping
const PRESET_ICON_COMPONENTS: Record<string, React.ElementType> = {
  'trader': Zap,
  'investor': Briefcase,
  'minimal': Search
};

// Size configurations
const SIZE_CONFIG: Record<WidgetSize, { class: string; label: string; cols: number }> = {
  small: { class: 'min-h-[280px]', label: 'Petit', cols: 1 },
  medium: { class: 'min-h-[380px]', label: 'Moyen', cols: 1 },
  large: { class: 'min-h-[480px]', label: 'Grand', cols: 2 },
  fullscreen: { class: 'min-h-[600px]', label: 'Plein écran', cols: 3 },
};

// Memoized widget renderer
const WidgetRenderer = memo(function WidgetRenderer({
  config,
  data,
  aiSignal,
  alerts,
  portfolioData,
  performanceData,
  marketData,
  trades,
  prices,
  compact
}: {
  config: WidgetConfig;
  data: any;
  aiSignal: any;
  alerts: any[];
  portfolioData: any;
  performanceData: any;
  marketData: any[];
  trades: any[];
  prices: Map<string, any>;
  compact: boolean;
}) {
  switch (config.type) {
    case 'price':
    case 'change':
    case 'volume':
    case 'mini-chart':
      return <PriceWidget config={config} data={data} compact={compact} />;
    case 'ai-signal':
      return <AISignalWidget signal={aiSignal} compact={compact} />;
    case 'portfolio':
      return <PortfolioWidget data={portfolioData} compact={compact} />;
    case 'alert':
      return <AlertWidget alerts={alerts} compact={compact} />;
    case 'performance':
      return <PerformanceWidget data={performanceData} compact={compact} />;
    case 'market-overview':
      return <MarketOverviewWidget data={marketData} compact={compact} />;
    case 'trades':
      return <TradesWidget trades={trades} prices={prices} compact={compact} />;
    default:
      return null;
  }
});

export default function WidgetSettings() {
  // Stores
  const prices = useCryptoStore((state) => state.prices);
  const trades = useCryptoStore((state) => state.trades);
  
  // Hooks
  const {
    widgets,
    layouts,
    activeLayoutId,
    isLoading,
    lastUpdate,
    getWidgetData,
    getAISignal,
    getAlerts,
    getPortfolioData,
    getPerformanceData,
    getMarketOverview,
    addWidget,
    updateWidget,
    removeWidget,
    reorderWidgets,
    saveLayout,
    loadLayout,
    deleteLayout,
    refreshAll,
    exportConfig,
    importConfig,
    addToHomeScreen,
  } = useWidgets();

  // UI States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'configure' | 'mobile' | 'presets'>('dashboard');
  const [showInstructions, setShowInstructions] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWidget, setEditingWidget] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [layoutName, setLayoutName] = useState('');
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>(detectPlatform());

  // Derived data
  const alerts = getAlerts();
  const portfolioData = getPortfolioData();
  const performanceData = getPerformanceData();
  const marketData = getMarketOverview();

  // Platform detection
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  // Handlers
  const handleAddWidget = (type: WidgetType) => {
    const defaultSymbol = type === 'market-overview' ? undefined : 'BTCUSDT';
    addWidget({
      type,
      symbol: defaultSymbol,
      size: 'medium',
      theme: 'dark',
      refreshInterval: 5000,
      timeframe: '1h',
      showChart: type === 'price' || type === 'mini-chart',
    });
    setShowAddModal(false);
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = WIDGET_PRESETS.find(p => p.id === presetId);
    if (preset) {
      preset.widgets.forEach(w => addWidget(w));
      showToast.success(`Preset "${preset.name}" chargé`);
    }
  };

  const handleExport = () => {
    const config = exportConfig();
    navigator.clipboard.writeText(config);
    showToast.success('Configuration copiée dans le presse-papiers');
    setShowExportModal(false);
  };

  const handleImport = () => {
    if (importJson.trim()) {
      const success = importConfig(importJson);
      if (success) {
        setShowImportModal(false);
        setImportJson('');
      }
    }
  };

  const handleSaveLayout = () => {
    if (layoutName.trim()) {
      saveLayout(layoutName.trim());
      setLayoutName('');
    }
  };

  // Refresh status
  const timeSinceUpdate = lastUpdate 
    ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000)
    : null;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header - Style amélioré et épuré */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-crypto-border/50">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-crypto-blue to-blue-600 rounded-xl">
              <Grid className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Widgets NEUROVEST</h1>
              <p className="text-sm text-gray-400">
                Tableaux de bord temps réel personnalisables
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {timeSinceUpdate !== null && (
            <span className="text-xs text-gray-500 px-3 py-1.5 bg-slate-800/50 rounded-lg">
              Mis à jour il y a {timeSinceUpdate}s
            </span>
          )}
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-xl p-1">
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="p-2.5 text-crypto-blue hover:bg-crypto-blue/10 rounded-lg transition-all"
              title="Aide"
            >
              <Info className="w-5 h-5" />
            </button>
            <button
              onClick={refreshAll}
              disabled={isLoading}
              className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              title="Rafraîchir tout"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Instructions - Style amélioré */}
      {showInstructions && (
        <div className="bg-gradient-to-r from-crypto-blue/10 via-blue-500/5 to-transparent border border-crypto-blue/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-lg flex items-center gap-2 text-white">
              <Info className="w-5 h-5 text-crypto-blue" />
              Guide des Widgets
            </h3>
            <button onClick={() => setShowInstructions(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-crypto-blue/20 rounded-lg">
                  <Smartphone className="w-5 h-5 text-crypto-blue" />
                </div>
                <h4 className="font-medium text-white">Widgets Mobile</h4>
              </div>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2"><span className="text-crypto-blue mt-1">•</span> Installez l'app PWA sur votre écran d'accueil</li>
                <li className="flex items-start gap-2"><span className="text-crypto-blue mt-1">•</span> Ajoutez des widgets iOS 14+ ou Android 8+</li>
                <li className="flex items-start gap-2"><span className="text-crypto-blue mt-1">•</span> Données temps réel avec mise à jour auto</li>
              </ul>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Laptop className="w-5 h-5 text-blue-400" />
                </div>
                <h4 className="font-medium text-white">Desktop</h4>
              </div>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2"><span className="text-blue-400 mt-1">•</span> Dashboard complet dans l'app</li>
                <li className="flex items-start gap-2"><span className="text-blue-400 mt-1">•</span> Glissez-déposez pour réorganiser</li>
                <li className="flex items-start gap-2"><span className="text-blue-400 mt-1">•</span> Export/Import de configurations</li>
              </ul>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Zap className="w-5 h-5 text-yellow-400" />
                </div>
                <h4 className="font-medium text-white">Performances</h4>
              </div>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2"><span className="text-yellow-400 mt-1">•</span> Cache intelligent pour éviter les requêtes</li>
                <li className="flex items-start gap-2"><span className="text-yellow-400 mt-1">•</span> Fréquence de rafraîchissement configurable</li>
                <li className="flex items-start gap-2"><span className="text-yellow-400 mt-1">•</span> Mise à jour uniquement si données changées</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tabs - Style amélioré avec indicateur visuel */}
      <div className="relative">
        <div className="flex gap-2 p-2 bg-slate-900/50 rounded-2xl border border-slate-800">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Grid },
            { id: 'configure', label: 'Configurer', icon: Settings },
            { id: 'mobile', label: 'Mobile', icon: Smartphone },
            { id: 'presets', label: 'Presets', icon: Layout },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-crypto-blue to-blue-600 text-white shadow-lg shadow-crypto-blue/25'
                  : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'animate-pulse' : ''}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* DASHBOARD TAB - Style amélioré */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Quick Actions - Section améliorée */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-gradient-to-r from-slate-800/50 to-transparent rounded-2xl border border-slate-700/30">
            <span className="text-sm text-gray-400 font-medium mr-2">Actions rapides:</span>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-crypto-accent to-emerald-600 rounded-xl text-sm font-semibold text-white shadow-lg shadow-crypto-accent/20 hover:shadow-crypto-accent/40 hover:scale-105 transition-all"
            >
              <Plus className="w-4 h-4" />
              Ajouter Widget
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-700/80 hover:bg-slate-600 rounded-xl text-sm font-medium transition-all"
              >
                <Download className="w-4 h-4" />
                Exporter
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-700/80 hover:bg-slate-600 rounded-xl text-sm font-medium transition-all"
              >
                <Upload className="w-4 h-4" />
                Importer
              </button>
            </div>
          </div>

          {/* Widgets Grid - Style amélioré */}
          {widgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-gradient-to-b from-slate-800/30 to-slate-900/30 rounded-3xl border border-dashed border-slate-700/50">
              <div className="p-6 bg-slate-800/50 rounded-3xl mb-6">
                <Grid className="w-20 h-20 text-slate-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Aucun widget configuré</h3>
              <p className="text-sm text-gray-400 mb-6 text-center max-w-sm">
                Commencez à créer votre tableau de bord personnalisé en ajoutant votre premier widget
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-crypto-accent to-emerald-600 rounded-xl text-sm font-semibold text-white shadow-lg shadow-crypto-accent/20 hover:shadow-crypto-accent/40 hover:scale-105 transition-all"
              >
                <Plus className="w-5 h-5" />
                Ajouter un widget
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {widgets.map((widget) => {
                const data = getWidgetData(widget.id);
                const aiSignal = widget.symbol ? getAISignal(widget.symbol) : null;
                
                return (
                  <div
                    key={widget.id}
                    className={`relative group flex flex-col bg-gradient-to-br from-slate-800/60 to-slate-900/40 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-crypto-blue/40 hover:shadow-lg hover:shadow-crypto-blue/10 transition-all duration-300 ${SIZE_CONFIG[widget.size].class} ${
                      widget.size === 'large' ? 'md:col-span-2' : ''
                    } ${widget.size === 'fullscreen' ? 'md:col-span-3' : ''}`}
                  >
                    {/* Widget Header - Fixed */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-slate-700/70 rounded-lg">
                          <WidgetIcon type={widget.type} className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-white">{WIDGET_TYPE_LABELS[widget.type]}</span>
                          {widget.symbol && (
                            <span className="text-[10px] px-2 py-0.5 bg-crypto-blue/20 text-crypto-blue rounded-full w-fit">{widget.symbol}</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Widget Actions */}
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setEditingWidget(editingWidget === widget.id ? null : widget.id)}
                          className="p-1.5 bg-slate-700/50 hover:bg-crypto-blue hover:text-white rounded-lg transition-all"
                          title="Modifier"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeWidget(widget.id)}
                          className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Widget Content */}
                    <div className="p-4 flex-1 overflow-y-auto">
                      <WidgetRenderer
                        config={widget}
                        data={data}
                        aiSignal={aiSignal}
                        alerts={alerts}
                        portfolioData={portfolioData}
                        performanceData={performanceData}
                        marketData={marketData}
                        trades={trades}
                        prices={prices}
                        compact={widget.size === 'small'}
                      />
                    </div>

                    {/* Edit Panel - Style amélioré */}
                    {editingWidget === widget.id && (
                      <div className="absolute inset-0 bg-slate-900/98 backdrop-blur-md rounded-2xl p-5 z-20 overflow-y-auto border border-slate-700/50">
                        <div className="flex items-center justify-between mb-5">
                          <h4 className="font-semibold text-lg text-white flex items-center gap-2">
                            <Settings className="w-5 h-5 text-crypto-blue" />
                            Modifier Widget
                          </h4>
                          <button 
                            onClick={() => setEditingWidget(null)}
                            className="p-2 hover:bg-slate-800 rounded-lg transition-all"
                          >
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          </button>
                        </div>
                        
                        {/* Symbol */}
                        {widget.type !== 'portfolio' && widget.type !== 'performance' && widget.type !== 'trades' && (
                          <div className="mb-4">
                            <label className="text-xs font-medium text-gray-400 block mb-2">Cryptomonnaie</label>
                            <select
                              value={widget.symbol || ''}
                              onChange={(e) => updateWidget(widget.id, { symbol: e.target.value })}
                              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-crypto-blue transition-colors"
                            >
                              {POPULAR_SYMBOLS.map(s => (
                                <option key={s} value={s}>{s.replace('USDT', '')}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Size */}
                        <div className="mb-4">
                          <label className="text-xs font-medium text-gray-400 block mb-2">Taille du widget</label>
                          <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(SIZE_CONFIG) as WidgetSize[]).map(size => (
                              <button
                                key={size}
                                onClick={() => updateWidget(widget.id, { size })}
                                className={`py-3 rounded-xl text-sm font-medium transition-all ${
                                  widget.size === size
                                    ? 'bg-gradient-to-r from-crypto-blue to-blue-600 text-white shadow-lg shadow-crypto-blue/25'
                                    : 'bg-slate-800/80 text-gray-400 hover:text-white hover:bg-slate-700'
                                }`}
                              >
                                {SIZE_CONFIG[size].label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Refresh Interval */}
                        <div className="mb-4">
                          <label className="text-xs font-medium text-gray-400 block mb-2">Fréquence de rafraîchissement</label>
                          <select
                            value={widget.refreshInterval}
                            onChange={(e) => updateWidget(widget.id, { refreshInterval: parseInt(e.target.value) as any })}
                            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-crypto-blue transition-colors"
                          >
                            {REFRESH_INTERVALS.map(i => (
                              <option key={i.value} value={i.value}>{i.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Theme */}
                        <div className="mb-5">
                          <label className="text-xs font-medium text-gray-400 block mb-2">Thème</label>
                          <div className="flex gap-2">
                            {(['dark', 'light', 'auto'] as WidgetTheme[]).map(theme => (
                              <button
                                key={theme}
                                onClick={() => updateWidget(widget.id, { theme })}
                                className={`flex-1 py-3 rounded-xl text-sm font-medium capitalize transition-all ${
                                  widget.theme === theme
                                    ? 'bg-gradient-to-r from-crypto-blue to-blue-600 text-white shadow-lg shadow-crypto-blue/25'
                                    : 'bg-slate-800/80 text-gray-400 hover:text-white'
                                }`}
                              >
                                <div className="flex flex-col items-center gap-1">
                                  {theme === 'dark' && <Moon className="w-5 h-5" />}
                                  {theme === 'light' && <Sun className="w-5 h-5" />}
                                  {theme === 'auto' && <Palette className="w-5 h-5" />}
                                  <span className="text-xs">{theme}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => setEditingWidget(null)}
                          className="w-full py-3 bg-gradient-to-r from-crypto-blue to-blue-600 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-crypto-blue/25 transition-all"
                        >
                          Enregistrer et fermer
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONFIGURE TAB - Style amélioré */}
      {activeTab === 'configure' && (
        <div className="space-y-6">
          {/* Layouts */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-crypto-blue/20 rounded-xl">
                <Layout className="w-5 h-5 text-crypto-blue" />
              </div>
              <h3 className="font-semibold text-lg text-white">Layouts Sauvegardés</h3>
            </div>
            
            {/* Save New Layout */}
            <div className="flex gap-3 mb-5">
              <input
                type="text"
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
                placeholder="Nom du layout..."
                className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-crypto-blue transition-colors"
              />
              <button
                onClick={handleSaveLayout}
                disabled={!layoutName.trim()}
                className="px-5 py-3 bg-gradient-to-r from-crypto-accent to-emerald-600 rounded-xl text-sm font-semibold disabled:opacity-50 hover:shadow-lg hover:shadow-crypto-accent/20 transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Sauver
              </button>
            </div>

            {/* Saved Layouts */}
            <div className="space-y-3">
              {layouts.map(layout => (
                <div
                  key={layout.id}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    activeLayoutId === layout.id 
                      ? 'bg-gradient-to-r from-crypto-blue/20 to-blue-500/10 border border-crypto-blue/40' 
                      : 'bg-slate-900/50 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${activeLayoutId === layout.id ? 'bg-crypto-blue/30' : 'bg-slate-800'}`}>
                      <Grid className={`w-4 h-4 ${activeLayoutId === layout.id ? 'text-crypto-blue' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="font-medium text-white">{layout.name}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <span className="px-2 py-0.5 bg-slate-800 rounded-full">{layout.widgets.length} widgets</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadLayout(layout.id)}
                      className="p-2.5 text-crypto-blue hover:bg-crypto-blue/20 rounded-lg transition-all"
                      title="Charger"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteLayout(layout.id)}
                      className="p-2.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {layouts.length === 0 && (
                <div className="text-center py-8 px-4 bg-slate-900/30 rounded-xl border border-dashed border-slate-700">
                  <Layout className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-400">Aucun layout sauvegardé</p>
                  <p className="text-xs text-gray-500 mt-1">Créez un layout pour sauvegarder votre configuration</p>
                </div>
              )}
            </div>
          </div>

          {/* Widget List */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-purple-500/20 rounded-xl">
                <Settings className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="font-semibold text-lg text-white">Widgets Configurés</h3>
              <span className="ml-auto px-3 py-1 bg-slate-700 rounded-full text-xs font-medium text-gray-300">
                {widgets.length} total
              </span>
            </div>
            <div className="space-y-3">
              {widgets.map((widget, index) => (
                <div key={widget.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-800 rounded-lg">
                      <WidgetIcon type={widget.type} className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-white">{WIDGET_TYPE_LABELS[widget.type]}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                        {widget.symbol && <span className="px-2 py-0.5 bg-crypto-blue/20 text-crypto-blue rounded">{widget.symbol}</span>}
                        <span className="text-slate-500">•</span>
                        <span>{REFRESH_INTERVALS.find(i => i.value === widget.refreshInterval)?.label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {index > 0 && (
                      <button
                        onClick={() => {
                          const newOrder = [...widgets];
                          [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
                          reorderWidgets(newOrder.map(w => w.id));
                        }}
                        className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                    )}
                    {index < widgets.length - 1 && (
                      <button
                        onClick={() => {
                          const newOrder = [...widgets];
                          [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                          reorderWidgets(newOrder.map(w => w.id));
                        }}
                        className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => removeWidget(widget.id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {widgets.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  Aucun widget configuré
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE TAB - Style amélioré */}
      {activeTab === 'mobile' && (
        <div className="space-y-6">
          {/* Platform Status */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-crypto-blue/20 rounded-xl">
                <Smartphone className="w-5 h-5 text-crypto-blue" />
              </div>
              <h3 className="font-semibold text-lg text-white">Votre Appareil</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-5 rounded-2xl border-2 transition-all ${platform === 'ios' ? 'bg-gradient-to-br from-crypto-blue/20 to-blue-500/10 border-crypto-blue/50 shadow-lg shadow-crypto-blue/10' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-slate-800 rounded-xl">
                    <Apple className="w-8 h-8 text-white" />
                  </div>
                  {platform === 'ios' && <CheckCircle className="w-6 h-6 text-crypto-green" />}
                </div>
                <div className="font-semibold text-white text-lg">iOS</div>
                <div className="text-sm text-gray-400">iPhone & iPad</div>
              </div>
              
              <div className={`p-5 rounded-2xl border-2 transition-all ${platform === 'android' ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-green-500/50 shadow-lg shadow-green-500/10' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-500/20 rounded-xl">
                    <Bot className="w-8 h-8 text-green-400" />
                  </div>
                  {platform === 'android' && <CheckCircle className="w-6 h-6 text-crypto-green" />}
                </div>
                <div className="font-semibold text-white text-lg">Android</div>
                <div className="text-sm text-gray-400">Tous appareils</div>
              </div>
              
              <div className={`p-5 rounded-2xl border-2 transition-all ${platform === 'desktop' ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border-blue-500/50 shadow-lg shadow-blue-500/10' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <Laptop className="w-8 h-8 text-blue-400" />
                  </div>
                  {platform === 'desktop' && <CheckCircle className="w-6 h-6 text-crypto-green" />}
                </div>
                <div className="font-semibold text-white text-lg">Desktop</div>
                <div className="text-sm text-gray-400">Windows, Mac, Linux</div>
              </div>
            </div>

            {/* PWA Status */}
            <div className="mt-6 p-5 bg-slate-900/50 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${isPWA() ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                    {isPWA() ? <CheckCircle className="w-6 h-6 text-green-400" /> : <Globe className="w-6 h-6 text-yellow-400" />}
                  </div>
                  <div>
                    <div className="font-semibold text-white">Status PWA</div>
                    <div className="text-sm text-gray-400">
                      {isPWA() ? 'Installée comme application native' : 'Utilisé dans le navigateur'}
                    </div>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-full text-xs font-medium ${isPWA() ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {isPWA() ? 'Installé' : 'Non installé'}
                </div>
              </div>
              
              {!isPWA() && (
                <button
                  onClick={addToHomeScreen}
                  className="mt-5 w-full py-3 bg-gradient-to-r from-crypto-accent to-emerald-600 rounded-xl text-sm font-semibold text-white shadow-lg shadow-crypto-accent/20 hover:shadow-crypto-accent/40 transition-all"
                >
                  Ajouter à l'écran d'accueil
                </button>
              )}
            </div>
          </div>

          {/* Installation Instructions */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-green-500/20 rounded-xl">
                <Download className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="font-semibold text-lg text-white">Guide d'installation</h3>
            </div>
            
            {platform === 'ios' && (
              <ol className="space-y-4">
                <li className="flex gap-4 items-start p-4 bg-slate-900/50 rounded-xl">
                  <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-crypto-blue to-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-crypto-blue/25">1</span>
                  <div>
                    <p className="font-medium text-white">Appuyez sur le bouton "Partager"</p>
                    <p className="text-sm text-gray-400 mt-1">En bas de l'écran dans Safari</p>
                  </div>
                </li>
                <li className="flex gap-4 items-start p-4 bg-slate-900/50 rounded-xl">
                  <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-crypto-blue to-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-crypto-blue/25">2</span>
                  <div>
                    <p className="font-medium text-white">Faites défiler vers le bas</p>
                    <p className="text-sm text-gray-400 mt-1">Appuyez sur "Sur l'écran d'accueil"</p>
                  </div>
                </li>
                <li className="flex gap-4 items-start p-4 bg-slate-900/50 rounded-xl">
                  <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-crypto-blue to-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-crypto-blue/25">3</span>
                  <div>
                    <p className="font-medium text-white">Appuyez sur "Ajouter"</p>
                    <p className="text-sm text-gray-400 mt-1">En haut à droite de l'écran</p>
                  </div>
                </li>
                <li className="flex gap-4 items-start p-4 bg-slate-900/50 rounded-xl">
                  <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-purple-500/25">4</span>
                  <div>
                    <p className="font-medium text-white">Pour ajouter un widget</p>
                    <p className="text-sm text-gray-400 mt-1">Appuyez longuement sur l'écran d'accueil → + → Cherchez NEUROVEST</p>
                  </div>
                </li>
              </ol>
            )}
            
            {platform === 'android' && (
              <ol className="space-y-4">
                <li className="flex gap-4 items-start p-4 bg-slate-900/50 rounded-xl">
                  <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-green-500/25">1</span>
                  <div>
                    <p className="font-medium text-white">Ouvrez le menu Chrome</p>
                    <p className="text-sm text-gray-400 mt-1">Appuyez sur ⋮ en haut à droite</p>
                  </div>
                </li>
                <li className="flex gap-4 items-start p-4 bg-slate-900/50 rounded-xl">
                  <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-green-500/25">2</span>
                  <div>
                    <p className="font-medium text-white">Sélectionnez l'option</p>
                    <p className="text-sm text-gray-400 mt-1">"Ajouter à l'écran d'accueil"</p>
                  </div>
                </li>
                <li className="flex gap-4 items-start p-4 bg-slate-900/50 rounded-xl">
                  <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-green-500/25">3</span>
                  <div>
                    <p className="font-medium text-white">Confirmez l'installation</p>
                    <p className="text-sm text-gray-400 mt-1">Appuyez sur "Ajouter"</p>
                  </div>
                </li>
                <li className="flex gap-4 items-start p-4 bg-slate-900/50 rounded-xl">
                  <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-purple-500/25">4</span>
                  <div>
                    <p className="font-medium text-white">Pour ajouter un widget</p>
                    <p className="text-sm text-gray-400 mt-1">Appuyez longuement sur l'écran d'accueil → Widgets → NEUROVEST</p>
                  </div>
                </li>
              </ol>
            )}
            
            {platform === 'desktop' && (
              <ol className="space-y-4">
                <li className="flex gap-4 items-start p-4 bg-slate-900/50 rounded-xl">
                  <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-500/25">1</span>
                  <div>
                    <p className="font-medium text-white">Chrome / Edge</p>
                    <p className="text-sm text-gray-400 mt-1">Cliquez sur l'icône ➕ dans la barre d'adresse</p>
                  </div>
                </li>
                <li className="flex gap-4 items-start p-4 bg-slate-900/50 rounded-xl">
                  <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-500/25">2</span>
                  <div>
                    <p className="font-medium text-white">Firefox</p>
                    <p className="text-sm text-gray-400 mt-1">Menu → Installer NEUROVEST</p>
                  </div>
                </li>
                <li className="flex gap-4 items-start p-4 bg-slate-900/50 rounded-xl">
                  <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-500/25">3</span>
                  <div>
                    <p className="font-medium text-white">Safari Mac</p>
                    <p className="text-sm text-gray-400 mt-1">Fichier → Ajouter au Dock</p>
                  </div>
                </li>
              </ol>
            )}
          </div>
        </div>
      )}

      {/* PRESETS TAB - Style amélioré */}
      {activeTab === 'presets' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {WIDGET_PRESETS.map(preset => {
              const PresetIcon = PRESET_ICON_COMPONENTS[preset.id] || Sparkles;
              return (
              <div key={preset.id} className="group bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 hover:border-crypto-accent/50 hover:bg-slate-800/60 transition-all duration-300">
                <div className="mb-5 p-4 bg-gradient-to-br from-crypto-accent/20 to-emerald-500/10 rounded-2xl w-fit">
                  <PresetIcon className="w-10 h-10 text-crypto-accent" />
                </div>
                <h3 className="font-semibold text-lg text-white mb-2">{preset.name}</h3>
                <p className="text-sm text-gray-400 mb-5 leading-relaxed">{preset.description}</p>
                <div className="flex items-center gap-3 mb-5 p-3 bg-slate-900/50 rounded-xl">
                  <span className="text-xs text-gray-500 font-medium">{preset.widgets.length} widgets:</span>
                  <div className="flex gap-1.5">
                    {preset.widgets.map((w, i) => (
                      <div key={i} className="p-1.5 bg-slate-800 rounded-lg">
                        <WidgetIcon type={w.type} className="w-4 h-4 text-crypto-blue" />
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleLoadPreset(preset.id)}
                  className="w-full py-3 bg-gradient-to-r from-crypto-accent to-emerald-600 rounded-xl text-sm font-semibold text-white shadow-lg shadow-crypto-accent/20 hover:shadow-crypto-accent/40 hover:scale-[1.02] transition-all"
                >
                  Charger ce preset
                </button>
              </div>
              );
            })}
          </div>

          {/* Custom Preset Info */}
          <div className="bg-gradient-to-r from-crypto-blue/10 via-blue-500/5 to-transparent border border-crypto-blue/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-crypto-blue/20 rounded-xl">
                <Info className="w-6 h-6 text-crypto-blue" />
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Créer votre propre preset</h4>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Configurez vos widgets dans l'onglet "Dashboard", sauvegardez comme layout dans "Configurer", 
                  puis exportez la configuration pour la partager ou la réutiliser.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Widget Modal - Style amélioré */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-crypto-accent to-emerald-600 rounded-2xl">
                  <Plus className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Ajouter un Widget</h3>
                  <p className="text-sm text-gray-400">Choisissez le type de widget à ajouter</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-3 hover:bg-slate-800 rounded-xl transition-all">
                <ChevronUp className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(Object.keys(WIDGET_ICON_COMPONENTS) as WidgetType[]).map(type => {
                const IconComp = WIDGET_ICON_COMPONENTS[type];
                return (
                  <button
                    key={type}
                    onClick={() => handleAddWidget(type)}
                    className="group p-6 bg-slate-800/50 border border-slate-700 rounded-2xl hover:bg-slate-700/50 hover:border-crypto-blue/50 transition-all text-left"
                  >
                    <div className="mb-4 p-4 bg-slate-700/50 rounded-2xl w-fit group-hover:bg-crypto-blue/20 group-hover:scale-110 transition-all">
                      <IconComp className="w-8 h-8 text-crypto-blue" />
                    </div>
                    <div className="font-semibold text-white text-lg">{WIDGET_TYPE_LABELS[type]}</div>
                    <div className="text-sm text-gray-500 mt-1">Cliquez pour ajouter</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Export Modal - Style amélioré */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-gradient-to-br from-crypto-blue to-blue-600 rounded-2xl">
                <Download className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Exporter la Configuration</h3>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              La configuration sera copiée dans votre presse-papiers. Vous pouvez la sauvegarder ou la partager avec d'autres utilisateurs.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleExport}
                className="flex-1 py-3.5 bg-gradient-to-r from-crypto-accent to-emerald-600 rounded-xl text-sm font-semibold text-white shadow-lg shadow-crypto-accent/20 hover:shadow-crypto-accent/40 transition-all flex items-center justify-center gap-2"
              >
                <Copy className="w-5 h-5" />
                Copier dans le presse-papiers
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal - Style amélioré */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl">
                <Upload className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Importer une Configuration</h3>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Collez votre configuration JSON ici:
            </p>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='{"widgets": [...], "layouts": [...]}'
              className="w-full h-40 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-sm font-mono resize-none mb-6 focus:outline-none focus:border-crypto-blue transition-colors"
            />
            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={!importJson.trim()}
                className="flex-1 py-3.5 bg-gradient-to-r from-crypto-accent to-emerald-600 rounded-xl text-sm font-semibold text-white shadow-lg shadow-crypto-accent/20 hover:shadow-crypto-accent/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Importer
              </button>
              <button
                onClick={() => { setShowImportModal(false); setImportJson(''); }}
                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
