/**
 * NEUROVEST - Binance Service Production-Ready
 * Interfaçage avec l'API Binance (Spot & Futures)
 * 
 * FIXES CRITIQUES:
 * - Rate limiting: 1200 req/min max (Binance limit) = 50ms min entre requêtes
 * - User-Agent header requis pour éviter 403
 * - Cache mémoire pour éviter spam API
 * - Exponential backoff retry
 * - No infinite loops
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const WebSocket = require('ws');
const EventEmitter = require('events');

// Configuration Production
const CONFIG = {
  // Rate limiting: 1200 requêtes/minute max (limite Binance)
  RATE_LIMIT: {
    MAX_REQUESTS_PER_MINUTE: 1200,
    MIN_INTERVAL_MS: 50, // 50ms = 1200 req/min
    QUEUE_SIZE: 1000,
    WINDOW_MS: 60000 // 1 minute
  },
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 5,
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 30000,
    EXPONENTIAL_FACTOR: 2
  },
  
  // Cache configuration
  CACHE: {
    PRICE_TTL_MS: 5000, // 5 secondes pour les prix
    KLINES_TTL_MS: 30000, // 30 secondes pour les klines
    TICKER_TTL_MS: 10000, // 10 secondes pour 24h ticker
    ACCOUNT_TTL_MS: 5000 // 5 secondes pour account info
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
  },
  
  // Headers requis
  HEADERS: {
    'User-Agent': 'NEUROVEST-Trading-Bot/1.0',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
};

// Logger structuré
const logger = {
  info: (msg, meta = {}) => console.log(`[BINANCE][INFO] ${new Date().toISOString()} - ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`[BINANCE][ERROR] ${new Date().toISOString()} - ${msg}`, meta),
  warn: (msg, meta = {}) => console.warn(`[BINANCE][WARN] ${new Date().toISOString()} - ${msg}`, meta),
  debug: (msg, meta = {}) => process.env.NODE_ENV === 'development' && console.log(`[BINANCE][DEBUG] ${new Date().toISOString()} - ${msg}`, meta)
};

/**
 * Rate Limiter - Garantit max 1200 requêtes/minute
 * File d'attente avec traitement séquentiel
 */
class RateLimiter extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.requestsThisMinute = 0;
    this.windowStart = Date.now();
    this.processing = false;
  }

  async acquire() {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= CONFIG.RATE_LIMIT.QUEUE_SIZE) {
        reject(new Error('Rate limit queue full - too many requests'));
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
    if (now - this.windowStart >= CONFIG.RATE_LIMIT.WINDOW_MS) {
      this.requestsThisMinute = 0;
      this.windowStart = now;
      logger.debug('Rate limit window reset');
    }

    // Check if we're at the limit
    if (this.requestsThisMinute >= CONFIG.RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = CONFIG.RATE_LIMIT.WINDOW_MS - (now - this.windowStart);
      logger.warn(`Rate limit hit, waiting ${waitTime}ms until next window`);
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

  getStatus() {
    return {
      queueLength: this.queue.length,
      requestsThisMinute: this.requestsThisMinute,
      windowStart: this.windowStart,
      windowProgress: (Date.now() - this.windowStart) / CONFIG.RATE_LIMIT.WINDOW_MS
    };
  }
}

/**
 * Cache mémoire avec TTL
 */
class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
  }

  get(key, ttlMs) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp) return null;
    
    if (Date.now() - timestamp > ttlMs) {
      this.delete(key);
      return null;
    }
    
    return this.cache.get(key);
  }

  set(key, value) {
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
  }

  delete(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }

  generateKey(endpoint, params) {
    return `${endpoint}:${JSON.stringify(params)}`;
  }
}

class BinanceService extends EventEmitter {
  constructor() {
    super();
    this.apiKey = process.env.BINANCE_API_KEY;
    this.apiSecret = process.env.BINANCE_SECRET;
    this.testnet = process.env.BINANCE_TESTNET === 'true';
    
    // Rate limiting
    this.rateLimiter = new RateLimiter();
    
    // Cache
    this.cache = new MemoryCache();
    
    // WebSocket connections
    this.wsConnections = new Map();
    this.priceCache = new Map();
    
    // Circuit breaker
    this.circuitBreaker = {
      failures: 0,
      lastFailure: 0,
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      threshold: 5,
      timeout: 60000
    };
    
    // Demo mode - seulement si pas de clés dans env ET pas de possibilité de clés dynamiques
    this.demoMode = false;
    
    if (this.apiKey && this.apiSecret) {
      logger.info('Binance Service initialized with API credentials from environment');
    } else {
      logger.info('Binance Service initialized - API keys will be provided dynamically');
    }
  }

  // === AUTHENTIFICATION ===
  
  generateSignature(queryString) {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  getHeaders(isSigned = false) {
    const headers = { ...CONFIG.HEADERS };
    
    if (this.apiKey && isSigned) {
      headers['X-MBX-APIKEY'] = this.apiKey;
    }
    
    return headers;
  }

  // === CIRCUIT BREAKER ===
  
  checkCircuitBreaker() {
    if (this.circuitBreaker.state === 'OPEN') {
      if (Date.now() - this.circuitBreaker.lastFailure > this.circuitBreaker.timeout) {
        this.circuitBreaker.state = 'HALF_OPEN';
        logger.info('Circuit breaker moved to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker OPEN - too many failures, please wait');
      }
    }
  }

  recordSuccess() {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failures = 0;
      logger.info('Circuit breaker CLOSED - service recovered');
    }
  }

  recordFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = 'OPEN';
      logger.error('Circuit breaker OPEN - service temporarily unavailable');
    }
  }

  // === RETRY LOGIC ===
  
  async withRetry(operation, context = '') {
    for (let attempt = 1; attempt <= CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
      try {
        logger.debug(`Attempt ${attempt}/${CONFIG.RETRY.MAX_ATTEMPTS} ${context}`);
        const result = await operation();
        this.recordSuccess();
        return result;
      } catch (error) {
        const isRetryable = this.isRetryableError(error);
        
        if (!isRetryable || attempt === CONFIG.RETRY.MAX_ATTEMPTS) {
          this.recordFailure();
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
          error: error.message,
          status: error.response?.status
        });
        
        await this.sleep(delay);
      }
    }
  }

  isRetryableError(error) {
    if (!error.response) return true; // Network errors are retryable
    const status = error.response.status;
    return status === 429 || status >= 500 || status === 408 || status === 403;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // === API CALLS ===
  
  async makeRequest(method, endpoint, params = {}, isSigned = false, isFutures = false, useCache = false, cacheTtl = 5000) {
    // Check circuit breaker
    this.checkCircuitBreaker();
    
    // Check cache for GET requests
    if (useCache && method === 'GET') {
      const cacheKey = this.cache.generateKey(endpoint, params);
      const cached = this.cache.get(cacheKey, cacheTtl);
      if (cached) {
        logger.debug(`Cache hit for ${endpoint}`);
        return cached;
      }
    }
    
    // Acquire rate limit
    await this.rateLimiter.acquire();

    const baseUrl = isFutures ? CONFIG.BASE_URLS.FUTURES : CONFIG.BASE_URLS.SPOT;
    let url = `${baseUrl}${endpoint}`;
    let body = null;
    
    if (isSigned) {
      params.timestamp = Date.now();
      params.recvWindow = 60000; // 60 secondes
      const queryString = new URLSearchParams(params).toString();
      params.signature = this.generateSignature(queryString);
    }
    
    if (method === 'GET') {
      const queryString = new URLSearchParams(params).toString();
      if (queryString) url += `?${queryString}`;
    } else {
      body = JSON.stringify(params);
    }

    const operation = async () => {
      const response = await axios({
        method,
        url,
        headers: this.getHeaders(isSigned),
        data: body,
        timeout: CONFIG.TIMEOUT.API
      });
      return response.data;
    };

    const result = await this.withRetry(operation, `${method} ${endpoint}`);
    
    // Store in cache
    if (useCache && method === 'GET') {
      const cacheKey = this.cache.generateKey(endpoint, params);
      this.cache.set(cacheKey, result);
    }
    
    return result;
  }

  handleError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      // Log spécifique pour 403
      if (status === 403) {
        logger.error(`Binance API 403 Forbidden - Check API keys or IP restrictions`, {
          code: data?.code,
          msg: data?.msg
        });
      }
      
      return new Error(`Binance API Error ${status}: ${data?.msg || JSON.stringify(data)}`);
    }
    return error;
  }

  // === MARKET DATA ===

  async getKlines(symbol, interval = '1h', limit = 100) {
    const cacheKey = this.cache.generateKey('/api/v3/klines', { symbol, interval, limit });
    const cached = this.cache.get(cacheKey, CONFIG.CACHE.KLINES_TTL_MS);
    if (cached) return cached;

    const data = await this.makeRequest('GET', '/api/v3/klines', {
      symbol: symbol.toUpperCase(),
      interval,
      limit
    });
    
    const result = data.map(candle => ({
      openTime: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
      closeTime: candle[6],
      quoteVolume: parseFloat(candle[7]),
      trades: candle[8],
      takerBuyBaseVolume: parseFloat(candle[9]),
      takerBuyQuoteVolume: parseFloat(candle[10])
    }));
    
    this.cache.set(cacheKey, result);
    return result;
  }

  async get24hTicker(symbol) {
    const params = symbol ? { symbol: symbol.toUpperCase() } : {};
    const cacheKey = this.cache.generateKey('/api/v3/ticker/24hr', params);
    const cached = this.cache.get(cacheKey, CONFIG.CACHE.TICKER_TTL_MS);
    if (cached) return cached;

    const data = await this.makeRequest('GET', '/api/v3/ticker/24hr', params);
    
    let result;
    if (Array.isArray(data)) {
      result = data.map(ticker => this.formatTicker(ticker));
    } else {
      result = this.formatTicker(data);
    }
    
    this.cache.set(cacheKey, result);
    return result;
  }

  formatTicker(ticker) {
    return {
      symbol: ticker.symbol,
      priceChange: parseFloat(ticker.priceChange),
      priceChangePercent: parseFloat(ticker.priceChangePercent),
      weightedAvgPrice: parseFloat(ticker.weightedAvgPrice),
      lastPrice: parseFloat(ticker.lastPrice),
      lastQty: parseFloat(ticker.lastQty),
      openPrice: parseFloat(ticker.openPrice),
      highPrice: parseFloat(ticker.highPrice),
      lowPrice: parseFloat(ticker.lowPrice),
      volume: parseFloat(ticker.volume),
      quoteVolume: parseFloat(ticker.quoteVolume),
      openTime: ticker.openTime,
      closeTime: ticker.closeTime,
      firstId: ticker.firstId,
      lastId: ticker.lastId,
      count: ticker.count
    };
  }

  async getPrice(symbol) {
    const cacheKey = this.cache.generateKey('/api/v3/ticker/price', { symbol });
    const cached = this.cache.get(cacheKey, CONFIG.CACHE.PRICE_TTL_MS);
    if (cached) return cached;

    const data = await this.makeRequest('GET', '/api/v3/ticker/price', {
      symbol: symbol.toUpperCase()
    });
    
    const price = parseFloat(data.price);
    this.cache.set(cacheKey, price);
    return price;
  }

  async getOrderBook(symbol, limit = 100) {
    return await this.makeRequest('GET', '/api/v3/depth', {
      symbol: symbol.toUpperCase(),
      limit
    });
  }

  async getRecentTrades(symbol, limit = 100) {
    const data = await this.makeRequest('GET', '/api/v3/trades', {
      symbol: symbol.toUpperCase(),
      limit
    });
    
    return data.map(trade => ({
      id: trade.id,
      price: parseFloat(trade.price),
      qty: parseFloat(trade.qty),
      quoteQty: parseFloat(trade.quoteQty),
      time: trade.time,
      isBuyerMaker: trade.isBuyerMaker,
      isBestMatch: trade.isBestMatch
    }));
  }

  // === ACCOUNT ===

  async getAccountBalances(apiKeys = null) {
    const keys = apiKeys || { apiKey: this.apiKey, secretKey: this.apiSecret };
    if (!keys.apiKey || !keys.secretKey) {
      return this.getDemoBalances();
    }
    
    const cacheKey = '/api/v3/account:balances';
    const cached = this.cache.get(cacheKey, CONFIG.CACHE.ACCOUNT_TTL_MS);
    if (cached) return cached;

    const data = await this.makeRequest('GET', '/api/v3/account', {}, true);
    
    const result = data.balances
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(balance => ({
        asset: balance.asset,
        free: parseFloat(balance.free),
        locked: parseFloat(balance.locked),
        total: parseFloat(balance.free) + parseFloat(balance.locked)
      }));
    
    this.cache.set(cacheKey, result);
    return result;
  }

  async getAccountInfo() {
    return await this.makeRequest('GET', '/api/v3/account', {}, true);
  }

  // === SPOT TRADING ===

  async placeOrder(symbol, side, type, quantity, options = {}) {
    const params = {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      type: type.toUpperCase(),
      quantity: quantity.toString(),
      ...options
    };

    // Ajouter prix pour les ordres limit
    if (options.price) {
      params.price = options.price.toString();
    }

    // Time in force pour les ordres limit
    if (options.timeInForce) {
      params.timeInForce = options.timeInForce;
    }

    // Stop loss / Take profit
    if (options.stopPrice) {
      params.stopPrice = options.stopPrice.toString();
    }

    const data = await this.makeRequest('POST', '/api/v3/order', params, true);
    
    return this.formatOrder(data);
  }

  async placeMarketOrder(symbol, side, quantity) {
    return await this.placeOrder(symbol, side, 'MARKET', quantity);
  }

  async placeLimitOrder(symbol, side, quantity, price, timeInForce = 'GTC') {
    return await this.placeOrder(symbol, side, 'LIMIT', quantity, {
      price,
      timeInForce
    });
  }

  async placeStopLossOrder(symbol, side, quantity, stopPrice) {
    return await this.placeOrder(symbol, side, 'STOP_LOSS', quantity, {
      stopPrice
    });
  }

  async placeTakeProfitOrder(symbol, side, quantity, stopPrice) {
    return await this.placeOrder(symbol, side, 'TAKE_PROFIT', quantity, {
      stopPrice
    });
  }

  async cancelOrder(symbol, orderId) {
    return await this.makeRequest('DELETE', '/api/v3/order', {
      symbol: symbol.toUpperCase(),
      orderId
    }, true);
  }

  async getOrderStatus(symbol, orderId) {
    const data = await this.makeRequest('GET', '/api/v3/order', {
      symbol: symbol.toUpperCase(),
      orderId
    }, true);
    
    return this.formatOrder(data);
  }

  async getOpenOrders(symbol = null) {
    const params = {};
    if (symbol) params.symbol = symbol.toUpperCase();
    
    const data = await this.makeRequest('GET', '/api/v3/openOrders', params, true);
    return data.map(order => this.formatOrder(order));
  }

  async getOrderHistory(symbol, limit = 500) {
    const data = await this.makeRequest('GET', '/api/v3/allOrders', {
      symbol: symbol.toUpperCase(),
      limit
    }, true);
    
    return data.map(order => this.formatOrder(order));
  }

  async getMyTrades(symbol, limit = 500) {
    const data = await this.makeRequest('GET', '/api/v3/myTrades', {
      symbol: symbol.toUpperCase(),
      limit
    }, true);
    
    return data.map(trade => ({
      id: trade.id,
      orderId: trade.orderId,
      price: parseFloat(trade.price),
      qty: parseFloat(trade.qty),
      quoteQty: parseFloat(trade.quoteQty),
      commission: parseFloat(trade.commission),
      commissionAsset: trade.commissionAsset,
      time: trade.time,
      isBuyer: trade.isBuyer,
      isMaker: trade.isMaker,
      isBestMatch: trade.isBestMatch
    }));
  }

  formatOrder(order) {
    return {
      orderId: order.orderId,
      symbol: order.symbol,
      status: order.status,
      side: order.side,
      type: order.type,
      price: parseFloat(order.price),
      origQty: parseFloat(order.origQty),
      executedQty: parseFloat(order.executedQty),
      cummulativeQuoteQty: parseFloat(order.cummulativeQuoteQty || 0),
      stopPrice: parseFloat(order.stopPrice || 0),
      timeInForce: order.timeInForce,
      time: order.time || order.transactTime,
      updateTime: order.updateTime,
      isWorking: order.isWorking
    };
  }

  // === FUTURES TRADING ===

  async getFuturesAccountInfo() {
    return await this.makeRequest('GET', '/fapi/v2/account', {}, true, true);
  }

  async getFuturesBalance() {
    const data = await this.makeRequest('GET', '/fapi/v2/balance', {}, true, true);
    return data.map(balance => ({
      asset: balance.asset,
      balance: parseFloat(balance.balance),
      availableBalance: parseFloat(balance.availableBalance),
      crossUnPnl: parseFloat(balance.crossUnPnl),
      crossWalletBalance: parseFloat(balance.crossWalletBalance),
      maxWithdrawAmount: parseFloat(balance.maxWithdrawAmount)
    }));
  }

  async placeFuturesOrder(symbol, side, type, quantity, options = {}) {
    const params = {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      type: type.toUpperCase(),
      quantity: quantity.toString(),
      ...options
    };

    if (options.price) params.price = options.price.toString();
    if (options.stopPrice) params.stopPrice = options.stopPrice.toString();
    if (options.timeInForce) params.timeInForce = options.timeInForce;

    const data = await this.makeRequest('POST', '/fapi/v1/order', params, true, true);
    return this.formatFuturesOrder(data);
  }

  async setLeverage(symbol, leverage) {
    return await this.makeRequest('POST', '/fapi/v1/leverage', {
      symbol: symbol.toUpperCase(),
      leverage
    }, true, true);
  }

  async getPositionRisk(symbol = null) {
    const params = {};
    if (symbol) params.symbol = symbol.toUpperCase();
    
    const data = await this.makeRequest('GET', '/fapi/v2/positionRisk', params, true, true);
    return data.map(pos => ({
      symbol: pos.symbol,
      positionAmt: parseFloat(pos.positionAmt),
      entryPrice: parseFloat(pos.entryPrice),
      markPrice: parseFloat(pos.markPrice),
      unRealizedProfit: parseFloat(pos.unRealizedProfit),
      liquidationPrice: parseFloat(pos.liquidationPrice),
      leverage: parseFloat(pos.leverage),
      marginType: pos.marginType,
      isolatedMargin: parseFloat(pos.isolatedMargin || 0),
      notional: parseFloat(pos.notional || 0)
    }));
  }

  formatFuturesOrder(order) {
    return {
      orderId: order.orderId,
      symbol: order.symbol,
      status: order.status,
      side: order.side,
      type: order.type,
      price: parseFloat(order.price),
      avgPrice: parseFloat(order.avgPrice || 0),
      origQty: parseFloat(order.origQty),
      executedQty: parseFloat(order.executedQty),
      cumQuote: parseFloat(order.cumQuote || 0),
      stopPrice: parseFloat(order.stopPrice || 0),
      timeInForce: order.timeInForce,
      time: order.time,
      updateTime: order.updateTime
    };
  }

  // === WEBSOCKET ===

  connectPriceStream(symbols, callback, isFutures = false) {
    const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
    const wsUrl = isFutures 
      ? `${CONFIG.BASE_URLS.WS_FUTURES}/${streams}`
      : `${CONFIG.BASE_URLS.WS_SPOT}/${streams}`;
    
    const ws = new WebSocket(wsUrl);
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    
    ws.on('open', () => {
      logger.info(`WebSocket connected for ${symbols.join(', ')}`);
      reconnectAttempts = 0;
      
      // Start ping interval
      ws.pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, CONFIG.TIMEOUT.WS_PING);
    });
    
    ws.on('message', (data) => {
      try {
        const ticker = JSON.parse(data);
        const priceData = {
          symbol: ticker.s,
          price: parseFloat(ticker.c),
          change24h: parseFloat(ticker.P),
          volume24h: parseFloat(ticker.v),
          high24h: parseFloat(ticker.h),
          low24h: parseFloat(ticker.l),
          timestamp: ticker.E
        };
        
        this.priceCache.set(ticker.s, priceData);
        
        if (callback) {
          callback(ticker.s, priceData);
        }
        
        this.emit('price', priceData);
      } catch (error) {
        logger.error('WebSocket message error', { error: error.message });
      }
    });
    
    ws.on('error', (error) => {
      logger.error('WebSocket error', { error: error.message, symbols });
    });
    
    ws.on('close', () => {
      logger.warn(`WebSocket closed for ${symbols.join(', ')}`);
      
      // Clear ping interval
      if (ws.pingInterval) {
        clearInterval(ws.pingInterval);
      }
      
      // Remove from connections
      symbols.forEach(symbol => {
        this.wsConnections.delete(symbol.toUpperCase());
      });
      
      // Reconnect with exponential backoff
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        logger.info(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
        setTimeout(() => this.connectPriceStream(symbols, callback, isFutures), delay);
      } else {
        logger.error(`Max reconnect attempts reached for ${symbols.join(', ')}`);
      }
    });
    
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    // Store connection
    symbols.forEach(symbol => {
      this.wsConnections.set(symbol.toUpperCase(), { ws, callback, isFutures });
    });
    
    return ws;
  }

  disconnectPriceStream(symbol) {
    const connection = this.wsConnections.get(symbol.toUpperCase());
    if (connection) {
      const { ws } = connection;
      if (ws.pingInterval) clearInterval(ws.pingInterval);
      ws.terminate();
      this.wsConnections.delete(symbol.toUpperCase());
      logger.info(`WebSocket disconnected for ${symbol}`);
    }
  }

  disconnectAllStreams() {
    for (const [symbol, connection] of this.wsConnections) {
      const { ws } = connection;
      if (ws.pingInterval) clearInterval(ws.pingInterval);
      ws.terminate();
    }
    this.wsConnections.clear();
    logger.info('All WebSocket connections closed');
  }

  getCachedPrice(symbol) {
    return this.priceCache.get(symbol.toUpperCase());
  }

  subscribeToKlines(symbol, interval, callback, isFutures = false) {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    const wsUrl = isFutures
      ? `${CONFIG.BASE_URLS.WS_FUTURES}/${streamName}`
      : `${CONFIG.BASE_URLS.WS_SPOT}/${streamName}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      logger.info(`Kline WebSocket connected: ${streamName}`);
    });
    
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed && parsed.k) {
          const k = parsed.k;
          const klineData = {
            symbol: parsed.s,
            time: k.t,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
            isClosed: k.x,
            timestamp: parsed.E
          };
          
          if (callback) {
            callback(klineData);
          }
          
          this.emit('kline', klineData);
        }
      } catch (error) {
        logger.error('Kline WebSocket error', { error: error.message });
      }
    });
    
    ws.on('error', (error) => {
      logger.error('Kline WebSocket error', { error: error.message, symbol, interval });
    });
    
    ws.on('close', () => {
      logger.warn(`Kline WebSocket closed: ${streamName}`);
      setTimeout(() => this.subscribeToKlines(symbol, interval, callback, isFutures), 5000);
    });
    
    return ws;
  }

  // === EXCHANGE INFO ===

  async getExchangeInfo() {
    return await this.makeRequest('GET', '/api/v3/exchangeInfo');
  }

  async getSymbolInfo(symbol) {
    const info = await this.getExchangeInfo();
    return info.symbols.find(s => s.symbol === symbol.toUpperCase());
  }

  // === UTILITAIRES ===

  async testConnectivity() {
    try {
      await this.makeRequest('GET', '/api/v3/ping');
      return { success: true, message: 'Connected to Binance' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getServerTime() {
    const data = await this.makeRequest('GET', '/api/v3/time');
    return data.serverTime;
  }

  // Vérifier si les clés API sont configurées
  hasApiKeys() {
    return !!(this.apiKey && this.apiSecret);
  }

  // === PRODUCTION UTILITIES ===

  getStatus() {
    return {
      demoMode: this.demoMode,
      hasApiKeys: this.hasApiKeys(),
      circuitBreakerState: this.circuitBreaker.state,
      rateLimiter: this.rateLimiter.getStatus(),
      activeWebSockets: Array.from(this.wsConnections.keys()),
      cacheSize: this.cache.cache.size
    };
  }

  clearCache() {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  // Batch operations for efficiency
  async getMultiplePrices(symbols) {
    const prices = {};
    for (const symbol of symbols) {
      try {
        prices[symbol] = await this.getPrice(symbol);
      } catch (error) {
        logger.warn(`Failed to get price for ${symbol}`, { error: error.message });
        prices[symbol] = null;
      }
    }
    return prices;
  }

  // Health check for monitoring
  async healthCheck() {
    const checks = {
      api: false,
      websocket: false,
      timestamp: Date.now()
    };

    try {
      await this.testConnectivity();
      checks.api = true;
    } catch (error) {
      logger.error('API health check failed', { error: error.message });
    }

    checks.websocket = this.wsConnections.size > 0;
    checks.circuitBreaker = this.circuitBreaker.state;
    checks.rateLimiter = this.rateLimiter.getStatus();

    return checks;
  }
}

module.exports = new BinanceService();
