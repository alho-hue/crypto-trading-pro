/**
 * 🔔 ToastContainer - Système de Notifications
 * Affiche les toasts modernes à la place des alert()
 */

import { useEffect, useState } from 'react';
import { notifications } from '../services/notificationService';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
};

const colors = {
  success: 'bg-green-500/10 border-green-500/30 text-green-400',
  error: 'bg-red-500/10 border-red-500/30 text-red-400',
  warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-400'
};

const iconColors = {
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-yellow-400',
  info: 'text-blue-400'
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = notifications.subscribe((newToasts) => {
      setToasts(newToasts);
    });
    return unsubscribe;
  }, []);

  const removeToast = (id: string) => {
    notifications.removeToast(id);
  };

  return (
    <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto w-96 animate-slide-in-right ${colors[toast.type]} 
                       backdrop-blur-md rounded-xl border p-4 shadow-2xl
                       transform transition-all duration-300 hover:scale-[1.02]`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg bg-black/20 ${iconColors[toast.type]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-white mb-1">{toast.title}</h4>
                <p className="text-sm text-gray-300 leading-relaxed">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-0.5 bg-black/20 rounded-full overflow-hidden">
              <div 
                className={`h-full ${iconColors[toast.type]} opacity-50 animate-shrink`}
                style={{ animationDuration: '4000ms' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
