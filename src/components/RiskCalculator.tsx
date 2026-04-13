import { useState, useEffect } from 'react';
import { useCryptoStore } from '../stores/cryptoStore';
import { FCFAConverter } from './FCFAConverter';
import { calculateRisk, calculateTakeProfit, kellyCriterion } from '../utils/riskCalculator';
import { Calculator, Target, Shield, TrendingUp, Percent, DollarSign, Scale } from 'lucide-react';
import type { RiskCalculation } from '../types';

export default function RiskCalculator() {
  const prices = useCryptoStore((state) => state.prices);
  const selectedSymbol = useCryptoStore((state) => state.selectedSymbol);
  const trades = useCryptoStore((state) => state.trades);

  const [entryPrice, setEntryPrice] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [riskReward, setRiskReward] = useState(2);
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [isLong, setIsLong] = useState(true);

  const [calculation, setCalculation] = useState<RiskCalculation | null>(null);

  // Auto-fill entry price from current price
  useEffect(() => {
    const currentPrice = prices.get(selectedSymbol)?.price || 0;
    if (currentPrice > 0 && entryPrice === 0) {
      setEntryPrice(currentPrice);
    }
  }, [prices, selectedSymbol, entryPrice]);

  // Calculate risk metrics
  useEffect(() => {
    if (entryPrice > 0 && stopLoss > 0 && accountSize > 0) {
      const takeProfit = isLong
        ? entryPrice + (entryPrice - stopLoss) * riskReward
        : entryPrice - (stopLoss - entryPrice) * riskReward;

      const result = calculateRisk(entryPrice, stopLoss, takeProfit, accountSize, riskPercent);
      setCalculation(result);
    }
  }, [entryPrice, stopLoss, riskReward, accountSize, riskPercent, isLong]);

  // Calculate stats for Kelly Criterion
  const closedTrades = trades.filter((t) => t.status === 'closed');
  const winningTrades = closedTrades.filter((t) => (t.pnl || 0) > 0);
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 50;
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length
    : 0;
  const avgLoss = closedTrades.filter((t) => (t.pnl || 0) < 0).length > 0
    ? closedTrades.filter((t) => (t.pnl || 0) < 0).reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / closedTrades.filter((t) => (t.pnl || 0) < 0).length
    : 1;

  const kellyPercent = avgLoss > 0 ? kellyCriterion(winRate, avgWin, avgLoss) : 0;

  const setQuickStopLoss = (percent: number) => {
    if (entryPrice > 0) {
      const sl = isLong
        ? entryPrice * (1 - percent / 100)
        : entryPrice * (1 + percent / 100);
      setStopLoss(sl);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="crypto-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-crypto-blue" />
            Calculateur de Position
          </h2>

          <div className="space-y-4">
            {/* Long/Short Toggle */}
            <div>
              <label className="text-sm text-gray-400 block mb-2">Direction</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsLong(true)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    isLong
                      ? 'bg-crypto-green text-white'
                      : 'bg-crypto-dark text-gray-400 hover:text-white'
                  }`}
                >
                  Long
                </button>
                <button
                  onClick={() => setIsLong(false)}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    !isLong
                      ? 'bg-crypto-red text-white'
                      : 'bg-crypto-dark text-gray-400 hover:text-white'
                  }`}
                >
                  Short
                </button>
              </div>
            </div>

            {/* Entry Price */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Prix d'entrée</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="number"
                  step="0.01"
                  value={entryPrice || ''}
                  onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                  className="crypto-input w-full pl-10"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Stop Loss */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Stop Loss</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="number"
                  step="0.01"
                  value={stopLoss || ''}
                  onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                  className="crypto-input w-full pl-10"
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setQuickStopLoss(1)}
                  className="px-2 py-1 text-xs bg-crypto-dark rounded hover:bg-gray-700"
                >
                  1%
                </button>
                <button
                  onClick={() => setQuickStopLoss(2)}
                  className="px-2 py-1 text-xs bg-crypto-dark rounded hover:bg-gray-700"
                >
                  2%
                </button>
                <button
                  onClick={() => setQuickStopLoss(3)}
                  className="px-2 py-1 text-xs bg-crypto-dark rounded hover:bg-gray-700"
                >
                  3%
                </button>
                <button
                  onClick={() => setQuickStopLoss(5)}
                  className="px-2 py-1 text-xs bg-crypto-dark rounded hover:bg-gray-700"
                >
                  5%
                </button>
              </div>
            </div>

            {/* Risk/Reward Ratio */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Ratio R:R</label>
              <div className="relative">
                <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <select
                  value={riskReward}
                  onChange={(e) => setRiskReward(parseFloat(e.target.value))}
                  className="crypto-input w-full pl-10"
                >
                  <option value={1}>1:1</option>
                  <option value={1.5}>1:1.5</option>
                  <option value={2}>1:2</option>
                  <option value={2.5}>1:2.5</option>
                  <option value={3}>1:3</option>
                </select>
              </div>
            </div>

            {/* Account Size */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Capital ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="number"
                  step="100"
                  value={accountSize || ''}
                  onChange={(e) => setAccountSize(parseFloat(e.target.value) || 0)}
                  className="crypto-input w-full pl-10"
                  placeholder="10000"
                />
              </div>
            </div>

            {/* Risk Percent */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Risque par trade (%)</label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="5"
                  value={riskPercent || ''}
                  onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 0)}
                  className="crypto-input w-full pl-10"
                  placeholder="1.0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {calculation ? (
            <div className="crypto-card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-crypto-green" />
                Résultats
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-crypto-dark rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Take Profit</div>
                  <div className="text-xl font-mono font-medium text-crypto-green">
                    ${calculation.takeProfit.toFixed(2)}
                  </div>
                  <FCFAConverter usdAmount={calculation.takeProfit} />
                </div>
                <div className="bg-crypto-dark rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Ratio R:R</div>
                  <div className="text-xl font-mono font-medium">
                    1:{calculation.riskRewardRatio.toFixed(1)}
                  </div>
                </div>
                <div className="bg-crypto-dark rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Taille Position</div>
                  <div className="text-xl font-mono font-medium">
                    {calculation.positionSize.toFixed(4)}
                  </div>
                  <div className="text-xs text-gray-500">
                    ${calculation.positionValue.toFixed(2)}
                    <FCFAConverter usdAmount={calculation.positionValue} className="text-[10px]" />
                  </div>
                </div>
                <div className="bg-crypto-dark rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Risque Max</div>
                  <div className="text-xl font-mono font-medium text-crypto-red">
                    ${calculation.maxLoss.toFixed(2)}
                  </div>
                  <FCFAConverter usdAmount={calculation.maxLoss} />
                </div>
              </div>
              <div className="text-xs text-gray-500 text-center mt-2">
                Profit potentiel: ${calculation.potentialProfit.toFixed(2)}
              </div>

              {/* Visual Representation */}
              <div className="bg-crypto-dark rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-3">Visualisation des niveaux</div>
                <div className="relative h-32 bg-crypto-card rounded-lg p-4">
                  <div className="flex flex-col justify-between h-full text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-crypto-green">TP</span>
                      <div className="flex-1 h-0.5 bg-crypto-green/50 relative">
                        <span className="absolute right-0 -top-4 text-crypto-green">
                          ${calculation?.takeProfit?.toFixed(2) || '0'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-crypto-blue">Entrée</span>
                      <div className="flex-1 h-0.5 bg-crypto-blue relative">
                        <span className="absolute right-0 -top-4 text-crypto-blue">
                          ${calculation?.entryPrice?.toFixed(2) || '0'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-crypto-red">SL</span>
                      <div className="flex-1 h-0.5 bg-crypto-red/50 relative">
                        <span className="absolute right-0 -top-4 text-crypto-red">
                          ${calculation?.stopLoss?.toFixed(2) || '0'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="crypto-card">
              <div className="text-center py-8 text-gray-500">
                <Calculator className="w-12 h-12 mx-auto mb-2 opacity-50" />
                Entrez les paramètres pour calculer
              </div>
            </div>
          )}

          {/* Kelly Criterion */}
          <div className="crypto-card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-crypto-purple" />
              Criterion Kelly (Optimal)
            </h3>

            <div className="bg-crypto-dark rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-4">
                Basé sur votre historique de trades:
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-gray-500 text-xs">Win Rate</div>
                  <div className="text-lg font-medium">{winRate.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Gain Moyen</div>
                  <div className="text-lg font-medium text-crypto-green">${avgWin.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Perte Moyenne</div>
                  <div className="text-lg font-medium text-crypto-red">${avgLoss.toFixed(2)}</div>
                </div>
              </div>
              <div className="pt-4 border-t border-crypto-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-gray-400 text-sm">Risque optimal par trade</div>
                    <div className="text-xs text-gray-500">Recommandation Kelly (moitié)</div>
                  </div>
                  <div className="text-2xl font-bold text-crypto-purple">
                    {kellyPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
