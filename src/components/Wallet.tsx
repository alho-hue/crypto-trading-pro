import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Wallet as WalletIcon, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  RefreshCcw, 
  History,
  Smartphone,
  Building2,
  Bitcoin,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Clock,
  X,
  Lock,
  Unlock,
  QrCode,
  ExternalLink,
  Info
} from 'lucide-react';
import {
  initializeWallet,
  depositMobileMoney,
  withdrawMobileMoney,
  depositCrypto,
  withdrawCrypto,
  convertWalletCurrency,
  fetchWalletTransactions,
  checkTransactionStatus,
  subscribeWalletUpdates,
  getCurrentWalletState,
  formatXOF,
  formatCrypto,
  formatBalance,
  calculateConversion,
  is2FASessionValid,
  verify2FACode,
  verifyConfirmationCode,
  type WalletState,
  type WalletTransaction,
  type TransactionStatus
} from '../services/walletRealService';
import {
  MOBILE_MONEY_PROVIDERS,
  validatePhoneNumber,
  formatPhoneNumber,
  detectProvider
} from '../services/mobileMoneyService';
import {
  request2FAVerification
} from '../services/securityService';
import { getCryptoPrices } from '../services/currencyService';
import { showToast } from '../stores/toastStore';

export default function Wallet() {
  // 🎯 États principaux
  const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdraw' | 'convert' | 'history'>('overview');
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, number>>({});
  const [showBalances, setShowBalances] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // 🔐 Sécurité
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [securityVerified, setSecurityVerified] = useState(false);

  // 💰 Formulaire Dépôt
  const [depositAmount, setDepositAmount] = useState('');
  const [depositCurrency, setDepositCurrency] = useState<'XOF' | 'USDT'>('XOF');
  const [depositMethod, setDepositMethod] = useState<'mobile_money' | 'bank_transfer' | 'crypto'>('mobile_money');
  const [depositPhone, setDepositPhone] = useState('');
  const [depositProvider, setDepositProvider] = useState<typeof MOBILE_MONEY_PROVIDERS[number]['id']>('MTN');
  const [depositTxHash, setDepositTxHash] = useState('');
  const [depositNetwork, setDepositNetwork] = useState('TRC20');
  const [depositConversion, setDepositConversion] = useState<{ xof: number; usdt: number } | null>(null);

  // 💸 Formulaire Retrait
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawCurrency, setWithdrawCurrency] = useState<'USDT' | 'BTC' | 'ETH'>('USDT');
  const [withdrawMethod, setWithdrawMethod] = useState<'mobile_money' | 'bank_transfer' | 'crypto'>('mobile_money');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawProvider, setWithdrawProvider] = useState<typeof MOBILE_MONEY_PROVIDERS[number]['id']>('MTN');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawMemo, setWithdrawMemo] = useState('');
  const [withdrawConfirmationCode, setWithdrawConfirmationCode] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  // 🔄 Formulaire Conversion
  const [convertFrom, setConvertFrom] = useState('USDT');
  const [convertTo, setConvertTo] = useState('XOF');
  const [convertAmount, setConvertAmount] = useState('');
  const [conversionPreview, setConversionPreview] = useState<{ toAmount: number; rate: number; fee: number; feePercent: number; netAmount: number } | null>(null);
  const [converting, setConverting] = useState(false);

  // 📊 Filtres historique
  const [historyFilter, setHistoryFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'conversion'>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<WalletTransaction | null>(null);

  // 🔔 Toast pour notifications
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 🚀 Initialisation
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setLoading(true);
      try {
        // Initialiser wallet
        const result = await initializeWallet();
        if (isMounted && result.success && result.state) {
          setWalletState(result.state);
          setIsDemoMode(result.state.isDemoMode);
          setLastUpdate(new Date());

          // Charger prix crypto
          const prices = await getCryptoPrices();
          if (isMounted) setCryptoPrices(prices);
        }
      } catch (error) {
        console.error('Erreur init wallet:', error);
        showToast.error('Erreur chargement wallet', 'Erreur');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    // S'abonner aux mises à jour temps réel
    const unsubscribe = subscribeWalletUpdates((newState) => {
      if (isMounted) {
        setWalletState(newState);
        setLastUpdate(new Date());
      }
    });

    unsubscribeRef.current = unsubscribe;

    // Auto-refresh prix
    const priceInterval = setInterval(async () => {
      const prices = await getCryptoPrices();
      if (isMounted) setCryptoPrices(prices);
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(priceInterval);
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []);

  // 🔄 Mise à jour conversion
  useEffect(() => {
    const updateConversion = async () => {
      if (convertAmount && parseFloat(convertAmount) > 0) {
        try {
          const { calculateConversion } = await import('../services/currencyService');
          const preview = await calculateConversion(convertFrom, convertTo, parseFloat(convertAmount));
          setConversionPreview(preview);
        } catch (error) {
          console.error('Erreur conversion:', error);
        }
      } else {
        setConversionPreview(null);
      }
    };

    updateConversion();
  }, [convertAmount, convertFrom, convertTo]);

  // 🔄 Mise à jour dépôt conversion (XOF → USDT)
  useEffect(() => {
    const updateDepositConversion = async () => {
      if (depositAmount && depositCurrency === 'XOF') {
        try {
          const { convertFromXOF } = await import('../services/currencyService');
          const usdt = await convertFromXOF(parseFloat(depositAmount));
          setDepositConversion({ xof: parseFloat(depositAmount), usdt });
        } catch (error) {
          console.error('Erreur conversion:', error);
        }
      }
    };

    updateDepositConversion();
  }, [depositAmount, depositCurrency]);

  // 📱 Auto-détection opérateur
  useEffect(() => {
    if (depositPhone.length >= 10) {
      const detected = detectProvider(depositPhone);
      if (detected) setDepositProvider(detected);
    }
  }, [depositPhone]);

  useEffect(() => {
    if (withdrawPhone.length >= 10) {
      const detected = detectProvider(withdrawPhone);
      if (detected) setWithdrawProvider(detected);
    }
  }, [withdrawPhone]);

  // 🔐 Vérification 2FA
  const checkSecurity = useCallback(async (action: () => void) => {
    if (!is2FASessionValid()) {
      setPendingAction(() => action);
      setShow2FAModal(true);
      return;
    }
    action();
  }, []);

  const handleVerify2FA = async () => {
    const result = await verify2FACode('', twoFACode);
    if (result.verified) {
      setShow2FAModal(false);
      setTwoFACode('');
      setSecurityVerified(true);
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } else {
      showToast.error(result.message, 'Erreur 2FA');
    }
  };

  // 💰 HANDLERS TRANSACTIONS

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      showToast.error('Montant invalide', 'Erreur');
      return;
    }

    // Validation spécifique
    if (depositMethod === 'mobile_money') {
      if (!validatePhoneNumber(depositPhone, depositProvider)) {
        showToast.error('Numéro de téléphone invalide', 'Erreur');
        return;
      }
    } else if (depositMethod === 'crypto' && !depositTxHash) {
      showToast.error('Transaction hash requis', 'Erreur');
      return;
    }

    setLoading(true);

    const executeDeposit = async () => {
      try {
        if (depositMethod === 'mobile_money') {
          const result = await depositMobileMoney(
            parseFloat(depositAmount),
            depositPhone,
            depositProvider
          );

          if (result.success) {
            showToast.success(result.message || 'Dépôt initié', 'Dépôt');
            resetDepositForm();
            setActiveTab('history');
          } else {
            if (result.requiresVerification) {
              setPendingAction(() => executeDeposit);
              setShow2FAModal(true);
            } else {
              showToast.error(result.message || 'Erreur dépôt', 'Erreur');
            }
          }
        } else if (depositMethod === 'crypto') {
          const result = await depositCrypto({
            amount: parseFloat(depositAmount),
            currency: depositCurrency,
            txHash: depositTxHash,
            network: depositNetwork
          });

          if (result.success) {
            showToast.success(result.message || 'Dépôt enregistré', 'Dépôt');
            resetDepositForm();
            setActiveTab('history');
          } else {
            showToast.error(result.message || 'Erreur dépôt', 'Erreur');
          }
        }
      } catch (error) {
        showToast.error('Erreur lors du dépôt', 'Erreur');
      } finally {
        setLoading(false);
      }
    };

    await executeDeposit();
  }

  function resetDepositForm() {
    setDepositAmount('');
    setDepositPhone('');
    setDepositTxHash('');
    setDepositConversion(null);
  }

  async function handleWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      showToast.error('Montant invalide', 'Erreur');
      return;
    }

    // Vérifier solde
    const balance = walletState?.balances.find(b => b.asset === withdrawCurrency);
    const available = parseFloat(balance?.free || '0');
    if (available < parseFloat(withdrawAmount)) {
      showToast.error(`Solde ${withdrawCurrency} insuffisant`, 'Erreur');
      return;
    }

    setLoading(true);

    const executeWithdrawal = async () => {
      try {
        if (withdrawMethod === 'mobile_money') {
          // Conversion USDT → FCFA
          const { convertToXOF } = await import('../services/currencyService');
          const amountXOF = await convertToXOF(parseFloat(withdrawAmount));

          const result = await withdrawMobileMoney(
            parseFloat(withdrawAmount),
            withdrawPhone,
            withdrawProvider
          );

          if (result.success) {
            showToast.success(result.message || 'Retrait initié', 'Retrait');
            resetWithdrawForm();
            setActiveTab('history');
          } else {
            if (result.requiresVerification) {
              setPendingAction(() => executeWithdrawal);
              setShow2FAModal(true);
            } else {
              showToast.error(result.message || 'Erreur retrait', 'Erreur');
            }
          }
        } else if (withdrawMethod === 'crypto') {
          if (!withdrawAddress) {
            showToast.error('Adresse de destination requise', 'Erreur');
            setLoading(false);
            return;
          }

          const result = await withdrawCrypto({
            amount: parseFloat(withdrawAmount),
            currency: withdrawCurrency,
            address: withdrawAddress,
            network: depositNetwork,
            memo: withdrawMemo
          });

          if (result.success) {
            showToast.success(result.message || 'Retrait initié', 'Retrait');
            resetWithdrawForm();
            setActiveTab('history');
          } else {
            if (result.requiresVerification) {
              setNeedsConfirmation(true);
            } else {
              showToast.error(result.message || 'Erreur retrait', 'Erreur');
            }
          }
        }
      } catch (error) {
        showToast.error('Erreur lors du retrait', 'Erreur');
      } finally {
        setLoading(false);
      }
    };

    // Vérifier sécurité pour gros montants
    if (parseFloat(withdrawAmount) > 1000) {
      checkSecurity(executeWithdrawal);
    } else {
      await executeWithdrawal();
    }
  }

  function resetWithdrawForm() {
    setWithdrawAmount('');
    setWithdrawPhone('');
    setWithdrawAddress('');
    setWithdrawMemo('');
    setWithdrawConfirmationCode('');
    setNeedsConfirmation(false);
  }

  async function handleConversion(e: React.FormEvent) {
    e.preventDefault();
    if (!convertAmount || parseFloat(convertAmount) <= 0) {
      showToast.error('Montant invalide', 'Erreur');
      return;
    }

    setConverting(true);

    try {
      const result = await convertWalletCurrency(
        convertFrom,
        convertTo,
        parseFloat(convertAmount)
      );

      if (result.success) {
        showToast.success(
          `Conversion: ${result.result?.fromAmount.toFixed(4)} ${convertFrom} → ${result.result?.netAmount.toFixed(4)} ${convertTo}`,
          'Conversion réussie'
        );
        setConvertAmount('');
        setConversionPreview(null);
        setActiveTab('history');
      } else {
        showToast.error(result.message || 'Erreur conversion', 'Erreur');
      }
    } catch (error) {
      showToast.error('Erreur lors de la conversion', 'Erreur');
    } finally {
      setConverting(false);
    }
  }

  async function refreshData() {
    setLoading(true);
    try {
      const { refreshWallet } = await import('../services/binanceWalletService');
      await refreshWallet();
      
      const txResult = await fetchWalletTransactions(50);
      if (txResult.success && walletState) {
        setWalletState({ ...walletState, transactions: txResult.transactions || [] });
      }
      
      showToast.success('Données actualisées', 'Rafraîchissement');
    } catch (error) {
      showToast.error('Erreur actualisation', 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  function getTotalBalanceUSDT(): number {
    return walletState?.totalUSDT || 0;
  }

  function getTotalBalanceXOF(): number {
    return walletState?.totalXOF || 0;
  }

  function formatCurrency(amount: number, currency: string): string {
    if (currency === 'XOF') return formatXOF(amount);
    if (currency === 'USDT' || currency === 'BUSD' || currency === 'USDC') return `$${amount.toFixed(2)}`;
    return formatCrypto(amount, currency);
  }

  function getFilteredTransactions(): WalletTransaction[] {
    if (!walletState?.transactions) return [];
    if (historyFilter === 'all') return walletState.transactions;
    return walletState.transactions.filter(t => t.type === historyFilter);
  }

  function getStatusColor(status: TransactionStatus): string {
    switch (status) {
      case 'completed': return 'text-crypto-green';
      case 'pending': return 'text-yellow-500';
      case 'processing': return 'text-blue-500';
      case 'failed': return 'text-crypto-red';
      case 'cancelled': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  }

  function getStatusIcon(status: TransactionStatus) {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-crypto-green" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-crypto-red" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  }

  // 🎨 RENDER
  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* 🔐 Modal 2FA */}
      {show2FAModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-crypto-dark border border-gray-700 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-8 h-8 text-crypto-accent" />
              <h3 className="text-xl font-bold">Vérification 2FA</h3>
            </div>
            <p className="text-gray-400 mb-4">
              Cette action nécessite une vérification de sécurité. Entrez votre code 2FA.
            </p>
            <input
              type="text"
              value={twoFACode}
              onChange={(e) => setTwoFACode(e.target.value)}
              placeholder="000000"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-center text-2xl tracking-widest mb-4"
              maxLength={6}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShow2FAModal(false)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleVerify2FA}
                disabled={twoFACode.length !== 6}
                className="flex-1 py-2 bg-crypto-accent hover:bg-crypto-accent/80 rounded-lg font-medium disabled:opacity-50"
              >
                Vérifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <WalletIcon className="w-6 h-6 text-crypto-accent" />
            Portefeuille
            {isDemoMode && (
              <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded ml-2">
                MODE DÉMO
              </span>
            )}
          </h1>
          <p className="text-gray-400">
            Données temps réel • Mis à jour {lastUpdate.toLocaleTimeString('fr-FR')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBalances(!showBalances)}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
            title={showBalances ? 'Masquer' : 'Afficher'}
          >
            {showBalances ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
          <button
            onClick={refreshData}
            disabled={loading}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-50"
          >
            <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total */}
        <div className="crypto-card bg-gradient-to-br from-crypto-accent/20 to-transparent">
          <div className="text-sm text-gray-400 mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Solde Total (USDT)
          </div>
          <div className="text-2xl font-bold">
            {showBalances ? `$${getTotalBalanceUSDT().toFixed(2)}` : '****'}
          </div>
          <div className="text-sm text-gray-500">
            {showBalances ? formatXOF(getTotalBalanceXOF()) : '****'}
          </div>
        </div>

        {/* USDT */}
        <div className="crypto-card">
          <div className="text-sm text-gray-400 mb-1">USDT</div>
          <div className="text-2xl font-bold text-crypto-accent">
            {showBalances ? formatBalance(
              walletState?.balances.find(b => b.asset === 'USDT') || { asset: 'USDT', free: '0', locked: '0', total: '0', valueUSDT: 0 }
            ) : '****'}
          </div>
          <div className="text-xs text-gray-500">{showBalances ? 'Stablecoin' : ''}</div>
        </div>

        {/* BTC */}
        <div className="crypto-card">
          <div className="text-sm text-gray-400 mb-1">BTC</div>
          <div className="text-2xl font-bold text-orange-500">
            {showBalances ? formatBalance(
              walletState?.balances.find(b => b.asset === 'BTC') || { asset: 'BTC', free: '0', locked: '0', total: '0', valueUSDT: 0 }
            ) : '****'}
          </div>
          <div className="text-xs text-gray-500">
            {(walletState && walletState.balances.find(b => b.asset === 'BTC')?.valueUSDT)
              ? `≈ $${walletState.balances.find(b => b.asset === 'BTC')?.valueUSDT?.toFixed(2) || '0.00'}`
              : ''}
          </div>
        </div>

        {/* ETH */}
        <div className="crypto-card">
          <div className="text-sm text-gray-400 mb-1">ETH</div>
          <div className="text-2xl font-bold text-purple-500">
            {showBalances ? formatBalance(
              walletState?.balances.find(b => b.asset === 'ETH') || { asset: 'ETH', free: '0', locked: '0', total: '0', valueUSDT: 0 }
            ) : '****'}
          </div>
          <div className="text-xs text-gray-500">
            {(showBalances && walletState && walletState.balances.find(b => b.asset === 'ETH')?.valueUSDT)
              ? `≈ $${walletState.balances.find(b => b.asset === 'ETH')?.valueUSDT?.toFixed(2)}`
              : ''}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setActiveTab('deposit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'deposit' ? 'bg-crypto-green text-black' : 'bg-crypto-gray hover:bg-crypto-gray/80'
          }`}
        >
          <ArrowDownCircle className="w-5 h-5" />
          Dépôt
        </button>
        <button
          onClick={() => setActiveTab('withdraw')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'withdraw' ? 'bg-crypto-red text-white' : 'bg-crypto-gray hover:bg-crypto-gray/80'
          }`}
        >
          <ArrowUpCircle className="w-5 h-5" />
          Retrait
        </button>
        <button
          onClick={() => setActiveTab('convert')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'convert' ? 'bg-crypto-accent text-white' : 'bg-crypto-gray hover:bg-crypto-gray/80'
          }`}
        >
          <RefreshCcw className="w-5 h-5" />
          Convertir
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'history' ? 'bg-crypto-purple text-white' : 'bg-crypto-gray hover:bg-crypto-gray/80'
          }`}
        >
          <History className="w-5 h-5" />
          Historique
        </button>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Deposit Form */}
        {activeTab === 'deposit' && (
          <div className="crypto-card max-w-2xl">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-crypto-green" />
              Effectuer un Dépôt
            </h3>
            
            <form onSubmit={handleDeposit} className="space-y-4">
              {/* Method Selection */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Méthode de dépôt</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDepositMethod('mobile_money')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      depositMethod === 'mobile_money' 
                        ? 'border-crypto-accent bg-crypto-accent/10' 
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <Smartphone className="w-6 h-6 mx-auto mb-1" />
                    <div className="text-xs">Mobile Money</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositMethod('bank_transfer')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      depositMethod === 'bank_transfer' 
                        ? 'border-crypto-accent bg-crypto-accent/10' 
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <Building2 className="w-6 h-6 mx-auto mb-1" />
                    <div className="text-xs">Virement</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositMethod('crypto')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      depositMethod === 'crypto' 
                        ? 'border-crypto-accent bg-crypto-accent/10' 
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <Bitcoin className="w-6 h-6 mx-auto mb-1" />
                    <div className="text-xs">Crypto</div>
                  </button>
                </div>
              </div>

              {/* Currency Selection */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Devise</label>
                <select
                  value={depositCurrency}
                  onChange={(e) => setDepositCurrency(e.target.value as any)}
                  className="w-full bg-crypto-dark border border-gray-700 rounded-lg px-4 py-2"
                >
                  <option value="USDT">USDT (Tether)</option>
                  <option value="BTC">BTC (Bitcoin)</option>
                  <option value="ETH">ETH (Ethereum)</option>
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Montant</label>
                <div className="relative">
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full bg-crypto-dark border border-gray-700 rounded-lg px-4 py-2 pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                    {depositCurrency}
                  </span>
                </div>
                {depositMethod === 'mobile_money' && depositAmount && (
                  <div className="text-sm text-gray-400 mt-1">
                    ≈ {formatXOF(parseFloat(depositAmount) * 605)}
                  </div>
                )}
              </div>

              {/* Mobile Money Specific */}
              {depositMethod === 'mobile_money' && (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Opérateur</label>
                    <div className="grid grid-cols-4 gap-2">
                      {MOBILE_MONEY_PROVIDERS.map((provider) => (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => setDepositNetwork(provider.id as any)}
                          className={`p-2 rounded-lg border-2 text-xs transition-colors ${
                            depositNetwork === provider.id
                              ? 'border-crypto-accent bg-crypto-accent/10'
                              : 'border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <div className="font-medium" style={{ color: provider.color }}>
                            {provider.id}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Numéro de téléphone</label>
                    <input
                      type="tel"
                      value={depositPhone}
                      onChange={(e) => setDepositPhone(e.target.value)}
                      placeholder="+225 XX XX XX XX XX"
                      className="w-full bg-crypto-dark border border-gray-700 rounded-lg px-4 py-2"
                    />
                  </div>
                </>
              )}

              {/* Crypto Specific */}
              {depositMethod === 'crypto' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Transaction Hash (TxHash)</label>
                  <input
                    type="text"
                    value={depositTxHash}
                    onChange={(e) => setDepositTxHash(e.target.value)}
                    placeholder="0x..."
                    className="w-full bg-crypto-dark border border-gray-700 rounded-lg px-4 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Entrez le hash de la transaction blockchain
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-crypto-green hover:bg-crypto-green/80 text-black rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowDownCircle className="w-5 h-5" />}
                Confirmer le Dépôt
              </button>
            </form>
          </div>
        )}

        {/* Withdrawal Form */}
        {activeTab === 'withdraw' && (
          <div className="crypto-card max-w-2xl">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-crypto-red" />
              Effectuer un Retrait
            </h3>
            
            <form onSubmit={handleWithdrawal} className="space-y-4">
              {/* Similar structure to deposit but for withdrawal */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Méthode de retrait</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setWithdrawMethod('mobile_money')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      withdrawMethod === 'mobile_money' 
                        ? 'border-crypto-red bg-crypto-red/10' 
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <Smartphone className="w-6 h-6 mx-auto mb-1" />
                    <div className="text-xs">Mobile Money</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawMethod('bank_transfer')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      withdrawMethod === 'bank_transfer' 
                        ? 'border-crypto-red bg-crypto-red/10' 
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <Building2 className="w-6 h-6 mx-auto mb-1" />
                    <div className="text-xs">Virement</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawMethod('crypto')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      withdrawMethod === 'crypto' 
                        ? 'border-crypto-red bg-crypto-red/10' 
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <Bitcoin className="w-6 h-6 mx-auto mb-1" />
                    <div className="text-xs">Crypto</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Devise</label>
                <select
                  value={withdrawCurrency}
                  onChange={(e) => setWithdrawCurrency(e.target.value as any)}
                  className="w-full bg-crypto-dark border border-gray-700 rounded-lg px-4 py-2"
                >
                  <option value="USDT">USDT (Tether)</option>
                  <option value="BTC">BTC (Bitcoin)</option>
                  <option value="ETH">ETH (Ethereum)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Montant</label>
                <div className="relative">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full bg-crypto-dark border border-gray-700 rounded-lg px-4 py-2 pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                    {withdrawCurrency}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Frais: 0.5% | Minimum: 10 USDT
                </p>
              </div>

              {withdrawMethod === 'mobile_money' && (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Opérateur</label>
                    <div className="grid grid-cols-4 gap-2">
                      {MOBILE_MONEY_PROVIDERS.map((provider) => (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => setWithdrawProvider(provider.id as any)}
                          className={`p-2 rounded-lg border-2 text-xs transition-colors ${
                            withdrawProvider === provider.id
                              ? 'border-crypto-red bg-crypto-red/10'
                              : 'border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <div className="font-medium" style={{ color: provider.color }}>
                            {provider.id}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Numéro de téléphone</label>
                    <input
                      type="tel"
                      value={withdrawPhone}
                      onChange={(e) => setWithdrawPhone(e.target.value)}
                      placeholder="+225 XX XX XX XX XX"
                      className="w-full bg-crypto-dark border border-gray-700 rounded-lg px-4 py-2"
                    />
                  </div>
                </>
              )}

              {withdrawMethod === 'crypto' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Adresse du portefeuille</label>
                  <input
                    type="text"
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    placeholder="0x... ou bc1..."
                    className="w-full bg-crypto-dark border border-gray-700 rounded-lg px-4 py-2"
                  />
                  <p className="text-xs text-yellow-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Vérifiez bien l'adresse - les transactions sont irréversibles
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-crypto-red hover:bg-crypto-red/80 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUpCircle className="w-5 h-5" />}
                Confirmer le Retrait
              </button>
            </form>
          </div>
        )}

        {/* Conversion Form */}
        {activeTab === 'convert' && (
          <div className="crypto-card max-w-2xl">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <RefreshCcw className="w-5 h-5 text-crypto-accent" />
              Convertir
            </h3>
            
            <form onSubmit={handleConversion} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">De</label>
                  <select
                    value={convertFrom}
                    onChange={(e) => setConvertFrom(e.target.value)}
                    className="w-full bg-crypto-dark border border-gray-700 rounded-lg px-4 py-2"
                  >
                    <option value="USDT">USDT</option>
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="XOF">FCFA (XOF)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Vers</label>
                  <select
                    value={convertTo}
                    onChange={(e) => setConvertTo(e.target.value)}
                    className="w-full bg-crypto-dark border border-gray-700 rounded-lg px-4 py-2"
                  >
                    <option value="XOF">FCFA (XOF)</option>
                    <option value="USDT">USDT</option>
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Montant</label>
                <div className="relative">
                  <input
                    type="number"
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full bg-crypto-dark border border-gray-700 rounded-lg px-4 py-2 pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                    {convertFrom}
                  </span>
                </div>
              </div>

              {conversionPreview && (
                <div className="bg-crypto-dark/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Taux de change</span>
                    <span>1 {convertFrom} = {conversionPreview?.rate?.toFixed(4) || '0.0000'} {convertTo}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Frais (0.5%)</span>
                    <span className="text-crypto-red">-{conversionPreview?.fee?.toFixed(4) || '0.0000'} {convertTo}</span>
                  </div>
                  <div className="flex justify-between font-medium text-lg">
                    <span>Vous recevrez</span>
                    <span className="text-crypto-green">{conversionPreview?.toAmount?.toFixed(4) || '0.0000'} {convertTo}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !conversionPreview}
                className="w-full py-3 bg-crypto-accent hover:bg-crypto-accent/80 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                Convertir
              </button>
            </form>
          </div>
        )}

        {/* Transaction History */}
        {activeTab === 'history' && (
          <div className="crypto-card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-crypto-purple" />
              Historique des Transactions
            </h3>
            
            {getFilteredTransactions().length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune transaction pour le moment</p>
              </div>
            ) : (
              <div className="space-y-3">
                {getFilteredTransactions().map((tx: WalletTransaction) => (
                  <div 
                    key={tx.id} 
                    className="flex items-center justify-between p-3 bg-crypto-dark/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.type === 'deposit' ? 'bg-crypto-green/20' :
                        tx.type === 'withdrawal' ? 'bg-crypto-red/20' :
                        'bg-crypto-accent/20'
                      }`}>
                        {tx.type === 'deposit' && <ArrowDownCircle className="w-5 h-5 text-crypto-green" />}
                        {tx.type === 'withdrawal' && <ArrowUpCircle className="w-5 h-5 text-crypto-red" />}
                        {tx.type === 'conversion' && <RefreshCcw className="w-5 h-5 text-crypto-accent" />}
                      </div>
                      <div>
                        <div className="font-medium">
                          {tx.type === 'deposit' && 'Dépôt'}
                          {tx.type === 'withdrawal' && 'Retrait'}
                          {tx.type === 'conversion' && 'Conversion'}
                        </div>
                        <div className="text-sm text-gray-400">
                          {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {tx.type === 'withdrawal' ? '-' : '+'}{tx.amount.toFixed(4)} {tx.currency}
                      </div>
                      <div className={`text-xs ${
                        tx.status === 'completed' ? 'text-crypto-green' :
                        tx.status === 'pending' ? 'text-yellow-500' :
                        tx.status === 'failed' ? 'text-crypto-red' :
                        'text-gray-500'
                      }`}>
                        {tx.status === 'completed' && 'Complété'}
                        {tx.status === 'pending' && 'En attente'}
                        {tx.status === 'failed' && 'Échoué'}
                        {tx.status === 'cancelled' && 'Annulé'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
