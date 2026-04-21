/**
 * Wave Money Integration Service
 * Handles deposits and withdrawals via Wave API
 */

const axios = require('axios');
const crypto = require('crypto');

// Wave API Configuration
const WAVE_CONFIG = {
  baseUrl: process.env.WAVE_MONEY_BASE_URL || 'https://api.wave.com/v1',
  apiKey: process.env.WAVE_API_KEY,
  apiSecret: process.env.WAVE_API_SECRET,
  merchantId: process.env.WAVE_MERCHANT_ID,
  webhookSecret: process.env.WAVE_WEBHOOK_SECRET
};

// Initialize a deposit via Wave
async function initializeDeposit(amount, phoneNumber, reference, description) {
  try {
    // Format phone number
    const formattedPhone = phoneNumber.replace(/^\+/, '').replace(/\s/g, '');
    
    const paymentData = {
      amount: amount,
      currency: 'XOF',
      phone_number: formattedPhone,
      reference: reference,
      description: description || `Dépôt NEUROVEST - ${amount} FCFA`,
      callback_url: `${process.env.BACKEND_URL}/api/wallet/webhook/wave`,
      metadata: {
        source: 'neurovest',
        type: 'deposit'
      }
    };
    
    const response = await axios.post(
      `${WAVE_CONFIG.baseUrl}/payments`,
      paymentData,
      {
        headers: {
          'Authorization': `Bearer ${WAVE_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
          'X-Merchant-ID': WAVE_CONFIG.merchantId
        }
      }
    );
    
    return {
      success: true,
      paymentUrl: response.data.payment_url,
      transactionId: response.data.transaction_id,
      orderId: reference,
      status: response.data.status
    };
  } catch (error) {
    console.error('Wave deposit error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to initialize Wave deposit'
    };
  }
}

// Check payment status
async function checkPaymentStatus(transactionId) {
  try {
    const response = await axios.get(
      `${WAVE_CONFIG.baseUrl}/payments/${transactionId}`,
      {
        headers: {
          'Authorization': `Bearer ${WAVE_CONFIG.apiKey}`,
          'X-Merchant-ID': WAVE_CONFIG.merchantId
        }
      }
    );
    
    return {
      success: true,
      status: response.data.status, // pending, completed, failed
      amount: response.data.amount,
      phoneNumber: response.data.phone_number,
      transactionId: response.data.transaction_id,
      paidAt: response.data.paid_at
    };
  } catch (error) {
    console.error('Wave check status error:', error.response?.data || error.message);
    return {
      success: false,
      error: 'Failed to check payment status'
    };
  }
}

// Process withdrawal
async function processWithdrawal(amount, phoneNumber, reference, description) {
  try {
    const formattedPhone = phoneNumber.replace(/^\+/, '').replace(/\s/g, '');
    
    const withdrawalData = {
      amount: amount,
      currency: 'XOF',
      phone_number: formattedPhone,
      reference: reference,
      description: description || `Retrait NEUROVEST - ${amount} FCFA`,
      callback_url: `${process.env.BACKEND_URL}/api/wallet/webhook/wave`,
      metadata: {
        source: 'neurovest',
        type: 'withdrawal'
      }
    };
    
    const response = await axios.post(
      `${WAVE_CONFIG.baseUrl}/transfers`,
      withdrawalData,
      {
        headers: {
          'Authorization': `Bearer ${WAVE_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
          'X-Merchant-ID': WAVE_CONFIG.merchantId
        }
      }
    );
    
    return {
      success: true,
      transactionId: response.data.transaction_id,
      status: response.data.status,
      amount: amount,
      recipient: formattedPhone,
      processedAt: response.data.processed_at
    };
  } catch (error) {
    console.error('Wave withdrawal error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to process withdrawal'
    };
  }
}

// Verify webhook signature
function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret || WAVE_CONFIG.webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}

// Check if credentials are configured
function isConfigured() {
  return !!(WAVE_CONFIG.apiKey && WAVE_CONFIG.apiSecret && WAVE_CONFIG.merchantId);
}

module.exports = {
  initializeDeposit,
  checkPaymentStatus,
  processWithdrawal,
  verifyWebhookSignature,
  isConfigured
};
