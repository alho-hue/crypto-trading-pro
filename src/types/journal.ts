/**
 * Types pour le Journal de Trading Intelligent NEUROVEST
 */

// Émotions possibles lors du trade
export type TradeEmotion = 
  | 'confident'   // Confiant
  | 'neutral'     // Neutre
  | 'stressed'    // Stressé
  | 'fomo'        // FOMO (Fear of Missing Out)
  | 'revenge';    // Vengeance (revenge trading)

// Note détaillée pour un trade
export interface TradeNote {
  why?: string;              // Raison du trade
  emotion: TradeEmotion;   // État émotionnel
  mistakes?: string[];      // Erreurs commises
  lessons?: string;         // Leçons apprises
  screenshotUrl?: string;   // URL du screenshot
  tags?: string[];          // Tags personnalisés
}

// Entrée de journal pour un trade
export interface JournalEntry {
  tradeId: string;
  note: TradeNote;
  createdAt: Date;
  updatedAt: Date;
}

// Pattern comportemental détecté
export interface BehavioralPattern {
  type: 'overtrading' | 'revenge_trading' | 'sl_not_respected' | 'emotional_trading' | 'fomo' | 'lack_of_patience';
  severity: 'low' | 'medium' | 'high';
  description: string;
  impact: number;           // Impact P&L
  recommendation: string;   // Recommandation d'amélioration
  frequency?: number;         // Fréquence d'apparition
}

// Métriques de discipline
export interface DisciplineMetrics {
  overallScore: number;           // Score global /100
  slRespectScore: number;         // Respect du SL /100
  strategyScore: number;          // Respect du plan /100
  emotionScore: number;         // Gestion émotionnelle /100
  totalTrades: number;
  tradesWithNotes: number;
}

// Statistiques journalières
export interface DailyStats {
  date: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
  notesAdded: number;
}

// Analyse IA
export interface JournalAIAnalysis {
  insights: {
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'critical';
    action?: string;
  }[];
  patterns: BehavioralPattern[];
  recommendations: string[];
  emotionalProfile: {
    dominantEmotion: TradeEmotion;
    emotionPnL: Record<TradeEmotion, number>;
  };
  errorAnalysis: {
    mostCommonMistake: string;
    mistakeCost: number;
    improvementAreas: string[];
  };
  generatedAt: Date;
}

// Configuration du journal
export interface JournalConfig {
  autoImportBinance: boolean;
  autoImportBot: boolean;
  autoImportAI: boolean;
  requireNotesBeforeClose: boolean;
  minNoteLength: number;
  emotionTracking: boolean;
  screenshotEnabled: boolean;
}

// Résumé hebdomadaire
export interface WeeklySummary {
  weekStart: Date;
  weekEnd: Date;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  bestDay: string;
  worstDay: string;
  mostCommonEmotion: TradeEmotion;
  patternsDetected: BehavioralPattern[];
  goalsAchieved: string[];
  goalsMissed: string[];
}

// Tag personnalisé
export interface JournalTag {
  id: string;
  name: string;
  color: string;
  count: number;
}

// Statut de complétion du journal
export interface JournalCompletionStatus {
  date: string;
  tradesCount: number;
  notesCount: number;
  completionRate: number;  // % de trades notés
  isComplete: boolean;
}

// Données pour l'export
export interface JournalExportData {
  entries: JournalEntry[];
  trades: any[];
  stats: {
    totalTrades: number;
    winRate: number;
    totalPnL: number;
    disciplineScore: number;
  };
  patterns: BehavioralPattern[];
  generatedAt: Date;
}

// Comportement par stratégie
export interface StrategyBehavior {
  strategy: string;
  trades: number;
  winRate: number;
  pnl: number;
  avgEmotion: TradeEmotion;
  commonMistakes: string[];
  bestEmotion: TradeEmotion;
  worstEmotion: TradeEmotion;
}

// Trend du journal
export interface JournalTrend {
  period: 'week' | 'month' | 'quarter';
  disciplineTrend: 'improving' | 'stable' | 'declining';
  emotionTrend: 'improving' | 'stable' | 'declining';
  performanceTrend: 'improving' | 'stable' | 'declining';
  streakDays: number;  // Jours consécutifs avec journal complet
}

// Goal de trading
export interface TradingGoal {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: 'trades' | 'percent' | 'pnl' | 'score';
  deadline?: Date;
  isAchieved: boolean;
  createdAt: Date;
}

// Session de trading
export interface TradingSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  trades: string[];
  preSessionEmotion: TradeEmotion;
  postSessionEmotion?: TradeEmotion;
  sessionGoal?: string;
  sessionReview?: string;
  pnl: number;
}

// Heatmap data pour visualisation
export interface JournalHeatmapData {
  date: string;
  trades: number;
  pnl: number;
  hasNotes: boolean;
  emotion?: TradeEmotion;
  intensity: number;  // 0-1 pour la couleur
}

// Notification du journal
export interface JournalNotification {
  id: string;
  type: 'goal_achieved' | 'pattern_detected' | 'reminder' | 'streak' | 'milestone';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    href: string;
  };
}

// Corrélation émotion-performance
export interface EmotionPerformanceCorrelation {
  emotion: TradeEmotion;
  tradesCount: number;
  winRate: number;
  avgPnL: number;
  avgHoldTime: number;  // Durée moyenne de détention en minutes
  bestPerforming: boolean;
  worstPerforming: boolean;
}

// Métrique de progression
export interface ProgressMetrics {
  currentWeek: {
    trades: number;
    winRate: number;
    pnl: number;
    disciplineScore: number;
  };
  previousWeek: {
    trades: number;
    winRate: number;
    pnl: number;
    disciplineScore: number;
  };
  change: {
    trades: number;  // % change
    winRate: number;
    pnl: number;
    disciplineScore: number;
  };
}

// Filtres avancés
export interface JournalFilters {
  dateRange?: { start: Date; end: Date };
  emotions?: TradeEmotion[];
  mistakes?: string[];
  strategies?: string[];
  symbols?: string[];
  sources?: ('binance' | 'bot' | 'ai' | 'manual')[];
  pnlRange?: { min?: number; max?: number };
  hasNotes?: boolean;
  hasScreenshot?: boolean;
  tags?: string[];
}

// Vue personnalisée
export interface JournalView {
  id: string;
  name: string;
  filters: JournalFilters;
  sortBy: 'date' | 'pnl' | 'emotion';
  sortOrder: 'asc' | 'desc';
  columns: string[];
  isDefault?: boolean;
}

// Suggestion IA
export interface AIJournalSuggestion {
  type: 'add_note' | 'review_trade' | 'check_pattern' | 'set_goal' | 'take_break';
  priority: 'low' | 'medium' | 'high';
  message: string;
  relatedTradeId?: string;
  actionLabel?: string;
}

// Résumé de session
export interface SessionSummary {
  sessionId: string;
  duration: number;  // minutes
  tradesCount: number;
  winRate: number;
  pnl: number;
  biggestWin: number;
  biggestLoss: number;
  emotions: TradeEmotion[];
  mistakes: string[];
  lessons: string;
  nextSessionGoals: string[];
}

// Comportement à risque
export interface RiskBehavior {
  type: 'position_size' | 'frequency' | 'drawdown' | 'emotion' | 'sl';
  risk: 'low' | 'medium' | 'high';
  currentValue: number;
  threshold: number;
  message: string;
  suggestion: string;
}

// État du store journal
export interface JournalState {
  entries: Record<string, JournalEntry>;
  isLoading: boolean;
  error: string | null;
  lastSync: Date | null;
  config: JournalConfig;
  activeFilters: JournalFilters;
  currentView: string;
  streakDays: number;
  notifications: JournalNotification[];
  goals: TradingGoal[];
  aiSuggestions: AIJournalSuggestion[];
}

// Actions du store journal
export interface JournalActions {
  addEntry: (tradeId: string, entry: JournalEntry) => void;
  updateEntry: (tradeId: string, updates: Partial<JournalEntry>) => void;
  deleteEntry: (tradeId: string) => void;
  loadEntries: () => Promise<void>;
  syncWithBackend: () => Promise<void>;
  runAIAnalysis: () => Promise<JournalAIAnalysis>;
  setFilter: (filters: Partial<JournalFilters>) => void;
  clearFilters: () => void;
  addGoal: (goal: TradingGoal) => void;
  updateGoal: (id: string, updates: Partial<TradingGoal>) => void;
  markNotificationRead: (id: string) => void;
  dismissSuggestion: (id: string) => void;
  exportData: (format: 'json' | 'csv' | 'pdf') => Promise<Blob>;
}

// Types combinés pour le store complet
export type JournalStore = JournalState & JournalActions;

// Helper types
export type MistakeType = 
  | 'Stop Loss non respecté'
  | 'Take Profit trop tôt'
  | 'Entrée sans setup clair'
  | 'Position trop large'
  | 'Trading émotionnel'
  | 'Revenge trading'
  | 'Overtrading'
  | 'Manque de patience'
  | 'Ignorer le plan'
  | 'FOMO entry';

export type JournalTab = 'trades' | 'analytics' | 'daily' | 'behavior' | 'goals' | 'settings';

export type ExportFormat = 'json' | 'csv' | 'pdf';

export type JournalSortField = 'date' | 'pnl' | 'symbol' | 'emotion' | 'strategy';

export type JournalSortOrder = 'asc' | 'desc';

// Props pour composants
export interface JournalEntryProps {
  entry: JournalEntry;
  trade: any;
  onEdit: () => void;
  onDelete: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export interface NoteFormProps {
  note: TradeNote;
  onChange: (note: TradeNote) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export interface BehaviorCardProps {
  pattern: BehavioralPattern;
  onDismiss: () => void;
  onAction: () => void;
}

export interface DisciplineScoreProps {
  metrics: DisciplineMetrics;
  trend: 'up' | 'down' | 'stable';
  previousScore: number;
}

export interface DailyJournalProps {
  date: Date;
  stats: DailyStats;
  trades: any[];
  entries: JournalEntry[];
  onAddNote: (tradeId: string) => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
}

export interface AIAnalysisPanelProps {
  analysis: JournalAIAnalysis;
  isLoading: boolean;
  onRefresh: () => void;
  onApplyRecommendation: (index: number) => void;
}

export interface EmotionSelectorProps {
  selected: TradeEmotion;
  onSelect: (emotion: TradeEmotion) => void;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export interface MistakeSelectorProps {
  selected: string[];
  onToggle: (mistake: string) => void;
  maxSelection?: number;
}

export interface ScreenshotUploaderProps {
  currentUrl?: string;
  onUpload: (file: File) => Promise<string>;
  onRemove: () => void;
  isUploading: boolean;
}

export interface JournalHeatmapProps {
  data: JournalHeatmapData[];
  year: number;
  onDayClick: (date: string) => void;
}

export interface StreakIndicatorProps {
  currentStreak: number;
  longestStreak: number;
  isActive: boolean;
  nextMilestone: number;
}

export interface GoalProgressProps {
  goal: TradingGoal;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateProgress: (value: number) => void;
}

export interface PatternListProps {
  patterns: BehavioralPattern[];
  onPatternClick: (pattern: BehavioralPattern) => void;
  onDismissPattern: (index: number) => void;
}

export interface CorrelationChartProps {
  correlations: EmotionPerformanceCorrelation[];
  type: 'emotion' | 'mistake' | 'time';
}

export interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat, filters?: JournalFilters) => void;
  isExporting: boolean;
}

export interface NotificationListProps {
  notifications: JournalNotification[];
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onAction: (notification: JournalNotification) => void;
}

// Constants
export const JOURNAL_CONSTANTS = {
  MIN_NOTE_LENGTH: 10,
  MAX_SCREENSHOT_SIZE: 5 * 1024 * 1024, // 5MB
  OVERTRADING_THRESHOLD: 5, // trades per day
  REVENGE_TIMEOUT_MINUTES: 30,
  STREAK_CHECK_HOUR: 23, // 23h00
  AI_MIN_TRADES_FOR_ANALYSIS: 3,
  MAX_JOURNAL_ENTRIES_EXPORT: 1000,
} as const;

// Emotion colors for UI
export const EMOTION_COLORS: Record<TradeEmotion, { bg: string; text: string; border: string }> = {
  confident: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  neutral: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
  stressed: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  fomo: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  revenge: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
};

// Default journal config
export const DEFAULT_JOURNAL_CONFIG: JournalConfig = {
  autoImportBinance: true,
  autoImportBot: true,
  autoImportAI: true,
  requireNotesBeforeClose: false,
  minNoteLength: 10,
  emotionTracking: true,
  screenshotEnabled: true,
};
