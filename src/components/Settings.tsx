import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, Key, Bell, Moon, Sun, Shield, Save, CheckCircle,
  ExternalLink, Lock, AlertTriangle, Wallet, Brain, Bot, RefreshCw,
  Globe, Trash2, X, Loader2, Zap, Target, Activity, Database, Check,
  AlertCircle, ChevronRight, Monitor
} from 'lucide-react';
import { testAuthenticatedConnection } from '../services/binanceApi';
import { showToast } from '../stores/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface SettingsState {
  realTradingEnabled: boolean;
  aiEnabled: boolean;
  aiAggressiveness: number;
  aiScoreThreshold: number;
  botEnabled: boolean;
  botMode: 'SAFE' | 'NORMAL' | 'AGRESSIF';
  botRiskPerTrade: number;
  autoRefresh: boolean;
  refreshInterval: number;
  webSocketEnabled: boolean;
  priceAlerts: boolean;
  aiSignals: boolean;
  tradeNotifications: boolean;
  theme: 'dark' | 'light';
  language: 'FR' | 'EN';
}

interface ResetModalState {
  open: boolean;
  confirmText: string;
  loading: boolean;
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsState>({
    realTradingEnabled: false,
    aiEnabled: true,
    aiAggressiveness: 50,
    aiScoreThreshold: 70,
    botEnabled: false,
    botMode: 'SAFE',
    botRiskPerTrade: 1,
    autoRefresh: true,
    refreshInterval: 30,
    webSocketEnabled: true,
    priceAlerts: true,
    aiSignals: true,
    tradeNotifications: true,
    theme: 'dark',
    language: 'FR',
  });

  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [binanceConnected, setBinanceConnected] = useState(false);
  const [testingBinance, setTestingBinance] = useState(false);
  const [resetModal, setResetModal] = useState<ResetModalState>({ open: false, confirmText: '', loading: false });
  const [enablingRealTrading, setEnablingRealTrading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { setLoading(false); return; }

      const res = await fetch(`${API_URL}/api/settings`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(prev => ({ ...prev, ...data.settings }));
          setBinanceConnected(data.binanceConnected || false);
        }
      }

      // Appliquer le thème
      const savedTheme = localStorage.getItem('theme') as 'dark' | 'light';
      if (savedTheme) {
        setSettings(prev => ({ ...prev, theme: savedTheme }));
        applyTheme(savedTheme);
      }
    } catch (error) {
      console.error('Erreur chargement paramètres:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (theme: 'dark' | 'light') => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  };

  const saveSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { showToast.error('Session expirée', 'Erreur'); return; }

      const res = await fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error('Erreur sauvegarde');

      localStorage.setItem('theme', settings.theme);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      showToast.success('Paramètres sauvegardés', 'Succès');
    } catch (error) {
      showToast.error('Erreur sauvegarde', 'Erreur');
    }
  };

  const testBinanceConnection = async () => {
    setTestingBinance(true);
    try {
      const result = await testAuthenticatedConnection();
      if (result.success) {
        setBinanceConnected(true);
        showToast.success('Connexion Binance réussie', 'Succès');
      } else {
        showToast.error('Connexion échouée - Vérifiez vos clés', 'Erreur');
      }
    } catch (error) {
      showToast.error('Erreur connexion Binance', 'Erreur');
    } finally {
      setTestingBinance(false);
    }
  };

  const toggleRealTrading = async () => {
    if (settings.realTradingEnabled) {
      setSettings(prev => ({ ...prev, realTradingEnabled: false }));
      return;
    }

    setEnablingRealTrading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { showToast.error('Session expirée', 'Erreur'); return; }

      // Vérifier si Binance est connecté
      const result = await testAuthenticatedConnection();
      if (!result.success) {
        showToast.error('Veuillez connecter Binance d\'abord', 'Erreur');
        return;
      }

      setSettings(prev => ({ ...prev, realTradingEnabled: true }));
      showToast.success('Trading réel activé', 'Succès');
    } catch (error) {
      showToast.error('Erreur activation', 'Erreur');
    } finally {
      setEnablingRealTrading(false);
    }
  };

  const handleResetData = async () => {
    if (resetModal.confirmText !== 'RESET') return;

    setResetModal(prev => ({ ...prev, loading: true }));
    try {
      const token = localStorage.getItem('token');
      if (!token) { showToast.error('Session expirée', 'Erreur'); return; }

      const res = await fetch(`${API_URL}/api/data/reset`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Erreur reset');

      localStorage.clear();
      showToast.success('Données réinitialisées - Rechargez la page', 'Succès');
      setResetModal({ open: false, confirmText: '', loading: false });
    } catch (error) {
      showToast.error('Erreur réinitialisation', 'Erreur');
      setResetModal(prev => ({ ...prev, loading: false }));
    }
  };

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return (<div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-crypto-blue" /></div>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-crypto-blue" />
          Paramètres
        </h1>
        <button onClick={saveSettings} className="px-4 py-2 bg-crypto-blue hover:bg-crypto-blue/80 rounded-lg font-medium flex items-center gap-2 transition-colors">
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Enregistré!' : 'Sauvegarder'}
        </button>
      </div>

      {/* Sécurité Globale */}
      <div className="crypto-card border-2 border-crypto-red/30">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-crypto-red" />
          <h2 className="font-semibold text-crypto-red">Sécurité Globale</h2>
        </div>
        <div className="bg-crypto-red/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">Trading Réel</span>
              <Lock className="w-4 h-4 text-crypto-red" />
            </div>
            <button
              onClick={toggleRealTrading}
              disabled={enablingRealTrading}
              className={`w-12 h-6 rounded-full transition-colors ${settings.realTradingEnabled ? 'bg-crypto-red' : 'bg-crypto-gray'} disabled:opacity-50`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.realTradingEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            ⚠️ Activez uniquement si vous comprenez les risques. Les ordres seront exécutés avec votre argent réel.
          </p>
          {settings.realTradingEnabled && (
            <div className="flex items-center gap-2 text-crypto-green p-2 bg-crypto-green/10 rounded">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Trading réel activé - Binance connecté: {binanceConnected ? '✓' : '✗'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Clés API */}
      <div className="crypto-card">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-crypto-blue" />
          <h2 className="font-semibold">Clés API Binance</h2>
          {binanceConnected && (<span className="px-2 py-0.5 rounded text-xs bg-crypto-green/20 text-crypto-green">Connecté</span>)}
        </div>
        <div className="bg-crypto-dark/50 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-yellow-500 mb-1">Sécurité Maximale</p>
              <p>Vos clés API sont stockées côté backend (chiffré AES-256). Elles ne sont jamais exposées au frontend.</p>
            </div>
          </div>
          <button
            onClick={testBinanceConnection}
            disabled={testingBinance}
            className="w-full py-3 bg-crypto-blue hover:bg-crypto-blue/80 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {testingBinance ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {testingBinance ? 'Test...' : 'Tester Connexion'}
          </button>
          <a href="https://www.binance.com/fr/my/settings/api-management" target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 text-crypto-blue text-sm hover:underline">
            <ExternalLink className="w-3 h-3" /> Créer des clés API
          </a>
        </div>
      </div>

      {/* Configuration IA */}
      <div className="crypto-card">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-crypto-purple" />
          <h2 className="font-semibold">Configuration IA (@Ethernal)</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Activer l'IA</div>
              <div className="text-sm text-gray-400">Génère des signaux et analyses</div>
            </div>
            <button onClick={() => updateSetting('aiEnabled', !settings.aiEnabled)} className={`w-12 h-6 rounded-full transition-colors ${settings.aiEnabled ? 'bg-crypto-purple' : 'bg-crypto-gray'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.aiEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {settings.aiEnabled && (
            <>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Agressivité: {settings.aiAggressiveness}%</label>
                <input type="range" min="0" max="100" value={settings.aiAggressiveness} onChange={(e) => updateSetting('aiAggressiveness', parseInt(e.target.value))} className="w-full" />
                <div className="flex justify-between text-xs text-gray-500 mt-1"><span>Prudent</span><span>Agressif</span></div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Seuil Score: {settings.aiScoreThreshold}+</label>
                <input type="range" min="50" max="95" value={settings.aiScoreThreshold} onChange={(e) => updateSetting('aiScoreThreshold', parseInt(e.target.value))} className="w-full" />
                <div className="flex justify-between text-xs text-gray-500 mt-1"><span>50%</span><span>95%</span></div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Configuration Bot */}
      <div className="crypto-card">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-crypto-green" />
          <h2 className="font-semibold">Configuration Bot</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Activer le Bot</div>
              <div className="text-sm text-gray-400">Trading automatisé</div>
            </div>
            <button onClick={() => updateSetting('botEnabled', !settings.botEnabled)} className={`w-12 h-6 rounded-full transition-colors ${settings.botEnabled ? 'bg-crypto-green' : 'bg-crypto-gray'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.botEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {settings.botEnabled && (
            <>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['SAFE', 'NORMAL', 'AGRESSIF'] as const).map((mode) => (
                    <button key={mode} onClick={() => updateSetting('botMode', mode)} className={`py-2 rounded-lg font-medium transition-colors ${settings.botMode === mode ? 'bg-crypto-blue text-white' : 'bg-crypto-gray text-gray-400'}`}>{mode}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Risque par Trade: {settings.botRiskPerTrade}%</label>
                <input type="range" min="0.5" max="5" step="0.5" value={settings.botRiskPerTrade} onChange={(e) => updateSetting('botRiskPerTrade', parseFloat(e.target.value))} className="w-full" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Paramètres Données */}
      <div className="crypto-card">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-crypto-blue" />
          <h2 className="font-semibold">Paramètres Données</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Auto-Refresh</div>
              <div className="text-sm text-gray-400">Mise à jour automatique</div>
            </div>
            <button onClick={() => updateSetting('autoRefresh', !settings.autoRefresh)} className={`w-12 h-6 rounded-full transition-colors ${settings.autoRefresh ? 'bg-crypto-blue' : 'bg-crypto-gray'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.autoRefresh ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {settings.autoRefresh && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Intervalle: {settings.refreshInterval}s</label>
              <input type="range" min="10" max="120" value={settings.refreshInterval} onChange={(e) => updateSetting('refreshInterval', parseInt(e.target.value))} className="w-full" />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">WebSocket</div>
              <div className="text-sm text-gray-400">Temps réel</div>
            </div>
            <button onClick={() => updateSetting('webSocketEnabled', !settings.webSocketEnabled)} className={`w-12 h-6 rounded-full transition-colors ${settings.webSocketEnabled ? 'bg-crypto-blue' : 'bg-crypto-gray'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.webSocketEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="crypto-card">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-crypto-blue" />
          <h2 className="font-semibold">Notifications</h2>
        </div>
        <div className="space-y-3">
          {[
            { key: 'priceAlerts', label: 'Alertes de Prix', desc: 'Notifications pour vos alertes configurées' },
            { key: 'aiSignals', label: 'Signaux IA', desc: 'Nouveaux signaux générés par l\'IA' },
            { key: 'tradeNotifications', label: 'Trades Exécutés', desc: 'Confirmation des trades' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <div className="font-medium">{item.label}</div>
                <div className="text-sm text-gray-400">{item.desc}</div>
              </div>
              <button onClick={() => updateSetting(item.key as keyof SettingsState, !settings[item.key as keyof SettingsState])} className={`w-12 h-6 rounded-full transition-colors ${settings[item.key as keyof SettingsState] ? 'bg-crypto-blue' : 'bg-crypto-gray'}`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings[item.key as keyof SettingsState] ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* UI / UX */}
      <div className="crypto-card">
        <div className="flex items-center gap-2 mb-4">
          <Monitor className="w-5 h-5 text-crypto-blue" />
          <h2 className="font-semibold">Interface</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Thème</label>
            <div className="flex gap-3">
              <button onClick={() => { updateSetting('theme', 'dark'); applyTheme('dark'); }} className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors ${settings.theme === 'dark' ? 'bg-crypto-blue text-white' : 'bg-crypto-gray text-gray-400'}`}>
                <Moon className="w-4 h-4" /> Sombre
              </button>
              <button onClick={() => { updateSetting('theme', 'light'); applyTheme('light'); }} className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors ${settings.theme === 'light' ? 'bg-crypto-orange text-white' : 'bg-crypto-gray text-gray-400'}`}>
                <Sun className="w-4 h-4" /> Clair
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Langue</label>
            <div className="flex gap-3">
              <button onClick={() => updateSetting('language', 'FR')} className={`flex-1 py-2 rounded-lg transition-colors ${settings.language === 'FR' ? 'bg-crypto-blue text-white' : 'bg-crypto-gray text-gray-400'}`}>Français</button>
              <button onClick={() => updateSetting('language', 'EN')} className={`flex-1 py-2 rounded-lg transition-colors ${settings.language === 'EN' ? 'bg-crypto-blue text-white' : 'bg-crypto-gray text-gray-400'}`}>English</button>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Données */}
      <div className="crypto-card border-2 border-crypto-red/30">
        <h2 className="font-semibold mb-4 text-crypto-red flex items-center gap-2"><Trash2 className="w-5 h-5" />Réinitialiser les Données</h2>
        <div className="bg-crypto-red/10 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-4">Cette action supprimera toutes vos données locales. C'est irréversible.</p>
          <button onClick={() => setResetModal({ open: true, confirmText: '', loading: false })} className="w-full py-3 bg-crypto-red hover:bg-crypto-red/80 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors">
            <Trash2 className="w-4 h-4" /> Réinitialiser
          </button>
        </div>
      </div>

      {/* Modal Reset */}
      {resetModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-crypto-dark border border-white/10 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-crypto-red" />
              <h3 className="text-lg font-semibold">Confirmation Requise</h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">Pour confirmer, tapez <code className="text-crypto-red">RESET</code></p>
            <input type="text" value={resetModal.confirmText} onChange={(e) => setResetModal({ ...resetModal, confirmText: e.target.value })} className="w-full bg-crypto-gray border border-white/10 rounded-lg px-4 py-2 mb-4 focus:border-crypto-red focus:outline-none" placeholder="RESET" />
            <div className="flex gap-3">
              <button onClick={() => setResetModal({ open: false, confirmText: '', loading: false })} className="flex-1 py-2 bg-crypto-gray hover:bg-crypto-gray/80 rounded-lg transition-colors">Annuler</button>
              <button onClick={handleResetData} disabled={resetModal.confirmText !== 'RESET' || resetModal.loading} className="flex-1 py-2 bg-crypto-red hover:bg-crypto-red/80 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {resetModal.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {resetModal.loading ? 'Suppression...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
