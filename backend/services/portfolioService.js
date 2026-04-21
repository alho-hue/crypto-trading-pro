// Service de Gestion de Portefeuille pour Ethernal IA
// Optimisation d'allocation, rebalancing et suivi de performance

require('dotenv').config();
const binanceService = require('./binanceService');
const sentimentService = require('./sentimentService');

class PortfolioService {
  // Obtenir le portefeuille actuel d'un utilisateur
  async getUserPortfolio(userId) {
    try {
      const balances = await binanceService.getAccountBalances();
      const totalValue = await this.calculateTotalPortfolioValue(balances);
      
      const portfolio = {
        totalValue,
        assets: [],
        allocation: {},
        lastUpdated: new Date()
      };

      for (const balance of balances) {
        if (parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0) {
          const assetValue = await this.getAssetValue(balance.asset, balance);
          const percentage = (assetValue / totalValue) * 100;

          portfolio.assets.push({
            symbol: balance.asset,
            free: parseFloat(balance.free),
            locked: parseFloat(balance.locked),
            total: parseFloat(balance.free) + parseFloat(balance.locked),
            value: assetValue,
            percentage: parseFloat(percentage.toFixed(2))
          });

          portfolio.allocation[balance.asset] = parseFloat(percentage.toFixed(2));
        }
      }

      // Trier par valeur
      portfolio.assets.sort((a, b) => b.value - a.value);

      return portfolio;
    } catch (error) {
      console.error('Erreur lors de la récupération du portefeuille:', error);
      throw error;
    }
  }

  // Calculer la valeur totale du portefeuille
  async calculateTotalPortfolioValue(balances) {
    let totalValue = 0;

    for (const balance of balances) {
      const value = await this.getAssetValue(balance.asset, balance);
      totalValue += value;
    }

    return parseFloat(totalValue.toFixed(2));
  }

  // Obtenir la valeur d'un actif
  async getAssetValue(asset, balance) {
    if (asset === 'USDT') {
      return parseFloat(balance.free) + parseFloat(balance.locked);
    }

    try {
      const ticker = await binanceService.get24hTicker(asset + 'USDT');
      const price = parseFloat(ticker.lastPrice);
      const quantity = parseFloat(balance.free) + parseFloat(balance.locked);
      return price * quantity;
    } catch (error) {
      return 0;
    }
  }

  // Optimiser l'allocation du portefeuille (Markowitz simplifié)
  async optimizeAllocation(assets, riskProfile = 'moderate') {
    // Récupérer les données historiques pour calculer les rendements et corrélations
    const historicalData = {};
    
    for (const asset of assets) {
      try {
        const candles = await binanceService.getKlines(asset + 'USDT', '1d', 30);
        const closes = candles.map(c => c.close);
        historicalData[asset] = {
          returns: this.calculateReturns(closes),
          avgReturn: this.calculateAverageReturn(closes),
          volatility: this.calculateVolatility(closes)
        };
      } catch (error) {
        console.error(`Erreur pour ${asset}:`, error);
      }
    }

    // Calculer les allocations selon le profil de risque
    const allocations = this.calculateRiskBasedAllocations(assets, historicalData, riskProfile);

    return allocations;
  }

  // Calculer les rendements
  calculateReturns(candles) {
    const closes = candles.map(c => c.close);
    const returns = [];
    
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    
    return returns;
  }

  // Calculer le rendement moyen
  calculateAverageReturn(candles) {
    const returns = this.calculateReturns(candles);
    return returns.reduce((sum, r) => sum + r, 0) / returns.length;
  }

  // Calculer la volatilité
  calculateVolatility(candles) {
    const returns = this.calculateReturns(candles);
    const avgReturn = this.calculateAverageReturn(candles);
    
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  // Calculer les allocations basées sur le risque
  calculateRiskBasedAllocations(assets, historicalData, riskProfile) {
    const allocations = [];

    for (const asset of assets) {
      const data = historicalData[asset];
      if (!data) continue;

      let weight;
      
      switch (riskProfile) {
        case 'conservative':
          // Privilégier la stabilité (BTC, ETH)
          if (asset === 'BTC') weight = 0.5;
          else if (asset === 'ETH') weight = 0.3;
          else weight = 0.2 / (assets.length - 2);
          break;
        case 'moderate':
          // Allocation équilibrée
          weight = 1 / assets.length;
          break;
        case 'aggressive':
          // Privilégier les altcoins avec potentiel
          if (asset === 'BTC') weight = 0.3;
          else if (asset === 'ETH') weight = 0.25;
          else weight = 0.45 / (assets.length - 2);
          break;
        default:
          weight = 1 / assets.length;
      }

      allocations.push({
        symbol: asset,
        percentage: parseFloat((weight * 100).toFixed(2)),
        expectedReturn: parseFloat((data.avgReturn * 100).toFixed(2)),
        volatility: parseFloat((data.volatility * 100).toFixed(2))
      });
    }

    return allocations;
  }

  // Recommander un rebalancing
  async recommendRebalancing(userId, targetAllocation) {
    const currentPortfolio = await this.getUserPortfolio(userId);
    
    const recommendations = [];
    let needsRebalancing = false;

    for (const target of targetAllocation) {
      const current = currentPortfolio.assets.find(a => a.symbol === target.symbol);
      const currentPercentage = current ? current.percentage : 0;
      const difference = target.percentage - currentPercentage;

      if (Math.abs(difference) > 5) { // Seuil de 5%
        needsRebalancing = true;
        
        recommendations.push({
          symbol: target.symbol,
          currentPercentage,
          targetPercentage: target.percentage,
          difference: parseFloat(difference.toFixed(2)),
          action: difference > 0 ? 'buy' : 'sell',
          amount: Math.abs(difference)
        });
      }
    }

    return {
      needsRebalancing,
      recommendations: recommendations.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    };
  }

  // Exécuter un rebalancing
  async executeRebalancing(userId, recommendations) {
    const executedTrades = [];

    for (const rec of recommendations) {
      try {
        if (rec.action === 'buy') {
          // Acheter pour atteindre l'allocation cible
          const trade = await this.executeBuyForAllocation(userId, rec);
          executedTrades.push(trade);
        } else if (rec.action === 'sell') {
          // Vendre pour atteindre l'allocation cible
          const trade = await this.executeSellForAllocation(userId, rec);
          executedTrades.push(trade);
        }
      } catch (error) {
        console.error(`Erreur lors du rebalancing pour ${rec.symbol}:`, error);
      }
    }

    return executedTrades;
  }

  // Exécuter un achat pour l'allocation
  async executeBuyForAllocation(userId, recommendation) {
    try {
      const symbol = recommendation.symbol;
      const symbolUSDT = symbol + 'USDT';
      
      // Récupérer le solde USDT disponible
      const balances = await binanceService.getAccountBalances();
      const usdtBalance = balances.find(b => b.asset === 'USDT');
      
      if (!usdtBalance || parseFloat(usdtBalance.free) < 10) {
        throw new Error('Solde USDT insuffisant pour le rebalancing');
      }
      
      // Calculer le montant à acheter
      const portfolio = await this.getUserPortfolio(userId);
      const targetValue = portfolio.totalValue * (recommendation.targetPercentage / 100);
      const currentValue = portfolio.assets.find(a => a.symbol === symbol)?.value || 0;
      const amountToBuy = targetValue - currentValue;
      
      if (amountToBuy < 10) {
        return {
          symbol: recommendation.symbol,
          action: 'buy',
          amount: 0,
          status: 'skipped',
          reason: 'Montant trop faible (< 10 USDT)',
          timestamp: new Date()
        };
      }
      
      // Récupérer le prix actuel
      const currentPrice = await binanceService.getPrice(symbolUSDT);
      const quantity = amountToBuy / currentPrice;
      
      // Vérifier les filtres de précision
      const symbolInfo = await binanceService.getSymbolInfo(symbolUSDT);
      if (symbolInfo && symbolInfo.filters) {
        const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
        if (lotSizeFilter) {
          const stepSize = parseFloat(lotSizeFilter.stepSize);
          const precision = Math.round(-Math.log10(stepSize));
          const adjustedQuantity = Math.floor(quantity / stepSize) * stepSize;
          
            if (adjustedQuantity * currentPrice < 10) {
            return {
              symbol: recommendation.symbol,
              action: 'buy',
              amount: 0,
              status: 'skipped',
              reason: 'Quantité ajustée trop faible',
              timestamp: new Date()
            };
          }
          
          // Placer l'ordre d'achat réel
          const order = await binanceService.placeMarketOrder(symbolUSDT, 'BUY', adjustedQuantity);
          
          return {
            symbol: recommendation.symbol,
            action: 'buy',
            amount: adjustedQuantity * order.price,
            quantity: adjustedQuantity,
            price: order.price,
            orderId: order.orderId,
            status: 'executed',
            timestamp: new Date()
          };
        }
      }
      
      // Fallback si pas d'info de filtre
      const order = await binanceService.placeMarketOrder(symbolUSDT, 'BUY', quantity);
      
      return {
        symbol: recommendation.symbol,
        action: 'buy',
        amount: quantity * order.price,
        quantity: quantity,
        price: order.price,
        orderId: order.orderId,
        status: 'executed',
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ Erreur rebalancing buy ${recommendation.symbol}:`, error);
      return {
        symbol: recommendation.symbol,
        action: 'buy',
        amount: 0,
        status: 'error',
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  // Exécuter une vente pour l'allocation
  async executeSellForAllocation(userId, recommendation) {
    try {
      const symbol = recommendation.symbol;
      const symbolUSDT = symbol + 'USDT';
      
      // Récupérer le solde de l'actif
      const balances = await binanceService.getAccountBalances();
      const assetBalance = balances.find(b => b.asset === symbol);
      
      if (!assetBalance || parseFloat(assetBalance.free) <= 0) {
        return {
          symbol: recommendation.symbol,
          action: 'sell',
          amount: 0,
          status: 'skipped',
          reason: 'Pas de solde disponible pour cet actif',
          timestamp: new Date()
        };
      }
      
      // Calculer la quantité à vendre
      const portfolio = await this.getUserPortfolio(userId);
      const currentValue = portfolio.assets.find(a => a.symbol === symbol)?.value || 0;
      const currentPercentage = (currentValue / portfolio.totalValue) * 100;
      const percentageToSell = currentPercentage - recommendation.targetPercentage;
      const valueToSell = portfolio.totalValue * (percentageToSell / 100);
      
      const currentPrice = await binanceService.getPrice(symbolUSDT);
      let quantityToSell = valueToSell / currentPrice;
      
      // Ne pas vendre plus que disponible
      const availableQuantity = parseFloat(assetBalance.free);
      quantityToSell = Math.min(quantityToSell, availableQuantity * 0.995); // Garder un peu pour les frais
      
      if (quantityToSell * currentPrice < 10) {
        return {
          symbol: recommendation.symbol,
          action: 'sell',
          amount: 0,
          status: 'skipped',
          reason: 'Montant de vente trop faible (< 10 USDT)',
          timestamp: new Date()
        };
      }
      
      // Vérifier les filtres de précision
      const symbolInfo = await binanceService.getSymbolInfo(symbolUSDT);
      if (symbolInfo && symbolInfo.filters) {
        const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
        if (lotSizeFilter) {
          const stepSize = parseFloat(lotSizeFilter.stepSize);
          quantityToSell = Math.floor(quantityToSell / stepSize) * stepSize;
        }
      }
      
      // Placer l'ordre de vente réel
      const order = await binanceService.placeMarketOrder(symbolUSDT, 'SELL', quantityToSell);
      
      return {
        symbol: recommendation.symbol,
        action: 'sell',
        amount: quantityToSell * order.price,
        quantity: quantityToSell,
        price: order.price,
        orderId: order.orderId,
        status: 'executed',
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ Erreur rebalancing sell ${recommendation.symbol}:`, error);
      return {
        symbol: recommendation.symbol,
        action: 'sell',
        amount: 0,
        status: 'error',
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  // Calculer la performance du portefeuille avec données réelles
  async calculatePortfolioPerformance(userId, period = '7d') {
    try {
      const portfolio = await this.getUserPortfolio(userId);
      
      const periods = {
        '1d': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      };
      
      const days = periods[period] || 7;
      const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      
      // Calculer la performance réelle pour chaque asset
      const assetPerformances = await Promise.all(
        portfolio.assets.map(async (asset) => {
          if (asset.symbol === 'USDT') {
            return { ...asset, returnPercentage: 0 };
          }
          
          try {
            // Récupérer les données historiques
            const candles = await binanceService.getKlines(
              asset.symbol + 'USDT',
              '1d',
              days + 1
            );
            
            if (candles.length < 2) {
              return { ...asset, returnPercentage: 0 };
            }
            
            const startPrice = candles[0].close;
            const currentPrice = candles[candles.length - 1].close;
            const returnPercentage = ((currentPrice - startPrice) / startPrice) * 100;
            
            return {
              ...asset,
              returnPercentage: parseFloat(returnPercentage.toFixed(2)),
              startPrice,
              currentPrice
            };
          } catch (error) {
            return { ...asset, returnPercentage: 0 };
          }
        })
      );
      
      // Calculer la performance totale pondérée
      let weightedReturn = 0;
      assetPerformances.forEach(asset => {
        weightedReturn += (asset.returnPercentage * asset.percentage) / 100;
      });
      
      const returnValue = portfolio.totalValue * (weightedReturn / 100);
      const startValue = portfolio.totalValue - returnValue;
      
      return {
        period,
        totalValue: portfolio.totalValue,
        returnValue: parseFloat(returnValue.toFixed(2)),
        returnPercentage: parseFloat(weightedReturn.toFixed(2)),
        startValue: parseFloat(startValue.toFixed(2)),
        assets: assetPerformances,
        calculatedAt: new Date()
      };
      
    } catch (error) {
      console.error('❌ Erreur calcul performance:', error);
      throw error;
    }
  }

  // Analyser la diversification
  async analyzeDiversification(userId) {
    const portfolio = await this.getUserPortfolio(userId);
    
    const analysis = {
      score: 0,
      concentration: [],
      recommendations: []
    };

    // Calculer le score de diversification (0-100)
    const assetCount = portfolio.assets.length;
    const maxAllocation = Math.max(...portfolio.assets.map(a => a.percentage));
    
    // Score basé sur le nombre d'actifs et la concentration maximale
    analysis.score = Math.min(100, (assetCount * 10) + (100 - maxAllocation));

    // Identifier les concentrations
    portfolio.assets.forEach(asset => {
      if (asset.percentage > 30) {
        analysis.concentration.push({
          symbol: asset.symbol,
          percentage: asset.percentage,
          level: 'high'
        });
      } else if (asset.percentage > 20) {
        analysis.concentration.push({
          symbol: asset.symbol,
          percentage: asset.percentage,
          level: 'medium'
        });
      }
    });

    // Générer des recommandations
    if (maxAllocation > 50) {
      analysis.recommendations.push('Considérez diversifier en réduisant la concentration sur ' + portfolio.assets[0].symbol);
    }
    
    if (assetCount < 5) {
      analysis.recommendations.push('Votre portefeuille pourrait bénéficier de plus de diversification');
    }

    if (analysis.score < 50) {
      analysis.recommendations.push('Diversification faible - risque de concentration élevé');
    }

    return analysis;
  }

  // Calculer le P&L du portefeuille avec données réelles
  async calculatePortfolioPnL(userId) {
    try {
      const Trade = require('../models/Trade');
      const portfolio = await this.getUserPortfolio(userId);
      
      // Récupérer tous les trades historiques
      const trades = await Trade.find({ userId, status: 'closed' }).sort({ exitTime: -1 });
      
      // Calculer le P&L réalisé
      let realizedPnL = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      
      // Calculer le P&L non réalisé
      let unrealizedPnL = 0;
      const openTrades = await Trade.find({ userId, status: 'open' });
      
      for (const trade of openTrades) {
        try {
          const currentPrice = await binanceService.getPrice(trade.symbol);
          const currentValue = trade.quantity * currentPrice;
          const entryValue = trade.quantity * trade.entryPrice;
          unrealizedPnL += (currentValue - entryValue);
        } catch (e) {
          // Ignorer les erreurs de prix
        }
      }
      
      const totalPnL = realizedPnL + unrealizedPnL;
      
      // Calculer le P&L par asset
      const pnlByAsset = {};
      trades.forEach(trade => {
        const baseSymbol = trade.symbol.replace('USDT', '');
        if (!pnlByAsset[baseSymbol]) {
          pnlByAsset[baseSymbol] = { realized: 0, unrealized: 0, trades: 0 };
        }
        pnlByAsset[baseSymbol].realized += trade.pnl || 0;
        pnlByAsset[baseSymbol].trades++;
      });
      
      // Ajouter le P&L non réalisé
      for (const trade of openTrades) {
        const baseSymbol = trade.symbol.replace('USDT', '');
        if (!pnlByAsset[baseSymbol]) {
          pnlByAsset[baseSymbol] = { realized: 0, unrealized: 0, trades: 0 };
        }
        const currentPrice = await binanceService.getPrice(trade.symbol).catch(() => trade.entryPrice);
        pnlByAsset[baseSymbol].unrealized += (currentPrice - trade.entryPrice) * trade.quantity;
      }
      
      // Formater les assets pour la réponse
      const assetPnL = Object.entries(pnlByAsset).map(([symbol, data]) => ({
        symbol,
        realizedPnL: parseFloat(data.realized.toFixed(2)),
        unrealizedPnL: parseFloat(data.unrealized.toFixed(2)),
        totalPnL: parseFloat((data.realized + data.unrealized).toFixed(2)),
        trades: data.trades
      }));
      
      return {
        totalValue: portfolio.totalValue,
        realizedPnL: parseFloat(realizedPnL.toFixed(2)),
        unrealizedPnL: parseFloat(unrealizedPnL.toFixed(2)),
        totalPnL: parseFloat(totalPnL.toFixed(2)),
        realizedPnLPercentage: parseFloat(((realizedPnL / portfolio.totalValue) * 100).toFixed(2)),
        unrealizedPnLPercentage: parseFloat(((unrealizedPnL / portfolio.totalValue) * 100).toFixed(2)),
        totalPnLPercentage: parseFloat(((totalPnL / portfolio.totalValue) * 100).toFixed(2)),
        totalTrades: trades.length,
        openPositions: openTrades.length,
        assets: assetPnL,
        calculatedAt: new Date()
      };
      
    } catch (error) {
      console.error('❌ Erreur calcul P&L:', error);
      throw error;
    }
  }

  // Générer un rapport de portefeuille
  async generatePortfolioReport(userId) {
    const [portfolio, performance, diversification, pnl] = await Promise.all([
      this.getUserPortfolio(userId),
      this.calculatePortfolioPerformance(userId, '30d'),
      this.analyzeDiversification(userId),
      this.calculatePortfolioPnL(userId)
    ]);

    return {
      summary: {
        totalValue: portfolio.totalValue,
        assetCount: portfolio.assets.length,
        performance30d: performance.returnPercentage,
        diversificationScore: diversification.score,
        unrealizedPnL: pnl.unrealizedPnL
      },
      allocation: portfolio.allocation,
      assets: portfolio.assets,
      performance,
      diversification,
      pnl,
      generatedAt: new Date()
    };
  }

  // Obtenir des recommandations de portefeuille
  async getPortfolioRecommendations(userId) {
    const [portfolio, diversification] = await Promise.all([
      this.getUserPortfolio(userId),
      this.analyzeDiversification(userId)
    ]);

    const recommendations = [];

    // Recommandations basées sur la diversification
    if (diversification.score < 50) {
      recommendations.push({
        type: 'diversification',
        priority: 'high',
        message: 'Améliorez la diversification de votre portefeuille',
        action: 'add_assets'
      });
    }

    // Recommandations basées sur l'allocation
    const btcAllocation = portfolio.allocation['BTC'] || 0;
    if (btcAllocation > 60) {
      recommendations.push({
        type: 'allocation',
        priority: 'medium',
        message: 'Considérez réduire l\'exposition à BTC',
        action: 'reduce_btc'
      });
    }

    // Recommandations basées sur le sentiment
    try {
      const sentiment = await sentimentService.getOverallMarketSentiment('BTCUSDT');
      if (sentiment.overall === 'strongly_bearish') {
        recommendations.push({
          type: 'market_sentiment',
          priority: 'high',
          message: 'Le marché est fortement baissier - considérez réduire les positions',
          action: 'reduce_exposure'
        });
      } else if (sentiment.overall === 'strongly_bullish') {
        recommendations.push({
          type: 'market_sentiment',
          priority: 'medium',
          message: 'Le marché est fortement haussier - opportunité d\'accumulation',
          action: 'accumulate'
        });
      }
    } catch (error) {
      // Ignorer les erreurs de sentiment
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}

module.exports = new PortfolioService();
