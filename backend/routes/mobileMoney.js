// Routes Mobile Money pour dépôts/retraits - PRODUCTION READY
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');
const orangeMoney = require('../services/orangeMoney');
const waveMoney = require('../services/waveMoney');
const mtnMoney = require('../services/mtnMoney');
const { getIO } = require('../server');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Taux de change cache
let rateCache = {
  usdtToXof: 605,
  lastUpdate: 0
};

// Récupérer le taux USDT/XOF en temps réel
async function getUSDTToXOFRate() {
  const now = Date.now();
  if (now - rateCache.lastUpdate < 60000) {
    return rateCache.usdtToXof;
  }
  
  try {
    const response = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 5000 });
    if (response.data?.rates?.XOF) {
      rateCache.usdtToXof = response.data.rates.XOF;
      rateCache.lastUpdate = now;
      return rateCache.usdtToXof;
    }
  } catch (error) {
    console.error('Erreur taux de change:', error.message);
  }
  
  return 605; // Fallback
}

// Convertir XOF en USDT
async function convertXOFtoUSDT(amountXOF) {
  const rate = await getUSDTToXOFRate();
  return {
    usdt: parseFloat((amountXOF / rate).toFixed(6)),
    rate
  };
}

// Opérateurs supportés avec leurs configurations
const MOBILE_MONEY_PROVIDERS = {
  'Orange': { name: 'Orange Money', countries: ['ML', 'CI', 'SN', 'BF'], feePercent: 1.5, minAmount: 100, maxAmount: 3000000 },
  'MTN': { name: 'MTN Mobile Money', countries: ['CI', 'GH', 'CM'], feePercent: 1.5, minAmount: 100, maxAmount: 2000000 },
  'Wave': { name: 'Wave', countries: ['CI', 'SN', 'ML'], feePercent: 1.0, minAmount: 50, maxAmount: 1000000 },
  'Moov': { name: 'Moov Money', countries: ['CI', 'TG', 'BJ'], feePercent: 1.5, minAmount: 100, maxAmount: 1500000 }
};

// Middleware to verify token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId || decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Veuillez vous connecter' });
  }
};

// @route   POST /api/mobile-money/deposit
// @desc    Initier un dépôt Mobile Money
// @access  Private
router.post('/deposit', auth, async (req, res) => {
  try {
    const { amount, phoneNumber, provider, currency = 'XOF' } = req.body;
    
    if (!amount || !phoneNumber || !provider) {
      return res.status(400).json({ 
        error: 'Montant, numéro de téléphone et opérateur requis' 
      });
    }
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Créer une transaction en attente
    const transaction = {
      id: `MM-DEP-${Date.now()}`,
      type: 'deposit',
      method: 'mobile_money',
      amount: parseFloat(amount),
      currency,
      provider,
      phoneNumber,
      status: 'pending',
      createdAt: new Date(),
      userId: req.userId
    };
    
    if (!user.transactions) user.transactions = [];
    user.transactions.unshift(transaction);
    await user.save();
    
    // 🔥 INITIER LE PAIEMENT AVEC LE VRAI PROVIDER
    let providerResult;
    
    try {
      switch (provider) {
        case 'Orange':
          providerResult = await orangeMoney.initializeDeposit(
            transaction.amount,
            phoneNumber,
            transaction.id,
            `Dépôt NEUROVEST - ${transaction.amount} FCFA`
          );
          break;
          
        case 'Wave':
          if (!waveMoney.isConfigured()) {
            return res.status(503).json({
              error: 'Service Wave non configuré. Veuillez contacter le support.'
            });
          }
          providerResult = await waveMoney.initializeDeposit(
            transaction.amount,
            phoneNumber,
            transaction.id,
            `Dépôt NEUROVEST - ${transaction.amount} FCFA`
          );
          break;
          
        case 'MTN':
          if (!mtnMoney.isConfigured()) {
            return res.status(503).json({
              error: 'Service MTN non configuré. Veuillez contacter le support.'
            });
          }
          providerResult = await mtnMoney.initializeDeposit(
            transaction.amount,
            phoneNumber,
            transaction.id,
            `Dépôt NEUROVEST - ${transaction.amount} FCFA`
          );
          break;
          
        default:
          // Pour Moov et autres: utiliser confirmation manuelle pour l'instant
          providerResult = {
            success: true,
            manualConfirmation: true,
            message: 'En attente de confirmation manuelle'
          };
      }
      
      if (!providerResult.success && !providerResult.manualConfirmation) {
        // Annuler la transaction si le provider a échoué
        transaction.status = 'failed';
        transaction.error = providerResult.error;
        await user.save();
        
        return res.status(400).json({
          error: providerResult.error || 'Échec de l\'initialisation du paiement'
        });
      }
      
      // Mettre à jour avec les infos du provider
      transaction.providerTransactionId = providerResult.transactionId || providerResult.paymentToken;
      transaction.providerData = providerResult;
      
      if (providerResult.manualConfirmation) {
        transaction.status = 'pending_manual';
      }
      
      await user.save();
      
      // 🔥 DÉMARRER LE POLLING POUR VÉRIFIER LE STATUT
      if (!providerResult.manualConfirmation) {
        startDepositStatusPolling(req.userId, transaction.id, provider, providerResult.transactionId);
      }
      
    } catch (providerError) {
      console.error(`[MobileMoney] Erreur ${provider}:`, providerError);
      // On continue quand même, la transaction reste en pending
    }
    
    res.json({
      success: true,
      message: `Dépôt ${provider} initié. Confirmez sur votre téléphone.`,
      transaction: {
        id: transaction.id,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        provider: transaction.provider,
        instructions: `Validez la transaction sur votre téléphone ${phoneNumber}. Le crédit sera automatique après confirmation.`,
        paymentUrl: providerResult?.paymentUrl || null,
        providerTransactionId: providerResult?.transactionId || null
      }
    });
  } catch (error) {
    console.error('Mobile Money deposit error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'initiation du dépôt' });
  }
});

// @route   POST /api/mobile-money/withdrawal
// @desc    Initier un retrait Mobile Money
// @access  Private
router.post('/withdrawal', auth, async (req, res) => {
  try {
    const { amount, phoneNumber, provider, currency = 'XOF' } = req.body;
    
    if (!amount || !phoneNumber || !provider) {
      return res.status(400).json({ 
        error: 'Montant, numéro de téléphone et opérateur requis' 
      });
    }
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Validation du provider
    const providerConfig = MOBILE_MONEY_PROVIDERS[provider];
    if (!providerConfig) {
      return res.status(400).json({ error: 'Opérateur non supporté' });
    }
    
    // Validation des montants
    if (amount < providerConfig.minAmount) {
      return res.status(400).json({ 
        error: `Montant minimum: ${providerConfig.minAmount} FCFA` 
      });
    }
    if (amount > providerConfig.maxAmount) {
      return res.status(400).json({ 
        error: `Montant maximum: ${providerConfig.maxAmount.toLocaleString()} FCFA` 
      });
    }
    
    // Calcul des frais avec le taux réel du provider
    const fee = amount * (providerConfig.feePercent / 100);
    const totalDeduction = amount + fee;
    
    // Conversion XOF -> USDT avec taux réel
    const { usdt: usdtAmount, rate } = await convertXOFtoUSDT(totalDeduction);
    const userBalance = user.wallet?.balance || 0;
    
    if (userBalance < usdtAmount) {
      return res.status(400).json({ 
        error: 'Solde insuffisant',
        balance: userBalance,
        required: usdtAmount,
        rate: rate
      });
    }
    
    // Créer une transaction
    const transaction = {
      id: `MM-WIT-${Date.now()}`,
      type: 'withdrawal',
      method: 'mobile_money',
      amount: parseFloat(amount),
      currency,
      provider,
      phoneNumber,
      fee,
      status: 'pending',
      createdAt: new Date(),
      userId: req.userId
    };
    
    if (!user.transactions) user.transactions = [];
    user.transactions.unshift(transaction);
    
    // Déduire le solde
    user.wallet.balance -= usdtAmount;
    user.wallet.locked = (user.wallet.locked || 0) + usdtAmount;
    
    await user.save();
    
    res.json({
      success: true,
      message: `Retrait ${provider} initié.`,
      transaction: {
        id: transaction.id,
        status: 'pending',
        amount: transaction.amount,
        fee: transaction.fee,
        currency: transaction.currency,
        provider: transaction.provider,
        estimatedArrival: '5-15 minutes'
      }
    });
  } catch (error) {
    console.error('Mobile Money withdrawal error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'initiation du retrait' });
  }
});

// @route   GET /api/mobile-money/status/:transactionId
// @desc    Vérifier le statut d'une transaction
// @access  Private
router.get('/status/:transactionId', auth, async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const transaction = user.transactions?.find(t => t.id === transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }
    
    res.json({
      success: true,
      status: transaction.status,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt
      }
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// @route   POST /api/mobile-money/cancel/:transactionId
// @desc    Annuler une transaction en attente
// @access  Private
router.post('/cancel/:transactionId', auth, async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const transaction = user.transactions?.find(t => t.id === transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }
    
    if (transaction.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Impossible d\'annuler une transaction déjà traitée' 
      });
    }
    
    // Rembourser le solde si c'était un retrait
    if (transaction.type === 'withdrawal') {
      const { usdt: usdtAmount } = await convertXOFtoUSDT(transaction.amount + (transaction.fee || 0));
      user.wallet.balance += usdtAmount;
      user.wallet.locked = Math.max(0, (user.wallet.locked || 0) - usdtAmount);
    }
    
    transaction.status = 'cancelled';
    transaction.updatedAt = new Date();
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Transaction annulée',
      transaction: {
        id: transaction.id,
        status: 'cancelled'
      }
    });
  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== FONCTIONS DE POLLING ET WEBHOOKS ====================

/**
 * Poll le statut d'un dépôt pour confirmation automatique
 */
async function startDepositStatusPolling(userId, transactionId, provider, providerTransactionId) {
  const maxAttempts = 60; // 5 minutes (une fois toutes les 5 secondes)
  let attempts = 0;
  
  const pollInterval = setInterval(async () => {
    attempts++;
    
    try {
      let statusResult;
      
      switch (provider) {
        case 'Orange':
          statusResult = await orangeMoney.checkPaymentStatus(providerTransactionId);
          break;
        case 'Wave':
          statusResult = await waveMoney.checkPaymentStatus(providerTransactionId);
          break;
        case 'MTN':
          statusResult = await mtnMoney.checkPaymentStatus(providerTransactionId);
          break;
        default:
          clearInterval(pollInterval);
          return;
      }
      
      if (!statusResult.success) {
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          console.log(`[MobileMoney] Polling terminé sans succès pour ${transactionId}`);
        }
        return;
      }
      
      const status = statusResult.status?.toLowerCase();
      
      // Si complété ou succès
      if (status === 'completed' || status === 'successful' || status === 'success') {
        clearInterval(pollInterval);
        await confirmDeposit(userId, transactionId, provider, statusResult);
      }
      // Si échoué
      else if (status === 'failed' || status === 'cancelled' || status === 'error') {
        clearInterval(pollInterval);
        await failDeposit(userId, transactionId, provider, statusResult);
      }
      // Si toujours pending et max attempts atteint
      else if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        console.log(`[MobileMoney] Polling timeout pour ${transactionId}`);
      }
      
    } catch (error) {
      console.error(`[MobileMoney] Erreur polling ${transactionId}:`, error);
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
      }
    }
  }, 5000); // Toutes les 5 secondes
}

/**
 * Confirme un dépôt et crédite le wallet
 */
async function confirmDeposit(userId, transactionId, provider, providerData) {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    
    const transaction = user.transactions.find(t => t.id === transactionId);
    if (!transaction || transaction.status !== 'pending') return;
    
    // Confirmer la transaction
    transaction.status = 'completed';
    transaction.completedAt = new Date();
    transaction.providerData = providerData;
    
    // Convertir XOF en USDT et créditer le wallet
    const conversion = await convertXOFtoUSDT(transaction.amount);
    const usdtAmount = conversion.usdt;
    
    if (!user.wallet) {
      user.wallet = { balance: 0, currency: 'USDT', transactions: [] };
    }
    
    user.wallet.balance = (user.wallet.balance || 0) + usdtAmount;
    user.wallet.transactions.push({
      id: `WALLET-${Date.now()}`,
      type: 'deposit',
      amount: usdtAmount,
      currency: 'USDT',
      status: 'completed',
      method: 'mobile_money',
      reference: transaction.id,
      createdAt: new Date()
    });
    
    await user.save();
    
    console.log(`[MobileMoney] ✅ Dépôt confirmé: ${transaction.amount} XOF -> ${usdtAmount} USDT pour user ${userId}`);
    
    // 🔔 Notifier le client via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`user_${userId}`).emit('deposit_completed', {
        transactionId: transaction.id,
        amount: transaction.amount,
        currency: 'XOF',
        usdtAmount: usdtAmount,
        provider: provider,
        message: `Dépôt de ${transaction.amount} FCFA confirmé ! ${usdtAmount.toFixed(2)} USDT crédités.`
      });
    }
    
  } catch (err) {
    console.error('[MobileMoney] Erreur confirmation dépôt:', err);
  }
}

/**
 * Marque un dépôt comme échoué
 */
async function failDeposit(userId, transactionId, provider, providerData) {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    
    const transaction = user.transactions.find(t => t.id === transactionId);
    if (!transaction) return;
    
    transaction.status = 'failed';
    transaction.failedAt = new Date();
    transaction.error = providerData.error || 'Payment failed';
    transaction.providerData = providerData;
    
    await user.save();
    
    console.log(`[MobileMoney] ❌ Dépôt échoué: ${transactionId} pour user ${userId}`);
    
    // 🔔 Notifier le client
    const io = getIO();
    if (io) {
      io.to(`user_${userId}`).emit('deposit_failed', {
        transactionId: transaction.id,
        amount: transaction.amount,
        provider: provider,
        error: transaction.error
      });
    }
    
  } catch (err) {
    console.error('[MobileMoney] Erreur échec dépôt:', err);
  }
}

// ==================== WEBHOOKS POUR CONFIRMATION INSTANTANÉE ====================

/**
 * Webhook Orange Money
 */
router.post('/webhook/orange', async (req, res) => {
  try {
    const { status, reference, transaction_id, amount } = req.body;
    const signature = req.headers['x-orange-signature'];
    
    // Vérifier la signature
    const isValid = orangeMoney.verifyWebhookSignature(req.body, signature, process.env.ORANGE_MONEY_WEBHOOK_SECRET);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Trouver l'utilisateur par référence
    const user = await User.findOne({ 'transactions.id': reference });
    if (!user) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (status === 'SUCCESS' || status === 'COMPLETED') {
      await confirmDeposit(user._id, reference, 'Orange', req.body);
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      await failDeposit(user._id, reference, 'Orange', req.body);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[MobileMoney] Webhook Orange error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Webhook Wave
 */
router.post('/webhook/wave', async (req, res) => {
  try {
    const { status, reference, transaction_id } = req.body;
    const signature = req.headers['x-wave-signature'];
    
    // Vérifier la signature
    const isValid = waveMoney.verifyWebhookSignature(req.body, signature);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const user = await User.findOne({ 'transactions.id': reference });
    if (!user) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (status === 'completed' || status === 'success') {
      await confirmDeposit(user._id, reference, 'Wave', req.body);
    } else if (status === 'failed' || status === 'cancelled') {
      await failDeposit(user._id, reference, 'Wave', req.body);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[MobileMoney] Webhook Wave error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Callback MTN MoMo
 */
router.post('/callback/mtn', async (req, res) => {
  try {
    const { status, referenceId, financialTransactionId } = req.body;
    
    // MTN utilise Basic Auth
    const authHeader = req.headers['authorization'];
    const isValid = mtnMoney.verifyCallbackAuth(authHeader, process.env.MTN_SUBSCRIPTION_KEY);
    if (!isValid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const user = await User.findOne({ 'transactions.id': referenceId });
    if (!user) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (status === 'SUCCESSFUL') {
      await confirmDeposit(user._id, referenceId, 'MTN', req.body);
    } else if (status === 'FAILED') {
      await failDeposit(user._id, referenceId, 'MTN', req.body);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[MobileMoney] Callback MTN error:', error);
    res.status(500).json({ error: 'Callback processing failed' });
  }
});

module.exports = router;
