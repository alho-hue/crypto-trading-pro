/**
 * 🔔 NEUROVEST - Système de Notifications Toast
 * Remplace tous les alert() natifs par des toasts modernes
 */

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration: number;
}

class NotificationService {
  private toasts: Toast[] = [];
  private listeners: ((toasts: Toast[]) => void)[] = [];

  private generateId(): string {
    return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private notify() {
    this.listeners.forEach(listener => listener([...this.toasts]));
  }

  subscribe(listener: (toasts: Toast[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private addToast(type: ToastType, title: string, message: string, duration = 4000) {
    const toast: Toast = {
      id: this.generateId(),
      type,
      title,
      message,
      duration
    };
    this.toasts.push(toast);
    this.notify();

    setTimeout(() => {
      this.removeToast(toast.id);
    }, duration);

    return toast.id;
  }

  removeToast(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  }

  // 🎉 Méthodes publiques
  success(title: string, message: string, duration?: number) {
    return this.addToast('success', title, message, duration);
  }

  error(title: string, message: string, duration?: number) {
    return this.addToast('error', title, message, duration);
  }

  warning(title: string, message: string, duration?: number) {
    return this.addToast('warning', title, message, duration);
  }

  info(title: string, message: string, duration?: number) {
    return this.addToast('info', title, message, duration);
  }

  // 🚀 Raccourcis spécifiques
  backtestSaved() {
    return this.success(
      'Backtest Sauvegardé !',
      'Votre stratégie a été sauvegardée avec succès. Retrouvez-la dans la comparaison.',
      4000
    );
  }

  strategyValidated(strategy: string, symbol: string) {
    return this.success(
      '🚀 Stratégie Validée !',
      `${strategy} sur ${symbol} a été envoyée au Trading Bot avec succès.`,
      5000
    );
  }

  exportSuccess(filename: string) {
    return this.success(
      'Export Réussi !',
      `Le fichier ${filename} a été téléchargé avec succès.`,
      4000
    );
  }

  tradeExecuted(side: 'BUY' | 'SELL', symbol: string, amount: number) {
    const emoji = side === 'BUY' ? '🟢' : '🔴';
    const action = side === 'BUY' ? 'Achat' : 'Vente';
    return this.success(
      `${emoji} ${action} Exécuté`,
      `${action} de ${amount} ${symbol} effectué avec succès.`,
      5000
    );
  }

  botStarted() {
    return this.success(
      '🤖 Bot Démarré',
      'Le trading bot est maintenant actif et analyse le marché.',
      4000
    );
  }

  botStopped() {
    return this.info(
      '⏹️ Bot Arrêté',
      'Le trading bot a été arrêté. Les positions restantes sont maintenues.',
      4000
    );
  }

  apiError(error: string) {
    return this.error(
      '❌ Erreur API',
      error || 'Une erreur est survenue lors de la connexion à l\'API.',
      6000
    );
  }

  validationError(field: string) {
    return this.warning(
      '⚠️ Validation',
      `Veuillez vérifier le champ : ${field}`,
      4000
    );
  }
}

export const notifications = new NotificationService();
