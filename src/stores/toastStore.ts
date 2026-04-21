import { create } from 'zustand';
import type { ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  title?: string;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    
    // Auto-remove after duration
    if (toast.duration !== 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, toast.duration || 5000);
    }
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  clearAll: () => set({ toasts: [] }),
}));

// Helper functions
export const showToast = {
  success: (message: string, title?: string, duration?: number) => {
    useToastStore.getState().addToast({ message, type: 'success', title, duration });
  },
  error: (message: string, title?: string, duration?: number) => {
    useToastStore.getState().addToast({ message, type: 'error', title, duration });
  },
  warning: (message: string, title?: string, duration?: number) => {
    useToastStore.getState().addToast({ message, type: 'warning', title, duration });
  },
  info: (message: string, title?: string, duration?: number) => {
    useToastStore.getState().addToast({ message, type: 'info', title, duration });
  },
  // Custom toast with React element as message
  custom: (message: React.ReactNode, title?: string, duration?: number) => {
    useToastStore.getState().addToast({ 
      message: message as string, 
      type: 'info', 
      title, 
      duration 
    });
  },
};
