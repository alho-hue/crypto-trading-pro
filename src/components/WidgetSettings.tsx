import { useState, useEffect } from 'react';
import { Smartphone, Grid, Info, CheckCircle } from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';

interface WidgetConfig {
  symbol: string;
  type: 'price' | 'change' | 'mini-chart';
  refreshInterval: number;
}

export default function WidgetSettings() {
  const prices = useCryptoStore((state) => state.prices);
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('widget_config');
    if (saved) {
      setWidgets(JSON.parse(saved));
    } else {
      // Default widgets
      setWidgets([
        { symbol: 'BTCUSDT', type: 'price', refreshInterval: 15 },
        { symbol: 'ETHUSDT', type: 'change', refreshInterval: 15 },
      ]);
    }
  }, []);

  const saveWidgets = (newWidgets: WidgetConfig[]) => {
    setWidgets(newWidgets);
    localStorage.setItem('widget_config', JSON.stringify(newWidgets));
  };

  const addWidget = () => {
    const newWidget: WidgetConfig = {
      symbol: 'BTCUSDT',
      type: 'price',
      refreshInterval: 15,
    };
    saveWidgets([...widgets, newWidget]);
  };

  const updateWidget = (index: number, updates: Partial<WidgetConfig>) => {
    const updated = widgets.map((w, i) => 
      i === index ? { ...w, ...updates } : w
    );
    saveWidgets(updated);
  };

  const removeWidget = (index: number) => {
    saveWidgets(widgets.filter((_, i) => i !== index));
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-crypto-blue" />
          Widgets Mobile
        </h1>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="p-2 text-crypto-blue hover:bg-crypto-blue/10 rounded-lg"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* Instructions */}
      {showInstructions && (
        <div className="crypto-card bg-crypto-blue/10 border-crypto-blue">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Comment ajouter des widgets
          </h3>
          
          {isIOS && (
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
              <li>Installez l'app PWA (Ajouter à l'écran d'accueil)</li>
              <li>Appuyez longuement sur l'écran d'accueil</li>
              <li>Appuyez sur le bouton "+" en haut à gauche</li>
              <li>Cherchez "Crypto Trading Pro" dans la liste</li>
              <li>Choisissez la taille du widget (Petit, Moyen, Grand)</li>
              <li>Appuyez sur "Ajouter widget"</li>
            </ol>
          )}
          
          {isAndroid && (
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
              <li>Installez l'app PWA (Ajouter à l'écran d'accueil)</li>
              <li>Appuyez longuement sur l'écran d'accueil</li>
              <li>Appuyez sur "Widgets"</li>
              <li>Cherchez "Crypto Trading Pro"</li>
              <li>Sélectionnez le widget et sa taille</li>
              <li>Appuyez sur "Ajouter"</li>
            </ol>
          )}
          
          {!isIOS && !isAndroid && (
            <p className="text-sm text-gray-300">
              Les widgets sont disponibles sur iOS (14+) et Android (8+). 
              Installez d'abord l'app PWA sur votre téléphone.
            </p>
          )}
          
          <div className="mt-4 p-3 bg-crypto-dark/50 rounded-lg">
            <p className="text-xs text-gray-400">
              <strong>Note:</strong> Les widgets se mettent à jour automatiquement toutes les 15-30 minutes pour économiser la batterie.
            </p>
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="crypto-card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Grid className="w-5 h-5" />
          Aperçu des Widgets
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Widget Preview - Small */}
          <div className="bg-crypto-dark rounded-xl p-4 border border-crypto-border">
            <div className="text-xs text-gray-400 mb-1">BTC/USDT</div>
            <div className="text-xl font-bold font-mono">
              {prices.get('BTCUSDT')?.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) || '74,442'}
            </div>
            <div className={`text-sm ${
              (prices.get('BTCUSDT')?.change24h || 0) >= 0 ? 'text-crypto-green' : 'text-crypto-red'
            }`}>
              {(prices.get('BTCUSDT')?.change24h || 0) >= 0 ? '+' : ''}
              {(prices.get('BTCUSDT')?.change24h || 0).toFixed(2)}%
            </div>
          </div>

          {/* Widget Preview - Medium */}
          <div className="bg-crypto-dark rounded-xl p-4 border border-crypto-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">ETH/USDT</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                (prices.get('ETHUSDT')?.change24h || 0) >= 0 ? 'bg-crypto-green/20 text-crypto-green' : 'bg-crypto-red/20 text-crypto-red'
              }`}>
                {(prices.get('ETHUSDT')?.change24h || 0) >= 0 ? '+' : ''}
                {(prices.get('ETHUSDT')?.change24h || 0).toFixed(2)}%
              </span>
            </div>
            <div className="text-2xl font-bold font-mono">
              {prices.get('ETHUSDT')?.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) || '3,500.00'}
            </div>
            <div className="mt-2 h-8 bg-crypto-card rounded flex items-end justify-between px-1 pb-1">
              {[40, 60, 45, 70, 55, 80, 65].map((h, i) => (
                <div 
                  key={i} 
                  className="w-2 bg-crypto-blue/50 rounded-t"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Widget Configuration */}
      <div className="crypto-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Configuration ({widgets.length}/5)</h2>
          <button
            onClick={addWidget}
            disabled={widgets.length >= 5}
            className="px-3 py-1.5 bg-crypto-accent rounded-lg text-sm disabled:opacity-50"
          >
            + Ajouter
          </button>
        </div>

        {widgets.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <p>Aucun widget configuré</p>
          </div>
        ) : (
          <div className="space-y-3">
            {widgets.map((widget, index) => (
              <div key={index} className="bg-crypto-dark/50 rounded-lg p-3">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <select
                    value={widget.symbol}
                    onChange={(e) => updateWidget(index, { symbol: e.target.value })}
                    className="bg-crypto-card border border-crypto-border rounded px-2 py-1 text-sm"
                  >
                    <option value="BTCUSDT">BTC</option>
                    <option value="ETHUSDT">ETH</option>
                    <option value="BNBUSDT">BNB</option>
                    <option value="ADAUSDT">ADA</option>
                    <option value="SOLUSDT">SOL</option>
                    <option value="XRPUSDT">XRP</option>
                  </select>

                  <select
                    value={widget.type}
                    onChange={(e) => updateWidget(index, { type: e.target.value as any })}
                    className="bg-crypto-card border border-crypto-border rounded px-2 py-1 text-sm"
                  >
                    <option value="price">Prix</option>
                    <option value="change">Variation</option>
                    <option value="mini-chart">Mini Graph</option>
                  </select>

                  <select
                    value={widget.refreshInterval}
                    onChange={(e) => updateWidget(index, { refreshInterval: parseInt(e.target.value) })}
                    className="bg-crypto-card border border-crypto-border rounded px-2 py-1 text-sm"
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={60}>1h</option>
                  </select>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">
                    Widget {index + 1}
                  </span>
                  <button
                    onClick={() => removeWidget(index)}
                    className="text-crypto-red text-sm hover:underline"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Supported Platforms */}
      <div className="crypto-card">
        <h2 className="text-lg font-semibold mb-4">Plateformes supportées</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-crypto-dark/50 rounded-lg">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-xl">
              🍎
            </div>
            <div className="flex-1">
              <div className="font-medium">iOS 14+</div>
              <div className="text-sm text-gray-400">iPhone & iPad</div>
            </div>
            <CheckCircle className="w-5 h-5 text-crypto-green" />
          </div>

          <div className="flex items-center gap-3 p-3 bg-crypto-dark/50 rounded-lg">
            <div className="w-10 h-10 bg-green-700 rounded-full flex items-center justify-center text-xl">
              🤖
            </div>
            <div className="flex-1">
              <div className="font-medium">Android 8+</div>
              <div className="text-sm text-gray-400">Tous les appareils</div>
            </div>
            <CheckCircle className="w-5 h-5 text-crypto-green" />
          </div>
        </div>
      </div>
    </div>
  );
}
