import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, BellRing, BellOff, Smartphone } from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';
import { requestNotificationPermission, hasNotificationPermission, sendPriceAlert, testNotification } from '../utils/notifications';

interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'above' | 'below';
  active: boolean;
  createdAt: number;
  triggeredAt?: number;
}

export default function PriceAlerts() {
  const prices = useCryptoStore((state) => state.prices);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [newAlert, setNewAlert] = useState({
    targetPrice: '',
    condition: 'above' as 'above' | 'below',
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Charger les alertes sauvegardées
  useEffect(() => {
    const saved = localStorage.getItem('price_alerts');
    if (saved) {
      setAlerts(JSON.parse(saved));
    }
    setNotificationsEnabled(hasNotificationPermission());
  }, []);

  // Sauvegarder les alertes
  useEffect(() => {
    localStorage.setItem('price_alerts', JSON.stringify(alerts));
  }, [alerts]);

  // Vérifier les alertes en temps réel
  useEffect(() => {
    if (!notificationsEnabled || alerts.length === 0) return;

    alerts.forEach(alert => {
      if (!alert.active) return;

      const currentPrice = prices.get(alert.symbol)?.price;
      if (!currentPrice) return;

      const shouldTrigger = 
        (alert.condition === 'above' && currentPrice >= alert.targetPrice) ||
        (alert.condition === 'below' && currentPrice <= alert.targetPrice);

      if (shouldTrigger) {
        // Envoyer notification
        sendPriceAlert(alert.symbol, currentPrice, alert.condition, alert.targetPrice);
        
        // Marquer comme déclenchée
        setAlerts(prev => prev.map(a => 
          a.id === alert.id 
            ? { ...a, triggeredAt: Date.now(), active: false }
            : a
        ));
      }
    });
  }, [prices, alerts, notificationsEnabled]);

  const enableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      testNotification();
    }
  };

  const addAlert = () => {
    const price = parseFloat(newAlert.targetPrice);
    if (isNaN(price) || price <= 0) return;

    const alert: PriceAlert = {
      id: Date.now().toString(),
      symbol: selectedSymbol,
      targetPrice: price,
      condition: newAlert.condition,
      active: true,
      createdAt: Date.now(),
    };

    setAlerts(prev => [...prev, alert]);
    setNewAlert({ targetPrice: '', condition: 'above' });
  };

  const deleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === id ? { ...a, active: !a.active } : a
    ));
  };

  const currentPrice = prices.get(selectedSymbol)?.price;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BellRing className="w-6 h-6 text-crypto-accent" />
          Alertes de Prix
        </h1>
      </div>

      {/* Notification Permission */}
      {!notificationsEnabled && (
        <div className="crypto-card bg-gradient-to-r from-crypto-accent/20 to-crypto-blue/20 border-crypto-accent">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-crypto-accent/30 rounded-full flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-crypto-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Activez les notifications push</h3>
              <p className="text-sm text-gray-400">
                Recevez des alertes instantanées sur votre téléphone quand un prix est atteint
              </p>
            </div>
            <button
              onClick={enableNotifications}
              className="px-4 py-2 bg-crypto-accent hover:bg-crypto-accent/80 rounded-lg font-medium transition-colors"
            >
              Activer
            </button>
          </div>
        </div>
      )}

      {notificationsEnabled && (
        <div className="crypto-card border-green-500/30 bg-green-500/10">
          <div className="flex items-center gap-2 text-green-400">
            <BellRing className="w-5 h-5" />
            <span>Notifications activées - Vous recevrez des alertes push</span>
          </div>
        </div>
      )}

      {/* Current Price Display */}
      <div className="crypto-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Prix actuel de {selectedSymbol}</p>
            <p className="text-3xl font-bold">
              {currentPrice ? `$${currentPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : '---'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Variation 24h</p>
            <p className={`text-xl font-semibold ${
              (prices.get(selectedSymbol)?.change24h || 0) >= 0 ? 'text-crypto-green' : 'text-crypto-red'
            }`}>
              {(prices.get(selectedSymbol)?.change24h || 0) >= 0 ? '+' : ''}
              {(prices.get(selectedSymbol)?.change24h || 0).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Add New Alert */}
      <div className="crypto-card">
        <h2 className="text-lg font-semibold mb-4">Nouvelle Alerte</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Condition</label>
            <select
              value={newAlert.condition}
              onChange={(e) => setNewAlert(prev => ({ ...prev, condition: e.target.value as 'above' | 'below' }))}
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
            >
              <option value="above">📈 Dépasser (Above)</option>
              <option value="below">📉 Descendre sous (Below)</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Prix cible (USDT)</label>
            <input
              type="number"
              step="0.00000001"
              value={newAlert.targetPrice}
              onChange={(e) => setNewAlert(prev => ({ ...prev, targetPrice: e.target.value }))}
              placeholder="Ex: 50000"
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={addAlert}
              disabled={!newAlert.targetPrice}
              className="w-full py-2 bg-crypto-accent hover:bg-crypto-accent/80 disabled:opacity-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter Alerte
            </button>
          </div>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="crypto-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Vos Alertes</h2>
          <span className="text-sm text-gray-400">
            {alerts.filter(a => a.active).length} active(s)
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucune alerte configurée</p>
            <p className="text-sm mt-1">Créez une alerte pour suivre vos prix cibles</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map(alert => {
              const currentPriceValue = prices.get(alert.symbol)?.price;
              const progress = currentPriceValue 
                ? alert.condition === 'above' 
                  ? Math.min(100, (currentPriceValue / alert.targetPrice) * 100)
                  : Math.min(100, (alert.targetPrice / currentPriceValue) * 100)
                : 0;

              return (
                <div 
                  key={alert.id} 
                  className={`p-3 rounded-lg border ${
                    alert.active 
                      ? 'bg-crypto-dark/50 border-crypto-border' 
                      : 'bg-gray-800/50 border-gray-700 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleAlert(alert.id)}
                        className={`p-1.5 rounded ${alert.active ? 'text-crypto-accent' : 'text-gray-500'}`}
                      >
                        {alert.active ? <BellRing className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{alert.symbol}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            alert.condition === 'above' ? 'bg-crypto-green/20 text-crypto-green' : 'bg-crypto-red/20 text-crypto-red'
                          }`}>
                            {alert.condition === 'above' ? 'Above' : 'Below'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">
                          Target: ${alert.targetPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                          {currentPriceValue && (
                            <span className="ml-2 text-gray-500">
                              (Actuel: ${currentPriceValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })})
                            </span>
                          )}
                        </p>
                        {alert.triggeredAt && (
                          <p className="text-xs text-crypto-green">
                            ✅ Déclenchée le {new Date(alert.triggeredAt).toLocaleString('fr-FR')}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="p-2 text-crypto-red hover:bg-crypto-red/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Progress bar */}
                  {alert.active && currentPriceValue && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-crypto-dark rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            alert.condition === 'above' ? 'bg-crypto-green' : 'bg-crypto-red'
                          }`}
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {progress.toFixed(1)}% du chemin parcouru
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
