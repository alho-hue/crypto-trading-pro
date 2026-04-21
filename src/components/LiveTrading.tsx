import { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, DollarSign, AlertCircle, Lock, 
  Loader2, History, Target, Shield, Percent 
} from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';
import { useTrading } from '../hooks/useTrading';
import { showToast } from '../stores/toastStore';
import { formatXOF } from '../utils/currency';
import { getAITradingSetup } from '../services/advancedAnalysis';
import { Brain } from 'lucide-react';

export default function LiveTrading() {
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  const prices = useCryptoStore((state) => state.prices);
  
  // NOUVEAU: Hook trading sécurisé avec WebSocket temps réel
  const {
    balance,
    positions,
    totalUnrealizedPnl,
    isLoading,
    isExecuting,
    error,
    isDemo,
    isConnected,
    executeSpotTrade,
    closePosition,
    toggleDemoMode,
    resetDemo,
    loadData,
    getDefaultSLTP,
    getMaxPositionSize,
    validateTrade,
    clearError
  } = useTrading({ defaultIsDemo: true });
  
  // États du formulaire
  const [activeTab, setActiveTab] = useState<'trade' | 'positions'>('trade');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  
  // Champs communs
  const [quantity, setQuantity] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  
  // NOUVEAU: Mode entrée USD
  const [inputMode, setInputMode] = useState<'crypto' | 'usd'>('usd');
  const [usdAmount, setUsdAmount] = useState<string>('');
  const [slUsd, setSlUsd] = useState<string>('');
  const [tpUsd, setTpUsd] = useState<string>('');
  
  // SL/TP OBLIGATOIRES
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [autoSLTP, setAutoSLTP] = useState<boolean>(true);
  
  // Validation en temps réel
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[]; positionPercent: number; riskRewardRatio: number } | null>(null);
  
  const currentPrice = prices.get(selectedSymbol)?.price || 0;
  
  // Calculer SL/TP automatiques quand le prix change
  useEffect(() => {
    if (autoSLTP && currentPrice > 0) {
      const defaults = getDefaultSLTP(
        currentPrice,
        side === 'buy' ? 'BUY' : 'SELL'
      );
      setStopLoss(defaults.stopLoss.toFixed(2));
      setTakeProfit(defaults.takeProfit.toFixed(2));
      // Convertir en USD aussi
      const slDistance = Math.abs(currentPrice - defaults.stopLoss);
      const tpDistance = Math.abs(defaults.takeProfit - currentPrice);
      setSlUsd((slDistance > 0 ? slDistance.toFixed(2) : ''));
      setTpUsd((tpDistance > 0 ? tpDistance.toFixed(2) : ''));
    }
  }, [currentPrice, side, autoSLTP, getDefaultSLTP]);
  
  // Conversion USD <-> Crypto
  const handleUsdAmountChange = (value: string) => {
    setUsdAmount(value);
    if (currentPrice > 0 && value) {
      const qty = (parseFloat(value) / currentPrice).toFixed(6);
      setQuantity(qty);
    }
  };
  
  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    if (currentPrice > 0 && value) {
      const usd = (parseFloat(value) * currentPrice).toFixed(2);
      setUsdAmount(usd);
    }
  };
  
  const handleSlUsdChange = (value: string) => {
    setSlUsd(value);
    if (currentPrice > 0 && value) {
      const slDistance = parseFloat(value);
      const sl = side === 'buy' 
        ? (currentPrice - slDistance).toFixed(2)
        : (currentPrice + slDistance).toFixed(2);
      setStopLoss(sl);
    }
  };
  
  const handleTpUsdChange = (value: string) => {
    setTpUsd(value);
    if (currentPrice > 0 && value) {
      const tpDistance = parseFloat(value);
      const tp = side === 'buy'
        ? (currentPrice + tpDistance).toFixed(2)
        : (currentPrice - tpDistance).toFixed(2);
      setTakeProfit(tp);
    }
  };
  
  const handleSlPriceChange = (value: string) => {
    setStopLoss(value);
    if (currentPrice > 0 && value) {
      const sl = parseFloat(value);
      const distance = Math.abs(currentPrice - sl).toFixed(2);
      setSlUsd(distance);
    }
  };
  
  const handleTpPriceChange = (value: string) => {
    setTakeProfit(value);
    if (currentPrice > 0 && value) {
      const tp = parseFloat(value);
      const distance = Math.abs(tp - currentPrice).toFixed(2);
      setTpUsd(distance);
    }
  };
  
  // 🧠 REMPLIR AVEC IA - RESPECTE LE MONTANT USDT DE L'UTILISATEUR
  const handleFillWithAI = () => {
    // Récupérer le prix EN DIRECT depuis le store au moment du clic
    const livePrice = prices.get(selectedSymbol)?.price || 0;
    
    if (!livePrice || livePrice <= 0) {
      showToast.error('Prix actuel non disponible - Veuillez patienter le chargement', 'Erreur');
      return;
    }
    
    const setup = getAITradingSetup(selectedSymbol, livePrice);
    
    // 🎯 RESPECTER LE MONTANT USDT QUE L'UTILISATEUR A DÉJÀ ENTRÉ
    const userUsdAmount = parseFloat(usdAmount) || 0;
    const maxAllowedUsd = Math.min(userUsdAmount > 0 ? userUsdAmount : balance * 0.02, balance * 0.10); // Max 10% du capital ou montant user
    
    // Appliquer le setup IA avec LE MONTANT DE L'UTILISATEUR
    if (setup.entryPrice) {
      // Calculer quantité basée sur le montant USDT de l'utilisateur (pas tout le capital!)
      const slDistance = Math.abs(setup.entryPrice - (setup.stopLoss || setup.entryPrice * 0.98));
      const qty = slDistance > 0 
        ? (maxAllowedUsd / setup.entryPrice).toFixed(6)  // Qty = Montant USDT / Prix
        : (maxAllowedUsd / setup.entryPrice).toFixed(6);
      
      setQuantity(qty);
      
      // Recalculer le vrai montant USDT utilisé
      const actualUsdUsed = (parseFloat(qty) * setup.entryPrice).toFixed(2);
      setUsdAmount(actualUsdUsed);
      
      // 🚨 ALERTE si le montant dépasse le budget
      if (parseFloat(actualUsdUsed) > balance) {
        showToast.warning(`⚠️ Montant (${actualUsdUsed}$) dépasse votre balance (${balance}$)`, 'Attention Budget');
      }
    }
    
    if (setup.stopLoss) {
      setStopLoss(setup.stopLoss.toFixed(2));
      const slDist = Math.abs(livePrice - setup.stopLoss).toFixed(2);
      setSlUsd(slDist);
    }
    
    if (setup.takeProfit) {
      setTakeProfit(setup.takeProfit.toFixed(2));
      const tpDist = Math.abs(setup.takeProfit - livePrice).toFixed(2);
      setTpUsd(tpDist);
    }
    
    // Ajuster le side selon la direction IA
    if (setup.direction === 'LONG') {
      setSide('buy');
    } else if (setup.direction === 'SHORT') {
      setSide('sell');
    }
    
    setAutoSLTP(false);
    
    // Calculer le risque réel
    const riskPercent = (parseFloat(usdAmount) / balance) * 100;
    
    showToast.success(
      `🧠 Setup IA: ${setup.direction} @ $${setup.entryPrice?.toFixed(2)} | Montant: $${usdAmount} (${riskPercent.toFixed(1)}% du capital) | Score: ${setup.score}`,
      'Signal IA Ethernal'
    );
  };
  
  // Validation en temps réel
  useEffect(() => {
    if (quantity && parseFloat(quantity) > 0) {
      const qty = parseFloat(quantity);
      const prc = orderType === 'market' ? currentPrice : (parseFloat(price) || currentPrice);
      const sl = parseFloat(stopLoss) || 0;
      const tp = parseFloat(takeProfit) || 0;
      
      const result = validateTrade({
        symbol: selectedSymbol,
        side: side === 'buy' ? 'BUY' : 'SELL',
        type: orderType === 'market' ? 'MARKET' : 'LIMIT',
        quantity: qty,
        price: prc,
        stopLoss: sl,
        takeProfit: tp
      });
      
      setValidation(result);
    } else {
      setValidation(null);
    }
  }, [quantity, price, stopLoss, takeProfit, orderType, side, selectedSymbol, currentPrice, validateTrade]);
  
  // Gérer erreurs
  useEffect(() => {
    if (error) {
      showToast.error(error, 'Erreur Trading');
      clearError();
    }
  }, [error, clearError]);

  // Exécuter un ordre - VALIDATION STRICTE
  const handleExecuteOrder = async () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      showToast.error('Veuillez entrer une quantité valide', 'Erreur');
      return;
    }
    
    if (!stopLoss || parseFloat(stopLoss) <= 0 || !takeProfit || parseFloat(takeProfit) <= 0) {
      showToast.error('Stop Loss et Take Profit sont obligatoires', 'Validation');
      return;
    }
    
    // 🚨 VALIDATION STRICTE DU MONTANT ET DU RISQUE
    const orderValue = parseFloat(quantity) * (orderType === 'market' ? currentPrice : (parseFloat(price) || currentPrice));
    const riskAmount = Math.abs(orderValue - (parseFloat(stopLoss) * parseFloat(quantity))); // Perte potentielle
    const riskPercent = (riskAmount / balance) * 100;
    const positionPercent = (orderValue / balance) * 100;
    
    // 1. Vérifier que le montant ne dépasse pas le budget
    const safeBalance = balance || 0;
    if (orderValue > safeBalance) {
      showToast.error(
        `❌ MONTANT INTERDIT: $${orderValue.toFixed(2)} > Balance $${safeBalance.toFixed(2)}`,
        'BLOQUÉ - Budget Insuffisant'
      );
      return;
    }
    
    // 2. Vérifier que le risque ne dépasse pas 2%
    if (riskPercent > 2.5) {
      showToast.error(
        `❌ RISQUE TROP ÉLEVÉ: ${riskPercent.toFixed(2)}% > 2% maximum\n` +
        `Réduisez la taille de position ou augmentez la distance SL`,
        'BLOQUÉ - Risque Excessif'
      );
      return;
    }
    
    // 3. Avertissement si position > 10% du capital
    if (positionPercent > 10) {
      showToast.warning(
        `⚠️ Position large: ${positionPercent.toFixed(1)}% du capital`,
        'Attention'
      );
    }
    
    if (validation && !validation.valid) {
      showToast.error(validation.errors[0], 'Validation Risque');
      return;
    }

    const executionPrice = orderType === 'market' ? currentPrice : parseFloat(price);
    
    const result = await executeSpotTrade({
      symbol: selectedSymbol,
      side: side === 'buy' ? 'BUY' : 'SELL',
      type: orderType === 'market' ? 'MARKET' : 'LIMIT',
      quantity: parseFloat(quantity),
      price: orderType === 'limit' ? parseFloat(price) : undefined,
      stopLoss: parseFloat(stopLoss),
      takeProfit: parseFloat(takeProfit),
      timeInForce: 'GTC'
    });

    if (result.success) {
      showToast.success(
        `✅ Ordre ${isDemo ? 'DÉMO' : 'RÉEL'} exécuté! #${result.orderId?.slice(0, 8)}`,
        'Succès'
      );
      
      // Reset form
      setQuantity('');
      setPrice('');
      setUsdAmount('');
      setSlUsd('');
      setTpUsd('');
      
      // Info risque
      if (result.risk) {
        showToast.info(
          `Position: ${result.risk.positionPercent.toFixed(2)}% | R/R: ${result.risk.riskRewardRatio.toFixed(2)}`,
          'Risque'
        );
      }
    } else {
      showToast.error(result.error || 'Échec de l\'exécution', 'Erreur');
    }
  };
  
  // Calculer valeur position
  const positionValue = quantity && parseFloat(quantity) > 0 
    ? parseFloat(quantity) * (orderType === 'market' ? currentPrice : (parseFloat(price) || currentPrice))
    : 0;
  
  const positionPercent = balance > 0 ? (positionValue / balance) * 100 : 0;
  
  // Calculer PnL potentiel
  const potentialProfit = quantity && takeProfit 
    ? Math.abs(parseFloat(takeProfit) - (orderType === 'market' ? currentPrice : parseFloat(price))) * parseFloat(quantity)
    : 0;
  
  const potentialLoss = quantity && stopLoss
    ? Math.abs((orderType === 'market' ? currentPrice : parseFloat(price)) - parseFloat(stopLoss)) * parseFloat(quantity)
    : 0;
  
  const riskRewardRatio = potentialLoss > 0 ? potentialProfit / potentialLoss : 0;


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-crypto-accent" />
          Trading Spot
          {isDemo && (
            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded-full font-medium">
              MODE DÉMO
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          {/* Toggle Demo/Real */}
          <button
            onClick={() => toggleDemoMode(!isDemo)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isDemo 
                ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30' 
                : 'bg-crypto-green/20 text-crypto-green hover:bg-crypto-green/30'
            }`}
          >
            {isDemo ? 'Passer en RÉEL' : 'Passer en DÉMO'}
          </button>
          
          {isDemo && (
            <button
              onClick={resetDemo}
              className="px-3 py-2 bg-crypto-dark hover:bg-crypto-dark/80 rounded-lg text-sm"
              title="Réinitialiser compte démo"
            >
              Reset $10k
            </button>
          )}
          
          <button 
            onClick={() => { loadData(isDemo); }}
            disabled={isLoading}
            className="px-4 py-2 bg-crypto-accent rounded-lg hover:bg-crypto-accent/80 transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualiser'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Balance */}
        <div className={`crypto-card ${isDemo ? 'border-yellow-500/30' : 'border-crypto-accent'}`}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className={`w-5 h-5 ${isDemo ? 'text-yellow-500' : 'text-crypto-accent'}`} />
            <span className="text-gray-400">Balance</span>
          </div>
          <p className="text-2xl font-bold font-mono">
            ${(balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-gray-400">
            ≈ {formatXOF(balance || 0)}
          </p>
        </div>

        {/* PnL */}
        <div className={`crypto-card ${totalUnrealizedPnl >= 0 ? 'border-crypto-green/30' : 'border-crypto-red/30'}`}>
          <div className="flex items-center gap-2 mb-2">
            {totalUnrealizedPnl >= 0 ? (
              <TrendingUp className="w-5 h-5 text-crypto-green" />
            ) : (
              <TrendingDown className="w-5 h-5 text-crypto-red" />
            )}
            <span className="text-gray-400">P&L Positions</span>
          </div>
          <p className={`text-2xl font-bold ${totalUnrealizedPnl >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
            {totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toFixed(2)}
          </p>
          <p className="text-sm text-gray-400">
            {positions.length} position{positions.length > 1 ? 's' : ''} ouverte{positions.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Connection Status */}
        <div className="crypto-card">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-crypto-green animate-pulse' : 'bg-crypto-red'}`} />
            <span className="text-gray-400">Connexion</span>
          </div>
          <p className="text-lg font-medium">
            {isConnected ? 'Temps réel' : 'Déconnecté'}
          </p>
          <p className="text-sm text-gray-400">
            {isDemo ? 'Trading simulé' : 'Trading réel Binance'}
          </p>
        </div>
      </div>

      {/* Interface de Trading */}
      <div className="crypto-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Nouvel Ordre - {selectedSymbol}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOrderType('market')}
              className={`px-3 py-1 rounded text-sm ${orderType === 'market' ? 'bg-crypto-accent' : 'bg-crypto-dark'}`}
            >
              Market
            </button>
            <button
              onClick={() => setOrderType('limit')}
              className={`px-3 py-1 rounded text-sm ${orderType === 'limit' ? 'bg-crypto-accent' : 'bg-crypto-dark'}`}
            >
              Limit
            </button>
          </div>
        </div>

        {/* Sélection Side */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setSide('buy')}
            className={`py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
              side === 'buy' 
                ? 'bg-crypto-green text-white' 
                : 'bg-crypto-dark/50 text-gray-400 hover:bg-crypto-green/20'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            ACHETER (LONG)
          </button>
          <button
            onClick={() => setSide('sell')}
            className={`py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
              side === 'sell' 
                ? 'bg-crypto-red text-white' 
                : 'bg-crypto-dark/50 text-gray-400 hover:bg-crypto-red/20'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            VENDRE (SHORT)
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulaire Ordre */}
          <div className="space-y-4">
            {/* Quantité - Mode USD/Crypto Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-gray-400 flex items-center gap-2">
                  {inputMode === 'usd' ? 'Montant (USDT)' : `Quantité (${selectedSymbol.replace('USDT', '')})`}
                  <span className="text-xs text-crypto-accent">
                    Max: {inputMode === 'usd' ? `$${(balance || 0).toFixed(2)}` : getMaxPositionSize(currentPrice || 0, 2).toFixed(6)}
                  </span>
                </label>
                {/* Toggle Mode */}
                <div className="flex bg-crypto-dark rounded-lg p-1">
                  <button
                    onClick={() => setInputMode('usd')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${inputMode === 'usd' ? 'bg-crypto-accent text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    USD
                  </button>
                  <button
                    onClick={() => setInputMode('crypto')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${inputMode === 'crypto' ? 'bg-crypto-accent text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    {selectedSymbol.replace('USDT', '')}
                  </button>
                </div>
              </div>
              
              {inputMode === 'usd' ? (
                <input
                  type="number"
                  value={usdAmount}
                  onChange={(e) => handleUsdAmountChange(e.target.value)}
                  placeholder="100.00"
                  step="0.01"
                  className="w-full bg-crypto-dark border border-crypto-accent rounded-lg px-4 py-3 mt-1 focus:border-crypto-accent focus:outline-none"
                />
              ) : (
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  placeholder="0.00"
                  step="0.000001"
                  className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-4 py-3 mt-1 focus:border-crypto-accent focus:outline-none"
                />
              )}
              
              {/* Affichage conversion */}
              {usdAmount && quantity && (
                <p className="text-xs text-gray-400 mt-1">
                  {inputMode === 'usd' 
                    ? `≈ ${parseFloat(quantity).toFixed(6)} ${selectedSymbol.replace('USDT', '')} @ $${(currentPrice || 0).toFixed(2)}`
                    : `≈ $${parseFloat(usdAmount).toFixed(2)} (${positionPercent.toFixed(2)}% du capital)`}
                </p>
              )}
            </div>

            {/* Prix (pour limit) */}
            {orderType === 'limit' && (
              <div>
                <label className="text-sm text-gray-400">Prix Limite (USDT)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder={(currentPrice || 0).toFixed(2)}
                    className="flex-1 bg-crypto-dark border border-crypto-border rounded-lg px-4 py-3 mt-1 focus:border-crypto-accent focus:outline-none"
                  />
                  <button
                    onClick={() => setPrice((currentPrice || 0).toFixed(2))}
                    className="mt-1 px-4 bg-crypto-accent/20 text-crypto-accent rounded-lg text-sm hover:bg-crypto-accent/30"
                  >
                    Market
                  </button>
                </div>
              </div>
            )}

            {/* Auto SL/TP Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoSLTP"
                checked={autoSLTP}
                onChange={(e) => setAutoSLTP(e.target.checked)}
                className="rounded border-crypto-border"
              />
              <label htmlFor="autoSLTP" className="text-sm text-gray-400">
                Calcul automatique SL/TP (SL: 2%, TP: 4%)
              </label>
            </div>

            {/* 🧠 REMPLIR AVEC IA */}
            <button
              onClick={handleFillWithAI}
              className="w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
            >
              <Brain className="w-5 h-5" />
              🧠 Remplir avec IA Ethernal
              <span className="text-xs opacity-70">(Score ≥ 70 requis)</span>
            </button>

            {/* Stop Loss - Mode Distance/Prix */}
            <div>
              <label className="text-sm text-gray-400 flex items-center gap-2">
                <Target className="w-4 h-4 text-crypto-red" />
                Stop Loss
                <span className="text-crypto-red text-xs">*OBLIGATOIRE</span>
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <span className="text-xs text-gray-500">Distance (USDT)</span>
                  <input
                    type="number"
                    value={slUsd}
                    onChange={(e) => {
                      handleSlUsdChange(e.target.value);
                      setAutoSLTP(false);
                    }}
                    placeholder="900"
                    step="0.01"
                    className="w-full bg-crypto-dark border border-crypto-red/30 rounded-lg px-3 py-2 focus:border-crypto-red focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-500">Prix SL (USDT)</span>
                  <input
                    type="number"
                    value={stopLoss}
                    onChange={(e) => {
                      handleSlPriceChange(e.target.value);
                      setAutoSLTP(false);
                    }}
                    placeholder={currentPrice > 0 ? (currentPrice * 0.98).toFixed(2) : ''}
                    step="0.01"
                    className="w-full bg-crypto-dark border border-crypto-red/30 rounded-lg px-3 py-2 focus:border-crypto-red focus:outline-none"
                  />
                </div>
              </div>
              {potentialLoss > 0 && (
                <p className="text-xs text-crypto-red mt-1">
                  Risque max: -${potentialLoss.toFixed(2)} ({((potentialLoss / (parseFloat(usdAmount) || 1)) * 100).toFixed(1)}%)
                </p>
              )}
            </div>

            {/* Take Profit - Mode Distance/Prix */}
            <div>
              <label className="text-sm text-gray-400 flex items-center gap-2">
                <Target className="w-4 h-4 text-crypto-green" />
                Take Profit
                <span className="text-crypto-green text-xs">*OBLIGATOIRE</span>
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <span className="text-xs text-gray-500">Distance (USDT)</span>
                  <input
                    type="number"
                    value={tpUsd}
                    onChange={(e) => {
                      handleTpUsdChange(e.target.value);
                      setAutoSLTP(false);
                    }}
                    placeholder="1800"
                    step="0.01"
                    className="w-full bg-crypto-dark border border-crypto-green/30 rounded-lg px-3 py-2 focus:border-crypto-green focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-500">Prix TP (USDT)</span>
                  <input
                    type="number"
                    value={takeProfit}
                    onChange={(e) => {
                      handleTpPriceChange(e.target.value);
                      setAutoSLTP(false);
                    }}
                    placeholder={currentPrice > 0 ? (currentPrice * 1.04).toFixed(2) : ''}
                    step="0.01"
                    className="w-full bg-crypto-dark border border-crypto-green/30 rounded-lg px-3 py-2 focus:border-crypto-green focus:outline-none"
                  />
                </div>
              </div>
              {potentialProfit > 0 && (
                <p className="text-xs text-crypto-green mt-1">
                  Profit potentiel: +${potentialProfit.toFixed(2)} | R/R: {riskRewardRatio.toFixed(2)}
                </p>
              )}
            </div>
          </div>

          {/* Panel Validation et Risques */}
          <div className="space-y-4">
            {/* Validation Status */}
            {validation && (
              <div className={`p-4 rounded-lg ${validation.valid ? 'bg-crypto-green/10 border border-crypto-green/30' : 'bg-crypto-red/10 border border-crypto-red/30'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className={`w-5 h-5 ${validation.valid ? 'text-crypto-green' : 'text-crypto-red'}`} />
                  <span className={`font-medium ${validation.valid ? 'text-crypto-green' : 'text-crypto-red'}`}>
                    {validation.valid ? 'Validation Risque OK' : 'Validation Échouée'}
                  </span>
                </div>
                
                {validation.errors.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {validation.errors.map((err, i) => (
                      <p key={i} className="text-sm text-crypto-red">• {err}</p>
                    ))}
                  </div>
                )}
                
                {validation.warnings.length > 0 && (
                  <div className="space-y-1">
                    {validation.warnings.map((warn, i) => (
                      <p key={i} className="text-sm text-yellow-500">• {warn}</p>
                    ))}
                  </div>
                )}
                
                {validation.valid && (
                  <div className="mt-3 pt-3 border-t border-crypto-green/20 space-y-1 text-sm">
                    <p className="text-crypto-green">
                      Position: {validation.positionPercent.toFixed(2)}% du capital
                    </p>
                    <p className="text-crypto-green">
                      Risk/Reward: {validation.riskRewardRatio?.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Risk/Reward Ratio */}
            {riskRewardRatio > 0 && (
              <div className="bg-crypto-dark/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-4 h-4 text-crypto-accent" />
                  <span className="font-medium">Risk / Reward Ratio</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-2 bg-crypto-dark rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${riskRewardRatio >= 2 ? 'bg-crypto-green' : riskRewardRatio >= 1.5 ? 'bg-yellow-500' : 'bg-crypto-red'}`}
                      style={{ width: `${Math.min(riskRewardRatio / 3 * 100, 100)}%` }}
                    />
                  </div>
                  <span className={`font-bold ${riskRewardRatio >= 2 ? 'text-crypto-green' : riskRewardRatio >= 1.5 ? 'text-yellow-500' : 'text-crypto-red'}`}>
                    1:{riskRewardRatio.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {riskRewardRatio >= 2 
                    ? '✅ Excellent ratio (recommandé: 2.0+)' 
                    : riskRewardRatio >= 1.5 
                      ? '⚠️ Ratio acceptable minimum (1.5+)' 
                      : '❌ Ratio insuffisant (< 1.5)'}
                </p>
              </div>
            )}

            {/* Bouton Exécution */}
            <button
              onClick={handleExecuteOrder}
              disabled={isExecuting || (!!validation && !validation.valid)}
              className={`w-full py-4 rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                side === 'buy'
                  ? 'bg-crypto-green hover:bg-crypto-green/80 disabled:bg-crypto-green/50'
                  : 'bg-crypto-red hover:bg-crypto-red/80 disabled:bg-crypto-red/50'
              }`}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Exécution...
                </>
              ) : (
                <>
                  {side === 'buy' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  {isDemo ? 'ORDRE DÉMO' : 'ORDRE RÉEL'} - {side === 'buy' ? 'ACHETER' : 'VENDRE'}
                </>
              )}
            </button>

            {/* Info Mode */}
            <div className={`p-3 rounded-lg flex items-start gap-2 ${isDemo ? 'bg-yellow-500/10' : 'bg-crypto-green/10'}`}>
              <AlertCircle className={`w-5 h-5 flex-shrink-0 ${isDemo ? 'text-yellow-500' : 'text-crypto-green'}`} />
              <p className={`text-sm ${isDemo ? 'text-yellow-500' : 'text-crypto-green'}`}>
                {isDemo 
                  ? 'Mode DÉMO: Ordres simulés avec prix réels. Balance fictive: $10,000.' 
                  : 'Mode RÉEL: Les ordres seront exécutés sur votre compte Binance avec de l\'argent réel.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Positions Ouvertes */}
      {positions.length > 0 && (
        <div className="crypto-card">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-crypto-accent" />
            Positions Ouvertes ({positions.length})
          </h2>
          <div className="space-y-3">
            {positions.map((pos) => {
              const safeEntryPrice = pos.entryPrice || 0;
              const safeUnrealizedPnl = pos.unrealizedPnl || 0;
              const safePnlPercent = pos.pnlPercent || 0;
              const safeSize = pos.size || 0;
              
              return (
                <div 
                  key={pos.id} 
                  className={`p-4 rounded-lg border ${safeUnrealizedPnl >= 0 ? 'border-crypto-green/30 bg-crypto-green/5' : 'border-crypto-red/30 bg-crypto-red/5'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{pos.symbol || 'Unknown'}</p>
                      <p className="text-sm text-gray-400">
                        {pos.side || 'buy'} {safeSize.toFixed(6)} @ {safeEntryPrice.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${safeUnrealizedPnl >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                        {safeUnrealizedPnl >= 0 ? '+' : ''}${safeUnrealizedPnl.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-400">
                        {safePnlPercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  {pos.stopLoss && pos.takeProfit && (
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                      <span>SL: {pos.stopLoss}</span>
                      <span>TP: {pos.takeProfit}</span>
                      <span>Mark: {(pos.markPrice || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
