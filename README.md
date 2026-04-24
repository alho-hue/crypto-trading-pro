# NEUROVEST - Professional Crypto Trading Platform

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18-339933?logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0-47A248?logo=mongodb)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Production-ready crypto trading platform** with real-time market data, AI-powered signals, automated trading bots, and advanced risk management.

## ✨ What's New (April 2026)

### 🔥 Real-World Integrations Now Live
- **Mobile Money Payments** - Direct integration with Orange Money, Wave, and MTN Mobile Money (XOF deposits/withdrawals)
- **Real Binance Futures Trading** - Live leverage configuration, position tracking, and PnL calculation
- **Real Trade History** - Direct sync with Binance API for complete trade history
- **AI-Powered Trade Analysis** - EthernalAI analyzes every trade for performance insights
- **Activity Logging** - Complete audit trail of all user actions
- **Moderation System** - Full reporting, review, and resolution workflow

## 🚀 Key Features

### Real-Time Trading Engine
- **Live market data** via Binance WebSocket API (Spot & Futures)
- **Real trade execution** on Binance Spot & Futures with live leverage
- **Real position tracking** with PnL calculation and liquidation monitoring
- **Automated trading bot** with AI signals
- **Paper trading mode** for safe testing
- **Trailing stops** and advanced order types
- **Real trade history sync** from Binance API

### Advanced Analytics
- **Multi-timeframe analysis** (15m, 1h, 4h, 1d)
- **Technical indicators**: RSI, MACD, Bollinger Bands, ADX
- **Kelly Criterion** position sizing
- **Correlation analysis** for risk management
- **Backtesting engine** with historical data

### Portfolio Management
- **Real-time P&L tracking**
- **Performance metrics**: Sharpe ratio, drawdown, win rate
- **Automatic rebalancing**
- **Diversification analysis**
- **Trade history & journaling**

### Security & Compliance
- **AES-256-GCM encryption** for API keys
- **2FA TOTP** authentication
- **IP whitelisting**
- **JWT secure authentication**
- **XSS protection** & input sanitization
- **Activity audit logging** - Complete user action trail
- **Moderation system** - Report, review, and resolve workflow
- **Webhook signature verification** for payment security

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Socket.io-client** for real-time updates
- **Lightweight Charts** for trading charts
- **Lucide React** for icons

### Backend
- **Node.js** with Express
- **MongoDB** with Mongoose
- **Socket.IO** for real-time communication
- **Binance API** integration
- **JWT** authentication
- **Winston** logging

### Security
- **crypto-js** for client-side encryption
- **speakeasy** for 2FA
- **helmet** for HTTP security
- **express-rate-limit** for DDoS protection

## 📋 Prerequisites

- **Node.js** 18+ 
- **MongoDB** 6+ (local or Atlas)
- **npm** 9+ or **yarn**
- **Git**

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/neurovest.git
cd neurovest

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 2. Environment Configuration

#### Backend (.env)
```bash
cd backend
cp .env.example .env
```

Edit `.env` with your values:
```env
# Required
MONGODB_URI=mongodb://localhost:27017/neurovest
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-here
ENCRYPTION_KEY=your-64-char-hex-encryption-key-here

# Binance (for real trading)
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
BINANCE_TESTNET=true  # Set to false for production

# Mobile Money APIs (for real deposits/withdrawals)
# Orange Money
ORANGE_MONEY_CLIENT_ID=your_orange_client_id
ORANGE_MONEY_CLIENT_SECRET=your_orange_secret
ORANGE_MONEY_MERCHANT_KEY=your_merchant_key
ORANGE_MONEY_ENV=sandbox  # or production

# Wave
WAVE_API_KEY=your_wave_api_key
WAVE_WEBHOOK_SECRET=your_wave_webhook_secret

# MTN MoMo
MTN_SUBSCRIPTION_KEY=your_mtn_key
MTN_API_USER=your_mtn_user
MTN_API_KEY=your_mtn_api_key

# AI (Optional)
GROQ_API_KEY=gsk_your_groq_key
```

**Generate encryption keys:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Frontend (.env.local)
```bash
cp .env.example .env.local
```

```env
VITE_API_URL=http://localhost:5000
```

### 3. Start MongoDB

```bash
# Using Docker
docker run -d -p 27017:27017 --name neurovest-mongo mongo:6

# Or using local MongoDB
mongod --dbpath /path/to/data
```

### 4. Start the Application

```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend (from root)
npm run dev
```

Visit `http://localhost:5173` 🎉

## 📖 API Documentation

### Authentication
```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/verify-2fa
```

### Trading Bot
```http
GET    /api/auto-trading/status
POST   /api/auto-trading/enable
POST   /api/auto-trading/disable
POST   /api/auto-trading/paper-trading
POST   /api/auto-trading/backtest
GET    /api/auto-trading/trades         # AI-analyzed trades
GET    /api/auto-trading/open-positions  # Real positions with PnL
```

### Portfolio
```http
GET    /api/portfolio
GET    /api/portfolio/performance
GET    /api/portfolio/pnl
POST   /api/portfolio/rebalancing/execute
```

### Wallet & Payments
```http
GET    /api/wallet/balance
GET    /api/wallet/transactions
POST   /api/wallet/withdraw
POST   /api/mobile-money/deposit      # Real Orange/Wave/MTN
POST   /api/mobile-money/withdrawal  # Real mobile money withdrawal
GET    /api/mobile-money/status/:id
```

### Alerts
```http
GET    /api/alerts
POST   /api/alerts
DELETE /api/alerts/:id
POST   /api/alerts/smart
```

### Security & Activity
```http
POST   /api/security/2fa/setup
POST   /api/security/2fa/verify
POST   /api/security/api-keys
GET    /api/security/audit
GET    /api/activity/recent            # Real activity history
GET    /api/activity/stats             # Activity statistics
```

## 🔐 Security Checklist

Before going to production:

- [ ] Change default JWT_SECRET (min 32 chars)
- [ ] Generate unique ENCRYPTION_KEY
- [ ] Generate RSA key pair for API encryption
- [ ] Enable 2FA for all admin accounts
- [ ] Configure IP whitelisting
- [ ] Set up MongoDB authentication
- [ ] Enable HTTPS/WSS
- [ ] Configure rate limiting
- [ ] Set up monitoring & logging
- [ ] Review CORS settings
- [ ] Configure mobile money webhooks (Orange/Wave/MTN)
- [ ] Set up SSL for webhook endpoints
- [ ] Test real trading with small amounts first

## 📊 Trading Bot Configuration

### Paper Trading (Default)
```javascript
{
  strategy: 'moderate',      // conservative | moderate | aggressive
  symbols: ['BTC', 'ETH'],   // Trading pairs
  maxRiskPerTrade: 2,        // % of capital per trade
  paperTrading: true         // No real money used
}
```

### Real Trading
1. Store encrypted API keys in Settings → Security
2. Disable Paper Trading mode
3. Set conservative risk parameters
4. Enable 2FA
5. Start with small amounts

## 🧪 Testing

```bash
# Frontend tests
npm run test

# Backend tests
cd backend
npm test

# Integration tests
npm run test:e2e
```

## 🚀 Deployment

### Backend (Railway/Render/Heroku)
```bash
# Set environment variables in dashboard
# Deploy from GitHub
```

### Frontend (Vercel/Netlify)
```bash
# Build
npm run build

# Or deploy directly from GitHub
```

### Docker
```bash
docker-compose up -d
```

## 📈 Performance Optimization

- **Database indexing** on frequently queried fields (User, Activity, Reports)
- **Redis caching** for market data
- **CDN** for static assets
- **Lazy loading** for routes
- **WebSocket connection pooling**
- **Activity aggregation** for fast statistics
- **Trade analysis caching** for AI insights

## 🐛 Troubleshooting

### Common Issues

**MongoDB connection failed**
```bash
# Check MongoDB is running
mongosh --eval "db.adminCommand('ping')"
```

**Binance API errors**
- Verify API keys have correct permissions
- Check IP whitelist on Binance
- Enable testnet for testing

**WebSocket not connecting**
- Check firewall settings
- Verify CORS configuration
- Check network connectivity

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## ⚠️ Disclaimer

**Trading cryptocurrencies carries significant risk.** This software is for educational purposes. Always:
- Start with paper trading
- Never risk more than you can afford to lose
- Do your own research
- Consider consulting a financial advisor

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/alho-hue/crypto-trading-pro/issues)
- **Discussions**: [GitHub Discussions](https://github.com/alho-hue/crypto-trading-pro/discussions)
- **Email**: alhousseynid504@gmail.com

---

Built with ❤️ by the NEUROVEST Team
