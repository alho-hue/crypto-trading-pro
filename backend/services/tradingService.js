/**
 * NEUROVEST - Trading Service Sécurisé
 * Service backend unifié pour le trading Spot et Futures sur Binance
 * 
 * SÉCURITÉ: Les clés API ne jamais quitter le backend
 * FIABILITÉ: Retry automatique, gestion erreurs robuste
 * RISQUES: Validation 1-2% max capital, SL/TP obligatoires
 */

const binanceService = require('./binanceServiceUnified');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  RISK: {
    MAX_POSITION_PERCENT: 100,      // 100% max du capital par trade (pas de limite stricte)
    MIN_POSITION_PERCENT: 0.001,    // 0.001% min (presque pas de limite)
    SL_TP_REQUIRED: true,           // Stop Loss et Take Profit obligatoires
    DEFAULT_SL_PERCENT: 2,          // SL par défaut: 2%
    DEFAULT_TP_PERCENT: 4,         // TP par défaut: 4% (ratio 1:2)
    MIN_RISK_REWARD_RATIO: 0.1,    // Ratio minimum très permissif (0.1:1)
  },
  
  FEES: {
    SPOT_MAKER: 0.001,             // 0.1%
    SPOT_TAKER: 0.001,             // 0.1%
    FUTURES_MAKER: 0.0002,         // 0.02%
    FUTURES_TAKER: 0.0004,         // 0.04%
  },
  
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY_MS: 1000,
  },
  
  DEMO: {
    INITIAL_BALANCE: 10000,        // $10,000 en mode démo
    DATA_FILE: 'demo_trading.json'
  }
};

// Logger structuré
const logger = {
  info: (msg, meta = {}) => console.log(`[TRADING][INFO] ${new Date().toISOString()} - ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`[TRADING][ERROR] ${new Date().toISOString()} - ${msg}`, meta),
  warn: (msg, meta = {}) => console.warn(`[TRADING][WARN] ${new Date().toISOString()} - ${msg}`, meta),
  trade: (msg, meta = {}) => console.log(`[TRADING][TRADE] ${new Date().toISOString()} - ${msg}`, meta)
};

/**
 * Retry avec exponential backoff
 */
async function withRetry(operation, context = '', maxAttempts = CONFIG.RETRY.MAX_ATTEMPTS) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isRetryable = error.code === 'ECONNRESET' || 
                         error.code === 'ETIMEDOUT' ||
                         error.code === 'ENOTFOUND' ||
                         error.response?.status >= 500 ||
                         error.response?.status === 429;
      
      if (!isRetryable || attempt === maxAttempts) {
        logger.error(`Operation failed ${context}`, { 
          attempt, 
          error: error.message,
          code: error.code || error.response?.status 
        });
        throw error;
      }

      const delay = CONFIG.RETRY.BASE_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn(`Retry ${attempt}/${maxAttempts} after ${delay}ms ${context}`, {
        error: error.message
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * ==================== GESTION DES RISQUES ====================
 */

class RiskManager {
  /**
   * Vérifie si le trade respecte les limites de risque
   */
  static validateTrade(params, accountBalance) {
    const { symbol, side, quantity, price, stopLoss, takeProfit, type } = params;
    const errors = [];

    // Vérifier présence SL/TP si obligatoires
    if (CONFIG.RISK.SL_TP_REQUIRED) {
      if (!stopLoss || stopLoss <= 0) {
        errors.push(`Stop Loss obligatoire (min: 0)`);
      }
      if (!takeProfit || takeProfit <= 0) {
        errors.push(`Take Profit obligatoire (min: 0)`);
      }
    }

    // Calculer valeur de la position
    const positionValue = quantity * price;
    const positionPercent = (positionValue / accountBalance) * 100;

    // Vérifier taille position (limites très permissives)
    if (positionPercent > CONFIG.RISK.MAX_POSITION_PERCENT) {
      errors.push(`Position trop grande: ${positionPercent.toFixed(2)}% > ${CONFIG.RISK.MAX_POSITION_PERCENT}% max`);
    }
    if (positionPercent < CONFIG.RISK.MIN_POSITION_PERCENT && positionValue > 0.01) {
      errors.push(`Position trop petite: ${positionPercent.toFixed(3)}% < ${CONFIG.RISK.MIN_POSITION_PERCENT}% min`);
    }

    // Vérifier ratio Risk/Reward minimum très permissif
    if (stopLoss && takeProfit) {
      const risk = Math.abs(price - stopLoss);
      const reward = Math.abs(takeProfit - price);
      const ratio = reward / risk;
      const minRatio = CONFIG.RISK.MIN_RISK_REWARD_RATIO || 0.1;
      
      if (ratio < minRatio) {
        errors.push(`Risk/Reward ratio insuffisant: ${ratio.toFixed(2)} < ${minRatio} min`);
      }
    }

    // Vérifier solde suffisant
    if (positionValue > accountBalance * 1.01) { // 1% marge pour frais
      errors.push(`Solde insuffisant: ${positionValue.toFixed(2)} USDT requis`);
    }

    return {
      valid: errors.length === 0,
      errors,
      positionPercent,
      riskRewardRatio: stopLoss && takeProfit ? 
        Math.abs(takeProfit - price) / Math.abs(price - stopLoss) : 0
    };
  }

  /**
   * Calcule les SL/TP par défaut si non fournis
   */
  static calculateDefaultLevels(price, side) {
    const slPercent = CONFIG.RISK.DEFAULT_SL_PERCENT / 100;
    const tpPercent = CONFIG.RISK.DEFAULT_TP_PERCENT / 100;
    
    if (side === 'BUY' || side === 'LONG') {
      return {
        stopLoss: price * (1 - slPercent),
        takeProfit: price * (1 + tpPercent)
      };
    } else {
      return {
        stopLoss: price * (1 + slPercent),
        takeProfit: price * (1 - tpPercent)
      };
    }
  }
}

/**
 * ==================== CALCUL PnL ====================
 */

class PnLCalculator {
  /**
   * Calcule le PnL d'une position
   */
  static calculatePositionPnL(position, currentPrice) {
    const entryPrice = parseFloat(position.entryPrice);
    const positionAmt = parseFloat(position.positionAmt);
    const isLong = positionAmt > 0;
    
    const rawPnl = isLong 
      ? (currentPrice - entryPrice) * Math.abs(positionAmt)
      : (entryPrice - currentPrice) * Math.abs(positionAmt);
    
    // Estimation des frais (taker fee sur l'ouverture + fermeture)
    const fees = Math.abs(positionAmt) * entryPrice * CONFIG.FEES.FUTURES_TAKER * 2;
    
    const netPnl = rawPnl - fees;
    const pnlPercent = (netPnl / (Math.abs(positionAmt) * entryPrice)) * 100;
    
    return {
      rawPnl,
      fees,
      netPnl,
      pnlPercent,
      isLong
    };
  }

  /**
   * Calcule le PnL d'un trade complété
   */
  static calculateTradePnL(entry, exit, quantity, side, fees = null) {
    const grossPnl = side === 'BUY' || side === 'LONG'
      ? (exit - entry) * quantity
      : (entry - exit) * quantity;
    
    const calculatedFees = fees || (entry * quantity * CONFIG.FEES.FUTURES_TAKER * 2);
    const netPnl = grossPnl - calculatedFees;
    
    return {
      grossPnl,
      fees: calculatedFees,
      netPnl,
      pnlPercent: (netPnl / (entry * quantity)) * 100
    };
  }
}

/**
 * ==================== MODE DÉMO ====================
 */

class DemoTradingManager {
  constructor() {
    this.dataPath = path.join(__dirname, '..', 'data', CONFIG.DEMO.DATA_FILE);
    this.data = null;
  }

  async loadData() {
    try {
      const content = await fs.readFile(this.dataPath, 'utf8');
      this.data = JSON.parse(content);
    } catch (error) {
      // Initialiser si fichier n'existe pas
      this.data = {
        balance: CONFIG.DEMO.INITIAL_BALANCE,
        positions: [],
        orders: [],
        trades: [],
        createdAt: Date.now()
      };
      await this.saveData();
    }
    return this.data;
  }

  async saveData() {
    try {
      await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
      await fs.writeFile(this.dataPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      logger.error('Failed to save demo data', { error: error.message });
    }
  }

  async getBalance() {
    const data = await this.loadData();
    return data.balance;
  }

  async getPositions() {
    const data = await this.loadData();
    return data.positions;
  }

  async executeOrder(orderParams, currentPrice) {
    const data = await this.loadData();
    const { symbol, side, quantity, type, stopLoss, takeProfit, leverage = 1 } = orderParams;
    
    const positionValue = quantity * currentPrice;
    const requiredMargin = positionValue / leverage;
    
    // Vérifier solde
    if (requiredMargin > data.balance) {
      throw new Error(`Solde démo insuffisant: ${data.balance.toFixed(2)} USDT`);
    }

    // Simuler exécution
    const executionPrice = type === 'MARKET' ? currentPrice : orderParams.price;
    const fees = positionValue * CONFIG.FEES.FUTURES_TAKER;
    
    // Mettre à jour balance
    data.balance -= (requiredMargin + fees);
    
    // Créer position
    const position = {
      id: `DEMO_POS_${Date.now()}`,
      symbol,
      side,
      size: quantity,
      entryPrice: executionPrice,
      markPrice: executionPrice,
      leverage,
      margin: requiredMargin,
      stopLoss,
      takeProfit,
      fees,
      openTime: Date.now(),
      unrealizedPnl: -fees
    };
    
    data.positions.push(position);
    
    // Logger trade
    const trade = {
      id: `DEMO_TRADE_${Date.now()}`,
      symbol,
      side,
      type,
      quantity,
      price: executionPrice,
      value: positionValue,
      fees,
      timestamp: Date.now()
    };
    data.trades.push(trade);
    
    await this.saveData();
    
    logger.trade('DEMO Order executed', { 
      symbol, 
      side, 
      quantity, 
      price: executionPrice,
      balance: data.balance 
    });
    
    return {
      success: true,
      demo: true,
      orderId: trade.id,
      position,
      balance: data.balance,
      fees
    };
  }

  async closePosition(positionId, currentPrice) {
    const data = await this.loadData();
    const positionIndex = data.positions.findIndex(p => p.id === positionId);
    
    if (positionIndex === -1) {
      throw new Error('Position non trouvée');
    }
    
    const position = data.positions[positionIndex];
    const closeFees = position.size * currentPrice * CONFIG.FEES.FUTURES_TAKER;
    
    // Calculer PnL
    const pnl = position.side === 'LONG'
      ? (currentPrice - position.entryPrice) * position.size
      : (position.entryPrice - currentPrice) * position.size;
    
    const netPnl = pnl - closeFees;
    
    // Rembourser marge + PnL
    data.balance += position.margin + netPnl;
    
    // Enregistrer trade fermé
    data.trades.push({
      id: `DEMO_CLOSE_${Date.now()}`,
      symbol: position.symbol,
      side: position.side === 'LONG' ? 'SELL' : 'BUY',
      type: 'MARKET',
      quantity: position.size,
      price: currentPrice,
      entryPrice: position.entryPrice,
      pnl: netPnl,
      fees: closeFees,
      timestamp: Date.now()
    });
    
    // Retirer position
    data.positions.splice(positionIndex, 1);
    await this.saveData();
    
    return {
      success: true,
      demo: true,
      pnl: netPnl,
      balance: data.balance
    };
  }

  async updatePositionsPrices(prices) {
    const data = await this.loadData();
    
    for (const position of data.positions) {
      const currentPrice = prices.get(position.symbol);
      if (currentPrice) {
        position.markPrice = currentPrice;
        
        // Calculer PnL non réalisé
        const rawPnl = position.side === 'LONG'
          ? (currentPrice - position.entryPrice) * position.size
          : (position.entryPrice - currentPrice) * position.size;
        
        position.unrealizedPnl = rawPnl - position.fees;
        
        // Vérifier SL/TP
        if (position.stopLoss) {
          const slHit = position.side === 'LONG' 
            ? currentPrice <= position.stopLoss
            : currentPrice >= position.stopLoss;
          
          if (slHit) {
            logger.warn(`DEMO Stop Loss triggered for ${position.symbol}`);
          }
        }
        
        if (position.takeProfit) {
          const tpHit = position.side === 'LONG'
            ? currentPrice >= position.takeProfit
            : currentPrice <= position.takeProfit;
          
          if (tpHit) {
            logger.info(`DEMO Take Profit triggered for ${position.symbol}`);
          }
        }
      }
    }
    
    await this.saveData();
    return data.positions;
  }
}

const demoManager = new DemoTradingManager();

/**
 * ==================== EXÉCUTION TRADING RÉEL ====================
 */

/**
 * Exécution sécurisée d'un ordre avec retry et validation
 */
async function safeExecuteTrade(params, isDemo = false) {
  const { 
    symbol, 
    side, 
    type, 
    quantity, 
    price, 
    stopLoss, 
    takeProfit,
    timeInForce = 'GTC',
    apiKeys = null
  } = params;

  logger.info(`Starting trade execution`, { 
    symbol, 
    side, 
    type, 
    quantity, 
    isDemo 
  });

  try {
    // Récupérer prix actuel pour validation
    let currentPrice;
    if (isDemo) {
      // Prix fictif en mode démo
      const demoPrices = {
        'BTCUSDT': 45000,
        'ETHUSDT': 3000,
        'BNBUSDT': 250,
        'SOLUSDT': 100,
        'ADAUSDT': 0.5,
        'XRPUSDT': 0.6
      };
      currentPrice = { price: demoPrices[symbol] || 100 };
    } else {
      currentPrice = await withRetry(
        () => binanceService.getPrice(symbol),
        'getPrice for validation'
      );
    }
    
    const executionPrice = type === 'MARKET' ? currentPrice.price : price;
    
    // Récupérer balance pour validation risque
    let accountBalance;
    if (isDemo) {
      accountBalance = await demoManager.getBalance();
    } else {
      const balances = await withRetry(
        () => binanceService.getBalances(apiKeys),
        'getBalances'
      );
      const usdtBalance = balances.find(b => b.asset === 'USDT');
      accountBalance = usdtBalance ? usdtBalance.free : 0;
    }

    // Validation des risques
    const riskCheck = RiskManager.validateTrade(
      { ...params, price: executionPrice },
      accountBalance
    );
    
    if (!riskCheck.valid) {
      logger.error('Risk validation failed', { errors: riskCheck.errors });
      throw new Error(`Validation risque échouée: ${riskCheck.errors.join(', ')}`);
    }

    logger.info('Risk validation passed', { 
      positionPercent: riskCheck.positionPercent,
      riskRewardRatio: riskCheck.riskRewardRatio 
    });

    // Exécution
    let result;
    if (isDemo) {
      result = await demoManager.executeOrder(params, executionPrice);
    } else {
      // Spot ou Futures selon le contexte
      result = await withRetry(
        () => binanceService.placeOrder({
          symbol,
          side,
          type,
          quantity,
          price,
          timeInForce,
          stopPrice: stopLoss // Pour ordres stop-loss
        }, apiKeys),
        'placeOrder'
      );
    }

    logger.trade('Order executed successfully', {
      orderId: result.orderId,
      symbol,
      side,
      quantity,
      price: executionPrice,
      demo: isDemo
    });

    return {
      success: true,
      orderId: result.orderId,
      symbol,
      side,
      type,
      quantity,
      price: executionPrice,
      stopLoss,
      takeProfit,
      demo: isDemo,
      timestamp: Date.now(),
      fees: result.fees || 0,
      riskValidation: riskCheck
    };

  } catch (error) {
    logger.error('Trade execution failed', { 
      error: error.message,
      symbol,
      side,
      type: isDemo ? 'DEMO' : 'REAL'
    });
    
    throw {
      success: false,
      error: error.message,
      code: error.code || error.response?.status,
      symbol,
      side,
      type,
      timestamp: Date.now()
    };
  }
}

/**
 * Exécution ordre Futures avec levier
 */
async function safeExecuteFuturesTrade(params, isDemo = false) {
  const { leverage = 1, apiKeys = null, ...otherParams } = params;
  
  logger.info(`Starting FUTURES trade execution`, { 
    symbol: params.symbol,
    side: params.side,
    leverage,
    isDemo 
  });

  if (!isDemo) {
    // 🔥 CONFIGURER LE LEVIER RÉEL SUR BINANCE FUTURES
    try {
      await binanceService.setFuturesLeverage(
        otherParams.symbol,
        leverage,
        apiKeys
      );
      logger.info('Futures leverage configured', { symbol: otherParams.symbol, leverage });
    } catch (leverageError) {
      logger.error('Failed to set leverage, continuing with default', {
        error: leverageError.message,
        symbol: otherParams.symbol
      });
      // Continuer quand même, l'ordre peut passer avec le levier par défaut
    }
  }

  return safeExecuteTrade({ ...otherParams, apiKeys }, isDemo);
}

/**
 * Fermer une position
 */
async function closePosition(position, isDemo = false) {
  const { symbol, side, size, isFutures = false, apiKeys = null } = position;
  
  // Inverser le side pour fermer
  const closeSide = side === 'LONG' || side === 'BUY' ? 'SELL' : 'BUY';
  
  logger.info(`Closing position`, { 
    symbol, 
    side: closeSide, 
    size,
    isDemo 
  });

  try {
    let result;
    
    if (isDemo) {
      // Prix fictif en mode démo
      const demoPrices = {
        'BTCUSDT': 45000,
        'ETHUSDT': 3000,
        'BNBUSDT': 250,
        'SOLUSDT': 100,
        'ADAUSDT': 0.5,
        'XRPUSDT': 0.6
      };
      const currentPrice = { price: demoPrices[symbol] || 100 };
      result = await demoManager.closePosition(position.id, currentPrice.price);
    } else {
      result = await withRetry(
        () => binanceService.placeOrder({
          symbol,
          side: closeSide,
          type: 'MARKET',
          quantity: size
        }, apiKeys),
        'closePosition'
      );
    }

    logger.trade('Position closed', { 
      symbol, 
      side: closeSide,
      pnl: result.pnl,
      demo: isDemo 
    });

    return {
      success: true,
      orderId: result.orderId || result.id,
      pnl: result.pnl || 0,
      demo: isDemo,
      timestamp: Date.now()
    };

  } catch (error) {
    logger.error('Failed to close position', { 
      error: error.message,
      symbol 
    });
    throw error;
  }
}

/**
 * Récupérer positions ouvertes avec PnL temps réel
 */
async function getPositionsWithPnL(isDemo = false) {
  try {
    if (isDemo) {
      const positions = await demoManager.getPositions();
      return positions.map(p => ({
        ...p,
        unrealizedPnl: p.unrealizedPnl || 0,
        pnlPercent: p.entryPrice ? (p.unrealizedPnl / (p.size * p.entryPrice)) * 100 : 0
      }));
    }

    // 🔥 RÉCUPÉRATION RÉELLE DES POSITIONS FUTURES
    try {
      const positions = await binanceService.getFuturesPositions(null, null);
      
      // Récupérer les prix actuels pour calculer le PnL
      const prices = new Map();
      for (const pos of positions) {
        if (!prices.has(pos.symbol)) {
          const price = await withRetry(
            () => binanceService.getPrice(pos.symbol),
            'getPrice for futures PnL'
          );
          prices.set(pos.symbol, price.price);
        }
      }
      
      // Calculer PnL pour chaque position
      return positions.map(pos => {
        const currentPrice = prices.get(pos.symbol) || pos.markPrice;
        const pnl = PnLCalculator.calculatePositionPnL({
          ...pos,
          entryPrice: pos.entryPrice,
          size: pos.size,
          side: pos.side
        }, currentPrice);
        
        return {
          ...pos,
          markPrice: currentPrice,
          unrealizedPnl: pnl.netPnl,
          pnlPercent: pnl.pnlPercent,
          liquidationRisk: pos.liquidationPrice > 0 
            ? Math.abs((currentPrice - pos.liquidationPrice) / currentPrice * 100)
            : 0
        };
      });
    } catch (error) {
      logger.error('Failed to fetch real futures positions', { error: error.message });
      throw error;
    }

  } catch (error) {
    logger.error('Failed to get positions', { error: error.message });
    throw error;
  }
}

/**
 * Mettre à jour les PnL temps réel
 */
async function updatePnLRealtime(positions, isDemo = false) {
  const prices = new Map();
  
  // Prix fictifs pour le mode démo
  const demoPrices = {
    'BTCUSDT': 45000,
    'ETHUSDT': 3000,
    'BNBUSDT': 250,
    'SOLUSDT': 100,
    'ADAUSDT': 0.5,
    'XRPUSDT': 0.6
  };
  
  // Récupérer tous les prix nécessaires
  for (const pos of positions) {
    if (!prices.has(pos.symbol)) {
      if (isDemo) {
        // En mode démo, utiliser le prix fictif ou markPrice existant
        prices.set(pos.symbol, demoPrices[pos.symbol] || 100);
      } else {
        const price = await withRetry(
          () => binanceService.getPrice(pos.symbol),
          'getPrice for PnL update'
        );
        prices.set(pos.symbol, price.price);
      }
    }
  }

  if (isDemo) {
    return await demoManager.updatePositionsPrices(prices);
  }

  // Calculer PnL pour positions réelles
  return positions.map(pos => {
    const currentPrice = prices.get(pos.symbol);
    const pnl = PnLCalculator.calculatePositionPnL(pos, currentPrice);
    
    return {
      ...pos,
      markPrice: currentPrice,
      unrealizedPnl: pnl.netPnl,
      pnlPercent: pnl.pnlPercent,
      fees: pnl.fees
    };
  });
}

module.exports = {
  // Configuration
  CONFIG,
  
  // Exécution trades
  safeExecuteTrade,
  safeExecuteFuturesTrade,
  closePosition,
  
  // Gestion positions
  getPositionsWithPnL,
  updatePnLRealtime,
  
  // Outils
  RiskManager,
  PnLCalculator,
  demoManager,
  
  // Utils
  withRetry,
  logger
};
