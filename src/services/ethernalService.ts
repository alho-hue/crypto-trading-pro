/**
 * NEUROVEST - Ethernal AI Service (Frontend)
 * Service pour interagir avec l'assistant trading intelligent Ethernal
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Helper pour les headers auth
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// ========== CHAT PRINCIPAL ==========
export async function sendMessage(content: string): Promise<{
  response: string;
  timestamp: Date;
}> {
  const response = await fetch(`${API_URL}/api/ethernal/chat`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ content })
  });
  return handleResponse(response);
}

// ========== ANALYSE TECHNIQUE ==========
export async function getTechnicalAnalysis(symbol: string): Promise<{
  analysis: string;
  symbol: string;
  timestamp: Date;
}> {
  const response = await fetch(`${API_URL}/api/ethernal/analysis/${encodeURIComponent(symbol)}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== CONTEXTE MARCHÉ ==========
export async function getMarketContext(symbol: string): Promise<{
  context: any;
  symbol: string;
  timestamp: Date;
}> {
  const response = await fetch(`${API_URL}/api/ethernal/market/${encodeURIComponent(symbol)}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== ALERTES ==========
export async function createAlert(
  symbol: string,
  condition: 'above' | 'below',
  targetPrice: number,
  notificationChannels: string[] = ['push']
): Promise<{ alert: any; message: string }> {
  const response = await fetch(`${API_URL}/api/ethernal/alerts`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ symbol, condition, targetPrice, notificationChannels })
  });
  return handleResponse(response);
}

export async function getAlerts(): Promise<{ alerts: any[] }> {
  const response = await fetch(`${API_URL}/api/ethernal/alerts`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function deleteAlert(alertId: string): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/api/ethernal/alerts/${alertId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== BOT AUTO-TRADING ==========
export async function enableAutoTrading(config: {
  strategy: string;
  symbols: string[];
  maxRiskPerTrade: number;
  autoBuy: boolean;
  autoSell: boolean;
}): Promise<{ config: any; message: string }> {
  const response = await fetch(`${API_URL}/api/ethernal/auto-trading/enable`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(config)
  });
  return handleResponse(response);
}

export async function disableAutoTrading(): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/api/ethernal/auto-trading/disable`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function getBotStatus(): Promise<{ status: any }> {
  const response = await fetch(`${API_URL}/api/ethernal/auto-trading/status`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function getBotPerformance(): Promise<{ stats: any }> {
  const response = await fetch(`${API_URL}/api/ethernal/auto-trading/performance`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== PORTFOLIO ==========
export async function getPortfolio(): Promise<{ portfolio: any }> {
  const response = await fetch(`${API_URL}/api/ethernal/portfolio`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function getPortfolioPerformance(period?: string): Promise<{ performance: any }> {
  const url = period 
    ? `${API_URL}/api/ethernal/portfolio/performance?period=${period}`
    : `${API_URL}/api/ethernal/portfolio/performance`;
  const response = await fetch(url, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function getPortfolioRecommendations(): Promise<{ recommendations: any[] }> {
  const response = await fetch(`${API_URL}/api/ethernal/portfolio/recommendations`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== SENTIMENT ==========
export async function getSentiment(symbol: string): Promise<{
  sentiment: any;
  symbol: string;
}> {
  const response = await fetch(`${API_URL}/api/ethernal/sentiment/${encodeURIComponent(symbol)}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function getFearGreed(): Promise<{
  fng: { value: number; classification: string };
  analysis: { sentiment: string; signal: string };
}> {
  const response = await fetch(`${API_URL}/api/ethernal/fear-greed`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== HISTORIQUE CONVERSATION ==========
export async function getConversationHistory(): Promise<{
  history: any[];
  summary: string;
  stats: any;
}> {
  const response = await fetch(`${API_URL}/api/ethernal/conversation/history`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function clearConversationHistory(): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/api/ethernal/conversation/history`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

// ========== COMMANDES RAPIDES PRÉDÉFINIES ==========
export const QUICK_COMMANDS = {
  // Analyses
  setupBTC: { label: 'Setup BTC', query: 'setup BTC' },
  setupETH: { label: 'Setup ETH', query: 'setup ETH' },
  analyseBTC: { label: 'Analyse BTC', query: 'analyse BTC' },
  analyseETH: { label: 'Analyse ETH', query: 'analyse ETH' },
  
  // Portfolio & Performance
  myPortfolio: { label: 'Mon Portfolio', query: 'résume mon portfolio' },
  myTrades: { label: 'Mes Trades', query: 'analyse mes trades' },
  myPerformance: { label: 'Performance', query: 'stats performance' },
  bestOpportunity: { label: 'Meilleur Trade', query: 'meilleur trade maintenant' },
  
  // Bot
  startBot: { label: 'Lancer Bot', query: 'lance bot safe' },
  stopBot: { label: 'Arrêter Bot', query: 'arrête bot' },
  botStatus: { label: 'Statut Bot', query: 'statut bot' },
  
  // Marché
  fearGreed: { label: 'Fear & Greed', query: 'fear greed' },
  sentimentBTC: { label: 'Sentiment BTC', query: 'sentiment BTC' },
  
  // Apprentissage
  myMemory: { label: 'Ma Mémoire', query: 'apprentissage' },
  optimize: { label: 'Optimiser', query: 'optimise mes stratégies' },
} as const;

// ========== DÉTECTION DE COMMANDES ==========
export function detectCommandType(message: string): string | null {
  const lower = message.toLowerCase();
  
  // Setups
  if (lower.includes('setup') || lower.includes('opportunité')) return 'setup';
  if (lower.includes('analyse') || lower.includes('signal')) return 'analysis';
  
  // Utilisateur
  if (lower.includes('mes trades') || lower.includes('erreurs')) return 'my_trades';
  if (lower.includes('portfolio') || lower.includes('portefeuille') || lower.includes('résume')) return 'portfolio';
  if (lower.includes('performance') || lower.includes('stats')) return 'performance';
  if (lower.includes('meilleur') || lower.includes('top')) return 'best_opportunity';
  
  // Bot
  if (lower.includes('lance bot') || lower.includes('start bot') || lower.includes('démarrer bot')) return 'bot_start';
  if (lower.includes('arrête bot') || lower.includes('stop bot') || lower.includes('pause bot')) return 'bot_stop';
  if (lower.includes('bot')) return 'auto_trading';
  
  // Alertes
  if (lower.includes('alerte') || lower.includes('alert')) return 'alert';
  
  // Marché
  if (lower.includes('sentiment')) return 'sentiment';
  if (lower.includes('fear') || lower.includes('greed') || lower.includes('peur')) return 'fear_greed';
  
  // Apprentissage
  if (lower.includes('apprends') || lower.includes('mémoire')) return 'learning';
  if (lower.includes('améliore') || lower.includes('optimise')) return 'optimization';
  
  return null;
}

// ========== UTILITAIRES ==========
export function extractSymbol(message: string): string | null {
  const symbols = message.match(/\b(BTC|ETH|BNB|SOL|ADA|DOT|AVAX|MATIC|XRP|DOGE|SHIB|LTC|LINK)\b/i);
  return symbols ? symbols[0].toUpperCase() : null;
}

export function formatAIResponse(text: string): string {
  // Formater la réponse pour l'affichage
  return text
    .replace(/\n\n/g, '\n') // Supprimer double sauts de ligne
    .trim();
}
