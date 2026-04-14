import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, Bell, Moon, Sun, Shield, Save, CheckCircle, ExternalLink, Lock, AlertTriangle, Wallet } from 'lucide-react';
import { getDecryptedKey, saveEncryptedKey, hasEncryptedKey, clearEncryptedKey } from '../utils/crypto';
import { testAuthenticatedConnection, hasApiKey } from '../services/binanceApi';

interface SettingsState {
  groqApiKey: string;
  binanceApiKey: string;
  binanceSecretKey: string;
  enableRealTrading: boolean;
  theme: 'dark' | 'light';
  notifications: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsState>({
    groqApiKey: '',
    binanceApiKey: '',
    binanceSecretKey: '',
    enableRealTrading: false,
    theme: 'dark',
    notifications: true,
    autoRefresh: true,
    refreshInterval: 3,
  });
  const [saved, setSaved] = useState(false);
  const [apiStatus, setApiStatus] = useState<{ groq: boolean; binance: boolean }>({ groq: false, binance: false });
  const [testingBinance, setTestingBinance] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('trading_settings');
    const binanceKey = getDecryptedKey('binance_api_key');
    const binanceSecret = getDecryptedKey('binance_secret_key');
    
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(prev => ({ 
        ...prev, 
        ...parsed,
        binanceApiKey: binanceKey || '',
        binanceSecretKey: binanceSecret || '',
      }));
      
      // Apply theme
      if (parsed.theme === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
      
      // Check API keys
      setApiStatus({
        groq: !!parsed.groqApiKey && parsed.groqApiKey !== 'ta_cle_groq_ici',
        binance: !!binanceKey && !!binanceSecret,
      });
    }
  }, []);

  // Apply theme when it changes
  useEffect(() => {
    if (settings.theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [settings.theme]);

  // Save settings
  const saveSettings = async () => {
    // Save non-sensitive settings
    const { binanceApiKey, binanceSecretKey, ...publicSettings } = settings;
    localStorage.setItem('trading_settings', JSON.stringify(publicSettings));
    
    // Encrypt and save API keys separately
    if (binanceApiKey) {
      saveEncryptedKey('binance_api_key', binanceApiKey);
    }
    if (binanceSecretKey) {
      saveEncryptedKey('binance_secret_key', binanceSecretKey);
    }
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    
    // Update API status
    setApiStatus({
      groq: !!settings.groqApiKey && settings.groqApiKey !== 'ta_cle_groq_ici',
      binance: !!binanceApiKey && !!binanceSecretKey,
    });
  };

  // Test Binance connection with authentication
  const testBinanceConnection = async () => {
    setTestingBinance(true);
    try {
      // Sauvegarder d'abord les clés pour le test
      if (settings.binanceApiKey) {
        saveEncryptedKey('binance_api_key', settings.binanceApiKey);
      }
      if (settings.binanceSecretKey) {
        saveEncryptedKey('binance_secret_key', settings.binanceSecretKey);
      }
      
      const result = await testAuthenticatedConnection();
      alert(result.message);
      
      if (result.success) {
        setApiStatus(prev => ({ ...prev, binance: true }));
      }
    } catch (error) {
      alert('Erreur de connexion');
    } finally {
      setTestingBinance(false);
    }
  };

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-crypto-blue" />
          Paramètres
        </h1>
        <button
          onClick={saveSettings}
          className="btn-primary flex items-center gap-2"
        >
          {saved ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Enregistré!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Sauvegarder
            </>
          )}
        </button>
      </div>

      {/* TRADING RÉEL - Binance */}
      <div className="crypto-card border-2 border-crypto-accent/30">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-crypto-accent" />
          <h2 className="font-semibold text-crypto-accent">Trading Réel Binance</h2>
          {apiStatus.binance && (
            <span className="px-2 py-0.5 rounded text-xs bg-crypto-green/20 text-crypto-green">
              Connecté
            </span>
          )}
        </div>

        <div className="bg-crypto-dark/50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">Activer le trading réel</span>
              <Lock className="w-4 h-4 text-crypto-accent" />
            </div>
            <button
              onClick={() => updateSetting('enableRealTrading', !settings.enableRealTrading)}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.enableRealTrading ? 'bg-crypto-accent' : 'bg-crypto-dark'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.enableRealTrading ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            ⚠️ Mode réel : exécute de vrais ordres sur Binance avec votre argent
          </p>

          {settings.enableRealTrading && (
            <div className="space-y-3 border-t border-crypto-border pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">API Key Binance</span>
                <span className="text-xs text-crypto-accent flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Chiffré
                </span>
              </div>
              <input
                type="password"
                value={settings.binanceApiKey}
                onChange={(e) => updateSetting('binanceApiKey', e.target.value)}
                placeholder="Collez votre API Key Binance"
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
              />
              <input
                type="password"
                value={settings.binanceSecretKey}
                onChange={(e) => updateSetting('binanceSecretKey', e.target.value)}
                placeholder="Collez votre Secret Key Binance"
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={testBinanceConnection}
                  disabled={testingBinance || !settings.binanceApiKey || !settings.binanceSecretKey}
                  className="flex-1 py-2 bg-crypto-blue/20 text-crypto-blue rounded-lg hover:bg-crypto-blue/30 transition-colors disabled:opacity-50 text-sm"
                >
                  {testingBinance ? 'Test...' : 'Tester connexion'}
                </button>
                <a
                  href="https://www.binance.com/fr/my/settings/api-management"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 bg-crypto-dark text-gray-400 rounded-lg hover:text-white transition-colors text-sm flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Créer clé
                </a>
              </div>
              <p className="text-xs text-gray-500">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Données chiffrées AES-256. N'utilisez que des clés avec permission "Spot Trading".
              </p>
            </div>
          )}
        </div>
      </div>

      {/* API Keys Section */}
      <div className="crypto-card">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-crypto-blue" />
          <h2 className="font-semibold">Configuration IA</h2>
        </div>
        
        <div className="bg-crypto-dark/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Groq API (IA)</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  apiStatus.groq ? 'bg-crypto-green/20 text-crypto-green' : 'bg-crypto-red/20 text-crypto-red'
                }`}>
                  {apiStatus.groq ? 'Connecté' : 'Non configuré'}
                </span>
              </div>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-crypto-blue text-sm flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Obtenir clé
              </a>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Nécessaire pour les analyses IA et les stratégies générées automatiquement
            </p>
            <input
              type="password"
              value={settings.groqApiKey}
              onChange={(e) => updateSetting('groqApiKey', e.target.value)}
              placeholder="API Key Groq"
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
            />
          </div>
      </div>

      {/* Notifications */}
      <div className="crypto-card">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-crypto-blue" />
          <h2 className="font-semibold">Notifications</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Activer les notifications</div>
              <div className="text-sm text-gray-400">Alertes de prix et signaux de trading</div>
            </div>
            <button
              onClick={() => updateSetting('notifications', !settings.notifications)}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.notifications ? 'bg-crypto-blue' : 'bg-crypto-dark'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.notifications ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Data Refresh */}
      <div className="crypto-card">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-crypto-blue" />
          <h2 className="font-semibold">Rafraîchissement des données</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Auto-refresh</div>
              <div className="text-sm text-gray-400">Met à jour les prix automatiquement</div>
            </div>
            <button
              onClick={() => updateSetting('autoRefresh', !settings.autoRefresh)}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.autoRefresh ? 'bg-crypto-blue' : 'bg-crypto-dark'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.autoRefresh ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {settings.autoRefresh && (
            <div>
              <label className="text-sm text-gray-400">
                Intervalle de rafraîchissement: {settings.refreshInterval} secondes
              </label>
              <input
                type="range"
                min="1"
                max="60"
                value={settings.refreshInterval}
                onChange={(e) => updateSetting('refreshInterval', parseInt(e.target.value))}
                className="w-full mt-2"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1s (rapide)</span>
                <span>60s (économique)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Theme */}
      <div className="crypto-card">
        <div className="flex items-center gap-2 mb-4">
          {settings.theme === 'dark' ? (
            <Moon className="w-5 h-5 text-crypto-blue" />
          ) : (
            <Sun className="w-5 h-5 text-crypto-orange" />
          )}
          <h2 className="font-semibold">Thème</h2>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => updateSetting('theme', 'dark')}
            className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors ${
              settings.theme === 'dark'
                ? 'bg-crypto-blue text-white'
                : 'bg-crypto-dark text-gray-400'
            }`}
          >
            <Moon className="w-4 h-4" />
            Sombre
          </button>
          <button
            onClick={() => updateSetting('theme', 'light')}
            className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors ${
              settings.theme === 'light'
                ? 'bg-crypto-orange text-white'
                : 'bg-crypto-dark text-gray-400'
            }`}
          >
            <Sun className="w-4 h-4" />
            Clair
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="crypto-card">
        <h2 className="font-semibold mb-4">Gestion des données</h2>
        <div className="space-y-3">
          <button
            onClick={() => {
              if (confirm('Supprimer toutes les données locales ? Cette action est irréversible.')) {
                localStorage.removeItem('trading_strategies');
                localStorage.removeItem('trading_alerts');
                localStorage.removeItem('trading_portfolio');
                localStorage.removeItem('trading_journal');
                localStorage.removeItem('trading_settings');
                alert('Données supprimées. Recharge la page.');
              }
            }}
            className="w-full py-3 bg-crypto-red/20 text-crypto-red rounded-lg hover:bg-crypto-red/30 transition-colors"
          >
            Réinitialiser toutes les données
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="text-center text-sm text-gray-500">
        <p>Crypto Trading Pro v1.0.0</p>
        <p className="mt-1">Données fournies par Binance • IA par Groq</p>
      </div>
    </div>
  );
}
