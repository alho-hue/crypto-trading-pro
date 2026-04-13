import { useState, useEffect } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { Bell, Plus, Trash2, BellRing, BellOff, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface Alert {
  id: string;
  symbol: string;
  type: 'price' | 'change' | 'volume';
  condition: 'above' | 'below' | 'crosses_above' | 'crosses_below';
  value: number;
  message?: string;
  active: boolean;
  triggered: boolean;
  createdAt: number;
  triggeredAt?: number;
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newAlert, setNewAlert] = useState({
    symbol: 'BTCUSDT',
    type: 'price' as 'price' | 'change' | 'volume',
    condition: 'above' as 'above' | 'below',
    value: '',
    message: '',
  });

  const prices = useCryptoStore((state) => state.prices);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);

  // Load alerts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('trading_alerts');
    if (saved) {
      setAlerts(JSON.parse(saved));
    }
  }, []);

  // Save alerts
  const saveAlerts = (updated: Alert[]) => {
    setAlerts(updated);
    localStorage.setItem('trading_alerts', JSON.stringify(updated));
  };

  // Check alerts against current prices
  useEffect(() => {
    const updatedAlerts = alerts.map(alert => {
      if (!alert.active || alert.triggered) return alert;

      const price = prices.get(alert.symbol);
      if (!price) return alert;

      let shouldTrigger = false;
      const currentValue = alert.type === 'price' ? price.price :
                          alert.type === 'change' ? price.change24h :
                          price.volume24h;

      if (alert.condition === 'above' && currentValue > alert.value) {
        shouldTrigger = true;
      } else if (alert.condition === 'below' && currentValue < alert.value) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        // Trigger notification
        if (Notification.permission === 'granted') {
          new Notification('Crypto Trading Pro', {
            body: `${alert.symbol}: ${alert.message || 'Alerte déclenchée !'}`,
            icon: '/icon-192x192.png',
          });
        }

        return {
          ...alert,
          triggered: true,
          triggeredAt: Date.now(),
        };
      }

      return alert;
    });

    // Only save if something changed
    const hasChanges = updatedAlerts.some((alert, i) => 
      alert.triggered !== alerts[i]?.triggered
    );
    
    if (hasChanges) {
      saveAlerts(updatedAlerts);
    }
  }, [prices, alerts]);

  // Create alert
  const createAlert = () => {
    if (!newAlert.value) return;

    const alert: Alert = {
      id: Date.now().toString(),
      symbol: newAlert.symbol,
      type: newAlert.type,
      condition: newAlert.condition,
      value: parseFloat(newAlert.value as string),
      message: newAlert.message || `Prix ${newAlert.condition} ${newAlert.value}`,
      active: true,
      triggered: false,
      createdAt: Date.now(),
    };

    saveAlerts([...alerts, alert]);
    setShowCreate(false);
    setNewAlert({
      symbol: 'BTCUSDT',
      type: 'price',
      condition: 'above',
      value: '',
      message: '',
    });
  };

  // Toggle alert
  const toggleAlert = (id: string) => {
    saveAlerts(alerts.map(a => 
      a.id === id ? { ...a, active: !a.active, triggered: false } : a
    ));
  };

  // Delete alert
  const deleteAlert = (id: string) => {
    if (confirm('Supprimer cette alerte ?')) {
      saveAlerts(alerts.filter(a => a.id !== id));
    }
  };

  // Request notification permission
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BellRing className="w-6 h-6 text-crypto-blue" />
          Système d'Alertes
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nouvelle Alerte
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-crypto-card rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-crypto-blue" />
              Créer une Alerte
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Crypto</label>
                <select
                  value={newAlert.symbol}
                  onChange={(e) => setNewAlert({...newAlert, symbol: e.target.value})}
                  className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                >
                  <option value="BTCUSDT">BTC/USDT</option>
                  <option value="ETHUSDT">ETH/USDT</option>
                  <option value="ADAUSDT">ADA/USDT</option>
                  <option value="BNBUSDT">BNB/USDT</option>
                  <option value="SOLUSDT">SOL/USDT</option>
                  <option value="XRPUSDT">XRP/USDT</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Type</label>
                  <select
                    value={newAlert.type}
                    onChange={(e) => setNewAlert({...newAlert, type: e.target.value as any})}
                    className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                  >
                    <option value="price">Prix</option>
                    <option value="change">Variation %</option>
                    <option value="volume">Volume</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Condition</label>
                  <select
                    value={newAlert.condition}
                    onChange={(e) => setNewAlert({...newAlert, condition: e.target.value as any})}
                    className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                  >
                    <option value="above">Au-dessus de</option>
                    <option value="below">En-dessous de</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400">Valeur</label>
                <input
                  type="number"
                  value={newAlert.value}
                  onChange={(e) => setNewAlert({...newAlert, value: e.target.value})}
                  placeholder={newAlert.type === 'price' ? '70000' : newAlert.type === 'change' ? '5' : '1000000'}
                  className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {newAlert.type === 'price' ? 'Prix en USDT' : 
                   newAlert.type === 'change' ? 'Pourcentage (ex: 5 pour +5%)' : 
                   'Volume en base asset'}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-400">Message (optionnel)</label>
                <input
                  type="text"
                  value={newAlert.message}
                  onChange={(e) => setNewAlert({...newAlert, message: e.target.value})}
                  placeholder="Alerte personnalisée..."
                  className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 bg-crypto-dark rounded-lg text-gray-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                onClick={createAlert}
                disabled={!newAlert.value}
                className="flex-1 py-2 bg-crypto-blue rounded-lg text-white hover:bg-crypto-blue/80 disabled:opacity-50"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Total Alertes</div>
          <div className="text-2xl font-bold">{alerts.length}</div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Actives</div>
          <div className="text-2xl font-bold text-crypto-green">
            {alerts.filter(a => a.active && !a.triggered).length}
          </div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Déclenchées</div>
          <div className="text-2xl font-bold text-crypto-orange">
            {alerts.filter(a => a.triggered).length}
          </div>
        </div>
      </div>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div className="crypto-card text-center py-12">
          <Bell className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium mb-2">Aucune alerte</h3>
          <p className="text-gray-400 mb-4">
            Crée des alertes pour être notifié des mouvements de prix
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Créer
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.sort((a, b) => b.createdAt - a.createdAt).map((alert) => {
            const price = prices.get(alert.symbol);
            const currentValue = price ? 
              alert.type === 'price' ? price.price :
              alert.type === 'change' ? price.change24h :
              price.volume24h : null;

            return (
              <div
                key={alert.id}
                className={`crypto-card flex items-center justify-between p-4 ${
                  alert.triggered ? 'border-crypto-orange' : ''
                } ${!alert.active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      alert.active && !alert.triggered
                        ? 'bg-crypto-blue/20 text-crypto-blue'
                        : 'bg-crypto-dark text-gray-400'
                    }`}
                  >
                    {alert.active && !alert.triggered ? (
                      <BellRing className="w-5 h-5" />
                    ) : (
                      <BellOff className="w-5 h-5" />
                    )}
                  </button>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{alert.symbol}</span>
                      <span className="text-sm text-gray-400">
                        {alert.type === 'price' ? 'Prix' : 
                         alert.type === 'change' ? 'Variation' : 'Volume'}
                      </span>
                      <span className={`text-sm ${
                        alert.condition === 'above' ? 'text-crypto-green' : 'text-crypto-red'
                      }`}>
                        {alert.condition === 'above' ? '>' : '<'}
                      </span>
                      <span className="font-mono">
                        {alert.type === 'change' ? `${alert.value}%` : alert.value.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{alert.message}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {currentValue !== null && (
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Actuel</div>
                      <div className={`font-mono font-medium ${
                        alert.type === 'change' 
                          ? currentValue >= 0 ? 'text-crypto-green' : 'text-crypto-red'
                          : ''
                      }`}>
                        {alert.type === 'change' ? `${currentValue >= 0 ? '+' : ''}${currentValue.toFixed(2)}%` : 
                         currentValue.toLocaleString()}
                      </div>
                    </div>
                  )}

                  {alert.triggered && (
                    <div className="px-2 py-1 bg-crypto-orange/20 text-crypto-orange rounded text-xs">
                      Déclenchée
                    </div>
                  )}

                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="text-gray-400 hover:text-crypto-red transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
