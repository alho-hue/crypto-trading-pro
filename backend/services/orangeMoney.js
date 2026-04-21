/**
 * Orange Money Mali Integration Service
 * Handles deposits and withdrawals via Orange Money API
 */

const axios = require('axios');
const crypto = require('crypto');

// Orange Money API Configuration for Mali
const ORANGE_MONEY_CONFIG = {
  baseUrl: process.env.ORANGE_MONEY_BASE_URL || 'https://api.orange.com/orange-money-webpay/dev/v1',
  clientId: process.env.ORANGE_MONEY_CLIENT_ID,
  clientSecret: process.env.ORANGE_MONEY_CLIENT_SECRET,
  merchantId: process.env.ORANGE_MONEY_MERCHANT_ID,
  countryCode: 'ML', // Mali
  currency: 'OUV', // Orange Unit Value for West Africa
  merchantName: process.env.MERCHANT_NAME || 'NEUROVEST'
};

// Cache pour les taux de change
let rateCache = {
  usdtToXof: 605,
  lastUpdate: 0
};

// Récupérer le taux USD/XOF en temps réel
async function getExchangeRate() {
  const now = Date.now();
  if (now - rateCache.lastUpdate < 60000) { // Cache 1 minute
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
    console.error('Orange Money: Erreur taux de change:', error.message);
  }
  
  return 605; // Fallback
}

// Get OAuth2 Token from Orange Money
async function getAccessToken() {
  try {
    const auth = Buffer.from(`${ORANGE_MONEY_CONFIG.clientId}:${ORANGE_MONEY_CONFIG.clientSecret}`).toString('base64');
    
    const response = await axios.post(
      `${ORANGE_MONEY_CONFIG.baseUrl}/oauth/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );
    
    return response.data.access_token;
  } catch (error) {
    console.error('Orange Money auth error:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Orange Money');
  }
}

// Initialize a payment (deposit)
async function initializeDeposit(amount, phoneNumber, reference, description) {
  try {
    const token = await getAccessToken();
    
    // Format phone number (remove + if present)
    const formattedPhone = phoneNumber.replace(/^\+/, '');
    
    const paymentData = {
      merchant_id: ORANGE_MONEY_CONFIG.merchantId,
      merchant_name: ORANGE_MONEY_CONFIG.merchantName,
      return_url: `${process.env.FRONTEND_URL}/wallet/deposit/success`,
      cancel_url: `${process.env.FRONTEND_URL}/wallet/deposit/cancel`,
      notif_url: `${process.env.BACKEND_URL}/webhooks/orange-money/deposit`,
      lang: 'fr',
      reference: reference,
      order_id: reference,
      amount: {
        value: amount,
        unit: ORANGE_MONEY_CONFIG.currency
      },
      payer: {
        id: formattedPhone,
        name: 'Client'
      },
      payee: {
        id: ORANGE_MONEY_CONFIG.merchantId,
        name: ORANGE_MONEY_CONFIG.merchantName
      },
      description: description || `Dépôt ${ORANGE_MONEY_CONFIG.merchantName} - ${amount} FCFA`
    };
    
    const response = await axios.post(
      `${ORANGE_MONEY_CONFIG.baseUrl}/payment`,
      paymentData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    return {
      success: true,
      paymentToken: response.data.payment_token,
      paymentUrl: response.data.payment_url,
      transactionId: response.data.transaction_id,
      orderId: reference
    };
  } catch (error) {
    console.error('Orange Money deposit error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to initialize deposit'
    };
  }
}

// Check payment status
async function checkPaymentStatus(transactionId) {
  try {
    const token = await getAccessToken();
    
    const response = await axios.get(
      `${ORANGE_MONEY_CONFIG.baseUrl}/payment/${transactionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      }
    );
    
    return {
      success: true,
      status: response.data.status, // PENDING, SUCCESS, FAILED
      amount: response.data.amount,
      payer: response.data.payer,
      transactionId: response.data.transaction_id
    };
  } catch (error) {
    console.error('Check payment status error:', error.response?.data || error.message);
    return {
      success: false,
      error: 'Failed to check payment status'
    };
  }
}

// Process withdrawal (merchant to client)
async function processWithdrawal(amount, phoneNumber, reference, description) {
  try {
    const token = await getAccessToken();
    
    // Format phone number
    const formattedPhone = phoneNumber.replace(/^\+/, '');
    
    const withdrawalData = {
      merchant_id: ORANGE_MONEY_CONFIG.merchantId,
      order_id: reference,
      amount: {
        value: amount,
        unit: ORANGE_MONEY_CONFIG.currency
      },
      recipient: {
        id: formattedPhone,
        name: 'Client'
      },
      description: description || `Retrait NEUROVEST - ${amount} FCFA`,
      reference: reference
    };
    
    const response = await axios.post(
      `${ORANGE_MONEY_CONFIG.baseUrl}/transfer`,
      withdrawalData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    return {
      success: true,
      transactionId: response.data.transaction_id,
      status: response.data.status,
      amount: amount,
      recipient: formattedPhone
    };
  } catch (error) {
    console.error('Orange Money withdrawal error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to process withdrawal'
    };
  }
}

// Verify webhook signature
function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}

// Convert FCFA to USDT using real-time exchange rate
async function convertFCFAtoUSDT(amountFCFA) {
  const rate = await getExchangeRate();
  return {
    usdt: parseFloat((amountFCFA / rate).toFixed(6)),
    rate: rate
  };
}

// Convert USDT to FCFA using real-time exchange rate
async function convertUSDTtoFCFA(amountUSDT) {
  const rate = await getExchangeRate();
  return {
    fcfa: Math.floor(amountUSDT * rate),
    rate: rate
  };
}

module.exports = {
  initializeDeposit,
  checkPaymentStatus,
  processWithdrawal,
  verifyWebhookSignature,
  convertFCFAtoUSDT,
  convertUSDTtoFCFA,
  getAccessToken
};
