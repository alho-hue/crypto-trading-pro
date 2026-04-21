/**
 * NEUROVEST - Learning Dashboard
 * Dashboard de l'IA Ethernal montrant l'apprentissage continu
 */

import React, { useEffect, useState } from 'react';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Zap,
  RefreshCw,
  Clock,
  Lightbulb,
  Award,
  ChevronRight,
  Activity
} from 'lucide-react';
import * as learningService from '../services/learningService';
import type { LearningReport, StrategyScore, TradeAnalysis } from '../services/learningService';
import { showToast } from '../stores/toastStore';

export default function LearningDashboard() {
  const [report, setReport] = useState<LearningReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [strategyDetails, setStrategyDetails] = useState<any>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<TradeAnalysis[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportRes, statsRes] = await Promise.all([
        learningService.getLearningReport(),
        learningService.getLearningStats()
      ]);

      if (reportRes.success) {
        setReport(reportRes.report);
      }

      console.log('[LearningDashboard] Stats:', statsRes);
    } catch (error: any) {
      console.error('[LearningDashboard] Erreur:', error);
      showToast.error('Erreur chargement données IA', 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleStrategyClick = async (strategy: string) => {
    setSelectedStrategy(strategy);
    try {
      const result = await learningService.getStrategyScore(strategy);
      if (result.success) {
        setStrategyDetails(result.score);
      }
    } catch (error) {
      console.error('[LearningDashboard] Erreur stratégie:', error);
    }
  };

  const handleOptimize = async (strategy: string) => {
    try {
      const result = await learningService.optimizeStrategy(strategy);
      if (result.success) {
        showToast.success(`Stratégie "${strategy}" optimisée`, 'Optimisation');
        setStrategyDetails((prev: any) => ({
          ...prev,
          optimizations: result.optimization
        }));
      }
    } catch (error: any) {
      showToast.error(error.message, 'Erreur');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-crypto-blue" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Brain className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg">L'IA Ethernal n'a pas encore assez de données</p>
        <p className="text-sm mt-2">Effectuez des trades pour commencer l'apprentissage</p>
      </div>
    );
  }

  const { memory, strategyScores, recommendations } = report;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-7 h-7 text-crypto-purple" />
            Dashboard IA Ethernal
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Apprentissage automatique et amélioration continue
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 bg-crypto-dark hover:bg-crypto-gray rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Recommandations Globales */}
      {recommendations.length > 0 && (
        <div className="bg-crypto-purple/10 border border-crypto-purple/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-crypto-purple" />
            <h3 className="font-semibold">Recommandations IA</h3>
          </div>
          <ul className="space-y-2">
            {recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <ChevronRight className="w-4 h-4 text-crypto-purple mt-0.5" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-crypto-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-crypto-blue" />
            <span className="text-sm text-gray-400">Trades Analysés</span>
          </div>
          <div className="text-2xl font-bold">{memory.totalTrades}</div>
          <div className="text-xs text-gray-500">Mémoire active</div>
        </div>

        <div className="bg-crypto-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-crypto-green" />
            <span className="text-sm text-gray-400">Meilleur Setup</span>
          </div>
          <div className="text-2xl font-bold text-crypto-green">
            {memory.bestSetups[0]?.pnl?.toFixed(1) || 0}%
          </div>
          <div className="text-xs text-gray-500">
            {memory.bestSetups[0]?.symbol || 'N/A'}
          </div>
        </div>

        <div className="bg-crypto-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-crypto-accent" />
            <span className="text-sm text-gray-400">Risk/Reward Opt.</span>
          </div>
          <div className="text-2xl font-bold">
            1:{memory.optimalParameters?.riskRewardRatio?.toFixed(1) || '2.0'}
          </div>
          <div className="text-xs text-gray-500">Basé sur l'historique</div>
        </div>

        <div className="bg-crypto-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-gray-400">Durée Moyenne</span>
          </div>
          <div className="text-2xl font-bold">
            {Math.round((memory.optimalParameters?.avgTradeDuration || 0) / 60)}m
          </div>
          <div className="text-xs text-gray-500">Trades gagnants</div>
        </div>
      </div>

      {/* Meilleurs et Pires Setups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Meilleurs */}
        <div className="bg-crypto-card rounded-xl p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Top Setups Gagnants
          </h3>
          <div className="space-y-3">
            {memory.bestSetups.slice(0, 5).map((setup, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-crypto-dark/50 rounded-lg">
                <div>
                  <div className="font-medium">{setup.symbol}</div>
                  <div className="text-xs text-gray-400">{setup.strategy || 'Manual'}</div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-bold">+{setup.pnl?.toFixed(2)}</div>
                  <div className="text-xs text-gray-400">{setup.pnlPercent?.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pires */}
        <div className="bg-crypto-card rounded-xl p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            Setups à Éviter
          </h3>
          <div className="space-y-3">
            {memory.worstSetups.slice(0, 5).map((setup, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-crypto-dark/50 rounded-lg">
                <div>
                  <div className="font-medium">{setup.symbol}</div>
                  <div className="text-xs text-gray-400">{setup.exitReason}</div>
                </div>
                <div className="text-right">
                  <div className="text-red-400 font-bold">{setup.pnl?.toFixed(2)}</div>
                  <div className="text-xs text-gray-400">{setup.pnlPercent?.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scoring des Stratégies */}
      <div className="bg-crypto-card rounded-xl p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-crypto-blue" />
          Performance des Stratégies
        </h3>
        
        <div className="space-y-3">
          {strategyScores.map((score) => {
            const grade = learningService.formatGrade(score.grade);
            return (
              <div
                key={score.strategy}
                onClick={() => handleStrategyClick(score.strategy)}
                className={`p-3 bg-crypto-dark/50 rounded-lg cursor-pointer hover:bg-crypto-dark transition-colors ${
                  selectedStrategy === score.strategy ? 'ring-2 ring-crypto-blue' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl font-bold ${grade.color}`}>
                      {score.grade}
                    </span>
                    <div>
                      <div className="font-medium">{score.strategy}</div>
                      <div className="text-xs text-gray-400">
                        {score.totalTrades} trades • {score.winRate.toFixed(0)}% win
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${score.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {score.totalProfit >= 0 ? '+' : ''}{score.totalProfit.toFixed(1)} USDT
                    </div>
                    <div className={`text-xs ${learningService.getRecommendationColor(score.recommendation)}`}>
                      {score.recommendation === 'use' ? '✅ Utiliser' : 
                       score.recommendation === 'caution' ? '⚠️ Prudence' : '❌ Éviter'}
                    </div>
                  </div>
                </div>

                {/* Détails si sélectionné */}
                {selectedStrategy === score.strategy && strategyDetails && (
                  <div className="mt-3 pt-3 border-t border-crypto-border/50">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400">Profit Factor</div>
                        <div className="font-mono">{score.profitFactor.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Max Drawdown</div>
                        <div className="font-mono text-red-400">{score.maxDrawdown.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Score</div>
                        <div className="font-mono">{score.score}/100</div>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOptimize(score.strategy);
                      }}
                      className="mt-3 w-full py-2 bg-crypto-blue/20 hover:bg-crypto-blue/30 text-crypto-blue rounded-lg text-sm transition-colors"
                    >
                      <Zap className="w-4 h-4 inline mr-2" />
                      Optimiser cette stratégie
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {strategyScores.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p>Pas assez de données pour scorer les stratégies</p>
            <p className="text-sm">Minimum 5 trades par stratégie</p>
          </div>
        )}
      </div>

      {/* Patterns Détectés */}
      {memory.winningPatterns && (
        <div className="bg-crypto-card rounded-xl p-4">
          <h3 className="font-semibold mb-4">Patterns Identifiés</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(memory.winningPatterns.bySymbol)
              .sort(([,a]: [string, any], [,b]: [string, any]) => b.avgPnl - a.avgPnl)
              .slice(0, 4)
              .map(([symbol, data]: [string, any]) => (
                <div key={symbol} className="bg-crypto-dark/50 rounded-lg p-3 text-center">
                  <div className="font-bold">{symbol}</div>
                  <div className={`text-sm ${data.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.avgPnl >= 0 ? '+' : ''}{data.avgPnl.toFixed(2)} USDT
                  </div>
                  <div className="text-xs text-gray-400">{data.count} trades</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
