/**
 * Widget Alertes - Affiche les alertes prix et signaux
 */

import { Bell, AlertTriangle, Zap, Bot, Brain, X, Clock } from 'lucide-react';
import type { AlertWidgetItem } from '../../types/widgets';

interface AlertWidgetProps {
  alerts: AlertWidgetItem[];
  onAcknowledge?: (id: string) => void;
  compact?: boolean;
}

export default function AlertWidget({ alerts, onAcknowledge, compact = false }: AlertWidgetProps) {
  const unacknowledged = alerts.filter(a => !a.acknowledged);
  const critical = unacknowledged.filter(a => a.severity === 'critical');
  const warning = unacknowledged.filter(a => a.severity === 'warning');
  
  if (unacknowledged.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6">
        <div className="p-4 bg-slate-800/50 rounded-2xl mb-4">
          <Bell className="w-10 h-10 text-slate-600" />
        </div>
        <span className="text-sm font-medium">Aucune alerte active</span>
        <span className="text-xs text-gray-500 mt-1">Tout va bien!</span>
      </div>
    );
  }
  
  if (compact) {
    const latest = unacknowledged[0];
    return (
      <div className="flex items-center gap-3 h-full px-1">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${
          latest.severity === 'critical' ? 'bg-red-500/20 border-red-500/30' : 
          latest.severity === 'warning' ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-blue-500/20 border-blue-500/30'
        }`}>
          {latest.severity === 'critical' ? <AlertTriangle className="w-6 h-6 text-red-400" /> :
           latest.severity === 'warning' ? <Bell className="w-6 h-6 text-yellow-400" /> :
           <Zap className="w-6 h-6 text-blue-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{latest.message}</div>
          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
            <span>{unacknowledged.length} alertes</span>
            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
            <span className={critical.length > 0 ? 'text-red-400' : ''}>{critical.length} urgentes</span>
          </div>
        </div>
      </div>
    );
  }
  
  const getIcon = (type: string, severity: string) => {
    if (type === 'bot') return <Bot className="w-4 h-4" />;
    if (type === 'ai') return <Brain className="w-4 h-4" />;
    if (severity === 'critical') return <AlertTriangle className="w-4 h-4" />;
    return <Bell className="w-4 h-4" />;
  };
  
  const getColors = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      default: return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Header avec compteurs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Bell className="w-4 h-4 text-yellow-400" />
          </div>
          <span className="text-sm font-semibold text-white">Alertes</span>
        </div>
        <div className="flex gap-2">
          {critical.length > 0 && (
            <span className="text-xs font-medium px-3 py-1.5 bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
              {critical.length} urgentes
            </span>
          )}
          {warning.length > 0 && (
            <span className="text-xs font-medium px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-full border border-yellow-500/30">
              {warning.length} avertissements
            </span>
          )}
        </div>
      </div>
      
      {/* Liste des alertes avec meilleur design */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {unacknowledged.slice(0, 5).map((alert) => (
          <div
            key={alert.id}
            className={`p-4 rounded-2xl border ${getColors(alert.severity)} relative group transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 p-2.5 rounded-xl ${
                alert.severity === 'critical' ? 'bg-red-500/20' :
                alert.severity === 'warning' ? 'bg-yellow-500/20' :
                'bg-blue-500/20'
              }`}>
                {getIcon(alert.type, alert.severity)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white leading-relaxed">{alert.message}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-medium px-2.5 py-1 bg-slate-800/70 rounded-full text-gray-400">
                    {alert.symbol}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              {onAcknowledge && (
                <button
                  onClick={() => onAcknowledge(alert.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/10 rounded-xl transition-all duration-200"
                  title="Marquer comme lu"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        
        {unacknowledged.length > 5 && (
          <div className="text-center text-xs text-gray-500 py-3 px-4 bg-slate-800/30 rounded-xl">
            +{unacknowledged.length - 5} alertes supplémentaires
          </div>
        )}
      </div>
    </div>
  );
}
