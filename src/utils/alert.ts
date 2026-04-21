import { showToast } from '../stores/toastStore';

/**
 * Show an in-app toast notification instead of browser alert
 * Usage: alert('Message') → showAlert('Message', 'error')
 */
export const showAlert = {
  success: (message: string, title: string = 'Succès') => {
    showToast.success(message, title, 5000);
  },
  error: (message: string, title: string = 'Erreur') => {
    showToast.error(message, title, 5000);
  },
  warning: (message: string, title: string = 'Attention') => {
    showToast.warning(message, title, 5000);
  },
  info: (message: string, title: string = 'Info') => {
    showToast.info(message, title, 5000);
  },
};

/**
 * Wrapper to replace window.alert
 * Usage: import { alertApp } from '../utils/alert';
 * Then use alertApp('message') instead of alert('message')
 */
export const alertApp = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  showToast[type](message, type === 'error' ? 'Erreur' : type === 'success' ? 'Succès' : 'Info', 5000);
};

/**
 * For backwards compatibility - can be used to override window.alert in dev mode
 * WARNING: Only use in development, not in production
 */
export const overrideAlert = () => {
  (window as any).originalAlert = window.alert;
  window.alert = (message: string) => {
    showToast.info(message, 'Notification', 5000);
  };
};

export const restoreAlert = () => {
  if ((window as any).originalAlert) {
    window.alert = (window as any).originalAlert;
  }
};
