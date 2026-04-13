import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, Bell, Moon, Sun, Shield, Save, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';

interface SettingsState {
  binanceApiKey: string;
  binanceSecretKey: string;
  groqApiKey: string;
  theme: 'dark' | 'light';
  notifications: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsState>({
    binanceApiKey: '',
    binanceSecretKey: '',
    groqApiKey: '',
    theme: 'dark',
    notifications: true,
    autoRefresh: true,
    refreshInterval: 3,
  });
  const [saved, setSaved] = useState(false);
  const [apiStatus, setApiStatus] = useState<{ binance: boolean; groq: boolean }>({ binance: false, groq: false });

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('trading_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(prev => ({ ...prev, ...parsed }));
      
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
        binance: !!parsed.binanceApiKey && parsed.binanceApiKey !== 'ta_cle_binance_ici',
        groq: !!parsed.groqApiKey && parsed.groqApiKey !== 'ta_cle_groq_ici',
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
  const saveSettings = () => {
    localStorage.setItem('trading_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    
    // Update API status
    setApiStatus({
      binance: !!settings.binanceApiKey && settings.binanceApiKey !== 'ta_cle_binance_ici',
      groq: !!settings.groqApiKey && settings.groqApiKey !== 'ta_cle_groq_ici',
    });
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

      {/* API Keys Section */}
      <div className="crypto-card">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-crypto-blue" />
          <h2 className="font-semibold">Clés API</h2>
        </div>
        
        <div className="space-y-4">
          {/* Binance API */}
          <div className="bg-crypto-dark/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Binance API</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  apiStatus.binance ? 'bg-crypto-green/20 text-crypto-green' : 'bg-crypto-red/20 text-crypto-red'
                }`}>
                  {apiStatus.binance ? 'Connecté' : 'Non configuré'}
                </span>
              </div>
              <a
                href="https://www.binance.com/en/support/faq/how-to-create-api-keys-on-binance-360002502072"
                target="_blank"
                rel="noopener noreferrer"
                className="text-crypto-blue text-sm flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Guide
              </a>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Nécessaire pour les données en temps réel et l'historique des trades
            </p>
            <div className="space-y-2">
              <input
                type="password"
                value={settings.binanceApiKey}
                onChange={(e) => updateSetting('binanceApiKey', e.target.value)}
                placeholder="API Key Binance"
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
              />
              <input
                type="password"
                value={settings.binanceSecretKey}
                onChange={(e) => updateSetting('binanceSecretKey', e.target.value)}
                placeholder="Secret Key Binance"
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              Utilise uniquement la permission "Lecture" pour la sécurité
            </p>
          </div>

          {/* Groq API */}
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
