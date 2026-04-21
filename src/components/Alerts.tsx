import { useState, useEffect, useCallback, useRef } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { 
  Bell, Plus, Trash2, BellRing, BellOff, TrendingUp, TrendingDown, Activity, Smartphone,
  Brain, Bot, Shield, Mail, MessageSquare, Settings, History, X, AlertTriangle,
  Target, Zap, LineChart, Percent, Clock, Filter, CheckCircle, XCircle, Info
} from 'lucide-react';
import { showToast } from '../stores/toastStore';
import { Modal } from './Modal';

// Types d'alertes complets
type AlertType = 
  | 'price'           // Prix atteint X
  | 'rsi'             // RSI surachat/survente
  | 'macd'            // MACD crossover
  | 'support'         // Cassure support
  | 'resistance'      // Cassure résistance
  | 'volume_spike'    // Pic de volume
  | 'ai_signal'       // Signal IA (LONG/SHORT)
  | 'bot_trade'       // Trade bot exécuté
  | 'bot_tp'          // Take Profit atteint
  | 'bot_sl'          // Stop Loss touché
  | 'bot_error'       // Erreur bot
  | 'daily_loss'      // Perte journalière élevée
  | 'drawdown'        // Drawdown critique
  | 'risk_high';      // Risque trop élevé

type AlertCondition = 
  | 'above'           // Au-dessus de
  | 'below'           // En-dessous de
  | 'crosses_above'   // Croise à la hausse
  | 'crosses_below'   // Croise à la baisse
  | 'equals'          // Égal à
  | 'rsi_overbought'  // RSI surachat (>70)
  | 'rsi_oversold';   // RSI survente (<30)

type AlertStatus = 'active' | 'triggered' | 'expired' | 'disabled';

type NotificationChannel = 'in_app' | 'email' | 'push';

interface Alert {
  id: string;
  symbol: string;
  type: AlertType;
  condition: AlertCondition;
  value: number;
  value2?: number; // Pour les ranges (ex: RSI 30-70)
  message?: string;
  active: boolean;
  status: AlertStatus;
  createdAt: number;
  triggeredAt?: number;
  triggeredCount: number;
  lastTriggeredAt?: number;
  channels: NotificationChannel[];
  cooldown: number; // Minutes entre déclenchements
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata?: {
    aiConfidence?: number;
    aiReason?: string;
    botId?: string;
    tradeId?: string;
    pnl?: number;
    riskLevel?: number;
  };
}

interface AlertSettings {
  enabledTypes: AlertType[];
  defaultChannels: NotificationChannel[];
  defaultCooldown: number;
  maxAlertsPerHour: number;
  emailEnabled: boolean;
  pushEnabled: boolean;
  soundEnabled: boolean;
  doNotDisturb: boolean;
  doNotDisturbStart: string;
  doNotDisturbEnd: string;
}

interface AlertHistory {
  id: string;
  alertId: string;
  symbol: string;
  type: AlertType;
  message: string;
  triggeredAt: number;
  acknowledged: boolean;
  channels: NotificationChannel[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata?: any;
}

const ALERT_TYPE_CONFIG: Record<AlertType, { label: string; icon: any; color: string; category: string }> = {
  price: { label: 'Prix', icon: TrendingUp, color: 'text-crypto-blue', category: 'Prix' },
  rsi: { label: 'RSI', icon: Activity, color: 'text-purple-400', category: 'Technique' },
  macd: { label: 'MACD', icon: LineChart, color: 'text-indigo-400', category: 'Technique' },
  support: { label: 'Support', icon: TrendingDown, color: 'text-red-400', category: 'Technique' },
  resistance: { label: 'Résistance', icon: TrendingUp, color: 'text-green-400', category: 'Technique' },
  volume_spike: { label: 'Volume', icon: Zap, color: 'text-yellow-400', category: 'Technique' },
  ai_signal: { label: 'Signal IA', icon: Brain, color: 'text-crypto-purple', category: 'IA' },
  bot_trade: { label: 'Trade Bot', icon: Bot, color: 'text-crypto-accent', category: 'Bot' },
  bot_tp: { label: 'Take Profit', icon: Target, color: 'text-green-400', category: 'Bot' },
  bot_sl: { label: 'Stop Loss', icon: Shield, color: 'text-red-400', category: 'Bot' },
  bot_error: { label: 'Erreur Bot', icon: AlertTriangle, color: 'text-red-500', category: 'Bot' },
  daily_loss: { label: 'Perte Journée', icon: TrendingDown, color: 'text-orange-400', category: 'Risque' },
  drawdown: { label: 'Drawdown', icon: Percent, color: 'text-red-400', category: 'Risque' },
  risk_high: { label: 'Risque Élevé', icon: Shield, color: 'text-red-500', category: 'Risque' },
};

const DEFAULT_SETTINGS: AlertSettings = {
  enabledTypes: ['price', 'ai_signal', 'bot_trade', 'daily_loss', 'risk_high'],
  defaultChannels: ['in_app', 'push'],
  defaultCooldown: 60, // 1 heure par défaut
  maxAlertsPerHour: 10,
  emailEnabled: false,
  pushEnabled: true,
  soundEnabled: true,
  doNotDisturb: false,
  doNotDisturbStart: '22:00',
  doNotDisturbEnd: '08:00',
};

// Service de notifications sécurisé
const safeJSONParse = <T,>(str: string | null, defaultValue: T): T => {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
};

// Anti-spam: tracker les dernières notifications
const alertCooldowns = new Map<string, number>();
const hourlyAlertCount = new Map<string, number[]>();

const canSendAlert = (alertId: string, cooldownMinutes: number, maxPerHour: number): boolean => {
  const now = Date.now();
  const cooldownMs = cooldownMinutes * 60 * 1000;
  
  // Check cooldown
  const lastSent = alertCooldowns.get(alertId);
  if (lastSent && now - lastSent < cooldownMs) {
    return false;
  }
  
  // Check hourly limit
  const hourAgo = now - 3600000;
  const hourKey = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const hourAlerts = hourlyAlertCount.get(hourKey) || [];
  const recentAlerts = hourAlerts.filter(t => t > hourAgo);
  
  if (recentAlerts.length >= maxPerHour) {
    return false;
  }
  
  // Update tracking
  alertCooldowns.set(alertId, now);
  hourlyAlertCount.set(hourKey, [...recentAlerts, now]);
  
  return true;
};

// Check if in do not disturb mode
const isDoNotDisturb = (start: string, end: string): boolean => {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  if (startMinutes < endMinutes) {
    return currentTime >= startMinutes && currentTime < endMinutes;
  } else {
    // Crosses midnight
    return currentTime >= startMinutes || currentTime < endMinutes;
  }
};

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertHistory[]>([]);
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_SETTINGS);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<AlertStatus | 'all'>('all');
  const wsRef = useRef<WebSocket | null>(null);
  const triggeredThisSession = useRef<Set<string>>(new Set());

  const [newAlert, setNewAlert] = useState({
    symbol: 'BTCUSDT',
    type: 'price' as AlertType,
    condition: 'above' as AlertCondition,
    value: '',
    value2: '',
    message: '',
    channels: ['in_app', 'push'] as NotificationChannel[],
    cooldown: '60',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
  });

  const prices = useCryptoStore((state) => state.prices);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);

  // Load data from localStorage
  useEffect(() => {
    const savedAlerts = safeJSONParse<Alert[]>('trading_alerts', []);
    const savedHistory = safeJSONParse<AlertHistory[]>('alert_history', []);
    const savedSettings = safeJSONParse<AlertSettings>('alert_settings', DEFAULT_SETTINGS);
    
    setAlerts(savedAlerts);
    setAlertHistory(savedHistory);
    setSettings(savedSettings);
    
    // Check notification permission
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  // Save data to localStorage
  const saveAlerts = useCallback((updated: Alert[]) => {
    setAlerts(updated);
    localStorage.setItem('trading_alerts', JSON.stringify(updated));
  }, []);

  const saveHistory = useCallback((updated: AlertHistory[]) => {
    setAlertHistory(updated);
    localStorage.setItem('alert_history', JSON.stringify(updated));
  }, []);

  const saveSettings = useCallback((updated: AlertSettings) => {
    setSettings(updated);
    localStorage.setItem('alert_settings', JSON.stringify(updated));
  }, []);

  // Enable notifications
  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      showToast.error('Notifications non supportées par ce navigateur', 'Erreur');
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
      
      if (permission === 'granted') {
        showToast.success('Notifications activées', 'Succès');
        // Test notification
        new Notification('NEUROVEST', {
          body: 'Système d\'alertes activé',
          icon: '/wolf-ffomix.png',
        });
      } else {
        showToast.warning('Permission de notification refusée', 'Attention');
      }
    } catch (error) {
      showToast.error('Erreur lors de l\'activation des notifications', 'Erreur');
    }
  };

  // Send notification through channels
  const sendNotification = useCallback((alert: Alert, currentValue: number) => {
    const isDND = settings.doNotDisturb && isDoNotDisturb(settings.doNotDisturbStart, settings.doNotDisturbEnd);
    
    // Build message
    let message = alert.message || '';
    if (!message) {
      const typeConfig = ALERT_TYPE_CONFIG[alert.type];
      const symbol = alert.symbol.replace('USDT', '');
      
      switch (alert.type) {
        case 'price':
          message = `${symbol} ${alert.condition === 'above' ? 'a dépassé' : 'est sous'} $${alert.value.toLocaleString()} (actuel: $${currentValue.toLocaleString()})`;
          break;
        case 'rsi':
          message = `RSI ${symbol} en ${alert.condition === 'rsi_overbought' ? 'surachat' : 'survente'} (${currentValue.toFixed(2)})`;
          break;
        case 'macd':
          message = `MACD ${symbol} signal de ${alert.condition === 'crosses_above' ? 'achat' : 'vente'}`;
          break;
        case 'ai_signal':
          message = `Signal IA: ${alert.metadata?.aiReason || 'Analyse complète disponible'}`;
          break;
        case 'bot_trade':
          message = `Trade exécuté: ${alert.metadata?.tradeId || 'Nouvelle position'}`;
          break;
        case 'bot_tp':
          message = `Take Profit atteint! PnL: ${alert.metadata?.pnl || 0}%`;
          break;
        case 'bot_sl':
          message = `Stop Loss touché. PnL: ${alert.metadata?.pnl || 0}%`;
          break;
        case 'daily_loss':
          message = `Perte journalière élevée: ${currentValue.toFixed(2)}%`;
          break;
        case 'drawdown':
          message = `Drawdown critique: ${currentValue.toFixed(2)}%`;
          break;
        case 'risk_high':
          message = `Niveau de risque trop élevé: ${alert.metadata?.riskLevel || 'Critique'}`;
          break;
        default:
          message = `${typeConfig.label}: ${alert.symbol}`;
      }
    }

    // Add to history
    const historyEntry: AlertHistory = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      alertId: alert.id,
      symbol: alert.symbol,
      type: alert.type,
      message,
      triggeredAt: Date.now(),
      acknowledged: false,
      channels: alert.channels,
      priority: alert.priority,
      metadata: alert.metadata,
    };
    
    setAlertHistory(prev => {
      const updated = [historyEntry, ...prev].slice(0, 100);
      localStorage.setItem('alert_history', JSON.stringify(updated));
      return updated;
    }); // Keep last 100

    // In-app notification (always unless DND)
    if (!isDND && alert.channels.includes('in_app')) {
      const priorityColors = {
        low: 'bg-blue-500',
        medium: 'bg-yellow-500',
        high: 'bg-orange-500',
        critical: 'bg-red-500',
      };
      
      showToast.custom(
        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full mt-2 ${priorityColors[alert.priority]}`} />
          <div>
            <div className="font-semibold">{ALERT_TYPE_CONFIG[alert.type].label}</div>
            <div className="text-sm text-gray-300">{message}</div>
          </div>
        </div>,
        ALERT_TYPE_CONFIG[alert.type].category,
        alert.priority === 'critical' ? 10000 : 5000
      );
    }

    // Push notification (respect DND)
    if (!isDND && alert.channels.includes('push') && notificationsEnabled && Notification.permission === 'granted') {
      new Notification('NEUROVEST Alert', {
        body: message,
        icon: '/wolf-ffomix.png',
        badge: '/wolf-ffomix.png',
        tag: alert.id,
        requireInteraction: alert.priority === 'critical',
      });
    }

    // Email notification (always async, no DND check)
    if (alert.channels.includes('email') && settings.emailEnabled) {
      // TODO: Implement email service
      console.log('[Email Notification]', message);
    }

    // Sound alert (respect DND)
    if (!isDND && settings.soundEnabled) {
      const audio = new Audio('/alert-sound.mp3');
      audio.volume = alert.priority === 'critical' ? 1.0 : 0.5;
      audio.play().catch(() => {});
    }
  }, [notificationsEnabled, settings, saveHistory]);

  // Smart alert checking with anti-spam
  const checkAlert = useCallback((alert: Alert): boolean => {
    if (!alert.active || alert.status === 'expired') return false;

    const price = prices.get(alert.symbol);
    if (!price) return false;

    // Anti-spam check
    if (!canSendAlert(alert.id, alert.cooldown, settings.maxAlertsPerHour)) {
      return false;
    }

    let shouldTrigger = false;
    let currentValue = price.price;

    switch (alert.type) {
      case 'price':
        currentValue = price.price;
        if (alert.condition === 'above' && currentValue > alert.value) shouldTrigger = true;
        if (alert.condition === 'below' && currentValue < alert.value) shouldTrigger = true;
        break;
        
      case 'rsi':
        // PAS DE RSI SIMULÉ - Nécessite un service d'analyse technique réel
        // currentValue = await fetchRealRSI(alert.symbol); // À implémenter
        // Pour l'instant, désactiver cette alerte
        shouldTrigger = false;
        break;
        
      case 'volume_spike':
        currentValue = price.volume24h || 0;
        if (currentValue > alert.value * 1000000) shouldTrigger = true; // Volume in millions
        break;
        
      case 'daily_loss':
        // PAS DE SIMULATION - Nécessite un service de portfolio réel
        shouldTrigger = false;
        break;
        
      case 'drawdown':
        // PAS DE SIMULATION - Nécessite un service de portfolio réel
        shouldTrigger = false;
        break;
    }

    return shouldTrigger;
  }, [prices, settings.maxAlertsPerHour]);

  // Check alerts loop
  useEffect(() => {
    const interval = setInterval(() => {
      const updatedAlerts = alerts.map(alert => {
        if (checkAlert(alert)) {
          const price = prices.get(alert.symbol);
          const currentValue = price?.price || 0;
          
          // Send notification
          sendNotification(alert, currentValue);
          
          // Update alert status
          return {
            ...alert,
            status: 'triggered' as AlertStatus,
            triggeredAt: Date.now(),
            triggeredCount: alert.triggeredCount + 1,
            lastTriggeredAt: Date.now(),
          };
        }
        return alert;
      });

      // Only save if changed
      const hasChanges = updatedAlerts.some((alert, i) => 
        alert.status !== alerts[i]?.status || alert.triggeredCount !== alerts[i]?.triggeredCount
      );
      
      if (hasChanges) {
        saveAlerts(updatedAlerts);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [alerts, prices, checkAlert, sendNotification, saveAlerts]);

  // WebSocket for real-time alerts
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:5000');
      
      ws.onopen = () => {
        console.log('[Alerts] WebSocket connected');
        // Subscribe to bot events
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'bot-events' }));
        // Subscribe to AI signals
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'ai-signals' }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle bot trade events
          if (data.type === 'bot_trade') {
            handleExternalAlert('bot_trade', data);
          }
          if (data.type === 'bot_tp') {
            handleExternalAlert('bot_tp', data);
          }
          if (data.type === 'bot_sl') {
            handleExternalAlert('bot_sl', data);
          }
          if (data.type === 'bot_error') {
            handleExternalAlert('bot_error', data);
          }
          
          // Handle AI signals
          if (data.type === 'ai_signal') {
            handleExternalAlert('ai_signal', data);
          }
          
          // Handle risk alerts
          if (data.type === 'risk_alert') {
            handleExternalAlert(data.alertType, data);
          }
        } catch (error) {
          console.error('[Alerts] WebSocket message error:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('[Alerts] WebSocket disconnected, retrying...');
        setTimeout(connectWebSocket, 3000);
      };
      
      wsRef.current = ws;
    };
    
    connectWebSocket();
    
    return () => {
      wsRef.current?.close();
    };
  }, []);

  // Handle external alerts (from bot, AI, etc.)
  const handleExternalAlert = useCallback((type: AlertType, data: any) => {
    // Check if there's a matching alert configured
    const matchingAlert = alerts.find(a => 
      a.type === type && 
      a.active && 
      (type === 'bot_trade' || type === 'bot_tp' || type === 'bot_sl' || type === 'bot_error' || 
       (a.symbol === data.symbol && type === 'ai_signal'))
    );
    
    if (matchingAlert) {
      const updatedAlert = {
        ...matchingAlert,
        status: 'triggered' as AlertStatus,
        triggeredAt: Date.now(),
        triggeredCount: matchingAlert.triggeredCount + 1,
        lastTriggeredAt: Date.now(),
        metadata: { ...matchingAlert.metadata, ...data },
      };
      
      sendNotification(updatedAlert, data.price || data.pnl || 0);
      
      saveAlerts(alerts.map(a => a.id === matchingAlert.id ? updatedAlert : a));
    } else {
      // Auto-create temporary alert for critical events
      if (type === 'bot_error' || type === 'daily_loss' || type === 'drawdown' || type === 'risk_high') {
        const tempAlert: Alert = {
          id: `auto-${Date.now()}`,
          symbol: data.symbol || 'PORTFOLIO',
          type,
          condition: 'above',
          value: data.threshold || 0,
          active: true,
          status: 'triggered',
          createdAt: Date.now(),
          triggeredAt: Date.now(),
          triggeredCount: 1,
          lastTriggeredAt: Date.now(),
          channels: settings.defaultChannels,
          cooldown: 5, // 5 minutes for auto-alerts
          priority: type === 'bot_error' || type === 'risk_high' ? 'critical' : 'high',
          metadata: data,
        };
        
        sendNotification(tempAlert, data.value || data.pnl || data.riskLevel || 0);
        const newEntry: AlertHistory = {
          id: Date.now().toString(),
          alertId: tempAlert.id,
          symbol: tempAlert.symbol,
          type,
          message: data.message || `Alerte automatique: ${type}`,
          triggeredAt: Date.now(),
          acknowledged: false,
          channels: tempAlert.channels,
          priority: tempAlert.priority,
          metadata: data,
        };
        setAlertHistory(prev => [newEntry, ...prev].slice(0, 100));
      }
    }
  }, [alerts, settings.defaultChannels, sendNotification, saveAlerts, saveHistory]);

  // Create alert
  const createAlert = () => {
    if (!newAlert.value) {
      showToast.error('Valeur requise pour l\'alerte', 'Erreur');
      return;
    }

    const alert: Alert = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      symbol: newAlert.symbol,
      type: newAlert.type,
      condition: newAlert.condition,
      value: parseFloat(newAlert.value),
      value2: newAlert.value2 ? parseFloat(newAlert.value2) : undefined,
      message: newAlert.message || '',
      active: true,
      status: 'active',
      createdAt: Date.now(),
      triggeredCount: 0,
      channels: newAlert.channels,
      cooldown: parseInt(newAlert.cooldown) || 60,
      priority: newAlert.priority,
    };

    saveAlerts([...alerts, alert]);
    setShowCreate(false);
    setNewAlert({
      symbol: 'BTCUSDT',
      type: 'price',
      condition: 'above',
      value: '',
      value2: '',
      message: '',
      channels: ['in_app', 'push'],
      cooldown: '60',
      priority: 'medium',
    });
    
    showToast.success('Alerte créée avec succès', 'Succès');
  };

  // Quick create alert from preset
  const quickCreateAlert = (preset: { type: AlertType; symbol: string; condition: AlertCondition; value: number; message: string }) => {
    const alert: Alert = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      symbol: preset.symbol,
      type: preset.type,
      condition: preset.condition,
      value: preset.value,
      message: preset.message,
      active: true,
      status: 'active',
      createdAt: Date.now(),
      triggeredCount: 0,
      channels: settings.defaultChannels,
      cooldown: settings.defaultCooldown,
      priority: 'medium',
    };

    saveAlerts([...alerts, alert]);
    showToast.success(`Alerte ${ALERT_TYPE_CONFIG[preset.type].label} créée`, 'Succès');
  };

  // Toggle alert
  const toggleAlert = (id: string) => {
    saveAlerts(alerts.map(a => 
      a.id === id ? { 
        ...a, 
        active: !a.active, 
        status: a.active ? 'disabled' : 'active',
        triggeredAt: undefined 
      } : a
    ));
  };

  // Reset triggered alert
  const resetAlert = (id: string) => {
    saveAlerts(alerts.map(a =>
      a.id === id ? {
        ...a,
        status: 'active',
        triggeredAt: undefined,
      } : a
    ));
    showToast.success('Alerte réactivée', 'Succès');
  };

  // Delete alert with modal
  const deleteAlert = (id: string) => {
    setShowDeleteModal(id);
  };

  const confirmDelete = () => {
    if (showDeleteModal) {
      saveAlerts(alerts.filter(a => a.id !== showDeleteModal));
      setShowDeleteModal(null);
      showToast.success('Alerte supprimée', 'Succès');
    }
  };

  // Acknowledge history item
  const acknowledgeHistory = (historyId: string) => {
    saveHistory(alertHistory.map(h =>
      h.id === historyId ? { ...h, acknowledged: true } : h
    ));
  };

  // Clear old history
  const clearHistory = () => {
    saveHistory([]);
    showToast.success('Historique effacé', 'Succès');
  };

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    const categoryMatch = filterCategory === 'all' || ALERT_TYPE_CONFIG[alert.type].category === filterCategory;
    const statusMatch = filterStatus === 'all' || alert.status === filterStatus;
    return categoryMatch && statusMatch;
  });

  // Stats
  const stats = {
    total: alerts.length,
    active: alerts.filter(a => a.active && a.status === 'active').length,
    triggered: alerts.filter(a => a.status === 'triggered').length,
    disabled: alerts.filter(a => a.status === 'disabled').length,
    historyToday: alertHistory.filter(h => h.triggeredAt > Date.now() - 86400000).length,
    unacknowledged: alertHistory.filter(h => !h.acknowledged).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BellRing className="w-6 h-6 text-crypto-blue" />
            Centre d'Alertes Intelligent
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Alertes prix, techniques, IA et risque en temps réel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="px-4 py-2 bg-crypto-dark hover:bg-crypto-gray rounded-lg flex items-center gap-2 transition-colors"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Historique</span>
            {stats.unacknowledged > 0 && (
              <span className="px-2 py-0.5 bg-crypto-orange rounded-full text-xs">
                {stats.unacknowledged}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 bg-crypto-dark hover:bg-crypto-gray rounded-lg flex items-center gap-2 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Paramètres</span>
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Alerte
          </button>
        </div>
      </div>

      {/* Notification Status */}
      {!notificationsEnabled ? (
        <div className="crypto-card bg-gradient-to-r from-crypto-accent/20 to-crypto-blue/20 border-crypto-accent">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-crypto-accent/30 rounded-full flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-crypto-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Activez les notifications push</h3>
              <p className="text-sm text-gray-400">
                Recevez des alertes instantanées sur votre téléphone même quand l'app est fermée
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
      ) : (
        <div className="crypto-card border-green-500/30 bg-green-500/10">
          <div className="flex items-center gap-2 text-green-400">
            <BellRing className="w-5 h-5" />
            <span>Notifications push activées - Vous recevrez des alertes instantanées</span>
          </div>
        </div>
      )}

      {/* Quick Presets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => quickCreateAlert({ 
            type: 'price', 
            symbol: selectedSymbol || 'BTCUSDT', 
            condition: 'above', 
            value: Math.round((prices.get(selectedSymbol || 'BTCUSDT')?.price || 70000) * 1.05),
            message: 'Prix cible haussier atteint'
          })}
          className="p-3 bg-crypto-dark hover:bg-crypto-gray rounded-lg text-left transition-colors"
        >
          <TrendingUp className="w-5 h-5 text-green-400 mb-2" />
          <div className="text-sm font-medium">Alerte Haussière</div>
          <div className="text-xs text-gray-500">+5% du prix actuel</div>
        </button>
        <button
          onClick={() => quickCreateAlert({ 
            type: 'price', 
            symbol: selectedSymbol || 'BTCUSDT', 
            condition: 'below', 
            value: Math.round((prices.get(selectedSymbol || 'BTCUSDT')?.price || 70000) * 0.95),
            message: 'Prix cible baissier atteint'
          })}
          className="p-3 bg-crypto-dark hover:bg-crypto-gray rounded-lg text-left transition-colors"
        >
          <TrendingDown className="w-5 h-5 text-red-400 mb-2" />
          <div className="text-sm font-medium">Alerte Baissière</div>
          <div className="text-xs text-gray-500">-5% du prix actuel</div>
        </button>
        <button
          onClick={() => quickCreateAlert({ 
            type: 'rsi', 
            symbol: selectedSymbol || 'BTCUSDT', 
            condition: 'rsi_oversold', 
            value: 30,
            message: 'RSI en zone de survente - opportunité d\'achat'
          })}
          className="p-3 bg-crypto-dark hover:bg-crypto-gray rounded-lg text-left transition-colors"
        >
          <Activity className="w-5 h-5 text-purple-400 mb-2" />
          <div className="text-sm font-medium">RSI Survente</div>
          <div className="text-xs text-gray-500">RSI {'<'} 30</div>
        </button>
        <button
          onClick={() => quickCreateAlert({ 
            type: 'daily_loss', 
            symbol: 'PORTFOLIO', 
            condition: 'above', 
            value: 5,
            message: 'Alerte de protection: perte journalière élevée'
          })}
          className="p-3 bg-crypto-dark hover:bg-crypto-gray rounded-lg text-left transition-colors"
        >
          <Shield className="w-5 h-5 text-orange-400 mb-2" />
          <div className="text-sm font-medium">Protection Risque</div>
          <div className="text-xs text-gray-500">Perte {'>'} 5%</div>
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
                  placeholder={newAlert.type === 'price' ? '70000' : newAlert.type === 'daily_loss' || newAlert.type === 'drawdown' ? '5' : newAlert.type === 'rsi' ? '70' : '1000000'}
                  className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {newAlert.type === 'price' ? 'Prix en USDT' : 
                   newAlert.type === 'daily_loss' || newAlert.type === 'drawdown' ? 'Pourcentage (ex: 5 pour 5%)' : 
                   newAlert.type === 'rsi' ? 'Valeur RSI (30-70)' :
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Total Alertes</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Actives</div>
          <div className="text-2xl font-bold text-crypto-green">{stats.active}</div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Déclenchées</div>
          <div className="text-2xl font-bold text-crypto-orange">{stats.triggered}</div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Aujourd'hui</div>
          <div className="text-2xl font-bold text-crypto-blue">{stats.historyToday}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 bg-crypto-dark rounded-lg p-1">
          <Filter className="w-4 h-4 text-gray-400 ml-2" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-transparent text-sm px-2 py-1 outline-none"
          >
            <option value="all">Toutes les catégories</option>
            <option value="Prix">Prix</option>
            <option value="Technique">Technique</option>
            <option value="IA">Intelligence Artificielle</option>
            <option value="Bot">Trading Bot</option>
            <option value="Risque">Risque</option>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-crypto-dark rounded-lg p-1">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as AlertStatus | 'all')}
            className="bg-transparent text-sm px-2 py-1 outline-none"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actives</option>
            <option value="triggered">Déclenchées</option>
            <option value="disabled">Désactivées</option>
          </select>
        </div>
      </div>

      {/* Alerts List */}
      {filteredAlerts.length === 0 ? (
        <div className="crypto-card text-center py-12">
          <Bell className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium mb-2">
            {alerts.length === 0 ? 'Aucune alerte' : 'Aucune alerte correspondante'}
          </h3>
          <p className="text-gray-400 mb-4">
            {alerts.length === 0 
              ? 'Créez des alertes pour être notifié des mouvements de prix, signaux techniques et événements bot'
              : 'Modifiez vos filtres pour voir plus d\'alertes'}
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Créer une Alerte
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAlerts.sort((a, b) => b.createdAt - a.createdAt).map((alert) => {
            const price = prices.get(alert.symbol);
            const currentValue = price?.price || 0;
            const typeConfig = ALERT_TYPE_CONFIG[alert.type];
            const TypeIcon = typeConfig.icon;
            
            const progress = alert.type === 'price' && currentValue > 0
              ? Math.min(100, Math.max(0, alert.condition === 'above'
                  ? (currentValue / alert.value) * 100
                  : (alert.value / currentValue) * 100))
              : 0;

            return (
              <div
                key={alert.id}
                className={`crypto-card p-4 ${
                  alert.status === 'triggered' ? 'border-crypto-orange' : ''
                } ${alert.status === 'disabled' ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleAlert(alert.id)}
                      className={`p-2 rounded-lg transition-colors mt-0.5 ${
                        alert.active && alert.status === 'active'
                          ? `bg-crypto-blue/20 text-crypto-blue`
                          : 'bg-crypto-dark text-gray-400'
                      }`}
                    >
                      {alert.active && alert.status === 'active' ? (
                        <BellRing className="w-5 h-5" />
                      ) : (
                        <BellOff className="w-5 h-5" />
                      )}
                    </button>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                        <span className="font-medium">{alert.symbol.replace('USDT', '')}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-crypto-dark ${typeConfig.color}`}>
                          {typeConfig.category}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          alert.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                          alert.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          alert.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {alert.priority}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-gray-400">{typeConfig.label}</span>
                        <span className={`text-sm ${
                          alert.condition === 'above' || alert.condition === 'crosses_above' || alert.condition === 'rsi_overbought'
                            ? 'text-crypto-green' 
                            : 'text-crypto-red'
                        }`}>
                          {alert.condition === 'above' ? '>' : 
                           alert.condition === 'below' ? '<' :
                           alert.condition === 'crosses_above' ? '↗' :
                           alert.condition === 'crosses_below' ? '↘' :
                           alert.condition === 'rsi_overbought' ? 'surachat' :
                           alert.condition === 'rsi_oversold' ? 'survente' : '='}
                        </span>
                        <span className="font-mono text-sm">
                          {alert.type === 'daily_loss' || alert.type === 'drawdown'
                            ? `${alert.value}%` 
                            : alert.value.toLocaleString()}
                        </span>
                        {alert.value2 && (
                          <span className="text-xs text-gray-500">
                            (range: {alert.value2})
                          </span>
                        )}
                      </div>
                      
                      {alert.message && (
                        <p className="text-sm text-gray-400 mt-1">{alert.message}</p>
                      )}

                      {/* Progress bar for price alerts */}
                      {alert.type === 'price' && alert.status === 'active' && (
                        <div className="mt-2">
                          <div className="h-1 bg-crypto-dark rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                progress >= 90 ? 'bg-crypto-green' : 
                                progress >= 50 ? 'bg-yellow-400' : 'bg-crypto-blue'
                              }`}
                              style={{ width: `${Math.min(100, progress)}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Actuel: {currentValue.toLocaleString()} ({progress.toFixed(0)}% de l'objectif)
                          </div>
                        </div>
                      )}

                      {/* Channels */}
                      <div className="flex items-center gap-2 mt-2">
                        {alert.channels.map(channel => (
                          <span key={channel} className="text-xs text-gray-500 flex items-center gap-1">
                            {channel === 'in_app' && <Bell className="w-3 h-3" />}
                            {channel === 'email' && <Mail className="w-3 h-3" />}
                            {channel === 'push' && <Smartphone className="w-3 h-3" />}
                          </span>
                        ))}
                        <span className="text-xs text-gray-500">
                          • Cooldown: {alert.cooldown}min
                        </span>
                        {alert.triggeredCount > 0 && (
                          <span className="text-xs text-crypto-orange">
                            • Déclenchée {alert.triggeredCount}x
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {alert.status === 'triggered' && (
                      <>
                        <span className="px-2 py-1 bg-crypto-orange/20 text-crypto-orange rounded text-xs">
                          Déclenchée
                        </span>
                        <button
                          onClick={() => resetAlert(alert.id)}
                          className="text-xs text-crypto-blue hover:underline"
                        >
                          Réactiver
                        </button>
                      </>
                    )}
                    
                    {alert.status === 'disabled' && (
                      <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">
                        Désactivée
                      </span>
                    )}

                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="text-gray-400 hover:text-crypto-red transition-colors p-1"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Créer une Alerte">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Type selection */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Type d'alerte</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ALERT_TYPE_CONFIG).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => setNewAlert({ ...newAlert, type: type as AlertType })}
                  className={`p-3 rounded-lg text-left transition-colors ${
                    newAlert.type === type 
                      ? 'bg-crypto-blue/20 border border-crypto-blue' 
                      : 'bg-crypto-dark hover:bg-crypto-gray'
                  }`}
                >
                  <config.icon className={`w-5 h-5 mb-1 ${config.color}`} />
                  <div className="text-sm font-medium">{config.label}</div>
                  <div className="text-xs text-gray-500">{config.category}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Symbol selection for price/tech alerts */}
          {(newAlert.type === 'price' || newAlert.type === 'rsi' || newAlert.type === 'macd' || 
            newAlert.type === 'support' || newAlert.type === 'resistance' || newAlert.type === 'volume_spike') && (
            <div>
              <label className="text-sm text-gray-400">Crypto</label>
              <select
                value={newAlert.symbol}
                onChange={(e) => setNewAlert({...newAlert, symbol: e.target.value})}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
              >
                <option value="BTCUSDT">BTC/USDT</option>
                <option value="ETHUSDT">ETH/USDT</option>
                <option value="BNBUSDT">BNB/USDT</option>
                <option value="SOLUSDT">SOL/USDT</option>
                <option value="ADAUSDT">ADA/USDT</option>
                <option value="XRPUSDT">XRP/USDT</option>
                <option value="DOTUSDT">DOT/USDT</option>
                <option value="DOGEUSDT">DOGE/USDT</option>
              </select>
            </div>
          )}

          {/* Condition */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400">Condition</label>
              <select
                value={newAlert.condition}
                onChange={(e) => setNewAlert({...newAlert, condition: e.target.value as AlertCondition})}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
              >
                {newAlert.type === 'rsi' ? (
                  <>
                    <option value="rsi_overbought">Surachat ({'>'}70)</option>
                    <option value="rsi_oversold">Survente ({'<'}30)</option>
                  </>
                ) : (
                  <>
                    <option value="above">Au-dessus de</option>
                    <option value="below">En-dessous de</option>
                    <option value="crosses_above">Croise à la hausse</option>
                    <option value="crosses_below">Croise à la baisse</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400">
                Valeur {newAlert.type === 'price' ? '(USDT)' : 
                        newAlert.type === 'daily_loss' || newAlert.type === 'drawdown' ? '(%)' : 
                        newAlert.type === 'rsi' ? '(RSI)' : ''}
              </label>
              <input
                type="number"
                value={newAlert.value}
                onChange={(e) => setNewAlert({...newAlert, value: e.target.value})}
                placeholder={newAlert.type === 'price' ? '70000' : newAlert.type === 'rsi' ? '70' : '5'}
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Priorité</label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setNewAlert({ ...newAlert, priority: p })}
                  className={`p-2 rounded-lg text-sm transition-colors ${
                    newAlert.priority === p
                      ? p === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500' :
                        p === 'high' ? 'bg-orange-500/20 text-orange-400 border border-orange-500' :
                        p === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500' :
                        'bg-blue-500/20 text-blue-400 border border-blue-500'
                      : 'bg-crypto-dark hover:bg-crypto-gray'
                  }`}
                >
                  {p === 'low' ? 'Basse' : p === 'medium' ? 'Moyenne' : p === 'high' ? 'Haute' : 'Critique'}
                </button>
              ))}
            </div>
          </div>

          {/* Channels */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Canaux de notification</label>
            <div className="flex gap-3">
              {(['in_app', 'push', 'email'] as const).map((channel) => (
                <label key={channel} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAlert.channels.includes(channel)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewAlert({ ...newAlert, channels: [...newAlert.channels, channel] });
                      } else {
                        setNewAlert({ ...newAlert, channels: newAlert.channels.filter(c => c !== channel) });
                      }
                    }}
                    className="rounded bg-crypto-dark border-crypto-border"
                  />
                  <span className="text-sm capitalize">
                    {channel === 'in_app' ? 'In-App' : channel === 'push' ? 'Push' : 'Email'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Cooldown */}
          <div>
            <label className="text-sm text-gray-400">Cooldown (minutes avant réactivation)</label>
            <input
              type="number"
              value={newAlert.cooldown}
              onChange={(e) => setNewAlert({...newAlert, cooldown: e.target.value})}
              min="1"
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
            />
          </div>

          {/* Message */}
          <div>
            <label className="text-sm text-gray-400">Message personnalisé (optionnel)</label>
            <input
              type="text"
              value={newAlert.message}
              onChange={(e) => setNewAlert({...newAlert, message: e.target.value})}
              placeholder="Décrivez votre alerte..."
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
            />
          </div>

          <div className="flex gap-3 pt-4">
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
              Créer l'Alerte
            </button>
          </div>
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Paramètres des Alertes">
        <div className="space-y-6">
          {/* Global Settings */}
          <div>
            <h3 className="font-semibold mb-3">Configuration Globale</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Son des alertes</div>
                  <div className="text-sm text-gray-400">Jouer un son lors des notifications</div>
                </div>
                <button
                  onClick={() => saveSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings.soundEnabled ? 'bg-crypto-blue' : 'bg-crypto-dark'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Mode Ne Pas Déranger</div>
                  <div className="text-sm text-gray-400">Silence les notifications pendant les heures configurées</div>
                </div>
                <button
                  onClick={() => saveSettings({ ...settings, doNotDisturb: !settings.doNotDisturb })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings.doNotDisturb ? 'bg-crypto-blue' : 'bg-crypto-dark'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.doNotDisturb ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {settings.doNotDisturb && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">Début</label>
                    <input
                      type="time"
                      value={settings.doNotDisturbStart}
                      onChange={(e) => saveSettings({ ...settings, doNotDisturbStart: e.target.value })}
                      className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Fin</label>
                    <input
                      type="time"
                      value={settings.doNotDisturbEnd}
                      onChange={(e) => saveSettings({ ...settings, doNotDisturbEnd: e.target.value })}
                      className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm text-gray-400">Limite d'alertes par heure</label>
                <input
                  type="number"
                  value={settings.maxAlertsPerHour}
                  onChange={(e) => saveSettings({ ...settings, maxAlertsPerHour: parseInt(e.target.value) || 10 })}
                  min="1"
                  max="100"
                  className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400">Cooldown par défaut (minutes)</label>
                <input
                  type="number"
                  value={settings.defaultCooldown}
                  onChange={(e) => saveSettings({ ...settings, defaultCooldown: parseInt(e.target.value) || 60 })}
                  min="1"
                  className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2 mt-1"
                />
              </div>
            </div>
          </div>

          {/* Alert Types */}
          <div>
            <h3 className="font-semibold mb-3">Types d'Alertes Activés</h3>
            <div className="space-y-2">
              {Object.entries(ALERT_TYPE_CONFIG).map(([type, config]) => (
                <label key={type} className="flex items-center gap-3 p-2 rounded-lg hover:bg-crypto-dark cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enabledTypes.includes(type as AlertType)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        saveSettings({ ...settings, enabledTypes: [...settings.enabledTypes, type as AlertType] });
                      } else {
                        saveSettings({ ...settings, enabledTypes: settings.enabledTypes.filter(t => t !== type) });
                      }
                    }}
                    className="rounded bg-crypto-dark border-crypto-border"
                  />
                  <config.icon className={`w-5 h-5 ${config.color}`} />
                  <div className="flex-1">
                    <div className="font-medium">{config.label}</div>
                    <div className="text-xs text-gray-400">{config.category}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowSettings(false)}
            className="w-full py-2 bg-crypto-blue rounded-lg text-white hover:bg-crypto-blue/80"
          >
            Enregistrer
          </button>
        </div>
      </Modal>

      {/* History Modal */}
      <Modal isOpen={showHistory} onClose={() => setShowHistory(false)} title="Historique des Alertes">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {alertHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <History className="w-12 h-12 mx-auto mb-3" />
              <p>Aucune alerte dans l'historique</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">{alertHistory.length} alertes</span>
                <button
                  onClick={clearHistory}
                  className="text-sm text-crypto-red hover:underline"
                >
                  Effacer l'historique
                </button>
              </div>
              
              <div className="space-y-2">
                {alertHistory.map((entry) => {
                  const typeConfig = ALERT_TYPE_CONFIG[entry.type];
                  const TypeIcon = typeConfig.icon;
                  
                  return (
                    <div 
                      key={entry.id}
                      className={`p-3 rounded-lg ${entry.acknowledged ? 'bg-crypto-dark/50' : 'bg-crypto-dark'}`}
                    >
                      <div className="flex items-start gap-3">
                        <TypeIcon className={`w-5 h-5 ${typeConfig.color} mt-0.5`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{typeConfig.label}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              entry.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                              entry.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              entry.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {entry.priority}
                            </span>
                            {!entry.acknowledged && (
                              <span className="w-2 h-2 bg-crypto-blue rounded-full" />
                            )}
                          </div>
                          <p className="text-sm text-gray-400 mt-1">{entry.message}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {new Date(entry.triggeredAt).toLocaleString()}
                            <span>•</span>
                            {entry.symbol}
                          </div>
                        </div>
                        {!entry.acknowledged && (
                          <button
                            onClick={() => acknowledgeHistory(entry.id)}
                            className="p-1 hover:bg-crypto-gray rounded"
                            title="Marquer comme lu"
                          >
                            <CheckCircle className="w-5 h-5 text-crypto-blue" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!showDeleteModal} onClose={() => setShowDeleteModal(null)} title="Confirmer la suppression">
        <div className="space-y-4">
          <p className="text-gray-400">
            Êtes-vous sûr de vouloir supprimer cette alerte ? Cette action est irréversible.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteModal(null)}
              className="flex-1 py-2 bg-crypto-dark rounded-lg text-gray-400 hover:text-white"
            >
              Annuler
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 py-2 bg-red-500 rounded-lg text-white hover:bg-red-600"
            >
              Supprimer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
