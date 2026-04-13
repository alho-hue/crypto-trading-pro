import type { RiskCalculation } from '../types';

export function calculateRisk(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  accountSize: number,
  riskPercent: number
): RiskCalculation {
  // Calculate risk per unit
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  
  // Calculate dollar risk amount
  const maxRiskAmount = accountSize * (riskPercent / 100);
  
  // Calculate position size in units
  const positionSize = maxRiskAmount / riskPerUnit;
  
  // Calculate position value
  const positionValue = positionSize * entryPrice;
  
  // Calculate risk/reward ratio
  const potentialLoss = maxRiskAmount;
  const potentialProfit = positionSize * Math.abs(takeProfit - entryPrice);
  const riskRewardRatio = potentialProfit / potentialLoss;
  
  return {
    entryPrice,
    stopLoss,
    takeProfit,
    accountSize,
    riskPercent,
    positionSize,
    positionValue,
    riskRewardRatio,
    maxLoss: potentialLoss,
    potentialProfit,
  };
}

export function calculateStopLoss(
  entryPrice: number,
  riskPercent: number,
  isLong: boolean
): number {
  return isLong 
    ? entryPrice * (1 - riskPercent / 100)
    : entryPrice * (1 + riskPercent / 100);
}

export function calculateTakeProfit(
  entryPrice: number,
  stopLoss: number,
  riskRewardRatio: number,
  isLong: boolean
): number {
  const riskDistance = Math.abs(entryPrice - stopLoss);
  const rewardDistance = riskDistance * riskRewardRatio;
  
  return isLong
    ? entryPrice + rewardDistance
    : entryPrice - rewardDistance;
}

// Kelly Criterion for position sizing
export function kellyCriterion(winRate: number, avgWin: number, avgLoss: number): number {
  const b = avgWin / avgLoss; // Win/loss ratio
  const p = winRate / 100; // Win rate as decimal
  const q = 1 - p;
  
  // Kelly percentage
  const kelly = (b * p - q) / b;
  
  // Return half-Kelly (more conservative)
  return Math.max(0, kelly * 0.5 * 100);
}

// Calculate optimal position size based on Kelly
export function calculateOptimalPositionSize(
  accountSize: number,
  winRate: number,
  avgWin: number,
  avgLoss: number,
  entryPrice: number,
  stopLoss: number
): { positionSize: number; riskPercent: number; kellyPercent: number } {
  const kellyPercent = kellyCriterion(winRate, avgWin, avgLoss);
  const riskAmount = accountSize * (kellyPercent / 100);
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  const positionSize = riskAmount / riskPerUnit;
  
  return {
    positionSize,
    riskPercent: kellyPercent,
    kellyPercent,
  };
}
