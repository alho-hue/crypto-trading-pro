/**
 * 🗂️ Stores Index - NEUROVEST
 * Export centralisé de tous les stores Zustand
 * 
 * Architecture:
 * - marketStore: Prix, candles, données marché
 * - userStore: Auth, profil, préférences, sécurité
 * - tradingStore: Positions, ordres, historique
 * - botStore: Bots automatisés, paper trading
 */

// Market Store
export { useMarketStore, selectPrice, selectSelectedSymbol, selectIsLoading } from './marketStore';
export type { PriceData, CandleData } from './marketStore';

// User Store
export { useUserStore, selectIsAuthenticated, selectUser, selectToken, selectApiKeys, selectPreferences } from './userStore';
export type { User, UserPreferences, UserStats, ApiKeys } from './userStore';

// Trading Store
export { useTradingStore, selectPositions, selectOpenPositions, selectTotalUnrealizedPnl, selectOpenRisk, selectIsExecuting, selectTodayPnl } from './tradingStore';
export type { Position, Trade } from './tradingStore';

// Bot Store
export { useBotStore, selectBots, selectActiveBots, selectSelectedBot, selectIsRunning, selectPaperBalance, selectTotalBotPnl } from './botStore';
export type { BotConfig, BotStats, BotLog } from './botStore';

// Legacy stores (à migrer progressivement)
export { useCryptoStore } from './cryptoStore';
export { useToastStore } from './toastStore';
export { useTradeStore } from './tradeStore';
