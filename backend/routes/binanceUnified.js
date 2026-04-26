/**
 * NEUROVEST - Routes Binance Unifiées
 * Toutes les routes utilisent le service centralisé binanceServiceUnified
 * 
 * Pas d'appels directs à l'API Binance ici - tout passe par le service
 */

const express = require('express');
const router = express.Router();
const binanceService = require('../services/binanceServiceUnified');
const { authenticateToken } = require('../middleware/auth');

/**
 * Middleware pour gérer les erreurs async
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * GET /api/binance/status
 * Status du service Binance
 */
router.get('/status', (req, res) => {
  const status = binanceService.getStatus();
  res.json({
    success: true,
    status,
    message: status.demoMode 
      ? 'Mode démo actif - Configurez vos clés API pour le trading réel'
      : 'Connecté à Binance'
  });
});

/**
 * GET /api/binance/price/:symbol
 * Prix actuel d'un symbole
 */
router.get('/price/:symbol', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  
  try {
    const price = await binanceService.getPrice(symbol);
    
    res.json({
      success: true,
      symbol: price.symbol,
      price: price.price,
      timestamp: price.timestamp
    });
  } catch (error) {
    console.error(`Price fetch failed for ${symbol}:`, error.message);
    res.status(503).json({
      success: false,
      error: 'Service Binance temporairement indisponible',
      message: error.message
    });
  }
}));

/**
 * GET /api/binance/ticker/24hr
 * Ticker 24h (tous les symboles ou un seul)
 */
router.get('/ticker/24hr', asyncHandler(async (req, res) => {
  const { symbol } = req.query;
  
  try {
    const ticker = await binanceService.get24hTicker(symbol);
    
    res.json({
      success: true,
      data: ticker,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error(`Ticker fetch failed:`, error.message);
    res.status(503).json({
      success: false,
      error: 'Service Binance temporairement indisponible',
      message: error.message
    });
  }
}));

/**
 * GET /api/binance/klines
 * Données de bougies (OHLCV)
 */
router.get('/klines', asyncHandler(async (req, res) => {
  const { symbol, interval = '1h', limit = 100 } = req.query;
  
  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol parameter required'
    });
  }
  
  try {
    const klines = await binanceService.getKlines(symbol, interval, parseInt(limit));
    
    res.json({
      success: true,
      symbol,
      interval,
      data: klines,
      count: klines.length
    });
  } catch (error) {
    console.error(`Klines fetch failed for ${symbol}:`, error.message);
    res.status(503).json({
      success: false,
      error: 'Service Binance temporairement indisponible',
      message: error.message
    });
  }
}));

/**
 * GET /api/binance/depth
 * Order book (livre d'ordres)
 */
router.get('/depth', asyncHandler(async (req, res) => {
  const { symbol, limit = 100 } = req.query;
  
  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol parameter required'
    });
  }
  
  const depth = await binanceService.getOrderBook(symbol, parseInt(limit));
  
  res.json({
    success: true,
    symbol,
    lastUpdateId: depth.lastUpdateId,
    bids: depth.bids.slice(0, 10), // Top 10 only
    asks: depth.asks.slice(0, 10)
  });
}));

/**
 * GET /api/binance/account
 * Informations du compte (nécessite authentification)
 */
router.get('/account', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const account = await binanceService.getAccountInfo();
    
    res.json({
      success: true,
      demoMode: false,
      balances: account.balances,
      commissions: {
        maker: account.makerCommission,
        taker: account.takerCommission
      },
      permissions: {
        canTrade: account.canTrade,
        canWithdraw: account.canWithdraw,
        canDeposit: account.canDeposit
      }
    });
  } catch (error) {
    // Si pas de clés API configurées
    if (error.message.includes('DEMO_MODE')) {
      return res.json({
        success: true,
        demoMode: true,
        balances: [],
        message: 'Mode démo: Configurez vos clés API Binance dans les paramètres'
      });
    }
    throw error;
  }
}));

/**
 * 🔥 POST /api/binance/account
 * Informations du compte avec clés API depuis le body (frontend sécurisé)
 */
router.post('/account', authenticateToken, asyncHandler(async (req, res) => {
  try {
    // Récupérer les clés depuis le body ou depuis l'utilisateur authentifié
    let apiKey = req.body.apiKey;
    let secretKey = req.body.secretKey;
    
    // Si pas de clés dans le body, utiliser celles de l'utilisateur
    if (!apiKey && !secretKey && req.user.encryptedApiKeys?.binanceApiKey && req.user.encryptedApiKeys?.binanceSecretKey) {
      apiKey = req.user.encryptedApiKeys.binanceApiKey;
      secretKey = req.user.encryptedApiKeys.binanceSecretKey;
      console.log('[POST /account] Using API keys from user profile');
    }
    
    if (apiKey && secretKey) {
      // Utiliser les clés fournies
      console.log('[POST /account] Calling Binance with API keys');
      const axios = require('axios');
      const crypto = require('crypto');
      
      const timestamp = Date.now();
      const recvWindow = 60000;
      const queryString = `timestamp=${timestamp}&recvWindow=${recvWindow}`;
      
      // Générer la signature
      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(queryString)
        .digest('hex');
      
      const BINANCE_API_URL = 'https://api.binance.com';
      
      const response = await axios.get(
        `${BINANCE_API_URL}/api/v3/account?${queryString}&signature=${signature}`,
        {
          headers: {
            'X-MBX-APIKEY': apiKey,
          },
          timeout: 10000,
        }
      );
      
      const balances = response.data.balances.filter(
        b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
      );
      
      return res.json({
        success: true,
        demoMode: false,
        balances,
        totalAssetOfBtc: response.data.totalAssetOfBtc,
        commissions: {
          maker: response.data.makerCommission,
          taker: response.data.takerCommission
        },
        permissions: {
          canTrade: response.data.canTrade,
          canWithdraw: response.data.canWithdraw,
          canDeposit: response.data.canDeposit
        }
      });
    }
    
    // Fallback: utiliser le service par défaut (mode démo)
    console.log('[POST /account] No API keys available, using demo mode');
    const account = await binanceService.getAccountInfo();
    
    res.json({
      success: true,
      demoMode: false,
      balances: account.balances,
      commissions: {
        maker: account.makerCommission,
        taker: account.takerCommission
      },
      permissions: {
        canTrade: account.canTrade,
        canWithdraw: account.canWithdraw,
        canDeposit: account.canDeposit
      }
    });
  } catch (error) {
    console.error('[POST /account] Error:', error.response?.data || error.message);
    
    if (error.response?.data?.code === -2015) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        message: 'Vos clés API Binance sont invalides ou ont des permissions incorrectes.'
      });
    }
    
    res.status(400).json({
      success: false,
      error: 'Failed to fetch account',
      message: error.response?.data?.msg || error.message
    });
  }
}));

/**
 * GET /api/binance/balances
 * Soldes du compte (nécessite authentification)
 * Utilise les clés API de l'utilisateur si disponibles
 */
router.get('/balances', authenticateToken, asyncHandler(async (req, res) => {
  try {
    let balances;
    
    // Si l'utilisateur a des clés API configurées, les utiliser
    if (req.user.encryptedApiKeys?.binanceApiKey && req.user.encryptedApiKeys?.binanceSecretKey) {
      console.log('[GET /balances] Using user API keys');
      const axios = require('axios');
      const crypto = require('crypto');
      
      const timestamp = Date.now();
      const recvWindow = 60000;
      const queryString = `timestamp=${timestamp}&recvWindow=${recvWindow}`;
      
      const signature = crypto
        .createHmac('sha256', req.user.encryptedApiKeys.binanceSecretKey)
        .update(queryString)
        .digest('hex');
      
      const response = await axios.get(
        `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
        {
          headers: { 'X-MBX-APIKEY': req.user.encryptedApiKeys.binanceApiKey },
          timeout: 10000,
        }
      );
      
      balances = response.data.balances.filter(
        b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
      );
      
      return res.json({
        success: true,
        demoMode: false,
        balances,
        timestamp: Date.now()
      });
    }
    
    // Sinon, utiliser le service par défaut (mode démo)
    balances = await binanceService.getBalances();
    
    res.json({
      success: true,
      demoMode: false,
      balances,
      timestamp: Date.now()
    });
  } catch (error) {
    if (error.message.includes('DEMO_MODE') || error.response?.status === 401) {
      return res.json({
        success: true,
        demoMode: true,
        balances: [],
        message: 'Mode démo: Aucune balance disponible sans clés API'
      });
    }
    throw error;
  }
}));

/**
 * 🔥 POST /api/binance/order
 * Placer un ordre (nécessite authentification)
 * Accepte les clés API depuis le body ou depuis le profil utilisateur
 */
router.post('/order', authenticateToken, asyncHandler(async (req, res) => {
  const { symbol, side, type, quantity, price, stopPrice, timeInForce, apiKey, secretKey } = req.body;
  
  // Validation
  if (!symbol || !side || !type || !quantity) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: symbol, side, type, quantity'
    });
  }
  
  // Récupérer les clés API (du body ou du profil utilisateur)
  let userApiKey = apiKey;
  let userSecretKey = secretKey;
  
  // Si pas de clés dans le body, utiliser celles du profil
  if (!userApiKey && !userSecretKey && req.user.encryptedApiKeys?.binanceApiKey && req.user.encryptedApiKeys?.binanceSecretKey) {
    userApiKey = req.user.encryptedApiKeys.binanceApiKey;
    userSecretKey = req.user.encryptedApiKeys.binanceSecretKey;
    console.log('[POST /order] Using API keys from user profile');
  }
  
  // 🔥 Si clés API disponibles, appeler Binance directement
  if (userApiKey && userSecretKey) {
    console.log('[POST /order] Calling Binance with API keys');
    const axios = require('axios');
    const crypto = require('crypto');
    
    const timestamp = Date.now();
    const recvWindow = 60000;
    const BINANCE_API_URL = 'https://api.binance.com';
    
    let queryString = `symbol=${symbol.toUpperCase()}&side=${side.toUpperCase()}&type=${type.toUpperCase()}&quantity=${quantity}&timestamp=${timestamp}&recvWindow=${recvWindow}`;
    
    if (price && type.toUpperCase() === 'LIMIT') {
      queryString += `&price=${price}&timeInForce=${timeInForce || 'GTC'}`;
    }
    
    const signature = crypto
      .createHmac('sha256', userSecretKey)
      .update(queryString)
      .digest('hex');
    
    try {
      const response = await axios.post(
        `${BINANCE_API_URL}/api/v3/order?${queryString}&signature=${signature}`,
        {},
        {
          headers: {
            'X-MBX-APIKEY': userApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000,
        }
      );
      
      return res.json({
        success: true,
        demoMode: false,
        order: {
          id: response.data.orderId?.toString(),
          orderId: response.data.orderId,
          symbol: response.data.symbol,
          side: response.data.side,
          type: response.data.type,
          price: response.data.price || response.data.fills?.[0]?.price,
          quantity: response.data.origQty,
          executedQty: response.data.executedQty,
          status: response.data.status,
          transactTime: response.data.transactTime,
          fills: response.data.fills
        },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[POST /order] Binance error:', error.response?.data || error.message);
      return res.status(400).json({
        success: false,
        error: error.response?.data?.msg || error.message,
        code: error.response?.data?.code
      });
    }
  }
  
  // Sinon, utiliser le service par défaut (mode démo)
  console.log('[POST /order] No API keys, using demo mode');
  const order = await binanceService.placeOrder({
    symbol,
    side,
    type,
    quantity,
    price,
    stopPrice,
    timeInForce
  });
  
  res.json({
    success: true,
    demoMode: order.demo || false,
    order: {
      id: order.orderId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      price: order.price,
      quantity: order.quantity,
      status: order.status,
      executedQty: order.executedQty
    },
    timestamp: order.timestamp
  });
}));

/**
 * POST /api/binance/order/market
 * Placer un ordre au marché
 */
router.post('/order/market', authenticateToken, asyncHandler(async (req, res) => {
  const { symbol, side, quantity } = req.body;
  
  if (!symbol || !side || !quantity) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: symbol, side, quantity'
    });
  }
  
  const order = await binanceService.placeMarketOrder(symbol, side, quantity);
  
  res.json({
    success: true,
    demoMode: order.demo || false,
    order: {
      id: order.orderId,
      symbol: order.symbol,
      side: order.side,
      type: 'MARKET',
      price: order.price,
      quantity: order.quantity,
      status: order.status
    }
  });
}));

/**
 * POST /api/binance/order/limit
 * Placer un ordre limit
 */
router.post('/order/limit', authenticateToken, asyncHandler(async (req, res) => {
  const { symbol, side, quantity, price, timeInForce = 'GTC' } = req.body;
  
  if (!symbol || !side || !quantity || !price) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: symbol, side, quantity, price'
    });
  }
  
  const order = await binanceService.placeLimitOrder(symbol, side, quantity, price, timeInForce);
  
  res.json({
    success: true,
    demoMode: order.demo || false,
    order: {
      id: order.orderId,
      symbol: order.symbol,
      side: order.side,
      type: 'LIMIT',
      price: order.price,
      quantity: order.quantity,
      status: order.status
    }
  });
}));

/**
 * DELETE /api/binance/order
 * Annuler un ordre
 */
router.delete('/order', authenticateToken, asyncHandler(async (req, res) => {
  const { symbol, orderId } = req.body;
  
  if (!symbol || !orderId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: symbol, orderId'
    });
  }
  
  const result = await binanceService.cancelOrder(symbol, orderId);
  
  res.json({
    success: true,
    demoMode: result.demo || false,
    cancelled: {
      orderId: result.orderId,
      symbol: result.symbol,
      status: result.status
    }
  });
}));

/**
 * 🔥 POST /api/binance/futures/order
 * Placer un ordre Futures (nécessite authentification)
 * Accepte les clés API depuis le body pour trading réel
 */
router.post('/futures/order', authenticateToken, asyncHandler(async (req, res) => {
  const { symbol, side, type, quantity, price, leverage, stopLoss, takeProfit, apiKey, secretKey } = req.body;
  
  // Validation
  if (!symbol || !side || !type || !quantity) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: symbol, side, type, quantity'
    });
  }
  
  // 🔥 Si clés API fournies dans le body, appeler Binance Futures directement
  if (apiKey && secretKey) {
    console.log('[POST /futures/order] Using API keys from request body');
    const axios = require('axios');
    const crypto = require('crypto');
    
    const timestamp = Date.now();
    const recvWindow = 60000;
    const BINANCE_FUTURES_URL = 'https://fapi.binance.com';
    
    // Configurer le levier d'abord si spécifié
    if (leverage && leverage > 1) {
      try {
        const leverageQuery = `symbol=${symbol.toUpperCase()}&leverage=${leverage}&timestamp=${timestamp}&recvWindow=${recvWindow}`;
        const leverageSig = crypto.createHmac('sha256', secretKey).update(leverageQuery).digest('hex');
        
        await axios.post(
          `${BINANCE_FUTURES_URL}/fapi/v1/leverage?${leverageQuery}&signature=${leverageSig}`,
          {},
          { headers: { 'X-MBX-APIKEY': apiKey }, timeout: 5000 }
        );
        console.log(`[Futures] Leverage set to ${leverage}x for ${symbol}`);
      } catch (levError) {
        console.warn('[Futures] Failed to set leverage:', levError.message);
      }
    }
    
    let queryString = `symbol=${symbol.toUpperCase()}&side=${side.toUpperCase()}&type=${type.toUpperCase()}&quantity=${quantity}&timestamp=${timestamp}&recvWindow=${recvWindow}`;
    
    if (price && type.toUpperCase() === 'LIMIT') {
      queryString += `&price=${price}&timeInForce=GTC`;
    }
    
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(queryString)
      .digest('hex');
    
    try {
      const response = await axios.post(
        `${BINANCE_FUTURES_URL}/fapi/v1/order?${queryString}&signature=${signature}`,
        {},
        {
          headers: {
            'X-MBX-APIKEY': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000,
        }
      );
      
      return res.json({
        success: true,
        demoMode: false,
        order: {
          id: response.data.orderId?.toString(),
          orderId: response.data.orderId,
          symbol: response.data.symbol,
          side: response.data.side,
          type: response.data.type,
          price: response.data.price || response.data.avgPrice,
          quantity: response.data.origQty,
          executedQty: response.data.executedQty,
          status: response.data.status,
          transactTime: response.data.updateTime || response.data.transactTime
        },
        leverage: leverage || 1,
        stopLoss,
        takeProfit,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[POST /futures/order] Binance error:', error.response?.data || error.message);
      return res.status(400).json({
        success: false,
        error: error.response?.data?.msg || error.message,
        code: error.response?.data?.code
      });
    }
  }
  
  // Sinon, retourner une erreur (pas de service par défaut pour futures)
  return res.status(400).json({
    success: false,
    error: 'API keys required for futures trading',
    message: 'Veuillez configurer vos clés API Binance Futures dans les paramètres'
  });
}));

/**
 * GET /api/binance/orders/open
 * Ordres ouverts
 */
router.get('/orders/open', authenticateToken, asyncHandler(async (req, res) => {
  const { symbol } = req.query;
  const orders = await binanceService.getOpenOrders(symbol);
  
  res.json({
    success: true,
    demoMode: binanceService.isDemoMode(),
    orders,
    count: orders.length
  });
}));

/**
 * GET /api/binance/orders/history
 * Historique des ordres
 */
router.get('/orders/history', authenticateToken, asyncHandler(async (req, res) => {
  const { symbol, limit = 100 } = req.query;
  
  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol parameter required'
    });
  }
  
  const orders = await binanceService.getOrderHistory(symbol, parseInt(limit));
  
  res.json({
    success: true,
    demoMode: binanceService.isDemoMode(),
    symbol,
    orders,
    count: orders.length
  });
}));

/**
 * WebSocket subscription endpoints
 * Pour démarrer des streams temps réel
 */

// Map pour stocker les callbacks actifs
const activeSubscriptions = new Map();

/**
 * POST /api/binance/ws/subscribe/price
 * Souscription aux prix en temps réel via Socket.IO
 */
router.post('/ws/subscribe/price', authenticateToken, (req, res) => {
  const { symbol } = req.body;
  const io = req.app.get('io');
  
  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol parameter required'
    });
  }
  
  const streamKey = `price_${symbol.toLowerCase()}`;
  
  // Unsubscribe existing if any
  if (activeSubscriptions.has(streamKey)) {
    binanceService.unsubscribe(activeSubscriptions.get(streamKey));
    activeSubscriptions.delete(streamKey);
  }
  
  // Subscribe to Binance WebSocket
  binanceService.subscribeToPrice(symbol, (data) => {
    // Broadcast to all connected clients via Socket.IO
    io.emit(`price-${symbol.toLowerCase()}`, data);
  });
  
  activeSubscriptions.set(streamKey, `${symbol.toLowerCase()}@ticker`);
  
  res.json({
    success: true,
    subscribed: symbol,
    stream: streamKey
  });
});

/**
 * POST /api/binance/ws/subscribe/klines
 * Souscription aux bougies en temps réel
 */
router.post('/ws/subscribe/klines', authenticateToken, (req, res) => {
  const { symbol, interval = '1m' } = req.body;
  const io = req.app.get('io');
  
  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol parameter required'
    });
  }
  
  const streamKey = `kline_${symbol.toLowerCase()}_${interval}`;
  
  if (activeSubscriptions.has(streamKey)) {
    binanceService.unsubscribe(activeSubscriptions.get(streamKey));
    activeSubscriptions.delete(streamKey);
  }
  
  binanceService.subscribeToKlines(symbol, interval, (data) => {
    io.emit(`kline-${symbol.toLowerCase()}-${interval}`, data);
  });
  
  activeSubscriptions.set(streamKey, `${symbol.toLowerCase()}@kline_${interval}`);
  
  res.json({
    success: true,
    subscribed: symbol,
    interval,
    stream: streamKey
  });
});

/**
 * POST /api/binance/keys
 * Sauvegarder les clés API Binance pour l'utilisateur (chiffrées)
 */
router.post('/keys', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { apiKey, secretKey } = req.body;
    const User = require('../models/User');
    const securityService = require('../services/securityService');
    
    if (!apiKey || !secretKey) {
      return res.status(400).json({
        success: false,
        error: 'Clés API requises'
      });
    }
    
    // Chiffrer les clés API
    const encryptedApiKey = securityService.encrypt(apiKey);
    const encryptedSecretKey = securityService.encrypt(secretKey);
    
    if (!encryptedApiKey || !encryptedSecretKey) {
      return res.status(500).json({
        success: false,
        error: 'Erreur lors du chiffrement des clés'
      });
    }
    
    // Sauvegarder dans la base de données
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }
    
    user.encryptedApiKeys = {
      binanceApiKey: encryptedApiKey,
      binanceSecretKey: encryptedSecretKey,
      lastRotatedAt: new Date()
    };
    
    await user.save();
    
    console.log(`[POST /keys] Clés API sauvegardées pour ${user.username}`);
    
    res.json({
      success: true,
      message: 'Clés API Binance sauvegardées avec succès'
    });
  } catch (error) {
    console.error('[POST /keys] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la sauvegarde des clés'
    });
  }
}));

/**
 * Error handler
 */
router.use((err, req, res, next) => {
  console.error('Binance route error:', err);
  
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
    code: err.response?.status || 500
  });
});

module.exports = router;
