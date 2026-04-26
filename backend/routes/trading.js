/**
 * NEUROVEST - Routes Trading API
 * Endpoints sécurisés pour le trading Spot et Futures
 * 
 * Toutes les clés API restent côté backend - jamais exposées au client
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const tradingService = require('../services/tradingService');
const binanceService = require('../services/binanceServiceUnified');

/**
 * Middleware pour gérer les erreurs async
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * GET /api/trading/status
 * Status du service de trading
 */
router.get('/status', (req, res) => {
  const binanceStatus = binanceService.getStatus();
  
  res.json({
    success: true,
    binanceConnected: binanceStatus.hasApiKeys,
    demoMode: binanceStatus.demoMode,
    riskConfig: tradingService.CONFIG.RISK,
    message: binanceStatus.demoMode 
      ? 'Mode démo actif - Trading simulé avec prix réels'
      : 'Trading réel actif'
  });
});

/**
 * POST /api/trading/order/spot
 * Placer un ordre Spot (Market ou Limit)
 * 
 * Body: {
 *   symbol: string (ex: BTCUSDT)
 *   side: 'BUY' | 'SELL'
 *   type: 'MARKET' | 'LIMIT'
 *   quantity: number
 *   price?: number (pour LIMIT)
 *   stopLoss?: number (obligatoire)
 *   takeProfit?: number (obligatoire)
 *   timeInForce?: 'GTC' | 'IOC' | 'FOK'
 *   isDemo?: boolean
 * }
 */
router.post('/order/spot', optionalAuth, asyncHandler(async (req, res) => {
  const { 
    symbol, 
    side, 
    type, 
    quantity, 
    price, 
    stopLoss, 
    takeProfit,
    timeInForce = 'GTC',
    isDemo = false 
  } = req.body;

  // Validation
  if (!symbol || !side || !type || !quantity) {
    return res.status(400).json({
      success: false,
      error: 'Champs requis manquants: symbol, side, type, quantity'
    });
  }

  // SL/TP obligatoires
  if (!stopLoss || !takeProfit) {
    return res.status(400).json({
      success: false,
      error: 'Stop Loss et Take Profit sont obligatoires',
      required: true
    });
  }

  try {
    // Récupérer les clés API de l'utilisateur depuis encryptedApiKeys
    const userApiKeys = req.user?.encryptedApiKeys?.binanceApiKey && req.user?.encryptedApiKeys?.binanceSecretKey ? {
      apiKey: req.user.encryptedApiKeys.binanceApiKey,
      apiSecret: req.user.encryptedApiKeys.binanceSecretKey
    } : null;
    
    const result = await tradingService.safeExecuteTrade({
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      type: type.toUpperCase(),
      quantity: parseFloat(quantity),
      price: price ? parseFloat(price) : undefined,
      stopLoss: parseFloat(stopLoss),
      takeProfit: parseFloat(takeProfit),
      timeInForce,
      apiKeys: userApiKeys
    }, isDemo);

    res.json({
      success: true,
      demoMode: result.demo,
      order: {
        id: result.orderId,
        symbol: result.symbol,
        side: result.side,
        type: result.type,
        quantity: result.quantity,
        price: result.price,
        stopLoss: result.stopLoss,
        takeProfit: result.takeProfit,
        fees: result.fees,
        timestamp: result.timestamp
      },
      risk: result.riskValidation,
      message: isDemo 
        ? 'Ordre démo exécuté avec succès'
        : 'Ordre réel exécuté sur Binance'
    });

  } catch (error) {
    const statusCode = error.code === 'INSUFFICIENT_BALANCE' ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.error || error.message || 'Échec de l\'exécution',
      code: error.code,
      timestamp: Date.now()
    });
  }
}));

/**
 * POST /api/trading/order/futures
 * Placer un ordre Futures (Long/Short avec levier)
 * 
 * Body: {
 *   symbol: string
 *   side: 'BUY' | 'SELL' (BUY=Long, SELL=Short)
 *   type: 'MARKET' | 'LIMIT'
 *   quantity: number
 *   price?: number
 *   leverage: number (1-125)
 *   stopLoss?: number (obligatoire)
 *   takeProfit?: number (obligatoire)
 *   isDemo?: boolean
 * }
 */
router.post('/order/futures', optionalAuth, asyncHandler(async (req, res) => {
  const { 
    symbol, 
    side, 
    type, 
    quantity, 
    price, 
    leverage = 1,
    stopLoss, 
    takeProfit,
    isDemo = false 
  } = req.body;

  // Validation
  if (!symbol || !side || !type || !quantity) {
    return res.status(400).json({
      success: false,
      error: 'Champs requis manquants: symbol, side, type, quantity'
    });
  }

  // Validation levier
  if (leverage < 1 || leverage > 125) {
    return res.status(400).json({
      success: false,
      error: 'Levier invalide: doit être entre 1 et 125'
    });
  }

  // SL/TP obligatoires pour futures
  if (!stopLoss || !takeProfit) {
    return res.status(400).json({
      success: false,
      error: 'Stop Loss et Take Profit sont obligatoires pour le trading Futures',
      required: true
    });
  }

  try {
    // Récupérer les clés API de l'utilisateur depuis encryptedApiKeys
    const userApiKeys = req.user?.encryptedApiKeys?.binanceApiKey && req.user?.encryptedApiKeys?.binanceSecretKey ? {
      apiKey: req.user.encryptedApiKeys.binanceApiKey,
      apiSecret: req.user.encryptedApiKeys.binanceSecretKey
    } : null;
    
    const result = await tradingService.safeExecuteFuturesTrade({
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      type: type.toUpperCase(),
      quantity: parseFloat(quantity),
      price: price ? parseFloat(price) : undefined,
      leverage: parseInt(leverage),
      stopLoss: parseFloat(stopLoss),
      takeProfit: parseFloat(takeProfit),
      apiKeys: userApiKeys
    }, isDemo);

    res.json({
      success: true,
      demoMode: result.demo,
      order: {
        id: result.orderId,
        symbol: result.symbol,
        side: result.side,
        type: result.type,
        quantity: result.quantity,
        price: result.price,
        leverage,
        stopLoss: result.stopLoss,
        takeProfit: result.takeProfit,
        fees: result.fees,
        timestamp: result.timestamp
      },
      risk: result.riskValidation,
      message: isDemo 
        ? 'Ordre Futures démo exécuté avec succès'
        : 'Ordre Futures réel exécuté sur Binance'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.error || error.message || 'Échec de l\'exécution Futures',
      code: error.code,
      timestamp: Date.now()
    });
  }
}));

/**
 * POST /api/trading/position/close
 * Fermer une position ouverte
 */
router.post('/position/close', optionalAuth, asyncHandler(async (req, res) => {
  const { positionId, symbol, side, size, isDemo = false } = req.body;

  if (!positionId || !symbol || !side || !size) {
    return res.status(400).json({
      success: false,
      error: 'Champs requis manquants: positionId, symbol, side, size'
    });
  }

  try {
    // Récupérer les clés API de l'utilisateur depuis encryptedApiKeys
    const userApiKeys = req.user?.encryptedApiKeys?.binanceApiKey && req.user?.encryptedApiKeys?.binanceSecretKey ? {
      apiKey: req.user.encryptedApiKeys.binanceApiKey,
      apiSecret: req.user.encryptedApiKeys.binanceSecretKey
    } : null;
    
    const result = await tradingService.closePosition({
      id: positionId,
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      size: parseFloat(size),
      isFutures: true,
      apiKeys: userApiKeys
    }, isDemo);

    res.json({
      success: true,
      demoMode: result.demo,
      closed: {
        orderId: result.orderId,
        pnl: result.pnl,
        timestamp: result.timestamp
      },
      message: isDemo 
        ? 'Position démo fermée'
        : 'Position réelle fermée sur Binance'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Échec de la fermeture de position',
      timestamp: Date.now()
    });
  }
}));

/**
 * GET /api/trading/positions
 * Récupérer les positions ouvertes avec PnL temps réel
 */
router.get('/positions', optionalAuth, asyncHandler(async (req, res) => {
  const { isDemo = false } = req.query;

  try {
    const positions = await tradingService.getPositionsWithPnL(isDemo === 'true');
    
    // Calculer totaux
    const totalUnrealizedPnl = positions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
    
    res.json({
      success: true,
      demoMode: isDemo === 'true',
      positions,
      summary: {
        count: positions.length,
        totalUnrealizedPnl,
        longCount: positions.filter(p => p.side === 'LONG' || p.side === 'BUY').length,
        shortCount: positions.filter(p => p.side === 'SHORT' || p.side === 'SELL').length
      },
      timestamp: Date.now()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Échec de la récupération des positions',
      timestamp: Date.now()
    });
  }
}));

/**
 * GET/POST /api/trading/balance
 * Récupérer le solde du compte
 */
router.all('/balance', optionalAuth, asyncHandler(async (req, res) => {
  const { isDemo = false } = req.query;

  console.log('[Trading] Balance request - isDemo:', isDemo);

  try {
    let balance;

    if (isDemo === 'true') {
      balance = await tradingService.demoManager.getBalance();
      console.log('[Trading] Demo balance:', balance);
      res.json({
        success: true,
        demoMode: true,
        balance,
        currency: 'USDT',
        timestamp: Date.now()
      });
    } else {
      // Récupérer les clés API depuis le body ou headers
      const apiKey = req.body?.apiKey || req.headers['x-binance-api-key'];
      const secretKey = req.body?.secretKey || req.headers['x-binance-secret-key'];

      const apiKeys = (apiKey && secretKey) ? { apiKey, secretKey } : null;
      const balances = await binanceService.getAccountBalances(apiKeys);
      const usdt = balances.find(b => b.asset === 'USDT');

      console.log('[Trading] Real balance:', usdt ? usdt.free : 0);

      res.json({
        success: true,
        demoMode: false,
        balance: usdt ? parseFloat(usdt.free) : 0,
        totalBalance: usdt ? parseFloat(usdt.total) : 0,
        locked: usdt ? parseFloat(usdt.locked) : 0,
        currency: 'USDT',
        allBalances: balances.filter(b => parseFloat(b.total) > 0),
        timestamp: Date.now()
      });
    }

  } catch (error) {
    console.error('[Trading] Balance error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Échec de la récupération du solde',
      timestamp: Date.now()
    });
  }
}));

/**
 * POST /api/trading/pnl/update
 * Mettre à jour les PnL temps réel
 */
router.post('/pnl/update', optionalAuth, asyncHandler(async (req, res) => {
  const { positions, isDemo = false } = req.body;

  if (!Array.isArray(positions)) {
    return res.status(400).json({
      success: false,
      error: 'Positions array required'
    });
  }

  try {
    const updatedPositions = await tradingService.updatePnLRealtime(
      positions, 
      isDemo
    );
    
    const totalPnl = updatedPositions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);

    res.json({
      success: true,
      demoMode: isDemo,
      positions: updatedPositions,
      totalUnrealizedPnl: totalPnl,
      timestamp: Date.now()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Échec de la mise à jour des PnL',
      timestamp: Date.now()
    });
  }
}));

/**
 * GET /api/trading/history
 * Historique des trades
 */
router.get('/history', optionalAuth, asyncHandler(async (req, res) => {
  const { isDemo = false, limit = 50 } = req.query;

  try {
    if (isDemo === 'true') {
      const data = await tradingService.demoManager.loadData();
      const recentTrades = data.trades.slice(-parseInt(limit)).reverse();
      
      res.json({
        success: true,
        demoMode: true,
        trades: recentTrades,
        count: recentTrades.length,
        timestamp: Date.now()
      });
    } else {
      // 🔥 RÉCUPÉRATION RÉELLE DE L'HISTORIQUE BINANCE
      try {
        // Récupérer les clés API de l'utilisateur
        const userApiKeys = req.user?.binanceApiKey && req.user?.binanceSecretKey ? {
          apiKey: req.user.binanceApiKey,
          apiSecret: req.user.binanceSecretKey
        } : null;
        
        if (!userApiKeys) {
          return res.status(400).json({
            success: false,
            error: 'Clés API Binance non configurées',
            message: 'Configurez vos clés API pour voir l\'historique réel'
          });
        }
        
        // Récupérer tous les symboles tradés récemment depuis les ordres
        const allOrders = [];
        const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOTUSDT'];
        
        // Récupérer l'historique pour chaque symbole (limité aux 5 derniers jours)
        for (const symbol of symbols) {
          try {
            const orders = await binanceService.getOrderHistory(symbol, 50);
            if (orders && orders.length > 0) {
              allOrders.push(...orders.map(order => ({
                id: order.orderId?.toString(),
                symbol: order.symbol,
                side: order.side,
                type: order.type,
                quantity: parseFloat(order.origQty),
                executedQty: parseFloat(order.executedQty),
                price: parseFloat(order.price) || parseFloat(order.avgPrice) || 0,
                status: order.status,
                time: order.time || order.updateTime,
                pnl: order.pnl || 0,
                commission: parseFloat(order.commission) || 0,
                commissionAsset: order.commissionAsset
              })));
            }
          } catch (err) {
            console.error(`[Trading] Erreur historique ${symbol}:`, err.message);
            // Continuer avec les autres symboles
          }
        }
        
        // Trier par date décroissante et limiter
        const sortedTrades = allOrders
          .sort((a, b) => b.time - a.time)
          .slice(0, parseInt(limit));
        
        res.json({
          success: true,
          demoMode: false,
          trades: sortedTrades,
          count: sortedTrades.length,
          totalFetched: allOrders.length,
          timestamp: Date.now()
        });
        
      } catch (error) {
        console.error('[Trading] Erreur récupération historique réel:', error);
        res.status(500).json({
          success: false,
          error: error.message || 'Échec de la récupération de l\'historique Binance',
          timestamp: Date.now()
        });
      }
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Échec de la récupération de l\'historique',
      timestamp: Date.now()
    });
  }
}));

/**
 * POST /api/trading/demo/reset
 * Réinitialiser le compte démo
 */
router.post('/demo/reset', optionalAuth, asyncHandler(async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const dataPath = path.join(__dirname, '..', 'data', 'demo_trading.json');
    
    await fs.unlink(dataPath).catch(() => {});
    
    res.json({
      success: true,
      message: 'Compte démo réinitialisé',
      newBalance: 10000,
      timestamp: Date.now()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
}));

/**
 * Error handler
 */
router.use((err, req, res, next) => {
  console.error('Trading route error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    code: err.code || 500,
    timestamp: Date.now()
  });
});

module.exports = router;
