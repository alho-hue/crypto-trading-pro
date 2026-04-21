/**
 * NEUROVEST - Binance Service Unifié
 * Service centralisé pour toutes les interactions avec l'API Binance
 * 
 * Fonctionnalités:
 * - Rate limiting intelligent (1200 req/min max)
 * - Retry avec exponential backoff
 * - WebSocket temps réel
 * - Logging structuré
 * - Gestion d'erreurs robuste
 * - Aucune donnée fake (sauf mode démo explicite)
 */

const axios = require('axios');
const crypto = require('crypto');
const WebSocket = require('ws');
const EventEmitter = require('events');

// Configuration
const CONFIG = {
  // Rate limiting: 1200 requêtes/minute max (Binance limit)
  RATE_LIMIT: {
    MAX_REQUESTS_PER_MINUTE: 1200,
    MIN_INTERVAL_MS: 50, // 50ms = 1200 req/min
    QUEUE_SIZE: 1000
  },
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 5,
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 30000,
    EXPONENTIAL_FACTOR: 2
  },
  
  // Timeouts
  TIMEOUT: {
    API: 10000,
    WS_RECONNECT: 5000,
    WS_PING: 30000
  },
  
  // Endpoints
  BASE_URLS: {
    SPOT: 'https://api.binance.com',
    FUTURES: 'https://fapi.binance.com',
    WS_SPOT: 'wss://stream.binance.com:9443/ws',
    WS_FUTURES: 'wss://fstream.binance.com/ws'
  }
};

// Logger structuré simple
const logger = {
  info: (msg, meta = {}) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, meta),
  warn: (msg, meta = {}) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, meta),
  debug: (msg, meta = {}) => process.env.NODE_ENV === 'development' && console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`, meta)
};

/**
 * Rate Limiter - Garantit max 1200 requêtes/minute
 */
class RateLimiter {
  constructor() {
    this.queue = [];
    this.requestsThisMinute = 0;
    this.windowStart = Date.now();
    this.processing = false;
  }

  async acquire() {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= CONFIG.RATE_LIMIT.QUEUE_SIZE) {
        reject(new Error('Rate limit queue full'));
        return;
      }
      this.queue.push({ resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const now = Date.now();
    
    // Reset counter every minute
    if (now - this.windowStart >= 60000) {
      this.requestsThisMinute = 0;
      this.windowStart = now;
    }

    // Check if we're at the limit
    if (this.requestsThisMinute >= CONFIG.RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = 60000 - (now - this.windowStart);
      logger.warn(`Rate limit hit, waiting ${waitTime}ms`);
      await this.sleep(waitTime);
      this.requestsThisMinute = 0;
      this.windowStart = Date.now();
    }

    // Ensure minimum interval between requests
    await this.sleep(CONFIG.RATE_LIMIT.MIN_INTERVAL_MS);

    const item = this.queue.shift();
    if (item) {
      this.requestsThisMinute++;
      item.resolve();
    }

    this.processing = false;
    if (this.queue.length > 0) {
      this.process();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * WebSocket Manager - Connexion temps réel aux prix
 */
class WebSocketManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();
    this.subscribers = new Map();
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 10;
  }

  connect(streamName, isFutures = false) {
    const wsUrl = isFutures 
      ? `${CONFIG.BASE_URLS.WS_FUTURES}/${streamName}`
      : `${CONFIG.BASE_URLS.WS_SPOT}/${streamName}`;

    if (this.connections.has(streamName)) {
      logger.debug(`WebSocket ${streamName} already connected`);
      return;
    }

    logger.info(`Connecting WebSocket: ${streamName}`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      logger.info(`WebSocket connected: ${streamName}`);
      this.reconnectAttempts.set(streamName, 0);
      this.emit('connected', streamName);
      
      // Start ping interval
      ws.pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, CONFIG.TIMEOUT.WS_PING);
    });

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data);
        this.emit('data', streamName, parsed);
        
        // Notify subscribers
        const subs = this.subscribers.get(streamName) || [];
        subs.forEach(callback => {
          try {
            callback(parsed);
          } catch (err) {
            logger.error('Subscriber callback error', { error: err.message });
          }
        });
      } catch (err) {
        logger.error('WebSocket message parse error', { error: err.message });
      }
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error: ${streamName}`, { error: error.message });
      this.emit('error', streamName, error);
    });

    ws.on('close', () => {
      logger.warn(`WebSocket closed: ${streamName}`);
      clearInterval(ws.pingInterval);
      this.connections.delete(streamName);
      this.emit('disconnected', streamName);
      
      // Reconnect logic
      const attempts = this.reconnectAttempts.get(streamName) || 0;
      if (attempts < this.maxReconnectAttempts) {
        this.reconnectAttempts.set(streamName, attempts + 1);
        const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
        logger.info(`Reconnecting ${streamName} in ${delay}ms (attempt ${attempts + 1})`);
        setTimeout(() => this.connect(streamName, isFutures), delay);
      } else {
        logger.error(`Max reconnect attempts reached for ${streamName}`);
        this.emit('maxReconnectReached', streamName);
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    this.connections.set(streamName, ws);
  }

  disconnect(streamName) {
    const ws = this.connections.get(streamName);
    if (ws) {
      clearInterval(ws.pingInterval);
      ws.terminate();
      this.connections.delete(streamName);
      this.subscribers.delete(streamName);
      logger.info(`WebSocket disconnected: ${streamName}`);
    }
  }

  disconnectAll() {
    for (const [streamName, ws] of this.connections) {
      this.disconnect(streamName);
    }
  }

  subscribe(streamName, callback) {
    if (!this.subscribers.has(streamName)) {
      this.subscribers.set(streamName, []);
    }
    this.subscribers.get(streamName).push(callback);
    logger.debug(`Subscriber added to ${streamName}`);
  }

  unsubscribe(streamName, callback) {
    const subs = this.subscribers.get(streamName) || [];
    const index = subs.indexOf(callback);
    if (index > -1) {
      subs.splice(index, 1);
    }
  }
}

/**
 * Binance Service Unifié
 * Point d'accès unique à toutes les fonctionnalités Binance
 */
class BinanceServiceUnified extends EventEmitter {
  constructor() {
    super();
    this.rateLimiter = new RateLimiter();
    this.wsManager = new WebSocketManager();
    this.apiKey = process.env.BINANCE_API_KEY || '';
    this.apiSecret = process.env.BINANCE_API_SECRET || '';
    this.demoMode = !this.apiKey || !this.apiSecret;
    
    if (this.demoMode) {
      logger.warn('Binance Service running in DEMO MODE - No real trading possible');
    } else {
      logger.info('Binance Service initialized with API credentials');
    }

    // Forward WebSocket events
    this.wsManager.on('data', (stream, data) => this.emit('wsData', stream, data));
    this.wsManager.on('connected', (stream) => this.emit('wsConnected', stream));
    this.wsManager.on('disconnected', (stream) => this.emit('wsDisconnected', stream));
    this.wsManager.on('error', (stream, error) => this.emit('wsError', stream, error));
  }

  // ==================== AUTHENTIFICATION ====================

  generateSignature(queryString, apiSecret = null) {
    const secret = apiSecret || this.apiSecret;
    return crypto
      .createHmac('sha256', secret)
      .update(queryString)
      .digest('hex');
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['X-MBX-APIKEY'] = this.apiKey;
    }
    return headers;
  }

  // ==================== RETRY LOGIC ====================

  async withRetry(operation, context = '') {
    for (let attempt = 1; attempt <= CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
      try {
        logger.debug(`Attempt ${attempt}/${CONFIG.RETRY.MAX_ATTEMPTS} ${context}`);
        return await operation();
      } catch (error) {
        const isRetryable = this.isRetryableError(error);
        
        if (!isRetryable || attempt === CONFIG.RETRY.MAX_ATTEMPTS) {
          logger.error(`Operation failed after ${attempt} attempts ${context}`, { 
            error: error.message,
            code: error.response?.status
          });
          throw error;
        }

        const delay = Math.min(
          CONFIG.RETRY.BASE_DELAY_MS * Math.pow(CONFIG.RETRY.EXPONENTIAL_FACTOR, attempt - 1),
          CONFIG.RETRY.MAX_DELAY_MS
        );
        
        logger.warn(`Retry ${attempt}/${CONFIG.RETRY.MAX_ATTEMPTS} after ${delay}ms ${context}`, {
          error: error.message
        });
        
        await this.sleep(delay);
      }
    }
  }

  isRetryableError(error) {
    if (!error.response) return true; // Network errors are retryable
    const status = error.response.status;
    return status === 429 || status >= 500 || status === 408;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== API REQUESTS ====================

  async makeRequest(method, endpoint, params = {}, isSigned = false, isFutures = false, apiKeys = null) {
    await this.rateLimiter.acquire();

    const baseUrl = isFutures ? CONFIG.BASE_URLS.FUTURES : CONFIG.BASE_URLS.SPOT;
    let url = `${baseUrl}${endpoint}`;
    let body = null;
    
    // Utiliser les clés utilisateur si fournies, sinon utiliser les clés par défaut
    const useApiKey = apiKeys?.apiKey || this.apiKey;
    const useApiSecret = apiKeys?.apiSecret || this.apiSecret;

    if (isSigned) {
      if (!useApiKey || !useApiSecret) {
        throw new Error('API keys required for signed requests');
      }
      params.timestamp = Date.now();
      params.recvWindow = 60000;
      const queryString = new URLSearchParams(params).toString();
      params.signature = this.generateSignature(queryString, useApiSecret);
    }

    if (method === 'GET') {
      const queryString = new URLSearchParams(params).toString();
      if (queryString) url += `?${queryString}`;
    } else {
      body = JSON.stringify(params);
    }
    
    // Headers avec clés utilisateur si fournies
    const headers = {
      'Content-Type': 'application/json',
      ...(useApiKey && { 'X-MBX-APIKEY': useApiKey })
    };

    const operation = async () => {
      const response = await axios({
        method,
        url,
        headers,
        data: body,
        timeout: CONFIG.TIMEOUT.API
      });
      return response.data;
    };

    return await this.withRetry(operation, `${method} ${endpoint}`);
  }

  // ==================== MARKET DATA ====================

  async getPrice(symbol) {
    try {
      const data = await this.makeRequest('GET', '/api/v3/ticker/price', {
        symbol: symbol.toUpperCase()
      });
      return {
        symbol: data.symbol,
        price: parseFloat(data.price),
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Failed to get price for ${symbol}`, { error: error.message });
      throw error;
    }
  }

  async get24hTicker(symbol = null) {
    try {
      const params = symbol ? { symbol: symbol.toUpperCase() } : {};
      const data = await this.makeRequest('GET', '/api/v3/ticker/24hr', params);
      
      const formatTicker = (t) => ({
        symbol: t.symbol,
        priceChange: parseFloat(t.priceChange),
        priceChangePercent: parseFloat(t.priceChangePercent),
        lastPrice: parseFloat(t.lastPrice),
        highPrice: parseFloat(t.highPrice),
        lowPrice: parseFloat(t.lowPrice),
        volume: parseFloat(t.volume),
        quoteVolume: parseFloat(t.quoteVolume),
        openPrice: parseFloat(t.openPrice),
        openTime: t.openTime,
        closeTime: t.closeTime
      });

      return Array.isArray(data) ? data.map(formatTicker) : formatTicker(data);
    } catch (error) {
      logger.error('Failed to get 24h ticker', { error: error.message });
      throw error;
    }
  }

  async getKlines(symbol, interval = '1h', limit = 100) {
    try {
      const data = await this.makeRequest('GET', '/api/v3/klines', {
        symbol: symbol.toUpperCase(),
        interval,
        limit
      });

      return data.map(candle => ({
        time: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: candle[6],
        quoteVolume: parseFloat(candle[7]),
        trades: candle[8]
      }));
    } catch (error) {
      logger.error(`Failed to get klines for ${symbol}`, { error: error.message });
      throw error;
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      return await this.makeRequest('GET', '/api/v3/depth', {
        symbol: symbol.toUpperCase(),
        limit
      });
    } catch (error) {
      logger.error(`Failed to get order book for ${symbol}`, { error: error.message });
      throw error;
    }
  }

  // ==================== ACCOUNT ====================

  async getAccountInfo(apiKeys = null) {
    const hasKeys = (apiKeys?.apiKey && apiKeys?.apiSecret) || (this.apiKey && this.apiSecret);
    if (!hasKeys) {
      throw new Error('DEMO_MODE: Cannot access real account without API keys');
    }

    try {
      const data = await this.makeRequest('GET', '/api/v3/account', {}, true, false, apiKeys);
      return {
        balances: data.balances
          .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
          .map(b => ({
            asset: b.asset,
            free: parseFloat(b.free),
            locked: parseFloat(b.locked),
            total: parseFloat(b.free) + parseFloat(b.locked)
          })),
        makerCommission: data.makerCommission,
        takerCommission: data.takerCommission,
        canTrade: data.canTrade,
        canWithdraw: data.canWithdraw,
        canDeposit: data.canDeposit
      };
    } catch (error) {
      logger.error('Failed to get account info', { error: error.message });
      throw error;
    }
  }

  async getBalances(apiKeys = null) {
    const account = await this.getAccountInfo(apiKeys);
    return account.balances;
  }

  // ==================== SPOT TRADING ====================

  async placeOrder(params, apiKeys = null) {
    // Mode démo si pas de clés (ni globales ni utilisateur)
    const hasKeys = (apiKeys?.apiKey && apiKeys?.apiSecret) || (this.apiKey && this.apiSecret);
    if (!hasKeys) {
      // Simulate order in demo mode
      logger.info('DEMO MODE: Simulated order', { params });
      return {
        orderId: `DEMO_${Date.now()}`,
        symbol: params.symbol,
        status: 'FILLED',
        side: params.side,
        type: params.type,
        price: params.price || 0,
        quantity: params.quantity,
        demo: true,
        timestamp: Date.now()
      };
    }

    try {
      const data = await this.makeRequest('POST', '/api/v3/order', {
        symbol: params.symbol.toUpperCase(),
        side: params.side.toUpperCase(),
        type: params.type.toUpperCase(),
        quantity: params.quantity.toString(),
        ...(params.price && { price: params.price.toString() }),
        ...(params.timeInForce && { timeInForce: params.timeInForce }),
        ...(params.stopPrice && { stopPrice: params.stopPrice.toString() })
      }, true, false, apiKeys);

      logger.info('Order placed', { 
        orderId: data.orderId, 
        symbol: data.symbol,
        side: data.side,
        status: data.status 
      });

      return {
        orderId: data.orderId,
        symbol: data.symbol,
        status: data.status,
        side: data.side,
        type: data.type,
        price: parseFloat(data.price),
        quantity: parseFloat(data.origQty),
        executedQty: parseFloat(data.executedQty),
        timestamp: data.transactTime
      };
    } catch (error) {
      logger.error('Failed to place order', { 
        error: error.message,
        params 
      });
      throw error;
    }
  }

  async placeMarketOrder(symbol, side, quantity) {
    return this.placeOrder({ symbol, side, type: 'MARKET', quantity });
  }

  async placeLimitOrder(symbol, side, quantity, price, timeInForce = 'GTC') {
    return this.placeOrder({ 
      symbol, 
      side, 
      type: 'LIMIT', 
      quantity, 
      price, 
      timeInForce 
    });
  }

  async cancelOrder(symbol, orderId) {
    if (this.demoMode) {
      logger.info('DEMO MODE: Simulated cancel', { symbol, orderId });
      return { orderId, status: 'CANCELED', demo: true };
    }

    try {
      const data = await this.makeRequest('DELETE', '/api/v3/order', {
        symbol: symbol.toUpperCase(),
        orderId: orderId.toString()
      }, true);

      logger.info('Order cancelled', { orderId, symbol });
      return data;
    } catch (error) {
      logger.error('Failed to cancel order', { error: error.message, orderId });
      throw error;
    }
  }

  async getOpenOrders(symbol = null) {
    if (this.demoMode) {
      return []; // No real orders in demo mode
    }

    const params = symbol ? { symbol: symbol.toUpperCase() } : {};
    return await this.makeRequest('GET', '/api/v3/openOrders', params, true);
  }

  async getOrderHistory(symbol, limit = 100) {
    if (this.demoMode) {
      return []; // No real history in demo mode
    }

    return await this.makeRequest('GET', '/api/v3/allOrders', {
      symbol: symbol.toUpperCase(),
      limit
    }, true);
  }

  // ==================== WEBSOCKET ====================

  subscribeToPrice(symbol, callback) {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    this.wsManager.subscribe(streamName, (data) => {
      if (data && data.c) { // c = current price
        callback({
          symbol: data.s,
          price: parseFloat(data.c),
          priceChange: parseFloat(data.P),
          high: parseFloat(data.h),
          low: parseFloat(data.l),
          volume: parseFloat(data.v),
          timestamp: data.E
        });
      }
    });
    this.wsManager.connect(streamName);
    logger.info(`Subscribed to price stream: ${streamName}`);
  }

  subscribeToKlines(symbol, interval, callback) {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    this.wsManager.subscribe(streamName, (data) => {
      if (data && data.k) { // k = kline data
        const k = data.k;
        callback({
          symbol: data.s,
          time: k.t,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
          isClosed: k.x, // is final
          timestamp: data.E
        });
      }
    });
    this.wsManager.connect(streamName);
    logger.info(`Subscribed to kline stream: ${streamName}`);
  }

  subscribeToTrades(symbol, callback) {
    const streamName = `${symbol.toLowerCase()}@trade`;
    this.wsManager.subscribe(streamName, (data) => {
      callback({
        symbol: data.s,
        price: parseFloat(data.p),
        quantity: parseFloat(data.q),
        time: data.T,
        isBuyerMaker: data.m,
        timestamp: data.E
      });
    });
    this.wsManager.connect(streamName);
    logger.info(`Subscribed to trade stream: ${streamName}`);
  }

  unsubscribe(streamName) {
    this.wsManager.disconnect(streamName);
    logger.info(`Unsubscribed from: ${streamName}`);
  }

  // ==================== FUTURES TRADING ====================

  /**
   * Définir le levier pour un symbole Futures
   * POST /fapi/v1/leverage
   */
  async setFuturesLeverage(symbol, leverage, apiKeys = null) {
    if (this.demoMode) {
      logger.info('DEMO MODE: Simulated leverage setting', { symbol, leverage });
      return { symbol, leverage: parseInt(leverage), maxNotionalValue: 1000000 };
    }

    try {
      const data = await this.makeRequest('POST', '/fapi/v1/leverage', {
        symbol: symbol.toUpperCase(),
        leverage: parseInt(leverage)
      }, true, true, apiKeys); // isSigned=true, isFutures=true

      logger.info('Futures leverage set', { symbol, leverage: data.leverage });
      return {
        symbol: data.symbol,
        leverage: data.leverage,
        maxNotionalValue: data.maxNotionalValue
      };
    } catch (error) {
      logger.error('Failed to set futures leverage', { error: error.message, symbol, leverage });
      throw error;
    }
  }

  /**
   * Récupérer les positions Futures ouvertes
   * GET /fapi/v2/positionRisk
   */
  async getFuturesPositions(symbol = null, apiKeys = null) {
    if (this.demoMode) {
      return []; // Pas de positions réelles en mode démo
    }

    try {
      const params = symbol ? { symbol: symbol.toUpperCase() } : {};
      const data = await this.makeRequest('GET', '/fapi/v2/positionRisk', params, true, true, apiKeys);

      // Formater les positions
      const positions = Array.isArray(data) ? data : [data];
      return positions
        .filter(p => parseFloat(p.positionAmt) !== 0) // Ne garder que les positions non nulles
        .map(p => ({
          symbol: p.symbol,
          side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
          size: Math.abs(parseFloat(p.positionAmt)),
          entryPrice: parseFloat(p.entryPrice),
          markPrice: parseFloat(p.markPrice),
          liquidationPrice: parseFloat(p.liquidationPrice),
          leverage: parseInt(p.leverage),
          unrealizedPnl: parseFloat(p.unRealizedProfit),
          marginType: p.marginType,
          isolatedMargin: parseFloat(p.isolatedMargin),
          notional: parseFloat(p.notional)
        }));
    } catch (error) {
      logger.error('Failed to get futures positions', { error: error.message, symbol });
      throw error;
    }
  }

  /**
   * Récupérer le solde du compte Futures
   * GET /fapi/v2/account
   */
  async getFuturesAccount(apiKeys = null) {
    if (this.demoMode) {
      throw new Error('DEMO_MODE: No futures account in demo mode');
    }

    try {
      const data = await this.makeRequest('GET', '/fapi/v2/account', {}, true, true, apiKeys);

      return {
        totalWalletBalance: parseFloat(data.totalWalletBalance),
        totalUnrealizedProfit: parseFloat(data.totalUnrealizedProfit),
        totalMarginBalance: parseFloat(data.totalMarginBalance),
        availableBalance: parseFloat(data.availableBalance),
        assets: data.assets.map(a => ({
          asset: a.asset,
          walletBalance: parseFloat(a.walletBalance),
          unrealizedProfit: parseFloat(a.unrealizedProfit),
          marginBalance: parseFloat(a.marginBalance),
          availableBalance: parseFloat(a.availableBalance)
        })),
        positions: data.positions.map(p => ({
          symbol: p.symbol,
          initialMargin: parseFloat(p.initialMargin),
          maintMargin: parseFloat(p.maintMargin),
          unrealizedProfit: parseFloat(p.unrealizedProfit),
          positionInitialMargin: parseFloat(p.positionInitialMargin)
        }))
      };
    } catch (error) {
      logger.error('Failed to get futures account', { error: error.message });
      throw error;
    }
  }

  /**
   * Placer un ordre Futures
   * POST /fapi/v1/order
   */
  async placeFuturesOrder(params, apiKeys = null) {
    if (this.demoMode) {
      logger.info('DEMO MODE: Simulated futures order', { params });
      return {
        orderId: `FUTURES_DEMO_${Date.now()}`,
        symbol: params.symbol,
        status: 'FILLED',
        side: params.side,
        type: params.type,
        price: params.price || 0,
        quantity: params.quantity,
        demo: true
      };
    }

    try {
      const data = await this.makeRequest('POST', '/fapi/v1/order', {
        symbol: params.symbol.toUpperCase(),
        side: params.side.toUpperCase(),
        type: params.type.toUpperCase(),
        quantity: params.quantity.toString(),
        ...(params.price && { price: params.price.toString() }),
        ...(params.timeInForce && { timeInForce: params.timeInForce }),
        ...(params.stopPrice && { stopPrice: params.stopPrice.toString() })
      }, true, true, apiKeys);

      logger.info('Futures order placed', {
        orderId: data.orderId,
        symbol: data.symbol,
        side: data.side,
        status: data.status
      });

      return {
        orderId: data.orderId,
        symbol: data.symbol,
        status: data.status,
        side: data.side,
        type: data.type,
        price: parseFloat(data.price),
        quantity: parseFloat(data.origQty),
        executedQty: parseFloat(data.executedQty),
        timestamp: data.updateTime
      };
    } catch (error) {
      logger.error('Failed to place futures order', { error: error.message, params });
      throw error;
    }
  }

  // ==================== UTILITAIRES ====================

  getStatus() {
    return {
      demoMode: this.demoMode,
      connectedStreams: Array.from(this.wsManager.connections.keys()),
      rateLimiterQueue: this.rateLimiter.queue.length,
      hasApiKeys: !!this.apiKey && !!this.apiSecret
    };
  }

  isDemoMode() {
    return this.demoMode;
  }
}

// Singleton instance
const binanceService = new BinanceServiceUnified();

module.exports = binanceService;
