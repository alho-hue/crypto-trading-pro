/**
 * 🌐 WebSocket Manager - Singleton Global
 * Gestion unique de la connexion Socket.IO pour toute l'application
 * Évite les multiples connexions et optimise les ressources
 */

import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Types locaux
interface PriceData {
  symbol: string;
  price: number;
  priceChange?: number;
  priceChangePercent?: number;
  high?: number;
  low?: number;
  volume?: number;
  timestamp?: number;
}

// Buffer pour les mises à jour de prix (throttle)
interface PriceBuffer {
  data: Map<string, PriceData>;
  lastEmit: number;
  subscribers: Set<(prices: Map<string, PriceData>) => void>;
}

class WebSocketManager {
  private static instance: WebSocketManager;
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private priceBuffer: PriceBuffer = {
    data: new Map(),
    lastEmit: 0,
    subscribers: new Set()
  };
  private throttleInterval = 200; // ms
  private throttleTimer: ReturnType<typeof setInterval> | null = null;
  private eventListeners = new Map<string, Set<(data: any) => void>>();
  private subscribedSymbols = new Set<string>();

  private constructor() {
    this.startThrottleTimer();
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Connexion unique au serveur
   */
  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 10000,
      forceNew: false, // Réutilise la connexion existante
      multiplex: true
    });

    this.setupEventHandlers();
    return this.socket;
  }

  /**
   * Configuration des gestionnaires d'événements
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[WebSocketManager] Connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Réabonner aux symboles précédents après reconnexion
      if (this.subscribedSymbols.size > 0) {
        this.socket?.emit('subscribe-prices', Array.from(this.subscribedSymbols));
      }

      this.notifyListeners('connect', null);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocketManager] Disconnected:', reason);
      this.isConnected = false;
      this.notifyListeners('disconnect', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocketManager] Connection error:', error);
      this.reconnectAttempts++;
      this.notifyListeners('error', error);
    });

    // Buffer les mises à jour de prix
    this.socket.on('price-update', (data: PriceData) => {
      this.priceBuffer.data.set(data.symbol, data);
    });

    this.socket.on('subscribed-prices', (symbols: string[]) => {
      console.log('[WebSocketManager] Subscribed to:', symbols);
    });

    // Autres événements pass-through
    this.socket.on('trade-update', (data) => {
      this.notifyListeners('trade-update', data);
    });

    this.socket.on('portfolio-update', (data) => {
      this.notifyListeners('portfolio-update', data);
    });

    this.socket.on('alert', (data) => {
      this.notifyListeners('alert', data);
    });
  }

  /**
   * Timer de throttle pour les mises à jour de prix
   */
  private startThrottleTimer(): void {
    this.throttleTimer = setInterval(() => {
      const now = Date.now();
      if (now - this.priceBuffer.lastEmit >= this.throttleInterval && 
          this.priceBuffer.data.size > 0) {
        
        // Copie les données et vide le buffer
        const prices = new Map(this.priceBuffer.data);
        this.priceBuffer.data.clear();
        this.priceBuffer.lastEmit = now;

        // Notifie tous les subscribers
        this.priceBuffer.subscribers.forEach(callback => {
          try {
            callback(prices);
          } catch (err) {
            console.error('[WebSocketManager] Error in price callback:', err);
          }
        });

        // Notifie aussi via event listeners
        this.notifyListeners('prices-batch', prices);
      }
    }, this.throttleInterval);
  }

  /**
   * S'abonner aux mises à jour de prix (throttled)
   */
  subscribeToPrices(callback: (prices: Map<string, PriceData>) => void): () => void {
    this.priceBuffer.subscribers.add(callback);
    
    // Retourne fonction de désabonnement
    return () => {
      this.priceBuffer.subscribers.delete(callback);
    };
  }

  /**
   * S'abonner à des symboles spécifiques
   */
  subscribeSymbols(symbols: string[]): void {
    symbols.forEach(s => this.subscribedSymbols.add(s));
    
    if (this.socket?.connected) {
      this.socket.emit('subscribe-prices', symbols);
    } else {
      this.connect();
      // Les symboles seront réabonnés après connexion
    }
  }

  /**
   * Se désabonner de symboles
   */
  unsubscribeSymbols(symbols: string[]): void {
    symbols.forEach(s => this.subscribedSymbols.delete(s));
    this.socket?.emit('unsubscribe', symbols.map(s => `${s.toLowerCase()}@ticker`));
  }

  /**
   * Écouter un événement spécifique
   */
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)!.add(callback);

    // Retourne fonction de désabonnement
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  /**
   * Notifier les listeners d'un événement
   */
  private notifyListeners(event: string, data: any): void {
    this.eventListeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`[WebSocketManager] Error in ${event} listener:`, err);
      }
    });
  }

  /**
   * Émettre un événement
   */
  emit(event: string, data?: any): void {
    this.socket?.emit(event, data);
  }

  /**
   * Déconnexion propre
   */
  disconnect(): void {
    if (this.throttleTimer) {
      clearInterval(this.throttleTimer);
      this.throttleTimer = null;
    }
    
    this.socket?.disconnect();
    this.socket = null;
    this.isConnected = false;
  }

  /**
   * Vérifier si connecté
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Obtenir l'instance socket
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Changer l'intervalle de throttle
   */
  setThrottleInterval(ms: number): void {
    this.throttleInterval = ms;
  }

  /**
   * Obtenir les symboles abonnés
   */
  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }
}

// Export singleton
export const websocketManager = WebSocketManager.getInstance();

// Hook React optimisé
export function useGlobalWebSocket() {
  return {
    connect: () => websocketManager.connect(),
    disconnect: () => websocketManager.disconnect(),
    subscribeToPrices: (cb: (prices: Map<string, PriceData>) => void) => 
      websocketManager.subscribeToPrices(cb),
    subscribeSymbols: (symbols: string[]) => websocketManager.subscribeSymbols(symbols),
    unsubscribeSymbols: (symbols: string[]) => websocketManager.unsubscribeSymbols(symbols),
    on: (event: string, callback: (data: any) => void) => websocketManager.on(event, callback),
    emit: (event: string, data?: any) => websocketManager.emit(event, data),
    connected: websocketManager.connected,
    getSocket: () => websocketManager.getSocket()
  };
}
