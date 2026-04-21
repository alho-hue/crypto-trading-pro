const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const User = require('../models/User');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Services
const orangeMoneyService = require('../services/orangeMoney');
const { getIO } = require('../server');

// Configuration
const BINANCE_API_URL = 'https://api.binance.com';
const XOF_RATE_API = 'https://open.er-api.com/v6/latest/USD';

// Cache pour les taux de change
let rateCache = {
  usdtToXof: 605,
  lastUpdate: 0
};

// Récupérer le taux USDT/XOF en temps réel
async function getUSDTToXOFRate() {
  const now = Date.now();
  if (now - rateCache.lastUpdate < 60000) { // Cache 1 minute
    return rateCache.usdtToXof;
  }
  
  try {
    const response = await axios.get(XOF_RATE_API, { timeout: 5000 });
    if (response.data && response.data.rates && response.data.rates.XOF) {
      rateCache.usdtToXof = response.data.rates.XOF;
      rateCache.lastUpdate = now;
      return rateCache.usdtToXof;
    }
  } catch (error) {
    console.error('Erreur taux de change:', error.message);
  }
  
  return 605; // Fallback
}

// Convertir FCFA en USDT
async function convertFCFAtoUSDT(amountFCFA) {
  const rate = await getUSDTToXOFRate();
  return {
    usdt: parseFloat((amountFCFA / rate).toFixed(6)),
    rate: rate
  };
}

// Convertir USDT en FCFA
async function convertUSDTtoFCFA(amountUSDT) {
  const rate = await getUSDTToXOFRate();
  return {
    fcfa: Math.floor(amountUSDT * rate),
    rate: rate
  };
}

// Middleware to verify token - supporte id et userId
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();

    const decoded = jwt.verify(token, JWT_SECRET);
    // Support both token formats
    req.userId = decoded.userId || decoded.id;

    if (!req.userId) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Veuillez vous connecter' });
  }
};

// @route   GET /api/wallet
// @desc    Get current user's wallet
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('wallet transactions username');
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json({
      wallet: {
        balance: user.wallet?.balance || 0,
        available: user.wallet?.available || user.wallet?.balance || 0,
        locked: user.wallet?.locked || 0,
        totalDeposits: user.wallet?.totalDeposits || 0,
        totalWithdrawals: user.wallet?.totalWithdrawals || 0
      },
      transactions: user.transactions?.slice(0, 50) || [],
      currency: 'USDT'
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/wallet/stats
// @desc    Get wallet statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const transactions = user.transactions || [];
    
    // Calculate stats
    const deposits = transactions.filter(t => t.type === 'deposit');
    const withdrawals = transactions.filter(t => t.type === 'withdrawal');
    const fees = transactions.reduce((sum, t) => sum + (t.fee || 0), 0);
    
    // Calculate this month
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const thisMonthDeposits = deposits.filter(t => new Date(t.createdAt) >= thisMonth);
    const thisMonthWithdrawals = withdrawals.filter(t => new Date(t.createdAt) >= thisMonth);
    
    res.json({
      stats: {
        balance: user.wallet?.balance || 0,
        totalDeposits: deposits.reduce((sum, t) => sum + t.amount, 0),
        totalWithdrawals: withdrawals.reduce((sum, t) => sum + t.amount, 0),
        totalFees: fees,
        depositCount: deposits.length,
        withdrawalCount: withdrawals.length,
        thisMonth: {
          deposits: thisMonthDeposits.reduce((sum, t) => sum + t.amount, 0),
          withdrawals: thisMonthWithdrawals.reduce((sum, t) => sum + t.amount, 0)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/wallet/transactions
// @desc    Get all transactions
// @access  Private
router.get('/transactions', auth, async (req, res) => {
  try {
    const { type, limit = 50, offset = 0 } = req.query;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    let transactions = user.transactions || [];
    
    // Filter by type if specified
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }
    
    // Sort by date desc
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const total = transactions.length;
    const paginated = transactions.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    res.json({
      transactions: paginated,
      total,
      hasMore: total > parseInt(offset) + parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/wallet/deposit
// @desc    Create deposit with real validation
// @access  Private
router.post('/deposit', auth, async (req, res) => {
  try {
    const { amount, method, txId, currency = 'USDT', network = 'BSC' } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Validation stricte
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }
    
    // Minimum selon la méthode
    const minAmount = method === 'mobile_money' ? 1000 : 10;
    if (depositAmount < minAmount) {
      return res.status(400).json({ error: `Montant minimum: ${minAmount}` });
    }
    
    // Pour crypto: vérifier le txHash
    if (method === 'crypto' && (!txId || txId.length < 10)) {
      return res.status(400).json({ error: 'Transaction hash requis pour dépôt crypto' });
    }
    
    // Générer référence unique
    const reference = `DEP-${user._id}-${Date.now()}`;
    
    // Créer transaction avec statut pending (en attente confirmation)
    const transaction = {
      id: reference,
      type: 'deposit',
      amount: depositAmount,
      currency: currency,
      method: method || 'crypto',
      txHash: txId || null,
      network: network,
      status: 'pending',
      fee: 0,
      netAmount: depositAmount,
      createdAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };
    
    // Add to transactions
    if (!user.transactions) user.transactions = [];
    user.transactions.unshift(transaction);
    
    // Pour mobile money: ne pas créditer immédiatement
    // Pour crypto: créditer seulement après confirmation blockchain
    
    await user.save();
    
    // Log sécurité
    console.log(`[DEPOSIT] User ${user._id} initiated ${method} deposit of ${depositAmount} ${currency}`);
    
    res.json({
      success: true,
      message: 'Dépôt enregistré - En attente de confirmation',
      transaction,
      reference,
      nextSteps: method === 'crypto' 
        ? 'Votre dépôt sera crédité après confirmation blockchain (1-6 confirmations)'
        : 'Validez le paiement sur votre téléphone'
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Erreur lors du dépôt' });
  }
});

// @route   POST /api/wallet/withdrawal
// @desc    Create withdrawal request
// @access  Private
router.post('/withdrawal', auth, async (req, res) => {
  try {
    const { amount, address, method, fee = 0 } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const withdrawalAmount = parseFloat(amount);
    const totalDeduction = withdrawalAmount + parseFloat(fee);
    
    // Check balance
    if ((user.wallet?.balance || 0) < totalDeduction) {
      return res.status(400).json({ error: 'Solde insuffisant' });
    }
    
    // Create transaction record
    const transaction = {
      id: Date.now().toString(),
      type: 'withdrawal',
      amount: withdrawalAmount,
      fee: parseFloat(fee),
      method: method || 'crypto',
      address,
      status: 'pending',
      createdAt: new Date()
    };
    
    // Add to transactions
    if (!user.transactions) user.transactions = [];
    user.transactions.unshift(transaction);
    
    // Update wallet
    if (!user.wallet) user.wallet = { balance: 0, totalDeposits: 0, totalWithdrawals: 0 };
    user.wallet.balance -= totalDeduction;
    user.wallet.totalWithdrawals += withdrawalAmount;
    
    await user.save();
    
    res.json({
      message: 'Retrait enregistré',
      transaction,
      balance: user.wallet.balance
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/wallet/convert
// @desc    Convert currency using real Binance rates
// @access  Private
router.post('/convert', auth, async (req, res) => {
  try {
    const { fromCurrency, toCurrency, amount } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const convertAmount = parseFloat(amount);
    const fee = convertAmount * 0.005; // 0.5% fee

    // Get real conversion rate from Binance
    let rate = 1;
    try {
      const axios = require('axios');
      const symbol = `${fromCurrency}${toCurrency}`;
      const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, { timeout: 5000 });
      rate = parseFloat(response.data.price);
    } catch (binanceError) {
      // Fallback: try reverse pair
      try {
        const axios = require('axios');
        const reverseSymbol = `${toCurrency}${fromCurrency}`;
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${reverseSymbol}`, { timeout: 5000 });
        rate = 1 / parseFloat(response.data.price);
      } catch (reverseError) {
        // If both fail, check for USDT pairs
        if (fromCurrency !== 'USDT' && toCurrency !== 'USDT') {
          try {
            const axios = require('axios');
            const fromUSDT = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${fromCurrency}USDT`, { timeout: 5000 });
            const toUSDT = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${toCurrency}USDT`, { timeout: 5000 });
            rate = parseFloat(fromUSDT.data.price) / parseFloat(toUSDT.data.price);
          } catch (usdtError) {
            return res.status(400).json({ error: `Impossible d'obtenir le taux pour ${fromCurrency}/${toCurrency}` });
          }
        } else if (fromCurrency === 'USDT' && toCurrency === 'XOF') {
          // Use real USD to XOF rate
          const xofResponse = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 5000 });
          rate = xofResponse.data.rates.XOF || 605;
        } else {
          return res.status(400).json({ error: `Paire de conversion non supportée: ${fromCurrency}/${toCurrency}` });
        }
      }
    }

    const toAmount = (convertAmount * rate) - fee;
    
    // Create transaction record
    const transaction = {
      id: Date.now().toString(),
      type: 'conversion',
      amount: convertAmount,
      currency: fromCurrency,
      toAmount,
      toCurrency,
      fee,
      rate,
      status: 'completed',
      createdAt: new Date()
    };
    
    // Add to transactions
    if (!user.transactions) user.transactions = [];
    user.transactions.unshift(transaction);
    
    await user.save();
    
    res.json({
      message: 'Conversion effectuée',
      fromAmount: convertAmount,
      toAmount,
      rate,
      fee,
      transaction
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/wallet/transactions
// @desc    Get user transactions
// @access  Private
router.get('/transactions', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json({
      transactions: user.transactions || []
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/wallet/balance
// @desc    Get wallet balance
// @access  Private
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json({
      balance: user.wallet || { usdt: 0, btc: 0, eth: 0, xof: 0 }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/wallet/all
// @desc    Get all wallets (admin only)
// @access  Private/Admin
router.get('/all', auth, async (req, res) => {
  try {
    // Check if user is admin
    const admin = await User.findById(req.userId);
    if (!admin?.isAdmin) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    const users = await User.find({})
      .select('username displayName wallet transactions createdAt isBanned')
      .sort({ 'wallet.balance': -1 });
    
    const wallets = users.map(u => ({
      userId: u._id,
      username: u.username,
      displayName: u.displayName,
      balance: u.wallet?.balance || 0,
      totalDeposits: u.wallet?.totalDeposits || 0,
      totalWithdrawals: u.wallet?.totalWithdrawals || 0,
      transactionCount: u.transactions?.length || 0,
      createdAt: u.createdAt,
      isBanned: u.isBanned
    }));
    
    const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
    const totalDeposits = wallets.reduce((sum, w) => sum + w.totalDeposits, 0);
    const totalWithdrawals = wallets.reduce((sum, w) => sum + w.totalWithdrawals, 0);
    
    res.json({
      wallets: wallets.slice(0, 100),
      summary: {
        totalUsers: wallets.length,
        totalBalance,
        totalDeposits,
        totalWithdrawals,
        netBalance: totalDeposits - totalWithdrawals
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/wallet/deposit/orange-money
// @desc    Initialize Orange Money deposit
// @access  Private
router.post('/deposit/orange-money', auth, async (req, res) => {
  try {
    const { amount, phoneNumber } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Validate amount
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount < 1000) {
      return res.status(400).json({ error: 'Montant minimum: 1000 FCFA' });
    }
    
    // Generate reference
    const reference = `DEP-${user._id}-${Date.now()}`;
    
    // Initialize Orange Money payment
    const orangeMoney = require('../services/orangeMoney');
    const result = await orangeMoney.initializeDeposit(
      depositAmount,
      phoneNumber,
      reference,
      `Dépôt Crypto Trading Pro - ${depositAmount} FCFA`
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Erreur Orange Money' });
    }
    
    // Create pending transaction
    const transaction = {
      id: reference,
      type: 'deposit',
      amount: depositAmount,
      currency: 'XOF',
      toCurrency: 'USDT',
      status: 'pending',
      method: 'orange_money',
      phoneNumber: phoneNumber,
      orangeMoneyToken: result.paymentToken,
      orangeMoneyTxId: result.transactionId,
      paymentUrl: result.paymentUrl,
      createdAt: new Date()
    };
    
    if (!user.transactions) user.transactions = [];
    user.transactions.unshift(transaction);
    await user.save();
    
    res.json({
      success: true,
      message: 'Dépôt initié',
      transaction,
      paymentUrl: result.paymentUrl,
      reference
    });
  } catch (error) {
    console.error('Orange Money deposit error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'initialisation du dépôt' });
  }
});

// @route   POST /api/wallet/withdrawal/orange-money
// @desc    Process Orange Money withdrawal
// @access  Private
router.post('/withdrawal/orange-money', auth, async (req, res) => {
  try {
    const { amount, phoneNumber } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Validate amount
    const withdrawalAmount = parseFloat(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount < 5000) {
      return res.status(400).json({ error: 'Montant minimum: 5000 FCFA' });
    }
    
    // Check if user has sufficient balance
    const orangeMoney = require('../services/orangeMoney');
    const { usdt } = await orangeMoney.convertFCFAtoUSDT(withdrawalAmount);
    const fee = parseFloat(usdt) * 0.01; // 1% fee
    const totalDeduction = parseFloat(usdt) + fee;
    
    if ((user.wallet?.usdt || 0) < totalDeduction) {
      return res.status(400).json({ error: 'Solde insuffisant' });
    }
    
    // Generate reference
    const reference = `WIT-${user._id}-${Date.now()}`;
    
    // Process withdrawal via Orange Money
    const result = await orangeMoney.processWithdrawal(
      withdrawalAmount,
      phoneNumber,
      reference,
      `Retrait Crypto Trading Pro - ${withdrawalAmount} FCFA`
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Erreur Orange Money' });
    }
    
    // Deduct from wallet
    user.wallet.usdt -= totalDeduction;
    user.wallet.totalWithdrawals += totalDeduction;
    
    // Create transaction record
    const transaction = {
      id: reference,
      type: 'withdrawal',
      amount: withdrawalAmount,
      currency: 'XOF',
      fromCurrency: 'USDT',
      fromAmount: totalDeduction,
      status: 'completed',
      method: 'orange_money',
      phoneNumber: phoneNumber,
      orangeMoneyTxId: result.transactionId,
      fee: fee,
      createdAt: new Date()
    };
    
    if (!user.transactions) user.transactions = [];
    user.transactions.unshift(transaction);
    await user.save();
    
    res.json({
      success: true,
      message: 'Retrait effectué',
      transaction
    });
  } catch (error) {
    console.error('Orange Money withdrawal error:', error);
    res.status(500).json({ error: 'Erreur lors du retrait' });
  }
});

// @route   POST /api/wallet/deposit/binance
// @desc    Process crypto deposit via Binance
// @access  Private
router.post('/deposit/binance', auth, async (req, res) => {
  try {
    const { amount, currency, txHash, network } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Validate
    if (!txHash || txHash.length < 10) {
      return res.status(400).json({ error: 'Transaction hash invalide' });
    }
    
    // Generate reference
    const reference = `BIN-${user._id}-${Date.now()}`;
    
    // Create pending transaction (will be confirmed by webhook or manual check)
    const transaction = {
      id: reference,
      type: 'deposit',
      amount: parseFloat(amount),
      currency: currency,
      status: 'pending',
      method: 'binance',
      txHash: txHash,
      network: network || 'BSC',
      createdAt: new Date()
    };
    
    if (!user.transactions) user.transactions = [];
    user.transactions.unshift(transaction);
    await user.save();
    
    res.json({
      success: true,
      message: 'Dépôt en attente de confirmation',
      transaction
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du dépôt' });
  }
});

// @route   POST /api/wallet/webhook/orange-money
// @desc    Webhook pour confirmations Orange Money
// @access  Public (avec signature)
router.post('/webhook/orange-money', async (req, res) => {
  try {
    const { status, reference, transactionId, amount } = req.body;
    const signature = req.headers['x-orange-signature'];
    
    // Vérifier la signature
    const orangeMoney = require('../services/orangeMoney');
    const isValid = orangeMoney.verifyWebhookSignature(req.body, signature, process.env.ORANGE_MONEY_WEBHOOK_SECRET);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Signature invalide' });
    }
    
    // Trouver l'utilisateur par référence
    const user = await User.findOne({ 'transactions.id': reference });
    if (!user) {
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }
    
    const transaction = user.transactions.find(t => t.id === reference);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }
    
    if (status === 'SUCCESS') {
      transaction.status = 'completed';
      transaction.orangeMoneyTxId = transactionId;
      transaction.completedAt = new Date();
      
      // Créditer le wallet
      const { usdt } = await convertFCFAtoUSDT(parseFloat(amount));
      if (!user.wallet) user.wallet = { balance: 0, totalDeposits: 0, totalWithdrawals: 0 };
      user.wallet.balance += usdt;
      user.wallet.totalDeposits += usdt;
      
      // Notifier via Socket.IO
      const io = getIO();
      io.to(`user-${user._id}`).emit('deposit-completed', {
        transactionId: reference,
        amount: usdt,
        currency: 'USDT'
      });
    } else if (status === 'FAILED') {
      transaction.status = 'failed';
      transaction.failureReason = req.body.reason || 'Paiement échoué';
    }
    
    await user.save();
    res.json({ success: true });
    
  } catch (error) {
    console.error('Orange Money webhook error:', error);
    res.status(500).json({ error: 'Erreur webhook' });
  }
});

// @route   POST /api/wallet/confirm-deposit
// @desc    Confirmer un dépôt crypto (admin ou vérification auto)
// @access  Private/Admin
router.post('/confirm-deposit/:transactionId', auth, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status, txHash, confirmations } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    // Trouver la transaction chez tous les utilisateurs
    const targetUser = await User.findOne({ 'transactions.id': transactionId });
    if (!targetUser) {
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }
    
    const transaction = targetUser.transactions.find(t => t.id === transactionId);
    if (!transaction || transaction.type !== 'deposit') {
      return res.status(404).json({ error: 'Dépôt non trouvé' });
    }
    
    if (status === 'completed') {
      transaction.status = 'completed';
      transaction.txHash = txHash;
      transaction.confirmations = confirmations || 6;
      transaction.completedAt = new Date();
      
      // Créditer le wallet
      if (!targetUser.wallet) targetUser.wallet = { balance: 0, totalDeposits: 0, totalWithdrawals: 0 };
      targetUser.wallet.balance += transaction.netAmount || transaction.amount;
      targetUser.wallet.totalDeposits += transaction.netAmount || transaction.amount;
      
      // Notifier
      const io = getIO();
      io.to(`user-${targetUser._id}`).emit('deposit-completed', {
        transactionId,
        amount: transaction.amount,
        currency: transaction.currency
      });
    } else if (status === 'failed') {
      transaction.status = 'failed';
      transaction.failureReason = req.body.reason || 'Vérification échouée';
    }
    
    await targetUser.save();
    
    res.json({
      success: true,
      message: `Dépôt ${status}`,
      transaction
    });
    
  } catch (error) {
    console.error('Confirm deposit error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   GET /api/wallet/exchange-rate
// @desc    Get current USDT/XOF exchange rate
// @access  Public
router.get('/exchange-rate', async (req, res) => {
  try {
    const rate = await getUSDTToXOFRate();
    res.json({
      success: true,
      rate,
      from: 'USDT',
      to: 'XOF',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur taux de change' });
  }
});

// @route   POST /api/wallet/validate-address
// @desc    Validate crypto address
// @access  Private
router.post('/validate-address', auth, async (req, res) => {
  try {
    const { address, network } = req.body;
    
    // Validation basique par réseau
    const patterns = {
      'BTC': /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/,
      'ETH': /^0x[a-fA-F0-9]{40}$/,
      'BSC': /^0x[a-fA-F0-9]{40}$/,
      'TRX': /^T[a-zA-Z0-9]{33}$/,
      'SOL': /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    };
    
    const pattern = patterns[network];
    const isValid = pattern ? pattern.test(address) : address.length >= 10;
    
    res.json({
      success: true,
      valid: isValid,
      network
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur validation' });
  }
});

module.exports = router;
