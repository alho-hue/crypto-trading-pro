/**
 * 📊 NEUROVEST - Service d'Export Excel Ultra Professionnel
 * Export premium avec mise en forme professionnelle, logos et watermark
 */

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface BacktestExportData {
  config: {
    strategy: string;
    symbol: string;
    timeframe: string;
    initialCapital: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    riskPerTrade: number;
    leverage: number;
    feesType: string;
    slippagePercent: number;
    startDate?: string;
    endDate?: string;
  };
  metrics: {
    totalReturn: number;
    totalReturnPercent: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
    sortinoRatio: number;
    riskRewardRatio: number;
    expectancy: number;
    totalFees: number;
    totalSlippage: number;
  };
  trades: Array<{
    entryTime: string;
    exitTime: string;
    entryPrice: number;
    exitPrice: number;
    side: string;
    pnl: number;
    pnlPercent: number;
    exitReason: string;
  }>;
  equityCurve: Array<{
    date: string;
    equity: number;
  }>;
}

// 🎨 Palette de couleurs professionnelle
const COLORS = {
  primary: '6366F1',      // Indigo
  primaryDark: '4F46E5',  // Indigo foncé
  success: '10B981',      // Emerald
  danger: 'EF4444',       // Red
  warning: 'F59E0B',      // Amber
  gray: '6B7280',         // Gray
  grayLight: 'F3F4F6',    // Gray light
  white: 'FFFFFF',
  black: '1F2937',
  blue: '3B82F6',
  purple: '8B5CF6'
};

class ExcelExportService {
  /**
   * 📋 Export Backtest Professionnel - Version Premium
   */
  exportBacktest(data: BacktestExportData, filename?: string) {
    const wb = XLSX.utils.book_new();
    const date = new Date().toISOString().split('T')[0];
    const finalFilename = filename || `NEUROVEST_Backtest_${data.config.strategy}_${data.config.symbol}_${date}.xlsx`;

    // 📊 FEUILLE 1: Dashboard Executive
    const dashboardWs = this.createExecutiveDashboard(data);
    XLSX.utils.book_append_sheet(wb, dashboardWs, '📊 Dashboard');

    // 📈 FEUILLE 2: Métriques Complètes
    const metricsWs = this.createDetailedMetrics(data);
    XLSX.utils.book_append_sheet(wb, metricsWs, '📈 Métriques');

    // 📋 FEUILLE 3: Journal des Trades
    const tradesWs = this.createTradeJournal(data);
    XLSX.utils.book_append_sheet(wb, tradesWs, '📋 Trades');

    // 📉 FEUILLE 4: Analyse Temporelle
    const equityWs = this.createEquityAnalysis(data);
    XLSX.utils.book_append_sheet(wb, equityWs, '📉 Equity');

    // 💾 Export
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, finalFilename);

    return finalFilename;
  }

  /**
   * 🎯 Dashboard Executive - Vue d'ensemble premium
   */
  private createExecutiveDashboard(data: BacktestExportData): XLSX.WorkSheet {
    const { config, metrics } = data;
    const ws: XLSX.WorkSheet = {};
    
    // En-tête premium
    const headerRows = [
      ['NEUROVEST'],
      ['RAPPORT DE BACKTEST - ANALYSE DE PERFORMANCE'],
      [`${config.strategy.toUpperCase()} | ${config.symbol} | ${config.timeframe}`],
      [''],
      ['Date d\'analyse:', new Date().toLocaleString('fr-FR')],
      ['Période:', `${config.startDate || 'N/A'} au ${config.endDate || 'N/A'}`],
      [''],
    ];

    // Section 1: RÉSULTATS CLÉS (Cartes visuelles)
    const keyResults = [
      ['═' + '═'.repeat(80)],
      ['  RÉSULTATS CLÉS'],
      ['═' + '═'.repeat(80)],
      [''],
      ['Rendement Total', `${metrics.totalReturnPercent.toFixed(2)}%`, '$' + metrics.totalReturn.toFixed(2)],
      ['Win Rate', `${metrics.winRate.toFixed(1)}%`, `${metrics.winningTrades}/${metrics.totalTrades} trades gagnants`],
      ['Profit Factor', metrics.profitFactor.toFixed(2), this.getPFLabel(metrics.profitFactor)],
      ['Max Drawdown', `${metrics.maxDrawdownPercent.toFixed(2)}%`, 'Risque maximum encaissé'],
      [''],
    ];

    // Section 2: MÉTRIQUES DE RISQUE
    const riskMetrics = [
      ['═' + '═'.repeat(80)],
      ['  MÉTRIQUES DE RISQUE & RENDEMENT'],
      ['═' + '═'.repeat(80)],
      [''],
      ['Ratio de Sharpe', metrics.sharpeRatio.toFixed(2), this.getSharpeLabel(metrics.sharpeRatio)],
      ['Ratio de Sortino', metrics.sortinoRatio.toFixed(2), this.getSortinoLabel(metrics.sortinoRatio)],
      ['Risk/Reward Ratio', metrics.riskRewardRatio.toFixed(2), this.getRRLabel(metrics.riskRewardRatio)],
      ['Expectancy', '$' + metrics.expectancy.toFixed(2), 'Gain moyen par trade'],
      [''],
    ];

    // Section 3: CONFIGURATION
    const configSection = [
      ['═' + '═'.repeat(80)],
      ['  PARAMÈTRES DE TRADING'],
      ['═' + '═'.repeat(80)],
      [''],
      ['Capital Initial', '$' + config.initialCapital.toLocaleString()],
      ['Stop Loss', config.stopLossPercent + '%'],
      ['Take Profit', config.takeProfitPercent + '%'],
      ['Risque par Trade', config.riskPerTrade + '%'],
      ['Levier Utilisé', config.leverage + 'x'],
      ['Type de Frais', config.feesType.toUpperCase()],
      ['Slippage Estimé', config.slippagePercent + '%'],
      [''],
    ];

    // Section 4: COÛTS
    const costsSection = [
      ['═' + '═'.repeat(80)],
      ['  ANALYSE DES COÛTS'],
      ['═' + '═'.repeat(80)],
      [''],
      ['Frais de Trading', '$' + metrics.totalFees.toFixed(2)],
      ['Slippage', '$' + metrics.totalSlippage.toFixed(2)],
      ['COÛT TOTAL', '$' + (metrics.totalFees + metrics.totalSlippage).toFixed(2)],
      [''],
    ];

    // Footer
    const footer = [
      [''],
      ['─' + '─'.repeat(80)],
      ['NEUROVEST Trading Intelligence Platform'],
      ['© 2026 Neurovest. Tous droits réservés.'],
      ['https://neurovest.netlify.app | contact@neurovest.app'],
      ['─' + '─'.repeat(80)],
    ];

    // Combiner toutes les sections
    const allRows = [
      ...headerRows,
      ...keyResults,
      ...riskMetrics,
      ...configSection,
      ...costsSection,
      ...footer
    ];

    // Remplir la feuille
    allRows.forEach((row, rowIdx) => {
      row.forEach((cell, colIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
        ws[cellRef] = { v: cell };
      });
    });

    // Appliquer les styles premium
    this.applyPremiumStyles(ws, allRows.length);

    return ws;
  }

  /**
   * 🎨 Appliquer les styles premium
   */
  private applyPremiumStyles(ws: XLSX.WorkSheet, totalRows: number) {
    // Configurer les largeurs
    ws['!cols'] = [
      { wch: 35 },  // A - Labels
      { wch: 20 },  // B - Valeurs
      { wch: 40 },  // C - Contexte
    ];

    // Styles
    const titleStyle = {
      font: { bold: true, sz: 16, color: { rgb: COLORS.primary } },
      alignment: { horizontal: 'center' }
    };

    const subtitleStyle = {
      font: { bold: true, sz: 12, color: { rgb: COLORS.gray } },
      alignment: { horizontal: 'center' }
    };

    const sectionStyle = {
      font: { bold: true, sz: 11, color: { rgb: COLORS.white } },
      fill: { patternType: 'solid', fgColor: { rgb: COLORS.primary } },
      alignment: { horizontal: 'left' }
    };

    const labelStyle = {
      font: { bold: true, sz: 10, color: { rgb: COLORS.gray } },
      alignment: { horizontal: 'left' }
    };

    const valueStyle = {
      font: { bold: true, sz: 11, color: { rgb: COLORS.black } },
      alignment: { horizontal: 'right' }
    };

    const contextStyle = {
      font: { sz: 9, color: { rgb: COLORS.gray }, italic: true },
      alignment: { horizontal: 'left' }
    };

    // Appliquer styles ligne par ligne
    for (let R = 0; R < totalRows; R++) {
      const cellA = XLSX.utils.encode_cell({ r: R, c: 0 });
      const cellB = XLSX.utils.encode_cell({ r: R, c: 1 });
      const cellC = XLSX.utils.encode_cell({ r: R, c: 2 });

      const valA = ws[cellA]?.v?.toString() || '';

      // Ligne de titre NEUROVEST
      if (valA === 'NEUROVEST') {
        ws[cellA].s = titleStyle;
      }
      // Ligne de sous-titre
      else if (valA.includes('RAPPORT')) {
        ws[cellA].s = subtitleStyle;
      }
      // Lignes de section (avec ═)
      else if (valA.startsWith('═')) {
        ws[cellA].s = sectionStyle;
        if (ws[cellB]) ws[cellB].s = sectionStyle;
        if (ws[cellC]) ws[cellC].s = sectionStyle;
      }
      // Labels normaux
      else if (valA && !valA.startsWith('─') && valA !== '') {
        if (ws[cellA]) ws[cellA].s = labelStyle;
        if (ws[cellB]) ws[cellB].s = valueStyle;
        if (ws[cellC]) ws[cellC].s = contextStyle;
      }
    }

    ws['!ref'] = `A1:C${totalRows}`;
  }

  /**
   * 📈 Métriques détaillées avec tableau comparatif
   */
  private createDetailedMetrics(data: BacktestExportData): XLSX.WorkSheet {
    const { metrics } = data;
    
    const headers = ['Métrique', 'Valeur', 'Performance', 'Benchmark', 'Statut'];
    
    const metricsData = [
      ['RENDEMENT', '', '', '', ''],
      ['Rendement Total', `${metrics.totalReturnPercent.toFixed(2)}%`, this.formatPerf(metrics.totalReturnPercent), '> 0%', this.getStatusPerf(metrics.totalReturnPercent > 0)],
      ['Gain Total ($)', `$${metrics.totalReturn.toFixed(2)}`, '', '', ''],
      ['', '', '', '', ''],
      ['STATISTIQUES DE TRADING', '', '', '', ''],
      ['Trades Totaux', metrics.totalTrades.toString(), '', '> 30', this.getStatusCount(metrics.totalTrades)],
      ['Trades Gagnants', `${metrics.winningTrades} (${metrics.winRate.toFixed(1)}%)`, this.formatPerf(metrics.winRate), '> 50%', this.getStatusPerf(metrics.winRate > 50)],
      ['Trades Perdants', `${metrics.losingTrades} (${(100-metrics.winRate).toFixed(1)}%)`, '', '', ''],
      ['', '', '', '', ''],
      ['RATIOS DE PERFORMANCE', '', '', '', ''],
      ['Profit Factor', metrics.profitFactor.toFixed(2), this.getPFLabel(metrics.profitFactor), '> 1.5', this.getStatusPerf(metrics.profitFactor > 1.5)],
      ['Ratio de Sharpe', metrics.sharpeRatio.toFixed(2), this.getSharpeLabel(metrics.sharpeRatio), '> 1.0', this.getStatusPerf(metrics.sharpeRatio > 1)],
      ['Ratio de Sortino', metrics.sortinoRatio.toFixed(2), this.getSortinoLabel(metrics.sortinoRatio), '> 1.5', this.getStatusPerf(metrics.sortinoRatio > 1.5)],
      ['Risk/Reward', metrics.riskRewardRatio.toFixed(2), this.getRRLabel(metrics.riskRewardRatio), '> 2.0', this.getStatusPerf(metrics.riskRewardRatio > 2)],
      ['Expectancy', `$${metrics.expectancy.toFixed(2)}`, metrics.expectancy > 0 ? 'POSITIF' : 'NÉGATIF', '> $0', this.getStatusPerf(metrics.expectancy > 0)],
      ['', '', '', '', ''],
      ['RISQUE', '', '', '', ''],
      ['Max Drawdown', `${metrics.maxDrawdownPercent.toFixed(2)}%`, 'Risque Max', '< 20%', this.getStatusRisk(metrics.maxDrawdownPercent < 20)],
      ['Drawdown ($)', `$${metrics.maxDrawdown.toFixed(2)}`, '', '', ''],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...metricsData]);
    
    // Styles
    ws['!cols'] = [
      { wch: 25 },
      { wch: 18 },
      { wch: 20 },
      { wch: 15 },
      { wch: 12 }
    ];

    return ws;
  }

  /**
   * 📋 Journal des trades détaillé
   */
  private createTradeJournal(data: BacktestExportData): XLSX.WorkSheet {
    const headers = [
      'N°', 'Date Entrée', 'Date Sortie', 'Type', 
      'Prix Entrée', 'Prix Sortie', 'P&L ($)', 'P&L (%)', 
      'Résultat', 'Raison'
    ];
    
    const rows = data.trades.map((trade, index) => {
      const isWin = trade.pnl > 0;
      return [
        index + 1,
        trade.entryTime,
        trade.exitTime,
        trade.side.toUpperCase(),
        trade.entryPrice,
        trade.exitPrice,
        trade.pnl,
        trade.pnlPercent.toFixed(2) + '%',
        isWin ? '✓ GAGNANT' : '✗ PERDANT',
        trade.exitReason
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    ws['!cols'] = [
      { wch: 5 },   // N°
      { wch: 20 },  // Date Entrée
      { wch: 20 },  // Date Sortie
      { wch: 10 },  // Type
      { wch: 15 },  // Prix Entrée
      { wch: 15 },  // Prix Sortie
      { wch: 12 },  // P&L ($)
      { wch: 10 },  // P&L (%)
      { wch: 12 },  // Résultat
      { wch: 20 },  // Raison
    ];

    return ws;
  }

  /**
   * 📉 Analyse de l'equity curve
   */
  private createEquityAnalysis(data: BacktestExportData): XLSX.WorkSheet {
    const headers = ['Date', 'Capital', 'Variation (%)', 'Cumulé (%)'];
    
    const initialCapital = data.config.initialCapital;
    let maxEquity = initialCapital;
    
    const rows = data.equityCurve.map((point, index) => {
      const variation = index === 0 ? 0 : ((point.equity - data.equityCurve[index-1].equity) / data.equityCurve[index-1].equity * 100);
      const cumul = ((point.equity - initialCapital) / initialCapital * 100);
      maxEquity = Math.max(maxEquity, point.equity);
      
      return [
        point.date,
        point.equity,
        variation.toFixed(2) + '%',
        cumul.toFixed(2) + '%'
      ];
    });

    // Ajouter stats
    const stats = [
      [''],
      ['STATISTIQUES DE LA COURBE'],
      ['Capital Initial', initialCapital],
      ['Capital Final', data.equityCurve[data.equityCurve.length-1]?.equity || initialCapital],
      ['Plus Haut', maxEquity],
      ['Variation Totale', (((data.equityCurve[data.equityCurve.length-1]?.equity || initialCapital) - initialCapital) / initialCapital * 100).toFixed(2) + '%'],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, ...stats]);
    
    ws['!cols'] = [
      { wch: 25 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 }
    ];

    return ws;
  }

  // ═══════════════════════════════════════════════════════════════
  // 🎯 HELPERS DE FORMATAGE
  // ═══════════════════════════════════════════════════════════════

  private formatPerf(value: number): string {
    if (value > 20) return 'EXCELLENT';
    if (value > 10) return 'TRÈS BON';
    if (value > 0) return 'POSITIF';
    if (value > -10) return 'NÉGATIF';
    return 'MAUVAIS';
  }

  private getStatusPerf(isGood: boolean): string {
    return isGood ? '✓' : '✗';
  }

  private getStatusRisk(isGood: boolean): string {
    return isGood ? '✓' : '⚠';
  }

  private getStatusCount(count: number): string {
    return count >= 30 ? '✓' : '⚠';
  }

  private getPFLabel(pf: number): string {
    if (pf > 2) return 'EXCELLENT';
    if (pf > 1.5) return 'BON';
    if (pf > 1) return 'ACCEPTABLE';
    return 'MAUVAIS';
  }

  private getSharpeLabel(sr: number): string {
    if (sr > 2) return 'EXCELLENT';
    if (sr > 1) return 'BON';
    if (sr > 0.5) return 'ACCEPTABLE';
    return 'MAUVAIS';
  }

  private getSortinoLabel(sr: number): string {
    if (sr > 2) return 'EXCELLENT';
    if (sr > 1.5) return 'BON';
    if (sr > 1) return 'ACCEPTABLE';
    return 'MAUVAIS';
  }

  private getRRLabel(rr: number): string {
    if (rr > 3) return 'EXCELLENT';
    if (rr > 2) return 'BON';
    if (rr > 1.5) return 'ACCEPTABLE';
    return 'MAUVAIS';
  }

  /**
   * 📤 Export générique
   */
  exportGeneric(data: any[], filename: string, sheetName: string = 'Data') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Header
    XLSX.utils.sheet_add_aoa(ws, [
      ['NEUROVEST - Export Data'],
      [`Généré le: ${new Date().toLocaleString('fr-FR')}`],
      ['']
    ], { origin: 'A1' });

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    saveAs(blob, filename);
  }
}

export const excelExport = new ExcelExportService();
