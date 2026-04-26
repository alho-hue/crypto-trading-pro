const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const BINANCE_API_URL = 'https://api.binance.com';
const BINANCE_FUTURES_URL = 'https://fapi.binance.com';

// Middleware to get user's API keys
async function getUserBinanceKeys(req) {
  // 🔥 PRIORITÉ 1: Clés envoyées depuis le frontend (body/headers)
  // Permet d'utiliser les clés stockées dans localStorage du user
  const bodyApiKey = req.body?.apiKey || req.headers['x-binance-api-key'];
  const bodySecretKey = req.body?.secretKey || req.headers['x-binance-secret-key'];
  
  if (bodyApiKey && bodySecretKey) {
    console.log('[BINANCE] Using API keys from request');
    return { apiKey: bodyApiKey, secretKey: bodySecretKey };
  }
  
  // PRIORITÉ 2: Clés depuis le JWT ou req.user (si stockées dans MongoDB)
  const userApiKey = req.user?.encryptedApiKeys?.binanceApiKey;
  const userSecretKey = req.user?.encryptedApiKeys?.binanceSecretKey;
  
  if (userApiKey && userSecretKey) {
    console.log('[BINANCE] Using API keys from user profile');
    return { 
      apiKey: userApiKey, 
      secretKey: userSecretKey 
    };
  }
  
  // PRIORITÉ 3: Clés depuis les variables d'environnement (fallback)
  if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET_KEY) {
    console.log('[BINANCE] Using API keys from environment');
    return { 
      apiKey: process.env.BINANCE_API_KEY, 
      secretKey: process.env.BINANCE_SECRET_KEY 
    };
  }
  
  console.log('[BINANCE] No API keys found');
  return null;
}

// Generate signature for Binance API
function generateSignature(queryString, secretKey) {
  return crypto
    .createHmac('sha256', secretKey)
    .update(queryString)
    .digest('hex');
}

// Get account info (SPOT) - Accept GET and POST
router.all('/account', authenticateToken, async (req, res) => {
  try {
    const keys = await getUserBinanceKeys(req);
    if (!keys) {
      // Return demo mode data instead of error
      return res.json({
        balances: [
          { asset: 'USDT', free: '1000.00', locked: '0.00' },
          { asset: 'BTC', free: '0.05', locked: '0.00' },
          { asset: 'ETH', free: '1.5', locked: '0.00' }
        ],
        totalAssetOfBtc: '0.15',
        demoMode: true,
        message: 'Mode démo: Configurez vos clés API Binance dans les paramètres pour voir vos vraies balances'
      });
    }

    // Use recvWindow to avoid timestamp issues
    const timestamp = Date.now();
    const recvWindow = 60000; // 60 seconds window
    const queryString = `timestamp=${timestamp}&recvWindow=${recvWindow}`;
    const signature = generateSignature(queryString, keys.secretKey);

    console.log('Fetching Binance account with API key:', keys.apiKey?.slice(0, 10) + '...');

    const response = await axios.get(
      `${BINANCE_API_URL}/api/v3/account?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': keys.apiKey,
        },
        timeout: 10000,
      }
    );

    // Filter non-zero balances
    const balances = response.data.balances.filter(
      b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
    );

    res.json({
      balances,
      totalAssetOfBtc: response.data.totalAssetOfBtc,
    });
  } catch (error) {
    console.error('Binance account error:', error.response?.data || error.message);
    
    // Check for specific Binance errors
    if (error.response?.data?.code === -1021) {
      return res.status(400).json({
        error: 'Timestamp error',
        details: 'Server time not synchronized. Please check your system time.',
      });
    }
    
    if (error.response?.data?.code === -2015) {
      return res.status(400).json({
        error: 'Invalid API key',
        details: 'Your Binance API key is invalid or has incorrect permissions.',
      });
    }
    
    res.status(400).json({
      error: 'Failed to fetch account info',
      details: error.response?.data?.msg || error.message,
    });
  }
});

// 🔥 POST /account - Accepte les clés API depuis le body (frontend sécurisé)
router.post('/account', authenticateToken, async (req, res) => {
  try {
    const keys = await getUserBinanceKeys(req);
    if (!keys) {
      return res.status(400).json({ error: 'API keys not configured' });
    }

    const timestamp = Date.now();
    const recvWindow = 60000;
    const queryString = `timestamp=${timestamp}&recvWindow=${recvWindow}`;
    const signature = generateSignature(queryString, keys.secretKey);

    console.log('[POST /account] Fetching Binance account with API key:', keys.apiKey?.slice(0, 10) + '...');

    const response = await axios.get(
      `${BINANCE_API_URL}/api/v3/account?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': keys.apiKey,
        },
        timeout: 10000,
      }
    );

    const balances = response.data.balances.filter(
      b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
    );

    res.json({
      balances,
      totalAssetOfBtc: response.data.totalAssetOfBtc,
    });
  } catch (error) {
    console.error('Binance account error (POST):', error.response?.data || error.message);
    
    if (error.response?.data?.code === -2015) {
      return res.status(401).json({
        error: 'Invalid API key',
        details: 'Your Binance API key is invalid or has incorrect permissions.',
      });
    }
    
    res.status(400).json({
      error: 'Failed to fetch account info',
      details: error.response?.data?.msg || error.message,
    });
  }
});

// Get futures account info
router.get('/futures/account', authenticateToken, async (req, res) => {
  try {
    const keys = await getUserBinanceKeys(req);
    if (!keys) {
      return res.status(400).json({ error: 'API keys not configured' });
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = generateSignature(queryString, keys.secretKey);

    const response = await axios.get(
      `${BINANCE_FUTURES_URL}/fapi/v2/account?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': keys.apiKey,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Binance futures account error:', error.response?.data || error.message);
    res.status(400).json({
      error: 'Failed to fetch futures account info',
      details: error.response?.data?.msg || error.message,
    });
  }
});

// Place spot order
router.post('/order', authenticateToken, async (req, res) => {
  try {
    const keys = await getUserBinanceKeys(req);
    if (!keys) {
      return res.status(400).json({ error: 'API keys not configured' });
    }

    const { symbol, side, type, quantity, price } = req.body;

    const timestamp = Date.now();
    let queryString = `symbol=${symbol}&side=${side}&type=${type}&quantity=${quantity}&timestamp=${timestamp}`;

    if (type === 'LIMIT' && price) {
      queryString += `&price=${price}&timeInForce=GTC`;
    }

    const signature = generateSignature(queryString, keys.secretKey);

    const response = await axios.post(
      `${BINANCE_API_URL}/api/v3/order?${queryString}&signature=${signature}`,
      null,
      {
        headers: {
          'X-MBX-APIKEY': keys.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Binance order error:', error.response?.data || error.message);
    res.status(400).json({
      error: 'Failed to place order',
      details: error.response?.data?.msg || error.message,
    });
  }
});

// Place futures order
router.post('/futures/order', authenticateToken, async (req, res) => {
  try {
    const keys = await getUserBinanceKeys(req);
    if (!keys) {
      return res.status(400).json({ error: 'API keys not configured' });
    }

    const { symbol, side, type, quantity, price, leverage } = req.body;

    // First set leverage if provided
    if (leverage) {
      const timestamp = Date.now();
      const leverageQuery = `symbol=${symbol}&leverage=${leverage}&timestamp=${timestamp}`;
      const leverageSignature = generateSignature(leverageQuery, keys.secretKey);

      await axios.post(
        `${BINANCE_FUTURES_URL}/fapi/v1/leverage?${leverageQuery}&signature=${leverageSignature}`,
        null,
        {
          headers: {
            'X-MBX-APIKEY': keys.apiKey,
          },
        }
      );
    }

    const timestamp = Date.now();
    let queryString = `symbol=${symbol}&side=${side}&type=${type}&quantity=${quantity}&timestamp=${timestamp}`;

    if (type === 'LIMIT' && price) {
      queryString += `&price=${price}&timeInForce=GTC`;
    }

    const signature = generateSignature(queryString, keys.secretKey);

    const response = await axios.post(
      `${BINANCE_FUTURES_URL}/fapi/v1/order?${queryString}&signature=${signature}`,
      null,
      {
        headers: {
          'X-MBX-APIKEY': keys.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Binance futures order error:', error.response?.data || error.message);
    res.status(400).json({
      error: 'Failed to place futures order',
      details: error.response?.data?.msg || error.message,
    });
  }
});

// Get open orders
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const keys = await getUserBinanceKeys(req);
    if (!keys) {
      return res.status(400).json({ error: 'API keys not configured' });
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = generateSignature(queryString, keys.secretKey);

    const response = await axios.get(
      `${BINANCE_API_URL}/api/v3/openOrders?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': keys.apiKey,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Binance orders error:', error.response?.data || error.message);
    res.status(400).json({
      error: 'Failed to fetch open orders',
      details: error.response?.data?.msg || error.message,
    });
  }
});

// Cancel order
router.delete('/order/:symbol/:orderId', authenticateToken, async (req, res) => {
  try {
    const keys = await getUserBinanceKeys(req);
    if (!keys) {
      return res.status(400).json({ error: 'API keys not configured' });
    }

    const { symbol, orderId } = req.params;
    const timestamp = Date.now();
    const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
    const signature = generateSignature(queryString, keys.secretKey);

    const response = await axios.delete(
      `${BINANCE_API_URL}/api/v3/order?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': keys.apiKey,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Binance cancel order error:', error.response?.data || error.message);
    res.status(400).json({
      error: 'Failed to cancel order',
      details: error.response?.data?.msg || error.message,
    });
  }
});

// Get order history
router.get('/myTrades', authenticateToken, async (req, res) => {
  try {
    const keys = await getUserBinanceKeys(req);
    if (!keys) {
      return res.status(400).json({ error: 'API keys not configured' });
    }

    const { symbol } = req.query;
    const timestamp = Date.now();
    let queryString = `timestamp=${timestamp}`;

    if (symbol) {
      queryString += `&symbol=${symbol}`;
    }

    const signature = generateSignature(queryString, keys.secretKey);

    const response = await axios.get(
      `${BINANCE_API_URL}/api/v3/myTrades?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': keys.apiKey,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Binance trades error:', error.response?.data || error.message);
    res.status(400).json({
      error: 'Failed to fetch trade history',
      details: error.response?.data?.msg || error.message,
    });
  }
});

// Test connectivity
router.get('/ping', async (req, res) => {
  try {
    const response = await axios.get(`${BINANCE_API_URL}/api/v3/ping`);
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ error: 'Binance API unavailable' });
  }
});

// Get exchange info (no auth required)
router.get('/exchangeInfo', async (req, res) => {
  try {
    const response = await axios.get(`${BINANCE_API_URL}/api/v3/exchangeInfo`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch exchange info' });
  }
});

// Get klines (candlestick data) - NO AUTH REQUIRED for public data
router.get('/klines', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT', interval = '1h', limit = 100 } = req.query;
    
    const response = await axios.get(
      `${BINANCE_API_URL}/api/v3/klines`,
      {
        params: {
          symbol: symbol.toUpperCase(),
          interval,
          limit: parseInt(limit)
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Binance klines error:', error.response?.data || error.message);
    res.status(400).json({
      error: 'Failed to fetch klines',
      details: error.response?.data?.msg || error.message,
    });
  }
});

// Get 24h ticker price - NO AUTH REQUIRED
router.get('/ticker/24hr', async (req, res) => {
  try {
    const { symbol } = req.query;
    
    const url = symbol 
      ? `${BINANCE_API_URL}/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`
      : `${BINANCE_API_URL}/api/v3/ticker/24hr`;
    
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error('Binance ticker error:', error.response?.data || error.message);
    res.status(400).json({
      error: 'Failed to fetch ticker',
      details: error.response?.data?.msg || error.message,
    });
  }
});

// Get current price - NO AUTH REQUIRED
router.get('/price', async (req, res) => {
  try {
    const { symbol } = req.query;
    
    const url = symbol
      ? `${BINANCE_API_URL}/api/v3/ticker/price?symbol=${symbol.toUpperCase()}`
      : `${BINANCE_API_URL}/api/v3/ticker/price`;
    
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error('Binance price error:', error.response?.data || error.message);
    res.status(400).json({
      error: 'Failed to fetch price',
      details: error.response?.data?.msg || error.message,
    });
  }
});

// 🔥 POST /keys - Sauvegarder les clés API Binance dans le profil utilisateur
router.post('/keys', authenticateToken, async (req, res) => {
  try {
    const { apiKey, secretKey } = req.body;
    
    if (!apiKey || !secretKey) {
      return res.status(400).json({
        success: false,
        message: 'Clés API et secrète requises'
      });
    }
    
    // Validation basique des clés Binance
    if (apiKey.length < 32 || secretKey.length < 32) {
      return res.status(400).json({
        success: false,
        message: 'Format de clé API invalide'
      });
    }
    
    // Mettre à jour l'utilisateur avec les clés API
    const User = require('../models/User');
    const user = await User.findById(req.user._id || req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    // Stocker les clés dans encryptedApiKeys (en clair pour l'instant, à chiffrer plus tard)
    if (!user.encryptedApiKeys) {
      user.encryptedApiKeys = {};
    }
    user.encryptedApiKeys.binanceApiKey = apiKey;
    user.encryptedApiKeys.binanceSecretKey = secretKey;
    await user.save();
    
    console.log('[BINANCE] Clés API sauvegardées pour user:', user._id);
    
    res.json({
      success: true,
      message: 'Clés API sauvegardées avec succès'
    });
    
  } catch (error) {
    console.error('[BINANCE] Erreur sauvegarde clés:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la sauvegarde des clés API'
    });
  }
});

module.exports = router;
