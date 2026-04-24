import { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, AlertCircle, Loader2, 
  Target, Shield, Percent, Zap, Lock, Wallet, RefreshCw, Brain
} from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';
import { useTrading } from '../hooks/useTrading';
import { showToast } from '../stores/toastStore';
import { getAITradingSetup } from '../services/advancedAnalysis';

const LEVERAGE_OPTIONS = [1, 2, 3, 5, 10, 20, 50, 75, 100, 125];

export default function FuturesTrading() {
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  const prices = useCryptoStore((state) => state.prices);
  const currentPrice = prices.get(selectedSymbol)?.price || 0;
  
  const {
    balance,
    positions,
    totalUnrealizedPnl,
    isLoading,
    isExecuting,
    error,
    isDemo,
    executeFuturesTrade,
    closePosition,
    toggleDemoMode,
    resetDemo,
    getDefaultSLTP,
    validateTrade,
    clearError
  } = useTrading({ defaultIsDemo: true });
  
  const [leverage, setLeverage] = useState<number>(10);
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [quantity, setQuantity] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  
  // NOUVEAU: Mode entrée USD
  const [inputMode, setInputMode] = useState<'crypto' | 'usd'>('usd');
  const [usdAmount, setUsdAmount] = useState<string>('');
  const [slUsd, setSlUsd] = useState<string>('');
  const [tpUsd, setTpUsd] = useState<string>('');
  
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [autoSLTP, setAutoSLTP] = useState<boolean>(true);
  const [showLeverageModal, setShowLeverageModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'trade' | 'positions'>('trade');
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[]; positionPercent: number; riskRewardRatio: number } | null>(null);

  // SL/TP automatiques (basé sur prix entré ou prix marché)
  useEffect(() => {
    // Déterminer le prix de référence : prix entré manuellement ou prix du marché
    const referencePrice = (orderType === 'limit' && price && parseFloat(price) > 0)
      ? parseFloat(price)
      : currentPrice;

    if (autoSLTP && referencePrice > 0) {
      const defaults = getDefaultSLTP(referencePrice, side === 'long' ? 'BUY' : 'SELL');
      setStopLoss(defaults.stopLoss.toFixed(2));
      setTakeProfit(defaults.takeProfit.toFixed(2));
      // Convertir en USD aussi
      const slDistance = Math.abs(referencePrice - defaults.stopLoss);
      const tpDistance = Math.abs(defaults.takeProfit - referencePrice);
      setSlUsd((slDistance > 0 ? slDistance.toFixed(2) : ''));
      setTpUsd((tpDistance > 0 ? tpDistance.toFixed(2) : ''));
    }
  }, [currentPrice, side, autoSLTP, getDefaultSLTP, orderType, price]);
  
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
      const sl = side === 'long' 
        ? (currentPrice - slDistance).toFixed(2)
        : (currentPrice + slDistance).toFixed(2);
      setStopLoss(sl);
    }
  };
  
  const handleTpUsdChange = (value: string) => {
    setTpUsd(value);
    if (currentPrice > 0 && value) {
      const tpDistance = parseFloat(value);
      const tp = side === 'long'
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

  // 🧠 REMPLIR AVEC IA - RESPECTE LE MONTANT USDT
  const handleFillWithAI = async () => {
    console.log('[FuturesTrading] handleFillWithAI called - selectedSymbol:', selectedSymbol);

    let livePrice = currentPrice;
    console.log('[FuturesTrading] Prix du store:', livePrice);

    // Si le prix n'est pas dans le store, le charger depuis l'API
    if (!livePrice || livePrice <= 0) {
      console.log('[FuturesTrading] Prix non disponible dans le store, chargement depuis API...');
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        console.log('[FuturesTrading] API_URL:', API_URL);
        const response = await fetch(`${API_URL}/api/prices?symbols=${selectedSymbol}`);
        const data = await response.json();
        console.log('[FuturesTrading] API response:', data);

        if (data.success && data.prices && data.prices.length > 0) {
          livePrice = data.prices[0].price;
          console.log('[FuturesTrading] Prix récupéré depuis API:', livePrice);
          // Mettre à jour le store avec le prix récupéré
          useCryptoStore.getState().setPrice(selectedSymbol, {
            symbol: selectedSymbol,
            price: livePrice,
            change24h: data.prices[0].priceChangePercent || 0,
            change24hValue: 0,
            volume24h: data.prices[0].volume || 0,
            high24h: data.prices[0].highPrice || 0,
            low24h: data.prices[0].lowPrice || 0,
            lastUpdate: Date.now()
          });
        } else {
          // Fallback: utiliser un prix fictif basé sur le symbol si API retourne vide
          console.warn('[FuturesTrading] API retourne tableau vide ou invalide, utilisation fallback');
          const fallbackPrices: Record<string, number> = {
            'BTCUSDT': 45000,
            'ETHUSDT': 3000,
            'BNBUSDT': 250,
            'SOLUSDT': 100,
            'ADAUSDT': 0.5,
            'XRPUSDT': 0.6,
            'DOTUSDT': 7,
            'DOGEUSDT': 0.15
          };
          livePrice = fallbackPrices[selectedSymbol] || 100;
          console.log('[FuturesTrading] Prix fallback utilisé:', livePrice);
          showToast.warning('Prix API non disponible - Utilisation prix estimé', 'Attention');
        }
      } catch (error) {
        console.error('[FuturesTrading] Erreur lors du chargement du prix:', error);
        // Fallback: utiliser un prix fictif basé sur le symbol
        const fallbackPrices: Record<string, number> = {
          'BTCUSDT': 45000,
          'ETHUSDT': 3000,
          'BNBUSDT': 250,
          'SOLUSDT': 100,
          'ADAUSDT': 0.5,
          'XRPUSDT': 0.6,
          'DOTUSDT': 7,
          'DOGEUSDT': 0.15
        };
        livePrice = fallbackPrices[selectedSymbol] || 100;
        console.log('[FuturesTrading] Prix fallback utilisé (erreur):', livePrice);
        showToast.warning('Prix API non disponible - Utilisation prix estimé', 'Attention');
      }
    }

    if (!livePrice || livePrice <= 0) {
      console.error('[FuturesTrading] Prix toujours non disponible après toutes les tentatives');
      showToast.error('Prix actuel non disponible - Veuillez réessayer', 'Erreur');
      return;
    }

    console.log('[FuturesTrading] Prix final utilisé:', livePrice);
    const setup = getAITradingSetup(selectedSymbol, livePrice);
    console.log('[FuturesTrading] Setup IA:', setup);

    // 🎯 RESPECTER LE MONTANT USDT DE L'UTILISATEUR
    let userUsdAmount = parseFloat(usdAmount) || 0;

    // Si l'utilisateur n'a pas entré de montant, utiliser 2% du balance par défaut
    if (userUsdAmount <= 0) {
      userUsdAmount = balance * 0.02;
      setUsdAmount(userUsdAmount.toFixed(2));
    }

    const maxAllowedUsd = Math.min(userUsdAmount, balance * 0.10);

    // Appliquer le setup IA avec LE MONTANT DE L'UTILISATEUR
    if (setup.entryPrice) {
      // Calculer quantité basée sur le montant USDT (avec levier)
      const qty = (maxAllowedUsd * leverage / setup.entryPrice).toFixed(6);
      setQuantity(qty);

      // Recalculer le vrai montant USDT
      const actualUsdUsed = (parseFloat(qty) * setup.entryPrice / leverage).toFixed(2);
      setUsdAmount(actualUsdUsed);

      // 🚨 ALERTE si dépasse budget
      if (parseFloat(actualUsdUsed) > balance) {
        showToast.warning(`⚠️ Montant ${actualUsdUsed}$ > Balance ${balance}$`, 'Attention Budget');
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
      setSide('long');
    } else if (setup.direction === 'SHORT') {
      setSide('short');
    }

    setAutoSLTP(false);

    showToast.success(
      `🧠 Setup IA appliqué! ${setup.direction} @ $${setup.entryPrice} (Score: ${setup.score}/100, Levier: ${leverage}x)`,
      'Signal IA'
    );
  };

  // Validation - utilisé dans l'input handler plutôt que useEffect pour éviter les boucles
  const handleValidate = useCallback(() => {
    if (quantity && parseFloat(quantity) > 0) {
      const result = validateTrade({
        symbol: selectedSymbol,
        side: side === 'long' ? 'BUY' : 'SELL',
        type: orderType === 'market' ? 'MARKET' : 'LIMIT',
        quantity: parseFloat(quantity),
        price: orderType === 'limit' ? parseFloat(price) || currentPrice : currentPrice,
        stopLoss: parseFloat(stopLoss) || 0,
        takeProfit: parseFloat(takeProfit) || 0
      });
      setValidation(result);
    } else {
      setValidation(null);
    }
  }, [quantity, price, stopLoss, takeProfit, orderType, side, selectedSymbol, currentPrice, validateTrade]);
  
  // Valider quand les inputs changent (débouncé)
  useEffect(() => {
    const timeout = setTimeout(() => {
      handleValidate();
    }, 300);
    return () => clearTimeout(timeout);
  }, [handleValidate]);

  // Erreurs
  useEffect(() => {
    if (error) {
      showToast.error(error, 'Erreur Futures');
      clearError();
    }
  }, [error, clearError]);

  const handleExecute = async () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      showToast.error('Veuillez entrer une quantité valide', 'Erreur');
      return;
    }
    if (!stopLoss || !takeProfit) {
      showToast.error('Stop Loss et Take Profit sont obligatoires', 'Validation');
      return;
    }
    
    // 🚨 VALIDATION STRICTE DU MONTANT ET RISQUE
    const orderValue = parseFloat(quantity) * (orderType === 'market' ? currentPrice : (parseFloat(price) || currentPrice)) / leverage;
    const riskPercent = (orderValue / balance) * 100;
    
    const safeBalance = balance || 0;
    if (orderValue > safeBalance) {
      showToast.error(`❌ MONTANT INTERDIT: $${orderValue.toFixed(2)} > Balance $${safeBalance.toFixed(2)}`, 'BLOQUÉ');
      return;
    }
    if (riskPercent > 2.5) {
      showToast.error(`❌ RISQUE TROP ÉLEVÉ: ${riskPercent.toFixed(2)}% > 2% max`, 'BLOQUÉ');
      return;
    }
    if (riskPercent > 10) {
      showToast.warning(`⚠️ Position large: ${riskPercent.toFixed(1)}% du capital`, 'Attention');
    }
    
    if (validation && !validation.valid) {
      showToast.error(validation.errors[0], 'Validation Risque');
      return;
    }

    const result = await executeFuturesTrade({
      symbol: selectedSymbol,
      side: side === 'long' ? 'BUY' : 'SELL',
      type: orderType === 'market' ? 'MARKET' : 'LIMIT',
      quantity: parseFloat(quantity),
      price: orderType === 'limit' ? parseFloat(price) : undefined,
      leverage,
      stopLoss: parseFloat(stopLoss),
      takeProfit: parseFloat(takeProfit)
    });

    if (result.success) {
      showToast.success(`✅ Position ${side.toUpperCase()} ${isDemo ? 'DÉMO' : 'RÉELLE'} ouverte!`, 'Position Ouverte');
      setQuantity('');
      setPrice('');
      setUsdAmount('');
      setSlUsd('');
      setTpUsd('');
    } else {
      showToast.error(result.error || 'Échec', 'Erreur');
    }
  };

  const handleClose = async (position: any) => {
    const result = await closePosition(position);
    if (result.success) {
      showToast.success(`Position fermée | PnL: ${result.pnl?.toFixed(2) || 0} USDT`, 'Fermée');
    } else {
      showToast.error(result.error || 'Échec', 'Erreur');
    }
  };

  // Calculs
  const notional = quantity ? parseFloat(quantity) * (orderType === 'market' ? currentPrice : (parseFloat(price) || currentPrice)) : 0;
  const margin = notional / leverage;
  const liqPrice = notional > 0 ? (side === 'long' ? currentPrice * (1 - 0.9 / leverage) : currentPrice * (1 + 0.9 / leverage)) : 0;
  const potentialProfit = quantity && takeProfit ? Math.abs(parseFloat(takeProfit) - currentPrice) * parseFloat(quantity) * leverage : 0;
  const potentialLoss = quantity && stopLoss ? Math.abs(currentPrice - parseFloat(stopLoss)) * parseFloat(quantity) * leverage : 0;
  const rr = potentialLoss > 0 && potentialProfit > 0 ? potentialProfit / potentialLoss : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-400" />
          Futures Trading
          <span className={`text-sm px-2 py-1 rounded ${isDemo ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
            {isDemo ? 'DÉMO' : 'RÉEL'}
          </span>
        </h1>
        <div className="flex gap-2">
          <button onClick={resetDemo} className="px-3 py-2 bg-crypto-dark rounded-lg text-sm hover:bg-crypto-border">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => toggleDemoMode(!isDemo)} className={`px-4 py-2 rounded-lg font-medium ${isDemo ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
            {isDemo ? 'Passer en Réel' : 'Passer en Démo'}
          </button>
        </div>
      </div>

      {/* Balance */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Balance</div>
          <div className="text-2xl font-bold">${(balance || 0).toFixed(2)}</div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Marge Utilisée</div>
          <div className="text-2xl font-bold">${(margin || 0).toFixed(2)}</div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">P&L Non Réalisé</div>
          <div className={`text-2xl font-bold ${(totalUnrealizedPnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {(totalUnrealizedPnl || 0) >= 0 ? '+' : ''}${(totalUnrealizedPnl || 0).toFixed(2)}
          </div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Positions</div>
          <div className="text-2xl font-bold">{positions.length}</div>
        </div>
      </div>

      {/* Trading Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="crypto-card">
          <h2 className="text-lg font-semibold mb-4">Nouvelle Position</h2>
          
          <div className="mb-4 p-3 bg-crypto-dark/50 rounded-lg">
            <div className="text-sm text-gray-400">{selectedSymbol}</div>
            <div className="text-2xl font-bold font-mono">${(currentPrice || 0).toLocaleString()}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => setSide('long')} className={`py-2 rounded-lg font-medium ${side === 'long' ? 'bg-green-500 text-white' : 'bg-crypto-dark'}`}>LONG</button>
            <button onClick={() => setSide('short')} className={`py-2 rounded-lg font-medium ${side === 'short' ? 'bg-red-500 text-white' : 'bg-crypto-dark'}`}>SHORT</button>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Levier</span>
              <span className="text-yellow-400 font-bold">{leverage}x</span>
            </div>
            <input type="range" min="0" max="9" value={LEVERAGE_OPTIONS.indexOf(leverage)} onChange={(e) => setLeverage(LEVERAGE_OPTIONS[parseInt(e.target.value)])} className="w-full" />
          </div>

          {/* Quantité - Mode USD/Crypto Toggle */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-400">
                {inputMode === 'usd' ? 'Montant (USDT)' : `Quantité (${selectedSymbol.replace('USDT', '')})`}
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
                className="w-full bg-crypto-dark border border-crypto-accent rounded-lg px-3 py-2" 
              />
            ) : (
              <input 
                type="number" 
                value={quantity} 
                onChange={(e) => handleQuantityChange(e.target.value)} 
                placeholder="0.01" 
                step="0.000001"
                className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2" 
              />
            )}
            
            {/* Affichage conversion */}
            {usdAmount && quantity && (
              <p className="text-xs text-gray-400 mt-1">
                {inputMode === 'usd' 
                  ? `≈ ${parseFloat(quantity).toFixed(6)} ${selectedSymbol.replace('USDT', '')}`
                  : `≈ $${parseFloat(usdAmount).toFixed(2)}`}
              </p>
            )}
          </div>

          {/* SL/TP - Mode Distance/Prix */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={autoSLTP} onChange={(e) => setAutoSLTP(e.target.checked)} className="rounded" />
              <span className="text-sm text-gray-400">SL/TP Auto</span>
            </div>

            {/* 🧠 REMPLIR AVEC IA */}
            <button
              onClick={handleFillWithAI}
              className="w-full py-2.5 mb-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 rounded-lg font-medium flex items-center justify-center gap-2 transition-all text-sm"
            >
              <Brain className="w-4 h-4" />
              🧠 Remplir avec IA Ethernal
              <span className="text-xs opacity-70">(Score ≥ 70)</span>
            </button>
            
            {/* Stop Loss */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <span className="text-xs text-gray-500 block mb-1">SL Distance (USDT)</span>
                <input 
                  type="number" 
                  value={slUsd} 
                  onChange={(e) => { handleSlUsdChange(e.target.value); setAutoSLTP(false); }}
                  placeholder="900"
                  step="0.01"
                  className="w-full bg-crypto-dark border border-red-500/30 rounded-lg px-3 py-2 text-sm" 
                />
              </div>
              <div>
                <span className="text-xs text-gray-500 block mb-1">Prix SL (USDT)</span>
                <input 
                  type="number" 
                  value={stopLoss} 
                  onChange={(e) => { handleSlPriceChange(e.target.value); setAutoSLTP(false); }}
                  placeholder={(currentPrice || 0) > 0 ? (side === 'long' ? ((currentPrice || 0) * 0.98).toFixed(2) : ((currentPrice || 0) * 1.02).toFixed(2)) : ''}
                  step="0.01"
                  className="w-full bg-crypto-dark border border-red-500/30 rounded-lg px-3 py-2 text-sm" 
                />
              </div>
            </div>
            
            {/* Take Profit */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-gray-500 block mb-1">TP Distance (USDT)</span>
                <input 
                  type="number" 
                  value={tpUsd} 
                  onChange={(e) => { handleTpUsdChange(e.target.value); setAutoSLTP(false); }}
                  placeholder="1800"
                  step="0.01"
                  className="w-full bg-crypto-dark border border-green-500/30 rounded-lg px-3 py-2 text-sm" 
                />
              </div>
              <div>
                <span className="text-xs text-gray-500 block mb-1">Prix TP (USDT)</span>
                <input 
                  type="number" 
                  value={takeProfit} 
                  onChange={(e) => { handleTpPriceChange(e.target.value); setAutoSLTP(false); }}
                  placeholder={(currentPrice || 0) > 0 ? (side === 'long' ? ((currentPrice || 0) * 1.04).toFixed(2) : ((currentPrice || 0) * 0.96).toFixed(2)) : ''}
                  step="0.01"
                  className="w-full bg-crypto-dark border border-green-500/30 rounded-lg px-3 py-2 text-sm" 
                />
              </div>
            </div>
            
            {/* Affichage R/R */}
            {potentialLoss > 0 && potentialProfit > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Risque: ${(potentialLoss || 0).toFixed(2)} | Profit: ${(potentialProfit || 0).toFixed(2)} | R/R: {(rr || 0).toFixed(2)}
              </p>
            )}
          </div>

          {validation && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${validation.valid ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              {validation.errors.map((e, i) => <p key={i} className="text-red-400">{e}</p>)}
              {validation.warnings.map((w, i) => <p key={i} className="text-yellow-400">{w}</p>)}
            </div>
          )}

          <button onClick={handleExecute} disabled={isExecuting || (!!validation && !validation.valid)} className={`w-full py-3 rounded-lg font-semibold ${side === 'long' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} disabled:opacity-50`}>
            {isExecuting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `${side === 'long' ? 'LONG' : 'SHORT'} ${leverage}x`}
          </button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2">
            {(['trade', 'positions'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg capitalize ${activeTab === tab ? 'bg-crypto-blue text-white' : 'bg-crypto-dark text-gray-400'}`}>
                {tab}
              </button>
            ))}
          </div>

          <div className="crypto-card">
            {activeTab === 'positions' && (
              <>
                <h3 className="text-lg font-semibold mb-4">Positions Ouvertes</h3>
                {positions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Aucune position ouverte</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {positions.map((pos) => (
                      <div key={pos.id} className={`p-4 rounded-lg border ${pos.side === 'LONG' ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded text-xs ${pos.side === 'LONG' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>{pos.side} {pos.leverage}x</span>
                            <span className="font-semibold">{pos.symbol}</span>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${(pos.unrealizedPnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>{(pos.unrealizedPnl || 0) >= 0 ? '+' : ''}${(pos.unrealizedPnl || 0).toFixed(2)}</div>
                          </div>
                          <button onClick={() => handleClose(pos)} disabled={isExecuting} className="px-3 py-1.5 bg-crypto-dark hover:bg-red-500/20 text-red-500 rounded text-sm">Fermer</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'trade' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Détails de l'Ordre</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-crypto-dark/50 rounded-lg">
                    <div className="text-gray-400">Valeur Notionnelle</div>
                    <div className="font-mono">${(notional || 0).toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-crypto-dark/50 rounded-lg">
                    <div className="text-gray-400">Marge Requise</div>
                    <div className="font-mono">${margin.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-crypto-dark/50 rounded-lg">
                    <div className="text-gray-400">Prix de Liquidation</div>
                    <div className="font-mono text-red-500">${liqPrice.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-crypto-dark/50 rounded-lg">
                    <div className="text-gray-400">Risk/Reward</div>
                    <div className="font-mono">{rr.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
