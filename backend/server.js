const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);

// CORS - Configuration sécurisée pour production (Cloudflare uniquement)
const allowedOrigins = [
  'https://trade.neurovest.workers.dev',  // Cloudflare principal
  'https://neurovest.pages.dev',          // Domaine alternatif Cloudflare
  'http://localhost:3000',                // Dev local
  'http://localhost:5173',                // Vite dev
  'http://localhost:4173'                 // Vite preview
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.warn(`[CORS] Requête bloquée de: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-MBX-APIKEY',
    'x-mbx-apikey',
    'X-Binance-Secret',
    'x-binance-secret',
    'x-binance-api-key',
    'x-binance-secret-key'
  ]
};

const io = new Server(httpServer, {
  cors: corsOptions,
  pingTimeout: 60000, // 60 secondes (au lieu de 5000 par défaut)
  pingInterval: 25000, // 25 secondes (au lieu de 25000 par défaut)
  maxHttpBufferSize: 1e6, // 1MB
  transports: ['websocket', 'polling'], // Permettre fallback polling
  allowUpgrades: true,
  allowEIO3: true
});

// Attach io to app for use in routes
app.set('io', io);

// Static files for uploads (avant helmet pour éviter les restrictions)
app.use('/uploads', express.static(uploadsDir));

// Security middleware - Helmet avec configuration production
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors(corsOptions));

// Rate limiting - Actif en production (limites très élevées pour éviter 429)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 2000 : 5000, // 2000 req/15min en prod, 5000 en dev
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Rate limiting spécifique pour trading (très permissif)
const tradingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 300 : 1000, // 300 req/min en prod, 1000 en dev
  message: { error: 'Too many trading requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log('[tradingLimiter] Rate limit exceeded for IP:', req.ip);
    res.status(429).json({ error: 'Too many trading requests, please try again later.' });
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 🔥 Log toutes les requêtes pour débogage
app.use((req, res, next) => {
  if (req.path.includes('/trading/balance')) {
    console.log('[ALL REQUESTS] Method:', req.method, '- Path:', req.path, '- IP:', req.ip);
    console.log('[ALL REQUESTS] Headers auth:', req.headers['authorization'] ? 'YES' : 'NO');
    console.log('[ALL REQUESTS] Headers binance-key:', req.headers['x-binance-api-key'] ? 'YES' : 'NO');
  }
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/webrtc', require('./routes/webrtc'));
app.use('/api/trades', require('./routes/trades'));
app.use('/api/trades', require('./routes/trades-v2')); // Routes v2 avec TradeManager
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/upload', require('./routes/upload')); // Upload de fichiers
// Utiliser les routes Binance unifiées (nouveau service centralisé)
app.use('/api/binance', require('./routes/binanceUnified'));
// Routes Trading sécurisées (Spot + Futures) avec rate limiting spécifique
app.use('/api/trading', tradingLimiter, require('./routes/trading'));
app.use('/api/auto-trading', require('./routes/autoTrading'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/security', require('./routes/security'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/mobile-money', require('./routes/mobileMoney'));
app.use('/api/learning', require('./routes/learning')); // Apprentissage automatique IA
app.use('/api/ethernal', require('./routes/ethernal')); // IA Ethernal intelligente
app.use('/api/social', require('./routes/social')); // Routes sociales (signaux, trades, follow)
app.use('/api/transactions', require('./routes/transactions')); // Gestion transactions financières

// === HEALTH CHECK (pour UptimeRobot et monitoring) ===
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// === ENDPOINT NEWS CRYPTO (Proxy pour éviter CORS) ===
app.get('/api/news', async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const filter = req.query.filter || 'all';
    
    let allNews = [];
    let source = 'unknown';
    
    // Essayer CoinGecko News API (gratuite et fiable)
    try {
      console.log('[News] Fetching from CoinGecko News API...');
      const geckoResponse = await axios.get(`https://api.coingecko.com/api/v3/news?page=1&per_page=${limit}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 15000
      });
      
      console.log('[News] CoinGecko response status:', geckoResponse.status);
      
      if (geckoResponse.status === 200) {
        const data = geckoResponse.data;
        console.log('[News] CoinGecko data keys:', Object.keys(data));
        
        if (data.data && Array.isArray(data.data)) {
          allNews = data.data.slice(0, limit).map((item) => ({
            id: String(item.id || Math.random()),
            title: item.title,
            description: item.description || item.title,
            url: item.url,
            source: item.news_site || 'CoinGecko',
            author: item.author || 'Crypto News',
            publishedAt: item.updated_at || new Date().toISOString(),
            imageUrl: item.thumb_2x || item.thumb || null,
            category: filter !== 'all' ? filter : 'general',
            sentiment: detectSentiment(item.title + ' ' + (item.description || '')),
            currencies: []
          }));
          source = 'coingecko';
          console.log(`[News] Successfully fetched ${allNews.length} news from CoinGecko`);
        } else {
          console.log('[News] CoinGecko data format unexpected:', JSON.stringify(data).substring(0, 200));
        }
      } else {
        console.log('[News] CoinGecko API returned status:', geckoResponse.status);
      }
    } catch (geckoError) {
      console.log('[News] CoinGecko API failed:', geckoError.message);
    }
    
    // Si CoinGecko échoue, essayer CryptoPanic
    if (allNews.length === 0) {
      try {
        console.log('[News] Trying CryptoPanic...');
        const cryptoPanicResponse = await axios.get(`https://cryptopanic.com/api/free/v1/posts/?auth_token=demo&public=true&limit=${limit}`, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'NEUROVEST-Trading-Bot/1.0'
          },
          timeout: 5000
        });
        
        if (cryptoPanicResponse.status === 200) {
          const data = cryptoPanicResponse.data;
          if (data.results && Array.isArray(data.results)) {
            allNews = data.results.map((item) => ({
              id: item.id || String(Math.random()),
              title: item.title,
              description: item.title,
              url: item.url,
              source: item.source?.title || 'CryptoPanic',
              author: item.source?.title || 'Crypto News',
              publishedAt: item.published_at || new Date().toISOString(),
              imageUrl: null,
              category: filter !== 'all' ? filter : 'general',
              sentiment: detectSentiment(item.title),
              currencies: item.currencies?.map((c) => c.code) || []
            }));
            source = 'cryptopanic';
            console.log(`[News] Successfully fetched ${allNews.length} news from CryptoPanic`);
          }
        }
      } catch (cpError) {
        console.log('[News] CryptoPanic failed:', cpError.message);
      }
    }
    
    // Si toutes les APIs échouent, générer des données fallback
    if (allNews.length === 0) {
      console.log('[News] All APIs failed, using fallback data');
      allNews = generateFallbackNews();
      source = 'fallback';
    }
    
    // Filtrer par catégorie si demandé
    if (filter !== 'all') {
      allNews = allNews.filter(news => {
        const title = news.title.toLowerCase();
        const currencies = news.currencies || [];
        
        switch (filter) {
          case 'bitcoin':
            return title.includes('bitcoin') || title.includes('btc') || currencies.includes('BTC');
          case 'ethereum':
            return title.includes('ethereum') || title.includes('eth') || currencies.includes('ETH');
          case 'altcoin':
            return currencies.length > 0 && !currencies.includes('BTC') && !currencies.includes('ETH');
          case 'regulation':
            return title.includes('regulation') || title.includes('sec') || title.includes('law') || 
                   title.includes('règlementation') || title.includes('ban');
          case 'market':
            return title.includes('market') || title.includes('prix') || title.includes('bull') || 
                   title.includes('bear') || title.includes('rally') || title.includes('crash');
          case 'technology':
            return title.includes('technology') || title.includes('blockchain') || 
                   title.includes('upgrade') || title.includes('hard fork');
          default:
            return true;
        }
      });
    }
    
    res.json({
      success: true,
      count: allNews.length,
      source: source,
      timestamp: new Date().toISOString(),
      news: allNews
    });
    
  } catch (error) {
    console.error('[News] Error:', error);
    
    // En cas d'erreur, renvoyer les données fallback
    const fallbackNews = generateFallbackNews();
    res.json({
      success: true,
      count: fallbackNews.length,
      source: 'fallback-error',
      timestamp: new Date().toISOString(),
      news: fallbackNews
    });
  }
});

// Fonction pour détecter le sentiment
function detectSentiment(text) {
  const positiveWords = ['surge', 'rally', 'bull', 'gain', 'up', 'rise', 'moon', 'pump', ' ATH', 'record', 'high', 'growth', 'adopt', 'partnership', 'launch'];
  const negativeWords = ['crash', 'dump', 'bear', 'down', 'fall', 'drop', 'hack', 'scam', 'ban', 'fud', 'low', 'loss', 'sell', 'short'];
  
  const textLower = text.toLowerCase();
  let positive = 0;
  let negative = 0;
  
  positiveWords.forEach(word => {
    if (textLower.includes(word.toLowerCase())) positive++;
  });
  
  negativeWords.forEach(word => {
    if (textLower.includes(word.toLowerCase())) negative++;
  });
  
  if (positive > negative) return 'positive';
  if (negative > positive) return 'negative';
  return 'neutral';
}

// Données fallback en cas d'échec des APIs
function generateFallbackNews() {
  return [
    {
      id: '1',
      title: 'Bitcoin atteint un nouveau record historique',
      description: 'Le Bitcoin a dépassé les 100,000$ pour la première fois, marquant un tournant historique pour la crypto.',
      url: 'https://bitcoin.org',
      source: 'NEUROVEST News',
      author: 'Équipe NEUROVEST',
      publishedAt: new Date().toISOString(),
      imageUrl: null,
      category: 'bitcoin',
      sentiment: 'positive',
      currencies: ['BTC']
    },
    {
      id: '2',
      title: 'Ethereum 2.0 : La mise à jour Shanghai complétée',
      description: 'La transition vers le Proof of Stake est maintenant terminée avec succès.',
      url: 'https://ethereum.org',
      source: 'NEUROVEST News',
      author: 'Équipe NEUROVEST',
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      imageUrl: null,
      category: 'ethereum',
      sentiment: 'positive',
      currencies: ['ETH']
    },
    {
      id: '3',
      title: 'Solana dépasse les 200$ suite à l\'adoption institutionnelle',
      description: 'Les institutions majeures ajoutent SOL à leurs portefeuilles.',
      url: 'https://solana.com',
      source: 'NEUROVEST News',
      author: 'Équipe NEUROVEST',
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
      imageUrl: null,
      category: 'altcoin',
      sentiment: 'positive',
      currencies: ['SOL']
    },
    {
      id: '4',
      title: 'La SEC approuve les premiers ETF Bitcoin spot',
      description: 'Une victoire majeure pour l\'adoption institutionnelle du Bitcoin.',
      url: 'https://sec.gov',
      source: 'NEUROVEST News',
      author: 'Équipe NEUROVEST',
      publishedAt: new Date(Date.now() - 10800000).toISOString(),
      imageUrl: null,
      category: 'regulation',
      sentiment: 'positive',
      currencies: ['BTC']
    },
    {
      id: '5',
      title: 'Le marché crypto en hausse de 15% cette semaine',
      description: 'Tendance haussière généralisée sur l\'ensemble du marché.',
      url: 'https://coinmarketcap.com',
      source: 'NEUROVEST News',
      author: 'Équipe NEUROVEST',
      publishedAt: new Date(Date.now() - 14400000).toISOString(),
      imageUrl: null,
      category: 'market',
      sentiment: 'positive',
      currencies: ['BTC', 'ETH', 'SOL']
    }
  ];
}

// === ENDPOINT PRIX TEMPS RÉEL ===
app.get('/api/prices', async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',') : 
      ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOTUSDT', 'DOGEUSDT'];
    
    const prices = [];
    
    for (const symbol of symbols) {
      try {
        const ticker = await binanceService.get24hTicker(symbol);
        if (ticker) {
          prices.push({
            symbol: symbol,
            price: parseFloat(ticker.lastPrice || 0),
            lastPrice: ticker.lastPrice,
            priceChangePercent: ticker.priceChangePercent || 0,
            priceChange: ticker.priceChange || 0,
            volume: ticker.volume || 0,
            highPrice: ticker.highPrice || 0,
            lowPrice: ticker.lowPrice || 0,
            closeTime: Date.now()
          });
        }
      } catch (err) {
        console.error(`[Prices] Error fetching ${symbol}:`, err.message);
      }
    }
    
    res.json({ success: true, prices, count: prices.length });
  } catch (error) {
    console.error('[Prices] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import services for Socket.IO initialization
const alertService = require('./services/alertService');
const autoTradingService = require('./services/autoTradingService');
const binanceService = require('./services/binanceServiceUnified');
const tradeManager = require('./services/tradeManager');
const learningEngine = require('./services/learningEngine');
const adminSocketIO = require('./services/adminSocketIO');

// Exporter io pour utilisation dans d'autres modules
const getIO = () => io;

// Socket.io for real-time chat, WebRTC signaling, and trading notifications
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Subscribe to default price streams for major cryptos
  const defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT'];
  const subscribedStreams = [];
  
  // Subscribe user to real-time price updates
  socket.on('subscribe-prices', (symbols) => {
    const symbolsToSubscribe = symbols || defaultSymbols;
    
    symbolsToSubscribe.forEach(symbol => {
      const streamName = `${symbol.toLowerCase()}@ticker`;
      
      // Only subscribe if not already subscribed
      if (!subscribedStreams.includes(streamName)) {
        binanceService.subscribeToPrice(symbol, (data) => {
          // Emit to this specific client
          socket.emit('price-update', data);
          // Also broadcast to all clients
          io.emit('price-update', data);
          
          // Mettre à jour les trades actifs pour ce symbol
          const price = parseFloat(data.price || data.lastPrice || 0);
          if (price > 0) {
            tradeManager.onPriceUpdate(symbol.toUpperCase(), price);
          }
        });
        subscribedStreams.push(streamName);
      }
    });
    
    console.log(`User ${socket.id} subscribed to prices:`, symbolsToSubscribe);
    socket.emit('subscribed-prices', symbolsToSubscribe);
  });
  
  // Subscribe to klines (candles) for chart data
  socket.on('subscribe-klines', ({ symbol, interval }) => {
    binanceService.subscribeToKlines(symbol, interval, (data) => {
      socket.emit(`kline-${symbol.toLowerCase()}-${interval}`, data);
    });
    console.log(`User ${socket.id} subscribed to klines: ${symbol} ${interval}`);
  });
  
  // Unsubscribe from streams
  socket.on('unsubscribe', (streams) => {
    streams.forEach(stream => {
      binanceService.unsubscribe(stream);
      const index = subscribedStreams.indexOf(stream);
      if (index > -1) {
        subscribedStreams.splice(index, 1);
      }
    });
  });

  // Join user room for personal notifications
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Leave user room
  socket.on('leave-user', (userId) => {
    socket.leave(`user-${userId}`);
    console.log(`User ${userId} left their room`);
  });

  socket.on('join-chat', (channelId) => {
    socket.join(`chat-${channelId}`);
  });

  socket.on('join-voice', ({ channel, userId, username }) => {
    socket.join(`voice-${channel}`);
    socket.to(`voice-${channel}`).emit('voice-user-joined', { userId, username, socketId: socket.id });
  });

  socket.on('leave-voice', ({ channel, userId }) => {
    socket.leave(`voice-${channel}`);
    socket.to(`voice-${channel}`).emit('voice-user-left', { userId });
  });

  // WebRTC signaling
  socket.on('voice-offer', ({ channel, targetUserId, offer }) => {
    socket.to(`voice-${channel}`).emit('voice-offer', { userId: socket.id, offer });
  });

  socket.on('voice-answer', ({ channel, targetUserId, answer }) => {
    socket.to(`voice-${channel}`).emit('voice-answer', { userId: socket.id, answer });
  });

  socket.on('ice-candidate', ({ channel, targetUserId, candidate }) => {
    socket.to(`voice-${channel}`).emit('ice-candidate', { userId: socket.id, candidate });
  });

  socket.on('voice-mute', ({ channel, userId, isMuted }) => {
    socket.to(`voice-${channel}`).emit('voice-mute', { userId, isMuted });
  });

  socket.on('send-message', async (data) => {
    io.to(`chat-${data.channelId || 'general'}`).emit('new-message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// MongoDB connection - optional for demo mode
let mongoConnected = false;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-trading-pro', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB Connected');
  mongoConnected = true;
  
  // Initialiser le TradeManager APRÈS connexion MongoDB
  try {
    tradeManager.initialize();
    console.log('✅ TradeManager initialized');
  } catch (e) {
    console.warn('⚠️ TradeManager failed:', e.message);
  }
  
  // Initialiser le LearningEngine pour l'IA
  try {
    learningEngine.initialize();
    console.log('✅ LearningEngine initialized');
  } catch (e) {
    console.warn('⚠️ LearningEngine failed:', e.message);
  }
})
.catch(err => {
  console.warn('⚠️ MongoDB not connected - running in demo mode:', err.message);
});

// Initialize services safely
try {
  autoTradingService.initialize(io);
  console.log('✅ Auto-trading service initialized');
} catch (e) {
  console.warn('⚠️ Auto-trading service failed:', e.message);
}

try {
  alertService.initialize(io);
  console.log('✅ Alert service initialized');
} catch (e) {
  console.warn('⚠️ Alert service failed:', e.message);
}

console.log('✅ Core services initialized');

// Initialize Admin Socket.IO service
try {
  adminSocketIO.initialize(io);
  console.log('✅ Admin Socket.IO service initialized on /admin namespace');
} catch (e) {
  console.warn('⚠️ Admin Socket.IO service failed:', e.message);
}

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready for real-time trading`);
  console.log(`🔐 Admin namespace: /admin (Socket.IO)`);
  console.log(`💬 Admin chat channels: all_admins, super_admins_only, mods_only`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  autoTradingService.stopAllBots();
  alertService.stop();
  httpServer.close(() => {
    console.log('💤 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  autoTradingService.stopAllBots();
  alertService.stop();
  httpServer.close(() => {
    console.log('💤 Server closed');
    process.exit(0);
  });
});

module.exports = { app, io, getIO };
