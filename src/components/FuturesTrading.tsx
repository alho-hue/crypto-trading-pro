import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Percent, Calculator, Wallet, History, ChevronDown } from 'lucide-react';
import { useCryptoStore } from '../stores/cryptoStore';
import { getDecryptedKey } from '../utils/crypto';
import { formatXOF } from '../utils/currency';

interface FuturesPosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  margin: number;
  pnl: number;
  pnlPercent: number;
  liquidationPrice: number;
  openTime: number;
}

interface FuturesOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  price?: number;
  quantity: number;
  leverage: number;
  status: 'pending' | 'filled' | 'cancelled';
  timestamp: number;
}

const LEVERAGE_OPTIONS = [1, 2, 3, 5, 10, 20, 50, 75, 100];
const POSITION_SIZES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

export default function FuturesTrading() {
  const [positions, setPositions] = useState<FuturesPosition[]>([]);
  const [orders, setOrders] = useState<FuturesOrder[]>([]);
  const [balance, setBalance] = useState(10000); // Demo balance
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [leverage, setLeverage] = useState(10);
  const [positionSize, setPositionSize] = useState(100);
  const [activeTab, setActiveTab] = useState<'trade' | 'positions' | 'orders' | 'history'>('trade');
  const [showLeverageModal, setShowLeverageModal] = useState(false);
  const [hasApiKeys, setHasApiKeys] = useState(false);
  
  const prices = useCryptoStore((state) => state.prices);
  const currentPrice = prices.get(selectedSymbol)?.price || 74442;

  useEffect(() => {
    const apiKey = getDecryptedKey('binance_api_key');
    setHasApiKeys(!!apiKey);
  }, []);

  // Calculate PnL for positions
  useEffect(() => {
    setPositions(prev => prev.map(pos => {
      const price = prices.get(pos.symbol)?.price || pos.markPrice;
      const priceDiff = pos.side === 'long' 
        ? price - pos.entryPrice 
        : pos.entryPrice - price;
      const pnl = priceDiff * pos.size * pos.leverage;
      const margin = (pos.size * pos.entryPrice) / pos.leverage;
      const pnlPercent = (pnl / margin) * 100;
      
      return {
        ...pos,
        markPrice: price,
        pnl,
        pnlPercent,
      };
    }));
  }, [prices]);

  const openPosition = (side: 'long' | 'short') => {
    if (!hasApiKeys) {
      alert('Configurez vos clés API pour trader en Futures');
      return;
    }
    
    const margin = (positionSize * currentPrice) / leverage;
    
    if (margin > balance) {
      alert('Solde insuffisant !');
      return;
    }
    
    const liquidationPrice = side === 'long'
      ? currentPrice * (1 - 0.9 / leverage)
      : currentPrice * (1 + 0.9 / leverage);
    
    const newPosition: FuturesPosition = {
      id: Date.now().toString(),
      symbol: selectedSymbol,
      side,
      size: positionSize,
      entryPrice: currentPrice,
      markPrice: currentPrice,
      leverage,
      margin,
      pnl: 0,
      pnlPercent: 0,
      liquidationPrice,
      openTime: Date.now(),
    };
    
    setPositions(prev => [...prev, newPosition]);
    setBalance(prev => prev - margin);
    
    // Create order record
    const order: FuturesOrder = {
      id: Date.now().toString(),
      symbol: selectedSymbol,
      side: side === 'long' ? 'buy' : 'sell',
      type: 'market',
      quantity: positionSize,
      leverage,
      status: 'filled',
      timestamp: Date.now(),
    };
    setOrders(prev => [order, ...prev]);
  };

  const closePosition = (positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    if (!position) return;
    
    // Return margin + PnL to balance
    const returnAmount = position.margin + position.pnl;
    setBalance(prev => prev + returnAmount);
    
    // Remove position
    setPositions(prev => prev.filter(p => p.id !== positionId));
    
    // Add to history
    const closeOrder: FuturesOrder = {
      id: Date.now().toString(),
      symbol: position.symbol,
      side: position.side === 'long' ? 'sell' : 'buy',
      type: 'market',
      quantity: position.size,
      leverage: position.leverage,
      status: 'filled',
      timestamp: Date.now(),
    };
    setOrders(prev => [closeOrder, ...prev]);
  };

  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalMargin = positions.reduce((sum, p) => sum + p.margin, 0);
  const availableBalance = balance;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-crypto-accent" />
          Futures Trading
          <span className="text-sm px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded">
            DEMO
          </span>
        </h1>
      </div>

      {!hasApiKeys && (
        <div className="crypto-card bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
            <div>
              <p className="font-medium">Mode Démo - Clés API requises</p>
              <p className="text-sm text-gray-400">
                Configurez vos clés API pour trader avec de l'argent réel
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="crypto-card bg-gradient-to-br from-crypto-accent/20 to-crypto-blue/20">
          <div className="text-sm text-gray-400">Balance Disponible</div>
          <div className="text-2xl font-bold">${availableBalance.toFixed(2)}</div>
          <div className="text-sm text-gray-400">≈ {formatXOF(availableBalance)}</div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Marge Utilisée</div>
          <div className="text-2xl font-bold">${totalMargin.toFixed(2)}</div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">P&L Non Réalisé</div>
          <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </div>
        </div>
        <div className="crypto-card">
          <div className="text-sm text-gray-400">Positions Ouvertes</div>
          <div className="text-2xl font-bold">{positions.length}</div>
        </div>
      </div>

      {/* Trading Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Form */}
        <div className="crypto-card">
          <h2 className="text-lg font-semibold mb-4">Nouvelle Position</h2>
          
          {/* Symbol Selector */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-1 block">Paire</label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
            >
              <option value="BTCUSDT">BTC/USDT</option>
              <option value="ETHUSDT">ETH/USDT</option>
              <option value="BNBUSDT">BNB/USDT</option>
              <option value="SOLUSDT">SOL/USDT</option>
              <option value="XRPUSDT">XRP/USDT</option>
            </select>
          </div>

          {/* Current Price */}
          <div className="mb-4 p-3 bg-crypto-dark/50 rounded-lg">
            <div className="text-sm text-gray-400">Prix Actuel</div>
            <div className="text-2xl font-bold font-mono">${currentPrice.toLocaleString()}</div>
          </div>

          {/* Leverage */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-400">Levier</label>
              <span className="text-crypto-accent font-bold">{leverage}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              value={LEVERAGE_OPTIONS.indexOf(leverage)}
              onChange={(e) => setLeverage(LEVERAGE_OPTIONS[parseInt(e.target.value)])}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1x</span>
              <span>100x</span>
            </div>
          </div>

          {/* Position Size */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-1 block">Taille Position (USDT)</label>
            <select
              value={positionSize}
              onChange={(e) => setPositionSize(parseInt(e.target.value))}
              className="w-full bg-crypto-dark border border-crypto-border rounded-lg px-3 py-2"
            >
              {POSITION_SIZES.map(size => (
                <option key={size} value={size}>{size} USDT</option>
              ))}
            </select>
          </div>

          {/* Margin Required */}
          <div className="mb-4 p-3 bg-crypto-dark/50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Marge Requise:</span>
              <span className="font-mono">${((positionSize * currentPrice) / leverage).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-400">Frais (0.05%):</span>
              <span className="font-mono">${(positionSize * 0.0005).toFixed(2)}</span>
            </div>
          </div>

          {/* Buy/Sell Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => openPosition('long')}
              className="py-3 bg-crypto-green hover:bg-crypto-green/80 rounded-lg font-semibold transition-colors"
            >
              <TrendingUp className="w-4 h-4 inline mr-1" />
              LONG {leverage}x
            </button>
            <button
              onClick={() => openPosition('short')}
              className="py-3 bg-crypto-red hover:bg-crypto-red/80 rounded-lg font-semibold transition-colors"
            >
              <TrendingDown className="w-4 h-4 inline mr-1" />
              SHORT {leverage}x
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-3 text-center">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            Le trading à effet de levier comporte des risques élevés
          </p>
        </div>

        {/* Positions List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2">
            {(['trade', 'positions', 'orders', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg capitalize ${
                  activeTab === tab
                    ? 'bg-crypto-blue text-white'
                    : 'bg-crypto-dark text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'trade' ? 'Trading' : tab}
                {tab === 'positions' && positions.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-crypto-accent rounded text-xs">
                    {positions.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="crypto-card">
            {activeTab === 'positions' && (
              <>
                <h3 className="text-lg font-semibold mb-4">Positions Ouvertes</h3>
                {positions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Aucune position ouverte</p>
                    <p className="text-sm">Ouvrez une position Long ou Short pour commencer</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {positions.map((pos) => (
                      <div 
                        key={pos.id}
                        className={`p-4 rounded-lg border ${
                          pos.side === 'long' ? 'border-crypto-green/30 bg-crypto-green/5' : 'border-crypto-red/30 bg-crypto-red/5'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              pos.side === 'long' ? 'bg-crypto-green/20' : 'bg-crypto-red/20'
                            }`}>
                              {pos.side === 'long' ? (
                                <TrendingUp className="w-5 h-5 text-crypto-green" />
                              ) : (
                                <TrendingDown className="w-5 h-5 text-crypto-red" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{pos.symbol}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  pos.side === 'long' ? 'bg-crypto-green/20 text-crypto-green' : 'bg-crypto-red/20 text-crypto-red'
                                }`}>
                                  {pos.side.toUpperCase()} {pos.leverage}x
                                </span>
                              </div>
                              <div className="text-sm text-gray-400">
                                Entry: ${pos.entryPrice.toLocaleString()} | Mark: ${pos.markPrice.toLocaleString()}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`text-lg font-bold ${pos.pnl >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                              {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                            </div>
                            <div className={`text-sm ${pos.pnlPercent >= 0 ? 'text-crypto-green' : 'text-crypto-red'}`}>
                              {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                            </div>
                          </div>

                          <button
                            onClick={() => closePosition(pos.id)}
                            className="px-3 py-1.5 bg-crypto-dark hover:bg-crypto-red/20 text-crypto-red rounded text-sm transition-colors"
                          >
                            Fermer
                          </button>
                        </div>

                        <div className="mt-3 pt-3 border-t border-crypto-border/50 grid grid-cols-4 gap-2 text-sm">
                          <div>
                            <div className="text-gray-400 text-xs">Taille</div>
                            <div className="font-mono">{pos.size}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs">Marge</div>
                            <div className="font-mono">${pos.margin.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs">Liq. Price</div>
                            <div className="font-mono text-crypto-red">${pos.liquidationPrice.toFixed(0)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs">Open Time</div>
                            <div className="font-mono text-xs">
                              {new Date(pos.openTime).toLocaleTimeString('fr-FR')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'orders' && (
              <>
                <h3 className="text-lg font-semibold mb-4">Historique des Ordres</h3>
                {orders.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Aucun ordre</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orders.slice(0, 10).map((order) => (
                      <div 
                        key={order.id}
                        className="flex items-center justify-between p-3 bg-crypto-dark/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            order.side === 'buy' ? 'bg-crypto-green/20 text-crypto-green' : 'bg-crypto-red/20 text-crypto-red'
                          }`}>
                            {order.side.toUpperCase()}
                          </span>
                          <span className="font-medium">{order.symbol}</span>
                          <span className="text-gray-400">{order.quantity} @ {order.leverage}x</span>
                        </div>
                        <span className="text-sm text-gray-400">
                          {new Date(order.timestamp).toLocaleTimeString('fr-FR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'trade' && (
              <div className="text-center py-8">
                <Calculator className="w-16 h-16 mx-auto mb-4 text-crypto-accent opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Calculateur de P&L</h3>
                <div className="max-w-md mx-auto space-y-3">
                  <div className="flex justify-between p-3 bg-crypto-dark/50 rounded-lg">
                    <span className="text-gray-400">Si prix monte de 1%</span>
                    <span className="text-crypto-green font-mono">+${(positionSize * leverage * 0.01).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-crypto-dark/50 rounded-lg">
                    <span className="text-gray-400">Si prix descend de 1%</span>
                    <span className="text-crypto-red font-mono">-${(positionSize * leverage * 0.01).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-crypto-dark/50 rounded-lg">
                    <span className="text-gray-400">Liquidation si prix</span>
                    <span className="text-crypto-red font-mono">
                      {selectedSymbol === 'BTCUSDT' ? '±' : ''}
                      {(100 / leverage).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="text-center py-8 text-gray-400">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Historique complet disponible bientôt</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
