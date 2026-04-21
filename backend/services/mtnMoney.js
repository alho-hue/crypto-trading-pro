/**
 * MTN Mobile Money Integration Service
 * Handles deposits and withdrawals via MTN MoMo API
 */

const axios = require('axios');
const crypto = require('crypto');

// MTN MoMo API Configuration
const MTN_CONFIG = {
  baseUrl: process.env.MTN_MONEY_BASE_URL || 'https://sandbox.momodeveloper.mtn.com', // Production: https://momodeveloper.mtn.com
  apiUser: process.env.MTN_API_USER,
  apiKey: process.env.MTN_API_KEY,
  subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY,
  targetEnvironment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
};

// Get OAuth token
async function getAccessToken() {
  try {
    const auth = Buffer.from(`${MTN_CONFIG.apiUser}:${MTN_CONFIG.apiKey}`).toString('base64');
    
    const response = await axios.post(
      `${MTN_CONFIG.baseUrl}/collection/token/`,
      {},
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Ocp-Apim-Subscription-Key': MTN_CONFIG.subscriptionKey
        }
      }
    );
    
    return response.data.access_token;
  } catch (error) {
    console.error('MTN auth error:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with MTN MoMo');
  }
}

// Request payment (deposit)
async function initializeDeposit(amount, phoneNumber, reference, description) {
  try {
    const token = await getAccessToken();
    
    // Format phone number with country code
    const formattedPhone = phoneNumber.replace(/\s/g, '');
    if (!formattedPhone.startsWith('+')) {
      // Default to Ivory Coast if no country code
      formattedPhone = '+225' + formattedPhone.replace(/^0/, '');
    }
    
    const paymentData = {
      amount: amount.toString(),
      currency: 'XOF',
      externalId: reference,
      payer: {
        partyIdType: 'MSISDN',
        partyId: formattedPhone
      },
      payerMessage: description || `Dépôt NEUROVEST`,
      payeeNote: `Reference: ${reference}`
    };
    
    const response = await axios.post(
      `${MTN_CONFIG.baseUrl}/collection/v1_0/requesttopay`,
      paymentData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Reference-Id': reference,
          'X-Target-Environment': MTN_CONFIG.targetEnvironment,
          'Ocp-Apim-Subscription-Key': MTN_CONFIG.subscriptionKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      success: true,
      transactionId: reference,
      status: 'pending',
      orderId: reference,
      message: 'Payment request sent to customer'
    };
  } catch (error) {
    console.error('MTN deposit error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to initialize MTN deposit'
    };
  }
}

// Check payment status
async function checkPaymentStatus(transactionId) {
  try {
    const token = await getAccessToken();
    
    const response = await axios.get(
      `${MTN_CONFIG.baseUrl}/collection/v1_0/requesttopay/${transactionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Target-Environment': MTN_CONFIG.targetEnvironment,
          'Ocp-Apim-Subscription-Key': MTN_CONFIG.subscriptionKey
        }
      }
    );
    
    return {
      success: true,
      status: response.data.status, // PENDING, SUCCESSFUL, FAILED
      amount: parseFloat(response.data.amount),
      currency: response.data.currency,
      financialTransactionId: response.data.financialTransactionId,
      payer: response.data.payer
    };
  } catch (error) {
    console.error('MTN check status error:', error.response?.data || error.message);
    return {
      success: false,
      error: 'Failed to check payment status'
    };
  }
}

// Process withdrawal (transfer)
async function processWithdrawal(amount, phoneNumber, reference, description) {
  try {
    const token = await getAccessToken();
    
    const formattedPhone = phoneNumber.replace(/\s/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+225' + formattedPhone.replace(/^0/, '');
    }
    
    const transferData = {
      amount: amount.toString(),
      currency: 'XOF',
      externalId: reference,
      payee: {
        partyIdType: 'MSISDN',
        partyId: formattedPhone
      },
      payerMessage: description || `Retrait NEUROVEST`,
      payeeNote: `Reference: ${reference}`
    };
    
    const response = await axios.post(
      `${MTN_CONFIG.baseUrl}/disbursement/v1_0/transfer`,
      transferData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Reference-Id': reference,
          'X-Target-Environment': MTN_CONFIG.targetEnvironment,
          'Ocp-Apim-Subscription-Key': process.env.MTN_DISBURSEMENT_SUBSCRIPTION_KEY || MTN_CONFIG.subscriptionKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      success: true,
      transactionId: reference,
      status: 'pending',
      amount: amount,
      recipient: formattedPhone
    };
  } catch (error) {
    console.error('MTN withdrawal error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to process withdrawal'
    };
  }
}

// Verify callback auth
function verifyCallbackAuth(authHeader, subscriptionKey) {
  return authHeader === `Bearer ${subscriptionKey}`;
}

// Check if credentials are configured
function isConfigured() {
  return !!(MTN_CONFIG.apiUser && MTN_CONFIG.apiKey && MTN_CONFIG.subscriptionKey);
}

module.exports = {
  initializeDeposit,
  checkPaymentStatus,
  processWithdrawal,
  verifyCallbackAuth,
  isConfigured
};
